import { loadSharePointConfig } from "../integrations/sharepoint/config.js";
import { ClientSecretGraphAuthProvider } from "../integrations/sharepoint/auth.js";
import { GraphRequestError, SharePointGraphClient } from "../integrations/sharepoint/graphClient.js";
import { recapTransactionService } from "./recapTransactionService.js";
import { recapWorkspaceMappingRepository, WorkspaceProvisioningLockError } from "./recapWorkspaceMappingRepository.js";

const SITE_KEY = "working";
const MANAGED_ROOT_NAME = "Transactions";
const MAX_TRANSACTION_FOLDER_LENGTH = 180;
export const REQUIRED_WORKSPACE_FOLDERS = Object.freeze([
    "Incoming Documents", "Working Files", "Artifacts", "Reports", "AI Generated", "Archive",
]);

export class WorkspaceNotFoundError extends Error {
    constructor() { super("Authoritative recap transaction was not found"); this.name = "WorkspaceNotFoundError"; }
}

export class WorkspaceConflictError extends Error {
    constructor(message) { super(message); this.name = "WorkspaceConflictError"; }
}

export function buildTransactionFolderName(businessTransactionId, transactionName) {
    const safeName = String(transactionName || "")
        .replace(/[\u0000-\u001f\u007f"*%#:<>?\/\\{|}~]/g, "-")
        .replace(/\s+/g, " ")
        .replace(/-+/g, "-")
        .trim()
        .replace(/[. ]+$/g, "") || "Transaction";
    const prefix = `${businessTransactionId} - `;
    const available = MAX_TRANSACTION_FOLDER_LENGTH - prefix.length;
    const suffix = safeName.slice(0, Math.max(1, available)).replace(/[. ]+$/g, "") || "Transaction";
    return `${prefix}${suffix}`;
}

async function ensureExactFolder(graphClient, driveId, parentId, name) {
    const existing = await graphClient.findChildByExactName(driveId, parentId, name);
    if (existing) {
        if (existing.type !== "folder") throw new WorkspaceConflictError(`A non-folder item conflicts with required folder '${name}'`);
        return { item: existing, created: false };
    }
    try {
        return { item: await graphClient.createChildFolder(driveId, parentId, name), created: true };
    } catch (error) {
        if (error instanceof GraphRequestError && (error.status === 409 || error.graphCode === "nameAlreadyExists")) {
            const raced = await graphClient.findChildByExactName(driveId, parentId, name);
            if (raced?.type === "folder") return { item: raced, created: false };
            if (raced) throw new WorkspaceConflictError(`A non-folder item conflicts with required folder '${name}'`);
        }
        throw error;
    }
}

function defaultGraphClientFactory(config) {
    return new SharePointGraphClient(new ClientSecretGraphAuthProvider(config.credentials));
}

export function createRecapWorkspaceProvisioningService({
    transactionService = recapTransactionService,
    mappingRepository = recapWorkspaceMappingRepository,
    loadConfig = loadSharePointConfig,
    graphClientFactory = defaultGraphClientFactory,
} = {}) {
    return {
        async provisionWorkspace(businessTransactionId) {
            const transaction = await transactionService.getTransactionById(businessTransactionId);
            if (!transaction) throw new WorkspaceNotFoundError();

            const provisionUnderLock = async () => {
            const config = loadConfig();
            const workingTarget = config.sites.find((site) => site.key === SITE_KEY);
            if (!workingTarget) throw new WorkspaceConflictError("Configured working SharePoint target is unavailable");
            const graphClient = graphClientFactory(config);
            const site = await graphClient.resolveSite(workingTarget.hostname, workingTarget.sitePath);
            const drive = await graphClient.findDriveByName(site.id, workingTarget.libraryName);
            const driveRoot = await graphClient.getDriveRoot(drive.id);
            if (driveRoot.type !== "folder") throw new WorkspaceConflictError("Configured SharePoint drive root is not a folder");

            const mapping = await mappingRepository.getByTransaction(transaction.databaseId, SITE_KEY);
            let managedRoot;
            let managedRootCreated = false;
            let workspaceRoot;
            let workspaceCreated = false;

            if (mapping) {
                if (mapping.siteId !== site.id || mapping.driveId !== drive.id) {
                    throw new WorkspaceConflictError("Workspace mapping does not match the configured working SharePoint target");
                }
                managedRoot = await graphClient.findChildByExactName(drive.id, driveRoot.id, MANAGED_ROOT_NAME);
                if (!managedRoot || managedRoot.type !== "folder") {
                    throw new WorkspaceConflictError("Mapped Transactions parent is missing or invalid; reconciliation is required");
                }
                try {
                    workspaceRoot = await graphClient.getItem(drive.id, mapping.rootItemId);
                } catch (error) {
                    if (error instanceof GraphRequestError && error.status === 404) {
                        throw new WorkspaceConflictError("Mapped transaction workspace no longer exists; reconciliation is required");
                    }
                    throw error;
                }
                if (workspaceRoot.type !== "folder" || workspaceRoot.parentId !== managedRoot.id) {
                    throw new WorkspaceConflictError("Mapped transaction workspace is outside the managed Transactions subtree");
                }
                if (workspaceRoot.name !== mapping.folderName || workspaceRoot.webUrl !== mapping.webUrl) {
                    await mappingRepository.refreshLocation(transaction.databaseId, SITE_KEY, workspaceRoot);
                }
            } else {
                const managed = await ensureExactFolder(graphClient, drive.id, driveRoot.id, MANAGED_ROOT_NAME);
                managedRoot = managed.item;
                managedRootCreated = managed.created;

                const expectedName = buildTransactionFolderName(transaction.businessTransactionId, transaction.name);
                const prefix = `${transaction.businessTransactionId} - `.toLocaleLowerCase();
                const candidates = (await graphClient.listChildren(drive.id, managedRoot.id))
                    .filter((item) => item.name.toLocaleLowerCase().startsWith(prefix));
                if (candidates.length > 1 || candidates.some((item) => item.type !== "folder")) {
                    throw new WorkspaceConflictError("Transaction workspace candidates are ambiguous or conflict with a non-folder item");
                }
                if (candidates.length === 1) {
                    workspaceRoot = candidates[0];
                } else {
                    const created = await ensureExactFolder(graphClient, drive.id, managedRoot.id, expectedName);
                    workspaceRoot = created.item;
                    workspaceCreated = created.created;
                }

                const persisted = await mappingRepository.createOrGet({
                    recapTransactionId: transaction.databaseId,
                    siteKey: SITE_KEY,
                    siteId: site.id,
                    driveId: drive.id,
                    rootItemId: workspaceRoot.id,
                    folderName: workspaceRoot.name,
                    webUrl: workspaceRoot.webUrl,
                });
                if (!persisted
                    || persisted.siteId !== site.id
                    || persisted.driveId !== drive.id
                    || persisted.rootItemId !== workspaceRoot.id) {
                    throw new WorkspaceConflictError("A different workspace mapping already exists; reconciliation is required");
                }
            }

            const createdFolders = [];
            const reusedFolders = [];
            for (const folderName of REQUIRED_WORKSPACE_FOLDERS) {
                const result = await ensureExactFolder(graphClient, drive.id, workspaceRoot.id, folderName);
                (result.created ? createdFolders : reusedFolders).push(folderName);
            }

            return {
                transactionId: transaction.businessTransactionId,
                workspaceProvisioned: true,
                transactionsRoot: managedRootCreated ? "created" : "reused",
                workspace: { status: workspaceCreated ? "created" : "reused", folderName: workspaceRoot.name, webUrl: workspaceRoot.webUrl },
                requiredFoldersReady: true,
                folders: { created: createdFolders, reused: reusedFolders },
            };
            };

            try {
                return await mappingRepository.withProvisioningLock(transaction.databaseId, SITE_KEY, provisionUnderLock);
            } catch (error) {
                if (error instanceof WorkspaceProvisioningLockError) {
                    throw new WorkspaceConflictError(error.message);
                }
                throw error;
            }
        },
    };
}

export const recapWorkspaceProvisioningService = createRecapWorkspaceProvisioningService();

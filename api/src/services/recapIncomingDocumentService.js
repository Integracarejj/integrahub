import { createHash } from "node:crypto";
import { loadSharePointConfig } from "../integrations/sharepoint/config.js";
import { ClientSecretGraphAuthProvider } from "../integrations/sharepoint/auth.js";
import { GraphRequestError, SharePointGraphClient } from "../integrations/sharepoint/graphClient.js";
import { recapTransactionService } from "./recapTransactionService.js";
import { recapWorkspaceMappingRepository } from "./recapWorkspaceMappingRepository.js";
import { recapWorkspaceProvisioningService } from "./recapWorkspaceProvisioningService.js";
import { recapIncomingDocumentRepository } from "./recapIncomingDocumentRepository.js";

export const MAX_INCOMING_PACKAGE_BYTES = 10 * 1024 * 1024;
const SITE_KEY = "working";
const INCOMING_FOLDER = "Incoming Documents";

export class IncomingDocumentValidationError extends Error {}
export class IncomingDocumentForbiddenError extends Error {}
export class IncomingDocumentConflictError extends Error {}

function sanitizeFileName(name) {
    if (typeof name !== "string" || name.length > 255) throw new IncomingDocumentValidationError("A valid file name is required");
    const normalized = String(name || "")
        .replace(/[\u0000-\u001f\u007f"*%#:<>?\/\\{|}~]/g, "-")
        .replace(/\s+/g, " ")
        .replace(/-+/g, "-")
        .trim()
        .replace(/[. ]+$/g, "");
    if (!normalized) throw new IncomingDocumentValidationError("A valid file name is required");
    const extensionIndex = normalized.lastIndexOf(".");
    const extension = extensionIndex > 0 ? normalized.slice(extensionIndex).slice(0, 16) : "";
    const base = extensionIndex > 0 ? normalized.slice(0, extensionIndex) : normalized;
    return { base: base.slice(0, 170) || "Package", extension };
}

function buildStoredFileName(originalFileName, sourcePackageId) {
    const { base, extension } = sanitizeFileName(originalFileName);
    const packageSuffix = sourcePackageId.replace(/[^A-Za-z0-9_-]/g, "-").replace(/-+/g, "-").slice(-48) || "package";
    return `${base} - ${packageSuffix}${extension}`.replace(/[. ]+$/g, "");
}

function toResult(document) {
    return {
        documentId: document.id,
        sourcePackageId: document.sourcePackageId,
        originalFileName: document.originalFileName,
        storedFileName: document.storedFileName,
        size: Number(document.contentSize),
        status: document.status,
        webUrl: document.webUrl,
        uploadedAt: document.uploadedAt,
    };
}

export function createRecapIncomingDocumentService({
    transactionService = recapTransactionService,
    workspaceService = recapWorkspaceProvisioningService,
    mappingRepository = recapWorkspaceMappingRepository,
    documentRepository = recapIncomingDocumentRepository,
    loadConfig = loadSharePointConfig,
    graphClientFactory = (config) => new SharePointGraphClient(new ClientSecretGraphAuthProvider(config.credentials)),
} = {}) {
    return {
        async getExternalOrganizationForUser(userId) {
            return documentRepository.getDefaultExternalOrganizationForUser(userId);
        },

        async uploadIncomingPackage({ businessTransactionId, sourcePackageId, originalFileName, content, actor }) {
            if (!Buffer.isBuffer(content) || content.length === 0) throw new IncomingDocumentValidationError("A non-empty package file is required");
            if (content.length > MAX_INCOMING_PACKAGE_BYTES) throw new IncomingDocumentValidationError("Package files must be 10 MiB or smaller");
            if (!sourcePackageId || sourcePackageId.length > 128) throw new IncomingDocumentValidationError("A valid source package ID is required");

            const transaction = await transactionService.getTransactionById(businessTransactionId);
            if (!transaction) throw new IncomingDocumentValidationError("Authoritative transaction was not found");
            const organizationId = transaction.owningExternalOrganizationId;
            const hasOrganizationAccess = organizationId
                ? await documentRepository.userHasExternalOrganization(actor.id, organizationId)
                : false;
            if (!hasOrganizationAccess) {
                throw new IncomingDocumentForbiddenError("Transaction access denied");
            }

            const storedFileName = buildStoredFileName(originalFileName, sourcePackageId);
            const contentSha256 = createHash("sha256").update(content).digest("hex");
            await workspaceService.provisionWorkspace(transaction.businessTransactionId);

            return mappingRepository.withProvisioningLock(transaction.databaseId, SITE_KEY, async () => {
                let document = await documentRepository.getByPackage(transaction.databaseId, sourcePackageId);
                if (document && (document.contentSha256 !== contentSha256 || Number(document.contentSize) !== content.length)) {
                    throw new IncomingDocumentConflictError("Package ID is already associated with different content");
                }
                if (document?.status === "Uploaded") return toResult(document);
                if (!document) {
                    document = await documentRepository.createPending({
                        recapTransactionId: transaction.databaseId,
                        sourcePackageId,
                        originalFileName,
                        storedFileName,
                        contentSha256,
                        contentSize: content.length,
                        uploadedBy: actor.id,
                        externalOrganizationId: organizationId,
                    });
                }

                const mapping = await mappingRepository.getByTransaction(transaction.databaseId, SITE_KEY);
                if (!mapping) throw new IncomingDocumentConflictError("Transaction workspace mapping is unavailable");
                const config = loadConfig();
                const graph = graphClientFactory(config);
                const incoming = await graph.findChildByExactName(mapping.driveId, mapping.rootItemId, INCOMING_FOLDER);
                if (!incoming || incoming.type !== "folder") throw new IncomingDocumentConflictError("Incoming Documents folder is unavailable");
                const collision = await graph.findChildByExactName(mapping.driveId, incoming.id, document.storedFileName);
                let uploaded;
                if (collision) {
                    if (collision.type !== "file" || collision.size !== content.length) {
                        throw new IncomingDocumentConflictError("Stored package filename conflicts with existing SharePoint content");
                    }
                    uploaded = collision;
                } else {
                    try {
                        uploaded = await graph.uploadNewFile(mapping.driveId, incoming.id, document.storedFileName, content);
                    } catch (error) {
                        if (error instanceof GraphRequestError && (error.status === 409 || error.status === 412 || error.graphCode === "nameAlreadyExists")) {
                            throw new IncomingDocumentConflictError("Stored package filename conflicts with existing SharePoint content");
                        }
                        throw error;
                    }
                }
                const completed = await documentRepository.markUploaded(document.id, {
                    driveId: mapping.driveId,
                    itemId: uploaded.id,
                    webUrl: uploaded.webUrl,
                });
                return toResult(completed || { ...document, status: "Uploaded", webUrl: uploaded.webUrl, uploadedAt: new Date() });
            });
        },
    };
}

export const recapIncomingDocumentService = createRecapIncomingDocumentService();

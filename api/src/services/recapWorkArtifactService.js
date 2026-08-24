import { createHash } from "node:crypto";
import { loadSharePointConfig } from "../integrations/sharepoint/config.js";
import { ClientSecretGraphAuthProvider } from "../integrations/sharepoint/auth.js";
import { GraphRequestError, SharePointGraphClient } from "../integrations/sharepoint/graphClient.js";
import { recapWorkspaceMappingRepository } from "./recapWorkspaceMappingRepository.js";
import { recapWorkspaceProvisioningService } from "./recapWorkspaceProvisioningService.js";
import { recapWorkArtifactRepository } from "./recapWorkArtifactRepository.js";

export const MAX_WORK_ARTIFACT_BYTES = 10 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ARTIFACTS_FOLDER = "Artifacts";
const ALLOWED_EXTENSIONS = new Set(["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "png", "jpg", "jpeg", "gif", "webp", "tif", "tiff"]);
const ALLOWED_CONTENT_TYPES = new Set([
    "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain", "text/csv", "image/png", "image/jpeg", "image/gif", "image/webp", "image/tiff", "application/octet-stream",
]);

export class WorkArtifactValidationError extends Error {}
export class WorkArtifactForbiddenError extends Error {}
export class WorkArtifactConflictError extends Error {}
export class WorkArtifactNotFoundError extends Error {}

function sanitizeFileName(name) {
    if (typeof name !== "string" || !name.trim() || name.length > 255) throw new WorkArtifactValidationError("A valid file name is required");
    const clean = name.replace(/[\u0000-\u001f\u007f"*%#:<>?\/\\{|}~]/g, "-").replace(/\s+/g, " ").replace(/-+/g, "-").trim().replace(/[. ]+$/g, "");
    const dot = clean.lastIndexOf(".");
    const extension = dot > 0 ? clean.slice(dot + 1).toLowerCase() : "";
    if (!clean || !ALLOWED_EXTENSIONS.has(extension)) throw new WorkArtifactValidationError("Unsupported work artifact file type");
    return { clean, extension, base: clean.slice(0, dot).slice(0, 170) || "Artifact" };
}

function sanitizeFolderPart(value, max = 120) {
    return String(value || "Work Item").replace(/[\u0000-\u001f\u007f"*%#:<>?\/\\{|}~]/g, "-").replace(/\s+/g, " ").replace(/-+/g, "-").trim().replace(/[. ]+$/g, "").slice(0, max) || "Work Item";
}

function isOperations(actor) { return ["PlatformAdmin", "DDTeam"].includes(actor?.globalRole); }
function canRead(context, actor) { return !!actor?.id && (context.assignedUserId === actor.id || isOperations(actor)); }
function toArtifact(row) { return { id: String(row.id), fileName: row.originalFileName, contentType: row.contentType, size: Number(row.contentSize), status: row.status, uploadedBy: row.uploadedBy || null, uploadedAt: row.uploadedAt }; }
function toSource(row) { return { id: String(row.id), fileName: row.originalFileName, contentType: "application/octet-stream", size: Number(row.contentSize), uploadedAt: row.uploadedAt }; }

export function createRecapWorkArtifactService({
    repository = recapWorkArtifactRepository,
    workspaceService = recapWorkspaceProvisioningService,
    mappingRepository = recapWorkspaceMappingRepository,
    loadConfig = loadSharePointConfig,
    graphClientFactory = config => new SharePointGraphClient(new ClientSecretGraphAuthProvider(config.credentials)),
} = {}) {
    async function contextFor(workItemId) {
        if (!UUID.test(workItemId)) throw new WorkArtifactValidationError("Invalid work item");
        const context = await repository.getWorkItemContext(workItemId);
        if (!context) throw new WorkArtifactNotFoundError("Work item not found");
        return context;
    }
    async function graph() { return graphClientFactory(loadConfig()); }
    return {
        async upload({ workItemId, originalFileName, contentType, content, actor }) {
            const context = await contextFor(workItemId);
            if (context.status !== "In Progress" || context.assignedUserId !== actor?.id) throw new WorkArtifactForbiddenError("Artifact upload is restricted to the active owner");
            if (!Buffer.isBuffer(content) || !content.length || content.length > MAX_WORK_ARTIFACT_BYTES) throw new WorkArtifactValidationError("Work artifacts must be between 1 byte and 10 MiB");
            const file = sanitizeFileName(originalFileName);
            const safeContentType = String(contentType || "application/octet-stream").toLowerCase().slice(0, 128);
            if (!ALLOWED_CONTENT_TYPES.has(safeContentType)) throw new WorkArtifactValidationError("Unsupported work artifact content type");
            const sha = createHash("sha256").update(content).digest("hex");
            const storedFileName = `${file.base} - ${sha.slice(0, 12)}.${file.extension}`;
            await workspaceService.provisionWorkspace(context.businessTransactionId);
            return mappingRepository.withProvisioningLock(context.transactionDatabaseId, "working", async () => {
                const existing = await repository.findByContent(workItemId, sha, storedFileName);
                if (existing?.status === "Uploaded") return toArtifact({ ...existing, uploadedBy: null });
                const mapping = await mappingRepository.getByTransaction(context.transactionDatabaseId, "working");
                if (!mapping) throw new WorkArtifactConflictError("Transaction workspace mapping is unavailable");
                const client = await graph();
                const artifactsRoot = await client.findChildByExactName(mapping.driveId, mapping.rootItemId, ARTIFACTS_FOLDER);
                if (!artifactsRoot || artifactsRoot.type !== "folder") throw new WorkArtifactConflictError("Artifacts folder is unavailable");
                let folder = await repository.getFolder(workItemId);
                if (folder) {
                    const actual = await client.getItem(mapping.driveId, folder.folderItemId);
                    if (actual.type !== "folder" || actual.parentId !== artifactsRoot.id) throw new WorkArtifactConflictError("Work item artifact folder is invalid");
                } else {
                    const folderName = `${context.requestNumber} - ${sanitizeFolderPart(context.title)}`.slice(0, 180).replace(/[. ]+$/g, "");
                    let item = await client.findChildByExactName(mapping.driveId, artifactsRoot.id, folderName);
                    if (item && item.type !== "folder") throw new WorkArtifactConflictError("Work item folder name conflicts with a file");
                    if (!item) {
                        try { item = await client.createChildFolder(mapping.driveId, artifactsRoot.id, folderName); }
                        catch (error) {
                            if (!(error instanceof GraphRequestError) || ![409, 412].includes(error.status)) throw error;
                            item = await client.findChildByExactName(mapping.driveId, artifactsRoot.id, folderName);
                            if (!item || item.type !== "folder") throw new WorkArtifactConflictError("Work item folder creation conflicted");
                        }
                    }
                    folder = await repository.createOrGetFolder({ workItemId, siteId: mapping.siteId, driveId: mapping.driveId, folderItemId: item.id, folderName: item.name, webUrl: item.webUrl });
                    if (!folder || folder.folderItemId !== item.id) throw new WorkArtifactConflictError("A different WorkItem folder mapping exists");
                }
                let pending = existing;
                if (pending?.status === "Failed") { await repository.restartFailed(pending.id, actor.id); pending = { ...pending, status: "Pending", uploadedByUserId: actor.id }; }
                if (!pending) pending = await repository.createPending({ workItemId, originalFileName: file.clean, storedFileName, contentType: safeContentType, contentSize: content.length, contentSha256: sha, uploadedByUserId: actor.id });
                try {
                    let uploaded = await client.findChildByExactName(mapping.driveId, folder.folderItemId, storedFileName);
                    if (uploaded) throw new WorkArtifactConflictError("Artifact filename conflicts with existing SharePoint content");
                    if (!uploaded) {
                        try { uploaded = await client.uploadNewFile(mapping.driveId, folder.folderItemId, storedFileName, content); }
                        catch (error) {
                            if (!(error instanceof GraphRequestError) || ![409, 412].includes(error.status)) throw error;
                            throw new WorkArtifactConflictError("Artifact filename conflicts with existing SharePoint content");
                        }
                    }
                    const completed = await repository.markUploaded(pending.id, mapping.driveId, uploaded);
                    return toArtifact(completed || { ...pending, status: "Uploaded", uploadedAt: new Date().toISOString() });
                } catch (error) {
                    await repository.markFailed(pending.id);
                    throw error;
                }
            });
        },
        async list(workItemId, actor) {
            const context = await contextFor(workItemId);
            if (!canRead(context, actor)) throw new WorkArtifactForbiddenError("Artifact access denied");
            return (await repository.list(workItemId)).map(toArtifact);
        },
        async listSources(workItemId, actor) {
            const context = await contextFor(workItemId);
            if (!canRead(context, actor)) throw new WorkArtifactForbiddenError("Source document access denied");
            return (await repository.listSourceDocuments(context)).map(toSource);
        },
        async downloadArtifact(workItemId, artifactId, actor) {
            const context = await contextFor(workItemId);
            if (!canRead(context, actor) || !UUID.test(artifactId)) throw new WorkArtifactForbiddenError("Artifact access denied");
            const artifact = await repository.getForDownload(workItemId, artifactId);
            if (!artifact) throw new WorkArtifactNotFoundError("Artifact not found");
            return { ...(await (await graph()).downloadFile(artifact.driveId, artifact.itemId, { maxBytes: MAX_WORK_ARTIFACT_BYTES, expectedSize: Number(artifact.contentSize) })), fileName: artifact.originalFileName, contentType: artifact.contentType };
        },
        async downloadSource(workItemId, documentId, actor) {
            const context = await contextFor(workItemId);
            if (!canRead(context, actor) || !UUID.test(documentId)) throw new WorkArtifactForbiddenError("Source document access denied");
            const source = await repository.getSourceForDownload(context, documentId);
            if (!source) throw new WorkArtifactNotFoundError("Source document not found");
            return { ...(await (await graph()).downloadFile(source.driveId, source.itemId, { maxBytes: MAX_WORK_ARTIFACT_BYTES, expectedSize: Number(source.contentSize) })), fileName: source.originalFileName };
        },
    };
}

export const recapWorkArtifactService = createRecapWorkArtifactService();

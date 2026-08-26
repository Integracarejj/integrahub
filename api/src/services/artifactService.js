import { createHash, randomUUID } from "node:crypto";
import { loadSharePointConfig, getArtifactDestinationTarget } from "../integrations/sharepoint/config.js";
import { ClientSecretGraphAuthProvider } from "../integrations/sharepoint/auth.js";
import { GraphRequestError, SharePointGraphClient } from "../integrations/sharepoint/graphClient.js";
import { artifactRepository } from "./artifactRepository.js";

export const MAX_ARTIFACT_BYTES = 10 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9._:-]{8,128}$/;
const READ_ROLES = new Set(["Viewer", "Editor", "PlatformAdmin", "DDTeam"]);
const UPLOAD_ROLES = new Set(["Editor", "PlatformAdmin"]);
const MIME_BY_EXTENSION = new Map([
    ["pdf", new Set(["application/pdf"])],
    ["doc", new Set(["application/msword"])],
    ["docx", new Set(["application/vnd.openxmlformats-officedocument.wordprocessingml.document"])],
    ["xls", new Set(["application/vnd.ms-excel"])],
    ["xlsx", new Set(["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"])],
    ["ppt", new Set(["application/vnd.ms-powerpoint"])],
    ["pptx", new Set(["application/vnd.openxmlformats-officedocument.presentationml.presentation"])],
    ["txt", new Set(["text/plain"])], ["csv", new Set(["text/csv", "application/csv"])],
    ["png", new Set(["image/png"])], ["jpg", new Set(["image/jpeg"])], ["jpeg", new Set(["image/jpeg"])],
    ["gif", new Set(["image/gif"])], ["webp", new Set(["image/webp"])],
    ["tif", new Set(["image/tiff"])], ["tiff", new Set(["image/tiff"])],
]);
const FILE_TYPE_EXTENSIONS = Object.freeze({
    pdf: ["pdf"], word: ["doc", "docx"], excel: ["xls", "xlsx"],
    powerpoint: ["ppt", "pptx"], text: ["txt", "csv"],
    images: ["png", "jpg", "jpeg", "gif", "webp", "tif", "tiff"],
});

export class ArtifactValidationError extends Error {}
export class ArtifactForbiddenError extends Error {}
export class ArtifactConflictError extends Error {}
export class ArtifactNotFoundError extends Error {}
export class ArtifactRecoveryRequiredError extends Error {}

function requireActor(actor, roles) {
    if (!actor?.id || !roles.has(actor.globalRole)) throw new ArtifactForbiddenError("Artifact access denied");
}

function sanitizeFileName(name, contentType) {
    if (typeof name !== "string" || !name.trim() || name.length > 255) throw new ArtifactValidationError("A valid file name is required");
    const clean = name.replace(/[\u0000-\u001f\u007f"*%#:<>?\/\\{|}~]/g, "-").replace(/\s+/g, " ").replace(/-+/g, "-").trim().replace(/[. ]+$/g, "");
    const dot = clean.lastIndexOf(".");
    const extension = dot > 0 ? clean.slice(dot + 1).toLowerCase() : "";
    const normalizedContentType = String(contentType || "").split(";", 1)[0].trim().toLowerCase();
    if (!clean || !MIME_BY_EXTENSION.get(extension)?.has(normalizedContentType)) throw new ArtifactValidationError("Unsupported artifact extension or content type");
    return { clean, extension, contentType: normalizedContentType, base: clean.slice(0, dot).slice(0, 120) || "Artifact" };
}

function safeArtifact(row) {
    return {
        id: String(row.id), fileName: row.originalFileName, extension: row.fileExtension,
        contentType: row.contentType, size: Number(row.contentSize), ingestionState: row.ingestionState,
        classificationState: row.classificationState, lifecycleState: row.lifecycleState,
        storageDestination: row.storageDestination, libraryKey: row.libraryKey,
        sourceOrigin: row.sourceOrigin, sourceModule: row.sourceModule, sourceContext: row.sourceContext || null,
        description: row.description || null, effectiveDate: row.effectiveDate || null,
        submittedByUserId: row.submittedByUserId, uploadedAt: row.uploadedAt || null,
        createdAt: row.createdAt, updatedAt: row.updatedAt,
    };
}

function sameRequest(row, values) {
    return row.contentSha256 === values.contentSha256 && Number(row.contentSize) === values.contentSize
        && row.originalFileName === values.originalFileName && row.contentType === values.contentType
        && row.libraryKey === values.libraryKey && (row.sourceContext || null) === (values.sourceContext || null);
}

export function createArtifactService({
    repository = artifactRepository,
    loadConfig = loadSharePointConfig,
    graphClientFactory = config => new SharePointGraphClient(new ClientSecretGraphAuthProvider(config.credentials)),
    generateUuid = randomUUID,
} = {}) {
    async function graphContext(libraryKey) {
        const config = loadConfig();
        const target = getArtifactDestinationTarget(config, libraryKey);
        const client = graphClientFactory(config);
        const site = await client.resolveSite(target.hostname, target.sitePath);
        const drive = await client.findDriveByName(site.id, target.libraryName);
        const root = await client.getDriveRoot(drive.id);
        return { client, site, drive, root };
    }

    async function verifyOwnedRemote(client, row, driveId, item) {
        if (item.type !== "file" || item.name !== row.storedFileName || Number(item.size) !== Number(row.contentSize)) {
            throw new ArtifactConflictError("Artifact storage collision could not be verified");
        }
        const downloaded = await client.downloadFile(driveId, item.id, { maxBytes: MAX_ARTIFACT_BYTES, expectedSize: Number(row.contentSize) });
        const actualHash = createHash("sha256").update(downloaded.content).digest("hex");
        if (actualHash !== row.contentSha256) throw new ArtifactConflictError("Artifact storage collision could not be verified");
    }

    return {
        async upload({ originalFileName, contentType, content, libraryKey, idempotencyKey, sourceContext, actor }) {
            requireActor(actor, UPLOAD_ROLES);
            if (!IDEMPOTENCY_KEY.test(String(idempotencyKey || ""))) throw new ArtifactValidationError("A valid Idempotency-Key is required");
            if (!["Projects", "Legal", "Operations"].includes(libraryKey)) throw new ArtifactValidationError("Invalid Artifact Hub destination");
            if (!Buffer.isBuffer(content) || content.length < 1 || content.length > MAX_ARTIFACT_BYTES) throw new ArtifactValidationError("Artifacts must be between 1 byte and 10 MiB");
            if (sourceContext != null && (typeof sourceContext !== "string" || sourceContext.length > 255)) throw new ArtifactValidationError("Invalid source context");
            const file = sanitizeFileName(originalFileName, contentType);
            const contentSha256 = createHash("sha256").update(content).digest("hex");
            const requested = { originalFileName: file.clean, contentType: file.contentType, contentSize: content.length, contentSha256, libraryKey, sourceContext: sourceContext || null };

            return repository.withIdempotencyLock(actor.id, idempotencyKey, async () => {
                let row = await repository.getByIdempotency(actor.id, idempotencyKey);
                if (row && !sameRequest(row, requested)) throw new ArtifactConflictError("Idempotency-Key was already used for a different artifact request");
                if (row?.ingestionState === "Uploaded") return safeArtifact(row);
                if (!row) {
                    const id = generateUuid();
                    const storedFileName = `${id}-${contentSha256.slice(0, 12)}-${file.base}.${file.extension}`;
                    row = await repository.createPending({ id, ...requested, storedFileName, fileExtension: file.extension,
                        sourceOrigin: "Internal Artifact Upload", sourceModule: "ArtifactHub",
                        submittedByUserId: actor.id, idempotencyKey });
                } else if (row.ingestionState === "Failed") {
                    row = await repository.restartFailed(row.id, actor.id, idempotencyKey);
                }

                let remoteIsDurable = !!row.itemId;
                try {
                    const { client, site, drive, root } = await graphContext(libraryKey);
                    let item;
                    if (row.itemId) {
                        if (row.siteId !== site.id || row.driveId !== drive.id) throw new ArtifactConflictError("Recorded Artifact storage destination is inconsistent");
                        item = await client.getItem(drive.id, row.itemId);
                        await verifyOwnedRemote(client, row, drive.id, item);
                    } else {
                        item = await client.findChildByExactName(drive.id, root.id, row.storedFileName);
                        if (item) {
                            await verifyOwnedRemote(client, row, drive.id, item);
                            remoteIsDurable = true;
                        } else {
                            item = await client.uploadNewFile(drive.id, root.id, row.storedFileName, content);
                            remoteIsDurable = true;
                        }
                        row = await repository.recordGraphReceipt(row.id, { siteId: site.id, driveId: drive.id, itemId: item.id, webUrl: item.webUrl });
                        if (!row?.itemId) throw new ArtifactRecoveryRequiredError("Artifact upload requires reconciliation");
                    }
                    const completed = await repository.markUploaded(row.id, actor.id, idempotencyKey);
                    if (!completed || completed.ingestionState !== "Uploaded") throw new ArtifactRecoveryRequiredError("Artifact upload requires reconciliation");
                    return safeArtifact(completed);
                } catch (error) {
                    if (remoteIsDurable) throw error instanceof ArtifactConflictError ? error : new ArtifactRecoveryRequiredError("Artifact bytes are durable but SQL finalization requires retry", { cause: error });
                    try { await repository.markFailed(row.id, actor.id, idempotencyKey, error instanceof GraphRequestError ? error.graphCode || "graph_error" : "upload_error"); } catch { /* Preserve the original safe failure. */ }
                    if (error instanceof GraphRequestError && [409, 412].includes(error.status)) throw new ArtifactConflictError("Artifact storage collision prevented upload");
                    throw error;
                }
            });
        },

        async get(id, actor) {
            requireActor(actor, READ_ROLES);
            if (!UUID.test(id)) throw new ArtifactValidationError("Invalid artifact ID");
            const row = await repository.getForRead(id);
            if (!row || row.lifecycleState === "Removed") throw new ArtifactNotFoundError("Artifact not found");
            return safeArtifact(row);
        },

        async list({ page = 1, pageSize = 25, libraryKey = null, q = "", fileType = "", dateRange = "all", sort = "newest" } = {}, actor) {
            requireActor(actor, READ_ROLES);
            const safePage = Number(page); const safePageSize = Number(pageSize);
            if (!Number.isInteger(safePage) || safePage < 1 || !Number.isInteger(safePageSize) || safePageSize < 1 || safePageSize > 100) throw new ArtifactValidationError("Invalid pagination");
            if (libraryKey && !["Projects", "Legal", "Operations"].includes(libraryKey)) throw new ArtifactValidationError("Invalid Artifact Hub destination");
            const safeQuery = String(q || "").trim();
            if (safeQuery.length > 200) throw new ArtifactValidationError("Search text is too long");
            if (fileType && !FILE_TYPE_EXTENSIONS[fileType]) throw new ArtifactValidationError("Invalid file type filter");
            if (!["all", "today", "7days", "30days"].includes(dateRange)) throw new ArtifactValidationError("Invalid uploaded date filter");
            if (!["newest", "name", "area"].includes(sort)) throw new ArtifactValidationError("Invalid artifact sort");
            const days = dateRange === "today" ? 0 : dateRange === "7days" ? 7 : dateRange === "30days" ? 30 : null;
            const uploadedFrom = days == null ? null : new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
            const result = await repository.list({ pageSize: safePageSize, offset: (safePage - 1) * safePageSize,
                libraryKey, q: safeQuery || null, extensions: FILE_TYPE_EXTENSIONS[fileType] || [], uploadedFrom, sort });
            return { artifacts: result.rows.map(safeArtifact), total: result.total, page: safePage, pageSize: safePageSize };
        },

        async download(id, actor) {
            requireActor(actor, READ_ROLES);
            if (!UUID.test(id)) throw new ArtifactValidationError("Invalid artifact ID");
            const row = await repository.getForRead(id);
            if (!row || row.ingestionState !== "Uploaded" || row.lifecycleState === "Removed" || !row.driveId || !row.itemId) throw new ArtifactNotFoundError("Artifact not found");
            const client = graphClientFactory(loadConfig());
            const file = await client.downloadFile(row.driveId, row.itemId, { maxBytes: MAX_ARTIFACT_BYTES, expectedSize: Number(row.contentSize) });
            await repository.appendEvent({ artifactId: row.id, eventType: "ArtifactDownloaded", actorUserId: actor.id, correlationId: null });
            return { ...file, fileName: row.originalFileName, contentType: row.contentType };
        },
    };
}

export const artifactService = createArtifactService();

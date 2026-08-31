import { createHash, randomUUID } from "node:crypto";
import { loadSharePointConfig, getArtifactDestinationTarget, getSharePointSiteTarget } from "../integrations/sharepoint/config.js";
import { ClientSecretGraphAuthProvider } from "../integrations/sharepoint/auth.js";
import { GraphRequestError, SharePointGraphClient } from "../integrations/sharepoint/graphClient.js";
import { ArtifactStoredIdentityConflictError, artifactRepository } from "./artifactRepository.js";

export const MAX_ARTIFACT_BYTES = 10 * 1024 * 1024;
export const MAX_STORED_ARTIFACT_BYTES = 20 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9._:-]{8,128}$/;
const READ_ROLES = new Set(["Viewer", "Editor", "PlatformAdmin", "DDTeam"]);
const UPLOAD_ROLES = new Set(["Editor", "PlatformAdmin"]);
const METADATA_WRITE_ROLES = UPLOAD_ROLES;
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
export class ArtifactIntegrityError extends Error {
    constructor(diagnostics) { super("Artifact content integrity check failed"); this.name = "ArtifactIntegrityError"; this.diagnostics = diagnostics; }
}
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
        documentTitle: row.documentTitle || null,
        documentType: row.documentTypeKey ? { key: row.documentTypeKey, displayName: row.documentTypeName } : null,
        businessTopic: row.businessTopicSlug ? { slug: row.businessTopicSlug, name: row.businessTopicName, group: row.businessTopicGroup } : null,
        documentOrigin: row.documentOrigin || null, description: row.description || null, effectiveDate: row.effectiveDate || null,
        submittedByDisplayName: row.submittedByDisplayName || row.submittedByEmail || "Unknown user", uploadedAt: row.uploadedAt || null,
        createdAt: row.createdAt, updatedAt: row.updatedAt,
    };
}

function optionalText(value, field, maxLength) {
    if (value == null || value === "") return null;
    if (typeof value !== "string") throw new ArtifactValidationError(`${field} must be text`);
    const clean = value.trim();
    if (!clean) return null;
    if (clean.length > maxLength) throw new ArtifactValidationError(`${field} is too long`);
    return clean;
}

function metadataValues(input) {
    return {
        documentTitle: optionalText(input.documentTitle, "Document title", 255),
        documentOrigin: optionalText(input.documentOrigin, "Document origin", 255),
        documentTypeKey: optionalText(input.documentTypeKey, "Document type", 64),
        businessTopicSlug: optionalText(input.businessTopicSlug, "Business topic", 64),
        description: optionalText(input.description, "Description", 2000),
    };
}

function sameRequest(row, values) {
    return row.contentSha256 === values.contentSha256 && Number(row.contentSize) === values.contentSize
        && row.originalFileName === values.originalFileName && row.contentType === values.contentType
        && row.storageDestination === values.storageDestination
        && (row.libraryKey || null) === (values.libraryKey || null)
        && (row.sourceContext || null) === (values.sourceContext || null);
}

export function createArtifactService({
    repository = artifactRepository,
    loadConfig = loadSharePointConfig,
    graphClientFactory = config => new SharePointGraphClient(new ClientSecretGraphAuthProvider(config.credentials)),
    generateUuid = randomUUID,
    logInfo = (message, fields) => console.info(message, fields),
} = {}) {
    function uploadSizeTelemetry(stage, inputByteSize, item, sizeField, matchField) {
        const observedSize = typeof item.size === "number" && Number.isSafeInteger(item.size) ? item.size : null;
        logInfo("Artifact upload size telemetry", {
            stage, inputByteSize, [sizeField]: observedSize,
            [matchField]: observedSize === inputByteSize,
            sizeDeltaBytes: observedSize == null ? null : observedSize - inputByteSize,
            [stage === "artifact-upload-response" ? "uploadResponseLastModifiedDateTime" : "postUploadLastModifiedDateTime"]:
                item.lastModifiedDateTime || null,
        });
    }

    async function graphContext(storageDestination, libraryKey) {
        const config = loadConfig();
        const target = storageDestination === "Knowledge"
            ? getSharePointSiteTarget(config, "knowledge")
            : getArtifactDestinationTarget(config, libraryKey);
        const client = graphClientFactory(config);
        const site = await client.resolveSite(target.hostname, target.sitePath);
        const drive = await client.findDriveByName(site.id, target.libraryName);
        const root = await client.getDriveRoot(drive.id);
        return { client, site, drive, root };
    }

    function integrityDiagnostics({ expectedStoredSize = null, observedSize = null, sizeMatched = null,
        hashMatched = null, storedIdentityExisted, lifecycleStage }) {
        return { expectedStoredSize, observedSize, sizeMatched, hashMatched,
            storedIdentityExisted: !!storedIdentityExisted, lifecycleStage };
    }

    async function observeStoredIdentity(client, row, driveId, item, lifecycleStage, verifiedFile = null) {
        if (!item || item.type !== "file" || item.name !== row.storedFileName) {
            throw new ArtifactConflictError("Recorded Artifact storage item is inconsistent");
        }
        const metadataSize = typeof item.size === "number" && Number.isSafeInteger(item.size) && item.size > 0
            && item.size <= MAX_STORED_ARTIFACT_BYTES ? item.size : null;
        if (metadataSize == null) throw new GraphRequestError("SharePoint item metadata", null, "invalid_size_boundary");
        const file = verifiedFile || await client.downloadFile(driveId, item.id, {
            maxBytes: MAX_STORED_ARTIFACT_BYTES, expectedSize: metadataSize,
        });
        const storedContentSize = file.content.length;
        const storedContentSha256 = createHash("sha256").update(file.content).digest("hex");
        try {
            await repository.establishStoredIdentity(row.id, { storedContentSize, storedContentSha256 });
        } catch (error) {
            if (!(error instanceof ArtifactStoredIdentityConflictError)) throw error;
            throw new ArtifactIntegrityError(integrityDiagnostics({
                expectedStoredSize: row.storedContentSize == null ? null : Number(row.storedContentSize),
                observedSize: storedContentSize,
                sizeMatched: row.storedContentSize == null ? null : Number(row.storedContentSize) === storedContentSize,
                hashMatched: false, storedIdentityExisted: true, lifecycleStage,
            }));
        }
        return file;
    }

    return {
        async upload({ originalFileName, contentType, content, destination, workArea, libraryKey, idempotencyKey, sourceContext, actor, ...metadataInput }) {
            requireActor(actor, UPLOAD_ROLES);
            if (!IDEMPOTENCY_KEY.test(String(idempotencyKey || ""))) throw new ArtifactValidationError("A valid Idempotency-Key is required");
            const storageDestination = destination || (libraryKey ? "Working" : "");
            const selectedLibraryKey = workArea ?? libraryKey ?? null;
            if (!["Working", "Knowledge"].includes(storageDestination)) throw new ArtifactValidationError("Invalid Artifact Hub destination");
            if (storageDestination === "Working" && !["Projects", "Legal", "Operations"].includes(selectedLibraryKey)) throw new ArtifactValidationError("A valid Work area is required");
            if (storageDestination === "Knowledge" && selectedLibraryKey != null) throw new ArtifactValidationError("Knowledge does not accept a Work area");
            if (!Buffer.isBuffer(content) || content.length < 1 || content.length > MAX_ARTIFACT_BYTES) throw new ArtifactValidationError("Artifacts must be between 1 byte and 10 MiB");
            if (sourceContext != null && (typeof sourceContext !== "string" || sourceContext.length > 255)) throw new ArtifactValidationError("Invalid source context");
            const file = sanitizeFileName(originalFileName, contentType);
            const metadata = metadataValues(metadataInput);
            if (repository.validateMetadataKeys && !await repository.validateMetadataKeys(metadata.documentTypeKey, metadata.businessTopicSlug)) throw new ArtifactValidationError("Select an active Document type and Business topic");
            const contentSha256 = createHash("sha256").update(content).digest("hex");
            const requested = { originalFileName: file.clean, contentType: file.contentType, contentSize: content.length,
                contentSha256, storageDestination, libraryKey: selectedLibraryKey, sourceContext: sourceContext || null };

            return repository.withIdempotencyLock(actor.id, idempotencyKey, async () => {
                let row = await repository.getByIdempotency(actor.id, idempotencyKey);
                if (row && !sameRequest(row, requested)) throw new ArtifactConflictError("Idempotency-Key was already used for a different artifact request");
                if (row?.ingestionState === "Uploaded") return safeArtifact(row);
                if (!row) {
                    const id = generateUuid();
                    const storedFileName = `${id}-${contentSha256.slice(0, 12)}-${file.base}.${file.extension}`;
                    row = await repository.createPending({ id, ...requested, ...metadata, siteKey: storageDestination.toLowerCase(), storedFileName, fileExtension: file.extension,
                        sourceOrigin: "Internal Artifact Upload", sourceModule: "ArtifactHub",
                        submittedByUserId: actor.id, idempotencyKey });
                } else if (row.ingestionState === "Failed") {
                    row = await repository.restartFailed(row.id, actor.id, idempotencyKey);
                }

                let remoteIsDurable = !!row.itemId;
                try {
                    const { client, site, drive, root } = await graphContext(storageDestination, selectedLibraryKey);
                    let item;
                    if (row.itemId) {
                        if (row.siteId !== site.id || row.driveId !== drive.id) throw new ArtifactConflictError("Recorded Artifact storage destination is inconsistent");
                        item = await client.getItem(drive.id, row.itemId);
                        await observeStoredIdentity(client, row, drive.id, item, "upload-recovery");
                    } else {
                        item = await client.findChildByExactName(drive.id, root.id, row.storedFileName);
                        if (item) {
                            remoteIsDurable = true;
                            throw new ArtifactRecoveryRequiredError("Artifact upload requires reconciliation");
                        } else {
                            item = await client.uploadNewFile(drive.id, root.id, row.storedFileName, content);
                            remoteIsDurable = true;
                            uploadSizeTelemetry("artifact-upload-response", content.length, item,
                                "uploadResponseByteSize", "uploadResponseMatchesInput");
                            row = await repository.recordGraphReceipt(row.id, { siteId: site.id, driveId: drive.id, itemId: item.id, webUrl: item.webUrl });
                            if (!row?.itemId) throw new ArtifactRecoveryRequiredError("Artifact upload requires reconciliation");
                            const postUploadItem = await client.getItem(drive.id, item.id);
                            if (!postUploadItem || postUploadItem.id !== item.id || postUploadItem.name !== item.name || postUploadItem.type !== "file") {
                                throw new ArtifactConflictError("Uploaded Artifact storage identity is inconsistent");
                            }
                            uploadSizeTelemetry("artifact-post-upload-metadata", content.length, postUploadItem,
                                "postUploadDriveItemSize", "postUploadMatchesInput");
                            item = postUploadItem;
                        }
                        if (!row.itemId) {
                            row = await repository.recordGraphReceipt(row.id, { siteId: site.id, driveId: drive.id, itemId: item.id, webUrl: item.webUrl });
                            if (!row?.itemId) throw new ArtifactRecoveryRequiredError("Artifact upload requires reconciliation");
                        }
                        await observeStoredIdentity(client, row, drive.id, item, "upload-finalization");
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

        async metadataOptions(actor) {
            requireActor(actor, READ_ROLES);
            return repository.listMetadataOptions();
        },

        async updateMetadata(id, input, actor) {
            requireActor(actor, METADATA_WRITE_ROLES);
            if (!UUID.test(id)) throw new ArtifactValidationError("Invalid artifact ID");
            const metadata = metadataValues(input || {});
            if (!await repository.validateMetadataKeys(metadata.documentTypeKey, metadata.businessTopicSlug)) throw new ArtifactValidationError("Select an active Document type and Business topic");
            const row = await repository.updateMetadata(id, metadata, actor.id);
            if (!row) throw new ArtifactNotFoundError("Artifact not found");
            return safeArtifact(row);
        },

        async list({ page = 1, pageSize = 25, destination = null, libraryKey = null, documentTypeKey = null, businessTopicSlug = null, q = "", fileType = "", dateRange = "all", sort = "newest" } = {}, actor) {
            requireActor(actor, READ_ROLES);
            const safePage = Number(page); const safePageSize = Number(pageSize);
            if (!Number.isInteger(safePage) || safePage < 1 || !Number.isInteger(safePageSize) || safePageSize < 1 || safePageSize > 100) throw new ArtifactValidationError("Invalid pagination");
            if (libraryKey && !["Projects", "Legal", "Operations"].includes(libraryKey)) throw new ArtifactValidationError("Invalid Artifact Hub destination");
            if (destination && !["Working", "Knowledge"].includes(destination)) throw new ArtifactValidationError("Invalid Artifact Hub destination");
            if (documentTypeKey && !/^[a-z0-9-]{1,64}$/.test(documentTypeKey)) throw new ArtifactValidationError("Invalid document type filter");
            if (businessTopicSlug && !/^[a-z0-9-]{1,64}$/.test(businessTopicSlug)) throw new ArtifactValidationError("Invalid Business topic filter");
            const safeQuery = String(q || "").trim();
            if (safeQuery.length > 200) throw new ArtifactValidationError("Search text is too long");
            if (fileType && !FILE_TYPE_EXTENSIONS[fileType]) throw new ArtifactValidationError("Invalid file type filter");
            if (!["all", "today", "7days", "30days"].includes(dateRange)) throw new ArtifactValidationError("Invalid uploaded date filter");
            if (!["newest", "name", "area"].includes(sort)) throw new ArtifactValidationError("Invalid artifact sort");
            const days = dateRange === "today" ? 0 : dateRange === "7days" ? 7 : dateRange === "30days" ? 30 : null;
            const uploadedFrom = days == null ? null : new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
            const result = await repository.list({ pageSize: safePageSize, offset: (safePage - 1) * safePageSize,
                destination, libraryKey, documentTypeKey, businessTopicSlug, q: safeQuery || null, extensions: FILE_TYPE_EXTENSIONS[fileType] || [], uploadedFrom, sort });
            return { artifacts: result.rows.map(safeArtifact), total: result.total, page: safePage, pageSize: safePageSize };
        },

        async download(id, actor) {
            requireActor(actor, READ_ROLES);
            if (!UUID.test(id)) throw new ArtifactValidationError("Invalid artifact ID");
            const row = await repository.getForRead(id);
            if (!row || row.ingestionState !== "Uploaded" || row.lifecycleState === "Removed" || !row.driveId || !row.itemId) throw new ArtifactNotFoundError("Artifact not found");
            const client = graphClientFactory(loadConfig());
            const storedIdentityExisted = row.storedContentSize != null && row.storedContentSha256 != null;
            let file;
            try {
                let expectedSize = storedIdentityExisted ? Number(row.storedContentSize) : null;
                if (!storedIdentityExisted) {
                    const item = await client.getItem(row.driveId, row.itemId);
                    if (!item || item.id !== row.itemId || item.name !== row.storedFileName || item.type !== "file") {
                        throw new ArtifactConflictError("Recorded Artifact storage item is inconsistent");
                    }
                    expectedSize = typeof item.size === "number" && Number.isSafeInteger(item.size) && item.size > 0
                        && item.size <= MAX_STORED_ARTIFACT_BYTES ? item.size : null;
                    if (expectedSize == null) throw new GraphRequestError("SharePoint item metadata", null, "invalid_size_boundary");
                }
                file = await client.downloadFile(row.driveId, row.itemId, {
                    maxBytes: MAX_STORED_ARTIFACT_BYTES,
                    expectedSize,
                });
            } catch (error) {
                if (!(storedIdentityExisted && error instanceof GraphRequestError && error.graphCode === "content_length_mismatch")) throw error;
                throw new ArtifactIntegrityError(integrityDiagnostics({
                    expectedStoredSize: Number(row.storedContentSize), observedSize: error.diagnostics?.observedSize ?? null,
                    sizeMatched: false, hashMatched: null, storedIdentityExisted: true, lifecycleStage: "download",
                }));
            }
            const observedSize = file.content.length;
            const observedHash = createHash("sha256").update(file.content).digest("hex");
            if (storedIdentityExisted) {
                const sizeMatched = observedSize === Number(row.storedContentSize);
                const hashMatched = observedHash === String(row.storedContentSha256).toLowerCase();
                if (!sizeMatched || !hashMatched) throw new ArtifactIntegrityError(integrityDiagnostics({
                    expectedStoredSize: Number(row.storedContentSize), observedSize, sizeMatched, hashMatched,
                    storedIdentityExisted: true, lifecycleStage: "download",
                }));
            } else {
                try {
                    await repository.establishStoredIdentity(row.id, {
                        storedContentSize: observedSize, storedContentSha256: observedHash,
                    });
                } catch (error) {
                    if (!(error instanceof ArtifactStoredIdentityConflictError)) throw error;
                    throw new ArtifactIntegrityError(integrityDiagnostics({
                        expectedStoredSize: null, observedSize, sizeMatched: null, hashMatched: false,
                        storedIdentityExisted: true, lifecycleStage: "legacy-download-establishment",
                    }));
                }
            }
            await repository.appendEvent({ artifactId: row.id, eventType: "ArtifactDownloaded", actorUserId: actor.id, correlationId: null });
            return { ...file, fileName: row.originalFileName, contentType: row.contentType };
        },
    };
}

export const artifactService = createArtifactService();

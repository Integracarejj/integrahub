import { createHash } from "node:crypto";
import { ClientSecretGraphAuthProvider } from "../integrations/sharepoint/auth.js";
import { getSharePointSiteTarget, loadSharePointConfig } from "../integrations/sharepoint/config.js";
import { GraphRequestError, SharePointGraphClient } from "../integrations/sharepoint/graphClient.js";
import { recapPublicationRepository } from "./recapPublicationRepository.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VERSION = /^0x[0-9a-f]{16}$/i;
const KEY = /^[A-Za-z0-9._:-]{8,128}$/;
const MAX_STORED_BYTES = 20 * 1024 * 1024;

export class RecapPublicationValidationError extends Error {}
export class RecapPublicationForbiddenError extends Error {}
export class RecapPublicationConflictError extends Error {}
export class RecapPublicationNotFoundError extends Error {}
export class RecapPublicationRecoveryRequiredError extends Error {}

function folderPart(value, max = 150) {
    // Truncation can expose a space or period that was internal to the title.
    return String(value || "Recap").replace(/[\u0000-\u001f\u007f"*%#:<>?\/\\{|}~]/g, "-").replace(/\s+/g, " ").replace(/-+/g, "-").trim().slice(0, max).replace(/[. ]+$/g, "") || "Recap";
}

function requireInternalPublisher(actor) {
    if (!actor?.id || !["PlatformAdmin", "DDTeam"].includes(actor.globalRole)) throw new RecapPublicationForbiddenError();
}

function validateId(value) { if (!UUID.test(String(value || ""))) throw new RecapPublicationValidationError(); }
function validateVersion(value) { if (!VERSION.test(String(value || ""))) throw new RecapPublicationValidationError("A current version is required"); }

async function ensureFolder(client, driveId, parentId, name) {
    let item = await client.findChildByExactName(driveId, parentId, name);
    if (item && item.type !== "folder") throw new RecapPublicationConflictError("Knowledge folder identity conflicts with existing content");
    if (!item) {
        try { item = await client.createChildFolder(driveId, parentId, name); }
        catch (error) {
            if (!(error instanceof GraphRequestError) || ![409, 412].includes(error.status)) throw error;
            item = await client.findChildByExactName(driveId, parentId, name);
            if (!item || item.type !== "folder") throw new RecapPublicationConflictError("Knowledge folder creation conflicted");
        }
    }
    return item;
}

function publicPublication(row, artifacts = []) {
    const snapshot = row.contentSnapshotJson ? JSON.parse(row.contentSnapshotJson) : null;
    const content = snapshot || row;
    return {
        id: String(row.id), workItemId: String(row.workItemId), publicationNumber: Number(row.publicationNumber),
        status: row.status, externalOrganizationId: row.targetExternalOrganizationId,
        publishedAt: row.publishedAt || null, partnerActionAt: row.partnerActionAt || null,
        partnerGuidance: row.partnerGuidance || null, version: row.version,
        requestId: content.requestNumber, title: content.title, description: content.description,
        transactionId: content.businessTransactionId, transactionName: content.transactionName,
        responseContent: snapshot?.responseContent ?? null, responseSnapshotAvailable: snapshot !== null,
        sourceIntakeRequestKey: row.intakePackageId && row.sourceRowNumber ? `${row.intakePackageId}-${row.sourceRowNumber}` : null,
        workItemStatus: row.workItemStatus,
        artifacts: artifacts.map(item => ({ id: String(item.artifactId), fileName: item.originalFileName, contentType: item.contentType })),
    };
}

export function createRecapPublicationService({
    repository = recapPublicationRepository,
    loadConfig = loadSharePointConfig,
    graphClientFactory = config => new SharePointGraphClient(new ClientSecretGraphAuthProvider(config.credentials)),
    logError = (...args) => console.error(...args),
} = {}) {
    async function knowledgeContext(diagnose) {
        const { client, target } = await diagnose("knowledge-config", () => {
            const config = loadConfig();
            const target = getSharePointSiteTarget(config, "knowledge");
            return { client: graphClientFactory(config), target };
        });
        const site = await diagnose("knowledge-site", () => client.resolveSite(target.hostname, target.sitePath));
        const drive = await diagnose("knowledge-library", () => client.findDriveByName(site.id, target.libraryName));
        const root = await diagnose("knowledge-root", () => client.getDriveRoot(drive.id));
        return { client, site, drive, root };
    }

    return {
        async publish(workItemId, input, actor) {
            requireInternalPublisher(actor); validateId(workItemId);
            const operationKey = String(input?.idempotencyKey || "");
            if (!KEY.test(operationKey)) throw new RecapPublicationValidationError("A valid idempotency key is required");
            validateVersion(input?.expectedVersion);
            let publication = await repository.getByOperation(workItemId, operationKey);
            if (publication?.status === "Published") return publicPublication(publication, await repository.listArtifacts(publication.id));
            const context = await repository.getInternalContext(workItemId);
            if (!context) throw new RecapPublicationNotFoundError();
            if (!context.owningExternalOrganizationId) throw new RecapPublicationConflictError("The transaction has no authoritative external organization");
            if (!publication) {
                try { publication = await repository.begin(context, operationKey, actor.id, input.expectedVersion); }
                catch (error) {
                    if (/cannot be started|stale/i.test(error?.message || "")) {
                        publication = await repository.getByOperation(workItemId, operationKey);
                        if (!publication) throw new RecapPublicationConflictError("Publication cannot be started or is stale");
                    } else {
                        throw error;
                    }
                }
            }
            if (publication?.status === "Published") return publicPublication(publication, await repository.listArtifacts(publication.id));
            if (!publication || publication.status !== "Pending") throw new RecapPublicationConflictError("Publication cannot be resumed");
            // Log only selected diagnostics; never serialize inputs, credentials, headers,
            // remote response bodies, or error.cause/diagnostics. Rethrow the same error
            // so existing collision and durable-recovery classification stays intact.
            async function diagnose(phase, operation, artifactId = null) {
                try { return await operation(); }
                catch (error) {
                    try {
                        logError("Recap publication phase failed", {
                            workItemId, requestNumber: context.requestNumber || null,
                            publicationId: publication.id, publicationNumber: Number(publication.publicationNumber),
                            artifactId, phase,
                            causeName: error instanceof Error ? error.name.replaceAll(operationKey, "[redacted]") : "UnknownError",
                            causeMessage: error instanceof Error ? error.message.replaceAll(operationKey, "[redacted]") : "Unknown error",
                            graphStatus: error instanceof GraphRequestError && Number.isInteger(error.status) ? error.status : null,
                            graphCode: error instanceof GraphRequestError && typeof error.graphCode === "string"
                                ? error.graphCode.replaceAll(operationKey, "[redacted]") : null,
                        });
                    } catch { /* Logging must not replace the original storage failure. */ }
                    throw error;
                }
            }
            const artifacts = await diagnose("publication-artifacts", () => repository.listArtifacts(publication.id));
            const knowledge = await knowledgeContext(diagnose);
            const publicationRoot = await diagnose("publication-root-folder", () => ensureFolder(knowledge.client, knowledge.drive.id, knowledge.root.id, "Recapitalization Published"));
            const transactionFolder = await diagnose("transaction-folder", () => ensureFolder(knowledge.client, knowledge.drive.id, publicationRoot.id,
                `${folderPart(context.businessTransactionId, 24)} - ${folderPart(context.transactionName, 110)}`));
            const requestFolder = await diagnose("request-folder", () => ensureFolder(knowledge.client, knowledge.drive.id, transactionFolder.id,
                `${folderPart(context.requestNumber, 30)} - ${folderPart(context.title, 105)}`));
            const editionFolder = await diagnose("publication-folder", () => ensureFolder(knowledge.client, knowledge.drive.id, requestFolder.id,
                `Publication ${Number(publication.publicationNumber)}`));
            let destinationDurable = false;
            try {
                for (const artifact of artifacts) {
                    if (artifact.status === "Active") continue;
                    let destination;
                    if (artifact.status === "Receipt") {
                        if (artifact.knowledgeSiteId !== knowledge.site.id || artifact.knowledgeDriveId !== knowledge.drive.id || !artifact.knowledgeItemId) {
                            throw new RecapPublicationConflictError("Knowledge receipt identity is inconsistent");
                        }
                        destination = await knowledge.client.getItem(artifact.knowledgeDriveId, artifact.knowledgeItemId);
                    } else {
                        const sourceSize = await diagnose("source-metadata", async () => {
                            const sourceItem = await knowledge.client.getItem(artifact.sourceDriveId, artifact.sourceItemId);
                            if (sourceItem.id !== artifact.sourceItemId || sourceItem.name !== artifact.storedFileName || sourceItem.type !== "file") {
                                throw new RecapPublicationConflictError("Working artifact identity is inconsistent");
                            }
                            const size = Number(sourceItem.size);
                            if (!Number.isSafeInteger(size) || size < 1 || size > MAX_STORED_BYTES) throw new GraphRequestError("Working artifact metadata", null, "invalid_size_boundary");
                            return size;
                        }, artifact.artifactId);
                        const source = await diagnose("source-download", () => knowledge.client.downloadFile(artifact.sourceDriveId, artifact.sourceItemId, { maxBytes: MAX_STORED_BYTES, expectedSize: sourceSize }), artifact.artifactId);
                        await diagnose("destination-preflight", async () => {
                            const collision = await knowledge.client.findChildByExactName(knowledge.drive.id, editionFolder.id, artifact.storedFileName);
                            if (collision) throw new RecapPublicationConflictError("Knowledge publication filename is occupied by an unverified item");
                        }, artifact.artifactId);
                        destination = await diagnose("destination-upload", () => knowledge.client.uploadNewFile(knowledge.drive.id, editionFolder.id, artifact.storedFileName, source.content), artifact.artifactId);
                        destinationDurable = true;
                        await repository.recordReceipt(publication.id, artifact.artifactId, {
                            knowledgeSiteId: knowledge.site.id, knowledgeDriveId: knowledge.drive.id,
                            knowledgeItemId: destination.id, knowledgeWebUrl: destination.webUrl,
                        });
                    }
                    destination = await knowledge.client.getItem(knowledge.drive.id, destination.id);
                    if (destination.name !== artifact.storedFileName || destination.type !== "file") throw new RecapPublicationConflictError("Knowledge artifact identity is inconsistent");
                    const destinationSize = Number(destination.size);
                    if (!Number.isSafeInteger(destinationSize) || destinationSize < 1 || destinationSize > MAX_STORED_BYTES) throw new GraphRequestError("Knowledge artifact metadata", null, "invalid_size_boundary");
                    const copied = await knowledge.client.downloadFile(knowledge.drive.id, destination.id, { maxBytes: MAX_STORED_BYTES, expectedSize: destinationSize });
                    const copiedHash = createHash("sha256").update(copied.content).digest("hex");
                    await repository.activateArtifact(publication.id, artifact.artifactId, {
                        knowledgeDriveId: knowledge.drive.id, knowledgeItemId: destination.id,
                        storedContentSize: copied.content.length, storedContentSha256: copiedHash,
                    });
                }
                try { publication = await repository.complete(publication.id, actor.id); }
                catch (error) {
                    if (/cannot be completed|incomplete|inconsistent/i.test(error?.message || "")) throw new RecapPublicationConflictError("Publication finalization is incomplete");
                    throw error;
                }
                return publicPublication(publication, await repository.listArtifacts(publication.id));
            } catch (error) {
                if (destinationDurable || artifacts.some(item => item.status !== "Pending")) throw new RecapPublicationRecoveryRequiredError("Publication requires retry", { cause: error });
                throw error;
            }
        },
        async listExternal(actor, transactionId = null) {
            if (!actor?.id || !["ExternalBroker", "ExternalBuyer"].includes(actor.portalRole)) throw new RecapPublicationForbiddenError();
            const rows = await repository.listForExternalUser(actor.id, transactionId);
            return Promise.all(rows.map(async row => publicPublication(row, await repository.listArtifacts(row.id))));
        },
        async getExternal(publicationId, actor) {
            validateId(publicationId);
            if (!actor?.id || !["ExternalBroker", "ExternalBuyer"].includes(actor.portalRole)) throw new RecapPublicationForbiddenError();
            const publication = await repository.getExternalPublication(actor.id, publicationId);
            if (!publication) throw new RecapPublicationNotFoundError();
            return publicPublication(publication, await repository.listArtifacts(publication.id));
        },
        async downloadExternal(publicationId, artifactId, actor) {
            validateId(publicationId); validateId(artifactId);
            if (!actor?.id || !["ExternalBroker", "ExternalBuyer"].includes(actor.portalRole)) throw new RecapPublicationForbiddenError();
            const artifact = await repository.getExternalArtifact(actor.id, publicationId, artifactId);
            if (!artifact) throw new RecapPublicationNotFoundError();
            const client = graphClientFactory(loadConfig());
            const item = await client.getItem(artifact.knowledgeDriveId, artifact.knowledgeItemId);
            if (item.id !== artifact.knowledgeItemId || item.name !== artifact.storedFileName || item.type !== "file") throw new RecapPublicationConflictError("Published artifact identity is inconsistent");
            const file = await client.downloadFile(artifact.knowledgeDriveId, artifact.knowledgeItemId, { maxBytes: MAX_STORED_BYTES, expectedSize: Number(artifact.storedContentSize) });
            const hash = createHash("sha256").update(file.content).digest("hex");
            if (hash !== String(artifact.storedContentSha256).toLowerCase()) throw new RecapPublicationConflictError("Published artifact integrity check failed");
            return { ...file, fileName: artifact.originalFileName, contentType: artifact.contentType };
        },
        async partnerAction(publicationId, input, actor) {
            validateId(publicationId); validateVersion(input?.expectedVersion);
            if (!actor?.id || !["ExternalBroker", "ExternalBuyer"].includes(actor.portalRole)) throw new RecapPublicationForbiddenError();
            const action = input?.action;
            if (!["approve", "rework"].includes(action)) throw new RecapPublicationValidationError();
            const guidance = action === "rework" ? String(input?.guidance || "").trim() : null;
            if (action === "rework" && (!guidance || guidance.length > 2000)) throw new RecapPublicationValidationError("Rework guidance is required");
            const publication = await repository.getExternalPublication(actor.id, publicationId);
            if (!publication) throw new RecapPublicationNotFoundError();
            let updated;
            try { updated = await repository.partnerAction(publicationId, actor.id, publication.targetExternalOrganizationId, action, guidance, input.expectedVersion); }
            catch (error) {
                if (/cannot be applied|stale|inconsistent/i.test(error?.message || "")) throw new RecapPublicationConflictError("Partner action cannot be applied or is stale");
                throw error;
            }
            if (!updated) throw new RecapPublicationConflictError("Partner action cannot be applied");
            return publicPublication(updated, await repository.listArtifacts(publicationId));
        },
    };
}

export const recapPublicationService = createRecapPublicationService();

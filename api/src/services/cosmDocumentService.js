import { cosmDocumentRepository } from "./cosmDocumentRepository.js";

export class CosmDocumentValidationError extends Error {}
export class CosmDocumentNotFoundError extends Error {}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function userReference(id, displayName, email) {
    return id ? { id, displayName: displayName || null, email: email || null } : null;
}

function currentVersion(row) {
    return {
        id: row.currentVersionId,
        sequence: row.versionSequence,
        fileName: row.fileName || null,
        mimeType: row.mimeType || null,
        contentSize: row.contentSize ?? null,
        webUrl: row.webUrl || null,
        effectiveAt: row.effectiveAt || null,
    };
}

function listItem(row) {
    return {
        id: row.id,
        documentNumber: row.documentNumber,
        title: row.title,
        category: row.category,
        subcategory: row.subcategory || null,
        audience: row.audience || null,
        status: row.status,
        effectiveDate: row.effectiveDate || null,
        reviewDate: row.reviewDate || null,
        currentVersion: currentVersion(row),
    };
}

export function createCosmDocumentService({ repository = cosmDocumentRepository } = {}) {
    return {
        async listDocuments() {
            return (await repository.listDocuments()).map(listItem);
        },

        async getDocument(id) {
            if (!UUID.test(id || "")) throw new CosmDocumentValidationError("Valid document ID is required");
            const row = await repository.getDocument(id);
            if (!row) throw new CosmDocumentNotFoundError("COSM document not found");
            const versions = await repository.listVersions(id);
            return {
                ...listItem(row),
                department: row.department || null,
                expirationDate: row.expirationDate || null,
                owner: userReference(row.ownerUserId, row.ownerDisplayName, row.ownerEmail),
                contentSteward: userReference(row.contentStewardUserId, row.contentStewardDisplayName, row.contentStewardEmail),
                supersedes: row.supersedesDocumentId ? { id: row.supersedesDocumentId, documentNumber: row.supersedesDocumentNumber || null } : null,
                createdAt: row.createdAt,
                updatedAt: row.updatedAt,
                versions: versions.map(version => ({
                    id: version.id,
                    sequence: version.versionSequence,
                    lifecycleState: version.lifecycleState,
                    fileName: version.fileName || null,
                    mimeType: version.mimeType || null,
                    contentSize: version.contentSize ?? null,
                    webUrl: version.webUrl || null,
                    effectiveAt: version.effectiveAt || null,
                    uploadedAt: version.uploadedAt || null,
                    createdAt: version.createdAt,
                })),
            };
        },
    };
}

export const cosmDocumentService = createCosmDocumentService();

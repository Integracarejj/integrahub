import { query as defaultQuery } from "../db.js";

const documentSelect = `
    SELECT CONVERT(varchar(36), documentRow.id) AS id,
           documentRow.documentNumber, documentRow.title, documentRow.category,
           documentRow.subcategory, documentRow.department, documentRow.audience,
           documentRow.status, documentRow.effectiveDate, documentRow.reviewDate,
           documentRow.expirationDate, documentRow.ownerUserId,
           ownerRow.displayName AS ownerDisplayName, ownerRow.email AS ownerEmail,
           documentRow.contentStewardUserId,
           stewardRow.displayName AS contentStewardDisplayName, stewardRow.email AS contentStewardEmail,
           CONVERT(varchar(36), documentRow.supersedesDocumentId) AS supersedesDocumentId,
           supersededRow.documentNumber AS supersedesDocumentNumber,
           documentRow.createdAt, documentRow.updatedAt,
           CONVERT(varchar(36), versionRow.id) AS currentVersionId,
           versionRow.versionSequence, versionRow.fileName, versionRow.mimeType,
           versionRow.contentSize, versionRow.webUrl, versionRow.effectiveAt
    FROM cmdb.CosmDocuments documentRow
    INNER JOIN cmdb.CosmDocumentVersions versionRow ON versionRow.id = documentRow.currentVersionId
    LEFT JOIN cmdb.Users ownerRow ON ownerRow.id = documentRow.ownerUserId
    LEFT JOIN cmdb.Users stewardRow ON stewardRow.id = documentRow.contentStewardUserId
    LEFT JOIN cmdb.CosmDocuments supersededRow ON supersededRow.id = documentRow.supersedesDocumentId
    WHERE documentRow.status = 'Active' AND versionRow.lifecycleState = 'Effective'`;

export function createCosmDocumentRepository({ query = defaultQuery } = {}) {
    return {
        listDocuments() {
            return query(`${documentSelect} ORDER BY documentRow.category, documentRow.title, documentRow.documentNumber`);
        },

        async getDocument(id) {
            const rows = await query(`${documentSelect} AND documentRow.id = @id`, { id });
            return rows[0] || null;
        },

        listVersions(documentId) {
            return query(`
                SELECT CONVERT(varchar(36), id) AS id, versionSequence, lifecycleState,
                       fileName, mimeType, contentSize, webUrl, effectiveAt, uploadedAt, createdAt
                FROM cmdb.CosmDocumentVersions
                WHERE documentId = @documentId AND lifecycleState IN ('Effective', 'Historical')
                ORDER BY versionSequence DESC
            `, { documentId });
        },
    };
}

export const cosmDocumentRepository = createCosmDocumentRepository();

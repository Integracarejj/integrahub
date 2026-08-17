import { randomUUID } from "node:crypto";
import { query as defaultQuery } from "../db.js";

const SELECT_DOCUMENT = `
    SELECT id, recapTransactionId, sourcePackageId, documentType, originalFileName,
           storedFileName, contentSha256, contentSize, status, siteKey, driveId,
           itemId, webUrl, uploadedAt, uploadedBy, externalOrganizationId,
           createdAt, updatedAt
    FROM cmdb.RecapIncomingDocuments
`;

export function createRecapIncomingDocumentRepository({ query = defaultQuery, generateUuid = randomUUID } = {}) {
    return {
        async getDefaultExternalOrganizationForUser(userId) {
            const rows = await query(`
                SELECT externalOrganizationId
                FROM cmdb.ExternalUserOrganizations
                WHERE userId = @userId AND isDefault = 1
            `, { userId });
            return rows[0]?.externalOrganizationId || null;
        },

        async userHasExternalOrganization(userId, externalOrganizationId) {
            const rows = await query(`
                SELECT 1 AS hasAccess
                FROM cmdb.ExternalUserOrganizations
                WHERE userId = @userId
                  AND externalOrganizationId = @externalOrganizationId
            `, { userId, externalOrganizationId });
            return !!rows[0]?.hasAccess;
        },

        async getByPackage(recapTransactionId, sourcePackageId) {
            const rows = await query(`${SELECT_DOCUMENT}
                WHERE recapTransactionId = @recapTransactionId
                  AND sourcePackageId = @sourcePackageId
            `, { recapTransactionId, sourcePackageId });
            return rows[0] || null;
        },

        async createPending(values) {
            await query(`
                INSERT INTO cmdb.RecapIncomingDocuments
                    (id, recapTransactionId, sourcePackageId, originalFileName,
                     storedFileName, contentSha256, contentSize, siteKey,
                     uploadedBy, externalOrganizationId)
                VALUES
                    (@id, @recapTransactionId, @sourcePackageId, @originalFileName,
                     @storedFileName, @contentSha256, @contentSize, 'working',
                     @uploadedBy, @externalOrganizationId)
            `, { id: generateUuid(), ...values });
            return this.getByPackage(values.recapTransactionId, values.sourcePackageId);
        },

        async markUploaded(id, { driveId, itemId, webUrl }) {
            const rows = await query(`
                UPDATE cmdb.RecapIncomingDocuments
                SET status = 'Uploaded', driveId = @driveId, itemId = @itemId,
                    webUrl = @webUrl, uploadedAt = SYSUTCDATETIME(),
                    updatedAt = SYSUTCDATETIME()
                OUTPUT INSERTED.id, INSERTED.recapTransactionId,
                       INSERTED.sourcePackageId, INSERTED.documentType,
                       INSERTED.originalFileName, INSERTED.storedFileName,
                       INSERTED.contentSha256, INSERTED.contentSize,
                       INSERTED.status, INSERTED.siteKey, INSERTED.driveId,
                       INSERTED.itemId, INSERTED.webUrl, INSERTED.uploadedAt,
                       INSERTED.uploadedBy, INSERTED.externalOrganizationId,
                       INSERTED.createdAt, INSERTED.updatedAt
                WHERE id = @id AND status = 'Pending'
            `, { id, driveId, itemId, webUrl });
            return rows[0] || null;
        },
    };
}

export const recapIncomingDocumentRepository = createRecapIncomingDocumentRepository();

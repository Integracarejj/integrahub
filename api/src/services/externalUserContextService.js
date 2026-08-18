import { query as defaultQuery } from "../db.js";

export function createExternalUserContextService({ query = defaultQuery } = {}) {
    return {
        async getForUser(userId) {
            const rows = await query(`
                SELECT externalOrganizationId, isDefault
                FROM cmdb.ExternalUserOrganizations
                WHERE userId = @userId
                ORDER BY isDefault DESC, externalOrganizationId ASC
            `, { userId });

            const organizations = rows.map((row) => ({
                id: row.externalOrganizationId,
                isDefault: !!row.isDefault,
            }));
            const defaultOrganization = organizations.find((organization) => organization.isDefault);

            return {
                organizations,
                defaultOrganizationId: defaultOrganization?.id || null,
                isConfigured: organizations.length > 0,
            };
        },

        async listAuthorizedTransactions(userId) {
            const rows = await query(`
                SELECT transactionRow.businessTransactionId AS id,
                       transactionRow.name,
                       transactionRow.status,
                       transactionRow.owningExternalOrganizationId,
                       transactionRow.updatedAt,
                       documentRow.sourcePackageId AS recoverableSourcePackageId,
                       documentRow.originalFileName AS recoverableOriginalFileName,
                       documentRow.contentSize AS recoverableContentSize
                FROM cmdb.RecapTransactions transactionRow
                OUTER APPLY (
                    SELECT TOP (1) document.sourcePackageId, document.originalFileName, document.contentSize
                    FROM cmdb.RecapIncomingDocuments document
                    WHERE document.recapTransactionId = transactionRow.id
                      AND document.status = 'Uploaded'
                      AND NOT EXISTS (
                        SELECT 1 FROM cmdb.RecapIntakePackages intakeRow
                        WHERE intakeRow.recapTransactionId = document.recapTransactionId
                          AND intakeRow.sourcePackageId = document.sourcePackageId
                      )
                    ORDER BY document.uploadedAt DESC, document.createdAt DESC
                ) documentRow
                WHERE EXISTS (
                    SELECT 1
                    FROM cmdb.ExternalUserOrganizations membership
                    WHERE membership.userId = @userId
                      AND membership.externalOrganizationId = transactionRow.owningExternalOrganizationId
                )
                ORDER BY transactionRow.updatedAt DESC, transactionRow.businessTransactionId DESC
            `, { userId });

            return rows.map((row) => ({
                id: row.id,
                name: row.name,
                status: row.status,
                owningExternalOrganizationId: row.owningExternalOrganizationId,
                recoverablePackage: row.recoverableSourcePackageId ? {
                    sourcePackageId: row.recoverableSourcePackageId,
                    originalFileName: row.recoverableOriginalFileName,
                    contentSize: Number(row.recoverableContentSize),
                } : null,
            }));
        },
    };
}

export const externalUserContextService = createExternalUserContextService();

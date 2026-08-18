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
                       transactionRow.updatedAt
                FROM cmdb.RecapTransactions transactionRow
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
            }));
        },
    };
}

export const externalUserContextService = createExternalUserContextService();

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
    };
}

export const externalUserContextService = createExternalUserContextService();

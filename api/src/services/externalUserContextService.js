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

        async getRecapReadModel(userId, businessTransactionId = null) {
            const transactionFilter = businessTransactionId
                ? "AND transactionRow.businessTransactionId = @businessTransactionId"
                : "";
            const rows = await query(`
                SELECT transactionRow.businessTransactionId AS transactionId,
                       transactionRow.name AS transactionName,
                       transactionRow.status AS transactionStatus,
                       transactionRow.owningExternalOrganizationId,
                       transactionRow.createdAt AS transactionCreatedAt,
                       packageRow.id AS packageId,
                       packageRow.sourcePackageId,
                       packageRow.packageName,
                       packageRow.originalFileName,
                       packageRow.requestCount,
                       packageRow.status AS packageStatus,
                       packageRow.submittedBy,
                       packageRow.submittedByName,
                       packageRow.submittedByEmail,
                       packageRow.createdAt AS packageSubmittedAt,
                       requestRow.sourceRowNumber,
                       requestRow.category,
                       requestRow.title,
                       requestRow.description,
                       requestRow.team,
                       requestRow.owner,
                       requestRow.priority,
                       requestRow.dueDate,
                       requestRow.communityNamesJson
                FROM cmdb.RecapTransactions transactionRow
                LEFT JOIN cmdb.RecapIntakePackages packageRow
                  ON packageRow.recapTransactionId = transactionRow.id
                 AND packageRow.externalOrganizationId = transactionRow.owningExternalOrganizationId
                LEFT JOIN cmdb.RecapIntakeRequests requestRow
                  ON requestRow.intakePackageId = packageRow.id
                WHERE EXISTS (
                    SELECT 1 FROM cmdb.ExternalUserOrganizations membership
                    WHERE membership.userId = @userId
                      AND membership.externalOrganizationId = transactionRow.owningExternalOrganizationId
                )
                ${transactionFilter}
                ORDER BY transactionRow.updatedAt DESC, transactionRow.businessTransactionId DESC,
                         packageRow.createdAt DESC, requestRow.sourceRowNumber ASC
            `, businessTransactionId ? { userId, businessTransactionId } : { userId });

            const transactions = new Map();
            for (const row of rows) {
                if (!transactions.has(row.transactionId)) transactions.set(row.transactionId, {
                    id: row.transactionId,
                    name: row.transactionName,
                    status: row.transactionStatus,
                    owningExternalOrganizationId: row.owningExternalOrganizationId,
                    createdAt: row.transactionCreatedAt,
                    packages: [],
                });
                const transaction = transactions.get(row.transactionId);
                if (!row.packageId) continue;
                let intakePackage = transaction.packages.find(item => item.id === String(row.packageId));
                if (!intakePackage) {
                    intakePackage = {
                        id: String(row.packageId), sourcePackageId: row.sourcePackageId,
                        name: row.packageName, fileName: row.originalFileName,
                        status: row.packageStatus, requestCount: row.requestCount,
                        submittedAt: row.packageSubmittedAt,
                        submittedBy: { id: row.submittedBy, name: row.submittedByName, email: row.submittedByEmail },
                        requests: [],
                    };
                    transaction.packages.push(intakePackage);
                }
                if (row.sourceRowNumber) intakePackage.requests.push({
                    rowNumber: row.sourceRowNumber, category: row.category,
                    title: row.title, description: row.description,
                    team: row.team || "", owner: row.owner || null,
                    priority: row.priority, dueDate: row.dueDate,
                    communityNames: JSON.parse(row.communityNamesJson || "[]"),
                });
            }
            return { transactions: [...transactions.values()] };
        },
    };
}

export const externalUserContextService = createExternalUserContextService();

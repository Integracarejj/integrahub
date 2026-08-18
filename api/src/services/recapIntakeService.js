import { recapIntakeRepository } from "./recapIntakeRepository.js";
import { query as defaultQuery } from "../db.js";

export class RecapIntakeValidationError extends Error {}
export class RecapIntakeForbiddenError extends Error {}

const text = (value, max) => String(value ?? "").trim().slice(0, max);

export function createRecapIntakeService({ repository = recapIntakeRepository, query = defaultQuery } = {}) {
    return {
        async finalizePackage(input, actor) {
            const rows = Array.isArray(input.requests) ? input.requests : null;
            if (!input.businessTransactionId || !input.sourcePackageId || !rows || rows.length > 5000) throw new RecapIntakeValidationError();
            const documents = await query(`
                SELECT documentRow.recapTransactionId, documentRow.originalFileName,
                       documentRow.externalOrganizationId, transactionRow.name AS packageName
                FROM cmdb.RecapIncomingDocuments documentRow
                INNER JOIN cmdb.RecapTransactions transactionRow ON transactionRow.id = documentRow.recapTransactionId
                WHERE transactionRow.businessTransactionId = @businessTransactionId
                  AND documentRow.sourcePackageId = @sourcePackageId
                  AND documentRow.status = 'Uploaded'
                  AND documentRow.uploadedBy = @uploadedBy
            `, { businessTransactionId: input.businessTransactionId, sourcePackageId: input.sourcePackageId, uploadedBy: actor.id });
            const document = documents[0];
            if (!document) throw new RecapIntakeForbiddenError();
            const requests = rows.map((row, index) => {
                const title = text(row.title, 512);
                if (!title) throw new RecapIntakeValidationError(`Request ${index + 1} has no title`);
                const priority = ["High", "Medium", "Low"].includes(row.priority) ? row.priority : "Medium";
                return {
                    category: text(row.category, 128) || "Unclassified",
                    title,
                    description: text(row.description, 100000),
                    team: text(row.team, 128) || null,
                    owner: text(row.owner, 255) || null,
                    priority,
                    dueDate: /^\d{4}-\d{2}-\d{2}$/.test(row.dueDate || "") ? row.dueDate : null,
                    communityNamesJson: JSON.stringify(Array.isArray(row.communityNames) ? row.communityNames.map(name => text(name, 255)).filter(Boolean) : []),
                };
            });
            return repository.persistPackage({
                recapTransactionId: document.recapTransactionId,
                sourcePackageId: input.sourcePackageId,
                packageName: document.packageName,
                originalFileName: document.originalFileName,
                submittedBy: actor.id,
                submittedByName: actor.name || actor.email,
                submittedByEmail: actor.email || null,
                externalOrganizationId: document.externalOrganizationId,
                requests,
            });
        },

        async listPackages() {
            const rows = await repository.listPackages();
            const packages = new Map();
            for (const row of rows) {
                if (!packages.has(row.packageId)) packages.set(row.packageId, {
                    id: row.packageId, sourcePackageId: row.sourcePackageId,
                    packageName: row.packageName, fileName: row.originalFileName,
                    requestCount: row.requestCount, status: row.status,
                    submittedBy: row.submittedBy, submittedByName: row.submittedByName,
                    submittedByEmail: row.submittedByEmail,
                    externalOrganizationId: row.externalOrganizationId,
                    submittedAt: row.createdAt, transactionId: row.businessTransactionId,
                    transactionName: row.transactionName, requests: [],
                });
                if (row.sourceRowNumber) packages.get(row.packageId).requests.push({
                    rowNumber: row.sourceRowNumber, category: row.category, title: row.title,
                    description: row.description, team: row.team || "", owner: row.owner || null,
                    priority: row.priority, dueDate: row.dueDate,
                    communityNames: JSON.parse(row.communityNamesJson || "[]"),
                });
            }
            return [...packages.values()];
        },
    };
}

export const recapIntakeService = createRecapIntakeService();

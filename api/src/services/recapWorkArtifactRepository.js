import { randomUUID } from "node:crypto";
import { query as defaultQuery } from "../db.js";

export function createRecapWorkArtifactRepository({ query = defaultQuery, generateUuid = randomUUID } = {}) {
    const repository = {
        async getWorkItemContext(workItemId) {
            const rows = await query(`
                SELECT CONVERT(varchar(36), workItem.id) AS workItemId, workItem.requestNumber,
                       workItem.title, workItem.status, workItem.assignedUserId,
                       CONVERT(varchar(36), transactionRow.id) AS transactionDatabaseId,
                       transactionRow.businessTransactionId, packageRow.sourcePackageId
                FROM cmdb.RecapWorkItems workItem
                INNER JOIN cmdb.RecapIntakeRequests intakeRow ON intakeRow.id = workItem.intakeRequestId
                INNER JOIN cmdb.RecapIntakePackages packageRow ON packageRow.id = intakeRow.intakePackageId
                INNER JOIN cmdb.RecapTransactions transactionRow ON transactionRow.id = packageRow.recapTransactionId
                WHERE workItem.id = @workItemId
            `, { workItemId });
            return rows[0] || null;
        },
        async getFolder(workItemId) {
            const rows = await query(`SELECT workItemId, siteKey, siteId, driveId, folderItemId, folderName, webUrl
                FROM cmdb.RecapWorkItemSharePointFolders WHERE workItemId = @workItemId AND siteKey = 'working'`, { workItemId });
            return rows[0] || null;
        },
        async createOrGetFolder(values) {
            try {
                await query(`INSERT INTO cmdb.RecapWorkItemSharePointFolders
                    (workItemId, siteKey, siteId, driveId, folderItemId, folderName, webUrl)
                    VALUES (@workItemId, 'working', @siteId, @driveId, @folderItemId, @folderName, @webUrl)`, values);
            } catch (error) {
                const number = error?.number ?? error?.originalError?.info?.number;
                if (number !== 2601 && number !== 2627) throw error;
            }
            return repository.getFolder(values.workItemId);
        },
        async findByContent(workItemId, contentSha256, storedFileName) {
            const rows = await query(`SELECT id, workItemId, originalFileName, storedFileName, contentType, contentSize,
                    contentSha256, status, driveId, itemId, webUrl, uploadedByUserId, uploadedAt
                FROM cmdb.RecapWorkArtifacts
                WHERE workItemId = @workItemId AND contentSha256 = @contentSha256 AND storedFileName = @storedFileName`,
                { workItemId, contentSha256, storedFileName });
            return rows[0] || null;
        },
        async createPending(values) {
            const id = generateUuid();
            await query(`INSERT INTO cmdb.RecapWorkArtifacts
                (id, workItemId, originalFileName, storedFileName, contentType, contentSize,
                 contentSha256, siteKey, uploadedByUserId)
                VALUES (@id, @workItemId, @originalFileName, @storedFileName, @contentType, @contentSize,
                        @contentSha256, 'working', @uploadedByUserId)`, { id, ...values });
            return { id, status: "Pending", ...values };
        },
        async restartFailed(id, uploadedByUserId) {
            await query(`UPDATE cmdb.RecapWorkArtifacts SET status = 'Pending', uploadedByUserId = @uploadedByUserId,
                    updatedAt = SYSUTCDATETIME() WHERE id = @id AND status = 'Failed'`, { id, uploadedByUserId });
        },
        async markUploaded(id, driveId, item) {
            const rows = await query(`UPDATE cmdb.RecapWorkArtifacts SET status = 'Uploaded', driveId = @driveId,
                    itemId = @itemId, webUrl = @webUrl, uploadedAt = SYSUTCDATETIME(), updatedAt = SYSUTCDATETIME()
                OUTPUT INSERTED.id, INSERTED.workItemId, INSERTED.originalFileName, INSERTED.storedFileName,
                       INSERTED.contentType, INSERTED.contentSize, INSERTED.status, INSERTED.uploadedByUserId, INSERTED.uploadedAt
                WHERE id = @id AND status = 'Pending'`, { id, driveId, itemId: item.id, webUrl: item.webUrl });
            return rows[0] || null;
        },
        async markFailed(id) {
            await query(`UPDATE cmdb.RecapWorkArtifacts SET status = 'Failed', updatedAt = SYSUTCDATETIME()
                WHERE id = @id AND status = 'Pending'`, { id });
        },
        async list(workItemId) {
            return query(`SELECT CONVERT(varchar(36), artifact.id) AS id, artifact.originalFileName,
                       artifact.contentType, artifact.contentSize, artifact.status, artifact.uploadedAt,
                       COALESCE(uploader.displayName, uploader.email) AS uploadedBy
                FROM cmdb.RecapWorkArtifacts artifact
                LEFT JOIN cmdb.Users uploader ON uploader.id = artifact.uploadedByUserId
                WHERE artifact.workItemId = @workItemId AND artifact.status = 'Uploaded'
                ORDER BY artifact.uploadedAt DESC`, { workItemId });
        },
        async getForDownload(workItemId, artifactId) {
            const rows = await query(`SELECT id, workItemId, originalFileName, contentType, contentSize, driveId, itemId
                FROM cmdb.RecapWorkArtifacts WHERE id = @artifactId AND workItemId = @workItemId AND status = 'Uploaded'`,
                { workItemId, artifactId });
            return rows[0] || null;
        },
        async listSourceDocuments(context) {
            return query(`SELECT CONVERT(varchar(36), id) AS id, originalFileName, contentSize, uploadedAt
                FROM cmdb.RecapIncomingDocuments
                WHERE recapTransactionId = @transactionDatabaseId AND sourcePackageId = @sourcePackageId AND status = 'Uploaded'
                ORDER BY uploadedAt`, context);
        },
        async getSourceForDownload(context, documentId) {
            const rows = await query(`SELECT id, originalFileName, contentSize, driveId, itemId
                FROM cmdb.RecapIncomingDocuments
                WHERE id = @documentId AND recapTransactionId = @transactionDatabaseId
                  AND sourcePackageId = @sourcePackageId AND status = 'Uploaded'`, { ...context, documentId });
            return rows[0] || null;
        },
    };
    return repository;
}

export const recapWorkArtifactRepository = createRecapWorkArtifactRepository();

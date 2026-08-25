import sql from "mssql";
import { randomUUID } from "node:crypto";
import { getPool as defaultGetPool, query as defaultQuery, queryInTransaction as defaultQueryInTransaction } from "../db.js";

const SELECT_ARTIFACT = `SELECT CONVERT(varchar(36), artifact.id) AS id, artifact.originalFileName,
    artifact.storedFileName, artifact.fileExtension, artifact.contentType, artifact.contentSize,
    artifact.contentSha256, artifact.ingestionState, artifact.classificationState,
    artifact.lifecycleState, artifact.storageDestination, artifact.libraryKey,
    artifact.siteId, artifact.driveId, artifact.itemId, artifact.webUrl,
    artifact.sourceOrigin, artifact.sourceModule, artifact.sourceContext,
    artifact.submittedByUserId, artifact.idempotencyKey, artifact.description,
    artifact.effectiveDate, artifact.classificationProvenance, artifact.classificationConfidence,
    artifact.uploadedAt, artifact.createdAt, artifact.updatedAt
    FROM cmdb.Artifacts artifact`;

export class ArtifactLockError extends Error {
    constructor() { super("Artifact operation is already in progress"); this.name = "ArtifactLockError"; }
}

export function createArtifactRepository({
    query = defaultQuery,
    getPool = defaultGetPool,
    queryInTransaction = defaultQueryInTransaction,
    createTransaction = pool => new sql.Transaction(pool),
    generateUuid = randomUUID,
} = {}) {
    async function appendEventWith(execute, { artifactId, eventType, actorUserId, correlationId, details = null }) {
        return execute(`INSERT INTO cmdb.ArtifactEvents
            (id, artifactId, eventType, actorUserId, correlationId, detailsJson)
            VALUES (@id, @artifactId, @eventType, @actorUserId, @correlationId, @detailsJson)`, {
            id: generateUuid(), artifactId, eventType, actorUserId: actorUserId || null,
            correlationId: correlationId || null, detailsJson: details ? JSON.stringify(details) : null,
        });
    }

    const repository = {
        async withIdempotencyLock(actorId, idempotencyKey, work) {
            const transaction = createTransaction(await getPool());
            await transaction.begin();
            try {
                const rows = await queryInTransaction(transaction, `DECLARE @result INT;
                    EXEC @result = sys.sp_getapplock @Resource = @resource, @LockMode = 'Exclusive',
                        @LockOwner = 'Transaction', @LockTimeout = 15000;
                    SELECT @result AS lockResult;`, { resource: `artifact-upload:${actorId}:${idempotencyKey}` });
                if (!rows[0] || rows[0].lockResult < 0) throw new ArtifactLockError();
                const result = await work();
                await transaction.commit();
                return result;
            } catch (error) {
                try { await transaction.rollback(); } catch { /* Preserve original error. */ }
                throw error;
            }
        },

        async getById(id) {
            const rows = await query(`${SELECT_ARTIFACT} WHERE artifact.id = @id`, { id });
            return rows[0] || null;
        },

        async getByIdempotency(submittedByUserId, idempotencyKey) {
            const rows = await query(`${SELECT_ARTIFACT}
                WHERE artifact.submittedByUserId = @submittedByUserId AND artifact.idempotencyKey = @idempotencyKey`,
            { submittedByUserId, idempotencyKey });
            return rows[0] || null;
        },

        async createPending(values) {
            const transaction = createTransaction(await getPool());
            await transaction.begin();
            try {
                await queryInTransaction(transaction, `INSERT INTO cmdb.Artifacts
                    (id, originalFileName, storedFileName, fileExtension, contentType, contentSize,
                     contentSha256, libraryKey, sourceOrigin, sourceModule, sourceContext,
                     submittedByUserId, idempotencyKey)
                    VALUES (@id, @originalFileName, @storedFileName, @fileExtension, @contentType, @contentSize,
                     @contentSha256, @libraryKey, @sourceOrigin, @sourceModule, @sourceContext,
                     @submittedByUserId, @idempotencyKey)`, values);
                await appendEventWith((statement, params) => queryInTransaction(transaction, statement, params), {
                    artifactId: values.id, eventType: "ArtifactUploadStarted", actorUserId: values.submittedByUserId,
                    correlationId: values.idempotencyKey, details: { libraryKey: values.libraryKey },
                });
                await transaction.commit();
                return repository.getById(values.id);
            } catch (error) {
                try { await transaction.rollback(); } catch { /* Preserve original error. */ }
                throw error;
            }
        },

        async restartFailed(id, actorUserId, correlationId) {
            const transaction = createTransaction(await getPool());
            await transaction.begin();
            try {
                const changed = await queryInTransaction(transaction, `UPDATE cmdb.Artifacts
                    SET ingestionState = 'Pending', updatedAt = SYSUTCDATETIME()
                    OUTPUT CONVERT(varchar(36), INSERTED.id) AS id
                    WHERE id = @id AND ingestionState = 'Failed'`, { id });
                if (!changed[0]) throw new ArtifactLockError();
                await appendEventWith((statement, params) => queryInTransaction(transaction, statement, params),
                    { artifactId: id, eventType: "ArtifactUploadStarted", actorUserId, correlationId, details: { retry: true } });
                await transaction.commit();
                return repository.getById(id);
            } catch (error) {
                try { await transaction.rollback(); } catch { /* Preserve original error. */ }
                throw error;
            }
        },

        async recordGraphReceipt(id, { siteId, driveId, itemId, webUrl }) {
            await query(`UPDATE cmdb.Artifacts SET siteId = @siteId, driveId = @driveId, itemId = @itemId,
                    webUrl = @webUrl, updatedAt = SYSUTCDATETIME()
                WHERE id = @id AND ingestionState = 'Pending'
                  AND (itemId IS NULL OR (siteId = @siteId AND driveId = @driveId AND itemId = @itemId))`,
            { id, siteId, driveId, itemId, webUrl });
            return repository.getById(id);
        },

        async markUploaded(id, actorUserId, correlationId) {
            const transaction = createTransaction(await getPool());
            await transaction.begin();
            try {
                const changed = await queryInTransaction(transaction, `UPDATE cmdb.Artifacts
                    SET ingestionState = 'Uploaded', uploadedAt = COALESCE(uploadedAt, SYSUTCDATETIME()), updatedAt = SYSUTCDATETIME()
                    OUTPUT CONVERT(varchar(36), INSERTED.id) AS id
                    WHERE id = @id AND ingestionState = 'Pending' AND siteId IS NOT NULL AND driveId IS NOT NULL AND itemId IS NOT NULL`, { id });
                if (!changed[0]) throw new ArtifactLockError();
                await appendEventWith((statement, params) => queryInTransaction(transaction, statement, params),
                    { artifactId: id, eventType: "ArtifactUploaded", actorUserId, correlationId });
                await transaction.commit();
                return repository.getById(id);
            } catch (error) {
                try { await transaction.rollback(); } catch { /* Preserve original error. */ }
                throw error;
            }
        },

        async markFailed(id, actorUserId, correlationId, reason) {
            const transaction = createTransaction(await getPool());
            await transaction.begin();
            try {
                const changed = await queryInTransaction(transaction, `UPDATE cmdb.Artifacts
                    SET ingestionState = 'Failed', updatedAt = SYSUTCDATETIME()
                    OUTPUT CONVERT(varchar(36), INSERTED.id) AS id
                    WHERE id = @id AND ingestionState = 'Pending' AND itemId IS NULL`, { id });
                if (changed[0]) await appendEventWith((statement, params) => queryInTransaction(transaction, statement, params),
                    { artifactId: id, eventType: "ArtifactUploadFailed", actorUserId, correlationId, details: { reason } });
                await transaction.commit();
            } catch (error) {
                try { await transaction.rollback(); } catch { /* Preserve original error. */ }
                throw error;
            }
        },

        appendEvent(event) { return appendEventWith(query, event); },

        async list({ pageSize, offset, libraryKey, q, extensions, uploadedFrom, sort }) {
            const params = { pageSize, offset, libraryKey: libraryKey || null, q: q || null, uploadedFrom: uploadedFrom || null };
            const extensionClause = extensions.length
                ? `AND artifact.fileExtension IN (${extensions.map((extension, index) => {
                    params[`extension${index}`] = extension;
                    return `@extension${index}`;
                }).join(", ")})`
                : "";
            const where = `WHERE artifact.lifecycleState = 'Active' AND artifact.ingestionState = 'Uploaded'
                AND (@libraryKey IS NULL OR artifact.libraryKey = @libraryKey)
                AND (@q IS NULL OR artifact.originalFileName LIKE '%' + @q + '%' OR artifact.description LIKE '%' + @q + '%')
                AND (@uploadedFrom IS NULL OR artifact.uploadedAt >= @uploadedFrom)
                ${extensionClause}`;
            const orderBy = sort === "name" ? "artifact.originalFileName, artifact.id"
                : sort === "area" ? "artifact.libraryKey, artifact.originalFileName, artifact.id"
                    : "artifact.uploadedAt DESC, artifact.id";
            const countRows = await query(`SELECT COUNT_BIG(*) AS total FROM cmdb.Artifacts artifact ${where}`, params);
            const rows = await query(`${SELECT_ARTIFACT} ${where}
                ORDER BY ${orderBy}
                OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`, params);
            return { rows, total: Number(countRows[0]?.total || 0) };
        },
    };
    return repository;
}

export const artifactRepository = createArtifactRepository();

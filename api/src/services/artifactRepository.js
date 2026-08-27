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

const WORKING_PLACEMENT_APPLY = `OUTER APPLY (
    SELECT COUNT_BIG(*) AS placementCount,
        MAX(CONVERT(varchar(36), placement.id)) AS placementId,
        MAX(placement.legacyLibraryKey) AS legacyLibraryKey,
        MAX(placement.siteId) AS siteId, MAX(placement.driveId) AS driveId,
        MAX(placement.itemId) AS itemId, MAX(placement.webUrl) AS webUrl
    FROM cmdb.ArtifactPlacements placement
    WHERE placement.artifactId = artifact.id
      AND placement.placementType = artifact.storageDestination
      AND placement.placementStatus = 'Active'
) working
CROSS JOIN (
    SELECT appliedAt FROM cmdb.SchemaMigrations
    WHERE migrationName = '016_artifact_placements.sql'
) placementMigration`;

const SELECT_READ_ARTIFACT = `SELECT CONVERT(varchar(36), artifact.id) AS id, artifact.originalFileName,
    artifact.storedFileName, artifact.fileExtension, artifact.contentType, artifact.contentSize,
    artifact.contentSha256, artifact.ingestionState, artifact.classificationState,
    artifact.lifecycleState, artifact.storageDestination,
    COALESCE(working.legacyLibraryKey, artifact.libraryKey) AS libraryKey,
    COALESCE(working.siteId, artifact.siteId) AS siteId,
    COALESCE(working.driveId, artifact.driveId) AS driveId,
    COALESCE(working.itemId, artifact.itemId) AS itemId,
    COALESCE(working.webUrl, artifact.webUrl) AS webUrl,
    artifact.sourceOrigin, artifact.sourceModule, artifact.sourceContext,
    artifact.submittedByUserId, artifact.idempotencyKey, artifact.description,
    artifact.effectiveDate, artifact.classificationProvenance, artifact.classificationConfidence,
    artifact.uploadedAt, artifact.createdAt, artifact.updatedAt,
    working.placementCount AS workingPlacementCount, working.placementId AS workingPlacementId,
    working.legacyLibraryKey AS placementLibraryKey,
    working.siteId AS placementSiteId, working.driveId AS placementDriveId,
    working.itemId AS placementItemId, working.webUrl AS placementWebUrl,
    artifact.libraryKey AS legacyArtifactLibraryKey,
    artifact.siteId AS legacyArtifactSiteId, artifact.driveId AS legacyArtifactDriveId,
    artifact.itemId AS legacyArtifactItemId, artifact.webUrl AS legacyArtifactWebUrl,
    placementMigration.appliedAt AS placementMigrationAppliedAt
    FROM cmdb.Artifacts artifact
    ${WORKING_PLACEMENT_APPLY}`;

export class ArtifactLockError extends Error {
    constructor() { super("Artifact operation is already in progress"); this.name = "ArtifactLockError"; }
}

export class ArtifactPlacementReadError extends Error {
    constructor() { super("Artifact Working placement requires reconciliation"); this.name = "ArtifactPlacementReadError"; }
}

export class ArtifactPlacementWriteError extends Error {
    constructor() { super("Artifact Working placement requires reconciliation"); this.name = "ArtifactPlacementWriteError"; }
}

function sameNullable(left, right) { return (left ?? null) === (right ?? null); }

function validateWorkingPlacement(row) {
    if (!row || row.ingestionState !== "Uploaded") return row;
    const count = Number(row.workingPlacementCount || 0);
    if (count > 1) throw new ArtifactPlacementReadError();
    if (count === 0) {
        if (row.storageDestination !== "Working" || !row.placementMigrationAppliedAt
            || new Date(row.createdAt) <= new Date(row.placementMigrationAppliedAt)) {
            throw new ArtifactPlacementReadError();
        }
        return row;
    }
    if (!sameNullable(row.placementSiteId, row.legacyArtifactSiteId)
        || !sameNullable(row.placementDriveId, row.legacyArtifactDriveId)
        || !sameNullable(row.placementItemId, row.legacyArtifactItemId)
        || !sameNullable(row.placementWebUrl, row.legacyArtifactWebUrl)
        || (row.placementLibraryKey != null && row.placementLibraryKey !== row.legacyArtifactLibraryKey)) {
        throw new ArtifactPlacementReadError();
    }
    return row;
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

        async getForRead(id) {
            const rows = await query(`${SELECT_READ_ARTIFACT} WHERE artifact.id = @id`, { id });
            if (!rows[0]) return null;
            return validateWorkingPlacement(rows[0]);
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
                     contentSha256, storageDestination, libraryKey, sourceOrigin, sourceModule, sourceContext,
                     submittedByUserId, idempotencyKey)
                    VALUES (@id, @originalFileName, @storedFileName, @fileExtension, @contentType, @contentSize,
                     @contentSha256, @storageDestination, @libraryKey, @sourceOrigin, @sourceModule, @sourceContext,
                     @submittedByUserId, @idempotencyKey)`, values);
                await queryInTransaction(transaction, `INSERT INTO cmdb.ArtifactPlacements
                    (id, artifactId, placementType, placementStatus, siteKey, legacyLibraryKey, createdByUserId)
                    VALUES (@placementId, @id, @storageDestination, 'Pending', @siteKey, @libraryKey, @submittedByUserId)`,
                { ...values, placementId: generateUuid() });
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
                const placements = await queryInTransaction(transaction, `UPDATE placement
                    SET placementStatus = 'Pending', updatedAt = SYSUTCDATETIME()
                    OUTPUT CONVERT(varchar(36), INSERTED.id) AS id
                    FROM cmdb.ArtifactPlacements placement
                    INNER JOIN cmdb.Artifacts artifact ON artifact.id = placement.artifactId
                    WHERE placement.artifactId = @id AND placement.placementType = artifact.storageDestination
                      AND placement.placementStatus = 'Failed'`, { id });
                if (placements.length !== 1) throw new ArtifactPlacementWriteError();
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
            const transaction = createTransaction(await getPool());
            await transaction.begin();
            try {
                const params = { id, siteId, driveId, itemId, webUrl };
                const changed = await queryInTransaction(transaction, `UPDATE cmdb.Artifacts
                    SET siteId = @siteId, driveId = @driveId, itemId = @itemId,
                        webUrl = @webUrl, updatedAt = SYSUTCDATETIME()
                    OUTPUT CONVERT(varchar(36), INSERTED.id) AS id
                    WHERE id = @id AND ingestionState = 'Pending'
                      AND (itemId IS NULL OR (siteId = @siteId AND driveId = @driveId AND itemId = @itemId))`, params);
                if (!changed[0]) throw new ArtifactLockError();
                const placements = await queryInTransaction(transaction, `UPDATE placement
                    SET siteId = @siteId, driveId = @driveId, itemId = @itemId, webUrl = @webUrl,
                        updatedAt = SYSUTCDATETIME()
                    OUTPUT CONVERT(varchar(36), INSERTED.id) AS id
                    FROM cmdb.ArtifactPlacements placement
                    INNER JOIN cmdb.Artifacts artifact ON artifact.id = placement.artifactId
                    WHERE placement.artifactId = @id AND placement.placementType = artifact.storageDestination
                      AND placement.placementStatus = 'Pending'
                      AND (itemId IS NULL OR (siteId = @siteId AND driveId = @driveId AND itemId = @itemId))`, params);
                if (placements.length !== 1) throw new ArtifactPlacementWriteError();
                await transaction.commit();
                return repository.getById(id);
            } catch (error) {
                try { await transaction.rollback(); } catch { /* Preserve original error. */ }
                throw error;
            }
        },

        async markUploaded(id, actorUserId, correlationId) {
            const transaction = createTransaction(await getPool());
            await transaction.begin();
            try {
                const changed = await queryInTransaction(transaction, `UPDATE cmdb.Artifacts
                    SET ingestionState = 'Uploaded', uploadedAt = COALESCE(uploadedAt, SYSUTCDATETIME()), updatedAt = SYSUTCDATETIME()
                    OUTPUT CONVERT(varchar(36), INSERTED.id) AS id, INSERTED.uploadedAt AS uploadedAt
                    WHERE id = @id AND ingestionState = 'Pending' AND siteId IS NOT NULL AND driveId IS NOT NULL AND itemId IS NOT NULL`, { id });
                if (!changed[0]) throw new ArtifactLockError();
                const placements = await queryInTransaction(transaction, `UPDATE placement
                    SET placementStatus = 'Active', activatedAt = @activatedAt, updatedAt = SYSUTCDATETIME()
                    OUTPUT CONVERT(varchar(36), INSERTED.id) AS id
                    FROM cmdb.ArtifactPlacements placement
                    INNER JOIN cmdb.Artifacts artifact ON artifact.id = placement.artifactId
                    WHERE placement.artifactId = @id AND placement.placementType = artifact.storageDestination
                      AND placement.placementStatus = 'Pending'
                      AND placement.siteId = artifact.siteId AND placement.driveId = artifact.driveId
                      AND placement.itemId = artifact.itemId
                      AND ISNULL(placement.webUrl, '') = ISNULL(artifact.webUrl, '')
                      AND ISNULL(placement.legacyLibraryKey, '') = ISNULL(artifact.libraryKey, '')`,
                { id, activatedAt: changed[0].uploadedAt });
                if (placements.length !== 1) throw new ArtifactPlacementWriteError();
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
                if (changed[0]) {
                    const placements = await queryInTransaction(transaction, `UPDATE placement
                        SET placementStatus = 'Failed', updatedAt = SYSUTCDATETIME()
                        OUTPUT CONVERT(varchar(36), INSERTED.id) AS id
                        FROM cmdb.ArtifactPlacements placement
                        INNER JOIN cmdb.Artifacts artifact ON artifact.id = placement.artifactId
                        WHERE placement.artifactId = @id AND placement.placementType = artifact.storageDestination
                          AND placement.placementStatus = 'Pending'
                          AND siteId IS NULL AND driveId IS NULL AND itemId IS NULL AND webUrl IS NULL`, { id });
                    if (placements.length !== 1) throw new ArtifactPlacementWriteError();
                    await appendEventWith((statement, params) => queryInTransaction(transaction, statement, params),
                        { artifactId: id, eventType: "ArtifactUploadFailed", actorUserId, correlationId, details: { reason } });
                }
                await transaction.commit();
            } catch (error) {
                try { await transaction.rollback(); } catch { /* Preserve original error. */ }
                throw error;
            }
        },

        appendEvent(event) { return appendEventWith(query, event); },

        async list({ pageSize, offset, destination, libraryKey, q, extensions, uploadedFrom, sort }) {
            const params = { pageSize, offset, destination: destination || null, libraryKey: libraryKey || null, q: q || null, uploadedFrom: uploadedFrom || null };
            const extensionClause = extensions.length
                ? `AND artifact.fileExtension IN (${extensions.map((extension, index) => {
                    params[`extension${index}`] = extension;
                    return `@extension${index}`;
                }).join(", ")})`
                : "";
            const inconsistency = `artifact.lifecycleState = 'Active' AND artifact.ingestionState = 'Uploaded'
                AND (working.placementCount > 1
                    OR (working.placementCount = 0 AND (artifact.storageDestination <> 'Working' OR artifact.createdAt <= placementMigration.appliedAt))
                    OR (working.placementCount = 1 AND (
                        ISNULL(working.siteId, '') <> ISNULL(artifact.siteId, '')
                        OR ISNULL(working.driveId, '') <> ISNULL(artifact.driveId, '')
                        OR ISNULL(working.itemId, '') <> ISNULL(artifact.itemId, '')
                        OR ISNULL(working.webUrl, '') <> ISNULL(artifact.webUrl, '')
                        OR (working.legacyLibraryKey IS NOT NULL AND working.legacyLibraryKey <> artifact.libraryKey)
                    )))`;
            const inconsistentRows = await query(`SELECT TOP (1) CONVERT(varchar(36), artifact.id) AS id
                FROM cmdb.Artifacts artifact ${WORKING_PLACEMENT_APPLY}
                WHERE ${inconsistency}`, {});
            if (inconsistentRows[0]) throw new ArtifactPlacementReadError();
            const where = `WHERE artifact.lifecycleState = 'Active' AND artifact.ingestionState = 'Uploaded'
                AND (@destination IS NULL OR artifact.storageDestination = @destination)
                AND (@libraryKey IS NULL OR COALESCE(working.legacyLibraryKey, artifact.libraryKey) = @libraryKey)
                AND (@q IS NULL OR artifact.originalFileName LIKE '%' + @q + '%' OR artifact.description LIKE '%' + @q + '%')
                AND (@uploadedFrom IS NULL OR artifact.uploadedAt >= @uploadedFrom)
                ${extensionClause}`;
            const orderBy = sort === "name" ? "artifact.originalFileName, artifact.id"
                : sort === "area" ? "COALESCE(working.legacyLibraryKey, artifact.libraryKey), artifact.originalFileName, artifact.id"
                    : "artifact.uploadedAt DESC, artifact.id";
            const countRows = await query(`SELECT COUNT_BIG(*) AS total FROM cmdb.Artifacts artifact
                ${WORKING_PLACEMENT_APPLY} ${where}`, params);
            const rows = await query(`${SELECT_READ_ARTIFACT} ${where}
                ORDER BY ${orderBy}
                OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`, params);
            return { rows, total: Number(countRows[0]?.total || 0) };
        },
    };
    return repository;
}

export const artifactRepository = createArtifactRepository();

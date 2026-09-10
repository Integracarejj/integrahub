-- Migration: 023_recap_lifecycle_status_width.sql
-- Widen authoritative Recap lifecycle columns to fit every permitted status.
-- Checksum is calculated with CRLF normalized to LF and this literal normalized to zeros.

SET XACT_ABORT ON;

BEGIN TRY
    BEGIN TRANSACTION;

IF OBJECT_ID('cmdb.SchemaMigrations', 'U') IS NULL OR OBJECT_ID('cmdb.RecapWorkItems', 'U') IS NULL
    OR OBJECT_ID('cmdb.RecapWorkArtifacts', 'U') IS NULL
    THROW 51090, 'Migration 023 requires SchemaMigrations and migrations 014 through 022.', 1;

DECLARE @migrationName NVARCHAR(255) = N'023_recap_lifecycle_status_width.sql';
DECLARE @contentSha256 CHAR(64) = '4C035809FD054110A0E23C52764844313A442A83B63CC294D2B3F144AC815EE5';
DECLARE @existingChecksum CHAR(64) = (SELECT contentSha256 FROM cmdb.SchemaMigrations WHERE migrationName = @migrationName);

IF @existingChecksum IS NOT NULL AND @existingChecksum <> @contentSha256
    THROW 51091, 'Migration 023 was previously recorded with a different checksum.', 1;

IF @existingChecksum = @contentSha256
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.columns columnInfo INNER JOIN sys.types typeInfo ON typeInfo.user_type_id = columnInfo.user_type_id
            WHERE columnInfo.object_id = OBJECT_ID('cmdb.RecapWorkItems') AND columnInfo.name = 'status'
              AND typeInfo.name = 'varchar' AND columnInfo.max_length = 32 AND columnInfo.is_nullable = 0)
        OR NOT EXISTS (SELECT 1 FROM sys.columns columnInfo INNER JOIN sys.types typeInfo ON typeInfo.user_type_id = columnInfo.user_type_id
            WHERE columnInfo.object_id = OBJECT_ID('cmdb.RecapWorkArtifacts') AND columnInfo.name = 'publicationEligibility'
              AND typeInfo.name = 'varchar' AND columnInfo.max_length = 32 AND columnInfo.is_nullable = 0)
        OR 3 <> (SELECT COUNT(*) FROM sys.check_constraints
            WHERE parent_object_id = OBJECT_ID('cmdb.RecapWorkItems')
              AND name IN ('CK_RecapWorkItems_Status', 'CK_RecapWorkItems_ActiveReason', 'CK_RecapWorkItems_Disposition')
              AND is_disabled = 0 AND is_not_trusted = 0)
        OR NOT EXISTS (SELECT 1 FROM sys.check_constraints
            WHERE parent_object_id = OBJECT_ID('cmdb.RecapWorkItems') AND name = 'CK_RecapWorkItems_Status'
              AND is_disabled = 0 AND is_not_trusted = 0
              AND definition LIKE '%Queued%' AND definition LIKE '%Assigned%' AND definition LIKE '%In Progress%'
              AND definition LIKE '%Clarification Needed%' AND definition LIKE '%Blocked%' AND definition LIKE '%Needs DD Review%'
              AND definition LIKE '%Ready to Publish%' AND definition LIKE '%Waiting Partner Review%'
              AND definition LIKE '%Completed%' AND definition LIKE '%Not Applicable%' AND definition LIKE '%Duplicate%')
        OR NOT EXISTS (SELECT 1 FROM sys.check_constraints
            WHERE parent_object_id = OBJECT_ID('cmdb.RecapWorkItems') AND name = 'CK_RecapWorkItems_ActiveReason'
              AND is_disabled = 0 AND is_not_trusted = 0 AND definition LIKE '%Clarification Needed%'
              AND definition LIKE '%Clarification%' AND definition LIKE '%Blocked%' AND definition LIKE '%Blocker%'
              AND definition LIKE '%activeReasonType%' AND definition LIKE '%activeReason%')
        OR NOT EXISTS (SELECT 1 FROM sys.check_constraints
            WHERE parent_object_id = OBJECT_ID('cmdb.RecapWorkItems') AND name = 'CK_RecapWorkItems_Disposition'
              AND is_disabled = 0 AND is_not_trusted = 0 AND definition LIKE '%Not Applicable%'
              AND definition LIKE '%Duplicate%' AND definition LIKE '%Needs DD Review%'
              AND definition LIKE '%proposedDisposition%' AND definition LIKE '%dispositionReason%'
              AND definition LIKE '%dispositionProposedByUserId%' AND definition LIKE '%dispositionProposedAt%')
        OR NOT EXISTS (SELECT 1 FROM sys.check_constraints
            WHERE parent_object_id = OBJECT_ID('cmdb.RecapWorkArtifacts')
              AND name = 'CK_RecapWorkArtifacts_PublicationEligibility' AND is_disabled = 0 AND is_not_trusted = 0
              AND definition LIKE '%Active%' AND definition LIKE '%PendingReplacement%' AND definition LIKE '%Superseded%'
              AND definition LIKE '%supersededByArtifactId%' AND definition LIKE '%supersededAt%' AND definition LIKE '%supersededByUserId%')
        OR NOT EXISTS (SELECT 1 FROM sys.default_constraints defaultInfo INNER JOIN sys.columns columnInfo
            ON columnInfo.object_id = defaultInfo.parent_object_id AND columnInfo.column_id = defaultInfo.parent_column_id
            WHERE defaultInfo.parent_object_id = OBJECT_ID('cmdb.RecapWorkArtifacts')
              AND defaultInfo.name = 'DF_RecapWorkArtifacts_PublicationEligibility'
              AND columnInfo.name = 'publicationEligibility'
              AND REPLACE(REPLACE(defaultInfo.definition, '(', ''), ')', '') = '''Active''')
        OR NOT EXISTS (SELECT 1 FROM sys.indexes indexInfo WHERE indexInfo.object_id = OBJECT_ID('cmdb.RecapWorkArtifacts')
            AND indexInfo.name = 'IX_RecapWorkArtifacts_PublicationEligible' AND indexInfo.is_disabled = 0
            AND indexInfo.is_unique = 0 AND indexInfo.has_filter = 1
            AND REPLACE(REPLACE(indexInfo.filter_definition, '[', ''), ']', '') = '(status=''Uploaded'')'
            AND (SELECT COUNT(*) FROM sys.index_columns WHERE object_id = indexInfo.object_id AND index_id = indexInfo.index_id AND key_ordinal > 0) = 3
            AND NOT EXISTS (SELECT 1 FROM sys.index_columns WHERE object_id = indexInfo.object_id AND index_id = indexInfo.index_id AND is_included_column = 1)
            AND NOT EXISTS (SELECT expected.keyOrdinal, expected.columnName, expected.isDescending
                FROM (VALUES (1, 'workItemId', 0), (2, 'publicationEligibility', 0), (3, 'uploadedAt', 1)) expected(keyOrdinal, columnName, isDescending)
                WHERE NOT EXISTS (SELECT 1 FROM sys.index_columns indexColumn INNER JOIN sys.columns columnInfo
                    ON columnInfo.object_id = indexColumn.object_id AND columnInfo.column_id = indexColumn.column_id
                    WHERE indexColumn.object_id = indexInfo.object_id AND indexColumn.index_id = indexInfo.index_id
                      AND indexColumn.key_ordinal = expected.keyOrdinal AND columnInfo.name = expected.columnName
                      AND indexColumn.is_descending_key = expected.isDescending)))
        THROW 51092, 'Migration 023 is recorded but its required schema is incomplete.', 1;
    COMMIT TRANSACTION;
    PRINT 'Migration 023 already applied';
    RETURN;
END;

IF NOT EXISTS (SELECT 1 FROM cmdb.SchemaMigrations
        WHERE migrationName = N'022_recap_external_publication.sql'
          AND contentSha256 = '533855CB1A9ACEF557B36C5C67377DB00146C04A2F9F726E1261C76127A44A97')
    THROW 51093, 'Migration 023 requires the recorded final migration 022.', 1;

IF NOT EXISTS (SELECT 1 FROM sys.columns columnInfo INNER JOIN sys.types typeInfo ON typeInfo.user_type_id = columnInfo.user_type_id
        WHERE columnInfo.object_id = OBJECT_ID('cmdb.RecapWorkItems') AND columnInfo.name = 'status'
          AND typeInfo.name = 'varchar' AND columnInfo.max_length = 20 AND columnInfo.is_nullable = 0)
    OR NOT EXISTS (SELECT 1 FROM sys.columns columnInfo INNER JOIN sys.types typeInfo ON typeInfo.user_type_id = columnInfo.user_type_id
        WHERE columnInfo.object_id = OBJECT_ID('cmdb.RecapWorkArtifacts') AND columnInfo.name = 'publicationEligibility'
          AND typeInfo.name = 'varchar' AND columnInfo.max_length = 16 AND columnInfo.is_nullable = 0)
    OR 3 <> (SELECT COUNT(*) FROM sys.check_constraints
        WHERE parent_object_id = OBJECT_ID('cmdb.RecapWorkItems')
          AND name IN ('CK_RecapWorkItems_Status', 'CK_RecapWorkItems_ActiveReason', 'CK_RecapWorkItems_Disposition')
          AND is_disabled = 0 AND is_not_trusted = 0)
    OR NOT EXISTS (SELECT 1 FROM sys.check_constraints
        WHERE parent_object_id = OBJECT_ID('cmdb.RecapWorkItems') AND name = 'CK_RecapWorkItems_Status'
          AND definition LIKE '%Waiting Partner Review%' AND definition LIKE '%Completed%')
    OR NOT EXISTS (SELECT 1 FROM sys.check_constraints
        WHERE parent_object_id = OBJECT_ID('cmdb.RecapWorkArtifacts')
          AND name = 'CK_RecapWorkArtifacts_PublicationEligibility' AND is_disabled = 0 AND is_not_trusted = 0)
    OR NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('cmdb.RecapWorkArtifacts')
        AND name = 'IX_RecapWorkArtifacts_PublicationEligible' AND is_disabled = 0)
    THROW 51094, 'Recap lifecycle schema is incompatible with migration 023.', 1;

ALTER TABLE cmdb.RecapWorkItems DROP CONSTRAINT CK_RecapWorkItems_Status;
ALTER TABLE cmdb.RecapWorkItems DROP CONSTRAINT CK_RecapWorkItems_ActiveReason;
ALTER TABLE cmdb.RecapWorkItems DROP CONSTRAINT CK_RecapWorkItems_Disposition;
ALTER TABLE cmdb.RecapWorkItems ALTER COLUMN status VARCHAR(32) NOT NULL;

ALTER TABLE cmdb.RecapWorkItems WITH CHECK ADD CONSTRAINT CK_RecapWorkItems_Status CHECK (status IN (
    'Queued', 'Assigned', 'In Progress', 'Clarification Needed', 'Blocked', 'Needs DD Review',
    'Ready to Publish', 'Waiting Partner Review', 'Completed', 'Not Applicable', 'Duplicate'
));
ALTER TABLE cmdb.RecapWorkItems WITH CHECK ADD CONSTRAINT CK_RecapWorkItems_ActiveReason CHECK (
    (status = 'Clarification Needed' AND activeReasonType IS NOT NULL AND activeReasonType = 'Clarification'
        AND activeReason IS NOT NULL AND NULLIF(LTRIM(RTRIM(activeReason)), '') IS NOT NULL)
    OR (status = 'Blocked' AND activeReasonType IS NOT NULL AND activeReasonType = 'Blocker'
        AND activeReason IS NOT NULL AND NULLIF(LTRIM(RTRIM(activeReason)), '') IS NOT NULL)
    OR (status NOT IN ('Clarification Needed', 'Blocked') AND activeReasonType IS NULL AND activeReason IS NULL)
);
ALTER TABLE cmdb.RecapWorkItems WITH CHECK ADD CONSTRAINT CK_RecapWorkItems_Disposition CHECK (
    (status NOT IN ('Not Applicable', 'Duplicate')
        AND proposedDisposition IS NULL AND dispositionReason IS NULL AND dispositionProposedByUserId IS NULL AND dispositionProposedAt IS NULL)
    OR (proposedDisposition IS NOT NULL AND proposedDisposition IN ('Not Applicable', 'Duplicate')
        AND dispositionReason IS NOT NULL AND NULLIF(LTRIM(RTRIM(dispositionReason)), '') IS NOT NULL
        AND dispositionProposedByUserId IS NOT NULL AND dispositionProposedAt IS NOT NULL
        AND (status = 'Needs DD Review' OR status = proposedDisposition))
);
ALTER TABLE cmdb.RecapWorkItems CHECK CONSTRAINT CK_RecapWorkItems_Status;
ALTER TABLE cmdb.RecapWorkItems CHECK CONSTRAINT CK_RecapWorkItems_ActiveReason;
ALTER TABLE cmdb.RecapWorkItems CHECK CONSTRAINT CK_RecapWorkItems_Disposition;

DROP INDEX IX_RecapWorkArtifacts_PublicationEligible ON cmdb.RecapWorkArtifacts;
ALTER TABLE cmdb.RecapWorkArtifacts DROP CONSTRAINT CK_RecapWorkArtifacts_PublicationEligibility;
ALTER TABLE cmdb.RecapWorkArtifacts ALTER COLUMN publicationEligibility VARCHAR(32) NOT NULL;
ALTER TABLE cmdb.RecapWorkArtifacts WITH CHECK ADD CONSTRAINT CK_RecapWorkArtifacts_PublicationEligibility CHECK (
    (publicationEligibility IN ('Active', 'PendingReplacement') AND supersededByArtifactId IS NULL
        AND supersededAt IS NULL AND supersededByUserId IS NULL)
    OR (publicationEligibility = 'Superseded' AND supersededByArtifactId IS NOT NULL
        AND supersededByArtifactId <> id AND supersededAt IS NOT NULL AND supersededByUserId IS NOT NULL)
);
ALTER TABLE cmdb.RecapWorkArtifacts CHECK CONSTRAINT CK_RecapWorkArtifacts_PublicationEligibility;
CREATE INDEX IX_RecapWorkArtifacts_PublicationEligible
    ON cmdb.RecapWorkArtifacts(workItemId, publicationEligibility, uploadedAt DESC)
    WHERE status = 'Uploaded';

IF NOT EXISTS (SELECT 1 FROM sys.columns columnInfo INNER JOIN sys.types typeInfo ON typeInfo.user_type_id = columnInfo.user_type_id
        WHERE columnInfo.object_id = OBJECT_ID('cmdb.RecapWorkItems') AND columnInfo.name = 'status'
          AND typeInfo.name = 'varchar' AND columnInfo.max_length = 32 AND columnInfo.is_nullable = 0)
    OR NOT EXISTS (SELECT 1 FROM sys.columns columnInfo INNER JOIN sys.types typeInfo ON typeInfo.user_type_id = columnInfo.user_type_id
        WHERE columnInfo.object_id = OBJECT_ID('cmdb.RecapWorkArtifacts') AND columnInfo.name = 'publicationEligibility'
          AND typeInfo.name = 'varchar' AND columnInfo.max_length = 32 AND columnInfo.is_nullable = 0)
    OR 3 <> (SELECT COUNT(*) FROM sys.check_constraints
        WHERE parent_object_id = OBJECT_ID('cmdb.RecapWorkItems')
          AND name IN ('CK_RecapWorkItems_Status', 'CK_RecapWorkItems_ActiveReason', 'CK_RecapWorkItems_Disposition')
          AND is_disabled = 0 AND is_not_trusted = 0)
    OR NOT EXISTS (SELECT 1 FROM sys.check_constraints
        WHERE parent_object_id = OBJECT_ID('cmdb.RecapWorkItems') AND name = 'CK_RecapWorkItems_Status'
          AND is_disabled = 0 AND is_not_trusted = 0
          AND definition LIKE '%Queued%' AND definition LIKE '%Assigned%' AND definition LIKE '%In Progress%'
          AND definition LIKE '%Clarification Needed%' AND definition LIKE '%Blocked%' AND definition LIKE '%Needs DD Review%'
          AND definition LIKE '%Ready to Publish%' AND definition LIKE '%Waiting Partner Review%'
          AND definition LIKE '%Completed%' AND definition LIKE '%Not Applicable%' AND definition LIKE '%Duplicate%')
    OR NOT EXISTS (SELECT 1 FROM sys.check_constraints
        WHERE parent_object_id = OBJECT_ID('cmdb.RecapWorkItems') AND name = 'CK_RecapWorkItems_ActiveReason'
          AND is_disabled = 0 AND is_not_trusted = 0 AND definition LIKE '%Clarification Needed%'
          AND definition LIKE '%Clarification%' AND definition LIKE '%Blocked%' AND definition LIKE '%Blocker%'
          AND definition LIKE '%activeReasonType%' AND definition LIKE '%activeReason%')
    OR NOT EXISTS (SELECT 1 FROM sys.check_constraints
        WHERE parent_object_id = OBJECT_ID('cmdb.RecapWorkItems') AND name = 'CK_RecapWorkItems_Disposition'
          AND is_disabled = 0 AND is_not_trusted = 0 AND definition LIKE '%Not Applicable%'
          AND definition LIKE '%Duplicate%' AND definition LIKE '%Needs DD Review%'
          AND definition LIKE '%proposedDisposition%' AND definition LIKE '%dispositionReason%'
          AND definition LIKE '%dispositionProposedByUserId%' AND definition LIKE '%dispositionProposedAt%')
    OR NOT EXISTS (SELECT 1 FROM sys.check_constraints
        WHERE parent_object_id = OBJECT_ID('cmdb.RecapWorkArtifacts')
          AND name = 'CK_RecapWorkArtifacts_PublicationEligibility' AND is_disabled = 0 AND is_not_trusted = 0
          AND definition LIKE '%Active%' AND definition LIKE '%PendingReplacement%' AND definition LIKE '%Superseded%'
          AND definition LIKE '%supersededByArtifactId%' AND definition LIKE '%supersededAt%' AND definition LIKE '%supersededByUserId%')
    OR NOT EXISTS (SELECT 1 FROM sys.default_constraints defaultInfo INNER JOIN sys.columns columnInfo
        ON columnInfo.object_id = defaultInfo.parent_object_id AND columnInfo.column_id = defaultInfo.parent_column_id
        WHERE defaultInfo.parent_object_id = OBJECT_ID('cmdb.RecapWorkArtifacts')
          AND defaultInfo.name = 'DF_RecapWorkArtifacts_PublicationEligibility'
          AND columnInfo.name = 'publicationEligibility'
          AND REPLACE(REPLACE(defaultInfo.definition, '(', ''), ')', '') = '''Active''')
    OR NOT EXISTS (SELECT 1 FROM sys.indexes indexInfo WHERE indexInfo.object_id = OBJECT_ID('cmdb.RecapWorkArtifacts')
        AND indexInfo.name = 'IX_RecapWorkArtifacts_PublicationEligible' AND indexInfo.is_disabled = 0
        AND indexInfo.is_unique = 0 AND indexInfo.has_filter = 1
        AND REPLACE(REPLACE(indexInfo.filter_definition, '[', ''), ']', '') = '(status=''Uploaded'')'
        AND (SELECT COUNT(*) FROM sys.index_columns WHERE object_id = indexInfo.object_id AND index_id = indexInfo.index_id AND key_ordinal > 0) = 3
        AND NOT EXISTS (SELECT 1 FROM sys.index_columns WHERE object_id = indexInfo.object_id AND index_id = indexInfo.index_id AND is_included_column = 1)
        AND NOT EXISTS (SELECT expected.keyOrdinal, expected.columnName, expected.isDescending
            FROM (VALUES (1, 'workItemId', 0), (2, 'publicationEligibility', 0), (3, 'uploadedAt', 1)) expected(keyOrdinal, columnName, isDescending)
            WHERE NOT EXISTS (SELECT 1 FROM sys.index_columns indexColumn INNER JOIN sys.columns columnInfo
                ON columnInfo.object_id = indexColumn.object_id AND columnInfo.column_id = indexColumn.column_id
                WHERE indexColumn.object_id = indexInfo.object_id AND indexColumn.index_id = indexInfo.index_id
                  AND indexColumn.key_ordinal = expected.keyOrdinal AND columnInfo.name = expected.columnName
                  AND indexColumn.is_descending_key = expected.isDescending)))
    THROW 51095, 'Migration 023 post-change schema verification failed.', 1;

INSERT INTO cmdb.SchemaMigrations (migrationName, contentSha256, releaseName, appliedBy)
VALUES (@migrationName, @contentSha256, NULL, NULL);

COMMIT TRANSACTION;
PRINT 'Migration 023 complete';
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;

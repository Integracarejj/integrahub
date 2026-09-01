-- Migration: 020_artifact_lifecycle.sql
-- Add durable Move operation identity, placement cardinality, and Move audit events.

SET XACT_ABORT ON;

BEGIN TRY
    BEGIN TRANSACTION;

IF OBJECT_ID('cmdb.SchemaMigrations', 'U') IS NULL
    THROW 51050, 'Migration 020 requires cmdb.SchemaMigrations.', 1;
IF OBJECT_ID('cmdb.Artifacts', 'U') IS NULL OR OBJECT_ID('cmdb.ArtifactPlacements', 'U') IS NULL
    OR OBJECT_ID('cmdb.ArtifactEvents', 'U') IS NULL
    THROW 51051, 'Migration 020 requires migrations 015 through 019.', 1;

DECLARE @migrationName NVARCHAR(255) = N'020_artifact_lifecycle.sql';
DECLARE @contentSha256 CHAR(64) = '741FB7DAD05B271863B5571358C22590BA8FBBB92A8C0C7C19D31B90509705CB';
DECLARE @existingChecksum CHAR(64) = (SELECT contentSha256 FROM cmdb.SchemaMigrations WHERE migrationName = @migrationName);

IF @existingChecksum IS NOT NULL AND @existingChecksum <> @contentSha256
    THROW 51052, 'Migration 020 was previously recorded with a different checksum.', 1;

IF @existingChecksum = @contentSha256
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.columns columnInfo INNER JOIN sys.types typeInfo ON typeInfo.user_type_id = columnInfo.user_type_id
            WHERE columnInfo.object_id = OBJECT_ID('cmdb.ArtifactPlacements') AND columnInfo.name = 'operationKey'
              AND typeInfo.name = 'varchar' AND columnInfo.max_length = 128 AND columnInfo.is_nullable = 1
              AND columnInfo.collation_name = 'Latin1_General_100_BIN2')
        OR NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('cmdb.ArtifactPlacements')
            AND name = 'UQ_ArtifactPlacements_ActiveArtifact' AND is_unique = 1 AND has_filter = 1 AND is_disabled = 0
            AND REPLACE(REPLACE(filter_definition, '[', ''), ']', '') = '(placementStatus=''Active'')'
            AND (SELECT COUNT(*) FROM sys.index_columns WHERE object_id = OBJECT_ID('cmdb.ArtifactPlacements') AND index_id = sys.indexes.index_id AND key_ordinal > 0) = 1
            AND EXISTS (SELECT 1 FROM sys.index_columns indexColumn INNER JOIN sys.columns columnInfo
                ON columnInfo.object_id = indexColumn.object_id AND columnInfo.column_id = indexColumn.column_id
                WHERE indexColumn.object_id = OBJECT_ID('cmdb.ArtifactPlacements') AND indexColumn.index_id = sys.indexes.index_id
                  AND indexColumn.key_ordinal = 1 AND columnInfo.name = 'artifactId'))
        OR NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('cmdb.ArtifactPlacements')
            AND name = 'UQ_ArtifactPlacements_PendingArtifact' AND is_unique = 1 AND has_filter = 1 AND is_disabled = 0
            AND REPLACE(REPLACE(filter_definition, '[', ''), ']', '') = '(placementStatus=''Pending'')'
            AND (SELECT COUNT(*) FROM sys.index_columns WHERE object_id = OBJECT_ID('cmdb.ArtifactPlacements') AND index_id = sys.indexes.index_id AND key_ordinal > 0) = 1
            AND EXISTS (SELECT 1 FROM sys.index_columns indexColumn INNER JOIN sys.columns columnInfo
                ON columnInfo.object_id = indexColumn.object_id AND columnInfo.column_id = indexColumn.column_id
                WHERE indexColumn.object_id = OBJECT_ID('cmdb.ArtifactPlacements') AND indexColumn.index_id = sys.indexes.index_id
                  AND indexColumn.key_ordinal = 1 AND columnInfo.name = 'artifactId'))
        OR NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('cmdb.ArtifactPlacements')
            AND name = 'UQ_ArtifactPlacements_Operation' AND is_unique = 1 AND has_filter = 1 AND is_disabled = 0
            AND REPLACE(REPLACE(filter_definition, '[', ''), ']', '') = '(operationKey IS NOT NULL)'
            AND (SELECT COUNT(*) FROM sys.index_columns WHERE object_id = OBJECT_ID('cmdb.ArtifactPlacements') AND index_id = sys.indexes.index_id AND key_ordinal > 0) = 2
            AND NOT EXISTS (SELECT expected.keyOrdinal, expected.columnName FROM (VALUES (1, 'artifactId'), (2, 'operationKey')) expected(keyOrdinal, columnName)
                WHERE NOT EXISTS (SELECT 1 FROM sys.index_columns indexColumn INNER JOIN sys.columns columnInfo
                    ON columnInfo.object_id = indexColumn.object_id AND columnInfo.column_id = indexColumn.column_id
                    WHERE indexColumn.object_id = OBJECT_ID('cmdb.ArtifactPlacements') AND indexColumn.index_id = sys.indexes.index_id
                      AND indexColumn.key_ordinal = expected.keyOrdinal AND columnInfo.name = expected.columnName)))
        OR NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('cmdb.ArtifactPlacements')
            AND name = 'CK_ArtifactPlacements_OperationKey' AND is_disabled = 0 AND is_not_trusted = 0)
        OR NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('cmdb.ArtifactEvents')
            AND name = 'CK_ArtifactEvents_Type' AND is_disabled = 0 AND is_not_trusted = 0
            AND CHARINDEX('ArtifactMoveStarted', definition) > 0 AND CHARINDEX('ArtifactMoved', definition) > 0
            AND CHARINDEX('ArtifactMoveFailed', definition) > 0)
        THROW 51053, 'Migration 020 is recorded but its required schema is incomplete.', 1;
    COMMIT TRANSACTION;
    PRINT 'Migration 020 already applied';
    RETURN;
END;

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('cmdb.ArtifactPlacements') AND name = 'operationKey')
    OR EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('cmdb.ArtifactPlacements')
        AND name IN ('UQ_ArtifactPlacements_ActiveArtifact', 'UQ_ArtifactPlacements_PendingArtifact', 'UQ_ArtifactPlacements_Operation'))
    OR EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('cmdb.ArtifactPlacements')
        AND name = 'CK_ArtifactPlacements_OperationKey')
    THROW 51054, 'Unrecorded Artifact lifecycle schema already exists.', 1;

IF EXISTS (SELECT artifactId FROM cmdb.ArtifactPlacements WHERE placementStatus = 'Active' GROUP BY artifactId HAVING COUNT_BIG(*) > 1)
    OR EXISTS (SELECT artifactId FROM cmdb.ArtifactPlacements WHERE placementStatus = 'Pending' GROUP BY artifactId HAVING COUNT_BIG(*) > 1)
    THROW 51055, 'Existing Artifact placement cardinality is incompatible with migration 020.', 1;

ALTER TABLE cmdb.ArtifactPlacements ADD operationKey VARCHAR(128) COLLATE Latin1_General_100_BIN2 NULL;

EXEC(N'ALTER TABLE cmdb.ArtifactPlacements ADD CONSTRAINT CK_ArtifactPlacements_OperationKey CHECK (
    operationKey IS NULL OR (
        LEN(operationKey) BETWEEN 8 AND 128
        AND operationKey NOT LIKE ''%[^A-Za-z0-9._:-]%'' COLLATE Latin1_General_100_BIN2
    )
)');

CREATE UNIQUE INDEX UQ_ArtifactPlacements_ActiveArtifact
    ON cmdb.ArtifactPlacements(artifactId) WHERE placementStatus = 'Active';
CREATE UNIQUE INDEX UQ_ArtifactPlacements_PendingArtifact
    ON cmdb.ArtifactPlacements(artifactId) WHERE placementStatus = 'Pending';
-- Dynamic DDL avoids SQL Server same-batch compilation of the newly-added column.
EXEC(N'CREATE UNIQUE INDEX UQ_ArtifactPlacements_Operation
    ON cmdb.ArtifactPlacements(artifactId, operationKey) WHERE operationKey IS NOT NULL');

ALTER TABLE cmdb.ArtifactEvents DROP CONSTRAINT CK_ArtifactEvents_Type;
ALTER TABLE cmdb.ArtifactEvents ADD CONSTRAINT CK_ArtifactEvents_Type CHECK (eventType IN (
    'ArtifactUploadStarted', 'ArtifactUploaded', 'ArtifactUploadFailed', 'ArtifactDownloaded',
    'MetadataUpdated', 'ArtifactClassified', 'ArtifactArchived', 'ArtifactRemoved',
    'ArtifactSuperseded', 'PromotedToKnowledge', 'PreparedForExternal', 'PublishedExternal',
    'ArtifactMoveStarted', 'ArtifactMoved', 'ArtifactMoveFailed'
));

INSERT INTO cmdb.SchemaMigrations (migrationName, contentSha256, releaseName, appliedBy)
VALUES (@migrationName, @contentSha256, NULL, NULL);

COMMIT TRANSACTION;
PRINT 'Migration 020 complete';
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;

-- Migration: 018_artifact_placement_stored_identity.sql
-- Add nullable physical byte identity to SharePoint Artifact placements.

SET XACT_ABORT ON;

BEGIN TRY
    BEGIN TRANSACTION;

IF OBJECT_ID('cmdb.SchemaMigrations', 'U') IS NULL
    THROW 51030, 'Migration 018 requires cmdb.SchemaMigrations.', 1;
IF OBJECT_ID('cmdb.Artifacts', 'U') IS NULL OR OBJECT_ID('cmdb.ArtifactPlacements', 'U') IS NULL
    THROW 51031, 'Migration 018 requires migrations 015 through 017.', 1;

DECLARE @migrationName NVARCHAR(255) = N'018_artifact_placement_stored_identity.sql';
DECLARE @contentSha256 CHAR(64) = '02AC9684A2FB27FCDF1AAB0D517BD356B88011A47A7CA3E043AD013A7D0DA7F4';
DECLARE @existingChecksum CHAR(64) = (SELECT contentSha256 FROM cmdb.SchemaMigrations WHERE migrationName = @migrationName);

IF @existingChecksum IS NOT NULL AND @existingChecksum <> @contentSha256
    THROW 51032, 'Migration 018 was previously recorded with a different checksum.', 1;

IF @existingChecksum = @contentSha256
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.columns columnInfo INNER JOIN sys.types typeInfo ON typeInfo.user_type_id = columnInfo.user_type_id
            WHERE columnInfo.object_id = OBJECT_ID('cmdb.ArtifactPlacements') AND columnInfo.name = 'storedContentSize'
              AND typeInfo.name = 'bigint' AND columnInfo.max_length = 8 AND columnInfo.is_nullable = 1)
        OR NOT EXISTS (SELECT 1 FROM sys.columns columnInfo INNER JOIN sys.types typeInfo ON typeInfo.user_type_id = columnInfo.user_type_id
            WHERE columnInfo.object_id = OBJECT_ID('cmdb.ArtifactPlacements') AND columnInfo.name = 'storedContentSha256'
              AND typeInfo.name = 'char' AND columnInfo.max_length = 64 AND columnInfo.is_nullable = 1)
        OR NOT EXISTS (SELECT 1 FROM sys.columns columnInfo INNER JOIN sys.types typeInfo ON typeInfo.user_type_id = columnInfo.user_type_id
            WHERE columnInfo.object_id = OBJECT_ID('cmdb.ArtifactPlacements') AND columnInfo.name = 'storedObservedAt'
              AND typeInfo.name = 'datetime2' AND columnInfo.scale = 3 AND columnInfo.is_nullable = 1)
        OR NOT EXISTS (SELECT 1 FROM sys.check_constraints constraintInfo
            WHERE constraintInfo.parent_object_id = OBJECT_ID('cmdb.ArtifactPlacements')
              AND constraintInfo.name = 'CK_ArtifactPlacements_StoredIdentity'
              AND constraintInfo.is_disabled = 0 AND constraintInfo.is_not_trusted = 0
              AND CHARINDEX('storedContentSize IS NOT NULL', REPLACE(REPLACE(constraintInfo.definition, '[', ''), ']', '')) > 0
              AND CHARINDEX('storedContentSha256 IS NOT NULL', REPLACE(REPLACE(constraintInfo.definition, '[', ''), ']', '')) > 0
              AND CHARINDEX('storedObservedAt IS NOT NULL', REPLACE(REPLACE(constraintInfo.definition, '[', ''), ']', '')) > 0
              AND CHARINDEX('20971520', constraintInfo.definition) > 0)
        THROW 51033, 'Migration 018 is recorded but its required schema is incomplete.', 1;
    COMMIT TRANSACTION;
    PRINT 'Migration 018 already applied';
    RETURN;
END;

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('cmdb.ArtifactPlacements') AND name IN ('storedContentSize', 'storedContentSha256', 'storedObservedAt'))
    OR EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('cmdb.ArtifactPlacements') AND name = 'CK_ArtifactPlacements_StoredIdentity')
    THROW 51034, 'Unrecorded Artifact placement stored identity schema already exists.', 1;

ALTER TABLE cmdb.ArtifactPlacements ADD
    storedContentSize BIGINT NULL,
    storedContentSha256 CHAR(64) NULL,
    storedObservedAt DATETIME2(3) NULL;

-- Compile references to the newly-added columns only after the ALTER TABLE ADD
-- has executed; GO cannot be used inside this transactional TRY/CATCH migration.
EXEC(N'ALTER TABLE cmdb.ArtifactPlacements ADD CONSTRAINT CK_ArtifactPlacements_StoredIdentity CHECK (
    (storedContentSize IS NULL AND storedContentSha256 IS NULL AND storedObservedAt IS NULL)
    OR (
        storedContentSize IS NOT NULL
        AND storedContentSize BETWEEN 1 AND 20971520
        AND storedContentSha256 IS NOT NULL
        AND storedContentSha256 NOT LIKE ''%[^0-9A-Fa-f]%''
        AND LEN(storedContentSha256) = 64
        AND storedObservedAt IS NOT NULL
    )
)');

INSERT INTO cmdb.SchemaMigrations (migrationName, contentSha256, releaseName, appliedBy)
VALUES (@migrationName, @contentSha256, NULL, NULL);

COMMIT TRANSACTION;
PRINT 'Migration 018 complete';
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;

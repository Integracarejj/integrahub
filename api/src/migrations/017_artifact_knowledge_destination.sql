-- Migration: 017_artifact_knowledge_destination.sql
-- Permit Knowledge-native Artifacts while preserving Working compatibility routing.

SET XACT_ABORT ON;

BEGIN TRY
    BEGIN TRANSACTION;

IF OBJECT_ID('cmdb.SchemaMigrations', 'U') IS NULL
    THROW 51020, 'Migration 017 requires cmdb.SchemaMigrations.', 1;
IF OBJECT_ID('cmdb.Artifacts', 'U') IS NULL OR OBJECT_ID('cmdb.ArtifactPlacements', 'U') IS NULL
    THROW 51021, 'Migration 017 requires migrations 015 and 016.', 1;

DECLARE @migrationName NVARCHAR(255) = N'017_artifact_knowledge_destination.sql';
DECLARE @contentSha256 CHAR(64) = '99B5EBD30A211BEDCAB5E7D77D5B86C55CEC809575F826A0EF65344F2B75DA84';
DECLARE @existingChecksum CHAR(64) = (SELECT contentSha256 FROM cmdb.SchemaMigrations WHERE migrationName = @migrationName);

IF @existingChecksum IS NOT NULL AND @existingChecksum <> @contentSha256
    THROW 51022, 'Migration 017 was previously recorded with a different checksum.', 1;

IF @existingChecksum = @contentSha256
BEGIN
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('cmdb.Artifacts') AND name = 'libraryKey' AND is_nullable = 0)
        OR NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('cmdb.Artifacts') AND name = 'CK_Artifacts_DestinationLibrary')
        THROW 51023, 'Migration 017 is recorded but its required schema is incomplete.', 1;
    COMMIT TRANSACTION;
    PRINT 'Migration 017 already applied';
    RETURN;
END;

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('cmdb.Artifacts') AND name = 'CK_Artifacts_StorageDestination')
    OR NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('cmdb.Artifacts') AND name = 'CK_Artifacts_LibraryKey')
    OR EXISTS (SELECT 1 FROM cmdb.Artifacts WHERE storageDestination <> 'Working' OR libraryKey NOT IN ('Projects', 'Legal', 'Operations'))
    THROW 51024, 'Artifact schema or data is incompatible with migration 017.', 1;

ALTER TABLE cmdb.Artifacts DROP CONSTRAINT CK_Artifacts_StorageDestination;
ALTER TABLE cmdb.Artifacts DROP CONSTRAINT CK_Artifacts_LibraryKey;
ALTER TABLE cmdb.Artifacts ALTER COLUMN libraryKey VARCHAR(16) NULL;

ALTER TABLE cmdb.Artifacts ADD CONSTRAINT CK_Artifacts_DestinationLibrary CHECK (
    (storageDestination = 'Working' AND libraryKey IN ('Projects', 'Legal', 'Operations'))
    OR (storageDestination = 'Knowledge' AND libraryKey IS NULL)
);

-- SQL Server unique indexes permit multiple composite rows when another key differs;
-- storedFileName contains the Artifact UUID, so the existing destination/name index
-- remains collision-safe for NULL Knowledge library keys and requires no replacement.

INSERT INTO cmdb.SchemaMigrations (migrationName, contentSha256, releaseName, appliedBy)
VALUES (@migrationName, @contentSha256, NULL, NULL);

COMMIT TRANSACTION;
PRINT 'Migration 017 complete';
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;

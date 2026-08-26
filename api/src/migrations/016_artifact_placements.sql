-- Migration: 016_artifact_placements.sql
-- Additive placement foundation and compatibility backfill for existing Artifacts.
-- The checksum is calculated over this file with CRLF normalized to LF and embedded
-- checksum literals normalized to zeros; an automated test verifies it.

SET XACT_ABORT ON;

BEGIN TRY
    BEGIN TRANSACTION;

IF OBJECT_ID('cmdb.SchemaMigrations', 'U') IS NULL
    THROW 51010, 'Migration 016 requires migration 015 and cmdb.SchemaMigrations.', 1;

IF OBJECT_ID('cmdb.Artifacts', 'U') IS NULL
    THROW 51011, 'Migration 016 requires cmdb.Artifacts.', 1;

DECLARE @migrationName NVARCHAR(255) = N'016_artifact_placements.sql';
DECLARE @contentSha256 CHAR(64) = '0AF0411BAC9597DC06B66C2471B9829FFD4DC3A4B7E2B1875B522DABBF82BC42';
DECLARE @existingChecksum CHAR(64) = (
    SELECT contentSha256 FROM cmdb.SchemaMigrations WHERE migrationName = @migrationName
);

IF @existingChecksum IS NOT NULL AND @existingChecksum <> @contentSha256
    THROW 51012, 'Migration 016 was previously recorded with a different checksum.', 1;

IF @existingChecksum = @contentSha256
BEGIN
    IF OBJECT_ID('cmdb.ArtifactPlacements', 'U') IS NULL
        OR NOT EXISTS (
            SELECT 1 FROM sys.indexes
            WHERE object_id = OBJECT_ID('cmdb.ArtifactPlacements')
              AND name = 'UQ_ArtifactPlacements_GraphItem'
              AND is_unique = 1
        )
        THROW 51013, 'Migration 016 is recorded but its required schema is incomplete.', 1;

    IF EXISTS (
        SELECT artifact.id
        FROM cmdb.Artifacts artifact
        LEFT JOIN cmdb.ArtifactPlacements placement
          ON placement.artifactId = artifact.id
         AND placement.placementType = 'Working'
        GROUP BY artifact.id
        HAVING COUNT(placement.id) = 0
    )
        THROW 51014, 'Migration 016 is recorded but its Working backfill is incomplete.', 1;

    COMMIT TRANSACTION;
    PRINT 'Migration 016 already applied';
    RETURN;
END;

IF OBJECT_ID('cmdb.ArtifactPlacements', 'U') IS NOT NULL
    THROW 51015, 'Unrecorded Artifact placement schema already exists.', 1;

-- Refuse to transform source rows that do not satisfy the deployed migration 015
-- contract. This migration does not repair or rewrite authoritative Artifact data.
IF EXISTS (
    SELECT 1 FROM cmdb.Artifacts
    WHERE storageDestination <> 'Working'
       OR libraryKey NOT IN ('Projects', 'Legal', 'Operations')
       OR (ingestionState = 'Uploaded' AND (
            siteId IS NULL OR driveId IS NULL OR itemId IS NULL OR uploadedAt IS NULL
       ))
       OR NOT (
            (siteId IS NULL AND driveId IS NULL AND itemId IS NULL AND webUrl IS NULL)
            OR (siteId IS NOT NULL AND driveId IS NOT NULL AND itemId IS NOT NULL)
       )
)
    THROW 51016, 'Existing Artifact data is incompatible with the Working placement backfill.', 1;

CREATE TABLE cmdb.ArtifactPlacements (
    id UNIQUEIDENTIFIER NOT NULL,
    artifactId UNIQUEIDENTIFIER NOT NULL,
    placementType VARCHAR(16) NOT NULL,
    placementStatus VARCHAR(16) NOT NULL CONSTRAINT DF_ArtifactPlacements_Status DEFAULT 'Pending',
    siteKey VARCHAR(32) NOT NULL,
    siteId NVARCHAR(255) NULL,
    driveId NVARCHAR(255) NULL,
    itemId NVARCHAR(255) NULL,
    webUrl NVARCHAR(2048) NULL,
    legacyLibraryKey VARCHAR(16) NULL,
    createdByUserId VARCHAR(255) NOT NULL,
    createdAt DATETIME2(3) NOT NULL CONSTRAINT DF_ArtifactPlacements_CreatedAt DEFAULT SYSUTCDATETIME(),
    updatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_ArtifactPlacements_UpdatedAt DEFAULT SYSUTCDATETIME(),
    activatedAt DATETIME2(3) NULL,
    retiredAt DATETIME2(3) NULL,
    version ROWVERSION NOT NULL,
    CONSTRAINT PK_ArtifactPlacements PRIMARY KEY (id),
    CONSTRAINT FK_ArtifactPlacements_Artifact FOREIGN KEY (artifactId) REFERENCES cmdb.Artifacts(id),
    CONSTRAINT FK_ArtifactPlacements_Creator FOREIGN KEY (createdByUserId) REFERENCES cmdb.Users(id),
    CONSTRAINT CK_ArtifactPlacements_Type CHECK (placementType IN ('Working', 'Knowledge', 'External')),
    CONSTRAINT CK_ArtifactPlacements_Status CHECK (placementStatus IN ('Pending', 'Active', 'Failed', 'Retracted', 'Archived')),
    CONSTRAINT CK_ArtifactPlacements_SiteKey CHECK (siteKey IN ('working', 'knowledge', 'external')),
    CONSTRAINT CK_ArtifactPlacements_GraphIdentity CHECK (
        (siteId IS NULL AND driveId IS NULL AND itemId IS NULL AND webUrl IS NULL)
        OR (siteId IS NOT NULL AND driveId IS NOT NULL AND itemId IS NOT NULL)
    ),
    CONSTRAINT CK_ArtifactPlacements_ActiveIdentity CHECK (
        placementStatus <> 'Active'
        OR (siteId IS NOT NULL AND driveId IS NOT NULL AND itemId IS NOT NULL AND activatedAt IS NOT NULL)
    ),
    CONSTRAINT CK_ArtifactPlacements_LegacyLibrary CHECK (
        legacyLibraryKey IS NULL
        OR (placementType = 'Working' AND legacyLibraryKey IN ('Projects', 'Legal', 'Operations'))
    ),
    CONSTRAINT CK_ArtifactPlacements_Retirement CHECK (
        (placementStatus IN ('Retracted', 'Archived') AND retiredAt IS NOT NULL)
        OR (placementStatus NOT IN ('Retracted', 'Archived') AND retiredAt IS NULL)
    )
);

CREATE UNIQUE INDEX UQ_ArtifactPlacements_GraphItem
    ON cmdb.ArtifactPlacements(siteId, driveId, itemId)
    WHERE siteId IS NOT NULL AND driveId IS NOT NULL AND itemId IS NOT NULL;

CREATE INDEX IX_ArtifactPlacements_Artifact
    ON cmdb.ArtifactPlacements(artifactId, placementType, placementStatus);

INSERT INTO cmdb.ArtifactPlacements (
    id, artifactId, placementType, placementStatus, siteKey,
    siteId, driveId, itemId, webUrl, legacyLibraryKey,
    createdByUserId, createdAt, updatedAt, activatedAt, retiredAt
)
SELECT
    NEWID(), artifact.id, 'Working',
    CASE artifact.ingestionState
        WHEN 'Uploaded' THEN 'Active'
        WHEN 'Pending' THEN 'Pending'
        WHEN 'Failed' THEN 'Failed'
    END,
    'working', artifact.siteId, artifact.driveId, artifact.itemId, artifact.webUrl,
    artifact.libraryKey, artifact.submittedByUserId, artifact.createdAt, artifact.updatedAt,
    CASE WHEN artifact.ingestionState = 'Uploaded' THEN artifact.uploadedAt ELSE NULL END,
    NULL
FROM cmdb.Artifacts artifact;

IF (SELECT COUNT_BIG(*) FROM cmdb.ArtifactPlacements) <> (SELECT COUNT_BIG(*) FROM cmdb.Artifacts)
    OR EXISTS (SELECT 1 FROM cmdb.ArtifactPlacements WHERE placementType <> 'Working')
    THROW 51017, 'Artifact Working placement backfill validation failed.', 1;

INSERT INTO cmdb.SchemaMigrations (migrationName, contentSha256, releaseName, appliedBy)
VALUES (@migrationName, @contentSha256, NULL, NULL);

COMMIT TRANSACTION;
PRINT 'Migration 016 complete';
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0
        ROLLBACK TRANSACTION;
    THROW;
END CATCH;

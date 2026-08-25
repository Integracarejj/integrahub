-- Migration: 015_artifact_hub_foundation.sql
-- Additive durable migration history and generic Artifact Hub foundation.
-- The checksum is calculated over this file with CRLF normalized to LF and embedded
-- checksum literals normalized to zeros; an automated test verifies it.

SET XACT_ABORT ON;

BEGIN TRY
    BEGIN TRANSACTION;

IF OBJECT_ID('cmdb.SchemaMigrations', 'U') IS NULL
BEGIN
    CREATE TABLE cmdb.SchemaMigrations (
        migrationName NVARCHAR(255) NOT NULL,
        contentSha256 CHAR(64) NOT NULL,
        releaseName NVARCHAR(128) NULL,
        appliedBy NVARCHAR(255) NULL,
        appliedAt DATETIME2(3) NOT NULL CONSTRAINT DF_SchemaMigrations_AppliedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_SchemaMigrations PRIMARY KEY (migrationName),
        CONSTRAINT CK_SchemaMigrations_ContentSha256 CHECK (contentSha256 NOT LIKE '%[^0-9A-Fa-f]%' AND LEN(contentSha256) = 64)
    );
END;

DECLARE @migrationName NVARCHAR(255) = N'015_artifact_hub_foundation.sql';
DECLARE @contentSha256 CHAR(64) = '76328C968DE4D12F4DEBA8AAF151A68CE9BDAAB2E2F9CA2A9C2347844A0D2D6A';
DECLARE @existingChecksum CHAR(64) = (
    SELECT contentSha256 FROM cmdb.SchemaMigrations WHERE migrationName = @migrationName
);

IF @existingChecksum IS NOT NULL AND @existingChecksum <> @contentSha256
    THROW 51003, 'Migration 015 was previously recorded with a different checksum.', 1;

IF @existingChecksum = @contentSha256
BEGIN
    IF OBJECT_ID('cmdb.Artifacts', 'U') IS NULL
        OR OBJECT_ID('cmdb.ArtifactEvents', 'U') IS NULL
        OR OBJECT_ID('cmdb.TR_ArtifactEvents_AppendOnly', 'TR') IS NULL
        OR OBJECT_ID('cmdb.TR_SchemaMigrations_Immutable', 'TR') IS NULL
        THROW 51004, 'Migration 015 is recorded but its required schema is incomplete.', 1;

    COMMIT TRANSACTION;
    PRINT 'Migration 015 already applied';
    RETURN;
END;

-- Artifact Hub objects have no predecessor. Refuse to adopt unexplained partial
-- objects rather than falsely recording them as a successfully applied migration.
IF OBJECT_ID('cmdb.Artifacts', 'U') IS NOT NULL
    OR OBJECT_ID('cmdb.ArtifactEvents', 'U') IS NOT NULL
    OR OBJECT_ID('cmdb.TR_ArtifactEvents_AppendOnly', 'TR') IS NOT NULL
    THROW 51005, 'Unrecorded Artifact Hub schema objects already exist.', 1;

IF OBJECT_ID('cmdb.Artifacts', 'U') IS NULL
BEGIN
    CREATE TABLE cmdb.Artifacts (
        id UNIQUEIDENTIFIER NOT NULL,
        originalFileName NVARCHAR(255) NOT NULL,
        storedFileName NVARCHAR(255) NOT NULL,
        fileExtension VARCHAR(16) NOT NULL,
        contentType NVARCHAR(128) NOT NULL,
        contentSize BIGINT NOT NULL,
        contentSha256 CHAR(64) NOT NULL,
        ingestionState VARCHAR(16) NOT NULL CONSTRAINT DF_Artifacts_IngestionState DEFAULT 'Pending',
        classificationState VARCHAR(16) NOT NULL CONSTRAINT DF_Artifacts_ClassificationState DEFAULT 'Unclassified',
        lifecycleState VARCHAR(16) NOT NULL CONSTRAINT DF_Artifacts_LifecycleState DEFAULT 'Active',
        storageDestination VARCHAR(16) NOT NULL CONSTRAINT DF_Artifacts_StorageDestination DEFAULT 'Working',
        libraryKey VARCHAR(16) NOT NULL,
        siteId NVARCHAR(255) NULL,
        driveId NVARCHAR(255) NULL,
        itemId NVARCHAR(255) NULL,
        webUrl NVARCHAR(2048) NULL,
        sourceOrigin VARCHAR(64) NOT NULL,
        sourceModule VARCHAR(64) NOT NULL,
        sourceContext NVARCHAR(255) NULL,
        submittedByUserId VARCHAR(255) NOT NULL,
        idempotencyKey VARCHAR(128) COLLATE Latin1_General_100_BIN2 NOT NULL,
        description NVARCHAR(2000) NULL,
        effectiveDate DATE NULL,
        classificationProvenance VARCHAR(64) NULL,
        classificationConfidence DECIMAL(5,4) NULL,
        uploadedAt DATETIME2(3) NULL,
        createdAt DATETIME2(3) NOT NULL CONSTRAINT DF_Artifacts_CreatedAt DEFAULT SYSUTCDATETIME(),
        updatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_Artifacts_UpdatedAt DEFAULT SYSUTCDATETIME(),
        version ROWVERSION NOT NULL,
        CONSTRAINT PK_Artifacts PRIMARY KEY (id),
        CONSTRAINT FK_Artifacts_Submitter FOREIGN KEY (submittedByUserId) REFERENCES cmdb.Users(id),
        CONSTRAINT UQ_Artifacts_Idempotency UNIQUE (submittedByUserId, idempotencyKey),
        CONSTRAINT CK_Artifacts_Extension CHECK (fileExtension NOT LIKE '%[^a-z0-9]%' AND LEN(fileExtension) BETWEEN 1 AND 16),
        CONSTRAINT CK_Artifacts_Size CHECK (contentSize > 0 AND contentSize <= 10485760),
        CONSTRAINT CK_Artifacts_ContentSha256 CHECK (contentSha256 NOT LIKE '%[^0-9A-Fa-f]%' AND LEN(contentSha256) = 64),
        CONSTRAINT CK_Artifacts_IngestionState CHECK (ingestionState IN ('Pending', 'Uploaded', 'Failed')),
        CONSTRAINT CK_Artifacts_ClassificationState CHECK (classificationState IN ('Unclassified', 'Suggested', 'Confirmed')),
        CONSTRAINT CK_Artifacts_LifecycleState CHECK (lifecycleState IN ('Active', 'Archived', 'Removed', 'Superseded')),
        CONSTRAINT CK_Artifacts_StorageDestination CHECK (storageDestination = 'Working'),
        CONSTRAINT CK_Artifacts_LibraryKey CHECK (libraryKey IN ('Projects', 'Legal', 'Operations')),
        CONSTRAINT CK_Artifacts_SourceOrigin CHECK (sourceOrigin IN (
            'Internal Artifact Upload', 'External Intake', 'Recap Work Artifact', 'COSM Ingestion',
            'Acquisition Intake', 'System Migration', 'API / Integration'
        )),
        CONSTRAINT CK_Artifacts_SourceModule CHECK (sourceModule IN ('ArtifactHub', 'Recap', 'COSM', 'Acquisition', 'Integration')),
        CONSTRAINT CK_Artifacts_ClassificationConfidence CHECK (classificationConfidence IS NULL OR classificationConfidence BETWEEN 0 AND 1),
        CONSTRAINT CK_Artifacts_GraphIdentity CHECK (
            (siteId IS NULL AND driveId IS NULL AND itemId IS NULL AND webUrl IS NULL)
            OR (siteId IS NOT NULL AND driveId IS NOT NULL AND itemId IS NOT NULL)
        ),
        CONSTRAINT CK_Artifacts_UploadedIdentity CHECK (
            ingestionState <> 'Uploaded'
            OR (siteId IS NOT NULL AND driveId IS NOT NULL AND itemId IS NOT NULL AND uploadedAt IS NOT NULL)
        )
    );

    CREATE UNIQUE INDEX UQ_Artifacts_GraphItem
        ON cmdb.Artifacts(siteId, driveId, itemId)
        WHERE siteId IS NOT NULL AND driveId IS NOT NULL AND itemId IS NOT NULL;

    CREATE UNIQUE INDEX UQ_Artifacts_StoredFile
        ON cmdb.Artifacts(libraryKey, storedFileName);

    CREATE INDEX IX_Artifacts_ActiveCreated
        ON cmdb.Artifacts(lifecycleState, createdAt DESC)
        INCLUDE (ingestionState, classificationState, storageDestination, libraryKey, originalFileName, submittedByUserId);
END;

IF OBJECT_ID('cmdb.ArtifactEvents', 'U') IS NULL
BEGIN
    CREATE TABLE cmdb.ArtifactEvents (
        id UNIQUEIDENTIFIER NOT NULL,
        artifactId UNIQUEIDENTIFIER NOT NULL,
        eventType VARCHAR(64) NOT NULL,
        actorUserId VARCHAR(255) NULL,
        correlationId VARCHAR(128) NULL,
        detailsJson NVARCHAR(MAX) NULL,
        createdAt DATETIME2(3) NOT NULL CONSTRAINT DF_ArtifactEvents_CreatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_ArtifactEvents PRIMARY KEY (id),
        CONSTRAINT FK_ArtifactEvents_Artifact FOREIGN KEY (artifactId) REFERENCES cmdb.Artifacts(id),
        CONSTRAINT FK_ArtifactEvents_Actor FOREIGN KEY (actorUserId) REFERENCES cmdb.Users(id),
        CONSTRAINT CK_ArtifactEvents_Type CHECK (eventType IN (
            'ArtifactUploadStarted', 'ArtifactUploaded', 'ArtifactUploadFailed', 'ArtifactDownloaded',
            'MetadataUpdated', 'ArtifactClassified', 'ArtifactArchived', 'ArtifactRemoved',
            'ArtifactSuperseded', 'PromotedToKnowledge', 'PreparedForExternal', 'PublishedExternal'
        )),
        CONSTRAINT CK_ArtifactEvents_DetailsJson CHECK (detailsJson IS NULL OR ISJSON(detailsJson) = 1)
    );

    CREATE INDEX IX_ArtifactEvents_ArtifactDate
        ON cmdb.ArtifactEvents(artifactId, createdAt DESC);
END;

-- Dynamic DDL keeps trigger creation in this transaction and avoids the
-- CREATE TRIGGER first-statement batch restriction.
EXEC(N'CREATE TRIGGER cmdb.TR_ArtifactEvents_AppendOnly
    ON cmdb.ArtifactEvents
    INSTEAD OF UPDATE, DELETE
    AS
    BEGIN
        SET NOCOUNT ON;
        THROW 51000, ''ArtifactEvents are append-only.'', 1;
    END');

IF OBJECT_ID('cmdb.TR_SchemaMigrations_Immutable', 'TR') IS NULL
BEGIN
    EXEC(N'CREATE TRIGGER cmdb.TR_SchemaMigrations_Immutable
        ON cmdb.SchemaMigrations
        INSTEAD OF UPDATE, DELETE
        AS
        BEGIN
            SET NOCOUNT ON;
            THROW 51001, ''Schema migration history is immutable.'', 1;
        END');
END;

-- This is deliberately the final durable mutation before commit. A failure
-- anywhere above rolls back both schema objects and this ledger entry.
INSERT INTO cmdb.SchemaMigrations (migrationName, contentSha256, releaseName, appliedBy)
VALUES (@migrationName, @contentSha256, NULL, NULL);

COMMIT TRANSACTION;
PRINT 'Migration 015 complete';
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0
        ROLLBACK TRANSACTION;
    THROW;
END CATCH;

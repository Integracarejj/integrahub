-- Migration: 022_recap_external_publication.sql
-- Add authoritative Recap publication, published artifact identity, and partner decisions.
-- Checksum is calculated with CRLF normalized to LF and this literal normalized to zeros.

SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;

BEGIN TRY
    BEGIN TRANSACTION;

IF OBJECT_ID('cmdb.SchemaMigrations', 'U') IS NULL OR OBJECT_ID('cmdb.RecapWorkItems', 'U') IS NULL
    OR OBJECT_ID('cmdb.RecapWorkArtifacts', 'U') IS NULL OR OBJECT_ID('cmdb.RecapWorkItemEvents', 'U') IS NULL
    THROW 51070, 'Migration 022 requires migrations 014 and 021.', 1;

DECLARE @migrationName NVARCHAR(255) = N'022_recap_external_publication.sql';
DECLARE @contentSha256 CHAR(64) = '533855CB1A9ACEF557B36C5C67377DB00146C04A2F9F726E1261C76127A44A97';
DECLARE @existingChecksum CHAR(64) = (SELECT contentSha256 FROM cmdb.SchemaMigrations WHERE migrationName = @migrationName);

IF @existingChecksum IS NOT NULL AND @existingChecksum <> @contentSha256
    THROW 51071, 'Migration 022 was previously recorded with a different checksum.', 1;

IF @existingChecksum = @contentSha256
BEGIN
    IF OBJECT_ID('cmdb.RecapPublications', 'U') IS NULL OR OBJECT_ID('cmdb.RecapPublishedArtifacts', 'U') IS NULL
        OR NOT EXISTS (SELECT 1 FROM sys.columns columnInfo INNER JOIN sys.types typeInfo ON typeInfo.user_type_id = columnInfo.user_type_id
            WHERE columnInfo.object_id = OBJECT_ID('cmdb.RecapWorkArtifacts') AND columnInfo.name = 'publicationEligibility'
              AND typeInfo.name = 'varchar' AND columnInfo.max_length = 16 AND columnInfo.is_nullable = 0)
        OR NOT EXISTS (SELECT 1 FROM sys.default_constraints defaultInfo INNER JOIN sys.columns columnInfo
            ON columnInfo.object_id = defaultInfo.parent_object_id AND columnInfo.column_id = defaultInfo.parent_column_id
            WHERE defaultInfo.parent_object_id = OBJECT_ID('cmdb.RecapWorkArtifacts')
              AND defaultInfo.name = 'DF_RecapWorkArtifacts_PublicationEligibility'
              AND columnInfo.name = 'publicationEligibility'
              AND REPLACE(REPLACE(defaultInfo.definition, '(', ''), ')', '') = '''Active''')
        OR NOT EXISTS (SELECT 1 FROM sys.columns columnInfo INNER JOIN sys.types typeInfo ON typeInfo.user_type_id = columnInfo.user_type_id
            WHERE columnInfo.object_id = OBJECT_ID('cmdb.RecapWorkArtifacts') AND columnInfo.name = 'supersededByArtifactId'
              AND typeInfo.name = 'uniqueidentifier' AND columnInfo.max_length = 16 AND columnInfo.is_nullable = 1)
        OR NOT EXISTS (SELECT 1 FROM sys.columns columnInfo INNER JOIN sys.types typeInfo ON typeInfo.user_type_id = columnInfo.user_type_id
            WHERE columnInfo.object_id = OBJECT_ID('cmdb.RecapWorkArtifacts') AND columnInfo.name = 'supersededAt'
              AND typeInfo.name = 'datetime2' AND columnInfo.max_length = 8 AND columnInfo.scale = 3 AND columnInfo.is_nullable = 1)
        OR NOT EXISTS (SELECT 1 FROM sys.columns columnInfo INNER JOIN sys.types typeInfo ON typeInfo.user_type_id = columnInfo.user_type_id
            WHERE columnInfo.object_id = OBJECT_ID('cmdb.RecapWorkArtifacts') AND columnInfo.name = 'supersededByUserId'
              AND typeInfo.name = 'varchar' AND columnInfo.max_length = 255 AND columnInfo.is_nullable = 1)
        OR NOT EXISTS (SELECT 1 FROM sys.foreign_keys foreignKey
            WHERE foreignKey.parent_object_id = OBJECT_ID('cmdb.RecapWorkArtifacts')
              AND foreignKey.referenced_object_id = OBJECT_ID('cmdb.RecapWorkArtifacts')
              AND foreignKey.name = 'FK_RecapWorkArtifacts_SupersededByArtifact'
              AND foreignKey.is_disabled = 0 AND foreignKey.is_not_trusted = 0
              AND EXISTS (SELECT 1 FROM sys.foreign_key_columns mapping
                  WHERE mapping.constraint_object_id = foreignKey.object_id
                    AND mapping.parent_column_id = COLUMNPROPERTY(OBJECT_ID('cmdb.RecapWorkArtifacts'), 'supersededByArtifactId', 'ColumnId')
                    AND mapping.referenced_column_id = COLUMNPROPERTY(OBJECT_ID('cmdb.RecapWorkArtifacts'), 'id', 'ColumnId')))
        OR NOT EXISTS (SELECT 1 FROM sys.foreign_keys foreignKey
            WHERE foreignKey.parent_object_id = OBJECT_ID('cmdb.RecapWorkArtifacts')
              AND foreignKey.referenced_object_id = OBJECT_ID('cmdb.Users')
              AND foreignKey.name = 'FK_RecapWorkArtifacts_SupersededByUser'
              AND foreignKey.is_disabled = 0 AND foreignKey.is_not_trusted = 0
              AND EXISTS (SELECT 1 FROM sys.foreign_key_columns mapping
                  WHERE mapping.constraint_object_id = foreignKey.object_id
                    AND mapping.parent_column_id = COLUMNPROPERTY(OBJECT_ID('cmdb.RecapWorkArtifacts'), 'supersededByUserId', 'ColumnId')
                    AND mapping.referenced_column_id = COLUMNPROPERTY(OBJECT_ID('cmdb.Users'), 'id', 'ColumnId')))
        OR NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('cmdb.RecapWorkArtifacts')
            AND name = 'CK_RecapWorkArtifacts_PublicationEligibility' AND is_disabled = 0 AND is_not_trusted = 0
            AND definition LIKE '%PendingReplacement%' AND definition LIKE '%Superseded%')
        OR NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('cmdb.RecapWorkArtifacts')
            AND name = 'IX_RecapWorkArtifacts_PublicationEligible' AND is_disabled = 0)
        OR NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_RecapPublications_Status' AND is_disabled = 0 AND is_not_trusted = 0)
        OR NOT EXISTS (SELECT 1 FROM sys.computed_columns columnInfo
            WHERE columnInfo.object_id = OBJECT_ID('cmdb.RecapPublications')
              AND columnInfo.name = 'publicationCardinalityKey' AND columnInfo.is_persisted = 1
              AND REPLACE(REPLACE(columnInfo.definition, '[', ''), ']', '') LIKE '%CASE WHEN status IN (''Pending'', ''Published'') THEN workItemId ELSE id END%')
        OR NOT EXISTS (SELECT 1 FROM sys.computed_columns columnInfo
            WHERE columnInfo.object_id = OBJECT_ID('cmdb.RecapPublications')
              AND columnInfo.name = 'publicationCardinalityScope' AND columnInfo.is_persisted = 1
              AND REPLACE(REPLACE(columnInfo.definition, '[', ''), ']', '') LIKE '%CASE WHEN status IN (''Pending'', ''Published'') THEN 0 ELSE 1 END%')
        OR NOT EXISTS (SELECT 1 FROM sys.indexes indexInfo
            WHERE indexInfo.object_id = OBJECT_ID('cmdb.RecapPublications')
              AND indexInfo.name = 'UQ_RecapPublications_OpenWorkItem' AND indexInfo.is_unique = 1
              AND indexInfo.has_filter = 0 AND indexInfo.is_disabled = 0
              AND (SELECT COUNT(*) FROM sys.index_columns indexColumn
                  WHERE indexColumn.object_id = indexInfo.object_id AND indexColumn.index_id = indexInfo.index_id
                    AND indexColumn.key_ordinal > 0) = 2
              AND NOT EXISTS (SELECT expected.keyOrdinal, expected.columnName
                  FROM (VALUES (1, 'publicationCardinalityScope'), (2, 'publicationCardinalityKey')) expected(keyOrdinal, columnName)
                  WHERE NOT EXISTS (SELECT 1 FROM sys.index_columns indexColumn INNER JOIN sys.columns columnInfo
                      ON columnInfo.object_id = indexColumn.object_id AND columnInfo.column_id = indexColumn.column_id
                      WHERE indexColumn.object_id = indexInfo.object_id AND indexColumn.index_id = indexInfo.index_id
                        AND indexColumn.key_ordinal = expected.keyOrdinal AND columnInfo.name = expected.columnName)))
        OR NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('cmdb.RecapPublishedArtifacts')
            AND name = 'CK_RecapPublishedArtifacts_Status' AND is_disabled = 0 AND is_not_trusted = 0 AND definition LIKE '%Receipt%')
        OR NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_RecapWorkItems_Status' AND definition LIKE '%Waiting Partner Review%' AND definition LIKE '%Completed%')
        OR NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_RecapWorkItemEvents_Type' AND definition LIKE '%PublishedExternal%' AND definition LIKE '%PartnerRequestedRework%')
        THROW 51072, 'Migration 022 is recorded but its required schema is incomplete.', 1;
    COMMIT TRANSACTION;
    PRINT 'Migration 022 already applied';
    RETURN;
END;

IF OBJECT_ID('cmdb.RecapPublications', 'U') IS NOT NULL OR OBJECT_ID('cmdb.RecapPublishedArtifacts', 'U') IS NOT NULL
    THROW 51073, 'Unrecorded Recap publication schema already exists.', 1;

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('cmdb.RecapWorkArtifacts')
    AND name IN ('publicationEligibility', 'supersededByArtifactId', 'supersededAt', 'supersededByUserId'))
    THROW 51080, 'Unrecorded Recap artifact publication lifecycle already exists.', 1;

ALTER TABLE cmdb.RecapWorkItems DROP CONSTRAINT CK_RecapWorkItems_Status;
ALTER TABLE cmdb.RecapWorkItems ADD CONSTRAINT CK_RecapWorkItems_Status CHECK (status IN (
    'Queued', 'Assigned', 'In Progress', 'Clarification Needed', 'Blocked', 'Needs DD Review',
    'Ready to Publish', 'Waiting Partner Review', 'Completed', 'Not Applicable', 'Duplicate'
));

ALTER TABLE cmdb.RecapWorkArtifacts ADD
    publicationEligibility VARCHAR(16) NOT NULL CONSTRAINT DF_RecapWorkArtifacts_PublicationEligibility DEFAULT 'Active',
    supersededByArtifactId UNIQUEIDENTIFIER NULL,
    supersededAt DATETIME2(3) NULL,
    supersededByUserId VARCHAR(255) NULL;
EXEC(N'ALTER TABLE cmdb.RecapWorkArtifacts ADD
    CONSTRAINT FK_RecapWorkArtifacts_SupersededByArtifact FOREIGN KEY (supersededByArtifactId) REFERENCES cmdb.RecapWorkArtifacts(id),
    CONSTRAINT FK_RecapWorkArtifacts_SupersededByUser FOREIGN KEY (supersededByUserId) REFERENCES cmdb.Users(id),
    CONSTRAINT CK_RecapWorkArtifacts_PublicationEligibility CHECK (
        (publicationEligibility IN (''Active'', ''PendingReplacement'') AND supersededByArtifactId IS NULL AND supersededAt IS NULL AND supersededByUserId IS NULL)
        OR (publicationEligibility = ''Superseded'' AND supersededByArtifactId IS NOT NULL AND supersededByArtifactId <> id
            AND supersededAt IS NOT NULL AND supersededByUserId IS NOT NULL)
    )');
EXEC(N'CREATE INDEX IX_RecapWorkArtifacts_PublicationEligible
    ON cmdb.RecapWorkArtifacts(workItemId, publicationEligibility, uploadedAt DESC)
    WHERE status = ''Uploaded''');

CREATE TABLE cmdb.RecapPublications (
    id UNIQUEIDENTIFIER NOT NULL,
    workItemId UNIQUEIDENTIFIER NOT NULL,
    publicationNumber INT NOT NULL,
    operationKey VARCHAR(128) COLLATE Latin1_General_100_BIN2 NOT NULL,
    targetExternalOrganizationId VARCHAR(64) NOT NULL,
    status VARCHAR(24) NOT NULL CONSTRAINT DF_RecapPublications_Status DEFAULT 'Pending',
    publishedByUserId VARCHAR(255) NOT NULL,
    publishedAt DATETIME2(3) NULL,
    partnerActorUserId VARCHAR(255) NULL,
    partnerActorOrganizationId VARCHAR(64) NULL,
    partnerActionAt DATETIME2(3) NULL,
    partnerGuidance NVARCHAR(2000) NULL,
    publicationCardinalityScope AS (CASE WHEN status IN ('Pending', 'Published') THEN 0 ELSE 1 END) PERSISTED,
    publicationCardinalityKey AS (CASE WHEN status IN ('Pending', 'Published') THEN workItemId ELSE id END) PERSISTED,
    createdAt DATETIME2(3) NOT NULL CONSTRAINT DF_RecapPublications_CreatedAt DEFAULT SYSUTCDATETIME(),
    updatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_RecapPublications_UpdatedAt DEFAULT SYSUTCDATETIME(),
    version ROWVERSION NOT NULL,
    CONSTRAINT PK_RecapPublications PRIMARY KEY (id),
    CONSTRAINT FK_RecapPublications_WorkItem FOREIGN KEY (workItemId) REFERENCES cmdb.RecapWorkItems(id),
    CONSTRAINT FK_RecapPublications_Publisher FOREIGN KEY (publishedByUserId) REFERENCES cmdb.Users(id),
    CONSTRAINT FK_RecapPublications_PartnerActor FOREIGN KEY (partnerActorUserId) REFERENCES cmdb.Users(id),
    CONSTRAINT UQ_RecapPublications_Number UNIQUE (workItemId, publicationNumber),
    CONSTRAINT UQ_RecapPublications_Operation UNIQUE (workItemId, operationKey),
    CONSTRAINT CK_RecapPublications_Status CHECK (status IN ('Pending', 'Published', 'Approved', 'Rework Requested')),
    CONSTRAINT CK_RecapPublications_OperationKey CHECK (LEN(operationKey) BETWEEN 8 AND 128 AND operationKey NOT LIKE '%[^A-Za-z0-9._:-]%' COLLATE Latin1_General_100_BIN2),
    CONSTRAINT CK_RecapPublications_PartnerAction CHECK (
        (status = 'Pending' AND publishedAt IS NULL AND partnerActorUserId IS NULL AND partnerActorOrganizationId IS NULL AND partnerActionAt IS NULL AND partnerGuidance IS NULL)
        OR (status = 'Published' AND publishedAt IS NOT NULL AND partnerActorUserId IS NULL AND partnerActorOrganizationId IS NULL AND partnerActionAt IS NULL AND partnerGuidance IS NULL)
        OR (status = 'Approved' AND publishedAt IS NOT NULL AND partnerActorUserId IS NOT NULL AND partnerActorOrganizationId = targetExternalOrganizationId AND partnerActionAt IS NOT NULL AND partnerGuidance IS NULL)
        OR (status = 'Rework Requested' AND publishedAt IS NOT NULL AND partnerActorUserId IS NOT NULL AND partnerActorOrganizationId = targetExternalOrganizationId AND partnerActionAt IS NOT NULL AND NULLIF(LTRIM(RTRIM(partnerGuidance)), '') IS NOT NULL)
    )
);
CREATE UNIQUE INDEX UQ_RecapPublications_OpenWorkItem
    ON cmdb.RecapPublications(publicationCardinalityScope, publicationCardinalityKey);
CREATE INDEX IX_RecapPublications_ExternalOrganization ON cmdb.RecapPublications(targetExternalOrganizationId, status, publishedAt DESC);

CREATE TABLE cmdb.RecapPublishedArtifacts (
    publicationId UNIQUEIDENTIFIER NOT NULL,
    artifactId UNIQUEIDENTIFIER NOT NULL,
    sourceDriveId NVARCHAR(255) NOT NULL,
    sourceItemId NVARCHAR(255) NOT NULL,
    storedFileName NVARCHAR(255) NOT NULL,
    knowledgeSiteId NVARCHAR(255) NULL,
    knowledgeDriveId NVARCHAR(255) NULL,
    knowledgeItemId NVARCHAR(255) NULL,
    knowledgeWebUrl NVARCHAR(2048) NULL,
    storedContentSize BIGINT NULL,
    storedContentSha256 CHAR(64) NULL,
    status VARCHAR(16) NOT NULL CONSTRAINT DF_RecapPublishedArtifacts_Status DEFAULT 'Pending',
    createdAt DATETIME2(3) NOT NULL CONSTRAINT DF_RecapPublishedArtifacts_CreatedAt DEFAULT SYSUTCDATETIME(),
    updatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_RecapPublishedArtifacts_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_RecapPublishedArtifacts PRIMARY KEY (publicationId, artifactId),
    CONSTRAINT FK_RecapPublishedArtifacts_Publication FOREIGN KEY (publicationId) REFERENCES cmdb.RecapPublications(id),
    CONSTRAINT FK_RecapPublishedArtifacts_Artifact FOREIGN KEY (artifactId) REFERENCES cmdb.RecapWorkArtifacts(id),
    CONSTRAINT CK_RecapPublishedArtifacts_Status CHECK (status IN ('Pending', 'Receipt', 'Active')),
    CONSTRAINT CK_RecapPublishedArtifacts_Identity CHECK (
        (status = 'Pending' AND knowledgeSiteId IS NULL AND knowledgeDriveId IS NULL AND knowledgeItemId IS NULL AND knowledgeWebUrl IS NULL AND storedContentSize IS NULL AND storedContentSha256 IS NULL)
        OR (status = 'Receipt' AND knowledgeSiteId IS NOT NULL AND knowledgeDriveId IS NOT NULL AND knowledgeItemId IS NOT NULL
            AND storedContentSize IS NULL AND storedContentSha256 IS NULL)
        OR (status = 'Active' AND knowledgeSiteId IS NOT NULL AND knowledgeDriveId IS NOT NULL AND knowledgeItemId IS NOT NULL
            AND storedContentSize BETWEEN 1 AND 20971520 AND LEN(storedContentSha256) = 64 AND storedContentSha256 NOT LIKE '%[^0-9A-Fa-f]%')
    )
);
CREATE UNIQUE INDEX UQ_RecapPublishedArtifacts_KnowledgeItem
    ON cmdb.RecapPublishedArtifacts(knowledgeDriveId, knowledgeItemId)
    WHERE knowledgeDriveId IS NOT NULL AND knowledgeItemId IS NOT NULL;

ALTER TABLE cmdb.RecapWorkItemEvents DROP CONSTRAINT CK_RecapWorkItemEvents_Type;
ALTER TABLE cmdb.RecapWorkItemEvents ADD CONSTRAINT CK_RecapWorkItemEvents_Type CHECK (eventType IN (
    'Admitted', 'Assigned', 'Reassigned', 'Accepted', 'ResponseUpdated', 'ClarificationRequested',
    'ClarificationResolved', 'Blocked', 'Unblocked', 'DispositionProposed', 'DispositionApproved',
    'DispositionReturned', 'MarkedNotMine', 'SubmittedForDdReview', 'ReturnedFromDdReview',
    'MarkedReadyToPublish', 'PublicationStarted', 'PublishedExternal', 'PartnerApproved', 'PartnerRequestedRework'
));

INSERT INTO cmdb.SchemaMigrations (migrationName, contentSha256, releaseName, appliedBy)
VALUES (@migrationName, @contentSha256, NULL, NULL);

COMMIT TRANSACTION;
PRINT 'Migration 022 complete';
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;

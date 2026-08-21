-- Migration: 012_cosm_document_foundation.sql
-- Durable COSM logical document and document-version metadata foundation.

IF OBJECT_ID('cmdb.CosmDocuments', 'U') IS NULL
BEGIN
    CREATE TABLE cmdb.CosmDocuments (
        id UNIQUEIDENTIFIER NOT NULL,
        documentNumber NVARCHAR(64) NOT NULL,
        title NVARCHAR(512) NOT NULL,
        category NVARCHAR(128) NOT NULL,
        subcategory NVARCHAR(128) NULL,
        department NVARCHAR(128) NULL,
        audience NVARCHAR(128) NULL,
        ownerUserId VARCHAR(255) NULL,
        contentStewardUserId VARCHAR(255) NULL,
        status VARCHAR(16) NOT NULL CONSTRAINT DF_CosmDocuments_Status DEFAULT 'Draft',
        effectiveDate DATE NULL,
        reviewDate DATE NULL,
        expirationDate DATE NULL,
        currentVersionId UNIQUEIDENTIFIER NULL,
        supersedesDocumentId UNIQUEIDENTIFIER NULL,
        createdBy VARCHAR(255) NOT NULL,
        createdAt DATETIME2(3) NOT NULL CONSTRAINT DF_CosmDocuments_CreatedAt DEFAULT SYSUTCDATETIME(),
        updatedBy VARCHAR(255) NOT NULL,
        updatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_CosmDocuments_UpdatedAt DEFAULT SYSUTCDATETIME(),
        version ROWVERSION NOT NULL,
        CONSTRAINT PK_CosmDocuments PRIMARY KEY (id),
        CONSTRAINT UQ_CosmDocuments_DocumentNumber UNIQUE (documentNumber),
        CONSTRAINT FK_CosmDocuments_Owner FOREIGN KEY (ownerUserId) REFERENCES cmdb.Users(id),
        CONSTRAINT FK_CosmDocuments_ContentSteward FOREIGN KEY (contentStewardUserId) REFERENCES cmdb.Users(id),
        CONSTRAINT FK_CosmDocuments_Supersedes FOREIGN KEY (supersedesDocumentId) REFERENCES cmdb.CosmDocuments(id),
        CONSTRAINT FK_CosmDocuments_CreatedBy FOREIGN KEY (createdBy) REFERENCES cmdb.Users(id),
        CONSTRAINT FK_CosmDocuments_UpdatedBy FOREIGN KEY (updatedBy) REFERENCES cmdb.Users(id),
        CONSTRAINT CK_CosmDocuments_Status CHECK (status IN ('Draft', 'Active', 'Superseded', 'Retired')),
        CONSTRAINT CK_CosmDocuments_Dates CHECK (expirationDate IS NULL OR effectiveDate IS NULL OR expirationDate >= effectiveDate),
        CONSTRAINT CK_CosmDocuments_Supersedes CHECK (supersedesDocumentId IS NULL OR supersedesDocumentId <> id)
    );

    CREATE INDEX IX_CosmDocuments_StatusCategory ON cmdb.CosmDocuments(status, category, title);
    CREATE INDEX IX_CosmDocuments_CurrentVersion ON cmdb.CosmDocuments(currentVersionId) WHERE currentVersionId IS NOT NULL;
END
GO

IF OBJECT_ID('cmdb.CosmDocumentVersions', 'U') IS NULL
BEGIN
    CREATE TABLE cmdb.CosmDocumentVersions (
        id UNIQUEIDENTIFIER NOT NULL,
        documentId UNIQUEIDENTIFIER NOT NULL,
        versionSequence INT NOT NULL,
        sharePointSiteKey VARCHAR(32) NULL,
        sharePointSiteId NVARCHAR(255) NULL,
        driveId NVARCHAR(255) NULL,
        itemId NVARCHAR(255) NULL,
        sharePointVersionId NVARCHAR(255) NULL,
        fileName NVARCHAR(255) NULL,
        mimeType NVARCHAR(128) NULL,
        contentSize BIGINT NULL,
        contentSha256 CHAR(64) NULL,
        webUrl NVARCHAR(2048) NULL,
        lifecycleState VARCHAR(16) NOT NULL CONSTRAINT DF_CosmDocumentVersions_Lifecycle DEFAULT 'Draft',
        effectiveAt DATETIME2(3) NULL,
        uploadedBy VARCHAR(255) NULL,
        uploadedAt DATETIME2(3) NULL,
        ingestionStatus VARCHAR(16) NOT NULL CONSTRAINT DF_CosmDocumentVersions_Ingestion DEFAULT 'Pending',
        indexingStatus VARCHAR(16) NOT NULL CONSTRAINT DF_CosmDocumentVersions_Indexing DEFAULT 'Pending',
        processingErrorCode NVARCHAR(128) NULL,
        createdAt DATETIME2(3) NOT NULL CONSTRAINT DF_CosmDocumentVersions_CreatedAt DEFAULT SYSUTCDATETIME(),
        version ROWVERSION NOT NULL,
        CONSTRAINT PK_CosmDocumentVersions PRIMARY KEY (id),
        CONSTRAINT FK_CosmDocumentVersions_Document FOREIGN KEY (documentId) REFERENCES cmdb.CosmDocuments(id),
        CONSTRAINT FK_CosmDocumentVersions_Uploader FOREIGN KEY (uploadedBy) REFERENCES cmdb.Users(id),
        CONSTRAINT UQ_CosmDocumentVersions_Sequence UNIQUE (documentId, versionSequence),
        CONSTRAINT CK_CosmDocumentVersions_Sequence CHECK (versionSequence > 0),
        CONSTRAINT CK_CosmDocumentVersions_ContentSize CHECK (contentSize IS NULL OR contentSize >= 0),
        CONSTRAINT CK_CosmDocumentVersions_ContentSha256 CHECK (contentSha256 IS NULL OR LEN(contentSha256) = 64),
        CONSTRAINT CK_CosmDocumentVersions_Lifecycle CHECK (lifecycleState IN ('Draft', 'Effective', 'Historical')),
        CONSTRAINT CK_CosmDocumentVersions_Ingestion CHECK (ingestionStatus IN ('Pending', 'Processing', 'Complete', 'Failed')),
        CONSTRAINT CK_CosmDocumentVersions_Indexing CHECK (indexingStatus IN ('Pending', 'Processing', 'Complete', 'Failed'))
    );

    CREATE INDEX IX_CosmDocumentVersions_Document ON cmdb.CosmDocumentVersions(documentId, versionSequence DESC);
    CREATE UNIQUE INDEX UQ_CosmDocumentVersions_SharePointVersion
        ON cmdb.CosmDocumentVersions(sharePointSiteKey, driveId, itemId, sharePointVersionId)
        WHERE sharePointSiteKey IS NOT NULL AND driveId IS NOT NULL AND itemId IS NOT NULL AND sharePointVersionId IS NOT NULL;
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = 'FK_CosmDocuments_CurrentVersion' AND parent_object_id = OBJECT_ID('cmdb.CosmDocuments')
)
BEGIN
    ALTER TABLE cmdb.CosmDocuments WITH CHECK
        ADD CONSTRAINT FK_CosmDocuments_CurrentVersion
        FOREIGN KEY (currentVersionId) REFERENCES cmdb.CosmDocumentVersions(id);
END
GO

PRINT 'Migration 012 complete';

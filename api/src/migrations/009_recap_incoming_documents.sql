-- Migration: 009_recap_incoming_documents.sql
-- Authoritative external organization membership and incoming-package metadata.

IF EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID('cmdb.Users')
      AND name = 'chk_user_role'
)
BEGIN
    ALTER TABLE cmdb.Users DROP CONSTRAINT chk_user_role;
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID('cmdb.Users')
      AND name = 'chk_user_role'
)
BEGIN
    ALTER TABLE cmdb.Users ADD CONSTRAINT chk_user_role
        CHECK (role IN ('Viewer', 'Editor', 'PlatformAdmin', 'ExternalBroker', 'ExternalBuyer', 'DDTeam'));
END
GO

IF OBJECT_ID('cmdb.ExternalUserOrganizations', 'U') IS NULL
BEGIN
    CREATE TABLE cmdb.ExternalUserOrganizations (
        userId VARCHAR(255) NOT NULL,
        externalOrganizationId NVARCHAR(64) NOT NULL,
        isDefault BIT NOT NULL
            CONSTRAINT DF_ExternalUserOrganizations_IsDefault DEFAULT 0,
        createdAt DATETIME2(3) NOT NULL
            CONSTRAINT DF_ExternalUserOrganizations_CreatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_ExternalUserOrganizations PRIMARY KEY (userId, externalOrganizationId),
        CONSTRAINT FK_ExternalUserOrganizations_User
            FOREIGN KEY (userId) REFERENCES cmdb.Users(id)
    );

    CREATE INDEX IX_ExternalUserOrganizations_Organization
        ON cmdb.ExternalUserOrganizations(externalOrganizationId);

    CREATE UNIQUE INDEX UQ_ExternalUserOrganizations_Default
        ON cmdb.ExternalUserOrganizations(userId)
        WHERE isDefault = 1;
END
GO

IF OBJECT_ID('cmdb.RecapIncomingDocuments', 'U') IS NULL
BEGIN
    CREATE TABLE cmdb.RecapIncomingDocuments (
        id UNIQUEIDENTIFIER NOT NULL,
        recapTransactionId UNIQUEIDENTIFIER NOT NULL,
        sourcePackageId NVARCHAR(128) NOT NULL,
        documentType VARCHAR(32) NOT NULL
            CONSTRAINT DF_RecapIncomingDocuments_Type DEFAULT 'IncomingPackage',
        originalFileName NVARCHAR(255) NOT NULL,
        storedFileName NVARCHAR(255) NOT NULL,
        contentSha256 CHAR(64) NOT NULL,
        contentSize BIGINT NOT NULL,
        status VARCHAR(16) NOT NULL
            CONSTRAINT DF_RecapIncomingDocuments_Status DEFAULT 'Pending',
        siteKey VARCHAR(32) NOT NULL,
        driveId NVARCHAR(255) NULL,
        itemId NVARCHAR(255) NULL,
        webUrl NVARCHAR(2048) NULL,
        uploadedAt DATETIME2(3) NULL,
        uploadedBy VARCHAR(255) NOT NULL,
        externalOrganizationId NVARCHAR(64) NOT NULL,
        createdAt DATETIME2(3) NOT NULL
            CONSTRAINT DF_RecapIncomingDocuments_CreatedAt DEFAULT SYSUTCDATETIME(),
        updatedAt DATETIME2(3) NOT NULL
            CONSTRAINT DF_RecapIncomingDocuments_UpdatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_RecapIncomingDocuments PRIMARY KEY (id),
        CONSTRAINT FK_RecapIncomingDocuments_Transaction
            FOREIGN KEY (recapTransactionId) REFERENCES cmdb.RecapTransactions(id),
        CONSTRAINT FK_RecapIncomingDocuments_Uploader
            FOREIGN KEY (uploadedBy) REFERENCES cmdb.Users(id),
        CONSTRAINT UQ_RecapIncomingDocuments_Package UNIQUE (recapTransactionId, sourcePackageId),
        CONSTRAINT CK_RecapIncomingDocuments_Type CHECK (documentType = 'IncomingPackage'),
        CONSTRAINT CK_RecapIncomingDocuments_Status CHECK (status IN ('Pending', 'Uploaded')),
        CONSTRAINT CK_RecapIncomingDocuments_SiteKey CHECK (siteKey = 'working'),
        CONSTRAINT CK_RecapIncomingDocuments_Size CHECK (contentSize > 0)
    );

    CREATE UNIQUE INDEX UQ_RecapIncomingDocuments_GraphItem
        ON cmdb.RecapIncomingDocuments(siteKey, driveId, itemId)
        WHERE driveId IS NOT NULL AND itemId IS NOT NULL;

    CREATE INDEX IX_RecapIncomingDocuments_TransactionDate
        ON cmdb.RecapIncomingDocuments(recapTransactionId, uploadedAt DESC);

    CREATE INDEX IX_RecapIncomingDocuments_OrganizationDate
        ON cmdb.RecapIncomingDocuments(externalOrganizationId, uploadedAt DESC);

    CREATE INDEX IX_RecapIncomingDocuments_FileName
        ON cmdb.RecapIncomingDocuments(originalFileName);
END
GO

PRINT 'Migration 009 complete';

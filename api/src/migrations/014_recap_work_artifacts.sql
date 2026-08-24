-- Migration: 014_recap_work_artifacts.sql
-- Durable SharePoint folder and metadata linkage for authoritative Recap work artifacts.

IF OBJECT_ID('cmdb.RecapWorkItemSharePointFolders', 'U') IS NULL
BEGIN
    CREATE TABLE cmdb.RecapWorkItemSharePointFolders (
        workItemId UNIQUEIDENTIFIER NOT NULL,
        siteKey VARCHAR(32) NOT NULL,
        siteId NVARCHAR(255) NOT NULL,
        driveId NVARCHAR(255) NOT NULL,
        folderItemId NVARCHAR(255) NOT NULL,
        folderName NVARCHAR(256) NOT NULL,
        webUrl NVARCHAR(2048) NULL,
        createdAt DATETIME2(3) NOT NULL CONSTRAINT DF_RecapWorkArtifactFolders_CreatedAt DEFAULT SYSUTCDATETIME(),
        updatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_RecapWorkArtifactFolders_UpdatedAt DEFAULT SYSUTCDATETIME(),
        version ROWVERSION NOT NULL,
        CONSTRAINT PK_RecapWorkArtifactFolders PRIMARY KEY (workItemId, siteKey),
        CONSTRAINT FK_RecapWorkArtifactFolders_WorkItem FOREIGN KEY (workItemId) REFERENCES cmdb.RecapWorkItems(id),
        CONSTRAINT CK_RecapWorkArtifactFolders_SiteKey CHECK (siteKey = 'working')
    );
    CREATE UNIQUE INDEX UQ_RecapWorkArtifactFolders_GraphItem
        ON cmdb.RecapWorkItemSharePointFolders(siteKey, driveId, folderItemId);
END
GO

IF OBJECT_ID('cmdb.RecapWorkArtifacts', 'U') IS NULL
BEGIN
    CREATE TABLE cmdb.RecapWorkArtifacts (
        id UNIQUEIDENTIFIER NOT NULL,
        workItemId UNIQUEIDENTIFIER NOT NULL,
        originalFileName NVARCHAR(255) NOT NULL,
        storedFileName NVARCHAR(255) NOT NULL,
        contentType NVARCHAR(128) NOT NULL,
        contentSize BIGINT NOT NULL,
        contentSha256 CHAR(64) NOT NULL,
        siteKey VARCHAR(32) NOT NULL,
        driveId NVARCHAR(255) NULL,
        itemId NVARCHAR(255) NULL,
        webUrl NVARCHAR(2048) NULL,
        status VARCHAR(16) NOT NULL CONSTRAINT DF_RecapWorkArtifacts_Status DEFAULT 'Pending',
        uploadedByUserId VARCHAR(255) NOT NULL,
        uploadedAt DATETIME2(3) NULL,
        createdAt DATETIME2(3) NOT NULL CONSTRAINT DF_RecapWorkArtifacts_CreatedAt DEFAULT SYSUTCDATETIME(),
        updatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_RecapWorkArtifacts_UpdatedAt DEFAULT SYSUTCDATETIME(),
        version ROWVERSION NOT NULL,
        CONSTRAINT PK_RecapWorkArtifacts PRIMARY KEY (id),
        CONSTRAINT FK_RecapWorkArtifacts_WorkItem FOREIGN KEY (workItemId) REFERENCES cmdb.RecapWorkItems(id),
        CONSTRAINT FK_RecapWorkArtifacts_Uploader FOREIGN KEY (uploadedByUserId) REFERENCES cmdb.Users(id),
        CONSTRAINT UQ_RecapWorkArtifacts_Content UNIQUE (workItemId, contentSha256, storedFileName),
        CONSTRAINT CK_RecapWorkArtifacts_SiteKey CHECK (siteKey = 'working'),
        CONSTRAINT CK_RecapWorkArtifacts_Status CHECK (status IN ('Pending', 'Uploaded', 'Failed')),
        CONSTRAINT CK_RecapWorkArtifacts_Size CHECK (contentSize > 0)
    );
    CREATE UNIQUE INDEX UQ_RecapWorkArtifacts_GraphItem
        ON cmdb.RecapWorkArtifacts(siteKey, driveId, itemId)
        WHERE driveId IS NOT NULL AND itemId IS NOT NULL;
    CREATE INDEX IX_RecapWorkArtifacts_WorkItemDate
        ON cmdb.RecapWorkArtifacts(workItemId, uploadedAt DESC);
END
GO

PRINT 'Migration 014 complete';

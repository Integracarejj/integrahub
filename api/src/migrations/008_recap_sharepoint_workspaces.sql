-- Migration: 008_recap_sharepoint_workspaces.sql
-- Durable mapping from an authoritative recap transaction to its managed
-- SharePoint workspace root. This migration does not create SharePoint content.

IF OBJECT_ID('cmdb.RecapTransactionSharePointWorkspaces', 'U') IS NULL
BEGIN
    CREATE TABLE cmdb.RecapTransactionSharePointWorkspaces (
        recapTransactionId UNIQUEIDENTIFIER NOT NULL,
        siteKey VARCHAR(32) NOT NULL,
        siteId NVARCHAR(255) NOT NULL,
        driveId NVARCHAR(255) NOT NULL,
        rootItemId NVARCHAR(255) NOT NULL,
        folderName NVARCHAR(256) NOT NULL,
        webUrl NVARCHAR(2048) NULL,
        createdAt DATETIME2(3) NOT NULL
            CONSTRAINT DF_RecapSPWorkspaces_CreatedAt DEFAULT SYSUTCDATETIME(),
        updatedAt DATETIME2(3) NOT NULL
            CONSTRAINT DF_RecapSPWorkspaces_UpdatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_RecapSPWorkspaces PRIMARY KEY (recapTransactionId, siteKey),
        CONSTRAINT FK_RecapSPWorkspaces_Transaction
            FOREIGN KEY (recapTransactionId) REFERENCES cmdb.RecapTransactions(id),
        CONSTRAINT CK_RecapSPWorkspaces_SiteKey CHECK (siteKey = 'working')
    );

    CREATE UNIQUE INDEX UQ_RecapSPWorkspaces_RootItem
        ON cmdb.RecapTransactionSharePointWorkspaces(siteKey, driveId, rootItemId);
END
GO

PRINT 'Migration 008 complete';

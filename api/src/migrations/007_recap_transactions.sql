-- Migration: 007_recap_transactions.sql
-- Authoritative server-side identity for Recapitalization transactions.
-- Additive only: does not migrate or modify browser/localStorage recap data.

IF NOT EXISTS (
    SELECT 1
    FROM sys.sequences
    WHERE name = 'RecapTransactionNumberSequence'
      AND schema_id = SCHEMA_ID('cmdb')
)
BEGIN
    CREATE SEQUENCE cmdb.RecapTransactionNumberSequence
        AS BIGINT
        START WITH 1
        INCREMENT BY 1
        NO CYCLE;
END
GO

IF OBJECT_ID('cmdb.RecapTransactions', 'U') IS NULL
BEGIN
    CREATE TABLE cmdb.RecapTransactions (
        id UNIQUEIDENTIFIER NOT NULL,
        businessTransactionId VARCHAR(32) NOT NULL,
        name NVARCHAR(256) NOT NULL,
        status VARCHAR(20) NOT NULL
            CONSTRAINT DF_RecapTransactions_Status DEFAULT 'Active',
        owningExternalOrganizationId NVARCHAR(64) NULL,
        createdAt DATETIME2(3) NOT NULL
            CONSTRAINT DF_RecapTransactions_CreatedAt DEFAULT SYSUTCDATETIME(),
        updatedAt DATETIME2(3) NOT NULL
            CONSTRAINT DF_RecapTransactions_UpdatedAt DEFAULT SYSUTCDATETIME(),
        createdBy NVARCHAR(255) NOT NULL,
        CONSTRAINT PK_RecapTransactions PRIMARY KEY (id),
        CONSTRAINT UQ_RecapTransactions_BusinessId UNIQUE (businessTransactionId),
        CONSTRAINT CK_RecapTransactions_Status
            CHECK (status IN ('Active', 'Pending', 'Completed', 'Cancelled'))
    );

    CREATE INDEX IX_RecapTransactions_Status
        ON cmdb.RecapTransactions(status, updatedAt DESC);

    CREATE INDEX IX_RecapTransactions_Organization
        ON cmdb.RecapTransactions(owningExternalOrganizationId)
        WHERE owningExternalOrganizationId IS NOT NULL;
END
GO

PRINT 'Migration 007 complete';

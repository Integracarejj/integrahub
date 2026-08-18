-- Migration: 010_recap_intake_workflow.sql
-- Durable handoff from an uploaded external package into Recapitalization Intake.

IF OBJECT_ID('cmdb.RecapIntakePackages', 'U') IS NULL
BEGIN
    CREATE TABLE cmdb.RecapIntakePackages (
        id UNIQUEIDENTIFIER NOT NULL,
        recapTransactionId UNIQUEIDENTIFIER NOT NULL,
        sourcePackageId NVARCHAR(128) NOT NULL,
        packageName NVARCHAR(256) NOT NULL,
        originalFileName NVARCHAR(255) NOT NULL,
        requestCount INT NOT NULL,
        status VARCHAR(24) NOT NULL CONSTRAINT DF_RecapIntakePackages_Status DEFAULT 'Awaiting Review',
        submittedBy VARCHAR(255) NOT NULL,
        submittedByName NVARCHAR(255) NOT NULL,
        submittedByEmail NVARCHAR(255) NULL,
        externalOrganizationId NVARCHAR(64) NOT NULL,
        createdAt DATETIME2(3) NOT NULL CONSTRAINT DF_RecapIntakePackages_CreatedAt DEFAULT SYSUTCDATETIME(),
        updatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_RecapIntakePackages_UpdatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_RecapIntakePackages PRIMARY KEY (id),
        CONSTRAINT FK_RecapIntakePackages_Transaction FOREIGN KEY (recapTransactionId) REFERENCES cmdb.RecapTransactions(id),
        CONSTRAINT FK_RecapIntakePackages_Submitter FOREIGN KEY (submittedBy) REFERENCES cmdb.Users(id),
        CONSTRAINT UQ_RecapIntakePackages_Source UNIQUE (recapTransactionId, sourcePackageId),
        CONSTRAINT CK_RecapIntakePackages_Count CHECK (requestCount >= 0),
        CONSTRAINT CK_RecapIntakePackages_Status CHECK (status IN ('Awaiting Review', 'Assigned', 'Converted', 'Rejected'))
    );

    CREATE INDEX IX_RecapIntakePackages_StatusDate
        ON cmdb.RecapIntakePackages(status, createdAt DESC);
END
GO

IF OBJECT_ID('cmdb.RecapIntakeRequests', 'U') IS NULL
BEGIN
    CREATE TABLE cmdb.RecapIntakeRequests (
        id UNIQUEIDENTIFIER NOT NULL,
        intakePackageId UNIQUEIDENTIFIER NOT NULL,
        sourceRowNumber INT NOT NULL,
        category NVARCHAR(128) NOT NULL,
        title NVARCHAR(512) NOT NULL,
        description NVARCHAR(MAX) NOT NULL,
        team NVARCHAR(128) NULL,
        owner NVARCHAR(255) NULL,
        priority VARCHAR(8) NOT NULL,
        dueDate DATE NULL,
        communityNamesJson NVARCHAR(MAX) NOT NULL CONSTRAINT DF_RecapIntakeRequests_Communities DEFAULT '[]',
        createdAt DATETIME2(3) NOT NULL CONSTRAINT DF_RecapIntakeRequests_CreatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_RecapIntakeRequests PRIMARY KEY (id),
        CONSTRAINT FK_RecapIntakeRequests_Package FOREIGN KEY (intakePackageId) REFERENCES cmdb.RecapIntakePackages(id),
        CONSTRAINT UQ_RecapIntakeRequests_Row UNIQUE (intakePackageId, sourceRowNumber),
        CONSTRAINT CK_RecapIntakeRequests_Row CHECK (sourceRowNumber > 0),
        CONSTRAINT CK_RecapIntakeRequests_Priority CHECK (priority IN ('High', 'Medium', 'Low')),
        CONSTRAINT CK_RecapIntakeRequests_CommunitiesJson CHECK (ISJSON(communityNamesJson) = 1)
    );

    CREATE INDEX IX_RecapIntakeRequests_Package
        ON cmdb.RecapIntakeRequests(intakePackageId, sourceRowNumber);
END
GO

PRINT 'Migration 010 complete';

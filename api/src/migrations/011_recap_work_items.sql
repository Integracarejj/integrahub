-- Migration: 011_recap_work_items.sql
-- Additive authoritative internal workflow seam for durable Recap intake requests.

IF NOT EXISTS (
    SELECT 1 FROM sys.sequences
    WHERE name = 'RecapWorkItemNumberSequence' AND schema_id = SCHEMA_ID('cmdb')
)
BEGIN
    CREATE SEQUENCE cmdb.RecapWorkItemNumberSequence AS BIGINT START WITH 1 INCREMENT BY 1 NO CYCLE;
END
GO

IF OBJECT_ID('cmdb.RecapWorkItems', 'U') IS NULL
BEGIN
    CREATE TABLE cmdb.RecapWorkItems (
        id UNIQUEIDENTIFIER NOT NULL,
        intakeRequestId UNIQUEIDENTIFIER NOT NULL,
        requestNumber VARCHAR(32) NOT NULL,
        status VARCHAR(20) NOT NULL CONSTRAINT DF_RecapWorkItems_Status DEFAULT 'Queued',
        assignedUserId VARCHAR(255) NULL,
        assignedByUserId VARCHAR(255) NULL,
        team NVARCHAR(128) NULL,
        priority VARCHAR(8) NOT NULL,
        dueDate DATE NULL,
        title NVARCHAR(512) NOT NULL,
        description NVARCHAR(MAX) NOT NULL,
        category NVARCHAR(128) NOT NULL,
        communityNamesJson NVARCHAR(MAX) NOT NULL CONSTRAINT DF_RecapWorkItems_Communities DEFAULT '[]',
        needsReassignment BIT NOT NULL CONSTRAINT DF_RecapWorkItems_NeedsReassignment DEFAULT 0,
        misassignedReason NVARCHAR(1000) NULL,
        admittedAt DATETIME2(3) NOT NULL CONSTRAINT DF_RecapWorkItems_AdmittedAt DEFAULT SYSUTCDATETIME(),
        assignedAt DATETIME2(3) NULL,
        acceptedAt DATETIME2(3) NULL,
        createdAt DATETIME2(3) NOT NULL CONSTRAINT DF_RecapWorkItems_CreatedAt DEFAULT SYSUTCDATETIME(),
        updatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_RecapWorkItems_UpdatedAt DEFAULT SYSUTCDATETIME(),
        version ROWVERSION NOT NULL,
        CONSTRAINT PK_RecapWorkItems PRIMARY KEY (id),
        CONSTRAINT UQ_RecapWorkItems_IntakeRequest UNIQUE (intakeRequestId),
        CONSTRAINT UQ_RecapWorkItems_RequestNumber UNIQUE (requestNumber),
        CONSTRAINT FK_RecapWorkItems_IntakeRequest FOREIGN KEY (intakeRequestId) REFERENCES cmdb.RecapIntakeRequests(id),
        CONSTRAINT FK_RecapWorkItems_AssignedUser FOREIGN KEY (assignedUserId) REFERENCES cmdb.Users(id),
        CONSTRAINT FK_RecapWorkItems_AssignedByUser FOREIGN KEY (assignedByUserId) REFERENCES cmdb.Users(id),
        CONSTRAINT CK_RecapWorkItems_Status CHECK (status IN ('Queued', 'Assigned', 'In Progress')),
        CONSTRAINT CK_RecapWorkItems_Priority CHECK (priority IN ('High', 'Medium', 'Low')),
        CONSTRAINT CK_RecapWorkItems_CommunitiesJson CHECK (ISJSON(communityNamesJson) = 1)
    );

    CREATE INDEX IX_RecapWorkItems_Status ON cmdb.RecapWorkItems(status, updatedAt DESC);
    CREATE INDEX IX_RecapWorkItems_Assignee ON cmdb.RecapWorkItems(assignedUserId, status) WHERE assignedUserId IS NOT NULL;
END
GO

PRINT 'Migration 011 complete';

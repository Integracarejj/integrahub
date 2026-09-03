-- Migration: 021_recap_internal_workflow.sql
-- Add authoritative internal Recap workflow state, immutable events, and work notes.
-- Checksum is calculated with CRLF normalized to LF and this literal normalized to zeros.

SET XACT_ABORT ON;

BEGIN TRY
    BEGIN TRANSACTION;

IF OBJECT_ID('cmdb.SchemaMigrations', 'U') IS NULL OR OBJECT_ID('cmdb.RecapWorkItems', 'U') IS NULL
    OR OBJECT_ID('cmdb.Users', 'U') IS NULL
    THROW 51060, 'Migration 021 requires SchemaMigrations, RecapWorkItems, and Users.', 1;

DECLARE @migrationName NVARCHAR(255) = N'021_recap_internal_workflow.sql';
DECLARE @contentSha256 CHAR(64) = 'DBAA37B0C5A4903A10016C936FEC88F18C1D076BB5DA691BAA95CCB1EB5A3E1F';
DECLARE @existingChecksum CHAR(64) = (SELECT contentSha256 FROM cmdb.SchemaMigrations WHERE migrationName = @migrationName);

IF @existingChecksum IS NOT NULL AND @existingChecksum <> @contentSha256
    THROW 51061, 'Migration 021 was previously recorded with a different checksum.', 1;

IF @existingChecksum = @contentSha256
BEGIN
    IF 9 <> (SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID('cmdb.RecapWorkItems')
            AND name IN ('responseContent', 'responseUpdatedAt', 'responseUpdatedByUserId', 'activeReasonType', 'activeReason', 'proposedDisposition', 'dispositionReason', 'dispositionProposedByUserId', 'dispositionProposedAt') AND is_nullable = 1)
        OR NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('cmdb.RecapWorkItems') AND name = 'responseContent' AND max_length = -1 AND is_nullable = 1)
        OR NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('cmdb.RecapWorkItems') AND name = 'activeReason' AND max_length = 4000 AND is_nullable = 1)
        OR NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('cmdb.RecapWorkItems') AND name = 'proposedDisposition' AND max_length = 14 AND is_nullable = 1)
        OR OBJECT_ID('cmdb.RecapWorkItemEvents', 'U') IS NULL
        OR OBJECT_ID('cmdb.RecapWorkNotes', 'U') IS NULL
        OR 2 <> (SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID('cmdb.RecapWorkItemEvents') AND name IN ('priorAssignedUserId', 'resultingAssignedUserId') AND is_nullable = 1)
        OR NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('cmdb.RecapWorkItemEvents') AND name = 'IX_RecapWorkItemEvents_WorkItemDate' AND is_disabled = 0)
        OR NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('cmdb.RecapWorkNotes') AND name = 'IX_RecapWorkNotes_WorkItemDate' AND is_disabled = 0)
        OR NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID('cmdb.RecapWorkItems') AND name = 'FK_RecapWorkItems_ResponseUpdater' AND is_disabled = 0 AND is_not_trusted = 0)
        OR NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID('cmdb.RecapWorkItems') AND name = 'FK_RecapWorkItems_DispositionProposer' AND is_disabled = 0 AND is_not_trusted = 0)
        OR 8 <> (SELECT COUNT(*) FROM sys.foreign_keys WHERE name IN ('FK_RecapWorkItems_ResponseUpdater', 'FK_RecapWorkItems_DispositionProposer', 'FK_RecapWorkItemEvents_WorkItem', 'FK_RecapWorkItemEvents_Actor', 'FK_RecapWorkItemEvents_PriorAssignee', 'FK_RecapWorkItemEvents_ResultingAssignee', 'FK_RecapWorkNotes_WorkItem', 'FK_RecapWorkNotes_Author') AND is_disabled = 0 AND is_not_trusted = 0)
        OR 8 <> (SELECT COUNT(*) FROM sys.check_constraints WHERE name IN ('CK_RecapWorkItems_Status', 'CK_RecapWorkItems_ActiveReason', 'CK_RecapWorkItems_Disposition', 'CK_RecapWorkItems_Response', 'CK_RecapWorkItemEvents_Type', 'CK_RecapWorkItemEvents_Details', 'CK_RecapWorkNotes_Type', 'CK_RecapWorkNotes_Text') AND is_disabled = 0 AND is_not_trusted = 0)
        OR EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id IN (OBJECT_ID('cmdb.RecapWorkItems'), OBJECT_ID('cmdb.RecapWorkItemEvents'), OBJECT_ID('cmdb.RecapWorkNotes')) AND (is_disabled = 1 OR is_not_trusted = 1))
        THROW 51062, 'Migration 021 is recorded but its required schema is incomplete.', 1;
    COMMIT TRANSACTION;
    PRINT 'Migration 021 already applied';
    RETURN;
END;

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('cmdb.RecapWorkItems') AND name IN ('responseContent', 'responseUpdatedAt', 'responseUpdatedByUserId', 'activeReasonType', 'activeReason', 'proposedDisposition', 'dispositionReason', 'dispositionProposedByUserId', 'dispositionProposedAt'))
    OR OBJECT_ID('cmdb.RecapWorkItemEvents', 'U') IS NOT NULL
    OR OBJECT_ID('cmdb.RecapWorkNotes', 'U') IS NOT NULL
    THROW 51063, 'Unrecorded or partial Recap internal workflow schema already exists.', 1;

ALTER TABLE cmdb.RecapWorkItems DROP CONSTRAINT CK_RecapWorkItems_Status;
ALTER TABLE cmdb.RecapWorkItems ADD
    responseContent NVARCHAR(MAX) NULL,
    responseUpdatedAt DATETIME2(3) NULL,
    responseUpdatedByUserId VARCHAR(255) NULL,
    activeReasonType VARCHAR(20) NULL,
    activeReason NVARCHAR(2000) NULL,
    proposedDisposition VARCHAR(14) NULL,
    dispositionReason NVARCHAR(2000) NULL,
    dispositionProposedByUserId VARCHAR(255) NULL,
    dispositionProposedAt DATETIME2(3) NULL;

ALTER TABLE cmdb.RecapWorkItems ADD CONSTRAINT FK_RecapWorkItems_ResponseUpdater
    FOREIGN KEY (responseUpdatedByUserId) REFERENCES cmdb.Users(id);
ALTER TABLE cmdb.RecapWorkItems ADD CONSTRAINT FK_RecapWorkItems_DispositionProposer
    FOREIGN KEY (dispositionProposedByUserId) REFERENCES cmdb.Users(id);
ALTER TABLE cmdb.RecapWorkItems ADD CONSTRAINT CK_RecapWorkItems_Status CHECK (status IN (
    'Queued', 'Assigned', 'In Progress', 'Clarification Needed', 'Blocked',
    'Needs DD Review', 'Ready to Publish', 'Not Applicable', 'Duplicate'
));
ALTER TABLE cmdb.RecapWorkItems ADD CONSTRAINT CK_RecapWorkItems_ActiveReason CHECK (
    (status = 'Clarification Needed' AND activeReasonType IS NOT NULL AND activeReasonType = 'Clarification' AND activeReason IS NOT NULL AND NULLIF(LTRIM(RTRIM(activeReason)), '') IS NOT NULL)
    OR (status = 'Blocked' AND activeReasonType IS NOT NULL AND activeReasonType = 'Blocker' AND activeReason IS NOT NULL AND NULLIF(LTRIM(RTRIM(activeReason)), '') IS NOT NULL)
    OR (status NOT IN ('Clarification Needed', 'Blocked') AND activeReasonType IS NULL AND activeReason IS NULL)
);
ALTER TABLE cmdb.RecapWorkItems ADD CONSTRAINT CK_RecapWorkItems_Disposition CHECK (
    (status NOT IN ('Not Applicable', 'Duplicate')
        AND proposedDisposition IS NULL AND dispositionReason IS NULL AND dispositionProposedByUserId IS NULL AND dispositionProposedAt IS NULL)
    OR (proposedDisposition IS NOT NULL AND proposedDisposition IN ('Not Applicable', 'Duplicate')
        AND dispositionReason IS NOT NULL AND NULLIF(LTRIM(RTRIM(dispositionReason)), '') IS NOT NULL
        AND dispositionProposedByUserId IS NOT NULL AND dispositionProposedAt IS NOT NULL
        AND (status = 'Needs DD Review' OR status = proposedDisposition))
);
ALTER TABLE cmdb.RecapWorkItems ADD CONSTRAINT CK_RecapWorkItems_Response CHECK (
    (responseContent IS NULL AND responseUpdatedAt IS NULL AND responseUpdatedByUserId IS NULL)
    OR (responseContent IS NOT NULL AND NULLIF(LTRIM(RTRIM(responseContent)), '') IS NOT NULL AND responseUpdatedAt IS NOT NULL AND responseUpdatedByUserId IS NOT NULL)
);

CREATE TABLE cmdb.RecapWorkItemEvents (
    id UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_RecapWorkItemEvents_Id DEFAULT NEWID(),
    workItemId UNIQUEIDENTIFIER NOT NULL,
    eventType VARCHAR(40) NOT NULL,
    actorUserId VARCHAR(255) NOT NULL,
    occurredAt DATETIME2(3) NOT NULL CONSTRAINT DF_RecapWorkItemEvents_OccurredAt DEFAULT SYSUTCDATETIME(),
    priorStatus VARCHAR(24) NULL,
    resultingStatus VARCHAR(24) NOT NULL,
    priorAssignedUserId VARCHAR(255) NULL,
    resultingAssignedUserId VARCHAR(255) NULL,
    detailsJson NVARCHAR(4000) NULL,
    CONSTRAINT PK_RecapWorkItemEvents PRIMARY KEY (id),
    CONSTRAINT FK_RecapWorkItemEvents_WorkItem FOREIGN KEY (workItemId) REFERENCES cmdb.RecapWorkItems(id),
    CONSTRAINT FK_RecapWorkItemEvents_Actor FOREIGN KEY (actorUserId) REFERENCES cmdb.Users(id),
    CONSTRAINT FK_RecapWorkItemEvents_PriorAssignee FOREIGN KEY (priorAssignedUserId) REFERENCES cmdb.Users(id),
    CONSTRAINT FK_RecapWorkItemEvents_ResultingAssignee FOREIGN KEY (resultingAssignedUserId) REFERENCES cmdb.Users(id),
    CONSTRAINT CK_RecapWorkItemEvents_Type CHECK (eventType IN (
        'Admitted', 'Assigned', 'Reassigned', 'Accepted', 'ResponseUpdated',
        'ClarificationRequested', 'ClarificationResolved', 'Blocked', 'Unblocked',
        'DispositionProposed', 'DispositionApproved', 'DispositionReturned', 'MarkedNotMine',
        'SubmittedForDdReview', 'ReturnedFromDdReview', 'MarkedReadyToPublish'
    )),
    CONSTRAINT CK_RecapWorkItemEvents_Details CHECK (detailsJson IS NULL OR ISJSON(detailsJson) = 1)
);
CREATE INDEX IX_RecapWorkItemEvents_WorkItemDate ON cmdb.RecapWorkItemEvents(workItemId, occurredAt, id);

CREATE TABLE cmdb.RecapWorkNotes (
    id UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_RecapWorkNotes_Id DEFAULT NEWID(),
    workItemId UNIQUEIDENTIFIER NOT NULL,
    authorUserId VARCHAR(255) NOT NULL,
    noteType VARCHAR(20) NOT NULL CONSTRAINT DF_RecapWorkNotes_Type DEFAULT 'Work Note',
    noteText NVARCHAR(4000) NOT NULL,
    createdAt DATETIME2(3) NOT NULL CONSTRAINT DF_RecapWorkNotes_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_RecapWorkNotes PRIMARY KEY (id),
    CONSTRAINT FK_RecapWorkNotes_WorkItem FOREIGN KEY (workItemId) REFERENCES cmdb.RecapWorkItems(id),
    CONSTRAINT FK_RecapWorkNotes_Author FOREIGN KEY (authorUserId) REFERENCES cmdb.Users(id),
    CONSTRAINT CK_RecapWorkNotes_Type CHECK (noteType IN ('Work Note', 'Clarification', 'Blocker', 'Disposition')),
    CONSTRAINT CK_RecapWorkNotes_Text CHECK (NULLIF(LTRIM(RTRIM(noteText)), '') IS NOT NULL)
);
CREATE INDEX IX_RecapWorkNotes_WorkItemDate ON cmdb.RecapWorkNotes(workItemId, createdAt, id);

INSERT INTO cmdb.SchemaMigrations (migrationName, contentSha256, releaseName, appliedBy)
VALUES (@migrationName, @contentSha256, NULL, NULL);

COMMIT TRANSACTION;
PRINT 'Migration 021 complete';
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;

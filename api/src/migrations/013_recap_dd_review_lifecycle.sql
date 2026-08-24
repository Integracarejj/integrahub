-- Migration: 013_recap_dd_review_lifecycle.sql
-- Extend the authoritative Recap work item lifecycle through DD review.

IF OBJECT_ID('cmdb.RecapWorkItems', 'U') IS NOT NULL
BEGIN
    IF OBJECT_ID('cmdb.CK_RecapWorkItems_Status', 'C') IS NOT NULL
        ALTER TABLE cmdb.RecapWorkItems DROP CONSTRAINT CK_RecapWorkItems_Status;

    ALTER TABLE cmdb.RecapWorkItems ADD CONSTRAINT CK_RecapWorkItems_Status
        CHECK (status IN ('Queued', 'Assigned', 'In Progress', 'Needs DD Review', 'Ready to Publish'));
END
GO

PRINT 'Migration 013 complete';

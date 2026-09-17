-- Migration: 025_recap_partner_returned_for_changes.sql
-- Add the authoritative state for partner-returned work before the contributor resumes it.
-- Checksum is calculated with CRLF normalized to LF and this literal normalized to zeros.
SET XACT_ABORT ON;
BEGIN TRY
    BEGIN TRANSACTION;
    IF OBJECT_ID('cmdb.SchemaMigrations', 'U') IS NULL OR OBJECT_ID('cmdb.RecapWorkItems', 'U') IS NULL
        OR OBJECT_ID('cmdb.RecapWorkItemEvents', 'U') IS NULL
        THROW 51110, 'Migration 025 requires SchemaMigrations, RecapWorkItems, and RecapWorkItemEvents.', 1;

    DECLARE @migrationName NVARCHAR(255) = N'025_recap_partner_returned_for_changes.sql';
    DECLARE @contentSha256 CHAR(64) = 'ABDAA7C86C9B3597EEB19C024E8DBD407F81E81A79469169B7C9EB318D30478B';
    DECLARE @existingChecksum CHAR(64) = (SELECT contentSha256 FROM cmdb.SchemaMigrations WHERE migrationName = @migrationName);
    IF @existingChecksum IS NOT NULL AND @existingChecksum <> @contentSha256
        THROW 51111, 'Migration 025 was recorded with a different checksum.', 1;
    IF @existingChecksum IS NULL
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM cmdb.SchemaMigrations
            WHERE migrationName = N'024_recap_publication_content_snapshot.sql'
              AND contentSha256 = '25E47EBB151C0205D579A860D74637FC8D7EF9B005BFF41EBE441DF4C13DD4A3')
            THROW 51112, 'Migration 025 requires the recorded final migration 024.', 1;
        IF EXISTS (SELECT 1 FROM cmdb.RecapWorkItems WHERE status = 'Returned for Changes')
            THROW 51113, 'Unrecorded Returned for Changes work-item state already exists.', 1;
        ALTER TABLE cmdb.RecapWorkItems DROP CONSTRAINT CK_RecapWorkItems_Status;
        ALTER TABLE cmdb.RecapWorkItems WITH CHECK ADD CONSTRAINT CK_RecapWorkItems_Status CHECK (status IN (
            'Queued', 'Assigned', 'In Progress', 'Returned for Changes', 'Clarification Needed', 'Blocked', 'Needs DD Review',
            'Ready to Publish', 'Waiting Partner Review', 'Completed', 'Not Applicable', 'Duplicate'
        ));
        ALTER TABLE cmdb.RecapWorkItemEvents DROP CONSTRAINT CK_RecapWorkItemEvents_Type;
        ALTER TABLE cmdb.RecapWorkItemEvents WITH CHECK ADD CONSTRAINT CK_RecapWorkItemEvents_Type CHECK (eventType IN (
            'Admitted', 'Assigned', 'Reassigned', 'Accepted', 'ResumedReturnedWork', 'ResponseUpdated', 'ClarificationRequested',
            'ClarificationResolved', 'Blocked', 'Unblocked', 'DispositionProposed', 'DispositionApproved', 'DispositionReturned',
            'MarkedNotMine', 'SubmittedForDdReview', 'ReturnedFromDdReview', 'MarkedReadyToPublish', 'PublicationStarted',
            'PublishedExternal', 'PartnerApproved', 'PartnerRequestedRework'
        ));
    END;
    IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('cmdb.RecapWorkItems')
        AND name = 'CK_RecapWorkItems_Status' AND is_disabled = 0 AND is_not_trusted = 0
        AND definition LIKE '%Returned for Changes%')
        OR NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('cmdb.RecapWorkItemEvents')
        AND name = 'CK_RecapWorkItemEvents_Type' AND is_disabled = 0 AND is_not_trusted = 0
        AND definition LIKE '%ResumedReturnedWork%')
        THROW 51114, 'Migration 025 partner-return lifecycle schema verification failed.', 1;
    IF @existingChecksum IS NULL
        INSERT INTO cmdb.SchemaMigrations (migrationName, contentSha256, releaseName, appliedBy)
        VALUES (@migrationName, @contentSha256, NULL, NULL);
    COMMIT TRANSACTION;
    PRINT 'Migration 025 complete';
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;

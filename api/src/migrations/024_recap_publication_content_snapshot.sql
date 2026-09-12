-- Migration: 024_recap_publication_content_snapshot.sql
-- Capture edition content for new publications. Never backfill historical text
-- from mutable Working content. NULL identifies a legacy edition without a snapshot.
-- Checksum is calculated with CRLF normalized to LF and this literal normalized to zeros.
SET XACT_ABORT ON;
BEGIN TRY
    BEGIN TRANSACTION;
    IF OBJECT_ID('cmdb.SchemaMigrations', 'U') IS NULL OR OBJECT_ID('cmdb.RecapPublications', 'U') IS NULL
        THROW 51100, 'Migration 024 requires SchemaMigrations and RecapPublications.', 1;

    DECLARE @migrationName NVARCHAR(255) = N'024_recap_publication_content_snapshot.sql';
    DECLARE @contentSha256 CHAR(64) = '25E47EBB151C0205D579A860D74637FC8D7EF9B005BFF41EBE441DF4C13DD4A3';
    DECLARE @existingChecksum CHAR(64) = (SELECT contentSha256 FROM cmdb.SchemaMigrations WHERE migrationName = @migrationName);
    IF @existingChecksum IS NOT NULL AND @existingChecksum <> @contentSha256
        THROW 51101, 'Migration 024 was recorded with a different checksum.', 1;
    IF @existingChecksum IS NULL
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM cmdb.SchemaMigrations
            WHERE migrationName = N'023_recap_lifecycle_status_width.sql'
              AND contentSha256 = '4C035809FD054110A0E23C52764844313A442A83B63CC294D2B3F144AC815EE5')
            THROW 51102, 'Migration 024 requires the recorded final migration 023.', 1;
        IF COL_LENGTH('cmdb.RecapPublications', 'contentSnapshotJson') IS NOT NULL
            THROW 51103, 'Unrecorded publication content snapshot column already exists.', 1;
        ALTER TABLE cmdb.RecapPublications ADD contentSnapshotJson NVARCHAR(MAX) NULL;
        EXEC(N'ALTER TABLE cmdb.RecapPublications WITH CHECK ADD CONSTRAINT CK_RecapPublications_ContentSnapshot
            CHECK (contentSnapshotJson IS NULL OR ISJSON(contentSnapshotJson) = 1)');
    END;
    IF NOT EXISTS (SELECT 1 FROM sys.columns c INNER JOIN sys.types t ON t.user_type_id = c.user_type_id
        WHERE c.object_id = OBJECT_ID('cmdb.RecapPublications') AND c.name = 'contentSnapshotJson'
          AND t.name = 'nvarchar' AND c.max_length = -1 AND c.is_nullable = 1)
        OR NOT EXISTS (SELECT 1 FROM sys.check_constraints
            WHERE parent_object_id = OBJECT_ID('cmdb.RecapPublications') AND name = 'CK_RecapPublications_ContentSnapshot'
              AND is_disabled = 0 AND is_not_trusted = 0
              AND definition LIKE '%ISJSON%' AND definition LIKE '%contentSnapshotJson%')
        THROW 51104, 'Migration 024 snapshot schema verification failed.', 1;
    IF @existingChecksum IS NULL
        INSERT INTO cmdb.SchemaMigrations (migrationName, contentSha256, releaseName, appliedBy)
        VALUES (@migrationName, @contentSha256, NULL, NULL);
    COMMIT TRANSACTION;
    PRINT 'Migration 024 complete';
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;

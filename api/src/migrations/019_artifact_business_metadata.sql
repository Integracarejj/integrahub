-- Migration: 019_artifact_business_metadata.sql
-- Add optional business metadata and authoritative Document Hub vocabularies.
-- cmdb.BusinessTopics owns classification identity and lifecycle. The frontend
-- topics.ts file retains richer page-only enrichment keyed by these stable slugs.

SET XACT_ABORT ON;

BEGIN TRY
    BEGIN TRANSACTION;

IF OBJECT_ID('cmdb.SchemaMigrations', 'U') IS NULL
    THROW 51040, 'Migration 019 requires cmdb.SchemaMigrations.', 1;
IF OBJECT_ID('cmdb.Artifacts', 'U') IS NULL OR OBJECT_ID('cmdb.ArtifactPlacements', 'U') IS NULL
    THROW 51041, 'Migration 019 requires migrations 015 through 018.', 1;

DECLARE @migrationName NVARCHAR(255) = N'019_artifact_business_metadata.sql';
DECLARE @contentSha256 CHAR(64) = 'FEA70A912EA46C19B887007AA096B90C044FCF70A27D55315578D9A08C400A23';
DECLARE @existingChecksum CHAR(64) = (SELECT contentSha256 FROM cmdb.SchemaMigrations WHERE migrationName = @migrationName);

IF @existingChecksum IS NOT NULL AND @existingChecksum <> @contentSha256
    THROW 51042, 'Migration 019 was previously recorded with a different checksum.', 1;

IF @existingChecksum = @contentSha256
BEGIN
    IF OBJECT_ID('cmdb.DocumentTypes', 'U') IS NULL OR OBJECT_ID('cmdb.BusinessTopics', 'U') IS NULL
        OR NOT EXISTS (SELECT 1 FROM sys.columns columnInfo INNER JOIN sys.types typeInfo ON typeInfo.user_type_id = columnInfo.user_type_id
            WHERE columnInfo.object_id = OBJECT_ID('cmdb.Artifacts') AND columnInfo.name = 'documentTitle'
              AND typeInfo.name = 'nvarchar' AND columnInfo.max_length = 510 AND columnInfo.is_nullable = 1)
        OR NOT EXISTS (SELECT 1 FROM sys.columns columnInfo INNER JOIN sys.types typeInfo ON typeInfo.user_type_id = columnInfo.user_type_id
            WHERE columnInfo.object_id = OBJECT_ID('cmdb.Artifacts') AND columnInfo.name = 'documentOrigin'
              AND typeInfo.name = 'nvarchar' AND columnInfo.max_length = 510 AND columnInfo.is_nullable = 1)
        OR NOT EXISTS (SELECT 1 FROM sys.columns columnInfo INNER JOIN sys.types typeInfo ON typeInfo.user_type_id = columnInfo.user_type_id
            WHERE columnInfo.object_id = OBJECT_ID('cmdb.Artifacts') AND columnInfo.name = 'documentTypeKey'
              AND typeInfo.name = 'varchar' AND columnInfo.max_length = 64 AND columnInfo.is_nullable = 1)
        OR NOT EXISTS (SELECT 1 FROM sys.columns columnInfo INNER JOIN sys.types typeInfo ON typeInfo.user_type_id = columnInfo.user_type_id
            WHERE columnInfo.object_id = OBJECT_ID('cmdb.Artifacts') AND columnInfo.name = 'businessTopicSlug'
              AND typeInfo.name = 'varchar' AND columnInfo.max_length = 64 AND columnInfo.is_nullable = 1)
        OR EXISTS (SELECT 1 FROM (VALUES
                ('documentTypeKey', 'varchar', 64, 0), ('displayName', 'nvarchar', 256, 0),
                ('isActive', 'bit', 1, 0), ('sortOrder', 'int', 4, 0)
            ) expected(columnName, typeName, maxLength, isNullable)
            WHERE NOT EXISTS (SELECT 1 FROM sys.columns columnInfo INNER JOIN sys.types typeInfo ON typeInfo.user_type_id = columnInfo.user_type_id
                WHERE columnInfo.object_id = OBJECT_ID('cmdb.DocumentTypes') AND columnInfo.name = expected.columnName
                  AND typeInfo.name = expected.typeName AND columnInfo.max_length = expected.maxLength
                  AND columnInfo.is_nullable = expected.isNullable))
        OR EXISTS (SELECT 1 FROM (VALUES
                ('businessTopicSlug', 'varchar', 64, 0), ('displayName', 'nvarchar', 256, 0),
                ('description', 'nvarchar', 2000, 0), ('topicGroup', 'nvarchar', 128, 0),
                ('isActive', 'bit', 1, 0), ('sortOrder', 'int', 4, 0)
            ) expected(columnName, typeName, maxLength, isNullable)
            WHERE NOT EXISTS (SELECT 1 FROM sys.columns columnInfo INNER JOIN sys.types typeInfo ON typeInfo.user_type_id = columnInfo.user_type_id
                WHERE columnInfo.object_id = OBJECT_ID('cmdb.BusinessTopics') AND columnInfo.name = expected.columnName
                  AND typeInfo.name = expected.typeName AND columnInfo.max_length = expected.maxLength
                  AND columnInfo.is_nullable = expected.isNullable))
        OR NOT EXISTS (SELECT 1 FROM sys.foreign_keys foreignKey
            WHERE foreignKey.name = 'FK_Artifacts_DocumentType' AND foreignKey.parent_object_id = OBJECT_ID('cmdb.Artifacts')
              AND foreignKey.referenced_object_id = OBJECT_ID('cmdb.DocumentTypes') AND foreignKey.is_disabled = 0 AND foreignKey.is_not_trusted = 0
              AND EXISTS (SELECT 1 FROM sys.foreign_key_columns mapping WHERE mapping.constraint_object_id = foreignKey.object_id
                  AND mapping.parent_column_id = COLUMNPROPERTY(OBJECT_ID('cmdb.Artifacts'), 'documentTypeKey', 'ColumnId')
                  AND mapping.referenced_column_id = COLUMNPROPERTY(OBJECT_ID('cmdb.DocumentTypes'), 'documentTypeKey', 'ColumnId')))
        OR NOT EXISTS (SELECT 1 FROM sys.foreign_keys foreignKey
            WHERE foreignKey.name = 'FK_Artifacts_BusinessTopic' AND foreignKey.parent_object_id = OBJECT_ID('cmdb.Artifacts')
              AND foreignKey.referenced_object_id = OBJECT_ID('cmdb.BusinessTopics') AND foreignKey.is_disabled = 0 AND foreignKey.is_not_trusted = 0
              AND EXISTS (SELECT 1 FROM sys.foreign_key_columns mapping WHERE mapping.constraint_object_id = foreignKey.object_id
                  AND mapping.parent_column_id = COLUMNPROPERTY(OBJECT_ID('cmdb.Artifacts'), 'businessTopicSlug', 'ColumnId')
                  AND mapping.referenced_column_id = COLUMNPROPERTY(OBJECT_ID('cmdb.BusinessTopics'), 'businessTopicSlug', 'ColumnId')))
        THROW 51043, 'Migration 019 is recorded but its required schema is incomplete.', 1;

    DECLARE @seedDataValid BIT = 0;
    EXEC sys.sp_executesql N'
        SELECT @valid = CASE WHEN
            NOT EXISTS (
                SELECT expected.documentTypeKey, expected.displayName, expected.isActive, expected.sortOrder
                FROM (VALUES
                    (''policy'', N''Policy'', 1, 10), (''procedure'', N''Procedure'', 1, 20),
                    (''contract-agreement'', N''Contract / Agreement'', 1, 30), (''financial'', N''Financial'', 1, 40),
                    (''report-analysis'', N''Report / Analysis'', 1, 50),
                    (''government-regulatory-guidance'', N''Government / Regulatory Guidance'', 1, 60),
                    (''project-document'', N''Project Document'', 1, 70), (''meeting-notes'', N''Meeting / Notes'', 1, 80),
                    (''form-template'', N''Form / Template'', 1, 90), (''presentation'', N''Presentation'', 1, 100),
                    (''reference-material'', N''Reference Material'', 1, 110), (''other'', N''Other'', 1, 120)
                ) expected(documentTypeKey, displayName, isActive, sortOrder)
                EXCEPT SELECT documentTypeKey, displayName, isActive, sortOrder FROM cmdb.DocumentTypes
            ) AND NOT EXISTS (
                SELECT documentTypeKey, displayName, isActive, sortOrder FROM cmdb.DocumentTypes
                EXCEPT SELECT expected.documentTypeKey, expected.displayName, expected.isActive, expected.sortOrder
                FROM (VALUES
                    (''policy'', N''Policy'', 1, 10), (''procedure'', N''Procedure'', 1, 20),
                    (''contract-agreement'', N''Contract / Agreement'', 1, 30), (''financial'', N''Financial'', 1, 40),
                    (''report-analysis'', N''Report / Analysis'', 1, 50),
                    (''government-regulatory-guidance'', N''Government / Regulatory Guidance'', 1, 60),
                    (''project-document'', N''Project Document'', 1, 70), (''meeting-notes'', N''Meeting / Notes'', 1, 80),
                    (''form-template'', N''Form / Template'', 1, 90), (''presentation'', N''Presentation'', 1, 100),
                    (''reference-material'', N''Reference Material'', 1, 110), (''other'', N''Other'', 1, 120)
                ) expected(documentTypeKey, displayName, isActive, sortOrder)
            )
            AND (SELECT COUNT(*) FROM cmdb.BusinessTopics) = 19
            AND NOT EXISTS (SELECT 1 FROM cmdb.BusinessTopics
                WHERE isActive <> 1 OR description = N'''' OR topicGroup NOT IN (N''Operations'', N''Workforce'', N''Finance'', N''Sales'')
                   OR sortOrder NOT BETWEEN 10 AND 190 OR sortOrder % 10 <> 0)
            AND NOT EXISTS (
                SELECT expected.businessTopicSlug, expected.displayName, expected.topicGroup, expected.sortOrder
                FROM (VALUES
                    (''census'', N''Census'', N''Operations'', 10), (''occupancy'', N''Occupancy'', N''Operations'', 20),
                    (''move-ins'', N''Move-Ins'', N''Operations'', 30), (''resident-care'', N''Resident Care'', N''Operations'', 40),
                    (''maintenance'', N''Maintenance'', N''Operations'', 50), (''compliance'', N''Compliance'', N''Operations'', 60),
                    (''staffing'', N''Staffing'', N''Workforce'', 70), (''training'', N''Training'', N''Workforce'', 80),
                    (''payroll'', N''Payroll'', N''Workforce'', 90), (''employee-lifecycle'', N''Employee Lifecycle'', N''Workforce'', 100),
                    (''retention'', N''Retention'', N''Workforce'', 110), (''revenue-cycle'', N''Revenue Cycle'', N''Finance'', 120),
                    (''billing'', N''Billing'', N''Finance'', 130), (''budget'', N''Budget'', N''Finance'', 140),
                    (''ap-payments'', N''AP / Payments'', N''Finance'', 150), (''lead-generation'', N''Lead Generation'', N''Sales'', 160),
                    (''tours'', N''Tours'', N''Sales'', 170), (''conversion'', N''Conversion'', N''Sales'', 180),
                    (''referral-sources'', N''Referral Sources'', N''Sales'', 190)
                ) expected(businessTopicSlug, displayName, topicGroup, sortOrder)
                EXCEPT SELECT businessTopicSlug, displayName, topicGroup, sortOrder FROM cmdb.BusinessTopics
            ) THEN 1 ELSE 0 END;', N'@valid BIT OUTPUT', @valid = @seedDataValid OUTPUT;
    IF @seedDataValid <> 1
        THROW 51045, 'Migration 019 is recorded but its authoritative registry seeds are incomplete.', 1;
    COMMIT TRANSACTION;
    PRINT 'Migration 019 already applied';
    RETURN;
END;

IF OBJECT_ID('cmdb.DocumentTypes', 'U') IS NOT NULL OR OBJECT_ID('cmdb.BusinessTopics', 'U') IS NOT NULL
    OR EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('cmdb.Artifacts') AND name IN ('documentTitle', 'documentOrigin', 'documentTypeKey', 'businessTopicSlug'))
    THROW 51044, 'Unrecorded Artifact business metadata schema already exists.', 1;

CREATE TABLE cmdb.DocumentTypes (
    documentTypeKey VARCHAR(64) NOT NULL CONSTRAINT PK_DocumentTypes PRIMARY KEY,
    displayName NVARCHAR(128) NOT NULL,
    isActive BIT NOT NULL CONSTRAINT DF_DocumentTypes_IsActive DEFAULT 1,
    sortOrder INT NOT NULL,
    CONSTRAINT UQ_DocumentTypes_DisplayName UNIQUE (displayName),
    CONSTRAINT CK_DocumentTypes_Key CHECK (documentTypeKey NOT LIKE '%[^a-z0-9-]%' AND LEN(documentTypeKey) BETWEEN 1 AND 64),
    CONSTRAINT CK_DocumentTypes_SortOrder CHECK (sortOrder >= 0)
);

INSERT INTO cmdb.DocumentTypes (documentTypeKey, displayName, sortOrder) VALUES
('policy', N'Policy', 10), ('procedure', N'Procedure', 20), ('contract-agreement', N'Contract / Agreement', 30),
('financial', N'Financial', 40), ('report-analysis', N'Report / Analysis', 50),
('government-regulatory-guidance', N'Government / Regulatory Guidance', 60), ('project-document', N'Project Document', 70),
('meeting-notes', N'Meeting / Notes', 80), ('form-template', N'Form / Template', 90),
('presentation', N'Presentation', 100), ('reference-material', N'Reference Material', 110), ('other', N'Other', 120);

CREATE TABLE cmdb.BusinessTopics (
    businessTopicSlug VARCHAR(64) NOT NULL CONSTRAINT PK_BusinessTopics PRIMARY KEY,
    displayName NVARCHAR(128) NOT NULL,
    description NVARCHAR(1000) NOT NULL,
    topicGroup NVARCHAR(64) NOT NULL,
    isActive BIT NOT NULL CONSTRAINT DF_BusinessTopics_IsActive DEFAULT 1,
    sortOrder INT NOT NULL,
    CONSTRAINT UQ_BusinessTopics_DisplayName UNIQUE (displayName),
    CONSTRAINT CK_BusinessTopics_Slug CHECK (businessTopicSlug NOT LIKE '%[^a-z0-9-]%' AND LEN(businessTopicSlug) BETWEEN 1 AND 64),
    CONSTRAINT CK_BusinessTopics_SortOrder CHECK (sortOrder >= 0)
);

INSERT INTO cmdb.BusinessTopics (businessTopicSlug, displayName, description, topicGroup, sortOrder) VALUES
('census', N'Census', N'Current resident population and occupancy movement across communities.', N'Operations', 10),
('occupancy', N'Occupancy', N'Percentage of available units or beds currently filled across communities.', N'Operations', 20),
('move-ins', N'Move-Ins', N'New resident move-in activity including lead sources, conversion rates, and move-in readiness.', N'Operations', 30),
('resident-care', N'Resident Care', N'Care delivery, clinical documentation, wellness programs, and service coordination for residents.', N'Operations', 40),
('maintenance', N'Maintenance', N'Facility maintenance, work order management, preventive maintenance, and asset lifecycle tracking.', N'Operations', 50),
('compliance', N'Compliance', N'Regulatory compliance, safety inspections, licensing, and policy adherence across communities.', N'Operations', 60),
('staffing', N'Staffing', N'Workforce planning, staffing levels, scheduling, and labor cost management across communities.', N'Workforce', 70),
('training', N'Training', N'Employee training, onboarding, continuing education, and compliance training across the organization.', N'Workforce', 80),
('payroll', N'Payroll', N'Employee compensation, time tracking, payroll processing, and labor cost allocation.', N'Workforce', 90),
('employee-lifecycle', N'Employee Lifecycle', N'End-to-end employee journey from recruiting and hiring through onboarding, development, and offboarding.', N'Workforce', 100),
('retention', N'Retention', N'Employee retention rates, turnover analysis, and strategies to maintain workforce stability.', N'Workforce', 110),
('revenue-cycle', N'Revenue Cycle', N'End-to-end revenue process from billing through collections, including resident billing, insurance, and government payments.', N'Finance', 120),
('billing', N'Billing', N'Invoice generation, payment processing, and billing operations for resident accounts.', N'Finance', 130),
('budget', N'Budget', N'Annual budgeting process, financial planning, and variance tracking for communities and corporate.', N'Finance', 140),
('ap-payments', N'AP / Payments', N'Accounts payable, vendor payments, invoice processing, and payment reconciliation.', N'Finance', 150),
('lead-generation', N'Lead Generation', N'Marketing and sales activities that generate prospective resident inquiries and referrals.', N'Sales', 160),
('tours', N'Tours', N'Community tours and visits for prospective residents and their families.', N'Sales', 170),
('conversion', N'Conversion', N'Sales funnel conversion rates from lead through tour to move-in.', N'Sales', 180),
('referral-sources', N'Referral Sources', N'Analysis of where referrals come from including professional referrals, families, and digital channels.', N'Sales', 190);

-- Dynamic DDL avoids SQL Server same-batch compilation of the newly-added columns.
EXEC(N'ALTER TABLE cmdb.Artifacts ADD documentTitle NVARCHAR(255) NULL, documentOrigin NVARCHAR(255) NULL,
    documentTypeKey VARCHAR(64) NULL, businessTopicSlug VARCHAR(64) NULL');
EXEC(N'ALTER TABLE cmdb.Artifacts ADD CONSTRAINT FK_Artifacts_DocumentType FOREIGN KEY (documentTypeKey) REFERENCES cmdb.DocumentTypes(documentTypeKey),
    CONSTRAINT FK_Artifacts_BusinessTopic FOREIGN KEY (businessTopicSlug) REFERENCES cmdb.BusinessTopics(businessTopicSlug)');

INSERT INTO cmdb.SchemaMigrations (migrationName, contentSha256, releaseName, appliedBy)
VALUES (@migrationName, @contentSha256, NULL, NULL);

COMMIT TRANSACTION;
PRINT 'Migration 019 complete';
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;

-- ============================================================================
-- Recapitalization Portal & Internal DD Tracker — Schema Proposal
-- ============================================================================
-- Purpose: Proposed tables for the internal Recapitalization command center
--          and the external Recapitalization Portal (currently mock-driven).
--
-- Status: PROPOSAL ONLY — NOT EXECUTED
--         Run this script in SSMS against the icX database after review.
--         All tables created in the cmdb schema.
--
-- Dependencies: cmdb.Users already exists.
-- ============================================================================

-- ============================================================================
-- 1. cmdb.RecapTransactions
-- Represents a transaction (deal) being managed through the DD workflow.
-- Used by both internal tracker and external portal.
-- ============================================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'RecapTransactions' AND schema_id = SCHEMA_ID('cmdb'))
CREATE TABLE cmdb.RecapTransactions (
    Id                      NVARCHAR(50)    NOT NULL PRIMARY KEY,
    Name                    NVARCHAR(200)   NOT NULL,
    Description             NVARCHAR(1000)  NULL,
    Status                  NVARCHAR(20)    NOT NULL DEFAULT 'Active',  -- Active, Pending, Completed, Cancelled
    BuyerName               NVARCHAR(200)   NULL,
    BrokerName              NVARCHAR(200)   NULL,
    TargetCloseDate         DATE            NULL,
    TotalRequests           INT             NOT NULL DEFAULT 0,
    ProvidedCount           INT             NOT NULL DEFAULT 0,
    InProgressCount         INT             NOT NULL DEFAULT 0,
    ClarificationNeededCount INT            NOT NULL DEFAULT 0,
    OverdueCount            INT             NOT NULL DEFAULT 0,
    ExternalVisible         BIT             NOT NULL DEFAULT 1,         -- Whether transaction appears in external portal
    CreatedAt               DATETIME2       NOT NULL DEFAULT GETUTCDATE(),
    UpdatedAt               DATETIME2       NOT NULL DEFAULT GETUTCDATE(),
    CreatedBy               NVARCHAR(100)   NULL,
    UpdatedBy               NVARCHAR(100)   NULL
);
GO

-- Index for status-based queries (active transactions listing)
CREATE INDEX IX_RecapTransactions_Status ON cmdb.RecapTransactions (Status) INCLUDE (Name, BuyerName, TargetCloseDate);
GO

-- ============================================================================
-- 2. cmdb.RecapTransactionParties
-- Many-to-many mapping of parties (broker, buyer, legal, etc.) to transactions.
-- ============================================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'RecapTransactionParties' AND schema_id = SCHEMA_ID('cmdb'))
CREATE TABLE cmdb.RecapTransactionParties (
    Id              NVARCHAR(50)    NOT NULL PRIMARY KEY,
    TransactionId   NVARCHAR(50)    NOT NULL REFERENCES cmdb.RecapTransactions(Id),
    PartyType       NVARCHAR(50)    NOT NULL,   -- Broker, Buyer, Legal Counsel, Consultant, etc.
    PartyName       NVARCHAR(200)   NOT NULL,
    ContactEmail    NVARCHAR(200)   NULL,
    ContactPhone    NVARCHAR(50)    NULL,
    ExternalVisible BIT             NOT NULL DEFAULT 1,
    CreatedAt       DATETIME2       NOT NULL DEFAULT GETUTCDATE()
);
GO

CREATE INDEX IX_RecapTransactionParties_Txn ON cmdb.RecapTransactionParties (TransactionId);
GO

-- ============================================================================
-- 3. cmdb.RecapCommunities
-- Individual community/property within a transaction.
-- ============================================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'RecapCommunities' AND schema_id = SCHEMA_ID('cmdb'))
CREATE TABLE cmdb.RecapCommunities (
    Id              NVARCHAR(50)    NOT NULL PRIMARY KEY,
    Name            NVARCHAR(200)   NOT NULL,
    Description     NVARCHAR(500)   NULL,
    ExternalVisible BIT             NOT NULL DEFAULT 1,
    CreatedAt       DATETIME2       NOT NULL DEFAULT GETUTCDATE()
);
GO

-- ============================================================================
-- 4. cmdb.RecapTransactionCommunities
-- Links communities to transactions. A community can appear in multiple
-- transactions (though rare), and a transaction has multiple communities.
-- ============================================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'RecapTransactionCommunities' AND schema_id = SCHEMA_ID('cmdb'))
CREATE TABLE cmdb.RecapTransactionCommunities (
    Id              NVARCHAR(50)    NOT NULL PRIMARY KEY,
    TransactionId   NVARCHAR(50)    NOT NULL REFERENCES cmdb.RecapTransactions(Id),
    CommunityId     NVARCHAR(50)    NOT NULL REFERENCES cmdb.RecapCommunities(Id),
    ExternalVisible BIT             NOT NULL DEFAULT 1
);
GO

CREATE INDEX IX_RecapTxnComm_Txn ON cmdb.RecapTransactionCommunities (TransactionId);
CREATE INDEX IX_RecapTxnComm_Comm ON cmdb.RecapTransactionCommunities (CommunityId);
GO

-- ============================================================================
-- 5. cmdb.RecapUserTransactionAccess
-- Controls which internal or external users can access which transactions.
-- Used by both the external portal gate and internal team assignment views.
-- ============================================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'RecapUserTransactionAccess' AND schema_id = SCHEMA_ID('cmdb'))
CREATE TABLE cmdb.RecapUserTransactionAccess (
    Id              NVARCHAR(50)    NOT NULL PRIMARY KEY,
    UserId          NVARCHAR(50)    NOT NULL REFERENCES cmdb.Users(Id),
    TransactionId   NVARCHAR(50)    NOT NULL REFERENCES cmdb.RecapTransactions(Id),
    AccessLevel     NVARCHAR(20)    NOT NULL DEFAULT 'View',   -- View, Edit, Admin
    GrantedAt       DATETIME2       NOT NULL DEFAULT GETUTCDATE(),
    GrantedBy       NVARCHAR(100)   NULL
);
GO

CREATE INDEX IX_RecapUserAccess_User ON cmdb.RecapUserTransactionAccess (UserId);
CREATE INDEX IX_RecapUserAccess_Txn ON cmdb.RecapUserTransactionAccess (TransactionId);
GO

-- ============================================================================
-- 6. cmdb.DueDiligenceRequests
-- Central table for all due diligence requests. Used by both internal
-- tracker and external portal (subject to ExternalVisible flag).
-- ============================================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'DueDiligenceRequests' AND schema_id = SCHEMA_ID('cmdb'))
CREATE TABLE cmdb.DueDiligenceRequests (
    Id                  NVARCHAR(50)    NOT NULL PRIMARY KEY,
    RequestId           NVARCHAR(50)    NOT NULL,               -- Human-readable ID e.g. DD-2026-001
    TransactionId       NVARCHAR(50)    NOT NULL REFERENCES cmdb.RecapTransactions(Id),
    Title               NVARCHAR(300)   NOT NULL,
    Description         NVARCHAR(MAX)   NULL,
    Category            NVARCHAR(100)   NOT NULL,               -- Financial Statements, Licenses, etc.
    Status              NVARCHAR(30)    NOT NULL DEFAULT 'Open', -- Open, In Progress, Clarification Needed, Under Review, Provided, Overdue
    Priority            NVARCHAR(10)    NOT NULL DEFAULT 'Medium', -- High, Medium, Low
    Source              NVARCHAR(30)    NOT NULL DEFAULT 'Internal', -- External, Internal, Bulk Import
    DueDate             DATE            NULL,
    OwnerUserId         NVARCHAR(50)    NULL REFERENCES cmdb.Users(Id),
    Team                NVARCHAR(100)   NULL,
    SubmittedBy         NVARCHAR(200)   NULL,                   -- Free-text: broker/buyer name or internal team
    ExternalVisible     BIT             NOT NULL DEFAULT 0,      -- Whether external portal users can see this
    SubmittedAt         DATETIME2       NOT NULL DEFAULT GETUTCDATE(),
    UpdatedAt           DATETIME2       NOT NULL DEFAULT GETUTCDATE(),
    CompletedAt         DATETIME2       NULL
);
GO

CREATE INDEX IX_DDRequests_Txn ON cmdb.DueDiligenceRequests (TransactionId);
CREATE INDEX IX_DDRequests_Status ON cmdb.DueDiligenceRequests (Status) INCLUDE (TransactionId, DueDate, Priority);
CREATE INDEX IX_DDRequests_Owner ON cmdb.DueDiligenceRequests (OwnerUserId) WHERE OwnerUserId IS NOT NULL;
CREATE INDEX IX_DDRequests_RequestId ON cmdb.DueDiligenceRequests (RequestId);
GO

-- ============================================================================
-- 7. cmdb.DueDiligenceRequestCommunities
-- Links requests to specific communities. An empty/universal scope is
-- represented by no rows (implies all communities for that transaction).
-- ============================================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'DueDiligenceRequestCommunities' AND schema_id = SCHEMA_ID('cmdb'))
CREATE TABLE cmdb.DueDiligenceRequestCommunities (
    Id              NVARCHAR(50)    NOT NULL PRIMARY KEY,
    RequestId       NVARCHAR(50)    NOT NULL REFERENCES cmdb.DueDiligenceRequests(Id),
    CommunityId     NVARCHAR(50)    NOT NULL REFERENCES cmdb.RecapCommunities(Id)
);
GO

CREATE INDEX IX_DDReqComm_Req ON cmdb.DueDiligenceRequestCommunities (RequestId);
GO

-- ============================================================================
-- 8. cmdb.DueDiligenceAssignments
-- Tracks assignment history and current assignments for requests.
-- Each request can have multiple assignments over time; the latest
-- active assignment is the current one.
-- ============================================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'DueDiligenceAssignments' AND schema_id = SCHEMA_ID('cmdb'))
CREATE TABLE cmdb.DueDiligenceAssignments (
    Id              NVARCHAR(50)    NOT NULL PRIMARY KEY,
    RequestId       NVARCHAR(50)    NOT NULL REFERENCES cmdb.DueDiligenceRequests(Id),
    UserId          NVARCHAR(50)    NOT NULL REFERENCES cmdb.Users(Id),
    AssignedBy      NVARCHAR(100)   NULL,
    AssignedAt      DATETIME2       NOT NULL DEFAULT GETUTCDATE(),
    IsActive        BIT             NOT NULL DEFAULT 1,          -- Set to 0 when reassigned
    UnassignedAt    DATETIME2       NULL
);
GO

CREATE INDEX IX_DDAssignments_Req ON cmdb.DueDiligenceAssignments (RequestId) WHERE IsActive = 1;
CREATE INDEX IX_DDAssignments_User ON cmdb.DueDiligenceAssignments (UserId) WHERE IsActive = 1;
GO

-- ============================================================================
-- 9. cmdb.DueDiligenceIntakeItems
-- Items awaiting triage before becoming official tracker requests.
-- ============================================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'DueDiligenceIntakeItems' AND schema_id = SCHEMA_ID('cmdb'))
CREATE TABLE cmdb.DueDiligenceIntakeItems (
    Id              NVARCHAR(50)    NOT NULL PRIMARY KEY,
    ItemType        NVARCHAR(30)    NOT NULL,                    -- Bulk Import, Question, Clarification, New DD Request, Access Request
    Status          NVARCHAR(30)    NOT NULL DEFAULT 'Awaiting Review', -- Awaiting Review, Assigned, Converted, Duplicate, Rejected
    Title           NVARCHAR(300)   NOT NULL,
    Description     NVARCHAR(MAX)   NULL,
    TransactionId   NVARCHAR(50)    NULL REFERENCES cmdb.RecapTransactions(Id),
    SubmittedBy     NVARCHAR(200)   NULL,
    SubmittedAt     DATETIME2       NOT NULL DEFAULT GETUTCDATE(),
    AssignedToUserId NVARCHAR(50)   NULL REFERENCES cmdb.Users(Id),
    Priority        NVARCHAR(10)    NOT NULL DEFAULT 'Medium',
    ConvertedToRequestId NVARCHAR(50) NULL REFERENCES cmdb.DueDiligenceRequests(Id),
    RejectedReason  NVARCHAR(500)   NULL
);
GO

CREATE INDEX IX_DDIntake_Status ON cmdb.DueDiligenceIntakeItems (Status);
CREATE INDEX IX_DDIntake_Type ON cmdb.DueDiligenceIntakeItems (ItemType);
GO

-- ============================================================================
-- 10. cmdb.DueDiligenceQuestions
-- Questions submitted through the external portal.
-- ============================================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'DueDiligenceQuestions' AND schema_id = SCHEMA_ID('cmdb'))
CREATE TABLE cmdb.DueDiligenceQuestions (
    Id              NVARCHAR(50)    NOT NULL PRIMARY KEY,
    TransactionId   NVARCHAR(50)    NOT NULL REFERENCES cmdb.RecapTransactions(Id),
    CommunityIds    NVARCHAR(500)   NULL,                        -- Comma-separated or JSON list
    QuestionType    NVARCHAR(50)    NULL,
    Subject         NVARCHAR(300)   NOT NULL,
    Details         NVARCHAR(MAX)   NULL,
    SubmittedBy     NVARCHAR(200)   NULL,
    SubmittedAt     DATETIME2       NOT NULL DEFAULT GETUTCDATE(),
    Status          NVARCHAR(20)    NOT NULL DEFAULT 'Open',     -- Open, Answered, Closed
    AnsweredAt      DATETIME2       NULL,
    AnsweredByUserId NVARCHAR(50)   NULL REFERENCES cmdb.Users(Id),
    ResponseText    NVARCHAR(MAX)   NULL
);
GO

CREATE INDEX IX_DDQuestions_Txn ON cmdb.DueDiligenceQuestions (TransactionId);
GO

-- ============================================================================
-- 11. cmdb.DueDiligenceClarifications
-- Clarification requests on existing DD requests, from external users.
-- ============================================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'DueDiligenceClarifications' AND schema_id = SCHEMA_ID('cmdb'))
CREATE TABLE cmdb.DueDiligenceClarifications (
    Id              NVARCHAR(50)    NOT NULL PRIMARY KEY,
    TransactionId   NVARCHAR(50)    NOT NULL REFERENCES cmdb.RecapTransactions(Id),
    RequestId       NVARCHAR(50)    NOT NULL REFERENCES cmdb.DueDiligenceRequests(Id),
    CommunityIds    NVARCHAR(500)   NULL,
    Details         NVARCHAR(MAX)   NULL,
    SubmittedBy     NVARCHAR(200)   NULL,
    SubmittedAt     DATETIME2       NOT NULL DEFAULT GETUTCDATE(),
    Status          NVARCHAR(20)    NOT NULL DEFAULT 'Open',
    ResponseText    NVARCHAR(MAX)   NULL,
    RespondedAt     DATETIME2       NULL,
    RespondedByUserId NVARCHAR(50)  NULL REFERENCES cmdb.Users(Id)
);
GO

CREATE INDEX IX_DDClarifications_Req ON cmdb.DueDiligenceClarifications (RequestId);
GO

-- ============================================================================
-- 12. cmdb.DueDiligenceDocuments
-- Document metadata. Actual files live in SharePoint; this table stores
-- the SharePoint URL and metadata for search/display in both the
-- internal tracker and external portal.
-- ============================================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'DueDiligenceDocuments' AND schema_id = SCHEMA_ID('cmdb'))
CREATE TABLE cmdb.DueDiligenceDocuments (
    Id              NVARCHAR(50)    NOT NULL PRIMARY KEY,
    Name            NVARCHAR(300)   NOT NULL,
    TransactionId   NVARCHAR(50)    NOT NULL REFERENCES cmdb.RecapTransactions(Id),
    RequestId       NVARCHAR(50)    NULL REFERENCES cmdb.DueDiligenceRequests(Id),
    Category        NVARCHAR(100)   NULL,
    FileType        NVARCHAR(20)    NULL,
    FileSizeBytes   BIGINT          NULL,
    SharePointUrl   NVARCHAR(1000)  NULL,                        -- URL to the file in SharePoint
    SharePointDriveId NVARCHAR(100) NULL,
    SharePointItemId  NVARCHAR(100) NULL,
    UploadedByUserId  NVARCHAR(50)  NULL REFERENCES cmdb.Users(Id),
    UploadedAt      DATETIME2       NOT NULL DEFAULT GETUTCDATE(),
    ExternalVisible BIT             NOT NULL DEFAULT 0
);
GO

CREATE INDEX IX_DDDocs_Txn ON cmdb.DueDiligenceDocuments (TransactionId);
CREATE INDEX IX_DDDocs_Req ON cmdb.DueDiligenceDocuments (RequestId) WHERE RequestId IS NOT NULL;
GO

-- ============================================================================
-- 13. cmdb.DueDiligenceDocumentCommunities
-- Links documents to specific communities.
-- ============================================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'DueDiligenceDocumentCommunities' AND schema_id = SCHEMA_ID('cmdb'))
CREATE TABLE cmdb.DueDiligenceDocumentCommunities (
    Id              NVARCHAR(50)    NOT NULL PRIMARY KEY,
    DocumentId      NVARCHAR(50)    NOT NULL REFERENCES cmdb.DueDiligenceDocuments(Id),
    CommunityId     NVARCHAR(50)    NOT NULL REFERENCES cmdb.RecapCommunities(Id)
);
GO

CREATE INDEX IX_DDDocComm_Doc ON cmdb.DueDiligenceDocumentCommunities (DocumentId);
GO

-- ============================================================================
-- 14. cmdb.DueDiligenceActivityLog
-- Unified activity timeline for the entire recap system.
-- ============================================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'DueDiligenceActivityLog' AND schema_id = SCHEMA_ID('cmdb'))
CREATE TABLE cmdb.DueDiligenceActivityLog (
    Id              NVARCHAR(50)    NOT NULL PRIMARY KEY,
    ActivityType    NVARCHAR(30)    NOT NULL,                    -- Status Change, Assignment, Note, Submission, Document, Comment
    Description     NVARCHAR(MAX)   NOT NULL,
    TransactionId   NVARCHAR(50)    NULL REFERENCES cmdb.RecapTransactions(Id),
    RequestId       NVARCHAR(50)    NULL REFERENCES cmdb.DueDiligenceRequests(Id),
    IntakeItemId    NVARCHAR(50)    NULL REFERENCES cmdb.DueDiligenceIntakeItems(Id),
    PerformedByUserId NVARCHAR(50)  NULL REFERENCES cmdb.Users(Id),
    PerformedAt     DATETIME2       NOT NULL DEFAULT GETUTCDATE(),
    OldValue        NVARCHAR(500)   NULL,
    NewValue        NVARCHAR(500)   NULL
);
GO

CREATE INDEX IX_DDActivity_Txn ON cmdb.DueDiligenceActivityLog (TransactionId, PerformedAt DESC);
CREATE INDEX IX_DDActivity_Req ON cmdb.DueDiligenceActivityLog (RequestId, PerformedAt DESC);
GO

-- ============================================================================
-- 15. cmdb.DueDiligenceDeliverableCatalog
-- Catalog of known deliverables/documents that the system can suggest
-- when processing bulk imports. Helps with auto-classification.
-- ============================================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'DueDiligenceDeliverableCatalog' AND schema_id = SCHEMA_ID('cmdb'))
CREATE TABLE cmdb.DueDiligenceDeliverableCatalog (
    Id              NVARCHAR(50)    NOT NULL PRIMARY KEY,
    Name            NVARCHAR(300)   NOT NULL,
    Category        NVARCHAR(100)   NOT NULL,
    Description     NVARCHAR(1000)  NULL,
    SuggestedTeam   NVARCHAR(100)   NULL,
    SuggestedOwnerRole NVARCHAR(100) NULL,
    ConfidenceThreshold INT         NOT NULL DEFAULT 70,          -- Minimum confidence to auto-suggest
    IsActive        BIT             NOT NULL DEFAULT 1
);
GO

-- ============================================================================
-- 16. cmdb.DueDiligenceRequestMappings
-- Maps intake items (bulk import rows, questions, etc.) to the resulting
-- DD requests. Used for traceability and "Review & Publish" feature.
-- ============================================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'DueDiligenceRequestMappings' AND schema_id = SCHEMA_ID('cmdb'))
CREATE TABLE cmdb.DueDiligenceRequestMappings (
    Id              NVARCHAR(50)    NOT NULL PRIMARY KEY,
    SourceType      NVARCHAR(30)    NOT NULL,                    -- BulkImport, Question, Clarification, ExistingDeliverable
    SourceId        NVARCHAR(50)    NOT NULL,                    -- ID in the source table
    TargetRequestId NVARCHAR(50)    NOT NULL REFERENCES cmdb.DueDiligenceRequests(Id),
    MappingType     NVARCHAR(20)    NOT NULL,                    -- Created, Reused, Converted, Ignored
    Confidence      INT             NULL,                        -- Classification confidence percentage
    CreatedAt       DATETIME2       NOT NULL DEFAULT GETUTCDATE()
);
GO

CREATE INDEX IX_DDReqMappings_Source ON cmdb.DueDiligenceRequestMappings (SourceType, SourceId);
CREATE INDEX IX_DDReqMappings_Target ON cmdb.DueDiligenceRequestMappings (TargetRequestId);
GO

-- ============================================================================
-- 17. cmdb.DueDiligenceNotifications
-- Notification queue for in-app and email notifications.
-- ============================================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'DueDiligenceNotifications' AND schema_id = SCHEMA_ID('cmdb'))
CREATE TABLE cmdb.DueDiligenceNotifications (
    Id              NVARCHAR(50)    NOT NULL PRIMARY KEY,
    UserId          NVARCHAR(50)    NOT NULL REFERENCES cmdb.Users(Id),
    Title           NVARCHAR(300)   NOT NULL,
    Body            NVARCHAR(MAX)   NULL,
    NotificationType NVARCHAR(30)   NOT NULL,                    -- Assignment, StatusChange, DueDateReminder, NewIntakeItem
    ReferenceType   NVARCHAR(30)    NULL,                        -- Request, IntakeItem, Question
    ReferenceId     NVARCHAR(50)    NULL,
    IsRead          BIT             NOT NULL DEFAULT 0,
    CreatedAt       DATETIME2       NOT NULL DEFAULT GETUTCDATE(),
    ReadAt          DATETIME2       NULL
);
GO

CREATE INDEX IX_DDNotif_User ON cmdb.DueDiligenceNotifications (UserId, IsRead, CreatedAt DESC);
GO

-- ============================================================================
-- END OF PROPOSAL
-- ============================================================================

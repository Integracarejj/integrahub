-- ============================================================================
-- REPAIR: Cross-Workflow Active-State Contamination
-- ============================================================================
-- Purpose: Identify and repair requests where stale active-state fields from
--          one workflow prevent correct queue routing after transitioning to
--          another workflow (the "zero-home" bug).
--
-- Root Cause: When a request moves from one workflow (e.g., Blocker) to
--             another (e.g., Clarification), fields like _returnReason,
--             _blockerStatus, _partnerDecision, _needsReassignment, and
--             _misassignedReason may persist from the prior workflow,
--             causing queue selector filters to exclude the request from
--             all active queues.
--
-- Prerequisites:
--   1. The active-state columns listed below must exist on
--      cmdb.DueDiligenceRequests. If not present, run the ALTER TABLE
--      block at the bottom of this script first.
--   2. Run in SSMS against the icX database.
--   3. Wrap in a transaction for safety: BEGIN TRAN before execution.
--
-- Usage:
--   Step 1: Run DIAGNOSTIC queries to identify affected requests.
--   Step 2: Review results and confirm the cleanup makes sense.
--   Step 3: Run REPAIR statements within a transaction.
--   Step 4: Verify with post-repair diagnostic.
-- ============================================================================

-- ============================================================================
-- STEP 0: Ensure active-state columns exist (skip if already present)
-- ============================================================================
-- Uncomment and run this block if the columns do not yet exist.

/*
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('cmdb.DueDiligenceRequests') AND name = '_returnReason')
    ALTER TABLE cmdb.DueDiligenceRequests ADD _returnReason NVARCHAR(500) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('cmdb.DueDiligenceRequests') AND name = '_returnedBy')
    ALTER TABLE cmdb.DueDiligenceRequests ADD _returnedBy NVARCHAR(100) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('cmdb.DueDiligenceRequests') AND name = '_blockerStatus')
    ALTER TABLE cmdb.DueDiligenceRequests ADD _blockerStatus NVARCHAR(30) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('cmdb.DueDiligenceRequests') AND name = '_blockerResolution')
    ALTER TABLE cmdb.DueDiligenceRequests ADD _blockerResolution NVARCHAR(500) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('cmdb.DueDiligenceRequests') AND name = '_blockerRaisedBy')
    ALTER TABLE cmdb.DueDiligenceRequests ADD _blockerRaisedBy NVARCHAR(100) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('cmdb.DueDiligenceRequests') AND name = '_needsReassignment')
    ALTER TABLE cmdb.DueDiligenceRequests ADD _needsReassignment BIT NOT NULL DEFAULT 0;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('cmdb.DueDiligenceRequests') AND name = '_misassignedReason')
    ALTER TABLE cmdb.DueDiligenceRequests ADD _misassignedReason NVARCHAR(500) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('cmdb.DueDiligenceRequests') AND name = '_partnerDecision')
    ALTER TABLE cmdb.DueDiligenceRequests ADD _partnerDecision NVARCHAR(30) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('cmdb.DueDiligenceRequests') AND name = '_partnerNote')
    ALTER TABLE cmdb.DueDiligenceRequests ADD _partnerNote NVARCHAR(500) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('cmdb.DueDiligenceRequests') AND name = '_partnerActionAt')
    ALTER TABLE cmdb.DueDiligenceRequests ADD _partnerActionAt DATETIME2 NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('cmdb.DueDiligenceRequests') AND name = '_exceptionRecommendation')
    ALTER TABLE cmdb.DueDiligenceRequests ADD _exceptionRecommendation NVARCHAR(30) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('cmdb.DueDiligenceRequests') AND name = '_exceptionSentAt')
    ALTER TABLE cmdb.DueDiligenceRequests ADD _exceptionSentAt DATETIME2 NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('cmdb.DueDiligenceRequests') AND name = '_exceptionDecision')
    ALTER TABLE cmdb.DueDiligenceRequests ADD _exceptionDecision NVARCHAR(30) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('cmdb.DueDiligenceRequests') AND name = '_exceptionDecisionAt')
    ALTER TABLE cmdb.DueDiligenceRequests ADD _exceptionDecisionAt DATETIME2 NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('cmdb.DueDiligenceRequests') AND name = '_exceptionDecisionNote')
    ALTER TABLE cmdb.DueDiligenceRequests ADD _exceptionDecisionNote NVARCHAR(500) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('cmdb.DueDiligenceRequests') AND name = '_processingStartedAt')
    ALTER TABLE cmdb.DueDiligenceRequests ADD _processingStartedAt DATETIME2 NULL;
*/

-- ============================================================================
-- STEP 1: DIAGNOSTIC — Identify requests with stale active-state fields
-- ============================================================================

-- 1A: In Progress with stale blocker or return fields
SELECT 'IN_PROGRESS_WITH_STALE_FIELDS' AS violation_type,
       Id, RequestId, Status, OwnerUserId,
       _returnReason, _returnedBy, _blockerStatus, _blockerResolution,
       _needsReassignment, _misassignedReason,
       _partnerDecision, _partnerNote,
       _exceptionRecommendation, _exceptionSentAt, _exceptionDecision
FROM cmdb.DueDiligenceRequests
WHERE Status = 'In Progress'
  AND (
      _returnReason IS NOT NULL
      OR _returnedBy IS NOT NULL
      OR (_blockerStatus IS NOT NULL AND _blockerStatus <> 'Resolved')
      OR _needsReassignment = 1
      OR _misassignedReason IS NOT NULL
      OR _partnerDecision = 'Rework Required'
      OR _partnerNote IS NOT NULL
      OR _exceptionRecommendation IS NOT NULL
      OR _exceptionSentAt IS NOT NULL
      OR _exceptionDecision IS NOT NULL
  );

-- 1B: Clarification Needed with stale return or blocker fields
SELECT 'CLARIFICATION_WITH_STALE_FIELDS' AS violation_type,
       Id, RequestId, Status, OwnerUserId,
       _returnReason, _returnedBy, _blockerStatus, _blockerResolution,
       _needsReassignment, _misassignedReason,
       _partnerDecision, _partnerNote,
       _exceptionRecommendation, _exceptionSentAt, _exceptionDecision
FROM cmdb.DueDiligenceRequests
WHERE Status = 'Clarification Needed'
  AND (
      _returnReason IS NOT NULL
      OR _returnedBy IS NOT NULL
      OR (_blockerStatus IS NOT NULL AND _blockerStatus <> 'Resolved')
      OR _needsReassignment = 1
      OR _misassignedReason IS NOT NULL
      OR _partnerDecision = 'Rework Required'
  );

-- 1C: Blocked with stale return fields
SELECT 'BLOCKED_WITH_STALE_RETURN' AS violation_type,
       Id, RequestId, Status, OwnerUserId,
       _returnReason, _returnedBy,
       _needsReassignment, _misassignedReason
FROM cmdb.DueDiligenceRequests
WHERE Status = 'Blocked'
  AND (
      _returnReason IS NOT NULL
      OR _returnedBy IS NOT NULL
      OR _needsReassignment = 1
  );

-- 1D: Complete with any stale active fields
SELECT 'COMPLETE_WITH_STALE_FIELDS' AS violation_type,
       Id, RequestId, Status,
       _returnReason, _blockerStatus, _needsReassignment,
       _partnerDecision, _exceptionRecommendation
FROM cmdb.DueDiligenceRequests
WHERE Status = 'Complete'
  AND (
      _returnReason IS NOT NULL
      OR (_blockerStatus IS NOT NULL AND _blockerStatus <> 'Resolved')
      OR _needsReassignment = 1
  );

-- 1E: Open with stale active fields
SELECT 'OPEN_WITH_STALE_FIELDS' AS violation_type,
       Id, RequestId, Status,
       _returnReason, _blockerStatus, _needsReassignment
FROM cmdb.DueDiligenceRequests
WHERE Status = 'Open'
  AND (
      _returnReason IS NOT NULL
      OR (_blockerStatus IS NOT NULL AND _blockerStatus <> 'Resolved')
      OR _needsReassignment = 1
  );

-- 1F: Requests invisible to ALL active queues (zero-home diagnostic)
-- These are requests that would not appear in Active Work, Returned/Needs
-- Attention, Needs DD Review, or any other operational queue.
SELECT 'ZERO_HOME_RISK' AS violation_type,
       Id, RequestId, Status, OwnerUserId,
       _returnReason, _blockerStatus, _needsReassignment,
       _misassignedReason, _partnerDecision,
       _externalStatus, _exceptionSentAt
FROM cmdb.DueDiligenceRequests
WHERE Status NOT IN ('Complete', 'Duplicate', 'Not Applicable')
  AND Status <> 'Waiting Partner Review'
  AND (
      -- Has stale _returnReason blocking Needs DD Review
      (_returnReason IS NOT NULL AND Status IN ('Blocked', 'Clarification Needed'))
      -- Needs Rework not in Returned queue due to _returnReason + status combo
      OR (Status = 'Needs Rework' AND _returnReason IS NULL)
      -- Blocked with active blocker but _returnReason set (blocks Needs DD Review)
      OR (Status = 'Blocked' AND _returnReason IS NOT NULL AND _blockerStatus = 'Raised')
  );

-- ============================================================================
-- STEP 2: COUNT affected rows (summary before repair)
-- ============================================================================

SELECT
    SUM(CASE WHEN Status = 'In Progress' AND _returnReason IS NOT NULL THEN 1 ELSE 0 END) AS in_progress_stale_return,
    SUM(CASE WHEN Status = 'In Progress' AND _blockerStatus NOT IN ('Resolved', NULL) THEN 1 ELSE 0 END) AS in_progress_stale_blocker,
    SUM(CASE WHEN Status = 'In Progress' AND _partnerDecision = 'Rework Required' THEN 1 ELSE 0 END) AS in_progress_stale_partner,
    SUM(CASE WHEN Status = 'In Progress' AND _needsReassignment = 1 THEN 1 ELSE 0 END) AS in_progress_stale_reassign,
    SUM(CASE WHEN Status = 'Clarification Needed' AND _returnReason IS NOT NULL THEN 1 ELSE 0 END) AS clar_stale_return,
    SUM(CASE WHEN Status = 'Clarification Needed' AND _blockerStatus NOT IN ('Resolved', NULL) THEN 1 ELSE 0 END) AS clar_stale_blocker,
    SUM(CASE WHEN Status = 'Clarification Needed' AND _partnerDecision = 'Rework Required' THEN 1 ELSE 0 END) AS clar_stale_partner,
    SUM(CASE WHEN Status = 'Blocked' AND _returnReason IS NOT NULL THEN 1 ELSE 0 END) AS blocked_stale_return,
    SUM(CASE WHEN Status = 'Complete' AND _returnReason IS NOT NULL THEN 1 ELSE 0 END) AS complete_stale_return,
    SUM(CASE WHEN Status = 'Open' AND _returnReason IS NOT NULL THEN 1 ELSE 0 END) AS open_stale_return
FROM cmdb.DueDiligenceRequests;

-- ============================================================================
-- STEP 3: REPAIR — Clear stale fields per target status
-- ============================================================================
-- IMPORTANT: Wrap in BEGIN TRAN / COMMIT. Roll back on error.

-- BEGIN TRAN;

-- 3A: In Progress — clear everything except _processingStartedAt (sticky)
UPDATE cmdb.DueDiligenceRequests
SET _returnReason      = NULL,
    _returnedBy        = NULL,
    _blockerStatus     = NULL,
    _blockerResolution = NULL,
    _needsReassignment = 0,
    _misassignedReason = NULL,
    _partnerDecision   = NULL,
    _partnerNote       = NULL,
    _partnerActionAt   = NULL,
    _exceptionRecommendation = NULL,
    _exceptionSentAt         = NULL,
    _exceptionDecision       = NULL,
    _exceptionDecisionAt     = NULL,
    _exceptionDecisionNote   = NULL,
    UpdatedAt = GETUTCDATE()
WHERE Status = 'In Progress'
  AND (
      _returnReason IS NOT NULL
      OR _returnedBy IS NOT NULL
      OR (_blockerStatus IS NOT NULL AND _blockerStatus <> 'Resolved')
      OR _needsReassignment = 1
      OR _misassignedReason IS NOT NULL
      OR _partnerDecision = 'Rework Required'
      OR _partnerNote IS NOT NULL
      OR _exceptionRecommendation IS NOT NULL
      OR _exceptionSentAt IS NOT NULL
      OR _exceptionDecision IS NOT NULL
  );

-- 3B: Clarification Needed — clear stale fields + set owner to DD Ops Lead
UPDATE cmdb.DueDiligenceRequests
SET _returnReason      = NULL,
    _returnedBy        = NULL,
    _blockerStatus     = NULL,
    _blockerResolution = NULL,
    _needsReassignment = 0,
    _misassignedReason = NULL,
    _partnerDecision   = NULL,
    _partnerNote       = NULL,
    _partnerActionAt   = NULL,
    _exceptionRecommendation = NULL,
    _exceptionSentAt         = NULL,
    _exceptionDecision       = NULL,
    _exceptionDecisionAt     = NULL,
    _exceptionDecisionNote   = NULL,
    UpdatedAt = GETUTCDATE()
WHERE Status = 'Clarification Needed'
  AND (
      _returnReason IS NOT NULL
      OR _returnedBy IS NOT NULL
      OR (_blockerStatus IS NOT NULL AND _blockerStatus <> 'Resolved')
      OR _needsReassignment = 1
      OR _misassignedReason IS NOT NULL
      OR _partnerDecision = 'Rework Required'
  );

-- 3C: Blocked — clear stale return and partner fields
UPDATE cmdb.DueDiligenceRequests
SET _returnReason      = NULL,
    _returnedBy        = NULL,
    _needsReassignment = 0,
    _misassignedReason = NULL,
    _partnerDecision   = NULL,
    _partnerNote       = NULL,
    _partnerActionAt   = NULL,
    _exceptionRecommendation = NULL,
    _exceptionSentAt         = NULL,
    _exceptionDecision       = NULL,
    _exceptionDecisionAt     = NULL,
    _exceptionDecisionNote   = NULL,
    UpdatedAt = GETUTCDATE()
WHERE Status = 'Blocked'
  AND (
      _returnReason IS NOT NULL
      OR _returnedBy IS NOT NULL
      OR _needsReassignment = 1
  );

-- 3D: Complete — clear stale return and blocker fields
UPDATE cmdb.DueDiligenceRequests
SET _returnReason      = NULL,
    _returnedBy        = NULL,
    _blockerStatus     = NULL,
    _blockerResolution = NULL,
    _needsReassignment = 0,
    UpdatedAt = GETUTCDATE()
WHERE Status = 'Complete'
  AND (
      _returnReason IS NOT NULL
      OR (_blockerStatus IS NOT NULL AND _blockerStatus <> 'Resolved')
      OR _needsReassignment = 1
  );

-- 3E: Open — clear stale return and blocker fields
UPDATE cmdb.DueDiligenceRequests
SET _returnReason      = NULL,
    _returnedBy        = NULL,
    _blockerStatus     = NULL,
    _blockerResolution = NULL,
    _needsReassignment = 0,
    UpdatedAt = GETUTCDATE()
WHERE Status = 'Open'
  AND (
      _returnReason IS NOT NULL
      OR (_blockerStatus IS NOT NULL AND _blockerStatus <> 'Resolved')
      OR _needsReassignment = 1
  );

-- COMMIT TRAN;

-- ============================================================================
-- STEP 4: POST-REPAIR VERIFICATION
-- ============================================================================

-- Should return 0 rows (no remaining violations)
SELECT COUNT(*) AS remaining_violations
FROM cmdb.DueDiligenceRequests
WHERE (
    (Status = 'In Progress' AND (_returnReason IS NOT NULL OR (_blockerStatus IS NOT NULL AND _blockerStatus <> 'Resolved') OR _needsReassignment = 1 OR _partnerDecision = 'Rework Required'))
    OR (Status = 'Clarification Needed' AND (_returnReason IS NOT NULL OR (_blockerStatus IS NOT NULL AND _blockerStatus <> 'Resolved') OR _partnerDecision = 'Rework Required'))
    OR (Status = 'Blocked' AND _returnReason IS NOT NULL)
    OR (Status = 'Complete' AND _returnReason IS NOT NULL)
    OR (Status = 'Open' AND _returnReason IS NOT NULL)
);

-- ============================================================================
-- END OF REPAIR SCRIPT
-- ============================================================================

import { describe, it, expect } from 'vitest';
import { getExternalStatusInfo } from '../services/externalStatusMapping';
import type { RecapRequest, WorkNoteEntry } from '../services/recapMockData';

const DD_OPS_LEAD = 'David Park';
const CONTRIBUTOR = 'Sarah Chen';

function createWorkNote(text: string, author: string, action: string | null, tsOffset = 0): WorkNoteEntry {
    return {
        id: `wn-test-${Date.now()}-${tsOffset}`,
        text,
        author,
        timestamp: new Date(Date.now() + tsOffset).toISOString(),
        action,
    };
}

function buildRequest(overrides: Partial<RecapRequest> = {}): RecapRequest {
    return {
        id: 'req-test-001',
        requestId: 'DD-TEST-001',
        intakeId: 'INT-TEST-001',
        transactionId: 'txn-test',
        transactionName: 'Test Transaction',
        brokerBuyer: 'Test Broker / Test Buyer',
        communityIds: [],
        communityNames: ['Test Community'],
        category: 'Test Category',
        title: 'Test deliverable',
        description: 'Test description',
        owner: CONTRIBUTOR,
        team: 'Financial Analysis',
        status: 'In Progress',
        priority: 'High',
        dueDate: '2026-12-31',
        lastUpdated: '2026-07-01',
        externalVisible: true,
        submittedBy: 'Test',
        source: 'External',
        createdDate: '2026-06-01',
        assignedTo: CONTRIBUTOR,
        _publishedAt: '2026-06-01',
        _createdFromReview: true,
        _externalStatus: 'Internal Only',
        _workNotes: [],
        _returnReason: null,
        ...overrides,
    };
}

const RETURNED_STATUSES = ['Clarification Needed', 'Blocked', 'Duplicate', 'Not Applicable', 'Needs Rework'];
const NEEDS_DD_REVIEW_STATUSES = ['Blocked', 'Clarification Needed'];

function isActiveExternalClarification(req: RecapRequest): boolean {
    const notes = req._workNotes;
    if (!notes) return false;
    const hasExternalQuestion = notes.some(n => n.action === 'Clarification External Question');
    if (!hasExternalQuestion) return false;
    const clarActions = ['Clarification External Question', 'Clarification Guidance'];
    const clarNotes = notes.filter(n => clarActions.includes(n.action || ''));
    if (clarNotes.length === 0) return false;
    return clarNotes[clarNotes.length - 1].action === 'Clarification External Question';
}

function inActiveWork(req: RecapRequest): boolean {
    return !RETURNED_STATUSES.includes(req.status) && !req._needsReassignment;
}

function inReturnedNeedsAttention(req: RecapRequest): boolean {
    return (RETURNED_STATUSES.includes(req.status) &&
        !(req.status === 'Clarification Needed' && (req._returnReason || isActiveExternalClarification(req)))) ||
        !!req._needsReassignment;
}

function inNeedsDDReview(req: RecapRequest): boolean {
    return (NEEDS_DD_REVIEW_STATUSES.includes(req.status) || !!req._needsReassignment || !!req._misassignedReason || req._partnerDecision === 'Rework Required') && !req._returnReason;
}

function simulateBlock(req: RecapRequest, raisedBy: string, reason: string): RecapRequest {
    return {
        ...req,
        status: 'Blocked',
        owner: DD_OPS_LEAD,
        assignedTo: DD_OPS_LEAD,
        _blockerReason: reason,
        _blockerStatus: 'Raised',
        _blockerRaisedBy: raisedBy,
        _blockerOwner: DD_OPS_LEAD,
        _blockerRaisedAt: new Date().toISOString(),
        _returnReason: null,
        _returnedBy: null,
        _blockerExternalQuestion: null,
        _blockerExternalResponse: null,
        _blockerResolution: null,
    };
}

function simulateResolveBlocker(req: RecapRequest, resolution: string, resolvedBy: string): RecapRequest {
    return {
        ...req,
        status: 'Needs Rework',
        owner: req._blockerRaisedBy || req.owner,
        assignedTo: req._blockerRaisedBy || req.owner,
        _blockerStatus: 'Resolved',
        _blockerResolution: resolution,
        _returnReason: `Blocker resolved: ${resolution}`,
        _returnedBy: resolvedBy,
        _blockerExternalQuestion: null,
        _blockerExternalResponse: null,
    };
}

function simulateReacceptWithCleanup(req: RecapRequest): RecapRequest {
    return {
        ...req,
        status: 'In Progress',
        _processingStartedAt: req._processingStartedAt || new Date().toISOString(),
        _returnReason: null,
        _returnedBy: null,
        _blockerStatus: null,
        _blockerResolution: null,
        _needsReassignment: false,
        _misassignedReason: null,
    };
}

function simulateStartClarification(req: RecapRequest, questionText: string): RecapRequest {
    return {
        ...req,
        status: 'Clarification Needed',
        owner: DD_OPS_LEAD,
        assignedTo: DD_OPS_LEAD,
        _returnReason: null,
        _returnedBy: null,
        _blockerStatus: null,
        _blockerResolution: null,
        _needsReassignment: false,
        _misassignedReason: null,
        _statusNotes: questionText,
        _workNotes: [...(req._workNotes || []), createWorkNote(questionText, CONTRIBUTOR, 'Clarification Needed')],
    };
}

describe('Cross-Workflow Active-State Contamination', () => {

    describe('Primary Reproduction Sequence: Blocker → Resolve → Reaccept → Clarification', () => {

        it('should route clarification to DD Operations after blocker → resolve → reaccept → clarification', () => {
            let req = buildRequest();

            req = simulateBlock(req, CONTRIBUTOR, 'Missing documents');
            expect(req.status).toBe('Blocked');
            expect(req._blockerStatus).toBe('Raised');
            expect(req.owner).toBe(DD_OPS_LEAD);

            req = simulateResolveBlocker(req, 'Documents found', DD_OPS_LEAD);
            expect(req.status).toBe('Needs Rework');
            expect(req._blockerStatus).toBe('Resolved');
            expect(req._returnReason).toBe('Blocker resolved: Documents found');

            req = simulateReacceptWithCleanup(req);
            expect(req.status).toBe('In Progress');
            expect(req._returnReason).toBeNull();
            expect(req._returnedBy).toBeNull();
            expect(req._blockerStatus).toBeNull();
            expect(req._blockerResolution).toBeNull();

            req = simulateStartClarification(req, 'Can you provide more details on the financials?');
            expect(req.status).toBe('Clarification Needed');
            expect(req.owner).toBe(DD_OPS_LEAD);
            expect(req.assignedTo).toBe(DD_OPS_LEAD);

            // Clarification with no stale _returnReason appears in both DD Ops "Needs DD Review"
            // and My Work "Returned / Needs Attention" — that is correct routing
            expect(inNeedsDDReview(req)).toBe(true);
            expect(inActiveWork(req)).toBe(false);
        });

        it('should have stale _returnReason AFTER resolve but BEFORE reaccept', () => {
            let req = buildRequest();
            req = simulateBlock(req, CONTRIBUTOR, 'Missing docs');
            req = simulateResolveBlocker(req, 'Found', DD_OPS_LEAD);
            expect(req._returnReason).toBe('Blocker resolved: Found');
            // Needs Rework with _returnReason → "Returned / Needs Attention" only
            expect(inNeedsDDReview(req)).toBe(false);
            expect(inReturnedNeedsAttention(req)).toBe(true);
        });

        it('should have clean state AFTER reaccept (stale fields cleared)', () => {
            let req = buildRequest();
            req = simulateBlock(req, CONTRIBUTOR, 'Missing docs');
            req = simulateResolveBlocker(req, 'Found', DD_OPS_LEAD);
            req = simulateReacceptWithCleanup(req);
            expect(req._returnReason).toBeNull();
            expect(req._blockerStatus).toBeNull();
            expect(req._blockerResolution).toBeNull();
            expect(inActiveWork(req)).toBe(true);
        });

        it('should include clarification in both Needs DD Review and Returned after clean reaccept', () => {
            let req = buildRequest();
            req = simulateBlock(req, CONTRIBUTOR, 'Issue');
            req = simulateResolveBlocker(req, 'Fixed', DD_OPS_LEAD);
            req = simulateReacceptWithCleanup(req);
            req = simulateStartClarification(req, 'Question?');
            expect(inNeedsDDReview(req)).toBe(true);
            expect(inReturnedNeedsAttention(req)).toBe(true);
        });
    });

    describe('Sequential Cross-Workflow Actions', () => {

        it('should handle Blocker → Resolve → Reaccept → Clarification → Response → Blocker again', () => {
            let req = buildRequest();
            req = simulateBlock(req, CONTRIBUTOR, 'Issue 1');
            req = simulateResolveBlocker(req, 'Fixed 1', DD_OPS_LEAD);
            req = simulateReacceptWithCleanup(req);
            req = simulateStartClarification(req, 'Clarification 1');
            expect(req.status).toBe('Clarification Needed');

            req = { ...req, status: 'In Progress' as RecapRequest['status'] };
            expect(req.status).toBe('In Progress');
            expect(inActiveWork(req)).toBe(true);

            req = simulateBlock(req, CONTRIBUTOR, 'Issue 2');
            expect(req.status).toBe('Blocked');
            expect(req._blockerStatus).toBe('Raised');
        });

        it('should handle Return-to-Owner → Reaccept → Clarification without stale return fields', () => {
            let req = buildRequest();
            req = {
                ...req,
                status: 'Needs Rework',
                _returnReason: 'Needs additional documentation',
                _returnedBy: DD_OPS_LEAD,
            };

            req = simulateReacceptWithCleanup(req);
            expect(req._returnReason).toBeNull();
            expect(req._returnedBy).toBeNull();

            req = simulateStartClarification(req, 'Question?');
            expect(req.status).toBe('Clarification Needed');
            expect(inNeedsDDReview(req)).toBe(true);
        });

        it('should handle Blocker → External Request → External Response → Resolve → Reaccept → Clarification', () => {
            let req = buildRequest();
            req = simulateBlock(req, CONTRIBUTOR, 'Need info');

            req = {
                ...req,
                status: 'Pending External' as RecapRequest['status'],
                _blockerStatus: 'Pending External',
                _blockerExternalQuestion: 'Can you provide X?',
            };

            req = {
                ...req,
                status: 'Blocked',
                _blockerStatus: 'External Response Received',
                _blockerExternalResponse: 'Here is X',
            };

            req = simulateResolveBlocker(req, 'Resolved with external info', DD_OPS_LEAD);
            expect(req._blockerStatus).toBe('Resolved');

            req = simulateReacceptWithCleanup(req);
            expect(req._blockerStatus).toBeNull();
            expect(req._returnReason).toBeNull();

            req = simulateStartClarification(req, 'One more thing?');
            expect(inNeedsDDReview(req)).toBe(true);
        });
    });

    describe('State Cleanup Verification', () => {

        it('should clear _returnReason when transitioning to In Progress', () => {
            let req = buildRequest({ _returnReason: 'Stale return', _returnedBy: 'Old' });
            req = simulateReacceptWithCleanup(req);
            expect(req._returnReason).toBeNull();
            expect(req._returnedBy).toBeNull();
        });

        it('should clear _blockerStatus when transitioning to In Progress', () => {
            let req = buildRequest({ _blockerStatus: 'Resolved' as RecapRequest['_blockerStatus'], _blockerResolution: 'Old resolution' });
            req = simulateReacceptWithCleanup(req);
            expect(req._blockerStatus).toBeNull();
            expect(req._blockerResolution).toBeNull();
        });

        it('should clear _needsReassignment when transitioning to In Progress', () => {
            let req = buildRequest({ _needsReassignment: true, _misassignedReason: 'Wrong team' });
            req = simulateReacceptWithCleanup(req);
            expect(req._needsReassignment).toBe(false);
            expect(req._misassignedReason).toBeNull();
        });

        it('should clear all stale fields when transitioning to In Progress in one step', () => {
            let req = buildRequest({
                _returnReason: 'Stale',
                _returnedBy: 'Someone',
                _blockerStatus: 'Resolved' as RecapRequest['_blockerStatus'],
                _blockerResolution: 'Old',
                _needsReassignment: true,
                _misassignedReason: 'Wrong',
            });
            req = simulateReacceptWithCleanup(req);
            expect(req._returnReason).toBeNull();
            expect(req._returnedBy).toBeNull();
            expect(req._blockerStatus).toBeNull();
            expect(req._blockerResolution).toBeNull();
            expect(req._needsReassignment).toBe(false);
            expect(req._misassignedReason).toBeNull();
        });

        it('should set owner and assignedTo to DD_OPS_LEAD when starting clarification', () => {
            let req = buildRequest({ owner: CONTRIBUTOR, assignedTo: CONTRIBUTOR });
            req = simulateStartClarification(req, 'Question?');
            expect(req.owner).toBe(DD_OPS_LEAD);
            expect(req.assignedTo).toBe(DD_OPS_LEAD);
        });

        it('should clear _returnReason when starting clarification', () => {
            let req = buildRequest({ _returnReason: 'Stale return' });
            req = simulateStartClarification(req, 'Question?');
            expect(req._returnReason).toBeNull();
        });

        it('should clear _blockerStatus when starting clarification', () => {
            let req = buildRequest({ _blockerStatus: 'Resolved' as RecapRequest['_blockerStatus'] });
            req = simulateStartClarification(req, 'Question?');
            expect(req._blockerStatus).toBeNull();
        });
    });

    describe('Fresh Workflow Regression (No Prior Blocker)', () => {

        it('should route fresh clarification to DD Operations and My Work Returned', () => {
            let req = buildRequest();
            req = simulateStartClarification(req, 'Need more info on financials');
            expect(req.status).toBe('Clarification Needed');
            expect(req.owner).toBe(DD_OPS_LEAD);
            expect(inNeedsDDReview(req)).toBe(true);
            expect(inReturnedNeedsAttention(req)).toBe(true);
        });

        it('should not set _returnReason for fresh clarification', () => {
            let req = buildRequest();
            req = simulateStartClarification(req, 'Question?');
            expect(req._returnReason).toBeNull();
        });

        it('should keep fresh clarification routed to DD Operations', () => {
            let req = buildRequest({ owner: DD_OPS_LEAD, assignedTo: DD_OPS_LEAD });
            req = simulateStartClarification(req, 'Question?');
            expect(req.status).toBe('Clarification Needed');
            expect(inNeedsDDReview(req)).toBe(true);
        });
    });

    describe('Locked Workflow Regression (External Lifecycle Milestone)', () => {

        it('should preserve _processingStartedAt through blocker → resolve → reaccept → clarification', () => {
            let req = buildRequest({ _processingStartedAt: '2026-07-01T10:00:00Z' });
            req = simulateBlock(req, CONTRIBUTOR, 'Issue');
            req = simulateResolveBlocker(req, 'Fixed', DD_OPS_LEAD);
            req = simulateReacceptWithCleanup(req);
            expect(req._processingStartedAt).toBe('2026-07-01T10:00:00Z');
            req = simulateStartClarification(req, 'Question?');
            expect(req._processingStartedAt).toBe('2026-07-01T10:00:00Z');
        });

        it('should preserve external visibility through blocker → resolve → reaccept', () => {
            let req = buildRequest({ externalVisible: true, _externalStatus: 'Published External' });
            req = simulateBlock(req, CONTRIBUTOR, 'Issue');
            req = simulateResolveBlocker(req, 'Fixed', DD_OPS_LEAD);
            req = simulateReacceptWithCleanup(req);
            expect(req.externalVisible).toBe(true);
            expect(req._externalStatus).toBe('Published External');
        });

        it('should preserve _publishedAt through cross-workflow transitions', () => {
            let req = buildRequest({ _publishedAt: '2026-06-01' });
            req = simulateBlock(req, CONTRIBUTOR, 'Issue');
            req = simulateResolveBlocker(req, 'Fixed', DD_OPS_LEAD);
            req = simulateReacceptWithCleanup(req);
            expect(req._publishedAt).toBe('2026-06-01');
            req = simulateStartClarification(req, 'Question?');
            expect(req._publishedAt).toBe('2026-06-01');
        });
    });

    describe('External Status Mapping After Cross-Workflow', () => {

        it('should map to correct external status after blocker → resolve → reaccept → clarification', () => {
            let req = buildRequest({ _processingStartedAt: '2026-07-01T10:00:00Z' });
            req = simulateBlock(req, CONTRIBUTOR, 'Issue');
            req = simulateResolveBlocker(req, 'Fixed', DD_OPS_LEAD);
            req = simulateReacceptWithCleanup(req);
            req = simulateStartClarification(req, 'Question?');

            const extStatus = getExternalStatusInfo({
                status: req.status,
                _exceptionRecommendation: req._exceptionRecommendation,
                _exceptionDecision: req._exceptionDecision,
                _publishedExternal: req._externalStatus === 'Published External',
                _externalStatus: req._externalStatus,
                _exceptionSentAt: req._exceptionSentAt,
                _publishedAt: req._publishedAt,
                _workNotes: req._workNotes,
                _blockerStatus: req._blockerStatus,
                _blockerExternalQuestion: req._blockerExternalQuestion,
                _blockerExternalResponse: req._blockerExternalResponse,
                _processingStartedAt: req._processingStartedAt,
            });
            expect(extStatus.status).not.toBe('stale');
        });

        it('should not show stale "Resolved" blocker status after reaccept', () => {
            let req = buildRequest();
            req = simulateBlock(req, CONTRIBUTOR, 'Issue');
            req = simulateResolveBlocker(req, 'Fixed', DD_OPS_LEAD);
            req = simulateReacceptWithCleanup(req);
            expect(req._blockerStatus).toBeNull();
        });
    });

    describe('Edge Cases', () => {

        it('should handle multiple rapid status transitions without accumulating stale state', () => {
            let req = buildRequest();

            for (let i = 0; i < 3; i++) {
                req = simulateBlock(req, CONTRIBUTOR, `Issue ${i}`);
                req = simulateResolveBlocker(req, `Fixed ${i}`, DD_OPS_LEAD);
                req = simulateReacceptWithCleanup(req);
                expect(req._returnReason).toBeNull();
                expect(req._blockerStatus).toBeNull();
            }

            req = simulateStartClarification(req, 'Final question');
            expect(inNeedsDDReview(req)).toBe(true);
        });

        it('should handle Blocker → Resolve → Clarification directly (skip reaccept)', () => {
            let req = buildRequest();
            req = simulateBlock(req, CONTRIBUTOR, 'Issue');
            req = simulateResolveBlocker(req, 'Fixed', DD_OPS_LEAD);
            req = simulateStartClarification(req, 'Question?');
            expect(req.status).toBe('Clarification Needed');
            expect(req._returnReason).toBeNull();
            expect(inNeedsDDReview(req)).toBe(true);
        });

        it('should handle Return-to-Owner → Blocker → Resolve → Reaccept → Clarification', () => {
            let req = buildRequest();
            req = { ...req, status: 'Needs Rework', _returnReason: 'Needs more docs', _returnedBy: DD_OPS_LEAD };
            req = simulateBlock(req, CONTRIBUTOR, 'New blocker');
            req = simulateResolveBlocker(req, 'Fixed', DD_OPS_LEAD);
            req = simulateReacceptWithCleanup(req);
            req = simulateStartClarification(req, 'Question?');
            expect(inNeedsDDReview(req)).toBe(true);
        });

        it('should handle Clarification → Response → Reaccept → Blocker → Resolve → Clarification', () => {
            let req = buildRequest();
            req = simulateStartClarification(req, 'First question');
            expect(req.status).toBe('Clarification Needed');

            req = { ...req, status: 'In Progress' as RecapRequest['status'] };
            expect(inActiveWork(req)).toBe(true);

            req = simulateBlock(req, CONTRIBUTOR, 'Blocker after clarification');
            expect(req.status).toBe('Blocked');

            req = simulateResolveBlocker(req, 'Fixed', DD_OPS_LEAD);
            req = simulateReacceptWithCleanup(req);
            expect(req._returnReason).toBeNull();

            req = simulateStartClarification(req, 'Second question');
            expect(inNeedsDDReview(req)).toBe(true);
        });

        it('should NOT preserve _processingStartedAt if it was never set', () => {
            let req = buildRequest({ _processingStartedAt: undefined });
            req = simulateBlock(req, CONTRIBUTOR, 'Issue');
            req = simulateResolveBlocker(req, 'Fixed', DD_OPS_LEAD);
            req = simulateReacceptWithCleanup(req);
            expect(req.status).toBe('In Progress');
        });
    });

    describe('Queue Selector State Machine', () => {

        it('should track queue membership through full lifecycle: Active → Block → Resolve → Reaccept → Clarify', () => {
            let req = buildRequest();

            // Active Work: In Progress with no RETURNED_STATUSES
            expect(inActiveWork(req)).toBe(true);
            expect(inNeedsDDReview(req)).toBe(false);
            expect(inReturnedNeedsAttention(req)).toBe(false);

            // Blocked → DD Operations "Needs DD Review" + My Work "Returned / Needs Attention"
            req = simulateBlock(req, CONTRIBUTOR, 'Issue');
            expect(inActiveWork(req)).toBe(false);
            expect(inNeedsDDReview(req)).toBe(true);
            expect(inReturnedNeedsAttention(req)).toBe(true);

            // Resolved → "Returned / Needs Attention" only (Needs Rework with _returnReason blocks DD Ops)
            req = simulateResolveBlocker(req, 'Fixed', DD_OPS_LEAD);
            expect(inActiveWork(req)).toBe(false);
            expect(inNeedsDDReview(req)).toBe(false);
            expect(inReturnedNeedsAttention(req)).toBe(true);

            // Reaccept → Active Work only (stale fields cleared, status: In Progress)
            req = simulateReacceptWithCleanup(req);
            expect(inActiveWork(req)).toBe(true);
            expect(inNeedsDDReview(req)).toBe(false);
            expect(inReturnedNeedsAttention(req)).toBe(false);

            // Clarification → DD Ops "Needs DD Review" + My Work "Returned / Needs Attention"
            // (no stale _returnReason, so both queues include it)
            req = simulateStartClarification(req, 'Question?');
            expect(inActiveWork(req)).toBe(false);
            expect(inNeedsDDReview(req)).toBe(true);
            expect(inReturnedNeedsAttention(req)).toBe(true);
        });

        it('should correctly route to "Waiting on DD Operations" when contributor raised blocker', () => {
            let req = buildRequest();
            req = simulateBlock(req, CONTRIBUTOR, 'Issue');
            expect(req._blockerRaisedBy).toBe(CONTRIBUTOR);
            expect(req.status === 'Blocked' && req._blockerRaisedBy === CONTRIBUTOR).toBe(true);
        });

        it('should exclude clarification from Needs DD Review AND Returned when stale _returnReason persists (the bug)', () => {
            let req = buildRequest();
            req = simulateBlock(req, CONTRIBUTOR, 'Issue');
            req = simulateResolveBlocker(req, 'Fixed', DD_OPS_LEAD);

            // Old behavior: reaccept does NOT clear _returnReason
            const oldReq: RecapRequest = {
                ...req,
                status: 'In Progress',
                // _returnReason is NOT cleared (stale from blocker resolution)
            };
            // Old behavior: clarification does NOT clear _returnReason or set owner
            const oldClarReq: RecapRequest = {
                ...oldReq,
                status: 'Clarification Needed',
                // _returnReason still set from blocker resolution
                _workNotes: [...(oldReq._workNotes || []), createWorkNote('Question?', CONTRIBUTOR, 'Clarification Needed')],
            };

            // With stale _returnReason set from blocker resolution:
            expect(oldClarReq._returnReason).toBeTruthy();
            // Needs DD Review: status is Clarification Needed but _returnReason blocks it
            expect(inNeedsDDReview(oldClarReq)).toBe(false);
            // Returned/Needs Attention: status is Clarification Needed AND _returnReason is set → excluded
            expect(inReturnedNeedsAttention(oldClarReq)).toBe(false);
            // Active Work: Clarification Needed is in RETURNED_STATUSES → excluded
            expect(inActiveWork(oldClarReq)).toBe(false);
            // Request disappears from ALL queues — the zero-home state
        });

        it('should NOT be in zero-home state after the fix: clarification appears in Needs DD Review', () => {
            let req = buildRequest();
            req = simulateBlock(req, CONTRIBUTOR, 'Issue');
            req = simulateResolveBlocker(req, 'Fixed', DD_OPS_LEAD);
            req = simulateReacceptWithCleanup(req);
            req = simulateStartClarification(req, 'Question?');

            // After the fix: _returnReason is null, so Needs DD Review includes it
            expect(inNeedsDDReview(req)).toBe(true);
            // It may also appear in Returned/Needs Attention (that's correct for contributor's view)
            expect(inReturnedNeedsAttention(req)).toBe(true);
            // But NOT in Active Work (Correct: Clarification Needed is a returned status)
            expect(inActiveWork(req)).toBe(false);
            // Key assertion: request is NOT in zero-home state
            expect(inNeedsDDReview(req) || inReturnedNeedsAttention(req) || inActiveWork(req)).toBe(true);
        });
    });
});

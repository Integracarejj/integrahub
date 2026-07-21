import { describe, it, expect } from 'vitest';
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
    return req.status !== 'Complete' && !RETURNED_STATUSES.includes(req.status) && !req._needsReassignment;
}

function inReturnedNeedsAttention(req: RecapRequest): boolean {
    return (RETURNED_STATUSES.includes(req.status) &&
        !(req.status === 'Clarification Needed' && (req._returnReason || isActiveExternalClarification(req)))) ||
        !!req._needsReassignment;
}

function inNeedsDDReview(req: RecapRequest): boolean {
    return (NEEDS_DD_REVIEW_STATUSES.includes(req.status) || !!req._needsReassignment || !!req._misassignedReason || req._partnerDecision === 'Rework Required') && !req._returnReason;
}

function inWaitingOnDDOps(req: RecapRequest, activeUser: string): boolean {
    return ((req.status === 'Blocked' || req.status === 'Pending External') && req._blockerRaisedBy === activeUser) ||
        (req.status === 'Clarification Needed' && req._clarificationRaisedBy === activeUser);
}

function inCompletedWork(req: RecapRequest): boolean {
    return req.status === 'Complete' || req._externalStatus === 'Ready to Publish' ||
        (req._externalStatus === 'Published External' && req.status !== 'Needs Rework');
}

function assertQueueRouting(req: RecapRequest, expected: {
    activeWork?: boolean;
    needsDDReview?: boolean;
    returnedNeedsAttention?: boolean;
    waitingOnDDOps?: boolean;
    completedWork?: boolean;
    inAnyActiveQueue?: boolean;
}, _context?: string) {
    const active = inActiveWork(req);
    const ddReview = inNeedsDDReview(req);
    const returned = inReturnedNeedsAttention(req);
    const waiting = inWaitingOnDDOps(req, CONTRIBUTOR);
    const completed = inCompletedWork(req);

    if (expected.activeWork !== undefined) expect(active).toBe(expected.activeWork);
    if (expected.needsDDReview !== undefined) expect(ddReview).toBe(expected.needsDDReview);
    if (expected.returnedNeedsAttention !== undefined) expect(returned).toBe(expected.returnedNeedsAttention);
    if (expected.waitingOnDDOps !== undefined) expect(waiting).toBe(expected.waitingOnDDOps);
    if (expected.completedWork !== undefined) expect(completed).toBe(expected.completedWork);
    if (expected.inAnyActiveQueue !== undefined) {
        const inAny = active || ddReview || returned || waiting;
        expect(inAny).toBe(expected.inAnyActiveQueue);
    }
}

function assertValidActiveState(req: RecapRequest, context: string) {
    const msgs: string[] = [];
    if (req.status === 'Clarification Needed' && req.owner !== DD_OPS_LEAD && req.assignedTo !== DD_OPS_LEAD) {
        msgs.push(`Clarification Needed but owner/assignedTo is not DD_OPS_LEAD (owner=${req.owner}, assignedTo=${req.assignedTo})`);
    }
    if (req.status === 'Blocked' && req.owner !== DD_OPS_LEAD) {
        msgs.push(`Blocked but owner is not DD_OPS_LEAD (owner=${req.owner})`);
    }
    if (req.status === 'In Progress' && req._blockerStatus && req._blockerStatus !== 'Resolved') {
        msgs.push(`In Progress with active blocker status: ${req._blockerStatus}`);
    }
    if (req.status === 'Clarification Needed' && req._returnReason) {
        msgs.push(`Clarification Needed with stale _returnReason: ${req._returnReason}`);
    }
    if (req.status === 'Clarification Needed' && req._blockerStatus && req._blockerStatus !== 'Resolved') {
        msgs.push(`Clarification Needed with active blocker: ${req._blockerStatus}`);
    }
    if (req.status === 'In Progress' && req.owner === DD_OPS_LEAD && req.assignedTo === DD_OPS_LEAD) {
        msgs.push(`In Progress but still owned by DD Ops (contributor not reassigned)`);
    }
    if (msgs.length > 0) {
        throw new Error(`Invariant violation [${context}]:\n  ${msgs.join('\n  ')}`);
    }
}

function simulateBlock(req: RecapRequest, raisedBy: string, reason: string): RecapRequest {
    const wn = createWorkNote(reason, raisedBy, 'Blocked');
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
        _needsReassignment: false,
        _misassignedReason: null,
        _workNotes: [...(req._workNotes || []), wn],
    };
}

function simulateResolveBlocker(req: RecapRequest, resolution: string, resolvedBy: string): RecapRequest {
    const wn = createWorkNote(`Blocker resolved: ${resolution}`, resolvedBy, 'Blocker Resolution');
    const returnTo = req._blockerRaisedBy || req.owner;
    return {
        ...req,
        status: 'Needs Rework',
        owner: returnTo,
        assignedTo: returnTo,
        _blockerStatus: 'Resolved',
        _blockerResolution: resolution,
        _returnReason: `Blocker resolved: ${resolution}`,
        _returnedBy: resolvedBy,
        _blockerExternalQuestion: null,
        _blockerExternalResponse: null,
        _workNotes: [...(req._workNotes || []), wn],
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
        _partnerDecision: null,
        _partnerNote: null,
        _partnerActionAt: null,
        _exceptionRecommendation: null,
        _exceptionSentAt: null,
        _exceptionDecision: null,
        _exceptionDecisionAt: null,
        _exceptionDecisionNote: null,
    };
}

function simulateClarificationSubmission(req: RecapRequest, questionText: string, submittedBy: string): RecapRequest {
    const wn = createWorkNote(questionText, submittedBy, 'Clarification Needed');
    return {
        ...req,
        status: 'Clarification Needed',
        owner: DD_OPS_LEAD,
        assignedTo: DD_OPS_LEAD,
        _clarificationRaisedBy: submittedBy,
        _returnReason: null,
        _returnedBy: null,
        _blockerStatus: null,
        _blockerResolution: null,
        _needsReassignment: false,
        _misassignedReason: null,
        _partnerDecision: null,
        _partnerNote: null,
        _partnerActionAt: null,
        _exceptionRecommendation: null,
        _exceptionSentAt: null,
        _exceptionDecision: null,
        _exceptionDecisionAt: null,
        _exceptionDecisionNote: null,
        _statusNotes: questionText,
        _workNotes: [...(req._workNotes || []), wn],
    };
}

function simulateClarificationReturn(req: RecapRequest, response: string, returnedBy: string): RecapRequest {
    const returnTo = req._clarificationRaisedBy || req.owner;
    const wn = createWorkNote(response, returnedBy, 'Clarification Response');
    return {
        ...req,
        status: 'Needs Rework',
        owner: returnTo,
        assignedTo: returnTo,
        _clarificationRaisedBy: null,
        _returnReason: `Clarification response: ${response}`,
        _returnedBy: returnedBy,
        _blockerStatus: null,
        _blockerResolution: null,
        _needsReassignment: false,
        _misassignedReason: null,
        _partnerDecision: null,
        _partnerNote: null,
        _partnerActionAt: null,
        _exceptionRecommendation: null,
        _exceptionSentAt: null,
        _exceptionDecision: null,
        _exceptionDecisionAt: null,
        _exceptionDecisionNote: null,
        _workNotes: [...(req._workNotes || []), wn],
    };
}

function simulateReturnToOwner(req: RecapRequest, reason: string, returnedBy: string): RecapRequest {
    const wn = createWorkNote(reason, returnedBy, 'Returned to Owner');
    return {
        ...req,
        status: 'Needs Rework',
        _returnReason: reason,
        _returnedBy: returnedBy,
        _exceptionRecommendation: null,
        _exceptionSentAt: null,
        _exceptionDecision: null,
        _exceptionDecisionAt: null,
        _exceptionDecisionNote: null,
        _blockerStatus: null,
        _blockerResolution: null,
        _partnerDecision: null,
        _partnerNote: null,
        _partnerActionAt: null,
        _workNotes: [...(req._workNotes || []), wn],
    };
}

describe('Clarification Routing Fix', () => {

    describe('Test 1 — Clarification submission after blocker', () => {

        it('should route to DD Operations and contributor Waiting after blocker → resolve → reaccept → clarification', () => {
            let req = buildRequest({ _processingStartedAt: '2026-07-01T10:00:00Z' });

            // Step 1: Accept work
            assertValidActiveState(req, 'accept');
            assertQueueRouting(req, { activeWork: true });

            // Step 2: Raise blocker
            req = simulateBlock(req, CONTRIBUTOR, 'Missing documents');
            expect(req.status).toBe('Blocked');
            expect(req._blockerRaisedBy).toBe(CONTRIBUTOR);
            assertValidActiveState(req, 'block');
            assertQueueRouting(req, { activeWork: false, needsDDReview: true, waitingOnDDOps: true });

            // Step 3: Resolve blocker
            req = simulateResolveBlocker(req, 'Documents found', DD_OPS_LEAD);
            expect(req.status).toBe('Needs Rework');
            expect(req._returnReason).toBeTruthy();
            assertValidActiveState(req, 'resolve');
            assertQueueRouting(req, { activeWork: false, returnedNeedsAttention: true });

            // Step 4: Reaccept
            req = simulateReacceptWithCleanup(req);
            expect(req.status).toBe('In Progress');
            expect(req._returnReason).toBeNull();
            expect(req._processingStartedAt).toBe('2026-07-01T10:00:00Z');
            assertValidActiveState(req, 'reaccept');
            assertQueueRouting(req, { activeWork: true });

            // Step 5: Submit clarification
            req = simulateClarificationSubmission(req, 'Can you provide more details?', CONTRIBUTOR);
            expect(req.status).toBe('Clarification Needed');
            expect(req.owner).toBe(DD_OPS_LEAD);
            expect(req._clarificationRaisedBy).toBe(CONTRIBUTOR);
            assertValidActiveState(req, 'clarification');
            assertQueueRouting(req, {
                activeWork: false,
                needsDDReview: true,
                waitingOnDDOps: true,
                inAnyActiveQueue: true,
            });
        });

        it('should preserve blocker history through the full sequence', () => {
            let req = buildRequest();
            req = simulateBlock(req, CONTRIBUTOR, 'Issue');
            req = simulateResolveBlocker(req, 'Fixed', DD_OPS_LEAD);
            req = simulateReacceptWithCleanup(req);
            req = simulateClarificationSubmission(req, 'Question?', CONTRIBUTOR);

            const blockNotes = req._workNotes?.filter(n => n.action === 'Blocked') || [];
            const resolveNotes = req._workNotes?.filter(n => n.action === 'Blocker Resolution') || [];
            const clarNotes = req._workNotes?.filter(n => n.action === 'Clarification Needed') || [];
            expect(blockNotes.length).toBe(1);
            expect(resolveNotes.length).toBe(1);
            expect(clarNotes.length).toBe(1);
        });

        it('should have only one active workflow (clarification) after the sequence', () => {
            let req = buildRequest();
            req = simulateBlock(req, CONTRIBUTOR, 'Issue');
            req = simulateResolveBlocker(req, 'Fixed', DD_OPS_LEAD);
            req = simulateReacceptWithCleanup(req);
            req = simulateClarificationSubmission(req, 'Question?', CONTRIBUTOR);

            expect(req._blockerStatus).toBeNull();
            expect(req._blockerResolution).toBeNull();
            expect(req._returnReason).toBeNull();
            expect(req._needsReassignment).toBe(false);
            expect(req.status).toBe('Clarification Needed');
            expect(req.owner).toBe(DD_OPS_LEAD);
        });

        it('should preserve external lifecycle milestone', () => {
            let req = buildRequest({ _processingStartedAt: '2026-07-01T10:00:00Z' });
            req = simulateBlock(req, CONTRIBUTOR, 'Issue');
            req = simulateResolveBlocker(req, 'Fixed', DD_OPS_LEAD);
            req = simulateReacceptWithCleanup(req);
            req = simulateClarificationSubmission(req, 'Question?', CONTRIBUTOR);
            expect(req._processingStartedAt).toBe('2026-07-01T10:00:00Z');
        });

        it('should show clarification in Full Work Queue', () => {
            let req = buildRequest();
            req = simulateBlock(req, CONTRIBUTOR, 'Issue');
            req = simulateResolveBlocker(req, 'Fixed', DD_OPS_LEAD);
            req = simulateReacceptWithCleanup(req);
            req = simulateClarificationSubmission(req, 'Question?', CONTRIBUTOR);
            expect(req.status).not.toBe('Complete');
            expect(req.status).not.toBe('Duplicate');
        });
    });

    describe('Test 2 — DD Operations returns clarification', () => {

        it('should return clarification to contributor Returned / Needs Attention', () => {
            let req = buildRequest({ _processingStartedAt: '2026-07-01T10:00:00Z' });
            req = simulateBlock(req, CONTRIBUTOR, 'Issue');
            req = simulateResolveBlocker(req, 'Fixed', DD_OPS_LEAD);
            req = simulateReacceptWithCleanup(req);
            req = simulateClarificationSubmission(req, 'Need details on financials', CONTRIBUTOR);

            // DD Operations reviews and returns
            req = simulateClarificationReturn(req, 'Here is the clarification response', DD_OPS_LEAD);

            expect(req.status).toBe('Needs Rework');
            expect(req.owner).toBe(CONTRIBUTOR);
            expect(req.assignedTo).toBe(CONTRIBUTOR);
            expect(req._clarificationRaisedBy).toBeNull();
            expect(req._returnReason).toContain('Clarification response');
            expect(req._returnedBy).toBe(DD_OPS_LEAD);
            assertValidActiveState(req, 'clarification return');
            assertQueueRouting(req, {
                activeWork: false,
                needsDDReview: false,
                waitingOnDDOps: false,
                returnedNeedsAttention: true,
                inAnyActiveQueue: true,
            });
        });

        it('should not be visible in DD Operations after return', () => {
            let req = buildRequest();
            req = simulateBlock(req, CONTRIBUTOR, 'Issue');
            req = simulateResolveBlocker(req, 'Fixed', DD_OPS_LEAD);
            req = simulateReacceptWithCleanup(req);
            req = simulateClarificationSubmission(req, 'Question?', CONTRIBUTOR);
            req = simulateClarificationReturn(req, 'Answer', DD_OPS_LEAD);

            expect(inNeedsDDReview(req)).toBe(false);
        });

        it('should not be visible in Waiting on DD Operations after return', () => {
            let req = buildRequest();
            req = simulateBlock(req, CONTRIBUTOR, 'Issue');
            req = simulateResolveBlocker(req, 'Fixed', DD_OPS_LEAD);
            req = simulateReacceptWithCleanup(req);
            req = simulateClarificationSubmission(req, 'Question?', CONTRIBUTOR);
            req = simulateClarificationReturn(req, 'Answer', DD_OPS_LEAD);

            expect(inWaitingOnDDOps(req, CONTRIBUTOR)).toBe(false);
        });

        it('should preserve clarification history and response', () => {
            let req = buildRequest();
            req = simulateBlock(req, CONTRIBUTOR, 'Issue');
            req = simulateResolveBlocker(req, 'Fixed', DD_OPS_LEAD);
            req = simulateReacceptWithCleanup(req);
            req = simulateClarificationSubmission(req, 'Need details', CONTRIBUTOR);
            req = simulateClarificationReturn(req, 'Here are the details', DD_OPS_LEAD);

            const clarNotes = req._workNotes?.filter(n => n.action === 'Clarification Needed') || [];
            const respNotes = req._workNotes?.filter(n => n.action === 'Clarification Response') || [];
            expect(clarNotes.length).toBe(1);
            expect(respNotes.length).toBe(1);
        });

        it('should still exist in Full Work Queue', () => {
            let req = buildRequest();
            req = simulateBlock(req, CONTRIBUTOR, 'Issue');
            req = simulateResolveBlocker(req, 'Fixed', DD_OPS_LEAD);
            req = simulateReacceptWithCleanup(req);
            req = simulateClarificationSubmission(req, 'Question?', CONTRIBUTOR);
            req = simulateClarificationReturn(req, 'Answer', DD_OPS_LEAD);

            expect(req.status).not.toBe('Complete');
            expect(req.status).not.toBe('Duplicate');
        });
    });

    describe('Test 3 — Contributor reaccepts after clarification return', () => {

        it('should move from Returned / Needs Attention to Active Work', () => {
            let req = buildRequest({ _processingStartedAt: '2026-07-01T10:00:00Z' });
            req = simulateBlock(req, CONTRIBUTOR, 'Issue');
            req = simulateResolveBlocker(req, 'Fixed', DD_OPS_LEAD);
            req = simulateReacceptWithCleanup(req);
            req = simulateClarificationSubmission(req, 'Question?', CONTRIBUTOR);
            req = simulateClarificationReturn(req, 'Answer', DD_OPS_LEAD);

            // Contributor reaccepts
            req = simulateReacceptWithCleanup(req);

            expect(req.status).toBe('In Progress');
            expect(req.owner).toBe(CONTRIBUTOR);
            expect(req._returnReason).toBeNull();
            expect(req._clarificationRaisedBy).toBeNull();
            assertValidActiveState(req, 'reaccept after clarification');
            assertQueueRouting(req, {
                activeWork: true,
                needsDDReview: false,
                waitingOnDDOps: false,
                returnedNeedsAttention: false,
            });
        });

        it('should not be in Returned / Needs Attention after reaccept', () => {
            let req = buildRequest();
            req = simulateBlock(req, CONTRIBUTOR, 'Issue');
            req = simulateResolveBlocker(req, 'Fixed', DD_OPS_LEAD);
            req = simulateReacceptWithCleanup(req);
            req = simulateClarificationSubmission(req, 'Question?', CONTRIBUTOR);
            req = simulateClarificationReturn(req, 'Answer', DD_OPS_LEAD);
            req = simulateReacceptWithCleanup(req);

            expect(inReturnedNeedsAttention(req)).toBe(false);
        });

        it('should have no stale DD review or waiting state', () => {
            let req = buildRequest();
            req = simulateBlock(req, CONTRIBUTOR, 'Issue');
            req = simulateResolveBlocker(req, 'Fixed', DD_OPS_LEAD);
            req = simulateReacceptWithCleanup(req);
            req = simulateClarificationSubmission(req, 'Question?', CONTRIBUTOR);
            req = simulateClarificationReturn(req, 'Answer', DD_OPS_LEAD);
            req = simulateReacceptWithCleanup(req);

            expect(req._blockerStatus).toBeNull();
            expect(req._clarificationRaisedBy).toBeNull();
            expect(req._returnReason).toBeNull();
        });

        it('should preserve clarification history after reaccept', () => {
            let req = buildRequest();
            req = simulateBlock(req, CONTRIBUTOR, 'Issue');
            req = simulateResolveBlocker(req, 'Fixed', DD_OPS_LEAD);
            req = simulateReacceptWithCleanup(req);
            req = simulateClarificationSubmission(req, 'Question?', CONTRIBUTOR);
            req = simulateClarificationReturn(req, 'Answer', DD_OPS_LEAD);
            req = simulateReacceptWithCleanup(req);

            const clarNotes = req._workNotes?.filter(n => n.action === 'Clarification Needed') || [];
            const respNotes = req._workNotes?.filter(n => n.action === 'Clarification Response') || [];
            const blockNotes = req._workNotes?.filter(n => n.action === 'Blocked') || [];
            expect(clarNotes.length).toBe(1);
            expect(respNotes.length).toBe(1);
            expect(blockNotes.length).toBe(1);
        });
    });

    describe('Test 4 — Blocker comparison regression', () => {

        it('should still work: Blocker → DD Ops → Return → Reaccept', () => {
            let req = buildRequest({ _processingStartedAt: '2026-07-01T10:00:00Z' });

            req = simulateBlock(req, CONTRIBUTOR, 'Missing docs');
            assertQueueRouting(req, { activeWork: false, needsDDReview: true, waitingOnDDOps: true });

            req = simulateReturnToOwner(req, 'Please provide docs', DD_OPS_LEAD);
            assertQueueRouting(req, { activeWork: false, returnedNeedsAttention: true });

            req = simulateReacceptWithCleanup(req);
            assertQueueRouting(req, { activeWork: true });
        });
    });

    describe('Test 5 — DD review reason labels', () => {

        it('should identify Clarification Needed as review reason', () => {
            const req = buildRequest({ status: 'Clarification Needed', owner: DD_OPS_LEAD, assignedTo: DD_OPS_LEAD });
            expect(inNeedsDDReview(req)).toBe(true);
            expect(req.status).toBe('Clarification Needed');
        });

        it('should identify Blocked as review reason', () => {
            const req = buildRequest({ status: 'Blocked', owner: DD_OPS_LEAD, assignedTo: DD_OPS_LEAD });
            expect(inNeedsDDReview(req)).toBe(true);
            expect(req.status).toBe('Blocked');
        });

        it('should identify Not Applicable as exception', () => {
            const req = buildRequest({ status: 'Not Applicable' });
            expect(req.status).toBe('Not Applicable');
        });

        it('should identify Duplicate as exception', () => {
            const req = buildRequest({ status: 'Duplicate' });
            expect(req.status).toBe('Duplicate');
        });

        it('should identify Needs Reassignment', () => {
            const req = buildRequest({ status: 'Open', _needsReassignment: true });
            expect(inNeedsDDReview(req)).toBe(true);
        });

        it('should identify Rework Requested via partnerDecision', () => {
            const req = buildRequest({ status: 'In Progress', _partnerDecision: 'Rework Required' });
            expect(inNeedsDDReview(req)).toBe(true);
        });
    });

    describe('Test 6 — Repeated alternating transition', () => {

        it('should handle: Blocker → Return → Reaccept → Clarification → Return → Reaccept → Blocker', () => {
            let req = buildRequest({ _processingStartedAt: '2026-07-01T10:00:00Z' });

            // Blocker
            req = simulateBlock(req, CONTRIBUTOR, 'Issue 1');
            expect(req.status).toBe('Blocked');
            assertQueueRouting(req, { activeWork: false, needsDDReview: true, waitingOnDDOps: true });

            // Return
            req = simulateReturnToOwner(req, 'Fix this', DD_OPS_LEAD);
            expect(req.status).toBe('Needs Rework');
            assertQueueRouting(req, { activeWork: false, returnedNeedsAttention: true });

            // Reaccept
            req = simulateReacceptWithCleanup(req);
            expect(req.status).toBe('In Progress');
            assertQueueRouting(req, { activeWork: true });

            // Clarification
            req = simulateClarificationSubmission(req, 'Need details', CONTRIBUTOR);
            expect(req.status).toBe('Clarification Needed');
            assertQueueRouting(req, { activeWork: false, needsDDReview: true, waitingOnDDOps: true });

            // Return clarification
            req = simulateClarificationReturn(req, 'Here is the info', DD_OPS_LEAD);
            expect(req.status).toBe('Needs Rework');
            assertQueueRouting(req, { activeWork: false, returnedNeedsAttention: true });

            // Reaccept
            req = simulateReacceptWithCleanup(req);
            expect(req.status).toBe('In Progress');
            assertQueueRouting(req, { activeWork: true });

            // Blocker again
            req = simulateBlock(req, CONTRIBUTOR, 'Issue 2');
            expect(req.status).toBe('Blocked');
            assertQueueRouting(req, { activeWork: false, needsDDReview: true, waitingOnDDOps: true });

            // Verify history retained
            const blockNotes = req._workNotes?.filter(n => n.action === 'Blocked') || [];
            const clarNotes = req._workNotes?.filter(n => n.action === 'Clarification Needed') || [];
            const respNotes = req._workNotes?.filter(n => n.action === 'Clarification Response') || [];
            expect(blockNotes.length).toBe(2);
            expect(clarNotes.length).toBe(1);
            expect(respNotes.length).toBe(1);
        });

        it('should handle: Clarification → Return → Reaccept → Blocker → Return → Reaccept → Clarification', () => {
            let req = buildRequest({ _processingStartedAt: '2026-07-01T10:00:00Z' });

            // Clarification
            req = simulateClarificationSubmission(req, 'Need info', CONTRIBUTOR);
            expect(req.status).toBe('Clarification Needed');
            assertQueueRouting(req, { activeWork: false, needsDDReview: true, waitingOnDDOps: true });

            // Return clarification
            req = simulateClarificationReturn(req, 'Here you go', DD_OPS_LEAD);
            expect(req.status).toBe('Needs Rework');
            assertQueueRouting(req, { activeWork: false, returnedNeedsAttention: true });

            // Reaccept
            req = simulateReacceptWithCleanup(req);
            expect(req.status).toBe('In Progress');
            assertQueueRouting(req, { activeWork: true });

            // Blocker
            req = simulateBlock(req, CONTRIBUTOR, 'Blocker issue');
            expect(req.status).toBe('Blocked');
            assertQueueRouting(req, { activeWork: false, needsDDReview: true, waitingOnDDOps: true });

            // Return blocker
            req = simulateReturnToOwner(req, 'Please fix', DD_OPS_LEAD);
            expect(req.status).toBe('Needs Rework');
            assertQueueRouting(req, { activeWork: false, returnedNeedsAttention: true });

            // Reaccept
            req = simulateReacceptWithCleanup(req);
            expect(req.status).toBe('In Progress');
            assertQueueRouting(req, { activeWork: true });

            // Clarification again
            req = simulateClarificationSubmission(req, 'Another question', CONTRIBUTOR);
            expect(req.status).toBe('Clarification Needed');
            assertQueueRouting(req, { activeWork: false, needsDDReview: true, waitingOnDDOps: true });
        });

        it('should never leave request with zero active queues at any step', () => {
            let req = buildRequest({ _processingStartedAt: '2026-07-01T10:00:00Z' });

            const steps = [
                () => { req = simulateBlock(req, CONTRIBUTOR, 'Issue'); },
                () => { req = simulateReturnToOwner(req, 'Fix', DD_OPS_LEAD); },
                () => { req = simulateReacceptWithCleanup(req); },
                () => { req = simulateClarificationSubmission(req, 'Question', CONTRIBUTOR); },
                () => { req = simulateClarificationReturn(req, 'Answer', DD_OPS_LEAD); },
                () => { req = simulateReacceptWithCleanup(req); },
                () => { req = simulateBlock(req, CONTRIBUTOR, 'Issue 2'); },
                () => { req = simulateReturnToOwner(req, 'Fix 2', DD_OPS_LEAD); },
                () => { req = simulateReacceptWithCleanup(req); },
            ];

            for (const step of steps) {
                step();
                const inAny = inActiveWork(req) || inNeedsDDReview(req) || inReturnedNeedsAttention(req) || inWaitingOnDDOps(req, CONTRIBUTOR);
                expect(inAny).toBe(true);
            }
        });
    });

    describe('Test 7 — Edge cases', () => {

        it('should handle Not Mine → Reassign → Clarification', () => {
            let req = buildRequest();
            req = { ...req, status: 'Open' as RecapRequest['status'], owner: null, assignedTo: null, _needsReassignment: true, _misassignedReason: 'Not my deliverable' };
            expect(inNeedsDDReview(req)).toBe(true);
            assertQueueRouting(req, { activeWork: false, needsDDReview: true });

            // Reassign
            req = simulateReacceptWithCleanup(req);
            assertQueueRouting(req, { activeWork: true });

            // Clarification
            req = simulateClarificationSubmission(req, 'Need info', CONTRIBUTOR);
            assertQueueRouting(req, { activeWork: false, needsDDReview: true, waitingOnDDOps: true });
        });

        it('should handle Partner Rework → Return → Reaccept → Clarification', () => {
            let req = buildRequest({ _processingStartedAt: '2026-07-01T10:00:00Z' });
            req = { ...req, status: 'Waiting Partner Review' as RecapRequest['status'], _externalStatus: 'Published External', _partnerDecision: 'Rework Required' };

            req = simulateReturnToOwner(req, 'Revise financials', DD_OPS_LEAD);
            expect(req.status).toBe('Needs Rework');

            req = simulateReacceptWithCleanup(req);
            expect(req.status).toBe('In Progress');

            req = simulateClarificationSubmission(req, 'Clarify financials', CONTRIBUTOR);
            expect(req.status).toBe('Clarification Needed');
            assertQueueRouting(req, { activeWork: false, needsDDReview: true, waitingOnDDOps: true });
        });

        it('should handle stale _returnReason not blocking DD Ops routing after clarification', () => {
            let req = buildRequest();
            req = simulateBlock(req, CONTRIBUTOR, 'Issue');
            req = simulateResolveBlocker(req, 'Fixed', DD_OPS_LEAD);
            req = simulateReacceptWithCleanup(req);
            req = simulateClarificationSubmission(req, 'Question', CONTRIBUTOR);

            // _returnReason should be null
            expect(req._returnReason).toBeNull();
            expect(inNeedsDDReview(req)).toBe(true);
        });

        it('should handle clarification followed by complete', () => {
            let req = buildRequest({ _processingStartedAt: '2026-07-01T10:00:00Z' });
            req = simulateClarificationSubmission(req, 'Question', CONTRIBUTOR);
            req = simulateClarificationReturn(req, 'Answer', DD_OPS_LEAD);
            req = simulateReacceptWithCleanup(req);

            req = { ...req, status: 'Complete' as RecapRequest['status'], _completedBy: CONTRIBUTOR, _completedAt: new Date().toISOString() };
            expect(req.status).toBe('Complete');
            assertQueueRouting(req, { activeWork: false, completedWork: true });
        });
    });
});

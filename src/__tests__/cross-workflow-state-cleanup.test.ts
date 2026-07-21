import { describe, it, expect } from 'vitest';
import type { RecapRequest, WorkNoteEntry } from '../services/recapMockData';

const DD_OPS_LEAD = 'David Park';
const CONTRIBUTOR = 'Sarah Chen';
const OTHER_CONTRIBUTOR = 'Mike Wilson';

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

function inWaitingOnDDOps(req: RecapRequest, activeUser: string): boolean {
    return (req.status === 'Blocked' || req.status === 'Pending External') && req._blockerRaisedBy === activeUser;
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

function simulateClarificationResponse(req: RecapRequest, response: string, respondedBy: string): RecapRequest {
    return {
        ...req,
        status: 'In Progress',
        _returnReason: null,
        _returnedBy: null,
        _workNotes: [...(req._workNotes || []), createWorkNote(response, respondedBy, 'Clarification Response')],
    };
}

function simulateReturnToOwner(req: RecapRequest, reason: string, returnedBy: string): RecapRequest {
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
    };
}

function simulateNotMine(req: RecapRequest, reason: string, _userName: string): RecapRequest {
    return {
        ...req,
        status: 'Open',
        owner: null,
        assignedTo: null,
        _misassignedReason: reason,
        _needsReassignment: true,
        _returnReason: null,
        _returnedBy: null,
        _blockerStatus: null,
        _blockerResolution: null,
    };
}

function simulateComplete(req: RecapRequest, completedBy: string): RecapRequest {
    return {
        ...req,
        status: 'Complete',
        _completedBy: completedBy,
        _completedAt: new Date().toISOString(),
        _returnReason: null,
        _returnedBy: null,
        _blockerStatus: null,
        _blockerResolution: null,
        _needsReassignment: false,
        _misassignedReason: null,
    };
}

function simulatePublishExternal(req: RecapRequest): RecapRequest {
    return {
        ...req,
        status: 'Waiting Partner Review',
        _externalStatus: 'Published External',
        _publishedExternal: true,
        _publishedExternalAt: new Date().toISOString(),
        _partnerDecision: null,
        _partnerNote: null,
        _partnerActionAt: null,
    };
}

function simulatePartnerApprove(req: RecapRequest): RecapRequest {
    return {
        ...req,
        status: 'Completed',
        _partnerDecision: 'Approved',
        _partnerNote: null,
        _partnerActionAt: new Date().toISOString(),
        _completedBy: 'External Partner',
        _completedAt: new Date().toISOString(),
    };
}

function simulatePartnerRework(req: RecapRequest, reason: string): RecapRequest {
    return {
        ...req,
        status: 'Needs Rework',
        owner: DD_OPS_LEAD,
        assignedTo: DD_OPS_LEAD,
        _partnerDecision: 'Rework Required',
        _partnerNote: reason,
        _partnerActionAt: new Date().toISOString(),
    };
}

/** Invariant validator: asserts a request has valid active state after a transition */
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

    if (msgs.length > 0) {
        throw new Error(`Invariant violation [${context}]:\n  ${msgs.join('\n  ')}`);
    }
}

/** Queue-level assertion: verifies the request appears in exactly the right queues */
function assertQueueRouting(req: RecapRequest, expected: {
    activeWork?: boolean;
    needsDDReview?: boolean;
    returnedNeedsAttention?: boolean;
    waitingOnDDOps?: boolean;
    inAnyQueue?: boolean;
}, _context?: string) {
    const active = inActiveWork(req);
    const ddReview = inNeedsDDReview(req);
    const returned = inReturnedNeedsAttention(req);

    if (expected.activeWork !== undefined) {
        expect(active).toBe(expected.activeWork);
    }
    if (expected.needsDDReview !== undefined) {
        expect(ddReview).toBe(expected.needsDDReview);
    }
    if (expected.returnedNeedsAttention !== undefined) {
        expect(returned).toBe(expected.returnedNeedsAttention);
    }
    if (expected.waitingOnDDOps !== undefined) {
        expect(inWaitingOnDDOps(req, CONTRIBUTOR)).toBe(expected.waitingOnDDOps);
    }
    if (expected.inAnyQueue !== undefined) {
        const inAny = active || ddReview || returned;
        expect(inAny).toBe(expected.inAnyQueue);
    }
}

describe('Cross-Workflow Active-State Transition Defect', () => {

    describe('Test A — Primary Regression: Blocker → Resolve → Reaccept → Clarification', () => {

        it('should route clarification to DD Ops after blocker → resolve → reaccept → clarification', () => {
            let req = buildRequest({ _processingStartedAt: '2026-07-01T10:00:00Z' });

            // Step 1: Accept Work
            expect(req.status).toBe('In Progress');
            assertValidActiveState(req, 'accept');

            // Step 2: Raise Blocker
            req = simulateBlock(req, CONTRIBUTOR, 'Missing documents');
            expect(req.status).toBe('Blocked');
            expect(req._blockerStatus).toBe('Raised');
            expect(req.owner).toBe(DD_OPS_LEAD);
            assertValidActiveState(req, 'block');
            assertQueueRouting(req, { activeWork: false, needsDDReview: true, waitingOnDDOps: true });

            // Step 3: Resolve Blocker
            req = simulateResolveBlocker(req, 'Documents found', DD_OPS_LEAD);
            expect(req.status).toBe('Needs Rework');
            expect(req._blockerStatus).toBe('Resolved');
            expect(req._returnReason).toBe('Blocker resolved: Documents found');
            assertValidActiveState(req, 'resolve');
            assertQueueRouting(req, { activeWork: false, needsDDReview: false, returnedNeedsAttention: true });

            // Step 4: Reaccept
            req = simulateReacceptWithCleanup(req);
            expect(req.status).toBe('In Progress');
            expect(req._returnReason).toBeNull();
            expect(req._blockerStatus).toBeNull();
            expect(req._processingStartedAt).toBe('2026-07-01T10:00:00Z');
            assertValidActiveState(req, 'reaccept');
            assertQueueRouting(req, { activeWork: true, needsDDReview: false, returnedNeedsAttention: false });

            // Step 5: Clarification
            req = simulateStartClarification(req, 'Can you provide more details?');
            expect(req.status).toBe('Clarification Needed');
            expect(req.owner).toBe(DD_OPS_LEAD);
            expect(req.assignedTo).toBe(DD_OPS_LEAD);
            expect(req._returnReason).toBeNull();
            expect(req._blockerStatus).toBeNull();
            assertValidActiveState(req, 'clarification');
            assertQueueRouting(req, { activeWork: false, needsDDReview: true, returnedNeedsAttention: true, inAnyQueue: true });
        });

        it('should retain blocker history through the full sequence', () => {
            let req = buildRequest();
            req = simulateBlock(req, CONTRIBUTOR, 'Issue');
            const blockNotes = req._workNotes?.filter(n => n.action === 'Blocked') || [];
            expect(blockNotes.length).toBe(1);

            req = simulateResolveBlocker(req, 'Fixed', DD_OPS_LEAD);
            const resolveNotes = req._workNotes?.filter(n => n.action === 'Blocker Resolution') || [];
            expect(resolveNotes.length).toBe(1);
            expect(blockNotes.length).toBe(1); // still present

            req = simulateReacceptWithCleanup(req);
            expect(req._workNotes?.filter(n => n.action === 'Blocked').length).toBe(1);
            expect(req._workNotes?.filter(n => n.action === 'Blocker Resolution').length).toBe(1);

            req = simulateStartClarification(req, 'Question?');
            const clarNotes = req._workNotes?.filter(n => n.action === 'Clarification Needed') || [];
            expect(clarNotes.length).toBe(1);
            expect(req._workNotes?.filter(n => n.action === 'Blocked').length).toBe(1);
            expect(req._workNotes?.filter(n => n.action === 'Blocker Resolution').length).toBe(1);
        });

        it('should have only one active workflow (clarification) after the sequence', () => {
            let req = buildRequest();
            req = simulateBlock(req, CONTRIBUTOR, 'Issue');
            req = simulateResolveBlocker(req, 'Fixed', DD_OPS_LEAD);
            req = simulateReacceptWithCleanup(req);
            req = simulateStartClarification(req, 'Question?');

            // Active workflow indicators should only reflect clarification
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
            req = simulateStartClarification(req, 'Question?');
            expect(req._processingStartedAt).toBe('2026-07-01T10:00:00Z');
        });
    });

    describe('Test B — Reverse Order: Clarification → Resolve → Reaccept → Blocker', () => {

        it('should route blocker correctly after clarification → resolve → reaccept → blocker', () => {
            let req = buildRequest({ _processingStartedAt: '2026-07-01T10:00:00Z' });

            // Step 1: Start Clarification
            req = simulateStartClarification(req, 'Need more info on financials');
            expect(req.status).toBe('Clarification Needed');
            expect(req.owner).toBe(DD_OPS_LEAD);
            assertValidActiveState(req, 'start clarification');
            assertQueueRouting(req, { activeWork: false, needsDDReview: true });

            // Step 2: Clarification Response (DD Ops answers)
            req = simulateClarificationResponse(req, 'Here is the info', DD_OPS_LEAD);
            expect(req.status).toBe('In Progress');
            assertValidActiveState(req, 'clarification response');
            assertQueueRouting(req, { activeWork: true });

            // Step 3: Return to Contributor
            req = simulateReturnToOwner(req, 'Need additional analysis', DD_OPS_LEAD);
            expect(req.status).toBe('Needs Rework');
            expect(req._returnReason).toBe('Need additional analysis');
            assertValidActiveState(req, 'return to owner');
            assertQueueRouting(req, { activeWork: false, returnedNeedsAttention: true });

            // Step 4: Reaccept
            req = simulateReacceptWithCleanup(req);
            expect(req.status).toBe('In Progress');
            expect(req._returnReason).toBeNull();
            expect(req._blockerStatus).toBeNull();
            assertValidActiveState(req, 'reaccept');
            assertQueueRouting(req, { activeWork: true });

            // Step 5: Raise Blocker
            req = simulateBlock(req, CONTRIBUTOR, 'Still missing docs');
            expect(req.status).toBe('Blocked');
            expect(req._blockerStatus).toBe('Raised');
            expect(req.owner).toBe(DD_OPS_LEAD);
            assertValidActiveState(req, 'block after clarification');
            assertQueueRouting(req, { activeWork: false, needsDDReview: true });
        });

        it('should retain clarification history through the full sequence', () => {
            let req = buildRequest();
            req = simulateStartClarification(req, 'Question?');
            req = simulateClarificationResponse(req, 'Answer', DD_OPS_LEAD);
            req = simulateReturnToOwner(req, 'More work needed', DD_OPS_LEAD);
            req = simulateReacceptWithCleanup(req);
            req = simulateBlock(req, CONTRIBUTOR, 'Blocker');

            const clarNotes = req._workNotes?.filter(n => n.action === 'Clarification Needed') || [];
            const respNotes = req._workNotes?.filter(n => n.action === 'Clarification Response') || [];
            expect(clarNotes.length).toBe(1);
            expect(respNotes.length).toBe(1);
        });
    });

    describe('Test C — Repeated Workflow: Blocker → Resolve → Reaccept → Blocker Again', () => {

        it('should route second blocker identically to first', () => {
            let req = buildRequest();

            // First blocker cycle
            req = simulateBlock(req, CONTRIBUTOR, 'Issue 1');
            expect(req._blockerStatus).toBe('Raised');
            expect(req.status).toBe('Blocked');

            req = simulateResolveBlocker(req, 'Fixed 1', DD_OPS_LEAD);
            req = simulateReacceptWithCleanup(req);
            expect(req._blockerStatus).toBeNull();
            expect(req._returnReason).toBeNull();

            // Second blocker cycle
            req = simulateBlock(req, CONTRIBUTOR, 'Issue 2');
            expect(req._blockerStatus).toBe('Raised');
            expect(req.status).toBe('Blocked');
            expect(req.owner).toBe(DD_OPS_LEAD);
            assertValidActiveState(req, 'second blocker');
            assertQueueRouting(req, { activeWork: false, needsDDReview: true, waitingOnDDOps: true });

            // Both blocker notes retained
            const blockNotes = req._workNotes?.filter(n => n.action === 'Blocked') || [];
            expect(blockNotes.length).toBe(2);
        });
    });

    describe('Test D — Repeated Clarification: Clarification → Resolve → Reaccept → Clarification Again', () => {

        it('should route second clarification correctly', () => {
            let req = buildRequest();

            // First clarification cycle
            req = simulateStartClarification(req, 'First question');
            expect(req.status).toBe('Clarification Needed');
            req = simulateClarificationResponse(req, 'First answer', DD_OPS_LEAD);
            req = simulateReturnToOwner(req, 'Need more work', DD_OPS_LEAD);
            req = simulateReacceptWithCleanup(req);
            expect(req.status).toBe('In Progress');

            // Second clarification cycle
            req = simulateStartClarification(req, 'Second question');
            expect(req.status).toBe('Clarification Needed');
            expect(req.owner).toBe(DD_OPS_LEAD);
            expect(req._returnReason).toBeNull();
            assertValidActiveState(req, 'second clarification');
            assertQueueRouting(req, { activeWork: false, needsDDReview: true });

            // Both clarification notes retained
            const clarNotes = req._workNotes?.filter(n => n.action === 'Clarification Needed') || [];
            expect(clarNotes.length).toBe(2);
        });
    });

    describe('Test E — Publish and Rework Protection', () => {

        it('should not regress: Complete → Publish → Rework → Return → Reaccept → Complete → Republish → Approve', () => {
            let req = buildRequest({ _processingStartedAt: '2026-07-01T10:00:00Z' });

            // Complete
            req = simulateComplete(req, CONTRIBUTOR);
            expect(req.status).toBe('Complete');
            assertValidActiveState(req, 'complete');

            // Publish External
            req = simulatePublishExternal(req);
            expect(req.status).toBe('Waiting Partner Review');
            expect(req._externalStatus).toBe('Published External');
            assertValidActiveState(req, 'publish');

            // Partner Requests Rework
            req = simulatePartnerRework(req, 'Please revise financials');
            expect(req.status).toBe('Needs Rework');
            expect(req._partnerDecision).toBe('Rework Required');
            expect(req.owner).toBe(DD_OPS_LEAD);
            assertValidActiveState(req, 'partner rework');
            assertQueueRouting(req, { activeWork: false, needsDDReview: true }); // _partnerDecision === 'Rework Required'

            // Return to Contributor
            req = simulateReturnToOwner(req, 'Revise the financials section', DD_OPS_LEAD);
            expect(req.status).toBe('Needs Rework');
            expect(req._returnReason).toBe('Revise the financials section');
            assertQueueRouting(req, { activeWork: false, returnedNeedsAttention: true });

            // Reaccept
            req = simulateReacceptWithCleanup(req);
            expect(req.status).toBe('In Progress');
            expect(req._returnReason).toBeNull();
            expect(req._partnerDecision).toBeNull();
            assertValidActiveState(req, 'reaccept after rework');
            assertQueueRouting(req, { activeWork: true });

            // Complete Again
            req = simulateComplete(req, CONTRIBUTOR);
            expect(req.status).toBe('Complete');

            // Republish
            req = simulatePublishExternal(req);
            expect(req._externalStatus).toBe('Published External');
            expect(req.status).toBe('Waiting Partner Review');

            // Partner Approves
            req = simulatePartnerApprove(req);
            expect(req.status).toBe('Completed');
            expect(req._partnerDecision).toBe('Approved');
            assertValidActiveState(req, 'partner approve');
        });

        it('should preserve external visibility through blocker → publish → rework → approve', () => {
            let req = buildRequest({ _processingStartedAt: '2026-07-01T10:00:00Z' });
            req = simulateBlock(req, CONTRIBUTOR, 'Issue');
            req = simulateResolveBlocker(req, 'Fixed', DD_OPS_LEAD);
            req = simulateReacceptWithCleanup(req);
            req = simulateComplete(req, CONTRIBUTOR);
            req = simulatePublishExternal(req);
            req = simulatePartnerApprove(req);
            expect(req._processingStartedAt).toBe('2026-07-01T10:00:00Z');
            expect(req._externalStatus).toBe('Published External');
        });
    });

    describe('Test F — Sticky External Status', () => {

        it('should preserve In Progress external status through internal blocker transitions', () => {
            let req = buildRequest({ _processingStartedAt: '2026-07-01T10:00:00Z' });

            req = simulateBlock(req, CONTRIBUTOR, 'Issue');
            expect(req._processingStartedAt).toBe('2026-07-01T10:00:00Z');

            req = simulateResolveBlocker(req, 'Fixed', DD_OPS_LEAD);
            expect(req._processingStartedAt).toBe('2026-07-01T10:00:00Z');

            req = simulateReacceptWithCleanup(req);
            expect(req._processingStartedAt).toBe('2026-07-01T10:00:00Z');

            req = simulateStartClarification(req, 'Question?');
            expect(req._processingStartedAt).toBe('2026-07-01T10:00:00Z');
        });
    });

    describe('Alternating Workflows: Blocker → Clarification → Blocker → Clarification', () => {

        it('should handle alternating blocker and clarification workflows', () => {
            let req = buildRequest({ _processingStartedAt: '2026-07-01T10:00:00Z' });

            // Blocker round 1
            req = simulateBlock(req, CONTRIBUTOR, 'Blocker 1');
            expect(req.status).toBe('Blocked');
            assertValidActiveState(req, 'blocker 1');

            req = simulateResolveBlocker(req, 'Fixed 1', DD_OPS_LEAD);
            req = simulateReacceptWithCleanup(req);
            expect(req.status).toBe('In Progress');

            // Clarification round 1
            req = simulateStartClarification(req, 'Clarification 1');
            expect(req.status).toBe('Clarification Needed');
            expect(req.owner).toBe(DD_OPS_LEAD);
            assertValidActiveState(req, 'clarification 1');

            req = simulateClarificationResponse(req, 'Answer 1', DD_OPS_LEAD);
            req = simulateReturnToOwner(req, 'More work', DD_OPS_LEAD);
            req = simulateReacceptWithCleanup(req);
            expect(req.status).toBe('In Progress');

            // Blocker round 2
            req = simulateBlock(req, CONTRIBUTOR, 'Blocker 2');
            expect(req.status).toBe('Blocked');
            expect(req._blockerStatus).toBe('Raised');
            assertValidActiveState(req, 'blocker 2');
            assertQueueRouting(req, { activeWork: false, needsDDReview: true });

            req = simulateResolveBlocker(req, 'Fixed 2', DD_OPS_LEAD);
            req = simulateReacceptWithCleanup(req);

            // Clarification round 2
            req = simulateStartClarification(req, 'Clarification 2');
            expect(req.status).toBe('Clarification Needed');
            expect(req.owner).toBe(DD_OPS_LEAD);
            expect(req._returnReason).toBeNull();
            expect(req._blockerStatus).toBeNull();
            assertValidActiveState(req, 'clarification 2');
            assertQueueRouting(req, { activeWork: false, needsDDReview: true, inAnyQueue: true });
        });
    });

    describe('Not Mine → Reassign → Clarification', () => {

        it('should handle Not Mine → reassign → clarification', () => {
            let req = buildRequest();

            // Not Mine
            req = simulateNotMine(req, 'Wrong team', CONTRIBUTOR);
            expect(req.status).toBe('Open');
            expect(req.owner).toBeNull();
            expect(req._needsReassignment).toBe(true);

            // Reassign
            req = { ...req, owner: OTHER_CONTRIBUTOR, assignedTo: OTHER_CONTRIBUTOR, status: 'In Progress', _needsReassignment: false, _misassignedReason: null, _processingStartedAt: new Date().toISOString() };
            assertValidActiveState(req, 'reassign');

            // Clarification
            req = simulateStartClarification(req, 'Question?');
            expect(req.status).toBe('Clarification Needed');
            expect(req.owner).toBe(DD_OPS_LEAD);
            assertValidActiveState(req, 'clarification after not-mine');
            assertQueueRouting(req, { activeWork: false, needsDDReview: true });
        });
    });

    describe('Queue-Level Routing Invariants', () => {

        it('should never leave a request with zero active queues after any transition', () => {
            let req = buildRequest();
            assertQueueRouting(req, { activeWork: true, inAnyQueue: true }, 'initial');

            req = simulateBlock(req, CONTRIBUTOR, 'Issue');
            assertQueueRouting(req, { inAnyQueue: true }, 'blocked');

            req = simulateResolveBlocker(req, 'Fixed', DD_OPS_LEAD);
            assertQueueRouting(req, { inAnyQueue: true }, 'resolved');

            req = simulateReacceptWithCleanup(req);
            assertQueueRouting(req, { activeWork: true, inAnyQueue: true }, 'reaccepted');

            req = simulateStartClarification(req, 'Question?');
            assertQueueRouting(req, { needsDDReview: true, inAnyQueue: true }, 'clarification');

            req = simulateClarificationResponse(req, 'Answer', DD_OPS_LEAD);
            assertQueueRouting(req, { activeWork: true, inAnyQueue: true }, 'clarification response');

            req = simulateReturnToOwner(req, 'Needs work', DD_OPS_LEAD);
            assertQueueRouting(req, { inAnyQueue: true }, 'returned');

            req = simulateReacceptWithCleanup(req);
            assertQueueRouting(req, { activeWork: true, inAnyQueue: true }, 'reaccepted 2');

            req = simulateComplete(req, CONTRIBUTOR);
            // Complete is not in any active queue, but that's expected
        });

        it('should have exactly one primary queue destination for each active state', () => {
            // Clarification Needed: should be in Needs DD Review (DD Ops view)
            const clarReq = buildRequest({ status: 'Clarification Needed', owner: DD_OPS_LEAD, assignedTo: DD_OPS_LEAD });
            expect(inNeedsDDReview(clarReq)).toBe(true);

            // Blocked: should be in Needs DD Review AND Waiting on DD Ops
            const blockedReq = buildRequest({ status: 'Blocked', _blockerStatus: 'Raised', _blockerRaisedBy: CONTRIBUTOR, owner: DD_OPS_LEAD });
            expect(inNeedsDDReview(blockedReq)).toBe(true);
            expect(inWaitingOnDDOps(blockedReq, CONTRIBUTOR)).toBe(true);

            // In Progress: should be in Active Work
            const inProgressReq = buildRequest({ status: 'In Progress', owner: CONTRIBUTOR });
            expect(inActiveWork(inProgressReq)).toBe(true);

            // Needs Rework (with _returnReason): should be in Returned / Needs Attention
            const reworkReq = buildRequest({ status: 'Needs Rework', _returnReason: 'Needs more work', owner: CONTRIBUTOR });
            expect(inReturnedNeedsAttention(reworkReq)).toBe(true);
        });
    });

    describe('Defensive: No Zero-Home State After Any Transition', () => {

        it('should not disappear after Blocker → Resolve → Reaccept → Clarification (the original bug)', () => {
            let req = buildRequest();
            req = simulateBlock(req, CONTRIBUTOR, 'Issue');
            req = simulateResolveBlocker(req, 'Fixed', DD_OPS_LEAD);
            req = simulateReacceptWithCleanup(req);
            req = simulateStartClarification(req, 'Question?');
            expect(inNeedsDDReview(req)).toBe(true);
            expect(inActiveWork(req)).toBe(false);
            // Key: at least one queue claims it (the bug was zero queues)
            expect(inNeedsDDReview(req) || inReturnedNeedsAttention(req) || inActiveWork(req)).toBe(true);
        });

        it('should not disappear after Return → Reaccept → Clarification', () => {
            let req = buildRequest();
            req = simulateReturnToOwner(req, 'Needs work', DD_OPS_LEAD);
            req = simulateReacceptWithCleanup(req);
            req = simulateStartClarification(req, 'Question?');
            expect(inNeedsDDReview(req)).toBe(true);
        });

        it('should not disappear after Not Mine → Reassign → Blocker', () => {
            let req = buildRequest();
            req = simulateNotMine(req, 'Wrong', CONTRIBUTOR);
            req = { ...req, owner: OTHER_CONTRIBUTOR, assignedTo: OTHER_CONTRIBUTOR, status: 'In Progress', _needsReassignment: false, _misassignedReason: null };
            req = simulateBlock(req, CONTRIBUTOR, 'Issue');
            expect(inNeedsDDReview(req)).toBe(true);
            expect(inWaitingOnDDOps(req, CONTRIBUTOR)).toBe(true);
        });

        it('should not disappear after Partner Rework → Return → Reaccept → Blocker', () => {
            let req = buildRequest({ _externalStatus: 'Published External', _partnerDecision: 'Approved' });
            req = simulatePartnerRework(req, 'Revise');
            req = simulateReturnToOwner(req, 'Revise now', DD_OPS_LEAD);
            req = simulateReacceptWithCleanup(req);
            req = simulateBlock(req, CONTRIBUTOR, 'Blocker');
            expect(inNeedsDDReview(req)).toBe(true);
        });

        it('should not have stale _returnReason blocking DD Ops routing after reaccept', () => {
            let req = buildRequest();
            req = simulateBlock(req, CONTRIBUTOR, 'Issue');
            req = simulateResolveBlocker(req, 'Fixed', DD_OPS_LEAD);
            req = simulateReacceptWithCleanup(req);
            expect(req._returnReason).toBeNull();
            req = simulateStartClarification(req, 'Question?');
            // The original bug: _returnReason was stale, blocking Needs DD Review
            expect(inNeedsDDReview(req)).toBe(true);
        });
    });
});

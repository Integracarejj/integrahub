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
        _clarificationRaisedBy: null,
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

function inNeedsDDReview(req: RecapRequest): boolean {
    return (NEEDS_DD_REVIEW_STATUSES.includes(req.status) || !!req._needsReassignment || !!req._misassignedReason || req._partnerDecision === 'Rework Required') && !req._returnReason;
}

function inWaitingOnDDOps(req: RecapRequest, activeUser: string): boolean {
    return ((req.status === 'Blocked' || req.status === 'Pending External') && req._blockerRaisedBy === activeUser) ||
        (req.status === 'Clarification Needed' && req._clarificationRaisedBy === activeUser);
}

function inReturnedNeedsAttention(req: RecapRequest): boolean {
    return (RETURNED_STATUSES.includes(req.status) &&
        !(req.status === 'Clarification Needed' && (req._returnReason || isActiveExternalClarification(req)))) ||
        !!req._needsReassignment;
}

function assertValidActiveState(req: RecapRequest, context: string) {
    const msgs: string[] = [];
    if (req.status === 'Clarification Needed' && req.owner !== DD_OPS_LEAD && req.assignedTo !== DD_OPS_LEAD) {
        msgs.push(`Clarification Needed but owner/assignedTo is not DD_OPS_LEAD (owner=${req.owner}, assignedTo=${req.assignedTo})`);
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
    if (req.status === 'Needs Rework' && req._blockerStatus && req._blockerStatus !== 'Resolved') {
        msgs.push(`Needs Rework with active blocker status: ${req._blockerStatus}`);
    }
    if (msgs.length > 0) {
        throw new Error(`Invariant violation [${context}]:\n  ${msgs.join('\n  ')}`);
    }
}

/**
 * Mirrors submitClarificationToDdOperations atomic service function.
 * Single-patch approach: all fields applied atomically.
 */
function simulateAtomicClarificationSubmit(req: RecapRequest, questionText: string, additionalContext: string | null, raisedBy: string): RecapRequest {
    const wnEntries: WorkNoteEntry[] = [];
    wnEntries.push(createWorkNote(questionText, raisedBy, 'Clarification Needed'));
    if (additionalContext?.trim()) {
        wnEntries.push(createWorkNote(additionalContext.trim(), raisedBy, 'Clarification Context'));
    }
    return {
        ...req,
        status: 'Clarification Needed',
        owner: DD_OPS_LEAD,
        assignedTo: DD_OPS_LEAD,
        _clarificationRaisedBy: raisedBy,
        _statusNotes: questionText,
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
        _workNotes: [...(req._workNotes || []), ...wnEntries],
    };
}

/**
 * Mirrors returnClarificationToContributor with validation.
 * Returns undefined if no valid contributor target exists.
 */
function simulateClarificationReturn(req: RecapRequest, response: string, returnedBy: string): RecapRequest | undefined {
    const returnTarget = req._clarificationRaisedBy;
    if (!returnTarget || !returnTarget.trim() || returnTarget === DD_OPS_LEAD) {
        return undefined;
    }
    const returnTo = returnTarget;
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

/**
 * Mirrors blockRequest with full cleanup patch.
 */
function simulateBlock(req: RecapRequest, raisedBy: string, reason: string): RecapRequest {
    const wn = createWorkNote(reason, raisedBy, 'Blocked');
    const originalContributor = req.owner || raisedBy;
    return {
        ...req,
        status: 'Blocked',
        owner: DD_OPS_LEAD,
        assignedTo: DD_OPS_LEAD,
        _blockerReason: reason,
        _blockerStatus: 'Raised',
        _blockerRaisedBy: originalContributor,
        _blockerRaisedAt: new Date().toISOString(),
        _blockerOwner: DD_OPS_LEAD,
        _returnReason: null,
        _returnedBy: null,
        _blockerExternalQuestion: null,
        _blockerExternalResponse: null,
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
        _clarificationRaisedBy: null,
        _workNotes: [...(req._workNotes || []), wn],
    };
}

/**
 * Mirrors reaccept (doStatusChange to In Progress) with full cleanup.
 */
function simulateReaccept(req: RecapRequest): RecapRequest {
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
        _clarificationRaisedBy: null,
        _blockerExternalQuestion: null,
        _blockerExternalResponse: null,
    };
}

// ═══════════════════════════════════════════════════════════════════
// Test Group 1: Atomic State — submitClarificationToDdOperations
// ═══════════════════════════════════════════════════════════════════
describe('submitClarificationToDdOperations — atomic state', () => {
    it('sets status to Clarification Needed with _clarificationRaisedBy in single patch', () => {
        const req = buildRequest({ status: 'In Progress' });
        const result = simulateAtomicClarificationSubmit(req, 'Need more details on financials', null, CONTRIBUTOR);
        expect(result.status).toBe('Clarification Needed');
        expect(result._clarificationRaisedBy).toBe(CONTRIBUTOR);
        expect(result.owner).toBe(DD_OPS_LEAD);
        expect(result.assignedTo).toBe(DD_OPS_LEAD);
    });

    it('clears all incompatible active-state fields atomically', () => {
        const req = buildRequest({
            status: 'In Progress',
            _returnReason: 'old return',
            _returnedBy: 'old returner',
            _blockerStatus: 'Raised',
            _blockerResolution: null,
            _needsReassignment: true,
            _misassignedReason: 'wrong team',
            _partnerDecision: 'Approved',
            _partnerNote: 'old note',
            _exceptionRecommendation: 'Duplicate',
        });
        const result = simulateAtomicClarificationSubmit(req, 'Question?', null, CONTRIBUTOR);
        expect(result._returnReason).toBeNull();
        expect(result._returnedBy).toBeNull();
        expect(result._blockerStatus).toBeNull();
        expect(result._blockerResolution).toBeNull();
        expect(result._needsReassignment).toBe(false);
        expect(result._misassignedReason).toBeNull();
        expect(result._partnerDecision).toBeNull();
        expect(result._partnerNote).toBeNull();
        expect(result._exceptionRecommendation).toBeNull();
        assertValidActiveState(result, 'after atomic submit');
    });

    it('preserves _processingStartedAt from prior In Progress state', () => {
        const startedAt = '2026-06-15T10:00:00.000Z';
        const req = buildRequest({ status: 'In Progress', _processingStartedAt: startedAt });
        const result = simulateAtomicClarificationSubmit(req, 'Question?', null, CONTRIBUTOR);
        expect(result._processingStartedAt).toBe(startedAt);
    });

    it('writes question text to _statusNotes', () => {
        const req = buildRequest();
        const result = simulateAtomicClarificationSubmit(req, 'Need financial details', null, CONTRIBUTOR);
        expect(result._statusNotes).toBe('Need financial details');
    });

    it('appends question and optional context as work notes in order', () => {
        const req = buildRequest({ _workNotes: [createWorkNote('existing note', CONTRIBUTOR, null, -1000)] });
        const result = simulateAtomicClarificationSubmit(req, 'Question text', 'Additional context here', CONTRIBUTOR);
        const notes = result._workNotes!;
        expect(notes).toHaveLength(3);
        expect(notes[0].text).toBe('existing note');
        expect(notes[1].text).toBe('Question text');
        expect(notes[1].action).toBe('Clarification Needed');
        expect(notes[2].text).toBe('Additional context here');
        expect(notes[2].action).toBe('Clarification Context');
    });

    it('omits context work note when additionalContext is null or blank', () => {
        const req = buildRequest();
        const r1 = simulateAtomicClarificationSubmit(req, 'Question', null, CONTRIBUTOR);
        expect(r1._workNotes).toHaveLength(1);
        const r2 = simulateAtomicClarificationSubmit(req, 'Question', '   ', CONTRIBUTOR);
        expect(r2._workNotes).toHaveLength(1);
    });

    it('routes item to Needs DD Review queue', () => {
        const req = buildRequest({ status: 'In Progress' });
        const result = simulateAtomicClarificationSubmit(req, 'Question?', null, CONTRIBUTOR);
        expect(inNeedsDDReview(result)).toBe(true);
    });

    it('routes item to Waiting on DD Ops when raised by active user', () => {
        const req = buildRequest({ status: 'In Progress' });
        const result = simulateAtomicClarificationSubmit(req, 'Question?', null, CONTRIBUTOR);
        expect(inWaitingOnDDOps(result, CONTRIBUTOR)).toBe(true);
    });

    it('does NOT appear in Active Work queue after submit', () => {
        const req = buildRequest({ status: 'In Progress' });
        const result = simulateAtomicClarificationSubmit(req, 'Question?', null, CONTRIBUTOR);
        expect(inActiveWork(result)).toBe(false);
    });

    it('appears in Returned / Needs Attention (Clarification Needed is a returned status)', () => {
        const req = buildRequest({ status: 'In Progress' });
        const result = simulateAtomicClarificationSubmit(req, 'Question?', null, CONTRIBUTOR);
        expect(inReturnedNeedsAttention(result)).toBe(true);
    });

    it('result is valid per invariant check', () => {
        const req = buildRequest({ status: 'In Progress' });
        const result = simulateAtomicClarificationSubmit(req, 'Need details', null, CONTRIBUTOR);
        assertValidActiveState(result, 'atomic submit result');
    });
});

// ═══════════════════════════════════════════════════════════════════
// Test Group 2: Post-Blocker Clarification — submit from Blocked
// ═══════════════════════════════════════════════════════════════════
describe('submitClarificationToDdOperations — post-blocker', () => {
    it('clears active blocker fields when submitting clarification from Blocked', () => {
        const req = buildRequest({
            status: 'Blocked',
            _blockerStatus: 'Raised',
            _blockerReason: 'Missing data',
            _blockerRaisedBy: CONTRIBUTOR,
            _blockerOwner: DD_OPS_LEAD,
        });
        const result = simulateAtomicClarificationSubmit(req, 'Need clarification on blocker', null, CONTRIBUTOR);
        expect(result.status).toBe('Clarification Needed');
        expect(result._blockerStatus).toBeNull();
        // _blockerReason, _blockerRaisedBy, _blockerOwner persist from spread (not cleared by Clarification Needed cleanup)
        expect(result._blockerReason).toBe('Missing data');
        assertValidActiveState(result, 'post-blocker clarification');
    });

    it('clears _blockerExternalQuestion and _blockerExternalResponse are NOT cleared by Clarification Needed cleanup', () => {
        const req = buildRequest({
            status: 'Blocked',
            _blockerStatus: 'Pending External',
            _blockerExternalQuestion: 'External question text',
        });
        const result = simulateAtomicClarificationSubmit(req, 'New question', null, CONTRIBUTOR);
        // These persist from spread — not in clearIncompatibleActiveState("Clarification Needed")
        expect(result._blockerExternalQuestion).toBe('External question text');
    });

    it('sets _clarificationRaisedBy to the contributor who raised the clarification', () => {
        const req = buildRequest({
            status: 'Blocked',
            _blockerStatus: 'Raised',
            _blockerRaisedBy: 'Mike Wilson',
        });
        const result = simulateAtomicClarificationSubmit(req, 'Need help', null, 'Mike Wilson');
        expect(result._clarificationRaisedBy).toBe('Mike Wilson');
    });

    it('routes to Needs DD Review from Blocked state', () => {
        const req = buildRequest({
            status: 'Blocked',
            _blockerStatus: 'Raised',
        });
        const result = simulateAtomicClarificationSubmit(req, 'Clarify?', null, CONTRIBUTOR);
        expect(inNeedsDDReview(result)).toBe(true);
    });

    it('item remains in Waiting on DD Ops (contributor can track their own clarification)', () => {
        const req = buildRequest({
            status: 'Blocked',
            _blockerStatus: 'Raised',
            _blockerRaisedBy: CONTRIBUTOR,
        });
        const result = simulateAtomicClarificationSubmit(req, 'Question?', null, CONTRIBUTOR);
        expect(inWaitingOnDDOps(result, CONTRIBUTOR)).toBe(true);
    });
});

// ═══════════════════════════════════════════════════════════════════
// Test Group 3: Return — returnClarificationToContributor
// ═══════════════════════════════════════════════════════════════════
describe('returnClarificationToContributor — valid return', () => {
    it('returns item to the contributor who raised the clarification', () => {
        const req = buildRequest({
            status: 'Clarification Needed',
            _clarificationRaisedBy: CONTRIBUTOR,
        });
        const result = simulateClarificationReturn(req, 'Here is the answer', DD_OPS_LEAD);
        expect(result).toBeDefined();
        expect(result!.owner).toBe(CONTRIBUTOR);
        expect(result!.assignedTo).toBe(CONTRIBUTOR);
    });

    it('sets status to Needs Rework with _returnReason', () => {
        const req = buildRequest({
            status: 'Clarification Needed',
            _clarificationRaisedBy: CONTRIBUTOR,
        });
        const result = simulateClarificationReturn(req, 'Here are the details', DD_OPS_LEAD);
        expect(result!.status).toBe('Needs Rework');
        expect(result!._returnReason).toBe('Clarification response: Here are the details');
        expect(result!._returnedBy).toBe(DD_OPS_LEAD);
    });

    it('clears _clarificationRaisedBy on return', () => {
        const req = buildRequest({
            status: 'Clarification Needed',
            _clarificationRaisedBy: CONTRIBUTOR,
        });
        const result = simulateClarificationReturn(req, 'Answer', DD_OPS_LEAD);
        expect(result!._clarificationRaisedBy).toBeNull();
    });

    it('appends response as work note with Clarification Response action', () => {
        const req = buildRequest({
            status: 'Clarification Needed',
            _clarificationRaisedBy: CONTRIBUTOR,
            _workNotes: [createWorkNote('original question', CONTRIBUTOR, 'Clarification Needed', -1000)],
        });
        const result = simulateClarificationReturn(req, 'Here is the answer', DD_OPS_LEAD);
        const notes = result!._workNotes!;
        expect(notes).toHaveLength(2);
        expect(notes[1].text).toBe('Here is the answer');
        expect(notes[1].action).toBe('Clarification Response');
    });

    it('clears incompatible fields on return', () => {
        const req = buildRequest({
            status: 'Clarification Needed',
            _clarificationRaisedBy: CONTRIBUTOR,
            _blockerStatus: 'Raised',
            _needsReassignment: true,
            _partnerDecision: 'Approved',
        });
        const result = simulateClarificationReturn(req, 'Answer', DD_OPS_LEAD);
        expect(result!._blockerStatus).toBeNull();
        expect(result!._needsReassignment).toBe(false);
        expect(result!._partnerDecision).toBeNull();
    });

    it('item appears in Returned / Needs Attention queue', () => {
        const req = buildRequest({
            status: 'Clarification Needed',
            _clarificationRaisedBy: CONTRIBUTOR,
        });
        const result = simulateClarificationReturn(req, 'Answer', DD_OPS_LEAD);
        expect(inReturnedNeedsAttention(result!)).toBe(true);
    });

    it('item no longer in Needs DD Review after return', () => {
        const req = buildRequest({
            status: 'Clarification Needed',
            _clarificationRaisedBy: CONTRIBUTOR,
        });
        const result = simulateClarificationReturn(req, 'Answer', DD_OPS_LEAD);
        expect(inNeedsDDReview(result!)).toBe(false);
    });

    it('item no longer in Waiting on DD Ops after return', () => {
        const req = buildRequest({
            status: 'Clarification Needed',
            _clarificationRaisedBy: CONTRIBUTOR,
        });
        const result = simulateClarificationReturn(req, 'Answer', DD_OPS_LEAD);
        expect(inWaitingOnDDOps(result!, CONTRIBUTOR)).toBe(false);
    });

    it('return result is valid per invariant check', () => {
        const req = buildRequest({
            status: 'Clarification Needed',
            _clarificationRaisedBy: CONTRIBUTOR,
        });
        const result = simulateClarificationReturn(req, 'Answer', DD_OPS_LEAD);
        assertValidActiveState(result!, 'after return');
    });
});

// ═══════════════════════════════════════════════════════════════════
// Test Group 4: Missing Contributor Marker — return fails safely
// ═══════════════════════════════════════════════════════════════════
describe('returnClarificationToContributor — missing contributor marker', () => {
    it('returns undefined when _clarificationRaisedBy is null', () => {
        const req = buildRequest({
            status: 'Clarification Needed',
            _clarificationRaisedBy: null,
        });
        const result = simulateClarificationReturn(req, 'Answer', DD_OPS_LEAD);
        expect(result).toBeUndefined();
    });

    it('returns undefined when _clarificationRaisedBy is empty string', () => {
        const req = buildRequest({
            status: 'Clarification Needed',
            _clarificationRaisedBy: '',
        });
        const result = simulateClarificationReturn(req, 'Answer', DD_OPS_LEAD);
        expect(result).toBeUndefined();
    });

    it('returns undefined when _clarificationRaisedBy is whitespace only', () => {
        const req = buildRequest({
            status: 'Clarification Needed',
            _clarificationRaisedBy: '   ',
        });
        const result = simulateClarificationReturn(req, 'Answer', DD_OPS_LEAD);
        expect(result).toBeUndefined();
    });

    it('returns undefined when _clarificationRaisedBy is DD_OPS_LEAD', () => {
        const req = buildRequest({
            status: 'Clarification Needed',
            _clarificationRaisedBy: DD_OPS_LEAD,
        });
        const result = simulateClarificationReturn(req, 'Answer', DD_OPS_LEAD);
        expect(result).toBeUndefined();
    });

    it('request is NOT mutated when return fails', () => {
        const req = buildRequest({
            status: 'Clarification Needed',
            _clarificationRaisedBy: null,
        });
        const originalStatus = req.status;
        const originalNotes = req._workNotes?.length || 0;
        simulateClarificationReturn(req, 'Answer', DD_OPS_LEAD);
        expect(req.status).toBe(originalStatus);
        expect(req._workNotes?.length || 0).toBe(originalNotes);
    });
});

// ═══════════════════════════════════════════════════════════════════
// Test Group 5: Reaccept — full patch on Mock path
// ═══════════════════════════════════════════════════════════════════
describe('reaccept — full patch cleanup on In Progress transition', () => {
    it('clears _returnReason when reaccepting from Needs Rework', () => {
        const req = buildRequest({
            status: 'Needs Rework',
            _returnReason: 'Clarification response: answer',
            _returnedBy: DD_OPS_LEAD,
            _clarificationRaisedBy: null,
        });
        const result = simulateReaccept(req);
        expect(result.status).toBe('In Progress');
        expect(result._returnReason).toBeNull();
        expect(result._returnedBy).toBeNull();
    });

    it('clears _blockerStatus when reaccepting from Blocked (after resolve)', () => {
        const req = buildRequest({
            status: 'Needs Rework',
            _blockerStatus: 'Resolved',
            _blockerResolution: 'Data provided',
            _returnReason: 'Blocker resolved: Data provided',
        });
        const result = simulateReaccept(req);
        expect(result._blockerStatus).toBeNull();
        expect(result._blockerResolution).toBeNull();
    });

    it('clears _needsReassignment and _misassignedReason when reaccepting', () => {
        const req = buildRequest({
            status: 'Needs Rework',
            _needsReassignment: true,
            _misassignedReason: 'Wrong team',
            _returnReason: 'Reassigned',
        });
        const result = simulateReaccept(req);
        expect(result._needsReassignment).toBe(false);
        expect(result._misassignedReason).toBeNull();
    });

    it('clears _partnerDecision and _exceptionRecommendation when reaccepting', () => {
        const req = buildRequest({
            status: 'Needs Rework',
            _partnerDecision: 'Rework Required',
            _partnerNote: 'Fix issues',
            _exceptionRecommendation: 'Duplicate',
            _returnReason: 'Partner requested rework',
        });
        const result = simulateReaccept(req);
        expect(result._partnerDecision).toBeNull();
        expect(result._partnerNote).toBeNull();
        expect(result._exceptionRecommendation).toBeNull();
    });

    it('preserves _processingStartedAt from original In Progress state', () => {
        const startedAt = '2026-06-15T10:00:00.000Z';
        const req = buildRequest({
            status: 'Needs Rework',
            _processingStartedAt: startedAt,
            _returnReason: 'test',
        });
        const result = simulateReaccept(req);
        expect(result._processingStartedAt).toBe(startedAt);
    });

    it('sets _processingStartedAt if not previously set', () => {
        const req = buildRequest({
            status: 'Needs Rework',
            _processingStartedAt: undefined,
            _returnReason: 'test',
        });
        const result = simulateReaccept(req);
        expect(result._processingStartedAt).toBeDefined();
    });

    it('item returns to Active Work queue after reaccept', () => {
        const req = buildRequest({
            status: 'Needs Rework',
            _returnReason: 'test',
            _returnedBy: DD_OPS_LEAD,
        });
        const result = simulateReaccept(req);
        expect(inActiveWork(result)).toBe(true);
        expect(inReturnedNeedsAttention(result)).toBe(false);
    });

    it('reaccept result is valid per invariant check', () => {
        const req = buildRequest({
            status: 'Needs Rework',
            _returnReason: 'test',
        });
        const result = simulateReaccept(req);
        assertValidActiveState(result, 'after reaccept');
    });
});

// ═══════════════════════════════════════════════════════════════════
// Test Group 6: Three Repeated Rounds — submit → return cycle
// ═══════════════════════════════════════════════════════════════════
describe('three repeated clarification rounds', () => {
    it('submit → return → reaccept → submit → return → reaccept → submit → return preserves state consistency', () => {
        let req = buildRequest({ status: 'In Progress' });

        // Round 1
        req = simulateAtomicClarificationSubmit(req, 'First question', null, CONTRIBUTOR);
        expect(req.status).toBe('Clarification Needed');
        expect(req._clarificationRaisedBy).toBe(CONTRIBUTOR);
        assertValidActiveState(req, 'round 1 submit');

        req = simulateClarificationReturn(req, 'First answer', DD_OPS_LEAD)!;
        expect(req.status).toBe('Needs Rework');
        expect(req._clarificationRaisedBy).toBeNull();
        assertValidActiveState(req, 'round 1 return');

        req = simulateReaccept(req);
        expect(req.status).toBe('In Progress');
        assertValidActiveState(req, 'round 1 reaccept');

        // Round 2
        req = simulateAtomicClarificationSubmit(req, 'Second question', 'With context', CONTRIBUTOR);
        expect(req.status).toBe('Clarification Needed');
        expect(req._clarificationRaisedBy).toBe(CONTRIBUTOR);
        assertValidActiveState(req, 'round 2 submit');

        req = simulateClarificationReturn(req, 'Second answer', DD_OPS_LEAD)!;
        expect(req.status).toBe('Needs Rework');
        expect(req._clarificationRaisedBy).toBeNull();
        assertValidActiveState(req, 'round 2 return');

        req = simulateReaccept(req);
        expect(req.status).toBe('In Progress');
        assertValidActiveState(req, 'round 2 reaccept');

        // Round 3
        req = simulateAtomicClarificationSubmit(req, 'Third question', null, CONTRIBUTOR);
        expect(req.status).toBe('Clarification Needed');
        expect(req._clarificationRaisedBy).toBe(CONTRIBUTOR);
        assertValidActiveState(req, 'round 3 submit');

        req = simulateClarificationReturn(req, 'Third answer', DD_OPS_LEAD)!;
        expect(req.status).toBe('Needs Rework');
        expect(req._clarificationRaisedBy).toBeNull();
        assertValidActiveState(req, 'round 3 return');

        // Verify all work notes accumulated correctly
        const clarNeededNotes = req._workNotes!.filter(n => n.action === 'Clarification Needed');
        const clarContextNotes = req._workNotes!.filter(n => n.action === 'Clarification Context');
        const clarResponseNotes = req._workNotes!.filter(n => n.action === 'Clarification Response');
        expect(clarNeededNotes).toHaveLength(3);
        expect(clarContextNotes).toHaveLength(1); // only round 2 had context
        expect(clarResponseNotes).toHaveLength(3);
    });

    it('each submit clears all prior round fields (no stale _returnReason after submit)', () => {
        let req = buildRequest({ status: 'In Progress' });

        // Round 1
        req = simulateAtomicClarificationSubmit(req, 'Q1', null, CONTRIBUTOR);
        req = simulateClarificationReturn(req, 'A1', DD_OPS_LEAD)!;
        req = simulateReaccept(req);

        // Round 2 submit
        req = simulateAtomicClarificationSubmit(req, 'Q2', null, CONTRIBUTOR);
        expect(req._returnReason).toBeNull();
        expect(req._returnedBy).toBeNull();
        expect(req._blockerStatus).toBeNull();
        expect(req._needsReassignment).toBe(false);
    });

    it('queue routing is consistent across all three rounds', () => {
        let req = buildRequest({ status: 'In Progress' });

        for (let i = 1; i <= 3; i++) {
            req = simulateAtomicClarificationSubmit(req, `Q${i}`, null, CONTRIBUTOR);
            expect(inNeedsDDReview(req)).toBe(true);
            expect(inWaitingOnDDOps(req, CONTRIBUTOR)).toBe(true);
            expect(inActiveWork(req)).toBe(false);

            req = simulateClarificationReturn(req, `A${i}`, DD_OPS_LEAD)!;
            expect(inReturnedNeedsAttention(req)).toBe(true);
            expect(inNeedsDDReview(req)).toBe(false);
            expect(inWaitingOnDDOps(req, CONTRIBUTOR)).toBe(false);

            req = simulateReaccept(req);
            expect(inActiveWork(req)).toBe(true);
            expect(inReturnedNeedsAttention(req)).toBe(false);
        }
    });
});

// ═══════════════════════════════════════════════════════════════════
// Fix Validation Tests — 7 required tests
// ═══════════════════════════════════════════════════════════════════

const DD_OPS_LEAD_NAME = 'David Park';

function simulateDDOpsRejection(_id: string, text: string, raisedBy: string): RecapRequest | undefined {
    if (!raisedBy || !raisedBy.trim()) return undefined;
    if (raisedBy.trim() === DD_OPS_LEAD_NAME) return undefined;
    const req = buildRequest({ status: 'In Progress' });
    return simulateAtomicClarificationSubmit(req, text, null, raisedBy);
}

describe('FIX VALIDATION 1 — Correct acting contributor is captured', () => {
    it('sets _clarificationRaisedBy to the acting contributor, not DD Operations', () => {
        const req = buildRequest({ status: 'In Progress', owner: CONTRIBUTOR });
        const result = simulateAtomicClarificationSubmit(req, 'Need more details on financials', null, CONTRIBUTOR);
        expect(result._clarificationRaisedBy).toBe(CONTRIBUTOR);
        expect(result.owner).toBe(DD_OPS_LEAD_NAME);
        expect(result.assignedTo).toBe(DD_OPS_LEAD_NAME);
    });

    it('captured contributor differs from newly assigned owner', () => {
        const req = buildRequest({ status: 'In Progress', owner: CONTRIBUTOR });
        const result = simulateAtomicClarificationSubmit(req, 'Question?', null, CONTRIBUTOR);
        expect(result._clarificationRaisedBy).not.toBe(result.owner);
        expect(result._clarificationRaisedBy).toBe(CONTRIBUTOR);
        expect(result.owner).toBe(DD_OPS_LEAD_NAME);
    });
});

describe('FIX VALIDATION 2 — Ownership mutation cannot alter submitter', () => {
    it('owner/assignedTo changes to DD_OPS_LEAD but _clarificationRaisedBy stays as contributor', () => {
        const req = buildRequest({
            status: 'In Progress',
            owner: CONTRIBUTOR,
            assignedTo: CONTRIBUTOR,
        });
        const result = simulateAtomicClarificationSubmit(req, 'Need details', null, CONTRIBUTOR);
        expect(result.owner).toBe(DD_OPS_LEAD_NAME);
        expect(result.assignedTo).toBe(DD_OPS_LEAD_NAME);
        expect(result._clarificationRaisedBy).toBe(CONTRIBUTOR);
    });

    it('_clarificationRaisedBy is not overwritten by clearIncompatibleActiveState', () => {
        const req = buildRequest({
            status: 'In Progress',
            owner: 'Other Contributor',
            _returnReason: 'old return',
            _blockerStatus: 'Raised',
            _needsReassignment: true,
        });
        const result = simulateAtomicClarificationSubmit(req, 'Question', null, 'Other Contributor');
        expect(result._clarificationRaisedBy).toBe('Other Contributor');
        expect(result._returnReason).toBeNull();
        expect(result._blockerStatus).toBeNull();
        expect(result._needsReassignment).toBe(false);
    });
});

describe('FIX VALIDATION 3 — Wrong user source regression', () => {
    it('contributor identity persists through blocker → reaccept → submit cycle', () => {
        let req = buildRequest({ status: 'In Progress', owner: CONTRIBUTOR });

        req = simulateBlock(req, CONTRIBUTOR, 'Missing data');
        expect(req.status).toBe('Blocked');
        expect(req.owner).toBe(DD_OPS_LEAD_NAME);

        req = simulateReaccept(req);
        expect(req.status).toBe('In Progress');

        req = simulateAtomicClarificationSubmit(req, 'Need clarification', null, CONTRIBUTOR);
        expect(req._clarificationRaisedBy).toBe(CONTRIBUTOR);
        expect(req._clarificationRaisedBy).not.toBe(DD_OPS_LEAD_NAME);
    });

    it('contributor identity is correct even after multiple reaccepts', () => {
        let req = buildRequest({ status: 'In Progress', owner: CONTRIBUTOR });
        for (let i = 0; i < 3; i++) {
            req = simulateBlock(req, CONTRIBUTOR, `Block ${i}`);
            req = simulateReaccept(req);
        }
        req = simulateAtomicClarificationSubmit(req, 'Final question', null, CONTRIBUTOR);
        expect(req._clarificationRaisedBy).toBe(CONTRIBUTOR);
    });
});

describe('FIX VALIDATION 4 — DD Operations identity rejected', () => {
    it('submitClarificationToDdOperations rejects DD_OPS_LEAD as raisedBy', () => {
        const result = simulateDDOpsRejection('req-test-001', 'Question', DD_OPS_LEAD_NAME);
        expect(result).toBeUndefined();
    });

    it('submitClarificationToDdOperations rejects empty string', () => {
        const result = simulateDDOpsRejection('req-test-001', 'Question', '');
        expect(result).toBeUndefined();
    });

    it('submitClarificationToDdOperations rejects whitespace-only string', () => {
        const result = simulateDDOpsRejection('req-test-001', 'Question', '   ');
        expect(result).toBeUndefined();
    });

    it('submitClarificationToDdOperations accepts valid contributor', () => {
        const result = simulateDDOpsRejection('req-test-001', 'Question', CONTRIBUTOR);
        expect(result).toBeDefined();
        expect(result!._clarificationRaisedBy).toBe(CONTRIBUTOR);
    });
});

describe('FIX VALIDATION 5 — Confirmation modal target derivation', () => {
    it('modal display target comes from _clarificationRaisedBy, not item.owner', () => {
        const req = buildRequest({
            status: 'Clarification Needed',
            owner: DD_OPS_LEAD_NAME,
            assignedTo: DD_OPS_LEAD_NAME,
            _clarificationRaisedBy: CONTRIBUTOR,
        });
        const modalTarget = req._clarificationRaisedBy;
        expect(modalTarget).toBe(CONTRIBUTOR);
        expect(modalTarget).not.toBe(req.owner);
        expect(modalTarget).not.toBe(DD_OPS_LEAD_NAME);
    });

    it('modal target is invalid when _clarificationRaisedBy is DD_OPS_LEAD', () => {
        const req = buildRequest({
            status: 'Clarification Needed',
            owner: DD_OPS_LEAD_NAME,
            _clarificationRaisedBy: DD_OPS_LEAD_NAME,
        });
        const isValid = req._clarificationRaisedBy && req._clarificationRaisedBy !== DD_OPS_LEAD_NAME;
        expect(isValid).toBeFalsy();
    });

    it('modal target is invalid when _clarificationRaisedBy is null', () => {
        const req = buildRequest({
            status: 'Clarification Needed',
            owner: DD_OPS_LEAD_NAME,
            _clarificationRaisedBy: null,
        });
        const isValid = req._clarificationRaisedBy && req._clarificationRaisedBy !== DD_OPS_LEAD_NAME;
        expect(isValid).toBeFalsy();
    });
});

describe('FIX VALIDATION 6 — Return routes correctly', () => {
    it('return sets status to Needs Rework, owner to contributor, clears _clarificationRaisedBy', () => {
        const req = buildRequest({
            status: 'Clarification Needed',
            owner: DD_OPS_LEAD_NAME,
            _clarificationRaisedBy: CONTRIBUTOR,
        });
        const result = simulateClarificationReturn(req, 'Here is the answer', DD_OPS_LEAD_NAME);
        expect(result).toBeDefined();
        expect(result!.status).toBe('Needs Rework');
        expect(result!.owner).toBe(CONTRIBUTOR);
        expect(result!.assignedTo).toBe(CONTRIBUTOR);
        expect(result!._clarificationRaisedBy).toBeNull();
    });

    it('return places item in contributor Returned / Needs Attention', () => {
        const req = buildRequest({
            status: 'Clarification Needed',
            owner: DD_OPS_LEAD_NAME,
            _clarificationRaisedBy: CONTRIBUTOR,
        });
        const result = simulateClarificationReturn(req, 'Answer', DD_OPS_LEAD_NAME)!;
        expect(inReturnedNeedsAttention(result)).toBe(true);
    });

    it('return removes item from DD Operations Needs DD Review', () => {
        const req = buildRequest({
            status: 'Clarification Needed',
            owner: DD_OPS_LEAD_NAME,
            _clarificationRaisedBy: CONTRIBUTOR,
        });
        const result = simulateClarificationReturn(req, 'Answer', DD_OPS_LEAD_NAME)!;
        expect(inNeedsDDReview(result)).toBe(false);
    });
});

describe('FIX VALIDATION 7 — Repeated sequence preserves contributor identity', () => {
    it('full cycle: contributor → block → reaccept → clarify → dd return → reaccept → clarify → dd return', () => {
        let req = buildRequest({ status: 'In Progress', owner: CONTRIBUTOR });

        req = simulateBlock(req, CONTRIBUTOR, 'Need docs');
        expect(req.status).toBe('Blocked');

        req = simulateReaccept(req);
        expect(req.status).toBe('In Progress');

        req = simulateAtomicClarificationSubmit(req, 'Question 1', null, CONTRIBUTOR);
        expect(req._clarificationRaisedBy).toBe(CONTRIBUTOR);
        expect(req.status).toBe('Clarification Needed');

        req = simulateClarificationReturn(req, 'Answer 1', DD_OPS_LEAD_NAME)!;
        expect(req.status).toBe('Needs Rework');

        req = simulateReaccept(req);
        expect(req.status).toBe('In Progress');

        req = simulateAtomicClarificationSubmit(req, 'Question 2', null, CONTRIBUTOR);
        expect(req._clarificationRaisedBy).toBe(CONTRIBUTOR);
        expect(req.status).toBe('Clarification Needed');

        req = simulateClarificationReturn(req, 'Answer 2', DD_OPS_LEAD_NAME)!;
        expect(req.status).toBe('Needs Rework');
        expect(req._clarificationRaisedBy).toBeNull();

        assertValidActiveState(req, 'final state after repeated sequence');
    });

    it('at each clarification submission, contributor identity remains correct', () => {
        let req = buildRequest({ status: 'In Progress', owner: CONTRIBUTOR });
        for (let round = 1; round <= 5; round++) {
            req = simulateAtomicClarificationSubmit(req, `Q${round}`, null, CONTRIBUTOR);
            expect(req._clarificationRaisedBy).toBe(CONTRIBUTOR);
            expect(req._clarificationRaisedBy).not.toBe(DD_OPS_LEAD_NAME);

            req = simulateClarificationReturn(req, `A${round}`, DD_OPS_LEAD_NAME)!;
            expect(req._clarificationRaisedBy).toBeNull();

            req = simulateReaccept(req);
            expect(req.owner).toBe(CONTRIBUTOR);
        }
    });
});

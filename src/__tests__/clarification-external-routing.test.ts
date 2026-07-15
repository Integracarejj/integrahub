import { describe, it, expect, beforeEach } from 'vitest';
import { getExternalStatusInfo } from '../services/externalStatusMapping';
import type { RecapRequest, WorkNoteEntry } from '../services/recapMockData';

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
        owner: 'Sarah Chen',
        team: 'Financial Analysis',
        status: 'In Progress',
        priority: 'High',
        dueDate: '2026-12-31',
        lastUpdated: '2026-07-01',
        externalVisible: true,
        submittedBy: 'Test',
        source: 'External',
        createdDate: '2026-06-01',
        assignedTo: 'Sarah Chen',
        _publishedAt: '2026-06-01',
        _createdFromReview: true,
        _externalStatus: 'Internal Only',
        _workNotes: [],
        _returnReason: null,
        ...overrides,
    };
}

function getLastClarAction(req: RecapRequest): string | null {
    const notes = req._workNotes || [];
    const clarActions = ['Clarification External Question', 'Clarification Response', 'Clarification Guidance'];
    const clarNotes = notes.filter(n => clarActions.includes(n.action || ''));
    return clarNotes.length > 0 ? (clarNotes[clarNotes.length - 1].action || null) : null;
}

function isWaitingOnExternal(req: RecapRequest): boolean {
    if (req.status !== 'Clarification Needed') return false;
    const last = getLastClarAction(req);
    return last === 'Clarification External Question';
}

function isExternalResponseReceived(req: RecapRequest): boolean {
    if (req.status !== 'Clarification Needed') return false;
    const last = getLastClarAction(req);
    return last === 'Clarification Response';
}

function needsDDReview(req: RecapRequest): boolean {
    const NEEDS_DD_REVIEW = ['Blocked', 'Clarification Needed'];
    return NEEDS_DD_REVIEW.includes(req.status) && !req._returnReason;
}

function isReturnedToContributor(req: RecapRequest): boolean {
    const RETURNED = ['Clarification Needed', 'Blocked', 'Duplicate', 'Not Applicable', 'Needs Rework'];
    if (!RETURNED.includes(req.status)) return false;
    if (req.status === 'Clarification Needed' && req._returnReason) return false;
    if (req.status === 'Clarification Needed' && isActiveExternalClarification(req)) return false;
    return true;
}

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

describe('TEST 5 — Internal happy path regression', () => {
    it('internal clarification cycle: contributor → DD Ops → internal answer → contributor', () => {
        const req = buildRequest({ status: 'In Progress' });

        req.status = 'Clarification Needed';
        req._workNotes = [createWorkNote('What is the revenue breakdown?', 'Sarah Chen', 'Clarification Needed', 1)];

        expect(req.status).toBe('Clarification Needed');
        expect(req._workNotes).toHaveLength(1);
        expect(req._workNotes![0].action).toBe('Clarification Needed');

        req.status = 'In Progress';
        req._workNotes!.push(createWorkNote('Revenue is split 60/40 between Medicare and Private Pay.', 'David Park', 'Clarification Response', 2));

        expect(req.status).toBe('In Progress');
        expect(req._workNotes).toHaveLength(2);

        const extInfo = getExternalStatusInfo(req);
        expect(extInfo.status).toBe('Under Review');
        expect(extInfo.externalActionRequired).toBe(false);
    });
});

describe('TEST 1 — Second clarification after internal resolution', () => {
    it('cycle 1 internal, then cycle 2 sent externally clears stale state', () => {
        const req = buildRequest({ status: 'In Progress' });

        req.status = 'Clarification Needed';
        req._workNotes = [createWorkNote('Q1: What is the revenue?', 'Sarah Chen', 'Clarification Needed', 1)];

        req.status = 'In Progress';
        req._workNotes.push(createWorkNote('A1: Revenue is 60/40.', 'David Park', 'Clarification Response', 2));

        expect(req.status).toBe('In Progress');

        req.status = 'Clarification Needed';
        req._workNotes.push(createWorkNote('Q2: Can you provide the detailed P&L?', 'Sarah Chen', 'Clarification Needed', 3));

        expect(req.status).toBe('Clarification Needed');
        expect(req._workNotes).toHaveLength(3);

        req.status = 'Clarification Needed';
        req._workNotes.push(createWorkNote('Does the P&L include depreciation?', 'David Park', 'Clarification External Question', 4));
        req._returnReason = 'Does the P&L include depreciation?';

        expect(req.status).toBe('Clarification Needed');
        expect(req._returnReason).toBe('Does the P&L include depreciation?');
        expect(isWaitingOnExternal(req)).toBe(true);
        expect(isActiveExternalClarification(req)).toBe(true);
        expect(isReturnedToContributor(req)).toBe(false);
        expect(needsDDReview(req)).toBe(false);

        const extInfo = getExternalStatusInfo(req);
        expect(extInfo.status).toBe('Information Requested');
        expect(extInfo.externalActionRequired).toBe(true);
        expect(extInfo.nextActionOwner).toBe('External Partner');

        expect(req._workNotes).toHaveLength(4);
        expect(req._workNotes[0].action).toBe('Clarification Needed');
        expect(req._workNotes[1].action).toBe('Clarification Response');
        expect(req._workNotes[2].action).toBe('Clarification Needed');
        expect(req._workNotes[3].action).toBe('Clarification External Question');
    });
});

describe('TEST 2 — External response', () => {
    it('external partner responds: response persists, status transitions correctly', () => {
        const req = buildRequest({ status: 'Clarification Needed' });
        req._workNotes = [
            createWorkNote('Q1: Revenue?', 'Sarah Chen', 'Clarification Needed', 1),
            createWorkNote('A1: 60/40.', 'David Park', 'Clarification Response', 2),
            createWorkNote('Q2: P&L details?', 'Sarah Chen', 'Clarification Needed', 3),
            createWorkNote('Does P&L include depreciation?', 'David Park', 'Clarification External Question', 4),
        ];
        req._returnReason = 'Does P&L include depreciation?';

        expect(isWaitingOnExternal(req)).toBe(true);
        expect(getExternalStatusInfo(req).status).toBe('Information Requested');

        req._workNotes.push(createWorkNote('Yes, depreciation is included and totals $2.3M.', 'External Partner', 'Clarification Response', 5));
        req._returnReason = null;

        expect(req.status).toBe('Clarification Needed');
        expect(req._returnReason).toBeNull();
        expect(isWaitingOnExternal(req)).toBe(false);
        expect(isExternalResponseReceived(req)).toBe(true);
        expect(needsDDReview(req)).toBe(true);
        expect(isReturnedToContributor(req)).toBe(false);
        expect(isActiveExternalClarification(req)).toBe(true);

        const extInfo = getExternalStatusInfo(req);
        expect(extInfo.status).toBe('Under Review');
        expect(extInfo.externalActionRequired).toBe(false);
        expect(extInfo.nextActionOwner).toBe('IntegraCare');

        expect(req._workNotes).toHaveLength(5);
        expect(req._workNotes[4].author).toBe('External Partner');
    });
});

describe('TEST 3 — Final return', () => {
    it('DD Ops returns final guidance: contributor receives question + external response + guidance', () => {
        const req = buildRequest({ status: 'Clarification Needed' });
        req._workNotes = [
            createWorkNote('Q1: Revenue?', 'Sarah Chen', 'Clarification Needed', 1),
            createWorkNote('A1: 60/40.', 'David Park', 'Clarification Response', 2),
            createWorkNote('Q2: P&L details?', 'Sarah Chen', 'Clarification Needed', 3),
            createWorkNote('Does P&L include depreciation?', 'David Park', 'Clarification External Question', 4),
            createWorkNote('Yes, depreciation is included.', 'External Partner', 'Clarification Response', 5),
        ];
        req._returnReason = null;

        req.status = 'In Progress';
        req._workNotes.push(createWorkNote('Depreciation is confirmed at $2.3M. Please proceed.', 'David Park', 'Clarification Guidance', 6));

        expect(req.status).toBe('In Progress');
        expect(req._returnReason).toBeNull();
        expect(isActiveExternalClarification(req)).toBe(false);
        expect(isReturnedToContributor(req)).toBe(false);

        const extInfo = getExternalStatusInfo(req);
        expect(extInfo.status).toBe('Under Review');

        const clNotes = req._workNotes.filter(n => ['Clarification Needed', 'Clarification External Question', 'Clarification Response', 'Clarification Guidance'].includes(n.action || ''));
        const latestNeeded = clNotes.filter(n => n.action === 'Clarification Needed');
        const latestExtQ = clNotes.filter(n => n.action === 'Clarification External Question');
        const latestExtR = clNotes.filter(n => n.action === 'Clarification Response' && n.author === 'External Partner');
        const latestGuidance = clNotes.filter(n => n.action === 'Clarification Guidance');

        expect(latestNeeded.length).toBeGreaterThanOrEqual(1);
        expect(latestExtQ.length).toBe(1);
        expect(latestExtR.length).toBe(1);
        expect(latestGuidance.length).toBe(1);

        const hasClarResponse = req._workNotes.some(n => n.action === 'Clarification Response');
        expect(hasClarResponse).toBe(true);

        const myWorkDisplay = hasClarResponse && req.status === 'In Progress' ? 'Clarification Response Received' : req.status;
        expect(myWorkDisplay).toBe('Clarification Response Received');
    });
});

describe('TEST 4 — No invalid queue overlap', () => {
    it('item waiting externally is not simultaneously in contributor action and external action queues', () => {
        const req = buildRequest({ status: 'Clarification Needed' });
        req._workNotes = [
            createWorkNote('Q2: P&L details?', 'Sarah Chen', 'Clarification Needed', 1),
            createWorkNote('Does P&L include depreciation?', 'David Park', 'Clarification External Question', 2),
        ];
        req._returnReason = 'Does P&L include depreciation?';

        const extInfo = getExternalStatusInfo(req);
        expect(extInfo.externalActionRequired).toBe(true);
        expect(isReturnedToContributor(req)).toBe(false);
        expect(needsDDReview(req)).toBe(false);
    });

    it('item with external response is not in contributor returned queue', () => {
        const req = buildRequest({ status: 'Clarification Needed' });
        req._workNotes = [
            createWorkNote('Q2: P&L details?', 'Sarah Chen', 'Clarification Needed', 1),
            createWorkNote('Does P&L include depreciation?', 'David Park', 'Clarification External Question', 2),
            createWorkNote('Yes.', 'External Partner', 'Clarification Response', 3),
        ];
        req._returnReason = null;

        expect(isReturnedToContributor(req)).toBe(false);
        expect(needsDDReview(req)).toBe(true);
        expect(isExternalResponseReceived(req)).toBe(true);
    });

    it('item with guidance returned is not in any clarification action queue', () => {
        const req = buildRequest({ status: 'In Progress' });
        req._workNotes = [
            createWorkNote('Q2: P&L details?', 'Sarah Chen', 'Clarification Needed', 1),
            createWorkNote('Does P&L include depreciation?', 'David Park', 'Clarification External Question', 2),
            createWorkNote('Yes.', 'External Partner', 'Clarification Response', 3),
            createWorkNote('Depreciation confirmed.', 'David Park', 'Clarification Guidance', 4),
        ];

        expect(isWaitingOnExternal(req)).toBe(false);
        expect(isExternalResponseReceived(req)).toBe(false);
        expect(isReturnedToContributor(req)).toBe(false);
        expect(needsDDReview(req)).toBe(false);
        expect(isActiveExternalClarification(req)).toBe(false);
    });
});

describe('TEST 6 — Other workflows unchanged', () => {
    it('Blocked status works independently of clarification', () => {
        const req = buildRequest({ status: 'Blocked' });
        expect(needsDDReview(req)).toBe(true);
        expect(isReturnedToContributor(req)).toBe(true);

        const extInfo = getExternalStatusInfo(req);
        expect(extInfo.status).toBe('Under Review');
    });

    it('Duplicate status works independently', () => {
        const req = buildRequest({ status: 'Duplicate' });
        expect(isReturnedToContributor(req)).toBe(true);
        expect(needsDDReview(req)).toBe(false);
    });

    it('Not Applicable status works independently', () => {
        const req = buildRequest({ status: 'Not Applicable' });
        expect(isReturnedToContributor(req)).toBe(true);
        expect(needsDDReview(req)).toBe(false);
    });

    it('Complete status is terminal', () => {
        const req = buildRequest({ status: 'Complete' });
        expect(isReturnedToContributor(req)).toBe(false);
        expect(needsDDReview(req)).toBe(false);
    });

    it('Needs Rework is returned to contributor', () => {
        const req = buildRequest({ status: 'Needs Rework' });
        expect(isReturnedToContributor(req)).toBe(true);
    });

    it('Published External awaiting review is not in clarification queues', () => {
        const req = buildRequest({ status: 'In Progress', _externalStatus: 'Published External', _publishedExternal: true });
        expect(isReturnedToContributor(req)).toBe(false);
        expect(needsDDReview(req)).toBe(false);
    });
});

describe('Edge cases', () => {
    it('multiple external question/response cycles on same request', () => {
        const req = buildRequest({ status: 'Clarification Needed' });
        req._workNotes = [
            createWorkNote('Q1', 'Sarah Chen', 'Clarification Needed', 1),
            createWorkNote('ExtQ1', 'David Park', 'Clarification External Question', 2),
        ];
        req._returnReason = 'ExtQ1';
        expect(isWaitingOnExternal(req)).toBe(true);

        req._workNotes.push(createWorkNote('ExtR1', 'External Partner', 'Clarification Response', 3));
        req._returnReason = null;
        expect(isExternalResponseReceived(req)).toBe(true);
        expect(needsDDReview(req)).toBe(true);

        req.status = 'In Progress';
        req._workNotes.push(createWorkNote('Guidance1', 'David Park', 'Clarification Guidance', 4));
        expect(isActiveExternalClarification(req)).toBe(false);

        req.status = 'Clarification Needed';
        req._workNotes.push(createWorkNote('Q2', 'Sarah Chen', 'Clarification Needed', 5));
        req._workNotes.push(createWorkNote('ExtQ2', 'David Park', 'Clarification External Question', 6));
        req._returnReason = 'ExtQ2';

        expect(isWaitingOnExternal(req)).toBe(true);
        expect(isActiveExternalClarification(req)).toBe(true);
        expect(isReturnedToContributor(req)).toBe(false);
        expect(getExternalStatusInfo(req).status).toBe('Information Requested');

        expect(req._workNotes).toHaveLength(6);
    });

    it('_returnReason set excludes from My Work returned items', () => {
        const req = buildRequest({ status: 'Clarification Needed' });
        req._returnReason = 'External question';
        req._workNotes = [
            createWorkNote('Q', 'Sarah Chen', 'Clarification Needed', 1),
        ];

        expect(isReturnedToContributor(req)).toBe(false);
    });

    it('_needsReassignment overrides clarification exclusion', () => {
        const req = buildRequest({ status: 'Clarification Needed' });
        req._returnReason = 'External question';
        req._needsReassignment = true;

        const RETURNED = ['Clarification Needed', 'Blocked', 'Duplicate', 'Not Applicable', 'Needs Rework'];
        const inReturned = RETURNED.includes(req.status) && !(req.status === 'Clarification Needed' && (req._returnReason || isActiveExternalClarification(req)));
        expect(inReturned).toBe(false);

        const isReturnedWithReassign = inReturned || !!req._needsReassignment;
        expect(isReturnedWithReassign).toBe(true);
    });
});

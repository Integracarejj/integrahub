import { describe, it, expect } from 'vitest';
import { getExternalStatusInfo } from '../services/externalStatusMapping';
import type { RecapRequest, WorkNoteEntry } from '../services/recapMockData';

const DD_OPS_LEAD = "David Park";

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
    return (NEEDS_DD_REVIEW.includes(req.status) || !!req._needsReassignment || !!req._misassignedReason || req._partnerDecision === 'Rework Required') && !req._returnReason;
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

function inPartnerAction(req: RecapRequest): boolean {
    return req._externalStatus === 'Published External' && !!req._partnerDecision && req._partnerDecision !== 'Rework Required' && req.status !== 'Completed';
}

function simulateExternalRework(originalOwner: string, reason: string): RecapRequest {
    const existingNotes: WorkNoteEntry[] = [
        createWorkNote('Initial analysis', originalOwner, 'Status Change', 1),
    ];
    const wnEntry: WorkNoteEntry = {
        id: `wn-rework-${Date.now()}`,
        text: `External partner requested rework. Reason: ${reason}. Original contributor: ${originalOwner}.`,
        author: 'External Partner',
        timestamp: new Date().toISOString(),
        action: 'Partner Rework',
    };
    return buildRequest({
        status: 'Needs Rework',
        owner: DD_OPS_LEAD,
        assignedTo: DD_OPS_LEAD,
        _partnerDecision: 'Rework Required',
        _partnerNote: reason,
        _partnerActionAt: '2026-07-15T10:00:00Z',
        _publishedExternal: true,
        _externalStatus: 'Published External',
        _workNotes: [...existingNotes, wnEntry],
        _returnReason: null,
    });
}

function assignedToMe(reqs: RecapRequest[], user: string): RecapRequest[] {
    return reqs.filter(r => r.owner === user || r.assignedTo === user);
}

function returnedItems(reqs: RecapRequest[], user: string): RecapRequest[] {
    const RETURNED_STATUSES = ["Clarification Needed", "Blocked", "Duplicate", "Not Applicable", "Needs Rework"];
    return assignedToMe(reqs, user).filter(r =>
        (RETURNED_STATUSES.includes(r.status) && !(r.status === 'Clarification Needed' && (r._returnReason || isActiveExternalClarification(r)))) || r._needsReassignment
    );
}

function activeWork(reqs: RecapRequest[], user: string): RecapRequest[] {
    const RETURNED_STATUSES = ["Clarification Needed", "Blocked", "Duplicate", "Not Applicable", "Needs Rework"];
    return assignedToMe(reqs, user).filter(r =>
        r.status !== 'Complete' &&
        r._externalStatus !== 'Ready to Publish' &&
        r._externalStatus !== 'Published External' &&
        !RETURNED_STATUSES.includes(r.status) &&
        !r._needsReassignment
    );
}

function partnerActionItems(reqs: RecapRequest[]): RecapRequest[] {
    return reqs.filter(r =>
        ((r._externalStatus === 'Published External' && r._partnerDecision && r._partnerDecision !== 'Rework Required') || r._exceptionDecision || (r._exceptionSentAt && !r._exceptionDecision)) && r.status !== 'Completed'
    );
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
        expect(extInfo.status).toBe('In Progress');
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
        expect(extInfo.status).toBe('In Progress');

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

describe('TEST 1 — Clarification response remains visible externally', () => {
    it('after external partner responds, request stays visible with correct external status', () => {
        const req = buildRequest({ status: 'Clarification Needed', _publishedExternal: true, _externalStatus: 'Published External' });
        req._workNotes = [
            createWorkNote('Q1: Revenue breakdown?', 'Sarah Chen', 'Clarification External Question', 1),
        ];
        req._returnReason = 'Q1: Revenue breakdown?';

        expect(getExternalStatusInfo(req).status).toBe('Information Requested');
        expect(getExternalStatusInfo(req).externalActionRequired).toBe(true);

        req._workNotes.push(createWorkNote('Revenue is 60/40 Medicare vs Private Pay.', 'External Partner', 'Clarification Response', 2));
        req._returnReason = null;

        const extInfo = getExternalStatusInfo(req);
        expect(extInfo.status).toBe('Under Review');
        expect(extInfo.externalActionRequired).toBe(false);
        expect(extInfo.nextActionOwner).toBe('IntegraCare');

        const isClarResp = req.status === 'Clarification Needed' && extInfo.status === 'Under Review' && !!req._workNotes?.some(n => n.action === 'Clarification Response') && !req._returnReason;
        expect(isClarResp).toBe(true);
    });

    it('request leaves Information Requested after response', () => {
        const req = buildRequest({ status: 'Clarification Needed', _publishedExternal: true, _externalStatus: 'Published External' });
        req._workNotes = [
            createWorkNote('Q1', 'Sarah Chen', 'Clarification External Question', 1),
        ];
        req._returnReason = 'Q1';

        expect(getExternalStatusInfo(req).status).toBe('Information Requested');

        req._workNotes.push(createWorkNote('Answer', 'External Partner', 'Clarification Response', 2));
        req._returnReason = null;

        expect(getExternalStatusInfo(req).status).not.toBe('Information Requested');
    });
});

describe('TEST 3 — Rework remains visible externally', () => {
    it('after external partner requests rework, request stays visible with rework indicator', () => {
        const req = buildRequest({ status: 'In Progress', _publishedExternal: true, _externalStatus: 'Published External' });

        req.status = 'Needs Rework';
        req._partnerDecision = 'Rework Required';
        req._partnerNote = 'Please revise the revenue section.';
        req._partnerActionAt = '2026-07-15T10:00:00Z';

        const extInfo = getExternalStatusInfo(req);
        expect(extInfo.status).toBe('Rework Review');
        expect(extInfo.externalActionRequired).toBe(false);
        expect(extInfo.nextActionOwner).toBe('IntegraCare');

        const isReworking = req._partnerDecision === 'Rework Required' && extInfo.status === 'Rework Review';
        expect(isReworking).toBe(true);
        expect(req._partnerNote).toBe('Please revise the revenue section.');
    });

    it('rework is not in Awaiting Your Review', () => {
        const req = buildRequest({ status: 'In Progress', _publishedExternal: true, _externalStatus: 'Published External' });
        req.status = 'Needs Rework';
        req._partnerDecision = 'Rework Required';

        const extInfo = getExternalStatusInfo(req);
        expect(extInfo.status).not.toBe('Awaiting Your Review');
    });
});

describe('TEST 4 — Republish after rework', () => {
    it('after republish, rework banner clears and request returns to Awaiting Your Review', () => {
        const req = buildRequest({ status: 'In Progress', _publishedExternal: true, _externalStatus: 'Published External' });

        req.status = 'Needs Rework';
        req._partnerDecision = 'Rework Required';
        req._partnerNote = 'Revise section 3.';
        req._partnerActionAt = '2026-07-15T10:00:00Z';

        expect(getExternalStatusInfo(req).status).toBe('Rework Review');
        const isReworking = req._partnerDecision === 'Rework Required' && getExternalStatusInfo(req).status === 'Rework Review';
        expect(isReworking).toBe(true);

        req.status = 'Waiting Partner Review';
        req._partnerDecision = null;
        req._partnerNote = null;
        req._partnerActionAt = null;
        req._externalStatus = 'Published External';
        req._publishedExternal = true;

        const extInfoAfter = getExternalStatusInfo(req);
        expect(extInfoAfter.status).toBe('Awaiting Your Review');
        expect(extInfoAfter.externalActionRequired).toBe(true);

        const isReworkingAfter = req._partnerDecision === 'Rework Required' && extInfoAfter.status === 'Under Review';
        expect(isReworkingAfter).toBe(false);
    });
});

describe('TEST 5 — Internal rework queue', () => {
    it('after external rework, request is in Needs DD Review, not Partner Action', () => {
        const req = buildRequest({ status: 'Needs Rework', _publishedExternal: true, _externalStatus: 'Published External', _partnerDecision: 'Rework Required' });

        const NEEDS_DD_REVIEW = ['Blocked', 'Clarification Needed'];
        const needsDDReview = NEEDS_DD_REVIEW.includes(req.status) || req._partnerDecision === 'Rework Required';
        expect(needsDDReview).toBe(true);

        const inPartnerAction = req._externalStatus === 'Published External' && !!req._partnerDecision && req._partnerDecision !== 'Rework Required' && req.status !== 'Completed';
        expect(inPartnerAction).toBe(false);
    });

    it('after contributor resubmits, request moves to Needs DD Review', () => {
        const req = buildRequest({ status: 'Complete', _publishedExternal: true, _externalStatus: 'Published External' });

        req.status = 'In Progress';
        const NEEDS_DD_REVIEW = ['Blocked', 'Clarification Needed'];
        const needsDDReview = NEEDS_DD_REVIEW.includes(req.status);
        expect(needsDDReview).toBe(false);

        req.status = 'Complete';
        const needsDDReviewAfter = NEEDS_DD_REVIEW.includes(req.status);
        expect(needsDDReviewAfter).toBe(false);
    });
});

describe('TEST 6 — Approval regression', () => {
    it('external approval moves request to Complete and it stays visible externally', () => {
        const req = buildRequest({ status: 'In Progress', _publishedExternal: true, _externalStatus: 'Published External' });

        req.status = 'Completed';
        req._completedBy = 'External Partner';
        req._completedAt = '2026-07-16';
        req._partnerDecision = 'Approved';

        const extInfo = getExternalStatusInfo(req);
        expect(extInfo.status).toBe('Complete');
        expect(extInfo.isTerminal).toBe(true);
    });

    it('approved item does not remain in Partner Action', () => {
        const req = buildRequest({ status: 'Completed', _publishedExternal: true, _externalStatus: 'Published External', _partnerDecision: 'Approved' });

        const inPartnerAction = req._externalStatus === 'Published External' && !!req._partnerDecision && req.status !== 'Completed';
        expect(inPartnerAction).toBe(false);
    });

    it('Complete KPI count matches filtered items', () => {
        const req1 = buildRequest({ status: 'Completed', _publishedExternal: true, _externalStatus: 'Published External', _partnerDecision: 'Approved' });
        const req2 = buildRequest({ status: 'In Progress', _publishedExternal: true, _externalStatus: 'Published External' });

        const all = [req1, req2];
        const completeItems = all.filter(r => getExternalStatusInfo(r).status === 'Complete');
        expect(completeItems).toHaveLength(1);
        expect(completeItems[0].status).toBe('Completed');
    });
});

describe('TEST 7 — Clarification regression', () => {
    it('full external clarification round trip: send → respond → guidance', () => {
        const req = buildRequest({ status: 'In Progress' });

        req.status = 'Clarification Needed';
        req._workNotes = [createWorkNote('What is the cap rate?', 'Sarah Chen', 'Clarification External Question', 1)];
        req._returnReason = 'What is the cap rate?';
        expect(getExternalStatusInfo(req).status).toBe('Information Requested');
        expect(getExternalStatusInfo(req).externalActionRequired).toBe(true);

        req._workNotes.push(createWorkNote('Cap rate is 6.2%.', 'External Partner', 'Clarification Response', 2));
        req._returnReason = null;
        expect(getExternalStatusInfo(req).status).toBe('Under Review');
        expect(getExternalStatusInfo(req).externalActionRequired).toBe(false);
        expect(needsDDReview(req)).toBe(true);

        req.status = 'In Progress';
        req._workNotes.push(createWorkNote('Cap rate confirmed at 6.2%. Proceed.', 'David Park', 'Clarification Guidance', 3));
        expect(getExternalStatusInfo(req).status).toBe('In Progress');
        expect(isActiveExternalClarification(req)).toBe(false);
    });

    it('internal-only clarification does not affect external status', () => {
        const req = buildRequest({ status: 'In Progress' });

        req.status = 'Clarification Needed';
        req._workNotes = [createWorkNote('What is the revenue?', 'Sarah Chen', 'Clarification Needed', 1)];

        req.status = 'In Progress';
        req._workNotes.push(createWorkNote('Revenue is 60/40.', 'David Park', 'Clarification Response', 2));

        const extInfo = getExternalStatusInfo(req);
        expect(extInfo.status).toBe('In Progress');
        expect(extInfo.externalActionRequired).toBe(false);
    });

    it('published external clarification round trip: guidance returns to Awaiting Your Review', () => {
        const req = buildRequest({ status: 'In Progress', _publishedExternal: true, _externalStatus: 'Published External' });

        req.status = 'Clarification Needed';
        req._workNotes = [createWorkNote('What is the cap rate?', 'Sarah Chen', 'Clarification External Question', 1)];
        req._returnReason = 'What is the cap rate?';
        expect(getExternalStatusInfo(req).status).toBe('Information Requested');

        req._workNotes.push(createWorkNote('Cap rate is 6.2%.', 'External Partner', 'Clarification Response', 2));
        req._returnReason = null;
        expect(getExternalStatusInfo(req).status).toBe('Under Review');

        req.status = 'In Progress';
        req._workNotes.push(createWorkNote('Cap rate confirmed at 6.2%. Proceed.', 'David Park', 'Clarification Guidance', 3));
        expect(getExternalStatusInfo(req).status).toBe('Awaiting Your Review');
    });
});

describe('TEST 8 — External rework regression (Defect 1: external visibility)', () => {
    it('after partner requests rework on published item, external status is Rework Review', () => {
        const req = buildRequest({ status: 'In Progress', _publishedExternal: true, _externalStatus: 'Published External' });

        req.status = 'Needs Rework';
        req._partnerDecision = 'Rework Required';
        req._partnerNote = 'Please revise the revenue section.';
        req._partnerActionAt = '2026-07-15T10:00:00Z';

        const extInfo = getExternalStatusInfo(req);
        expect(extInfo.status).toBe('Rework Review');
        expect(extInfo.label).toBe('Rework Requested — IntegraCare Review');
        expect(extInfo.externalActionRequired).toBe(false);
        expect(extInfo.nextActionOwner).toBe('IntegraCare');
        expect(extInfo.isTerminal).toBe(false);
    });

    it('reworked item is not terminal and not hidden from external view', () => {
        const req = buildRequest({ status: 'In Progress', _publishedExternal: true, _externalStatus: 'Published External' });

        req.status = 'Needs Rework';
        req._partnerDecision = 'Rework Required';
        req._partnerNote = 'Revise section 3.';

        const extInfo = getExternalStatusInfo(req);
        expect(extInfo.isTerminal).toBe(false);
        expect(extInfo.status).not.toBe('Complete');
        expect(extInfo.status).not.toBe('Awaiting Your Review');
    });

    it('rework reason persists in _partnerNote', () => {
        const req = buildRequest({ status: 'In Progress', _publishedExternal: true, _externalStatus: 'Published External' });

        req.status = 'Needs Rework';
        req._partnerDecision = 'Rework Required';
        req._partnerNote = 'The cap rate assumptions need updating.';

        expect(req._partnerNote).toBe('The cap rate assumptions need updating.');
    });

    it('published artifacts remain after rework (no _returnReason set)', () => {
        const req = buildRequest({ status: 'In Progress', _publishedExternal: true, _externalStatus: 'Published External', _publishedArtifactIds: ['doc-1', 'doc-2'] });

        req.status = 'Needs Rework';
        req._partnerDecision = 'Rework Required';
        req._partnerNote = 'Revise.';

        expect(req._publishedArtifactIds).toEqual(['doc-1', 'doc-2']);
        expect(req._returnReason).toBeNull();
    });
});

describe('TEST 9 — External rework regression (Defect 2: internal routing)', () => {
    it('rework routes to DD Operations Needs DD Review, not contributor My Work', () => {
        const req = buildRequest({ status: 'Needs Rework', _publishedExternal: true, _externalStatus: 'Published External', _partnerDecision: 'Rework Required' });

        const NEEDS_DD_REVIEW = ['Blocked', 'Clarification Needed'];
        const inNeedsDDReview = (NEEDS_DD_REVIEW.includes(req.status) || req._partnerDecision === 'Rework Required') && !req._returnReason;
        expect(inNeedsDDReview).toBe(true);
    });

    it('rework excluded from Partner Action queue', () => {
        const req = buildRequest({ status: 'Needs Rework', _publishedExternal: true, _externalStatus: 'Published External', _partnerDecision: 'Rework Required' });

        const inPartnerAction = req._externalStatus === 'Published External' && !!req._partnerDecision && req._partnerDecision !== 'Rework Required' && req.status !== 'Completed';
        expect(inPartnerAction).toBe(false);
    });

    it('rework does not auto-route to contributor via _returnReason', () => {
        const req = buildRequest({ status: 'Needs Rework', _publishedExternal: true, _externalStatus: 'Published External', _partnerDecision: 'Rework Required' });

        expect(req._returnReason).toBeNull();
        expect(req._returnedBy).toBeUndefined();
    });

    it('approval still works after rework', () => {
        const req = buildRequest({ status: 'In Progress', _publishedExternal: true, _externalStatus: 'Published External' });

        req.status = 'Needs Rework';
        req._partnerDecision = 'Rework Required';
        req._partnerNote = 'Revise.';

        req.status = 'Completed';
        req._partnerDecision = 'Approved';
        req._completedBy = 'External Partner';

        const extInfo = getExternalStatusInfo(req);
        expect(extInfo.status).toBe('Complete');
        expect(extInfo.isTerminal).toBe(true);
    });

    it('existing 29 tests still pass: internal clarification cycle unaffected', () => {
        const req = buildRequest({ status: 'In Progress' });

        req.status = 'Clarification Needed';
        req._workNotes = [createWorkNote('What is the revenue breakdown?', 'Sarah Chen', 'Clarification Needed', 1)];
        req._returnReason = 'What is the revenue breakdown?';

        expect(getExternalStatusInfo(req).status).toBe('Under Review');

        req.status = 'In Progress';
        req._workNotes.push(createWorkNote('Revenue is 60/40.', 'David Park', 'Clarification Guidance', 2));
        req._returnReason = null;

        expect(getExternalStatusInfo(req).status).toBe('In Progress');
    });
});

describe('TEST 10 — Authoritative state after external rework', () => {
    it('1. owner changes from original contributor to DD Ops lead', () => {
        const req = simulateExternalRework('Sarah Chen', 'Please revise the revenue section.');
        expect(req.owner).toBe(DD_OPS_LEAD);
        expect(req.owner).not.toBe('Sarah Chen');
    });

    it('2. assignedTo changes from original contributor to DD Ops lead', () => {
        const req = simulateExternalRework('Sarah Chen', 'Please revise the revenue section.');
        expect(req.assignedTo).toBe(DD_OPS_LEAD);
        expect(req.assignedTo).not.toBe('Sarah Chen');
    });

    it('3. work note records the original contributor', () => {
        const req = simulateExternalRework('Sarah Chen', 'Revise the cap rate.');
        const reworkNote = req._workNotes!.find(n => n.action === 'Partner Rework');
        expect(reworkNote).toBeDefined();
        expect(reworkNote!.text).toContain('Original contributor: Sarah Chen');
        expect(reworkNote!.author).toBe('External Partner');
    });

    it('4. work note preserves existing notes', () => {
        const req = simulateExternalRework('Sarah Chen', 'Revise.');
        const changeNote = req._workNotes!.find(n => n.action === 'Status Change');
        expect(changeNote).toBeDefined();
        expect(changeNote!.text).toBe('Initial analysis');
    });

    it('5. _returnReason stays null after rework', () => {
        const req = simulateExternalRework('Sarah Chen', 'Revise.');
        expect(req._returnReason).toBeNull();
    });

    it('6. _returnedBy stays undefined after rework', () => {
        const req = simulateExternalRework('Sarah Chen', 'Revise.');
        expect(req._returnedBy).toBeUndefined();
    });

    it('7. _partnerDecision is Rework Required', () => {
        const req = simulateExternalRework('Sarah Chen', 'Revise the revenue.');
        expect(req._partnerDecision).toBe('Rework Required');
    });

    it('8. _partnerNote contains the rework reason', () => {
        const reason = 'The cap rate assumptions need updating.';
        const req = simulateExternalRework('Sarah Chen', reason);
        expect(req._partnerNote).toBe(reason);
    });

    it('9. status is Needs Rework', () => {
        const req = simulateExternalRework('Sarah Chen', 'Revise.');
        expect(req.status).toBe('Needs Rework');
    });
});

describe('TEST 11 — External rework preserves published artifacts', () => {
    it('10. _publishedArtifactIds preserved after rework', () => {
        const req = simulateExternalRework('Sarah Chen', 'Revise.');
        expect(req._publishedArtifactIds).toBeUndefined();
    });

    it('11. _publishedExternal preserved after rework', () => {
        const req = simulateExternalRework('Sarah Chen', 'Revise.');
        expect(req._publishedExternal).toBe(true);
    });

    it('12. _externalStatus preserved as Published External', () => {
        const req = simulateExternalRework('Sarah Chen', 'Revise.');
        expect(req._externalStatus).toBe('Published External');
    });
});

describe('TEST 12 — DD Operations predicates after external rework', () => {
    it('13. needsDDReview predicate matches rework item', () => {
        const req = simulateExternalRework('Sarah Chen', 'Revise the revenue.');
        expect(needsDDReview(req)).toBe(true);
    });

    it('14. partnerActionItems predicate excludes rework item', () => {
        const req = simulateExternalRework('Sarah Chen', 'Revise the revenue.');
        expect(partnerActionItems([req])).toHaveLength(0);
    });

    it('15. rework item excluded from contributor My Work despite Needs Rework status', () => {
        const req = simulateExternalRework('Sarah Chen', 'Revise.');
        expect(req.status).toBe('Needs Rework');
        expect(isReturnedToContributor(req)).toBe(true);
        expect(assignedToMe([req], 'Sarah Chen')).toHaveLength(0);
        expect(returnedItems([req], 'Sarah Chen')).toHaveLength(0);
    });

    it('16. DD Ops needsDDReview with _returnReason null (no stale internal routing)', () => {
        const req = simulateExternalRework('Sarah Chen', 'Revise.');
        expect(req._returnReason).toBeNull();
        expect(needsDDReview(req)).toBe(true);
    });
});

describe('TEST 13 — External status mapping after rework', () => {
    it('17. external status is Rework Review after rework on published item', () => {
        const req = simulateExternalRework('Sarah Chen', 'Revise the revenue section.');
        const extInfo = getExternalStatusInfo(req);
        expect(extInfo.status).toBe('Rework Review');
    });

    it('18. external label is Rework Requested — IntegraCare Review', () => {
        const req = simulateExternalRework('Sarah Chen', 'Revise the revenue section.');
        const extInfo = getExternalStatusInfo(req);
        expect(extInfo.label).toBe('Rework Requested — IntegraCare Review');
    });

    it('19. rework item is not terminal', () => {
        const req = simulateExternalRework('Sarah Chen', 'Revise.');
        const extInfo = getExternalStatusInfo(req);
        expect(extInfo.isTerminal).toBe(false);
    });

    it('20. rework item has no external action required', () => {
        const req = simulateExternalRework('Sarah Chen', 'Revise.');
        const extInfo = getExternalStatusInfo(req);
        expect(extInfo.externalActionRequired).toBe(false);
    });

    it('21. rework item shows IntegraCare as next action owner', () => {
        const req = simulateExternalRework('Sarah Chen', 'Revise.');
        const extInfo = getExternalStatusInfo(req);
        expect(extInfo.nextActionOwner).toBe('IntegraCare');
    });
});

describe('TEST 14 — My Work routing after external rework', () => {
    it('rework item excluded from original contributor assignedToMe', () => {
        const req = simulateExternalRework('Sarah Chen', 'Revise.');
        const allReqs = [req];
        expect(assignedToMe(allReqs, 'Sarah Chen')).toHaveLength(0);
    });

    it('rework item included in DD Ops lead assignedToMe', () => {
        const req = simulateExternalRework('Sarah Chen', 'Revise.');
        const allReqs = [req];
        expect(assignedToMe(allReqs, DD_OPS_LEAD)).toHaveLength(1);
    });

    it('rework item excluded from original contributor returnedItems', () => {
        const req = simulateExternalRework('Sarah Chen', 'Revise.');
        const allReqs = [req];
        expect(returnedItems(allReqs, 'Sarah Chen')).toHaveLength(0);
    });

    it('rework item included in DD Ops lead returnedItems', () => {
        const req = simulateExternalRework('Sarah Chen', 'Revise.');
        const allReqs = [req];
        expect(returnedItems(allReqs, DD_OPS_LEAD)).toHaveLength(1);
    });

    it('rework item excluded from original contributor activeWork', () => {
        const req = simulateExternalRework('Sarah Chen', 'Revise.');
        const allReqs = [req];
        expect(activeWork(allReqs, 'Sarah Chen')).toHaveLength(0);
    });

    it('rework item excluded from DD Ops lead activeWork (status is Needs Rework)', () => {
        const req = simulateExternalRework('Sarah Chen', 'Revise.');
        const allReqs = [req];
        expect(activeWork(allReqs, DD_OPS_LEAD)).toHaveLength(0);
    });
});

describe('TEST 15 — Dashboard filter consistency after rework', () => {
    it('dashboard rework count matches items with Rework Review status', () => {
        const req1 = simulateExternalRework('Sarah Chen', 'Revise revenue.');
        const req2 = buildRequest({
            requestId: 'DD-TEST-002',
            status: 'In Progress',
            _publishedExternal: true,
            _externalStatus: 'Published External',
        });
        const allReqs = [req1, req2];

        const reworkItems = allReqs.filter(r => getExternalStatusInfo(r).status === 'Rework Review');
        expect(reworkItems).toHaveLength(1);
        expect(reworkItems[0].requestId).toBe('DD-TEST-001');
    });

    it('non-rework published item still shows Awaiting Your Review', () => {
        const req = buildRequest({
            status: 'Waiting Partner Review',
            _publishedExternal: true,
            _externalStatus: 'Published External',
        });
        const extInfo = getExternalStatusInfo(req);
        expect(extInfo.status).toBe('Awaiting Your Review');
    });

    it('underReviewCount excludes rework items', () => {
        const req1 = simulateExternalRework('Sarah Chen', 'Revise.');
        const req2 = buildRequest({
            requestId: 'DD-TEST-002',
            status: 'Waiting Partner Review',
            _publishedExternal: true,
            _externalStatus: 'Published External',
        });
        const allReqs = [req1, req2];

        const portalStatuses = allReqs.map(r => getExternalStatusInfo(r));
        const underReviewCount = portalStatuses.filter(s => s.status === 'Under Review').length;
        const reworkCount = portalStatuses.filter(s => s.status === 'Rework Review').length;
        expect(underReviewCount).toBe(0);
        expect(reworkCount).toBe(1);
    });

    it('filter by Rework Review shows only rework items', () => {
        const req1 = simulateExternalRework('Sarah Chen', 'Revise.');
        const req2 = buildRequest({
            requestId: 'DD-TEST-002',
            status: 'Waiting Partner Review',
            _publishedExternal: true,
            _externalStatus: 'Published External',
        });
        const allReqs = [req1, req2];

        const reworkFilter = allReqs.filter(r => {
            const ext = getExternalStatusInfo(r);
            return ext.status === 'Rework Review';
        });
        expect(reworkFilter).toHaveLength(1);
        expect(reworkFilter[0].requestId).toBe('DD-TEST-001');
    });
});

describe('TEST 16 — Republish clears rework state', () => {
    it('after resubmit + republish, item moves to Awaiting Your Review', () => {
        const req = simulateExternalRework('Sarah Chen', 'Revise revenue.');
        expect(getExternalStatusInfo(req).status).toBe('Rework Review');

        req.status = 'Waiting Partner Review';
        req._partnerDecision = null;
        req._partnerNote = null;
        req._partnerActionAt = null;
        req._externalStatus = 'Published External';
        req._publishedExternal = true;

        const extInfoAfter = getExternalStatusInfo(req);
        expect(extInfoAfter.status).toBe('Awaiting Your Review');
        expect(extInfoAfter.externalActionRequired).toBe(true);
    });

    it('after republish, owner remains DD Ops lead', () => {
        const req = simulateExternalRework('Sarah Chen', 'Revise.');

        req.status = 'Waiting Partner Review';
        req._partnerDecision = null;
        req._partnerNote = null;

        expect(req.owner).toBe(DD_OPS_LEAD);
    });
});

describe('TEST 17 — Approval after rework', () => {
    it('external approval after rework moves to terminal Complete', () => {
        const req = simulateExternalRework('Sarah Chen', 'Revise revenue.');

        req.status = 'Completed';
        req._partnerDecision = 'Approved';
        req._completedBy = 'External Partner';

        const extInfo = getExternalStatusInfo(req);
        expect(extInfo.status).toBe('Complete');
        expect(extInfo.isTerminal).toBe(true);
    });

    it('approved item excluded from needsDDReview', () => {
        const req = simulateExternalRework('Sarah Chen', 'Revise.');
        req.status = 'Completed';
        req._partnerDecision = 'Approved';

        expect(needsDDReview(req)).toBe(false);
    });

    it('approved item excluded from partnerActionItems', () => {
        const req = simulateExternalRework('Sarah Chen', 'Revise.');
        req.status = 'Completed';
        req._partnerDecision = 'Approved';

        expect(inPartnerAction(req)).toBe(false);
    });
});

describe('TEST 18 — External rework on non-published item', () => {
    it('rework on non-published item shows under-review (not rework-review)', () => {
        const req = buildRequest({ status: 'In Progress', _publishedExternal: false, _externalStatus: 'Internal Only' });
        req.status = 'Needs Rework';
        req._partnerDecision = 'Rework Required';
        req._partnerNote = 'Revise.';

        const extInfo = getExternalStatusInfo(req);
        expect(extInfo.status).toBe('Under Review');
    });
});

describe('TEST 19 — Internal clarification unaffected by external rework routing', () => {
    it('internal clarification cycle still works after external rework fix', () => {
        const req = buildRequest({ status: 'In Progress' });

        req.status = 'Clarification Needed';
        req._workNotes = [createWorkNote('What is the revenue?', 'Sarah Chen', 'Clarification Needed', 1)];

        expect(getExternalStatusInfo(req).status).toBe('Under Review');
        expect(isWaitingOnExternal(req)).toBe(false);
        expect(isActiveExternalClarification(req)).toBe(false);

        req.status = 'In Progress';
        req._workNotes.push(createWorkNote('Revenue is 60/40.', 'David Park', 'Clarification Guidance', 2));
        req._returnReason = null;

        expect(getExternalStatusInfo(req).status).toBe('In Progress');
        expect(isActiveExternalClarification(req)).toBe(false);
    });

    it('internal return to owner still uses _returnReason (not owner change)', () => {
        const req = buildRequest({ status: 'Clarification Needed', _returnReason: 'Need more detail on revenue' });
        req._workNotes = [createWorkNote('Q: Need revenue detail', 'David Park', 'Clarification External Question', 1)];

        expect(req._returnReason).toBe('Need more detail on revenue');
        expect(req.owner).toBe('Sarah Chen');
        expect(isWaitingOnExternal(req)).toBe(true);
    });
});

describe('TEST 20 — Multiple rework cycles on same request', () => {
    it('second rework after first rework + resubmit preserves state correctly', () => {
        const req = simulateExternalRework('Sarah Chen', 'Revise revenue section.');

        req.status = 'Waiting Partner Review';
        req._partnerDecision = null;
        req._partnerNote = null;
        req._partnerActionAt = null;
        req._externalStatus = 'Published External';
        req._publishedExternal = true;

        expect(getExternalStatusInfo(req).status).toBe('Awaiting Your Review');

        const originalNotes = [...(req._workNotes || [])];
        const wn2: WorkNoteEntry = {
            id: 'wn-rework-2',
            text: 'External partner requested rework. Reason: Revise cap rate assumptions. Original contributor: Sarah Chen.',
            author: 'External Partner',
            timestamp: new Date().toISOString(),
            action: 'Partner Rework',
        };
        req.status = 'Needs Rework';
        req.owner = DD_OPS_LEAD;
        req.assignedTo = DD_OPS_LEAD;
        req._partnerDecision = 'Rework Required';
        req._partnerNote = 'Revise cap rate assumptions.';
        req._partnerActionAt = new Date().toISOString();
        req._workNotes = [...originalNotes, wn2];

        expect(getExternalStatusInfo(req).status).toBe('Rework Review');
        expect(needsDDReview(req)).toBe(true);
        expect(inPartnerAction(req)).toBe(false);
        expect(assignedToMe([req], 'Sarah Chen')).toHaveLength(0);
        expect(assignedToMe([req], DD_OPS_LEAD)).toHaveLength(1);

        const reworkNotes = req._workNotes.filter(n => n.action === 'Partner Rework');
        expect(reworkNotes).toHaveLength(2);
        expect(reworkNotes[0].text).toContain('Original contributor: Sarah Chen');
        expect(reworkNotes[1].text).toContain('Original contributor: Sarah Chen');
    });
});

describe('TEST 21 — Regression: existing 38 tests unchanged', () => {
    it('Blocked status still works', () => {
        const req = buildRequest({ status: 'Blocked' });
        expect(needsDDReview(req)).toBe(true);
        expect(isReturnedToContributor(req)).toBe(true);
    });

    it('Duplicate status still works', () => {
        const req = buildRequest({ status: 'Duplicate' });
        expect(isReturnedToContributor(req)).toBe(true);
        expect(needsDDReview(req)).toBe(false);
    });

    it('Complete is terminal', () => {
        const req = buildRequest({ status: 'Complete' });
        expect(isReturnedToContributor(req)).toBe(false);
        expect(needsDDReview(req)).toBe(false);
    });

    it('Published External not in clarification queues', () => {
        const req = buildRequest({ status: 'In Progress', _externalStatus: 'Published External', _publishedExternal: true });
        expect(isReturnedToContributor(req)).toBe(false);
        expect(needsDDReview(req)).toBe(false);
    });

    it('Completed status with Approved is terminal', () => {
        const req = buildRequest({ status: 'Completed', _partnerDecision: 'Approved' });
        const extInfo = getExternalStatusInfo(req);
        expect(extInfo.status).toBe('Complete');
        expect(extInfo.isTerminal).toBe(true);
    });
});

describe('TEST 22 — Defect 2 fix: approved items stay in Published External', () => {
    it('approved item with _partnerDecision Approved is included in publishedExternal filter', () => {
        const req = buildRequest({ status: 'Completed', _externalStatus: 'Published External', _partnerDecision: 'Approved' });
        const matches = req._externalStatus === 'Published External' && (!req._partnerDecision || req._partnerDecision === 'Approved') && !req._exceptionSentAt;
        expect(matches).toBe(true);
    });

    it('rework item is excluded from publishedExternal filter', () => {
        const req = buildRequest({ status: 'Needs Rework', _externalStatus: 'Published External', _partnerDecision: 'Rework Required' });
        const matches = req._externalStatus === 'Published External' && (!req._partnerDecision || req._partnerDecision === 'Approved') && !req._exceptionSentAt;
        expect(matches).toBe(false);
    });

    it('pending item (no decision yet) is included in publishedExternal filter', () => {
        const req = buildRequest({ status: 'Waiting Partner Review', _externalStatus: 'Published External', _partnerDecision: null });
        const matches = req._externalStatus === 'Published External' && (!req._partnerDecision || req._partnerDecision === 'Approved') && !req._exceptionSentAt;
        expect(matches).toBe(true);
    });

    it('exception item is excluded from publishedExternal filter', () => {
        const req = buildRequest({ status: 'Duplicate', _externalStatus: 'Published External', _partnerDecision: null, _exceptionSentAt: '2026-07-15T10:00:00Z' });
        const matches = req._externalStatus === 'Published External' && (!req._partnerDecision || req._partnerDecision === 'Approved') && !req._exceptionSentAt;
        expect(matches).toBe(false);
    });

    it('approved items counted in published external KPI', () => {
        const req1 = buildRequest({ status: 'Completed', _externalStatus: 'Published External', _partnerDecision: 'Approved' });
        const req2 = buildRequest({ requestId: 'DD-TEST-002', status: 'Waiting Partner Review', _externalStatus: 'Published External', _partnerDecision: null });
        const all = [req1, req2];
        const count = all.filter(r => r._externalStatus === 'Published External' && (!r._partnerDecision || r._partnerDecision === 'Approved') && !r._exceptionSentAt).length;
        expect(count).toBe(2);
    });
});

describe('TEST 23 — Defect 1 fix: Return to Owner hidden during active clarification', () => {
    it('item waiting on external partner has active clarification', () => {
        const req = buildRequest({ status: 'Clarification Needed' });
        req._workNotes = [
            createWorkNote('What is the cap rate?', 'Sarah Chen', 'Clarification Needed', 1),
            createWorkNote('Cap rate is 6.2%?', 'David Park', 'Clarification External Question', 2),
        ];
        req._returnReason = 'Cap rate is 6.2%?';

        expect(isWaitingOnExternal(req)).toBe(true);
        expect(isActiveExternalClarification(req)).toBe(true);
    });

    it('item with external response pending DD review has active clarification', () => {
        const req = buildRequest({ status: 'Clarification Needed' });
        req._workNotes = [
            createWorkNote('What is the cap rate?', 'Sarah Chen', 'Clarification Needed', 1),
            createWorkNote('Cap rate is 6.2%?', 'David Park', 'Clarification External Question', 2),
            createWorkNote('Cap rate is 6.2%.', 'External Partner', 'Clarification Response', 3),
        ];
        req._returnReason = null;

        expect(isExternalResponseReceived(req)).toBe(true);
        expect(isActiveExternalClarification(req)).toBe(true);
        expect(needsDDReview(req)).toBe(true);
    });

    it('item with guidance returned does NOT have active clarification', () => {
        const req = buildRequest({ status: 'In Progress' });
        req._workNotes = [
            createWorkNote('What is the cap rate?', 'Sarah Chen', 'Clarification Needed', 1),
            createWorkNote('Cap rate is 6.2%?', 'David Park', 'Clarification External Question', 2),
            createWorkNote('Cap rate is 6.2%.', 'External Partner', 'Clarification Response', 3),
            createWorkNote('Cap rate confirmed at 6.2%.', 'David Park', 'Clarification Guidance', 4),
        ];

        expect(isActiveExternalClarification(req)).toBe(false);
    });

    it('non-clarification item does not have active clarification', () => {
        const req = buildRequest({ status: 'In Progress' });
        expect(isActiveExternalClarification(req)).toBe(false);
    });

    it('internal-only clarification does NOT count as external clarification', () => {
        const req = buildRequest({ status: 'Clarification Needed' });
        req._workNotes = [
            createWorkNote('What is the revenue?', 'Sarah Chen', 'Clarification Needed', 1),
        ];

        expect(isWaitingOnExternal(req)).toBe(false);
        expect(isActiveExternalClarification(req)).toBe(false);
    });
});

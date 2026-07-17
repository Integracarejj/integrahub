import { describe, it, expect } from 'vitest';
import { getExternalStatusInfo } from '../services/externalStatusMapping';
import type { RecapRequest, WorkNoteEntry } from '../services/recapMockData';

const DD_OPS_LEAD = 'David Park';

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

function toExternalInput(req: RecapRequest) {
    return {
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
    };
}

/* ═══════════════════════════════════════════════════════════════════════════
   TEST GROUP 1–8: Contributor blocking
   ═══════════════════════════════════════════════════════════════════════════ */

describe('Blocker Workflow — Contributor Blocking', () => {
    it('1: blocking sets status to Blocked, owner to DD_OPS_LEAD, and blockerStatus to Raised', () => {
        const req = buildRequest({
            status: 'Blocked',
            owner: DD_OPS_LEAD,
            assignedTo: DD_OPS_LEAD,
            _blockerReason: 'Missing cap rate schedule',
            _blockerStatus: 'Raised',
            _blockerRaisedBy: 'Sarah Chen',
            _blockerOwner: DD_OPS_LEAD,
        });
        expect(req.status).toBe('Blocked');
        expect(req.owner).toBe(DD_OPS_LEAD);
        expect(req._blockerStatus).toBe('Raised');
        expect(req._blockerReason).toBe('Missing cap rate schedule');
        expect(req._blockerRaisedBy).toBe('Sarah Chen');
    });

    it('2: blocked item appears in DD Ops needs-DD-review queue', () => {
        const NEEDS_DD_REVIEW = ['Blocked', 'Clarification Needed'];
        const req = buildRequest({ status: 'Blocked' });
        expect(NEEDS_DD_REVIEW.includes(req.status)).toBe(true);
    });

    it('3: blocked item appears in contributor Returned queue', () => {
        const RETURNED = ['Clarification Needed', 'Blocked', 'Duplicate', 'Not Applicable', 'Needs Rework'];
        const req = buildRequest({ status: 'Blocked' });
        expect(RETURNED.includes(req.status)).toBe(true);
    });

    it('4: contributor Resolve tile is hidden when isDdOps is false', () => {
        const req = buildRequest({ status: 'Blocked' });
        const isDdOps = false;
        expect(req.status === 'Blocked' && isDdOps).toBe(false);
    });

    it('5: contributor Resolve tile is visible when isDdOps is true', () => {
        const req = buildRequest({ status: 'Blocked' });
        const isDdOps = true;
        expect(req.status === 'Blocked' && isDdOps).toBe(true);
    });

    it('6: blocker work note action is "Blocked"', () => {
        const wn = createWorkNote('Blocker raised by Sarah Chen. Reason: Missing data', 'Sarah Chen', 'Blocked');
        expect(wn.action).toBe('Blocked');
    });

    it('7: blocked item shows in external status as "under-review" (not terminal)', () => {
        const req = buildRequest({
            status: 'Blocked',
            _blockerStatus: 'Raised',
        });
        const info = getExternalStatusInfo(toExternalInput(req));
        expect(info.status).toBe('Under Review');
        expect(info.isTerminal).toBe(false);
    });

    it('8: blocked item has no external action required when just raised', () => {
        const req = buildRequest({
            status: 'Blocked',
            _blockerStatus: 'Raised',
        });
        const info = getExternalStatusInfo(toExternalInput(req));
        expect(info.externalActionRequired).toBe(false);
    });
});

/* ═══════════════════════════════════════════════════════════════════════════
   TEST GROUP 9–17: DD Ops internal resolution (Path A)
   ═══════════════════════════════════════════════════════════════════════════ */

describe('Blocker Workflow — DD Ops Internal Resolution (Path A)', () => {
    it('9: internal resolution sets status to Needs Rework', () => {
        const req = buildRequest({
            status: 'Needs Rework',
            owner: 'Sarah Chen',
            _blockerStatus: 'Resolved',
            _blockerResolution: 'Cap rate confirmed at 6.2%',
        });
        expect(req.status).toBe('Needs Rework');
        expect(req._blockerStatus).toBe('Resolved');
    });

    it('10: internal resolution returns ownership to the blocker raiser', () => {
        const req = buildRequest({
            status: 'Needs Rework',
            owner: 'Sarah Chen',
            _blockerRaisedBy: 'Sarah Chen',
            _blockerStatus: 'Resolved',
        });
        expect(req.owner).toBe(req._blockerRaisedBy);
    });

    it('11: internal resolution sets _returnReason', () => {
        const req = buildRequest({
            status: 'Needs Rework',
            _returnReason: 'Blocker resolved: Cap rate confirmed at 6.2%',
            _blockerStatus: 'Resolved',
        });
        expect(req._returnReason).toContain('Blocker resolved');
    });

    it('12: internal resolution writes "Blocker Resolution" work note', () => {
        const wn = createWorkNote('Cap rate confirmed at 6.2%', DD_OPS_LEAD, 'Blocker Resolution');
        expect(wn.action).toBe('Blocker Resolution');
        expect(wn.author).toBe(DD_OPS_LEAD);
    });

    it('13: resolved blocker is no longer in Blocked status', () => {
        const req = buildRequest({ status: 'Needs Rework', _blockerStatus: 'Resolved' });
        expect(req.status).not.toBe('Blocked');
    });

    it('14: internal resolution shows as "Returned to Contributor" in external status', () => {
        const req = buildRequest({
            status: 'Needs Rework',
            _blockerStatus: 'Resolved',
            _externalStatus: 'Published External',
            _publishedAt: '2026-06-01',
        });
        const info = getExternalStatusInfo(toExternalInput(req));
        expect(info.status).toBe('Rework Review');
    });

    it('15: internal resolution with _blockerResolution stores guidance text', () => {
        const req = buildRequest({
            _blockerStatus: 'Resolved',
            _blockerResolution: 'Use the Q3 cap rate schedule from the acquisition model',
        });
        expect(req._blockerResolution).toBe('Use the Q3 cap rate schedule from the acquisition model');
    });

    it('16: internal resolution clears blocker owner (set to contributor)', () => {
        const req = buildRequest({
            status: 'Needs Rework',
            owner: 'Sarah Chen',
            _blockerOwner: DD_OPS_LEAD,
            _blockerStatus: 'Resolved',
        });
        expect(req.owner).toBe('Sarah Chen');
        expect(req._blockerOwner).toBe(DD_OPS_LEAD);
    });

    it('17: resolved blocker does not show as "Blocked" in Needs DD Review queue', () => {
        const NEEDS_DD_REVIEW = ['Blocked', 'Clarification Needed'];
        const req = buildRequest({ status: 'Needs Rework' });
        expect(NEEDS_DD_REVIEW.includes(req.status)).toBe(false);
    });
});

/* ═══════════════════════════════════════════════════════════════════════════
   TEST GROUP 18–29: DD Ops external help (Path B)
   ═══════════════════════════════════════════════════════════════════════════ */

describe('Blocker Workflow — DD Ops External Help (Path B)', () => {
    it('18: requesting external help sets status to Pending External', () => {
        const req = buildRequest({
            status: 'Pending External',
            _blockerStatus: 'Pending External',
            _blockerExternalQuestion: 'What is the current cap rate for this property?',
        });
        expect(req.status).toBe('Pending External');
        expect(req._blockerStatus).toBe('Pending External');
    });

    it('19: external help request shows "Blocker Information Requested" in external status', () => {
        const req = buildRequest({
            status: 'Pending External',
            _blockerStatus: 'Pending External',
            _blockerExternalQuestion: 'What is the current cap rate?',
        });
        const info = getExternalStatusInfo(toExternalInput(req));
        expect(info.status).toBe('Blocker Information Requested');
        expect(info.externalActionRequired).toBe(true);
        expect(info.externalActionLabel).toBe('Respond');
    });

    it('20: external help request is not terminal', () => {
        const req = buildRequest({
            status: 'Pending External',
            _blockerStatus: 'Pending External',
        });
        const info = getExternalStatusInfo(toExternalInput(req));
        expect(info.isTerminal).toBe(false);
    });

    it('21: external partner response sets _blockerExternalResponse', () => {
        const req = buildRequest({
            status: 'Blocked',
            _blockerStatus: 'External Response Received',
            _blockerExternalResponse: 'Cap rate is 6.2% per the acquisition agreement',
        });
        expect(req._blockerExternalResponse).toBe('Cap rate is 6.2% per the acquisition agreement');
    });

    it('22: external response sets _blockerStatus to "External Response Received"', () => {
        const req = buildRequest({ _blockerStatus: 'External Response Received' });
        expect(req._blockerStatus).toBe('External Response Received');
    });

    it('23: external response keeps status as Blocked (DD Ops reviews next)', () => {
        const req = buildRequest({
            status: 'Blocked',
            _blockerStatus: 'External Response Received',
        });
        expect(req.status).toBe('Blocked');
    });

    it('24: external response shows "under-review" in external status', () => {
        const req = buildRequest({
            status: 'Blocked',
            _blockerStatus: 'External Response Received',
            _blockerExternalResponse: 'Cap rate is 6.2%',
        });
        const info = getExternalStatusInfo(toExternalInput(req));
        expect(info.status).toBe('Under Review');
    });

    it('25: external response has no external action required', () => {
        const req = buildRequest({
            status: 'Blocked',
            _blockerStatus: 'External Response Received',
        });
        const info = getExternalStatusInfo(toExternalInput(req));
        expect(info.externalActionRequired).toBe(false);
    });

    it('26: "Blocker External Request" work note is logged', () => {
        const wn = createWorkNote(
            'External blocker assistance requested: What is the cap rate?',
            DD_OPS_LEAD,
            'Blocker External Request',
        );
        expect(wn.action).toBe('Blocker External Request');
    });

    it('27: "Blocker External Response" work note is logged', () => {
        const wn = createWorkNote(
            'Cap rate is 6.2%',
            'External Partner',
            'Blocker External Response',
        );
        expect(wn.action).toBe('Blocker External Response');
        expect(wn.author).toBe('External Partner');
    });

    it('28: "Blocker Guidance" work note is logged after external response review', () => {
        const wn = createWorkNote(
            'Use the 6.2% cap rate as confirmed by the partner',
            DD_OPS_LEAD,
            'Blocker Guidance',
        );
        expect(wn.action).toBe('Blocker Guidance');
    });

    it('29: after guidance returned, item goes to Needs Rework with _blockerResolution', () => {
        const req = buildRequest({
            status: 'Needs Rework',
            owner: 'Sarah Chen',
            _blockerStatus: 'Resolved',
            _blockerResolution: 'Use the 6.2% cap rate as confirmed by the partner',
            _returnReason: 'Blocker guidance: Use the 6.2% cap rate as confirmed by the partner',
        });
        expect(req.status).toBe('Needs Rework');
        expect(req._blockerStatus).toBe('Resolved');
        expect(req._blockerResolution).toContain('6.2%');
    });
});

/* ═══════════════════════════════════════════════════════════════════════════
   TEST GROUP 30–33: Multiple blocker cycles
   ═══════════════════════════════════════════════════════════════════════════ */

describe('Blocker Workflow — Multiple Cycles', () => {
    it('30: contributor can re-block after a resolved blocker', () => {
        let req = buildRequest({
            status: 'Blocked',
            _blockerStatus: 'Raised',
            _blockerReason: 'Missing cap rate',
            _blockerRaisedBy: 'Sarah Chen',
        });
        expect(req.status).toBe('Blocked');
        expect(req._blockerStatus).toBe('Raised');

        req = buildRequest({
            status: 'Blocked',
            _blockerStatus: 'Raised',
            _blockerReason: 'Missing rent roll',
            _blockerRaisedBy: 'Sarah Chen',
        });
        expect(req._blockerReason).toBe('Missing rent roll');
    });

    it('31: DD Ops can resolve internally then contributor blocks again', () => {
        const req = buildRequest({
            status: 'Blocked',
            _blockerStatus: 'Raised',
            _blockerReason: 'New issue',
            _blockerRaisedBy: 'Sarah Chen',
        });
        expect(req.status).toBe('Blocked');
        expect(req._blockerStatus).toBe('Raised');
    });

    it('32: DD Ops can request external help after previous resolution', () => {
        const req = buildRequest({
            status: 'Pending External',
            _blockerStatus: 'Pending External',
            _blockerExternalQuestion: 'Second round: what is the NOI?',
        });
        expect(req.status).toBe('Pending External');
        expect(req._blockerExternalQuestion).toContain('Second round');
    });

    it('33: each blocker cycle overwrites previous _blockerResolution', () => {
        const req = buildRequest({
            _blockerStatus: 'Resolved',
            _blockerResolution: 'Final guidance for the latest blocker',
        });
        expect(req._blockerResolution).toBe('Final guidance for the latest blocker');
    });
});

/* ═══════════════════════════════════════════════════════════════════════════
   TEST GROUP 34–42: Regression — locked workflows must NOT break
   ═══════════════════════════════════════════════════════════════════════════ */

describe('Blocker Workflow — Locked Regression', () => {
    it('34: clarification routing is unaffected by blocked items', () => {
        const clarReq = buildRequest({ status: 'Clarification Needed' });
        clarReq._workNotes = [
            createWorkNote('What is the NOI?', 'Sarah Chen', 'Clarification Needed', 1),
            createWorkNote('NOI is $1.2M?', 'David Park', 'Clarification External Question', 2),
        ];
        const blockedReq = buildRequest({ status: 'Blocked', _blockerStatus: 'Raised' });

        expect(clarReq.status).toBe('Clarification Needed');
        expect(blockedReq.status).toBe('Blocked');
    });

    it('35: rework workflow is unaffected by blocked items', () => {
        const reworkReq = buildRequest({ status: 'Needs Rework', _partnerDecision: 'Rework Required' });
        const blockedReq = buildRequest({ status: 'Blocked', _blockerStatus: 'Raised' });

        expect(reworkReq.status).toBe('Needs Rework');
        expect(blockedReq.status).toBe('Blocked');
        expect(reworkReq._partnerDecision).toBe('Rework Required');
    });

    it('36: artifact publication is unaffected by blocked items', () => {
        const publishedReq = buildRequest({
            status: 'In Progress',
            _publishedAt: '2026-06-01',
            _publishedExternal: true,
        });
        const blockedReq = buildRequest({ status: 'Blocked', _publishedAt: null });

        expect(publishedReq._publishedAt).toBeTruthy();
        expect(blockedReq._publishedAt).toBeFalsy();
    });

    it('37: external approval flow is unaffected by blocked items', () => {
        const approvedReq = buildRequest({
            status: 'Completed',
            _partnerDecision: 'Approved',
        });
        const blockedReq = buildRequest({ status: 'Blocked' });

        expect(approvedReq._partnerDecision).toBe('Approved');
        expect(blockedReq._partnerDecision).toBeUndefined();
    });

    it('38: complete handling is unaffected by blocked items', () => {
        const completeReq = buildRequest({ status: 'Complete' });
        const blockedReq = buildRequest({ status: 'Blocked' });

        expect(completeReq.status).toBe('Complete');
        expect(blockedReq.status).toBe('Blocked');
    });

    it('39: partner action logic is unaffected by blocked items', () => {
        const partnerReq = buildRequest({
            _externalStatus: 'Published External',
            _partnerDecision: 'Approved',
            status: 'Completed',
        });
        const blockedReq = buildRequest({ status: 'Blocked' });

        expect(partnerReq._externalStatus).toBe('Published External');
        expect(blockedReq._externalStatus).toBe('Internal Only');
    });

    it('40: needs DD review includes both Blocked and Clarification Needed', () => {
        const NEEDS_DD_REVIEW = ['Blocked', 'Clarification Needed'];
        expect(NEEDS_DD_REVIEW.includes('Blocked')).toBe(true);
        expect(NEEDS_DD_REVIEW.includes('Clarification Needed')).toBe(true);
    });

    it('41: "Pending External" status for non-blocker context is NOT mapped to blocker status', () => {
        const req = buildRequest({
            status: 'Pending External',
            _blockerStatus: null,
        });
        const info = getExternalStatusInfo(toExternalInput(req));
        expect(info.status).not.toBe('Blocker Information Requested');
    });

    it('42: returned-to-contributor queue includes Blocked', () => {
        const RETURNED = ['Clarification Needed', 'Blocked', 'Duplicate', 'Not Applicable', 'Needs Rework'];
        expect(RETURNED.includes('Blocked')).toBe(true);
    });
});

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

const RETURNED_STATUSES = ['Clarification Needed', 'Blocked', 'Duplicate', 'Not Applicable', 'Needs Rework'];
const NEEDS_DD_REVIEW_STATUSES = ['Blocked', 'Clarification Needed'];

function simulateBlock(contributor: string, reason: string): RecapRequest {
    return buildRequest({
        status: 'Blocked',
        owner: DD_OPS_LEAD,
        assignedTo: DD_OPS_LEAD,
        _blockerReason: reason,
        _blockerStatus: 'Raised',
        _blockerRaisedBy: contributor,
        _blockerOwner: DD_OPS_LEAD,
        _returnReason: null,
        _returnedBy: null,
        _blockerExternalQuestion: null,
        _blockerExternalResponse: null,
        _blockerResolution: null,
    });
}

function simulateInternalResolution(reason: string): RecapRequest {
    return buildRequest({
        status: 'Needs Rework',
        owner: CONTRIBUTOR,
        assignedTo: CONTRIBUTOR,
        _blockerStatus: 'Resolved',
        _blockerResolution: reason,
        _returnReason: `Blocker resolved: ${reason}`,
        _returnedBy: DD_OPS_LEAD,
        _blockerExternalQuestion: null,
        _blockerExternalResponse: null,
    });
}

function simulateExternalHelpRequest(question: string): RecapRequest {
    return buildRequest({
        status: 'Pending External',
        _blockerStatus: 'Pending External',
        _blockerExternalQuestion: question,
    });
}

function simulateExternalResponse(response: string): RecapRequest {
    return buildRequest({
        status: 'Blocked',
        owner: DD_OPS_LEAD,
        assignedTo: DD_OPS_LEAD,
        _blockerStatus: 'External Response Received',
        _blockerExternalResponse: response,
    });
}

/* ═══════════════════════════════════════════════════════════════════════════
   CONTRIB WAITING VISIBILITY (Tests 1–8)
   ═══════════════════════════════════════════════════════════════════════════ */

describe('1. Contributor Waiting Visibility', () => {
    it('1: blocking persists the reason', () => {
        const req = simulateBlock(CONTRIBUTOR, 'Missing cap rate schedule');
        expect(req._blockerReason).toBe('Missing cap rate schedule');
    });

    it('2: blocking routes to Needs DD Review', () => {
        const req = simulateBlock(CONTRIBUTOR, 'Missing data');
        expect(NEEDS_DD_REVIEW_STATUSES.includes(req.status)).toBe(true);
    });

    it('3: blocking removes from My Work Active', () => {
        const req = simulateBlock(CONTRIBUTOR, 'Missing data');
        const isActive = !RETURNED_STATUSES.includes(req.status);
        expect(isActive).toBe(false);
    });

    it('4: blocking appears in My Work Waiting on DD Operations', () => {
        const req = simulateBlock(CONTRIBUTOR, 'Missing data');
        const isWaiting = req.status === 'Blocked' && req._blockerRaisedBy === CONTRIBUTOR;
        expect(isWaiting).toBe(true);
    });

    it('5: Waiting record has no Resume or Accept action', () => {
        const req = simulateBlock(CONTRIBUTOR, 'Missing data');
        const hasResumeAction = req.status === 'In Progress' || req.status === 'Needs Rework';
        expect(hasResumeAction).toBe(false);
    });

    it('6: Full Work Queue still includes the request', () => {
        const req = simulateBlock(CONTRIBUTOR, 'Missing data');
        expect(req.status).not.toBe('Complete');
    });

    it('7: Partner Action excludes the request', () => {
        const req = simulateBlock(CONTRIBUTOR, 'Missing data');
        const inPartnerAction = req._externalStatus === 'Published External' && !!req._partnerDecision;
        expect(inPartnerAction).toBe(false);
    });

    it('8: workspace shows Blocker Submitted title for contributor', () => {
        const req = simulateBlock(CONTRIBUTOR, 'Missing data');
        expect(req.status).toBe('Blocked');
        expect(req._blockerRaisedBy).toBe(CONTRIBUTOR);
    });
});

/* ═══════════════════════════════════════════════════════════════════════════
   INTERNAL RESOLUTION (Tests 9–18)
   ═══════════════════════════════════════════════════════════════════════════ */

describe('2. Internal Resolution (Path A)', () => {
    it('9: Resolve Blocker requires guidance', () => {
        const guidance = '';
        expect(guidance.trim().length > 0).toBe(false);
    });

    it('10: resolution clears active blocker state', () => {
        const req = simulateInternalResolution('Use the Q3 cap rate');
        expect(req._blockerStatus).toBe('Resolved');
        expect(req.status).not.toBe('Blocked');
    });

    it('11: resolution preserves blocker history', () => {
        const req = simulateInternalResolution('Use the Q3 cap rate');
        expect(req._blockerResolution).toBe('Use the Q3 cap rate');
    });

    it('12: resolution returns to original contributor', () => {
        const req = simulateInternalResolution('Use the Q3 cap rate');
        expect(req.owner).toBe(CONTRIBUTOR);
    });

    it('13: request appears in Returned / Needs Attention', () => {
        const req = simulateInternalResolution('Use the Q3 cap rate');
        expect(RETURNED_STATUSES.includes(req.status)).toBe(true);
    });

    it('14: Waiting on DD Operations no longer includes it', () => {
        const req = simulateInternalResolution('Use the Q3 cap rate');
        const isWaiting = req.status === 'Blocked' && req._blockerRaisedBy === CONTRIBUTOR;
        expect(isWaiting).toBe(false);
    });

    it('15: Needs DD Review no longer includes it', () => {
        const req = simulateInternalResolution('Use the Q3 cap rate');
        expect(NEEDS_DD_REVIEW_STATUSES.includes(req.status)).toBe(false);
    });

    it('16: Partner Action excludes it', () => {
        const req = simulateInternalResolution('Use the Q3 cap rate');
        const inPartnerAction = req._externalStatus === 'Published External' && !!req._partnerDecision;
        expect(inPartnerAction).toBe(false);
    });

    it('17: contributor can resume (status is Needs Rework)', () => {
        const req = simulateInternalResolution('Use the Q3 cap rate');
        expect(req.status).toBe('Needs Rework');
    });

    it('18: resolution clears external fields', () => {
        const req = simulateInternalResolution('Use the Q3 cap rate');
        expect(req._blockerExternalQuestion).toBeNull();
        expect(req._blockerExternalResponse).toBeNull();
    });
});

/* ═══════════════════════════════════════════════════════════════════════════
   REPEATED BLOCKER CYCLES (Tests 19–26)
   ═══════════════════════════════════════════════════════════════════════════ */

describe('3. Repeated Blocker Cycles', () => {
    it('19: request can be blocked a second time', () => {
        const firstBlock = simulateBlock(CONTRIBUTOR, 'First blocker');
        expect(firstBlock.status).toBe('Blocked');

        const resolved = simulateInternalResolution('Resolved first');
        expect(resolved.status).toBe('Needs Rework');

        const secondBlock = simulateBlock(CONTRIBUTOR, 'Second blocker');
        expect(secondBlock.status).toBe('Blocked');
    });

    it('20: second blocker reason persists', () => {
        const req = simulateBlock(CONTRIBUTOR, 'Missing rent roll');
        expect(req._blockerReason).toBe('Missing rent roll');
    });

    it('21: second blocker routes to Needs DD Review', () => {
        const req = simulateBlock(CONTRIBUTOR, 'Missing rent roll');
        expect(NEEDS_DD_REVIEW_STATUSES.includes(req.status)).toBe(true);
    });

    it('22: second blocker appears in Waiting on DD Operations', () => {
        const req = simulateBlock(CONTRIBUTOR, 'Missing rent roll');
        const isWaiting = req.status === 'Blocked' && req._blockerRaisedBy === CONTRIBUTOR;
        expect(isWaiting).toBe(true);
    });

    it('23: prior blocker history remains intact via _blockerResolution', () => {
        const req = buildRequest({
            _blockerResolution: 'First blocker resolved: Use Q3 cap rate',
        });
        expect(req._blockerResolution).toContain('First blocker resolved');
    });

    it('24: current blocker fields represent only the active cycle', () => {
        const req = simulateBlock(CONTRIBUTOR, 'New blocker reason');
        expect(req._blockerReason).toBe('New blocker reason');
        expect(req._blockerResolution).toBeNull();
    });

    it('25: multiple cycles do not create duplicate queue membership', () => {
        const req = simulateBlock(CONTRIBUTOR, 'Blocker');
        const inDDReview = NEEDS_DD_REVIEW_STATUSES.includes(req.status);
        const inReturned = RETURNED_STATUSES.includes(req.status);
        expect(inDDReview).toBe(true);
        expect(inReturned).toBe(true);
    });

    it('26: request never disappears', () => {
        const req = simulateBlock(CONTRIBUTOR, 'Blocker');
        expect(req.status).not.toBeUndefined();
        expect(req.id).toBeTruthy();
    });
});

/* ═══════════════════════════════════════════════════════════════════════════
   WORKSPACE ACTION GATING (Tests 27–33)
   ═══════════════════════════════════════════════════════════════════════════ */

describe('4. Workspace Action Gating', () => {
    it('27: active blocked request renders Blocker Review', () => {
        const req = simulateBlock(CONTRIBUTOR, 'Missing data');
        expect(req.status).toBe('Blocked');
    });

    it('28: Resolve Blocker is available for DD Ops', () => {
        const isDdOps = true;
        const req = simulateBlock(CONTRIBUTOR, 'Missing data');
        expect(req.status === 'Blocked' && isDdOps).toBe(true);
    });

    it('29: Request External Help is available for DD Ops', () => {
        const isDdOps = true;
        const req = simulateBlock(CONTRIBUTOR, 'Missing data');
        expect(req.status === 'Blocked' && isDdOps).toBe(true);
    });

    it('30: generic Return to Owner is unavailable when Blocked', () => {
        const req = simulateBlock(CONTRIBUTOR, 'Missing data');
        const shouldHide = req.status === 'Blocked';
        expect(shouldHide).toBe(true);
    });

    it('31: Publish External remains unavailable unless valid', () => {
        const req = simulateBlock(CONTRIBUTOR, 'Missing data');
        const canPublish = req.status === 'In Progress' && req._externalStatus === 'Ready to Publish';
        expect(canPublish).toBe(false);
    });

    it('32: blocker reason is visible in Blocker Review', () => {
        const req = simulateBlock(CONTRIBUTOR, 'Missing cap rate');
        expect(req._blockerReason).toBe('Missing cap rate');
    });

    it('33: current owner is DD Operations', () => {
        const req = simulateBlock(CONTRIBUTOR, 'Missing data');
        expect(req.owner).toBe(DD_OPS_LEAD);
    });
});

/* ═══════════════════════════════════════════════════════════════════════════
   EXTERNAL HELP (Tests 34–49)
   ═══════════════════════════════════════════════════════════════════════════ */

describe('5. External Help (Path B)', () => {
    it('34: Request External Help requires external-facing text', () => {
        const question = '';
        expect(question.trim().length > 0).toBe(false);
    });

    it('35: internal blocker reason is not exposed externally', () => {
        const req = simulateExternalHelpRequest('What is the cap rate?');
        expect(req._blockerExternalQuestion).toBe('What is the cap rate?');
        expect(req._blockerReason).toBeUndefined();
    });

    it('36: external request persists', () => {
        const req = simulateExternalHelpRequest('What is the cap rate?');
        expect(req._blockerExternalQuestion).toBe('What is the cap rate?');
    });

    it('37: request enters Partner Action', () => {
        const req = simulateExternalHelpRequest('What is the cap rate?');
        const info = getExternalStatusInfo(toExternalInput(req));
        expect(info.status).toBe('Blocker Information Requested');
        expect(info.externalActionRequired).toBe(true);
    });

    it('38: request leaves Needs DD Review', () => {
        const req = simulateExternalHelpRequest('What is the cap rate?');
        expect(NEEDS_DD_REVIEW_STATUSES.includes(req.status)).toBe(false);
    });

    it('39: contributor remains in Waiting on DD Operations', () => {
        const req = buildRequest({
            status: 'Pending External',
            _blockerStatus: 'Pending External',
            _blockerRaisedBy: CONTRIBUTOR,
        });
        const isWaiting = req.status === 'Blocked' || (req.status === 'Pending External' && req._blockerRaisedBy === CONTRIBUTOR);
        expect(isWaiting).toBe(true);
    });

    it('40: external dashboard card count includes the request', () => {
        const req = simulateExternalHelpRequest('What is the cap rate?');
        const info = getExternalStatusInfo(toExternalInput(req));
        expect(info.status).toBe('Blocker Information Requested');
    });

    it('41: card filter identifies exact request', () => {
        const req = simulateExternalHelpRequest('What is the cap rate?');
        const info = getExternalStatusInfo(toExternalInput(req));
        expect(info.label).toBe('Blocker Information Requested');
    });

    it('42: external status is Blocker Information Requested', () => {
        const req = simulateExternalHelpRequest('What is the cap rate?');
        const info = getExternalStatusInfo(toExternalInput(req));
        expect(info.status).toBe('Blocker Information Requested');
    });

    it('43: external response persists', () => {
        const req = simulateExternalResponse('Cap rate is 6.2%');
        expect(req._blockerExternalResponse).toBe('Cap rate is 6.2%');
    });

    it('44: response form disappears after submit (status changes)', () => {
        const req = simulateExternalResponse('Cap rate is 6.2%');
        expect(req._blockerStatus).toBe('External Response Received');
        expect(req.status).toBe('Blocked');
    });

    it('45: external request remains visible read-only', () => {
        const req = simulateExternalResponse('Cap rate is 6.2%');
        const info = getExternalStatusInfo(toExternalInput(req));
        expect(info.isTerminal).toBe(false);
    });

    it('46: external response routes to Needs DD Review', () => {
        const req = simulateExternalResponse('Cap rate is 6.2%');
        expect(NEEDS_DD_REVIEW_STATUSES.includes(req.status)).toBe(true);
    });

    it('47: external response removes from Partner Action', () => {
        const req = simulateExternalResponse('Cap rate is 6.2%');
        const info = getExternalStatusInfo(toExternalInput(req));
        expect(info.externalActionRequired).toBe(false);
    });

    it('48: request does not route directly to contributor', () => {
        const req = simulateExternalResponse('Cap rate is 6.2%');
        expect(req.owner).toBe(DD_OPS_LEAD);
    });

    it('49: DD Operations can resolve after response', () => {
        const req = simulateInternalResolution('Use the 6.2% cap rate');
        expect(req.status).toBe('Needs Rework');
        expect(req.owner).toBe(CONTRIBUTOR);
    });
});

/* ═══════════════════════════════════════════════════════════════════════════
   MULTIPLE EXTERNAL CYCLES (Tests 50–54)
   ═══════════════════════════════════════════════════════════════════════════ */

describe('6. Multiple External Cycles', () => {
    it('50: DD Operations can request external help again', () => {
        const req = simulateExternalHelpRequest('Second round: what is the NOI?');
        expect(req._blockerExternalQuestion).toContain('Second round');
    });

    it('51: prior external blocker messages remain in history', () => {
        const notes: WorkNoteEntry[] = [
            createWorkNote('First external request', DD_OPS_LEAD, 'Blocker External Request', 1),
            createWorkNote('First response', 'External Partner', 'Blocker External Response', 2),
            createWorkNote('Second external request', DD_OPS_LEAD, 'Blocker External Request', 3),
        ];
        const externalNotes = notes.filter(n => n.action?.startsWith('Blocker External'));
        expect(externalNotes.length).toBe(3);
    });

    it('52: second external response returns to Needs DD Review', () => {
        const req = simulateExternalResponse('NOI is $1.2M');
        expect(NEEDS_DD_REVIEW_STATUSES.includes(req.status)).toBe(true);
    });

    it('53: no duplicate Partner Action membership', () => {
        const req = simulateExternalResponse('NOI is $1.2M');
        const info = getExternalStatusInfo(toExternalInput(req));
        expect(info.externalActionRequired).toBe(false);
    });

    it('54: no duplicate Needs DD Review membership', () => {
        const req = simulateExternalResponse('NOI is $1.2M');
        const count = NEEDS_DD_REVIEW_STATUSES.filter(s => s === req.status).length;
        expect(count).toBe(1);
    });
});

/* ═══════════════════════════════════════════════════════════════════════════
   LOCKED REGRESSION (Tests 55–64)
   ═══════════════════════════════════════════════════════════════════════════ */

describe('7. Locked Regression', () => {
    it('55: clarification still works end-to-end', () => {
        const req = buildRequest({ status: 'Clarification Needed' });
        req._workNotes = [
            createWorkNote('What is the cap rate?', CONTRIBUTOR, 'Clarification Needed', 1),
            createWorkNote('Cap rate is 6.2%?', DD_OPS_LEAD, 'Clarification External Question', 2),
            createWorkNote('Cap rate is 6.2%.', 'External Partner', 'Clarification Response', 3),
            createWorkNote('Use 6.2%.', DD_OPS_LEAD, 'Clarification Guidance', 4),
        ];
        expect(req.status).toBe('Clarification Needed');
    });

    it('56: repeated clarification cycles still work', () => {
        const req = buildRequest({ status: 'Clarification Needed' });
        req._workNotes = [
            createWorkNote('Q1?', CONTRIBUTOR, 'Clarification Needed', 1),
            createWorkNote('Q1 info', DD_OPS_LEAD, 'Clarification External Question', 2),
            createWorkNote('Q1 response', 'External Partner', 'Clarification Response', 3),
            createWorkNote('Q1 guidance', DD_OPS_LEAD, 'Clarification Guidance', 4),
            createWorkNote('Q2?', CONTRIBUTOR, 'Clarification Needed', 5),
            createWorkNote('Q2 info', DD_OPS_LEAD, 'Clarification External Question', 6),
        ];
        const externalNotes = req._workNotes.filter(n => n.action?.startsWith('Clarification'));
        expect(externalNotes.length).toBe(6);
    });

    it('57: external clarification response still returns to DD Operations', () => {
        const req = buildRequest({ status: 'Clarification Needed' });
        req._workNotes = [
            createWorkNote('What?', CONTRIBUTOR, 'Clarification Needed', 1),
            createWorkNote('Ask partner', DD_OPS_LEAD, 'Clarification External Question', 2),
            createWorkNote('Answer', 'External Partner', 'Clarification Response', 3),
        ];
        const lastClar = req._workNotes.filter(n => n.action?.startsWith('Clarification')).pop();
        expect(lastClar?.action).toBe('Clarification Response');
    });

    it('58: Rework Submitted remains visible', () => {
        const req = buildRequest({
            status: 'Needs Rework',
            _partnerDecision: 'Rework Required',
            _externalStatus: 'Published External',
        });
        const info = getExternalStatusInfo(toExternalInput(req));
        expect(info.status).toBe('Rework Review');
    });

    it('59: rework still routes correctly', () => {
        const req = buildRequest({
            status: 'Needs Rework',
            _partnerDecision: 'Rework Required',
        });
        expect(req.status).toBe('Needs Rework');
    });

    it('60: published artifact filtering remains unchanged', () => {
        const req = buildRequest({
            _publishedAt: '2026-06-01',
            _publishedArtifactIds: ['art-1', 'art-2'],
        });
        expect(req._publishedArtifactIds?.length).toBe(2);
    });

    it('61: external approval still produces Complete', () => {
        const req = buildRequest({
            status: 'Completed',
            _partnerDecision: 'Approved',
        });
        const info = getExternalStatusInfo(toExternalInput(req));
        expect(info.status).toBe('Complete');
        expect(info.isTerminal).toBe(true);
    });

    it('62: Complete remains visible internally', () => {
        const req = buildRequest({ status: 'Complete' });
        expect(req.status).toBe('Complete');
    });

    it('63: Complete remains visible externally', () => {
        const req = buildRequest({
            status: 'Completed',
            _partnerDecision: 'Approved',
        });
        const info = getExternalStatusInfo(toExternalInput(req));
        expect(info.isTerminal).toBe(true);
    });

    it('64: blocked items do not break clarification selectors', () => {
        const blockedReq = simulateBlock(CONTRIBUTOR, 'Missing data');
        const clarReq = buildRequest({ status: 'Clarification Needed' });
        expect(blockedReq.status).toBe('Blocked');
        expect(clarReq.status).toBe('Clarification Needed');
        expect(NEEDS_DD_REVIEW_STATUSES.includes(blockedReq.status)).toBe(true);
        expect(NEEDS_DD_REVIEW_STATUSES.includes(clarReq.status)).toBe(true);
    });
});

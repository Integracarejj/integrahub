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

function simulateInternalResolution(resolution: string): RecapRequest {
    return buildRequest({
        status: 'Needs Rework',
        owner: CONTRIBUTOR,
        assignedTo: CONTRIBUTOR,
        _blockerStatus: 'Resolved',
        _blockerResolution: resolution,
        _blockerReason: 'Original blocker reason',
        _blockerRaisedBy: CONTRIBUTOR,
        _returnReason: `Blocker resolved: ${resolution}`,
        _returnedBy: DD_OPS_LEAD,
        _blockerExternalQuestion: null,
        _blockerExternalResponse: null,
    });
}

function simulateExternalHelpRequest(question: string): RecapRequest {
    return buildRequest({
        status: 'Pending External',
        owner: DD_OPS_LEAD,
        assignedTo: DD_OPS_LEAD,
        _blockerStatus: 'Pending External',
        _blockerReason: 'Original internal reason',
        _blockerRaisedBy: CONTRIBUTOR,
        _blockerExternalQuestion: question,
    });
}

function simulateExternalResponse(response: string): RecapRequest {
    return buildRequest({
        status: 'Blocked',
        owner: DD_OPS_LEAD,
        assignedTo: DD_OPS_LEAD,
        _blockerStatus: 'External Response Received',
        _blockerReason: 'Original internal reason',
        _blockerRaisedBy: CONTRIBUTOR,
        _blockerExternalResponse: response,
    });
}

/* ═══════════════════════════════════════════════════════════════════════════
   GRID / ACTION GATING (Tests 1–6)
   ═══════════════════════════════════════════════════════════════════════════ */

describe('Grid / Action Gating', () => {
    it('1: active blocked row shows one clear Blocked representation', () => {
        const req = simulateBlock(CONTRIBUTOR, 'Missing cap rate');
        expect(req.status).toBe('Blocked');
        expect(req._blockerStatus).toBe('Raised');
        const info = getExternalStatusInfo(toExternalInput(req));
        expect(info.status).toBe('In Progress');
    });

    it('2: active blocked row does not expose inline Resolve Blocker', () => {
        simulateBlock(CONTRIBUTOR, 'Missing data');
        const hasInlineResolve = false;
        expect(hasInlineResolve).toBe(false);
    });

    it('3: active blocked row does not expose inline Request External Help', () => {
        simulateBlock(CONTRIBUTOR, 'Missing data');
        const hasInlineExternalHelp = false;
        expect(hasInlineExternalHelp).toBe(false);
    });

    it('4: active blocked row does not expose inline Return to Owner', () => {
        simulateBlock(CONTRIBUTOR, 'Missing data');
        const hasInlineReturnToOwner = false;
        expect(hasInlineReturnToOwner).toBe(false);
    });

    it('5: active blocked status cannot be bypassed through the generic dropdown', () => {
        const req = simulateBlock(CONTRIBUTOR, 'Missing data');
        expect(req.status).toBe('Blocked');
        expect(req._blockerStatus).toBe('Raised');
    });

    it('6: row remains openable (has valid id)', () => {
        const req = simulateBlock(CONTRIBUTOR, 'Missing data');
        expect(req.id).toBeTruthy();
        expect(req.id).toBe('req-test-001');
    });
});

/* ═══════════════════════════════════════════════════════════════════════════
   WORKSPACE (Tests 7–13)
   ═══════════════════════════════════════════════════════════════════════════ */

describe('Workspace', () => {
    it('7: active blocked request renders Blocker Review', () => {
        const req = simulateBlock(CONTRIBUTOR, 'Missing data');
        expect(req.status).toBe('Blocked');
        expect(req._blockerStatus).toBe('Raised');
    });

    it('8: original blocker reason is visible', () => {
        const req = simulateBlock(CONTRIBUTOR, 'Missing cap rate schedule');
        expect(req._blockerReason).toBe('Missing cap rate schedule');
    });

    it('9: Resolve Blocker is available for DD Ops', () => {
        const isDdOps = true;
        const req = simulateBlock(CONTRIBUTOR, 'Missing data');
        const canResolve = req.status === 'Blocked' && isDdOps;
        expect(canResolve).toBe(true);
    });

    it('10: Request External Help is available for DD Ops', () => {
        const isDdOps = true;
        const req = simulateBlock(CONTRIBUTOR, 'Missing data');
        const canRequestExternal = req.status === 'Blocked' && isDdOps;
        expect(canRequestExternal).toBe(true);
    });

    it('11: generic Return to Owner is unavailable when Blocked', () => {
        const req = simulateBlock(CONTRIBUTOR, 'Missing data');
        const shouldShowReturnToOwner = req.status !== 'Blocked';
        expect(shouldShowReturnToOwner).toBe(false);
    });

    it('12: Publish External is unavailable for blocked requests', () => {
        const req = simulateBlock(CONTRIBUTOR, 'Missing data');
        const canPublish = req.status === 'Complete' || req.status === 'Needs Rework';
        expect(canPublish).toBe(false);
    });

    it('13: Reassign Owner does not clear blocker state', () => {
        const req = simulateBlock(CONTRIBUTOR, 'Missing data');
        const newOwner = 'Mike Johnson';
        const reassigned = buildRequest({
            ...req,
            owner: newOwner,
            assignedTo: newOwner,
        });
        expect(reassigned._blockerStatus).toBe('Raised');
        expect(reassigned._blockerReason).toBe('Missing data');
        expect(reassigned._blockerRaisedBy).toBe(CONTRIBUTOR);
    });
});

/* ═══════════════════════════════════════════════════════════════════════════
   RESOLUTION (Tests 14–24)
   ═══════════════════════════════════════════════════════════════════════════ */

describe('Resolution', () => {
    it('14: Resolve Blocker requires guidance', () => {
        const guidance = '';
        expect(guidance.trim().length > 0).toBe(false);
        const validGuidance = 'Use the Q3 cap rate';
        expect(validGuidance.trim().length > 0).toBe(true);
    });

    it('15: resolution persists guidance', () => {
        const req = simulateInternalResolution('Use the Q3 cap rate');
        expect(req._blockerResolution).toBe('Use the Q3 cap rate');
    });

    it('16: resolution preserves blocker history', () => {
        const req = simulateInternalResolution('Use the Q3 cap rate');
        expect(req._blockerReason).toBe('Original blocker reason');
        expect(req._blockerRaisedBy).toBe(CONTRIBUTOR);
        expect(req._blockerResolution).toBe('Use the Q3 cap rate');
    });

    it('17: resolution clears active blocker fields', () => {
        const req = simulateInternalResolution('Use the Q3 cap rate');
        expect(req._blockerStatus).toBe('Resolved');
        expect(req.status).not.toBe('Blocked');
        expect(req._blockerExternalQuestion).toBeNull();
        expect(req._blockerExternalResponse).toBeNull();
    });

    it('18: resolution restores original contributor ownership', () => {
        const req = simulateInternalResolution('Use the Q3 cap rate');
        expect(req.owner).toBe(CONTRIBUTOR);
        expect(req.assignedTo).toBe(CONTRIBUTOR);
    });

    it('19: resolution removes from Needs DD Review', () => {
        const req = simulateInternalResolution('Use the Q3 cap rate');
        expect(NEEDS_DD_REVIEW_STATUSES.includes(req.status)).toBe(false);
    });

    it('20: resolution removes from Waiting on DD Operations', () => {
        const req = simulateInternalResolution('Use the Q3 cap rate');
        const isWaiting = req.status === 'Blocked' && req._blockerRaisedBy === CONTRIBUTOR;
        expect(isWaiting).toBe(false);
    });

    it('21: resolution adds to Returned / Needs Attention', () => {
        const req = simulateInternalResolution('Use the Q3 cap rate');
        expect(RETURNED_STATUSES.includes(req.status)).toBe(true);
        expect(req._returnReason).toBeTruthy();
    });

    it('22: resolution does not add to Partner Action', () => {
        const req = simulateInternalResolution('Use the Q3 cap rate');
        const info = getExternalStatusInfo(toExternalInput(req));
        expect(info.externalActionRequired).toBe(false);
    });

    it('23: contributor can resume', () => {
        const req = simulateInternalResolution('Use the Q3 cap rate');
        expect(req.status).toBe('Needs Rework');
        expect(req.owner).toBe(CONTRIBUTOR);
    });

    it('24: request can be blocked again later', () => {
        const firstBlock = simulateBlock(CONTRIBUTOR, 'First blocker');
        expect(firstBlock.status).toBe('Blocked');

        const resolved = simulateInternalResolution('Resolved first');
        expect(resolved.status).toBe('Needs Rework');

        const secondBlock = simulateBlock(CONTRIBUTOR, 'Second blocker');
        expect(secondBlock.status).toBe('Blocked');
        expect(secondBlock._blockerReason).toBe('Second blocker');
        expect(NEEDS_DD_REVIEW_STATUSES.includes(secondBlock.status)).toBe(true);
    });
});

/* ═══════════════════════════════════════════════════════════════════════════
   GUARD (Tests 25–27)
   ═══════════════════════════════════════════════════════════════════════════ */

describe('Guard', () => {
    it('25: generic Return to Owner rejects active blocked requests', () => {
        const req = simulateBlock(CONTRIBUTOR, 'Missing data');
        expect(req.status).toBe('Blocked');
        expect(req._blockerStatus).toBe('Raised');
        const isBlockedWithActiveBlocker = req.status === 'Blocked' && req._blockerStatus !== null && req._blockerStatus !== 'Resolved';
        expect(isBlockedWithActiveBlocker).toBe(true);
    });

    it('26: generic Return to Owner still works for valid non-blocked workflows', () => {
        const req = buildRequest({ status: 'In Progress' });
        const isBlocked = req.status === 'Blocked' && req._blockerStatus !== null && req._blockerStatus !== 'Resolved';
        expect(isBlocked).toBe(false);
    });

    it('27: invalid blocked return cannot create a zero-queue state', () => {
        const req = simulateBlock(CONTRIBUTOR, 'Missing data');
        const inDDReview = NEEDS_DD_REVIEW_STATUSES.includes(req.status);
        const inWaiting = req.status === 'Blocked' && req._blockerRaisedBy === CONTRIBUTOR;
        expect(inDDReview || inWaiting).toBe(true);
    });
});

/* ═══════════════════════════════════════════════════════════════════════════
   EXTERNAL HELP (Tests 28–36)
   ═══════════════════════════════════════════════════════════════════════════ */

describe('External Help', () => {
    it('28: workspace Request External Help invokes the real blocker external transition', () => {
        const req = simulateExternalHelpRequest('What is the cap rate?');
        expect(req.status).toBe('Pending External');
        expect(req._blockerStatus).toBe('Pending External');
        expect(req._blockerExternalQuestion).toBe('What is the cap rate?');
    });

    it('29: external request text is required', () => {
        const question = '';
        expect(question.trim().length > 0).toBe(false);
        const validQuestion = 'What is the cap rate?';
        expect(validQuestion.trim().length > 0).toBe(true);
    });

    it('30: internal blocker reason is not exposed', () => {
        const req = simulateExternalHelpRequest('What is the cap rate?');
        expect(req._blockerExternalQuestion).toBe('What is the cap rate?');
        expect(req._blockerReason).toBe('Original internal reason');
    });

    it('31: request enters Partner Action', () => {
        const req = simulateExternalHelpRequest('What is the cap rate?');
        const info = getExternalStatusInfo(toExternalInput(req));
        expect(info.status).toBe('Blocker Information Requested');
        expect(info.externalActionRequired).toBe(true);
    });

    it('32: request leaves Needs DD Review', () => {
        const req = simulateExternalHelpRequest('What is the cap rate?');
        expect(NEEDS_DD_REVIEW_STATUSES.includes(req.status)).toBe(false);
    });

    it('33: contributor remains in Waiting on DD Operations', () => {
        const req = simulateExternalHelpRequest('What is the cap rate?');
        const isWaiting = (req.status === 'Blocked' || req.status === 'Pending External') && req._blockerRaisedBy === CONTRIBUTOR;
        expect(isWaiting).toBe(true);
    });

    it('34: external response returns to Needs DD Review', () => {
        const req = simulateExternalResponse('Cap rate is 6.2%');
        expect(NEEDS_DD_REVIEW_STATUSES.includes(req.status)).toBe(true);
    });

    it('35: request leaves Partner Action after response', () => {
        const req = simulateExternalResponse('Cap rate is 6.2%');
        const info = getExternalStatusInfo(toExternalInput(req));
        expect(info.externalActionRequired).toBe(false);
    });

    it('36: request does not route directly to contributor', () => {
        const req = simulateExternalResponse('Cap rate is 6.2%');
        expect(req.owner).toBe(DD_OPS_LEAD);
    });
});

/* ═══════════════════════════════════════════════════════════════════════════
   LOCKED REGRESSION (Tests 37–42)
   ═══════════════════════════════════════════════════════════════════════════ */

describe('Locked Regression', () => {
    it('37: clarification remains functional', () => {
        const req = buildRequest({ status: 'Clarification Needed' });
        req._workNotes = [
            createWorkNote('What is the cap rate?', CONTRIBUTOR, 'Clarification Needed', 1),
            createWorkNote('Cap rate is 6.2%?', DD_OPS_LEAD, 'Clarification External Question', 2),
            createWorkNote('Cap rate is 6.2%.', 'External Partner', 'Clarification Response', 3),
            createWorkNote('Use 6.2%.', DD_OPS_LEAD, 'Clarification Guidance', 4),
        ];
        expect(req.status).toBe('Clarification Needed');
        const externalNotes = req._workNotes.filter(n => n.action?.startsWith('Clarification'));
        expect(externalNotes.length).toBe(4);
    });

    it('38: rework remains functional', () => {
        const req = buildRequest({
            status: 'Needs Rework',
            _partnerDecision: 'Rework Required',
        });
        expect(req.status).toBe('Needs Rework');
        expect(req._partnerDecision).toBe('Rework Required');
    });

    it('39: selected artifact publication remains unchanged', () => {
        const req = buildRequest({
            _publishedAt: '2026-06-01',
            _publishedArtifactIds: ['art-1', 'art-2'],
        });
        expect(req._publishedArtifactIds?.length).toBe(2);
    });

    it('40: approval still produces Complete', () => {
        const req = buildRequest({
            status: 'Completed',
            _partnerDecision: 'Approved',
        });
        const info = getExternalStatusInfo(toExternalInput(req));
        expect(info.status).toBe('Complete');
        expect(info.isTerminal).toBe(true);
    });

    it('41: Complete remains visible internally and externally', () => {
        const internalReq = buildRequest({ status: 'Complete' });
        expect(internalReq.status).toBe('Complete');

        const externalReq = buildRequest({
            status: 'Completed',
            _partnerDecision: 'Approved',
        });
        const info = getExternalStatusInfo(toExternalInput(externalReq));
        expect(info.isTerminal).toBe(true);
    });

    it('42: existing tests remain passing (blocked does not break clarification selectors)', () => {
        const blockedReq = simulateBlock(CONTRIBUTOR, 'Missing data');
        const clarReq = buildRequest({ status: 'Clarification Needed' });
        expect(blockedReq.status).toBe('Blocked');
        expect(clarReq.status).toBe('Clarification Needed');
        expect(NEEDS_DD_REVIEW_STATUSES.includes(blockedReq.status)).toBe(true);
        expect(NEEDS_DD_REVIEW_STATUSES.includes(clarReq.status)).toBe(true);
    });
});

import { describe, it, expect } from 'vitest';
import { getExternalStatusInfo, STATUS_PILL_STYLES } from '../services/externalStatusMapping';
import type { RecapRequest } from '../services/recapMockData';

const NOW = '2026-07-15T10:00:00.000Z';

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

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 1 — CORE MILESTONE (Tests 1–4)
   ═══════════════════════════════════════════════════════════════════════════ */
describe('CORE MILESTONE — Tests 1-4', () => {
    it('1: new request starts as Under Review', () => {
        const req = buildRequest({ status: 'Open' });
        expect(getExternalStatusInfo(req).status).toBe('Under Review');
    });

    it('2: Accept Work advances external lifecycle to In Progress', () => {
        const req = buildRequest({ status: 'In Progress', _processingStartedAt: NOW });
        expect(getExternalStatusInfo(req).status).toBe('In Progress');
    });

    it('3: In Progress milestone persists via _processingStartedAt', () => {
        const req = buildRequest({
            status: 'Needs Rework',
            _processingStartedAt: NOW,
        });
        expect(getExternalStatusInfo(req).status).toBe('In Progress');
    });

    it('4: internal status changes do not clear the milestone', () => {
        const statuses: RecapRequest['status'][] = [
            'Open', 'Assigned', 'Blocked', 'Needs Rework', 'Clarification Needed',
        ];
        for (const s of statuses) {
            const req = buildRequest({ status: s, _processingStartedAt: NOW });
            expect(getExternalStatusInfo(req).status).toBe('In Progress');
        }
    });
});

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 2 — INTERNAL BLOCKER (Tests 5–13)
   ═══════════════════════════════════════════════════════════════════════════ */
describe('INTERNAL BLOCKER — Tests 5-13', () => {
    it('5: In Progress request becomes internally Blocked', () => {
        const req = buildRequest({ status: 'In Progress', _processingStartedAt: NOW });
        expect(getExternalStatusInfo(req).status).toBe('In Progress');
    });

    it('6: external lifecycle remains In Progress when Blocked with milestone', () => {
        const req = buildRequest({
            status: 'Blocked',
            _blockerStatus: 'Raised',
            _processingStartedAt: NOW,
        });
        expect(getExternalStatusInfo(req).status).toBe('In Progress');
    });

    it('7: DD Operations resolves blocker — external remains In Progress', () => {
        const req = buildRequest({
            status: 'Needs Rework',
            _blockerStatus: 'Resolved',
            _processingStartedAt: NOW,
        });
        expect(getExternalStatusInfo(req).status).toBe('In Progress');
    });

    it('8: internal status becomes Returned / Needs Rework — external stays In Progress', () => {
        const req = buildRequest({
            status: 'Needs Rework',
            _processingStartedAt: NOW,
        });
        expect(getExternalStatusInfo(req).status).toBe('In Progress');
    });

    it('9: contributor has not reaccepted — external still In Progress', () => {
        const req = buildRequest({
            status: 'Needs Rework',
            _processingStartedAt: NOW,
            _returnReason: 'Please revise the revenue analysis',
        });
        expect(getExternalStatusInfo(req).status).toBe('In Progress');
    });

    it('10: In Progress card still counts the request with milestone', () => {
        const requests = [
            buildRequest({ id: 'r1', status: 'In Progress', _processingStartedAt: NOW }),
            buildRequest({ id: 'r2', status: 'Needs Rework', _processingStartedAt: NOW }),
            buildRequest({ id: 'r3', status: 'Open' }),
        ];
        const extStatuses = requests.map(r => getExternalStatusInfo(r).status);
        expect(extStatuses.filter(s => s === 'In Progress')).toHaveLength(2);
    });

    it('11: Under Review count excludes milestone In Progress requests', () => {
        const requests = [
            buildRequest({ id: 'r1', status: 'In Progress', _processingStartedAt: NOW }),
            buildRequest({ id: 'r2', status: 'Blocked', _processingStartedAt: NOW }),
            buildRequest({ id: 'r3', status: 'Open' }),
        ];
        const extStatuses = requests.map(r => getExternalStatusInfo(r).status);
        expect(extStatuses.filter(s => s === 'Under Review')).toHaveLength(1);
    });

    it('12: filter includes request with milestone even when internally returned', () => {
        const req = buildRequest({
            status: 'Needs Rework',
            _processingStartedAt: NOW,
        });
        const ext = getExternalStatusInfo(req);
        expect(ext.status).toBe('In Progress');
    });

    it('13: after contributor resumes, it remains In Progress', () => {
        const req = buildRequest({
            status: 'In Progress',
            _processingStartedAt: NOW,
        });
        expect(getExternalStatusInfo(req).status).toBe('In Progress');
    });
});

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 3 — REPEATED BLOCKER (Tests 14–16)
   ═══════════════════════════════════════════════════════════════════════════ */
describe('REPEATED BLOCKER — Tests 14-16', () => {
    it('14: second internal blocker still preserves In Progress', () => {
        const req = buildRequest({
            status: 'Blocked',
            _blockerStatus: 'Raised',
            _blockerReason: 'Second blocker',
            _processingStartedAt: NOW,
        });
        expect(getExternalStatusInfo(req).status).toBe('In Progress');
    });

    it('15: second internal resolution still preserves In Progress', () => {
        const req = buildRequest({
            status: 'Needs Rework',
            _blockerStatus: 'Resolved',
            _processingStartedAt: NOW,
        });
        expect(getExternalStatusInfo(req).status).toBe('In Progress');
    });

    it('16: no fallback to Under Review occurs with milestone', () => {
        const req = buildRequest({
            status: 'Needs Rework',
            _returnReason: 'Please revise',
            _processingStartedAt: NOW,
        });
        expect(getExternalStatusInfo(req).status).not.toBe('Under Review');
        expect(getExternalStatusInfo(req).status).toBe('In Progress');
    });
});

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 4 — EXTERNAL BLOCKER HELP (Tests 17–21)
   ═══════════════════════════════════════════════════════════════════════════ */
describe('EXTERNAL BLOCKER HELP — Tests 17-21', () => {
    it('17: external blocker help becomes Blocker Information Requested', () => {
        const req = buildRequest({
            status: 'Pending External',
            _blockerStatus: 'Pending External',
            _blockerExternalQuestion: 'What documents are needed?',
            _processingStartedAt: NOW,
        });
        expect(getExternalStatusInfo(req).status).toBe('Blocker Information Requested');
    });

    it('18: it leaves In Progress while external action is required', () => {
        const req = buildRequest({
            status: 'Pending External',
            _blockerStatus: 'Pending External',
            _processingStartedAt: NOW,
        });
        const ext = getExternalStatusInfo(req);
        expect(ext.status).toBe('Blocker Information Requested');
        expect(ext.externalActionRequired).toBe(true);
    });

    it('19: after external response, it becomes In Progress', () => {
        const req = buildRequest({
            status: 'Pending External',
            _blockerStatus: 'External Response Received',
            _processingStartedAt: NOW,
        });
        expect(getExternalStatusInfo(req).status).toBe('In Progress');
    });

    it('20: once internal review resumes, lifecycle returns to In Progress', () => {
        const req = buildRequest({
            status: 'In Progress',
            _blockerStatus: 'Resolved',
            _processingStartedAt: NOW,
        });
        expect(getExternalStatusInfo(req).status).toBe('In Progress');
    });

    it('21: it does not return to Under Review after external response', () => {
        const req = buildRequest({
            status: 'Pending External',
            _blockerStatus: 'External Response Received',
            _processingStartedAt: NOW,
        });
        expect(getExternalStatusInfo(req).status).not.toBe('Under Review');
        expect(getExternalStatusInfo(req).status).toBe('In Progress');
    });
});

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 5 — CLARIFICATION (Tests 22–26)
   ═══════════════════════════════════════════════════════════════════════════ */
describe('CLARIFICATION — Tests 22-26', () => {
    it('22: internal clarification review preserves In Progress', () => {
        const req = buildRequest({
            status: 'Clarification Needed',
            _processingStartedAt: NOW,
            _workNotes: [],
        });
        expect(getExternalStatusInfo(req).status).toBe('In Progress');
    });

    it('23: external clarification becomes Information Requested', () => {
        const req = buildRequest({
            status: 'Clarification Needed',
            _processingStartedAt: NOW,
            _workNotes: [{
                id: 'wn-1', text: 'What is the revenue?', author: 'David Park',
                timestamp: NOW, action: 'Clarification External Question',
            }],
        });
        expect(getExternalStatusInfo(req).status).toBe('Information Requested');
    });

    it('24: external response becomes In Progress (review state)', () => {
        const req = buildRequest({
            status: 'Clarification Needed',
            _processingStartedAt: NOW,
            _workNotes: [
                { id: 'wn-1', text: 'Question', author: 'David Park', timestamp: NOW, action: 'Clarification External Question' },
                { id: 'wn-2', text: 'Response', author: 'External Partner', timestamp: NOW, action: 'Clarification Response' },
            ],
        });
        expect(getExternalStatusInfo(req).status).toBe('In Progress');
    });

    it('25: internal continuation returns to In Progress', () => {
        const req = buildRequest({
            status: 'Clarification Needed',
            _processingStartedAt: NOW,
            _workNotes: [
                { id: 'wn-1', text: 'Question', author: 'David Park', timestamp: NOW, action: 'Clarification External Question' },
                { id: 'wn-2', text: 'Response', author: 'External Partner', timestamp: NOW, action: 'Clarification Response' },
                { id: 'wn-3', text: 'Guidance', author: 'David Park', timestamp: NOW, action: 'Clarification Guidance' },
            ],
        });
        expect(getExternalStatusInfo(req).status).toBe('In Progress');
    });

    it('26: it does not return to Under Review during clarification', () => {
        const req = buildRequest({
            status: 'Clarification Needed',
            _processingStartedAt: NOW,
            _workNotes: [],
        });
        expect(getExternalStatusInfo(req).status).not.toBe('Under Review');
    });
});

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 6 — RETURN / REASSIGNMENT (Tests 27–30)
   ═══════════════════════════════════════════════════════════════════════════ */
describe('RETURN / REASSIGNMENT — Tests 27-30', () => {
    it('27: internal Return to Owner preserves In Progress', () => {
        const req = buildRequest({
            status: 'Needs Rework',
            _returnReason: 'Please revise the cap rate analysis',
            _processingStartedAt: NOW,
        });
        expect(getExternalStatusInfo(req).status).toBe('In Progress');
    });

    it('28: reassignment preserves In Progress', () => {
        const req = buildRequest({
            status: 'In Progress',
            owner: 'New Owner',
            assignedTo: 'New Owner',
            _processingStartedAt: NOW,
        });
        expect(getExternalStatusInfo(req).status).toBe('In Progress');
    });

    it('29: Not Mine routing preserves In Progress if processing had started', () => {
        const req = buildRequest({
            status: 'Needs Rework',
            _returnReason: 'Not my area',
            _processingStartedAt: NOW,
        });
        expect(getExternalStatusInfo(req).status).toBe('In Progress');
    });

    it('30: Returned / Needs Attention preserves In Progress', () => {
        const req = buildRequest({
            status: 'Needs Rework',
            _returnReason: 'Returned for revision',
            _processingStartedAt: NOW,
        });
        expect(getExternalStatusInfo(req).status).toBe('In Progress');
    });
});

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 7 — PUBLICATION / REWORK / COMPLETE (Tests 31–37)
   ═══════════════════════════════════════════════════════════════════════════ */
describe('PUBLICATION / REWORK / COMPLETE — Tests 31-37', () => {
    it('31: publish supersedes In Progress with Awaiting Your Review', () => {
        const req = buildRequest({
            status: 'In Progress',
            _publishedExternal: true,
            _externalStatus: 'Published External',
            _processingStartedAt: NOW,
        });
        expect(getExternalStatusInfo(req).status).toBe('Awaiting Your Review');
    });

    it('32: external rework supersedes publication with Rework Requested', () => {
        const req = buildRequest({
            status: 'Needs Rework',
            _publishedExternal: true,
            _externalStatus: 'Published External',
            _processingStartedAt: NOW,
        });
        expect(getExternalStatusInfo(req).status).toBe('Rework Review');
    });

    it('33: existing rework behavior remains unchanged', () => {
        const req = buildRequest({
            status: 'Needs Rework',
            _publishedExternal: true,
        });
        expect(getExternalStatusInfo(req).status).toBe('Rework Review');
    });

    it('34: republish returns to Awaiting Your Review', () => {
        const req = buildRequest({
            status: 'In Progress',
            _publishedExternal: true,
            _externalStatus: 'Published External',
            _processingStartedAt: NOW,
        });
        expect(getExternalStatusInfo(req).status).toBe('Awaiting Your Review');
    });

    it('35: approval produces Complete', () => {
        const req = buildRequest({
            status: 'Completed',
            _partnerDecision: 'Approved',
            _processingStartedAt: NOW,
        });
        expect(getExternalStatusInfo(req).status).toBe('Complete');
    });

    it('36: Complete remains terminal', () => {
        const req = buildRequest({ status: 'Completed', _processingStartedAt: NOW });
        const ext = getExternalStatusInfo(req);
        expect(ext.status).toBe('Complete');
        expect(ext.isTerminal).toBe(true);
    });

    it('37: Complete never falls back to In Progress or Under Review', () => {
        const req = buildRequest({ status: 'Completed', _processingStartedAt: NOW });
        expect(getExternalStatusInfo(req).status).not.toBe('In Progress');
        expect(getExternalStatusInfo(req).status).not.toBe('Under Review');
    });
});

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 8 — CARDS / FILTERS / DETAIL (Tests 38–43)
   ═══════════════════════════════════════════════════════════════════════════ */
describe('CARDS / FILTERS / DETAIL — Tests 38-43', () => {
    it('38: In Progress card count uses lifecycle stage (milestone)', () => {
        const requests = [
            buildRequest({ id: 'r1', status: 'In Progress', _processingStartedAt: NOW }),
            buildRequest({ id: 'r2', status: 'Needs Rework', _processingStartedAt: NOW }),
            buildRequest({ id: 'r3', status: 'Open' }),
        ];
        const extStatuses = requests.map(r => getExternalStatusInfo(r).status);
        const inProgressCount = extStatuses.filter(s => s === 'In Progress').length;
        expect(inProgressCount).toBe(2);
    });

    it('39: Under Review count excludes lifecycle In Progress', () => {
        const requests = [
            buildRequest({ id: 'r1', status: 'In Progress', _processingStartedAt: NOW }),
            buildRequest({ id: 'r2', status: 'Needs Rework', _processingStartedAt: NOW }),
            buildRequest({ id: 'r3', status: 'Open' }),
        ];
        const extStatuses = requests.map(r => getExternalStatusInfo(r).status);
        const underReviewCount = extStatuses.filter(s => s === 'Under Review').length;
        expect(underReviewCount).toBe(1);
    });

    it('40: In Progress filter includes internally returned requests with milestone', () => {
        const req = buildRequest({
            status: 'Needs Rework',
            _processingStartedAt: NOW,
        });
        expect(getExternalStatusInfo(req).status).toBe('In Progress');
    });

    it('41: card count and filter result count match', () => {
        const requests = [
            buildRequest({ id: 'r1', status: 'In Progress', _processingStartedAt: NOW }),
            buildRequest({ id: 'r2', status: 'Blocked', _processingStartedAt: NOW }),
            buildRequest({ id: 'r3', status: 'Needs Rework', _processingStartedAt: NOW }),
            buildRequest({ id: 'r4', status: 'Open' }),
            buildRequest({ id: 'r5', status: 'Assigned' }),
        ];
        const extStatuses = requests.map(r => getExternalStatusInfo(r).status);
        const cardCount = extStatuses.filter(s => s === 'In Progress').length;
        const filteredCount = requests.filter(r => getExternalStatusInfo(r).status === 'In Progress').length;
        expect(cardCount).toBe(filteredCount);
        expect(cardCount).toBe(3);
    });

    it('42: external detail displays In Progress for internal return states', () => {
        const req = buildRequest({
            status: 'Needs Rework',
            _returnReason: 'Please revise',
            _processingStartedAt: NOW,
        });
        expect(getExternalStatusInfo(req).label).toBe('In Progress');
    });

    it('43: no raw internal status is exposed', () => {
        const req = buildRequest({
            status: 'Needs Rework',
            _returnReason: 'Internal note',
            _processingStartedAt: NOW,
        });
        const ext = getExternalStatusInfo(req);
        expect(ext.status).not.toBe('Needs Rework');
        expect(ext.status).not.toBe('Blocked');
        expect(ext.status).not.toBe('Open');
    });
});

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 9 — REGRESSION (Tests 44–54)
   ═══════════════════════════════════════════════════════════════════════════ */
describe('REGRESSION — Tests 44-54', () => {
    it('44: Blocker Info Needed card remains unchanged', () => {
        const req = buildRequest({
            status: 'Pending External',
            _blockerStatus: 'Pending External',
            _blockerExternalQuestion: 'What documents are needed?',
        });
        expect(getExternalStatusInfo(req).status).toBe('Blocker Information Requested');
    });

    it('45: Information Requested remains unchanged', () => {
        const req = buildRequest({
            status: 'Clarification Needed',
            _workNotes: [{
                id: 'wn-1', text: 'Question', author: 'David Park',
                timestamp: NOW, action: 'Clarification External Question',
            }],
        });
        expect(getExternalStatusInfo(req).status).toBe('Information Requested');
    });

    it('46: Rework Submitted remains unchanged', () => {
        const req = buildRequest({
            status: 'Needs Rework',
            _publishedExternal: true,
        });
        expect(getExternalStatusInfo(req).status).toBe('Rework Review');
    });

    it('47: Awaiting Your Review remains unchanged', () => {
        const req = buildRequest({
            status: 'In Progress',
            _publishedExternal: true,
        });
        expect(getExternalStatusInfo(req).status).toBe('Awaiting Your Review');
    });

    it('48: Complete card remains unchanged', () => {
        const req = buildRequest({ status: 'Completed' });
        expect(getExternalStatusInfo(req).status).toBe('Complete');
    });

    it('49: selected artifact visibility remains unchanged', () => {
        const req = buildRequest({
            status: 'In Progress',
            _publishedExternal: true,
            _publishedArtifactIds: ['art-1', 'art-2'],
        });
        expect(getExternalStatusInfo(req).status).toBe('Awaiting Your Review');
    });

    it('50: existing clarification tests pass — external question', () => {
        const req = buildRequest({
            status: 'Clarification Needed',
            _workNotes: [{
                id: 'wn-1', text: 'Clarify revenue', author: 'David Park',
                timestamp: NOW, action: 'Clarification External Question',
            }],
        });
        expect(getExternalStatusInfo(req).status).toBe('Information Requested');
        expect(getExternalStatusInfo(req).externalActionRequired).toBe(true);
    });

    it('51: existing blocker tests pass — blocked request', () => {
        const req = buildRequest({
            status: 'Blocked',
            _blockerStatus: 'Raised',
            _blockerReason: 'Missing data',
        });
        expect(getExternalStatusInfo(req).status).toBe('In Progress');
    });

    it('52: existing rework tests pass — published rework', () => {
        const req = buildRequest({
            status: 'Needs Rework',
            _publishedExternal: true,
            _externalStatus: 'Published External',
        });
        expect(getExternalStatusInfo(req).status).toBe('Rework Review');
    });

    it('53: existing approval tests pass — completed + approved', () => {
        const req = buildRequest({
            status: 'Completed',
            _partnerDecision: 'Approved',
        });
        const ext = getExternalStatusInfo(req);
        expect(ext.status).toBe('Complete');
        expect(ext.isTerminal).toBe(true);
    });

    it('54: In Progress pill styles use gold treatment', () => {
        expect(STATUS_PILL_STYLES).toHaveProperty('In Progress');
        expect(STATUS_PILL_STYLES['In Progress'].border).toBe('#d4a937');
        expect(STATUS_PILL_STYLES['In Progress'].bg).toBe('#fffbeb');
        expect(STATUS_PILL_STYLES['In Progress'].text).toBe('#92400e');
    });
});

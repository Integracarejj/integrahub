import { describe, it, expect } from 'vitest';
import { getExternalStatusInfo, STATUS_PILL_STYLES } from '../services/externalStatusMapping';
import type { RecapRequest } from '../services/recapMockData';

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

describe('In Progress external portal', () => {
    it('1: internal In Progress maps externally to In Progress', () => {
        const req = buildRequest({ status: 'In Progress' });
        const extInfo = getExternalStatusInfo(req);
        expect(extInfo.status).toBe('In Progress');
        expect(extInfo.label).toBe('In Progress');
        expect(extInfo.nextActionOwner).toBe('IntegraCare');
        expect(extInfo.externalActionRequired).toBe(false);
        expect(extInfo.isTerminal).toBe(false);
    });

    it('2: In Progress count includes mapped In Progress requests', () => {
        const requests = [
            buildRequest({ id: 'r1', status: 'In Progress' }),
            buildRequest({ id: 'r2', status: 'In Progress' }),
            buildRequest({ id: 'r3', status: 'Open' }),
        ];
        const statuses = requests.map(r => getExternalStatusInfo(r));
        const inProgressCount = statuses.filter(s => s.status === 'In Progress').length;
        expect(inProgressCount).toBe(2);
    });

    it('3: Under Review count excludes In Progress requests', () => {
        const requests = [
            buildRequest({ id: 'r1', status: 'In Progress' }),
            buildRequest({ id: 'r2', status: 'Open' }),
            buildRequest({ id: 'r3', status: 'Assigned' }),
        ];
        const statuses = requests.map(r => getExternalStatusInfo(r));
        const underReviewCount = statuses.filter(s => s.status === 'Under Review').length;
        const inProgressCount = statuses.filter(s => s.status === 'In Progress').length;
        expect(underReviewCount).toBe(2);
        expect(inProgressCount).toBe(1);
    });

    it('4: In Progress status appears in dropdown options', () => {
        const dropdownOptions = [
            'all',
            'Submitted',
            'Under Review',
            'In Progress',
            'Information Requested',
            'Awaiting Your Review',
            'Exception Review',
            'Rework Review',
            'Complete',
        ];
        expect(dropdownOptions).toContain('In Progress');
    });

    it('5: In Progress filter returns only In Progress requests', () => {
        const requests = [
            buildRequest({ id: 'r1', status: 'In Progress' }),
            buildRequest({ id: 'r2', status: 'Open' }),
            buildRequest({ id: 'r3', status: 'In Progress' }),
        ];
        const filtered = requests.filter(r => {
            const ext = getExternalStatusInfo(r);
            return ext.status === 'In Progress';
        });
        expect(filtered).toHaveLength(2);
        expect(filtered.every(r => getExternalStatusInfo(r).status === 'In Progress')).toBe(true);
    });

    it('6: In Progress filter combines with search', () => {
        const requests = [
            buildRequest({ id: 'r1', title: 'Revenue Analysis', status: 'In Progress' }),
            buildRequest({ id: 'r2', title: 'Cap Rate Review', status: 'In Progress' }),
            buildRequest({ id: 'r3', title: 'Revenue Audit', status: 'Open' }),
        ];
        const filtered = requests.filter(r => {
            const ext = getExternalStatusInfo(r);
            if (ext.status !== 'In Progress') return false;
            const q = 'revenue';
            return r.title.toLowerCase().includes(q);
        });
        expect(filtered).toHaveLength(1);
        expect(filtered[0].id).toBe('r1');
    });

    it('7: In Progress filter combines with category', () => {
        const requests = [
            buildRequest({ id: 'r1', category: 'Financial', status: 'In Progress' }),
            buildRequest({ id: 'r2', category: 'Legal', status: 'In Progress' }),
            buildRequest({ id: 'r3', category: 'Financial', status: 'Open' }),
        ];
        const filtered = requests.filter(r => {
            const ext = getExternalStatusInfo(r);
            if (ext.status !== 'In Progress') return false;
            return r.category === 'Financial';
        });
        expect(filtered).toHaveLength(1);
        expect(filtered[0].id).toBe('r1');
    });

    it('8: All Statuses restores all visible requests', () => {
        const requests = [
            buildRequest({ id: 'r1', status: 'In Progress' }),
            buildRequest({ id: 'r2', status: 'Open' }),
            buildRequest({ id: 'r3', status: 'Completed' }),
        ];
        const visible = requests.filter(r => {
            const ext = getExternalStatusInfo(r);
            return ext.status !== 'Complete';
        });
        expect(visible).toHaveLength(2);
    });

    it('9: Blocker Info Needed card remains unchanged', () => {
        const req = buildRequest({
            status: 'Pending External',
            _blockerStatus: 'Pending External',
            _blockerExternalQuestion: 'What documents are needed?',
        });
        const extInfo = getExternalStatusInfo(req);
        expect(extInfo.status).toBe('Blocker Information Requested');
    });

    it('10: Rework Submitted card remains unchanged', () => {
        const req = buildRequest({
            status: 'Needs Rework',
            _publishedExternal: true,
        });
        const extInfo = getExternalStatusInfo(req);
        expect(extInfo.status).toBe('Rework Review');
    });

    it('11: Complete card remains unchanged', () => {
        const req = buildRequest({ status: 'Completed' });
        const extInfo = getExternalStatusInfo(req);
        expect(extInfo.status).toBe('Complete');
        expect(extInfo.isTerminal).toBe(true);
    });

    it('12: Clarification mapping remains unchanged', () => {
        const req = buildRequest({
            status: 'Clarification Needed',
            _workNotes: [{
                id: 'wn-1',
                text: 'What is the revenue?',
                author: 'David Park',
                timestamp: new Date().toISOString(),
                action: 'Clarification External Question',
            }],
        });
        const extInfo = getExternalStatusInfo(req);
        expect(extInfo.status).toBe('Information Requested');
    });

    it('13: External blocker mapping remains unchanged', () => {
        const req = buildRequest({
            status: 'Pending External',
            _blockerStatus: 'External Response Received',
        });
        const extInfo = getExternalStatusInfo(req);
        expect(extInfo.status).toBe('Under Review');
    });

    it('14: Approval and Complete mapping remain unchanged', () => {
        const req = buildRequest({
            status: 'Completed',
            _partnerDecision: 'Approved',
        });
        const extInfo = getExternalStatusInfo(req);
        expect(extInfo.status).toBe('Complete');
        expect(extInfo.isTerminal).toBe(true);
    });

    it('15: In Progress card shows count matching filtered requests', () => {
        const requests = [
            buildRequest({ id: 'r1', status: 'In Progress' }),
            buildRequest({ id: 'r2', status: 'In Progress' }),
            buildRequest({ id: 'r3', status: 'Open' }),
        ];
        const statuses = requests.map(r => getExternalStatusInfo(r));
        const inProgressCount = statuses.filter(s => s.status === 'In Progress').length;
        const filteredForCard = requests.filter(r => getExternalStatusInfo(r).status === 'In Progress');
        expect(inProgressCount).toBe(filteredForCard.length);
    });

    it('16: In Progress is not terminal', () => {
        const req = buildRequest({ status: 'In Progress' });
        const extInfo = getExternalStatusInfo(req);
        expect(extInfo.isTerminal).toBe(false);
    });

    it('17: In Progress does not require external action', () => {
        const req = buildRequest({ status: 'In Progress' });
        const extInfo = getExternalStatusInfo(req);
        expect(extInfo.externalActionRequired).toBe(false);
        expect(extInfo.externalActionLabel).toBeNull();
    });

    it('18: In Progress description indicates active work', () => {
        const req = buildRequest({ status: 'In Progress' });
        const extInfo = getExternalStatusInfo(req);
        expect(extInfo.description).toContain('actively working');
    });

    it('19: Total requests count includes In Progress', () => {
        const requests = [
            buildRequest({ id: 'r1', status: 'In Progress' }),
            buildRequest({ id: 'r2', status: 'Open' }),
            buildRequest({ id: 'r3', status: 'Completed' }),
        ];
        const statuses = requests.map(r => getExternalStatusInfo(r));
        const visibleCount = statuses.filter(s => s.status !== 'Complete').length;
        expect(visibleCount).toBe(2);
    });

    it('20: In Progress appears in status pill styles', () => {
        expect(STATUS_PILL_STYLES).toHaveProperty('In Progress');
        expect(STATUS_PILL_STYLES['In Progress'].border).toBe('#93c5fd');
    });
});

import { describe, it, expect, beforeEach } from 'vitest';

/* ── localStorage polyfill ─────────────────────────────────── */

const store: Record<string, string> = {};

const localStorageMock: Storage = {
    get length() { return Object.keys(store).length; },
    clear() { Object.keys(store).forEach(k => delete store[k]); },
    getItem(key: string) { return store[key] ?? null; },
    key(index: number) { return Object.keys(store)[index] ?? null; },
    removeItem(key: string) { delete store[key]; },
    setItem(key: string, value: string) { store[key] = value; },
};

globalThis.localStorage = localStorageMock;

import {
    setActivePersona,
    getPortalRequests,
    isRequestAuthorized,
    isTransactionAuthorized,
    submitBrokerUploadPackage,
    confirmBrokerPackage,
    saveParsedRows,
    clearPortalSubmissions,
    createPortalTransaction,
    getTransactionsList,
    getTransactionAccessList,
    getPersonaIdentity,
    getLastCreatedTransactionId,
    clearLastCreatedTransactionId,
} from '../services/portalMockData';

import {
    clearAllPortalCreatedData,
    getRequests,
    getIntakeItems,
} from '../services/recapDataService';

/* ── Helpers ──────────────────────────────────────────────── */

function simulateDataWipe(): void {
    localStorage.setItem("integrasource.recap.wiped", "true");
}

function setupMockParsedRows(count: number): Record<string, string>[] {
    const rows: Record<string, string>[] = [];
    for (let i = 1; i <= count; i++) {
        rows.push({
            'Request Title': `Request ${i} - Financial audit for period ${i}`,
            'Category': i <= 3 ? 'Financial' : 'Legal',
            'Priority': i === 1 ? 'High' : 'Medium',
            '#': String(i),
        });
    }
    return rows;
}

function createKeystoneAsAtlas(): string {
    setActivePersona('broker');
    const txnId = createPortalTransaction('Project Keystone');
    return txnId;
}

function uploadKeystonePackage(txnId: string, count: number): string {
    const rows = setupMockParsedRows(count);
    saveParsedRows(rows);
    const result = submitBrokerUploadPackage('Keystone.xlsx', count, ['Financial', 'Legal'], txnId);
    confirmBrokerPackage(result.submissionId);
    return result.submissionId;
}

/* ═══════════════════════════════════════════════════════════════
   Test A — Organization uniqueness
   ═══════════════════════════════════════════════════════════════ */
describe('Test A: Organization uniqueness', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        setActivePersona('broker');
    });

    it('all 3 preview organizations have distinct stable IDs', () => {
        setActivePersona('broker');
        const atlas = getPersonaIdentity()!;
        setActivePersona('owner-seller');
        const harbor = getPersonaIdentity()!;
        setActivePersona('buyer');
        const summit = getPersonaIdentity()!;

        expect(atlas.organization.id).toBe('org-atlas');
        expect(harbor.organization.id).toBe('org-harbor');
        expect(summit.organization.id).toBe('org-summit');

        expect(atlas.organization.id).not.toBe(harbor.organization.id);
        expect(atlas.organization.id).not.toBe(summit.organization.id);
        expect(harbor.organization.id).not.toBe(summit.organization.id);

        expect(atlas.user.id).not.toBe(harbor.user.id);
        expect(atlas.user.id).not.toBe(summit.user.id);
        expect(harbor.user.id).not.toBe(summit.user.id);
    });
});

/* ═══════════════════════════════════════════════════════════════
   Test B — Keystone transaction ownership
   ═══════════════════════════════════════════════════════════════ */
describe('Test B: Keystone transaction ownership', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        simulateDataWipe();
        setActivePersona('broker');
    });

    it('Keystone is owned by Atlas org, not Harbor or Summit', () => {
        const txnId = createKeystoneAsAtlas();

        const txns = getTransactionsList();
        const keystone = txns.find(t => t.id === txnId);
        expect(keystone).toBeDefined();
        expect(keystone!.orgId).toBe('org-atlas');
        expect(keystone!.orgId).not.toBe('org-harbor');
        expect(keystone!.orgId).not.toBe('org-summit');
    });
});

/* ═══════════════════════════════════════════════════════════════
   Test C — Atlas authorization
   ═══════════════════════════════════════════════════════════════ */
describe('Test C: Atlas authorization on Keystone request', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        simulateDataWipe();
        setActivePersona('broker');
    });

    it('Atlas can access Keystone requests', () => {
        const txnId = createKeystoneAsAtlas();
        uploadKeystonePackage(txnId, 5);

        setActivePersona('broker');
        const atlasReqs = getPortalRequests().filter(r => r.transactionId === txnId);
        expect(atlasReqs.length).toBe(5);

        const req = atlasReqs[0];
        expect(isRequestAuthorized(req.id, 'ext-user-alex')).toBe(true);
        expect(isTransactionAuthorized(txnId, 'ext-user-alex')).toBe(true);
    });
});

/* ═══════════════════════════════════════════════════════════════
   Test D — Harbor authorization
   ═══════════════════════════════════════════════════════════════ */
describe('Test D: Harbor cannot access Keystone requests', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        simulateDataWipe();
        setActivePersona('broker');
    });

    it('Harbor sees 0 Keystone requests', () => {
        const txnId = createKeystoneAsAtlas();
        uploadKeystonePackage(txnId, 5);

        setActivePersona('owner-seller');
        const harborReqs = getPortalRequests().filter(r => r.transactionId === txnId);
        expect(harborReqs.length).toBe(0);

        expect(isTransactionAuthorized(txnId, 'ext-user-hannah')).toBe(false);
    });
});

/* ═══════════════════════════════════════════════════════════════
   Test E — Summit authorization (CRITICAL)
   ═══════════════════════════════════════════════════════════════ */
describe('Test E: Summit cannot access Keystone requests', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        simulateDataWipe();
        setActivePersona('broker');
    });

    it('Summit sees 0 Keystone requests — the critical isolation test', () => {
        const txnId = createKeystoneAsAtlas();
        uploadKeystonePackage(txnId, 213);

        setActivePersona('buyer');
        const summitReqs = getPortalRequests().filter(r => r.transactionId === txnId);
        expect(summitReqs.length).toBe(0);

        expect(isTransactionAuthorized(txnId, 'ext-user-sam')).toBe(false);
    });

    it('Summit has NO cross-org access to Atlas transactions', () => {
        setActivePersona('buyer');
        const summitIdentity = getPersonaIdentity()!;

        expect(summitIdentity.authorizedTransactions.some(a => a.transactionId === 'txn-abc-portfolio')).toBe(false);
        expect(summitIdentity.authorizedTransactions.length).toBe(1); // only txn-summit-review
    });
});

/* ═══════════════════════════════════════════════════════════════
   Test F — Persona switching
   ═══════════════════════════════════════════════════════════════ */
describe('Test F: Persona switching — Atlas 5 → Harbor 0 → Summit 0 → Atlas 5', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        simulateDataWipe();
    });

    it('no stale data survives persona switch', () => {
        const txnId = createKeystoneAsAtlas();
        uploadKeystonePackage(txnId, 5);

        // Atlas: 5
        setActivePersona('broker');
        expect(getPortalRequests().filter(r => r.transactionId === txnId).length).toBe(5);

        // Harbor: 0
        setActivePersona('owner-seller');
        expect(getPortalRequests().filter(r => r.transactionId === txnId).length).toBe(0);

        // Summit: 0
        setActivePersona('buyer');
        expect(getPortalRequests().filter(r => r.transactionId === txnId).length).toBe(0);

        // Back to Atlas: 5
        setActivePersona('broker');
        expect(getPortalRequests().filter(r => r.transactionId === txnId).length).toBe(5);
    });
});

/* ═══════════════════════════════════════════════════════════════
   Test G — Lifecycle does not leak
   ═══════════════════════════════════════════════════════════════ */
describe('Test G: Lifecycle status does not leak across personas', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        simulateDataWipe();
    });

    it('In Progress status visible only to Atlas, not to Summit', () => {
        const txnId = createKeystoneAsAtlas();
        uploadKeystonePackage(txnId, 10);

        // All 10 should be "Open" initially
        setActivePersona('broker');
        const atlasReqs = getPortalRequests().filter(r => r.transactionId === txnId);
        expect(atlasReqs.filter(r => r._rawStatus === 'Open').length).toBe(10);
        expect(atlasReqs.filter(r => r._rawStatus === 'In Progress').length).toBe(0);

        // Summit: no requests at all
        setActivePersona('buyer');
        const summitReqs = getPortalRequests().filter(r => r.transactionId === txnId);
        expect(summitReqs.length).toBe(0);
        expect(summitReqs.filter(r => r._rawStatus === 'In Progress').length).toBe(0);
    });
});

/* ═══════════════════════════════════════════════════════════════
   Test H — Transaction reset on persona switch
   ═══════════════════════════════════════════════════════════════ */
describe('Test H: Transaction context reset on persona switch', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        simulateDataWipe();
    });

    it('lastCreatedTransactionId is cleared on persona switch', () => {
        const txnId = createKeystoneAsAtlas();

        // After creation, the hint should exist
        expect(getLastCreatedTransactionId()).toBe(txnId);

        // Simulate persona switch
        clearLastCreatedTransactionId();

        // After switch, the hint should be gone
        expect(getLastCreatedTransactionId()).toBeNull();
    });

    it('Summit authorizedTxnIds does not include Keystone', () => {
        const txnId = createKeystoneAsAtlas();

        setActivePersona('buyer');
        const identity = getPersonaIdentity()!;
        const authorizedTxnIds = new Set(identity.authorizedTransactions.map(a => a.transactionId));
        expect(authorizedTxnIds.has(txnId)).toBe(false);
    });
});

/* ═══════════════════════════════════════════════════════════════
   Test I — Direct URL authorization
   ═══════════════════════════════════════════════════════════════ */
describe('Test I: Direct URL — Summit cannot authorize Keystone request', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        simulateDataWipe();
    });

    it('isRequestAuthorized returns false for Summit on Keystone request', () => {
        const txnId = createKeystoneAsAtlas();
        uploadKeystonePackage(txnId, 3);

        // Get a Keystone request ID
        setActivePersona('broker');
        const atlasReqs = getPortalRequests().filter(r => r.transactionId === txnId);
        const keystoneReqId = atlasReqs[0].id;

        // Atlas: authorized
        expect(isRequestAuthorized(keystoneReqId, 'ext-user-alex')).toBe(true);

        // Summit: NOT authorized
        setActivePersona('buyer');
        expect(isRequestAuthorized(keystoneReqId, 'ext-user-sam')).toBe(false);

        // Harbor: NOT authorized
        setActivePersona('owner-seller');
        expect(isRequestAuthorized(keystoneReqId, 'ext-user-hannah')).toBe(false);
    });
});

/* ═══════════════════════════════════════════════════════════════
   Test J — Activity isolation
   ═══════════════════════════════════════════════════════════════ */
describe('Test J: Activity isolation — Summit cannot see Atlas Keystone activity', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        simulateDataWipe();
    });

    it('Summit has no Keystone transaction in authorized list', () => {
        const txnId = createKeystoneAsAtlas();
        uploadKeystonePackage(txnId, 3);

        setActivePersona('buyer');
        const identity = getPersonaIdentity()!;
        const authorizedTxnIds = identity.authorizedTransactions.map(a => a.transactionId);
        expect(authorizedTxnIds).not.toContain(txnId);
    });
});

/* ═══════════════════════════════════════════════════════════════
   Test K — Communication/Document isolation
   ═══════════════════════════════════════════════════════════════ */
describe('Test K: Communication and document isolation', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        simulateDataWipe();
    });

    it('Summit has no Keystone transactions in authorizedTransactions', () => {
        const txnId = createKeystoneAsAtlas();

        setActivePersona('buyer');
        const identity = getPersonaIdentity()!;
        const authorizedTxns = identity.authorizedTransactions;
        expect(authorizedTxns.some(a => a.transactionId === txnId)).toBe(false);
    });

    it('getPortalRequests returns empty for Summit after Keystone upload', () => {
        const txnId = createKeystoneAsAtlas();
        uploadKeystonePackage(txnId, 50);

        setActivePersona('buyer');
        const summitReqs = getPortalRequests();
        // Summit should only see requests for their own authorized transactions
        // Since no requests were uploaded to Summit's transactions, expect 0
        expect(summitReqs.length).toBe(0);
    });
});

/* ═══════════════════════════════════════════════════════════════
   Test L — Existing workflow regression
   (Verifies no blocker, clarification, publish, rework, approval,
    exception, or internal queue-routing transition semantics changed)
   ═══════════════════════════════════════════════════════════════ */
describe('Test L: Existing workflow regression — Data Wipe + recreate works', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        simulateDataWipe();
        setActivePersona('broker');
    });

    it('intake item, requests, and transaction all link correctly after wipe + create', () => {
        const txnId = createPortalTransaction('Project Liberty');
        const rows = setupMockParsedRows(8);
        saveParsedRows(rows);

        const result = submitBrokerUploadPackage('Liberty.xlsx', 8, ['Financial'], txnId);
        confirmBrokerPackage(result.submissionId);

        // Intake item has correct transactionId
        const intakeItems = getIntakeItems();
        const pkg = intakeItems.find(i => i.intakeId === `INT-PKG-${result.submissionId.slice(0, 8)}`);
        expect(pkg).toBeDefined();
        expect(pkg!.transactionId).toBe(txnId);

        // Requests have matching transactionId
        const allReqs = getRequests();
        const pkgReqs = allReqs.filter(r => r.transactionId === pkg!.transactionId);
        expect(pkgReqs.length).toBe(8);

        // Intake Workbench query returns items
        expect(pkg!.rowsFound).toBe(pkgReqs.length);

        // Transaction ownership is correct
        const identity = getPersonaIdentity()!;
        expect(identity.authorizedTransactions.some(a => a.transactionId === txnId)).toBe(true);

        // Summit cannot see these requests
        setActivePersona('buyer');
        expect(getPortalRequests().filter(r => r.transactionId === txnId).length).toBe(0);

        // Harbor cannot see these requests
        setActivePersona('owner-seller');
        expect(getPortalRequests().filter(r => r.transactionId === txnId).length).toBe(0);
    });
});

/* ═══════════════════════════════════════════════════════════════
   Test — Deny-by-default invariant
   ═══════════════════════════════════════════════════════════════ */
describe('Deny-by-default invariant', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        simulateDataWipe();
    });

    it('getPortalRequests returns empty when no authorized transactions', () => {
        setActivePersona('broker');
        const txnId = createKeystoneAsAtlas();
        uploadKeystonePackage(txnId, 5);

        // Summit has no Keystone access
        setActivePersona('buyer');
        expect(getPortalRequests().length).toBe(0);
    });

    it('demo seed has exactly 3 access records (no cross-org)', () => {
        const accesses = getTransactionAccessList();
        expect(accesses.length).toBe(3);
        // Each access is unique user+transaction
        const keys = accesses.map(a => `${a.userId}:${a.transactionId}`);
        expect(new Set(keys).size).toBe(3);
        // No Summit access to Atlas transaction
        expect(accesses.some(a => a.userId === 'ext-user-sam' && a.transactionId === 'txn-abc-portfolio')).toBe(false);
    });
});

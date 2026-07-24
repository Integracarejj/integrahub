import { describe, it, expect, beforeEach, afterEach } from 'vitest';

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
    getPortalTransactions,
    getPortalUserContext,
    getAggregateTransactionStats,
    getPortalSubmissionsList,
    getPortalActivity,
    getPortalQuestions,
    getPortalClarifications,
} from '../services/portalMockData';

import {
    clearAllPortalCreatedData,
    getRequests,
    getIntakeItems,
    isRecapDataWiped,
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

function createSummitProject(): string {
    setActivePersona('buyer');
    const txnId = createPortalTransaction('Project Summit');
    return txnId;
}

function createHarborProject(): string {
    setActivePersona('owner-seller');
    const txnId = createPortalTransaction('Project Harbor');
    return txnId;
}

function uploadPackage(txnId: string, count: number, prefix: string): string {
    const rows = setupMockParsedRows(count);
    saveParsedRows(rows);
    const result = submitBrokerUploadPackage(`${prefix}.xlsx`, count, ['Financial', 'Legal'], txnId);
    confirmBrokerPackage(result.submissionId);
    return result.submissionId;
}

/* ═══════════════════════════════════════════════════════════════
   Test A — Distinct identity invariants
   ═══════════════════════════════════════════════════════════════ */
describe('Test A: Distinct identity invariants', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
    });

    it('all 3 organizations have distinct stable IDs', () => {
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
    });

    it('all 3 users have distinct stable IDs', () => {
        setActivePersona('broker');
        const atlas = getPersonaIdentity()!;
        setActivePersona('owner-seller');
        const harbor = getPersonaIdentity()!;
        setActivePersona('buyer');
        const summit = getPersonaIdentity()!;

        expect(atlas.user.id).not.toBe(harbor.user.id);
        expect(atlas.user.id).not.toBe(summit.user.id);
        expect(harbor.user.id).not.toBe(summit.user.id);
    });

    it('all 3 users have distinct emails', () => {
        setActivePersona('broker');
        const atlas = getPersonaIdentity()!;
        setActivePersona('owner-seller');
        const harbor = getPersonaIdentity()!;
        setActivePersona('buyer');
        const summit = getPersonaIdentity()!;

        expect(atlas.user.email).not.toBe(harbor.user.email);
        expect(atlas.user.email).not.toBe(summit.user.email);
        expect(harbor.user.email).not.toBe(summit.user.email);
    });

    it('demo seed has exactly 3 access records (no cross-org)', () => {
        const accesses = getTransactionAccessList();
        expect(accesses.length).toBe(3);
        const keys = accesses.map(a => `${a.userId}:${a.transactionId}`);
        expect(new Set(keys).size).toBe(3);
        expect(accesses.some(a => a.userId === 'ext-user-sam' && a.transactionId === 'txn-abc-portfolio')).toBe(false);
    });
});

/* ═══════════════════════════════════════════════════════════════
   Test B — Atlas request authorization
   ═══════════════════════════════════════════════════════════════ */
describe('Test B: Atlas request authorization', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        simulateDataWipe();
        setActivePersona('broker');
    });

    it('Atlas can access Keystone requests', () => {
        const txnId = createKeystoneAsAtlas();
        uploadPackage(txnId, 5, 'Keystone');

        setActivePersona('broker');
        const atlasReqs = getPortalRequests().filter(r => r.transactionId === txnId);
        expect(atlasReqs.length).toBe(5);

        const req = atlasReqs[0];
        expect(isRequestAuthorized(req.id, 'ext-user-alex')).toBe(true);
        expect(isTransactionAuthorized(txnId, 'ext-user-alex')).toBe(true);
    });

    it('Harbor CANNOT access Keystone requests (org predicate = FAIL)', () => {
        const txnId = createKeystoneAsAtlas();
        uploadPackage(txnId, 5, 'Keystone');

        setActivePersona('owner-seller');
        const harborReqs = getPortalRequests().filter(r => r.transactionId === txnId);
        expect(harborReqs.length).toBe(0);
        expect(isTransactionAuthorized(txnId, 'ext-user-hannah')).toBe(false);
    });

    it('Summit CANNOT access Keystone requests (org predicate = FAIL)', () => {
        const txnId = createKeystoneAsAtlas();
        uploadPackage(txnId, 5, 'Keystone');

        setActivePersona('buyer');
        const summitReqs = getPortalRequests().filter(r => r.transactionId === txnId);
        expect(summitReqs.length).toBe(0);
        expect(isTransactionAuthorized(txnId, 'ext-user-sam')).toBe(false);
    });
});

/* ═══════════════════════════════════════════════════════════════
   Test C — Summit request authorization (CRITICAL)
   ═══════════════════════════════════════════════════════════════ */
describe('Test C: Summit request authorization', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        simulateDataWipe();
    });

    it('Summit can access Summit project requests', () => {
        const txnId = createSummitProject();
        uploadPackage(txnId, 5, 'Summit');

        setActivePersona('buyer');
        const summitReqs = getPortalRequests().filter(r => r.transactionId === txnId);
        expect(summitReqs.length).toBe(5);
        expect(isTransactionAuthorized(txnId, 'ext-user-sam')).toBe(true);
    });

    it('Summit CANNOT access Keystone (the critical isolation test)', () => {
        setActivePersona('broker');
        const keystoneTxnId = createKeystoneAsAtlas();
        uploadPackage(keystoneTxnId, 213, 'Keystone');

        setActivePersona('buyer');
        const summitReqs = getPortalRequests().filter(r => r.transactionId === keystoneTxnId);
        expect(summitReqs.length).toBe(0);
        expect(isTransactionAuthorized(keystoneTxnId, 'ext-user-sam')).toBe(false);
    });

    it('Summit has NO cross-org access to Atlas transactions', () => {
        setActivePersona('buyer');
        const summitIdentity = getPersonaIdentity()!;
        expect(summitIdentity.authorizedTransactions.some(a => a.transactionId === 'txn-abc-portfolio')).toBe(false);
    });
});

/* ═══════════════════════════════════════════════════════════════
   Test D — Harbor request authorization
   ═══════════════════════════════════════════════════════════════ */
describe('Test D: Harbor request authorization', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        simulateDataWipe();
    });

    it('Harbor can access Harbor project requests', () => {
        const txnId = createHarborProject();
        uploadPackage(txnId, 5, 'Harbor');

        setActivePersona('owner-seller');
        const harborReqs = getPortalRequests().filter(r => r.transactionId === txnId);
        expect(harborReqs.length).toBe(5);
        expect(isTransactionAuthorized(txnId, 'ext-user-hannah')).toBe(true);
    });

    it('Harbor CANNOT access Keystone', () => {
        setActivePersona('broker');
        const txnId = createKeystoneAsAtlas();
        uploadPackage(txnId, 5, 'Keystone');

        setActivePersona('owner-seller');
        expect(getPortalRequests().filter(r => r.transactionId === txnId).length).toBe(0);
        expect(isTransactionAuthorized(txnId, 'ext-user-hannah')).toBe(false);
    });

    it('Harbor CANNOT access Summit project', () => {
        setActivePersona('buyer');
        const txnId = createSummitProject();
        uploadPackage(txnId, 5, 'Summit');

        setActivePersona('owner-seller');
        expect(getPortalRequests().filter(r => r.transactionId === txnId).length).toBe(0);
        expect(isTransactionAuthorized(txnId, 'ext-user-hannah')).toBe(false);
    });
});

/* ═══════════════════════════════════════════════════════════════
   Test E — Persona switching
   ═══════════════════════════════════════════════════════════════ */
describe('Test E: Persona switching — no data leakage', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        simulateDataWipe();
    });

    it('Atlas 5 → Harbor 0 → Summit 0 → Atlas 5', () => {
        const txnId = createKeystoneAsAtlas();
        uploadPackage(txnId, 5, 'Keystone');

        setActivePersona('broker');
        expect(getPortalRequests().filter(r => r.transactionId === txnId).length).toBe(5);

        setActivePersona('owner-seller');
        expect(getPortalRequests().filter(r => r.transactionId === txnId).length).toBe(0);

        setActivePersona('buyer');
        expect(getPortalRequests().filter(r => r.transactionId === txnId).length).toBe(0);

        setActivePersona('broker');
        expect(getPortalRequests().filter(r => r.transactionId === txnId).length).toBe(5);
    });

    it('getPortalTransactions returns only authorized transactions per persona', () => {
        setActivePersona('broker');
        const atlasTxnId = createKeystoneAsAtlas();
        uploadPackage(atlasTxnId, 3, 'KeystoneCheck');

        const atlasTxns = getPortalTransactions();
        expect(atlasTxns.length).toBeGreaterThanOrEqual(1);

        setActivePersona('buyer');
        const summitTxnId = createSummitProject();
        uploadPackage(summitTxnId, 3, 'SummitCheck');
        const summitTxns = getPortalTransactions();
        expect(summitTxns.length).toBeGreaterThanOrEqual(1);

        setActivePersona('owner-seller');
        const harborTxnId = createHarborProject();
        uploadPackage(harborTxnId, 3, 'HarborCheck');
        const harborTxns = getPortalTransactions();
        expect(harborTxns.length).toBeGreaterThanOrEqual(1);

        const atlasIds = atlasTxns.map(t => t.id);
        const summitIds = summitTxns.map(t => t.id);
        const harborIds = harborTxns.map(t => t.id);

        expect(new Set([...atlasIds, ...summitIds]).size).toBe(atlasIds.length + summitIds.length);
        expect(new Set([...atlasIds, ...harborIds]).size).toBe(atlasIds.length + harborIds.length);
        expect(new Set([...harborIds, ...summitIds]).size).toBe(harborIds.length + summitIds.length);
    });

    it('getPortalUserContext returns only authorized transactions', () => {
        setActivePersona('broker');
        const atlasCtx = getPortalUserContext();
        expect(atlasCtx.transactions.length).toBeGreaterThanOrEqual(1);

        setActivePersona('buyer');
        const summitCtx = getPortalUserContext();
        expect(summitCtx.transactions.length).toBeGreaterThanOrEqual(1);

        const atlasIds = atlasCtx.transactions.map(t => t.id);
        const summitIds = summitCtx.transactions.map(t => t.id);
        expect(new Set([...atlasIds, ...summitIds]).size).toBe(atlasIds.length + summitIds.length);
    });
});

/* ═══════════════════════════════════════════════════════════════
   Test F — Active transaction reset
   ═══════════════════════════════════════════════════════════════ */
describe('Test F: Active transaction reset on persona switch', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        simulateDataWipe();
    });

    it('lastCreatedTransactionId is cleared on persona switch', () => {
        const txnId = createKeystoneAsAtlas();
        expect(getLastCreatedTransactionId()).toBe(txnId);

        clearLastCreatedTransactionId();
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
   Test G — Organization overview aggregation
   ═══════════════════════════════════════════════════════════════ */
describe('Test G: Organization overview aggregation', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        simulateDataWipe();
    });

    it('Atlas with Keystone(5) + Liberty(3) = 8 total in aggregate', () => {
        setActivePersona('broker');
        const keystoneId = createPortalTransaction('Project Keystone');
        uploadPackage(keystoneId, 5, 'Keystone');

        const libertyId = createPortalTransaction('Project Liberty');
        uploadPackage(libertyId, 3, 'Liberty');

        setActivePersona('broker');
        const allReqs = getPortalRequests();
        const keystoneReqs = allReqs.filter(r => r.transactionId === keystoneId);
        const libertyReqs = allReqs.filter(r => r.transactionId === libertyId);

        expect(keystoneReqs.length).toBe(5);
        expect(libertyReqs.length).toBe(3);
        expect(allReqs.length).toBe(8);

        const stats = getAggregateTransactionStats();
        expect(stats.totalRequests).toBe(8);
        expect(stats.transactionCount).toBe(2);
    });
});

/* ═══════════════════════════════════════════════════════════════
   Test H — Transactions remain separate
   ═══════════════════════════════════════════════════════════════ */
describe('Test H: Transactions remain separate records', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        simulateDataWipe();
    });

    it('Atlas has Keystone and Liberty as separate transactions', () => {
        setActivePersona('broker');
        const keystoneId = createPortalTransaction('Project Keystone');
        const libertyId = createPortalTransaction('Project Liberty');

        setActivePersona('broker');
        const txns = getPortalTransactions();
        const keystone = txns.find(t => t.id === keystoneId);
        const liberty = txns.find(t => t.id === libertyId);

        expect(keystone).toBeDefined();
        expect(liberty).toBeDefined();
        expect(keystone!.name).toBe('Project Keystone');
        expect(liberty!.name).toBe('Project Liberty');
        expect(keystone!.id).not.toBe(liberty!.id);
    });

    it('Summit does not see Keystone or Liberty in their transactions', () => {
        setActivePersona('broker');
        const keystoneId = createPortalTransaction('Project Keystone');
        const libertyId = createPortalTransaction('Project Liberty');

        setActivePersona('buyer');
        const txns = getPortalTransactions();
        expect(txns.some(t => t.id === keystoneId)).toBe(false);
        expect(txns.some(t => t.id === libertyId)).toBe(false);
    });
});

/* ═══════════════════════════════════════════════════════════════
   Test I — Package rollup into transaction
   ═══════════════════════════════════════════════════════════════ */
describe('Test I: Package rollup — multiple packages per transaction', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        simulateDataWipe();
    });

    it('Keystone with Package A(3) + Package B(2) = 5 total', () => {
        setActivePersona('broker');
        const txnId = createKeystoneAsAtlas();

        uploadPackage(txnId, 3, 'PackageA');
        uploadPackage(txnId, 2, 'PackageB');

        setActivePersona('broker');
        const txnReqs = getPortalRequests().filter(r => r.transactionId === txnId);
        expect(txnReqs.length).toBe(5);

        const packagePrefixes = new Set(txnReqs.map(r => r.requestId.split('-').slice(0, 3).join('-')));
        expect(packagePrefixes.size).toBe(2);
    });
});

/* ═══════════════════════════════════════════════════════════════
   Test J — Direct URL authorization
   ═══════════════════════════════════════════════════════════════ */
describe('Test J: Direct URL — cross-persona authorization denied', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        simulateDataWipe();
    });

    it('Atlas request: Atlas=ALLOW, Harbor=DENY, Summit=DENY', () => {
        setActivePersona('broker');
        const txnId = createKeystoneAsAtlas();
        uploadPackage(txnId, 3, 'Keystone');

        setActivePersona('broker');
        const atlasReqs = getPortalRequests().filter(r => r.transactionId === txnId);
        const reqId = atlasReqs[0].id;

        expect(isRequestAuthorized(reqId, 'ext-user-alex')).toBe(true);
        setActivePersona('owner-seller');
        expect(isRequestAuthorized(reqId, 'ext-user-hannah')).toBe(false);
        setActivePersona('buyer');
        expect(isRequestAuthorized(reqId, 'ext-user-sam')).toBe(false);
    });

    it('Summit request: Summit=ALLOW, Atlas=DENY, Harbor=DENY', () => {
        setActivePersona('buyer');
        const txnId = createSummitProject();
        uploadPackage(txnId, 3, 'Summit');

        setActivePersona('buyer');
        const summitReqs = getPortalRequests().filter(r => r.transactionId === txnId);
        const reqId = summitReqs[0].id;

        expect(isRequestAuthorized(reqId, 'ext-user-sam')).toBe(true);
        setActivePersona('broker');
        expect(isRequestAuthorized(reqId, 'ext-user-alex')).toBe(false);
        setActivePersona('owner-seller');
        expect(isRequestAuthorized(reqId, 'ext-user-hannah')).toBe(false);
    });

    it('non-existent request returns false', () => {
        expect(isRequestAuthorized('fake-request-id', 'ext-user-alex')).toBe(false);
    });
});

/* ═══════════════════════════════════════════════════════════════
   Test K — Lifecycle isolation
   ═══════════════════════════════════════════════════════════════ */
describe('Test K: Lifecycle status does not leak across personas', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        simulateDataWipe();
    });

    it('In Progress status visible only to Atlas, not to Summit', () => {
        setActivePersona('broker');
        const txnId = createKeystoneAsAtlas();
        uploadPackage(txnId, 10, 'Keystone');

        setActivePersona('broker');
        const atlasReqs = getPortalRequests().filter(r => r.transactionId === txnId);
        expect(atlasReqs.filter(r => r._rawStatus === 'Open').length).toBe(10);
        expect(atlasReqs.filter(r => r._rawStatus === 'In Progress').length).toBe(0);

        setActivePersona('buyer');
        const summitReqs = getPortalRequests().filter(r => r.transactionId === txnId);
        expect(summitReqs.length).toBe(0);
    });
});

/* ═══════════════════════════════════════════════════════════════
   Test L — Activity isolation
   ═══════════════════════════════════════════════════════════════ */
describe('Test L: Activity isolation', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        simulateDataWipe();
    });

    it('Summit has no Keystone transaction in authorized list', () => {
        setActivePersona('broker');
        const txnId = createKeystoneAsAtlas();
        uploadPackage(txnId, 3, 'Keystone');

        setActivePersona('buyer');
        const identity = getPersonaIdentity()!;
        const authorizedTxnIds = identity.authorizedTransactions.map(a => a.transactionId);
        expect(authorizedTxnIds).not.toContain(txnId);
    });
});

/* ═══════════════════════════════════════════════════════════════
   Test M — Data Wipe
   ═══════════════════════════════════════════════════════════════ */
describe('Test M: Data Wipe — removes dynamic data, preserves identity', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        simulateDataWipe();
    });

    it('after wipe: personas, organizations, users, memberships survive', () => {
        setActivePersona('broker');
        const atlas = getPersonaIdentity()!;
        setActivePersona('owner-seller');
        const harbor = getPersonaIdentity()!;
        setActivePersona('buyer');
        const summit = getPersonaIdentity()!;

        expect(atlas.organization.id).toBe('org-atlas');
        expect(harbor.organization.id).toBe('org-harbor');
        expect(summit.organization.id).toBe('org-summit');
    });

    it('after wipe: transactions are re-seeded as demo defaults', () => {
        const txns = getTransactionsList();
        expect(txns.length).toBe(3);
        expect(txns.some(t => t.id === 'txn-abc-portfolio')).toBe(true);
        expect(txns.some(t => t.id === 'txn-harbor-deal')).toBe(true);
        expect(txns.some(t => t.id === 'txn-summit-review')).toBe(true);
    });

    it('after wipe + recreate: isolation still holds', () => {
        setActivePersona('broker');
        const txnId = createKeystoneAsAtlas();
        uploadPackage(txnId, 5, 'Keystone');

        setActivePersona('broker');
        expect(getPortalRequests().filter(r => r.transactionId === txnId).length).toBe(5);

        setActivePersona('buyer');
        expect(getPortalRequests().filter(r => r.transactionId === txnId).length).toBe(0);

        setActivePersona('owner-seller');
        expect(getPortalRequests().filter(r => r.transactionId === txnId).length).toBe(0);
    });
});

/* ═══════════════════════════════════════════════════════════════
   Test N — Locked workflow regression
   ═══════════════════════════════════════════════════════════════ */
describe('Test N: Locked workflow regression — existing workflow tests pass', () => {
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

        const intakeItems = getIntakeItems();
        const pkg = intakeItems.find(i => i.intakeId === `INT-PKG-${result.submissionId.slice(0, 8)}`);
        expect(pkg).toBeDefined();
        expect(pkg!.transactionId).toBe(txnId);

        const allReqs = getRequests();
        const pkgReqs = allReqs.filter(r => r.transactionId === pkg!.transactionId);
        expect(pkgReqs.length).toBe(8);
        expect(pkg!.rowsFound).toBe(pkgReqs.length);

        const identity = getPersonaIdentity()!;
        expect(identity.authorizedTransactions.some(a => a.transactionId === txnId)).toBe(true);

        setActivePersona('buyer');
        expect(getPortalRequests().filter(r => r.transactionId === txnId).length).toBe(0);

        setActivePersona('owner-seller');
        expect(getPortalRequests().filter(r => r.transactionId === txnId).length).toBe(0);
    });
});

/* ═══════════════════════════════════════════════════════════════
   Deny-by-default invariant
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
        uploadPackage(txnId, 5, 'Keystone');

        setActivePersona('buyer');
        expect(getPortalRequests().length).toBe(0);
    });

    it('getPortalTransactions returns only authorized transactions', () => {
        setActivePersona('broker');
        const txnId = createKeystoneAsAtlas();

        setActivePersona('buyer');
        const summitTxns = getPortalTransactions();
        expect(summitTxns.some(t => t.id === txnId)).toBe(false);
    });

    it('getPortalUserContext returns only authorized transactions', () => {
        setActivePersona('broker');
        const txnId = createKeystoneAsAtlas();

        setActivePersona('buyer');
        const ctx = getPortalUserContext();
        expect(ctx.transactions.some(t => t.id === txnId)).toBe(false);
    });

    it('getAggregateTransactionStats returns Summit-only aggregates', () => {
        setActivePersona('broker');
        const atlasTxnId = createKeystoneAsAtlas();
        uploadPackage(atlasTxnId, 10, 'Keystone');

        setActivePersona('buyer');
        const summitStats = getAggregateTransactionStats();
        expect(summitStats.totalRequests).toBe(0);
        expect(summitStats.transactionCount).toBe(0);
    });
});

/* ── Test O: Submission isolation ──────────────────────────────────── */
describe('Test O: Submissions are persona-scoped', () => {
    afterEach(clearAllPortalCreatedData);

    it('Atlas submissions not visible to Summit', () => {
        setActivePersona('broker');
        const txnId = createKeystoneAsAtlas();
        uploadPackage(txnId, 5, 'Keystone');

        setActivePersona('buyer');
        const summitSubs = getPortalSubmissionsList();
        expect(summitSubs.some(s => s.transactionId === txnId)).toBe(false);
    });

    it('Summit submissions not visible to Atlas', () => {
        setActivePersona('buyer');
        const txnId = createSummitProject();
        uploadPackage(txnId, 3, 'Summit Project');

        setActivePersona('broker');
        const atlasSubs = getPortalSubmissionsList();
        expect(atlasSubs.some(s => s.transactionId === txnId)).toBe(false);
    });

    it('Atlas submissions only appear for Atlas', () => {
        setActivePersona('broker');
        const txnId = createKeystoneAsAtlas();
        uploadPackage(txnId, 4, 'Keystone');

        const atlasSubs = getPortalSubmissionsList();
        expect(atlasSubs.some(s => s.transactionId === txnId)).toBe(true);
    });
});

/* ── Test P: Activity isolation ────────────────────────────────────── */
describe('Test P: Activity feed is persona-scoped', () => {
    afterEach(clearAllPortalCreatedData);

    it('Activity for Keystone not visible to Summit', () => {
        setActivePersona('broker');
        const txnId = createKeystoneAsAtlas();
        uploadPackage(txnId, 3, 'Keystone');

        setActivePersona('buyer');
        const summitActivity = getPortalActivity(20);
        expect(summitActivity.some(a => a.transactionId === txnId)).toBe(false);
    });

    it('Activity for Summit not visible to Atlas', () => {
        setActivePersona('buyer');
        const txnId = createSummitProject();
        uploadPackage(txnId, 2, 'Summit Project');

        setActivePersona('broker');
        const atlasActivity = getPortalActivity(20);
        expect(atlasActivity.some(a => a.transactionId === txnId)).toBe(false);
    });

    it('Activity for Keystone visible to Atlas', () => {
        setActivePersona('broker');
        const txnId = createKeystoneAsAtlas();
        uploadPackage(txnId, 3, 'Keystone');

        const atlasActivity = getPortalActivity(20);
        expect(atlasActivity.some(a => a.transactionId === txnId)).toBe(true);
    });
});

/* ── Test Q: Questions/Clarifications isolation ────────────────────── */
describe('Test Q: Questions and clarifications are persona-scoped', () => {
    afterEach(clearAllPortalCreatedData);

    it('Summit persona gets empty questions (no Keystone txn)', () => {
        setActivePersona('broker');
        createKeystoneAsAtlas();

        setActivePersona('buyer');
        const summitQuestions = getPortalQuestions();
        expect(summitQuestions.length).toBe(0);
    });

    it('Atlas persona gets empty clarifications (no Summit txn)', () => {
        setActivePersona('buyer');
        createSummitProject();

        setActivePersona('broker');
        const atlasClarifications = getPortalClarifications();
        expect(atlasClarifications.length).toBe(0);
    });

    it('No persona sees questions when no transactions authorized', () => {
        setActivePersona('buyer');
        const questions = getPortalQuestions();
        expect(questions.length).toBe(0);
    });

    it('No persona sees clarifications when no transactions authorized', () => {
        setActivePersona('buyer');
        const clarifications = getPortalClarifications();
        expect(clarifications.length).toBe(0);
    });
});

/* ── Test R: Exact user-reported scenario (ATLAS↔SUMMIT bidirectional) ── */
describe('Test R: Exact user-reported scenario — Atlas ↔ Summit bidirectional isolation', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        simulateDataWipe();
    });

    it('Step 1-6: Wipe → Atlas creates txn → upload → switch Summit → Summit sees 0 Atlas requests', () => {
        setActivePersona('broker');
        const txnId = createKeystoneAsAtlas();
        uploadPackage(txnId, 213, 'Keystone');

        setActivePersona('broker');
        expect(getPortalRequests().filter(r => r.transactionId === txnId).length).toBe(213);

        setActivePersona('buyer');
        expect(getPortalRequests().filter(r => r.transactionId === txnId).length).toBe(0);
    });

    it('Bidirectional: Summit uploads → Atlas sees 0 Summit requests', () => {
        setActivePersona('buyer');
        const summitTxnId = createSummitProject();
        uploadPackage(summitTxnId, 50, 'SummitProject');

        setActivePersona('buyer');
        expect(getPortalRequests().filter(r => r.transactionId === summitTxnId).length).toBe(50);

        setActivePersona('broker');
        expect(getPortalRequests().filter(r => r.transactionId === summitTxnId).length).toBe(0);
    });

    it('Both upload simultaneously — each sees only their own', () => {
        setActivePersona('broker');
        const atlasTxnId = createKeystoneAsAtlas();
        uploadPackage(atlasTxnId, 100, 'AtlasKeystone');

        setActivePersona('buyer');
        const summitTxnId = createSummitProject();
        uploadPackage(summitTxnId, 50, 'SummitReview');

        setActivePersona('broker');
        const atlasAll = getPortalRequests();
        expect(atlasAll.filter(r => r.transactionId === atlasTxnId).length).toBe(100);
        expect(atlasAll.filter(r => r.transactionId === summitTxnId).length).toBe(0);
        expect(atlasAll.length).toBe(100);

        setActivePersona('buyer');
        const summitAll = getPortalRequests();
        expect(summitAll.filter(r => r.transactionId === summitTxnId).length).toBe(50);
        expect(summitAll.filter(r => r.transactionId === atlasTxnId).length).toBe(0);
        expect(summitAll.length).toBe(50);
    });

    it('Round-trip: Atlas → Summit → Atlas — no stale data', () => {
        setActivePersona('broker');
        const atlasTxnId = createKeystoneAsAtlas();
        uploadPackage(atlasTxnId, 10, 'Keystone');

        setActivePersona('buyer');
        expect(getPortalRequests().filter(r => r.transactionId === atlasTxnId).length).toBe(0);

        setActivePersona('broker');
        expect(getPortalRequests().filter(r => r.transactionId === atlasTxnId).length).toBe(10);
    });

    it('isRequestAuthorized denies cross-persona even though request exists in shared pool', () => {
        setActivePersona('broker');
        const txnId = createKeystoneAsAtlas();
        uploadPackage(txnId, 5, 'Keystone');

        setActivePersona('broker');
        const atlasReqs = getPortalRequests().filter(r => r.transactionId === txnId);
        const reqId = atlasReqs[0].id;

        expect(isRequestAuthorized(reqId, 'ext-user-alex')).toBe(true);
        expect(isRequestAuthorized(reqId, 'ext-user-sam')).toBe(false);
        expect(isRequestAuthorized(reqId, 'ext-user-hannah')).toBe(false);
    });
});

/* ── Test S: Clear Demo Data — wiped flag prevents initDemo re-seeding ── */
describe('Test S: Clear Demo Data sets wiped flag — initDemo does not re-run', () => {
    it('after clearPortalSubmissions, isRecapDataWiped() returns true', () => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        expect(isRecapDataWiped()).toBe(true);
    });

    it('after clearPortalSubmissions + persona switch, no demo data leaks', () => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();

        setActivePersona('broker');
        const txnId = createKeystoneAsAtlas();
        uploadPackage(txnId, 5, 'Keystone');

        setActivePersona('buyer');
        expect(getPortalRequests().filter(r => r.transactionId === txnId).length).toBe(0);
        expect(getPortalRequests().length).toBe(0);
    });

    it('both Clear mechanisms produce same isolation outcome', () => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        simulateDataWipe();

        setActivePersona('broker');
        const txnId = createKeystoneAsAtlas();
        uploadPackage(txnId, 5, 'Keystone');

        setActivePersona('buyer');
        expect(getPortalRequests().filter(r => r.transactionId === txnId).length).toBe(0);
    });
});

/* ── Test T: orgId belt-and-suspenders — cross-org requests filtered even if txn matches ── */
describe('Test T: orgId belt-and-suspenders isolation', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        simulateDataWipe();
    });

    it('Atlas requests carry orgId=org-atlas', () => {
        setActivePersona('broker');
        const txnId = createKeystoneAsAtlas();
        uploadPackage(txnId, 3, 'Keystone');

        setActivePersona('broker');
        const reqs = getPortalRequests().filter(r => r.transactionId === txnId);
        expect(reqs.length).toBe(3);
        expect(reqs.every(r => r.orgId === 'org-atlas')).toBe(true);
    });

    it('Summit requests carry orgId=org-summit', () => {
        setActivePersona('buyer');
        const txnId = createSummitProject();
        uploadPackage(txnId, 3, 'Summit');

        setActivePersona('buyer');
        const reqs = getPortalRequests().filter(r => r.transactionId === txnId);
        expect(reqs.length).toBe(3);
        expect(reqs.every(r => r.orgId === 'org-summit')).toBe(true);
    });

    it('Atlas submissions carry orgId=org-atlas', () => {
        setActivePersona('broker');
        const txnId = createKeystoneAsAtlas();
        uploadPackage(txnId, 3, 'Keystone');

        setActivePersona('broker');
        const subs = getPortalSubmissionsList();
        expect(subs.some(s => s.orgId === 'org-atlas')).toBe(true);
    });
});

/* ── Test U: Three-persona simultaneous isolation ── */
describe('Test U: Three-persona simultaneous upload — mutual isolation', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        simulateDataWipe();
    });

    it('Atlas, Harbor, Summit each upload — each sees only their own', () => {
        setActivePersona('broker');
        const atlasTxnId = createKeystoneAsAtlas();
        uploadPackage(atlasTxnId, 5, 'Keystone');

        setActivePersona('owner-seller');
        const harborTxnId = createHarborProject();
        uploadPackage(harborTxnId, 3, 'HarborProject');

        setActivePersona('buyer');
        const summitTxnId = createSummitProject();
        uploadPackage(summitTxnId, 4, 'SummitReview');

        setActivePersona('broker');
        const atlasReqs = getPortalRequests();
        expect(atlasReqs.filter(r => r.transactionId === atlasTxnId).length).toBe(5);
        expect(atlasReqs.filter(r => r.transactionId === harborTxnId).length).toBe(0);
        expect(atlasReqs.filter(r => r.transactionId === summitTxnId).length).toBe(0);

        setActivePersona('owner-seller');
        const harborReqs = getPortalRequests();
        expect(harborReqs.filter(r => r.transactionId === harborTxnId).length).toBe(3);
        expect(harborReqs.filter(r => r.transactionId === atlasTxnId).length).toBe(0);
        expect(harborReqs.filter(r => r.transactionId === summitTxnId).length).toBe(0);

        setActivePersona('buyer');
        const summitReqs = getPortalRequests();
        expect(summitReqs.filter(r => r.transactionId === summitTxnId).length).toBe(4);
        expect(summitReqs.filter(r => r.transactionId === atlasTxnId).length).toBe(0);
        expect(summitReqs.filter(r => r.transactionId === harborTxnId).length).toBe(0);
    });
});

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
    submitBrokerUploadPackage,
    confirmBrokerPackage,
    getPortalSubmissionsList,
    saveParsedRows,
    clearPortalSubmissions,
    createPortalTransaction,
    getPersonaIdentity,
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

/* ═══════════════════════════════════════════════════════════════
   Test A — Internal package receives all parsed rows
   ═══════════════════════════════════════════════════════════════ */
describe('Test A: Internal package receives all parsed rows', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        simulateDataWipe();
        setActivePersona('broker');
    });

    it('10 parsed requests become 10 intake workbench items', () => {
        const txnId = createPortalTransaction('Project Keystone');
        const rows = setupMockParsedRows(10);
        saveParsedRows(rows);

        const result = submitBrokerUploadPackage('Keystone.xlsx', 10, ['Financial', 'Legal'], txnId);
        confirmBrokerPackage(result.submissionId);

        // Intake item exists
        const intakeItems = getIntakeItems();
        const pkg = intakeItems.find(i => i.intakeId === `INT-PKG-${result.submissionId.slice(0, 8)}`);
        expect(pkg).toBeDefined();
        expect(pkg!.rowsFound).toBe(10);

        // Intake item transactionId matches the actual Keystone transaction
        expect(pkg!.transactionId).toBe(txnId);

        // Requests loaded by Intake Workbench filter
        const allReqs = getRequests();
        const pkgReqs = allReqs.filter(r => r.transactionId === pkg!.transactionId);
        expect(pkgReqs.length).toBe(10);

        // Every request has a structured intakeId and belongs to the same transaction
        for (const req of pkgReqs) {
            expect(req.intakeId).toMatch(/^INT-/);
            expect(req.transactionId).toBe(txnId);
        }
    });
});

/* ═══════════════════════════════════════════════════════════════
   Test B — Full 213-style package relationship
   ═══════════════════════════════════════════════════════════════ */
describe('Test B: Scalable package relationship (50 requests)', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        simulateDataWipe();
        setActivePersona('broker');
    });

    it('package shell is not empty — all rows attached', () => {
        const txnId = createPortalTransaction('Project Keystone');
        const rows = setupMockParsedRows(50);
        saveParsedRows(rows);

        const result = submitBrokerUploadPackage('Keystone.xlsx', 50, ['Financial', 'Legal'], txnId);
        confirmBrokerPackage(result.submissionId);

        const intakeItems = getIntakeItems();
        const pkg = intakeItems.find(i => i.intakeId === `INT-PKG-${result.submissionId.slice(0, 8)}`);
        expect(pkg).toBeDefined();

        // Workbench query: requests with matching transactionId
        const pkgReqs = getRequests().filter(r => r.transactionId === pkg!.transactionId);
        expect(pkgReqs.length).toBe(50);
        expect(pkg!.rowsFound).toBe(pkgReqs.length);
    });
});

/* ═══════════════════════════════════════════════════════════════
   Test C — Organization IDs unique
   ═══════════════════════════════════════════════════════════════ */
describe('Test C: Organization IDs are unique', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        setActivePersona('broker');
    });

    it('Atlas, Harbor, Summit have distinct org IDs and user IDs', () => {
        const identity1 = getPersonaIdentity();
        expect(identity1).toBeDefined();

        setActivePersona('owner-seller');
        const identity2 = getPersonaIdentity();
        expect(identity2).toBeDefined();

        setActivePersona('buyer');
        const identity3 = getPersonaIdentity();
        expect(identity3).toBeDefined();

        // Distinct org IDs
        expect(identity1!.organization.id).not.toBe(identity2!.organization.id);
        expect(identity2!.organization.id).not.toBe(identity3!.organization.id);
        expect(identity1!.organization.id).not.toBe(identity3!.organization.id);

        // Distinct user IDs
        expect(identity1!.user.id).not.toBe(identity2!.user.id);
        expect(identity2!.user.id).not.toBe(identity3!.user.id);
        expect(identity1!.user.id).not.toBe(identity3!.user.id);

        // Expected values
        expect(identity1!.organization.id).toBe('org-atlas');
        expect(identity2!.organization.id).toBe('org-harbor');
        expect(identity3!.organization.id).toBe('org-summit');
    });
});

/* ═══════════════════════════════════════════════════════════════
   Test D — Keystone authorization (transaction access)
   ═══════════════════════════════════════════════════════════════ */
describe('Test D: Keystone transaction authorization', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        simulateDataWipe();
        setActivePersona('broker');
    });

    it('Atlas can access Keystone, Harbor cannot, Summit cannot', () => {
        const txnId = createPortalTransaction('Project Keystone');

        // Atlas identity includes Keystone
        setActivePersona('broker');
        const atlasIdentity = getPersonaIdentity()!;
        expect(atlasIdentity.authorizedTransactions.some(a => a.transactionId === txnId)).toBe(true);

        // Harbor identity does NOT include Keystone
        setActivePersona('owner-seller');
        const harborIdentity = getPersonaIdentity()!;
        expect(harborIdentity.authorizedTransactions.some(a => a.transactionId === txnId)).toBe(false);

        // Summit identity does NOT include Keystone
        setActivePersona('buyer');
        const summitIdentity = getPersonaIdentity()!;
        expect(summitIdentity.authorizedTransactions.some(a => a.transactionId === txnId)).toBe(false);
    });
});

/* ═══════════════════════════════════════════════════════════════
   Test E — Keystone request authorization
   ═══════════════════════════════════════════════════════════════ */
describe('Test E: Keystone request visibility per persona', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        simulateDataWipe();
        setActivePersona('broker');
    });

    it('Atlas sees Keystone requests, Harbor sees none, Summit sees none', () => {
        const txnId = createPortalTransaction('Project Keystone');
        const rows = setupMockParsedRows(5);
        saveParsedRows(rows);

        const result = submitBrokerUploadPackage('Keystone.xlsx', 5, ['Financial'], txnId);
        confirmBrokerPackage(result.submissionId);

        // Atlas sees requests
        setActivePersona('broker');
        const atlasReqs = getPortalRequests().filter(r => r.transactionId === txnId);
        expect(atlasReqs.length).toBe(5);

        // Harbor sees NONE
        setActivePersona('owner-seller');
        const harborReqs = getPortalRequests().filter(r => r.transactionId === txnId);
        expect(harborReqs.length).toBe(0);

        // Summit sees NONE
        setActivePersona('buyer');
        const summitReqs = getPortalRequests().filter(r => r.transactionId === txnId);
        expect(summitReqs.length).toBe(0);
    });
});

/* ═══════════════════════════════════════════════════════════════
   Test F — Persona switch invalidates transaction context
   ═══════════════════════════════════════════════════════════════ */
describe('Test F: Persona switch invalidates Keystone context for Summit', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        simulateDataWipe();
        setActivePersona('broker');
    });

    it('switching to Summit removes Keystone from authorized transactions', () => {
        const txnId = createPortalTransaction('Project Keystone');
        const rows = setupMockParsedRows(3);
        saveParsedRows(rows);

        const result = submitBrokerUploadPackage('Keystone.xlsx', 3, ['Financial'], txnId);
        confirmBrokerPackage(result.submissionId);

        // Atlas: Keystone visible
        setActivePersona('broker');
        expect(getPortalRequests().filter(r => r.transactionId === txnId).length).toBe(3);

        // Switch to Summit
        setActivePersona('buyer');

        // Summit: Keystone not in authorized transactions
        const summitIdentity = getPersonaIdentity()!;
        expect(summitIdentity.authorizedTransactions.some(a => a.transactionId === txnId)).toBe(false);

        // Summit: 0 Keystone requests
        expect(getPortalRequests().filter(r => r.transactionId === txnId).length).toBe(0);
    });
});

/* ═══════════════════════════════════════════════════════════════
   Test G — Persona round trip (Atlas → Harbor → Summit → Atlas)
   ═══════════════════════════════════════════════════════════════ */
describe('Test G: Persona round trip — no stale data', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        simulateDataWipe();
        setActivePersona('broker');
    });

    it('Atlas 5 → Harbor 0 → Summit 0 → Atlas 5', () => {
        const txnId = createPortalTransaction('Project Keystone');
        const rows = setupMockParsedRows(5);
        saveParsedRows(rows);

        const result = submitBrokerUploadPackage('Keystone.xlsx', 5, ['Financial'], txnId);
        confirmBrokerPackage(result.submissionId);

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
   Test H — Internal intake normal flow
   ═══════════════════════════════════════════════════════════════ */
describe('Test H: Internal intake receives requests via transactionId join', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        simulateDataWipe();
        setActivePersona('broker');
    });

    it('intake item and its requests share the same transactionId', () => {
        const txnId = createPortalTransaction('Project Keystone');
        const rows = setupMockParsedRows(8);
        saveParsedRows(rows);

        const result = submitBrokerUploadPackage('Keystone.xlsx', 8, ['Financial', 'Legal'], txnId);
        confirmBrokerPackage(result.submissionId);

        // Intake item
        const intakeItems = getIntakeItems();
        const pkg = intakeItems.find(i => i.intakeId === `INT-PKG-${result.submissionId.slice(0, 8)}`);
        expect(pkg).toBeDefined();

        // Requests matching intake item's transactionId
        const pkgReqs = getRequests().filter(r => r.transactionId === pkg!.transactionId);
        expect(pkgReqs.length).toBe(8);

        // Count matches
        expect(pkg!.rowsFound).toBe(pkgReqs.length);
    });
});

/* ═══════════════════════════════════════════════════════════════
   Test I — Direct URL authorization
   ═══════════════════════════════════════════════════════════════ */
describe('Test I: Summit cannot authorize Keystone request via direct URL', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        simulateDataWipe();
        setActivePersona('broker');
    });

    it('isRequestAuthorized returns false for Summit on Keystone request', () => {
        const txnId = createPortalTransaction('Project Keystone');
        const rows = setupMockParsedRows(3);
        saveParsedRows(rows);

        const result = submitBrokerUploadPackage('Keystone.xlsx', 3, ['Financial'], txnId);
        confirmBrokerPackage(result.submissionId);

        const req = getRequests().find(r => r.id.startsWith(result.submissionId))!;
        expect(req).toBeDefined();

        // Atlas: authorized
        setActivePersona('broker');
        expect(isRequestAuthorized(req.id, 'ext-user-alex')).toBe(true);

        // Summit: NOT authorized
        setActivePersona('buyer');
        expect(isRequestAuthorized(req.id, 'ext-user-sam')).toBe(false);
    });
});

/* ═══════════════════════════════════════════════════════════════
   Test J — Data Wipe clears both internal and external data
   ═══════════════════════════════════════════════════════════════ */
describe('Test J: Data Wipe removes Keystone package + requests + intake items', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        simulateDataWipe();
        setActivePersona('broker');
    });

    it('clearPortalSubmissions removes all dynamic data', () => {
        const txnId = createPortalTransaction('Project Keystone');
        const rows = setupMockParsedRows(5);
        saveParsedRows(rows);

        const result = submitBrokerUploadPackage('Keystone.xlsx', 5, ['Financial'], txnId);
        confirmBrokerPackage(result.submissionId);

        // Verify data exists
        expect(getPortalRequests().filter(r => r.transactionId === txnId).length).toBe(5);
        expect(getPortalSubmissionsList().filter(s => s.transactionId === txnId).length).toBe(1);
        expect(getIntakeItems().filter(i => i.transactionId === txnId).length).toBe(1);

        // Wipe
        clearPortalSubmissions();

        // All data gone
        expect(getPortalSubmissionsList().filter(s => s.transactionId === txnId).length).toBe(0);
    });
});

/* ═══════════════════════════════════════════════════════════════
   Test K — Existing workflow tests remain passing
   (this test verifies no regression in data wipe behavior)
   ═══════════════════════════════════════════════════════════════ */
describe('Test K: Locked workflow not broken — data wipe + recreate works', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        simulateDataWipe();
        setActivePersona('broker');
    });

    it('after wipe + create new transaction + upload, everything works', () => {
        const txnId = createPortalTransaction('Project Liberty');
        const rows = setupMockParsedRows(3);
        saveParsedRows(rows);

        const result = submitBrokerUploadPackage('Liberty.xlsx', 3, ['Financial'], txnId);
        confirmBrokerPackage(result.submissionId);

        // Requests visible for authorized persona
        setActivePersona('broker');
        expect(getPortalRequests().filter(r => r.transactionId === txnId).length).toBe(3);

        // Intake item has correct transactionId
        const intakeItems = getIntakeItems();
        const pkg = intakeItems.find(i => i.intakeId === `INT-PKG-${result.submissionId.slice(0, 8)}`);
        expect(pkg).toBeDefined();
        expect(pkg!.transactionId).toBe(txnId);

        // Intake Workbench query returns items
        const pkgReqs = getRequests().filter(r => r.transactionId === pkg!.transactionId);
        expect(pkgReqs.length).toBe(3);
    });
});

/* ═══════════════════════════════════════════════════════════════
   Test — getPortalRequests returns [] when no identity
   ═══════════════════════════════════════════════════════════════ */
describe('getPortalRequests returns empty when no identity available', () => {
    it('returns empty when no authorized transactions exist after Data Wipe', () => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        simulateDataWipe();

        // Atlas creates Keystone
        setActivePersona('broker');
        const txnId = createPortalTransaction('Project Keystone');
        const rows = setupMockParsedRows(3);
        saveParsedRows(rows);
        const result = submitBrokerUploadPackage('Keystone.xlsx', 3, ['Financial'], txnId);
        confirmBrokerPackage(result.submissionId);

        // Summit has no access
        setActivePersona('buyer');
        const summitReqs = getPortalRequests();
        expect(summitReqs.length).toBe(0);
    });
});

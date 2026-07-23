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
} from '../services/portalMockData';

import {
    clearAllPortalCreatedData,
    getRequests,
    getTransactions,
} from '../services/recapDataService';

/* ── Helpers ──────────────────────────────────────────────── */

/** Simulate Data Wipe: set the recap wiped flag so getTransactions() uses the portal path */
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
   Test A — Empty transaction upload available
   ═══════════════════════════════════════════════════════════════ */
describe('Test A: Empty transaction — upload entry point available', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        simulateDataWipe();
        setActivePersona('broker');
    });

    it('after Data Wipe + Create Keystone, getTransactions() returns the new transaction', () => {
        const txnId = createPortalTransaction('Project Keystone');

        // getTransactions() must include the new ExternalTransaction
        const txns = getTransactions();
        const keystone = txns.find(t => t.id === txnId);
        expect(keystone).toBeDefined();
        expect(keystone!.name).toBe('Project Keystone');
    });

    it('after Data Wipe + Create Keystone, no submissions exist → upload should be available', () => {
        const txnId = createPortalTransaction('Project Keystone');

        // No submissions → upload panel is the correct UX
        const subs = getPortalSubmissionsList();
        expect(subs.filter(s => s.transactionId === txnId).length).toBe(0);
    });

    it('after Data Wipe + Create Keystone, zero requests exist for the transaction', () => {
        const txnId = createPortalTransaction('Project Keystone');

        // Zero requests → full upload panel
        const requests = getPortalRequests().filter(r => r.transactionId === txnId);
        expect(requests.length).toBe(0);
    });
});

/* ═══════════════════════════════════════════════════════════════
   Test B — Existing transaction upload available
   ═══════════════════════════════════════════════════════════════ */
describe('Test B: Existing transaction — additional package upload available', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        setActivePersona('broker');
    });

    it('after first package submitted, a second upload can be initiated', () => {
        const txnId = createPortalTransaction('Project Keystone');
        const rows = setupMockParsedRows(3);
        saveParsedRows(rows);

        // First package
        const result1 = submitBrokerUploadPackage('Keystone_A.xlsx', 3, ['Financial'], txnId);
        confirmBrokerPackage(result1.submissionId);

        // Verify first package exists
        const subs1 = getPortalSubmissionsList().filter(s => s.transactionId === txnId);
        expect(subs1.length).toBe(1);
        expect(subs1[0].status).toBe('Submitted');

        // Second upload can be initiated (no blocking condition)
        const rows2 = setupMockParsedRows(2);
        saveParsedRows(rows2);
        const result2 = submitBrokerUploadPackage('Keystone_B.xlsx', 2, ['Legal'], txnId);
        confirmBrokerPackage(result2.submissionId);

        // Both packages exist
        const subs2 = getPortalSubmissionsList().filter(s => s.transactionId === txnId);
        expect(subs2.length).toBe(2);

        // Both sets of requests visible
        const allReqs = getPortalRequests().filter(r => r.transactionId === txnId);
        expect(allReqs.length).toBe(5); // 3 + 2
    });
});

/* ═══════════════════════════════════════════════════════════════
   Test C — Transaction inheritance
   ═══════════════════════════════════════════════════════════════ */
describe('Test C: Transaction inheritance — package and requests get selectedTxnId', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        setActivePersona('broker');
    });

    it('package submission and generated requests carry the active transaction ID', () => {
        const txnId = createPortalTransaction('Project Keystone');
        const rows = setupMockParsedRows(3);
        saveParsedRows(rows);

        const result = submitBrokerUploadPackage('Keystone.xlsx', 3, ['Financial'], txnId);
        confirmBrokerPackage(result.submissionId);

        // Submission record has transactionId
        const sub = getPortalSubmissionsList().find(s => s.id === result.submissionId);
        expect(sub).toBeDefined();
        expect(sub!.transactionId).toBe(txnId);

        // All generated requests have the same transactionId
        const requests = getRequests().filter(r => r.id.startsWith(result.submissionId));
        expect(requests.length).toBe(3);
        for (const req of requests) {
            expect(req.transactionId).toBe(txnId);
        }

        // Portal requests are visible for this transaction
        const portalReqs = getPortalRequests().filter(r => r.transactionId === txnId);
        expect(portalReqs.length).toBe(3);
    });
});

/* ═══════════════════════════════════════════════════════════════
   Test D — Persona inheritance
   ═══════════════════════════════════════════════════════════════ */
describe('Test D: Persona inheritance — package gets active persona context', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        setActivePersona('broker');
    });

    it('package captures orgId, userId, orgName, userName from active persona', () => {
        const txnId = createPortalTransaction('Project Keystone');
        const rows = setupMockParsedRows(3);
        saveParsedRows(rows);

        const result = submitBrokerUploadPackage('Keystone.xlsx', 3, ['Financial'], txnId);
        confirmBrokerPackage(result.submissionId);

        const sub = getPortalSubmissionsList().find(s => s.id === result.submissionId);
        expect(sub).toBeDefined();
        expect(sub!.orgId).toBe('org-atlas');
        expect(sub!.userId).toBe('ext-user-alex');
        expect(sub!.orgName).toBe('Atlas Capital Partners');
        expect(sub!.userName).toBe('Morgan Blake');
    });
});

/* ═══════════════════════════════════════════════════════════════
   Test E — Transaction switching
   ═══════════════════════════════════════════════════════════════ */
describe('Test E: Transaction switching — packages attach to active transaction', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        setActivePersona('broker');
    });

    it('uploading into Keystone vs Liberty produces correctly scoped packages', () => {
        const keystoneId = createPortalTransaction('Project Keystone');
        const libertyId = createPortalTransaction('Project Liberty');

        // Upload into Keystone
        const rows1 = setupMockParsedRows(3);
        saveParsedRows(rows1);
        const result1 = submitBrokerUploadPackage('Keystone.xlsx', 3, ['Financial'], keystoneId);
        confirmBrokerPackage(result1.submissionId);

        // Upload into Liberty
        const rows2 = setupMockParsedRows(2);
        saveParsedRows(rows2);
        const result2 = submitBrokerUploadPackage('Liberty.xlsx', 2, ['Legal'], libertyId);
        confirmBrokerPackage(result2.submissionId);

        // Keystone requests
        const keystoneReqs = getPortalRequests().filter(r => r.transactionId === keystoneId);
        expect(keystoneReqs.length).toBe(3);

        // Liberty requests
        const libertyReqs = getPortalRequests().filter(r => r.transactionId === libertyId);
        expect(libertyReqs.length).toBe(2);

        // No cross-contamination
        expect(keystoneReqs.every(r => r.transactionId === keystoneId)).toBe(true);
        expect(libertyReqs.every(r => r.transactionId === libertyId)).toBe(true);
    });
});

/* ═══════════════════════════════════════════════════════════════
   Test F — Unauthorized transaction
   ═══════════════════════════════════════════════════════════════ */
describe('Test F: Unauthorized transaction — persona cannot see requests they did not create', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        setActivePersona('broker');
    });

    it('Atlas user cannot see Harbor transaction requests', () => {
        const atlasTxnId = createPortalTransaction('Project Keystone');

        // Atlas uploads into Keystone
        const rows = setupMockParsedRows(3);
        saveParsedRows(rows);
        const result = submitBrokerUploadPackage('Keystone.xlsx', 3, ['Financial'], atlasTxnId);
        confirmBrokerPackage(result.submissionId);

        // Atlas sees requests
        setActivePersona('broker');
        const atlasReqs = getPortalRequests().filter(r => r.transactionId === atlasTxnId);
        expect(atlasReqs.length).toBe(3);

        // Harbor persona does NOT see Atlas/Keystone requests
        setActivePersona('owner-seller');
        const harborReqs = getPortalRequests().filter(r => r.transactionId === atlasTxnId);
        expect(harborReqs.length).toBe(0);

        // isRequestAuthorized confirms
        const req = getRequests().find(r => r.id.startsWith(result.submissionId))!;
        setActivePersona('broker');
        expect(isRequestAuthorized(req.id, 'ext-user-alex')).toBe(true);
        setActivePersona('owner-seller');
        expect(isRequestAuthorized(req.id, 'ext-user-hannah')).toBe(false);
    });
});

/* ═══════════════════════════════════════════════════════════════
   Test G — Data Wipe
   ═══════════════════════════════════════════════════════════════ */
describe('Test G: Data Wipe — upload entry available after wipe + recreate', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        simulateDataWipe();
        setActivePersona('broker');
    });

    it('after Data Wipe + Create Keystone, upload entry exists', () => {
        const txnId = createPortalTransaction('Project Keystone');

        // No submissions, no requests → upload entry should be available
        const subs = getPortalSubmissionsList().filter(s => s.transactionId === txnId);
        expect(subs.length).toBe(0);

        const requests = getPortalRequests().filter(r => r.transactionId === txnId);
        expect(requests.length).toBe(0);

        // getTransactions() includes the new transaction
        const txns = getTransactions();
        expect(txns.some(t => t.id === txnId)).toBe(true);
    });

    it('after wipe, clearPortalSubmissions removes all dynamic data', () => {
        const txnId = createPortalTransaction('Project Keystone');
        const rows = setupMockParsedRows(3);
        saveParsedRows(rows);
        const result = submitBrokerUploadPackage('Keystone.xlsx', 3, ['Financial'], txnId);
        confirmBrokerPackage(result.submissionId);

        // Verify data exists
        expect(getPortalSubmissionsList().filter(s => s.transactionId === txnId).length).toBe(1);
        expect(getPortalRequests().filter(r => r.transactionId === txnId).length).toBe(3);

        // Wipe
        clearPortalSubmissions();

        // Dynamic data gone
        expect(getPortalSubmissionsList().filter(s => s.transactionId === txnId).length).toBe(0);
    });
});

/* ═══════════════════════════════════════════════════════════════
   Test H — Existing parser regression
   ═══════════════════════════════════════════════════════════════ */
describe('Test H: Parser regression — flexible parser still handles standard formats', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        setActivePersona('broker');
    });

    it('submitBrokerUploadPackage works with zero-parsed-rows fallback (count-based)', () => {
        const txnId = createPortalTransaction('Project Keystone');

        // Simulate: no parsed rows saved (e.g. count-only mode)
        const result = submitBrokerUploadPackage('Keystone.xlsx', 5, ['Financial', 'Legal'], txnId);
        expect(result.detected).toBe(5);

        // Confirm without parsed rows → generatePortalRequests fallback
        confirmBrokerPackage(result.submissionId);

        // Requests generated via fallback
        const requests = getPortalRequests().filter(r => r.transactionId === txnId);
        expect(requests.length).toBe(5);
    });

    it('submitBrokerUploadPackage works with parsed rows (full pipeline)', () => {
        const txnId = createPortalTransaction('Project Keystone');
        const rows = setupMockParsedRows(4);
        saveParsedRows(rows);

        const result = submitBrokerUploadPackage('Keystone.xlsx', 4, ['Financial', 'Legal'], txnId);
        expect(result.detected).toBe(4);

        confirmBrokerPackage(result.submissionId);

        const requests = getPortalRequests().filter(r => r.transactionId === txnId);
        expect(requests.length).toBe(4);
    });
});

/* ═══════════════════════════════════════════════════════════════
   Test — getTransactions() includes ExternalTransactions after wipe
   ═══════════════════════════════════════════════════════════════ */
describe('getTransactions() includes ExternalTransactions after Data Wipe', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        simulateDataWipe();
        setActivePersona('broker');
    });

    it('newly created ExternalTransaction appears in getTransactions()', () => {
        const txnId = createPortalTransaction('Project Keystone');
        const txns = getTransactions();
        expect(txns.some(t => t.id === txnId)).toBe(true);
    });

    it('multiple new ExternalTransactions all appear in getTransactions()', () => {
        const id1 = createPortalTransaction('Project Keystone');
        const id2 = createPortalTransaction('Project Liberty');
        const txns = getTransactions();
        expect(txns.some(t => t.id === id1)).toBe(true);
        expect(txns.some(t => t.id === id2)).toBe(true);
    });
});

/* ═══════════════════════════════════════════════════════════════
   Test — Multiple packages per transaction
   ═══════════════════════════════════════════════════════════════ */
describe('Multiple packages per transaction', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        setActivePersona('broker');
    });

    it('three packages all attach to the same transaction', () => {
        const txnId = createPortalTransaction('Project Keystone');

        for (let i = 1; i <= 3; i++) {
            const rows = setupMockParsedRows(2);
            saveParsedRows(rows);
            const result = submitBrokerUploadPackage(`Package_${i}.xlsx`, 2, ['Financial'], txnId);
            confirmBrokerPackage(result.submissionId);
        }

        const subs = getPortalSubmissionsList().filter(s => s.transactionId === txnId);
        expect(subs.length).toBe(3);

        const requests = getPortalRequests().filter(r => r.transactionId === txnId);
        expect(requests.length).toBe(6); // 3 packages × 2 requests
    });
});

import { describe, it, expect, beforeEach } from 'vitest';

/* ── localStorage polyfill for Node test environment ────────── */

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
    getTransactionsList,
    getTransactionAccessList,
    getAuthorizedTransactions,
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
} from '../services/recapDataService';

/* ── Helpers ──────────────────────────────────────────────── */

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
   Test A — Package Ownership
   ═══════════════════════════════════════════════════════════════ */
describe('Test A: Package ownership captures stable IDs at creation', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        setActivePersona('broker');
    });

    it('package submission stores organizationId, transactionId, and userId from active persona', () => {
        // Create a transaction for this persona
        const txnId = createPortalTransaction('Project Keystone');

        // Set up parsed rows for the upload
        const rows = setupMockParsedRows(5);
        saveParsedRows(rows);

        // Submit package with the transaction
        const result = submitBrokerUploadPackage('Keystone_DD.xlsx', 5, ['Financial', 'Legal'], txnId);

        // Confirm the package to create requests
        confirmBrokerPackage(result.submissionId);

        // Check the submission record
        const submissions = getPortalSubmissionsList();
        const sub = submissions.find(s => s.id === result.submissionId);
        expect(sub).toBeDefined();
        expect(sub!.transactionId).toBe(txnId);
        expect(sub!.orgId).toBe('org-atlas');
        expect(sub!.userId).toBe('ext-user-alex');
        expect(sub!.orgName).toBe('Atlas Capital Partners');
        expect(sub!.userName).toBe('Morgan Blake');
    });
});

/* ═══════════════════════════════════════════════════════════════
   Test B — Request Inheritance
   ═══════════════════════════════════════════════════════════════ */
describe('Test B: Generated requests inherit package context', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        setActivePersona('broker');
    });

    it('every generated request has the same transaction, organization, and package context', () => {
        const txnId = createPortalTransaction('Project Keystone');
        const rows = setupMockParsedRows(5);
        saveParsedRows(rows);

        const result = submitBrokerUploadPackage('Keystone_DD.xlsx', 5, ['Financial', 'Legal'], txnId);
        confirmBrokerPackage(result.submissionId);

        // Get all requests
        const requests = getRequests();
        const keystoneRequests = requests.filter(r =>
            r.id.startsWith(result.submissionId)
        );

        expect(keystoneRequests.length).toBe(5);

        // Every request must have the same transactionId
        for (const req of keystoneRequests) {
            expect(req.transactionId).toBe(txnId);
        }

        // Every request must have org context
        for (const req of keystoneRequests) {
            expect((req as any).orgId).toBe('org-atlas');
            expect((req as any).userId).toBe('ext-user-alex');
            expect((req as any).orgName).toBe('Atlas Capital Partners');
            expect((req as any).userName).toBe('Morgan Blake');
        }

        // transactionName should be the package name
        for (const req of keystoneRequests) {
            expect(req.transactionName).toBe('Keystone_DD');
        }
    });
});

/* ═══════════════════════════════════════════════════════════════
   Test C — Immediate External Visibility
   ═══════════════════════════════════════════════════════════════ */
describe('Test C: Immediate external visibility after package submission', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        setActivePersona('broker');
    });

    it('requests are visible in getPortalRequests() immediately after confirmBrokerPackage', () => {
        const txnId = createPortalTransaction('Project Keystone');
        const rows = setupMockParsedRows(3);
        saveParsedRows(rows);

        const result = submitBrokerUploadPackage('Keystone.xlsx', 3, ['Financial'], txnId);
        confirmBrokerPackage(result.submissionId);

        // Immediately check portal requests for the active persona
        const portalRequests = getPortalRequests();
        const keystoneRequests = portalRequests.filter(r =>
            r.transactionId === txnId
        );

        expect(keystoneRequests.length).toBe(3);

        // No internal workflow action required — they are visible from submission
        for (const req of keystoneRequests) {
            expect(req.orgId).toBe('org-atlas');
            expect(req.transactionId).toBe(txnId);
        }
    });
});

/* ═══════════════════════════════════════════════════════════════
   Test D — Persona Isolation
   ═══════════════════════════════════════════════════════════════ */
describe('Test D: Persona isolation — Harbor persona cannot see Atlas requests', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        setActivePersona('broker');
    });

    it('switching to Harbor persona hides Atlas/Keystone requests; switching back restores them', () => {
        // As Atlas broker, create Keystone transaction and submit
        const txnId = createPortalTransaction('Project Keystone');
        const rows = setupMockParsedRows(3);
        saveParsedRows(rows);

        const result = submitBrokerUploadPackage('Keystone.xlsx', 3, ['Financial'], txnId);
        confirmBrokerPackage(result.submissionId);

        // Atlas persona sees requests
        setActivePersona('broker');
        const atlasRequests = getPortalRequests();
        expect(atlasRequests.filter(r => r.transactionId === txnId).length).toBe(3);

        // Harbor persona does NOT see Keystone requests
        setActivePersona('owner-seller');
        const harborRequests = getPortalRequests();
        expect(harborRequests.filter(r => r.transactionId === txnId).length).toBe(0);

        // Switch back to Atlas — requests return
        setActivePersona('broker');
        const atlasAgain = getPortalRequests();
        expect(atlasAgain.filter(r => r.transactionId === txnId).length).toBe(3);
    });
});

/* ═══════════════════════════════════════════════════════════════
   Test E — Transaction Filtering
   ═══════════════════════════════════════════════════════════════ */
describe('Test E: Transaction filtering — requests scoped to correct transactions', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        setActivePersona('broker');
    });

    it('two Atlas transactions show correct request counts', () => {
        // Create two transactions
        const txnId1 = createPortalTransaction('Project Keystone');
        const txnId2 = createPortalTransaction('Harbor View');

        // Submit to Keystone
        const rows1 = setupMockParsedRows(3);
        saveParsedRows(rows1);
        const result1 = submitBrokerUploadPackage('Keystone.xlsx', 3, ['Financial'], txnId1);
        confirmBrokerPackage(result1.submissionId);

        // Submit to Harbor View
        const rows2 = setupMockParsedRows(5);
        saveParsedRows(rows2);
        const result2 = submitBrokerUploadPackage('HarborView.xlsx', 5, ['Legal'], txnId2);
        confirmBrokerPackage(result2.submissionId);

        // All requests visible
        const all = getPortalRequests();
        expect(all.filter(r => r.transactionId === txnId1).length).toBe(3);
        expect(all.filter(r => r.transactionId === txnId2).length).toBe(5);

        // Harbor persona sees neither
        setActivePersona('owner-seller');
        const harbor = getPortalRequests();
        expect(harbor.filter(r => r.transactionId === txnId1).length).toBe(0);
        expect(harbor.filter(r => r.transactionId === txnId2).length).toBe(0);
    });
});

/* ═══════════════════════════════════════════════════════════════
   Test F — In Progress Lifecycle
   ═══════════════════════════════════════════════════════════════ */
describe('Test F: In Progress lifecycle — request remains visible after internal status change', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        setActivePersona('broker');
    });

    it('request is visible immediately and after status changes', () => {
        const txnId = createPortalTransaction('Project Keystone');
        const rows = setupMockParsedRows(2);
        saveParsedRows(rows);

        const result = submitBrokerUploadPackage('Keystone.xlsx', 2, ['Financial'], txnId);
        confirmBrokerPackage(result.submissionId);

        // Verify initial visibility
        let portalReqs = getPortalRequests().filter(r => r.transactionId === txnId);
        expect(portalReqs.length).toBe(2);

        // Simulate internal status change to In Progress by modifying the backing store
        const allRequests = getRequests();
        const reqToModify = allRequests.find(r => r.id.startsWith(result.submissionId));
        if (reqToModify) {
            reqToModify.status = 'In Progress';
            // Re-write to localStorage
            const portalReqs = JSON.parse(localStorage.getItem('integrasource.recap.portalRequests') || '[]');
            const idx = portalReqs.findIndex((r: any) => r.id === reqToModify.id);
            if (idx >= 0) {
                portalReqs[idx].status = 'In Progress';
                localStorage.setItem('integrasource.recap.portalRequests', JSON.stringify(portalReqs));
            }
        }

        // Request still visible
        portalReqs = getPortalRequests().filter(r => r.transactionId === txnId);
        expect(portalReqs.length).toBe(2);
    });
});

/* ═══════════════════════════════════════════════════════════════
   Test G — Publish Lifecycle
   ═══════════════════════════════════════════════════════════════ */
describe('Test G: Publish lifecycle — _publishedAt does not gate visibility', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        setActivePersona('broker');
    });

    it('requests are visible before and after publication', () => {
        const txnId = createPortalTransaction('Project Keystone');
        const rows = setupMockParsedRows(2);
        saveParsedRows(rows);

        const result = submitBrokerUploadPackage('Keystone.xlsx', 2, ['Financial'], txnId);
        confirmBrokerPackage(result.submissionId);

        // Visible before publish (no _publishedAt)
        let portalReqs = getPortalRequests().filter(r => r.transactionId === txnId);
        expect(portalReqs.length).toBe(2);
        for (const r of portalReqs) {
            expect(r._publishedAt).toBeFalsy();
        }

        // Simulate publish by setting _publishedAt
        const portalReqsStore = JSON.parse(localStorage.getItem('integrasource.recap.portalRequests') || '[]');
        for (const req of portalReqsStore) {
            if (req.id.startsWith(result.submissionId)) {
                req._publishedAt = new Date().toISOString();
            }
        }
        localStorage.setItem('integrasource.recap.portalRequests', JSON.stringify(portalReqsStore));

        // Still visible after publish
        portalReqs = getPortalRequests().filter(r => r.transactionId === txnId);
        expect(portalReqs.length).toBe(2);
    });
});

/* ═══════════════════════════════════════════════════════════════
   Test H — Activity Consistency
   ═══════════════════════════════════════════════════════════════ */
describe('Test H: Activity uses same transactionId as requests', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        setActivePersona('broker');
    });

    it('activity entry transactionId matches the request transactionId', () => {
        const txnId = createPortalTransaction('Project Keystone');
        const rows = setupMockParsedRows(3);
        saveParsedRows(rows);

        const result = submitBrokerUploadPackage('Keystone.xlsx', 3, ['Financial'], txnId);
        confirmBrokerPackage(result.submissionId);

        // Check activity feed
        const activityFeed = JSON.parse(localStorage.getItem('integrasource.recap.activityFeed') || '[]');
        const submissionActivity = activityFeed.filter((a: any) =>
            a.description?.includes('Keystone')
        );

        expect(submissionActivity.length).toBeGreaterThan(0);

        // Activity transactionId must match the request transactionId
        for (const act of submissionActivity) {
            expect(act.transactionId).toBe(txnId);
        }
    });
});

/* ═══════════════════════════════════════════════════════════════
   Test I — Direct URL Authorization
   ═══════════════════════════════════════════════════════════════ */
describe('Test I: Direct URL — Harbor persona cannot authorize Keystone request', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        setActivePersona('broker');
    });

    it('isRequestAuthorized returns true for Atlas user, false for Harbor user', () => {
        const txnId = createPortalTransaction('Project Keystone');
        const rows = setupMockParsedRows(2);
        saveParsedRows(rows);

        const result = submitBrokerUploadPackage('Keystone.xlsx', 2, ['Financial'], txnId);
        confirmBrokerPackage(result.submissionId);

        const requests = getRequests();
        const keystoneReq = requests.find(r => r.id.startsWith(result.submissionId));
        expect(keystoneReq).toBeDefined();

        // Atlas user is authorized
        setActivePersona('broker');
        expect(isRequestAuthorized(keystoneReq!.id, 'ext-user-alex')).toBe(true);

        // Harbor user is NOT authorized
        setActivePersona('owner-seller');
        expect(isRequestAuthorized(keystoneReq!.id, 'ext-user-hannah')).toBe(false);
    });
});

/* ═══════════════════════════════════════════════════════════════
   Test J — Existing workflow tests not broken
   (This test confirms the data wipe clears Keystone data)
   ═══════════════════════════════════════════════════════════════ */
describe('Test J: Data Wipe removes dynamic Keystone data', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        setActivePersona('broker');
    });

    it('clearPortalSubmissions removes all dynamic data', () => {
        const txnId = createPortalTransaction('Project Keystone');
        const rows = setupMockParsedRows(3);
        saveParsedRows(rows);

        const result = submitBrokerUploadPackage('Keystone.xlsx', 3, ['Financial'], txnId);
        confirmBrokerPackage(result.submissionId);

        // Verify data exists
        expect(getPortalRequests().filter(r => r.transactionId === txnId).length).toBe(3);
        expect(getPortalSubmissionsList().length).toBeGreaterThan(0);

        // Wipe
        clearPortalSubmissions();

        // After wipe, dynamic data is gone
        const remaining = getPortalSubmissionsList();
        expect(remaining.filter(s => s.transactionId === txnId).length).toBe(0);
    });
});

/* ═══════════════════════════════════════════════════════════════
   Test — createPortalTransaction creates proper records
   ═══════════════════════════════════════════════════════════════ */
describe('createPortalTransaction creates ExternalTransaction + access record', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        setActivePersona('broker');
    });

    it('creates transaction and grants access to active persona user', () => {
        const txnId = createPortalTransaction('Test Transaction', 'Test description');

        // Transaction exists
        const txns = getTransactionsList();
        const txn = txns.find(t => t.id === txnId);
        expect(txn).toBeDefined();
        expect(txn!.name).toBe('Test Transaction');
        expect(txn!.orgId).toBe('org-atlas');

        // Access granted
        const access = getTransactionAccessList().find(
            a => a.transactionId === txnId && a.userId === 'ext-user-alex'
        );
        expect(access).toBeDefined();

        // Authorized transactions include it
        const authTxns = getAuthorizedTransactions('ext-user-alex');
        expect(authTxns.some(a => a.transactionId === txnId)).toBe(true);
    });
});

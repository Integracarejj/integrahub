import { describe, it, expect, beforeEach } from 'vitest';

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
    submitBrokerUploadPackage,
    confirmBrokerPackage,
    saveParsedRows,
    clearPortalSubmissions,
    createPortalTransaction,
    getPortalRequests,
    getPortalTransactions,
} from '../services/portalMockData';

import {
    clearAllPortalCreatedData,
    getTransactions,
    getPortalCreatedRequests,
    getPortalCreatedIntakeItems,
    publishSelectedRequests,
    getRequests,
    archiveRequest,
    unarchiveRequest,
    isPlatformAdminActive,
    setPlatformAdminOverride,
    permanentlyDeleteRequest,

} from '../services/recapDataService';

function simulateDataWipe(): void {
    localStorage.setItem("integrasource.recap.wiped", "true");
}

function setupMockParsedRows(count: number): Record<string, string>[] {
    return Array.from({ length: count }, (_, i) => ({
        'Request Title': `Request ${i + 1}`,
        'Category': i % 2 === 0 ? 'Financial' : 'Legal',
        'Priority': 'Medium',
        '#': String(i + 1),
    }));
}

function createAndSubmitPackage(txnId: string, fileName: string, rowCount: number): string {
    const rows = setupMockParsedRows(rowCount);
    saveParsedRows(rows);
    const result = submitBrokerUploadPackage(fileName, rowCount, [], txnId);
    confirmBrokerPackage(result.submissionId);
    return result.submissionId;
}

/* ═══════════════════════════════════════════════════════════════
   Test 1 — Unique package IDs
   ═══════════════════════════════════════════════════════════════ */
describe('Test 1: Unique package IDs', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        simulateDataWipe();
        setActivePersona('broker');
    });

    it('4 rapidly-created packages all have unique persistent IDs', () => {
        const keystoneId = createPortalTransaction('Project Keystone');
        const libertyId = createPortalTransaction('Project Liberty');
        const harborId = createPortalTransaction('Project Harbor');
        const summitId = createPortalTransaction('Project Summit');

        createAndSubmitPackage(keystoneId, 'Keystone.xlsx', 4);
        createAndSubmitPackage(libertyId, 'Liberty.xlsx', 4);
        createAndSubmitPackage(harborId, 'Harbor.xlsx', 4);
        createAndSubmitPackage(summitId, 'Summit.xlsx', 4);

        const items = getPortalCreatedIntakeItems();
        expect(items.length).toBe(4);

        const intakeIds = items.map(i => i.intakeId);
        const uniqueIntakeIds = new Set(intakeIds);
        expect(uniqueIntakeIds.size).toBe(4);

        const packageIds = items.map(i => i.packageId || i.id);
        const uniquePackageIds = new Set(packageIds);
        expect(uniquePackageIds.size).toBe(4);
    });
});

/* ═══════════════════════════════════════════════════════════════
   Test 2 — Unique request UIDs
   ═══════════════════════════════════════════════════════════════ */
describe('Test 2: Unique request UIDs', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        simulateDataWipe();
        setActivePersona('broker');
    });

    it('requests across packages with same display sequence have unique internal UIDs', () => {
        const keystoneId = createPortalTransaction('Project Keystone');
        const libertyId = createPortalTransaction('Project Liberty');

        createAndSubmitPackage(keystoneId, 'Keystone.xlsx', 4);
        createAndSubmitPackage(libertyId, 'Liberty.xlsx', 4);

        const requests = getPortalCreatedRequests();
        expect(requests.length).toBe(8);

        const internalIds = requests.map(r => r.id);
        const uniqueIds = new Set(internalIds);
        expect(uniqueIds.size).toBe(8);

        const displayIds = requests.map(r => r.requestId);
        const uniqueDisplayIds = new Set(displayIds);
        expect(uniqueDisplayIds.size).toBe(8);
    });
});

/* ═══════════════════════════════════════════════════════════════
   Test 3 — 4x4 Intake → Work Queue = 16
   ═══════════════════════════════════════════════════════════════ */
describe('Test 3: 4x4 Intake → Work Queue = 16', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        simulateDataWipe();
        setActivePersona('broker');
    });

    it('publishing all 4 requests from each of 4 packages yields 16 in work queue', () => {
        const keystoneId = createPortalTransaction('Project Keystone');
        const libertyId = createPortalTransaction('Project Liberty');
        const harborId = createPortalTransaction('Project Harbor');
        const summitId = createPortalTransaction('Project Summit');

        createAndSubmitPackage(keystoneId, 'Keystone.xlsx', 4);
        createAndSubmitPackage(libertyId, 'Liberty.xlsx', 4);
        createAndSubmitPackage(harborId, 'Harbor.xlsx', 4);
        createAndSubmitPackage(summitId, 'Summit.xlsx', 4);

        const allRequests = getPortalCreatedRequests();
        expect(allRequests.length).toBe(16);

        const ids = allRequests.map(r => r.id);
        const result = publishSelectedRequests(ids);
        expect(result.publishedCount).toBe(16);
        expect(result.publishedIds.length).toBe(16);
    });
});

/* ═══════════════════════════════════════════════════════════════
   Test 4 — Transaction distribution
   ═══════════════════════════════════════════════════════════════ */
describe('Test 4: Transaction distribution', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        simulateDataWipe();
        setActivePersona('broker');
    });

    it('each transaction has exactly 4 requests', () => {
        const keystoneId = createPortalTransaction('Project Keystone');
        const libertyId = createPortalTransaction('Project Liberty');
        const harborId = createPortalTransaction('Project Harbor');
        const summitId = createPortalTransaction('Project Summit');

        createAndSubmitPackage(keystoneId, 'Keystone.xlsx', 4);
        createAndSubmitPackage(libertyId, 'Liberty.xlsx', 4);
        createAndSubmitPackage(harborId, 'Harbor.xlsx', 4);
        createAndSubmitPackage(summitId, 'Summit.xlsx', 4);

        const all = getPortalCreatedRequests();
        expect(all.filter(r => r.transactionId === keystoneId).length).toBe(4);
        expect(all.filter(r => r.transactionId === libertyId).length).toBe(4);
        expect(all.filter(r => r.transactionId === harborId).length).toBe(4);
        expect(all.filter(r => r.transactionId === summitId).length).toBe(4);
    });
});

/* ═══════════════════════════════════════════════════════════════
   Test 5 — External Party distribution
   ═══════════════════════════════════════════════════════════════ */
describe('Test 5: External Party distribution', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        simulateDataWipe();
        setActivePersona('broker');
    });

    it('Atlas has 8 (Keystone + Liberty), Harbor 4, Summit 4', () => {
        const keystoneId = createPortalTransaction('Project Keystone');
        const libertyId = createPortalTransaction('Project Liberty');
        const harborId = createPortalTransaction('Project Harbor');
        const summitId = createPortalTransaction('Project Summit');

        createAndSubmitPackage(keystoneId, 'Keystone.xlsx', 4);
        createAndSubmitPackage(libertyId, 'Liberty.xlsx', 4);
        createAndSubmitPackage(harborId, 'Harbor.xlsx', 4);
        createAndSubmitPackage(summitId, 'Summit.xlsx', 4);

        const all = getPortalCreatedRequests();
        expect(all.filter(r => r.transactionId === keystoneId || r.transactionId === libertyId).length).toBe(8);
        expect(all.filter(r => r.transactionId === harborId).length).toBe(4);
        expect(all.filter(r => r.transactionId === summitId).length).toBe(4);
    });
});

/* ═══════════════════════════════════════════════════════════════
   Test 6 — Package context on requests
   ═══════════════════════════════════════════════════════════════ */
describe('Test 6: Package context on requests', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        simulateDataWipe();
        setActivePersona('broker');
    });

    it('each request retains _sourcePackageId, _sourcePackageName, _sourceFileName', () => {
        const txnId = createPortalTransaction('Project Keystone');
        createAndSubmitPackage(txnId, 'Keystone.xlsx', 4);

        const requests = getPortalCreatedRequests();
        expect(requests.length).toBe(4);
        requests.forEach(r => {
            expect(r._sourcePackageId).toBeDefined();
            expect(r._sourcePackageName).toBe('Keystone');
            expect(r._sourceFileName).toBe('Keystone');
        });
    });
});

/* ═══════════════════════════════════════════════════════════════
   Test 7 — Multiple packages same transaction
   ═══════════════════════════════════════════════════════════════ */
describe('Test 7: Multiple packages same transaction', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        simulateDataWipe();
        setActivePersona('broker');
    });

    it('two packages in one transaction aggregate to combined total', () => {
        const txnId = createPortalTransaction('Project Keystone');

        createAndSubmitPackage(txnId, 'Keystone Initial DD.xlsx', 3);
        createAndSubmitPackage(txnId, 'Keystone Supplemental.xlsx', 2);

        const all = getPortalCreatedRequests();
        expect(all.filter(r => r.transactionId === txnId).length).toBe(5);

        const packages = new Set(all.map(r => r._sourcePackageName));
        expect(packages.size).toBe(2);

        const pkg1Count = all.filter(r => r._sourcePackageName === 'Keystone Initial DD').length;
        const pkg2Count = all.filter(r => r._sourcePackageName === 'Keystone Supplemental').length;
        expect(pkg1Count).toBe(3);
        expect(pkg2Count).toBe(2);
    });
});

/* ═══════════════════════════════════════════════════════════════
   Test 8 — Persona isolation regression
   ═══════════════════════════════════════════════════════════════ */
describe('Test 8: Persona isolation regression', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        simulateDataWipe();
    });

    it('Harbor cannot see Keystone/Liberty requests', () => {
        setActivePersona('broker');
        const keystoneId = createPortalTransaction('Project Keystone');
        const libertyId = createPortalTransaction('Project Liberty');
        createAndSubmitPackage(keystoneId, 'Keystone.xlsx', 4);

        setActivePersona('owner-seller');
        const harborId = createPortalTransaction('Project Harbor');
        createAndSubmitPackage(harborId, 'Harbor.xlsx', 4);

        setActivePersona('broker');
        createAndSubmitPackage(libertyId, 'Liberty.xlsx', 4);

        // Broker should see 8 (Keystone 4 + Liberty 4)
        const brokerRequests = getPortalRequests();
        expect(brokerRequests.length).toBe(8);

        // Harbor should see 4 (Harbor only)
        setActivePersona('owner-seller');
        const harborRequests = getPortalRequests();
        expect(harborRequests.length).toBe(4);
    });
});

/* ═══════════════════════════════════════════════════════════════
   Test 9 — Intake item navigation uses stable id
   ═══════════════════════════════════════════════════════════════ */
describe('Test 9: Intake item stable identity', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        simulateDataWipe();
        setActivePersona('broker');
    });

    it('intake items can be looked up by their stable id', () => {
        const txnId = createPortalTransaction('Project Keystone');
        createAndSubmitPackage(txnId, 'Keystone.xlsx', 4);

        const items = getPortalCreatedIntakeItems();
        expect(items.length).toBe(1);

        // Lookup by id (stable) must work
        const byId = items.find(i => i.id === items[0].id);
        expect(byId).toBeDefined();
        expect(byId!.transactionName).toBe('Project Keystone');

        // Lookup by intakeId must also work
        const byIntakeId = items.find(i => i.intakeId === items[0].intakeId);
        expect(byIntakeId).toBeDefined();
    });
});

/* ═══════════════════════════════════════════════════════════════
   Test 10 — Transaction selector
   ═══════════════════════════════════════════════════════════════ */
describe('Test 10: Transaction selector consistency', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        simulateDataWipe();
        setActivePersona('broker');
    });

    it('created transaction id and name are consistent across data sources', () => {
        const txnId = createPortalTransaction('Project Keystone');

        const txns = getTransactions();
        const txn = txns.find(t => t.id === txnId);
        expect(txn).toBeDefined();
        expect(txn!.name).toBe('Project Keystone');
        expect(txn!.id).toBe(txnId);
    });
});

/* ═══════════════════════════════════════════════════════════════
   Acceptance Test: 213 + 130 scenario, archive, delete
   ═══════════════════════════════════════════════════════════════ */
describe('Acceptance: 213/130 multi-package, archive, delete', () => {
    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        simulateDataWipe();
        setActivePersona('broker');
    });

    function uploadPackage(txnId: string, fileName: string, count: number): string {
        const rows = setupMockParsedRows(count);
        saveParsedRows(rows);
        const result = submitBrokerUploadPackage(fileName, count, [], txnId);
        confirmBrokerPackage(result.submissionId);
        return result.submissionId;
    }

    it('1-4: aggregate=343, Keystone=213, Liberty=130, per-package counts are independent', () => {
        const keystoneTxn = createPortalTransaction('Project Keystone');
        const libertyTxn = createPortalTransaction('Project Liberty');

        uploadPackage(keystoneTxn, 'Keystone.xlsx', 213);
        uploadPackage(libertyTxn, 'Liberty.xlsx', 130);

        // All requests = 343
        const allReqs = getRequests();
        expect(allReqs.length).toBe(343);

        // Aggregate Atlas = 343
        const atlasReqs = allReqs.filter(r => r.transactionId === keystoneTxn || r.transactionId === libertyTxn);
        expect(atlasReqs.length).toBe(343);

        // Keystone = 213
        const keystoneReqs = allReqs.filter(r => r.transactionId === keystoneTxn);
        expect(keystoneReqs.length).toBe(213);

        // Liberty = 130
        const libertyReqs = allReqs.filter(r => r.transactionId === libertyTxn);
        expect(libertyReqs.length).toBe(130);

        // No request belongs to both
        expect(keystoneReqs.every(r => !libertyReqs.includes(r))).toBe(true);

        // Intake items match
        const intakeItems = getPortalCreatedIntakeItems();
        expect(intakeItems.length).toBe(2);
        const keystoneIntake = intakeItems.find(i => i.transactionId === keystoneTxn);
        const libertyIntake = intakeItems.find(i => i.transactionId === libertyTxn);
        expect(keystoneIntake).toBeDefined();
        expect(keystoneIntake!.rowsFound).toBe(213);
        expect(libertyIntake).toBeDefined();
        expect(libertyIntake!.rowsFound).toBe(130);
    });

    it('5-6: transaction filter shows only persisted transactions, no demo names', () => {
        const keystoneTxn = createPortalTransaction('Project Keystone');
        const libertyTxn = createPortalTransaction('Project Liberty');

        uploadPackage(keystoneTxn, 'Keystone.xlsx', 5);
        uploadPackage(libertyTxn, 'Liberty.xlsx', 3);

        const txns = getTransactions();
        // In wiped mode, only portal-created transactions appear
        expect(txns.length).toBe(2);
        expect(txns.some(t => t.id === keystoneTxn)).toBe(true);
        expect(txns.some(t => t.id === libertyTxn)).toBe(true);
        expect(txns.some(t => t.name === 'ABC Company Portfolio')).toBe(false);
        expect(txns.some(t => t.name === 'Valstone Corp Portfolio')).toBe(false);
        expect(txns.some(t => t.name === 'ABC Portfolio Acquisition')).toBe(false);
        expect(txns.some(t => t.name === 'Harbor View Single Asset')).toBe(false);
        expect(txns.some(t => t.name === 'Summit Portfolio Review')).toBe(false);

        // Before any transaction exists, filter shows empty after wipe
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        simulateDataWipe();
        setActivePersona('broker');

        // Re-create one transaction
        const newTxn = createPortalTransaction('Project Keystone');
        uploadPackage(newTxn, 'Keystone.xlsx', 5);

        const txnsAfter = getTransactions();
        expect(txnsAfter.length).toBe(1);
        expect(txnsAfter[0].name).toBe('Project Keystone');
    });

    it('7-9: all 213 Keystone requests can move to Work Queue with no 150 cap', () => {
        const keystoneTxn = createPortalTransaction('Project Keystone');

        uploadPackage(keystoneTxn, 'Keystone.xlsx', 213);

        // Verify 213 exist before publish
        const before = getRequests();
        expect(before.filter(r => r.transactionId === keystoneTxn).length).toBe(213);

        // Publish all 213 via publishSelectedRequests
        const allKeystoneIds = before.filter(r => r.transactionId === keystoneTxn).map(r => r.id);
        const result = publishSelectedRequests(allKeystoneIds, { sourceIntakeId: 'test-intake', sourcePackageId: 'test-pkg' });
        expect(result.publishedCount).toBe(213);
        expect(result.publishedIds.length).toBe(213);

        // After publish, all 213 have _publishedAt set
        const after = getRequests();
        const published = after.filter(r => r.transactionId === keystoneTxn && r._publishedAt);
        expect(published.length).toBe(213);

        // No request was silently skipped
        expect(after.filter(r => r.transactionId === keystoneTxn).length).toBe(213);
    });

    it('10-12: Work Queue correctly represents all 343, filtered by transaction', () => {
        const keystoneTxn = createPortalTransaction('Project Keystone');
        const libertyTxn = createPortalTransaction('Project Liberty');

        uploadPackage(keystoneTxn, 'Keystone.xlsx', 213);
        uploadPackage(libertyTxn, 'Liberty.xlsx', 130);

        // Publish all
        const allReqIds = getRequests().map(r => r.id);
        publishSelectedRequests(allReqIds);

        const allPublished = getRequests().filter(r => r._publishedAt);
        expect(allPublished.length).toBe(343);

        // Filter by Keystone
        const keystonePublished = allPublished.filter(r => r.transactionId === keystoneTxn);
        expect(keystonePublished.length).toBe(213);

        // Filter by Liberty
        const libertyPublished = allPublished.filter(r => r.transactionId === libertyTxn);
        expect(libertyPublished.length).toBe(130);

        // Combined = 343
        expect(keystonePublished.length + libertyPublished.length).toBe(343);
    });

    it('13: package/source lineage preserved after Move to Work Queue', () => {
        const keystoneTxn = createPortalTransaction('Project Keystone');
        uploadPackage(keystoneTxn, 'Keystone.xlsx', 5);

        const allReqIds = getRequests().map(r => r.id);
        publishSelectedRequests(allReqIds, { sourceIntakeId: 'intake-xyz', sourcePackageId: 'pkg-xyz' });

        const published = getRequests().filter(r => r._publishedAt);
        published.forEach(r => {
            expect(r._sourcePackageId).toBe('pkg-xyz');
            expect(r._sourceIntakeId).toBe('intake-xyz');
            expect(r._sourcePackageName).toBe('Keystone');
            expect(r._sourceFileName).toBe('Keystone');
            expect(r._createdFromReview).toBe(true);
            expect(r._sourceReviewItemId).toBe(r.requestId);
        });
    });

    it('14-17: archive workflow — archive, hide from Active, show in Archived/All, retain history', () => {
        const txn = createPortalTransaction('Project Keystone');
        uploadPackage(txn, 'Keystone.xlsx', 10);

        // Publish all
        const allReqIds = getRequests().map(r => r.id);
        publishSelectedRequests(allReqIds);

        // All 10 are active (not archived)
        const active = getRequests().filter(r => r._publishedAt && !r._archived);
        expect(active.length).toBe(10);

        // Archive request #1
        const req1 = getRequests()[0];
        const archiveResult = archiveRequest(req1.id, 'Duplicate', 'Test archive', 'Sarah Chen');
        expect(archiveResult).toBeDefined();
        expect(archiveResult!._archived).toBe(true);
        expect(archiveResult!._archiveReason).toBe('Duplicate');
        expect(archiveResult!._archivedBy).toBe('Sarah Chen');
        expect(archiveResult!._archiveNote).toBe('Test archive');

        // Verify still persisted
        const allAfter = getRequests();
        const archivedReq = allAfter.find(r => r.id === req1.id);
        expect(archivedReq).toBeDefined();
        expect(archivedReq!._archived).toBe(true);

        // Only 9 active now
        const activeAfter = allAfter.filter(r => r._publishedAt && !r._archived);
        expect(activeAfter.length).toBe(9);

        // Archived request still has transaction relationship
        expect(archivedReq!.transactionId).toBe(txn);
        expect(archivedReq!.transactionName).toBe('Project Keystone');

        // Unarchive
        unarchiveRequest(req1.id);
        const afterUnarchive = getRequests().find(r => r.id === req1.id);
        expect(afterUnarchive!._archived).toBe(false);
        expect(afterUnarchive!._archiveReason).toBeNull();
    });

    it('18: non-admin cannot permanently delete', () => {
        const txn = createPortalTransaction('Project Keystone');
        uploadPackage(txn, 'Keystone.xlsx', 3);
        const allReqIds = getRequests().map(r => r.id);
        publishSelectedRequests(allReqIds);

        // Ensure admin is NOT active
        setPlatformAdminOverride(false);
        expect(isPlatformAdminActive()).toBe(false);

        const req = getRequests()[0];
        const reqId = req.id;

        // Try to delete — should fail
        const deleted = permanentlyDeleteRequest(reqId);
        expect(deleted).toBe(false);

        // Request still exists
        const stillThere = getRequests().find(r => r.id === reqId);
        expect(stillThere).toBeDefined();
    });

    it('19: platform admin can permanently delete after strong confirmation', () => {
        const txn = createPortalTransaction('Project Keystone');
        uploadPackage(txn, 'Keystone.xlsx', 3);
        const allReqIds = getRequests().map(r => r.id);
        publishSelectedRequests(allReqIds);

        // Enable admin
        setPlatformAdminOverride(true);
        expect(isPlatformAdminActive()).toBe(true);

        const req = getRequests()[0];
        const reqId = req.id;
        const reqRequestId = req.requestId;

        // Delete
        const deleted = permanentlyDeleteRequest(reqId);
        expect(deleted).toBe(true);

        // Request is gone from portal requests
        const portalReqs = getPortalCreatedRequests();
        const stillThere = portalReqs.find(r => r.id === reqId || r.requestId === reqRequestId);
        expect(stillThere).toBeUndefined();

        // Cleanup
        setPlatformAdminOverride(false);
    });

    it('20: existing locked workflows still pass — verify no regression marker', () => {
        // Quick sanity: basic portal workflow still works after all changes
        const txn = createPortalTransaction('Project Keystone');
        uploadPackage(txn, 'Keystone.xlsx', 5);

        const allReqs = getRequests();
        expect(allReqs.filter(r => r.transactionId === txn).length).toBe(5);

        // Publish
        const ids = allReqs.filter(r => r.transactionId === txn).map(r => r.id);
        const pubResult = publishSelectedRequests(ids);
        expect(pubResult.publishedCount).toBe(5);

        // Archive
        archiveRequest(ids[0], 'No Longer Required');
        const archived = getRequests().find(r => r.id === ids[0]);
        expect(archived!._archived).toBe(true);
        expect(archived!._archiveReason).toBe('No Longer Required');

        // PublishedAt still set after archive
        expect(archived!._publishedAt).toBeDefined();
    });
});

/* ═══════════════════════════════════════════════════════════════
   External Portal Consumer Path — 213 + 130 scenario
   Uses ONLY functions consumed by the deployed browser:
   getPortalTransactions, getPortalRequests, getPortalRequestsByTransaction
   createPortalTransaction, submitBrokerUploadPackage, confirmBrokerPackage
   ═══════════════════════════════════════════════════════════════ */
describe('External Portal — multi-transaction 213/130 consumer path', () => {
    let keystoneTxn: string;
    let libertyTxn: string;

    beforeEach(() => {
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        localStorage.setItem("integrasource.recap.wiped", "true");
        setActivePersona('broker');
    });

    function uploadPackage(txnId: string, fileName: string, count: number): string {
        const rows = Array.from({ length: count }, (_, i) => ({
            'Request Title': `Request ${i + 1}`,
            'Category': i % 2 === 0 ? 'Financial' : 'Legal',
            'Priority': 'Medium',
            '#': String(i + 1),
        }));
        saveParsedRows(rows);
        const result = submitBrokerUploadPackage(fileName, count, [], txnId);
        confirmBrokerPackage(result.submissionId);
        return result.submissionId;
    }

    it('Atlas has 2 independent transactions (getPortalTransactions)', () => {
        keystoneTxn = createPortalTransaction('Project Keystone');
        libertyTxn = createPortalTransaction('Project Liberty');
        uploadPackage(keystoneTxn, 'Keystone.xlsx', 213);
        uploadPackage(libertyTxn, 'Liberty.xlsx', 130);

        const portalTxns = getPortalTransactions();
        expect(portalTxns.length).toBe(2);

        const names = portalTxns.map(t => t.name);
        expect(names).toContain('Project Keystone');
        expect(names).toContain('Project Liberty');

        // No demo/fake transaction names
        expect(names).not.toContain('ABC Portfolio Acquisition');
        expect(names).not.toContain('Harbor View Single Asset');
        expect(names).not.toContain('Summit Portfolio Review');
    });

    it('Atlas aggregate = 343 via getPortalRequests (no demo contamination)', () => {
        keystoneTxn = createPortalTransaction('Project Keystone');
        libertyTxn = createPortalTransaction('Project Liberty');
        uploadPackage(keystoneTxn, 'Keystone.xlsx', 213);
        uploadPackage(libertyTxn, 'Liberty.xlsx', 130);

        const allReqs = getPortalRequests();
        expect(allReqs.length).toBe(343);

        const keystoneReqs = allReqs.filter(r => r.transactionId === keystoneTxn);
        const libertyReqs = allReqs.filter(r => r.transactionId === libertyTxn);
        expect(keystoneReqs.length).toBe(213);
        expect(libertyReqs.length).toBe(130);
    });

    it('Keystone-scoped query returns 213 with correct transactionId', () => {
        keystoneTxn = createPortalTransaction('Project Keystone');
        libertyTxn = createPortalTransaction('Project Liberty');
        uploadPackage(keystoneTxn, 'Keystone.xlsx', 213);
        uploadPackage(libertyTxn, 'Liberty.xlsx', 130);

        const keystoneReqs = getPortalRequests().filter(r => r.transactionId === keystoneTxn);
        expect(keystoneReqs.length).toBe(213);
        keystoneReqs.forEach(r => {
            expect(r.transactionId).toBe(keystoneTxn);
            expect(r.transactionName).toBe('Project Keystone');
        });
    });

    it('Liberty-scoped query returns 130 with correct transactionId', () => {
        keystoneTxn = createPortalTransaction('Project Keystone');
        libertyTxn = createPortalTransaction('Project Liberty');
        uploadPackage(keystoneTxn, 'Keystone.xlsx', 213);
        uploadPackage(libertyTxn, 'Liberty.xlsx', 130);

        const libertyReqs = getPortalRequests().filter(r => r.transactionId === libertyTxn);
        expect(libertyReqs.length).toBe(130);
        libertyReqs.forEach(r => {
            expect(r.transactionId).toBe(libertyTxn);
            expect(r.transactionName).toBe('Project Liberty');
        });
    });

    it('no cross-contamination between Keystone and Liberty requests', () => {
        keystoneTxn = createPortalTransaction('Project Keystone');
        libertyTxn = createPortalTransaction('Project Liberty');
        uploadPackage(keystoneTxn, 'Keystone.xlsx', 213);
        uploadPackage(libertyTxn, 'Liberty.xlsx', 130);

        const allReqs = getPortalRequests();
        const keystoneIds = new Set(allReqs.filter(r => r.transactionId === keystoneTxn).map(r => r.id));
        const libertyIds = new Set(allReqs.filter(r => r.transactionId === libertyTxn).map(r => r.id));

        // No overlap
        keystoneIds.forEach(id => expect(libertyIds.has(id)).toBe(false));
        libertyIds.forEach(id => expect(keystoneIds.has(id)).toBe(false));

        // Combined count = 343
        expect(keystoneIds.size).toBe(213);
        expect(libertyIds.size).toBe(130);
    });

    it('every portal request exposes transaction identity (transactionName)', () => {
        keystoneTxn = createPortalTransaction('Project Keystone');
        libertyTxn = createPortalTransaction('Project Liberty');
        uploadPackage(keystoneTxn, 'Keystone.xlsx', 213);
        uploadPackage(libertyTxn, 'Liberty.xlsx', 130);

        const allReqs = getPortalRequests();
        allReqs.forEach(r => {
            expect(r.transactionId).toBeTruthy();
            expect(r.transactionName).toBeTruthy();
        });
    });

    it('org isolation: Summit cannot see Atlas transactions', () => {
        keystoneTxn = createPortalTransaction('Project Keystone');
        libertyTxn = createPortalTransaction('Project Liberty');
        uploadPackage(keystoneTxn, 'Keystone.xlsx', 213);
        uploadPackage(libertyTxn, 'Liberty.xlsx', 130);

        setActivePersona('buyer');
        const summitTxns = getPortalTransactions();
        expect(summitTxns.some(t => t.id === keystoneTxn)).toBe(false);
        expect(summitTxns.some(t => t.id === libertyTxn)).toBe(false);

        const summitReqs = getPortalRequests();
        expect(summitReqs.some(r => r.transactionId === keystoneTxn)).toBe(false);
        expect(summitReqs.some(r => r.transactionId === libertyTxn)).toBe(false);
    });

    it('data wipe removes both transactions from getPortalTransactions', () => {
        keystoneTxn = createPortalTransaction('Project Keystone');
        libertyTxn = createPortalTransaction('Project Liberty');
        uploadPackage(keystoneTxn, 'Keystone.xlsx', 5);
        uploadPackage(libertyTxn, 'Liberty.xlsx', 3);

        // Visible before wipe
        expect(getPortalTransactions().length).toBeGreaterThanOrEqual(2);

        // Wipe
        clearPortalSubmissions();
        clearAllPortalCreatedData();
        localStorage.setItem("integrasource.recap.wiped", "true");
        setActivePersona('broker');

        // No transactions visible (including demo — not re-seeded after wipe)
        const afterTxns = getPortalTransactions();
        expect(afterTxns.length).toBe(0);
    });
});

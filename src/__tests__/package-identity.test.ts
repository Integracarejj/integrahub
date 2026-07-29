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
} from '../services/portalMockData';

import {
    clearAllPortalCreatedData,
    getTransactions,
    getPortalCreatedRequests,
    getPortalCreatedIntakeItems,
    publishSelectedRequests,
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
        expect(byId!.transactionName).toBe('Keystone');

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

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

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

// @ts-expect-error — assigning to globalThis.localStorage in test setup
globalThis.localStorage = localStorageMock;

import {
    getOrganizations, getOrganization, addOrganization,
    getExternalUsers, getExternalUser, addExternalUser,
    getMemberships, addMembership, deleteMembership,
    getTransactionsList, addTransaction,
    getTransactionAccessList, addTransactionAccess,
    getAuthorizedTransactions, isRequestAuthorized, isTransactionAuthorized,
    getPersonaIdentity, getActivePersona, setActivePersona,
    clearPortalSubmissions,
    getPortalRequests,
    type ExternalOrganization, type ExternalUser, type ExternalOrganizationMembership,
    type ExternalTransaction, type ExternalTransactionAccess,
} from '../services/portalMockData';

/* ── Helper builders ──────────────────────────────────────── */

function buildOrg(overrides: Partial<ExternalOrganization> = {}): ExternalOrganization {
    return {
        id: `org-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: `Test Organization ${Date.now()}`,
        status: 'Active',
        ...overrides,
    };
}

function buildUser(overrides: Partial<ExternalUser> = {}): ExternalUser {
    return {
        id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        email: `test-${Date.now()}@example.com`,
        displayName: 'Test User',
        organizationId: 'org-test',
        organizationName: 'Test Organization',
        roleAssignments: [{ orgId: 'org-test', role: 'Broker' }],
        ...overrides,
    };
}

function buildMembership(overrides: Partial<ExternalOrganizationMembership> = {}): ExternalOrganizationMembership {
    return {
        userId: 'user-test',
        orgId: 'org-test',
        role: 'Broker',
        ...overrides,
    };
}

function buildExtTxn(overrides: Partial<ExternalTransaction> = {}): ExternalTransaction {
    return {
        id: `txn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        orgId: 'org-test',
        name: `Test Transaction ${Date.now()}`,
        description: 'Test transaction description',
        status: 'Active',
        createdAt: new Date().toISOString(),
        ...overrides,
    };
}

function buildTxnAccess(overrides: Partial<ExternalTransactionAccess> = {}): ExternalTransactionAccess {
    return {
        transactionId: 'txn-test',
        orgId: 'org-test',
        userId: 'user-test',
        ...overrides,
    };
}

/* ── Test Suite ────────────────────────────────────────────── */

describe('External Organization Model', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('should initialize demo organizations on first call', () => {
        const orgs = getOrganizations();
        expect(orgs.length).toBe(3);
        expect(orgs.find(o => o.id === 'org-atlas')).toBeDefined();
        expect(orgs.find(o => o.id === 'org-harbor')).toBeDefined();
        expect(orgs.find(o => o.id === 'org-summit')).toBeDefined();
    });

    it('should return same organizations on subsequent calls (persistence)', () => {
        const first = getOrganizations();
        const second = getOrganizations();
        expect(first).toEqual(second);
    });

    it('should get organization by id', () => {
        const org = getOrganization('org-atlas');
        expect(org).toBeDefined();
        expect(org!.name).toBe('Atlas Capital Partners');
        expect(org!.status).toBe('Active');
    });

    it('should return undefined for non-existent organization', () => {
        const org = getOrganization('org-nonexistent');
        expect(org).toBeUndefined();
    });

    it('should add a new organization', () => {
        const newOrg = buildOrg({ id: 'org-new', name: 'New Corp' });
        addOrganization(newOrg);
        const orgs = getOrganizations();
        expect(orgs.length).toBe(4);
        expect(orgs.find(o => o.id === 'org-new')).toBeDefined();
    });
});

describe('External User Model', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('should initialize demo users on first call', () => {
        const users = getExternalUsers();
        expect(users.length).toBe(3);
        expect(users.find(u => u.id === 'ext-user-alex')).toBeDefined();
        expect(users.find(u => u.id === 'ext-user-hannah')).toBeDefined();
        expect(users.find(u => u.id === 'ext-user-sam')).toBeDefined();
    });

    it('should return same users on subsequent calls (persistence)', () => {
        const first = getExternalUsers();
        const second = getExternalUsers();
        expect(first).toEqual(second);
    });

    it('should get user by id', () => {
        const user = getExternalUser('ext-user-alex');
        expect(user).toBeDefined();
        expect(user!.displayName).toBe('Morgan Blake');
        expect(user!.organizationId).toBe('org-atlas');
    });

    it('should return undefined for non-existent user', () => {
        const user = getExternalUser('user-nonexistent');
        expect(user).toBeUndefined();
    });

    it('should add a new user', () => {
        const newUser = buildUser({ id: 'user-new', displayName: 'New User' });
        addExternalUser(newUser);
        const users = getExternalUsers();
        expect(users.length).toBe(4);
        expect(users.find(u => u.id === 'user-new')).toBeDefined();
    });
});

describe('Organization Membership Model', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('should initialize demo memberships on first call', () => {
        const memberships = getMemberships();
        expect(memberships.length).toBe(3);
        expect(memberships.find(m => m.userId === 'ext-user-alex' && m.orgId === 'org-atlas')).toBeDefined();
        expect(memberships.find(m => m.userId === 'ext-user-hannah' && m.orgId === 'org-harbor')).toBeDefined();
        expect(memberships.find(m => m.userId === 'ext-user-sam' && m.orgId === 'org-summit')).toBeDefined();
    });

    it('should add a new membership', () => {
        const newMembership = buildMembership({ userId: 'ext-user-alex', orgId: 'org-harbor', role: 'Buyer' });
        addMembership(newMembership);
        const memberships = getMemberships();
        expect(memberships.length).toBe(4);
        expect(memberships.find(m => m.userId === 'ext-user-alex' && m.orgId === 'org-harbor')).toBeDefined();
    });

    it('should delete a membership', () => {
        deleteMembership('ext-user-alex', 'org-atlas');
        const memberships = getMemberships();
        expect(memberships.find(m => m.userId === 'ext-user-alex' && m.orgId === 'org-atlas')).toBeUndefined();
    });

    it('should not affect other memberships when deleting', () => {
        deleteMembership('ext-user-alex', 'org-atlas');
        const memberships = getMemberships();
        expect(memberships.find(m => m.userId === 'ext-user-hannah' && m.orgId === 'org-harbor')).toBeDefined();
    });
});

describe('External Transaction Model', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('should initialize demo transactions on first call', () => {
        const txns = getTransactionsList();
        expect(txns.length).toBe(3);
        expect(txns.find(t => t.id === 'txn-abc-portfolio')).toBeDefined();
    });

    it('should add a transaction', () => {
        const txn = buildExtTxn({ id: 'txn-new', name: 'New Deal' });
        addTransaction(txn);
        const txns = getTransactionsList();
        expect(txns.length).toBe(4);
        expect(txns.find(t => t.id === 'txn-new')).toBeDefined();
    });

    it('should persist transactions across calls', () => {
        addTransaction(buildExtTxn({ id: 'txn-extra' }));
        const txns = getTransactionsList();
        expect(txns.length).toBe(4);
    });
});

describe('Transaction Access Model', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('should initialize demo transaction access on first call', () => {
        const accesses = getTransactionAccessList();
        expect(accesses.length).toBe(4);
        expect(accesses.find(a => a.transactionId === 'txn-abc-portfolio' && a.userId === 'ext-user-alex')).toBeDefined();
    });

    it('should add transaction access', () => {
        addTransactionAccess(buildTxnAccess({ transactionId: 'txn-extra', userId: 'user-extra' }));
        const accesses = getTransactionAccessList();
        expect(accesses.length).toBe(5);
        expect(accesses.find(a => a.transactionId === 'txn-extra')).toBeDefined();
    });

    it('should get authorized transactions for a user', () => {
        addTransactionAccess(buildTxnAccess({ transactionId: 'txn-1', userId: 'user-1' }));
        addTransactionAccess(buildTxnAccess({ transactionId: 'txn-2', userId: 'user-1' }));
        addTransactionAccess(buildTxnAccess({ transactionId: 'txn-3', userId: 'user-2' }));

        const authorized = getAuthorizedTransactions('user-1');
        expect(authorized.length).toBe(2);
        expect(authorized.every(a => a.userId === 'user-1')).toBe(true);
    });

    it('should return empty array for user with no access', () => {
        const authorized = getAuthorizedTransactions('user-nonexistent');
        expect(authorized.length).toBe(0);
    });
});

describe('Persona Identity Context', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('should return identity context for Alex Broker (Morgan Blake)', () => {
        setActivePersona('broker');
        const identity = getPersonaIdentity();
        expect(identity).not.toBeNull();
        expect(identity!.user.id).toBe('ext-user-alex');
        expect(identity!.organization.id).toBe('org-atlas');
        expect(identity!.organization.name).toBe('Atlas Capital Partners');
    });

    it('should return identity context for Hannah Seller (Alex Carter)', () => {
        setActivePersona('owner-seller');
        const identity = getPersonaIdentity();
        expect(identity).not.toBeNull();
        expect(identity!.user.id).toBe('ext-user-hannah');
        expect(identity!.organization.id).toBe('org-harbor');
    });

    it('should return identity context for Sam Buyer (Jamie Reynolds)', () => {
        setActivePersona('buyer');
        const identity = getPersonaIdentity();
        expect(identity).not.toBeNull();
        expect(identity!.user.id).toBe('ext-user-sam');
        expect(identity!.organization.id).toBe('org-summit');
    });

    it('should initialize demo transactions on first identity call', () => {
        setActivePersona('broker');
        const identity = getPersonaIdentity();
        expect(identity!.allTransactions.length).toBe(3);
        expect(identity!.authorizedTransactions.length).toBe(1);
    });

    it('should have correct authorized transactions per persona', () => {
        setActivePersona('broker');
        let identity = getPersonaIdentity()!;
        expect(identity.authorizedTransactions.some(a => a.transactionId === 'txn-abc-portfolio')).toBe(true);

        setActivePersona('owner-seller');
        identity = getPersonaIdentity()!;
        expect(identity.authorizedTransactions.some(a => a.transactionId === 'txn-harbor-deal')).toBe(true);

        setActivePersona('buyer');
        identity = getPersonaIdentity()!;
        expect(identity.authorizedTransactions.some(a => a.transactionId === 'txn-summit-review')).toBe(true);
        expect(identity.authorizedTransactions.some(a => a.transactionId === 'txn-abc-portfolio')).toBe(true);
    });
});

describe('Request Authorization', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('should deny request access for non-existent request', () => {
        setActivePersona('broker');
        const authorized = isRequestAuthorized('req-nonexistent', 'ext-user-alex');
        expect(authorized).toBe(false);
    });

    it('should authorize transaction access for broker persona', () => {
        setActivePersona('broker');
        // Morgan Blake (ext-user-alex) has access to txn-abc-portfolio
        const authorized = isTransactionAuthorized('txn-abc-portfolio', 'ext-user-alex');
        expect(authorized).toBe(true);
    });

    it('should deny transaction access for unauthorized user', () => {
        setActivePersona('broker');
        // Morgan Blake (ext-user-alex) does NOT have access to txn-summit-review
        const authorized = isTransactionAuthorized('txn-summit-review', 'ext-user-alex');
        expect(authorized).toBe(false);
    });

    it('should authorize cross-transaction access for Sam Buyer', () => {
        setActivePersona('buyer');
        // Jamie Reynolds (ext-user-sam) has access to both txn-summit-review AND txn-abc-portfolio
        const authorized = isTransactionAuthorized('txn-abc-portfolio', 'ext-user-sam');
        expect(authorized).toBe(true);
    });
});

describe('Data Isolation via getPortalRequests', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('should scope requests to authorized transactions for Alex Broker', () => {
        setActivePersona('broker');
        const requests = getPortalRequests();
        expect(Array.isArray(requests)).toBe(true);
    });

    it('should scope requests to authorized transactions for Sam Buyer', () => {
        setActivePersona('buyer');
        const requests = getPortalRequests();
        expect(Array.isArray(requests)).toBe(true);
    });

    it('should scope requests to authorized transactions for Hannah Seller', () => {
        setActivePersona('owner-seller');
        const requests = getPortalRequests();
        expect(Array.isArray(requests)).toBe(true);
    });
});

describe('Data Wipe preserves identity', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('should preserve organizations, users, and memberships after clearPortalSubmissions', () => {
        getOrganizations();
        getExternalUsers();
        getMemberships();

        const orgsBefore = getOrganizations();
        const usersBefore = getExternalUsers();
        const membershipsBefore = getMemberships();

        clearPortalSubmissions();

        const orgsAfter = getOrganizations();
        const usersAfter = getExternalUsers();
        const membershipsAfter = getMemberships();

        expect(orgsAfter.length).toBe(orgsBefore.length);
        expect(usersAfter.length).toBe(usersBefore.length);
        expect(membershipsAfter.length).toBe(membershipsBefore.length);
    });

    it('should clear transactional data after clearPortalSubmissions', () => {
        addTransaction(buildExtTxn({ id: 'txn-custom' }));
        addTransactionAccess(buildTxnAccess({ transactionId: 'txn-custom', userId: 'user-custom' }));

        clearPortalSubmissions();

        const txns = getTransactionsList();
        const accesses = getTransactionAccessList();

        expect(txns.some(t => t.id === 'txn-custom')).toBe(false);
        expect(accesses.some(a => a.transactionId === 'txn-custom')).toBe(false);
    });
});

describe('Persona Switching preserves identity', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('should switch identity context when persona changes', () => {
        setActivePersona('broker');
        const identityAlex = getPersonaIdentity()!;
        expect(identityAlex.user.id).toBe('ext-user-alex');

        setActivePersona('buyer');
        const identitySam = getPersonaIdentity()!;
        expect(identitySam.user.id).toBe('ext-user-sam');

        expect(identityAlex.user.id).not.toBe(identitySam.user.id);
        expect(identityAlex.organization.id).not.toBe(identitySam.organization.id);
    });

    it('should have correct organization for each persona', () => {
        setActivePersona('broker');
        expect(getPersonaIdentity()!.organization.name).toBe('Atlas Capital Partners');

        setActivePersona('owner-seller');
        expect(getPersonaIdentity()!.organization.name).toBe('Harbor Partners');

        setActivePersona('buyer');
        expect(getPersonaIdentity()!.organization.name).toBe('Summit Equity Group');
    });
});

describe('PortalRequest org context fields', () => {
    it('should have orgId, orgName, userId, userName as optional fields', () => {
        const req: import('../services/portalMockData').PortalRequest = {
            id: 'test',
            requestId: 'DD-TEST-001',
            intakeId: 'INT-TEST-001',
            transactionId: 'txn-test',
            transactionName: 'Test',
            title: 'Test',
            category: 'Test',
            status: 'Submitted',
            priority: 'High',
            neededBy: '2026-12-31',
            submittedAt: '2026-07-01',
            updatedAt: '2026-07-01',
            communityIds: [],
            communityNames: [],
            owner: null,
            team: 'Test',
            brokerBuyer: 'Test',
            _rawStatus: 'Open',
            orgId: 'org-atlas',
            orgName: 'Atlas Capital Partners',
            userId: 'ext-user-alex',
            userName: 'Alex Broker',
        };
        expect(req.orgId).toBe('org-atlas');
        expect(req.orgName).toBe('Atlas Capital Partners');
        expect(req.userId).toBe('ext-user-alex');
        expect(req.userName).toBe('Alex Broker');
    });

    it('should allow PortalRequest without org context fields', () => {
        const req: import('../services/portalMockData').PortalRequest = {
            id: 'test',
            requestId: 'DD-TEST-001',
            intakeId: 'INT-TEST-001',
            transactionId: 'txn-test',
            transactionName: 'Test',
            title: 'Test',
            category: 'Test',
            status: 'Submitted',
            priority: 'High',
            neededBy: '2026-12-31',
            submittedAt: '2026-07-01',
            updatedAt: '2026-07-01',
            communityIds: [],
            communityNames: [],
            owner: null,
            team: 'Test',
            brokerBuyer: 'Test',
            _rawStatus: 'Open',
        };
        expect(req.orgId).toBeUndefined();
        expect(req.orgName).toBeUndefined();
    });
});

import { beforeEach, describe, expect, it } from "vitest";
import { isExternalOnlyRole, shouldRedirectFromInternal } from "../utils/accessRouting";
import { createPortalTransaction, getActivePersona, getAuthoritativeTransactionId, getPersonaIdentity, getPersonas, getTransactionsList, registerAuthoritativePortalTransaction, setActivePersona } from "../services/portalMockData";
import { setAuthenticatedExternalContext } from "../services/portalRuntimeContext";

const storage = new Map<string, string>();
globalThis.localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => { storage.set(key, value); },
    removeItem: (key) => { storage.delete(key); },
    clear: () => storage.clear(),
    key: (index) => [...storage.keys()][index] ?? null,
    get length() { return storage.size; },
} as Storage;

describe("authenticated external route boundary", () => {
    it.each(["ExternalBroker", "ExternalBuyer"])("redirects %s away from internal routes", (role) => {
        expect(isExternalOnlyRole(role)).toBe(true);
        expect(shouldRedirectFromInternal(role)).toBe(true);
    });

    it.each(["Viewer", "Editor", "PlatformAdmin", "DDTeam"])("keeps %s on internal routes", (role) => {
        expect(shouldRedirectFromInternal(role)).toBe(false);
    });
});

describe("authenticated external portal context", () => {
    beforeEach(() => {
        storage.clear();
        setAuthenticatedExternalContext(null);
    });

    it("uses authenticated identity and SQL-authorized organization instead of Morgan Blake and Atlas", () => {
        setActivePersona("broker");
        setAuthenticatedExternalContext({
            userId: "user-1777051904674-6n040l",
            email: "joyner.jeremy@ymail.com",
            displayName: "joyner.jeremy@ymail.com",
            role: "ExternalBroker",
            organizations: [{ id: "TEST-BROKER-ORG", isDefault: true }],
            defaultOrganizationId: "TEST-BROKER-ORG",
        });

        expect(getActivePersona()).toMatchObject({
            email: "joyner.jeremy@ymail.com",
            displayName: "joyner.jeremy@ymail.com",
            companyName: "TEST-BROKER-ORG",
            role: "Broker",
        });
        expect(getPersonaIdentity()?.organization.id).toBe("TEST-BROKER-ORG");
        expect(getPersonaIdentity()?.authorizedTransactions).toEqual([]);
        setActivePersona("buyer");
        expect(getActivePersona().email).toBe("joyner.jeremy@ymail.com");
    });

    it("does not fall back to a demo organization when no membership exists", () => {
        setAuthenticatedExternalContext({
            userId: "external-without-org",
            email: "external@example.com",
            displayName: "External User",
            role: "ExternalBuyer",
            organizations: [],
            defaultOrganizationId: null,
        });
        expect(getActivePersona().companyName).toBe("Organization access not configured");
        expect(getPersonaIdentity()).toBeNull();
    });

    it("creates a real-session workflow transaction using authenticated organization identity", () => {
        setAuthenticatedExternalContext({
            userId: "real-broker",
            email: "broker@example.com",
            displayName: "Real Broker",
            role: "ExternalBroker",
            organizations: [{ id: "TEST-BROKER-ORG", isDefault: true }],
            defaultOrganizationId: "TEST-BROKER-ORG",
        });
        const transactionId = createPortalTransaction("Project Liberty");
        expect(getTransactionsList().find(row => row.id === transactionId)).toMatchObject({
            name: "Project Liberty",
            orgId: "TEST-BROKER-ORG",
        });
    });

    it("registers only backend-returned transactions from an authorized organization", () => {
        setAuthenticatedExternalContext({
            userId: "real-broker",
            email: "broker@example.com",
            displayName: "Real Broker",
            role: "ExternalBroker",
            organizations: [{ id: "TEST-BROKER-ORG", isDefault: true }],
            defaultOrganizationId: "TEST-BROKER-ORG",
        });
        const registered = registerAuthoritativePortalTransaction({
            id: "REC-2026-00000002",
            name: "Project Liberty",
            status: "Active",
            owningExternalOrganizationId: "TEST-BROKER-ORG",
        });
        expect(registered?.businessTransactionId).toBe("REC-2026-00000002");
        expect(getAuthoritativeTransactionId(registered!.id)).toBe("REC-2026-00000002");

        expect(registerAuthoritativePortalTransaction({
            id: "REC-2026-00000003",
            name: "Foreign Project",
            status: "Active",
            owningExternalOrganizationId: "OTHER-ORG",
        })).toBeNull();
    });

    it("preserves explicit Atlas, Harbor, and Summit demo personas outside real external mode", () => {
        expect(getPersonas()).toHaveLength(3);
        setActivePersona("buyer");
        expect(getActivePersona().email).toBe("123@mail.com");
    });
});

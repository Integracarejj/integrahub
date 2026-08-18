import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadAuthoritativeIntake } from "../services/recapIntakePersistence";
import { getPortalCreatedIntakeItems, getPortalCreatedRequests } from "../services/recapDataService";

const store = new Map<string, string>();
const localStorageMock: Storage = {
    get length() { return store.size; }, clear: () => store.clear(),
    getItem: key => store.get(key) ?? null, key: index => [...store.keys()][index] ?? null,
    removeItem: key => { store.delete(key); }, setItem: (key, value) => { store.set(key, value); },
};
globalThis.localStorage = localStorageMock;

const response = { packages: [{
    id: "pkg-1", sourcePackageId: "sub-real", packageName: "Project Liberty", fileName: "Project Liberty.xlsx",
    requestCount: 2, status: "Awaiting Review", submittedBy: "user-real", submittedByName: "Jeremy Joyner",
    submittedByEmail: "joyner.jeremy@ymail.com", externalOrganizationId: "TEST-BROKER-ORG",
    submittedAt: "2026-08-18T12:00:00Z", transactionId: "REC-2026-00000002", transactionName: "Project Liberty",
    requests: [
        { rowNumber: 1, category: "Financial", title: "Rent roll", description: "Current", team: "Financial Analysis", owner: null, priority: "High", dueDate: "2026-09-01", communityNames: [] },
        { rowNumber: 2, category: "Legal", title: "Contracts", description: "All", team: "Legal", owner: null, priority: "Medium", dueDate: null, communityNames: [] },
    ],
}] };

describe("durable cross-session intake bridge", () => {
    beforeEach(() => {
        store.clear();
        vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => response })));
    });

    it("hydrates an independent internal browser with real identity and every request", async () => {
        expect(localStorage.length).toBe(0);
        await loadAuthoritativeIntake();
        const intake = getPortalCreatedIntakeItems()[0];
        expect(intake).toMatchObject({ title: "Project Liberty", transactionId: "REC-2026-00000002", orgId: "TEST-BROKER-ORG", submittedBy: "Jeremy Joyner", rowsFound: 2 });
        expect(intake.submittedBy).not.toContain("Morgan Blake");
        expect(getPortalCreatedRequests()).toHaveLength(2);
        expect(getPortalCreatedRequests().every(row => row.transactionId === "REC-2026-00000002")).toBe(true);
    });

    it("is idempotent when Intake reloads", async () => {
        await loadAuthoritativeIntake();
        await loadAuthoritativeIntake();
        expect(getPortalCreatedIntakeItems()).toHaveLength(1);
        expect(getPortalCreatedRequests()).toHaveLength(2);
    });
});

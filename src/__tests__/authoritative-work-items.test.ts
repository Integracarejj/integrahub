import { beforeEach, describe, expect, it, vi } from "vitest";
import { acceptAuthoritativeWorkItem, admitAuthoritativeRequests, assignAuthoritativeWorkItem, AuthoritativeWorkItemVersionError, getCachedAuthoritativeWorkItems, loadAuthoritativeWorkItems, markAuthoritativeWorkItemNotMine, markAuthoritativeWorkItemReadyToPublish, returnAuthoritativeWorkItemFromDdReview, submitAuthoritativeWorkItemForDdReview } from "../services/recapWorkItemPersistence";
import { loadAuthoritativeIntake } from "../services/recapIntakePersistence";
import { getPortalCreatedRequests, getRequests, getWorkQueueTransactions } from "../services/recapDataService";
import type { RecapRequest } from "../services/recapDataService";

const storage = new Map<string, string>();
globalThis.localStorage = {
    getItem: key => storage.get(key) ?? null, setItem: (key, value) => { storage.set(key, value); }, removeItem: key => { storage.delete(key); },
    clear: () => storage.clear(), key: index => [...storage.keys()][index] ?? null, get length() { return storage.size; },
} as Storage;

const workItem = {
    workItemId: "work-1", intakeRequestId: "intake-1", requestNumber: "DD-2026-00000001",
    status: "Assigned", assignedUserId: "user-1", assignedUserName: "Internal User", assignedUserEmail: "internal@example.com",
    team: "Financial Analysis", priority: "High", dueDate: "2026-09-01", title: "Rent roll",
    description: "Current rent roll", category: "Financial", communities: ["Liberty"], needsReassignment: false,
    misassignedReason: null, packageId: "pkg-1", sourcePackageId: "sub-1", packageName: "Liberty",
    originalFileName: "Liberty.xlsx", externalOrganizationId: "TEST-BROKER-ORG",
    businessTransactionId: "REC-2026-00000004", transactionName: "Project Liberty",
    admittedAt: "2026-08-19T12:00:00Z", assignedAt: "2026-08-19T13:00:00Z", acceptedAt: null,
    updatedAt: "2026-08-19T13:00:00Z", version: "0x0000000000000001",
    capabilities: { canAssign: false, canReassign: false, canAccept: true, canComplete: false },
};

describe("authoritative work item runtime", () => {
    beforeEach(() => { vi.restoreAllMocks(); storage.clear(); });

    it("projects backend identity and explicit authoritative origin without localStorage", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ workItems: [workItem], assignees: [] }) })));
        await loadAuthoritativeWorkItems();
        expect(getCachedAuthoritativeWorkItems()[0]).toMatchObject({
            id: "work-1", workItemId: "work-1", intakeRequestId: "intake-1",
            requestId: "DD-2026-00000001", origin: "authoritative", assignedUserId: "user-1",
            capabilities: { canAssign: false, canReassign: false, canAccept: true },
        });
    });

    it("admission sends durable IntakeRequest IDs and a whitelisted reviewed snapshot", async () => {
        const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ workItems: [workItem] }) }));
        vi.stubGlobal("fetch", fetchMock);
        const request = { intakeRequestId: "intake-1", title: "Rent roll", description: "Reviewed", category: "Financial", team: "Finance", priority: "High", dueDate: "2026-09-01", communityNames: ["Liberty"] } as RecapRequest;
        await admitAuthoritativeRequests([request]);
        const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
        const body = JSON.parse(String(call[1].body));
        expect(body.intakeRequestIds).toEqual(["intake-1"]);
        expect(body.reviewedItems[0]).not.toHaveProperty("transactionId");
    });

    it("assignment targets an internal Users.id through the backend", async () => {
        const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ workItem }) }));
        vi.stubGlobal("fetch", fetchMock);
        await assignAuthoritativeWorkItem("work-1", "user-1");
        const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
        expect(call[0]).toContain("/work-1/assign");
        expect(JSON.parse(String(call[1].body))).toEqual({ assignedUserId: "user-1", expectedVersion: "0x0000000000000001" });
    });

    it("fails closed and refreshes when the API projection lacks a canonical rowversion", async () => {
        const malformed = { ...workItem, version: { type: "Buffer", data: [0, 0, 0, 0, 0, 0, 0, 1] } };
        const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ workItems: [malformed], assignees: [] }) }));
        vi.stubGlobal("fetch", fetchMock);
        await loadAuthoritativeWorkItems();
        await expect(assignAuthoritativeWorkItem("work-1", "user-1")).rejects.toBeInstanceOf(AuthoritativeWorkItemVersionError);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        const calls = fetchMock.mock.calls as unknown as [string, RequestInit | undefined][];
        expect(calls.every(call => !call[1] || call[1].method !== "POST")).toBe(true);
    });

    it("sends the required rowversion for every existing authoritative mutation", async () => {
        const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => ({
            ok: true,
            json: async () => url.endsWith("/work-items") ? { workItems: [workItem], assignees: [] } : { workItem },
        }));
        vi.stubGlobal("fetch", fetchMock);
        await loadAuthoritativeWorkItems();
        await assignAuthoritativeWorkItem("work-1", "user-1");
        await acceptAuthoritativeWorkItem("work-1");
        await markAuthoritativeWorkItemNotMine("work-1", "Wrong specialty");
        await submitAuthoritativeWorkItemForDdReview("work-1");
        await returnAuthoritativeWorkItemFromDdReview("work-1", "More work needed");
        await markAuthoritativeWorkItemReadyToPublish("work-1");

        for (const call of fetchMock.mock.calls.slice(1)) {
            const body = JSON.parse(String(call[1]?.body));
            expect(body.expectedVersion).toBe(workItem.version);
        }
    });

    it("repairs a stale browser intake projection with SQL identity before admission", async () => {
        storage.set("integrasource.recap.demo.portalRequests", JSON.stringify([{ id: "intake-request-pkg-1-1", requestId: "DD-sub-old-1", title: "Rent roll", transactionId: "REC-2026-00000004", _publishedAt: "2026-08-19" }]));
        vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ packages: [{
            id: "pkg-1", sourcePackageId: "sub-old", packageName: "Liberty", fileName: "Liberty.xlsx", requestCount: 1,
            status: "Awaiting Review", submittedBy: "broker-1", submittedByName: "Broker", externalOrganizationId: "TEST-BROKER-ORG",
            submittedAt: "2026-08-19T12:00:00Z", transactionId: "REC-2026-00000004", transactionName: "Project Liberty",
            requests: [{ intakeRequestId: "intake-1", rowNumber: 1, category: "Financial", title: "Rent roll", description: "Current", team: "Finance", owner: null, priority: "High", communityNames: ["Liberty"] }],
        }] }) })));

        await loadAuthoritativeIntake();

        expect(getPortalCreatedRequests()[0]).toMatchObject({ origin: "authoritative", intakeRequestId: "intake-1", _publishedAt: null });
    });

    it("hydrates a fresh storage session and exposes its authoritative transaction", async () => {
        storage.set("integrasource.recap.demo.portalRequests", JSON.stringify([{ id: "demo-row", transactionId: "demo-txn", transactionName: "Demo" }]));
        vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ workItems: [workItem], assignees: [] }) })));
        await loadAuthoritativeWorkItems();
        const requests = getRequests();
        const transactions = getWorkQueueTransactions(requests);
        expect(requests).toEqual(expect.arrayContaining([expect.objectContaining({ requestId: "DD-2026-00000001" })]));
        expect(transactions).toEqual(expect.arrayContaining([expect.objectContaining({ id: "REC-2026-00000004", name: "Project Liberty" })]));
    });
});

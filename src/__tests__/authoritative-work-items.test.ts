import { beforeEach, describe, expect, it, vi } from "vitest";
import { admitAuthoritativeRequests, assignAuthoritativeWorkItem, getCachedAuthoritativeWorkItems, loadAuthoritativeWorkItems } from "../services/recapWorkItemPersistence";
import type { RecapRequest } from "../services/recapDataService";

globalThis.localStorage = {
    getItem: () => null, setItem: () => undefined, removeItem: () => undefined,
    clear: () => undefined, key: () => null, length: 0,
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
    capabilities: { canAssign: true, canAccept: true, canComplete: false },
};

describe("authoritative work item runtime", () => {
    beforeEach(() => vi.restoreAllMocks());

    it("projects backend identity and explicit authoritative origin without localStorage", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ workItems: [workItem], assignees: [] }) })));
        await loadAuthoritativeWorkItems();
        expect(getCachedAuthoritativeWorkItems()[0]).toMatchObject({
            id: "work-1", workItemId: "work-1", intakeRequestId: "intake-1",
            requestId: "DD-2026-00000001", origin: "authoritative", assignedUserId: "user-1",
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
        expect(JSON.parse(String(call[1].body))).toEqual({ assignedUserId: "user-1" });
    });
});

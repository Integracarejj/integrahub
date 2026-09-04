import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    AuthoritativeWorkItemConflictError, addAuthoritativeWorkNote, approveAuthoritativeDisposition,
    blockAuthoritativeWorkItem, getAuthoritativeWorkItem, loadAuthoritativeWorkItemEvents,
    loadAuthoritativeWorkItems, loadAuthoritativeWorkNotes, proposeAuthoritativeDisposition,
    requestAuthoritativeClarification, resolveAuthoritativeClarification, returnAuthoritativeDisposition,
    unblockAuthoritativeWorkItem, updateAuthoritativeResponse,
} from "../services/recapWorkItemPersistence";

const storage = new Map<string, string>();
const localStorageMock = {
    getItem: vi.fn((key: string) => storage.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { storage.set(key, value); }),
    removeItem: vi.fn((key: string) => { storage.delete(key); }),
    clear: vi.fn(() => storage.clear()), key: vi.fn(() => null), get length() { return storage.size; },
} as unknown as Storage;
globalThis.localStorage = localStorageMock;

const base = {
    workItemId: "work-1", intakeRequestId: "intake-1", requestNumber: "DD-1", status: "In Progress",
    assignedUserId: "owner", assignedUserName: "Owner", assignedUserEmail: "owner@example.com",
    team: "DD", priority: "High", dueDate: null, title: "Rent roll", description: "Review",
    category: "Financial", communities: [], needsReassignment: false, misassignedReason: null,
    packageId: "pkg", sourcePackageId: "source", packageName: "Package", originalFileName: "source.xlsx",
    externalOrganizationId: "org", businessTransactionId: "txn", transactionName: "Transaction",
    admittedAt: "2026-09-01T00:00:00Z", assignedAt: "2026-09-01T01:00:00Z", acceptedAt: "2026-09-01T02:00:00Z",
    updatedAt: "2026-09-01T02:00:00Z", version: "0x0000000000000001", responseContent: null,
    responseUpdatedAt: null, responseUpdatedByUserId: null, activeReasonType: null, activeReason: null,
    proposedDisposition: null, dispositionReason: null, dispositionProposedByUserId: null,
    dispositionProposedAt: null, capabilities: { canUpdateResponse: true },
};

function ok(payload: unknown) { return { ok: true, status: 200, json: async () => payload }; }

describe("Big Rock 2B authoritative browser boundary", () => {
    beforeEach(() => { vi.restoreAllMocks(); storage.clear(); vi.mocked(localStorageMock.getItem).mockClear(); });

    it("projects every internal lifecycle state and Big Rock 2A field without localStorage", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => ok({ workItems: [{ ...base, status: "Blocked", activeReasonType: "Blocker", activeReason: "Waiting", responseContent: "Saved", responseUpdatedAt: "2026-09-02T00:00:00Z", responseUpdatedByUserId: "owner", proposedDisposition: "Duplicate", dispositionReason: "Same", dispositionProposedByUserId: "owner", dispositionProposedAt: "2026-09-02T01:00:00Z" }], assignees: [] })));
        const [item] = await loadAuthoritativeWorkItems();
        expect(item).toMatchObject({ status: "Blocked", authoritativeResponse: "Saved", authoritativeActiveReason: "Waiting", authoritativeProposedDisposition: "Duplicate", authoritativeDispositionProposedByUserId: "owner" });
        expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });

    it("saves response with expectedVersion and advances the cached authoritative version", async () => {
        const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => url.endsWith("/work-items")
            ? ok({ workItems: [base], assignees: [] })
            : ok({ workItem: { ...base, responseContent: "Authoritative answer", version: "0x0000000000000002" } }));
        vi.stubGlobal("fetch", fetchMock);
        await loadAuthoritativeWorkItems();
        await updateAuthoritativeResponse("work-1", "Authoritative answer");
        const body = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
        expect(body).toEqual({ responseContent: "Authoritative answer", expectedVersion: base.version });
        expect(getAuthoritativeWorkItem("work-1")?.authoritativeVersion).toBe("0x0000000000000002");
    });

    it("uses backend transitions for blockers, clarification, and governed dispositions", async () => {
        const endpoints: string[] = [];
        vi.stubGlobal("fetch", vi.fn(async (url: string) => {
            endpoints.push(url);
            if (url.endsWith("/work-items")) return ok({ workItems: [base], assignees: [] });
            return ok({ workItem: { ...base, version: "0x0000000000000002" } });
        }));
        await loadAuthoritativeWorkItems();
        await blockAuthoritativeWorkItem("work-1", "Dependency");
        await unblockAuthoritativeWorkItem("work-1", "Resolved");
        await requestAuthoritativeClarification("work-1", "Need detail");
        await resolveAuthoritativeClarification("work-1", "Guidance");
        await proposeAuthoritativeDisposition("work-1", "Not Applicable", "Outside scope");
        await approveAuthoritativeDisposition("work-1");
        await returnAuthoritativeDisposition("work-1", "Continue work");
        expect(endpoints).toEqual(expect.arrayContaining([
            expect.stringContaining("/block"), expect.stringContaining("/unblock"),
            expect.stringContaining("/clarification"), expect.stringContaining("/clarification/resolve"),
            expect.stringContaining("/disposition"), expect.stringContaining("/disposition/approve"),
            expect.stringContaining("/disposition/return"),
        ]));
    });

    it("loads append-only notes and authoritative event history", async () => {
        vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
            if (url.endsWith("/notes") && init?.method === "POST") return ok({ note: { id: "n2", noteText: "New context" } });
            if (url.endsWith("/notes")) return ok({ notes: [{ id: "n1", noteText: "Context" }] });
            if (url.endsWith("/events")) return ok({ events: [{ id: "e1", eventType: "Accepted" }] });
            return ok({});
        }));
        expect(await loadAuthoritativeWorkNotes("work-1")).toHaveLength(1);
        expect(await loadAuthoritativeWorkItemEvents("work-1")).toHaveLength(1);
        expect((await addAuthoritativeWorkNote("work-1", "New context")).id).toBe("n2");
    });

    it("refreshes authoritative state after HTTP 409 and does not retry the mutation", async () => {
        let calls = 0;
        const fetchMock = vi.fn(async () => {
            calls += 1;
            if (calls === 1) return ok({ workItems: [base], assignees: [] });
            if (calls === 2) return { ok: false, status: 409, json: async () => ({ error: "stale" }) };
            return ok({ workItems: [{ ...base, version: "0x0000000000000009", responseContent: "Someone else's update" }], assignees: [] });
        });
        vi.stubGlobal("fetch", fetchMock);
        await loadAuthoritativeWorkItems();
        await expect(updateAuthoritativeResponse("work-1", "My unsaved draft")).rejects.toBeInstanceOf(AuthoritativeWorkItemConflictError);
        expect(fetchMock).toHaveBeenCalledTimes(3);
        expect(getAuthoritativeWorkItem("work-1")?.authoritativeVersion).toBe("0x0000000000000009");
    });
});

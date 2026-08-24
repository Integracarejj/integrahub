import { describe, expect, it } from "vitest";
import { canAcceptAuthoritativeWorkItem, canMarkAuthoritativeWorkItemReadyToPublish, canReturnAuthoritativeWorkItemFromDdReview, canSubmitAuthoritativeWorkItemForDdReview, getMyWorkRequests, getPresentedRecapRequests, isRealInternalRecapMode } from "../services/recapPresentation";
import type { CurrentUserResponse } from "../hooks/useCurrentUser";
import type { RecapRequest } from "../services/recapDataService";

const identity = {
    isAuthenticated: true, hasAppAccess: true, isPortalUser: false,
    userRecord: { id: "test-jeremy-001", displayName: "Jeremy Joyner" },
} as CurrentUserResponse;
const authoritative = { id: "work-1", workItemId: "work-1", origin: "authoritative", assignedUserId: "test-jeremy-001" } as RecapRequest;
const otherAuthoritative = { id: "work-2", workItemId: "work-2", origin: "authoritative", assignedUserId: "another-user" } as RecapRequest;
const intakeOnlyProjection = { id: "intake-1", intakeRequestId: "intake-1", origin: "authoritative" } as RecapRequest;
const sarahDemo = { id: "demo-1", origin: "demo", owner: "Sarah Chen", assignedTo: "Sarah Chen" } as RecapRequest;

describe("Recap authenticated and demo presentation boundary", () => {
    it("uses authenticated identity and excludes browser legacy rows in real internal mode", () => {
        const realMode = isRealInternalRecapMode(identity, false);
        const presented = getPresentedRecapRequests([sarahDemo, intakeOnlyProjection, authoritative, otherAuthoritative], realMode);
        expect(presented.map(row => row.id)).toEqual(["work-1", "work-2"]);
        expect(getMyWorkRequests(presented, "test-jeremy-001", "Sarah Chen", realMode)).toEqual([authoritative]);
    });

    it("a stored demo persona cannot redefine authenticated My Work", () => {
        expect(getMyWorkRequests([sarahDemo, authoritative], "test-jeremy-001", "Sarah Chen", true)).toEqual([authoritative]);
    });

    it("preserves persona-based legacy filtering in explicit demo mode", () => {
        const demoMode = isRealInternalRecapMode(identity, true);
        expect(demoMode).toBe(false);
        expect(getPresentedRecapRequests([sarahDemo, authoritative], demoMode)).toHaveLength(2);
        expect(getMyWorkRequests([sarahDemo, authoritative], "test-jeremy-001", "Sarah Chen", demoMode)).toEqual([sarahDemo, authoritative]);
    });

    it("offers authoritative acceptance only to the current assigned internal user", () => {
        const assigned = { ...authoritative, status: "Assigned" } as RecapRequest;
        expect(canAcceptAuthoritativeWorkItem(assigned, "test-jeremy-001")).toBe(true);
        expect(canAcceptAuthoritativeWorkItem(assigned, "another-user")).toBe(false);
        expect(canAcceptAuthoritativeWorkItem({ ...assigned, assignedUserId: undefined }, "test-jeremy-001")).toBe(false);
        expect(canAcceptAuthoritativeWorkItem({ ...assigned, status: "In Progress" }, "test-jeremy-001")).toBe(false);
        expect(canAcceptAuthoritativeWorkItem({ ...sarahDemo, status: "Assigned" }, "test-jeremy-001")).toBe(false);
    });

    it.each([
        ["Queued", {}, false, false, false],
        ["Assigned", { canAccept: true }, false, false, false],
        ["In Progress", { canSubmitForDdReview: true }, true, false, false],
        ["Needs DD Review", { canReturnFromDdReview: true, canMarkReadyToPublish: true }, false, true, true],
        ["Ready to Publish", { canPublish: false }, false, false, false],
    ])("protects the authoritative action matrix for %s", (status, capabilities, submit, returnFromReview, ready) => {
        const request = { ...authoritative, status, capabilities } as RecapRequest;
        expect(canSubmitAuthoritativeWorkItemForDdReview(request, "test-jeremy-001")).toBe(submit);
        expect(canReturnAuthoritativeWorkItemFromDdReview(request)).toBe(returnFromReview);
        expect(canMarkAuthoritativeWorkItemReadyToPublish(request)).toBe(ready);
    });

    it("never exposes durable transitions to demo rows or a non-owner", () => {
        const inProgress = { ...authoritative, status: "In Progress", capabilities: { canSubmitForDdReview: true } } as RecapRequest;
        expect(canSubmitAuthoritativeWorkItemForDdReview(inProgress, "another-user")).toBe(false);
        expect(canSubmitAuthoritativeWorkItemForDdReview({ ...inProgress, origin: "demo" }, "test-jeremy-001")).toBe(false);
    });
});

import { describe, expect, it } from "vitest";
import { getMyWorkRequests, getPresentedRecapRequests, isRealInternalRecapMode } from "../services/recapPresentation";
import type { CurrentUserResponse } from "../hooks/useCurrentUser";
import type { RecapRequest } from "../services/recapDataService";

const identity = {
    isAuthenticated: true, hasAppAccess: true, isPortalUser: false,
    userRecord: { id: "test-jeremy-001", displayName: "Jeremy Joyner" },
} as CurrentUserResponse;
const authoritative = { id: "work-1", origin: "authoritative", assignedUserId: "test-jeremy-001" } as RecapRequest;
const otherAuthoritative = { id: "work-2", origin: "authoritative", assignedUserId: "another-user" } as RecapRequest;
const sarahDemo = { id: "demo-1", origin: "demo", owner: "Sarah Chen", assignedTo: "Sarah Chen" } as RecapRequest;

describe("Recap authenticated and demo presentation boundary", () => {
    it("uses authenticated identity and excludes browser legacy rows in real internal mode", () => {
        const realMode = isRealInternalRecapMode(identity, false);
        const presented = getPresentedRecapRequests([sarahDemo, authoritative, otherAuthoritative], realMode);
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
});

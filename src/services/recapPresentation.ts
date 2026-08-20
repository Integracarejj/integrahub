import type { CurrentUserResponse } from "../hooks/useCurrentUser";
import type { RecapRequest } from "./recapMockData";

export function isRealInternalRecapMode(identity: CurrentUserResponse | null, demoActive: boolean): boolean {
    return !!identity?.isAuthenticated && !!identity.hasAppAccess && !identity.isPortalUser && !demoActive;
}

export function getPresentedRecapRequests(requests: RecapRequest[], realInternalMode: boolean): RecapRequest[] {
    return realInternalMode ? requests.filter(request => request.origin === "authoritative" && !!request.workItemId) : requests;
}

export function getMyWorkRequests(requests: RecapRequest[], userId: string | undefined, demoUserName: string, realInternalMode: boolean): RecapRequest[] {
    return requests.filter(request => request.origin === "authoritative"
        ? !!userId && request.assignedUserId === userId
        : !realInternalMode && (request.owner === demoUserName || request.assignedTo === demoUserName));
}

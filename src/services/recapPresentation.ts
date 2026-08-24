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

export function canAcceptAuthoritativeWorkItem(request: RecapRequest, userId: string | undefined): boolean {
    return request.origin === "authoritative"
        && request.status === "Assigned"
        && !!userId
        && request.assignedUserId === userId;
}

export function canSubmitAuthoritativeWorkItemForDdReview(request: RecapRequest, userId: string | undefined): boolean {
    return request.origin === "authoritative"
        && request.status === "In Progress"
        && !!userId
        && request.assignedUserId === userId
        && request.capabilities?.canSubmitForDdReview === true;
}

export function canReturnAuthoritativeWorkItemFromDdReview(request: RecapRequest): boolean {
    return request.origin === "authoritative" && request.status === "Needs DD Review"
        && request.capabilities?.canReturnFromDdReview === true;
}

export function canMarkAuthoritativeWorkItemReadyToPublish(request: RecapRequest): boolean {
    return request.origin === "authoritative" && request.status === "Needs DD Review"
        && request.capabilities?.canMarkReadyToPublish === true;
}

export function canUploadAuthoritativeArtifact(request: RecapRequest, userId: string | undefined): boolean {
    return request.origin === "authoritative" && request.status === "In Progress" && !!userId
        && request.assignedUserId === userId && request.capabilities?.canUploadArtifact === true;
}

export function canViewAuthoritativeArtifacts(request: RecapRequest): boolean {
    return request.origin === "authoritative" && request.capabilities?.canViewArtifacts === true;
}

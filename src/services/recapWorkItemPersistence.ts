import { getAuthHeaders } from "../utils/apiFetch";
import type { RecapRequest } from "./recapMockData";

export interface AuthoritativeAssignee { id: string; displayName: string | null; email: string | null; role: string }
export interface WorkItemResponse {
    workItemId: string; intakeRequestId: string; requestNumber: string;
    status: "Queued" | "Assigned" | "In Progress" | "Clarification Needed" | "Blocked" | "Needs DD Review" | "Ready to Publish" | "Not Applicable" | "Duplicate"; assignedUserId: string | null;
    assignedUserName: string | null; assignedUserEmail: string | null;
    team: string; priority: RecapRequest["priority"]; dueDate: string | null;
    title: string; description: string; category: string; communities: string[];
    needsReassignment: boolean; misassignedReason: string | null;
    packageId: string; sourcePackageId: string; packageName: string; originalFileName: string;
    externalOrganizationId: string; businessTransactionId: string; transactionName: string;
    admittedAt: string; assignedAt: string | null; acceptedAt: string | null;
    updatedAt: string; version: string;
    responseContent?: string | null; responseUpdatedAt?: string | null; responseUpdatedByUserId?: string | null;
    activeReasonType?: "Clarification" | "Blocker" | null; activeReason?: string | null;
    proposedDisposition?: "Not Applicable" | "Duplicate" | null; dispositionReason?: string | null;
    dispositionProposedByUserId?: string | null; dispositionProposedAt?: string | null;
    capabilities: Record<string, boolean>;
}

export interface AuthoritativeWorkItemEvent {
    id: string; eventType: string; actorUserId: string; actorName: string | null;
    occurredAt: string; priorStatus: string | null; resultingStatus: string | null;
    priorAssignedUserId: string | null; resultingAssignedUserId: string | null;
    details: Record<string, unknown> | null;
}

export interface AuthoritativeWorkNote {
    id: string; authorUserId: string; authorName: string | null;
    noteType: "Work Note" | "Clarification" | "Blocker" | "Disposition";
    noteText: string; createdAt: string;
}

export class AuthoritativeWorkItemConflictError extends Error {
    constructor() { super("This request changed since you opened it. We refreshed the latest version. Please review the updated request and try again."); }
}

let cachedRequests: RecapRequest[] = [];
let cachedAssignees: AuthoritativeAssignee[] = [];

function project(item: WorkItemResponse): RecapRequest {
    return {
        id: item.workItemId, requestId: item.requestNumber, intakeId: item.intakeRequestId,
        transactionId: item.businessTransactionId, transactionName: item.transactionName,
        brokerBuyer: item.externalOrganizationId, communityIds: [], communityNames: item.communities,
        category: item.category, title: item.title, description: item.description,
        owner: item.assignedUserName || item.assignedUserEmail, assignedTo: item.assignedUserName || item.assignedUserEmail,
        team: item.team || "", status: item.status,
        priority: item.priority, dueDate: item.dueDate ? String(item.dueDate).slice(0, 10) : "",
        lastUpdated: String(item.acceptedAt || item.assignedAt || item.admittedAt).slice(0, 10),
        externalVisible: false, submittedBy: item.externalOrganizationId, source: "External",
        createdDate: String(item.admittedAt).slice(0, 10), orgId: item.externalOrganizationId,
        orgName: item.externalOrganizationId, _publishedAt: String(item.admittedAt).slice(0, 10),
        _convertedAt: item.admittedAt, _createdFromReview: true, _externalStatus: "Internal Only",
        _sourceIntakeId: item.intakeRequestId, _sourcePackageId: item.packageId,
        _sourcePackageName: item.packageName, _sourceFileName: item.originalFileName,
        _needsReassignment: item.needsReassignment, _misassignedReason: item.misassignedReason,
        origin: "authoritative", workItemId: item.workItemId, intakeRequestId: item.intakeRequestId,
        assignedUserId: item.assignedUserId, capabilities: item.capabilities,
        authoritativeVersion: item.version, authoritativeResponse: item.responseContent || null,
        authoritativeResponseUpdatedAt: item.responseUpdatedAt || null,
        authoritativeResponseUpdatedByUserId: item.responseUpdatedByUserId || null,
        authoritativeActiveReasonType: item.activeReasonType || null, authoritativeActiveReason: item.activeReason || null,
        authoritativeProposedDisposition: item.proposedDisposition || null, authoritativeDispositionReason: item.dispositionReason || null,
        authoritativeDispositionProposedByUserId: item.dispositionProposedByUserId || null,
        authoritativeDispositionProposedAt: item.dispositionProposedAt || null,
    };
}

async function api(path: string, init?: RequestInit) {
    const response = await fetch(`/api/recapitalization/work-items${path}`, {
        credentials: "include", ...init,
        headers: { "Content-Type": "application/json", ...getAuthHeaders(), ...(init?.headers || {}) },
    });
    if (!response.ok) {
        if (response.status === 409) throw new AuthoritativeWorkItemConflictError();
        throw new Error((await response.json().catch(() => null))?.error || "Work item operation failed");
    }
    return response.json();
}

function upsert(item: WorkItemResponse) {
    const projected = project(item);
    cachedRequests = [...cachedRequests.filter(row => row.id !== projected.id), projected];
    return projected;
}

export async function loadAuthoritativeWorkItems(): Promise<RecapRequest[]> {
    const data = await api("");
    cachedRequests = (data.workItems || []).map(project);
    cachedAssignees = data.assignees || [];
    return cachedRequests;
}

export function getCachedAuthoritativeWorkItems() { return cachedRequests; }
export function getAuthoritativeAssignees() { return cachedAssignees; }
export function getAuthoritativeWorkItem(id: string) { return cachedRequests.find(row => row.id === id || row.requestId === id || row.intakeRequestId === id); }
export function isIntakeRequestAdmitted(id?: string) { return !!id && cachedRequests.some(row => row.intakeRequestId === id); }
function expectedVersion(id: string) { return getAuthoritativeWorkItem(id)?.authoritativeVersion || null; }

async function mutate(id: string, path: string, body: Record<string, unknown>) {
    try {
        const data = await api(`/${id}${path}`, { method: "POST", body: JSON.stringify({ ...body, expectedVersion: expectedVersion(id) }) });
        return upsert(data.workItem);
    } catch (error) {
        if (error instanceof AuthoritativeWorkItemConflictError) await loadAuthoritativeWorkItems();
        throw error;
    }
}

export async function admitAuthoritativeRequests(requests: RecapRequest[]) {
    const eligible = requests.filter(row => row.intakeRequestId);
    const data = await api("/admit", { method: "POST", body: JSON.stringify({
        intakeRequestIds: eligible.map(row => row.intakeRequestId),
        reviewedItems: eligible.map(row => ({ intakeRequestId: row.intakeRequestId, title: row.title,
            description: row.description, category: row.category, team: row.team, priority: row.priority,
            dueDate: row.dueDate || null, communityNames: row.communityNames })),
    }) });
    (data.workItems || []).forEach(upsert);
    return data.workItems?.length || 0;
}

export async function assignAuthoritativeWorkItem(id: string, assignedUserId: string) {
    return mutate(id, "/assign", { assignedUserId });
}
export function acceptAuthoritativeWorkItem(id: string) { return mutate(id, "/accept", {}); }
export function submitAuthoritativeWorkItemForDdReview(id: string) { return mutate(id, "/submit-dd-review", {}); }
export function returnAuthoritativeWorkItemFromDdReview(id: string, reason?: string) { return mutate(id, "/return-from-dd-review", { reason }); }
export function markAuthoritativeWorkItemReadyToPublish(id: string) { return mutate(id, "/ready-to-publish", {}); }
export function markAuthoritativeWorkItemNotMine(id: string, reason: string) { return mutate(id, "/not-mine", { reason }); }
export function updateAuthoritativeResponse(id: string, responseContent: string) { return mutate(id, "/response", { responseContent }); }
export function requestAuthoritativeClarification(id: string, reason: string) { return mutate(id, "/clarification", { reason }); }
export function resolveAuthoritativeClarification(id: string, resolution: string) { return mutate(id, "/clarification/resolve", { resolution }); }
export function blockAuthoritativeWorkItem(id: string, reason: string) { return mutate(id, "/block", { reason }); }
export function unblockAuthoritativeWorkItem(id: string, resolution: string) { return mutate(id, "/unblock", { resolution }); }
export function proposeAuthoritativeDisposition(id: string, disposition: "Not Applicable" | "Duplicate", reason: string) { return mutate(id, "/disposition", { disposition, reason }); }
export function approveAuthoritativeDisposition(id: string) { return mutate(id, "/disposition/approve", {}); }
export function returnAuthoritativeDisposition(id: string, reason: string) { return mutate(id, "/disposition/return", { reason }); }
export async function loadAuthoritativeWorkItemEvents(id: string): Promise<AuthoritativeWorkItemEvent[]> { return (await api(`/${id}/events`)).events || []; }
export async function loadAuthoritativeWorkNotes(id: string): Promise<AuthoritativeWorkNote[]> { return (await api(`/${id}/notes`)).notes || []; }
export async function addAuthoritativeWorkNote(id: string, noteText: string, noteType: AuthoritativeWorkNote["noteType"] = "Work Note") {
    const data = await api(`/${id}/notes`, { method: "POST", body: JSON.stringify({ noteText, noteType }) });
    return data.note as AuthoritativeWorkNote;
}

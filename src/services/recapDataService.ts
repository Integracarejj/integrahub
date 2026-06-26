import { isDemoLoaded } from "./recapDemoData";
import * as Demo from "./recapDemoData";
import * as Mock from "./recapMockData";
import type {
    RecapTransaction, RecapRequest, RecapIntakeItem,
    RecapDocument, RecapActivity, RecapTeamMember, RecapCategory, RecapDeliverable,
} from "./recapMockData";

export type {
    RecapTransaction, RecapRequest, RecapIntakeItem,
    RecapDocument, RecapActivity, RecapTeamMember, RecapCategory, RecapDeliverable,
};

export function getTransactions(): RecapTransaction[] {
    if (isDemoLoaded()) {
        const txn = Demo.getDemoTransaction();
        return txn ? [txn] : [];
    }
    return Mock.getTransactions();
}

export function getActiveTransactions(): RecapTransaction[] {
    return getTransactions().filter((t) => t.status === "Active");
}

export function getTransactionById(id: string): RecapTransaction | undefined {
    if (isDemoLoaded()) {
        const txn = Demo.getDemoTransaction();
        if (txn && txn.id === id) return txn;
        return;
    }
    return Mock.getTransactionById(id);
}

export function getRequests(): RecapRequest[] {
    if (isDemoLoaded()) return Demo.getDemoRequests();
    return Mock.getRequests();
}

export function getRequestsByTransaction(transactionId: string): RecapRequest[] {
    return getRequests().filter((r) => r.transactionId === transactionId);
}

export function getRequestById(id: string): RecapRequest | undefined {
    if (isDemoLoaded()) return Demo.getDemoRequestById(id);
    return Mock.getRequestById(id);
}

export function getIntakeItems(): RecapIntakeItem[] {
    const portalItems = getPortalCreatedIntakeItems();
    if (isDemoLoaded()) {
        const item = Demo.getDemoIntakeItem();
        return item ? [item, ...portalItems] : portalItems;
    }
    return [...Mock.getIntakeItems(), ...portalItems];
}

export function getIntakeItemsByType(type: RecapIntakeItem["type"]): RecapIntakeItem[] {
    return getIntakeItems().filter((i) => i.type === type);
}

export function getRequests(): RecapRequest[] {
    const portalReqs = getPortalCreatedRequests();
    if (isDemoLoaded()) {
        const demo = Demo.getDemoRequests();
        return [...demo, ...portalReqs];
    }
    return [...Mock.getRequests(), ...portalReqs];
}

export function getDocuments(): RecapDocument[] {
    if (isDemoLoaded()) return Demo.getDemoDocuments();
    return Mock.getDocuments();
}

export function getDocumentsByTransaction(transactionId: string): RecapDocument[] {
    return getDocuments().filter((d) => d.transactionId === transactionId);
}

export function getActivity(limit?: number): RecapActivity[] {
    if (isDemoLoaded()) return Demo.getDemoActivity(limit);
    return Mock.getActivity(limit);
}

export function getActivityByTransaction(transactionId: string): RecapActivity[] {
    if (isDemoLoaded()) {
        return Demo.getDemoActivity(999).filter((a) => a.transactionId === transactionId);
    }
    return Mock.getActivityByTransaction(transactionId);
}

export function getTeamMembers(): RecapTeamMember[] {
    return Mock.getTeamMembers();
}

export function getTeamMembersByTeam(team: string): RecapTeamMember[] {
    return Mock.getTeamMembersByTeam(team);
}

export function getCategories(): RecapCategory[] {
    return Mock.getCategories();
}

export function getTeams(): string[] {
    if (isDemoLoaded()) return Demo.getDemoTeams();
    return Mock.getTeams();
}

export function getTeamWorkload(): { team: string; total: number; activeLoad: number }[] {
    if (isDemoLoaded()) return Demo.getDemoWorkload();
    return Mock.getTeamWorkload();
}

export function getStatusCounts(): Record<string, number> {
    if (isDemoLoaded()) return Demo.getDemoStatusCounts();
    return Mock.getStatusCounts();
}

export function getDeliverables(): RecapDeliverable[] {
    return Mock.getDeliverables();
}

export function lookupWorkspaceItem(id: string): { type: "intake"; item: RecapIntakeItem; transaction: RecapTransaction } | { type: "request"; item: RecapRequest; transaction: RecapTransaction } | null {
    if (isDemoLoaded()) {
        const intake = Demo.getDemoIntakeItem();
        if (intake && (intake.id === id || intake.intakeId === id)) {
            const txn = Demo.getDemoTransaction();
            return { type: "intake", item: intake, transaction: txn! };
        }
        const request = Demo.getDemoRequestById(id);
        if (request) {
            const txn = Demo.getDemoTransaction();
            return { type: "request", item: request, transaction: txn! };
        }
    }
    const portalIntakes = getPortalCreatedIntakeItems();
    const foundPortal = portalIntakes.find(i => i.id === id || i.intakeId === id);
    if (foundPortal) {
        const txn = Demo.getDemoTransaction();
        return { type: "intake", item: foundPortal, transaction: txn || { id: "txn-portal", name: foundPortal.transactionName, description: "", status: "Active", sellerName: "", buyerName: "", brokerName: "", targetClose: "", totalRequests: 0, providedCount: 0, inProgressCount: 0, clarificationNeededCount: 0, overdueCount: 0, communities: [] } };
    }
    const portalReqs = getPortalCreatedRequests();
    const foundReq = portalReqs.find(r => r.id === id || r.intakeId === id);
    if (foundReq) {
        const txn = Demo.getDemoTransaction();
        return { type: "request", item: foundReq, transaction: txn || { id: "txn-portal", name: foundReq.transactionName, description: "", status: "Active", sellerName: "", buyerName: "", brokerName: "", targetClose: "", totalRequests: 0, providedCount: 0, inProgressCount: 0, clarificationNeededCount: 0, overdueCount: 0, communities: [] } };
    }
    if (isDemoLoaded()) return null;
    return Mock.lookupWorkspaceItem(id);
}

export function getOverrideRequests(): RecapRequest[] {
    if (isDemoLoaded()) return Demo.getDemoOverrideRequests();
    return Mock.getOverrideRequests();
}

export function updateRequestStatus(id: string, status: RecapRequest["status"]): RecapRequest | undefined {
    if (isDemoLoaded()) return Demo.updateDemoRequest(id, { status });
    return Mock.updateRequestStatus(id, status);
}

export function updateRequestOwner(id: string, owner: string | null): RecapRequest | undefined {
    if (isDemoLoaded()) return Demo.updateDemoRequest(id, { owner, assignedTo: owner });
    return Mock.updateRequestOwner(id, owner);
}

export function updateRequestPriority(id: string, priority: RecapRequest["priority"]): RecapRequest | undefined {
    if (isDemoLoaded()) return Demo.updateDemoRequest(id, { priority });
    return Mock.updateRequestPriority(id, priority);
}

export function updateRequestDueDate(id: string, dueDate: string): RecapRequest | undefined {
    if (isDemoLoaded()) return Demo.updateDemoRequest(id, { dueDate });
    return Mock.updateRequestDueDate(id, dueDate);
}

export function updateRequestTeam(id: string, team: string): RecapRequest | undefined {
    if (isDemoLoaded()) return Demo.updateDemoRequest(id, { team });
    return Mock.updateRequestTeam(id, team);
}

export function toggleExternalVisibility(id: string): RecapRequest | undefined {
    if (isDemoLoaded()) {
        const req = Demo.getDemoRequestById(id);
        if (req) return Demo.updateDemoRequest(id, { externalVisible: !req.externalVisible });
        return;
    }
    return Mock.toggleExternalVisibility(id);
}

export function getMyWork(userName: string): {
    assignedToMe: RecapRequest[];
    assignedToMyTeam: RecapRequest[];
    dueThisWeek: RecapRequest[];
    overdue: RecapRequest[];
    needsMyResponse: RecapRequest[];
    waitingOnExternal: RecapRequest[];
} {
    if (isDemoLoaded()) {
        const demo = Demo.getDemoMyWork(userName);
        const user = Mock.getTeamMembers().find((m) => m.name === userName);
        const myTeam = user?.team || "";
        const all = Demo.getDemoRequests();
        return {
            assignedToMe: demo.assignedToMe,
            assignedToMyTeam: all.filter((r) => r.team === myTeam && r.owner !== userName),
            dueThisWeek: demo.dueThisWeek,
            overdue: demo.overdue,
            needsMyResponse: demo.needsMyResponse,
            waitingOnExternal: all.filter((r) => r.status === "Clarification Needed"),
        };
    }
    return Mock.getMyWork(userName);
}

export function bulkUpdateDemoRequests(ids: string[], patch: Partial<RecapRequest>): number {
    if (isDemoLoaded()) return Demo.bulkUpdateDemoRequests(ids, patch);
    return 0;
}

export function getDemoEngineSummary() {
    return Demo.getDemoEngineSummary();
}

export function getDemoReports() {
    return Demo.getDemoReports();
}

export function publishIntake(): void {
    if (isDemoLoaded()) Demo.publishIntake();
}

export function publishSelectedRequests(ids: string[]): void {
    if (isDemoLoaded()) Demo.publishSelectedRequests(ids);
}

export function initDemo(): void {
    Demo.initDemo();
}

export function resetDemo(): void {
    Demo.resetDemo();
}

export function isDemoActive(): boolean {
    return Demo.isDemoLoaded();
}

export function getDemoTransaction(): RecapTransaction | null {
    return Demo.getDemoTransaction();
}

export function getDemoRequests() {
    return Demo.getDemoRequests();
}

export function getDemoDocuments() {
    return Demo.getDemoDocuments();
}

export function getDemoStatusCounts() {
    return Demo.getDemoStatusCounts();
}

/* ── Portal-created data (packages submitted via external portal) ── */

const PORTAL_INTAKE_KEY = "integrasource.recap.demo.portalIntakeItems";
const PORTAL_REQUESTS_KEY = "integrasource.recap.demo.portalRequests";
const PORTAL_SUBMISSIONS_KEY = "integrasource.recap.demo.portalSubmissions";

export function getPortalCreatedIntakeItems(): RecapIntakeItem[] {
    try {
        const raw = localStorage.getItem(PORTAL_INTAKE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

export function getPortalCreatedRequests(): RecapRequest[] {
    try {
        const raw = localStorage.getItem(PORTAL_REQUESTS_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

export function getPortalSubmissions(): { id: string; fileName: string; packageName: string; submittedAt: string; requestCount: number; status: "Draft" | "Analyzed" | "Submitted"; transactionName: string; isABCDemo: boolean }[] {
    try {
        const raw = localStorage.getItem(PORTAL_SUBMISSIONS_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

export function addPortalCreatedIntakeItem(item: RecapIntakeItem): void {
    const items = getPortalCreatedIntakeItems();
    items.push(item);
    localStorage.setItem(PORTAL_INTAKE_KEY, JSON.stringify(items));
}

export function addPortalCreatedRequests(requests: RecapRequest[]): void {
    const existing = getPortalCreatedRequests();
    const merged = [...existing, ...requests];
    localStorage.setItem(PORTAL_REQUESTS_KEY, JSON.stringify(merged));
}

export function addPortalSubmission(submission: { id: string; fileName: string; packageName: string; submittedAt: string; requestCount: number; status: "Draft" | "Analyzed" | "Submitted"; transactionName: string; isABCDemo: boolean }): void {
    const existing = getPortalSubmissions();
    existing.push(submission);
    localStorage.setItem(PORTAL_SUBMISSIONS_KEY, JSON.stringify(existing));
}

export function updatePortalSubmissionStatus(id: string, status: "Draft" | "Analyzed" | "Submitted"): void {
    const all = getPortalSubmissions();
    const found = all.find(s => s.id === id);
    if (found) {
        found.status = status;
        localStorage.setItem(PORTAL_SUBMISSIONS_KEY, JSON.stringify(all));
    }
}

export function clearAllPortalCreatedData(): void {
    localStorage.removeItem(PORTAL_INTAKE_KEY);
    localStorage.removeItem(PORTAL_REQUESTS_KEY);
    localStorage.removeItem(PORTAL_SUBMISSIONS_KEY);
}

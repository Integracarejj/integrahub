import { isDemoLoaded, isRecapWiped } from "./recapDemoData";
import * as Demo from "./recapDemoData";
import * as Mock from "./recapMockData";
import type {
    RecapTransaction, RecapRequest, RecapIntakeItem,
    RecapDocument, RecapActivity, RecapTeamMember, RecapCategory, RecapDeliverable, WorkNoteEntry,
} from "./recapMockData";

export type {
    RecapTransaction, RecapRequest, RecapIntakeItem,
    RecapDocument, RecapActivity, RecapTeamMember, RecapCategory, RecapDeliverable, WorkNoteEntry,
};

export function isRecapDataWiped(): boolean {
    return isRecapWiped();
}

export function getTransactions(): RecapTransaction[] {
    if (isRecapWiped()) {
        const portalReqs = getPortalCreatedRequests();
        const seen = new Set<string>();
        return portalReqs.reduce<RecapTransaction[]>((acc, r) => {
            if (!seen.has(r.transactionId)) {
                seen.add(r.transactionId);
                acc.push(makePortalTransaction(r.transactionId, r.transactionName));
            }
            return acc;
        }, []);
    }
    if (isDemoLoaded()) {
        const txn = Demo.getDemoTransaction();
        const result = txn ? [txn] : [];
        // Include synthetic transactions for any portal-created packages (e.g. BonJovi)
        const portalReqs = getPortalCreatedRequests();
        const seenIds = new Set(result.map(t => t.id));
        portalReqs.forEach(r => {
            if (!seenIds.has(r.transactionId)) {
                seenIds.add(r.transactionId);
                result.push(makePortalTransaction(r.transactionId, r.transactionName));
            }
        });
        return result;
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
        // Check portal requests for matching transaction ID
        const portalReqs = getPortalCreatedRequests();
        const found = portalReqs.find(r => r.transactionId === id);
        if (found) return makePortalTransaction(found.transactionId, found.transactionName);
        return;
    }
    return Mock.getTransactionById(id);
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
    if (isRecapWiped()) return portalItems;
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
    if (isRecapWiped()) return portalReqs;
    if (isDemoLoaded()) {
        const demo = Demo.getDemoRequests();
        return [...demo, ...portalReqs];
    }
    return [...Mock.getRequests(), ...portalReqs];
}

export function getTrackerRequests(): RecapRequest[] {
    return getRequests().filter(r => r._publishedAt || r._createdFromReview);
}

export function getDocuments(): RecapDocument[] {
    if (isRecapWiped()) return [];
    if (isDemoLoaded()) return Demo.getDemoDocuments();
    return Mock.getDocuments();
}

export function getDocumentsByTransaction(transactionId: string): RecapDocument[] {
    return getDocuments().filter((d) => d.transactionId === transactionId);
}

export function getActivity(limit?: number): RecapActivity[] {
    const persisted = getPersistedActivity();
    const source: RecapActivity[] = isRecapWiped() ? [] : (isDemoLoaded() ? Demo.getDemoActivity(999) : Mock.getActivity(999));
    const merged = [...persisted, ...source].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return limit ? merged.slice(0, limit) : merged;
}

export function getActivityByTransaction(transactionId: string): RecapActivity[] {
    if (isRecapWiped()) return [];
    if (isDemoLoaded()) {
        return Demo.getDemoActivity(999).filter((a) => a.transactionId === transactionId);
    }
    return Mock.getActivityByTransaction(transactionId);
}

export function addActivityEntry(entry: Omit<RecapActivity, "id" | "timestamp">): void {
    const newEntry: RecapActivity = {
        ...entry,
        id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: new Date().toISOString(),
    };
    const persisted = getPersistedActivity();
    persisted.unshift(newEntry);
    savePersistedActivity(persisted);
    if (!isRecapWiped()) {
        if (isDemoLoaded()) {
            Demo.addDemoActivityEntry(entry);
        } else {
            Mock.addActivityEntry(entry);
        }
    }
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
    if (isRecapWiped()) return Mock.getTeams();
    if (isDemoLoaded()) return Demo.getDemoTeams();
    return Mock.getTeams();
}

export function getTeamWorkload(): { team: string; total: number; activeLoad: number }[] {
    if (isRecapWiped()) return [];
    if (isDemoLoaded()) return Demo.getDemoWorkload();
    return Mock.getTeamWorkload();
}

export function getStatusCounts(): Record<string, number> {
    if (isRecapWiped()) return {};
    if (isDemoLoaded()) return Demo.getDemoStatusCounts();
    return Mock.getStatusCounts();
}

export function getDeliverables(): RecapDeliverable[] {
    if (isRecapWiped()) return [];
    return Mock.getDeliverables();
}

function makePortalTransaction(transactionId: string, transactionName: string): RecapTransaction {
    return { id: transactionId, name: transactionName, description: "", status: "Active" as const, sellerName: "", buyerName: "", brokerName: "", targetClose: "", totalRequests: 0, providedCount: 0, inProgressCount: 0, clarificationNeededCount: 0, overdueCount: 0, communities: [] };
}

export function lookupWorkspaceItem(id: string): { type: "intake"; item: RecapIntakeItem; transaction: RecapTransaction } | { type: "request"; item: RecapRequest; transaction: RecapTransaction } | null {
    if (isRecapWiped()) {
        const portalIntakes = getPortalCreatedIntakeItems();
        const foundPortal = portalIntakes.find(i => i.id === id || i.intakeId === id);
        if (foundPortal) return { type: "intake", item: foundPortal, transaction: makePortalTransaction(foundPortal.transactionId, foundPortal.transactionName) };
        const portalReqs = getPortalCreatedRequests();
        const foundReq = portalReqs.find(r => r.id === id || r.intakeId === id);
        if (foundReq) return { type: "request", item: foundReq, transaction: makePortalTransaction(foundReq.transactionId, foundReq.transactionName) };
        return null;
    }
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
        return { type: "intake", item: foundPortal, transaction: makePortalTransaction(foundPortal.transactionId, foundPortal.transactionName) };
    }
    const portalReqs = getPortalCreatedRequests();
    const foundReq = portalReqs.find(r => r.id === id || r.intakeId === id);
    if (foundReq) {
        return { type: "request", item: foundReq, transaction: makePortalTransaction(foundReq.transactionId, foundReq.transactionName) };
    }
    if (isDemoLoaded()) return null;
    return Mock.lookupWorkspaceItem(id);
}

export function getOverrideRequests(): RecapRequest[] {
    if (isRecapWiped()) return [];
    if (isDemoLoaded()) return Demo.getDemoOverrideRequests();
    return Mock.getOverrideRequests();
}

export function updateRequestStatus(id: string, status: RecapRequest["status"]): RecapRequest | undefined {
    if (isDemoLoaded()) {
        const result = Demo.updateDemoRequest(id, { status });
        if (result) return result;
        return updatePortalRequestStatus(id, status);
    }
    const result = Mock.updateRequestStatus(id, status);
    if (result) return result;
    return updatePortalRequestStatus(id, status);
}

export function updateRequestOwner(id: string, owner: string | null): RecapRequest | undefined {
    if (isDemoLoaded()) {
        const result = Demo.updateDemoRequest(id, { owner, assignedTo: owner, _needsReassignment: false, _misassignedReason: null });
        if (result) return result;
        return updatePortalRequestOwner(id, owner);
    }
    const result = Mock.updateRequestOwner(id, owner);
    if (result) return result;
    return updatePortalRequestOwner(id, owner);
}

export function updateRequestPriority(id: string, priority: RecapRequest["priority"]): RecapRequest | undefined {
    if (isDemoLoaded()) {
        const result = Demo.updateDemoRequest(id, { priority });
        if (result) return result;
        return updatePortalRequestById(id, { priority });
    }
    const result = Mock.updateRequestPriority(id, priority);
    if (result) return result;
    return updatePortalRequestById(id, { priority });
}

export function updateRequestDueDate(id: string, dueDate: string): RecapRequest | undefined {
    if (isDemoLoaded()) {
        const result = Demo.updateDemoRequest(id, { dueDate });
        if (result) return result;
        return updatePortalRequestById(id, { dueDate });
    }
    const result = Mock.updateRequestDueDate(id, dueDate);
    if (result) return result;
    return updatePortalRequestById(id, { dueDate });
}

export function updateRequestTeam(id: string, team: string): RecapRequest | undefined {
    if (isDemoLoaded()) {
        const result = Demo.updateDemoRequest(id, { team });
        if (result) return result;
        return updatePortalRequestTeam(id, team);
    }
    const result = Mock.updateRequestTeam(id, team);
    if (result) return result;
    return updatePortalRequestTeam(id, team);
}

export function updateRequestCompletion(id: string, data: { completedBy: string; completedAt: string; completionNotes: string }): RecapRequest | undefined {
    if (isDemoLoaded()) {
        const result = Demo.updateDemoRequest(id, {
            status: "Complete",
            _completedBy: data.completedBy,
            _completedAt: data.completedAt,
            _completionNotes: data.completionNotes || null,
        });
        if (result) return result;
        return updatePortalRequestById(id, {
            status: "Complete",
            _completedBy: data.completedBy,
            _completedAt: data.completedAt,
            _completionNotes: data.completionNotes || null,
        });
    }
    const req = Mock.getRequestById(id);
    if (req) {
        req.status = "Complete";
        req._completedBy = data.completedBy;
        req._completedAt = data.completedAt;
        req._completionNotes = data.completionNotes || null;
        req.lastUpdated = new Date().toISOString().split("T")[0];
        return req;
    }
    return updatePortalRequestById(id, {
        status: "Complete",
        _completedBy: data.completedBy,
        _completedAt: data.completedAt,
        _completionNotes: data.completionNotes || null,
    });
}

export function updateRequestReturnToOwner(id: string, reason: string, returnedBy: string): RecapRequest | undefined {
    const wnEntry: WorkNoteEntry = {
        id: `wn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        text: reason,
        author: returnedBy,
        timestamp: new Date().toISOString(),
        action: "Returned to Owner",
    };
    let req: RecapRequest | undefined;
    const existing = getRequestById(id);
    const prevNotes = existing?._workNotes || [];
    if (isDemoLoaded()) {
        req = Demo.updateDemoRequest(id, {
            status: "Clarification Needed",
            _returnReason: reason,
            _returnedBy: returnedBy,
            _workNotes: [...prevNotes, wnEntry],
        });
    } else {
        req = Mock.getRequestById(id);
        if (req) {
            req.status = "Clarification Needed";
            req._returnReason = reason;
            req._returnedBy = returnedBy;
            req._workNotes = [...prevNotes, wnEntry];
            req.lastUpdated = new Date().toISOString().split("T")[0];
        } else {
            req = updatePortalRequestById(id, {
                status: "Clarification Needed",
                _returnReason: reason,
                _returnedBy: returnedBy,
                _workNotes: [...prevNotes, wnEntry],
            });
        }
    }
    if (req) {
        addActivityEntry({
            type: "Status Change",
            description: `${req.requestId}: Returned to owner ${req.owner || "Unknown"} by ${returnedBy}. Reason: ${reason}`,
            userId: returnedBy,
            userName: returnedBy,
            requestId: req.id,
            requestTitle: req.title,
            transactionId: req.transactionId,
            transactionName: req.transactionName,
        });
    }
    return req;
}

export function updateRequestNotMine(id: string, reason: string, userName: string): RecapRequest | undefined {
    const wnEntry: WorkNoteEntry = {
        id: `wn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        text: reason,
        author: userName,
        timestamp: new Date().toISOString(),
        action: "Not Mine",
    };
    let req: RecapRequest | undefined;
    const existing = getRequestById(id);
    const prevNotes = existing?._workNotes || [];
    if (isDemoLoaded()) {
        req = Demo.updateDemoRequest(id, {
            status: "Open",
            owner: null,
            assignedTo: null,
            _misassignedReason: reason,
            _needsReassignment: true,
            _workNotes: [...prevNotes, wnEntry],
        });
    } else {
        req = Mock.getRequestById(id);
        if (req) {
            req.status = "Open";
            req.owner = null;
            req.assignedTo = null;
            req._misassignedReason = reason;
            req._needsReassignment = true;
            req._workNotes = [...prevNotes, wnEntry];
            req.lastUpdated = new Date().toISOString().split("T")[0];
        } else {
            req = updatePortalRequestById(id, {
                status: "Open",
                owner: null,
                assignedTo: null,
                _misassignedReason: reason,
                _needsReassignment: true,
                _workNotes: [...prevNotes, wnEntry],
            });
        }
    }
    if (req) {
        addActivityEntry({
            type: "Status Change",
            description: `${req.requestId}: Reported as Not Mine by ${userName}. Reason: ${reason}`,
            userId: userName,
            userName,
            requestId: req.id,
            requestTitle: req.title,
            transactionId: req.transactionId,
            transactionName: req.transactionName,
        });
    }
    return req;
}

export function updateRequestExternalStatus(id: string, publishedWithoutDocuments?: boolean): RecapRequest | undefined {
    if (isDemoLoaded()) {
        const result = Demo.updateDemoRequest(id, { _publishedExternal: true, _publishedExternalAt: new Date().toISOString().split("T")[0], _externalStatus: "Published External", _publishedWithoutDocuments: publishedWithoutDocuments ?? false });
        if (result) return result;
        return updatePortalRequestById(id, { _publishedExternal: true, _publishedExternalAt: new Date().toISOString().split("T")[0], _externalStatus: "Published External", _publishedWithoutDocuments: publishedWithoutDocuments ?? false });
    }
    const result = Mock.updateExternalPublishStatus(id, publishedWithoutDocuments);
    if (result) return result;
    return updatePortalRequestById(id, { _publishedExternal: true, _publishedExternalAt: new Date().toISOString().split("T")[0], _externalStatus: "Published External", _publishedWithoutDocuments: publishedWithoutDocuments ?? false });
}

export function toggleExternalVisibility(id: string): RecapRequest | undefined {
    if (isDemoLoaded()) {
        const req = Demo.getDemoRequestById(id);
        if (req) return Demo.updateDemoRequest(id, { externalVisible: !req.externalVisible });
        return;
    }
    return Mock.toggleExternalVisibility(id);
}

export function updateRequestStatusNotes(id: string, note: string | null): RecapRequest | undefined {
    if (isDemoLoaded()) {
        return Demo.updateDemoRequest(id, { _statusNotes: note });
    }
    const req = Mock.getRequestById(id);
    if (req) {
        req._statusNotes = note;
        req.lastUpdated = new Date().toISOString().split("T")[0];
        return req;
    }
    return updatePortalRequestById(id, { _statusNotes: note });
}

/* ── Work Notes ──────────────────────────────────────────── */

export function addWorkNote(id: string, text: string, author: string, action?: string | null): WorkNoteEntry | undefined {
    const entry: WorkNoteEntry = {
        id: `wn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        text,
        author,
        timestamp: new Date().toISOString(),
        action: action || null,
    };
    const req = getRequestById(id);
    if (!req) return;
    const notes = [...(req._workNotes || []), entry];
    if (isDemoLoaded()) {
        Demo.updateDemoRequest(id, { _workNotes: notes });
        addActivityEntry({
            type: "Note",
            description: text,
            userId: author,
            userName: author,
            requestId: req.id,
            requestTitle: req.title,
            transactionId: req.transactionId,
            transactionName: req.transactionName,
        });
        return entry;
    }
    const mockReq = Mock.getRequestById(id);
    if (mockReq) {
        mockReq._workNotes = notes;
        mockReq.lastUpdated = new Date().toISOString().split("T")[0];
    } else {
        updatePortalRequestById(id, { _workNotes: notes });
    }
    addActivityEntry({
        type: "Note",
        description: text,
        userId: author,
        userName: author,
        requestId: req.id,
        requestTitle: req.title,
        transactionId: req.transactionId,
        transactionName: req.transactionName,
    });
    return entry;
}

export function editWorkNote(id: string, noteId: string, newText: string): boolean {
    const req = getRequestById(id);
    if (!req || !req._workNotes) return false;
    const notes = req._workNotes.map(n => n.id === noteId ? { ...n, text: newText } : n);
    if (isDemoLoaded()) {
        Demo.updateDemoRequest(id, { _workNotes: notes });
    } else {
        const mockReq = Mock.getRequestById(id);
        if (mockReq) {
            mockReq._workNotes = notes;
            mockReq.lastUpdated = new Date().toISOString().split("T")[0];
        } else {
            updatePortalRequestById(id, { _workNotes: notes });
        }
    }
    return true;
}

export function deleteWorkNote(id: string, noteId: string): boolean {
    const req = getRequestById(id);
    if (!req || !req._workNotes) return false;
    const notes = req._workNotes.filter(n => n.id !== noteId);
    if (isDemoLoaded()) {
        Demo.updateDemoRequest(id, { _workNotes: notes });
    } else {
        const mockReq = Mock.getRequestById(id);
        if (mockReq) {
            mockReq._workNotes = notes;
            mockReq.lastUpdated = new Date().toISOString().split("T")[0];
        } else {
            updatePortalRequestById(id, { _workNotes: notes });
        }
    }
    return true;
}

export function promoteToReusableKnowledge(
    id: string,
    status: "Promoted" | "Skipped",
    artifactIds: string[],
    userName: string
): RecapRequest | undefined {
    const patch: Partial<RecapRequest> = {
        _reusableKnowledgeCandidate: true,
        _reusableKnowledgeStatus: status,
        _reusableKnowledgeArtifactIds: artifactIds,
    };
    let req: RecapRequest | undefined;
    if (isDemoLoaded()) {
        req = Demo.updateDemoRequest(id, patch);
    } else {
        req = Mock.getRequestById(id);
        if (req) {
            Object.assign(req, patch);
            req.lastUpdated = new Date().toISOString().split("T")[0];
        } else {
            req = updatePortalRequestById(id, patch);
        }
    }
    if (req) {
        const label = status === "Promoted" ? "promoted to" : "skipped";
        addActivityEntry({
            type: "Status Change",
            description: `${req.requestId} ${label} Reusable Knowledge`,
            userId: userName,
            userName,
            requestId: req.id,
            requestTitle: req.title,
            transactionId: req.transactionId,
            transactionName: req.transactionName,
        });
    }
    return req;
}

/** Determine Reusable Knowledge recommendation based on category */
export function getReusableKnowledgeRecommendation(category: string): { action: "Promote" | "Do not promote" | "Needs review"; reason: string } {
    const cat = (category || "").toLowerCase();
    const promotePatterns = ["hr", "staffing", "regulatory", "licenses", "clinical", "physical plant", "facilities", "legal", "operations", "template", "policies"];
    const skipPatterns = ["accounts receivable", "ar aging", "debt schedule", "rent roll", "utility expense", "financial statement", "point-in-time"];
    for (const p of skipPatterns) {
        if (cat.includes(p)) return { action: "Do not promote", reason: `${category} appears transaction-specific and unlikely to be reusable.` };
    }
    for (const p of promotePatterns) {
        if (cat.includes(p)) return { action: "Promote", reason: `${category} is generally reusable across communities and transactions.` };
    }
    return { action: "Needs review", reason: `${category} category requires manual review to determine reusability.` };
}

export function getMyWork(userName: string): {
    assignedToMe: RecapRequest[];
    assignedToMyTeam: RecapRequest[];
    dueThisWeek: RecapRequest[];
    overdue: RecapRequest[];
    needsMyResponse: RecapRequest[];
    waitingOnExternal: RecapRequest[];
} {
    if (isRecapWiped()) return { assignedToMe: [], assignedToMyTeam: [], dueThisWeek: [], overdue: [], needsMyResponse: [], waitingOnExternal: [] };
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
    let count = 0;
    if (isDemoLoaded()) {
        count = Demo.bulkUpdateDemoRequests(ids, patch);
    }
    count += bulkUpdatePortalRequests(ids, patch);
    return count;
}

export function getDemoEngineSummary() {
    if (!isDemoLoaded()) return { total: 0, needsReview: 0, possibleDuplicates: 0, needsFollowUp: 0, critical: 0, categories: {}, teams: {} };
    return Demo.getDemoEngineSummary();
}

export function getDemoReports() {
    return Demo.getDemoReports();
}

export function publishIntake(): { publishedCount: number; publishedIds: string[]; publishedBatchId?: string } {
    if (isDemoLoaded()) return Demo.publishIntake();
    return { publishedCount: 0, publishedIds: [] };
}

export function publishSelectedRequests(ids: string[], sourceInfo?: { sourceIntakeId?: string; sourcePackageId?: string }): { publishedCount: number; publishedIds: string[]; publishedBatchId?: string } {
    const batchId = `batch-${Date.now()}`;
    const now = new Date().toISOString();
    const nowDate = now.split("T")[0];
    let publishedIds: string[] = [];
    let publishedCount = 0;

    // Check if IDs belong to demo state requests (ABC transaction) or portal requests
    const portalReqIds = new Set(getPortalCreatedRequests().map(r => r.id));
    const demoIds = ids.filter(id => !portalReqIds.has(id));
    const portalIds = ids.filter(id => portalReqIds.has(id));

    // Publish demo state requests (only if demo IDs are present)
    if (demoIds.length > 0 && isDemoLoaded()) {
        const result = Demo.publishSelectedRequests(demoIds, sourceInfo);
        publishedIds = [...result.publishedIds];
        publishedCount = result.publishedCount;
    }

    // Publish portal-created requests (e.g. custom packages like BonJovi)
    if (portalIds.length > 0) {
        const portalReqs = getPortalCreatedRequests();
        let portalUpdated = false;
        const updatedPortalReqs = portalReqs.map(r => {
            if (portalIds.includes(r.id) || portalIds.includes(r.requestId) || portalIds.includes(r.intakeId)) {
                if (r._publishedAt) return r;
                r._publishedAt = nowDate;
                r._convertedAt = now;
                r.lastUpdated = nowDate;
                r._createdFromReview = true;
                r._sourceReviewItemId = r.requestId;
                r._externalStatus = "Internal Only";
                if (sourceInfo?.sourceIntakeId) r._sourceIntakeId = sourceInfo.sourceIntakeId;
                if (sourceInfo?.sourcePackageId) r._sourcePackageId = sourceInfo.sourcePackageId;
                publishedCount++;
                publishedIds.push(r.id);
                portalUpdated = true;
                // Keep status as Open; do not auto-change to In Progress
            }
            return r;
        });
        if (portalUpdated) {
            localStorage.setItem(PORTAL_REQUESTS_KEY, JSON.stringify(updatedPortalReqs));
            const reqTitles = publishedIds.map(id => {
                const r = updatedPortalReqs.find(p => p.id === id || p.requestId === id);
                return r?.title || id;
            });
            addActivityEntry({ type: "Status Change", description: `${publishedCount} request${publishedCount !== 1 ? "s" : ""} moved to work queue: ${reqTitles.join(", ")}`, userId: "system", userName: "System", requestId: publishedIds.join(", "), requestTitle: reqTitles.join(", "), transactionId: "", transactionName: "" });
        }
    }

    const finalBatchId = publishedCount > 0 ? batchId : undefined;
    console.log(`[publishSelectedRequests] Published ${publishedCount} requests. batchId: ${batchId}`);
    return { publishedCount, publishedIds, publishedBatchId: finalBatchId };
}

export function resetRequestTracker(): { clearedCount: number } {
    let demoCleared = 0;
    let portalCleared = 0;

    // Reset demo state requests
    if (isDemoLoaded()) {
        const r = Demo.resetDemoTracker();
        demoCleared = r.clearedCount;
    }

    // Reset portal-created requests (clear _publishedAt, _convertedAt, etc.)
    const portalReqs = getPortalCreatedRequests();
    let anyCleared = false;
    const resetPortal = portalReqs.map(r => {
        if (r._publishedAt || r._createdFromReview) {
            r._publishedAt = null;
            r._convertedAt = null;
            r._sourceIntakeId = undefined;
            r._sourcePackageId = undefined;
            r._sourceReviewItemId = undefined;
            r._createdFromReview = false;
            portalCleared++;
            anyCleared = true;
        }
        return r;
    });
    if (anyCleared) {
        localStorage.setItem(PORTAL_REQUESTS_KEY, JSON.stringify(resetPortal));
    }

    console.log(`[resetRequestTracker] Cleared ${demoCleared} demo + ${portalCleared} portal = ${demoCleared + portalCleared} total`);
    return { clearedCount: demoCleared + portalCleared };
}

export function initDemo(): void {
    if (isRecapWiped()) return;
    Demo.initDemo();
}

export function resetDemo(): void {
    Demo.resetDemo();
}

export function resetAllRecapData(): void {
    Demo.resetAllRecapData();
}

export function isDemoActive(): boolean {
    return Demo.isDemoLoaded();
}

export function getDemoTransaction(): RecapTransaction | null {
    return Demo.getDemoTransaction();
}

export function getDemoRequests() {
    if (!isDemoLoaded()) return [];
    return Demo.getDemoRequests();
}

export function getDemoDocuments() {
    return Demo.getDemoDocuments();
}

export function getDemoStatusCounts() {
    return Demo.getDemoStatusCounts();
}

/* ── Activity Feed persistence (prototype — not gated by wiped) ── */

const ACTIVITY_FEED_KEY = "integrasource.recap.activityFeed";

function getPersistedActivity(): RecapActivity[] {
    try {
        const raw = localStorage.getItem(ACTIVITY_FEED_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

function savePersistedActivity(entries: RecapActivity[]): void {
    localStorage.setItem(ACTIVITY_FEED_KEY, JSON.stringify(entries));
}

/* ── Work Artifacts persistence (prototype metadata only) ── */

const ARTIFACTS_KEY = "integrasource.recap.artifacts";

export interface WorkArtifact {
    id: string;
    name: string;
    size: number;
    uploadedAt: string;
    requestId: string;
    intakeId?: string;
    generatedId?: string;
    originalFileName?: string;
    displayFileName?: string;
    uploadedBy?: string;
    artifactType?: string;
    isPrototype?: boolean;
    /** Future SharePoint metadata (not yet implemented) */
    sharePointSiteId?: string;
    driveId?: string;
    itemId?: string;
    webUrl?: string;
    version?: string;
}

export function generateDisplayFileName(requestId: string, title: string, artifactIndex: number, originalName: string): string {
    const ext = originalName.includes(".") ? originalName.split(".").pop() : "bin";
    const safeTitle = title.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 30);
    const dateStr = new Date().toISOString().split("T")[0].replace(/-/g, "_");
    return `${requestId}_${safeTitle}_${artifactIndex}_${dateStr}.${ext}`;
}

export function getWorkArtifactsByRequest(requestId: string): WorkArtifact[] {
    try {
        const raw = localStorage.getItem(ARTIFACTS_KEY);
        const store: Record<string, WorkArtifact[]> = raw ? JSON.parse(raw) : {};
        return store[requestId] || [];
    } catch { return []; }
}

export function saveWorkArtifact(requestId: string, artifact: WorkArtifact): void {
    try {
        const raw = localStorage.getItem(ARTIFACTS_KEY);
        const store: Record<string, WorkArtifact[]> = raw ? JSON.parse(raw) : {};
        if (!store[requestId]) store[requestId] = [];
        store[requestId].push(artifact);
        localStorage.setItem(ARTIFACTS_KEY, JSON.stringify(store));
    } catch { }
}

export function saveWorkArtifacts(requestId: string, artifacts: WorkArtifact[]): void {
    try {
        const raw = localStorage.getItem(ARTIFACTS_KEY);
        const store: Record<string, WorkArtifact[]> = raw ? JSON.parse(raw) : {};
        store[requestId] = artifacts;
        localStorage.setItem(ARTIFACTS_KEY, JSON.stringify(store));
    } catch { }
}

export function removeWorkArtifact(requestId: string, artifactId: string): void {
    try {
        const raw = localStorage.getItem(ARTIFACTS_KEY);
        const store: Record<string, WorkArtifact[]> = raw ? JSON.parse(raw) : {};
        if (store[requestId]) {
            store[requestId] = store[requestId].filter(a => a.id !== artifactId);
            localStorage.setItem(ARTIFACTS_KEY, JSON.stringify(store));
        }
    } catch { }
}

/* ── Portal-created data (packages submitted via external portal) ── */

const PORTAL_INTAKE_KEY = "integrasource.recap.demo.portalIntakeItems";
const PORTAL_REQUESTS_KEY = "integrasource.recap.demo.portalRequests";
const PORTAL_SUBMISSIONS_KEY = "integrasource.recap.demo.portalSubmissions";

/* ── Portal request/assignment persistence helpers ────────── */

export function updatePortalRequestOwner(reqId: string, owner: string | null): RecapRequest | undefined {
    const all = getPortalCreatedRequests();
    const idx = all.findIndex(r => r.id === reqId || r.requestId === reqId || r.intakeId === reqId);
    if (idx === -1) return;
    all[idx] = { ...all[idx], owner, assignedTo: owner, _needsReassignment: false, _misassignedReason: null, lastUpdated: new Date().toISOString().split("T")[0] };
    localStorage.setItem(PORTAL_REQUESTS_KEY, JSON.stringify(all));
    return all[idx];
}

export function updatePortalRequestStatus(reqId: string, status: string): RecapRequest | undefined {
    const all = getPortalCreatedRequests();
    const idx = all.findIndex(r => r.id === reqId || r.requestId === reqId || r.intakeId === reqId);
    if (idx === -1) return;
    all[idx] = { ...all[idx], status: status as RecapRequest["status"], lastUpdated: new Date().toISOString().split("T")[0] };
    localStorage.setItem(PORTAL_REQUESTS_KEY, JSON.stringify(all));
    return all[idx];
}

export function updatePortalRequestById(reqId: string, patch: Partial<RecapRequest>): RecapRequest | undefined {
    const all = getPortalCreatedRequests();
    const idx = all.findIndex(r => r.id === reqId || r.requestId === reqId || r.intakeId === reqId);
    if (idx === -1) return;
    all[idx] = { ...all[idx], ...patch, lastUpdated: new Date().toISOString().split("T")[0] };
    localStorage.setItem(PORTAL_REQUESTS_KEY, JSON.stringify(all));
    return all[idx];
}

export function updatePortalRequestTeam(reqId: string, team: string): RecapRequest | undefined {
    const all = getPortalCreatedRequests();
    const idx = all.findIndex(r => r.id === reqId || r.requestId === reqId || r.intakeId === reqId);
    if (idx === -1) return;
    all[idx] = { ...all[idx], team, lastUpdated: new Date().toISOString().split("T")[0] };
    localStorage.setItem(PORTAL_REQUESTS_KEY, JSON.stringify(all));
    return all[idx];
}

export function bulkUpdatePortalRequests(ids: string[], patch: Partial<RecapRequest>): number {
    let count = 0;
    const all = getPortalCreatedRequests();
    const updated = all.map(r => {
        if (ids.includes(r.id) || ids.includes(r.requestId) || ids.includes(r.intakeId)) {
            count++;
            return { ...r, ...patch, lastUpdated: new Date().toISOString().split("T")[0] };
        }
        return r;
    });
    if (count > 0) {
        localStorage.setItem(PORTAL_REQUESTS_KEY, JSON.stringify(updated));
    }
    return count;
}

/* ── Portal-created data (packages submitted via external portal) ── */

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
    localStorage.removeItem("integrasource.recap.demo.parsedRows");
}

export function setRecapWiped(): void {
    Demo.setRecapWiped();
}

export function clearRecapWiped(): void {
    Demo.clearRecapWiped();
}

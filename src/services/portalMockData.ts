import { getTransactions, getRequests, getDocuments, isDemoActive, initDemo, getDemoEngineSummary, addPortalCreatedIntakeItem, addPortalCreatedRequests, addPortalSubmission, getPortalSubmissions, updatePortalSubmissionStatus, clearAllPortalCreatedData, isRecapDataWiped, clearRecapWiped, addActivityEntry } from "./recapDataService";
import type { RecapRequest, RecapDocument, RecapTransaction, RecapIntakeItem } from "./recapDataService";
import { getExternalStatusInfo } from "./externalStatusMapping";

const PERSONA_KEY = "integrasource.recap.portalPersona";
const PARSED_ROWS_KEY = "integrasource.recap.demo.parsedRows";
const ORGS_KEY = "integrasource.recap.portalOrganizations";
const USERS_KEY = "integrasource.recap.portalUsers";
const MEMBERSHIPS_KEY = "integrasource.recap.portalMemberships";
const TRANSACTIONS_KEY = "integrasource.recap.portalTransactions";
const TXN_ACCESS_KEY = "integrasource.recap.portalTransactionAccess";

/* ── Persona Model ──────────────────────────────────────────── */

export interface ExternalDemoPersona {
    id: string;
    email: string;
    displayName: string;
    companyName: string;
    role: "Owner / Seller" | "Buyer" | "Broker";
    description: string;
}

const PERSONAS: ExternalDemoPersona[] = [
    { id: "broker", email: "broker@mail.com", displayName: "Morgan Blake", companyName: "ABCto123 Associates", role: "Broker", description: "Coordinate requests, upload DD packages, monitor bottlenecks" },
    { id: "owner-seller", email: "abc@mail.com", displayName: "Alex Carter", companyName: "ABC Company", role: "Owner / Seller", description: "Upload requested documents, respond to clarifications, see missing items" },
    { id: "buyer", email: "123@mail.com", displayName: "Jamie Reynolds", companyName: "123 Corporation", role: "Buyer", description: "Review available documents, submit new requests, track diligence progress" },
];

export function getPersonas(): ExternalDemoPersona[] {
    return PERSONAS;
}

export function getActivePersona(): ExternalDemoPersona {
    try {
        const raw = localStorage.getItem(PERSONA_KEY);
        if (raw) {
            const found = PERSONAS.find((p) => p.id === raw);
            if (found) return found;
        }
    } catch { }
    return PERSONAS[0];
}

export function setActivePersona(id: string): void {
    localStorage.setItem(PERSONA_KEY, id);
}

/* ── External Identity Model ─────────────────────────────── */

export interface ExternalOrganization {
    id: string;
    name: string;
    status: "Active" | "Inactive";
}

export interface ExternalUser {
    id: string;
    email: string;
    displayName: string;
    organizationId: string;
    organizationName: string;
    roleAssignments: { orgId: string; role: "Owner / Seller" | "Buyer" | "Broker" }[];
}

export interface ExternalOrganizationMembership {
    userId: string;
    orgId: string;
    role: "Owner / Seller" | "Buyer" | "Broker";
}

export interface ExternalTransaction {
    id: string;
    orgId: string;
    name: string;
    description: string;
    status: "Active" | "Pending" | "Completed";
    createdAt: string;
}

export interface ExternalTransactionAccess {
    transactionId: string;
    orgId: string;
    userId: string;
}

const DEMO_ORGANIZATIONS: ExternalOrganization[] = [
    { id: "org-atlas", name: "Atlas Capital Partners", status: "Active" },
    { id: "org-harbor", name: "Harbor Partners", status: "Active" },
    { id: "org-summit", name: "Summit Equity Group", status: "Active" },
];

const DEMO_USERS: ExternalUser[] = [
    {
        id: "ext-user-alex", email: "broker@mail.com", displayName: "Morgan Blake",
        organizationId: "org-atlas", organizationName: "Atlas Capital Partners",
        roleAssignments: [{ orgId: "org-atlas", role: "Broker" }],
    },
    {
        id: "ext-user-hannah", email: "abc@mail.com", displayName: "Alex Carter",
        organizationId: "org-harbor", organizationName: "Harbor Partners",
        roleAssignments: [{ orgId: "org-harbor", role: "Owner / Seller" }],
    },
    {
        id: "ext-user-sam", email: "123@mail.com", displayName: "Jamie Reynolds",
        organizationId: "org-summit", organizationName: "Summit Equity Group",
        roleAssignments: [{ orgId: "org-summit", role: "Buyer" }],
    },
];

const DEMO_MEMBERSHIPS: ExternalOrganizationMembership[] = [
    { userId: "ext-user-alex", orgId: "org-atlas", role: "Broker" },
    { userId: "ext-user-hannah", orgId: "org-harbor", role: "Owner / Seller" },
    { userId: "ext-user-sam", orgId: "org-summit", role: "Buyer" },
];

function readJsonArray<T>(key: string): T[] {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

function writeJsonArray<T>(key: string, data: T[]): void {
    localStorage.setItem(key, JSON.stringify(data));
}

export function getOrganizations(): ExternalOrganization[] {
    const stored = readJsonArray<ExternalOrganization>(ORGS_KEY);
    if (stored.length === 0) {
        writeJsonArray(ORGS_KEY, DEMO_ORGANIZATIONS);
        return [...DEMO_ORGANIZATIONS];
    }
    return stored;
}

export function getOrganization(id: string): ExternalOrganization | undefined {
    return getOrganizations().find(o => o.id === id);
}

export function addOrganization(org: ExternalOrganization): void {
    const orgs = getOrganizations();
    orgs.push(org);
    writeJsonArray(ORGS_KEY, orgs);
}

export function getExternalUsers(): ExternalUser[] {
    const stored = readJsonArray<ExternalUser>(USERS_KEY);
    if (stored.length === 0) {
        writeJsonArray(USERS_KEY, DEMO_USERS);
        return [...DEMO_USERS];
    }
    return stored;
}

export function getExternalUser(id: string): ExternalUser | undefined {
    return getExternalUsers().find(u => u.id === id);
}

export function addExternalUser(user: ExternalUser): void {
    const users = getExternalUsers();
    users.push(user);
    writeJsonArray(USERS_KEY, users);
}

export function getMemberships(): ExternalOrganizationMembership[] {
    const stored = readJsonArray<ExternalOrganizationMembership>(MEMBERSHIPS_KEY);
    if (stored.length === 0) {
        writeJsonArray(MEMBERSHIPS_KEY, DEMO_MEMBERSHIPS);
        return [...DEMO_MEMBERSHIPS];
    }
    return stored;
}

export function addMembership(m: ExternalOrganizationMembership): void {
    const memberships = getMemberships();
    memberships.push(m);
    writeJsonArray(MEMBERSHIPS_KEY, memberships);
}

export function deleteMembership(userId: string, orgId: string): void {
    const memberships = getMemberships().filter(m => !(m.userId === userId && m.orgId === orgId));
    writeJsonArray(MEMBERSHIPS_KEY, memberships);
}

export function getTransactionsList(): ExternalTransaction[] {
    const stored = readJsonArray<ExternalTransaction>(TRANSACTIONS_KEY);
    if (stored.length === 0) {
        // Initialize demo transactions on first call
        const demoTxns: ExternalTransaction[] = [
            { id: "txn-abc-portfolio", orgId: "org-atlas", name: "ABC Portfolio Acquisition", description: "Multi-community residential portfolio due diligence", status: "Active", createdAt: new Date().toISOString() },
            { id: "txn-harbor-deal", orgId: "org-harbor", name: "Harbor View Single Asset", description: "Single asset acquisition - Harbor View community", status: "Active", createdAt: new Date().toISOString() },
            { id: "txn-summit-review", orgId: "org-summit", name: "Summit Portfolio Review", description: "Existing portfolio re-underwriting and review", status: "Active", createdAt: new Date().toISOString() },
        ];
        writeJsonArray(TRANSACTIONS_KEY, demoTxns);
        // Also ensure demo access exists
        if (readJsonArray<ExternalTransactionAccess>(TXN_ACCESS_KEY).length === 0) {
            const demoAccess: ExternalTransactionAccess[] = [
                { transactionId: "txn-abc-portfolio", orgId: "org-atlas", userId: "ext-user-alex" },
                { transactionId: "txn-harbor-deal", orgId: "org-harbor", userId: "ext-user-hannah" },
                { transactionId: "txn-summit-review", orgId: "org-summit", userId: "ext-user-sam" },
                { transactionId: "txn-abc-portfolio", orgId: "org-summit", userId: "ext-user-sam" },
            ];
            writeJsonArray(TXN_ACCESS_KEY, demoAccess);
        }
        return demoTxns;
    }
    return stored;
}

export function addTransaction(txn: ExternalTransaction): void {
    const txns = getTransactionsList();
    txns.push(txn);
    writeJsonArray(TRANSACTIONS_KEY, txns);
}

export function getTransactionAccessList(): ExternalTransactionAccess[] {
    const stored = readJsonArray<ExternalTransactionAccess>(TXN_ACCESS_KEY);
    if (stored.length === 0) {
        // Trigger initialization via getTransactionsList which also seeds access
        getTransactionsList();
        return readJsonArray<ExternalTransactionAccess>(TXN_ACCESS_KEY);
    }
    return stored;
}

export function addTransactionAccess(access: ExternalTransactionAccess): void {
    const accesses = getTransactionAccessList();
    accesses.push(access);
    writeJsonArray(TXN_ACCESS_KEY, accesses);
}

export function getAuthorizedTransactions(userId: string): ExternalTransactionAccess[] {
    return getTransactionAccessList().filter(a => a.userId === userId);
}

export function isRequestAuthorized(requestId: string, userId: string): boolean {
    const all = getPortalRequests();
    const req = all.find(r => r.id === requestId || r.requestId === requestId);
    if (!req) return false;
    const txns = getTransactionsList();
    const txn = txns.find(t => t.id === req.transactionId);
    if (txn) {
        return getTransactionAccessList().some(a => a.transactionId === txn.id && a.userId === userId);
    }
    const accesses = getTransactionAccessList();
    return accesses.some(a => a.userId === userId);
}

export function isTransactionAuthorized(transactionId: string, userId: string): boolean {
    return getTransactionAccessList().some(a => a.transactionId === transactionId && a.userId === userId);
}

export interface PortalIdentityContext {
    user: ExternalUser;
    organization: ExternalOrganization;
    authorizedTransactions: ExternalTransactionAccess[];
    allTransactions: ExternalTransaction[];
}

export function getPersonaIdentity(): PortalIdentityContext | null {
    const persona = getActivePersona();
    const users = getExternalUsers();
    const user = users.find(u => u.email === persona.email);
    if (!user) return null;
    const org = getOrganization(user.organizationId);
    if (!org) return null;

    const authorizedTransactions = getAuthorizedTransactions(user.id);
    const allTransactions = getTransactionsList();
    return { user, organization: org, authorizedTransactions, allTransactions };
}

/* ── Portal Types ──────────────────────────────────────────── */

export interface PortalCommunity {
    id: string;
    name: string;
}

export interface PortalTransaction {
    id: string;
    name: string;
    description: string;
    status: string;
    sellerName: string;
    buyerName: string;
    brokerName: string;
    targetClose: string;
    totalRequests: number;
    providedCount: number;
    inProgressCount: number;
    clarificationNeededCount: number;
    communities: PortalCommunity[];
}

export interface PortalRequest {
    id: string;
    requestId: string;
    intakeId: string;
    transactionId: string;
    transactionName: string;
    title: string;
    category: string;
    status: string;
    priority: string;
    neededBy: string;
    submittedAt: string;
    updatedAt: string;
    communityIds: string[];
    communityNames: string[];
    owner: string | null;
    team: string;
    brokerBuyer: string;
    externalStatus?: string;
    /** Organization ownership: captured at upload time */
    orgId?: string;
    orgName?: string;
    userId?: string;
    userName?: string;
    /** Internal field: whether this was published externally */
    _publishedExternal?: boolean;
    _publishedWithoutDocuments?: boolean;
    _publishedArtifactIds?: string[];
    _publishedExternalNote?: string;
    /** Partner review fields */
    _completedBy?: string | null;
    _completedAt?: string | null;
    _completionNotes?: string | null;
    _returnedBy?: string | null;
    _returnReason?: string | null;
    /** Exception recommendation fields for external partner review */
    _exceptionRecommendation?: "Duplicate" | "Not Applicable" | null;
    _exceptionSentAt?: string | null;
    _exceptionDecision?: "Approve Removal" | "Keep Request" | "Confirm Duplicate" | "Keep Separate" | null;
    _exceptionDecisionAt?: string | null;
    _exceptionDecisionNote?: string | null;
    _exceptionReason?: string | null;
    _archived?: boolean;
    _archiveReason?: "Duplicate" | "Not Applicable" | "Cancelled" | "Closed" | null;
    _archivedAt?: string | null;
    /** Raw internal status before external label mapping — use this for getExternalStatusInfo() */
    _rawStatus: string;
    /** Work notes for clarification routing */
    _workNotes?: import("./recapMockData").WorkNoteEntry[];
    /** When the request was published internally */
    _publishedAt?: string | null;
    /** Partner decision fields for rework/approval visibility */
    _partnerDecision?: string | null;
    _partnerNote?: string | null;
    _partnerActionAt?: string | null;
    /** Blocker workflow fields */
    _blockerReason?: string | null;
    _blockerStatus?: string | null;
    _blockerExternalQuestion?: string | null;
    _blockerExternalResponse?: string | null;
    /** External lifecycle milestone: timestamp when processing first started.
     *  Preserves "In Progress" externally across internal status changes. */
    _processingStartedAt?: string | null;
}

export interface PortalQuestion {
    id: string;
    transactionId: string;
    transactionName: string;
    questionType: string;
    subject: string;
    details: string;
    status: string;
    submittedAt: string;
    answeredAt: string | null;
    answer: string | null;
    communityIds: string[];
    communityNames: string[];
    submittedBy: string;
    companyName: string;
}

export interface PortalClarification {
    id: string;
    transactionId: string;
    transactionName: string;
    requestId: string;
    requestTitle: string;
    details: string;
    status: string;
    submittedAt: string;
    resolvedAt: string | null;
    response: string | null;
    communityIds: string[];
    communityNames: string[];
    submittedBy: string;
    companyName: string;
}

export interface PortalDocument {
    id: string;
    transactionId: string;
    transactionName: string;
    name: string;
    category: string;
    uploadedAt: string;
    size: string;
    externalVisible: boolean;
    communityIds: string[];
    communityNames: string[];
    relatedRequestId: string | null;
    relatedRequestTitle: string | null;
    sharePointUrl: string | null;
}

export interface PortalUserContext {
    displayName: string;
    email: string;
    companyName: string;
    role: string;
    transactions: PortalTransaction[];
}

/* ── In-memory mock stores for submit operations ──────────── */

const MOCK_REQUESTS: PortalRequest[] = [];

const MOCK_QUESTIONS: PortalQuestion[] = [
    {
        id: "pq-1", transactionId: "txn-abc", transactionName: "ABC Company Portfolio",
        questionType: "General", subject: "Property condition disclosure timeline",
        details: "Can you provide an estimated timeline for the property condition assessment reports?",
        status: "Answered", submittedAt: "2026-06-20", answeredAt: "2026-06-22",
        answer: "PCA reports are expected within 2 weeks of the request. We will notify you when they are ready.",
        communityIds: ["abc-cr", "abc-mp"], communityNames: ["Cedar Ridge", "Magnolia Place"],
        submittedBy: "Jamie Reynolds", companyName: "123 Corporation",
    },
    {
        id: "pq-2", transactionId: "txn-abc", transactionName: "ABC Company Portfolio",
        questionType: "General", subject: "Insurance renewal documentation",
        details: "Will the current insurance certificates remain valid through the anticipated close date?",
        status: "Open", submittedAt: "2026-06-24", answeredAt: null, answer: null,
        communityIds: [], communityNames: [],
        submittedBy: "Jamie Reynolds", companyName: "123 Corporation",
    },
];

const MOCK_CLARIFICATIONS: PortalClarification[] = [
    {
        id: "pc-1", transactionId: "txn-abc", transactionName: "ABC Company Portfolio",
        requestId: "DD-ABC-015", requestTitle: "Phase I environmental assessment",
        details: "Does the Phase I cover all five communities or just Cedar Ridge?",
        status: "Resolved", submittedAt: "2026-06-18", resolvedAt: "2026-06-20",
        response: "The Phase I covers all five communities in the portfolio.",
        communityIds: ["abc-cr", "abc-mp", "abc-hv", "abc-po", "abc-ss"],
        communityNames: ["Cedar Ridge", "Magnolia Place", "Harbor View", "Prairie Oaks", "Summit Springs"],
        submittedBy: "Morgan Blake", companyName: "ABCto123 Associates",
    },
    {
        id: "pc-2", transactionId: "txn-abc", transactionName: "ABC Company Portfolio",
        requestId: "DD-ABC-042", requestTitle: "Staffing roster and wage report",
        details: "Can the wage data be broken down by job classification rather than aggregated?",
        status: "Open", submittedAt: "2026-06-25", resolvedAt: null, response: null,
        communityIds: ["abc-hv", "abc-po"], communityNames: ["Harbor View", "Prairie Oaks"],
        submittedBy: "Alex Carter", companyName: "ABC Company",
    },
];

/* ── Mapping Helpers ────────────────────────────────────────── */

function mapRecapToPortalTxn(txn: RecapTransaction): PortalTransaction {
    return {
        id: txn.id,
        name: txn.name,
        description: txn.description,
        status: txn.status,
        sellerName: txn.sellerName,
        buyerName: txn.buyerName,
        brokerName: txn.brokerName,
        targetClose: txn.targetClose,
        totalRequests: txn.totalRequests,
        providedCount: txn.providedCount,
        inProgressCount: txn.inProgressCount,
        clarificationNeededCount: txn.clarificationNeededCount,
        communities: txn.communities.map((c) => ({ id: c.id, name: c.name })),
    };
}

function mapRecapToPortalRequest(req: RecapRequest): PortalRequest {
    const extInfo = getExternalStatusInfo(req);
    let portalStatus = extInfo.label;
    return {
        id: req.id,
        requestId: req.requestId,
        intakeId: req.intakeId,
        transactionId: req.transactionId,
        transactionName: req.transactionName,
        title: req.title,
        category: req.category,
        status: portalStatus,
        priority: req.priority,
        neededBy: req.dueDate,
        submittedAt: req.createdDate,
        updatedAt: req.lastUpdated,
        communityIds: req.communityIds,
        communityNames: req.communityNames,
        owner: req.owner,
        team: req.team,
        brokerBuyer: req.brokerBuyer,
        externalStatus: req._externalStatus,
        orgId: (req as any).orgId,
        orgName: (req as any).orgName,
        userId: (req as any).userId,
        userName: (req as any).userName,
        _publishedExternal: !!req._publishedExternal,
        _publishedWithoutDocuments: req._publishedWithoutDocuments,
        _publishedArtifactIds: req._publishedArtifactIds,
        _publishedExternalNote: req._publishedExternalNote,
        _completedBy: req._completedBy,
        _completedAt: req._completedAt,
        _completionNotes: req._completionNotes,
        _returnedBy: req._returnedBy,
        _returnReason: req._returnReason,
        _exceptionRecommendation: req._exceptionRecommendation ?? null,
        _exceptionSentAt: req._exceptionSentAt ?? null,
        _exceptionDecision: req._exceptionDecision ?? null,
        _exceptionDecisionAt: req._exceptionDecisionAt ?? null,
        _exceptionDecisionNote: req._exceptionDecisionNote ?? null,
        _exceptionReason: req._statusNotes ?? null,
        _archived: !!req._archived,
        _archiveReason: req._archiveReason ?? null,
        _archivedAt: req._archivedAt ?? null,
        _rawStatus: req.status,
        _workNotes: req._workNotes,
        _publishedAt: req._publishedAt ?? null,
        _partnerDecision: req._partnerDecision ?? null,
        _partnerNote: req._partnerNote ?? null,
        _partnerActionAt: req._partnerActionAt ?? null,
        _blockerReason: req._blockerReason ?? null,
        _blockerStatus: req._blockerStatus ?? null,
        _blockerExternalQuestion: req._blockerExternalQuestion ?? null,
        _blockerExternalResponse: req._blockerExternalResponse ?? null,
        _processingStartedAt: req._processingStartedAt ?? null,
    };
}

/** Convert a PortalRequest to the raw input shape expected by getExternalStatusInfo.
 *  Uses _rawStatus (internal) instead of status (external label) to ensure correct state machine evaluation. */
export function toExternalStatusInput(req: PortalRequest) {
    return {
        status: req._rawStatus || req.status,
        _exceptionRecommendation: req._exceptionRecommendation,
        _exceptionDecision: req._exceptionDecision,
        _publishedExternal: req._publishedExternal,
        _externalStatus: req.externalStatus,
        _exceptionSentAt: req._exceptionSentAt,
        _publishedAt: req._publishedAt,
        _workNotes: req._workNotes,
        _blockerStatus: req._blockerStatus || (req._rawStatus === "Pending External" ? "Pending External" : null),
        _blockerExternalQuestion: req._blockerExternalQuestion,
        _blockerExternalResponse: req._blockerExternalResponse,
        _processingStartedAt: req._processingStartedAt,
        _archived: (req as any)._archived,
        _archiveReason: (req as any)._archiveReason,
    };
}

function mapRecapToPortalDocument(doc: RecapDocument): PortalDocument {
    return {
        id: doc.id,
        transactionId: doc.transactionId,
        transactionName: doc.transactionName,
        name: doc.name,
        category: doc.category,
        uploadedAt: doc.uploadedAt,
        size: doc.size,
        externalVisible: true,
        communityIds: doc.communityIds,
        communityNames: doc.communityNames,
        relatedRequestId: doc.requestId,
        relatedRequestTitle: doc.requestTitle,
        sharePointUrl: doc.sharePointUrl,
    };
}

/* ── Data Retrieval ─────────────────────────────────────────── */

/* ── Exported Functions ────────────────────────────────────── */

export function getPortalUserContext(): PortalUserContext {
    const persona = getActivePersona();
    if (!isRecapDataWiped() && !isDemoActive()) {
        initDemo();
    }
    const transactions = getTransactions().map(mapRecapToPortalTxn);
    return {
        displayName: persona.displayName,
        email: persona.email,
        companyName: persona.companyName,
        role: persona.role,
        transactions,
    };
}

export function getPortalTransactions(): PortalTransaction[] {
    if (!isRecapDataWiped() && !isDemoActive()) {
        initDemo();
    }
    return getTransactions().map(mapRecapToPortalTxn);
}

export function getPortalRequests(): PortalRequest[] {
    if (!isRecapDataWiped() && !isDemoActive()) {
        initDemo();
    }
    const requests = getRequests();
    const allRequests = [...MOCK_REQUESTS, ...requests.map(mapRecapToPortalRequest)];

    // Filter by persona's authorized transactions for data isolation
    const identity = getPersonaIdentity();
    if (identity && identity.authorizedTransactions.length > 0) {
        const authorizedTxnIds = new Set(identity.authorizedTransactions.map(a => a.transactionId));
        return allRequests.filter(r => authorizedTxnIds.has(r.transactionId));
    }

    return allRequests;
}

export function getPortalRequestsByTransaction(transactionId: string): PortalRequest[] {
    return getPortalRequests().filter((r) => r.transactionId === transactionId);
}

export function getPortalQuestions(): PortalQuestion[] {
    return MOCK_QUESTIONS;
}

export function getPortalClarifications(): PortalClarification[] {
    return MOCK_CLARIFICATIONS;
}

export function getPortalDocuments(): PortalDocument[] {
    if (!isRecapDataWiped() && !isDemoActive()) {
        initDemo();
    }
    const documents = getDocuments();
    const allDocs = documents.map(mapRecapToPortalDocument).filter((d) => d.externalVisible !== false);

    // Filter by persona's authorized transactions for data isolation
    const identity = getPersonaIdentity();
    if (identity && identity.authorizedTransactions.length > 0) {
        const authorizedTxnIds = new Set(identity.authorizedTransactions.map(a => a.transactionId));
        return allDocs.filter(d => authorizedTxnIds.has(d.transactionId));
    }

    return allDocs;
}

export function getPortalDocumentsByTransaction(transactionId: string): PortalDocument[] {
    return getPortalDocuments().filter((d) => d.transactionId === transactionId);
}

export function submitPortalQuestion(data: {
    transactionId: string;
    communityIds: string[];
    communityNames: string[];
    questionType: string;
    subject: string;
    details: string;
}): void {
    const persona = getActivePersona();
    const q: PortalQuestion = {
        id: `pq-${Date.now()}`,
        transactionId: data.transactionId,
        transactionName: "ABC Company Portfolio",
        questionType: data.questionType,
        subject: data.subject,
        details: data.details,
        status: "Open",
        submittedAt: new Date().toISOString().split("T")[0],
        answeredAt: null,
        answer: null,
        communityIds: data.communityIds,
        communityNames: data.communityNames,
        submittedBy: persona.displayName,
        companyName: persona.companyName,
    };
    MOCK_QUESTIONS.unshift(q);
}

export function submitPortalClarification(data: {
    transactionId: string;
    communityIds: string[];
    communityNames: string[];
    requestId: string;
    requestTitle: string;
    details: string;
}): void {
    const persona = getActivePersona();
    const c: PortalClarification = {
        id: `pc-${Date.now()}`,
        transactionId: data.transactionId,
        transactionName: "ABC Company Portfolio",
        requestId: data.requestId,
        requestTitle: data.requestTitle,
        details: data.details,
        status: "Open",
        submittedAt: new Date().toISOString().split("T")[0],
        resolvedAt: null,
        response: null,
        communityIds: data.communityIds,
        communityNames: data.communityNames,
        submittedBy: persona.displayName,
        companyName: persona.companyName,
    };
    MOCK_CLARIFICATIONS.unshift(c);
}

export function submitPortalNewRequest(data: {
    transactionId: string;
    communityIds: string[];
    communityNames: string[];
    category: string;
    title: string;
    details: string;
    priority: string;
    neededBy: string;
}): void {
    const persona = getActivePersona();
    const users = getExternalUsers();
    const identityUser = users.find(u => u.email === persona.email);
    const newReq: PortalRequest = {
        id: `pr-${Date.now()}`,
        requestId: `DD-PORTAL-${Math.floor(Math.random() * 9000) + 1000}`,
        intakeId: `INT-PORTAL-${Date.now()}`,
        transactionId: data.transactionId,
        transactionName: "ABC Company Portfolio",
        title: data.title,
        category: data.category,
        status: "Intake Review",
        priority: data.priority,
        neededBy: data.neededBy,
        submittedAt: new Date().toISOString().split("T")[0],
        updatedAt: new Date().toISOString().split("T")[0],
        communityIds: data.communityIds,
        communityNames: data.communityNames,
        owner: null,
        team: "DD Management",
        brokerBuyer: persona.companyName,
        _rawStatus: "Intake Review",
        _workNotes: [],
        orgId: identityUser?.organizationId,
        orgName: identityUser?.organizationName,
        userId: identityUser?.id,
        userName: identityUser?.displayName,
    };
    MOCK_REQUESTS.unshift(newReq);
}

export interface PortalPackageSubmission {
    id: string;
    fileName: string;
    packageName: string;
    submittedAt: string;
    requestCount: number;
    status: "Draft" | "Analyzed" | "Submitted";
    transactionName: string;
    isABCDemo: boolean;
    orgId?: string;
    orgName?: string;
    userId?: string;
    userName?: string;
}

/* ── XLSX Parsing ───────────────────────────────────────────── */

export interface ParseDiagnostics {
    fileName: string;
    fileSize: number;
    sheetNames: string[];
    selectedSheet: string;
    rawHeaders: string[];
    normalizedHeaders: Record<string, string>;
    totalPhysicalRows: number;
    acceptedCount: number;
    skippedCount: number;
    skipReasons: { rowIndex: number; reason: string; sampleValues: Record<string, string> }[];
    firstTenAccepted: Record<string, string>[];
    firstTenSkipped: { rowIndex: number; values: Record<string, string>; reason: string }[];
}

function isSectionHeader(text: string): boolean {
    const trimmed = text.trim();
    if (!trimmed) return false;
    if (/^[IVXLCDM]+\.?\s*$/i.test(trimmed)) return true;
    if (/^[A-Z]\s*\.?\s*$/.test(trimmed)) return true;
    if (/^(SECTION|PART|EXHIBIT|ATTACHMENT|SCHEDULE)\b/i.test(trimmed)) return true;
    if (trimmed.length < 3) return true;
    if (/^[A-Z\s]{4,}$/.test(trimmed) && trimmed.length < 30) return true;
    return false;
}

function isMeaningfulRequestText(text: string): boolean {
    const trimmed = text.trim();
    if (!trimmed) return false;
    if (trimmed.length < 5) return false;
    if (isSectionHeader(trimmed)) return false;
    const lower = trimmed.toLowerCase();
    if (lower.startsWith("note:") || lower.startsWith("notes:") || lower.startsWith("reference:") || lower.startsWith("source:")) return false;
    if (/^(instructions|directions|overview|background|introduction|summary|conclusion)/i.test(trimmed)) return false;
    return true;
}

export async function parseUploadedXLSX(file: File): Promise<{
    headers: string[];
    rows: Record<string, string>[];
    sheetName: string;
    count: number;
    diagnostics: ParseDiagnostics;
}> {
    const XLSX = await import("xlsx");
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });

    const sheetNames = workbook.SheetNames;
    const selectedSheet = sheetNames.find(n => n.toLowerCase().includes("dd requests")) || sheetNames[0];
    const sheet = workbook.Sheets[selectedSheet];

    const ref = sheet["!ref"];
    const totalPhysicalRows = ref ? XLSX.utils.decode_range(ref).e.r + 1 : 0;

    const jsonRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    const rawHeaders: string[] = jsonRows.length > 0
        ? jsonRows[0].map((h: any) => (h !== null && h !== undefined ? String(h).trim() : ""))
        : [];

    // Try header-based parsing first
    const headerMap: Record<string, string> = {};
    rawHeaders.forEach((h, i) => {
        const clean = h.trim();
        if (!clean) return;
        const lower = clean.toLowerCase().replace(/[\/\s\-_]+/g, " ");
        if (lower.includes("owner") || lower.includes("seller")) headerMap[`col_${i}`] = "Owner / Seller";
        else if (lower === "buyer") headerMap[`col_${i}`] = "Buyer";
        else if (lower === "broker") headerMap[`col_${i}`] = "Broker";
        else if (lower.includes("request") && lower.includes("title")) headerMap[`col_${i}`] = "Request Title";
        else if (lower === "description" || lower.includes("description")) headerMap[`col_${i}`] = "Description";
        else if (lower === "priority" || lower.includes("priority")) headerMap[`col_${i}`] = "Priority";
        else if (lower.includes("suggested") && (lower.includes("team") || lower.includes("group"))) headerMap[`col_${i}`] = "Suggested Team";
        else if (lower.includes("suggested") && lower.includes("owner")) headerMap[`col_${i}`] = "Suggested Internal Owner";
        else if (lower.includes("due") || lower.includes("date")) headerMap[`col_${i}`] = "Due Date";
        else if (lower === "notes" || lower.includes("notes")) headerMap[`col_${i}`] = "Notes";
        else if (lower.includes("category")) headerMap[`col_${i}`] = "Category";
        else headerMap[`col_${i}`] = clean;
    });

    const normalizedHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(headerMap)) normalizedHeaders[k] = v;

    const accepted: Record<string, string>[] = [];
    const skipReasons: { rowIndex: number; reason: string; sampleValues: Record<string, string> }[] = [];

    let nonEmptyDataRows = 0;
    for (let i = 1; i < jsonRows.length; i++) {
        const rawRow: any[] | undefined = jsonRows[i];
        if (!rawRow) continue;
        if (rawRow.some((c: any) => c !== null && c !== undefined && String(c).trim().length > 0)) {
            nonEmptyDataRows++;
        }
    }

    const useHeaderParsing = nonEmptyDataRows > 0;

    if (useHeaderParsing) {
        for (let i = 1; i < jsonRows.length; i++) {
            const rawRow: any[] | undefined = jsonRows[i];
            if (!rawRow || rawRow.length === 0) {
                skipReasons.push({ rowIndex: i, reason: "Empty row (null/undefined)", sampleValues: {} });
                continue;
            }

            const row: Record<string, string> = {};
            let hasAnyValue = false;
            const numCols = Math.max(rawHeaders.length, rawRow.length);
            for (let ci = 0; ci < numCols; ci++) {
                const val = ci < rawRow.length ? rawRow[ci] : undefined;
                const strVal = val !== null && val !== undefined ? String(val).trim() : "";
                const key = ci < rawHeaders.length ? headerMap[`col_${ci}`] : undefined;
                if (key) {
                    row[key] = strVal;
                } else {
                    const fallbackKey = rawHeaders[ci] || `Column_${ci}`;
                    row[fallbackKey] = strVal;
                }
                if (strVal.length > 0) hasAnyValue = true;
            }

            if (!hasAnyValue) {
                skipReasons.push({ rowIndex: i, reason: "All cells empty", sampleValues: {} });
                continue;
            }

            const hasTitle = (row["Request Title"] || "").trim().length > 0;
            const hasDesc = (row["Description"] || "").trim().length > 0;
            const hasNotes = (row["Notes"] || "").trim().length > 0;

            if (!hasTitle && !hasDesc && !hasNotes) {
                const contentCols = Object.entries(row).filter(([_, v]) => v.trim().length > 0).map(([k]) => k);
                skipReasons.push({
                    rowIndex: i,
                    reason: contentCols.length > 0
                        ? `Row has data in [${contentCols.join(", ")}] but missing Request Title, Description, AND Notes`
                        : "No content in Request Title, Description, or Notes columns",
                    sampleValues: row,
                });
                continue;
            }

            accepted.push(row);
        }
    }

    // If header-based parsing yielded few rows, fall back to positional semi-structured parsing
    const headerAcceptanceRate = nonEmptyDataRows > 0 ? accepted.length / nonEmptyDataRows : 0;
    if (accepted.length === 0 || headerAcceptanceRate < 0.2) {
        accepted.length = 0;
        skipReasons.length = 0;

        let currentCategory = "";
        const romanNumeral = /^[IVXLCDM]+\.?\s*$/i;
        const singleLetter = /^[A-Z]\s*\.?\s*$/;

        for (let i = 1; i < jsonRows.length; i++) {
            const rawRow: any[] | undefined = jsonRows[i];
            if (!rawRow) {
                skipReasons.push({ rowIndex: i, reason: "Empty row", sampleValues: {} });
                continue;
            }

            const rowValues = rawRow.map((v: any) => v !== null && v !== undefined ? String(v).trim() : "");
            if (rowValues.every((v: string) => !v)) {
                skipReasons.push({ rowIndex: i, reason: "All cells empty", sampleValues: {} });
                continue;
            }

            const firstCell = rowValues[0] || "";
            const secondCell = rowValues[1] || "";

            // Detect section header: first cell is a section marker
            const isRoman = romanNumeral.test(firstCell) || romanNumeral.test(secondCell);
            const isSingleLetter = singleLetter.test(firstCell);
            const isAllCapsShort = /^[A-Z\s]{3,40}$/.test(firstCell) && firstCell.length >= 3 && firstCell.length <= 40;
            if (isRoman || isSingleLetter || isAllCapsShort) {
                if (firstCell && !isRoman && !isSingleLetter) {
                    currentCategory = firstCell;
                }
                continue;
            }

            // Check if this is a section/instruction row
            const firstLower = firstCell.toLowerCase();
            if (/^(section|part|exhibit|attachment|schedule|instructions|directions|overview|background|introduction|summary|conclusion|notes?|references?)\b/i.test(firstCell)) {
                if (firstCell && firstLower.startsWith("section") || firstLower.startsWith("part") || firstLower.startsWith("exhibit")) {
                    currentCategory = firstCell;
                }
                continue;
            }

            // Primary text: prefer column E (index 4) if meaningful, else first non-empty meaningful column
            let primaryText = "";
            let responsibleParty = "";
            let comments = "";
            let source = "";
            let status = "";

            if (rowValues[4] && isMeaningfulRequestText(rowValues[4])) {
                primaryText = rowValues[4];
            } else {
                for (let ci = 0; ci < Math.min(rowValues.length, 6); ci++) {
                    if (ci === 1 || ci === 2) continue;
                    if (rowValues[ci] && isMeaningfulRequestText(rowValues[ci])) {
                        primaryText = rowValues[ci];
                        break;
                    }
                }
            }

            if (!primaryText) {
                const filledCols = rowValues.map((v: string, idx: number) => v ? `col_${idx}` : "").filter(Boolean);
                skipReasons.push({
                    rowIndex: i,
                    reason: filledCols.length > 0 ? `Row has data in [${filledCols.join(", ")}] but no meaningful request text` : "No meaningful request text detected",
                    sampleValues: Object.fromEntries(rowValues.map((v: string, idx: number) => [`col_${idx}`, v]).filter(([_, v]) => v)),
                });
                continue;
            }

            responsibleParty = rowValues[5] || "";
            comments = rowValues[6] || "";
            source = rowValues[7] || "";
            status = rowValues[8] || "";

            const row: Record<string, string> = {
                "Request Title": primaryText,
                "Description": "",
                "Notes": comments,
                "Category": currentCategory,
                "Owner / Seller": responsibleParty,
                "Suggested Internal Owner": responsibleParty,
                "Source / Reference": source,
                "Status": status,
            };

            if (rowValues[1] && !romanNumeral.test(rowValues[1]) && !singleLetter.test(rowValues[1]) && rowValues[1].length > 3) {
                row["Category"] = rowValues[1];
            }
            if (rowValues[2] && !romanNumeral.test(rowValues[2]) && !singleLetter.test(rowValues[2]) && rowValues[2].length > 3) {
                if (!row["Category"]) row["Category"] = rowValues[2];
            }

            accepted.push(row);
        }
    }

    const firstTenSkipped: { rowIndex: number; values: Record<string, string>; reason: string }[] = [];
    for (let si = 0; si < Math.min(skipReasons.length, 10); si++) {
        const sr = skipReasons[si];
        firstTenSkipped.push({ rowIndex: sr.rowIndex, values: sr.sampleValues, reason: sr.reason });
    }

    const diagnostics: ParseDiagnostics = {
        fileName: file.name,
        fileSize: file.size,
        sheetNames,
        selectedSheet,
        rawHeaders,
        normalizedHeaders,
        totalPhysicalRows,
        acceptedCount: accepted.length,
        skippedCount: skipReasons.length,
        skipReasons: skipReasons.slice(0, 50),
        firstTenAccepted: accepted.slice(0, 10),
        firstTenSkipped,
    };

    console.log("=== XLSX Parse Diagnostics ===");
    console.log("File:", file.name, `(${(file.size / 1024).toFixed(1)} KB)`);
    console.log("Sheet names:", sheetNames);
    console.log("Selected sheet:", selectedSheet);
    console.log("Total physical rows:", totalPhysicalRows);
    console.log("Non-empty data rows:", nonEmptyDataRows);
    console.log("Header row:", rawHeaders);
    console.log("Normalized headers:", normalizedHeaders);
    console.log("Parsing mode:", useHeaderParsing ? (headerAcceptanceRate >= 0.2 ? "header-based" : "positional (fallback)") : "positional");
    console.log("Accepted rows:", accepted.length);
    console.log("Skipped rows:", skipReasons.length);
    console.log("First 10 accepted:", accepted.slice(0, 10));
    console.log("First 10 skip reasons:", skipReasons.slice(0, 10));
    console.log("================================");

    return {
        headers: Object.values(normalizedHeaders).filter((h): h is string => h.length > 0),
        rows: accepted,
        sheetName: selectedSheet,
        count: accepted.length,
        diagnostics,
    };
}

function detectCategoryFromTitle(title: string, description: string): string {
    const text = (title + " " + description).toLowerCase();

    const rules: [RegExp, string][] = [
        [/payroll|pay.?roll/, "Financial Statements"],
        [/audited financial|financial statement|financials/, "Financial Statements"],
        [/debt|a\/?r\b|accounts? receivable|bank statement|expense history/, "Financial Statements"],
        [/profit.*loss|p&l|balance sheet|cash flow/, "Financial Statements"],
        [/license|permit|regulatory/, "Regulatory / Licenses"],
        [/survey report|state survey/, "Regulatory / Licenses"],
        [/compliance/, "Regulatory / Licenses"],
        [/insurance|certificate of insurance|coi\b/, "Insurance"],
        [/clinical|care plan|incident log|resident|survey results/, "Clinical"],
        [/hr\b|human resources?|employee|roster|benefits|staffing|handbook/, "HR / Staffing"],
        [/contract|vendor agreement|service agreement/, "Contracts / Legal"],
        [/litigation|legal|governance/, "Legal"],
        [/maintenance|physical plant|utility|facilities|floor plan/, "Physical Plant / Facilities"],
        [/environmental|phase i|esa|asbestos/, "Environmental"],
        [/marketing|census|occupancy|sales/, "Marketing / Operations"],
        [/policy|procedure|guideline|standard/, "HR / Staffing"],
        [/template/, "HR / Staffing"],
        [/certificate/, "Insurance"],
        [/osha/, "Regulatory / Licenses"],
        [/benefit summary/, "HR / Staffing"],
    ];

    for (const [pattern, category] of rules) {
        if (pattern.test(text)) {
            return category;
        }
    }
    return "";
}

function detectTeamFromCategory(category: string): string {
    const map: Record<string, string> = {
        "Financial Statements": "Financial Analysis",
        "Regulatory / Licenses": "Regulatory",
        "Insurance": "Risk Management",
        "Clinical": "HR & Operations",
        "HR / Staffing": "HR & Operations",
        "Contracts / Legal": "Risk Management",
        "Legal": "Risk Management",
        "Physical Plant / Facilities": "Environmental",
        "Environmental": "Environmental",
        "Marketing / Operations": "HR & Operations",
    };
    return map[category] || "";
}

export function mapParsedRowToRecapRequest(
    row: Record<string, string>,
    submissionId: string,
    index: number,
    fileBaseName: string,
    packageName: string,
    orgId?: string,
    orgName?: string,
    userId?: string,
    userName?: string,
): RecapRequest {
    const prefix = fileBaseName.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5) || "PKG";
    const subHash = submissionId.replace('sub-', '').slice(-4);
    const rawPriority = String(row["Priority"] || "").toLowerCase();
    const priority: RecapRequest["priority"] = rawPriority.includes("high") ? "High" : rawPriority.includes("low") ? "Low" : "Medium";
    const rawDate = row["Due Date"] || "";
    const dueDate = rawDate ? new Date(rawDate).toISOString().split("T")[0] : new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];
    const now = new Date().toISOString().split("T")[0];
    const rawTitle = String(row["Request Title"] || row["Title"] || "").trim();
    const rawDesc = String(row["Description"] || "").trim();
    let title = rawTitle;
    if (!title && rawDesc) {
        title = rawDesc.replace(/\s+(for|at|in|–)\s+[A-Z][A-Za-z\s-]+\.?$/i, "").trim();
    }
    if (!title) {
        title = `Request ${index}`;
    }
    const category = row["Category"] || detectCategoryFromTitle(title, rawDesc) || "Unclassified";
    const ownerVal = String(row["Suggested Internal Owner"] || row["Owner / Seller"] || "").trim() || null;
    return {
        id: `${submissionId}-req-${index}`,
        requestId: `DD-${prefix}-${subHash}-${String(index).padStart(3, "0")}`,
        intakeId: `INT-${prefix}-${index}`,
        transactionId: `txn-portal-${submissionId}`,
        transactionName: packageName,
        brokerBuyer: "External",
        communityIds: [],
        communityNames: [],
        category,
        title,
        description: rawDesc,
        owner: ownerVal,
        team: detectTeamFromCategory(category) || String(row["Suggested Team"] || "").trim() || "",
        status: "Open",
        priority,
        dueDate,
        lastUpdated: now,
        externalVisible: true,
        submittedBy: String(row["Broker"] || "External Portal").trim(),
        source: "External",
        createdDate: now,
        assignedTo: ownerVal,
        _publishedAt: null,
        ...(orgId ? { orgId, orgName, userId, userName } : {}),
    };
}

export function extractCategoriesFromParsedRows(rows: Record<string, string>[]): string[] {
    const cats = new Set<string>();
    rows.forEach(r => {
        if (r["Category"]) cats.add(r["Category"]);
    });
    const result = [...cats].filter(Boolean);
    return result.length > 0 ? result : ["Financial Statements", "Licenses", "Environmental", "Insurance", "Legal", "HR / Staffing"];
}

export function saveParsedRows(rows: Record<string, string>[]): void {
    localStorage.setItem(PARSED_ROWS_KEY, JSON.stringify(rows));
}
export function getParsedRows(): Record<string, string>[] {
    try { const raw = localStorage.getItem(PARSED_ROWS_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
}
export function clearParsedRows(): void {
    localStorage.removeItem(PARSED_ROWS_KEY);
}

/* ── Portal Package Submission Helpers ────────────────────────── */

function generatePortalRequests(submissionId: string, packageName: string, fileBaseName: string, count: number, orgId?: string, orgName?: string, userId?: string, userName?: string): RecapRequest[] {
    const communityNames = ["Cedar Ridge", "Magnolia Place", "Harbor View", "Prairie Oaks", "Summit Springs"];
    const categories = ["Financial Statements", "Licenses", "Environmental", "Insurance", "Legal", "HR / Staffing", "Physical Plant", "Regulatory", "Operations", "Marketing"];
    const teams = ["Financial Analysis", "Regulatory", "Environmental", "Risk Management", "HR & Operations", "DD Management"];
    const priorities: RecapRequest["priority"][] = ["High", "Medium", "Low"];
    const statuses: RecapRequest["status"][] = ["Open", "In Progress", "Provided", "Clarification Needed", "Under Review", "Overdue"];
    const now = new Date().toISOString().split("T")[0];
    const prefix = fileBaseName.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5) || "PKG";
    const subHash = submissionId.replace('sub-', '').slice(-4);
    const requests: RecapRequest[] = [];
    for (let i = 1; i <= count; i++) {
        const cat = categories[(i - 1) % categories.length];
        const community = communityNames[(i - 1) % communityNames.length];
        const team = teams[(i - 1) % teams.length];
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        const priority = priorities[Math.floor(Math.random() * priorities.length)];
        requests.push({
            id: `${submissionId}-req-${i}`,
            requestId: `DD-${prefix}-${subHash}-${String(i).padStart(3, "0")}`,
            intakeId: `INT-${prefix}-${i}`,
            transactionId: `txn-portal-${submissionId}`,
            transactionName: packageName,
            brokerBuyer: "External",
            communityIds: [],
            communityNames: [community],
            category: cat,
            title: `${packageName} - Request ${i} (${cat})`,
            description: `Auto-generated request for ${packageName}. Category: ${cat}. Community: ${community}.`,
            owner: null,
            team,
            status,
            priority,
            dueDate: new Date(Date.now() + (Math.floor(Math.random() * 60) + 5) * 86400000).toISOString().split("T")[0],
            lastUpdated: now,
            externalVisible: Math.random() > 0.2,
            submittedBy: "External Portal",
            source: "External",
            createdDate: now,
            assignedTo: null,
            _publishedAt: null,
            ...(orgId ? { orgId, orgName, userId, userName } : {}),
        });
    }
    return requests;
}

function createPortalIntakeItem(submissionId: string, packageName: string, fileName: string, requestCount: number, isABCDemo: boolean): RecapIntakeItem {
    return {
        id: `${submissionId}-intake`,
        intakeId: `INT-PKG-${submissionId.slice(0, 8)}`,
        type: "Broker Upload",
        status: "Awaiting Review",
        title: `${packageName}${isABCDemo ? " (Gold Standard Demo)" : ""}`,
        description: `${isABCDemo ? "Gold standard due diligence package" : "Package uploaded via external portal"} containing ${requestCount} DD request items.`,
        transactionId: isABCDemo ? "txn-abc" : `txn-portal-${submissionId}`,
        transactionName: packageName,
        submittedBy: "External Portal",
        submittedAt: new Date().toISOString(),
        assignedTo: null,
        communityNames: ["Cedar Ridge", "Magnolia Place", "Harbor View", "Prairie Oaks", "Summit Springs"],
        priority: "High",
        fileName,
        rowsFound: requestCount,
    };
}

export function submitBrokerUploadPackage(
    fileName?: string,
    parsedCount?: number,
    parsedCategories?: string[]
): {
    submissionId: string;
    detected: number;
    needsReview: number;
    duplicates: number;
    followUp: number;
    categories: string[];
    packageName: string;
    isABCDemo: boolean;
} {
    const submissionId = `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    // ABC Demo flow — unchanged
    if (!fileName || fileName === "ABC Gold Standard Demo Package") {
        if (!isRecapDataWiped() && !isDemoActive()) initDemo();
        const summary = getDemoEngineSummary();
        const submission: PortalPackageSubmission = {
            id: submissionId,
            fileName: "ABC_Company_Portfolio_Gold_Standard_DD_Package.xlsx",
            packageName: "ABC Company Portfolio",
            submittedAt: new Date().toISOString(),
            requestCount: summary.total,
            status: "Analyzed",
            transactionName: "ABC Company Portfolio",
            isABCDemo: true,
        };
        addPortalSubmission(submission);
        return {
            submissionId,
            detected: summary.total,
            needsReview: summary.needsReview,
            duplicates: summary.possibleDuplicates,
            followUp: summary.needsFollowUp,
            categories: Object.keys(summary.categories),
            packageName: "ABC Company Portfolio",
            isABCDemo: true,
        };
    }

    // Custom uploaded package
    const fileBaseName = fileName.replace(/\.[^.]+$/, "").trim();
    const packageName = fileBaseName;
    const requestCount = parsedCount ?? 0;

    const persona = getActivePersona();
    const users = getExternalUsers();
    const identityUser = users.find(u => u.email === persona.email);

    const submission: PortalPackageSubmission = {
        id: submissionId,
        fileName,
        packageName,
        submittedAt: new Date().toISOString(),
        requestCount,
        status: "Analyzed",
        transactionName: packageName,
        isABCDemo: false,
        orgId: identityUser?.organizationId,
        orgName: identityUser?.organizationName,
        userId: identityUser?.id,
        userName: identityUser?.displayName,
    };
    addPortalSubmission(submission);

    const categories = parsedCategories && parsedCategories.length > 0
        ? parsedCategories
        : ["Financial Statements", "Licenses", "Environmental", "Insurance", "Legal", "HR / Staffing", "Physical Plant", "Regulatory", "Operations", "Marketing"];
    return {
        submissionId,
        detected: requestCount,
        needsReview: Math.floor(requestCount * 0.4),
        duplicates: Math.floor(requestCount * 0.08),
        followUp: Math.floor(requestCount * 0.12),
        categories,
        packageName,
        isABCDemo: false,
    };
}

export function confirmBrokerPackage(submissionId?: string): void {
    if (!submissionId) {
        if (!isRecapDataWiped() && !isDemoActive()) initDemo();
        return;
    }

    const submissions = getPortalSubmissions();
    const sub = submissions.find(s => s.id === submissionId);
    if (!sub) return;

    const persona = getActivePersona();
    const users = getExternalUsers();
    const identityUser = users.find(u => u.email === persona.email);

    if (sub.isABCDemo) {
        if (!isRecapDataWiped() && !isDemoActive()) initDemo();
        updatePortalSubmissionStatus(submissionId, "Submitted");
        addActivityEntry({
            type: "Submission",
            description: `Package submitted successfully: ${sub.packageName} (${sub.requestCount} requests)`,
            userId: "portal",
            userName: "Portal User",
            requestId: null,
            requestTitle: null,
            transactionId: sub.isABCDemo ? "txn-abc" : `txn-portal-${submissionId}`,
            transactionName: sub.packageName,
        });
        return;
    }

    // Custom package: create intake item + review item (not tracker) records
    const fileBaseName = sub.fileName.replace(/\.[^.]+$/, "").trim();
    const parsedRows = getParsedRows();
    let reviewItems: RecapRequest[];
    if (parsedRows.length > 0) {
        reviewItems = parsedRows.map((row, i) => mapParsedRowToRecapRequest(
            row, submissionId, i + 1, fileBaseName, sub.packageName,
            identityUser?.organizationId, identityUser?.organizationName, identityUser?.id, identityUser?.displayName,
        ));
    } else {
        reviewItems = generatePortalRequests(submissionId, sub.packageName, fileBaseName, sub.requestCount,
            identityUser?.organizationId, identityUser?.organizationName, identityUser?.id, identityUser?.displayName);
    }
    clearParsedRows();
    // Review items are kept for the intake review grid but have _publishedAt: null so they don't appear in tracker
    addPortalCreatedRequests(reviewItems);
    const intakeItem = createPortalIntakeItem(submissionId, sub.packageName, sub.fileName, reviewItems.length, false);

    addPortalCreatedIntakeItem(intakeItem);
    updatePortalSubmissionStatus(submissionId, "Submitted");
    addActivityEntry({
        type: "Submission",
        description: `Package submitted successfully: ${sub.packageName} (${reviewItems.length} requests)`,
        userId: "portal",
        userName: "Portal User",
        requestId: null,
        requestTitle: null,
        transactionId: `txn-portal-${submissionId}`,
        transactionName: sub.packageName,
    });
}

export function loadABCDemoPackage(): void {
    clearRecapWiped();
    initDemo();
}

export function getPortalSubmissionsList(): PortalPackageSubmission[] {
    return getPortalSubmissions();
}

export function getOnlyPortalCreatedRequests(): PortalRequest[] {
    return [...MOCK_REQUESTS];
}

export function clearPortalSubmissions(): void {
    clearAllPortalCreatedData();
    localStorage.removeItem(ORGS_KEY);
    localStorage.removeItem(USERS_KEY);
    localStorage.removeItem(MEMBERSHIPS_KEY);
    localStorage.removeItem(TRANSACTIONS_KEY);
    localStorage.removeItem(TXN_ACCESS_KEY);
    // Also clear in-memory portal-created requests for this session
    MOCK_REQUESTS.length = 0;
}

// Re-export partner lifecycle functions so UI components import from a single module
export { partnerApproveRequest, partnerReworkRequest, partnerExceptionDecision } from "./recapDataService";

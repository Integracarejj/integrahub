import { isDemoActive, getDemoTransaction, getDemoRequests, getDemoDocuments, initDemo, publishIntake, getDemoEngineSummary, addPortalCreatedIntakeItem, addPortalCreatedRequests, addPortalSubmission, getPortalSubmissions, updatePortalSubmissionStatus, clearAllPortalCreatedData } from "./recapDataService";
import type { RecapRequest, RecapDocument, RecapTransaction, RecapIntakeItem } from "./recapDataService";

const PERSONA_KEY = "integrasource.recap.portalPersona";

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

const ABC_TXN_ID = "txn-abc";

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
    return {
        id: req.id,
        requestId: req.requestId,
        intakeId: req.intakeId,
        transactionId: req.transactionId,
        transactionName: req.transactionName,
        title: req.title,
        category: req.category,
        status: req.status,
        priority: req.priority,
        neededBy: req.dueDate,
        submittedAt: req.createdDate,
        updatedAt: req.lastUpdated,
        communityIds: req.communityIds,
        communityNames: req.communityNames,
        owner: req.owner,
        team: req.team,
        brokerBuyer: req.brokerBuyer,
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

function getRecapData(): { txn: RecapTransaction | null; requests: RecapRequest[]; documents: RecapDocument[] } {
    if (!isDemoActive()) {
        initDemo();
    }
    return {
        txn: getDemoTransaction(),
        requests: getDemoRequests(),
        documents: getDemoDocuments(),
    };
}

/* ── Exported Functions ────────────────────────────────────── */

export function getPortalUserContext(): PortalUserContext {
    const persona = getActivePersona();
    const { txn } = getRecapData();
    const transactions = txn ? [mapRecapToPortalTxn(txn)] : [];
    return {
        displayName: persona.displayName,
        email: persona.email,
        companyName: persona.companyName,
        role: persona.role,
        transactions,
    };
}

export function getPortalTransactions(): PortalTransaction[] {
    const { txn } = getRecapData();
    return txn ? [mapRecapToPortalTxn(txn)] : [];
}

export function getPortalRequests(): PortalRequest[] {
    const { requests } = getRecapData();
    return [...MOCK_REQUESTS, ...requests.filter((r) => r.transactionId === ABC_TXN_ID).map(mapRecapToPortalRequest)];
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
    const { documents } = getRecapData();
    return documents.filter((d) => d.transactionId === ABC_TXN_ID).map(mapRecapToPortalDocument).filter((d) => d.externalVisible !== false);
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
    const newReq: PortalRequest = {
        id: `pr-${Date.now()}`,
        requestId: `DD-PORTAL-${Math.floor(Math.random() * 9000) + 1000}`,
        intakeId: `INT-PORTAL-${Date.now()}`,
        transactionId: data.transactionId,
        transactionName: "ABC Company Portfolio",
        title: data.title,
        category: data.category,
        status: "Under Review",
        priority: data.priority,
        neededBy: data.neededBy,
        submittedAt: new Date().toISOString().split("T")[0],
        updatedAt: new Date().toISOString().split("T")[0],
        communityIds: data.communityIds,
        communityNames: data.communityNames,
        owner: null,
        team: "DD Management",
        brokerBuyer: persona.companyName,
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
}

/* ── Portal Package Submission Helpers ────────────────────────── */

function generatePortalRequests(submissionId: string, packageName: string, fileBaseName: string, count: number): RecapRequest[] {
    const communityNames = ["Cedar Ridge", "Magnolia Place", "Harbor View", "Prairie Oaks", "Summit Springs"];
    const categories = ["Financial Statements", "Licenses", "Environmental", "Insurance", "Legal", "HR / Staffing", "Physical Plant", "Regulatory", "Operations", "Marketing"];
    const teams = ["Financial Analysis", "Regulatory", "Environmental", "Risk Management", "HR & Operations", "DD Management"];
    const priorities: RecapRequest["priority"][] = ["High", "Medium", "Low"];
    const statuses: RecapRequest["status"][] = ["Open", "In Progress", "Provided", "Clarification Needed", "Under Review", "Overdue"];
    const now = new Date().toISOString().split("T")[0];
    const prefix = fileBaseName.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5) || "PKG";
    const requests: RecapRequest[] = [];
    for (let i = 1; i <= count; i++) {
        const cat = categories[(i - 1) % categories.length];
        const community = communityNames[(i - 1) % communityNames.length];
        const team = teams[(i - 1) % teams.length];
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        const priority = priorities[Math.floor(Math.random() * priorities.length)];
        requests.push({
            id: `${submissionId}-req-${i}`,
            requestId: `DD-${prefix}-${String(i).padStart(3, "0")}`,
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

export function submitBrokerUploadPackage(fileName?: string): {
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
        if (!isDemoActive()) initDemo();
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
    const requestCount = Math.floor(Math.random() * 15) + 5;

    const submission: PortalPackageSubmission = {
        id: submissionId,
        fileName,
        packageName,
        submittedAt: new Date().toISOString(),
        requestCount,
        status: "Analyzed",
        transactionName: packageName,
        isABCDemo: false,
    };
    addPortalSubmission(submission);

    const categories = ["Financial Statements", "Licenses", "Environmental", "Insurance", "Legal", "HR / Staffing", "Physical Plant", "Regulatory", "Operations", "Marketing"];
    return {
        submissionId,
        detected: requestCount,
        needsReview: Math.floor(requestCount * 0.4),
        duplicates: Math.floor(requestCount * 0.08),
        followUp: Math.floor(requestCount * 0.12),
        categories: categories.slice(0, Math.min(5 + Math.floor(Math.random() * 4), categories.length)),
        packageName,
        isABCDemo: false,
    };
}

export function confirmBrokerPackage(submissionId?: string): void {
    if (!submissionId) {
        // Legacy ABC-only flow
        if (!isDemoActive()) initDemo();
        publishIntake();
        return;
    }

    const submissions = getPortalSubmissions();
    const sub = submissions.find(s => s.id === submissionId);
    if (!sub) return;

    if (sub.isABCDemo) {
        // Publish existing ABC demo
        if (!isDemoActive()) initDemo();
        publishIntake();
        updatePortalSubmissionStatus(submissionId, "Submitted");
        return;
    }

    // Custom package: create intake item + requests, persist
    const fileBaseName = sub.fileName.replace(/\.[^.]+$/, "").trim();
    const requests = generatePortalRequests(submissionId, sub.packageName, fileBaseName, sub.requestCount);
    const intakeItem = createPortalIntakeItem(submissionId, sub.packageName, sub.fileName, sub.requestCount, false);

    addPortalCreatedRequests(requests);
    addPortalCreatedIntakeItem(intakeItem);
    updatePortalSubmissionStatus(submissionId, "Submitted");
}

export function loadABCDemoPackage(): void {
    if (!isDemoActive()) initDemo();
}

export function getPortalSubmissionsList(): PortalPackageSubmission[] {
    return getPortalSubmissions();
}

export function clearPortalSubmissions(): void {
    clearAllPortalCreatedData();
    // Also clear in-memory portal-created requests for this session
    MOCK_REQUESTS.length = 0;
}

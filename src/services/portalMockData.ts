export interface PortalTransaction {
    id: string;
    name: string;
    description: string;
    status: "Active" | "Pending" | "Completed";
    buyerName: string;
    brokerName: string;
    targetClose: string;
    totalRequests: number;
    providedCount: number;
    inProgressCount: number;
    clarificationNeededCount: number;
}

export interface PortalRequest {
    id: string;
    transactionId: string;
    transactionName: string;
    title: string;
    category: string;
    status: "Provided" | "In Progress" | "Clarification Needed" | "Under Review";
    priority: "High" | "Medium" | "Low";
    neededBy: string;
    submittedAt: string;
    updatedAt: string;
}

export interface PortalQuestion {
    id: string;
    transactionId: string;
    transactionName: string;
    questionType: string;
    subject: string;
    details: string;
    status: "Open" | "Answered" | "Closed";
    submittedAt: string;
    answeredAt: string | null;
    answer: string | null;
}

export interface PortalClarification {
    id: string;
    transactionId: string;
    transactionName: string;
    requestId: string;
    requestTitle: string;
    details: string;
    status: "Open" | "Resolved";
    submittedAt: string;
    resolvedAt: string | null;
    response: string | null;
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
}

export interface PortalUserContext {
    displayName: string;
    email: string;
    companyName: string;
    role: string;
    transactions: PortalTransaction[];
}

const MOCK_TRANSACTIONS: PortalTransaction[] = [
    {
        id: "txn-001",
        name: "IntegraCare Midwest Portfolio",
        description: "Acquisition of 12 skilled nursing facilities across Ohio, Indiana, and Illinois.",
        status: "Active",
        buyerName: "Blue Harbor Capital",
        brokerName: "Healthcare Properties Group",
        targetClose: "Q3 2026",
        totalRequests: 24,
        providedCount: 14,
        inProgressCount: 6,
        clarificationNeededCount: 4,
    },
    {
        id: "txn-002",
        name: "Sunshine Senior Living - Phase 2",
        description: "Second-phase acquisition of 8 assisted living facilities in Florida.",
        status: "Active",
        buyerName: "Sunshine Senior Living LLC",
        brokerName: "Senior Care Advisors",
        targetClose: "Q4 2026",
        totalRequests: 18,
        providedCount: 9,
        inProgressCount: 7,
        clarificationNeededCount: 2,
    },
    {
        id: "txn-003",
        name: "Pine Ridge Rehabilitation Portfolio",
        description: "Due diligence for 5 rehabilitation and therapy centers in Texas.",
        status: "Pending",
        buyerName: "Pine Ridge Health Partners",
        brokerName: "MedFacilities Brokerage",
        targetClose: "Q1 2027",
        totalRequests: 8,
        providedCount: 2,
        inProgressCount: 5,
        clarificationNeededCount: 1,
    },
];

const MOCK_REQUESTS: PortalRequest[] = [
    { id: "req-001", transactionId: "txn-001", transactionName: "IntegraCare Midwest Portfolio", title: "Medicare Cost Reports (2023-2025)", category: "Financial", status: "Provided", priority: "High", neededBy: "2026-07-15", submittedAt: "2026-06-01", updatedAt: "2026-06-10" },
    { id: "req-002", transactionId: "txn-001", transactionName: "IntegraCare Midwest Portfolio", title: "State Survey Reports - Last 3 Years", category: "Compliance", status: "In Progress", priority: "High", neededBy: "2026-07-20", submittedAt: "2026-06-05", updatedAt: "2026-06-12" },
    { id: "req-003", transactionId: "txn-001", transactionName: "IntegraCare Midwest Portfolio", title: "Staffing Ratios by Facility", category: "Operational", status: "Clarification Needed", priority: "Medium", neededBy: "2026-07-25", submittedAt: "2026-06-08", updatedAt: "2026-06-14" },
    { id: "req-004", transactionId: "txn-001", transactionName: "IntegraCare Midwest Portfolio", title: "Payer Mix Analysis", category: "Financial", status: "Provided", priority: "High", neededBy: "2026-07-10", submittedAt: "2026-05-28", updatedAt: "2026-06-09" },
    { id: "req-005", transactionId: "txn-002", transactionName: "Sunshine Senior Living - Phase 2", title: "Licenses and Certifications", category: "Compliance", status: "In Progress", priority: "High", neededBy: "2026-09-01", submittedAt: "2026-06-10", updatedAt: "2026-06-15" },
    { id: "req-006", transactionId: "txn-001", transactionName: "IntegraCare Midwest Portfolio", title: "Property Appraisals", category: "Financial", status: "Under Review", priority: "Medium", neededBy: "2026-08-01", submittedAt: "2026-06-12", updatedAt: "2026-06-16" },
];

const MOCK_QUESTIONS: PortalQuestion[] = [
    { id: "q-001", transactionId: "txn-001", transactionName: "IntegraCare Midwest Portfolio", questionType: "Financial", subject: "Revenue recognition for managed care contracts", details: "How does IntegraCare recognize revenue for managed care contracts across the Midwest portfolio? Are there any deviations from standard GAAP?", status: "Answered", submittedAt: "2026-06-03", answeredAt: "2026-06-07", answer: "Revenue is recognized at the point of service under the accrual method. Managed care contracts follow standard GAAP with no material deviations. A detailed revenue recognition memo is available in the Financial section." },
    { id: "q-002", transactionId: "txn-001", transactionName: "IntegraCare Midwest Portfolio", questionType: "Operational", subject: "Staff turnover rates for nursing staff", details: "What are the annualized turnover rates for RNs and LPNs across the 12 facilities? Please provide for the last 3 fiscal years.", status: "Open", submittedAt: "2026-06-14", answeredAt: null, answer: null },
    { id: "q-003", transactionId: "txn-002", transactionName: "Sunshine Senior Living - Phase 2", questionType: "Legal", subject: "Pending litigation overview", details: "Please provide a summary of any pending or threatened litigation involving any of the 8 facilities in the Phase 2 portfolio.", status: "Answered", submittedAt: "2026-06-11", answeredAt: "2026-06-13", answer: "No material pending litigation exists. Two minor workers' compensation claims are in process and covered by insurance." },
];

const MOCK_CLARIFICATIONS: PortalClarification[] = [
    { id: "cl-001", transactionId: "txn-001", transactionName: "IntegraCare Midwest Portfolio", requestId: "req-003", requestTitle: "Staffing Ratios by Facility", details: "In the provided staffing data, it appears that Facility #7 (Columbus) shows a lower RN-to-patient ratio than the others. Can you confirm this is accurate and explain any mitigating factors?", status: "Open", submittedAt: "2026-06-15", resolvedAt: null, response: null },
    { id: "cl-002", transactionId: "txn-001", transactionName: "IntegraCare Midwest Portfolio", requestId: "req-001", requestTitle: "Medicare Cost Reports (2023-2025)", details: "The 2023 cost report for Facility #3 (Gary, IN) appears to be missing the supplemental Schedules A and B. Can you provide these?", status: "Resolved", submittedAt: "2026-06-08", resolvedAt: "2026-06-11", response: "The supplemental schedules were misfiled. We have uploaded the complete 2023 cost report with all schedules." },
];

const MOCK_DOCUMENTS: PortalDocument[] = [
    { id: "doc-001", transactionId: "txn-001", transactionName: "IntegraCare Midwest Portfolio", name: "2024_Financial_Statements_Audited.pdf", category: "Financial", uploadedAt: "2026-06-01", size: "4.2 MB", externalVisible: true },
    { id: "doc-002", transactionId: "txn-001", transactionName: "IntegraCare Midwest Portfolio", name: "CMS_Survey_Reports_2024.zip", category: "Compliance", uploadedAt: "2026-06-02", size: "12.8 MB", externalVisible: true },
    { id: "doc-003", transactionId: "txn-001", transactionName: "IntegraCare Midwest Portfolio", name: "Staffing_Data_By_Facility.xlsx", category: "Operational", uploadedAt: "2026-06-05", size: "1.6 MB", externalVisible: true },
    { id: "doc-004", transactionId: "txn-001", transactionName: "IntegraCare Midwest Portfolio", name: "Internal_Ownership_Analysis.pdf", category: "Internal", uploadedAt: "2026-06-03", size: "3.1 MB", externalVisible: false },
    { id: "doc-005", transactionId: "txn-002", transactionName: "Sunshine Senior Living - Phase 2", name: "Phase2_Licenses_2026.pdf", category: "Compliance", uploadedAt: "2026-06-10", size: "2.4 MB", externalVisible: true },
    { id: "doc-006", transactionId: "txn-002", transactionName: "Sunshine Senior Living - Phase 2", name: "DD_Room_Assessment.xlsx", category: "Operational", uploadedAt: "2026-06-11", size: "5.7 MB", externalVisible: true },
    { id: "doc-007", transactionId: "txn-001", transactionName: "IntegraCare Midwest Portfolio", name: "DD_Internal_Confidence_Scoring.pdf", category: "Internal", uploadedAt: "2026-06-04", size: "892 KB", externalVisible: false },
];

export function getPortalUserContext(): PortalUserContext {
    return {
        displayName: "Jeremy Morrison",
        email: "jeremy.morrison@blueharbor-capital.com",
        companyName: "Blue Harbor Capital",
        role: "ExternalBuyer",
        transactions: MOCK_TRANSACTIONS.filter(t => t.status !== "Completed"),
    };
}

export function getPortalTransactions(): PortalTransaction[] {
    return MOCK_TRANSACTIONS;
}

export function getPortalRequests(): PortalRequest[] {
    return MOCK_REQUESTS;
}

export function getPortalRequestsByTransaction(transactionId: string): PortalRequest[] {
    return MOCK_REQUESTS.filter(r => r.transactionId === transactionId);
}

export function getPortalQuestions(): PortalQuestion[] {
    return MOCK_QUESTIONS;
}

export function getPortalClarifications(): PortalClarification[] {
    return MOCK_CLARIFICATIONS;
}

export function getPortalDocuments(): PortalDocument[] {
    return MOCK_DOCUMENTS.filter(d => d.externalVisible);
}

export function getPortalDocumentsByTransaction(transactionId: string): PortalDocument[] {
    return MOCK_DOCUMENTS.filter(d => d.transactionId === transactionId && d.externalVisible);
}

export function submitPortalQuestion(data: { transactionId: string; questionType: string; subject: string; details: string }): PortalQuestion {
    const q: PortalQuestion = {
        id: `q-${Date.now()}`,
        transactionId: data.transactionId,
        transactionName: MOCK_TRANSACTIONS.find(t => t.id === data.transactionId)?.name || "",
        questionType: data.questionType,
        subject: data.subject,
        details: data.details,
        status: "Open",
        submittedAt: new Date().toISOString().split("T")[0],
        answeredAt: null,
        answer: null,
    };
    MOCK_QUESTIONS.unshift(q);
    return q;
}

export function submitPortalClarification(data: { transactionId: string; requestId: string; details: string }): PortalClarification {
    const request = MOCK_REQUESTS.find(r => r.id === data.requestId);
    const c: PortalClarification = {
        id: `cl-${Date.now()}`,
        transactionId: data.transactionId,
        transactionName: MOCK_TRANSACTIONS.find(t => t.id === data.transactionId)?.name || "",
        requestId: data.requestId,
        requestTitle: request?.title || "",
        details: data.details,
        status: "Open",
        submittedAt: new Date().toISOString().split("T")[0],
        resolvedAt: null,
        response: null,
    };
    MOCK_CLARIFICATIONS.unshift(c);
    return c;
}

export function submitPortalNewRequest(data: { transactionId: string; category: string; title: string; details: string; priority: string; neededBy: string }): PortalRequest {
    const r: PortalRequest = {
        id: `req-${Date.now()}`,
        transactionId: data.transactionId,
        transactionName: MOCK_TRANSACTIONS.find(t => t.id === data.transactionId)?.name || "",
        title: data.title,
        category: data.category,
        status: "Under Review",
        priority: data.priority as "High" | "Medium" | "Low",
        neededBy: data.neededBy,
        submittedAt: new Date().toISOString().split("T")[0],
        updatedAt: new Date().toISOString().split("T")[0],
    };
    MOCK_REQUESTS.unshift(r);
    return r;
}

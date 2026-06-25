export interface PortalCommunity {
    id: string;
    name: string;
    transactionId: string;
}

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
    communities: PortalCommunity[];
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
    communityIds: string[];
    communityNames: string[];
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
    communityIds: string[];
    communityNames: string[];
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
    communityIds: string[];
    communityNames: string[];
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

const VALSTONE_COMMUNITIES: PortalCommunity[] = [
    { id: "comm-001", name: "Valstone Manor - Main Campus", transactionId: "txn-004" },
    { id: "comm-002", name: "Valstone Heights - Assisted Living", transactionId: "txn-004" },
    { id: "comm-003", name: "Valstone Springs - Skilled Nursing", transactionId: "txn-004" },
    { id: "comm-004", name: "Valstone Gardens - Memory Care", transactionId: "txn-004" },
    { id: "comm-005", name: "Valstone Ridge - Rehabilitation", transactionId: "txn-004" },
    { id: "comm-006", name: "Valstone Pointe - Independent Living", transactionId: "txn-004" },
    { id: "comm-007", name: "Valstone Crossing - Senior Apartments", transactionId: "txn-004" },
    { id: "comm-008", name: "Valstone Estates - Luxury Care", transactionId: "txn-004" },
];

const MOCK_TRANSACTIONS: PortalTransaction[] = [
    {
        id: "txn-004",
        name: "Valstone Corp Portfolio",
        description: "Acquisition of 8 senior living communities across the Valstone enterprise in Florida and Georgia.",
        status: "Active",
        buyerName: "Blue Harbor Capital",
        brokerName: "Senior Living Advisors Group",
        targetClose: "Q1 2027",
        totalRequests: 32,
        providedCount: 12,
        inProgressCount: 14,
        clarificationNeededCount: 6,
        communities: VALSTONE_COMMUNITIES,
    },
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
        communities: [],
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
        communities: [],
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
        communities: [],
    },
];

function getCommunityNames(txnId: string, communityIds: string[]): string[] {
    const txn = MOCK_TRANSACTIONS.find(t => t.id === txnId);
    if (!txn || !txn.communities) return [];
    return communityIds.map(cid => txn.communities.find(c => c.id === cid)?.name || cid).filter(Boolean);
}

const MOCK_REQUESTS: PortalRequest[] = [
    { id: "req-001", transactionId: "txn-004", transactionName: "Valstone Corp Portfolio", title: "Portfolio-Level Financial Statements (2024-2025)", category: "Financial", status: "Provided", priority: "High", neededBy: "2027-01-15", submittedAt: "2026-11-01", updatedAt: "2026-11-10", communityIds: [], communityNames: ["All Communities"] },
    { id: "req-002", transactionId: "txn-004", transactionName: "Valstone Corp Portfolio", title: "Medicaid Certification Status by Community", category: "Compliance", status: "In Progress", priority: "High", neededBy: "2027-01-20", submittedAt: "2026-11-05", updatedAt: "2026-11-12", communityIds: ["comm-001", "comm-002", "comm-003", "comm-004", "comm-005", "comm-006", "comm-007", "comm-008"], communityNames: ["All Communities"] },
    { id: "req-003", transactionId: "txn-004", transactionName: "Valstone Corp Portfolio", title: "Valstone Manor - Staffing Ratios & Turnover", category: "Operational", status: "Clarification Needed", priority: "Medium", neededBy: "2027-01-25", submittedAt: "2026-11-08", updatedAt: "2026-11-14", communityIds: ["comm-001"], communityNames: ["Valstone Manor - Main Campus"] },
    { id: "req-004", transactionId: "txn-004", transactionName: "Valstone Corp Portfolio", title: "Payer Mix Analysis - FL Communities", category: "Financial", status: "Provided", priority: "High", neededBy: "2027-01-10", submittedAt: "2026-10-28", updatedAt: "2026-11-09", communityIds: ["comm-003", "comm-005", "comm-008"], communityNames: ["Valstone Springs - Skilled Nursing", "Valstone Ridge - Rehabilitation", "Valstone Estates - Luxury Care"] },
    { id: "req-005", transactionId: "txn-004", transactionName: "Valstone Corp Portfolio", title: "ALF Licenses - Valstone Heights & Pointe", category: "Compliance", status: "Under Review", priority: "High", neededBy: "2027-02-01", submittedAt: "2026-11-10", updatedAt: "2026-11-15", communityIds: ["comm-002", "comm-006"], communityNames: ["Valstone Heights - Assisted Living", "Valstone Pointe - Independent Living"] },
    { id: "req-006", transactionId: "txn-004", transactionName: "Valstone Corp Portfolio", title: "Valstone Gardens - Memory Care Program Description", category: "Operational", status: "In Progress", priority: "Medium", neededBy: "2027-01-30", submittedAt: "2026-11-12", updatedAt: "2026-11-16", communityIds: ["comm-004"], communityNames: ["Valstone Gardens - Memory Care"] },
    { id: "req-007", transactionId: "txn-001", transactionName: "IntegraCare Midwest Portfolio", title: "Medicare Cost Reports (2023-2025)", category: "Financial", status: "Provided", priority: "High", neededBy: "2026-07-15", submittedAt: "2026-06-01", updatedAt: "2026-06-10", communityIds: [], communityNames: [] },
    { id: "req-008", transactionId: "txn-001", transactionName: "IntegraCare Midwest Portfolio", title: "State Survey Reports - Last 3 Years", category: "Compliance", status: "In Progress", priority: "High", neededBy: "2026-07-20", submittedAt: "2026-06-05", updatedAt: "2026-06-12", communityIds: [], communityNames: [] },
    { id: "req-009", transactionId: "txn-002", transactionName: "Sunshine Senior Living - Phase 2", title: "Licenses and Certifications", category: "Compliance", status: "In Progress", priority: "High", neededBy: "2026-09-01", submittedAt: "2026-06-10", updatedAt: "2026-06-15", communityIds: [], communityNames: [] },
];

const MOCK_QUESTIONS: PortalQuestion[] = [
    { id: "q-001", transactionId: "txn-004", transactionName: "Valstone Corp Portfolio", questionType: "Financial", subject: "Revenue recognition for managed care contracts", details: "How does IntegraCare recognize revenue for managed care contracts across the Valstone portfolio? Are there any deviations from standard GAAP?", status: "Answered", submittedAt: "2026-11-03", answeredAt: "2026-11-07", answer: "Revenue is recognized at the point of service under the accrual method. Managed care contracts follow standard GAAP with no material deviations.", communityIds: [], communityNames: ["All Communities"] },
    { id: "q-002", transactionId: "txn-004", transactionName: "Valstone Corp Portfolio", questionType: "Operational", subject: "Staff turnover rates for Valstone Manor nursing staff", details: "What are the annualized turnover rates for RNs and LPNs at Valstone Manor? Please provide for the last 3 fiscal years.", status: "Open", submittedAt: "2026-11-14", answeredAt: null, answer: null, communityIds: ["comm-001"], communityNames: ["Valstone Manor - Main Campus"] },
    { id: "q-003", transactionId: "txn-002", transactionName: "Sunshine Senior Living - Phase 2", questionType: "Legal", subject: "Pending litigation overview", details: "Please provide a summary of any pending or threatened litigation involving any of the 8 facilities.", status: "Answered", submittedAt: "2026-06-11", answeredAt: "2026-06-13", answer: "No material pending litigation exists.", communityIds: [], communityNames: [] },
];

const MOCK_CLARIFICATIONS: PortalClarification[] = [
    { id: "cl-001", transactionId: "txn-004", transactionName: "Valstone Corp Portfolio", requestId: "req-003", requestTitle: "Valstone Manor - Staffing Ratios & Turnover", details: "In the provided staffing data, it appears that Valstone Manor shows a lower RN-to-patient ratio than the other communities. Can you confirm this is accurate?", status: "Open", submittedAt: "2026-11-15", resolvedAt: null, response: null, communityIds: ["comm-001"], communityNames: ["Valstone Manor - Main Campus"] },
    { id: "cl-002", transactionId: "txn-001", transactionName: "IntegraCare Midwest Portfolio", requestId: "req-007", requestTitle: "Medicare Cost Reports (2023-2025)", details: "The 2023 cost report for Facility #3 appears to be missing supplemental Schedules A and B. Can you provide these?", status: "Resolved", submittedAt: "2026-06-08", resolvedAt: "2026-06-11", response: "The supplemental schedules were misfiled. We have uploaded the complete 2023 cost report.", communityIds: [], communityNames: [] },
];

const MOCK_DOCUMENTS: PortalDocument[] = [
    { id: "doc-001", transactionId: "txn-004", transactionName: "Valstone Corp Portfolio", name: "Valstone_Consolidated_2024_Audited.pdf", category: "Financial", uploadedAt: "2026-11-01", size: "4.2 MB", externalVisible: true, communityIds: [], communityNames: ["All Communities"], relatedRequestId: "req-001", relatedRequestTitle: "Portfolio-Level Financial Statements (2024-2025)", sharePointUrl: null },
    { id: "doc-002", transactionId: "txn-004", transactionName: "Valstone Corp Portfolio", name: "Valstone_Manor_Staffing_Q3_2026.xlsx", category: "Operational", uploadedAt: "2026-11-05", size: "1.6 MB", externalVisible: true, communityIds: ["comm-001"], communityNames: ["Valstone Manor - Main Campus"], relatedRequestId: "req-003", relatedRequestTitle: "Valstone Manor - Staffing Ratios & Turnover", sharePointUrl: null },
    { id: "doc-003", transactionId: "txn-004", transactionName: "Valstone Corp Portfolio", name: "FL_Communities_Payer_Mix_Analysis.pdf", category: "Financial", uploadedAt: "2026-11-09", size: "3.1 MB", externalVisible: true, communityIds: ["comm-003", "comm-005", "comm-008"], communityNames: ["Valstone Springs - Skilled Nursing", "Valstone Ridge - Rehabilitation", "Valstone Estates - Luxury Care"], relatedRequestId: "req-004", relatedRequestTitle: "Payer Mix Analysis - FL Communities", sharePointUrl: null },
    { id: "doc-004", transactionId: "txn-004", transactionName: "Valstone Corp Portfolio", name: "ALF_Licenses_Valstone_Heights_Pointe.pdf", category: "Compliance", uploadedAt: "2026-11-10", size: "2.4 MB", externalVisible: true, communityIds: ["comm-002", "comm-006"], communityNames: ["Valstone Heights - Assisted Living", "Valstone Pointe - Independent Living"], relatedRequestId: "req-005", relatedRequestTitle: "ALF Licenses - Valstone Heights & Pointe", sharePointUrl: null },
    { id: "doc-005", transactionId: "txn-004", transactionName: "Valstone Corp Portfolio", name: "Medicaid_Cert_Status_All_Communities.pdf", category: "Compliance", uploadedAt: "2026-11-12", size: "5.7 MB", externalVisible: true, communityIds: ["comm-001", "comm-002", "comm-003", "comm-004", "comm-005", "comm-006", "comm-007", "comm-008"], communityNames: ["All Communities"], relatedRequestId: "req-002", relatedRequestTitle: "Medicaid Certification Status by Community", sharePointUrl: null },
    { id: "doc-006", transactionId: "txn-004", transactionName: "Valstone Corp Portfolio", name: "DD_Internal_Confidence_Scoring.pdf", category: "Internal", uploadedAt: "2026-11-04", size: "892 KB", externalVisible: false, communityIds: [], communityNames: [], relatedRequestId: null, relatedRequestTitle: null, sharePointUrl: null },
    { id: "doc-007", transactionId: "txn-001", transactionName: "IntegraCare Midwest Portfolio", name: "CMS_Survey_Reports_2024.zip", category: "Compliance", uploadedAt: "2026-06-02", size: "12.8 MB", externalVisible: true, communityIds: [], communityNames: [], relatedRequestId: null, relatedRequestTitle: null, sharePointUrl: null },
    { id: "doc-008", transactionId: "txn-001", transactionName: "IntegraCare Midwest Portfolio", name: "Midwest_Payer_Mix_Analysis.xlsx", category: "Financial", uploadedAt: "2026-06-09", size: "1.6 MB", externalVisible: true, communityIds: [], communityNames: [], relatedRequestId: "req-007", relatedRequestTitle: "Medicare Cost Reports (2023-2025)", sharePointUrl: null },
    { id: "doc-009", transactionId: "txn-004", transactionName: "Valstone Corp Portfolio", name: "Valstone_Gardens_Memory_Care_Program.pdf", category: "Operational", uploadedAt: "2026-11-16", size: "3.8 MB", externalVisible: true, communityIds: ["comm-004"], communityNames: ["Valstone Gardens - Memory Care"], relatedRequestId: "req-006", relatedRequestTitle: "Valstone Gardens - Memory Care Program Description", sharePointUrl: null },
    { id: "doc-010", transactionId: "txn-002", transactionName: "Sunshine Senior Living - Phase 2", name: "Phase2_Licenses_2026.pdf", category: "Compliance", uploadedAt: "2026-06-10", size: "2.4 MB", externalVisible: true, communityIds: [], communityNames: [], relatedRequestId: "req-009", relatedRequestTitle: "Licenses and Certifications", sharePointUrl: null },
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

export function submitPortalQuestion(data: {
    transactionId: string;
    questionType: string;
    subject: string;
    details: string;
    communityIds: string[];
}): PortalQuestion {
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
        communityIds: data.communityIds,
        communityNames: getCommunityNames(data.transactionId, data.communityIds),
    };
    MOCK_QUESTIONS.unshift(q);
    return q;
}

export function submitPortalClarification(data: {
    transactionId: string;
    requestId: string;
    details: string;
    communityIds: string[];
}): PortalClarification {
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
        communityIds: data.communityIds,
        communityNames: getCommunityNames(data.transactionId, data.communityIds),
    };
    MOCK_CLARIFICATIONS.unshift(c);
    return c;
}

export function submitPortalNewRequest(data: {
    transactionId: string;
    category: string;
    title: string;
    details: string;
    priority: string;
    neededBy: string;
    communityIds: string[];
}): PortalRequest {
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
        communityIds: data.communityIds,
        communityNames: getCommunityNames(data.transactionId, data.communityIds),
    };
    MOCK_REQUESTS.unshift(r);
    return r;
}

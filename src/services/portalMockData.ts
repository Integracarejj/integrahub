import { isDemoActive, getDemoTransaction, getDemoRequests, getDemoDocuments, initDemo, getDemoEngineSummary, addPortalCreatedIntakeItem, addPortalCreatedRequests, addPortalSubmission, getPortalSubmissions, updatePortalSubmissionStatus, clearAllPortalCreatedData } from "./recapDataService";
import type { RecapRequest, RecapDocument, RecapTransaction, RecapIntakeItem } from "./recapDataService";

const PERSONA_KEY = "integrasource.recap.portalPersona";
const PARSED_ROWS_KEY = "integrasource.recap.demo.parsedRows";

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
    externalStatus?: string;
    /** Internal field: whether this was published externally */
    _publishedExternal?: boolean;
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
    let portalStatus: string = req.status;
    if (req._externalStatus === "Published External") {
        portalStatus = "Published";
    } else if (req._externalStatus === "Ready to Publish") {
        portalStatus = "Available";
    } else if (req.status === "Complete") {
        portalStatus = "Under Review";
    }
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
        _publishedExternal: !!req._publishedExternal,
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

    // Get raw sheet info
    const ref = sheet["!ref"];
    const totalPhysicalRows = ref ? XLSX.utils.decode_range(ref).e.r + 1 : 0;

    // Read ALL rows as arrays (header: 1 gives arrays, not objects)
    const jsonRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    const rawHeaders: string[] = jsonRows.length > 0
        ? jsonRows[0].map((h: any) => (h !== null && h !== undefined ? String(h).trim() : ""))
        : [];

    // Normalize header names by index
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

    // Build accepted rows with normalized keys
    const accepted: Record<string, string>[] = [];
    const skipReasons: { rowIndex: number; reason: string; sampleValues: Record<string, string> }[] = [];

    // Data rows start at index 1 (after header row 0)
    for (let i = 1; i < jsonRows.length; i++) {
        const rawRow: any[] | undefined = jsonRows[i];
        if (!rawRow || rawRow.length === 0) {
            skipReasons.push({ rowIndex: i, reason: "Empty row (null/undefined)", sampleValues: {} });
            continue;
        }

        // Build row with normalized keys
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

        // Accept row if it has Request Title OR Description OR Notes with content
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

    // Build firstTenSkipped for diagnostics
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

    // Log diagnostics
    console.log("=== XLSX Parse Diagnostics ===");
    console.log("File:", file.name, `(${(file.size / 1024).toFixed(1)} KB)`);
    console.log("Sheet names:", sheetNames);
    console.log("Selected sheet:", selectedSheet);
    console.log("Total physical rows (from !ref):", totalPhysicalRows);
    console.log("Raw JSON rows (including header):", jsonRows.length);
    console.log("Header row:", rawHeaders);
    console.log("Normalized headers:", normalizedHeaders);
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
    packageName: string
): RecapRequest {
    const prefix = fileBaseName.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5) || "PKG";
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
    return {
        id: `${submissionId}-req-${index}`,
        requestId: `DD-${prefix}-${String(index).padStart(3, "0")}`,
        intakeId: `INT-${prefix}-${index}`,
        transactionId: `txn-portal-${submissionId}`,
        transactionName: packageName,
        brokerBuyer: "External",
        communityIds: [],
        communityNames: [],
        category: detectCategoryFromTitle(title, rawDesc) || "Unclassified",
        title,
        description: rawDesc,
        owner: String(row["Suggested Internal Owner"] || "").trim() || null,
        team: detectTeamFromCategory(detectCategoryFromTitle(title, rawDesc)) || String(row["Suggested Team"] || "").trim() || "",
        status: "Open",
        priority,
        dueDate,
        lastUpdated: now,
        externalVisible: true,
        submittedBy: String(row["Broker"] || "External Portal").trim(),
        source: "External",
        createdDate: now,
        assignedTo: String(row["Suggested Internal Owner"] || "").trim() || null,
        _publishedAt: null,
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
    const requestCount = parsedCount ?? 0;

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
        if (!isDemoActive()) initDemo();
        return;
    }

    const submissions = getPortalSubmissions();
    const sub = submissions.find(s => s.id === submissionId);
    if (!sub) return;

    if (sub.isABCDemo) {
        if (!isDemoActive()) initDemo();
        updatePortalSubmissionStatus(submissionId, "Submitted");
        return;
    }

    // Custom package: create intake item + review item (not tracker) records
    const fileBaseName = sub.fileName.replace(/\.[^.]+$/, "").trim();
    const parsedRows = getParsedRows();
    let reviewItems: RecapRequest[];
    if (parsedRows.length > 0) {
        reviewItems = parsedRows.map((row, i) => mapParsedRowToRecapRequest(row, submissionId, i + 1, fileBaseName, sub.packageName));
    } else {
        reviewItems = generatePortalRequests(submissionId, sub.packageName, fileBaseName, sub.requestCount);
    }
    clearParsedRows();
    // Review items are kept for the intake review grid but have _publishedAt: null so they don't appear in tracker
    addPortalCreatedRequests(reviewItems);
    const intakeItem = createPortalIntakeItem(submissionId, sub.packageName, sub.fileName, reviewItems.length, false);

    addPortalCreatedIntakeItem(intakeItem);
    updatePortalSubmissionStatus(submissionId, "Submitted");
}

export function loadABCDemoPackage(): void {
    if (!isDemoActive()) initDemo();
}

export function getPortalSubmissionsList(): PortalPackageSubmission[] {
    return getPortalSubmissions();
}

export function getOnlyPortalCreatedRequests(): PortalRequest[] {
    return [...MOCK_REQUESTS];
}

export function clearPortalSubmissions(): void {
    clearAllPortalCreatedData();
    // Also clear in-memory portal-created requests for this session
    MOCK_REQUESTS.length = 0;
}

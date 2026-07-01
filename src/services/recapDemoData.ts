import type { RecapTransaction, RecapRequest, RecapIntakeItem, RecapDocument, RecapActivity } from "./recapMockData";

const DEMO_KEY = "integrasource.recap.demo";
const RECAP_WIPED_KEY = "integrasource.recap.wiped";

const ABC_COMMUNITIES = [
    { id: "abc-cr", name: "Cedar Ridge" },
    { id: "abc-mp", name: "Magnolia Place" },
    { id: "abc-hv", name: "Harbor View" },
    { id: "abc-po", name: "Prairie Oaks" },
    { id: "abc-ss", name: "Summit Springs" },
];

const CATEGORIES = [
    "Financial Statements", "Licenses", "Environmental", "Insurance",
    "Legal", "HR / Staffing", "Physical Plant", "Regulatory", "Operations", "Marketing"
];

const STATUSES: RecapRequest["status"][] = [
    "Open", "Open", "Open", "Open",
    "In Progress", "In Progress",
    "Provided",
    "Clarification Needed",
    "Under Review",
    "Overdue",
];

const PRIORITIES: RecapRequest["priority"][] = [
    "High", "High",
    "Medium", "Medium", "Medium", "Medium",
    "Low", "Low",
];

const TEAMS = ["Financial Analysis", "Regulatory", "Environmental", "Risk Management", "HR & Operations", "DD Management"];

const MEMBERS: { name: string; team: string }[] = [
    { name: "Sarah Chen", team: "Financial Analysis" },
    { name: "James Wright", team: "Regulatory" },
    { name: "Lisa Park", team: "Environmental" },
    { name: "Tom Davies", team: "Risk Management" },
    { name: "Mike O'Brien", team: "Financial Analysis" },
    { name: "Anna Patel", team: "HR & Operations" },
    { name: "David Park", team: "DD Management" },
    { name: "Carlos Rivera", team: "Financial Analysis" },
];

function pick<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

function randDate(startDaysAgo: number, endDaysAgo: number): string {
    const d = new Date();
    d.setDate(d.getDate() - Math.floor(Math.random() * (startDaysAgo - endDaysAgo + 1)) - endDaysAgo);
    return d.toISOString().split("T")[0];
}

function futureDate(maxDays: number): string {
    const d = new Date();
    d.setDate(d.getDate() + Math.floor(Math.random() * maxDays) + 5);
    return d.toISOString().split("T")[0];
}

const REQUEST_TEMPLATES: { title: string; desc: string }[] = [
    { title: "Audited financial statements", desc: "Audited financial statements covering the most recent fiscal year, including balance sheet, income statement, and cash flow statement." },
    { title: "Monthly rent rolls", desc: "Monthly rent rolls and delinquency reports for the trailing 12-month period, including unit mix and occupancy data." },
    { title: "Operating licenses and certifications", desc: "Current state operating licenses, Medicare/Medicaid certifications, and any recent survey results." },
    { title: "Phase I environmental assessment", desc: "Phase I environmental site assessment report prepared by a qualified environmental professional." },
    { title: "General liability insurance certificate", desc: "Certificate of general liability insurance showing current coverage limits and policy effective dates." },
    { title: "Professional liability coverage", desc: "Professional liability / errors & omissions insurance policy declarations page and certificate." },
    { title: "Property insurance schedule", desc: "Schedule of insured property values, including building replacement cost and business interruption coverage." },
    { title: "Workers compensation experience mod", desc: "Workers compensation experience modification rating and loss run reports for the past 3 years." },
    { title: "Staffing roster and wage report", desc: "Full staffing roster including position, wage rate, hours, and tenure for all community staff." },
    { title: "Pending litigation summary", desc: "Summary of any pending or threatened litigation, arbitration, or regulatory proceedings." },
    { title: "P&L statement by facility", desc: "Profit and loss statement broken down by revenue center and expense category for each facility." },
    { title: "Property condition assessment", desc: "Recent property condition assessment report including capital expenditure needs and deferred maintenance." },
    { title: "Emergency evacuation plan", desc: "Emergency evacuation and disaster preparedness plan, including FEMA compliance documentation." },
    { title: "Vendor service agreements", desc: "Copies of all active vendor agreements including food service, therapy, janitorial, maintenance contracts." },
    { title: "Market analysis report", desc: "Market study including competitor analysis, demographic trends, and occupancy benchmarks." },
    { title: "Community contact directory", desc: "Emergency contact rosters, key personnel directory, and referral contact lists." },
    { title: "Revenue trend analysis", desc: "Multi-year revenue trend analysis showing payer mix changes and revenue growth trajectory." },
    { title: "Quality measure scores", desc: "CMS quality measure star ratings, Five-Star reports, and any quality improvement plans." },
    { title: "Life safety inspection report", desc: "Most recent life safety inspection report and any outstanding corrective action items." },
    { title: "Certificate of occupancy", desc: "Certificate of occupancy and any zoning compliance documentation for the property." },
];

interface RecapDemoState {
    transaction: RecapTransaction;
    intakeItem: RecapIntakeItem;
    requests: RecapRequest[];
    documents: RecapDocument[];
    activity: RecapActivity[];
    intakePublished: boolean;
}

function generateDemoState(): RecapDemoState {
    const transaction: RecapTransaction = {
        id: "txn-abc",
        name: "ABC Company Portfolio",
        description: "Gold standard due diligence package for the ABC Company portfolio acquisition across 5 communities.",
        status: "Active",
        sellerName: "ABC Company",
        buyerName: "123 Corporation",
        brokerName: "ABCto123 Associates",
        targetClose: "2026-10-15",
        totalRequests: 300,
        providedCount: 0,
        inProgressCount: 0,
        clarificationNeededCount: 0,
        overdueCount: 0,
        communities: ABC_COMMUNITIES.map(c => ({ ...c, transactionId: "txn-abc" })),
    };

    const intakeItem: RecapIntakeItem = {
        id: "abc-intake-001",
        intakeId: "INT-ABC-1",
        type: "Broker Upload",
        status: "Awaiting Review",
        title: "ABC Company Portfolio DD Request Package",
        description: "Gold standard due diligence package containing 300 DD request items across 5 communities, submitted by ABCto123 Associates.",
        transactionId: "txn-abc",
        transactionName: "ABC Company Portfolio",
        submittedBy: "ABCto123 Associates",
        submittedAt: new Date().toISOString(),
        assignedTo: null,
        communityNames: ABC_COMMUNITIES.map(c => c.name),
        priority: "High",
        fileName: "ABC_Company_Portfolio_Gold_Standard_DD_Package.xlsx",
        rowsFound: 300,
    };

    const requests: RecapRequest[] = [];
    const activity: RecapActivity[] = [];
    const documents: RecapDocument[] = [];

    const reqStatusWeights = [0.40, 0.20, 0.15, 0.10, 0.10, 0.05]; // Open, InProgress, Provided, Clar, UnderReview, Overdue

    for (let i = 1; i <= 300; i++) {
        const catIdx = Math.floor((i - 1) / 30) % CATEGORIES.length;
        const category = CATEGORIES[catIdx];
        const community = pick(ABC_COMMUNITIES);
        const owner = pick(MEMBERS);
        const template = pick(REQUEST_TEMPLATES);

        const rand = Math.random();
        let statusIdx = 0;
        let cum = 0;
        for (let s = 0; s < reqStatusWeights.length; s++) {
            cum += reqStatusWeights[s];
            if (rand < cum) { statusIdx = s; break; }
        }
        const status = STATUSES[statusIdx % STATUSES.length];
        const priority = pick(PRIORITIES);
        const team = CATEGORY_TEAM_MAP[category] || "DD Management";

        const reqId = `DD-ABC-${String(i).padStart(3, "0")}`;
        const title = `${template.title} - ${community.name}`;
        const desc = `${template.desc} Request for ${community.name} as part of the ABC Company Portfolio due diligence.`;

        requests.push({
            id: `abc-req-${i}`,
            requestId: reqId,
            intakeId: `INT-ABC-${i}`,
            transactionId: "txn-abc",
            transactionName: "ABC Company Portfolio",
            brokerBuyer: "ABCto123 / ABC Company",
            communityIds: [community.id],
            communityNames: [community.name],
            category,
            title,
            description: desc,
            owner: Math.random() > 0.3 ? owner.name : null,
            team,
            status,
            priority,
            dueDate: futureDate(45),
            lastUpdated: randDate(30, 0),
            externalVisible: Math.random() > 0.2,
            submittedBy: "ABCto123 Associates",
            source: "External",
            createdDate: randDate(60, 30),
            assignedTo: Math.random() > 0.3 ? owner.name : null,
            _publishedAt: null,
            _externalStatus: "Internal Only",
        });

        if (i <= 20) {
            const docId = `abc-doc-${i}`;
            documents.push({
                id: docId,
                name: `${template.title.replace(/\s+/g, "_")}_${community.name.replace(/\s+/g, "_")}.pdf`,
                transactionId: "txn-abc",
                transactionName: "ABC Company Portfolio",
                communityIds: [community.id],
                communityNames: [community.name],
                category,
                requestId: `abc-req-${i}`,
                requestTitle: title,
                uploadedAt: randDate(30, 0),
                sharePointUrl: Math.random() > 0.5 ? `https://integrasource.sharepoint.com/abc/${docId}` : null,
                fileType: "pdf",
                size: `${Math.floor(Math.random() * 10) + 1}.${Math.floor(Math.random() * 9)} MB`,
            });
        }

        if (i <= 10) {
            activity.push({
                id: `abc-act-${i}`,
                type: ["Status Change", "Assignment", "Note", "Submission", "Document"][Math.floor(Math.random() * 5)] as RecapActivity["type"],
                description: `Request ${reqId}: ${template.title}`,
                userId: owner.name.toLowerCase().replace(/\s+/, "."),
                userName: owner.name,
                requestId: `abc-req-${i}`,
                requestTitle: title,
                transactionId: "txn-abc",
                transactionName: "ABC Company Portfolio",
                timestamp: randDate(30, 0),
            });
        }
    }

    activity.push({
        id: "abc-act-submit",
        type: "Submission",
        description: "ABC Company Portfolio DD Request Package submitted by ABCto123 Associates with 300 items across 5 communities.",
        userId: "broker",
        userName: "ABCto123 Associates",
        requestId: null,
        requestTitle: null,
        transactionId: "txn-abc",
        transactionName: "ABC Company Portfolio",
        timestamp: new Date().toISOString(),
    });

    activity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return { transaction, intakeItem, requests, documents, activity, intakePublished: false };
}

const CATEGORY_TEAM_MAP: Record<string, string> = {
    "Financial Statements": "Financial Analysis",
    "Licenses": "Regulatory",
    "Environmental": "Environmental",
    "Insurance": "Risk Management",
    "Legal": "Risk Management",
    "HR / Staffing": "HR & Operations",
    "Physical Plant": "Environmental",
    "Regulatory": "Regulatory",
    "Operations": "HR & Operations",
    "Marketing": "Financial Analysis",
};

function loadState(): RecapDemoState | null {
    try {
        const raw = localStorage.getItem(DEMO_KEY);
        if (raw) return JSON.parse(raw);
    } catch { }
    return null;
}

function saveState(state: RecapDemoState) {
    localStorage.setItem(DEMO_KEY, JSON.stringify(state));
}

export function isDemoLoaded(): boolean {
    return loadState() !== null;
}

export function initDemo(): void {
    saveState(generateDemoState());
}

export function resetDemo(): void {
    localStorage.removeItem(DEMO_KEY);
    localStorage.removeItem("integrasource.recap.demo.reviewStates");
    localStorage.removeItem("integrasource.recap.demo.portalIntakeItems");
    localStorage.removeItem("integrasource.recap.demo.portalRequests");
    localStorage.removeItem("integrasource.recap.demo.portalSubmissions");
}

const ALL_RECAP_KEYS = [
    DEMO_KEY,
    "integrasource.recap.demo.reviewStates",
    "integrasource.recap.demo.portalIntakeItems",
    "integrasource.recap.demo.portalRequests",
    "integrasource.recap.demo.portalSubmissions",
    "integrasource.recap.demo.parsedRows",
    "integrasource.recap.myWorkUser",
];

export function resetAllRecapData(): void {
    ALL_RECAP_KEYS.forEach(key => localStorage.removeItem(key));
    console.log("[resetAllRecapData] All recap localStorage keys cleared");
}

export function isRecapWiped(): boolean {
    return localStorage.getItem(RECAP_WIPED_KEY) === "true";
}

export function setRecapWiped(): void {
    resetAllRecapData();
    localStorage.removeItem("integrasource.recap.portalPersona");
    localStorage.setItem(RECAP_WIPED_KEY, "true");
    console.log("[setRecapWiped] All recap data wiped — flag set");
}

export function clearRecapWiped(): void {
    localStorage.removeItem(RECAP_WIPED_KEY);
    console.log("[clearRecapWiped] Wipe flag cleared");
}

export function getDemoTransaction(): RecapTransaction | null {
    const state = loadState();
    return state?.transaction || null;
}

export function getDemoIntakeItem(): RecapIntakeItem | null {
    const state = loadState();
    return state?.intakeItem || null;
}

export function getDemoRequests(): RecapRequest[] {
    const state = loadState();
    return state?.requests || [];
}

export function getDemoRequestById(id: string): RecapRequest | undefined {
    const state = loadState();
    return state?.requests.find(r => r.id === id || r.requestId === id || r.intakeId === id);
}

export function getDemoDocuments(): RecapDocument[] {
    const state = loadState();
    return state?.documents || [];
}

export function getDemoActivity(limit = 20): RecapActivity[] {
    const state = loadState();
    return state?.activity.slice(0, limit) || [];
}

export function addDemoActivityEntry(entry: Omit<RecapActivity, "id" | "timestamp">): void {
    const state = loadState();
    if (!state) return;
    const newEntry: RecapActivity = {
        ...entry,
        id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: new Date().toISOString().split("T")[0],
    };
    state.activity.unshift(newEntry);
    saveState(state);
}

export function publishIntake(): { publishedCount: number; publishedIds: string[]; publishedBatchId?: string } {
    const state = loadState();
    if (!state || state.intakePublished) return { publishedCount: 0, publishedIds: [] };
    state.intakePublished = true;
    state.intakeItem.status = "Converted";
    const now = new Date().toISOString();
    const nowDate = now.split("T")[0];
    const batchId = `batch-${Date.now()}`;
    const publishedIds: string[] = [];
    state.requests.forEach(r => {
        if (r._publishedAt) return;
        r._publishedAt = nowDate;
        r._convertedAt = now;
        r._createdFromReview = true;
        r._sourceReviewItemId = r.requestId;
        r._externalStatus = "Internal Only";
        r.lastUpdated = nowDate;
        publishedIds.push(r.id);
        // Keep status as Open; do not auto-change to In Progress
    });
    state.transaction.totalRequests = state.requests.length;
    state.transaction.inProgressCount = state.requests.filter(r => r.status === "In Progress").length;
    state.transaction.providedCount = state.requests.filter(r => r.status === "Provided").length;
    state.transaction.clarificationNeededCount = state.requests.filter(r => r.status === "Clarification Needed").length;
    state.transaction.overdueCount = state.requests.filter(r => r.status === "Overdue").length;

    state.activity.unshift({
        id: "abc-act-publish",
        type: "Status Change",
        description: `${state.requests.length} requests published to request tracker (batch ${batchId}).`,
        userId: "system",
        userName: "System",
        requestId: null,
        requestTitle: null,
        transactionId: "txn-abc",
        transactionName: state.transaction.name,
        timestamp: now,
    });

    saveState(state);
    console.log(`[publishIntake] Published ${publishedIds.length} requests.`);
    console.log(`  batchId: ${batchId}`);
    console.log(`  IDs:`, publishedIds);
    console.log(`  final tracker count:`, state.requests.filter(r => r._publishedAt).length);
    return { publishedCount: publishedIds.length, publishedIds, publishedBatchId: batchId };
}

export function updateDemoRequest(id: string, patch: Partial<RecapRequest>): RecapRequest | undefined {
    const state = loadState();
    if (!state) return;
    const req = state.requests.find(r => r.id === id || r.requestId === id || r.intakeId === id);
    if (!req) return;
    Object.assign(req, patch);
    req.lastUpdated = new Date().toISOString().split("T")[0];
    saveState(state);
    return req;
}

export function bulkUpdateDemoRequests(ids: string[], patch: Partial<RecapRequest>): number {
    let count = 0;
    ids.forEach(id => {
        const r = updateDemoRequest(id, patch);
        if (r) count++;
    });
    return count;
}

export function getDemoEngineSummary(): {
    total: number;
    needsReview: number;
    possibleDuplicates: number;
    needsFollowUp: number;
    critical: number;
    categories: Record<string, number>;
    teams: Record<string, number>;
} {
    const requests = getDemoRequests();
    const categories: Record<string, number> = {};
    const teams: Record<string, number> = {};
    requests.forEach(r => {
        categories[r.category] = (categories[r.category] || 0) + 1;
        teams[r.team] = (teams[r.team] || 0) + 1;
    });
    return {
        total: requests.length,
        needsReview: requests.filter(r => r.status === "Open").length,
        possibleDuplicates: Math.floor(requests.length * 0.04),
        needsFollowUp: requests.filter(r => r.status === "Clarification Needed").length,
        critical: requests.filter(r => r.priority === "High" && (r.status === "Open" || r.status === "Overdue")).length,
        categories,
        teams,
    };
}

export function getDemoWorkload(): { team: string; total: number; activeLoad: number }[] {
    const requests = getDemoRequests();
    if (requests.length === 0) return [];
    const map: Record<string, number> = {};
    requests.forEach(r => {
        if (r.team) map[r.team] = (map[r.team] || 0) + 1;
    });
    return Object.entries(map).map(([team, total]) => ({
        team,
        total,
        activeLoad: requests.filter(r => r.team === team && r.status !== "Provided" && r.status !== "Under Review").length,
    }));
}

export function getDemoMyWork(userName = "Sarah Chen"): {
    assignedToMe: RecapRequest[];
    dueThisWeek: RecapRequest[];
    overdue: RecapRequest[];
    needsMyResponse: RecapRequest[];
    readyToPublish: RecapRequest[];
} {
    const requests = getDemoRequests();
    const assignedToMe = requests.filter(r => r.owner === userName && r.status !== "Provided");
    const today = new Date();
    const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    const dueThisWeek = requests.filter(r => {
        if (r.status === "Provided" || r.status === "Under Review") return false;
        const due = new Date(r.dueDate);
        return due >= today && due <= weekFromNow;
    });
    const overdue = requests.filter(r => r.status === "Overdue");
    const needsMyResponse = requests.filter(r => r.status === "Clarification Needed" && r.owner === userName);
    const readyToPublish = requests.filter(r => r.status === "Under Review");
    return { assignedToMe, dueThisWeek, overdue, needsMyResponse, readyToPublish };
}

export function getDemoReports(): {
    completion: number;
    openByCategory: { name: string; count: number }[];
    openByTeam: { name: string; count: number }[];
    overdue: number;
    duplicates: number;
    needsFollowUp: number;
    readinessByCommunity: { name: string; total: number; provided: number }[];
} {
    const requests = getDemoRequests();
    const provided = requests.filter(r => r.status === "Provided" || r.status === "Under Review").length;
    const completion = requests.length > 0 ? Math.round((provided / requests.length) * 100) : 0;

    const catMap: Record<string, number> = {};
    const teamMap: Record<string, number> = {};
    const commMap: Record<string, { total: number; provided: number }> = {};
    requests.forEach(r => {
        if (r.status !== "Provided" && r.status !== "Under Review") {
            catMap[r.category] = (catMap[r.category] || 0) + 1;
            teamMap[r.team] = (teamMap[r.team] || 0) + 1;
        }
        r.communityNames.forEach(cn => {
            if (!commMap[cn]) commMap[cn] = { total: 0, provided: 0 };
            commMap[cn].total++;
            if (r.status === "Provided" || r.status === "Under Review") commMap[cn].provided++;
        });
    });

    return {
        completion,
        openByCategory: Object.entries(catMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
        openByTeam: Object.entries(teamMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
        overdue: requests.filter(r => r.status === "Overdue").length,
        duplicates: Math.floor(requests.length * 0.04),
        needsFollowUp: requests.filter(r => r.status === "Clarification Needed").length,
        readinessByCommunity: Object.entries(commMap).map(([name, v]) => ({ name, ...v })).sort((a, b) => a.name.localeCompare(b.name)),
    };
}

export function getDemoStatusCounts(): Record<string, number> {
    const requests = getDemoRequests();
    return {
        Provided: requests.filter(r => r.status === "Provided").length,
        "In Progress": requests.filter(r => r.status === "In Progress").length,
        "Clarification Needed": requests.filter(r => r.status === "Clarification Needed").length,
        Overdue: requests.filter(r => r.status === "Overdue").length,
        Open: requests.filter(r => r.status === "Open").length,
        "Under Review": requests.filter(r => r.status === "Under Review").length,
    };
}

export function getDemoOverrideRequests(): RecapRequest[] {
    const state = loadState();
    if (!state) return [];
    const now = new Date();
    return state.requests.filter(r => {
        if (r.status === "Overdue") return true;
        if (r.status === "Provided" || r.status === "Under Review") return false;
        const due = new Date(r.dueDate);
        return due < now;
    });
}

export function publishSelectedRequests(ids: string[], sourceInfo?: { sourceIntakeId?: string; sourcePackageId?: string }): { publishedCount: number; publishedIds: string[]; publishedBatchId?: string } {
    const state = loadState();
    if (!state) return { publishedCount: 0, publishedIds: [] };
    state.intakePublished = true;
    state.intakeItem.status = "Converted";
    const now = new Date().toISOString();
    const nowDate = now.split("T")[0];
    const batchId = `batch-${Date.now()}`;
    const idSet = new Set(ids);
    let publishedCount = 0;
    const publishedIds: string[] = [];
    state.requests.forEach(r => {
        if (idSet.has(r.id) || idSet.has(r.requestId) || idSet.has(r.intakeId)) {
            if (r._publishedAt) return;
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
            // Keep status as Open; do not auto-change to In Progress
        }
    });
    state.transaction.totalRequests = state.requests.length;
    state.transaction.inProgressCount = state.requests.filter(r => r.status === "In Progress").length;
    state.transaction.providedCount = state.requests.filter(r => r.status === "Provided").length;
    state.transaction.clarificationNeededCount = state.requests.filter(r => r.status === "Clarification Needed").length;
    state.transaction.overdueCount = state.requests.filter(r => r.status === "Overdue").length;

    state.activity.unshift({
        id: "abc-act-publish-selected",
        type: "Status Change",
        description: `${publishedCount} requests published to tracker (batch ${batchId}).`,
        userId: "system",
        userName: "System",
        requestId: null,
        requestTitle: null,
        transactionId: "txn-abc",
        transactionName: state.transaction.name,
        timestamp: now,
    });

    saveState(state);
    console.log(`[publishSelectedRequests] Published ${publishedCount} requests.`);
    console.log(`  batchId: ${batchId}`);
    console.log(`  ids:`, publishedIds);
    console.log(`  sourceInfo:`, sourceInfo);
    console.log(`  sourceIntakeId:`, sourceInfo?.sourceIntakeId);
    console.log(`  sourcePackageId:`, sourceInfo?.sourcePackageId);
    console.log(`  final tracker count:`, state.requests.filter(r => r._publishedAt).length);
    return { publishedCount, publishedIds, publishedBatchId: batchId };
}

export function resetDemoTracker(): { clearedCount: number } {
    const state = loadState();
    if (!state) return { clearedCount: 0 };
    let clearedCount = 0;
    state.requests.forEach(r => {
        if (r._publishedAt) {
            r._publishedAt = null;
            r._convertedAt = null;
            r._sourceIntakeId = undefined;
            r._sourcePackageId = undefined;
            r._createdFromReview = false;
            clearedCount++;
        }
    });
    state.intakePublished = false;
    state.intakeItem.status = "Awaiting Review";
    saveState(state);
    console.log(`[resetDemoTracker] Cleared ${clearedCount} published request records.`);
    return { clearedCount };
}

export function getDemoTeams(): string[] {
    return [...TEAMS];
}

export function getDemoCategories(): string[] {
    return [...CATEGORIES];
}

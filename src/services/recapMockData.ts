export interface RecapCommunity {
    id: string;
    name: string;
    transactionId: string;
}

export interface RecapTransaction {
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
    overdueCount: number;
    communities: RecapCommunity[];
}

export interface RecapRequest {
    id: string;
    requestId: string;
    transactionId: string;
    transactionName: string;
    brokerBuyer: string;
    communityIds: string[];
    communityNames: string[];
    category: string;
    title: string;
    description: string;
    owner: string | null;
    team: string;
    status: "Provided" | "In Progress" | "Clarification Needed" | "Under Review" | "Open" | "Overdue";
    priority: "High" | "Medium" | "Low";
    dueDate: string;
    lastUpdated: string;
    externalVisible: boolean;
    submittedBy: string;
    source: "External" | "Internal" | "Bulk Import";
    createdDate: string;
    assignedTo: string | null;
}

export interface RecapIntakeItem {
    id: string;
    type: "Broker Upload" | "External Question" | "External Clarification" | "External New Request" | "Access Request" | "Manual Internal Request";
    status: "Awaiting Review" | "Assigned" | "Converted" | "Duplicate" | "Rejected" | "Not Applicable";
    title: string;
    description: string;
    transactionId: string;
    transactionName: string;
    submittedBy: string;
    submittedAt: string;
    assignedTo: string | null;
    communityNames: string[];
    priority: "High" | "Medium" | "Low";
    /** Broker-Upload-specific fields */
    fileName?: string;
    rowsFound?: number;
    /** Suggested fields from classification engine */
    suggestedCategory?: string;
    suggestedOwner?: string;
    suggestedTeam?: string;
    suggestedCommunities?: string[];
    suggestedPriority?: "High" | "Medium" | "Low";
}

export interface RecapDeliverable {
    id: string;
    name: string;
    category: string;
    requestId: string | null;
    requestTitle: string | null;
    transactionId: string;
    transactionName: string;
    owner: string;
    team: string;
    status: "Available" | "Linked" | "Needs Review";
    confidence: number;
}

export interface RecapDocument {
    id: string;
    name: string;
    transactionId: string;
    transactionName: string;
    communityIds: string[];
    communityNames: string[];
    category: string;
    requestId: string | null;
    requestTitle: string | null;
    uploadedAt: string;
    sharePointUrl: string | null;
    fileType: string;
    size: string;
}

export interface RecapActivity {
    id: string;
    type: "Status Change" | "Assignment" | "Note" | "Submission" | "Document" | "Comment";
    description: string;
    userId: string;
    userName: string;
    requestId: string | null;
    requestTitle: string | null;
    transactionId: string;
    transactionName: string;
    timestamp: string;
}

export interface RecapTeamMember {
    id: string;
    name: string;
    email: string;
    team: string;
    role: string;
    activeLoad: number;
}

export interface RecapCategory {
    id: string;
    name: string;
    description: string;
}

const MOCK_TRANSACTIONS: RecapTransaction[] = [
    {
        id: "txn-valstone",
        name: "Valstone Corp Portfolio",
        description: "Multi-community portfolio acquisition across 8 Gulf Coast properties",
        status: "Active",
        buyerName: "Valstone Corp",
        brokerName: "Marcus & Associates",
        targetClose: "2026-09-30",
        totalRequests: 47,
        providedCount: 18,
        inProgressCount: 14,
        clarificationNeededCount: 8,
        overdueCount: 7,
        communities: [
            { id: "comm-vg", name: "Valencia Grove", transactionId: "txn-valstone" },
            { id: "comm-om", name: "Oakwood Manor", transactionId: "txn-valstone" },
            { id: "comm-sb", name: "Sunset Bay", transactionId: "txn-valstone" },
            { id: "comm-pv", name: "Palm Vista", transactionId: "txn-valstone" },
            { id: "comm-hc", name: "Harbor Cove", transactionId: "txn-valstone" },
            { id: "comm-mp", name: "Magnolia Place", transactionId: "txn-valstone" },
            { id: "comm-cr", name: "Cedar Ridge", transactionId: "txn-valstone" },
            { id: "comm-bb", name: "Bayou Bend", transactionId: "txn-valstone" },
        ],
    },
    {
        id: "txn-midwest",
        name: "IntegraCare Midwest",
        description: "Single-region acquisition of 3 Midwestern skilled nursing facilities",
        status: "Active",
        buyerName: "IntegraCare Health",
        brokerName: "HealthCap Advisors",
        targetClose: "2026-08-15",
        totalRequests: 23,
        providedCount: 15,
        inProgressCount: 5,
        clarificationNeededCount: 2,
        overdueCount: 1,
        communities: [
            { id: "comm-mw", name: "Midwest Region", transactionId: "txn-midwest" },
        ],
    },
    {
        id: "txn-sunshine",
        name: "Sunshine Healthcare",
        description: "Florida-based assisted living portfolio",
        status: "Active",
        buyerName: "Sunshine Healthcare Group",
        brokerName: "Senior Living Partners",
        targetClose: "2026-11-01",
        totalRequests: 31,
        providedCount: 9,
        inProgressCount: 12,
        clarificationNeededCount: 5,
        overdueCount: 5,
        communities: [
            { id: "comm-sp", name: "Sunshine Properties", transactionId: "txn-sunshine" },
        ],
    },
    {
        id: "txn-riverside",
        name: "Riverside Senior Living",
        description: "Ohio-based senior living community acquisition",
        status: "Pending",
        buyerName: "Riverside Capital",
        brokerName: "Senior Living Partners",
        targetClose: "2027-01-15",
        totalRequests: 0,
        providedCount: 0,
        inProgressCount: 0,
        clarificationNeededCount: 0,
        overdueCount: 0,
        communities: [
            { id: "comm-rs", name: "Riverside", transactionId: "txn-riverside" },
        ],
    },
];

const MOCK_REQUESTS: RecapRequest[] = [
    { id: "req-001", requestId: "DD-2026-001", transactionId: "txn-valstone", transactionName: "Valstone Corp Portfolio", brokerBuyer: "Marcus & Assoc / Valstone Corp", communityIds: ["comm-vg"], communityNames: ["Valencia Grove"], category: "Financial Statements", title: "Audited financials for Valencia Grove (FY 2024-2025)", description: "Request audited financial statements for Valencia Grove covering fiscal years 2024 and 2025, including balance sheet, income statement, and cash flow.", owner: "Sarah Chen", team: "Financial Analysis", status: "Provided", priority: "High", dueDate: "2026-07-15", lastUpdated: "2026-06-20", externalVisible: true, submittedBy: "Marcus & Associates", source: "External", createdDate: "2026-05-10", assignedTo: "Sarah Chen" },
    { id: "req-002", requestId: "DD-2026-002", transactionId: "txn-valstone", transactionName: "Valstone Corp Portfolio", brokerBuyer: "Marcus & Assoc / Valstone Corp", communityIds: ["comm-om"], communityNames: ["Oakwood Manor"], category: "Licenses", title: "Oakwood Manor state licensing and certifications", description: "Current state licenses, Medicare/Medicaid certifications, and any recent survey results for Oakwood Manor.", owner: "James Wright", team: "Regulatory", status: "In Progress", priority: "High", dueDate: "2026-07-20", lastUpdated: "2026-06-22", externalVisible: true, submittedBy: "Marcus & Associates", source: "External", createdDate: "2026-05-12", assignedTo: "James Wright" },
    { id: "req-003", requestId: "DD-2026-003", transactionId: "txn-valstone", transactionName: "Valstone Corp Portfolio", brokerBuyer: "Marcus & Assoc / Valstone Corp", communityIds: ["comm-sb", "comm-pv"], communityNames: ["Sunset Bay", "Palm Vista"], category: "Environmental", title: "Phase I environmental reports for Sunset Bay and Palm Vista", description: "Phase I environmental site assessment reports for both Sunset Bay and Palm Vista properties.", owner: "Lisa Park", team: "Environmental", status: "Clarification Needed", priority: "Medium", dueDate: "2026-07-10", lastUpdated: "2026-06-21", externalVisible: true, submittedBy: "Marcus & Associates", source: "External", createdDate: "2026-05-14", assignedTo: "Lisa Park" },
    { id: "req-004", requestId: "DD-2026-004", transactionId: "txn-valstone", transactionName: "Valstone Corp Portfolio", brokerBuyer: "Marcus & Assoc / Valstone Corp", communityIds: [], communityNames: ["All Communities"], category: "Insurance", title: "Portfolio-wide general liability and professional liability coverage", description: "Certificates of insurance for all 8 Valstone properties - general liability, professional liability, workers comp, and property insurance.", owner: "Tom Davies", team: "Risk Management", status: "Under Review", priority: "High", dueDate: "2026-07-25", lastUpdated: "2026-06-23", externalVisible: false, submittedBy: "Internal DD Team", source: "Internal", createdDate: "2026-05-08", assignedTo: "Tom Davies" },
    { id: "req-005", requestId: "DD-2026-005", transactionId: "txn-valstone", transactionName: "Valstone Corp Portfolio", brokerBuyer: "Marcus & Assoc / Valstone Corp", communityIds: ["comm-hc"], communityNames: ["Harbor Cove"], category: "Financial Statements", title: "Harbor Cove rent rolls and occupancy reports (last 12 months)", description: "Monthly rent rolls, delinquency reports, and occupancy data for Harbor Cove covering the most recent 12-month period.", owner: "Sarah Chen", team: "Financial Analysis", status: "Provided", priority: "Medium", dueDate: "2026-07-05", lastUpdated: "2026-06-18", externalVisible: true, submittedBy: "Marcus & Associates", source: "External", createdDate: "2026-05-20", assignedTo: "Sarah Chen" },
    { id: "req-006", requestId: "DD-2026-006", transactionId: "txn-valstone", transactionName: "Valstone Corp Portfolio", brokerBuyer: "Marcus & Assoc / Valstone Corp", communityIds: ["comm-mp", "comm-cr", "comm-bb"], communityNames: ["Magnolia Place", "Cedar Ridge", "Bayou Bend"], category: "HR / Staffing", title: "Staffing rosters and labor cost reports for 3 Gulf Coast properties", description: "Full staffing roster, wage rates, turnover data, and labor cost breakdowns for Magnolia Place, Cedar Ridge, and Bayou Bend.", owner: null, team: "HR & Operations", status: "Open", priority: "Medium", dueDate: "2026-08-01", lastUpdated: "2026-06-10", externalVisible: true, submittedBy: "Marcus & Associates", source: "External", createdDate: "2026-06-01", assignedTo: null },
    { id: "req-007", requestId: "DD-2026-007", transactionId: "txn-midwest", transactionName: "IntegraCare Midwest", brokerBuyer: "HealthCap / IntegraCare Health", communityIds: ["comm-mw"], communityNames: ["Midwest Region"], category: "Financial Statements", title: "IntegraCare Midwest financial statements FY 2024", description: "Audited financial statements for the Midwest region, including facility-level P&L statements.", owner: "Mike O'Brien", team: "Financial Analysis", status: "Provided", priority: "High", dueDate: "2026-07-01", lastUpdated: "2026-06-19", externalVisible: true, submittedBy: "HealthCap Advisors", source: "External", createdDate: "2026-04-15", assignedTo: "Mike O'Brien" },
    { id: "req-008", requestId: "DD-2026-008", transactionId: "txn-midwest", transactionName: "IntegraCare Midwest", brokerBuyer: "HealthCap / IntegraCare Health", communityIds: ["comm-mw"], communityNames: ["Midwest Region"], category: "Regulatory", title: "State survey results and plans of correction", description: "Most recent state survey results, plans of correction, and any enforcement actions for all 3 facilities.", owner: "James Wright", team: "Regulatory", status: "Overdue", priority: "High", dueDate: "2026-06-15", lastUpdated: "2026-06-25", externalVisible: true, submittedBy: "HealthCap Advisors", source: "External", createdDate: "2026-05-01", assignedTo: "James Wright" },
    { id: "req-009", requestId: "DD-2026-009", transactionId: "txn-sunshine", transactionName: "Sunshine Healthcare", brokerBuyer: "SLP / Sunshine Health", communityIds: ["comm-sp"], communityNames: ["Sunshine Properties"], category: "Physical Plant", title: "Property condition assessments for all Sunshine facilities", description: "Recent property condition assessments, capital expenditure plans, and deferred maintenance reports.", owner: "Lisa Park", team: "Environmental", status: "In Progress", priority: "Medium", dueDate: "2026-08-10", lastUpdated: "2026-06-24", externalVisible: true, submittedBy: "Senior Living Partners", source: "External", createdDate: "2026-05-25", assignedTo: "Lisa Park" },
    { id: "req-010", requestId: "DD-2026-010", transactionId: "txn-valstone", transactionName: "Valstone Corp Portfolio", brokerBuyer: "Marcus & Assoc / Valstone Corp", communityIds: [], communityNames: ["All Communities"], category: "Legal", title: "Pending litigation summary for Valstone portfolio", description: "Summary of any pending or threatened litigation, arbitration, or regulatory proceedings involving any Valstone property.", owner: "Tom Davies", team: "Risk Management", status: "Overdue", priority: "High", dueDate: "2026-06-01", lastUpdated: "2026-06-26", externalVisible: false, submittedBy: "Internal DD Team", source: "Internal", createdDate: "2026-04-20", assignedTo: "Tom Davies" },
    { id: "req-011", requestId: "DD-2026-011", transactionId: "txn-valstone", transactionName: "Valstone Corp Portfolio", brokerBuyer: "Marcus & Assoc / Valstone Corp", communityIds: ["comm-vg", "comm-om"], communityNames: ["Valencia Grove", "Oakwood Manor"], category: "Financial Statements", title: "Valencia Grove and Oakwood Manor 3-year revenue trends", description: "Revenue trend analysis for Valencia Grove and Oakwood Manor showing payer mix changes over the past 3 years.", owner: "Sarah Chen", team: "Financial Analysis", status: "In Progress", priority: "Medium", dueDate: "2026-07-30", lastUpdated: "2026-06-22", externalVisible: true, submittedBy: "Marcus & Associates", source: "External", createdDate: "2026-06-05", assignedTo: "Sarah Chen" },
    { id: "req-012", requestId: "DD-2026-012", transactionId: "txn-sunshine", transactionName: "Sunshine Healthcare", brokerBuyer: "SLP / Sunshine Health", communityIds: ["comm-sp"], communityNames: ["Sunshine Properties"], category: "Insurance", title: "Sunshine Healthcare liability insurance renewal details", description: "Current insurance policies, renewal terms, and claims history for the Sunshine portfolio.", owner: "Tom Davies", team: "Risk Management", status: "Open", priority: "Low", dueDate: "2026-09-01", lastUpdated: "2026-06-15", externalVisible: false, submittedBy: "Internal DD Team", source: "Internal", createdDate: "2026-06-10", assignedTo: "Tom Davies" },
];

const MOCK_INTAKE_ITEMS: RecapIntakeItem[] = [
    {
        id: "int-001",
        type: "Broker Upload",
        status: "Awaiting Review",
        title: "Valstone DD Package v2.xlsx",
        description: "Broker uploaded updated due diligence package with financial statements and licenses",
        transactionId: "txn-valstone",
        transactionName: "Valstone Corp Portfolio",
        submittedBy: "Marcus & Associates",
        submittedAt: "2026-06-24T14:30:00Z",
        assignedTo: null,
        communityNames: ["Valencia Grove", "Oakwood Manor", "Sunset Bay"],
        priority: "High",
        fileName: "Valstone_DD_Package_v2.xlsx",
        rowsFound: 12,
        suggestedCategory: "Financial Statements",
        suggestedOwner: "Sarah Chen",
        suggestedTeam: "Financial Analysis",
        suggestedCommunities: ["Valencia Grove", "Oakwood Manor", "Sunset Bay"],
        suggestedPriority: "High",
    },
    {
        id: "int-002",
        type: "External Question",
        status: "Awaiting Review",
        title: "How should rent roll data be normalized across properties?",
        description: "Broker asking about the methodology for normalizing rent roll data across properties with different unit mixes and floor plans.",
        transactionId: "txn-valstone",
        transactionName: "Valstone Corp Portfolio",
        submittedBy: "Marcus & Associates",
        submittedAt: "2026-06-25T09:15:00Z",
        assignedTo: null,
        communityNames: ["All Communities"],
        priority: "Medium",
        suggestedCategory: "Financial Statements",
        suggestedOwner: "Sarah Chen",
        suggestedTeam: "Financial Analysis",
        suggestedCommunities: ["All Communities"],
        suggestedPriority: "Medium",
    },
    {
        id: "int-003",
        type: "External Clarification",
        status: "Awaiting Review",
        title: "Insurance coverage limits for DD-2026-004 need clarification",
        description: "Broker requests clarification on which specific coverage limits and policy types are required for the portfolio-wide insurance request.",
        transactionId: "txn-valstone",
        transactionName: "Valstone Corp Portfolio",
        submittedBy: "Marcus & Associates",
        submittedAt: "2026-06-25T11:00:00Z",
        assignedTo: null,
        communityNames: ["All Communities"],
        priority: "High",
        suggestedCategory: "Insurance",
        suggestedOwner: "Tom Davies",
        suggestedTeam: "Risk Management",
        suggestedCommunities: ["All Communities"],
        suggestedPriority: "High",
    },
    {
        id: "int-004",
        type: "External New Request",
        status: "Awaiting Review",
        title: "Vendor contract copies for Magnolia Place",
        description: "New request from broker for copies of all vendor/service contracts at Magnolia Place including janitorial, food service, therapy, and maintenance agreements.",
        transactionId: "txn-valstone",
        transactionName: "Valstone Corp Portfolio",
        submittedBy: "Marcus & Associates",
        submittedAt: "2026-06-25T15:45:00Z",
        assignedTo: null,
        communityNames: ["Magnolia Place"],
        priority: "Medium",
        suggestedCategory: "Legal",
        suggestedOwner: "Tom Davies",
        suggestedTeam: "Risk Management",
        suggestedCommunities: ["Magnolia Place"],
        suggestedPriority: "Medium",
    },
    {
        id: "int-005",
        type: "Access Request",
        status: "Awaiting Review",
        title: "Portal access for John Miller (Valstone analyst)",
        description: "Access request for John Miller (john.miller@valstone.com) to view Valstone Corp Portfolio transaction documents and submit requests.",
        transactionId: "txn-valstone",
        transactionName: "Valstone Corp Portfolio",
        submittedBy: "Valstone Corp",
        submittedAt: "2026-06-23T16:00:00Z",
        assignedTo: null,
        communityNames: [],
        priority: "Low",
    },
    {
        id: "int-006",
        type: "External Question",
        status: "Awaiting Review",
        title: "How are community-level financials aggregated to portfolio?",
        description: "Broker team wants to understand the methodology for how individual community financial statements roll up to portfolio-level reporting.",
        transactionId: "txn-valstone",
        transactionName: "Valstone Corp Portfolio",
        submittedBy: "Marcus & Associates",
        submittedAt: "2026-06-25T16:30:00Z",
        assignedTo: null,
        communityNames: ["All Communities"],
        priority: "Low",
        suggestedCategory: "Financial Statements",
        suggestedOwner: "Sarah Chen",
        suggestedTeam: "Financial Analysis",
        suggestedCommunities: ["All Communities"],
        suggestedPriority: "Low",
    },
    {
        id: "int-007",
        type: "Broker Upload",
        status: "Awaiting Review",
        title: "IntegraCare Midwest Updated Package.xlsx",
        description: "Revised DD package from HealthCap Advisors with additional financial detail for 3 facilities",
        transactionId: "txn-midwest",
        transactionName: "IntegraCare Midwest",
        submittedBy: "HealthCap Advisors",
        submittedAt: "2026-06-22T10:00:00Z",
        assignedTo: null,
        communityNames: ["Midwest Region"],
        priority: "High",
        fileName: "IntegraCare_Midwest_Updated_Package.xlsx",
        rowsFound: 8,
        suggestedCategory: "Financial Statements",
        suggestedOwner: "Mike O'Brien",
        suggestedTeam: "Financial Analysis",
        suggestedCommunities: ["Midwest Region"],
        suggestedPriority: "High",
    },
    {
        id: "int-008",
        type: "Manual Internal Request",
        status: "Awaiting Review",
        title: "Property condition assessment for Cedar Ridge",
        description: "Internal request from DD management to add property condition assessment and CapEx analysis for Cedar Ridge to the Valstone portfolio scope.",
        transactionId: "txn-valstone",
        transactionName: "Valstone Corp Portfolio",
        submittedBy: "David Park",
        submittedAt: "2026-06-26T08:00:00Z",
        assignedTo: null,
        communityNames: ["Cedar Ridge"],
        priority: "Medium",
        suggestedCategory: "Physical Plant",
        suggestedOwner: "Lisa Park",
        suggestedTeam: "Environmental",
        suggestedCommunities: ["Cedar Ridge"],
        suggestedPriority: "Medium",
    },
    {
        id: "int-009",
        type: "External New Request",
        status: "Assigned",
        title: "Sunshine Healthcare rent roll data (last 12 months)",
        description: "Request from Senior Living Partners for monthly rent rolls and occupancy reports across all Sunshine Healthcare facilities.",
        transactionId: "txn-sunshine",
        transactionName: "Sunshine Healthcare",
        submittedBy: "Senior Living Partners",
        submittedAt: "2026-06-21T13:00:00Z",
        assignedTo: "Lisa Park",
        communityNames: ["Sunshine Properties"],
        priority: "High",
        suggestedCategory: "Financial Statements",
        suggestedOwner: "Lisa Park",
        suggestedTeam: "Financial Analysis",
        suggestedCommunities: ["Sunshine Properties"],
        suggestedPriority: "High",
    },
    {
        id: "int-010",
        type: "External Clarification",
        status: "Awaiting Review",
        title: "Clarify scope of Phase I environmental for Sunset Bay",
        description: "Broker needs clarification on whether Phase I ESA should include asbestos and lead-based paint testing or just the standard environmental site assessment.",
        transactionId: "txn-valstone",
        transactionName: "Valstone Corp Portfolio",
        submittedBy: "Marcus & Associates",
        submittedAt: "2026-06-26T09:45:00Z",
        assignedTo: null,
        communityNames: ["Sunset Bay"],
        priority: "Medium",
        suggestedCategory: "Environmental",
        suggestedOwner: "Lisa Park",
        suggestedTeam: "Environmental",
        suggestedCommunities: ["Sunset Bay"],
        suggestedPriority: "Medium",
    },
    {
        id: "int-011",
        type: "Access Request",
        status: "Converted",
        title: "Portal access for HealthCap new hire",
        description: "Access request for Sarah Mitchell (sarah.mitchell@healthcap.com) to access IntegraCare Midwest transaction.",
        transactionId: "txn-midwest",
        transactionName: "IntegraCare Midwest",
        submittedBy: "HealthCap Advisors",
        submittedAt: "2026-06-20T11:30:00Z",
        assignedTo: "David Park",
        communityNames: [],
        priority: "Low",
    },
    {
        id: "int-012",
        type: "Manual Internal Request",
        status: "Awaiting Review",
        title: "Litigation history check for all Valstone properties",
        description: "Legal team request to conduct a comprehensive litigation history search across all 8 Valstone portfolio properties.",
        transactionId: "txn-valstone",
        transactionName: "Valstone Corp Portfolio",
        submittedBy: "Carlos Rivera",
        submittedAt: "2026-06-26T07:30:00Z",
        assignedTo: null,
        communityNames: ["Valencia Grove", "Oakwood Manor", "Sunset Bay", "Palm Vista", "Harbor Cove", "Magnolia Place", "Cedar Ridge", "Bayou Bend"],
        priority: "High",
        suggestedCategory: "Legal",
        suggestedOwner: "Tom Davies",
        suggestedTeam: "Risk Management",
        suggestedCommunities: ["Valencia Grove", "Oakwood Manor", "Sunset Bay", "Palm Vista", "Harbor Cove", "Magnolia Place", "Cedar Ridge", "Bayou Bend"],
        suggestedPriority: "High",
    },
];

const MOCK_DELIVERABLES: RecapDeliverable[] = [
    { id: "del-001", name: "Audited Financial Statements Template", category: "Financial Statements", requestId: "req-001", requestTitle: "Audited financials for Valencia Grove (FY 2024-2025)", transactionId: "txn-valstone", transactionName: "Valstone Corp Portfolio", owner: "Sarah Chen", team: "Financial Analysis", status: "Available", confidence: 95 },
    { id: "del-002", name: "License Verification Report - Oakwood Manor", category: "Licenses", requestId: "req-002", requestTitle: "Oakwood Manor state licensing and certifications", transactionId: "txn-valstone", transactionName: "Valstone Corp Portfolio", owner: "James Wright", team: "Regulatory", status: "Available", confidence: 88 },
    { id: "del-003", name: "Phase I ESA Sample Report", category: "Environmental", requestId: null, requestTitle: null, transactionId: "txn-valstone", transactionName: "Valstone Corp Portfolio", owner: "Lisa Park", team: "Environmental", status: "Needs Review", confidence: 72 },
    { id: "del-004", name: "Insurance Certificate - Portfolio Summary", category: "Insurance", requestId: "req-004", requestTitle: "Portfolio-wide general liability and professional liability coverage", transactionId: "txn-valstone", transactionName: "Valstone Corp Portfolio", owner: "Tom Davies", team: "Risk Management", status: "Linked", confidence: 91 },
    { id: "del-005", name: "Rent Roll Analysis Workbook", category: "Financial Statements", requestId: "req-005", requestTitle: "Harbor Cove rent rolls and occupancy reports (last 12 months)", transactionId: "txn-valstone", transactionName: "Valstone Corp Portfolio", owner: "Sarah Chen", team: "Financial Analysis", status: "Available", confidence: 84 },
];

const MOCK_DOCUMENTS: RecapDocument[] = [
    { id: "doc-001", name: "Valencia_Grove_Audited_Financials_2024.pdf", transactionId: "txn-valstone", transactionName: "Valstone Corp Portfolio", communityIds: ["comm-vg"], communityNames: ["Valencia Grove"], category: "Financial Statements", requestId: "req-001", requestTitle: "Audited financials for Valencia Grove (FY 2024-2025)", uploadedAt: "2026-06-20", sharePointUrl: null, fileType: "PDF", size: "4.2 MB" },
    { id: "doc-002", name: "Valencia_Grove_Audited_Financials_2025.pdf", transactionId: "txn-valstone", transactionName: "Valstone Corp Portfolio", communityIds: ["comm-vg"], communityNames: ["Valencia Grove"], category: "Financial Statements", requestId: "req-001", requestTitle: "Audited financials for Valencia Grove (FY 2024-2025)", uploadedAt: "2026-06-20", sharePointUrl: null, fileType: "PDF", size: "4.5 MB" },
    { id: "doc-003", name: "Oakwood_Manor_License_Certification.pdf", transactionId: "txn-valstone", transactionName: "Valstone Corp Portfolio", communityIds: ["comm-om"], communityNames: ["Oakwood Manor"], category: "Licenses", requestId: "req-002", requestTitle: "Oakwood Manor state licensing and certifications", uploadedAt: "2026-06-22", sharePointUrl: null, fileType: "PDF", size: "1.8 MB" },
    { id: "doc-004", name: "Harbor_Cove_Rent_Roll_Jun2026.xlsx", transactionId: "txn-valstone", transactionName: "Valstone Corp Portfolio", communityIds: ["comm-hc"], communityNames: ["Harbor Cove"], category: "Financial Statements", requestId: "req-005", requestTitle: "Harbor Cove rent rolls and occupancy reports (last 12 months)", uploadedAt: "2026-06-18", sharePointUrl: null, fileType: "XLSX", size: "892 KB" },
    { id: "doc-005", name: "Valstone_Portfolio_Insurance_Certs.pdf", transactionId: "txn-valstone", transactionName: "Valstone Corp Portfolio", communityIds: [], communityNames: ["All Communities"], category: "Insurance", requestId: "req-004", requestTitle: "Portfolio-wide general liability and professional liability coverage", uploadedAt: "2026-06-23", sharePointUrl: null, fileType: "PDF", size: "6.1 MB" },
    { id: "doc-006", name: "IntegraCare_Midwest_Financials_2024.pdf", transactionId: "txn-midwest", transactionName: "IntegraCare Midwest", communityIds: ["comm-mw"], communityNames: ["Midwest Region"], category: "Financial Statements", requestId: "req-007", requestTitle: "IntegraCare Midwest financial statements FY 2024", uploadedAt: "2026-06-19", sharePointUrl: null, fileType: "PDF", size: "3.4 MB" },
    { id: "doc-007", name: "Midwest_Survey_Results_2026.pdf", transactionId: "txn-midwest", transactionName: "IntegraCare Midwest", communityIds: ["comm-mw"], communityNames: ["Midwest Region"], category: "Regulatory", requestId: "req-008", requestTitle: "State survey results and plans of correction", uploadedAt: "2026-06-25", sharePointUrl: null, fileType: "PDF", size: "2.1 MB" },
];

const MOCK_ACTIVITY: RecapActivity[] = [
    { id: "act-001", type: "Status Change", description: "Request DD-2026-001 marked as Provided", userId: "user-sarah", userName: "Sarah Chen", requestId: "req-001", requestTitle: "Audited financials for Valencia Grove (FY 2024-2025)", transactionId: "txn-valstone", transactionName: "Valstone Corp Portfolio", timestamp: "2026-06-20T16:30:00Z" },
    { id: "act-002", type: "Assignment", description: "James Wright assigned to DD-2026-002 (Oakwood Manor licensing)", userId: "user-admin", userName: "David Park", requestId: "req-002", requestTitle: "Oakwood Manor state licensing and certifications", transactionId: "txn-valstone", transactionName: "Valstone Corp Portfolio", timestamp: "2026-06-22T09:15:00Z" },
    { id: "act-003", type: "Note", description: "Added internal note: Broker called asking about timeline for environmental reports", userId: "user-sarah", userName: "Sarah Chen", requestId: "req-003", requestTitle: "Phase I environmental reports for Sunset Bay and Palm Vista", transactionId: "txn-valstone", transactionName: "Valstone Corp Portfolio", timestamp: "2026-06-21T14:00:00Z" },
    { id: "act-004", type: "Submission", description: "New intake item: Valstone DD Package v2 (bulk import)", userId: "system", userName: "System", requestId: null, requestTitle: null, transactionId: "txn-valstone", transactionName: "Valstone Corp Portfolio", timestamp: "2026-06-24T14:30:00Z" },
    { id: "act-005", type: "Status Change", description: "DD-2026-003 marked as Clarification Needed", userId: "user-lisa", userName: "Lisa Park", requestId: "req-003", requestTitle: "Phase I environmental reports for Sunset Bay and Palm Vista", transactionId: "txn-valstone", transactionName: "Valstone Corp Portfolio", timestamp: "2026-06-21T11:00:00Z" },
    { id: "act-006", type: "Document", description: "Harbor Cove rent roll uploaded to DD-2026-005", userId: "user-sarah", userName: "Sarah Chen", requestId: "req-005", requestTitle: "Harbor Cove rent rolls and occupancy reports (last 12 months)", transactionId: "txn-valstone", transactionName: "Valstone Corp Portfolio", timestamp: "2026-06-18T15:45:00Z" },
    { id: "act-007", type: "Status Change", description: "DD-2026-010 marked as Overdue (past due date 2026-06-01)", userId: "system", userName: "System", requestId: "req-010", requestTitle: "Pending litigation summary for Valstone portfolio", transactionId: "txn-valstone", transactionName: "Valstone Corp Portfolio", timestamp: "2026-06-02T00:00:00Z" },
    { id: "act-008", type: "Submission", description: "New external question received for Valstone portfolio", userId: "ext-system", userName: "Marcus & Associates", requestId: null, requestTitle: null, transactionId: "txn-valstone", transactionName: "Valstone Corp Portfolio", timestamp: "2026-06-25T09:15:00Z" },
];

const MOCK_TEAM_MEMBERS: RecapTeamMember[] = [
    { id: "user-sarah", name: "Sarah Chen", email: "sarah.chen@integracare.com", team: "Financial Analysis", role: "Senior Analyst", activeLoad: 4 },
    { id: "user-james", name: "James Wright", email: "james.wright@integracare.com", team: "Regulatory", role: "Analyst", activeLoad: 3 },
    { id: "user-lisa", name: "Lisa Park", email: "lisa.park@integracare.com", team: "Environmental", role: "Analyst", activeLoad: 2 },
    { id: "user-tom", name: "Tom Davies", email: "tom.davies@integracare.com", team: "Risk Management", role: "Senior Analyst", activeLoad: 5 },
    { id: "user-mike", name: "Mike O'Brien", email: "mike.obrien@integracare.com", team: "Financial Analysis", role: "Analyst", activeLoad: 1 },
    { id: "user-david", name: "David Park", email: "david.park@integracare.com", team: "DD Management", role: "Manager", activeLoad: 1 },
    { id: "user-anna", name: "Anna Patel", email: "anna.patel@integracare.com", team: "HR & Operations", role: "Analyst", activeLoad: 0 },
    { id: "user-carlos", name: "Carlos Rivera", email: "carlos.rivera@integracare.com", team: "Financial Analysis", role: "Director", activeLoad: 2 },
];

const MOCK_CATEGORIES: RecapCategory[] = [
    { id: "cat-fin", name: "Financial Statements", description: "Audited financials, P&L, balance sheets, revenue reports" },
    { id: "cat-lic", name: "Licenses", description: "State licenses, certifications, survey results" },
    { id: "cat-env", name: "Environmental", description: "Phase I/II reports, environmental assessments" },
    { id: "cat-ins", name: "Insurance", description: "General liability, professional liability, workers comp" },
    { id: "cat-legal", name: "Legal", description: "Litigation summary, contracts, regulatory matters" },
    { id: "cat-hr", name: "HR / Staffing", description: "Staffing rosters, wage reports, turnover data" },
    { id: "cat-plant", name: "Physical Plant", description: "Property condition assessments, CapEx plans" },
    { id: "cat-reg", name: "Regulatory", description: "Regulatory compliance, enforcement actions" },
];

export function getTransactions(): RecapTransaction[] {
    return MOCK_TRANSACTIONS;
}

export function getActiveTransactions(): RecapTransaction[] {
    return MOCK_TRANSACTIONS.filter((t) => t.status === "Active");
}

export function getTransactionById(id: string): RecapTransaction | undefined {
    return MOCK_TRANSACTIONS.find((t) => t.id === id);
}

export function getRequests(): RecapRequest[] {
    return MOCK_REQUESTS;
}

export function getRequestsByTransaction(transactionId: string): RecapRequest[] {
    return MOCK_REQUESTS.filter((r) => r.transactionId === transactionId);
}

export function getRequestById(id: string): RecapRequest | undefined {
    return MOCK_REQUESTS.find((r) => r.id === id);
}

export function getIntakeItems(): RecapIntakeItem[] {
    return MOCK_INTAKE_ITEMS;
}

export function getIntakeItemsByType(type: RecapIntakeItem["type"]): RecapIntakeItem[] {
    return MOCK_INTAKE_ITEMS.filter((i) => i.type === type);
}

export function getDeliverables(): RecapDeliverable[] {
    return MOCK_DELIVERABLES;
}

export function getDocuments(): RecapDocument[] {
    return MOCK_DOCUMENTS;
}

export function getDocumentsByTransaction(transactionId: string): RecapDocument[] {
    return MOCK_DOCUMENTS.filter((d) => d.transactionId === transactionId);
}

export function getActivity(limit?: number): RecapActivity[] {
    const sorted = [...MOCK_ACTIVITY].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
    return limit ? sorted.slice(0, limit) : sorted;
}

export function getActivityByTransaction(transactionId: string): RecapActivity[] {
    return MOCK_ACTIVITY.filter((a) => a.transactionId === transactionId)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export function getTeamMembers(): RecapTeamMember[] {
    return MOCK_TEAM_MEMBERS;
}

export function getTeamMembersByTeam(team: string): RecapTeamMember[] {
    return MOCK_TEAM_MEMBERS.filter((m) => m.team === team);
}

export function getCategories(): RecapCategory[] {
    return MOCK_CATEGORIES;
}

export function getTeams(): string[] {
    const teams = new Set(MOCK_TEAM_MEMBERS.map((m) => m.team));
    return Array.from(teams).sort();
}

export function getTeamWorkload(): { team: string; total: number; activeLoad: number }[] {
    const teams = getTeams();
    return teams.map((team) => {
        const members = MOCK_TEAM_MEMBERS.filter((m) => m.team === team);
        const activeLoad = members.reduce((sum, m) => sum + m.activeLoad, 0);
        return { team, total: members.length, activeLoad };
    });
}

export function getStatusCounts(): Record<string, number> {
    return {
        Provided: MOCK_REQUESTS.filter((r) => r.status === "Provided").length,
        "In Progress": MOCK_REQUESTS.filter((r) => r.status === "In Progress").length,
        "Clarification Needed": MOCK_REQUESTS.filter((r) => r.status === "Clarification Needed").length,
        Overdue: MOCK_REQUESTS.filter((r) => r.status === "Overdue").length,
        Open: MOCK_REQUESTS.filter((r) => r.status === "Open").length,
        "Under Review": MOCK_REQUESTS.filter((r) => r.status === "Under Review").length,
    };
}

export function getOverrideRequests(): RecapRequest[] {
    const now = new Date();
    return MOCK_REQUESTS.filter((r) => {
        if (r.status === "Overdue") return true;
        if (r.status === "Provided" || r.status === "Under Review") return false;
        const due = new Date(r.dueDate);
        return due < now;
    });
}

export function updateRequestStatus(id: string, status: RecapRequest["status"]): RecapRequest | undefined {
    const req = MOCK_REQUESTS.find((r) => r.id === id);
    if (req) {
        req.status = status;
        req.lastUpdated = new Date().toISOString().split("T")[0];
    }
    return req;
}

export function updateRequestOwner(id: string, owner: string | null): RecapRequest | undefined {
    const req = MOCK_REQUESTS.find((r) => r.id === id);
    if (req) {
        req.owner = owner;
        req.assignedTo = owner;
        req.lastUpdated = new Date().toISOString().split("T")[0];
    }
    return req;
}

export function updateRequestPriority(id: string, priority: RecapRequest["priority"]): RecapRequest | undefined {
    const req = MOCK_REQUESTS.find((r) => r.id === id);
    if (req) {
        req.priority = priority;
        req.lastUpdated = new Date().toISOString().split("T")[0];
    }
    return req;
}

export function updateRequestDueDate(id: string, dueDate: string): RecapRequest | undefined {
    const req = MOCK_REQUESTS.find((r) => r.id === id);
    if (req) {
        req.dueDate = dueDate;
        req.lastUpdated = new Date().toISOString().split("T")[0];
    }
    return req;
}

export function updateRequestTeam(id: string, team: string): RecapRequest | undefined {
    const req = MOCK_REQUESTS.find((r) => r.id === id);
    if (req) {
        req.team = team;
        req.lastUpdated = new Date().toISOString().split("T")[0];
    }
    return req;
}

export function toggleExternalVisibility(id: string): RecapRequest | undefined {
    const req = MOCK_REQUESTS.find((r) => r.id === id);
    if (req) {
        req.externalVisible = !req.externalVisible;
        req.lastUpdated = new Date().toISOString().split("T")[0];
    }
    return req;
}

export function getMyWork(userName: string): {
    assignedToMe: RecapRequest[];
    assignedToMyTeam: RecapRequest[];
    dueThisWeek: RecapRequest[];
    overdue: RecapRequest[];
    needsMyResponse: RecapRequest[];
    waitingOnExternal: RecapRequest[];
} {
    const user = MOCK_TEAM_MEMBERS.find((m) => m.name === userName);
    const myTeam = user?.team || "";

    const assignedToMe = MOCK_REQUESTS.filter((r) => r.owner === userName);
    const assignedToMyTeam = MOCK_REQUESTS.filter((r) => {
        return r.team === myTeam && r.owner !== userName;
    });
    const today = new Date();
    const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    const dueThisWeek = MOCK_REQUESTS.filter((r) => {
        if (r.status === "Provided" || r.status === "Under Review") return false;
        const due = new Date(r.dueDate);
        return due >= today && due <= weekFromNow;
    });
    const overdue = MOCK_REQUESTS.filter((r) => r.status === "Overdue");
    const needsMyResponse = MOCK_REQUESTS.filter((r) => r.status === "Clarification Needed" && r.owner === userName);
    const waitingOnExternal = MOCK_REQUESTS.filter((r) => r.status === "Clarification Needed");

    return { assignedToMe, assignedToMyTeam, dueThisWeek, overdue, needsMyResponse, waitingOnExternal };
}

export interface BusinessTopic {
    slug: string;
    name: string;
    description: string;
    group: string;
    whyItMatters: string;
    relatedSystems: string[];
    relatedProcesses: string[];
    relatedPerformanceAreas: string[];
    relatedMetrics: string[];
    commonQuestions: { question: string; answer: string }[];
    reportingLinks?: { label: string; description: string; href?: string; status?: "Available" | "Planned" | "Unknown" }[];
}

export const BUSINESS_TOPICS: BusinessTopic[] = [
    {
        slug: "census",
        name: "Census",
        description: "Current resident population and occupancy movement across communities.",
        group: "Operations",
        whyItMatters: "Census impacts revenue, staffing, care planning, dining, and executive visibility.",
        relatedSystems: ["ECP", "WelcomeHome", "Power BI"],
        relatedProcesses: ["Prospect to Resident", "Resident Care"],
        relatedPerformanceAreas: ["Sales & Occupancy", "Financial Performance"],
        relatedMetrics: ["Occupancy Rate", "Average Daily Census", "Move-Ins vs Move-Outs"],
        commonQuestions: [
            { question: "Where does census data come from?", answer: "Census data is primarily sourced from ECP (electronic health record) and WelcomeHome (CRM/leasing). Daily census counts are reconciled between these systems." },
            { question: "Which report should I use?", answer: "The Executive Census Dashboard in Power BI provides the single source of truth for daily census, occupancy trends, and move activity." },
            { question: "How often is it updated?", answer: "Census data is updated daily via overnight batch syncs from ECP and WelcomeHome into the data warehouse." },
            { question: "Who owns the data?", answer: "Census data ownership is shared between Clinical Operations (for resident counts) and Sales/Marketing (for occupancy and move activity)." },
        ],
        reportingLinks: [
            { label: "Occupancy / Census Reporting", description: "Executive dashboard for daily census, occupancy trends, and move activity.", status: "Planned" },
        ],
    },
    {
        slug: "occupancy",
        name: "Occupancy",
        description: "Percentage of available units or beds currently filled across communities.",
        group: "Operations",
        whyItMatters: "Occupancy is the primary revenue driver and a key operational efficiency metric tracked at corporate and community levels.",
        relatedSystems: ["WelcomeHome", "Yardi Voyager", "Power BI"],
        relatedProcesses: ["Prospect to Resident"],
        relatedPerformanceAreas: ["Sales & Occupancy", "Financial Performance"],
        relatedMetrics: ["Occupancy %", "Net Move-Ins", "Average Length of Stay"],
        commonQuestions: [
            { question: "How is occupancy calculated?", answer: "Occupancy = (filled units or beds) / (total available units or beds). The definition varies slightly by community type (IL, AL, MC, SNF)." },
            { question: "What is a healthy occupancy rate?", answer: "Target occupancy varies by care level: Independent Living targets 92-95%, Assisted Living 88-92%, Skilled Nursing 80-85%." },
            { question: "How does seasonality affect occupancy?", answer: "Occupancy typically dips in winter months (fewer move-ins) and peaks in late summer/early fall." },
        ],
        reportingLinks: [
            { label: "Sales & Occupancy Dashboard", description: "Track occupancy rates, net move-ins, and community performance.", status: "Planned" },
        ],
    },
    {
        slug: "move-ins",
        name: "Move-Ins",
        description: "New resident move-in activity including lead sources, conversion rates, and move-in readiness.",
        group: "Operations",
        whyItMatters: "Move-in volume directly drives revenue growth and is a leading indicator of occupancy trends.",
        relatedSystems: ["WelcomeHome", "Salesforce CRM", "Power BI"],
        relatedProcesses: ["Prospect to Resident"],
        relatedPerformanceAreas: ["Sales & Occupancy"],
        relatedMetrics: ["Move-Ins per Month", "Lead-to-Move-In Conversion Rate", "Average Days from Lead to Move-In"],
        commonQuestions: [
            { question: "What is the move-in process?", answer: "The process spans lead generation → tour → application → deposit → move-in coordination. WelcomeHome tracks each stage." },
            { question: "How are move-ins forecasted?", answer: "Sales teams track expected move-in dates in WelcomeHome. The pipeline report shows expected move-ins for the next 30-60-90 days." },
        ],
    },
    {
        slug: "resident-care",
        name: "Resident Care",
        description: "Care delivery, clinical documentation, wellness programs, and service coordination for residents.",
        group: "Operations",
        whyItMatters: "Quality of care directly impacts resident satisfaction, family satisfaction, regulatory compliance, and clinical outcomes.",
        relatedSystems: ["ECP", "PointRight", "Power BI"],
        relatedProcesses: ["Resident Care"],
        relatedPerformanceAreas: ["Resident Care"],
        relatedMetrics: ["Care Hours per Resident per Day", "Clinical Compliance Score", "Service Request Resolution Time"],
        commonQuestions: [
            { question: "Which system is the clinical record of record?", answer: "ECP is the primary electronic health record for all clinical documentation, assessments, and care plans." },
            { question: "How is care quality measured?", answer: "Care quality is measured through clinical compliance audits, survey results, quality measure scores, and resident satisfaction surveys." },
        ],
    },
    {
        slug: "maintenance",
        name: "Maintenance",
        description: "Facility maintenance, work order management, preventive maintenance, and asset lifecycle tracking.",
        group: "Operations",
        whyItMatters: "Effective maintenance ensures safe, attractive communities, extends asset life, and reduces emergency repair costs.",
        relatedSystems: ["TELS Maintenance", "Yardi Voyager", "Power BI"],
        relatedProcesses: ["Maintenance & Compliance"],
        relatedPerformanceAreas: ["Maintenance & Compliance"],
        relatedMetrics: ["Open Work Orders", "PM Completion Rate", "Work Order Aging", "Mobile Adoption Rate"],
        commonQuestions: [
            { question: "How are work orders created?", answer: "Work orders can be created by community staff via TELS, automated from preventive maintenance schedules, or submitted by residents." },
            { question: "What is the preventive maintenance schedule?", answer: "PM schedules are managed in TELS based on equipment type, manufacturer recommendations, and regulatory requirements." },
        ],
        reportingLinks: [
            { label: "Maintenance & Compliance Performance", description: "Track work orders, PM completion, compliance scores, and safety metrics.", href: "/performance/maintenance-compliance", status: "Available" },
        ],
    },
    {
        slug: "compliance",
        name: "Compliance",
        description: "Regulatory compliance, safety inspections, licensing, and policy adherence across communities.",
        group: "Operations",
        whyItMatters: "Non-compliance results in fines, licensure actions, reputational damage, and risk to operations.",
        relatedSystems: ["TELS Maintenance", "ECP", "Power BI"],
        relatedProcesses: ["Maintenance & Compliance"],
        relatedPerformanceAreas: ["Maintenance & Compliance"],
        relatedMetrics: ["Compliance Score", "Inspection Pass Rate", "Regulatory Findings"],
        commonQuestions: [
            { question: "What regulations apply?", answer: "Communities must comply with federal, state, and local regulations including OSHA, life safety codes, health department requirements, and CMS conditions of participation." },
            { question: "How is compliance tracked?", answer: "Compliance is tracked through TELS for maintenance/safety, ECP for clinical, and manual audit processes for other areas." },
        ],
        reportingLinks: [
            { label: "Maintenance & Compliance Performance", description: "Monitor regulatory compliance, inspection results, and safety metrics.", href: "/performance/maintenance-compliance", status: "Available" },
        ],
    },
    {
        slug: "staffing",
        name: "Staffing",
        description: "Workforce planning, staffing levels, scheduling, and labor cost management across communities.",
        group: "Workforce",
        whyItMatters: "Staffing is the largest operating expense. Proper staffing ensures quality care, resident satisfaction, and regulatory compliance.",
        relatedSystems: ["ADP Workforce Now", "PointRight", "Paylocity", "Power BI"],
        relatedProcesses: ["Employee Lifecycle"],
        relatedPerformanceAreas: ["Workforce", "Financial Performance"],
        relatedMetrics: ["Staff Turnover Rate", "Hours per Resident per Day", "Labor Cost per Unit", "Overtime %"],
        commonQuestions: [
            { question: "How are staffing targets set?", answer: "Staffing targets are based on resident acuity, census, and budgeted hours per resident per day by department." },
            { question: "Which scheduling system is used?", answer: "PointRight is used for clinical staff scheduling. ADP is used for time tracking and payroll across all staff." },
        ],
        reportingLinks: [
            { label: "Workforce Performance", description: "View staffing levels, turnover, labor costs, and scheduling efficiency.", status: "Planned" },
        ],
    },
    {
        slug: "training",
        name: "Training",
        description: "Employee training, onboarding, continuing education, and compliance training across the organization.",
        group: "Workforce",
        whyItMatters: "Training ensures regulatory compliance, reduces liability, improves employee performance, and supports career development.",
        relatedSystems: ["LMS", "ADP Workforce Now", "Power BI"],
        relatedProcesses: ["Employee Lifecycle"],
        relatedPerformanceAreas: ["Workforce"],
        relatedMetrics: ["Training Completion Rate", "Hours per Employee", "Compliance Training %"],
        commonQuestions: [
            { question: "What training is mandatory?", answer: "Mandatory training includes annual compliance, OSHA safety, HIPAA, fire safety, infection control, and role-specific clinical training." },
            { question: "How is training tracked?", answer: "Training is tracked in the LMS. Completion data is reported to community leadership and corporate compliance." },
        ],
    },
    {
        slug: "payroll",
        name: "Payroll",
        description: "Employee compensation, time tracking, payroll processing, and labor cost allocation.",
        group: "Workforce",
        whyItMatters: "Payroll accuracy affects employee satisfaction, regulatory compliance, and financial reporting.",
        relatedSystems: ["ADP Workforce Now", "Paylocity", "Yardi Voyager", "Power BI"],
        relatedProcesses: ["Employee Lifecycle"],
        relatedPerformanceAreas: ["Workforce", "Financial Performance"],
        relatedMetrics: ["Payroll Accuracy Rate", "Labor Cost Variance", "Overtime %"],
        commonQuestions: [
            { question: "How is payroll processed?", answer: "Community staff enter time in ADP. Payroll is processed on a bi-weekly cycle with corporate review and approval." },
            { question: "Which payroll system is used?", answer: "ADP Workforce Now is the primary payroll and HRIS system across the organization." },
        ],
    },
    {
        slug: "employee-lifecycle",
        name: "Employee Lifecycle",
        description: "End-to-end employee journey from recruiting and hiring through onboarding, development, and offboarding.",
        group: "Workforce",
        whyItMatters: "A well-managed employee lifecycle improves retention, reduces hiring costs, and ensures compliance.",
        relatedSystems: ["ADP Workforce Now", "LMS", "Paylocity", "Power BI"],
        relatedProcesses: ["Employee Lifecycle"],
        relatedPerformanceAreas: ["Workforce"],
        relatedMetrics: ["Time to Hire", "Retention Rate", "Employee Satisfaction Score"],
        commonQuestions: [
            { question: "What is the hiring process?", answer: "The hiring process includes requisition approval, posting, screening, interviewing, offer, background check, and onboarding." },
            { question: "How is employee data managed?", answer: "Employee data is managed in ADP Workforce Now as the system of record, with integrations to LMS for training and Paylocity for payroll." },
        ],
    },
    {
        slug: "retention",
        name: "Retention",
        description: "Employee retention rates, turnover analysis, and strategies to maintain workforce stability.",
        group: "Workforce",
        whyItMatters: "High turnover increases costs, reduces quality of care, and impacts resident and family satisfaction.",
        relatedSystems: ["ADP Workforce Now", "Power BI"],
        relatedProcesses: ["Employee Lifecycle"],
        relatedPerformanceAreas: ["Workforce"],
        relatedMetrics: ["Turnover Rate", "Average Tenure", "Exit Interview Themes"],
        commonQuestions: [
            { question: "How is turnover calculated?", answer: "Turnover = (separations during period) / (average headcount during period). It is tracked monthly by community and department." },
            { question: "What drives turnover?", answer: "Common drivers include compensation, scheduling flexibility, management quality, career development opportunities, and burnout." },
        ],
    },
    {
        slug: "revenue-cycle",
        name: "Revenue Cycle",
        description: "End-to-end revenue process from billing through collections, including resident billing, insurance, and government payments.",
        group: "Finance",
        whyItMatters: "Revenue cycle efficiency directly impacts cash flow, days sales outstanding, and financial health.",
        relatedSystems: ["Yardi Voyager", "ECP", "Power BI"],
        relatedProcesses: ["Resident Care", "Prospect to Resident"],
        relatedPerformanceAreas: ["Financial Performance", "Sales & Occupancy"],
        relatedMetrics: ["Days Sales Outstanding", "AR Aging", "Collection Rate", "Denial Rate"],
        commonQuestions: [
            { question: "How are residents billed?", answer: "Rent and care charges are generated in Yardi Voyager based on lease terms and care level assessments from ECP." },
            { question: "What payment sources are managed?", answer: "Payment sources include private pay, Medicare, Medicaid, insurance, and veterans benefits." },
        ],
        reportingLinks: [
            { label: "Financial Performance Dashboard", description: "Track revenue, AR aging, billing accuracy, and collection rates.", status: "Planned" },
        ],
    },
    {
        slug: "billing",
        name: "Billing",
        description: "Invoice generation, payment processing, and billing operations for resident accounts.",
        group: "Finance",
        whyItMatters: "Accurate and timely billing ensures steady cash flow and reduces AR aging.",
        relatedSystems: ["Yardi Voyager", "ECP", "Power BI"],
        relatedProcesses: ["Prospect to Resident"],
        relatedPerformanceAreas: ["Financial Performance"],
        relatedMetrics: ["Billing Accuracy Rate", "Invoice Aging", "Payment Speed"],
        commonQuestions: [
            { question: "When are invoices generated?", answer: "Invoices are generated monthly in Yardi Voyager, typically on the 1st of the month for the upcoming month." },
            { question: "How are billing discrepancies resolved?", answer: "Discrepancies are handled by community business office staff through Yardi, with escalation to corporate billing if needed." },
        ],
    },
    {
        slug: "budget",
        name: "Budget",
        description: "Annual budgeting process, financial planning, and variance tracking for communities and corporate.",
        group: "Finance",
        whyItMatters: "Budgeting ensures financial discipline, supports strategic planning, and provides performance benchmarks.",
        relatedSystems: ["Yardi Voyager", "Excel", "Power BI", "Budgeting Software"],
        relatedProcesses: ["Financial Performance"],
        relatedPerformanceAreas: ["Financial Performance"],
        relatedMetrics: ["Budget Variance %", "Revenue vs Budget", "Expense vs Budget"],
        commonQuestions: [
            { question: "When does the budget cycle start?", answer: "The annual budget cycle typically begins in Q3 for the following year, with final approval before year-end." },
            { question: "How is budget performance tracked?", answer: "Actuals vs budget are tracked monthly in Power BI, with variance reporting at community and corporate levels." },
        ],
    },
    {
        slug: "ap-payments",
        name: "AP / Payments",
        description: "Accounts payable, vendor payments, invoice processing, and payment reconciliation.",
        group: "Finance",
        whyItMatters: "Efficient AP operations maintain vendor relationships, avoid late fees, and ensure accurate financial reporting.",
        relatedSystems: ["Yardi Voyager", "Power BI", "Banking Portal"],
        relatedProcesses: ["Financial Performance"],
        relatedPerformanceAreas: ["Financial Performance"],
        relatedMetrics: ["AP Aging", "Invoice Processing Time", "Payment Accuracy Rate"],
        commonQuestions: [
            { question: "How are vendor invoices processed?", answer: "Vendor invoices are submitted to community business offices, coded in Yardi, approved by management, and processed for payment." },
            { question: "What is the payment schedule?", answer: "Vendor payments are processed on a weekly or bi-weekly schedule depending on terms and community preference." },
        ],
    },
    {
        slug: "lead-generation",
        name: "Lead Generation",
        description: "Marketing and sales activities that generate prospective resident inquiries and referrals.",
        group: "Sales",
        whyItMatters: "Lead generation is the top of the sales funnel and directly impacts move-in volume and occupancy.",
        relatedSystems: ["WelcomeHome", "Salesforce CRM", "Power BI", "Marketing Platform"],
        relatedProcesses: ["Prospect to Resident"],
        relatedPerformanceAreas: ["Sales & Occupancy"],
        relatedMetrics: ["Lead Volume", "Lead Source Breakdown", "Cost per Lead"],
        commonQuestions: [
            { question: "Where do leads come from?", answer: "Leads come from multiple sources: digital marketing, referral sources, phone inquiries, walk-ins, professional referrals, and corporate campaigns." },
            { question: "How are leads tracked?", answer: "All leads are tracked in WelcomeHome from initial inquiry through move-in. Lead source attribution is captured at entry." },
        ],
    },
    {
        slug: "tours",
        name: "Tours",
        description: "Community tours and visits for prospective residents and their families.",
        group: "Sales",
        whyItMatters: "Tour conversion rate is a key sales metric. The tour experience heavily influences the prospect's decision.",
        relatedSystems: ["WelcomeHome", "Salesforce CRM"],
        relatedProcesses: ["Prospect to Resident"],
        relatedPerformanceAreas: ["Sales & Occupancy"],
        relatedMetrics: ["Tour Volume", "Tour-to-Move-In Conversion Rate", "Average Tours per Move-In"],
        commonQuestions: [
            { question: "How are tours scheduled?", answer: "Tours are scheduled through WelcomeHome by community sales teams. Prospects can also self-schedule through the website." },
            { question: "What is the conversion benchmark?", answer: "Industry benchmark for tour-to-move-in conversion is approximately 25-35%. Top-performing communities achieve 40%+" },
        ],
    },
    {
        slug: "conversion",
        name: "Conversion",
        description: "Sales funnel conversion rates from lead through tour to move-in.",
        group: "Sales",
        whyItMatters: "Conversion rate analysis identifies bottlenecks in the sales process and opportunities to improve sales effectiveness.",
        relatedSystems: ["WelcomeHome", "Salesforce CRM", "Power BI"],
        relatedProcesses: ["Prospect to Resident"],
        relatedPerformanceAreas: ["Sales & Occupancy"],
        relatedMetrics: ["Lead-to-Tour Rate", "Tour-to-Move-In Rate", "Overall Conversion Rate", "Average Days in Funnel"],
        commonQuestions: [
            { question: "What is the typical sales cycle?", answer: "The average sales cycle from inquiry to move-in is 45-60 days, varying by community type and market conditions." },
            { question: "Where do prospects drop off?", answer: "Common drop-off points include after the tour (no follow-up), during financial qualification, and during the move-in planning phase." },
        ],
    },
    {
        slug: "referral-sources",
        name: "Referral Sources",
        description: "Analysis of where referrals come from including professional referrals, families, and digital channels.",
        group: "Sales",
        whyItMatters: "Understanding referral sources helps optimize marketing spend and strengthen relationships with top referral partners.",
        relatedSystems: ["WelcomeHome", "Power BI"],
        relatedProcesses: ["Prospect to Resident"],
        relatedPerformanceAreas: ["Sales & Occupancy"],
        relatedMetrics: ["Referral Volume by Source", "Referral Conversion Rate", "Cost per Referral"],
        commonQuestions: [
            { question: "What are the top referral sources?", answer: "Top referral sources typically include hospital discharge planners, senior placement agents, family members, digital marketing, and professional networks." },
            { question: "How are referral sources tracked?", answer: "Referral source is captured in WelcomeHome at lead entry and reported in Power BI dashboards." },
        ],
    },
];

export const TOPIC_STYLES: Record<string, { icon: string; color: string; bg: string }> = {
    census: { icon: "🏠", color: "#2563eb", bg: "#eff6ff" },
    occupancy: { icon: "📊", color: "#059669", bg: "#f0fdf4" },
    "move-ins": { icon: "🚚", color: "#ea580c", bg: "#fff7ed" },
    "resident-care": { icon: "🏥", color: "#7c3aed", bg: "#f5f3ff" },
    maintenance: { icon: "🔧", color: "#2563eb", bg: "#eff6ff" },
    compliance: { icon: "✅", color: "#059669", bg: "#f0fdf4" },
    staffing: { icon: "👥", color: "#0d9488", bg: "#f0fdfa" },
    training: { icon: "📚", color: "#7c3aed", bg: "#f5f3ff" },
    payroll: { icon: "💰", color: "#059669", bg: "#f0fdf4" },
    "employee-lifecycle": { icon: "🔄", color: "#0d9488", bg: "#f0fdfa" },
    retention: { icon: "⭐", color: "#0d9488", bg: "#f0fdfa" },
    "revenue-cycle": { icon: "💳", color: "#ea580c", bg: "#fff7ed" },
    billing: { icon: "📄", color: "#ea580c", bg: "#fff7ed" },
    budget: { icon: "📋", color: "#ea580c", bg: "#fff7ed" },
    "ap-payments": { icon: "💵", color: "#ea580c", bg: "#fff7ed" },
    "lead-generation": { icon: "📢", color: "#2563eb", bg: "#eff6ff" },
    tours: { icon: "🚶", color: "#2563eb", bg: "#eff6ff" },
    conversion: { icon: "📈", color: "#2563eb", bg: "#eff6ff" },
    "referral-sources": { icon: "🔗", color: "#2563eb", bg: "#eff6ff" },
};

export function getTopicBySlug(slug: string): BusinessTopic | undefined {
    return BUSINESS_TOPICS.find(t => t.slug === slug);
}

export function searchTopics(query: string): BusinessTopic[] {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    return BUSINESS_TOPICS.filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.group.toLowerCase().includes(q) ||
        t.relatedSystems.some(s => s.toLowerCase().includes(q)) ||
        t.relatedProcesses.some(p => p.toLowerCase().includes(q))
    );
}

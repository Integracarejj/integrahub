import { useNavigate } from "react-router-dom";
import { getPortalUserContext, getPortalRequests, getPortalTransactions } from "../../services/portalMockData";
import "./PortalOverview.css";

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    "Provided": { bg: "#f0fdf4", text: "#166534", border: "#bbf7d0" },
    "In Progress": { bg: "#eff6ff", text: "#1e40af", border: "#bfdbfe" },
    "Clarification Needed": { bg: "#fff7ed", text: "#9a3412", border: "#fed7aa" },
    "Under Review": { bg: "#faf5ff", text: "#6b21a8", border: "#ddd6fe" },
    "Open": { bg: "#fff7ed", text: "#9a3412", border: "#fed7aa" },
    "Answered": { bg: "#f0fdf4", text: "#166534", border: "#bbf7d0" },
};

function StatusBadge({ status }: { status: string }) {
    const c = STATUS_COLORS[status] || { bg: "#f8fafc", text: "#475569", border: "#e2e8f0" };
    return (
        <span className="po-status-badge" style={{ background: c.bg, color: c.text, borderColor: c.border }}>
            {status}
        </span>
    );
}

export default function PortalOverview() {
    const navigate = useNavigate();
    const userContext = getPortalUserContext();
    const requests = getPortalRequests().slice(0, 5);
    const transactions = getPortalTransactions();

    const totalRequests = requests.length;
    const providedCount = requests.filter(r => r.status === "Provided").length;
    const inProgressCount = requests.filter(r => r.status === "In Progress").length;
    const clarificationNeededCount = requests.filter(r => r.status === "Clarification Needed").length;
    const newSubmittedCount = requests.filter(r => r.status === "Under Review").length;

    const recentUpdates = [
        { date: "2026-06-16", text: "Property Appraisals moved to Under Review" },
        { date: "2026-06-15", text: "Clarification requested on Staffing Ratios (Facility #7)" },
        { date: "2026-06-14", text: "Staff turnover question submitted" },
        { date: "2026-06-12", text: "Staffing Ratio data uploaded" },
        { date: "2026-06-11", text: "Litigation overview question answered" },
    ];

    return (
        <div className="portal-overview">
            <div className="po-welcome">
                <div className="po-welcome-text">
                    <h1 className="po-welcome-title">Welcome, {userContext.displayName}</h1>
                    <p className="po-welcome-sub">
                        {userContext.companyName} &middot; {userContext.role === "ExternalBuyer" ? "Buyer" : "Broker"} &middot; {transactions.length} active transaction{transactions.length !== 1 ? "s" : ""}
                    </p>
                </div>
            </div>

            <div className="po-summary-row">
                {transactions.map(txn => (
                    <div key={txn.id} className="po-txn-card" onClick={() => navigate("/portal/transactions")}>
                        <div className="po-txn-card-top">
                            <span className="po-txn-name">{txn.name}</span>
                            <StatusBadge status={txn.status} />
                        </div>
                        <p className="po-txn-desc">{txn.description}</p>
                        <div className="po-txn-meta">
                            <span>Buyer: {txn.buyerName}</span>
                            <span>Target Close: {txn.targetClose}</span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="po-stats-row">
                <div className="po-stat-card">
                    <span className="po-stat-value">{totalRequests}</span>
                    <span className="po-stat-label">Total Requests</span>
                </div>
                <div className="po-stat-card">
                    <span className="po-stat-value po-stat-value--green">{providedCount}</span>
                    <span className="po-stat-label">Provided</span>
                </div>
                <div className="po-stat-card">
                    <span className="po-stat-value po-stat-value--blue">{inProgressCount}</span>
                    <span className="po-stat-label">In Progress</span>
                </div>
                <div className="po-stat-card">
                    <span className="po-stat-value po-stat-value--amber">{clarificationNeededCount}</span>
                    <span className="po-stat-label">Clarification Needed</span>
                </div>
                <div className="po-stat-card">
                    <span className="po-stat-value po-stat-value--purple">{newSubmittedCount}</span>
                    <span className="po-stat-label">New Submitted</span>
                </div>
            </div>

            <div className="po-action-row">
                <button className="po-action-card" onClick={() => navigate("/portal/submit?type=question")}>
                    <span className="po-action-icon">&#63;</span>
                    <span className="po-action-title">Ask a General Question</span>
                    <span className="po-action-desc">Submit a question about any transaction</span>
                </button>
                <button className="po-action-card" onClick={() => navigate("/portal/submit?type=clarification")}>
                    <span className="po-action-icon">&#33;</span>
                    <span className="po-action-title">Clarify Existing Request</span>
                    <span className="po-action-desc">Request clarification on a previous submission</span>
                </button>
                <button className="po-action-card" onClick={() => navigate("/portal/submit?type=new-request")}>
                    <span className="po-action-icon">&#43;</span>
                    <span className="po-action-title">Submit New Request</span>
                    <span className="po-action-desc">Submit a new due diligence request</span>
                </button>
            </div>

            <div className="po-bottom-row">
                <div className="po-section">
                    <h2 className="po-section-title">My Recent Requests</h2>
                    <div className="po-requests-table">
                        <div className="po-requests-header">
                            <span>Title</span>
                            <span>Transaction</span>
                            <span>Status</span>
                            <span>Priority</span>
                            <span>Needed By</span>
                        </div>
                        {requests.map(req => (
                            <div key={req.id} className="po-requests-row">
                                <span className="po-requests-title">{req.title}</span>
                                <span className="po-requests-txn">{req.transactionName}</span>
                                <span><StatusBadge status={req.status} /></span>
                                <span className={`po-priority po-priority--${req.priority.toLowerCase()}`}>{req.priority}</span>
                                <span className="po-needed-by">{req.neededBy}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="po-section po-section--narrow">
                    <h2 className="po-section-title">Recent Updates</h2>
                    <div className="po-updates-list">
                        {recentUpdates.map((u, i) => (
                            <div key={i} className="po-update-item">
                                <span className="po-update-date">{u.date}</span>
                                <span className="po-update-text">{u.text}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

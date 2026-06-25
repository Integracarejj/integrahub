import { useNavigate } from "react-router-dom";
import {
    getActiveTransactions, getStatusCounts, getRequests,
    getActivity, getTeamWorkload, getOverrideRequests,
    isDemoActive,
} from "../../services/recapDataService";
import RecapSubNav from "./RecapSubNav";
import "./Recapitalization.css";

export default function RecapitalizationOverview() {
    const navigate = useNavigate();
    const transactions = getActiveTransactions();
    const statusCounts = getStatusCounts();
    const allRequests = getRequests();
    const recentActivity = getActivity(6);
    const workload = getTeamWorkload();
    const needingAttention = getOverrideRequests().slice(0, 4);

    const totalRequests = allRequests.length;
    const provided = statusCounts.Provided || 0;
    const inProgress = statusCounts["In Progress"] || 0;
    const clarificationNeeded = statusCounts["Clarification Needed"] || 0;
    const overdue = statusCounts.Overdue || 0;
    const newExternal = allRequests.filter(r => r.source === "External" && r.status === "Under Review").length;

    return (
        <div className="rc-page">
            <RecapSubNav />
            <div className="rc-header">
                <div className="rc-header-left">
                    <h1>Recapitalization</h1>
                    {isDemoActive() && <span className="rc-badge rc-badge-visible" style={{ fontSize: 10, marginLeft: 8 }}>ABC Demo Active</span>}
                </div>
                <div className="rc-header-actions">
                    <button className="rc-btn rc-btn-secondary" onClick={() => navigate("/recapitalization/intake")}>
                        Intake Queue
                    </button>
                    <button className="rc-btn rc-btn-primary" onClick={() => navigate("/recapitalization/tracker")}>
                        Open Tracker
                    </button>
                </div>
            </div>

            <div className="rc-stats-row">
                <div className="rc-stat-card" style={{ borderLeft: "3px solid #1d4ed8" }}>
                    <span className="rc-stat-value">{totalRequests}</span>
                    <span className="rc-stat-label">Total Requests</span>
                </div>
                <div className="rc-stat-card" style={{ borderLeft: "3px solid #166534" }}>
                    <span className="rc-stat-value">{provided}</span>
                    <span className="rc-stat-label">Provided</span>
                    <span className="rc-stat-desc">{Math.round(provided / totalRequests * 100)}% completion rate</span>
                </div>
                <div className="rc-stat-card" style={{ borderLeft: "3px solid #1e40af" }}>
                    <span className="rc-stat-value">{inProgress}</span>
                    <span className="rc-stat-label">In Progress</span>
                </div>
                <div className="rc-stat-card" style={{ borderLeft: "3px solid #92400e" }}>
                    <span className="rc-stat-value">{clarificationNeeded}</span>
                    <span className="rc-stat-label">Clarification Needed</span>
                </div>
                <div className="rc-stat-card" style={{ borderLeft: "3px solid #991b1b" }}>
                    <span className="rc-stat-value">{overdue}</span>
                    <span className="rc-stat-label">Overdue</span>
                </div>
                <div className="rc-stat-card" style={{ borderLeft: "3px solid #4338ca" }}>
                    <span className="rc-stat-value">{newExternal}</span>
                    <span className="rc-stat-label">New External</span>
                    <span className="rc-stat-desc">Awaiting review</span>
                </div>
            </div>

            <div className="rc-two-col">
                <div className="rc-card">
                    <div className="rc-card-header">
                        <h2>Active Transactions</h2>
                        <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => navigate("/recapitalization/transactions")}>View All</button>
                    </div>
                    <div className="rc-card-body" style={{ padding: 0 }}>
                        {transactions.map(txn => (
                            <div key={txn.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", borderBottom: "1px solid #f1f5f9", cursor: "pointer" }}
                                onClick={() => navigate("/recapitalization/transactions")}>
                                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{txn.name}</span>
                                    <span style={{ fontSize: 11, color: "#64748b" }}>{txn.sellerName} &middot; Close: {txn.targetClose}</span>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <span style={{ fontSize: 11, color: "#475569" }}>{txn.communities.length} communities</span>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: overdue > 0 ? "#991b1b" : "#166534" }}>
                                        {txn.providedCount}/{txn.totalRequests} provided
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="rc-card">
                    <div className="rc-card-header">
                        <h2>Recent Activity</h2>
                    </div>
                    <div className="rc-card-body" style={{ padding: 0 }}>
                        <div className="rc-timeline" style={{ padding: "14px 18px" }}>
                            {recentActivity.map((act, i) => (
                                <div className="rc-timeline-item" key={act.id}>
                                    <div style={{ position: "relative" }}>
                                        <div className="rc-timeline-dot" />
                                        {i < recentActivity.length - 1 && <div className="rc-timeline-line" />}
                                    </div>
                                    <div className="rc-timeline-content">
                                        <span className="rc-timeline-desc">{act.description}</span>
                                        <span className="rc-timeline-meta">{act.userName} &middot; {act.transactionName} &middot; {new Date(act.timestamp).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="rc-two-col">
                <div className="rc-card">
                    <div className="rc-card-header">
                        <h2>Workload by Team</h2>
                    </div>
                    <div className="rc-card-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {workload.map(w => (
                            <div key={w.team} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                <span style={{ width: 140, fontSize: 12, fontWeight: 600, color: "#475569", flexShrink: 0 }}>{w.team}</span>
                                <div style={{ flex: 1, height: 8, background: "#f1f5f9", borderRadius: 4, overflow: "hidden" }}>
                                    <div style={{ height: "100%", width: `${Math.min(100, (w.activeLoad / 6) * 100)}%`, background: w.activeLoad > 4 ? "#991b1b" : w.activeLoad > 2 ? "#1d4ed8" : "#166534", borderRadius: 4, transition: "width 0.3s" }} />
                                </div>
                                <span style={{ fontSize: 12, fontWeight: 600, color: "#64748b", minWidth: 40, textAlign: "right" }}>{w.activeLoad} items</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="rc-card">
                    <div className="rc-card-header">
                        <h2>Needs Attention</h2>
                    </div>
                    <div className="rc-card-body" style={{ padding: 0 }}>
                        {needingAttention.length === 0 && (
                            <div className="rc-empty-state">No items currently needing attention</div>
                        )}
                        {needingAttention.map(req => (
                            <div key={req.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 18px", borderBottom: "1px solid #f1f5f9", cursor: "pointer" }}
                                onClick={() => navigate("/recapitalization/tracker")}>
                                <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                        <span className={`rc-badge rc-badge-${req.status === "Overdue" ? "overdue" : req.status.toLowerCase().replace(/\s+/g, "-")}`}>
                                            {req.status}
                                        </span>
                                        <span style={{ fontSize: 11, color: "#64748b" }}>{req.requestId}</span>
                                    </div>
                                    <span className="rc-truncate" style={{ fontSize: 13, color: "#1e293b" }}>{req.title}</span>
                                </div>
                                <span className="rc-text-muted" style={{ flexShrink: 0, marginLeft: 8 }}>{req.owner || "Unassigned"}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

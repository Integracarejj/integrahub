import { useNavigate } from "react-router-dom";
import { getMyWork, isDemoActive } from "../../services/recapDataService";
import RecapSubNav from "./RecapSubNav";
import "./Recapitalization.css";

export default function RecapitalizationMyWork() {
    const navigate = useNavigate();
    const work = getMyWork("Sarah Chen");

    const sections = [
        { key: "assignedToMe" as const, label: "Assigned to Me", icon: "&#128100;", color: "#1d4ed8", bg: "#eff6ff", items: work.assignedToMe },
        { key: "assignedToMyTeam" as const, label: "Assigned to My Team", icon: "&#128101;", color: "#4338ca", bg: "#eef2ff", items: work.assignedToMyTeam },
        { key: "dueThisWeek" as const, label: "Due This Week", icon: "&#128197;", color: "#92400e", bg: "#fffbeb", items: work.dueThisWeek },
        { key: "overdue" as const, label: "Overdue", icon: "&#9888;", color: "#991b1b", bg: "#fef2f2", items: work.overdue },
        { key: "needsMyResponse" as const, label: "Needs My Response", icon: "&#9993;", color: "#166534", bg: "#f0fdf4", items: work.needsMyResponse },
        { key: "waitingOnExternal" as const, label: "Waiting on External", icon: "&#8987;", color: "#64748b", bg: "#f8fafc", items: work.waitingOnExternal },
    ];

    return (
        <div className="rc-page">
            <RecapSubNav />
            <div className="rc-header">
                <div className="rc-header-left">
                    <h1>My DD Work</h1>
                    {isDemoActive() && <span className="rc-badge rc-badge-visible" style={{ fontSize: 10, marginLeft: 8 }}>Live Demo Data</span>}
                    <span className="rc-text-muted" style={{ fontSize: 13 }}>Sarah Chen &middot; Financial Analysis</span>
                </div>
                <div className="rc-header-actions">
                    <select className="rc-filter-select" defaultValue="sarah">
                        <option value="sarah">Sarah Chen</option>
                        <option value="james">James Wright</option>
                        <option value="lisa">Lisa Park</option>
                        <option value="tom">Tom Davies</option>
                    </select>
                </div>
            </div>

            {sections.map(section => (
                <div key={section.key} className="rc-work-section">
                    <div className="rc-work-section-title">
                        <span>{section.label}</span>
                        <span style={{ fontSize: 13, color: "#64748b" }}>{section.items.length} items</span>
                    </div>
                    <div className="rc-card" style={{ padding: 0 }}>
                        {section.items.length === 0 ? (
                            <div className="rc-empty-state" style={{ padding: "20px" }}>No items in this section</div>
                        ) : section.items.slice(0, 3).map(req => (
                            <div key={req.id} style={{ display: "flex", alignItems: "center", padding: "10px 16px", borderBottom: "1px solid #f1f5f9", cursor: "pointer", gap: 12 }}
                                onClick={() => navigate("/recapitalization/tracker")}>
                                <div style={{ width: 4, height: 32, borderRadius: 2, background: section.color, flexShrink: 0 }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div className="rc-flex-center" style={{ marginBottom: 2, gap: 6 }}>
                                        <span className={`rc-badge rc-badge-${req.status === "Overdue" ? "overdue" : req.status.toLowerCase().replace(/\s+/g, "-")}`} style={{ fontSize: 10 }}>
                                            {req.status}
                                        </span>
                                        <span className={`rc-badge rc-badge-${req.priority.toLowerCase()}`} style={{ fontSize: 10 }}>{req.priority}</span>
                                        <span style={{ fontSize: 11, color: "#64748b" }}>{req.requestId}</span>
                                    </div>
                                    <span className="rc-truncate" style={{ fontSize: 13, fontWeight: 500, display: "block" }}>{req.title}</span>
                                    <span className="rc-text-muted" style={{ fontSize: 11 }}>{req.transactionName} &middot; Due: {req.dueDate}</span>
                                </div>
                                <span style={{ fontSize: 16, color: "#64748b" }}>&#8250;</span>
                            </div>
                        ))}
                        {section.items.length > 3 && (
                            <div style={{ padding: "8px 16px", textAlign: "center", borderTop: "1px solid #f1f5f9" }}>
                                <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => navigate("/recapitalization/tracker")}>
                                    View all {section.items.length} items
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}

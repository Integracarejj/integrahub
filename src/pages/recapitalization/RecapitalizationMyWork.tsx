import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { getRequests, isDemoActive, getTeamMembers } from "../../services/recapDataService";
import type { RecapRequest } from "../../services/recapDataService";
import RecapSubNav from "./RecapSubNav";
import "./Recapitalization.css";

type ViewTab = "active-work" | "completed-work" | "my-team" | "returned";

export default function RecapitalizationMyWork() {
    const navigate = useNavigate();
    const [activeUser, setActiveUser] = useState("Sarah Chen");
    const [detailItem, setDetailItem] = useState<RecapRequest | null>(null);
    const [refreshKey, _setRefreshKey] = useState(0);
    const [successMsg, setSuccessMsg] = useState<{ title: string; body: string } | null>(null);
    const [activeView, setActiveView] = useState<ViewTab>("active-work");
    const members = getTeamMembers();
    const allRequests = useMemo(() => getRequests(), [refreshKey]);

    const workItems = useMemo(() => {
        const published = allRequests.filter(r => r._publishedAt || r._createdFromReview);
        return published.length > 0 ? published : allRequests;
    }, [allRequests]);

    const user = members.find(m => m.name === activeUser);
    const userTeam = user?.team || "";

    const RETURNED_STATUSES = ["Clarification Needed", "Blocked", "Duplicate", "Not Applicable", "Needs Rework"];

    function isActiveExternalClarification(req: RecapRequest): boolean {
        const notes = req._workNotes;
        if (!notes) return false;
        const hasExternalQuestion = notes.some(n => n.action === "Clarification External Question");
        if (!hasExternalQuestion) return false;
        const clarActions = ["Clarification External Question", "Clarification Guidance"];
        const clarNotes = notes.filter(n => clarActions.includes(n.action || ""));
        if (clarNotes.length === 0) return false;
        return clarNotes[clarNotes.length - 1].action === "Clarification External Question";
    }

    function getDisplayStatus(req: RecapRequest): string {
        const wn = req._workNotes;
        if (req._exceptionSentAt && req._exceptionRecommendation === "Duplicate") return "Sent to Partner (Duplicate Review)";
        if (req._exceptionSentAt && req._exceptionRecommendation === "Not Applicable") return "Sent to Partner (Removal Review)";
        if (req._exceptionDecision === "Confirm Duplicate" || req._exceptionDecision === "Keep Separate") return "Duplicate Decision Received";
        if (req._exceptionDecision === "Approve Removal" || req._exceptionDecision === "Keep Request") return "Removal Decision Received";
        if (wn?.some(n => n.action === "Clarification Response") && req.status === "In Progress") return "Clarification Response Received";
        if (req.status === "Duplicate") return "Duplicate Review Pending";
        if (req.status === "Not Applicable") return "Not Applicable Review Pending";
        if (req.status === "Clarification Needed") {
            if (wn?.some(n => n.action === "Clarification External Question") && !isActiveExternalClarification(req)) return "Clarification Response Received";
            return "Clarification Requested";
        }
        if (req.status === "Needs Rework") return "Needs Rework";
        return req.status;
    }

    const assignedToMe = useMemo(() => {
        return workItems
            .filter(r => r.owner === activeUser || r.assignedTo === activeUser)
            .sort((a, b) => {
                const aDate = a.lastUpdated || "";
                const bDate = b.lastUpdated || "";
                if (bDate !== aDate) return bDate.localeCompare(aDate);
                const aDue = a.dueDate || "9999-99-99";
                const bDue = b.dueDate || "9999-99-99";
                if (aDue !== bDue) return aDue.localeCompare(bDue);
                const pMap: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
                return (pMap[a.priority] || 1) - (pMap[b.priority] || 1);
            });
    }, [workItems, activeUser]);

    const activeWork = useMemo(() => {
        return assignedToMe.filter(r =>
            r.status !== "Complete" &&
            r._externalStatus !== "Ready to Publish" &&
            r._externalStatus !== "Published External" &&
            !RETURNED_STATUSES.includes(r.status) &&
            !r._needsReassignment
        );
    }, [assignedToMe]);

    const completedWork = useMemo(() => {
        return assignedToMe.filter(r =>
            r.status === "Complete" ||
            r._externalStatus === "Ready to Publish" ||
            (r._externalStatus === "Published External" && r.status !== "Needs Rework")
        );
    }, [assignedToMe]);

    const myTeamItems = useMemo(() => {
        return workItems
            .filter(r => r.team === userTeam && r.owner !== activeUser && r.assignedTo !== activeUser)
            .sort((a, b) => {
                const aDue = a.dueDate || "9999-99-99";
                const bDue = b.dueDate || "9999-99-99";
                if (aDue !== bDue) return aDue.localeCompare(bDue);
                const pMap: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
                return (pMap[a.priority] || 1) - (pMap[b.priority] || 1);
            });
    }, [workItems, userTeam, activeUser]);

    const returnedItems = useMemo(() => {
        return assignedToMe.filter(r =>
            (RETURNED_STATUSES.includes(r.status) && !(r.status === "Clarification Needed" && (r._returnReason || isActiveExternalClarification(r)))) || r._needsReassignment
        );
    }, [assignedToMe]);

    const activeItems = useMemo(() => {
        switch (activeView) {
            case "active-work": return activeWork;
            case "completed-work": return completedWork;
            case "my-team": return myTeamItems;
            case "returned": return returnedItems;
        }
    }, [activeView, activeWork, completedWork, myTeamItems, returnedItems]);

    const emptyMessages: Record<ViewTab, string> = {
        "active-work": "No active items assigned to you.",
        "completed-work": "No completed items.",
        "my-team": "No items for your team.",
        "returned": "No items need your attention.",
    };

    const tabLabels: Record<ViewTab, string> = {
        "active-work": "Active Work",
        "completed-work": "Completed Work",
        "my-team": "My Team",
        "returned": "Returned / Needs Attention",
    };

    const StatusBadge = ({ displayLabel }: { displayLabel: string }) => {
        const cls = displayLabel === "Overdue" ? "overdue" : displayLabel.toLowerCase().replace(/\s+/g, "-");
        return <span className={`rc-badge rc-badge-${cls}`} style={{ fontSize: 10 }}>{displayLabel}</span>;
    };

    const PriorityBadge = ({ priority }: { priority: string }) => (
        <span className={`rc-badge rc-badge-${priority.toLowerCase()}`} style={{ fontSize: 10 }}>{priority}</span>
    );

    function openWorkspace(req: RecapRequest) {
        navigate(`/recapitalization/workspace/${req.id}`, { state: { from: "my-work" } });
    }

    function renderTable(items: RecapRequest[], emptyMsg: string) {
        if (items.length === 0) return <div className="rc-empty-state" style={{ padding: 20 }}>{emptyMsg}</div>;
        return (
            <div style={{ overflowX: "auto" }}>
            <table className="rc-table">
                <thead>
                    <tr>
                        <th style={{ width: 110, minWidth: 90 }}>Request ID</th>
                        <th style={{ minWidth: 180 }}>Deliverable</th>
                        <th style={{ width: 100, minWidth: 80 }}>Community</th>
                        <th style={{ width: 60, textAlign: "center" }}>Priority</th>
                        <th style={{ width: 110, minWidth: 90 }}>Status</th>
                        <th style={{ width: 85, minWidth: 70 }}>Due Date</th>
                        <th style={{ width: 80, minWidth: 65 }}>Updated</th>
                        <th style={{ width: 90, minWidth: 80, textAlign: "center" }}>Action</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map(req => (
                        <tr key={req.id} className="rc-row-clickable" onClick={() => openWorkspace(req)}>
                            <td style={{ fontFamily: '"SF Mono", "Cascadia Code", "Consolas", monospace', fontSize: 11, color: "#475569", fontWeight: 600 }}>{req.requestId}</td>
                            <td className="rc-truncate" style={{ fontWeight: 500, maxWidth: 220 }}>{req.title.split(" - ").slice(1).join(" - ").trim() || req.title}</td>
                            <td style={{ fontSize: 12, color: "#475569" }}>{req.communityNames[0] || "\u2014"}</td>
                            <td style={{ textAlign: "center" }}><PriorityBadge priority={req.priority} /></td>
                            <td><StatusBadge displayLabel={getDisplayStatus(req)} /></td>
                            <td style={{ fontSize: 12, color: req.dueDate && new Date(req.dueDate) < new Date() ? "#991b1b" : "#475569", fontWeight: req.dueDate && new Date(req.dueDate) < new Date() ? 600 : 400 }}>{req.dueDate || "\u2014"}</td>
                            <td style={{ fontSize: 12, color: req.lastUpdated ? "#475569" : "#64748b" }}>{req.lastUpdated || "\u2014"}</td>
                            <td onClick={e => e.stopPropagation()} style={{ textAlign: "center" }}>
                                <button
                                    onClick={() => openWorkspace(req)}
                                    style={{
                                        fontSize: 12,
                                        padding: "6px 16px",
                                        borderRadius: 8,
                                        background: "#1d4ed8",
                                        color: "#fff",
                                        border: "none",
                                        cursor: "pointer",
                                        fontWeight: 600,
                                        whiteSpace: "nowrap",
                                    }}
                                    onMouseEnter={e => { (e.target as HTMLElement).style.background = "#1e40af"; }}
                                    onMouseLeave={e => { (e.target as HTMLElement).style.background = "#1d4ed8"; }}
                                >
                                    {req.status === "In Progress" || req.status === "Needs Rework" ? "Resume" : "Open"}
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            </div>
        );
    }

    return (
        <div className="rc-page">
            <RecapSubNav />
            <div className="rc-header">
                <div className="rc-header-left">
                    <h1>My Work</h1>
                    {isDemoActive() && <span className="rc-badge rc-badge-visible" style={{ fontSize: 10, marginLeft: 8 }}>Live Demo Data</span>}
                    {isDemoActive() && (
                        <span style={{ fontSize: 11, color: "#475569", display: "inline-flex", alignItems: "center", gap: 4, marginLeft: 8 }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
                            Testing as: <strong>{activeUser}</strong>
                        </span>
                    )}
                </div>
                <div className="rc-header-actions">
                    <select className="rc-filter-select" value={activeUser} onChange={e => setActiveUser(e.target.value)}>
                        {members.map(m => <option key={m.id} value={m.name}>{m.name}{m.id === "user-demo" ? " (Test Persona)" : ""}</option>)}
                    </select>
                </div>
            </div>

            <div className="rc-view-tabs" style={{ display: "flex", gap: 0, marginBottom: 16, borderBottom: "2px solid #e2e8f0" }}>
                {(["active-work", "completed-work", "my-team", "returned"] as const).map(view => (
                    <button key={view} onClick={() => setActiveView(view)}
                        style={{ padding: "8px 16px", fontSize: 13, fontWeight: activeView === view ? 700 : 500, color: activeView === view ? "#1d4ed8" : "#475569", background: "none", border: "none", borderBottom: activeView === view ? "2px solid #1d4ed8" : "2px solid transparent", marginBottom: -2, cursor: "pointer", transition: "all 0.15s" }}>
                        {tabLabels[view]}
                    </button>
                ))}
            </div>

            <div className="rc-card">
                <div className="rc-card-header">
                    <h2>{tabLabels[activeView]} ({activeItems.length})</h2>
                </div>
                <div className="rc-card-body" style={{ padding: 0 }}>
                    {renderTable(activeItems, emptyMessages[activeView])}
                </div>
            </div>

            {detailItem && (
                <div className="rc-modal-overlay" onClick={() => setDetailItem(null)}>
                    <div className="rc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
                        <div className="rc-modal-header">
                            <h2>{detailItem.title}</h2>
                            <button className="rc-modal-close" onClick={() => setDetailItem(null)}>&times;</button>
                        </div>
                        <div className="rc-modal-body">
                            <div className="rc-detail-grid">
                                <div className="rc-drawer-field">
                                    <span className="rc-drawer-field-label">Request ID</span>
                                    <span className="rc-drawer-field-value">{detailItem.requestId}</span>
                                </div>
                                <div className="rc-drawer-field">
                                    <span className="rc-drawer-field-label">Intake ID</span>
                                    <span className="rc-drawer-field-value">{detailItem.intakeId}</span>
                                </div>
                                <div className="rc-drawer-field">
                                    <span className="rc-drawer-field-label">Status</span>
                                    <span className="rc-drawer-field-value"><StatusBadge displayLabel={getDisplayStatus(detailItem)} /></span>
                                </div>
                                <div className="rc-drawer-field">
                                    <span className="rc-drawer-field-label">Priority</span>
                                    <span className="rc-drawer-field-value"><PriorityBadge priority={detailItem.priority} /></span>
                                </div>
                                <div className="rc-drawer-field">
                                    <span className="rc-drawer-field-label">Team</span>
                                    <span className="rc-drawer-field-value">{detailItem.team}</span>
                                </div>
                                <div className="rc-drawer-field">
                                    <span className="rc-drawer-field-label">Due Date</span>
                                    <span className="rc-drawer-field-value">{detailItem.dueDate}</span>
                                </div>
                                <div className="rc-drawer-field">
                                    <span className="rc-drawer-field-label">Assigned To</span>
                                    <span className="rc-drawer-field-value">{detailItem.owner || "Unassigned"}</span>
                                </div>
                                <div className="rc-drawer-field">
                                    <span className="rc-drawer-field-label">Updated</span>
                                    <span className="rc-drawer-field-value">{detailItem.lastUpdated}</span>
                                </div>
                            </div>
                        </div>
                        <div className="rc-modal-footer">
                            <button className="rc-btn rc-btn-secondary" onClick={() => setDetailItem(null)}>Close</button>
                            <button className="rc-btn rc-btn-primary" onClick={() => { setDetailItem(null); openWorkspace(detailItem); }}>Open Workspace</button>
                        </div>
                    </div>
                </div>
            )}

            {successMsg && (
                <div className="rc-modal-overlay" onClick={() => setSuccessMsg(null)}>
                    <div className="rc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
                        <div className="rc-modal-header">
                            <h2>{successMsg.title}</h2>
                            <button className="rc-modal-close" onClick={() => setSuccessMsg(null)}>&times;</button>
                        </div>
                        <div className="rc-modal-body" style={{ padding: "20px", textAlign: "center" }}>
                            <div style={{ fontSize: 40, marginBottom: 8 }}>&#10003;</div>
                            <div style={{ fontSize: 14, color: "#166534", fontWeight: 500, lineHeight: 1.5 }}>{successMsg.body}</div>
                        </div>
                        <div className="rc-modal-footer" style={{ justifyContent: "center" }}>
                            <button className="rc-btn rc-btn-primary" onClick={() => setSuccessMsg(null)}>OK</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { getRequests, isDemoActive, getTeamMembers, updateRequestStatus, bulkUpdateDemoRequests } from "../../services/recapDataService";
import type { RecapRequest } from "../../services/recapDataService";
import RecapSubNav from "./RecapSubNav";
import "./Recapitalization.css";

const STATUS_OPTIONS = ["Open", "In Progress", "Blocked", "Complete", "Not Applicable", "Duplicate"];

const CARD_FILTERS = ["all", "assigned", "completed", "inProgress", "blocked"] as const;
type CardFilter = (typeof CARD_FILTERS)[number];

export default function RecapitalizationMyWork() {
    const navigate = useNavigate();
    const [activeUser, setActiveUser] = useState("Sarah Chen");
    const [detailItem, setDetailItem] = useState<RecapRequest | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const [bulkToast, setBulkToast] = useState("");
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [activeCard, setActiveCard] = useState<CardFilter>("all");
    const [activeView, setActiveView] = useState<"assigned-to-me" | "my-team" | "needs-dd-review" | "recently-updated">("assigned-to-me");
    const [pendingStatuses, setPendingStatuses] = useState<Record<string, string>>({});
    const [confirmAction, setConfirmAction] = useState<{ title: string; action: () => void } | null>(null);
    const members = getTeamMembers();
    const allRequests = useMemo(() => getRequests(), [refreshKey]);

    // Only show published/createdFromReview items
    const publishedRequests = useMemo(() => allRequests.filter(r => r._publishedAt || r._createdFromReview), [allRequests]);

    const myItems = useMemo(() => {
        const user = members.find(m => m.name === activeUser);
        const userTeam = user?.team || "";
        const assignedToMe = publishedRequests
            .filter(r => r.owner === activeUser || r.assignedTo === activeUser)
            .sort((a, b) => {
                const aAssigned = a.lastUpdated || "";
                const bAssigned = b.lastUpdated || "";
                if (bAssigned !== aAssigned) return bAssigned.localeCompare(aAssigned);
                const aDue = a.dueDate || "9999-99-99";
                const bDue = b.dueDate || "9999-99-99";
                if (aDue !== bDue) return aDue.localeCompare(bDue);
                const pMap: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
                return (pMap[a.priority] || 1) - (pMap[b.priority] || 1);
            });
        const myTeam = publishedRequests
            .filter(r => r.team === userTeam && r.owner !== activeUser && r.assignedTo !== activeUser)
            .sort((a, b) => {
                const aDue = a.dueDate || "9999-99-99";
                const bDue = b.dueDate || "9999-99-99";
                if (aDue !== bDue) return aDue.localeCompare(bDue);
                const pMap: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
                return (pMap[a.priority] || 1) - (pMap[b.priority] || 1);
            });
        return { assignedToMe, myTeam };
    }, [publishedRequests, activeUser, members]);

    const needsDDReview = useMemo(() => {
        return publishedRequests
            .filter(r => r.status === "Complete" && !r._publishedExternal)
            .sort((a, b) => {
                const aDue = a.dueDate || "9999-99-99";
                const bDue = b.dueDate || "9999-99-99";
                if (aDue !== bDue) return aDue.localeCompare(bDue);
                const pMap: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
                return (pMap[a.priority] || 1) - (pMap[b.priority] || 1);
            });
    }, [publishedRequests]);

    const recentlyUpdated = useMemo(() => {
        return [...publishedRequests]
            .filter(r => r.lastUpdated)
            .sort((a, b) => {
                const aDate = a.lastUpdated || "";
                const bDate = b.lastUpdated || "";
                return bDate.localeCompare(aDate);
            });
    }, [publishedRequests]);

    const totalAssigned = myItems.assignedToMe.length;

    const cardCounts = useMemo(() => {
        const assigned = myItems.assignedToMe.length;
        const completed = myItems.assignedToMe.filter(r => r.status === "Complete" || r.status === "Provided").length;
        const inProgress = myItems.assignedToMe.filter(r => r.status === "In Progress").length;
        const blocked = myItems.assignedToMe.filter(r => (r.status as string) === "Blocked").length;
        return { assigned, completed, inProgress, blocked };
    }, [myItems.assignedToMe]);

    const filteredItems = useMemo(() => {
        let items = myItems.assignedToMe;
        switch (activeCard) {
            case "completed":
                items = items.filter(r => r.status === "Complete" || r.status === "Provided");
                break;
            case "inProgress":
                items = items.filter(r => r.status === "In Progress");
                break;
            case "blocked":
                items = items.filter(r => (r.status as string) === "Blocked");
                break;
            default:
                break;
        }
        return items;
    }, [myItems.assignedToMe, activeCard]);

    function handleStatusChange(req: RecapRequest, newStatus: string) {
        updateRequestStatus(req.id, newStatus as RecapRequest["status"]);
        setRefreshKey(k => k + 1);
        setBulkToast(`${req.requestId}: status changed to ${newStatus}`);
    }

    function handleBulkStatus(newStatus: string) {
        const ids = [...selectedIds];
        ids.forEach(id => updateRequestStatus(id, newStatus as RecapRequest["status"]));
        setRefreshKey(k => k + 1);
        setBulkToast(`Updated ${ids.length} item${ids.length !== 1 ? "s" : ""} to ${newStatus}`);
        setSelectedIds(new Set());
    }

    function handleBulkDueDate(date: string) {
        const ids = [...selectedIds];
        ids.forEach(id => bulkUpdateDemoRequests([id], { dueDate: date }));
        setRefreshKey(k => k + 1);
        setBulkToast(`Set due date for ${ids.length} item${ids.length !== 1 ? "s" : ""}`);
        setSelectedIds(new Set());
    }

    function handleBulkComplete() {
        handleBulkStatus("Complete");
    }

    function pct(count: number): string {
        if (totalAssigned === 0) return "0%";
        return Math.round((count / totalAssigned) * 100) + "%";
    }

    const StatusBadge = ({ status }: { status: string }) => {
        const cls = status === "Overdue" ? "overdue" : status.toLowerCase().replace(/\s+/g, "-");
        return <span className={`rc-badge rc-badge-${cls}`} style={{ fontSize: 10 }}>{status}</span>;
    };

    const PriorityBadge = ({ priority }: { priority: string }) => (
        <span className={`rc-badge rc-badge-${priority.toLowerCase()}`} style={{ fontSize: 10 }}>{priority}</span>
    );

    function renderTable(items: RecapRequest[], emptyMsg: string, showCheckboxes = false) {
        if (items.length === 0) return <div className="rc-empty-state" style={{ padding: 20 }}>{emptyMsg}</div>;
        return (
            <table className="rc-table">
                <thead>
                    <tr>
                        {showCheckboxes && <th style={{ width: 16, paddingRight: 4 }}></th>}
                        <th style={{ minWidth: 160 }}>Deliverable</th>
                        <th style={{ minWidth: 80 }}>Community</th>
                        <th style={{ minWidth: 60 }}>Priority</th>
                        <th style={{ minWidth: 110 }}>Status</th>
                        <th style={{ minWidth: 80 }}>Due</th>
                        <th style={{ minWidth: 80 }}>Assigned</th>
                        <th style={{ minWidth: 80 }}>Team</th>
                        <th style={{ minWidth: 80 }}>Request ID</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map(req => (
                        <tr key={req.id} className="rc-row-clickable" onClick={() => navigate(`/recapitalization/workspace/${req.intakeId}`, { state: { from: "my-work" } })}>
                            {showCheckboxes && (
                                <td style={{ width: 16, paddingRight: 4 }} onClick={e => e.stopPropagation()}>
                                    <input type="checkbox" checked={selectedIds.has(req.id)} onChange={() => {
                                        setSelectedIds(prev => { const n = new Set(prev); if (n.has(req.id)) n.delete(req.id); else n.add(req.id); return n; });
                                    }} />
                                </td>
                            )}
                            <td className="rc-truncate" style={{ fontWeight: 500, maxWidth: 200 }}>{req.title.split(" - ").slice(1).join(" - ").trim() || req.title}</td>
                            <td style={{ fontSize: 12, color: "#475569" }}>{req.communityNames[0] || "\u2014"}</td>
                            <td><PriorityBadge priority={req.priority} /></td>
                            <td onClick={e => e.stopPropagation()}>
                                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                    <select
                                        value={pendingStatuses[req.id] ?? req.status}
                                        onChange={e => setPendingStatuses(prev => ({ ...prev, [req.id]: e.target.value }))}
                                        style={{ fontSize: 10, padding: "2px 18px 2px 4px", borderRadius: 4, background: "#fff", color: "#111827", fontWeight: 600, minWidth: 100, cursor: "pointer", border: pendingStatuses[req.id] && pendingStatuses[req.id] !== req.status ? "1px solid #1d4ed8" : "1px solid #d1d5db" }}
                                    >
                                        {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                    {pendingStatuses[req.id] && pendingStatuses[req.id] !== req.status && (
                                        <button className="rc-btn rc-btn-primary rc-btn-sm" style={{ fontSize: 9, padding: "1px 6px", whiteSpace: "nowrap" }} onClick={e => { e.stopPropagation(); handleStatusChange(req, pendingStatuses[req.id]); setPendingStatuses(prev => { const n = { ...prev }; delete n[req.id]; return n; }); }}>
                                            Change to {pendingStatuses[req.id]}
                                        </button>
                                    )}
                                </div>
                            </td>
                            <td className="nowrap" style={{ fontSize: 12, color: req.status === "Overdue" ? "#991b1b" : "#475569", fontWeight: req.status === "Overdue" ? 600 : 400 }}>{req.dueDate}</td>
                            <td style={{ fontSize: 12, color: req.lastUpdated ? "#475569" : "#94a3b8" }}>{req.lastUpdated || "\u2014"}</td>
                            <td style={{ fontSize: 12 }}>{req.team}</td>
                            <td style={{ fontFamily: '"SF Mono", "Cascadia Code", "Consolas", monospace', fontSize: 11, color: "#475569" }}>{req.requestId}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    }

    return (
        <div className="rc-page">
            <RecapSubNav />
            {bulkToast && (
                <div style={{ padding: "8px 16px", marginBottom: 12, borderRadius: 8, fontSize: 13, fontWeight: 600, background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0" }}>
                    {bulkToast}
                    <button style={{ background: "none", border: "none", color: "#166534", marginLeft: 8, cursor: "pointer", fontSize: 12 }} onClick={() => setBulkToast("")}>OK</button>
                </div>
            )}
            <div className="rc-header">
                <div className="rc-header-left">
                    <h1>My Work</h1>
                    {isDemoActive() && <span className="rc-badge rc-badge-visible" style={{ fontSize: 10, marginLeft: 8 }}>Live Demo Data</span>}
                </div>
                <div className="rc-header-actions">
                    <select className="rc-filter-select" value={activeUser} onChange={e => setActiveUser(e.target.value)}>
                        {members.map(m => <option key={m.id} value={m.name}>{m.name}{m.id === "user-demo" ? " (Test Persona)" : ""}</option>)}
                    </select>
                </div>
            </div>

            <div className="rc-stats-row">
                <div className={`rc-stat-card ${activeCard === "assigned" ? "rc-stat-active" : ""}`} onClick={() => { setActiveView("assigned-to-me"); setActiveCard(activeCard === "assigned" ? "all" : "assigned"); }} style={{ cursor: "pointer" }}>
                    <span className="rc-stat-value">{cardCounts.assigned}</span>
                    <span className="rc-stat-label">Assigned to Me</span>
                    <span className="rc-stat-desc">{pct(cardCounts.assigned)} of work</span>
                </div>
                <div className={`rc-stat-card ${activeCard === "completed" ? "rc-stat-active" : ""}`} onClick={() => { setActiveView("assigned-to-me"); setActiveCard(activeCard === "completed" ? "all" : "completed"); }} style={{ borderLeft: "3px solid #166534", cursor: "pointer" }}>
                    <span className="rc-stat-value">{cardCounts.completed}</span>
                    <span className="rc-stat-label">Completed</span>
                    <span className="rc-stat-desc">{pct(cardCounts.completed)} of assigned</span>
                </div>
                <div className={`rc-stat-card ${activeCard === "inProgress" ? "rc-stat-active" : ""}`} onClick={() => { setActiveView("assigned-to-me"); setActiveCard(activeCard === "inProgress" ? "all" : "inProgress"); }} style={{ borderLeft: "3px solid #1d4ed8", cursor: "pointer" }}>
                    <span className="rc-stat-value">{cardCounts.inProgress}</span>
                    <span className="rc-stat-label">In Progress</span>
                    <span className="rc-stat-desc">{pct(cardCounts.inProgress)} of assigned</span>
                </div>
                <div className={`rc-stat-card ${activeCard === "blocked" ? "rc-stat-active" : ""}`} onClick={() => { setActiveView("assigned-to-me"); setActiveCard(activeCard === "blocked" ? "all" : "blocked"); }} style={{ borderLeft: "3px solid #991b1b", cursor: "pointer" }}>
                    <span className="rc-stat-value">{cardCounts.blocked}</span>
                    <span className="rc-stat-label">Blocked</span>
                    <span className="rc-stat-desc">{pct(cardCounts.blocked)} of assigned</span>
                </div>
            </div>

            {/* Bulk actions bar */}
            {selectedIds.size > 0 && (
                <div className="rc-bulk-bar" style={{ marginBottom: 8 }}>
                    <span><span className="rc-bulk-count">{selectedIds.size}</span> selected</span>
                    <div className="rc-bulk-sep" />
                    <select onChange={e => { if (e.target.value) setConfirmAction({ title: `Change status of ${selectedIds.size} item${selectedIds.size !== 1 ? "s" : ""} to ${e.target.value}?`, action: () => { handleBulkStatus(e.target.value); } }); e.target.value = ""; }}
                        style={{ fontSize: 11, padding: "2px 18px 2px 6px", borderRadius: 4, border: "1px solid #d1d5db" }}>
                        <option value="">Change Status...</option>
                        {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <input type="date" onChange={e => { if (e.target.value) handleBulkDueDate(e.target.value); e.target.value = ""; }}
                        style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, border: "1px solid #d1d5db", maxWidth: 130 }}
                        placeholder="Set due date" />
                    <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => setConfirmAction({ title: `Mark ${selectedIds.size} item${selectedIds.size !== 1 ? "s" : ""} Complete?`, action: handleBulkComplete })}>Mark Complete</button>
                    <div className="rc-bulk-sep" />
                    <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => setSelectedIds(new Set())}>Clear Selection</button>
                </div>
            )}

            <div className="rc-view-tabs" style={{ display: "flex", gap: 0, marginBottom: 16, borderBottom: "2px solid #e2e8f0" }}>
                {(["assigned-to-me", "my-team", "needs-dd-review", "recently-updated"] as const).map(view => (
                    <button key={view} onClick={() => { setActiveView(view); if (view !== "assigned-to-me") setActiveCard("all"); }}
                        style={{ padding: "8px 16px", fontSize: 13, fontWeight: activeView === view ? 700 : 500, color: activeView === view ? "#1d4ed8" : "#475569", background: "none", border: "none", borderBottom: activeView === view ? "2px solid #1d4ed8" : "2px solid transparent", marginBottom: -2, cursor: "pointer", transition: "all 0.15s" }}>
                        {view === "assigned-to-me" ? "Assigned to Me" : view === "my-team" ? "My Team" : view === "needs-dd-review" ? "Needs DD Review" : "Recently Updated"}
                    </button>
                ))}
            </div>

            <div className="rc-card">
                <div className="rc-card-header">
                    <h2>
                        {activeView === "assigned-to-me" ? `Assigned to Me (${filteredItems.length})` :
                         activeView === "my-team" ? `My Team (${myItems.myTeam.length})` :
                         activeView === "needs-dd-review" ? `Needs DD Review (${needsDDReview.length})` :
                         `Recently Updated (${recentlyUpdated.length})`}
                    </h2>
                </div>
                <div className="rc-card-body" style={{ padding: 0 }}>
                    {activeView === "assigned-to-me" && renderTable(filteredItems, "No items assigned to you.", true)}
                    {activeView === "my-team" && renderTable(myItems.myTeam, "No items for your team.", false)}
                    {activeView === "needs-dd-review" && renderTable(needsDDReview, "No items needing DD review.", false)}
                    {activeView === "recently-updated" && renderTable(recentlyUpdated, "No recently updated items.", false)}
                </div>
            </div>


            {confirmAction && (
                <div className="rc-modal-overlay" onClick={() => setConfirmAction(null)}>
                    <div className="rc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
                        <div className="rc-modal-header">
                            <h2>Confirm</h2>
                            <button className="rc-modal-close" onClick={() => setConfirmAction(null)}>&times;</button>
                        </div>
                        <div className="rc-modal-body" style={{ padding: "16px", textAlign: "center" }}>
                            <p style={{ fontSize: 14, fontWeight: 600, color: "#1e293b", margin: 0 }}>{confirmAction.title}</p>
                        </div>
                        <div className="rc-modal-footer">
                            <button className="rc-btn rc-btn-ghost" onClick={() => setConfirmAction(null)}>Cancel</button>
                            <button className="rc-btn rc-btn-primary" onClick={() => { confirmAction.action(); setConfirmAction(null); }}>Confirm</button>
                        </div>
                    </div>
                </div>
            )}

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
                                    <span className="rc-drawer-field-value"><StatusBadge status={detailItem.status} /></span>
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
                            <button className="rc-btn rc-btn-primary" onClick={() => { setDetailItem(null); navigate(`/recapitalization/workspace/${detailItem.intakeId}`, { state: { from: "my-work" } }); }}>Open Workspace</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
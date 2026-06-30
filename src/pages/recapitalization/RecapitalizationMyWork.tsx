import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { getRequests, isDemoActive, getTeamMembers, updateRequestStatus, bulkUpdateDemoRequests, getDocuments, updateRequestNotMine } from "../../services/recapDataService";
import type { RecapRequest } from "../../services/recapDataService";
import RecapSubNav from "./RecapSubNav";
import "./Recapitalization.css";

const STATUS_OPTIONS = ["Open", "In Progress", "Blocked", "Complete", "Not Applicable", "Duplicate"];
const RETURNED_STATUSES = ["Clarification Needed", "Blocked"];

type ViewTab = "active-work" | "completed-work" | "my-team" | "returned";

export default function RecapitalizationMyWork() {
    const navigate = useNavigate();
    const [activeUser, setActiveUser] = useState("Sarah Chen");
    const [detailItem, setDetailItem] = useState<RecapRequest | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const [bulkToast, setBulkToast] = useState("");
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [activeView, setActiveView] = useState<ViewTab>("active-work");
    const [statusConfirm, setStatusConfirm] = useState<{ req: RecapRequest; newStatus: string } | null>(null);
    const [artifactWarning, setArtifactWarning] = useState<{ req: RecapRequest; newStatus: string } | null>(null);
    const [notMine, setNotMine] = useState<{ req: RecapRequest; reason: string } | null>(null);
    const [confirmAction, setConfirmAction] = useState<{ title: string; action: () => void } | null>(null);
    const members = getTeamMembers();
    const allRequests = useMemo(() => getRequests(), [refreshKey]);

    const publishedRequests = useMemo(() => allRequests.filter(r => r._publishedAt || r._createdFromReview), [allRequests]);

    const user = members.find(m => m.name === activeUser);
    const userTeam = user?.team || "";

    const assignedToMe = useMemo(() => {
        return publishedRequests
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
    }, [publishedRequests, activeUser]);

    const activeWork = useMemo(() => {
        return assignedToMe.filter(r =>
            r.status !== "Complete" &&
            r._externalStatus !== "Ready to Publish"
        );
    }, [assignedToMe]);

    const completedWork = useMemo(() => {
        return assignedToMe.filter(r =>
            r.status === "Complete" ||
            r._externalStatus === "Ready to Publish" ||
            r._externalStatus === "Published External"
        );
    }, [assignedToMe]);

    const myTeamItems = useMemo(() => {
        return publishedRequests
            .filter(r => r.team === userTeam && r.owner !== activeUser && r.assignedTo !== activeUser)
            .sort((a, b) => {
                const aDue = a.dueDate || "9999-99-99";
                const bDue = b.dueDate || "9999-99-99";
                if (aDue !== bDue) return aDue.localeCompare(bDue);
                const pMap: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
                return (pMap[a.priority] || 1) - (pMap[b.priority] || 1);
            });
    }, [publishedRequests, userTeam, activeUser]);

    const returnedItems = useMemo(() => {
        return assignedToMe.filter(r =>
            RETURNED_STATUSES.includes(r.status)
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

    function hasDocuments(req: RecapRequest): boolean {
        const docs = getDocuments();
        return docs.some(d => d.requestId === req.requestId || d.requestTitle === req.title);
    }

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
        const ids = [...selectedIds];
        const allReqs = publishedRequests;
        const noArtifactItems = ids.filter(reqId => {
            const req = allReqs.find(r => r.id === reqId);
            return req && !hasDocuments(req);
        });
        if (noArtifactItems.length > 0) {
            setBulkToast(`Warning: ${noArtifactItems.length} item${noArtifactItems.length !== 1 ? "s" : ""} ha${noArtifactItems.length !== 1 ? "ve" : "s"} no artifacts. Use per-item status change to mark Complete.`);
            return;
        }
        handleBulkStatus("Complete");
    }

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
                        <th style={{ minWidth: 80 }}>Updated</th>
                        <th style={{ minWidth: 80 }}>Team</th>
                        <th style={{ minWidth: 100 }}>Request ID</th>
                        <th style={{ minWidth: 70 }}>Actions</th>
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
                                        value={req.status}
                                        onChange={e => {
                                            const newStatus = e.target.value;
                                            if (newStatus !== req.status) {
                                                if (newStatus === "Complete" && !hasDocuments(req)) {
                                                    setArtifactWarning({ req, newStatus });
                                                } else {
                                                    setStatusConfirm({ req, newStatus });
                                                }
                                            }
                                        }}
                                        style={{ fontSize: 10, padding: "2px 18px 2px 4px", borderRadius: 4, background: "#fff", color: "#111827", fontWeight: 600, minWidth: 100, cursor: "pointer", border: "1px solid #d1d5db" }}
                                    >
                                        {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                            </td>
                            <td className="nowrap" style={{ fontSize: 12, color: req.status === "Overdue" ? "#991b1b" : "#475569", fontWeight: req.status === "Overdue" ? 600 : 400 }}>{req.dueDate}</td>
                            <td style={{ fontSize: 12, color: req.lastUpdated ? "#475569" : "#94a3b8" }}>{req.lastUpdated || "\u2014"}</td>
                            <td style={{ fontSize: 12 }}>{req.team}</td>
                            <td style={{ fontFamily: '"SF Mono", "Cascadia Code", "Consolas", monospace', fontSize: 11, color: "#475569" }}>{req.requestId}</td>
                            <td onClick={e => e.stopPropagation()}>
                                {req.owner === activeUser && req.status !== "Complete" && (
                                    <button
                                        onClick={() => setNotMine({ req, reason: "" })}
                                        style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: "#fff", color: "#dc2626", border: "1px solid #fecaca", cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" }}
                                        title="Report this item was not assigned to you"
                                    >
                                        Not Mine
                                    </button>
                                )}
                            </td>
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
                    {renderTable(activeItems, emptyMessages[activeView], activeView !== "my-team")}
                </div>
            </div>

            {statusConfirm && (
                <div className="rc-modal-overlay" onClick={() => setStatusConfirm(null)}>
                    <div className="rc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
                        <div className="rc-modal-header">
                            <h2>Change Status</h2>
                            <button className="rc-modal-close" onClick={() => setStatusConfirm(null)}>&times;</button>
                        </div>
                        <div className="rc-modal-body" style={{ padding: "16px 20px" }}>
                            <div style={{ fontSize: 14, color: "#1e293b", fontWeight: 500, margin: 0 }}>
                                Change <strong>{statusConfirm.req.requestId}</strong> &mdash; {statusConfirm.req.title.split(" - ").slice(1).join(" - ").trim() || statusConfirm.req.title} to <strong>{statusConfirm.newStatus}</strong>?
                            </div>
                        </div>
                        <div className="rc-modal-footer">
                            <button className="rc-btn rc-btn-ghost" onClick={() => setStatusConfirm(null)}>Cancel</button>
                            <button className="rc-btn rc-btn-primary" onClick={() => {
                                handleStatusChange(statusConfirm.req, statusConfirm.newStatus);
                                setStatusConfirm(null);
                            }}>Change Status</button>
                        </div>
                    </div>
                </div>
            )}

            {artifactWarning && (
                <div className="rc-modal-overlay" onClick={() => setArtifactWarning(null)}>
                    <div className="rc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
                        <div className="rc-modal-header">
                            <h2>No Artifact Attached</h2>
                            <button className="rc-modal-close" onClick={() => setArtifactWarning(null)}>&times;</button>
                        </div>
                        <div className="rc-modal-body" style={{ padding: "16px 20px" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                <div style={{ fontSize: 14, color: "#991b1b", fontWeight: 600 }}>
                                    No artifact is attached to this request. Marking complete will send it to DD Review without supporting documentation.
                                </div>
                                <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.5 }}>
                                    <strong>{artifactWarning.req.requestId}</strong> &mdash; {artifactWarning.req.title.split(" - ").slice(1).join(" - ").trim() || artifactWarning.req.title}
                                </div>
                            </div>
                        </div>
                        <div className="rc-modal-footer">
                            <button className="rc-btn rc-btn-ghost" onClick={() => setArtifactWarning(null)}>Cancel</button>
                            <button className="rc-btn rc-btn-primary" onClick={() => {
                                const req = artifactWarning.req;
                                const newStatus = artifactWarning.newStatus;
                                setArtifactWarning(null);
                                handleStatusChange(req, newStatus);
                            }}>Mark Complete Anyway</button>
                        </div>
                    </div>
                </div>
            )}

            {notMine && (
                <div className="rc-modal-overlay" onClick={() => setNotMine(null)}>
                    <div className="rc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
                        <div className="rc-modal-header">
                            <h2>Not Mine</h2>
                            <button className="rc-modal-close" onClick={() => setNotMine(null)}>&times;</button>
                        </div>
                        <div className="rc-modal-body" style={{ padding: "16px 20px" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                <div style={{ fontSize: 13, color: "#334155" }}>
                                    Report <strong>{notMine.req.requestId}</strong> &mdash; {notMine.req.title.split(" - ").slice(1).join(" - ").trim() || notMine.req.title} as <strong>not assigned to you</strong>?
                                </div>
                                <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.5 }}>
                                    This will remove you as the owner and send the item to the Needs Reassignment queue in DD Operations.
                                </div>
                                <label style={{ fontSize: 11, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                                    Reason <span style={{ color: "#dc2626" }}>*</span>
                                </label>
                                <textarea
                                    value={notMine.reason}
                                    onChange={e => setNotMine(prev => prev ? { ...prev, reason: e.target.value } : null)}
                                    placeholder="Why is this item not yours? (e.g., wrong team, wrong person, wrong category...)"
                                    rows={3}
                                    style={{ width: "100%", padding: "8px 10px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 6, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", outline: "none", color: "#0f172a" }}
                                />
                            </div>
                        </div>
                        <div className="rc-modal-footer">
                            <button className="rc-btn rc-btn-ghost" onClick={() => setNotMine(null)}>Cancel</button>
                            <button className="rc-btn rc-btn-primary" disabled={!notMine.reason.trim()} onClick={() => {
                                const reason = notMine.reason.trim();
                                if (!reason) return;
                                updateRequestNotMine(notMine.req.id, reason);
                                setRefreshKey(k => k + 1);
                                setBulkToast(`${notMine.req.requestId}: reported as not mine`);
                                setNotMine(null);
                            }}>Report Not Mine</button>
                        </div>
                    </div>
                </div>
            )}

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

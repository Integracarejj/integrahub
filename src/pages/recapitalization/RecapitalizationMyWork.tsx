import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { getRequests, isDemoActive, getTeamMembers, updateRequestStatus, bulkUpdateDemoRequests, getDocuments, updateRequestNotMine, addActivityEntry, updateRequestStatusNotes, getWorkArtifactsByRequest } from "../../services/recapDataService";
import type { RecapRequest, WorkArtifact } from "../../services/recapDataService";
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
    const [successMsg, setSuccessMsg] = useState<{ title: string; body: string } | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [activeView, setActiveView] = useState<ViewTab>("active-work");
    const [statusConfirm, setStatusConfirm] = useState<{ req: RecapRequest; newStatus: string; reason?: string } | null>(null);
    const [notePopup, setNotePopup] = useState<{ req: RecapRequest; note: string } | null>(null);
    const [artifactListModal, setArtifactListModal] = useState<{ req: RecapRequest; artifacts: WorkArtifact[] } | null>(null);
    const [artifactWarning, setArtifactWarning] = useState<{ req: RecapRequest; newStatus: string } | null>(null);
    const [notMine, setNotMine] = useState<{ req: RecapRequest; reason: string } | null>(null);
    const [confirmAction, setConfirmAction] = useState<{ title: string; action: () => void } | null>(null);
    const members = getTeamMembers();
    const allRequests = useMemo(() => getRequests(), [refreshKey]);

    const workItems = useMemo(() => {
        const published = allRequests.filter(r => r._publishedAt || r._createdFromReview);
        return published.length > 0 ? published : allRequests;
    }, [allRequests]);

    const user = members.find(m => m.name === activeUser);
    const userTeam = user?.team || "";

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
            r._externalStatus === "Published External"
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

    function handleStatusChange(req: RecapRequest, newStatus: string, reason?: string) {
        updateRequestStatus(req.id, newStatus as RecapRequest["status"]);
        if (reason) {
            updateRequestStatusNotes(req.id, reason);
        }
        addActivityEntry({
            type: "Status Change",
            description: `${req.requestId}: Status changed to ${newStatus} by ${activeUser}` + (reason ? `. Reason: ${reason}` : ""),
            userId: activeUser,
            userName: activeUser,
            requestId: req.id,
            requestTitle: req.title,
            transactionId: req.transactionId,
            transactionName: req.transactionName,
        });
        setRefreshKey(k => k + 1);
        setBulkToast(`${req.requestId}: status changed to ${newStatus}`);
    }

    function handleBulkStatus(newStatus: string) {
        const ids = [...selectedIds];
        const reqs = workItems;
        ids.forEach(id => {
            const req = reqs.find(r => r.id === id);
            updateRequestStatus(id, newStatus as RecapRequest["status"]);
            if (req) {
                addActivityEntry({
                    type: "Status Change",
                    description: `${req.requestId}: Status changed to ${newStatus} by ${activeUser}`,
                    userId: activeUser,
                    userName: activeUser,
                    requestId: req.id,
                    requestTitle: req.title,
                    transactionId: req.transactionId,
                    transactionName: req.transactionName,
                });
            }
        });
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
        const allReqs = workItems;
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

    function openWorkspace(req: RecapRequest) {
        navigate(`/recapitalization/workspace/${req.intakeId}`, { state: { from: "my-work" } });
    }

    function renderTable(items: RecapRequest[], emptyMsg: string, showCheckboxes = false) {
        if (items.length === 0) return <div className="rc-empty-state" style={{ padding: 20 }}>{emptyMsg}</div>;
        return (
            <div style={{ overflowX: "auto" }}>
            <table className="rc-table">
                <thead>
                    <tr>
                        {showCheckboxes && <th style={{ width: 16, paddingRight: 4 }}></th>}
                        <th style={{ width: 110, minWidth: 90 }}>Request ID</th>
                        <th style={{ minWidth: 140 }}>Deliverable</th>
                        <th style={{ width: 90, minWidth: 70 }}>Community</th>
                        <th style={{ width: 60, textAlign: "center" }}>Pri</th>
                        <th style={{ width: 105, minWidth: 85 }}>Status</th>
                        {activeView !== "my-team" && <th style={{ width: 80, minWidth: 70 }}>Owner</th>}
                        <th style={{ width: 75, minWidth: 65 }}>Team</th>
                        <th style={{ width: 85, minWidth: 70 }}>Due</th>
                        <th style={{ width: 38, textAlign: "center" }}>Art</th>
                        <th style={{ width: 38, textAlign: "center" }}>Notes</th>
                        <th style={{ width: 80, minWidth: 65 }}>Updated</th>
                        <th style={{ width: 90, minWidth: 80 }}>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map(req => (
                        <tr key={req.id} className="rc-row-clickable" onClick={() => openWorkspace(req)}>
                            {showCheckboxes && (
                                <td style={{ width: 16, paddingRight: 4 }} onClick={e => e.stopPropagation()}>
                                    <input type="checkbox" checked={selectedIds.has(req.id)} onChange={() => {
                                        setSelectedIds(prev => { const n = new Set(prev); if (n.has(req.id)) n.delete(req.id); else n.add(req.id); return n; });
                                    }} />
                                </td>
                            )}
                            <td style={{ fontFamily: '"SF Mono", "Cascadia Code", "Consolas", monospace', fontSize: 11, color: "#475569", fontWeight: 600 }}>{req.requestId}</td>
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
                                        style={{ fontSize: 10, padding: "2px 14px 2px 4px", borderRadius: 4, background: "#fff", color: "#111827", fontWeight: 600, minWidth: 85, cursor: "pointer", border: "1px solid #d1d5db", width: "100%" }}
                                    >
                                        {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                            </td>
                            {activeView !== "my-team" && <td style={{ fontSize: 12, color: "#475569" }}>{req.owner || "\u2014"}</td>}
                            <td style={{ fontSize: 12 }}>{req.team}</td>
                            <td className="nowrap" style={{ fontSize: 12, color: req.status === "Overdue" ? "#991b1b" : "#475569", fontWeight: req.status === "Overdue" ? 600 : 400 }}>{req.dueDate}</td>
                            <td onClick={e => e.stopPropagation()} style={{ fontSize: 11, textAlign: "center" }}>
                                {(function() {
                                    const key = req.requestId || req.intakeId || req.id;
                                    const artifacts = getWorkArtifactsByRequest(key);
                                    return artifacts.length > 0 ? (
                                        <span onClick={() => setArtifactListModal({ req, artifacts })} style={{ cursor: "pointer", color: "#2563eb" }} title="View artifacts">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><polyline points="13 2 13 9 20 9" /></svg>
                                        </span>
                                    ) : (
                                        <span style={{ color: "#d1d5db" }}>&mdash;</span>
                                    );
                                })()}
                            </td>
                            <td onClick={e => e.stopPropagation()} style={{ fontSize: 11, textAlign: "center" }}>
                                {(function() {
                                    const note = req._statusNotes || req._misassignedReason || req._returnReason || null;
                                    return note ? (
                                        <span onClick={() => setNotePopup({ req, note })} style={{ cursor: "pointer", color: "#92400e" }} title="View note">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
                                        </span>
                                    ) : (
                                        <span style={{ color: "#d1d5db" }}>&mdash;</span>
                                    );
                                })()}
                            </td>
                            <td style={{ fontSize: 12, color: req.lastUpdated ? "#475569" : "#94a3b8" }}>{req.lastUpdated || "\u2014"}</td>
                            <td onClick={e => e.stopPropagation()} style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {(activeView === "active-work" || activeView === "returned") && req.owner === activeUser && req.status !== "Complete" && req._externalStatus !== "Published External" && (
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
            </div>
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
                    <div className="rc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
                        <div className="rc-modal-header">
                            <h2>{statusConfirm.newStatus}</h2>
                            <button className="rc-modal-close" onClick={() => setStatusConfirm(null)}>&times;</button>
                        </div>
                        <div className="rc-modal-body" style={{ padding: "16px 20px" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                <div style={{ fontSize: 14, color: "#1e293b", fontWeight: 500, margin: 0 }}>
                                    Change <strong>{statusConfirm.req.requestId}</strong> &mdash; {statusConfirm.req.title.split(" - ").slice(1).join(" - ").trim() || statusConfirm.req.title} to <strong>{statusConfirm.newStatus}</strong>?
                                </div>
                                {["Blocked", "Duplicate", "Not Applicable"].includes(statusConfirm.newStatus) && (
                                    <>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, fontSize: 12, fontWeight: 500, color: "#991b1b" }}>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                                            {statusConfirm.newStatus === "Blocked" && "This will move the request to DD Operations \u2192 Needs DD Review for review."}
                                            {statusConfirm.newStatus === "Duplicate" && "This will move the request to DD Operations \u2192 Needs DD Review for duplicate review."}
                                            {statusConfirm.newStatus === "Not Applicable" && "This will move the request to DD Operations \u2192 Needs DD Review for disposition."}
                                        </div>
                                        <label style={{ fontSize: 11, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                                            Reason <span style={{ color: "#dc2626" }}>*</span>
                                        </label>
                                        <textarea
                                            value={statusConfirm.reason || ""}
                                            onChange={e => setStatusConfirm(prev => prev ? { ...prev, reason: e.target.value } : null)}
                                            placeholder={"Explain why this item is " + statusConfirm.newStatus.toLowerCase() + "..."}
                                            rows={3}
                                            style={{ width: "100%", padding: "8px 10px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 6, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", outline: "none", color: "#0f172a" }}
                                        />
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="rc-modal-footer">
                            <button className="rc-btn rc-btn-ghost" onClick={() => setStatusConfirm(null)}>Cancel</button>
                            <button className="rc-btn rc-btn-primary" disabled={["Blocked", "Duplicate", "Not Applicable"].includes(statusConfirm.newStatus) && !(statusConfirm.reason?.trim())} onClick={() => {
                                const reason = statusConfirm.reason?.trim();
                                if (["Blocked", "Duplicate", "Not Applicable"].includes(statusConfirm.newStatus) && !reason) return;
                                handleStatusChange(statusConfirm.req, statusConfirm.newStatus, reason);
                                if (["Blocked", "Duplicate", "Not Applicable"].includes(statusConfirm.newStatus)) {
                                    setSuccessMsg({
                                        title: "Status Updated",
                                        body: `${statusConfirm.req.requestId} moved to DD Operations \u2192 Needs DD Review.`,
                                    });
                                }
                                setStatusConfirm(null);
                            }}>Confirm</button>
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
                                    This will remove the item from your Active Work and send it to DD Operations \u2192 Needs Reassignment.
                                </div>
                                <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.5 }}>
                                    <strong>{notMine.req.requestId}</strong> &mdash; {notMine.req.title.split(" - ").slice(1).join(" - ").trim() || notMine.req.title}
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
                                updateRequestNotMine(notMine.req.id, reason, activeUser);
                                setRefreshKey(k => k + 1);
                                setSuccessMsg({
                                    title: "Not Mine Reported",
                                    body: `${notMine.req.requestId} sent to DD Operations \u2192 Needs Reassignment.`,
                                });
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
                            <button className="rc-btn rc-btn-primary" onClick={() => { setDetailItem(null); openWorkspace(detailItem); }}>Open Workspace</button>
                        </div>
                    </div>
                </div>
            )}

            {notePopup && (
                <div className="rc-modal-overlay" onClick={() => setNotePopup(null)}>
                    <div className="rc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
                        <div className="rc-modal-header">
                            <h2>Note &mdash; {notePopup.req.requestId}</h2>
                            <button className="rc-modal-close" onClick={() => setNotePopup(null)}>&times;</button>
                        </div>
                        <div className="rc-modal-body" style={{ padding: "16px 20px" }}>
                            <div style={{ fontSize: 12, color: "#334155", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{notePopup.note}</div>
                        </div>
                        <div className="rc-modal-footer">
                            <button className="rc-btn rc-btn-primary" onClick={() => setNotePopup(null)}>Close</button>
                        </div>
                    </div>
                </div>
            )}

            {artifactListModal && (
                <div className="rc-modal-overlay" onClick={() => setArtifactListModal(null)}>
                    <div className="rc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
                        <div className="rc-modal-header">
                            <h2>Artifacts &mdash; {artifactListModal.req.requestId}</h2>
                            <button className="rc-modal-close" onClick={() => setArtifactListModal(null)}>&times;</button>
                        </div>
                        <div className="rc-modal-body" style={{ padding: "12px 20px" }}>
                            {artifactListModal.artifacts.length === 0 ? (
                                <div style={{ padding: "12px 0", color: "#475569", fontSize: 13 }}>No artifacts.</div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                    {artifactListModal.artifacts.map(art => (
                                        <div key={art.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "#f8faff", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 12, color: "#1e293b" }}>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><polyline points="13 2 13 9 20 9" /></svg>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <span style={{ fontWeight: 500 }}>{art.displayFileName || art.name}</span>
                                                <div style={{ display: "flex", gap: 8, fontSize: 11, color: "#475569", marginTop: 1 }}>
                                                    <span>{(art.size / 1024).toFixed(0)} KB</span>
                                                    <span>{art.uploadedAt}</span>
                                                    {art.uploadedBy && <span>{art.uploadedBy}</span>}
                                                    {art.isPrototype && <span style={{ color: "#92400e", background: "#fffbeb", padding: "0 4px", borderRadius: 3, fontSize: 10, fontWeight: 600 }}>PROTOTYPE</span>}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="rc-modal-footer">
                            <button className="rc-btn rc-btn-primary" onClick={() => setArtifactListModal(null)}>Close</button>
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

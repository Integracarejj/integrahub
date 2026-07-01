import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { getRequests, getTeamMembers, updateRequestStatus, updateRequestOwner, getDocuments, updateRequestReturnToOwner, getActivity, addActivityEntry } from "../../services/recapDataService";
import type { RecapRequest } from "../../services/recapDataService";
import RecapSubNav from "./RecapSubNav";
import "./Recapitalization.css";

const STATUS_OPTIONS = ["Open", "In Progress", "Blocked", "Complete", "Not Applicable", "Duplicate"];

type ViewTab = "needs-dd-review" | "ready-to-publish" | "needs-reassignment" | "returned-to-owners" | "published-external" | "activity-feed" | "full-work-queue";

export default function RecapitalizationDdOperations() {
    const navigate = useNavigate();
    const [activeUser, setActiveUser] = useState("David Park");
    const [activeView, setActiveView] = useState<ViewTab>("full-work-queue");
    const [statusConfirm, setStatusConfirm] = useState<{ req: RecapRequest; newStatus: string } | null>(null);
    const [artifactWarning, setArtifactWarning] = useState<{ req: RecapRequest; newStatus: string } | null>(null);
    const [returnToOwner, setReturnToOwner] = useState<{ req: RecapRequest; reason: string } | null>(null);
    const [successMsg, setSuccessMsg] = useState<{ title: string; body: string } | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const members = getTeamMembers();
    const ddMembers = useMemo(() => members.filter(m => m.team === "DD Management"), [members]);

    const allRequests = useMemo(() => getRequests(), [refreshKey]);

    const workItems = useMemo(() => {
        const published = allRequests.filter(r => r._publishedAt || r._createdFromReview);
        return published.length > 0 ? published : allRequests;
    }, [allRequests]);

    /* ── KPIs ── */
    const NEEDS_DD_REVIEW_STATUSES = ["Blocked", "Duplicate", "Not Applicable", "Clarification Needed"];
    const kpiNeedsDDReview = useMemo(() => workItems.filter(r => NEEDS_DD_REVIEW_STATUSES.includes(r.status) && !r._returnReason).length, [workItems]);
    const kpiReadyToPublish = useMemo(() => workItems.filter(r => r.status === "Complete" && r._externalStatus !== "Published External").length, [workItems]);
    const kpiNeedsReassignment = useMemo(() => workItems.filter(r => r._needsReassignment || (r._misassignedReason && !r.owner)).length, [workItems]);
    const kpiReturnedToOwners = useMemo(() => workItems.filter(r => r._returnReason).length, [workItems]);
    const kpiPublishedExternal = useMemo(() => workItems.filter(r => r._externalStatus === "Published External").length, [workItems]);
    const kpiUpdatedToday = useMemo(() => {
        const today = new Date().toISOString().split("T")[0];
        return workItems.filter(r => r.lastUpdated === today).length;
    }, [workItems]);

    const needsDDReview = useMemo(() => {
        return workItems
            .filter(r => NEEDS_DD_REVIEW_STATUSES.includes(r.status) && !r._returnReason)
            .sort((a, b) => {
                const aDue = a.dueDate || "9999-99-99";
                const bDue = b.dueDate || "9999-99-99";
                if (aDue !== bDue) return aDue.localeCompare(bDue);
                const pMap: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
                return (pMap[a.priority] || 1) - (pMap[b.priority] || 1);
            });
    }, [workItems]);

    const readyToPublish = useMemo(() => {
        return workItems
            .filter(r => r.status === "Complete" && r._externalStatus !== "Published External")
            .sort((a, b) => {
                const aDate = a.lastUpdated || "";
                const bDate = b.lastUpdated || "";
                return bDate.localeCompare(aDate);
            });
    }, [workItems]);

    const needsReassignment = useMemo(() => {
        return workItems
            .filter(r => r._needsReassignment || (r._misassignedReason && !r.owner))
            .sort((a, b) => {
                const aDate = a.lastUpdated || "";
                const bDate = b.lastUpdated || "";
                return bDate.localeCompare(aDate);
            });
    }, [workItems]);

    const returnedToOwnersItems = useMemo(() => {
        return workItems
            .filter(r => r._returnReason)
            .sort((a, b) => {
                const aDate = a.lastUpdated || "";
                const bDate = b.lastUpdated || "";
                return bDate.localeCompare(aDate);
            });
    }, [workItems]);

    const publishedExternalItems = useMemo(() => {
        return workItems
            .filter(r => r._externalStatus === "Published External")
            .sort((a, b) => {
                const aDate = a.lastUpdated || "";
                const bDate = b.lastUpdated || "";
                return bDate.localeCompare(aDate);
            });
    }, [workItems]);

    const activityFeed = useMemo(() => {
        return getActivity(50);
    }, [refreshKey]);

    const fullWorkQueue = useMemo(() => {
        return workItems.sort((a, b) => {
            const aDate = a.lastUpdated || "";
            const bDate = b.lastUpdated || "";
            return bDate.localeCompare(aDate);
        });
    }, [workItems]);

    const activeItems = useMemo(() => {
        switch (activeView) {
            case "needs-dd-review": return needsDDReview;
            case "ready-to-publish": return readyToPublish;
            case "needs-reassignment": return needsReassignment;
            case "returned-to-owners": return returnedToOwnersItems;
            case "published-external": return publishedExternalItems;
            case "activity-feed": return [];
            case "full-work-queue": return fullWorkQueue;
        }
    }, [activeView, needsDDReview, readyToPublish, needsReassignment, returnedToOwnersItems, publishedExternalItems, fullWorkQueue]);

    function hasDocuments(req: RecapRequest): boolean {
        const docs = getDocuments();
        return docs.some(d => d.requestId === req.requestId || d.requestTitle === req.title);
    }

    function handleStatusChange(req: RecapRequest, newStatus: string) {
        updateRequestStatus(req.id, newStatus as RecapRequest["status"]);
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
        setRefreshKey(k => k + 1);
    }

    const emptyMessages: Record<ViewTab, string> = {
        "needs-dd-review": "No items needing DD review.",
        "ready-to-publish": "No items ready to publish.",
        "needs-reassignment": "No items needing reassignment.",
        "returned-to-owners": "No items returned to owners.",
        "published-external": "No items published externally.",
        "activity-feed": "No recent activity.",
        "full-work-queue": "No items in the work queue.",
    };

    const tabLabels: Record<ViewTab, string> = {
        "needs-dd-review": "Needs DD Review",
        "ready-to-publish": "Ready to Publish",
        "needs-reassignment": "Needs Reassignment",
        "returned-to-owners": "Returned to Owners",
        "published-external": "Published External",
        "activity-feed": "Activity Feed",
        "full-work-queue": "Full Work Queue",
    };

    const kpiCards = [
        { label: "Needs DD Review", count: kpiNeedsDDReview, tab: "needs-dd-review" as ViewTab, color: "#1d4ed8" },
        { label: "Ready to Publish", count: kpiReadyToPublish, tab: "ready-to-publish" as ViewTab, color: "#047857" },
        { label: "Needs Reassignment", count: kpiNeedsReassignment, tab: "needs-reassignment" as ViewTab, color: "#dc2626" },
        { label: "Returned to Owners", count: kpiReturnedToOwners, tab: "returned-to-owners" as ViewTab, color: "#7c3aed" },
        { label: "Published External", count: kpiPublishedExternal, tab: "published-external" as ViewTab, color: "#166534" },
        { label: "Updated Today", count: kpiUpdatedToday, tab: "activity-feed" as ViewTab, color: "#4338ca" },
    ];

    const PriorityBadge = ({ priority }: { priority: string }) => (
        <span className={`rc-badge rc-badge-${priority.toLowerCase()}`} style={{ fontSize: 10 }}>{priority}</span>
    );

    const ExternalStatus = ({ req }: { req: RecapRequest }) => {
        switch (req._externalStatus) {
            case "Published External":
                return <span style={{ color: "#166534", fontWeight: 600, fontSize: 11, background: "#f0fdf4", padding: "1px 6px", borderRadius: 4 }}>Published External</span>;
            case "Ready to Publish":
                return <span style={{ color: "#92400e", fontWeight: 600, fontSize: 11, background: "#fffbeb", padding: "1px 6px", borderRadius: 4 }}>Ready to Publish</span>;
            default:
                return <span style={{ color: "#475569", fontSize: 11 }}>Internal Only</span>;
        }
    };

    function openWorkspace(req: RecapRequest) {
        navigate(`/recapitalization/workspace/${req.intakeId}`, { state: { from: "dd-operations" } });
    }

    /* ── Activity Feed View ── */
    function renderActivityFeed() {
        if (activityFeed.length === 0) return <div className="rc-empty-state" style={{ padding: 20 }}>No recent activity.</div>;
        return (
            <div className="rc-timeline" style={{ padding: "16px 18px" }}>
                {activityFeed.map(act => (
                    <div key={act.id} className="rc-timeline-item">
                        <div className="rc-timeline-dot" style={{
                            background: act.type === "Status Change" ? "#3b82f6" :
                                act.type === "Assignment" ? "#8b5cf6" :
                                act.type === "Submission" ? "#10b981" :
                                act.type === "Document" ? "#f59e0b" :
                                act.type === "Comment" ? "#06b6d4" : "#94a3b8"
                        }} />
                        <div className="rc-timeline-line" />
                        <div className="rc-timeline-content">
                            <div className="rc-timeline-desc">{act.description}</div>
                            <div className="rc-timeline-meta">
                                {act.userName} &middot; {act.timestamp}
                                {act.requestId && <> &middot; <span style={{ fontFamily: '"SF Mono", monospace', fontSize: 10 }}>{act.requestId}</span></>}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    /* ── Table View ── */
    function renderTable(items: RecapRequest[], emptyMsg: string) {
        if (items.length === 0) return <div className="rc-empty-state" style={{ padding: 20 }}>{emptyMsg}</div>;
        return (
            <div style={{ overflowX: "auto", maxHeight: "calc(100vh - 310px)", overflowY: "auto" }}>
            <table className="rc-table">
                <thead>
                    <tr>
                        <th style={{ minWidth: 110 }}>Request ID</th>
                        <th style={{ minWidth: 200 }}>Deliverable</th>
                        <th style={{ minWidth: 90 }}>Community</th>
                        <th style={{ minWidth: 70 }}>Priority</th>
                        <th style={{ minWidth: 100 }}>Status</th>
                        <th style={{ minWidth: 100 }}>External Status</th>
                        <th style={{ minWidth: 80 }}>Owner</th>
                        <th style={{ minWidth: 80 }}>Team</th>
                        <th style={{ minWidth: 80 }}>Due</th>
                        <th style={{ minWidth: 80 }}>Updated</th>
                        <th style={{ minWidth: 160 }}>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map(req => (
                        <tr key={req.id} className="rc-row-clickable" onClick={() => openWorkspace(req)}>
                            <td style={{ fontFamily: '"SF Mono", "Cascadia Code", "Consolas", monospace', fontSize: 11, color: "#475569", fontWeight: 600 }}>{req.requestId}</td>
                            <td className="rc-truncate" style={{ fontWeight: 500, maxWidth: 240 }}>{req.title.split(" - ").slice(1).join(" - ").trim() || req.title}</td>
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
                            <td><ExternalStatus req={req} /></td>
                            <td style={{ fontSize: 12, color: "#475569" }}>{req.owner || "\u2014"}</td>
                            <td style={{ fontSize: 12 }}>{req.team}</td>
                            <td className="nowrap" style={{ fontSize: 12, color: req.status === "Overdue" ? "#991b1b" : "#475569", fontWeight: req.status === "Overdue" ? 600 : 400 }}>{req.dueDate}</td>
                            <td style={{ fontSize: 12, color: "#475569" }}>{req.lastUpdated}</td>
                            <td onClick={e => e.stopPropagation()} style={{ whiteSpace: "nowrap", minWidth: 160 }}>
                                {activeView === "needs-dd-review" && req.owner && (
                                    <button
                                        onClick={() => setReturnToOwner({ req, reason: "" })}
                                        style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: "#fff", color: "#92400e", border: "1px solid #fde68a", cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" }}
                                        title="Return this item to the original owner"
                                    >
                                        Return to Owner
                                    </button>
                                )}
                                {(activeView === "needs-reassignment" || activeView === "full-work-queue") && (!req.owner || req._needsReassignment) && (
                                    <select
                                        value=""
                                        onChange={e => {
                                            const newOwner = e.target.value;
                                            if (newOwner) {
                                                updateRequestOwner(req.id, newOwner);
                                                updateRequestStatus(req.id, "Open" as RecapRequest["status"]);
                                                req._needsReassignment = false;
                                                req._misassignedReason = null;
                                                addActivityEntry({
                                                    type: "Assignment",
                                                    description: `${req.requestId}: Reassigned to ${newOwner} by ${activeUser}`,
                                                    userId: activeUser,
                                                    userName: activeUser,
                                                    requestId: req.id,
                                                    requestTitle: req.title,
                                                    transactionId: req.transactionId,
                                                    transactionName: req.transactionName,
                                                });
                                                setRefreshKey(k => k + 1);
                                            }
                                        }}
                                        style={{ fontSize: 10, padding: "2px 4px", borderRadius: 4, border: "1px solid #d1d5db", cursor: "pointer", minWidth: 110 }}
                                    >
                                        <option value="">Assign...</option>
                                        {members.filter(m => m.team !== "DD Management").map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                                    </select>
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
            <div className="rc-header">
                <div className="rc-header-left">
                    <h1>DD Operations</h1>
                </div>
                <div className="rc-header-actions">
                    <select className="rc-filter-select" value={activeUser} onChange={e => setActiveUser(e.target.value)}>
                        {ddMembers.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                    </select>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="rc-stats-row">
                {kpiCards.map(kpi => (
                    <div
                        key={kpi.label}
                        className="rc-stat-card"
                        style={{ borderLeft: `3px solid ${kpi.color}`, cursor: "pointer" }}
                        onClick={() => setActiveView(kpi.tab)}
                        title={`View ${kpi.label}`}
                    >
                        <span className="rc-stat-value">{kpi.count}</span>
                        <span className="rc-stat-label">{kpi.label}</span>
                    </div>
                ))}
            </div>

            <div className="rc-view-tabs" style={{ display: "flex", gap: 0, marginBottom: 16, borderBottom: "2px solid #e2e8f0", overflowX: "auto" }}>
                {(["needs-dd-review", "ready-to-publish", "needs-reassignment", "returned-to-owners", "published-external", "activity-feed", "full-work-queue"] as const).map(view => (
                    <button key={view} onClick={() => setActiveView(view)}
                        style={{ padding: "8px 16px", fontSize: 13, fontWeight: activeView === view ? 700 : 500, color: activeView === view ? "#1d4ed8" : "#475569", background: "none", border: "none", borderBottom: activeView === view ? "2px solid #1d4ed8" : "2px solid transparent", marginBottom: -2, cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap" }}>
                        {tabLabels[view]}
                    </button>
                ))}
            </div>

            <div className="rc-card">
                <div className="rc-card-header">
                    <h2>{tabLabels[activeView]} {activeView !== "activity-feed" ? `(${activeItems.length})` : ""}</h2>
                </div>
                <div className="rc-card-body" style={{ padding: 0 }}>
                    {activeView === "activity-feed" ? renderActivityFeed() : renderTable(activeItems, emptyMessages[activeView])}
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

            {returnToOwner && (
                <div className="rc-modal-overlay" onClick={() => setReturnToOwner(null)}>
                    <div className="rc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
                        <div className="rc-modal-header">
                            <h2>Return to Owner</h2>
                            <button className="rc-modal-close" onClick={() => setReturnToOwner(null)}>&times;</button>
                        </div>
                        <div className="rc-modal-body" style={{ padding: "16px 20px" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                <div style={{ fontSize: 13, color: "#334155" }}>
                                    This will return <strong>{returnToOwner.req.requestId}</strong> to <strong>{returnToOwner.req.owner}</strong> for clarification before approval.
                                </div>
                                <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.5 }}>
                                    This will set the status to "Clarification Needed" and send the item back to the owner with a reason.
                                </div>
                                <label style={{ fontSize: 11, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                                    Return Reason <span style={{ color: "#dc2626" }}>*</span>
                                </label>
                                <textarea
                                    value={returnToOwner.reason}
                                    onChange={e => setReturnToOwner(prev => prev ? { ...prev, reason: e.target.value } : null)}
                                    placeholder="Explain why this item is being returned..."
                                    rows={3}
                                    style={{ width: "100%", padding: "8px 10px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 6, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", outline: "none", color: "#0f172a" }}
                                />
                            </div>
                        </div>
                        <div className="rc-modal-footer">
                            <button className="rc-btn rc-btn-ghost" onClick={() => setReturnToOwner(null)}>Cancel</button>
                            <button className="rc-btn rc-btn-primary" disabled={!returnToOwner.reason.trim()} onClick={() => {
                                const reason = returnToOwner.reason.trim();
                                if (!reason) return;
                                updateRequestReturnToOwner(returnToOwner.req.id, reason, activeUser);
                                setRefreshKey(k => k + 1);
                                setSuccessMsg({
                                    title: "Returned to Owner",
                                    body: `${returnToOwner.req.requestId} has been returned to ${returnToOwner.req.owner} with a request for clarification.`,
                                });
                                setReturnToOwner(null);
                            }}>Return to Owner</button>
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

import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { getRequests, getTeamMembers, updateRequestStatus, updateRequestOwner, getDocuments, updateRequestReturnToOwner, getActivity, addActivityEntry, getWorkArtifactsByRequest, updateRequestStatusNotes, isDemoActive, sendExceptionRecommendation, clearExceptionFields } from "../../services/recapDataService";
import type { RecapRequest, WorkArtifact } from "../../services/recapDataService";
import RecapSubNav from "./RecapSubNav";
import "./Recapitalization.css";

const STATUS_OPTIONS = ["Open", "Assigned", "In Progress", "Blocked", "Complete", "Not Applicable", "Duplicate", "Waiting Partner Review", "Needs Rework", "Completed"];

type ViewTab = "needs-dd-review" | "ready-to-publish" | "partner-action" | "exceptions" | "published-external" | "activity-feed" | "full-work-queue";

export default function RecapitalizationDdOperations() {
    const navigate = useNavigate();
    const [activeUser, setActiveUser] = useState("David Park");
    const [activeView, setActiveView] = useState<ViewTab>("full-work-queue");
    const [statusConfirm, setStatusConfirm] = useState<{ req: RecapRequest; newStatus: string; reason?: string } | null>(null);
    const [artifactWarning, setArtifactWarning] = useState<{ req: RecapRequest; newStatus: string } | null>(null);
    const [returnToOwner, setReturnToOwner] = useState<{ req: RecapRequest; reason: string } | null>(null);
    const [successMsg, setSuccessMsg] = useState<{ title: string; body: string } | null>(null);
    const [notePopup, setNotePopup] = useState<{ req: RecapRequest; note: string } | null>(null);
    const [artifactListModal, setArtifactListModal] = useState<{ req: RecapRequest; artifacts: WorkArtifact[] } | null>(null);
    const [archiveConfirm, setArchiveConfirm] = useState<{ req: RecapRequest } | null>(null);
    const [resolveModal, setResolveModal] = useState<{ req: RecapRequest; note: string } | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const [returnToTeam, setReturnToTeam] = useState<{ req: RecapRequest; reason: string } | null>(null);
    const members = getTeamMembers();
    const ddMembers = useMemo(() => members.filter(m => m.team === "DD Management"), [members]);

    const allRequests = useMemo(() => getRequests(), [refreshKey]);

    const workItems = useMemo(() => {
        const published = allRequests.filter(r => r._publishedAt || r._createdFromReview);
        return published.length > 0 ? published : allRequests;
    }, [allRequests]);

    /* ── KPIs ── */
    const NEEDS_DD_REVIEW_STATUSES = ["Blocked", "Clarification Needed"];
    const kpiNeedsDDReview = useMemo(() => workItems.filter(r => (NEEDS_DD_REVIEW_STATUSES.includes(r.status) || r._needsReassignment || r._misassignedReason) && !r._returnReason).length, [workItems]);
    const kpiReadyToPublish = useMemo(() => workItems.filter(r => r.status === "Complete" && r._externalStatus !== "Published External").length, [workItems]);
    const kpiExceptions = useMemo(() => workItems.filter(r => r.status === "Duplicate" || r.status === "Not Applicable").length, [workItems]);
    const kpiPublishedExternal = useMemo(() => workItems.filter(r => r._externalStatus === "Published External").length, [workItems]);
    const kpiPartnerActionRequired = useMemo(() => workItems.filter(r => r._externalStatus === "Published External" && r._partnerDecision).length, [workItems]);
    const kpiUpdatedToday = useMemo(() => {
        const today = new Date().toISOString().split("T")[0];
        return workItems.filter(r => r.lastUpdated === today).length;
    }, [workItems]);

    const needsDDReview = useMemo(() => {
        return workItems
            .filter(r => (NEEDS_DD_REVIEW_STATUSES.includes(r.status) || r._needsReassignment || r._misassignedReason) && !r._returnReason)
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

    const exceptionsItems = useMemo(() => {
        return workItems
            .filter(r => r.status === "Duplicate" || r.status === "Not Applicable")
            .sort((a, b) => {
                const aDate = a.lastUpdated || "";
                const bDate = b.lastUpdated || "";
                return bDate.localeCompare(aDate);
            });
    }, [workItems]);

    const publishedExternalItems = useMemo(() => {
        return workItems
            .filter(r => r._externalStatus === "Published External" && !r._partnerDecision)
            .sort((a, b) => {
                const aDate = a.lastUpdated || "";
                const bDate = b.lastUpdated || "";
                return bDate.localeCompare(aDate);
            });
    }, [workItems]);

    const partnerActionItems = useMemo(() => {
        return workItems
            .filter(r => r._externalStatus === "Published External" && r._partnerDecision)
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
            case "partner-action": return partnerActionItems;
            case "exceptions": return exceptionsItems;
            case "published-external": return publishedExternalItems;
            case "activity-feed": return [];
            case "full-work-queue": return fullWorkQueue;
        }
    }, [activeView, needsDDReview, readyToPublish, partnerActionItems, exceptionsItems, publishedExternalItems, fullWorkQueue]);

    function getArtifactKey(req: RecapRequest): string {
        return req.requestId || req.intakeId || req.id;
    }

    function getRequestNote(req: RecapRequest): string | null {
        return req._statusNotes || req._misassignedReason || req._returnReason || null;
    }

    function hasDocuments(req: RecapRequest): boolean {
        const docs = getDocuments();
        return docs.some(d => d.requestId === req.requestId);
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
    }

    const emptyMessages: Record<ViewTab, string> = {
        "needs-dd-review": "No items needing DD review.",
        "ready-to-publish": "No items ready to publish.",
        "partner-action": "No partner actions required.",
        "exceptions": "No exception items.",
        "published-external": "No items published externally.",
        "activity-feed": "No recent activity.",
        "full-work-queue": "No items in the work queue.",
    };

    const tabLabels: Record<ViewTab, string> = {
        "needs-dd-review": "Needs DD Review",
        "ready-to-publish": "Ready to Publish",
        "partner-action": "Partner Action",
        "exceptions": "Exceptions",
        "published-external": "Published External",
        "activity-feed": "Activity Feed",
        "full-work-queue": "Full Work Queue",
    };

    const kpiCards = [
        { label: "Needs DD Review", count: kpiNeedsDDReview, tab: "needs-dd-review" as ViewTab, color: "#1d4ed8" },
        { label: "Ready to Publish", count: kpiReadyToPublish, tab: "ready-to-publish" as ViewTab, color: "#047857" },
        { label: "Exceptions", count: kpiExceptions, tab: "exceptions" as ViewTab, color: "#7c3aed" },
        { label: "Published External", count: kpiPublishedExternal, tab: "published-external" as ViewTab, color: "#166534" },
        { label: "Partner Action", count: kpiPartnerActionRequired, tab: "partner-action" as ViewTab, color: kpiPartnerActionRequired > 0 && partnerActionItems.some(r => r._partnerDecision === "Rework Required") ? "#ea580c" : "#16a34a" },
        { label: "Updated Today", count: kpiUpdatedToday, tab: "activity-feed" as ViewTab, color: "#4338ca" },
    ];

    const PriorityBadge = ({ priority }: { priority: string }) => (
        <span className={`rc-badge rc-badge-${priority.toLowerCase()}`} style={{ fontSize: 10 }}>{priority}</span>
    );

    const ExternalStatus = ({ req }: { req: RecapRequest }) => {
        const pill = req._partnerDecision ? (
            req._partnerDecision === "Approved" ? (
                <span style={{ color: "#166534", fontWeight: 600, fontSize: 10, background: "#f0fdf4", padding: "1px 6px", borderRadius: 4, border: "1px solid #bbf7d0", marginLeft: 4 }}>
                    &#10003; Partner Approved
                </span>
            ) : (
                <span style={{ color: "#9a3412", fontWeight: 600, fontSize: 10, background: "#fff7ed", padding: "1px 6px", borderRadius: 4, border: "1px solid #fed7aa", marginLeft: 4 }}>
                    &#9888; Rework Requested
                </span>
            )
        ) : null;
        switch (req._externalStatus) {
            case "Published External":
                return <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}><span style={{ color: "#166534", fontWeight: 600, fontSize: 11, background: "#f0fdf4", padding: "1px 6px", borderRadius: 4 }}>Published External</span>{pill}</span>;
            case "Ready to Publish":
                return <span style={{ color: "#92400e", fontWeight: 600, fontSize: 11, background: "#fffbeb", padding: "1px 6px", borderRadius: 4 }}>Ready to Publish</span>;
            default:
                return <span style={{ color: "#475569", fontSize: 11 }}>Internal Only</span>;
        }
    };

    function renderPartnerActionTable(items: RecapRequest[]) {
        if (items.length === 0) return <div className="rc-empty-state" style={{ padding: 20 }}>No partner actions required.</div>;
        return (
            <div style={{ overflowX: "auto", maxHeight: "calc(100vh - 310px)", overflowY: "auto" }}>
            <table className="rc-table">
                <thead>
                    <tr>
                        <th style={{ width: 110, minWidth: 90 }}>Request ID</th>
                        <th style={{ minWidth: 140 }}>Deliverable</th>
                        <th style={{ width: 90, minWidth: 70 }}>Community</th>
                        <th style={{ width: 105, minWidth: 85 }}>Internal Status</th>
                        <th style={{ width: 130, minWidth: 110 }}>Partner Decision</th>
                        <th style={{ minWidth: 180 }}>Partner Note / Comment</th>
                        <th style={{ width: 85, minWidth: 70 }}>Updated</th>
                        <th style={{ width: 80, minWidth: 65 }}>Owner</th>
                        <th style={{ width: 120, minWidth: 100 }}>Action</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map(req => (
                        <tr key={req.id} className="rc-row-clickable" onClick={() => openWorkspace(req)}>
                            <td style={{ fontFamily: '"SF Mono", "Cascadia Code", "Consolas", monospace', fontSize: 11, color: "#475569", fontWeight: 600 }}>{req.requestId}</td>
                            <td className="rc-truncate" style={{ fontWeight: 500, maxWidth: 240 }}>{req.title.split(" - ").slice(1).join(" - ").trim() || req.title}</td>
                            <td style={{ fontSize: 12, color: "#475569" }}>{req.communityNames[0] || "\u2014"}</td>
                            <td>
                                <span className={`rc-badge rc-badge-${req.status.toLowerCase().replace(/\s+/g, "-")}`} style={{ fontSize: 11 }}>
                                    {req.status}
                                </span>
                            </td>
                            <td>
                                {req._exceptionDecision ? (
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#6b21a8", fontWeight: 600, fontSize: 11, background: "#faf5ff", padding: "3px 8px", borderRadius: 6, border: "1px solid #ddd6fe" }}>
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                                        Exception: {req._exceptionDecision}
                                    </span>
                                ) : req._partnerDecision === "Approved" ? (
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#166534", fontWeight: 600, fontSize: 11, background: "#f0fdf4", padding: "3px 8px", borderRadius: 6, border: "1px solid #bbf7d0" }}>
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                        Partner Approved
                                    </span>
                                ) : (
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#9a3412", fontWeight: 600, fontSize: 11, background: "#fff7ed", padding: "3px 8px", borderRadius: 6, border: "1px solid #fed7aa" }}>
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                                        Rework Requested
                                    </span>
                                )}
                            </td>
                            <td style={{ maxWidth: 260, minWidth: 180 }}>
                                {req._exceptionDecision ? (
                                    <div style={{ fontSize: 12, color: "#334155", lineHeight: 1.5, background: "#f5f3ff", padding: "6px 10px", borderRadius: 6, border: "1px solid #ddd6fe", whiteSpace: "pre-wrap" }}>
                                        <span style={{ fontWeight: 600, color: "#6b21a8" }}>Exception: {req._exceptionDecision}</span>
                                        {req._exceptionDecisionNote && <><br />{req._exceptionDecisionNote}</>}
                                    </div>
                                ) : req._partnerNote ? (
                                    <div style={{ fontSize: 12, color: "#334155", lineHeight: 1.5, background: "#f8faff", padding: "6px 10px", borderRadius: 6, border: "1px solid #dbeafe", whiteSpace: "pre-wrap" }}>
                                        {req._partnerNote}
                                    </div>
                                ) : (
                                    <span style={{ color: "#94a3b8", fontStyle: "italic", fontSize: 11 }}>No note</span>
                                )}
                            </td>
                            <td style={{ fontSize: 12, color: "#475569" }}>{req.lastUpdated}</td>
                            <td style={{ fontSize: 12, color: "#475569" }} onClick={e => e.stopPropagation()}>{req.owner || "\u2014"}</td>
                            <td onClick={e => e.stopPropagation()}>
                                {req._partnerDecision === "Approved" ? (
                                    <button
                                        onClick={() => navigate(`/recapitalization/workspace/${req.id}`, { state: { from: "dd-operations" } })}
                                        style={{ fontSize: 11, padding: "4px 12px", borderRadius: 6, background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0", cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" }}
                                    >
                                        Open Approval
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => navigate(`/recapitalization/workspace/${req.id}`, { state: { from: "dd-operations" } })}
                                        style={{ fontSize: 11, padding: "4px 12px", borderRadius: 6, background: "#fff7ed", color: "#9a3412", border: "1px solid #fed7aa", cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" }}
                                    >
                                        Open Rework
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

    function renderExceptionsTable(items: RecapRequest[]) {
        if (items.length === 0) return <div className="rc-empty-state" style={{ padding: 20 }}>No exception items.</div>;
        return (
            <div style={{ overflowX: "auto", maxHeight: "calc(100vh - 310px)", overflowY: "auto" }}>
            <table className="rc-table">
                <thead>
                    <tr>
                        <th style={{ width: 110, minWidth: 90 }}>Request ID</th>
                        <th style={{ minWidth: 140 }}>Deliverable</th>
                        <th style={{ width: 90, minWidth: 70 }}>Community</th>
                        <th style={{ width: 60, textAlign: "center" }}>Pri</th>
                        <th style={{ width: 125, minWidth: 100 }}>Status</th>
                        <th style={{ minWidth: 180 }}>Reason</th>
                        <th style={{ width: 85, minWidth: 70 }}>Updated</th>
                        <th style={{ width: 80, minWidth: 65 }}>Owner</th>
                        <th style={{ width: 170, minWidth: 140 }}>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map(req => (
                        <tr key={req.id} className="rc-row-clickable" onClick={() => openWorkspace(req)}>
                            <td style={{ fontFamily: '"SF Mono", "Cascadia Code", "Consolas", monospace', fontSize: 11, color: "#475569", fontWeight: 600 }}>{req.requestId}</td>
                            <td className="rc-truncate" style={{ fontWeight: 500, maxWidth: 240 }}>{req.title.split(" - ").slice(1).join(" - ").trim() || req.title}</td>
                            <td style={{ fontSize: 12, color: "#475569" }}>{req.communityNames[0] || "\u2014"}</td>
                            <td><PriorityBadge priority={req.priority} /></td>
                            <td>
                                <span className={`rc-badge ${req.status === "Duplicate" ? "rc-badge-duplicate" : "rc-badge-not-applicable"}`} style={{ fontSize: 11 }}>
                                    {req.status}
                                </span>
                            </td>
                            <td onClick={e => e.stopPropagation()} style={{ maxWidth: 260, fontSize: 12, color: "#475569" }}>
                                {getRequestNote(req) ? (
                                    <span onClick={() => setNotePopup({ req, note: getRequestNote(req)! })} style={{ cursor: "pointer", color: "#92400e", display: "inline-flex", alignItems: "center", gap: 4 }} title="Click to view reason">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
                                        <span style={{ fontSize: 10, fontWeight: 600, color: "#92400e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 140 }}>{getRequestNote(req)}</span>
                                    </span>
                                ) : (
                                    <span style={{ color: "#94a3b8", fontStyle: "italic", fontSize: 11 }}>No reason provided</span>
                                )}
                            </td>
                            <td style={{ fontSize: 12, color: "#475569" }}>{req.lastUpdated}</td>
                            <td style={{ fontSize: 12, color: "#475569" }} onClick={e => e.stopPropagation()}>{req.owner || "\u2014"}</td>
                            <td onClick={e => e.stopPropagation()} style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
                                {req.status === "Duplicate" && (
                                    <button
                                        onClick={() => setArchiveConfirm({ req })}
                                        style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: "#ede9fe", color: "#6d28d9", border: "1px solid #ddd6fe", cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" }}
                                        title="Approve this duplicate recommendation and send to external partner for decision"
                                    >
                                        Approve Recommendation (Duplicate)
                                    </button>
                                )}
                                {req.status === "Not Applicable" && (
                                    <button
                                        onClick={() => setArchiveConfirm({ req })}
                                        style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: "#f0f4ff", color: "#4f46e5", border: "1px solid #c7d2fe", cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" }}
                                        title="Approve this Not Applicable recommendation and send to external partner for decision"
                                    >
                                        Approve Recommendation (Not Applicable)
                                    </button>
                                )}
                                <button
                                    onClick={() => setReturnToTeam({ req, reason: "" })}
                                    style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: "#fff", color: "#475569", border: "1px solid #d1d5db", cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" }}
                                    title="Return this item to the work queue for reassignment"
                                >
                                    Return to Team
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            </div>
        );
    }

    function openWorkspace(req: RecapRequest) {
        navigate(`/recapitalization/workspace/${req.id}`, { state: { from: "dd-operations" } });
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
                        <th style={{ width: 110, minWidth: 90 }}>Request ID</th>
                        <th style={{ minWidth: 140 }}>Deliverable</th>
                        <th style={{ width: 90, minWidth: 70 }}>Community</th>
                        <th style={{ width: 60, textAlign: "center" }}>Pri</th>
                        <th style={{ width: 105, minWidth: 85 }}>Status</th>
                        {(activeView === "needs-dd-review" || activeView === "full-work-queue") && <th style={{ width: 80, minWidth: 70 }}>Owner</th>}
                        <th style={{ width: 75, minWidth: 65 }}>Team</th>
                        <th style={{ width: 85, minWidth: 70 }}>Due</th>
                        <th style={{ width: 80, minWidth: 65 }}>Updated</th>
                        <th style={{ width: 38, textAlign: "center" }}>Art</th>
                        <th style={{ width: 38, textAlign: "center" }}>Notes</th>
                        <th style={{ width: 140, minWidth: 120 }}>{activeView === "full-work-queue" || activeView === "needs-dd-review" ? "Assign" : "Actions"}</th>
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
                                        style={{ fontSize: 10, padding: "2px 14px 2px 4px", borderRadius: 4, background: "#fff", color: "#111827", fontWeight: 600, minWidth: 85, cursor: "pointer", border: "1px solid #d1d5db", width: "100%" }}
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
                            <td onClick={e => e.stopPropagation()} style={{ fontSize: 11, textAlign: "center", color: getWorkArtifactsByRequest(getArtifactKey(req)).length > 0 ? "#2563eb" : "#d1d5db" }}>
                                {getWorkArtifactsByRequest(getArtifactKey(req)).length > 0 ? (
                                    <span onClick={() => setArtifactListModal({ req, artifacts: getWorkArtifactsByRequest(getArtifactKey(req)) })} style={{ cursor: "pointer" }} title="View artifacts">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><polyline points="13 2 13 9 20 9" /></svg>
                                    </span>
                                ) : (
                                    <span style={{ color: "#d1d5db" }}>&mdash;</span>
                                )}
                            </td>
                            <td onClick={e => e.stopPropagation()} style={{ fontSize: 11, textAlign: "center", maxWidth: 160 }}>
                                {getRequestNote(req) ? (
                                    <span onClick={() => setNotePopup({ req, note: getRequestNote(req)! })} style={{ cursor: "pointer", color: "#92400e", display: "inline-flex", alignItems: "center", gap: 4 }} title="Click to view note/reason">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
                                        <span style={{ fontSize: 10, fontWeight: 600, color: "#92400e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 120 }}>{getRequestNote(req)}</span>
                                    </span>
                                ) : (
                                    <span style={{ color: "#d1d5db", fontSize: 10 }}>No note</span>
                                )}
                            </td>
                            <td onClick={e => e.stopPropagation()} style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {activeView === "needs-dd-review" && req.owner && !req._needsReassignment && !req._misassignedReason && (
                                    <button
                                        onClick={() => setReturnToOwner({ req, reason: "" })}
                                        style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: "#fff", color: "#92400e", border: "1px solid #fde68a", cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" }}
                                        title="Return this item to the original owner"
                                    >
                                        Return to Owner
                                    </button>
                                )}
                                {((activeView === "needs-dd-review" && (!req.owner || req._needsReassignment || req._misassignedReason)) || (activeView === "full-work-queue" && !req.owner)) && (
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
                                                setSuccessMsg({
                                                    title: "Reassigned",
                                                    body: `${req.requestId} \u2014 ${req.title.split(" - ").slice(1).join(" - ").trim() || req.title} reassigned to ${newOwner}.`,
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
                                {req.status === "Blocked" && (
                                    <button
                                        onClick={() => setResolveModal({ req, note: "" })}
                                        style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" }}
                                        title="Resolve blocker"
                                    >
                                        Resolve Blocker
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
            <div className="rc-header">
                <div className="rc-header-left">
                    <h1>DD Operations</h1>
                </div>
                <div className="rc-header-actions">
                    {isDemoActive() && (
                        <span style={{ fontSize: 11, color: "#475569", display: "inline-flex", alignItems: "center", gap: 4, marginRight: 8 }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
                            Testing as: <strong>{activeUser}</strong>
                        </span>
                    )}
                    <select className="rc-filter-select" value={activeUser} onChange={e => setActiveUser(e.target.value)}>
                        {ddMembers.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                    </select>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="rc-stats-row">
                {kpiCards.map(kpi => {
                    const extraClass = kpi.tab === "partner-action" && kpi.count > 0
                        ? (partnerActionItems.some(r => r._partnerDecision === "Rework Required") ? " rc-stat-card--amber" : " rc-stat-card--green")
                        : "";
                    return (
                        <div
                            key={kpi.label}
                            className={`rc-stat-card${activeView === kpi.tab ? " rc-stat-card--active" : ""}${extraClass}`}
                            onClick={() => setActiveView(kpi.tab)}
                            title={`View ${kpi.label}`}
                        >
                            <span className="rc-stat-value">{kpi.count}</span>
                            <span className="rc-stat-label">{kpi.label}</span>
                        </div>
                    );
                })}
            </div>

            <div className="rc-view-tabs" style={{ display: "flex", gap: 0, marginBottom: 16, borderBottom: "2px solid #e2e8f0", overflowX: "auto" }}>
                {(["needs-dd-review", "ready-to-publish", "partner-action", "exceptions", "published-external", "activity-feed", "full-work-queue"] as const).map(view => (
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
                    {activeView === "activity-feed" ? renderActivityFeed() : activeView === "partner-action" ? renderPartnerActionTable(activeItems) : activeView === "exceptions" ? renderExceptionsTable(activeItems) : renderTable(activeItems, emptyMessages[activeView])}
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
                                            {statusConfirm.newStatus === "Blocked" && "This will move the request to Needs DD Review for review."}
                                            {statusConfirm.newStatus === "Duplicate" && "This will move the request to Needs DD Review for duplicate review."}
                                            {statusConfirm.newStatus === "Not Applicable" && "This will move the request to Needs DD Review for disposition."}
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
                                setStatusConfirm(null);
                            }}>Confirm</button>
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
                                    title: "Successfully reassigned",
                                    body: `Successfully reassigned to ${returnToOwner.req.owner}.`,
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

            {archiveConfirm && (
                <div className="rc-modal-overlay" onClick={() => setArchiveConfirm(null)}>
                    <div className="rc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
                        <div className="rc-modal-header">
                            <h2>Approve Recommendation &mdash; Send to External Partner</h2>
                            <button className="rc-modal-close" onClick={() => setArchiveConfirm(null)}>&times;</button>
                        </div>
                        <div className="rc-modal-body" style={{ padding: "16px 20px" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                <div style={{ fontSize: 14, color: "#1e293b", fontWeight: 500 }}>
                                    Approve {archiveConfirm.req.status === "Not Applicable" ? "Not Applicable" : "Duplicate"} recommendation for <strong>{archiveConfirm.req.requestId}</strong> &mdash; {archiveConfirm.req.title.split(" - ").slice(1).join(" - ").trim() || archiveConfirm.req.title} and send to external partner for review?
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "#faf5ff", border: "1px solid #ddd6fe", borderRadius: 6, fontSize: 12, fontWeight: 500, color: "#6d28d9" }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>
                                    {archiveConfirm.req.status === "Not Applicable"
                                        ? "This will send the Not Applicable recommendation to the external partner for decision. The partner can Approve Removal or Keep Request active."
                                        : "This will send the Duplicate recommendation to the external partner for decision. The partner can Approve Merge or Keep Separate."}
                                </div>
                                <div style={{ fontSize: 12, color: "#075985", background: "#e0f2fe", padding: "8px 10px", borderRadius: 6, display: "flex", alignItems: "center", gap: 6 }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
                                    The item will remain in Exceptions until the partner responds.
                                </div>
                                <label style={{ fontSize: 11, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                                    Reason (from contributor)
                                </label>
                                <div style={{ fontSize: 13, color: "#334155", padding: "8px 10px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6 }}>
                                    {getRequestNote(archiveConfirm.req) || "No reason provided"}
                                </div>
                            </div>
                        </div>
                        <div className="rc-modal-footer">
                            <button className="rc-btn rc-btn-ghost" onClick={() => setArchiveConfirm(null)}>Cancel</button>
                            <button className="rc-btn rc-btn-primary" onClick={() => {
                                const reason = getRequestNote(archiveConfirm.req) || "";
                                sendExceptionRecommendation(archiveConfirm.req.id, archiveConfirm.req.status as "Duplicate" | "Not Applicable", reason);
                                addActivityEntry({
                                    type: "Status Change",
                                    description: `${archiveConfirm.req.requestId}: ${archiveConfirm.req.status === "Not Applicable" ? "Not Applicable" : "Duplicate"} recommendation approved by ${activeUser} and sent to external partner.`,
                                    userId: activeUser,
                                    userName: activeUser,
                                    requestId: archiveConfirm.req.id,
                                    requestTitle: archiveConfirm.req.title,
                                    transactionId: archiveConfirm.req.transactionId,
                                    transactionName: archiveConfirm.req.transactionName,
                                });
                                setSuccessMsg({
                                    title: "Recommendation Sent",
                                    body: `${archiveConfirm.req.requestId} ${archiveConfirm.req.status === "Not Applicable" ? "Not Applicable" : "Duplicate"} recommendation sent to external partner for review.`,
                                });
                                setArchiveConfirm(null);
                                setRefreshKey(k => k + 1);
                            }}>Send to External Partner</button>
                        </div>
                    </div>
                </div>
            )}

            {resolveModal && (
                <div className="rc-modal-overlay" onClick={() => setResolveModal(null)}>
                    <div className="rc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
                        <div className="rc-modal-header">
                            <h2>Resolve Blocker</h2>
                            <button className="rc-modal-close" onClick={() => setResolveModal(null)}>&times;</button>
                        </div>
                        <div className="rc-modal-body" style={{ padding: "16px 20px" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                <div style={{ fontSize: 14, color: "#1e293b", fontWeight: 500 }}>
                                    Resolve blocker for <strong>{resolveModal.req.requestId}</strong> &mdash; {resolveModal.req.title.split(" - ").slice(1).join(" - ").trim() || resolveModal.req.title}
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, fontSize: 12, fontWeight: 500, color: "#991b1b" }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
                                    This will move the item to "In Progress" status.
                                </div>
                                <label style={{ fontSize: 11, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                                    Resolution Note
                                </label>
                                <textarea
                                    value={resolveModal.note}
                                    onChange={e => setResolveModal(prev => prev ? { ...prev, note: e.target.value } : null)}
                                    placeholder="Describe how the blocker was resolved..."
                                    rows={3}
                                    style={{ width: "100%", padding: "8px 10px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 6, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", outline: "none", color: "#0f172a" }}
                                />
                            </div>
                        </div>
                        <div className="rc-modal-footer">
                            <button className="rc-btn rc-btn-ghost" onClick={() => setResolveModal(null)}>Cancel</button>
                            <button className="rc-btn rc-btn-primary" onClick={() => {
                                const note = resolveModal.note.trim();
                                updateRequestStatus(resolveModal.req.id, "In Progress" as RecapRequest["status"]);
                                if (note) {
                                    updateRequestStatusNotes(resolveModal.req.id, note);
                                }
                                addActivityEntry({
                                    type: "Status Change",
                                    description: `${resolveModal.req.requestId}: Blocker resolved by ${activeUser}.${note ? ` Note: ${note}` : ""}`,
                                    userId: activeUser,
                                    userName: activeUser,
                                    requestId: resolveModal.req.id,
                                    requestTitle: resolveModal.req.title,
                                    transactionId: resolveModal.req.transactionId,
                                    transactionName: resolveModal.req.transactionName,
                                });
                                setSuccessMsg({
                                    title: "Blocker Resolved",
                                    body: `${resolveModal.req.requestId} has been moved to In Progress.`,
                                });
                                setResolveModal(null);
                                setRefreshKey(k => k + 1);
                            }}>Resolve</button>
                        </div>
                    </div>
                </div>
            )}

            {returnToTeam && (
                <div className="rc-modal-overlay" onClick={() => setReturnToTeam(null)}>
                    <div className="rc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
                        <div className="rc-modal-header">
                            <h2>Return to Team</h2>
                            <button className="rc-modal-close" onClick={() => setReturnToTeam(null)}>&times;</button>
                        </div>
                        <div className="rc-modal-body" style={{ padding: "16px 20px" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                <div style={{ fontSize: 14, color: "#1e293b", fontWeight: 500, margin: 0 }}>
                                    Return <strong>{returnToTeam.req.requestId}</strong> &mdash; {returnToTeam.req.title.split(" - ").slice(1).join(" - ").trim() || returnToTeam.req.title} to the work queue?
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "#f0f4ff", border: "1px solid #c7d2fe", borderRadius: 6, fontSize: 12, fontWeight: 500, color: "#4338ca" }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
                                    This will set the status to "Open" and return the item to the Needs DD Review queue for reassignment.
                                </div>
                                <label style={{ fontSize: 11, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                                    Reason <span style={{ color: "#dc2626" }}>*</span>
                                </label>
                                <textarea
                                    value={returnToTeam.reason}
                                    onChange={e => setReturnToTeam(prev => prev ? { ...prev, reason: e.target.value } : null)}
                                    placeholder="Explain why this item should be returned to the team..."
                                    rows={3}
                                    style={{ width: "100%", padding: "8px 10px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 6, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", outline: "none", color: "#0f172a" }}
                                />
                            </div>
                        </div>
                        <div className="rc-modal-footer">
                            <button className="rc-btn rc-btn-ghost" onClick={() => setReturnToTeam(null)}>Cancel</button>
                            <button className="rc-btn rc-btn-primary" disabled={!returnToTeam.reason.trim()} onClick={() => {
                                const reason = returnToTeam.reason.trim();
                                if (!reason) return;
                                updateRequestStatus(returnToTeam.req.id, "Open" as RecapRequest["status"]);
                                updateRequestStatusNotes(returnToTeam.req.id, `Returned to team: ${reason}`);
                                clearExceptionFields(returnToTeam.req.id);
                                addActivityEntry({
                                    type: "Status Change",
                                    description: `${returnToTeam.req.requestId}: Returned to team by ${activeUser}. Reason: ${reason}`,
                                    userId: activeUser,
                                    userName: activeUser,
                                    requestId: returnToTeam.req.id,
                                    requestTitle: returnToTeam.req.title,
                                    transactionId: returnToTeam.req.transactionId,
                                    transactionName: returnToTeam.req.transactionName,
                                });
                                setSuccessMsg({
                                    title: "Returned to Team",
                                    body: `${returnToTeam.req.requestId} has been returned to the work queue.`,
                                });
                                setReturnToTeam(null);
                                setRefreshKey(k => k + 1);
                            }}>Return to Team</button>
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

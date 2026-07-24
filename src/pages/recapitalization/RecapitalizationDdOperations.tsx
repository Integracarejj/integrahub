import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { getRequests, getTeamMembers, updateRequestStatus, updateRequestOwner, getDocuments, updateRequestReturnToOwner, getActivity, addActivityEntry, getWorkArtifactsByRequest, updateRequestStatusNotes, isDemoActive, sendExceptionRecommendation, clearExceptionFields, resolveBlockerInternal, requestExternalBlockerHelp } from "../../services/recapDataService";
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
    const [blockerResolveModal, setBlockerResolveModal] = useState<{ req: RecapRequest; guidance: string } | null>(null);
    const [blockerExternalHelpModal, setBlockerExternalHelpModal] = useState<{ req: RecapRequest; externalQuestion: string } | null>(null);
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
    const kpiNeedsDDReview = useMemo(() => workItems.filter(r => (NEEDS_DD_REVIEW_STATUSES.includes(r.status) || r._needsReassignment || r._misassignedReason || r._partnerDecision === "Rework Required") && !r._returnReason).length, [workItems]);
    const kpiReadyToPublish = useMemo(() => workItems.filter(r => r.status === "Complete" && r._externalStatus !== "Published External").length, [workItems]);
    const kpiExceptions = useMemo(() => workItems.filter(r => (r.status === "Duplicate" || r.status === "Not Applicable") && !r._exceptionSentAt).length, [workItems]);
    const kpiPublishedExternal = useMemo(() => workItems.filter(r => r._externalStatus === "Published External" && (!r._partnerDecision || r._partnerDecision === "Approved") && !r._exceptionSentAt).length, [workItems]);
    const kpiPartnerActionRequired = useMemo(() => workItems.filter(r => ((r._externalStatus === "Published External" && r._partnerDecision && r._partnerDecision !== "Rework Required") || r._exceptionDecision || (r._exceptionSentAt && !r._exceptionDecision) || r._blockerStatus === "Pending External") && r.status !== "Completed").length, [workItems]);
    const kpiUpdatedToday = useMemo(() => {
        const today = new Date().toISOString().split("T")[0];
        return workItems.filter(r => r.lastUpdated === today).length;
    }, [workItems]);

    const needsDDReview = useMemo(() => {
        return workItems
            .filter(r => (NEEDS_DD_REVIEW_STATUSES.includes(r.status) || r._needsReassignment || r._misassignedReason || r._partnerDecision === "Rework Required") && !r._returnReason)
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
            .filter(r => (r.status === "Duplicate" || r.status === "Not Applicable") && !r._exceptionSentAt)
            .sort((a, b) => {
                const aDate = a.lastUpdated || "";
                const bDate = b.lastUpdated || "";
                return bDate.localeCompare(aDate);
            });
    }, [workItems]);

    const publishedExternalItems = useMemo(() => {
        return workItems
            .filter(r => r._externalStatus === "Published External" && (!r._partnerDecision || r._partnerDecision === "Approved") && !r._exceptionSentAt)
            .sort((a, b) => {
                const aDate = a.lastUpdated || "";
                const bDate = b.lastUpdated || "";
                return bDate.localeCompare(aDate);
            });
    }, [workItems]);

    const partnerActionItems = useMemo(() => {
        return workItems
            .filter(r => ((r._externalStatus === "Published External" && r._partnerDecision && r._partnerDecision !== "Rework Required") || r._exceptionDecision || (r._exceptionSentAt && !r._exceptionDecision) || r._blockerStatus === "Pending External") && r.status !== "Completed")
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
        return req._statusNotes || req._misassignedReason || req._returnReason || req._partnerNote || null;
    }

    function hasDocuments(req: RecapRequest): boolean {
        const docs = getDocuments();
        return docs.some(d => d.requestId === req.requestId);
    }

    function getDisplayStatus(req: RecapRequest): string {
        const wn = req._workNotes;
        if (req.status === "Clarification Needed") {
            const hasExtQ = wn?.some(n => n.action === "Clarification External Question");
            if (hasExtQ && wn) {
                const hasExtR = wn.some(n => n.action === "Clarification Response" && n.author === "External Partner");
                const hasGuidance = wn.some(n => n.action === "Clarification Guidance");
                const clarActions = ["Clarification External Question", "Clarification Guidance"];
                const clarNotes = wn.filter(n => clarActions.includes(n.action || ""));
                const lastClarAction = clarNotes.length > 0 ? clarNotes[clarNotes.length - 1].action : null;
                if (hasGuidance && lastClarAction === "Clarification Guidance") return "Clarification Resolved";
                if (hasExtR && !hasGuidance) return "External Response Received";
                if (lastClarAction === "Clarification External Question") return "Waiting on External";
            }
            return "Clarification Requested";
        }
        if (req.status === "Blocked") return "Blocked";
        return req.status;
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
                <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "#0f172a", fontWeight: 600, fontSize: 10, background: "#fff", padding: "1px 6px", borderRadius: 4, border: "1px solid #86efac", marginLeft: 4 }}>
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#166534" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    Partner Approved
                </span>
            ) : (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "#0f172a", fontWeight: 600, fontSize: 10, background: "#fff", padding: "1px 6px", borderRadius: 4, border: "1px solid #fed7aa", marginLeft: 4 }}>
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                    Rework Requested
                </span>
            )
        ) : null;
        switch (req._externalStatus) {
            case "Published External":
                return <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "#0f172a", fontWeight: 600, fontSize: 11, background: "#fff", padding: "2px 8px", borderRadius: 4, border: "1px solid #86efac" }}><svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#166534" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /></svg>Published External</span>{pill}</span>;
            case "Ready to Publish":
                return <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "#0f172a", fontWeight: 600, fontSize: 11, background: "#fff", padding: "2px 8px", borderRadius: 4, border: "1px solid #c7d2fe" }}>Ready to Publish</span>;
            default:
                return <span style={{ color: "#475569", fontSize: 11 }}>Internal Only</span>;
        }
    };

    function partnerBtnStyle(border: string): React.CSSProperties {
        return { fontSize: 11, padding: "5px 14px", borderRadius: 6, background: "#fff", color: "#0f172a", border: `1px solid ${border}`, cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" };
    }

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
                        <th style={{ width: 130, minWidth: 110 }}>Decision Type</th>
                        <th style={{ minWidth: 180 }}>Partner Note / Comment</th>
                        <th style={{ width: 85, minWidth: 70 }}>Updated</th>
                        <th style={{ width: 80, minWidth: 65 }}>Owner</th>
                        <th style={{ width: 120, minWidth: 100 }}>Action</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map(req => (
                        <tr key={req.id} className="rc-row-clickable" onClick={() => openWorkspace(req)} tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') openWorkspace(req); }}>
                            <td style={{ fontFamily: '"SF Mono", "Cascadia Code", "Consolas", monospace', fontSize: 11, color: "#475569", fontWeight: 600 }}>{req.requestId}</td>
                            <td className="rc-truncate" style={{ fontWeight: 500, maxWidth: 240 }}>{req.title.split(" - ").slice(1).join(" - ").trim() || req.title}</td>
                            <td style={{ fontSize: 12, color: "#475569" }}>{req.communityNames[0] || "\u2014"}</td>
                            <td>
                                <span className={`rc-badge rc-badge-${req.status.toLowerCase().replace(/\s+/g, "-")}`} style={{ fontSize: 11 }}>
                                    {getDisplayStatus(req)}
                                </span>
                            </td>
                            <td>
                                {req._exceptionDecision === "Confirm Duplicate" ? (
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#0f172a", fontWeight: 600, fontSize: 11, background: "#fff", padding: "3px 8px", borderRadius: 6, border: "1px solid #c4b5fd" }}>
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                                        Duplicate Confirmed
                                    </span>
                                ) : req._exceptionDecision === "Keep Separate" ? (
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#0f172a", fontWeight: 600, fontSize: 11, background: "#fff", padding: "3px 8px", borderRadius: 6, border: "1px solid #c7d2fe" }}>
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4338ca" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                                        Keep Separate
                                    </span>
                                ) : req._exceptionDecision === "Approve Removal" ? (
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#0f172a", fontWeight: 600, fontSize: 11, background: "#fff", padding: "3px 8px", borderRadius: 6, border: "1px solid #86efac" }}>
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#166534" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                        Removal Approved
                                    </span>
                                ) : req._exceptionDecision === "Keep Request" ? (
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#0f172a", fontWeight: 600, fontSize: 11, background: "#fff", padding: "3px 8px", borderRadius: 6, border: "1px solid #c7d2fe" }}>
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4338ca" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                                        Keep Request
                                    </span>
                                ) : req._partnerDecision === "Approved" ? (
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#0f172a", fontWeight: 600, fontSize: 11, background: "#fff", padding: "3px 8px", borderRadius: 6, border: "1px solid #86efac" }}>
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#166534" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                        Partner Approved
                                    </span>
                                ) : (
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#0f172a", fontWeight: 600, fontSize: 11, background: "#fff", padding: "3px 8px", borderRadius: 6, border: "1px solid #fed7aa" }}>
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                                        Rework Requested
                                    </span>
                                )}
                            </td>
                            <td>
                                {req._exceptionDecision ? (
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#0f172a", fontWeight: 600, fontSize: 11, background: "#fff", padding: "3px 8px", borderRadius: 6, border: "1px solid #c4b5fd" }}>
                                        Exception: {req._exceptionDecision}
                                    </span>
                                ) : req._partnerDecision === "Approved" ? (
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#0f172a", fontWeight: 600, fontSize: 11, background: "#fff", padding: "3px 8px", borderRadius: 6, border: "1px solid #86efac" }}>
                                        Partner Approved
                                    </span>
                                ) : (
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#0f172a", fontWeight: 600, fontSize: 11, background: "#fff", padding: "3px 8px", borderRadius: 6, border: "1px solid #fed7aa" }}>
                                        Rework Requested
                                    </span>
                                )}
                            </td>
                            <td style={{ maxWidth: 260, minWidth: 180 }}>
                                {req._exceptionDecision ? (
                                    <div style={{ fontSize: 12, color: "#334155", lineHeight: 1.5, background: "#fff", padding: "6px 10px", borderRadius: 6, border: "1px solid #c4b5fd", whiteSpace: "pre-wrap" }}>
                                        <span style={{ fontWeight: 600, color: "#0f172a" }}>Exception: {req._exceptionDecision}</span>
                                        {req._exceptionDecisionNote && <><br />{req._exceptionDecisionNote}</>}
                                    </div>
                                ) : req._partnerNote ? (
                                    <div style={{ fontSize: 12, color: "#334155", lineHeight: 1.5, background: "#fff", padding: "6px 10px", borderRadius: 6, border: "1px solid #e0e7ff", whiteSpace: "pre-wrap" }}>
                                        {req._partnerNote}
                                    </div>
                                ) : (
                                    <span style={{ color: "#94a3b8", fontStyle: "italic", fontSize: 11 }}>No note</span>
                                )}
                            </td>
                            <td style={{ fontSize: 12, color: "#475569" }}>{req.lastUpdated}</td>
                            <td style={{ fontSize: 12, color: "#475569" }} onClick={e => e.stopPropagation()}>{req.owner || "\u2014"}</td>
                            <td onClick={e => e.stopPropagation()}>
                                {req._exceptionDecision === "Approve Removal" && (
                                    <button onClick={() => navigate(`/recapitalization/workspace/${req.id}`, { state: { from: "dd-operations", actingUser: activeUser } })} style={partnerBtnStyle("#c4b5fd")}>
                                        Finalize Removal
                                    </button>
                                )}
                                {req._exceptionDecision === "Confirm Duplicate" && (
                                    <button onClick={() => navigate(`/recapitalization/workspace/${req.id}`, { state: { from: "dd-operations", actingUser: activeUser } })} style={partnerBtnStyle("#c4b5fd")}>
                                        Finalize Duplicate
                                    </button>
                                )}
                                {req._exceptionDecision === "Keep Separate" && (
                                    <button onClick={() => navigate(`/recapitalization/workspace/${req.id}`, { state: { from: "dd-operations", actingUser: activeUser } })} style={partnerBtnStyle("#86efac")}>
                                        Return to Active Work
                                    </button>
                                )}
                                {req._exceptionDecision === "Keep Request" && (
                                    <button onClick={() => navigate(`/recapitalization/workspace/${req.id}`, { state: { from: "dd-operations", actingUser: activeUser } })} style={partnerBtnStyle("#86efac")}>
                                        Return to Active Work
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
                        <th style={{ width: 100, minWidth: 80 }}>Status</th>
                        <th style={{ width: 100, minWidth: 80 }}>Review Type</th>
                        <th style={{ minWidth: 180 }}>Reason</th>
                        <th style={{ width: 85, minWidth: 70 }}>Updated</th>
                        <th style={{ width: 80, minWidth: 65 }}>Owner</th>
                        <th style={{ width: 180, minWidth: 150 }}>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map(req => (
                        <tr key={req.id} className="rc-row-clickable" onClick={() => openWorkspace(req)} tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') openWorkspace(req); }}>
                            <td style={{ fontFamily: '"SF Mono", "Cascadia Code", "Consolas", monospace', fontSize: 11, color: "#475569", fontWeight: 600 }}>{req.requestId}</td>
                            <td className="rc-truncate" style={{ fontWeight: 500, maxWidth: 240 }}>{req.title.split(" - ").slice(1).join(" - ").trim() || req.title}</td>
                            <td style={{ fontSize: 12, color: "#475569" }}>{req.communityNames[0] || "\u2014"}</td>
                            <td><PriorityBadge priority={req.priority} /></td>
                            <td>
                                <span className={`rc-badge ${req.status === "Duplicate" ? "rc-badge-duplicate" : "rc-badge-not-applicable"}`} style={{ fontSize: 11 }}>
                                    {req.status}
                                </span>
                            </td>
                            <td>
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#0f172a", fontWeight: 600, fontSize: 11, background: "#fff", padding: "2px 8px", borderRadius: 4, border: req.status === "Duplicate" ? "1px solid #c4b5fd" : "1px solid #a5b4fc", whiteSpace: "nowrap" }}>
                                    {req.status === "Duplicate" ? "Duplicate" : "Not Applicable"}
                                </span>
                            </td>
                            <td onClick={e => e.stopPropagation()} style={{ maxWidth: 260, fontSize: 12, color: "#475569" }}>
                                {getRequestNote(req) ? (
                                    <span onClick={() => setNotePopup({ req, note: getRequestNote(req)! })} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') setNotePopup({ req, note: getRequestNote(req)! }); }} style={{ cursor: "pointer", color: "#92400e", display: "inline-flex", alignItems: "center", gap: 4 }} title="Click to view reason">
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
                                        style={{ fontSize: 11, padding: "6px 16px", borderRadius: 6, background: "#fff", color: "#0f172a", border: "1px solid #5eead4", cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap", transition: "all 0.15s" }}
                                        onMouseEnter={e => { (e.target as HTMLElement).style.background = "#ccfbf1"; }}
                                        onMouseLeave={e => { (e.target as HTMLElement).style.background = "#fff"; }}
                                        title="Review the duplicate recommendation and send to external partner"
                                    >
                                        Review Duplicate
                                    </button>
                                )}
                                {req.status === "Not Applicable" && (
                                    <button
                                        onClick={() => setArchiveConfirm({ req })}
                                        style={{ fontSize: 11, padding: "6px 16px", borderRadius: 6, background: "#fff", color: "#0f172a", border: "1px solid #5eead4", cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap", transition: "all 0.15s" }}
                                        onMouseEnter={e => { (e.target as HTMLElement).style.background = "#ccfbf1"; }}
                                        onMouseLeave={e => { (e.target as HTMLElement).style.background = "#fff"; }}
                                        title="Review the not applicable recommendation and send to external partner"
                                    >
                                        Review Not Applicable
                                    </button>
                                )}
                                <button
                                    onClick={() => setReturnToTeam({ req, reason: "" })}
                                    style={{ fontSize: 11, padding: "6px 12px", borderRadius: 6, background: "#fff", color: "#0f172a", border: "1px solid #fcd34d", cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" }}
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
        navigate(`/recapitalization/workspace/${req.id}`, { state: { from: "dd-operations", actingUser: activeUser } });
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

    /* ── Issue/Exception Badge ── */
    function IssueExceptionBadge({ req }: { req: RecapRequest }) {
        if (req.status === "Blocked") {
            const blockerStatus = req._blockerStatus;
            if (blockerStatus === "Pending External") {
                return (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 4, background: "#fff7ed", color: "#0f172a", fontWeight: 600, border: "1px solid #fed7aa", whiteSpace: "nowrap", fontSize: 11 }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                        Blocked &mdash; Pending External
                    </span>
                );
            }
            if (blockerStatus === "External Response Received") {
                return (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 4, background: "#eff6ff", color: "#0f172a", fontWeight: 600, border: "1px solid #bfdbfe", whiteSpace: "nowrap", fontSize: 11 }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
                        Blocked &mdash; External Response
                    </span>
                );
            }
            return (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 4, background: "#fff", color: "#0f172a", fontWeight: 600, border: "1px solid #fca5a5", whiteSpace: "nowrap", fontSize: 11 }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                    Blocked
                </span>
            );
        }
        if (req.status === "Clarification Needed") {
            return (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 4, background: "#fff", color: "#0f172a", fontWeight: 600, border: "1px solid #fcd34d", whiteSpace: "nowrap", fontSize: 11 }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
                    Clarification Needed
                </span>
            );
        }
        if (req._needsReassignment || req._misassignedReason) {
            return (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 4, background: "#fff", color: "#0f172a", fontWeight: 600, border: "1px solid #c7d2fe", whiteSpace: "nowrap", fontSize: 11 }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#4338ca" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" /></svg>
                    Needs Reassignment
                </span>
            );
        }
        if (req._exceptionRecommendation === "Not Applicable") {
            return (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 4, background: "#f5f5f4", color: "#78716c", fontWeight: 600, border: "1px solid #e7e5e4", whiteSpace: "nowrap", fontSize: 11 }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#78716c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" /></svg>
                    Not Applicable
                </span>
            );
        }
        if (req._exceptionRecommendation === "Duplicate") {
            return (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 4, background: "#ede9fe", color: "#6d28d9", fontWeight: 600, border: "1px solid #ddd6fe", whiteSpace: "nowrap", fontSize: 11 }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#6d28d9" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>
                    Duplicate
                </span>
            );
        }
        if (req._partnerDecision === "Rework Required") {
            return (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 4, background: "#fff7ed", color: "#0f172a", fontWeight: 600, border: "1px solid #fed7aa", whiteSpace: "nowrap", fontSize: 11 }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                    Rework Requested
                </span>
            );
        }
        return (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 4, background: "#fff", color: "#0f172a", fontWeight: 600, border: "1px solid #86efac", whiteSpace: "nowrap", fontSize: 11 }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#166534" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                Ready for Review
            </span>
        );
    }

    /* ── Table View ── */
    function renderTable(items: RecapRequest[], emptyMsg: string) {
        if (items.length === 0) return <div className="rc-empty-state" style={{ padding: 20 }}>{emptyMsg}</div>;
        const isNddr = activeView === "needs-dd-review";
        return (
            <div style={{ overflowX: "auto", maxHeight: "calc(100vh - 310px)", overflowY: "auto" }}>
            <table className="rc-table">
                <thead>
                    <tr>
                        {isNddr ? (
                            <>
                                <th style={{ width: 110, minWidth: 90 }}>Request ID</th>
                                <th style={{ minWidth: 140 }}>Deliverable</th>
                                <th style={{ width: 60, textAlign: "center" }}>Pri</th>
                                <th style={{ width: 150, minWidth: 120 }}>Issue / Exception</th>
                                <th style={{ width: 90, minWidth: 70 }}>Owner</th>
                                <th style={{ width: 80, minWidth: 65 }}>Updated</th>
                                <th style={{ width: 180, minWidth: 150 }}>Actions</th>
                            </>
                        ) : (
                            <>
                                <th style={{ width: 110, minWidth: 90 }}>Request ID</th>
                                <th style={{ minWidth: 140 }}>Deliverable</th>
                                <th style={{ width: 90, minWidth: 70 }}>Community</th>
                                <th style={{ width: 60, textAlign: "center" }}>Pri</th>
                                <th style={{ width: 105, minWidth: 85 }}>Status</th>
                                <th style={{ width: 120, minWidth: 100 }}>External Status</th>
                                {activeView === "full-work-queue" && <th style={{ width: 80, minWidth: 70 }}>Owner</th>}
                                <th style={{ width: 75, minWidth: 65 }}>Team</th>
                                <th style={{ width: 85, minWidth: 70 }}>Due</th>
                                <th style={{ width: 80, minWidth: 65 }}>Updated</th>
                                <th style={{ width: 38, textAlign: "center" }}>Art</th>
                                <th style={{ width: 38, textAlign: "center" }}>Notes</th>
                                <th style={{ width: 140, minWidth: 120 }}>{activeView === "full-work-queue" ? "Assign" : "Actions"}</th>
                            </>
                        )}
                    </tr>
                </thead>
                <tbody>
                    {items.map(req => (
                        <tr key={req.id} className="rc-row-clickable" onClick={() => openWorkspace(req)} tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') openWorkspace(req); }}>
                            {isNddr ? (
                                <>
                                    <td style={{ fontFamily: '"SF Mono", "Cascadia Code", "Consolas", monospace', fontSize: 11, color: "#475569", fontWeight: 600 }}>{req.requestId}</td>
                                    <td className="rc-truncate" style={{ fontWeight: 500, maxWidth: 240 }}>
                                        <span style={{ display: "inline-flex", gap: 6, verticalAlign: "middle" }}>
                                            {req.title.split(" - ").slice(1).join(" - ").trim() || req.title}
                                            {getWorkArtifactsByRequest(getArtifactKey(req)).length > 0 && (
                                                <span onClick={e => { e.stopPropagation(); setArtifactListModal({ req, artifacts: getWorkArtifactsByRequest(getArtifactKey(req)) }); }} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') setArtifactListModal({ req, artifacts: getWorkArtifactsByRequest(getArtifactKey(req)) }); }} style={{ cursor: "pointer", color: "#2563eb" }} title="View artifacts">
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><polyline points="13 2 13 9 20 9" /></svg>
                                                </span>
                                            )}
                                            {getRequestNote(req) && (
                                                <span onClick={e => { e.stopPropagation(); setNotePopup({ req, note: getRequestNote(req)! }); }} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') setNotePopup({ req, note: getRequestNote(req)! }); }} style={{ cursor: "pointer", color: "#92400e" }} title="Click to view note/reason">
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
                                                </span>
                                            )}
                                        </span>
                                        {(req.transactionName || req.orgName) && (
                                            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 400, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                {req.transactionName && <span>{req.transactionName}</span>}
                                                {req.transactionName && req.orgName && <span> · </span>}
                                                {req.orgName && <span style={{ fontWeight: 600 }}>{req.orgName}</span>}
                                            </div>
                                        )}
                                    </td>
                                    <td><PriorityBadge priority={req.priority} /></td>
                                    <td onClick={e => e.stopPropagation()}>
                                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                            <div><IssueExceptionBadge req={req} /></div>
                                            {req.status === "Blocked" && req._blockerReason && (
                                                <span style={{ fontSize: 9, color: "#64748b", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={req._blockerReason}>
                                                    &ldquo;{req._blockerReason.length > 60 ? req._blockerReason.slice(0, 60) + "..." : req._blockerReason}&rdquo;
                                                </span>
                                            )}
                                            {req.status !== "Blocked" && getRequestNote(req) && (
                                                <span style={{ fontSize: 9, color: "#64748b", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={getRequestNote(req) || ""}>
                                                    {getRequestNote(req)!.slice(0, 80)}{getRequestNote(req)!.length > 80 ? "..." : ""}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td style={{ fontSize: 12, color: "#475569" }}>{req.owner || "\u2014"}</td>
                                    <td style={{ fontSize: 12, color: "#475569" }}>{req.lastUpdated}</td>
                                    <td onClick={e => e.stopPropagation()} style={{ whiteSpace: "nowrap" }}>
                                        {req.owner && !req._needsReassignment && !req._misassignedReason ? (
                                            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
                                                {req.status !== "Blocked" && (
                                                    <button
                                                        onClick={() => setReturnToOwner({ req, reason: "" })}
                                                        style={{ fontSize: 10, padding: "4px 12px", borderRadius: 6, background: "#fff", color: "#0f172a", border: "1px solid #fcd34d", cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" }}
                                                        title="Return this item to the original owner"
                                                    >
                                                        Return to Owner
                                                    </button>
                                                )}
                                            </div>
                                        ) : (
                                            <select
                                                aria-label={`Assign ${req.requestId}`}
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
                                    </td>
                                </>
                            ) : (
                                <>
                                    <td style={{ fontFamily: '"SF Mono", "Cascadia Code", "Consolas", monospace', fontSize: 11, color: "#475569", fontWeight: 600 }}>{req.requestId}</td>
                                    <td className="rc-truncate" style={{ fontWeight: 500, maxWidth: 240 }}>
                                        <div>{req.title.split(" - ").slice(1).join(" - ").trim() || req.title}</div>
                                        {(req.transactionName || req.orgName) && (
                                            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 400, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                {req.transactionName && <span>{req.transactionName}</span>}
                                                {req.transactionName && req.orgName && <span> · </span>}
                                                {req.orgName && <span style={{ fontWeight: 600 }}>{req.orgName}</span>}
                                            </div>
                                        )}
                                    </td>
                                    <td style={{ fontSize: 12, color: "#475569" }}>{req.communityNames[0] || "\u2014"}</td>
                                    <td><PriorityBadge priority={req.priority} /></td>
                                    <td onClick={e => e.stopPropagation()}>
                                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                            {req.status === "Blocked" ? (
                                                <div><IssueExceptionBadge req={req} /></div>
                                            ) : (
                                                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                                    <select
                                                        aria-label={`Status for ${req.requestId}`}
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
                                            )}
                                            {req.status === "Blocked" && req._blockerReason && (
                                                <span style={{ fontSize: 9, color: "#64748b", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={req._blockerReason}>
                                                    &ldquo;{req._blockerReason.length > 60 ? req._blockerReason.slice(0, 60) + "..." : req._blockerReason}&rdquo;
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td><ExternalStatus req={req} /></td>
                                    {activeView === "full-work-queue" && <td style={{ fontSize: 12, color: "#475569" }}>{req.owner || "\u2014"}</td>}
                                    <td style={{ fontSize: 12 }}>{req.team}</td>
                                    <td className="nowrap" style={{ fontSize: 12, color: req.status === "Overdue" ? "#991b1b" : "#475569", fontWeight: req.status === "Overdue" ? 600 : 400 }}>{req.dueDate}</td>
                                    <td style={{ fontSize: 12, color: "#475569" }}>{req.lastUpdated}</td>
                                    <td onClick={e => e.stopPropagation()} style={{ fontSize: 11, textAlign: "center", color: getWorkArtifactsByRequest(getArtifactKey(req)).length > 0 ? "#2563eb" : "#d1d5db" }}>
                                        {getWorkArtifactsByRequest(getArtifactKey(req)).length > 0 ? (
                                            <span onClick={() => setArtifactListModal({ req, artifacts: getWorkArtifactsByRequest(getArtifactKey(req)) })} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') setArtifactListModal({ req, artifacts: getWorkArtifactsByRequest(getArtifactKey(req)) }); }} style={{ cursor: "pointer" }} title="View artifacts">
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><polyline points="13 2 13 9 20 9" /></svg>
                                            </span>
                                        ) : (
                                            <span style={{ color: "#d1d5db" }}>&mdash;</span>
                                        )}
                                    </td>
                                    <td onClick={e => e.stopPropagation()} style={{ fontSize: 11, textAlign: "center", maxWidth: 160 }}>
                                        {getRequestNote(req) ? (
                                            <span onClick={() => setNotePopup({ req, note: getRequestNote(req)! })} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') setNotePopup({ req, note: getRequestNote(req)! }); }} style={{ cursor: "pointer", color: "#92400e", display: "inline-flex", alignItems: "center", gap: 4 }} title="Click to view note/reason">
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
                                                <span style={{ fontSize: 10, fontWeight: 600, color: "#92400e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 120 }}>{getRequestNote(req)}</span>
                                            </span>
                                        ) : (
                                            <span style={{ color: "#d1d5db", fontSize: 10 }}>No note</span>
                                        )}
                                    </td>
                                    <td onClick={e => e.stopPropagation()} style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                        {activeView === "full-work-queue" && !req.owner && (
                                            <select
                                                aria-label={`Assign ${req.requestId}`}
                                                value=""
                                                onChange={e => {
                                                    const newOwner = e.target.value;
                                                    if (newOwner) {
                                                        updateRequestOwner(req.id, newOwner);
                                                        updateRequestStatus(req.id, "Open" as RecapRequest["status"]);
                                                        addActivityEntry({
                                                            type: "Assignment",
                                                            description: `${req.requestId}: Assigned to ${newOwner} by ${activeUser}`,
                                                            userId: activeUser,
                                                            userName: activeUser,
                                                            requestId: req.id,
                                                            requestTitle: req.title,
                                                            transactionId: req.transactionId,
                                                            transactionName: req.transactionName,
                                                        });
                                                        setSuccessMsg({
                                                            title: "Assigned",
                                                            body: `${req.requestId} assigned to ${newOwner}.`,
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
                                </>
                            )}
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
                    <select className="rc-filter-select" aria-label="Switch user" value={activeUser} onChange={e => setActiveUser(e.target.value)}>
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
                <div className="rc-modal-overlay" role="dialog" aria-modal="true" aria-label={`Confirm status change to ${statusConfirm.newStatus}`} onClick={() => setStatusConfirm(null)}>
                    <div className="rc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
                        <div className="rc-modal-header">
                            <h2>{statusConfirm.newStatus}</h2>
                            <button className="rc-modal-close" onClick={() => setStatusConfirm(null)} aria-label="Close">&times;</button>
                        </div>
                        <div className="rc-modal-body" style={{ padding: "16px 20px" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                <div style={{ fontSize: 14, color: "#1e293b", fontWeight: 500, margin: 0 }}>
                                    Change <strong>{statusConfirm.req.requestId}</strong> &mdash; {statusConfirm.req.title.split(" - ").slice(1).join(" - ").trim() || statusConfirm.req.title} to <strong>{statusConfirm.newStatus}</strong>?
                                </div>
                                {["Blocked", "Duplicate", "Not Applicable"].includes(statusConfirm.newStatus) && (
                                    <>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "#fff", border: "1px solid #fca5a5", borderRadius: 6, fontSize: 12, fontWeight: 500, color: "#991b1b" }}>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
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
                <div className="rc-modal-overlay" role="dialog" aria-modal="true" aria-label="Return to owner" onClick={() => setReturnToOwner(null)}>
                    <div className="rc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
                        <div className="rc-modal-header">
                            <h2>Return to Owner</h2>
                            <button className="rc-modal-close" onClick={() => setReturnToOwner(null)} aria-label="Close">&times;</button>
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
                <div className="rc-modal-overlay" role="dialog" aria-modal="true" aria-label="No artifact warning" onClick={() => setArtifactWarning(null)}>
                    <div className="rc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
                        <div className="rc-modal-header">
                            <h2>No Artifact Attached</h2>
                            <button className="rc-modal-close" onClick={() => setArtifactWarning(null)} aria-label="Close">&times;</button>
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
                <div className="rc-modal-overlay" role="dialog" aria-modal="true" aria-label="View note" onClick={() => setNotePopup(null)}>
                    <div className="rc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
                        <div className="rc-modal-header">
                            <h2>Note &mdash; {notePopup.req.requestId}</h2>
                            <button className="rc-modal-close" onClick={() => setNotePopup(null)} aria-label="Close">&times;</button>
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
                <div className="rc-modal-overlay" role="dialog" aria-modal="true" aria-label={`Artifacts for ${artifactListModal.req.requestId}`} onClick={() => setArtifactListModal(null)}>
                    <div className="rc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
                        <div className="rc-modal-header">
                            <h2>Artifacts &mdash; {artifactListModal.req.requestId}</h2>
                            <button className="rc-modal-close" onClick={() => setArtifactListModal(null)} aria-label="Close">&times;</button>
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
                <div className="rc-modal-overlay" role="dialog" aria-modal="true" aria-label="Send recommendation to partner" onClick={() => setArchiveConfirm(null)}>
                    <div className="rc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
                        <div className="rc-modal-header">
                            <h2>{archiveConfirm.req.status === "Not Applicable" ? "Send Removal Recommendation" : "Send Duplicate Recommendation"}</h2>
                            <button className="rc-modal-close" onClick={() => setArchiveConfirm(null)} aria-label="Close">&times;</button>
                        </div>
                        <div className="rc-modal-body" style={{ padding: "16px 24px" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                                <div style={{ fontSize: 13, color: "#0f172a", display: "flex", flexDirection: "column", gap: 6, padding: "10px 14px", background: "#f8faff", borderRadius: 8, border: "1px solid #e0e7ff" }}>
                                    <div><span style={{ fontWeight: 700, textTransform: "uppercase", fontSize: 10, letterSpacing: "0.03em", marginRight: 8, color: "#475569" }}>Request ID</span><span style={{ fontFamily: '"SF Mono", "Cascadia Code", "Consolas", monospace', fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{archiveConfirm.req.requestId}</span></div>
                                    <div><span style={{ fontWeight: 700, textTransform: "uppercase", fontSize: 10, letterSpacing: "0.03em", marginRight: 8, color: "#475569" }}>Deliverable</span><span style={{ color: "#0f172a", fontWeight: 500 }}>{archiveConfirm.req.title.split(" - ").slice(1).join(" - ").trim() || archiveConfirm.req.title}</span></div>
                                </div>
                                
                                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "#fff", border: archiveConfirm.req.status === "Not Applicable" ? "1px solid #c7d2fe" : "1px solid #ddd6fe", borderRadius: 8, fontSize: 12, fontWeight: 600, color: archiveConfirm.req.status === "Not Applicable" ? "#4338ca" : "#6d28d9" }}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                                    {archiveConfirm.req.status === "Not Applicable" ? "Not Applicable" : "Possible Duplicate"}
                                </div>

                                <div style={{ padding: "10px 14px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8 }}>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 4 }}>Contributor Reason</div>
                                    <div style={{ fontSize: 13, color: "#0f172a", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                                        {getRequestNote(archiveConfirm.req) || "No reason provided"}
                                    </div>
                                </div>

                                <div style={{ padding: "10px 14px", background: "#fff", border: "1px solid #bbf7d0", borderRadius: 8, fontSize: 12, color: "#166534", lineHeight: 1.5 }}>
                                    <span style={{ fontWeight: 700, display: "block", marginBottom: 2 }}>Partner Decision Preview</span>
                                    {archiveConfirm.req.status === "Not Applicable"
                                        ? "The partner will choose: Approve Removal or Keep Request"
                                        : "The partner will choose: Confirm Duplicate or Keep Separate"}
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
                                    title: "Recommendation Sent to Partner",
                                    body: `${archiveConfirm.req.requestId} — ${archiveConfirm.req.status === "Not Applicable" ? "Removal" : "Duplicate"} recommendation sent. Moving to Published External — awaiting partner decision.`,
                                });
                                setArchiveConfirm(null);
                                setRefreshKey(k => k + 1);
                            }}>Send to External Partner</button>
                        </div>
                    </div>
                </div>
            )}

            {blockerResolveModal && (
                <div className="rc-modal-overlay" role="dialog" aria-modal="true" aria-label="Resolve blocker" onClick={() => setBlockerResolveModal(null)}>
                    <div className="rc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
                        <div className="rc-modal-header">
                            <h2>Resolve Blocker</h2>
                            <button className="rc-modal-close" onClick={() => setBlockerResolveModal(null)} aria-label="Close">&times;</button>
                        </div>
                        <div className="rc-modal-body" style={{ padding: "16px 20px" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                <div style={{ fontSize: 14, color: "#1e293b", fontWeight: 500 }}>
                                    Provide guidance for <strong>{blockerResolveModal.req.requestId}</strong> &mdash; {blockerResolveModal.req.title.split(" - ").slice(1).join(" - ").trim() || blockerResolveModal.req.title}
                                </div>
                                {blockerResolveModal.req._blockerReason && (
                                    <div style={{ padding: "8px 10px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, fontSize: 12, color: "#0f172a" }}>
                                        <strong style={{ color: "#991b1b" }}>Blocker reason:</strong> {blockerResolveModal.req._blockerReason}
                                    </div>
                                )}
                                <div style={{ fontSize: 12, color: "#475569" }}>
                                    This will resolve the blocker and return the item to the contributor with your guidance.
                                </div>
                                <label style={{ fontSize: 11, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                                    Guidance for Contributor <span style={{ color: "#dc2626" }}>*</span>
                                </label>
                                <textarea
                                    value={blockerResolveModal.guidance}
                                    onChange={e => setBlockerResolveModal(prev => prev ? { ...prev, guidance: e.target.value } : null)}
                                    placeholder="Explain how the blocker was resolved or what the contributor should do next..."
                                    rows={3}
                                    style={{ width: "100%", padding: "8px 10px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 6, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", outline: "none", color: "#0f172a" }}
                                />
                            </div>
                        </div>
                        <div className="rc-modal-footer">
                            <button className="rc-btn rc-btn-ghost" onClick={() => setBlockerResolveModal(null)}>Cancel</button>
                            <button className="rc-btn rc-btn-primary" disabled={!blockerResolveModal.guidance.trim()} onClick={() => {
                                const guidance = blockerResolveModal.guidance.trim();
                                if (!guidance) return;
                                resolveBlockerInternal(blockerResolveModal.req.id, guidance, activeUser);
                                addActivityEntry({
                                    type: "Status Change",
                                    description: `${blockerResolveModal.req.requestId}: Blocker resolved by ${activeUser}. Guidance: ${guidance}`,
                                    userId: activeUser,
                                    userName: activeUser,
                                    requestId: blockerResolveModal.req.id,
                                    requestTitle: blockerResolveModal.req.title,
                                    transactionId: blockerResolveModal.req.transactionId,
                                    transactionName: blockerResolveModal.req.transactionName,
                                });
                                setSuccessMsg({
                                    title: "Blocker Resolved",
                                    body: `${blockerResolveModal.req.requestId} has been returned to the contributor with your guidance.`,
                                });
                                setBlockerResolveModal(null);
                                setRefreshKey(k => k + 1);
                            }}>Resolve &amp; Return</button>
                        </div>
                    </div>
                </div>
            )}

            {blockerExternalHelpModal && (
                <div className="rc-modal-overlay" role="dialog" aria-modal="true" aria-label="Request external help" onClick={() => setBlockerExternalHelpModal(null)}>
                    <div className="rc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
                        <div className="rc-modal-header">
                            <h2>Request External Help</h2>
                            <button className="rc-modal-close" onClick={() => setBlockerExternalHelpModal(null)} aria-label="Close">&times;</button>
                        </div>
                        <div className="rc-modal-body" style={{ padding: "16px 20px" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                <div style={{ fontSize: 14, color: "#1e293b", fontWeight: 500 }}>
                                    Request information from external partner for <strong>{blockerExternalHelpModal.req.requestId}</strong> &mdash; {blockerExternalHelpModal.req.title.split(" - ").slice(1).join(" - ").trim() || blockerExternalHelpModal.req.title}
                                </div>
                                {blockerExternalHelpModal.req._blockerReason && (
                                    <div style={{ padding: "8px 10px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, fontSize: 12, color: "#0f172a" }}>
                                        <strong style={{ color: "#991b1b" }}>Blocker reason:</strong> {blockerExternalHelpModal.req._blockerReason}
                                    </div>
                                )}
                                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "#fffbeb", border: "1px solid #fed7aa", borderRadius: 6, fontSize: 12, fontWeight: 500, color: "#0f172a" }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                                    This will send a request to the external partner and move the item to "Pending External" status.
                                </div>
                                <label style={{ fontSize: 11, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                                    Request to External Partner <span style={{ color: "#dc2626" }}>*</span>
                                </label>
                                <textarea
                                    value={blockerExternalHelpModal.externalQuestion}
                                    onChange={e => setBlockerExternalHelpModal(prev => prev ? { ...prev, externalQuestion: e.target.value } : null)}
                                    placeholder="Describe what information you need from the external partner..."
                                    rows={3}
                                    style={{ width: "100%", padding: "8px 10px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 6, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", outline: "none", color: "#0f172a" }}
                                />
                            </div>
                        </div>
                        <div className="rc-modal-footer">
                            <button className="rc-btn rc-btn-ghost" onClick={() => setBlockerExternalHelpModal(null)}>Cancel</button>
                            <button className="rc-btn rc-btn-primary" disabled={!blockerExternalHelpModal.externalQuestion.trim()} onClick={() => {
                                const question = blockerExternalHelpModal.externalQuestion.trim();
                                if (!question) return;
                                requestExternalBlockerHelp(blockerExternalHelpModal.req.id, question, activeUser);
                                addActivityEntry({
                                    type: "Status Change",
                                    description: `${blockerExternalHelpModal.req.requestId}: External help requested by ${activeUser}. Question: ${question}`,
                                    userId: activeUser,
                                    userName: activeUser,
                                    requestId: blockerExternalHelpModal.req.id,
                                    requestTitle: blockerExternalHelpModal.req.title,
                                    transactionId: blockerExternalHelpModal.req.transactionId,
                                    transactionName: blockerExternalHelpModal.req.transactionName,
                                });
                                setSuccessMsg({
                                    title: "External Help Requested",
                                    body: `${blockerExternalHelpModal.req.requestId} has been sent to the external partner.`,
                                });
                                setBlockerExternalHelpModal(null);
                                setRefreshKey(k => k + 1);
                            }}>Send to External Partner</button>
                        </div>
                    </div>
                </div>
            )}

            {returnToTeam && (
                <div className="rc-modal-overlay" role="dialog" aria-modal="true" aria-label="Return to team" onClick={() => setReturnToTeam(null)}>
                    <div className="rc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
                        <div className="rc-modal-header">
                            <h2>Return to Team</h2>
                            <button className="rc-modal-close" onClick={() => setReturnToTeam(null)} aria-label="Close">&times;</button>
                        </div>
                        <div className="rc-modal-body" style={{ padding: "16px 20px" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                <div style={{ fontSize: 14, color: "#1e293b", fontWeight: 500, margin: 0 }}>
                                    Return <strong>{returnToTeam.req.requestId}</strong> &mdash; {returnToTeam.req.title.split(" - ").slice(1).join(" - ").trim() || returnToTeam.req.title} to the work queue?
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "#fff", border: "1px solid #c7d2fe", borderRadius: 6, fontSize: 12, fontWeight: 500, color: "#4338ca" }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4338ca" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
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
                <div className="rc-modal-overlay" role="dialog" aria-modal="true" aria-label={successMsg.title} onClick={() => setSuccessMsg(null)}>
                    <div className="rc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
                        <div className="rc-modal-header">
                            <h2>{successMsg.title}</h2>
                            <button className="rc-modal-close" onClick={() => setSuccessMsg(null)} aria-label="Close">&times;</button>
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

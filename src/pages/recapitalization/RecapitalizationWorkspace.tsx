import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { lookupWorkspaceItem, getDocumentsByTransaction, updateRequestStatus, updateRequestOwner, updateRequestExternalStatus, updateRequestCompletion, addActivityEntry, getWorkArtifactsByRequest, saveWorkArtifacts, removeWorkArtifact } from "../../services/recapDataService";
import type { RecapRequest, WorkArtifact } from "../../services/recapDataService";
import RecapSubNav from "./RecapSubNav";
import "./Recapitalization.css";

const STATUS_OPTIONS: RecapRequest["status"][] = ["Open", "In Progress", "Blocked", "Complete", "Not Applicable", "Duplicate"];

const TEAM_MEMBERS = ["Sarah Chen", "James Wright", "Lisa Park", "Tom Davies", "Mike O'Brien", "Anna Patel", "David Park", "Carlos Rivera", "Demo User (Test)"];

const STATUS_COLORS: Record<string, string> = {
    "Open": "#2563eb",
    "In Progress": "#f59e0b",
    "Blocked": "#dc2626",
    "Complete": "#22c55e",
    "Not Applicable": "#94a3b8",
    "Duplicate": "#dc2626",
};

function getInitials(name: string): string {
    return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

function statusDot(color: string) {
    return <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />;
}

interface WorkspaceQuestion {
    id: string;
    from: string;
    question: string;
    response: string | null;
    status: "Open" | "Answered";
    timestamp: string;
}

function ChevronDown() {
    return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>;
}
function ChevronRight() {
    return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>;
}

function BluePill({ children }: { children: React.ReactNode }) {
    return <span style={{ display: "inline-block", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: "#dbeafe", color: "#1d4ed8", textTransform: "uppercase", letterSpacing: "0.03em" }}>{children}</span>;
}

export default function RecapitalizationWorkspace() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const [wsRefreshKey, setWsRefreshKey] = useState(0);
    const result = useMemo(() => id ? lookupWorkspaceItem(id) : null, [id, wsRefreshKey]);

    const [internalOwner, setInternalOwner] = useState("");
    const [banner, setBanner] = useState<string | null>(null);
    const [bannerError, setBannerError] = useState(false);

    const [localQuestions, setLocalQuestions] = useState<WorkspaceQuestion[]>([
        { id: "q1", from: "Marcus & Associates", question: "Should the Phase I ESA include asbestos testing or just standard environmental assessment?", response: "Standard Phase I only. Asbestos scope to be handled separately if flagged.", status: "Answered", timestamp: "2026-06-24" },
        { id: "q2", from: "Marcus & Associates", question: "What is the preferred format for financial statements — scanned PDF or native Excel?", response: null, status: "Open", timestamp: "2026-06-27" },
    ]);

    const [needClarificationOpen, setNeedClarificationOpen] = useState(false);
    const [clarificationText, setClarificationText] = useState("");

    const [commentText, setCommentText] = useState("");

    const [statusActionModal, setStatusActionModal] = useState<{ newStatus: RecapRequest["status"]; reason: string } | null>(null);
    const [completionModal, setCompletionModal] = useState<{ note: string; readyForReview: boolean } | null>(null);
    const [workArtifacts, setWorkArtifacts] = useState<WorkArtifact[]>(() => id ? getWorkArtifactsByRequest(id) : []);
    const [artifactBanner, setArtifactBanner] = useState<string | null>(null);
    const [publishExternal, setPublishExternal] = useState<{ step: number; selectedArtifacts: string[] } | null>(null);

    // Re-sync artifacts when navigating to a different workspace item
    useEffect(() => {
        if (id) setWorkArtifacts(getWorkArtifactsByRequest(id));
    }, [id]);

    const backFrom = (location.state as any)?.from || "tracker";
    const backLabel = backFrom === "my-work" ? "Back to My Work" : "Back to Work Queue";
    const backPath = backFrom === "my-work" ? "/recapitalization/my-work" : "/recapitalization/tracker";

    if (!result) {
        return (
            <div className="rc-page">
                <RecapSubNav />
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "80px 20px", gap: 12, textAlign: "center" }}>
                    <h2 style={{ fontSize: 20, color: "#0f172a", margin: 0 }}>Item Not Found</h2>
                    <p style={{ fontSize: 14, color: "#475569" }}>The requested workspace item could not be found.</p>
                    <button className="rc-btn rc-btn-primary" onClick={() => navigate("/recapitalization/intake")}>Back to Intake Queue</button>
                </div>
            </div>
        );
    }

    const { transaction } = result;
    const item = result.item as any;

    const displayId = item.requestId || item.intakeId || item.id;
    const displayTitle = item.title || item.fileName || "";
    const displayStatus = item.status;
    const communities = item.communityNames || [];
    const description = item.description || "";
    const submittedDate = item.submittedAt ? new Date(item.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : item.createdDate || "";

    const isBulkUpload = item.type === "Broker Upload";
    const isDuplicate = displayStatus === "Duplicate";
    const statusColor = STATUS_COLORS[displayStatus] || "#64748b";

    const documents = useMemo(() => getDocumentsByTransaction(item.transactionId), [item.transactionId]);

    const completionSummary = useMemo(() => {
        if (result.type === "request") {
            const req = result.item as RecapRequest;
            if (req._completedBy) {
                return {
                    completedBy: req._completedBy,
                    completedDate: req._completedAt || "",
                    completionNotes: req._completionNotes || "",
                    supportingArtifacts: workArtifacts.filter(a => a.name).map(a => a.name),
                    reviewer: "",
                };
            }
        }
        return null;
    }, [result, workArtifacts]);

    useEffect(() => {
        setInternalOwner(item.suggestedOwner || item.owner || "");
    }, [item]);

    const [sections, setSections] = useState<Record<string, boolean>>({
        submission: false,
        documents: false,
        conversation: true,
        completionSummary: false,
    });

    const toggleSection = (key: string) => setSections(prev => ({ ...prev, [key]: !prev[key] }));

    function doStatusChange(newStatus: RecapRequest["status"]) {
        const reqId = item.id || item.intakeId || "";
        updateRequestStatus(reqId, newStatus);
        addActivityEntry({
            type: "Status Change",
            description: `Status changed to ${newStatus}`,
            userId: "current-user",
            userName: "Sarah Chen",
            requestId: item.requestId || item.id,
            requestTitle: displayTitle || item.category || "",
            transactionId: item.transactionId,
            transactionName: item.transactionName || item.transactionId,
        });
        setWsRefreshKey(k => k + 1);
        setBanner(`\u2713 Status updated to ${newStatus}`);
        setBannerError(false);
    }

    function doAssign(newOwner: string) {
        const reqId = item.id || item.intakeId || "";
        updateRequestOwner(reqId, newOwner || null);
        setInternalOwner(newOwner);
        addActivityEntry({
            type: "Assignment",
            description: `${displayId}: ${newOwner ? `Assigned to ${newOwner}` : "Unassigned"} by Sarah Chen`,
            userId: "current-user",
            userName: "Sarah Chen",
            requestId: item.requestId || item.id,
            requestTitle: displayTitle || item.category || "",
            transactionId: item.transactionId,
            transactionName: item.transactionName || item.transactionId,
        });
        setWsRefreshKey(k => k + 1);
        setBanner(newOwner ? `\u2713 Assigned to ${newOwner}` : "\u2713 Unassigned");
        setBannerError(false);
    }

    function doDuplicate() {
        const reqId = item.id || item.intakeId || "";
        updateRequestStatus(reqId, "Duplicate");
        addActivityEntry({
            type: "Status Change",
            description: "Marked as Duplicate",
            userId: "current-user",
            userName: "Sarah Chen",
            requestId: item.requestId || item.id,
            requestTitle: displayTitle || item.category || "",
            transactionId: item.transactionId,
            transactionName: item.transactionName || item.transactionId,
        });
        setWsRefreshKey(k => k + 1);
        setBanner("\u2713 Marked as Duplicate");
        setBannerError(false);
    }

    function addConversationEntry(text: string, from: string) {
        const entry: WorkspaceQuestion = {
            id: "q-" + Date.now(),
            from,
            question: text,
            response: null,
            status: "Open",
            timestamp: new Date().toISOString().split("T")[0],
        };
        setLocalQuestions(prev => [entry, ...prev]);
    }

    function submitClarification() {
        if (!clarificationText.trim()) return;
        addConversationEntry(clarificationText.trim(), "Sarah Chen (Internal)");
        setClarificationText("");
        setNeedClarificationOpen(false);
    }

    function submitComment() {
        if (!commentText.trim()) return;
        addConversationEntry(commentText.trim(), "Sarah Chen (Internal)");
        setCommentText("");
    }

    return (
        <div style={{ background: "#f8fbff", minHeight: "100vh", paddingBottom: 40 }}>
            <RecapSubNav />
            <div className="rc-page" style={{ maxWidth: 1100, gap: 0 }}>
                {/* Breadcrumb */}
                <div style={{ marginBottom: 16 }}>
                    <button onClick={() => navigate(backPath)} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "#2563eb", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
                        {backLabel}
                    </button>
                </div>

                {/* Success Feedback */}
                {banner && (
                    <div style={{
                        padding: "6px 14px", marginBottom: 12, borderRadius: 6, fontSize: 12, fontWeight: 600,
                        background: bannerError ? "#fef2f2" : "#f0fdf4",
                        color: bannerError ? "#991b1b" : "#166534",
                        border: `1px solid ${bannerError ? "#fecaca" : "#bbf7d0"}`,
                        display: "inline-flex", alignItems: "center", gap: 8,
                    }}>
                        <span>{banner}</span>
                        <button style={{ background: "none", border: "none", color: bannerError ? "#991b1b" : "#166534", fontSize: 14, cursor: "pointer", fontWeight: 700, padding: 0, lineHeight: 1 }} onClick={() => setBanner(null)}>&times;</button>
                    </div>
                )}

                {/* Main Content Card */}
                <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(15,23,42,0.04)", overflow: "hidden" }}>
                    {/* Hero Section */}
                    <div style={{ padding: "28px 32px", display: "flex", gap: 28, flexWrap: "wrap" }}>
                        {/* Left: ID + Title */}
                        <div style={{ flex: "1 1 320px", minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                                <BluePill>Request ID</BluePill>
                                <span style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", fontFamily: '"SF Mono", "Cascadia Code", "Consolas", monospace', letterSpacing: "-0.01em" }}>{displayId}</span>
                                {item.intakeId && item.intakeId !== displayId && (
                                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: 8 }}>
                                        <span style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em" }}>Intake ID</span>
                                        <span style={{ fontSize: 13, fontWeight: 600, color: "#475569", fontFamily: '"SF Mono", "Cascadia Code", "Consolas", monospace' }}>{item.intakeId}</span>
                                    </div>
                                )}
                                {isDuplicate && (
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}>
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                                        Duplicate
                                    </span>
                                )}
                            </div>
                            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 10 }}>
                                <span style={{ display: "inline-block", fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 4, background: "#eef2ff", color: "#4f46e5", textTransform: "uppercase", letterSpacing: "0.03em", marginTop: 2 }}>Deliverable</span>
                                <h1 style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", margin: 0, lineHeight: 1.3, flex: 1 }}>{displayTitle || item.category || "Untitled Request"}</h1>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap", fontSize: 12, color: "#475569" }}>
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
                                    {communities.slice(0, 2).join(", ") || "\u2014"}
                                </span>
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
                                    {transaction.name}
                                </span>
                            </div>
                        </div>

                        {/* Right: Status + Assign + Actions */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 240, maxWidth: 280 }}>
                            {/* Status */}
                            <div>
                                <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 5 }}>Status</div>
                                <div style={{ position: "relative" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 32px 7px 10px", fontSize: 13, fontWeight: 600, borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", color: "#0f172a", pointerEvents: "none" }}>
                                        {statusDot(statusColor)}
                                        <span>{displayStatus}</span>
                                    </div>
                                    <select
                                        value={displayStatus}
                                        onChange={e => {
                                            const newStatus = e.target.value as RecapRequest["status"];
                                            if (newStatus === "Complete") {
                                                setCompletionModal({ note: "", readyForReview: false });
                                            } else if (newStatus === "Blocked" || newStatus === "Duplicate" || newStatus === "Not Applicable") {
                                                setStatusActionModal({ newStatus, reason: "" });
                                            } else {
                                                doStatusChange(newStatus);
                                            }
                                        }}
                                        style={{ position: "absolute", inset: 0, width: "100%", opacity: 0, cursor: "pointer", fontSize: 13 }}
                                    >
                                        {STATUS_OPTIONS.map(s => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Assign */}
                            <div>
                                <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 5 }}>Assign</div>
                                <div style={{ position: "relative" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 32px 7px 10px", fontSize: 13, fontWeight: 500, borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", pointerEvents: "none" }}>
                                        {internalOwner ? (
                                            <>
                                                <span style={{ width: 22, height: 22, borderRadius: "50%", background: "#dbeafe", color: "#1d4ed8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{getInitials(internalOwner)}</span>
                                                <span style={{ color: "#0f172a" }}>{internalOwner}</span>
                                            </>
                                        ) : (
                                            <>
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                                                <span style={{ color: "#475569" }}>Unassigned</span>
                                            </>
                                        )}
                                    </div>
                                    <select
                                        value={internalOwner || ""}
                                        onChange={e => doAssign(e.target.value)}
                                        style={{ position: "absolute", inset: 0, width: "100%", opacity: 0, cursor: "pointer", fontSize: 13 }}
                                    >
                                        <option value="">Unassigned</option>
                                        {TEAM_MEMBERS.map(n => <option key={n} value={n}>{n}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Action buttons */}
                            <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                                <button
                                    onClick={() => setNeedClarificationOpen(true)}
                                    style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "7px 10px", fontSize: 12, fontWeight: 600, borderRadius: 6, background: "#fff", color: "#2563eb", border: "1px solid #2563eb", cursor: "pointer" }}
                                >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                                    Clarify
                                </button>
                                <button
                                    onClick={() => setPublishExternal({ step: 1, selectedArtifacts: workArtifacts.map(a => a.name) })}
                                    disabled={displayStatus !== "Complete"}
                                    title={displayStatus !== "Complete" ? "Publishing requires Complete status" : "Publish this deliverable"}
                                    style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "7px 10px", fontSize: 12, fontWeight: 600, borderRadius: 6, background: displayStatus === "Complete" ? "#1d4ed8" : "#f1f5f9", color: displayStatus === "Complete" ? "#fff" : "#94a3b8", border: "none", cursor: displayStatus === "Complete" ? "pointer" : "not-allowed" }}
                                >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a3 3 0 1 0 3.99 3.98m-9.19-1.17L2 21l2.44-2.44m5.57-5.57L18 5l3 3L13.01 13.01" /></svg>
                                    Publish External
                                </button>
                                <button
                                    onClick={doDuplicate}
                                    disabled={isDuplicate}
                                    style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "7px 10px", fontSize: 12, fontWeight: 600, borderRadius: 6, background: isDuplicate ? "#f1f5f9" : "#fff", color: isDuplicate ? "#94a3b8" : "#dc2626", border: `1px solid ${isDuplicate ? "#e2e8f0" : "#dc2626"}`, cursor: isDuplicate ? "not-allowed" : "pointer" }}
                                >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                                    {isDuplicate ? "Duplicated" : "Duplicate"}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div style={{ height: 1, background: "#e2e8f0" }} />

                    {/* Metadata Grid */}
                    <div style={{ padding: "22px 32px" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "18px 28px" }}>
                            <MetaField label="Priority" value={item.priority || "\u2014"} chipColor={item.priority === "High" ? "#dc2626" : item.priority === "Medium" ? "#f59e0b" : item.priority === "Low" ? "#22c55e" : undefined} />
                            <MetaField label="Broker / Buyer" value={`${transaction.brokerName || "\u2014"} / ${transaction.sellerName || "\u2014"}`} />
                            <MetaField label="Team" value={item.team || "\u2014"} />
                            <MetaField label="Due Date" value={item.dueDate || "\u2014"} />
                            <MetaField label="Internal Owner" value={internalOwner || "\u2014"} />
                            <MetaField label="Submitted" value={submittedDate || "\u2014"} />
                            <MetaField label="Community" value={communities.slice(0, 2).join(", ") || "\u2014"} />
                            <MetaField label="Transaction" value={transaction.name || "\u2014"} />
                            <MetaField label="Request Type" value={item.category || "\u2014"} />
                        </div>
                    </div>

                    <div style={{ height: 1, background: "#e2e8f0" }} />

                    {/* Visibility Key */}
                    <div style={{ padding: "10px 32px", display: "flex", gap: 16, flexWrap: "wrap", fontSize: 11, color: "#475569", background: "#f8faff", borderBottom: "1px solid #e2e8f0" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                            <strong>Internal</strong>: Notes &amp; artifacts are internal-only until published
                        </span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a3 3 0 1 0 3.99 3.98m-9.19-1.17L2 21l2.44-2.44m5.57-5.57L18 5l3 3L13.01 13.01" /></svg>
                            <strong>External</strong>: Published documents &amp; clarifications are visible on portal
                        </span>
                    </div>

                    <div style={{ height: 1, background: "#e2e8f0" }} />

                    {/* Accordion Sections — with dividers between */}
                    <div>
                        <AccordionSection
                            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>}
                            title="Original Submission"
                            isOpen={sections.submission}
                            onToggle={() => toggleSection("submission")}
                        >
                            <p style={{ fontSize: 13, color: "#334155", lineHeight: 1.7, margin: 0 }}>{description}</p>
                            {isBulkUpload && item.fileName && (
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, padding: "10px 12px", background: "#f8faff", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 13, color: "#1e293b" }}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4338ca" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><polyline points="13 2 13 9 20 9" /></svg>
                                    <span>{item.fileName}</span>
                                    {item.rowsFound && <span style={{ color: "#475569", fontSize: 12 }}>({item.rowsFound} rows found)</span>}
                                </div>
                            )}
                        </AccordionSection>

                        <div style={{ height: 1, background: "#e2e8f0" }} />

                        <AccordionSection
                            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>}
                            title={`Documents (${documents.length})`}
                            isOpen={sections.documents}
                            onToggle={() => toggleSection("documents")}
                        >
                            {documents.length === 0 ? (
                                <div style={{ padding: "12px 0", color: "#475569", fontSize: 13 }}>No documents linked yet</div>
                            ) : (
                                <table className="rc-table">
                                    <thead><tr><th>File Name</th><th>Category</th><th>Related Request</th><th></th></tr></thead>
                                    <tbody>{documents.map(doc => (
                                        <tr key={doc.id}>
                                            <td style={{ fontWeight: 500 }}>{doc.name}</td>
                                            <td>{doc.category}</td>
                                            <td style={{ fontSize: 12, color: "#475569" }}>{doc.requestTitle || "\u2014"}</td>
                                            <td><button className="rc-btn rc-btn-ghost rc-btn-sm" style={{ fontSize: 10, color: "#2563eb" }}>Open in SP</button></td>
                                        </tr>
                                    ))}</tbody>
                                </table>
                            )}

                            {/* Work Artifacts */}
                            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #e2e8f0" }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                                    Work Artifacts ({workArtifacts.length})
                                </div>

                                {/* Drag-and-drop zone */}
                                <div
                                    onDragOver={e => e.preventDefault()}
                                    onDrop={e => {
                                        e.preventDefault();
                                        const files = Array.from(e.dataTransfer.files);
                                        const newArtifacts = files.map(f => ({
                                            id: "art-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
                                            name: f.name,
                                            size: f.size,
                                            uploadedAt: new Date().toISOString().split("T")[0],
                                        }));
                                        const updated = [...workArtifacts, ...newArtifacts];
                                        setWorkArtifacts(updated);
                                        saveWorkArtifacts(id!, updated);
                                        if (files.length > 0) {
                                            setArtifactBanner(`\u2713 ${files.length} work artifact${files.length !== 1 ? "s" : ""} uploaded`);
                                            addActivityEntry({ type: "Document", description: "Uploaded artifact" + (files.length > 1 ? "s" : "") + ": " + files.map(f => f.name).join(", "), userId: "current-user", userName: "Sarah Chen", requestId: id!, requestTitle: displayTitle || item?.category || "", transactionId: item?.transactionId || "", transactionName: item?.transactionName || item?.transactionId || "" });
                                        }
                                    }}
                                    style={{ border: "2px dashed #d1d5db", borderRadius: 8, padding: "20px 16px", textAlign: "center", cursor: "pointer", background: "#fafbfc", transition: "border-color 0.15s, background 0.15s" }}
                                    onDragEnter={e => { (e.target as HTMLElement).style.borderColor = "#2563eb"; (e.target as HTMLElement).style.background = "#eff6ff"; }}
                                    onDragLeave={e => { (e.target as HTMLElement).style.borderColor = "#d1d5db"; (e.target as HTMLElement).style.background = "#fafbfc"; }}
                                >
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 6 }}>
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                                    </svg>
                                    <div style={{ fontSize: 12, color: "#475569", fontWeight: 500 }}>Drag & drop work artifacts here</div>
                                    <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>or click to select files (internal only)</div>
                                    <input
                                        type="file"
                                        multiple
                                        style={{ display: "none" }}
                                        id="artifact-upload"
                                        onChange={e => {
                                            const files = Array.from(e.target.files || []);
                                            const newArtifacts = files.map(f => ({
                                                id: "art-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
                                                name: f.name,
                                                size: f.size,
                                                uploadedAt: new Date().toISOString().split("T")[0],
                                            }));
                                            const updated = [...workArtifacts, ...newArtifacts];
                                            setWorkArtifacts(updated);
                                            saveWorkArtifacts(id!, updated);
                                            if (files.length > 0) {
                                                setArtifactBanner(`\u2713 ${files.length} work artifact${files.length !== 1 ? "s" : ""} uploaded`);
                                                addActivityEntry({ type: "Document", description: "Uploaded artifact" + (files.length > 1 ? "s" : "") + ": " + files.map(f => f.name).join(", "), userId: "current-user", userName: "Sarah Chen", requestId: id!, requestTitle: displayTitle || item?.category || "", transactionId: item?.transactionId || "", transactionName: item?.transactionName || item?.transactionId || "" });
                                            }
                                            e.target.value = "";
                                        }}
                                    />
                                    </div>

                                {artifactBanner && (
                                    <div style={{ padding: "6px 10px", marginTop: 6, borderRadius: 6, background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
                                        <span style={{ flex: 1 }}>{artifactBanner}</span>
                                        <button style={{ background: "none", border: "none", color: "#166534", cursor: "pointer", fontSize: 14, fontWeight: 700, padding: 0, lineHeight: 1 }} onClick={() => setArtifactBanner(null)}>&times;</button>
                                    </div>
                                )}

                                {/* Artifact list */}
                                {workArtifacts.length > 0 && (
                                    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
                                        {workArtifacts.map(art => (
                                            <div key={art.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "#f8faff", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 12, color: "#1e293b" }}>
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><polyline points="13 2 13 9 20 9" /></svg>
                                                <span style={{ flex: 1, fontWeight: 500 }}>{art.name}</span>
                                                <span style={{ color: "#475569", fontSize: 11 }}>{(art.size / 1024).toFixed(0)} KB</span>
                                                <span style={{ color: "#475569", fontSize: 11 }}>{art.uploadedAt}</span>
                                                <button
                                                    onClick={() => { removeWorkArtifact(id!, art.id); setWorkArtifacts(prev => prev.filter(a => a.id !== art.id)); }}
                                                    style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: "2px 4px" }}
                                                    title="Remove artifact"
                                                >&times;</button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div style={{ marginTop: 8, fontSize: 11, color: "#475569", fontStyle: "italic", display: "flex", alignItems: "center", gap: 6 }}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
                                    Internal artifacts stay internal until published to the external portal.
                                </div>
                            </div>
                        </AccordionSection>

                        <div style={{ height: 1, background: "#e2e8f0" }} />

                        <AccordionSection
                            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>}
                            title={`Conversation (${localQuestions.length})`}
                            isOpen={sections.conversation}
                            onToggle={() => toggleSection("conversation")}
                        >
                            {localQuestions.length === 0 ? (
                                <div style={{ padding: "12px 0", color: "#475569", fontSize: 13 }}>No conversation entries yet</div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column" }}>
                                    {localQuestions.map(q => {
                                        const isInternal = q.from.toLowerCase().includes("internal");
                                        const initials = q.from.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
                                        const bgColor = isInternal ? "#dbeafe" : "#f1f5f9";
                                        const textColor = isInternal ? "#1d4ed8" : "#475569";
                                        return (
                                            <div key={q.id} style={{
                                                padding: "14px 0",
                                                borderBottom: "1px solid #f1f5f9",
                                                display: "flex",
                                                gap: 10,
                                            }}>
                                                <span style={{ width: 28, height: 28, borderRadius: "50%", background: bgColor, color: textColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>{initials}</span>
                                                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
                                                        <span style={{ fontWeight: 700, color: "#0f172a", fontSize: 12 }}>{q.from}</span>
                                                        <span style={{
                                                            display: "inline-block", fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 3,
                                                            background: q.status === "Answered" ? "#f0fdf4" : "#fffbeb",
                                                            color: q.status === "Answered" ? "#166534" : "#92400e",
                                                            lineHeight: "14px",
                                                        }}>
                                                            {q.status}
                                                        </span>
                                                        <span style={{ color: "#475569", marginLeft: "auto", fontSize: 11 }}>{q.timestamp}</span>
                                                    </div>
                                                    <div style={{ fontSize: 13, color: "#1e293b", lineHeight: 1.5 }}>{q.question}</div>
                                                    {q.response && (
                                                        <div style={{
                                                            marginTop: 2, padding: "8px 12px", background: "#f8faff", border: "1px solid #dbeafe", borderRadius: 6, fontSize: 13, color: "#1e293b", lineHeight: 1.5,
                                                        }}>
                                                            <span style={{ fontWeight: 600, color: "#1d4ed8", fontSize: 11, display: "block", marginBottom: 2 }}>Response:</span>
                                                            {q.response}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Comment Input */}
                            <div style={{ padding: "12px 0 0", borderTop: "1px solid #e2e8f0", marginTop: 4, display: "flex", gap: 8, alignItems: "flex-start" }}>
                                <span style={{ width: 28, height: 28, borderRadius: "50%", background: "#dbeafe", color: "#1d4ed8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>SC</span>
                                <textarea
                                    value={commentText}
                                    onChange={e => setCommentText(e.target.value)}
                                    placeholder="Type internal note or add comment..."
                                    rows={2}
                                    style={{ flex: 1, padding: "8px 10px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 6, resize: "vertical", fontFamily: "inherit", lineHeight: 1.4, outline: "none", minHeight: 36 }}
                                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitComment(); } }}
                                />
                                <button
                                    onClick={submitComment}
                                    disabled={!commentText.trim()}
                                    className="rc-btn rc-btn-primary rc-btn-sm"
                                    style={{ padding: "7px 14px", alignSelf: "flex-end", whiteSpace: "nowrap" }}
                                >
                                    Add Note
                                </button>
                            </div>
                        </AccordionSection>

                        <div style={{ height: 1, background: "#e2e8f0" }} />

                        <AccordionSection
                            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>}
                            title={`Completion Summary${completionSummary ? "" : " (not yet completed)"}`}
                            isOpen={sections.completionSummary}
                            onToggle={() => toggleSection("completionSummary")}
                        >
                            {completionSummary ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                                        <div>
                                            <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 2 }}>Completed By</div>
                                            <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{completionSummary.completedBy}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 2 }}>Completed Date</div>
                                            <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{completionSummary.completedDate}</div>
                                        </div>
                                    </div>
                                    {completionSummary.completionNotes && (
                                        <div>
                                            <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 2 }}>Completion Notes</div>
                                            <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.6, padding: "8px 12px", background: "#f8faff", border: "1px solid #dbeafe", borderRadius: 6 }}>{completionSummary.completionNotes}</div>
                                        </div>
                                    )}
                                    {completionSummary.supportingArtifacts.length > 0 && (
                                        <div>
                                            <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 2 }}>Supporting Artifacts</div>
                                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                                {completionSummary.supportingArtifacts.map((name, i) => (
                                                    <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 4, fontSize: 11, color: "#475569" }}>
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><polyline points="13 2 13 9 20 9" /></svg>
                                                        {name}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div style={{ padding: "12px 0", color: "#475569", fontSize: 13, display: "flex", flexDirection: "column", gap: 6 }}>
                                    <span>This work item has not been marked as Complete yet.</span>
                                    <span style={{ fontSize: 12 }}>Change the status to "Complete" to record your completion summary.</span>
                                </div>
                            )}
                        </AccordionSection>
                    </div>
                </div>
            </div>

            {/* Need Clarification Modal */}
            {needClarificationOpen && (
                <div className="rc-modal-overlay" onClick={() => { setNeedClarificationOpen(false); setClarificationText(""); }}>
                    <div className="rc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
                        <div className="rc-modal-header">
                            <h2>Need Clarification</h2>
                            <button className="rc-modal-close" onClick={() => { setNeedClarificationOpen(false); setClarificationText(""); }}>&times;</button>
                        </div>
                        <div className="rc-modal-body" style={{ padding: "16px 20px" }}>
                            <div style={{ fontSize: 12, color: "#334155", marginBottom: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                                <div><span style={{ fontWeight: 700, color: "#0f172a", textTransform: "uppercase", fontSize: 10, letterSpacing: "0.03em", marginRight: 6 }}>Request ID</span> {displayId}</div>
                                <div><span style={{ fontWeight: 700, color: "#0f172a", textTransform: "uppercase", fontSize: 10, letterSpacing: "0.03em", marginRight: 6 }}>Deliverable</span> {displayTitle || item.category || "\u2014"}</div>
                                <div><span style={{ fontWeight: 700, color: "#0f172a", textTransform: "uppercase", fontSize: 10, letterSpacing: "0.03em", marginRight: 6 }}>Asked by</span> Sarah Chen</div>
                            </div>
                            <label style={{ fontSize: 11, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 6, display: "block" }}>Clarification Question</label>
                            <textarea
                                value={clarificationText}
                                onChange={e => setClarificationText(e.target.value)}
                                placeholder="What needs clarification?"
                                rows={4}
                                style={{ width: "100%", padding: "8px 10px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 6, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", outline: "none", color: "#0f172a" }}
                            />
                        </div>
                        <div className="rc-modal-footer">
                            <button className="rc-btn rc-btn-ghost" onClick={() => { setNeedClarificationOpen(false); setClarificationText(""); }}>Cancel</button>
                            <button className="rc-btn rc-btn-primary" disabled={!clarificationText.trim()} onClick={submitClarification}>Send Clarification</button>
                        </div>
                    </div>
                </div>
            )}

            {statusActionModal && (
                <div className="rc-modal-overlay" onClick={() => setStatusActionModal(null)}>
                    <div className="rc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
                        <div className="rc-modal-header">
                            <h2>{statusActionModal.newStatus}</h2>
                            <button className="rc-modal-close" onClick={() => setStatusActionModal(null)}>&times;</button>
                        </div>
                        <div className="rc-modal-body" style={{ padding: "16px 20px" }}>
                            <div style={{ fontSize: 12, color: "#334155", marginBottom: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                                <div><span style={{ fontWeight: 700, color: "#0f172a", textTransform: "uppercase", fontSize: 10, letterSpacing: "0.03em", marginRight: 6 }}>Request ID</span> {displayId}</div>
                                <div><span style={{ fontWeight: 700, color: "#0f172a", textTransform: "uppercase", fontSize: 10, letterSpacing: "0.03em", marginRight: 6 }}>Deliverable</span> {displayTitle || item.category || "\u2014"}</div>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, fontSize: 12, fontWeight: 500, color: "#991b1b" }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                                    {statusActionModal.newStatus === "Blocked" && "This will move the request to DD Operations \u2192 Needs DD Review for review."}
                                    {statusActionModal.newStatus === "Duplicate" && "This will move the request to DD Operations \u2192 Needs DD Review for duplicate review."}
                                    {statusActionModal.newStatus === "Not Applicable" && "This will move the request to DD Operations \u2192 Needs DD Review for disposition."}
                                </div>
                            </div>
                            <label style={{ fontSize: 11, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 6, display: "block" }}>Reason <span style={{ color: "#dc2626" }}>*</span></label>
                            <textarea
                                value={statusActionModal.reason}
                                onChange={e => setStatusActionModal(prev => prev ? { ...prev, reason: e.target.value } : null)}
                                placeholder={"Explain why this item is " + statusActionModal.newStatus.toLowerCase() + "..."}
                                rows={3}
                                style={{ width: "100%", padding: "8px 10px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 6, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", outline: "none", color: "#0f172a" }}
                            />
                        </div>
                        <div className="rc-modal-footer">
                            <button className="rc-btn rc-btn-ghost" onClick={() => setStatusActionModal(null)}>Cancel</button>
                            <button className="rc-btn rc-btn-primary" disabled={!statusActionModal.reason.trim()} onClick={() => {
                                if (!statusActionModal) return;
                                const reason = statusActionModal.reason.trim();
                                if (!reason) return;
                                const reqId = item.id || item.intakeId || "";
                                updateRequestStatus(reqId, statusActionModal.newStatus);
                                addActivityEntry({
                                    type: "Status Change",
                                    description: `${displayId}: ${statusActionModal.newStatus}. Reason: ${reason}`,
                                    userId: "current-user",
                                    userName: "Sarah Chen",
                                    requestId: item.requestId || item.id,
                                    requestTitle: displayTitle || item.category || "",
                                    transactionId: item.transactionId,
                                    transactionName: item.transactionName || item.transactionId,
                                });
                                setWsRefreshKey(k => k + 1);
                                setBanner(`${displayId} moved to DD Operations \u2192 Needs DD Review.`);
                                setBannerError(false);
                                setStatusActionModal(null);
                            }}>Confirm</button>
                        </div>
                    </div>
                </div>
            )}

            {completionModal && (
                <div className="rc-modal-overlay" onClick={() => setCompletionModal(null)}>
                    <div className="rc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
                        <div className="rc-modal-header">
                            <h2>Complete Work</h2>
                            <button className="rc-modal-close" onClick={() => setCompletionModal(null)}>&times;</button>
                        </div>
                        <div className="rc-modal-body" style={{ padding: "16px 20px" }}>
                            <div style={{ fontSize: 12, color: "#334155", marginBottom: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                                <div><span style={{ fontWeight: 700, color: "#0f172a", textTransform: "uppercase", fontSize: 10, letterSpacing: "0.03em", marginRight: 6 }}>Request ID</span> {displayId}</div>
                                <div><span style={{ fontWeight: 700, color: "#0f172a", textTransform: "uppercase", fontSize: 10, letterSpacing: "0.03em", marginRight: 6 }}>Deliverable</span> {displayTitle || item.category || "\u2014"}</div>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 6, fontSize: 12, fontWeight: 600, color: "#166534" }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
                                    Moving to Complete
                                </div>
                                {workArtifacts.length === 0 && (
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, fontSize: 12, fontWeight: 500, color: "#991b1b" }}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                                        No artifact is attached to this request. Marking complete will send it to DD Review without supporting documentation.
                                    </div>
                                )}
                            </div>
                            <label style={{ fontSize: 11, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 6, display: "block" }}>Completion Notes</label>
                            <textarea
                                value={completionModal.note}
                                onChange={e => setCompletionModal(prev => prev ? { ...prev, note: e.target.value } : null)}
                                placeholder="Describe what was completed or any follow-up items..."
                                rows={4}
                                style={{ width: "100%", padding: "8px 10px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 6, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", outline: "none", color: "#0f172a" }}
                            />
                            <div style={{ fontSize: 11, color: "#475569", fontStyle: "italic", display: "flex", alignItems: "center", gap: 6 }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
                                Completion notes are saved in the Completion Summary section below.
                            </div>
                        </div>
                        <div className="rc-modal-footer">
                            <button className="rc-btn rc-btn-ghost" onClick={() => setCompletionModal(null)}>Cancel</button>
                            <button className="rc-btn rc-btn-primary" onClick={() => {
                                if (!completionModal) return;
                                const note = completionModal.note.trim();
                                const now = new Date().toISOString().split("T")[0];
                                const reqId = item.id || item.intakeId || "";
                                updateRequestCompletion(reqId, {
                                    completedBy: "Sarah Chen",
                                    completedAt: now,
                                    completionNotes: note,
                                });
                                addActivityEntry({
                                    type: "Status Change",
                                    description: `Marked as Complete. Notes: ${note || "none provided"}`,
                                    userId: "current-user",
                                    userName: "Sarah Chen",
                                    requestId: item.requestId || item.id,
                                    requestTitle: displayTitle || item.category || "",
                                    transactionId: item.transactionId,
                                    transactionName: item.transactionName || item.transactionId,
                                });
                                setWsRefreshKey(k => k + 1);
                                setBanner("\u2713 Work completed and recorded");
                                setBannerError(false);
                                setCompletionModal(null);
                            }}>Submit Completion</button>
                        </div>
                    </div>
                </div>
            )}

            {publishExternal && (
                <div className="rc-modal-overlay" onClick={() => { if (publishExternal.step < 3) setPublishExternal(null); }}>
                    <div className="rc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
                        <div className="rc-modal-header">
                            <h2>
                                {publishExternal.step === 1 && "Publish to External Portal"}
                                {publishExternal.step === 2 && "Confirm External Publication"}
                                {publishExternal.step === 3 && "Published Externally"}
                            </h2>
                            <button className="rc-modal-close" onClick={() => setPublishExternal(null)}>&times;</button>
                        </div>
                        <div className="rc-modal-body" style={{ padding: "16px 20px" }}>
                            {/* Step indicator */}
                            <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
                                {[1, 2, 3].map(s => (
                                    <div key={s} style={{ flex: 1, height: 3, borderRadius: 2, background: s <= publishExternal.step ? "#1d4ed8" : "#e2e8f0", transition: "background 0.2s" }} />
                                ))}
                            </div>
                            <div style={{ fontSize: 11, color: "#475569", marginBottom: 12, fontWeight: 600 }}>Step {publishExternal.step} of 3</div>

                            {publishExternal.step === 1 && (
                                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", marginBottom: 4 }}>Review Details</div>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                        <div>
                                            <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 2 }}>Request ID</div>
                                            <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{displayId}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 2 }}>Intake ID</div>
                                            <div style={{ fontSize: 13, color: "#334155" }}>{item.intakeId || "\u2014"}</div>
                                        </div>
                                        <div style={{ gridColumn: "1 / -1" }}>
                                            <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 2 }}>Deliverable</div>
                                            <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{displayTitle || item.category || "\u2014"}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 2 }}>Completed By</div>
                                            <div style={{ fontSize: 13, color: "#334155" }}>{completionSummary?.completedBy || internalOwner || "\u2014"}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 2 }}>Completed Date</div>
                                            <div style={{ fontSize: 13, color: "#334155" }}>{completionSummary?.completedDate || "\u2014"}</div>
                                        </div>
                                    </div>
                                    {completionSummary?.completionNotes && (
                                        <div style={{ padding: "8px 12px", background: "#f8faff", border: "1px solid #dbeafe", borderRadius: 6 }}>
                                            <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 2 }}>Completion Summary</div>
                                            <div style={{ fontSize: 12, color: "#334155", lineHeight: 1.5 }}>{completionSummary.completionNotes}</div>
                                        </div>
                                    )}
                                    {workArtifacts.length > 0 ? (
                                        <div>
                                            <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 4 }}>Work Artifacts</div>
                                            {workArtifacts.map(art => (
                                                <label key={art.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", fontSize: 12, color: "#1e293b", cursor: "pointer" }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={publishExternal.selectedArtifacts.includes(art.name)}
                                                        onChange={e => {
                                                            if (e.target.checked) {
                                                                setPublishExternal(prev => prev ? { ...prev, selectedArtifacts: [...prev.selectedArtifacts, art.name] } : null);
                                                            } else {
                                                                setPublishExternal(prev => prev ? { ...prev, selectedArtifacts: prev.selectedArtifacts.filter(n => n !== art.name) } : null);
                                                            }
                                                        }}
                                                    />
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><polyline points="13 2 13 9 20 9" /></svg>
                                                    <span>{art.name}</span>
                                                </label>
                                            ))}
                                        </div>
                                    ) : (
                                        <div style={{ padding: "8px 12px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 6, fontSize: 12, color: "#92400e" }}>
                                            <strong>Warning:</strong> No artifacts are attached to this request. Publishing with no supporting documents will share minimal information.
                                        </div>
                                    )}
                                    <div style={{ padding: "8px 12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, fontSize: 12, color: "#991b1b", display: "flex", alignItems: "center", gap: 6 }}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                                        You are about to make this request and selected documents visible to the external broker/buyer portal.
                                    </div>
                                </div>
                            )}

                            {publishExternal.step === 2 && (
                                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>Confirm External Publication</div>
                                    <div style={{ padding: "8px 12px", background: "#f8faff", border: "1px solid #dbeafe", borderRadius: 6 }}>
                                        <div style={{ fontSize: 11, color: "#475569", marginBottom: 4 }}><strong>Request ID:</strong> {displayId}</div>
                                        <div style={{ fontSize: 11, color: "#475569", marginBottom: 4 }}><strong>Deliverable:</strong> {displayTitle || item.category || "\u2014"}</div>
                                        {publishExternal.selectedArtifacts.length > 0 && (
                                            <div style={{ fontSize: 11, color: "#475569" }}><strong>Documents ({publishExternal.selectedArtifacts.length}):</strong> {publishExternal.selectedArtifacts.join(", ")}</div>
                                        )}
                                    </div>
                                    <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.5 }}>
                                        Please confirm you want to publish these materials externally.
                                    </div>
                                </div>
                            )}

                            {publishExternal.step === 3 && (
                                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center", textAlign: "center", padding: "8px 0" }}>
                                        <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#166534" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
                                        </div>
                                        <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>Published Externally</div>
                                        <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.5, maxWidth: 380 }}>
                                            {displayId} &mdash; {displayTitle || item.category || "Item"} is now visible to the external portal.
                                        </div>
                                        {publishExternal.selectedArtifacts.length > 0 && (
                                            <div style={{ fontSize: 12, color: "#475569" }}>
                                                {publishExternal.selectedArtifacts.length} supporting artifact{publishExternal.selectedArtifacts.length !== 1 ? "s" : ""} published{workArtifacts.some(a => a.isPrototype) ? " (prototype metadata)" : ""}.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="rc-modal-footer">
                            {publishExternal.step < 3 && (
                                <button className="rc-btn rc-btn-ghost" onClick={() => setPublishExternal(null)}>Cancel</button>
                            )}
                            {publishExternal.step === 2 && (
                                <button className="rc-btn rc-btn-secondary" onClick={() => setPublishExternal(prev => prev ? { ...prev, step: 1 } : null)}>Back</button>
                            )}
                            {publishExternal.step === 1 && (
                                <button className="rc-btn rc-btn-primary" onClick={() => setPublishExternal(prev => prev ? { ...prev, step: 2 } : null)}>Continue</button>
                            )}
                            {publishExternal.step === 2 && (
                                <button className="rc-btn rc-btn-primary" onClick={() => {
                                    setPublishExternal(prev => prev ? { ...prev, step: 3 } : null);
                                    updateRequestExternalStatus(item.id || item.intakeId || "", workArtifacts.length === 0);
                                    const artCount = workArtifacts.length;
                                    addActivityEntry({
                                        type: "Status Change",
                                        description: `${displayId}: Published externally by Sarah Chen` + (artCount > 0 ? ` (${artCount} artifact${artCount !== 1 ? "s" : ""})` : ""),
                                        userId: "current-user",
                                        userName: "Sarah Chen",
                                        requestId: item.requestId || item.id,
                                        requestTitle: displayTitle || item.category || "",
                                        transactionId: item.transactionId,
                                        transactionName: item.transactionName || item.transactionId,
                                    });
                                }}>Confirm Publish External</button>
                            )}
                            {publishExternal.step === 3 && (
                                <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
                                    <button className="rc-btn rc-btn-primary" style={{ width: "100%" }} onClick={() => {
                                        setPublishExternal(null);
                                        setBanner("\u2713 Published externally.");
                                        setBannerError(false);
                                    }}>Done</button>
                                    <button className="rc-btn rc-btn-secondary" style={{ width: "100%" }} onClick={() => { setPublishExternal(null); navigate("/recapitalization/tracker"); }}>Return to Work Queue</button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ── Sub-components ── */

function MetaField({ label, value, chipColor }: { label: string; value: string; chipColor?: string }) {
    return (
        <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 3 }}>{label}</div>
            <div style={{ fontSize: 13, fontWeight: 500, color: "#0f172a" }}>
                {chipColor ? (
                    <span style={{ display: "inline-block", padding: "1px 8px", borderRadius: 4, fontSize: 12, fontWeight: 600, background: chipColor === "#dc2626" ? "#fef2f2" : chipColor === "#f59e0b" ? "#fffbeb" : "#f0fdf4", color: chipColor }}>
                        {value}
                    </span>
                ) : value}
            </div>
        </div>
    );
}

function AccordionSection({ icon, title, isOpen, onToggle, children }: { icon: React.ReactNode; title: string; isOpen: boolean; onToggle: () => void; children: React.ReactNode }) {
    return (
        <div>
            <div
                onClick={onToggle}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 32px", cursor: "pointer", userSelect: "none" }}
            >
                {icon}
                <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{title}</span>
                <span style={{ color: "#94a3b8", display: "flex" }}>
                    {isOpen ? <ChevronDown /> : <ChevronRight />}
                </span>
            </div>
            {isOpen && (
                <div style={{ padding: "0 32px 20px" }}>
                    {children}
                </div>
            )}
        </div>
    );
}

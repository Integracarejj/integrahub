import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { lookupWorkspaceItem, getDocumentsByTransaction, updateRequestStatus, updateRequestOwner, addActivityEntry, getCategories } from "../../services/recapDataService";
import type { RecapRequest } from "../../services/recapDataService";
import RecapSubNav from "./RecapSubNav";
import "./Recapitalization.css";

const STATUS_OPTIONS: RecapRequest["status"][] = ["Open", "In Progress", "Blocked", "Complete", "Not Applicable", "Duplicate"];

const TEAM_MEMBERS = ["Sarah Chen", "James Wright", "Lisa Park", "Tom Davies", "Mike O'Brien", "Anna Patel", "David Park", "Carlos Rivera"];

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

    const [completionModal, setCompletionModal] = useState<{ note: string; readyForReview: boolean } | null>(null);
    const [workArtifacts, setWorkArtifacts] = useState<{ id: string; name: string; size: number; uploadedAt: string }[]>([]);
    const [completionSummary, setCompletionSummary] = useState<{ completedBy: string; completedDate: string; completionNotes: string; supportingArtifacts: string[]; reviewer: string } | null>(null);
    const [publishWizard, setPublishWizard] = useState<{ step: number; publishExternal: boolean; promoteToLibrary: boolean; ddCategory: string } | null>(null);

    const backFrom = (location.state as any)?.from || "tracker";
    const backLabel = backFrom === "my-work" ? "Back to My Work" : "Back to Work Queue";
    const backPath = backFrom === "my-work" ? "/recapitalization/my-work" : "/recapitalization/tracker";

    if (!result) {
        return (
            <div className="rc-page">
                <RecapSubNav />
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "80px 20px", gap: 12, textAlign: "center" }}>
                    <h2 style={{ fontSize: 20, color: "#0f172a", margin: 0 }}>Item Not Found</h2>
                    <p style={{ fontSize: 14, color: "#64748b" }}>The requested workspace item could not be found.</p>
                    <button className="rc-btn rc-btn-primary" onClick={() => navigate("/recapitalization/intake")}>Back to Intake Queue</button>
                </div>
            </div>
        );
    }

    const { transaction } = result;
    const item = result.item as any;

    const displayId = item.intakeId || item.requestId || item.id;
    const displayTitle = item.title || item.fileName || "";
    const displayStatus = item.status;
    const communities = item.communityNames || [];
    const description = item.description || "";
    const submittedDate = item.submittedAt ? new Date(item.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : item.createdDate || "";

    const isBulkUpload = item.type === "Broker Upload";
    const isDuplicate = displayStatus === "Duplicate";
    const statusColor = STATUS_COLORS[displayStatus] || "#64748b";

    const documents = useMemo(() => getDocumentsByTransaction(item.transactionId), [item.transactionId]);

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
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
                                    {communities.slice(0, 2).join(", ") || "\u2014"}
                                </span>
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
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
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                                                <span style={{ color: "#64748b" }}>Unassigned</span>
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
                                    onClick={() => setPublishWizard({ step: 1, publishExternal: false, promoteToLibrary: false, ddCategory: "" })}
                                    disabled={displayStatus !== "Complete"}
                                    title={displayStatus !== "Complete" ? "Publishing requires Complete status" : "Publish this deliverable"}
                                    style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "7px 10px", fontSize: 12, fontWeight: 600, borderRadius: 6, background: displayStatus === "Complete" ? "#1d4ed8" : "#f1f5f9", color: displayStatus === "Complete" ? "#fff" : "#94a3b8", border: "none", cursor: displayStatus === "Complete" ? "pointer" : "not-allowed" }}
                                >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a3 3 0 1 0 3.99 3.98m-9.19-1.17L2 21l2.44-2.44m5.57-5.57L18 5l3 3L13.01 13.01" /></svg>
                                    Publish
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
                    <div style={{ padding: "10px 32px", display: "flex", gap: 16, flexWrap: "wrap", fontSize: 11, color: "#64748b", background: "#f8faff", borderBottom: "1px solid #e2e8f0" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                            <strong>Internal</strong>: Notes &amp; artifacts are internal-only until published
                        </span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a3 3 0 1 0 3.99 3.98m-9.19-1.17L2 21l2.44-2.44m5.57-5.57L18 5l3 3L13.01 13.01" /></svg>
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
                                    {item.rowsFound && <span style={{ color: "#64748b", fontSize: 12 }}>({item.rowsFound} rows found)</span>}
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
                                <div style={{ padding: "12px 0", color: "#64748b", fontSize: 13 }}>No documents linked yet</div>
                            ) : (
                                <table className="rc-table">
                                    <thead><tr><th>File Name</th><th>Category</th><th>Related Request</th><th></th></tr></thead>
                                    <tbody>{documents.map(doc => (
                                        <tr key={doc.id}>
                                            <td style={{ fontWeight: 500 }}>{doc.name}</td>
                                            <td>{doc.category}</td>
                                            <td style={{ fontSize: 12, color: "#64748b" }}>{doc.requestTitle || "\u2014"}</td>
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
                                        setWorkArtifacts(prev => [...prev, ...newArtifacts]);
                                        if (files.length > 0) {
                                            setBanner(`\u2713 ${files.length} work artifact${files.length !== 1 ? "s" : ""} uploaded`);
                                            setBannerError(false);
                                        }
                                    }}
                                    style={{ border: "2px dashed #d1d5db", borderRadius: 8, padding: "20px 16px", textAlign: "center", cursor: "pointer", background: "#fafbfc", transition: "border-color 0.15s, background 0.15s" }}
                                    onDragEnter={e => { (e.target as HTMLElement).style.borderColor = "#2563eb"; (e.target as HTMLElement).style.background = "#eff6ff"; }}
                                    onDragLeave={e => { (e.target as HTMLElement).style.borderColor = "#d1d5db"; (e.target as HTMLElement).style.background = "#fafbfc"; }}
                                >
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 6 }}>
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                                    </svg>
                                    <div style={{ fontSize: 12, color: "#475569", fontWeight: 500 }}>Drag & drop work artifacts here</div>
                                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>or click to select files (internal only)</div>
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
                                            setWorkArtifacts(prev => [...prev, ...newArtifacts]);
                                            if (files.length > 0) {
                                                setBanner(`\u2713 ${files.length} work artifact${files.length !== 1 ? "s" : ""} uploaded`);
                                                setBannerError(false);
                                            }
                                            e.target.value = "";
                                        }}
                                    />
                                </div>

                                {/* Artifact list */}
                                {workArtifacts.length > 0 && (
                                    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
                                        {workArtifacts.map(art => (
                                            <div key={art.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "#f8faff", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 12, color: "#1e293b" }}>
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><polyline points="13 2 13 9 20 9" /></svg>
                                                <span style={{ flex: 1, fontWeight: 500 }}>{art.name}</span>
                                                <span style={{ color: "#94a3b8", fontSize: 11 }}>{(art.size / 1024).toFixed(0)} KB</span>
                                                <span style={{ color: "#94a3b8", fontSize: 11 }}>{art.uploadedAt}</span>
                                                <button
                                                    onClick={() => setWorkArtifacts(prev => prev.filter(a => a.id !== art.id))}
                                                    style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: "2px 4px" }}
                                                    title="Remove artifact"
                                                >&times;</button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div style={{ marginTop: 8, fontSize: 11, color: "#64748b", fontStyle: "italic", display: "flex", alignItems: "center", gap: 6 }}>
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
                                <div style={{ padding: "12px 0", color: "#64748b", fontSize: 13 }}>No conversation entries yet</div>
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
                                                        <span style={{ color: "#94a3b8", marginLeft: "auto", fontSize: 11 }}>{q.timestamp}</span>
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
                                <div style={{ padding: "12px 0", color: "#64748b", fontSize: 13, display: "flex", flexDirection: "column", gap: 6 }}>
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
                            </div>
                            <label style={{ fontSize: 11, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 6, display: "block" }}>Completion Notes</label>
                            <textarea
                                value={completionModal.note}
                                onChange={e => setCompletionModal(prev => prev ? { ...prev, note: e.target.value } : null)}
                                placeholder="Describe what was completed or any follow-up items..."
                                rows={4}
                                style={{ width: "100%", padding: "8px 10px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 6, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", outline: "none", color: "#0f172a" }}
                            />
                            <div style={{ fontSize: 11, color: "#64748b", fontStyle: "italic", display: "flex", alignItems: "center", gap: 6 }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
                                Completion notes are saved in the Completion Summary section below.
                            </div>
                        </div>
                        <div className="rc-modal-footer">
                            <button className="rc-btn rc-btn-ghost" onClick={() => setCompletionModal(null)}>Cancel</button>
                            <button className="rc-btn rc-btn-primary" onClick={() => {
                                if (!completionModal) return;
                                const note = completionModal.note.trim();
                                setCompletionSummary({
                                    completedBy: "Sarah Chen",
                                    completedDate: new Date().toISOString().split("T")[0],
                                    completionNotes: note,
                                    supportingArtifacts: workArtifacts.filter(a => a.name).map(a => a.name),
                                    reviewer: "",
                                });
                                doStatusChange("Complete");
                                setCompletionModal(null);
                            }}>Submit Completion</button>
                        </div>
                    </div>
                </div>
            )}

            {publishWizard && (
                <div className="rc-modal-overlay" onClick={() => setPublishWizard(null)}>
                    <div className="rc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 540 }}>
                        <div className="rc-modal-header">
                            <h2>
                                {publishWizard.step === 1 && "Publish: Review Details"}
                                {publishWizard.step === 2 && "Publish: External Portal"}
                                {publishWizard.step === 3 && "Publish: DD Library"}
                                {publishWizard.step === 4 && "Publish: Complete"}
                            </h2>
                            <button className="rc-modal-close" onClick={() => setPublishWizard(null)}>&times;</button>
                        </div>
                        <div className="rc-modal-body" style={{ padding: "16px 20px" }}>
                            {/* Step indicator */}
                            <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
                                {[1, 2, 3, 4].map(s => (
                                    <div key={s} style={{ flex: 1, height: 3, borderRadius: 2, background: s <= publishWizard.step ? "#1d4ed8" : "#e2e8f0", transition: "background 0.2s" }} />
                                ))}
                            </div>
                            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 12, fontWeight: 600 }}>Step {publishWizard.step} of 4</div>

                            {publishWizard.step === 1 && (
                                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", marginBottom: 4 }}>Review Request Details</div>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                        <div>
                                            <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 2 }}>Request ID</div>
                                            <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{displayId}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 2 }}>Deliverable</div>
                                            <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{displayTitle || item.category || "\u2014"}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 2 }}>Category</div>
                                            <div style={{ fontSize: 13, color: "#334155" }}>{item.category || "\u2014"}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 2 }}>Transaction</div>
                                            <div style={{ fontSize: 13, color: "#334155" }}>{transaction.name}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 2 }}>Status</div>
                                            <div style={{ fontSize: 13, fontWeight: 600, color: "#166534" }}>{displayStatus}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 2 }}>Internal Owner</div>
                                            <div style={{ fontSize: 13, color: "#334155" }}>{internalOwner || "\u2014"}</div>
                                        </div>
                                    </div>
                                    {completionSummary && (
                                        <div style={{ padding: "8px 12px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 6, fontSize: 12, color: "#166534", display: "flex", alignItems: "center", gap: 6 }}>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
                                            Work marked Complete on {completionSummary.completedDate}
                                        </div>
                                    )}
                                </div>
                            )}

                            {publishWizard.step === 2 && (
                                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>Publish to External Portal?</div>
                                    <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.5 }}>
                                        Publishing makes the deliverable and its supporting artifacts visible to external users (brokers, buyers) through the external portal. Clarifications and published documents will be shared.
                                    </div>
                                    <div style={{ display: "flex", gap: 8 }}>
                                        <button
                                            onClick={() => setPublishWizard(prev => prev ? { ...prev, publishExternal: true } : null)}
                                            style={{ flex: 1, padding: "10px 14px", fontSize: 13, fontWeight: 600, borderRadius: 8, border: publishWizard.publishExternal ? "2px solid #1d4ed8" : "1px solid #e2e8f0", background: publishWizard.publishExternal ? "#eff6ff" : "#fff", color: "#1e293b", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}
                                        >
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={publishWizard.publishExternal ? "#1d4ed8" : "#64748b"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a3 3 0 1 0 3.99 3.98m-9.19-1.17L2 21l2.44-2.44m5.57-5.57L18 5l3 3L13.01 13.01" /></svg>
                                            <span>Yes, publish externally</span>
                                            <span style={{ fontSize: 11, color: "#64748b", fontWeight: 400 }}>Visible on portal</span>
                                        </button>
                                        <button
                                            onClick={() => setPublishWizard(prev => prev ? { ...prev, publishExternal: false } : null)}
                                            style={{ flex: 1, padding: "10px 14px", fontSize: 13, fontWeight: 600, borderRadius: 8, border: !publishWizard.publishExternal ? "2px solid #1d4ed8" : "1px solid #e2e8f0", background: !publishWizard.publishExternal ? "#f1f5f9" : "#fff", color: "#1e293b", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}
                                        >
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={!publishWizard.publishExternal ? "#475569" : "#64748b"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" /><line x1="12" y1="7" x2="12" y2="17" /><polyline points="9 10 12 7 15 10" /></svg>
                                            <span>No, keep internal only</span>
                                            <span style={{ fontSize: 11, color: "#64748b", fontWeight: 400 }}>Internal team only</span>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {publishWizard.step === 3 && (
                                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>Promote to Reusable DD Library?</div>
                                    <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.5 }}>
                                        Promoting to the DD Library makes this deliverable available as a reusable resource across transactions. Select a category to organize it.
                                    </div>
                                    <div style={{ display: "flex", gap: 8 }}>
                                        <button
                                            onClick={() => setPublishWizard(prev => prev ? { ...prev, promoteToLibrary: true } : null)}
                                            style={{ flex: 1, padding: "10px 14px", fontSize: 13, fontWeight: 600, borderRadius: 8, border: publishWizard.promoteToLibrary ? "2px solid #1d4ed8" : "1px solid #e2e8f0", background: publishWizard.promoteToLibrary ? "#eff6ff" : "#fff", color: "#1e293b", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}
                                        >
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={publishWizard.promoteToLibrary ? "#1d4ed8" : "#64748b"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
                                            <span>Yes, promote to library</span>
                                            <span style={{ fontSize: 11, color: "#64748b", fontWeight: 400 }}>Make reusable</span>
                                        </button>
                                        <button
                                            onClick={() => setPublishWizard(prev => prev ? { ...prev, promoteToLibrary: false } : null)}
                                            style={{ flex: 1, padding: "10px 14px", fontSize: 13, fontWeight: 600, borderRadius: 8, border: !publishWizard.promoteToLibrary ? "2px solid #1d4ed8" : "1px solid #e2e8f0", background: !publishWizard.promoteToLibrary ? "#f1f5f9" : "#fff", color: "#1e293b", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}
                                        >
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={!publishWizard.promoteToLibrary ? "#475569" : "#64748b"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" /><line x1="12" y1="7" x2="12" y2="17" /><polyline points="9 10 12 7 15 10" /></svg>
                                            <span>No, keep as-is</span>
                                            <span style={{ fontSize: 11, color: "#64748b", fontWeight: 400 }}>Not promoted</span>
                                        </button>
                                    </div>
                                    {publishWizard.promoteToLibrary && (
                                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                            <label style={{ fontSize: 11, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.03em" }}>DD Library Category</label>
                                            <select
                                                value={publishWizard.ddCategory}
                                                onChange={e => setPublishWizard(prev => prev ? { ...prev, ddCategory: e.target.value } : null)}
                                                style={{ padding: "7px 10px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 6, color: "#0f172a", background: "#fff" }}
                                            >
                                                <option value="">Select category...</option>
                                                {getCategories().map(c => (
                                                    <option key={c.id} value={c.name}>{c.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>
                            )}

                            {publishWizard.step === 4 && (
                                <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center", textAlign: "center", padding: "12px 0" }}>
                                    <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#166534" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
                                    </div>
                                    <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>Publish Complete</div>
                                    <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.5, maxWidth: 340 }}>
                                        {publishWizard.publishExternal
                                            ? "This deliverable has been published and is now visible on the external portal."
                                            : "Publishing complete. This deliverable remains internal only."}
                                        {publishWizard.promoteToLibrary && " It has also been promoted to the DD Library."}
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 4, width: "100%", textAlign: "left", padding: "8px 12px", background: "#f8faff", border: "1px solid #dbeafe", borderRadius: 6, fontSize: 12, color: "#334155" }}>
                                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                                            <span style={{ color: "#475569" }}>External Portal</span>
                                            <span style={{ fontWeight: 600 }}>{publishWizard.publishExternal ? "Published" : "Not published"}</span>
                                        </div>
                                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                                            <span style={{ color: "#475569" }}>DD Library</span>
                                            <span style={{ fontWeight: 600 }}>{publishWizard.promoteToLibrary ? `Promoted (${publishWizard.ddCategory})` : "Not promoted"}</span>
                                        </div>
                                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                                            <span style={{ color: "#475569" }}>Published By</span>
                                            <span style={{ fontWeight: 600 }}>Sarah Chen</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="rc-modal-footer">
                            {publishWizard.step < 4 && (
                                <button className="rc-btn rc-btn-ghost" onClick={() => setPublishWizard(null)}>Cancel</button>
                            )}
                            {publishWizard.step > 1 && publishWizard.step < 4 && (
                                <button className="rc-btn rc-btn-secondary" onClick={() => setPublishWizard(prev => prev ? { ...prev, step: prev.step - 1 } : null)}>Back</button>
                            )}
                            {publishWizard.step < 4 ? (
                                <button
                                    className="rc-btn rc-btn-primary"
                                    disabled={publishWizard.step === 3 && publishWizard.promoteToLibrary && !publishWizard.ddCategory}
                                    onClick={() => setPublishWizard(prev => prev ? { ...prev, step: prev.step + 1 } : null)}
                                >
                                    {publishWizard.step === 1 ? "Continue" : publishWizard.step === 2 ? "Continue" : "Publish"}
                                </button>
                            ) : (
                                <button className="rc-btn rc-btn-primary" onClick={() => {
                                    setPublishWizard(null);
                                    setBanner("\u2713 Published successfully");
                                    setBannerError(false);
                                }}>Done</button>
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

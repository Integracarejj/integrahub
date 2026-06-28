import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { lookupWorkspaceItem, getDocumentsByTransaction, updateRequestStatus, updateRequestOwner, addActivityEntry } from "../../services/recapDataService";
import type { RecapRequest } from "../../services/recapDataService";
import RecapSubNav from "./RecapSubNav";
import "./Recapitalization.css";

const STATUS_OPTIONS: RecapRequest["status"][] = ["Open", "In Progress", "Pending External", "Blocked", "Ready for Review", "Complete", "Not Applicable", "Duplicate"];

const TEAM_MEMBERS = ["Sarah Chen", "James Wright", "Lisa Park", "Tom Davies", "Mike O'Brien", "Anna Patel", "David Park", "Carlos Rivera"];

const STATUS_COLORS: Record<string, string> = {
    "Open": "#2563eb",
    "In Progress": "#f59e0b",
    "Pending External": "#f97316",
    "Blocked": "#dc2626",
    "Ready for Review": "#8b5cf6",
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
        if (displayStatus !== "Pending External" && displayStatus !== "Blocked") {
            doStatusChange("Pending External");
        }
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
                    <button onClick={() => navigate("/recapitalization/tracker")} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "#2563eb", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
                        Back to Request Tracker
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
                                        onChange={e => doStatusChange(e.target.value as RecapRequest["status"])}
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

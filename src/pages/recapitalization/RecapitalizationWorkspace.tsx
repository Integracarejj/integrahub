import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { lookupWorkspaceItem, getDocumentsByTransaction, getActivityByTransaction, getTeamMembers, getTeams, bulkUpdateDemoRequests, updateRequestStatus } from "../../services/recapDataService";
import type { RecapTeamMember } from "../../services/recapDataService";
import RecapSubNav from "./RecapSubNav";
import "./Recapitalization.css";

const SOURCE_CONFIG: Record<string, { icon: string; label: string; cssClass: string }> = {
    "Broker Upload": { icon: "\u{1F4E4}", label: "Broker Upload", cssClass: "rc-badge-import" },
    "External Question": { icon: "\u2753}", label: "Question", cssClass: "rc-badge-external-question" },
    "External Clarification": { icon: "\u2757", label: "Clarification", cssClass: "rc-badge-external-clarification" },
    "External New Request": { icon: "\u2795", label: "New Request", cssClass: "rc-badge-external-request" },
    "Access Request": { icon: "\u{1F512}", label: "Access Request", cssClass: "rc-badge-access" },
    "Manual Internal Request": { icon: "\u{1F4CB}", label: "Internal Request", cssClass: "rc-badge-internal" },
};

function readinessScore(item: { status: string; assignedTo?: string | null; owner?: string | null }): { score: number; label: string; factors: { label: string; met: boolean }[] } {
    const isAssigned = !!(item.assignedTo || item.owner);
    const isInProgress = item.status === "In Progress" || item.status === "Assigned";
    const isProvided = item.status === "Provided" || item.status === "Converted" || item.status === "Under Review";
    const factors = [
        { label: "Internal Owner assigned", met: isAssigned },
        { label: "Documents linked", met: isProvided || isInProgress },
        { label: "Clarifications resolved", met: isProvided || isInProgress },
        { label: "External note ready", met: isProvided },
        { label: "DD lead reviewed", met: isProvided },
    ];
    const met = factors.filter(f => f.met).length;
    const score = Math.round((met / factors.length) * 100);
    const label = score >= 80 ? "Well prepared" : score >= 40 ? "Partially ready" : "Needs attention";
    return { score, label, factors };
}

function NoteInput({ onAdd }: { onAdd: (text: string) => void }) {
    const [text, setText] = useState("");
    return (
        <div className="rc-note-input">
            <textarea placeholder="Add a note..." value={text} onChange={e => setText(e.target.value)} />
            <button className="rc-btn rc-btn-primary rc-btn-sm" onClick={() => { if (text.trim()) { onAdd(text.trim()); setText(""); } }} style={{ alignSelf: "flex-end" }}>Add Note</button>
        </div>
    );
}

function AssignUserModal({ onClose, onAssign }: { onClose: () => void; onAssign: (user: RecapTeamMember) => void }) {
    const members = getTeamMembers();
    const [search, setSearch] = useState("");
    const filtered = search.trim()
        ? members.filter(m => m.name.toLowerCase().includes(search.toLowerCase()) || m.email.toLowerCase().includes(search.toLowerCase()) || m.team.toLowerCase().includes(search.toLowerCase()))
        : members;

    return (
        <div className="rc-modal-overlay" onClick={onClose}>
            <div className="rc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
                <div className="rc-modal-header">
                    <h2>Assign User</h2>
                    <button className="rc-modal-close" onClick={onClose}>&times;</button>
                </div>
                <div className="rc-modal-body" style={{ padding: "12px 16px" }}>
                    <input type="text" placeholder="Search by name, email, or team..." value={search} onChange={e => setSearch(e.target.value)}
                        style={{ width: "100%", padding: "6px 10px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 4, marginBottom: 8, boxSizing: "border-box" }} />
                    <div style={{ maxHeight: 240, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
                        {filtered.map(m => (
                            <div key={m.id} className="rc-row-clickable" style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 4 }} onClick={() => onAssign(m)}>
                                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#e0e7ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#4338ca", flexShrink: 0 }}>
                                    {m.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a" }}>{m.name}</div>
                                    <div style={{ fontSize: 11, color: "#64748b" }}>{m.email} &middot; {m.team}</div>
                                </div>
                            </div>
                        ))}
                        {filtered.length === 0 && <div style={{ fontSize: 12, color: "#94a3b8", textAlign: "center", padding: 12 }}>No matching users found.</div>}
                    </div>
                </div>
                <div className="rc-modal-footer">
                    <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={onClose}>Cancel</button>
                </div>
            </div>
        </div>
    );
}

function RouteToTeamModal({ onClose, onRoute }: { onClose: () => void; onRoute: (team: string) => void }) {
    const teams = getTeams();
    const [selectedTeam, setSelectedTeam] = useState("");

    return (
        <div className="rc-modal-overlay" onClick={onClose}>
            <div className="rc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
                <div className="rc-modal-header">
                    <h2>Route to Team</h2>
                    <button className="rc-modal-close" onClick={onClose}>&times;</button>
                </div>
                <div className="rc-modal-body" style={{ padding: "12px 16px" }}>
                    <p style={{ fontSize: 12, color: "#475569", margin: "0 0 12px" }}>
                        Select a team to route this request to.
                    </p>
                    <select value={selectedTeam} onChange={e => setSelectedTeam(e.target.value)} style={{ width: "100%", padding: "6px 10px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 4 }}>
                        <option value="">Select a team...</option>
                        {teams.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
                <div className="rc-modal-footer">
                    <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={onClose}>Cancel</button>
                    <button className="rc-btn rc-btn-primary rc-btn-sm" disabled={!selectedTeam} onClick={() => { onRoute(selectedTeam); onClose(); }}>Route to {selectedTeam || "..."}</button>
                </div>
            </div>
        </div>
    );
}

function wsToast(msg: string) {
    const el = document.createElement("div");
    el.style.cssText = "position:fixed;bottom:16px;right:16px;background:#1e293b;color:#fff;padding:8px 16px;border-radius:6px;font-size:12px;font-weight:600;z-index:9999;box-shadow:0 2px 8px rgba(0,0,0,0.15)";
    el.textContent = msg;
    const ok = document.createElement("button");
    ok.textContent = "OK";
    ok.style.cssText = "background:none;border:none;color:#fff;margin-left:8px;font-size:11px;cursor:pointer";
    ok.onclick = () => el.remove();
    el.appendChild(ok);
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4000);
}

interface WorkspaceNote {
    id: string;
    author: string;
    text: string;
    timestamp: string;
}

interface WorkspaceQuestion {
    id: string;
    from: string;
    question: string;
    response: string | null;
    status: "Open" | "Answered";
    timestamp: string;
}

export default function RecapitalizationWorkspace() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [wsRefreshKey, setWsRefreshKey] = useState(0);
    const result = useMemo(() => id ? lookupWorkspaceItem(id) : null, [id, wsRefreshKey]);

    const [internalNotes, setInternalNotes] = useState<WorkspaceNote[]>([
        { id: "wn1", author: "David Park", text: "Initial review — needs owner assignment", timestamp: "2026-06-25" },
        { id: "wn2", author: "Sarah Chen", text: "Contacted broker for more details on scope", timestamp: "2026-06-26" },
    ]);

    const [category, setCategory] = useState("");
    const [team, setTeam] = useState("");
    const [internalOwner, setInternalOwner] = useState("");
    const [pendingOwner, setPendingOwner] = useState<string | null>(null);
    const [priority, setPriority] = useState("Medium");
    const [dueDate, setDueDate] = useState("");
    const [externalVisible, setExternalVisible] = useState(true);
    const [communityScope, setCommunityScope] = useState("");

    const [saved, setSaved] = useState(false);
    const [showAssign, setShowAssign] = useState(false);
    const [showRoute, setShowRoute] = useState(false);
    const [showConverted, setShowConverted] = useState(false);
    const [banner, setBanner] = useState<string | null>(null);
    const [localQuestions, setLocalQuestions] = useState<WorkspaceQuestion[]>([
        { id: "q1", from: "Marcus & Associates", question: "Should the Phase I ESA include asbestos testing or just standard environmental assessment?", response: "Standard Phase I only. Asbestos scope to be handled separately if flagged.", status: "Answered", timestamp: "2026-06-24" },
        { id: "q2", from: "Marcus & Associates", question: "What is the preferred format for financial statements — scanned PDF or native Excel?", response: null, status: "Open", timestamp: "2026-06-27" },
    ]);
    const [draftClarificationOpen, setDraftClarificationOpen] = useState(false);
    const [draftClarificationText, setDraftClarificationText] = useState("");
    const [draftClarificationInternal, setDraftClarificationInternal] = useState(true);
    const [respondExternalOpen, setRespondExternalOpen] = useState(false);
    const [respondExternalText, setRespondExternalText] = useState("");
    const [publishUpdateOpen, setPublishUpdateOpen] = useState(false);
    const [publishUpdateText, setPublishUpdateText] = useState("");
    const [addResponseId, setAddResponseId] = useState<string | null>(null);
    const [addResponseText, setAddResponseText] = useState("");
    const [wsConfirmAction, setWsConfirmAction] = useState<{ title: string; action: () => void } | null>(null);

    if (!result) {
        return (
            <div className="rc-page">
                <RecapSubNav />
                <div className="ws-not-found">
                    <h2>Item Not Found</h2>
                    <p>The requested workspace item could not be found.</p>
                    <button className="rc-btn rc-btn-primary" onClick={() => navigate("/recapitalization/intake")}>Back to Intake Queue</button>
                </div>
            </div>
        );
    }

    const { type, transaction } = result;
    const isIntake = type === "intake";
    const item = result.item as any;

    const displayId = item.intakeId || item.requestId || item.id;
    const displayTitle = item.title || item.fileName || "";
    const displayTypeLabel = isIntake ? (item.type || "Intake") : "Request";
    const displayStatus = item.status;
    const submittedDate = item.submittedAt ? new Date(item.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : item.createdDate || "";
    const communities = item.communityNames || [];
    const description = item.description || "";

    const isBulkUpload = item.type === "Broker Upload";

    const documents = useMemo(() => getDocumentsByTransaction(item.transactionId), [item.transactionId]);
    const activity = useMemo(() => getActivityByTransaction(item.transactionId).slice(0, 10), [item.transactionId]);

    const rs = readinessScore(item);

    useEffect(() => {
        setCategory(item.suggestedCategory || item.category || "");
        setTeam(item.suggestedTeam || item.team || "");
        setInternalOwner(item.suggestedOwner || item.owner || "");
        setDueDate(item.dueDate || "");
        setPriority(item.priority || "Medium");
        setCommunityScope(item.communityNames?.join(", ") || "");
        setExternalVisible(true);
    }, [item]);

    const config = SOURCE_CONFIG[item.type] || { icon: "\u2753", label: item.type || "Intake", cssClass: "rc-badge-open" };

    const STATUS_OPTIONS = ["Open", "In Progress", "Pending External", "Blocked", "Ready for Review", "Complete", "Not Applicable", "Duplicate"];

    const [sections, setSections] = useState<Record<string, boolean>>({
        submission: false,
        documents: false,
        questions: true,
        notes: false,
        activity: false,
        decisionSupport: false,
        routing: false,
    });

    const toggleSection = (key: string) => setSections(prev => ({ ...prev, [key]: !prev[key] }));

    const [pendingStatus, setPendingStatus] = useState<string | null>(null);

    function handleStatusChange(newStatus: string) {
        updateRequestStatus(item.id || item.intakeId || "", newStatus as any);
        setWsRefreshKey(k => k + 1);
        setPendingStatus(null);
        setBanner(`Status changed to ${newStatus}`);
    }

    return (
        <div className="rc-page ws-page">
            <RecapSubNav />

            <div className="ws-back">
                <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => navigate(-1)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="19" y1="12" x2="5" y2="12" />
                        <polyline points="12 19 5 12 12 5" />
                    </svg>
                    Back
                </button>
            </div>

            {banner && (
                <div style={{
                    padding: "10px 16px", marginBottom: 16, borderRadius: 8, fontSize: 13, fontWeight: 600,
                    background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0",
                }}>
                    {banner}
                    <button className="rc-btn rc-btn-ghost rc-btn-sm" style={{ marginLeft: 12, color: "#166534", fontSize: 11 }} onClick={() => setBanner(null)}>OK</button>
                </div>
            )}

            {/* Hero Section */}
            <div className="ws-header" style={{ borderBottom: "1px solid #e2e8f0", paddingBottom: 16, marginBottom: 12 }}>
                <div className="ws-header-main" style={{ flex: 1 }}>
                    <div className="ws-id-row" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                        <span className="ws-id" style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", fontFamily: '"SF Mono", "Cascadia Code", "Consolas", monospace' }}>{displayId}</span>
                        <span className={`rc-badge ${config.cssClass}`} style={{ fontSize: 9, padding: "2px 6px" }}>{displayTypeLabel}</span>
                    </div>
                    <h1 className="ws-title" style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", margin: "0 0 4px", lineHeight: 1.3 }}>{displayTitle}</h1>
                    {description && <p style={{ fontSize: 12, color: "#475569", margin: "0 0 12px", lineHeight: 1.5, maxWidth: 600 }}>{description}</p>}
                </div>
                <div className="ws-header-actions" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                    <select value={pendingStatus ?? displayStatus} onChange={e => setPendingStatus(e.target.value)} style={{ fontSize: 11, padding: "4px 20px 4px 8px", borderRadius: 4, border: pendingStatus && pendingStatus !== displayStatus ? "1px solid #1d4ed8" : "1px solid #d1d5db", background: "#fff", fontWeight: 600, minWidth: 120, cursor: "pointer" }}>
                        {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    {pendingStatus && pendingStatus !== displayStatus && (
                        <button className="rc-btn rc-btn-primary rc-btn-sm" onClick={() => handleStatusChange(pendingStatus)}>
                            Confirm
                        </button>
                    )}
                    <button className="rc-btn rc-btn-primary rc-btn-sm" onClick={() => setShowAssign(true)}>Assign</button>
                    <button className="rc-btn rc-btn-secondary rc-btn-sm" onClick={() => setRespondExternalOpen(true)}>Ask Broker Question</button>
                    <button className="rc-btn rc-btn-secondary rc-btn-sm" onClick={() => wsToast("Upload document — file picker would open here")}>Upload Document</button>
                    <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => { const name = prompt("Enter document name to link:"); if (name) wsToast(`Linked: ${name}`); }}>Link Document</button>
                    <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => setWsConfirmAction({ title: "Mark this item Complete?", action: () => handleStatusChange("Complete") })} style={{ color: "#166534" }}>Mark Complete</button>
                    <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => setDraftClarificationOpen(true)}>Add Internal Note</button>
                </div>
            </div>

            {/* Essential Info Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginBottom: 16 }}>
                <div className="rc-setting-card" style={{ padding: "8px 12px" }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.03em" }}>Status</span>
                    <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
                        <select value={pendingStatus ?? displayStatus} onChange={e => setPendingStatus(e.target.value)} style={{ fontSize: 12, padding: "2px 18px 2px 4px", borderRadius: 4, border: pendingStatus && pendingStatus !== displayStatus ? "1px solid #1d4ed8" : "1px solid #d1d5db", background: "#fff", fontWeight: 600, flex: 1, cursor: "pointer" }}>
                            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        {pendingStatus && pendingStatus !== displayStatus && (
                            <button className="rc-btn rc-btn-primary rc-btn-sm" style={{ fontSize: 9, padding: "1px 6px" }} onClick={() => handleStatusChange(pendingStatus)}>Confirm</button>
                        )}
                    </div>
                </div>
                <div className="rc-setting-card" style={{ padding: "8px 12px" }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.03em" }}>Priority</span>
                    <select value={priority} onChange={e => { setPriority(e.target.value); bulkUpdateDemoRequests([item.id || item.intakeId || ""].filter(Boolean), { priority: e.target.value as any }); }} style={{ fontSize: 12, padding: "2px 18px 2px 4px", borderRadius: 4, border: "1px solid #d1d5db", background: "#fff", fontWeight: 600, width: "100%", marginTop: 2, cursor: "pointer" }}>
                        <option value="High">High</option>
                        <option value="Medium">Medium</option>
                        <option value="Low">Low</option>
                    </select>
                </div>
                <div className="rc-setting-card" style={{ padding: "8px 12px" }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.03em" }}>Due Date</span>
                    <input type="date" value={dueDate} onChange={e => { setDueDate(e.target.value); bulkUpdateDemoRequests([item.id || item.intakeId || ""].filter(Boolean), { dueDate: e.target.value }); }}
                        style={{ fontSize: 12, padding: "2px 4px", borderRadius: 4, border: "1px solid #d1d5db", width: "100%", marginTop: 2, boxSizing: "border-box" }} />
                </div>
                <div className="rc-setting-card" style={{ padding: "8px 12px" }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.03em" }}>Internal Owner</span>
                    <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
                        <select value={pendingOwner ?? internalOwner} onChange={e => setPendingOwner(e.target.value)} style={{ fontSize: 12, padding: "2px 18px 2px 4px", borderRadius: 4, border: pendingOwner && pendingOwner !== internalOwner ? "1px solid #1d4ed8" : "1px solid #d1d5db", background: "#fff", fontWeight: 600, flex: 1, cursor: "pointer" }}>
                            <option value="">Unassigned</option>
                            {["Sarah Chen", "James Wright", "Lisa Park", "Tom Davies", "Mike O'Brien", "Anna Patel", "David Park", "Carlos Rivera"].map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                        {pendingOwner && pendingOwner !== internalOwner && (
                            <button className="rc-btn rc-btn-primary rc-btn-sm" style={{ fontSize: 9, padding: "1px 6px" }} onClick={() => { const ids = [item.id || item.intakeId || ""].filter(Boolean); bulkUpdateDemoRequests(ids, { owner: pendingOwner, assignedTo: pendingOwner }); setInternalOwner(pendingOwner); setPendingOwner(null); setWsRefreshKey(k => k + 1); setBanner(`Assigned to ${pendingOwner}`); }}>Confirm</button>
                        )}
                    </div>
                </div>
                <div className="rc-setting-card" style={{ padding: "8px 12px" }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.03em" }}>Team</span>
                    <select value={team} onChange={e => { setTeam(e.target.value); bulkUpdateDemoRequests([item.id || item.intakeId || ""].filter(Boolean), { team: e.target.value }); }} style={{ fontSize: 12, padding: "2px 18px 2px 4px", borderRadius: 4, border: "1px solid #d1d5db", background: "#fff", fontWeight: 600, width: "100%", marginTop: 2, cursor: "pointer" }}>
                        {["Financial Analysis", "Regulatory", "Environmental", "Risk Management", "HR & Operations", "DD Management"].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
                <div className="rc-setting-card" style={{ padding: "8px 12px" }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.03em" }}>Community</span>
                    <span style={{ fontSize: 12, fontWeight: 500, color: "#1e293b", marginTop: 2, display: "block" }}>{communities.slice(0, 2).join(", ") || "\u2014"}</span>
                </div>
                <div className="rc-setting-card" style={{ padding: "8px 12px" }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.03em" }}>Broker / Buyer</span>
                    <span style={{ fontSize: 12, fontWeight: 500, color: "#1e293b", marginTop: 2, display: "block" }}>{transaction.brokerName} / {transaction.sellerName}</span>
                </div>
                <div className="rc-setting-card" style={{ padding: "8px 12px" }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.03em" }}>Transaction</span>
                    <span style={{ fontSize: 12, fontWeight: 500, color: "#1e293b", marginTop: 2, display: "block" }}>{transaction.name}</span>
                </div>
                <div className="rc-setting-card" style={{ padding: "8px 12px" }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.03em" }}>Request ID</span>
                    <span style={{ fontSize: 12, fontWeight: 500, color: "#1e293b", marginTop: 2, display: "block", fontFamily: '"SF Mono", "Cascadia Code", "Consolas", monospace' }}>{item.requestId || item.id || "\u2014"}</span>
                </div>
                <div className="rc-setting-card" style={{ padding: "8px 12px" }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.03em" }}>Submitted</span>
                    <span style={{ fontSize: 12, fontWeight: 500, color: "#1e293b", marginTop: 2, display: "block" }}>{submittedDate}</span>
                </div>
            </div>

            {/* Actions Row */}
            <div className="ws-card" style={{ marginBottom: 12 }}>
                <div className="ws-card-body" style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "8px 12px" }}>
                    <button className="rc-btn rc-btn-primary rc-btn-sm" onClick={() => setShowAssign(true)}>Assign</button>
                    <button className="rc-btn rc-btn-secondary rc-btn-sm" onClick={() => setShowRoute(true)}>Route to Team</button>
                    <button className="rc-btn rc-btn-secondary rc-btn-sm" onClick={() => setRespondExternalOpen(true)}>Ask Broker Question</button>
                    <button className="rc-btn rc-btn-secondary rc-btn-sm" onClick={() => setPublishUpdateOpen(true)}>Publish Update</button>
                    <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => { const name = prompt("Enter document name to link:"); if (name) wsToast(`Linked: ${name}`); }}>Link Document</button>
                    <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => wsToast("Upload document — file picker would open here")}>Upload</button>
                    <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => setWsConfirmAction({ title: "Mark this item Complete?", action: () => handleStatusChange("Complete") })} style={{ color: "#166534" }}>Mark Complete</button>
                    <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => setDraftClarificationOpen(true)}>Add Internal Note</button>
                    <button className="rc-btn rc-btn-ghost rc-btn-sm" style={{ color: "#92400e" }} onClick={() => setWsConfirmAction({ title: "Mark this item as Duplicate?", action: () => { updateRequestStatus(item.id || item.intakeId || "", "Duplicate" as any); setWsRefreshKey(k => k + 1); setBanner("Marked as Duplicate"); } })}>Mark Duplicate</button>
                    <button className="rc-btn rc-btn-ghost rc-btn-sm" style={{ color: "#92400e" }} onClick={() => setWsConfirmAction({ title: "Mark this item as Not Applicable?", action: () => { updateRequestStatus(item.id || item.intakeId || "", "Not Applicable" as any); setWsRefreshKey(k => k + 1); setBanner("Marked as Not Applicable"); } })}>Mark N/A</button>
                    <div style={{ flex: 1 }} />
                    <button className="rc-btn rc-btn-secondary rc-btn-sm" onClick={() => { bulkUpdateDemoRequests([item.id || item.intakeId || ""].filter(Boolean), { category, team, owner: internalOwner, priority: priority as any, dueDate } as any); setSaved(true); setWsRefreshKey(k => k + 1); setTimeout(() => setSaved(false), 2000); }}>
                        {saved ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg> Saved!</> : "Save Draft"}
                    </button>
                </div>
            </div>

            {/* Collapsible Sections */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div className="ws-card" style={{ margin: 0 }}>
                    <div className="ws-card-header" onClick={() => toggleSection("submission")} style={{ cursor: "pointer" }}>
                        <h3>Original Submission</h3>
                        <span style={{ fontSize: 12, color: "#64748b" }}>{sections.submission ? "\u25BC" : "\u25B6"}</span>
                    </div>
                    {sections.submission && (
                        <div className="ws-card-body">
                            <p className="ws-submission-text">{description}</p>
                            {isBulkUpload && item.fileName && (
                                <div className="ws-file-info">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4338ca" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><polyline points="13 2 13 9 20 9" /></svg>
                                    <span>{item.fileName}</span>
                                    {item.rowsFound && <span className="rc-text-muted">({item.rowsFound} rows found)</span>}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="ws-card" style={{ margin: 0 }}>
                    <div className="ws-card-header" onClick={() => toggleSection("routing")} style={{ cursor: "pointer" }}>
                        <h3>Decision / Routing</h3>
                        <span style={{ fontSize: 12, color: "#64748b" }}>{sections.routing ? "\u25BC" : "\u25B6"}</span>
                    </div>
                    {sections.routing && (
                        <div className="ws-card-body">
                            <div className="ws-routing-grid">
                                <div className="ws-routing-field">
                                    <label className="ws-routing-label">Category</label>
                                    <select className="rc-filter-select" value={category} onChange={e => setCategory(e.target.value)} style={{ width: "100%" }}>
                                        <option value="">Select category...</option>
                                        <option value="Financial Statements">Financial Statements</option>
                                        <option value="Licenses">Licenses</option>
                                        <option value="Environmental">Environmental</option>
                                        <option value="Insurance">Insurance</option>
                                        <option value="Legal">Legal</option>
                                        <option value="HR / Staffing">HR / Staffing</option>
                                        <option value="Physical Plant">Physical Plant</option>
                                        <option value="Regulatory">Regulatory</option>
                                        <option value="Operations">Operations</option>
                                        <option value="Marketing">Marketing</option>
                                    </select>
                                </div>
                                <div className="ws-routing-field">
                                    <label className="ws-routing-label">External Visibility</label>
                                    <select className="rc-filter-select" value={externalVisible ? "visible" : "hidden"} onChange={e => setExternalVisible(e.target.value === "visible")} style={{ width: "100%" }}>
                                        <option value="visible">Visible to External</option>
                                        <option value="hidden">Internal Only</option>
                                    </select>
                                </div>
                                <div className="ws-routing-field ws-routing-field-wide">
                                    <label className="ws-routing-label">Community Scope</label>
                                    <input type="text" className="rc-filter-select" value={communityScope} onChange={e => setCommunityScope(e.target.value)} style={{ width: "100%" }} placeholder="e.g. All Communities, or specific ones" />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="ws-card" style={{ margin: 0 }}>
                    <div className="ws-card-header" onClick={() => toggleSection("documents")} style={{ cursor: "pointer" }}>
                        <h3>Documents ({documents.length})</h3>
                        <span style={{ fontSize: 12, color: "#64748b" }}>{sections.documents ? "\u25BC" : "\u25B6"}</span>
                    </div>
                    {sections.documents && (
                        <div className="ws-card-body" style={{ padding: 0 }}>
                            <div className="ws-card-actions" style={{ padding: "8px 12px", display: "flex", gap: 8 }}>
                                <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => { const name = prompt("Enter document name to link:"); if (name) wsToast(`Linked: ${name}`); }}>Link Existing</button>
                                <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => wsToast("Upload document — file picker would open here")}>Upload</button>
                            </div>
                            {documents.length === 0 ? (
                                <div className="ws-empty-section">No documents linked yet</div>
                            ) : (
                                <table className="rc-table">
                                    <thead><tr><th>File Name</th><th>Category</th><th>Related Request</th><th></th></tr></thead>
                                    <tbody>{documents.map(doc => (
                                        <tr key={doc.id}>
                                            <td style={{ fontWeight: 500 }}>{doc.name}</td>
                                            <td>{doc.category}</td>
                                            <td style={{ fontSize: 12, color: "#64748b" }}>{doc.requestTitle || "\u2014"}</td>
                                            <td><button className="rc-btn rc-btn-ghost rc-btn-sm" style={{ fontSize: 10 }} onClick={() => wsToast(`Opening ${doc.name} in SharePoint...`)}>Open in SP</button></td>
                                        </tr>
                                    ))}</tbody>
                                </table>
                            )}
                        </div>
                    )}
                </div>

                <div className="ws-card" style={{ margin: 0 }}>
                    <div className="ws-card-header" onClick={() => toggleSection("questions")} style={{ cursor: "pointer" }}>
                        <h3>Questions &amp; Clarifications ({localQuestions.length})</h3>
                        <span style={{ fontSize: 12, color: "#64748b" }}>{sections.questions ? "\u25BC" : "\u25B6"}</span>
                    </div>
                    {sections.questions && (
                        <div className="ws-card-body">
                            <div style={{ marginBottom: 8, display: "flex", gap: 6 }}>
                                <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => setDraftClarificationOpen(true)}>Request Clarification</button>
                                <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => setRespondExternalOpen(true)}>Ask Broker Question</button>
                            </div>
                            <div className="ws-qa-list">
                                {localQuestions.map(q => (
                                    <div key={q.id} className={`ws-qa-item ${q.status === "Answered" ? "ws-qa-answered" : ""}`}>
                                        <div className="ws-qa-header">
                                            <span className="ws-qa-from">{q.from}</span>
                                            <span className={`rc-badge ${q.status === "Answered" ? "rc-badge-provided" : "rc-badge-clarification-needed"}`} style={{ fontSize: 9, padding: "1px 6px" }}>{q.status}</span>
                                            <span className="ws-qa-time">{q.timestamp}</span>
                                        </div>
                                        <div className="ws-qa-question">{q.question}</div>
                                        {q.response ? (
                                            <div className="ws-qa-response"><span className="ws-qa-response-label">Response:</span> {q.response}</div>
                                        ) : (
                                            <div className="ws-qa-action">
                                                {addResponseId === q.id ? (
                                                    <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
                                                        <textarea value={addResponseText} onChange={e => setAddResponseText(e.target.value)} placeholder="Type response..." rows={2} style={{ width: "100%", padding: "6px 8px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 4, resize: "vertical", font: "inherit", boxSizing: "border-box" }} />
                                                        <div style={{ display: "flex", gap: 6 }}>
                                                            <button className="rc-btn rc-btn-primary rc-btn-sm" disabled={!addResponseText.trim()} onClick={() => { setLocalQuestions(prev => prev.map(x => x.id === q.id ? { ...x, response: addResponseText.trim(), status: "Answered" } : x)); setAddResponseId(null); setAddResponseText(""); wsToast("Response added"); }}>Submit</button>
                                                            <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => { setAddResponseId(null); setAddResponseText(""); }}>Cancel</button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <button className="rc-btn rc-btn-primary rc-btn-sm" onClick={() => { setAddResponseId(q.id); setAddResponseText(""); }}>Add Response</button>
                                                        <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => { setLocalQuestions(prev => prev.map(x => x.id === q.id ? { ...x, status: "Answered" } : x)); wsToast("Marked as answered"); }}>Mark Answered</button>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="ws-card" style={{ margin: 0 }}>
                    <div className="ws-card-header" onClick={() => toggleSection("notes")} style={{ cursor: "pointer" }}>
                        <h3>Internal Notes / Work Journal</h3>
                        <span style={{ fontSize: 12, color: "#64748b" }}>{sections.notes ? "\u25BC" : "\u25B6"}</span>
                    </div>
                    {sections.notes && (
                        <div className="ws-card-body">
                            <div className="rc-notes-section">
                                {internalNotes.map(note => (
                                    <div key={note.id} className="rc-note-item">
                                        <div className="rc-note-header">
                                            <span className="rc-note-author">{note.author}</span>
                                            <span>{note.timestamp}</span>
                                        </div>
                                        <div className="rc-note-body">{note.text}</div>
                                    </div>
                                ))}
                                <NoteInput onAdd={text => {
                                    const note: WorkspaceNote = { id: "wn" + Date.now(), author: "Current User", text, timestamp: new Date().toISOString().split("T")[0] };
                                    setInternalNotes(prev => [note, ...prev]);
                                }} />
                            </div>
                        </div>
                    )}
                </div>

                <div className="ws-card" style={{ margin: 0 }}>
                    <div className="ws-card-header" onClick={() => toggleSection("activity")} style={{ cursor: "pointer" }}>
                        <h3>Activity Timeline</h3>
                        <span style={{ fontSize: 12, color: "#64748b" }}>{sections.activity ? "\u25BC" : "\u25B6"}</span>
                    </div>
                    {sections.activity && (
                        <div className="ws-card-body">
                            {activity.length === 0 ? (
                                <div className="ws-empty-section">No activity recorded</div>
                            ) : (
                                <div className="rc-timeline">
                                    {activity.map((act, i) => (
                                        <div className="rc-timeline-item" key={act.id}>
                                            <div style={{ position: "relative" }}>
                                                <div className="rc-timeline-dot" />
                                                {i < activity.length - 1 && <div className="rc-timeline-line" />}
                                            </div>
                                            <div className="rc-timeline-content">
                                                <span className="rc-timeline-desc">{act.description}</span>
                                                <span className="rc-timeline-meta">{act.userName} &middot; {act.transactionName} &middot; {new Date(act.timestamp).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="ws-card" style={{ margin: 0 }}>
                    <div className="ws-card-header" onClick={() => toggleSection("decisionSupport")} style={{ cursor: "pointer" }}>
                        <h3>Decision Support Preview</h3>
                        <span className="rc-badge rc-badge-import" style={{ fontSize: 9 }}>Mock Preview</span>
                        <span style={{ fontSize: 12, color: "#64748b", marginLeft: "auto" }}>{sections.decisionSupport ? "\u25BC" : "\u25B6"}</span>
                    </div>
                    {sections.decisionSupport && (
                        <div className="ws-card-body">
                            <div className="ws-preview-grid">
                                <div className="ws-preview-field">
                                    <span className="ws-preview-label">Suggested Deliverable</span>
                                    <span className="ws-preview-value">{item.suggestedCategory ? `${item.suggestedCategory} Report` : "\u2014"}</span>
                                </div>
                                <div className="ws-preview-field">
                                    <span className="ws-preview-label">Suggested Category</span>
                                    <span className="ws-preview-value">{item.suggestedCategory || "\u2014"}</span>
                                </div>
                                <div className="ws-preview-field">
                                    <span className="ws-preview-label">Suggested Team</span>
                                    <span className="ws-preview-value">{item.suggestedTeam || "\u2014"}</span>
                                </div>
                                <div className="ws-preview-field">
                                    <span className="ws-preview-label">Suggested Internal Owner</span>
                                    <span className="ws-preview-value">{item.suggestedOwner || "\u2014"}</span>
                                </div>
                                <div className="ws-preview-field">
                                    <span className="ws-preview-label">Duplicate Confidence</span>
                                    <span className="ws-preview-value">{isIntake ? "12% \u2014 Likely unique" : "\u2014"}</span>
                                </div>
                                <div className="ws-preview-field">
                                    <span className="ws-preview-label">Similar Requests</span>
                                    <span className="ws-preview-value">{isIntake ? "DD-26-001, DD-26-005 (Audited Financials)" : "\u2014"}</span>
                                </div>
                            </div>
                            <div className="ws-preview-hint">AI-powered classification and matching will be available in a future sprint.</div>
                        </div>
                    )}
                </div>

                <div className="ws-card" style={{ margin: 0 }}>
                    <div className="ws-card-header" onClick={() => toggleSection("readiness")} style={{ cursor: "pointer" }}>
                        <h3>Readiness to Provide</h3>
                        <span style={{ fontSize: 12, color: "#64748b" }}>{sections.readiness ? "\u25BC" : "\u25B6"}</span>
                    </div>
                    {sections.readiness && (
                        <div className="ws-card-body">
                            <div className="ws-readiness">
                                <div className="ws-readiness-score">{rs.score}%</div>
                                <div className="ws-readiness-bar">
                                    <div className="ws-readiness-fill" style={{ width: `${rs.score}%`, background: rs.score >= 80 ? "#166534" : rs.score >= 40 ? "#1d4ed8" : "#92400e" }} />
                                </div>
                                <div className="ws-readiness-label">
                                    <span className={rs.score >= 80 ? "ws-readiness-label-ready" : rs.score >= 40 ? "ws-readiness-label-partial" : "ws-readiness-label-attention"}>{rs.label}</span>
                                </div>
                                <ul className="ws-readiness-factors">
                                    {rs.factors.map((f, i) => (
                                        <li key={i} className={f.met ? "ws-factor-met" : "ws-factor-unmet"}>
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={f.met ? "#166534" : "#64748b"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                {f.met ? <polyline points="20 6 9 17 4 12" /> : <line x1="18" y1="6" x2="6" y2="18" />}
                                            </svg>
                                            {f.label}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {showAssign && (
                <AssignUserModal
                    onClose={() => setShowAssign(false)}
                    onAssign={(user) => {
                        const ids = [item.id || item.intakeId || ""].filter(Boolean);
                        const count = bulkUpdateDemoRequests(ids, { owner: user.name, assignedTo: user.name });
                        setInternalOwner(user.name);
                        setWsRefreshKey(k => k + 1);
                        setShowAssign(false);
                        setBanner(count > 0 ? `Assigned to ${user.name}` : "Item not found — no change applied.");
                    }}
                />
            )}
            {showRoute && (
                <RouteToTeamModal
                    onClose={() => setShowRoute(false)}
                    onRoute={(team) => {
                        const ids = [item.id || item.intakeId || ""].filter(Boolean);
                        const count = bulkUpdateDemoRequests(ids, { team });
                        setTeam(team);
                        setWsRefreshKey(k => k + 1);
                        setShowRoute(false);
                        setBanner(count > 0 ? `Routed to ${team}` : "Item not found — no change applied.");
                    }}
                />
            )}
            {showConverted && (
                <div className="rc-modal-overlay" onClick={() => setShowConverted(false)}>
                    <div className="rc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
                        <div className="rc-modal-header">
                            <h2>Convert to Official Request</h2>
                            <button className="rc-modal-close" onClick={() => setShowConverted(false)}>&times;</button>
                        </div>
                        <div className="rc-modal-body" style={{ padding: "16px", textAlign: "center" }}>
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#166534" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 8px" }}>
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                            <p style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", margin: 0 }}>Converted!</p>
                            <p style={{ fontSize: 12, color: "#64748b", margin: "4px 0 0" }}>This item is now an official DD request.</p>
                        </div>
                        <div className="rc-modal-footer">
                            <button className="rc-btn rc-btn-primary rc-btn-sm" onClick={() => setShowConverted(false)}>Done</button>
                        </div>
                    </div>
                </div>
            )}

            {draftClarificationOpen && (
                <div className="rc-modal-overlay" onClick={() => { setDraftClarificationOpen(false); setDraftClarificationText(""); }}>
                    <div className="rc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
                        <div className="rc-modal-header">
                            <h2>Request Clarification</h2>
                            <button className="rc-modal-close" onClick={() => { setDraftClarificationOpen(false); setDraftClarificationText(""); }}>&times;</button>
                        </div>
                        <div className="rc-modal-body">
                            <div className="rc-modal-field">
                                <label>Clarification Question</label>
                                <textarea value={draftClarificationText} onChange={e => setDraftClarificationText(e.target.value)} placeholder="What clarification is needed?" rows={4} style={{ width: "100%", padding: "8px 10px", fontSize: 13, border: "1px solid #e2e8f0", borderRadius: 6, resize: "vertical", font: "inherit", boxSizing: "border-box" }} />
                            </div>
                            <div className="rc-modal-field">
                                <label>Visibility</label>
                                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                                    <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, cursor: "pointer" }}>
                                        <input type="radio" name="clarVisibility" checked={draftClarificationInternal} onChange={() => setDraftClarificationInternal(true)} />
                                        Internal Review Needed (default)
                                    </label>
                                    <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, cursor: "pointer" }}>
                                        <input type="radio" name="clarVisibility" checked={!draftClarificationInternal} onChange={() => setDraftClarificationInternal(false)} />
                                        Publish to External
                                    </label>
                                </div>
                                <p style={{ fontSize: 11, color: "#64748b", margin: "4px 0 0" }}>
                                    {draftClarificationInternal
                                        ? "DD lead will review and approve before external visibility."
                                        : "Clarification will be visible externally after submission."}
                                </p>
                            </div>
                        </div>
                        <div className="rc-modal-footer">
                            <button className="rc-btn rc-btn-ghost" onClick={() => { setDraftClarificationOpen(false); setDraftClarificationText(""); }}>Cancel</button>
                            <button className="rc-btn rc-btn-primary" disabled={!draftClarificationText.trim()} onClick={() => {
                                const newQ: WorkspaceQuestion = {
                                    id: "q" + Date.now(),
                                    from: "Internal Team",
                                    question: draftClarificationText.trim(),
                                    response: null,
                                    status: "Open",
                                    timestamp: new Date().toISOString().split("T")[0],
                                };
                                setLocalQuestions(prev => [...prev, { ...newQ, status: draftClarificationInternal ? "Open" as const : "Open" as const }]);
                                setDraftClarificationOpen(false);
                                setDraftClarificationText("");
                                setDraftClarificationInternal(true);
                                setBanner(draftClarificationInternal ? "Clarification drafted (internal review needed before external publish)" : "Clarification submitted and visible externally.");
                            }}>Save Clarification</button>
                        </div>
                    </div>
                </div>
            )}

            {respondExternalOpen && (
                <div className="rc-modal-overlay" onClick={() => { setRespondExternalOpen(false); setRespondExternalText(""); }}>
                    <div className="rc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
                        <div className="rc-modal-header">
                            <h2>Ask Broker Question</h2>
                            <button className="rc-modal-close" onClick={() => { setRespondExternalOpen(false); setRespondExternalText(""); }}>&times;</button>
                        </div>
                        <div className="rc-modal-body" style={{ padding: "12px 16px" }}>
                            <div style={{ fontSize: 12, color: "#475569", marginBottom: 12, display: "flex", flexDirection: "column", gap: 4 }}>
                                <span><strong>Intake ID:</strong> {item.intakeId || item.id}</span>
                                <span><strong>Request ID:</strong> {item.requestId}</span>
                                <span><strong>Deliverable:</strong> {item.title}</span>
                                <span><strong>Community:</strong> {(item.communityNames || []).join(", ")}</span>
                                <span><strong>Broker/Buyer:</strong> {item.brokerBuyer}</span>
                                {item.description && <span style={{ marginTop: 4, padding: "6px 8px", background: "#f8fafc", borderRadius: 4, fontSize: 11, color: "#64748b", lineHeight: 1.4 }}>{item.description}</span>}
                            </div>
                            <textarea
                                value={respondExternalText}
                                onChange={e => setRespondExternalText(e.target.value)}
                                placeholder="Type your question or response..."
                                rows={4}
                                style={{ width: "100%", padding: "8px 10px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 6, resize: "vertical", font: "inherit", boxSizing: "border-box" }}
                            />
                        </div>
                        <div className="rc-modal-footer">
                            <button className="rc-btn rc-btn-ghost" onClick={() => { setRespondExternalOpen(false); setRespondExternalText(""); }}>Cancel</button>
                            <button className="rc-btn rc-btn-primary" disabled={!respondExternalText.trim()} onClick={() => {
                                const newQ: WorkspaceQuestion = {
                                    id: "wsq" + Date.now(), from: item.brokerBuyer || "External", question: respondExternalText.trim(), response: null, status: "Open", timestamp: new Date().toISOString().split("T")[0],
                                };
                                setLocalQuestions(prev => [newQ, ...prev]);
                                setBanner(`Question sent to ${item.brokerBuyer || "Broker"} and added to the request activity.`);
                                setRespondExternalOpen(false);
                                setRespondExternalText("");
                            }}>Send Question</button>
                        </div>
                    </div>
                </div>
            )}

            {publishUpdateOpen && (
                <div className="rc-modal-overlay" onClick={() => { setPublishUpdateOpen(false); setPublishUpdateText(""); }}>
                    <div className="rc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
                        <div className="rc-modal-header">
                            <h2>Publish Update</h2>
                            <button className="rc-modal-close" onClick={() => { setPublishUpdateOpen(false); setPublishUpdateText(""); }}>&times;</button>
                        </div>
                        <div className="rc-modal-body" style={{ padding: "12px 16px" }}>
                            <p style={{ fontSize: 12, color: "#475569", margin: "0 0 8px" }}>
                                Publish an update for <strong>{displayTitle}</strong>:
                            </p>
                            <textarea value={publishUpdateText} onChange={e => setPublishUpdateText(e.target.value)} placeholder="Describe the update..." rows={4} style={{ width: "100%", padding: "8px 10px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 6, resize: "vertical", font: "inherit", boxSizing: "border-box" }} />
                        </div>
                        <div className="rc-modal-footer">
                            <button className="rc-btn rc-btn-ghost" onClick={() => { setPublishUpdateOpen(false); setPublishUpdateText(""); }}>Cancel</button>
                            <button className="rc-btn rc-btn-primary" disabled={!publishUpdateText.trim()} onClick={() => { updateRequestStatus(item.id || item.intakeId || "", "Under Review"); setWsRefreshKey(k => k + 1); setBanner(`Update published for ${displayTitle}`); setPublishUpdateOpen(false); setPublishUpdateText(""); }}>Publish Update</button>
                        </div>
                    </div>
                </div>
            )}

            {wsConfirmAction && (
                <div className="rc-modal-overlay" onClick={() => setWsConfirmAction(null)}>
                    <div className="rc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
                        <div className="rc-modal-header">
                            <h2>Confirm</h2>
                            <button className="rc-modal-close" onClick={() => setWsConfirmAction(null)}>&times;</button>
                        </div>
                        <div className="rc-modal-body" style={{ padding: "16px", textAlign: "center" }}>
                            <p style={{ fontSize: 14, fontWeight: 600, color: "#1e293b", margin: 0 }}>{wsConfirmAction.title}</p>
                        </div>
                        <div className="rc-modal-footer">
                            <button className="rc-btn rc-btn-ghost" onClick={() => setWsConfirmAction(null)}>Cancel</button>
                            <button className="rc-btn rc-btn-primary" onClick={() => { wsConfirmAction.action(); setWsConfirmAction(null); }}>Confirm</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

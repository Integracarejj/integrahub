import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { lookupWorkspaceItem, getDocumentsByTransaction, getActivityByTransaction } from "../../services/recapMockData";
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

const STATUS_BADGE: Record<string, string> = {
    "Awaiting Review": "rc-badge-intake-awaiting",
    "Assigned": "rc-badge-intake-assigned",
    "Converted": "rc-badge-intake-converted",
    "Duplicate": "rc-badge-intake-duplicate",
    "Rejected": "rc-badge-intake-rejected",
    "Not Applicable": "rc-badge-intake-na",
    "Provided": "rc-badge-provided",
    "In Progress": "rc-badge-in-progress",
    "Clarification Needed": "rc-badge-clarification-needed",
    "Under Review": "rc-badge-under-review",
    "Open": "rc-badge-open",
    "Overdue": "rc-badge-overdue",
};

const PRIORITY_BADGE: Record<string, string> = {
    High: "rc-badge-high",
    Medium: "rc-badge-medium",
    Low: "rc-badge-low",
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

function toast(msg: string) {
    window.alert(msg);
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
    const result = useMemo(() => id ? lookupWorkspaceItem(id) : null, [id]);

    const [internalNotes, setInternalNotes] = useState<WorkspaceNote[]>([
        { id: "wn1", author: "David Park", text: "Initial review — needs owner assignment", timestamp: "2026-06-25" },
        { id: "wn2", author: "Sarah Chen", text: "Contacted broker for more details on scope", timestamp: "2026-06-26" },
    ]);
    const [questions] = useState<WorkspaceQuestion[]>([
        { id: "q1", from: "Marcus & Associates", question: "Should the Phase I ESA include asbestos testing or just standard environmental assessment?", response: "Standard Phase I only. Asbestos scope to be handled separately if flagged.", status: "Answered", timestamp: "2026-06-24" },
        { id: "q2", from: "Marcus & Associates", question: "What is the preferred format for financial statements — scanned PDF or native Excel?", response: null, status: "Open", timestamp: "2026-06-27" },
    ]);

    const [category, setCategory] = useState("");
    const [team, setTeam] = useState("");
    const [internalOwner, setInternalOwner] = useState("");
    const [priority, setPriority] = useState("Medium");
    const [dueDate, setDueDate] = useState("");
    const [externalVisible, setExternalVisible] = useState(true);
    const [communityScope, setCommunityScope] = useState("");

    const [saved, setSaved] = useState(false);

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
    const displayPriority = item.priority || "Medium";
    const submittedDate = item.submittedAt ? new Date(item.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : item.createdDate || "";
    const dueDateStr = item.dueDate || "";
    const communities = item.communityNames || [];
    const submittedBy = item.submittedBy || "";
    const source = item.source || (isIntake ? "External" : "Internal");
    const description = item.description || "";

    const isBulkUpload = item.type === "Broker Upload";

    const documents = useMemo(() => getDocumentsByTransaction(item.transactionId), [item.transactionId]);
    const activity = useMemo(() => getActivityByTransaction(item.transactionId).slice(0, 10), [item.transactionId]);

    const rs = readinessScore(item);

    if (!category && item.suggestedCategory) setCategory(item.suggestedCategory);
    if (!category && item.category) setCategory(item.category);
    if (!team && item.suggestedTeam) setTeam(item.suggestedTeam);
    if (!team && item.team) setTeam(item.team);
    if (!internalOwner && item.suggestedOwner) setInternalOwner(item.suggestedOwner);
    if (!internalOwner && item.owner) setInternalOwner(item.owner);
    if (!dueDate && item.dueDate) setDueDate(item.dueDate);
    if (!communityScope && communities.length > 0) setCommunityScope(communities.join(", "));

    const config = SOURCE_CONFIG[item.type] || { icon: "\u2753", label: item.type || "Intake", cssClass: "rc-badge-open" };

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

            <div className="ws-header">
                <div className="ws-header-main">
                    <div className="ws-id-row">
                        <span className="ws-id">{displayId}</span>
                        <span className={`rc-badge ${config.cssClass}`} style={{ fontSize: 10 }}>{displayTypeLabel}</span>
                        <span className={`rc-badge ${STATUS_BADGE[displayStatus] || "rc-badge-open"}`} style={{ fontSize: 10 }}>{displayStatus}</span>
                        <span className={`rc-badge ${PRIORITY_BADGE[displayPriority] || "rc-badge-medium"}`} style={{ fontSize: 10 }}>{displayPriority}</span>
                    </div>
                    <h1 className="ws-title">{displayTitle}</h1>
                    <div className="ws-meta-row">
                        <span className="ws-meta-item">Submitted: {submittedDate}</span>
                        {dueDateStr && <span className="ws-meta-item">Due: {dueDateStr}</span>}
                    </div>
                </div>
            </div>

            <div className="ws-chips">
                <div className="ws-chip"><span className="ws-chip-label">Owner / Seller</span><span className="ws-chip-value">{transaction.sellerName}</span></div>
                <div className="ws-chip"><span className="ws-chip-label">Buyer</span><span className="ws-chip-value">{transaction.buyerName}</span></div>
                <div className="ws-chip"><span className="ws-chip-label">Broker</span><span className="ws-chip-value">{transaction.brokerName}</span></div>
                <div className="ws-chip"><span className="ws-chip-label">Transaction</span><span className="ws-chip-value">{transaction.name}</span></div>
                <div className="ws-chip"><span className="ws-chip-label">Community</span><span className="ws-chip-value">{communities.length > 0 ? communities.slice(0, 2).join(", ") + (communities.length > 2 ? ` +${communities.length - 2}` : "") : "\u2014"}</span></div>
                <div className="ws-chip"><span className="ws-chip-label">Source</span><span className="ws-chip-value">{source}</span></div>
                <div className="ws-chip"><span className="ws-chip-label">Submitted By</span><span className="ws-chip-value">{submittedBy}</span></div>
            </div>

            <div className="ws-layout">
                <div className="ws-main">

                    <div className="ws-card">
                        <div className="ws-card-header">
                            <h3>Decision Support Preview</h3>
                            <span className="rc-badge rc-badge-import" style={{ fontSize: 9 }}>Mock Preview</span>
                        </div>
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
                                    <span className="ws-preview-value">{isIntake ? "12% — Likely unique" : "\u2014"}</span>
                                </div>
                                <div className="ws-preview-field">
                                    <span className="ws-preview-label">Similar Requests</span>
                                    <span className="ws-preview-value">{isIntake ? "DD-26-001, DD-26-005 (Audited Financials)" : "\u2014"}</span>
                                </div>
                            </div>
                            <div className="ws-preview-hint">AI-powered classification and matching will be available in a future sprint.</div>
                        </div>
                    </div>

                    <div className="ws-card">
                        <div className="ws-card-header">
                            <h3>Original Submission</h3>
                        </div>
                        <div className="ws-card-body">
                            <p className="ws-submission-text">{description}</p>
                            {isBulkUpload && item.fileName && (
                                <div className="ws-file-info">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4338ca" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                                        <polyline points="13 2 13 9 20 9" />
                                    </svg>
                                    <span>{item.fileName}</span>
                                    {item.rowsFound && <span className="rc-text-muted">({item.rowsFound} rows found)</span>}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="ws-card">
                        <div className="ws-card-header">
                            <h3>Decision / Routing</h3>
                        </div>
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
                                    <label className="ws-routing-label">Team</label>
                                    <select className="rc-filter-select" value={team} onChange={e => setTeam(e.target.value)} style={{ width: "100%" }}>
                                        <option value="">Select team...</option>
                                        <option value="Financial Analysis">Financial Analysis</option>
                                        <option value="Regulatory">Regulatory</option>
                                        <option value="Environmental">Environmental</option>
                                        <option value="Risk Management">Risk Management</option>
                                        <option value="HR & Operations">HR & Operations</option>
                                        <option value="DD Management">DD Management</option>
                                    </select>
                                </div>
                                <div className="ws-routing-field">
                                    <label className="ws-routing-label">Internal Owner</label>
                                    <select className="rc-filter-select" value={internalOwner} onChange={e => setInternalOwner(e.target.value)} style={{ width: "100%" }}>
                                        <option value="">Unassigned</option>
                                        <option value="Sarah Chen">Sarah Chen</option>
                                        <option value="James Wright">James Wright</option>
                                        <option value="Lisa Park">Lisa Park</option>
                                        <option value="Tom Davies">Tom Davies</option>
                                        <option value="Mike O'Brien">Mike O'Brien</option>
                                        <option value="Anna Patel">Anna Patel</option>
                                        <option value="David Park">David Park</option>
                                        <option value="Carlos Rivera">Carlos Rivera</option>
                                    </select>
                                </div>
                                <div className="ws-routing-field">
                                    <label className="ws-routing-label">Priority</label>
                                    <select className="rc-filter-select" value={priority} onChange={e => setPriority(e.target.value)} style={{ width: "100%" }}>
                                        <option value="High">High</option>
                                        <option value="Medium">Medium</option>
                                        <option value="Low">Low</option>
                                    </select>
                                </div>
                                <div className="ws-routing-field">
                                    <label className="ws-routing-label">Due Date</label>
                                    <input type="date" className="rc-filter-select" value={dueDate} onChange={e => setDueDate(e.target.value)} style={{ width: "100%" }} />
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
                    </div>

                    <div className="ws-card">
                        <div className="ws-card-header">
                            <h3>Documents</h3>
                            <div className="ws-card-actions">
                                <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => toast("Link Existing Document — coming next sprint")}>Link Existing</button>
                                <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => toast("Upload Document — coming next sprint")}>Upload</button>
                                <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => toast("Create Folder — coming next sprint")}>Create Folder</button>
                            </div>
                        </div>
                        <div className="ws-card-body" style={{ padding: 0 }}>
                            {documents.length === 0 ? (
                                <div className="ws-empty-section">No documents linked yet</div>
                            ) : (
                                <table className="rc-table">
                                    <thead>
                                        <tr>
                                            <th>File Name</th>
                                            <th>Category</th>
                                            <th>Related Request</th>
                                            <th>External</th>
                                            <th></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {documents.map(doc => (
                                            <tr key={doc.id}>
                                                <td style={{ fontWeight: 500 }}>{doc.name}</td>
                                                <td>{doc.category}</td>
                                                <td style={{ fontSize: 12, color: "#64748b" }}>{doc.requestTitle || "\u2014"}</td>
                                                <td><span className={`rc-badge ${doc.requestId ? "rc-badge-visible" : "rc-badge-hidden"}`} style={{ fontSize: 9, padding: "1px 5px" }}>{doc.requestId ? "Yes" : "No"}</span></td>
                                                <td><button className="rc-btn rc-btn-ghost rc-btn-sm" style={{ fontSize: 11 }} onClick={() => toast("Open in SharePoint — coming next sprint")}>Open in SP</button></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>

                    <div className="ws-card">
                        <div className="ws-card-header">
                            <h3>Questions &amp; Clarifications</h3>
                            <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => toast("Request Clarification — coming next sprint")}>Request Clarification</button>
                        </div>
                        <div className="ws-card-body">
                            <div className="ws-qa-list">
                                {questions.map(q => (
                                    <div key={q.id} className={`ws-qa-item ${q.status === "Answered" ? "ws-qa-answered" : ""}`}>
                                        <div className="ws-qa-header">
                                            <span className="ws-qa-from">{q.from}</span>
                                            <span className={`rc-badge ${q.status === "Answered" ? "rc-badge-provided" : "rc-badge-clarification-needed"}`} style={{ fontSize: 9, padding: "1px 6px" }}>{q.status}</span>
                                            <span className="ws-qa-time">{q.timestamp}</span>
                                        </div>
                                        <div className="ws-qa-question">{q.question}</div>
                                        {q.response ? (
                                            <div className="ws-qa-response">
                                                <span className="ws-qa-response-label">Response:</span> {q.response}
                                            </div>
                                        ) : (
                                            <div className="ws-qa-action">
                                                <button className="rc-btn rc-btn-primary rc-btn-sm" onClick={() => toast("Add Response — coming next sprint")}>Add Response</button>
                                                <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => toast("Mark Answered — coming next sprint")}>Mark Answered</button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="ws-card">
                        <div className="ws-card-header">
                            <h3>Internal Notes / Work Journal</h3>
                        </div>
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
                    </div>

                    <div className="ws-card">
                        <div className="ws-card-header">
                            <h3>Activity Timeline</h3>
                        </div>
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
                    </div>

                </div>

                <div className="ws-sidebar">
                    <div className="ws-sidebar-inner">
                        <div className="ws-card">
                            <div className="ws-card-header">
                                <h3>Actions</h3>
                            </div>
                            <div className="ws-card-body ws-action-list">
                                <div className="ws-actions-group-label">Work</div>
                                <button className="rc-btn rc-btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={() => toast("Assign — local mock only")}>Assign</button>
                                <button className="rc-btn rc-btn-secondary" style={{ width: "100%", justifyContent: "center" }} onClick={() => toast("Route to Team — local mock only")}>Route to Team</button>
                                {isIntake && <button className="rc-btn rc-btn-secondary" style={{ width: "100%", justifyContent: "center" }} onClick={() => toast("Convert to Official Request — local mock only")}>Convert to Official Request</button>}

                                <div className="ws-actions-group-label">Communication</div>
                                <button className="rc-btn rc-btn-secondary" style={{ width: "100%", justifyContent: "center" }} onClick={() => toast("Respond Externally — coming next sprint")}>Respond Externally</button>
                                <button className="rc-btn rc-btn-secondary" style={{ width: "100%", justifyContent: "center" }} onClick={() => toast("Publish Update — coming next sprint")}>Publish Update</button>

                                <div className="ws-actions-group-label">Resolution</div>
                                <button className="rc-btn rc-btn-ghost" style={{ width: "100%", justifyContent: "center", color: "#92400e" }} onClick={() => toast("Mark Duplicate — local mock only")}>Mark Duplicate</button>
                                <button className="rc-btn rc-btn-ghost" style={{ width: "100%", justifyContent: "center" }} onClick={() => toast("Reuse Existing Deliverable — coming next sprint")}>Reuse Existing Deliverable</button>
                                <button className="rc-btn rc-btn-ghost" style={{ width: "100%", justifyContent: "center", color: "#92400e" }} onClick={() => toast("Mark Not Applicable — local mock only")}>Mark Not Applicable</button>
                                <button className="rc-btn rc-btn-ghost" style={{ width: "100%", justifyContent: "center", color: "#991b1b" }} onClick={() => toast("Reject — local mock only")}>Reject</button>

                                <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 8, marginTop: 4 }}>
                                    <button className="rc-btn rc-btn-secondary" style={{ width: "100%", justifyContent: "center" }} onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2000); }}>
                                        {saved ? "Saved!" : "Save Draft"}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="ws-card">
                            <div className="ws-card-header">
                                <h3>Readiness to Provide</h3>
                            </div>
                            <div className="ws-card-body">
                                <div className="ws-readiness">
                                    <div className="ws-readiness-score">{rs.score}%</div>
                                    <div className="ws-readiness-bar">
                                        <div className="ws-readiness-fill" style={{ width: `${rs.score}%`, background: rs.score >= 80 ? "#166534" : rs.score >= 40 ? "#1d4ed8" : "#92400e" }} />
                                    </div>
                                    <div className="ws-readiness-label">{rs.label}</div>
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
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

import { useState, useMemo } from "react";
import { useNavigate, Routes, Route } from "react-router-dom";
import { getIntakeItems, isDemoActive, getDemoEngineSummary, publishIntake } from "../../services/recapDataService";
import type { RecapIntakeItem } from "../../services/recapDataService";
import RecapSubNav from "./RecapSubNav";
import "./Recapitalization.css";

interface Note {
    id: string;
    author: string;
    timestamp: string;
    body: string;
}

const DEFAULT_NOTES: Note[] = [
    { id: "n1", author: "David Park", timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), body: "Assigned to Sarah Chen for initial review" },
    { id: "n2", author: "Sarah Chen", timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), body: "Follow up with broker on file format" },
];

const SOURCE_CONFIG: Record<string, { icon: string; label: string; cssClass: string }> = {
    "Broker Upload": { icon: "\u{1F4E4}", label: "Broker Upload", cssClass: "rc-badge-import" },
    "External Question": { icon: "\u2753", label: "Question", cssClass: "rc-badge-external-question" },
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
};

const PRIORITY_BADGE: Record<string, string> = {
    High: "rc-badge-high",
    Medium: "rc-badge-medium",
    Low: "rc-badge-low",
};

const CARD_FILTER_MAP: Record<string, string | null> = {
    newRequests: "External New Request",
    questions: "External Question",
    clarifications: "External Clarification",
    accessRequests: "Access Request",
    brokerUploads: "Broker Upload",
    needsAssignment: "__needs_assignment__",
};

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return formatDate(iso);
}

function ImportModal({ onClose, onImport }: { onClose: () => void; onImport: (name: string) => void }) {
    const [fileName, setFileName] = useState("");
    const [importing, setImporting] = useState(false);

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) {
            setFileName(file.name);
            setImporting(true);
            setTimeout(() => {
                setImporting(false);
                onImport(file.name);
            }, 1200);
        }
    };

    return (
        <div className="rc-modal-overlay" onClick={onClose}>
            <div className="rc-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
                <div className="rc-modal-header">
                    <h2>Import DD Package</h2>
                    <button className="rc-modal-close" onClick={onClose}>&times;</button>
                </div>
                <div className="rc-modal-body" style={{ textAlign: "center", padding: "24px 20px" }}>
                    {importing ? (
                        <div>
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 12px" }}>
                                <polyline points="23 4 23 10 17 10" />
                                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                            </svg>
                            <p style={{ fontSize: 14, fontWeight: 600, color: "#1e293b" }}>Processing {fileName}...</p>
                            <p style={{ fontSize: 12, color: "#64748b" }}>Running classification engine...</p>
                            <div style={{ width: "100%", height: 6, background: "#e2e8f0", borderRadius: 3, marginTop: 12, overflow: "hidden" }}>
                                <div style={{ width: "70%", height: "100%", background: "#4f46e5", borderRadius: 3, animation: "none" }} />
                            </div>
                        </div>
                    ) : (
                        <div
                            style={{ border: "2px dashed #cbd5e1", borderRadius: 12, padding: "32px 20px", cursor: "pointer", transition: "border-color 0.2s" }}
                            onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = "#4f46e5"; }}
                            onDragLeave={(e) => { e.currentTarget.style.borderColor = "#cbd5e1"; }}
                            onDrop={handleDrop}
                            onClick={() => {
                                setFileName("ABC_Company_Portfolio_Gold_Standard_DD_Package.xlsx");
                                setImporting(true);
                                setTimeout(() => { setImporting(false); onImport("ABC_Company_Portfolio_Gold_Standard_DD_Package.xlsx"); }, 1200);
                            }}
                        >
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 8px" }}>
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="17 8 12 3 7 8" />
                                <line x1="12" y1="3" x2="12" y2="15" />
                            </svg>
                            <p style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", margin: 0 }}>Drop your DD package here</p>
                            <p style={{ fontSize: 11, color: "#64748b", margin: "4px 0 0" }}>or click to browse (mock import)</p>
                        </div>
                    )}
                </div>
                <div className="rc-modal-footer">
                    <button className="rc-btn rc-btn-ghost" onClick={onClose} disabled={importing}>Cancel</button>
                </div>
            </div>
        </div>
    );
}

function ReviewEngine() {
    const navigate = useNavigate();
    const [published, setPublished] = useState(false);
    const [publishing, setPublishing] = useState(false);

    const summary = getDemoEngineSummary();

    const handlePublish = () => {
        setPublishing(true);
        setTimeout(() => {
            publishIntake();
            setPublishing(false);
            setPublished(true);
        }, 1500);
    };

    if (published) {
        return (
            <div className="rc-page">
                <div className="rc-header">
                    <div className="rc-header-left">
                        <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => navigate("/recapitalization/intake")}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="19" y1="12" x2="5" y2="12" />
                                <polyline points="12 19 5 12 12 5" />
                            </svg>
                            Back to Intake
                        </button>
                    </div>
                </div>
                <div className="iq-review-placeholder">
                    <div className="iq-review-placeholder-icon">
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#166534" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                    </div>
                    <h2>Published to Tracker!</h2>
                    <p>{summary.total} DD requests are now available in the Request Tracker.</p>
                    <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                        <button className="rc-btn rc-btn-primary" onClick={() => navigate("/recapitalization/tracker")}>Open Tracker</button>
                        <button className="rc-btn rc-btn-secondary" onClick={() => navigate("/recapitalization/intake")}>Return to Intake Queue</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="rc-page">
            <RecapSubNav />
            <div className="rc-header">
                <div className="rc-header-left">
                    <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => navigate("/recapitalization/intake")}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="19" y1="12" x2="5" y2="12" />
                            <polyline points="12 19 5 12 12 5" />
                        </svg>
                        Back to Intake
                    </button>
                    <h1>Review &amp; Publish</h1>
                    <span className="rc-badge rc-badge-import" style={{ fontSize: 10 }}>ABC Company Portfolio</span>
                </div>
                <div className="rc-header-actions">
                    <button className="rc-btn rc-btn-ghost rc-btn-sm">Refresh</button>
                    <button className={`rc-btn ${publishing ? "rc-btn-secondary" : "rc-btn-primary"}`} onClick={handlePublish} disabled={publishing}>
                        {publishing ? "Publishing..." : `Publish ${summary.total} Requests`}
                    </button>
                </div>
            </div>

            {publishing && (
                <div style={{ padding: "8px 0", fontSize: 12, color: "#4f46e5", fontWeight: 600 }}>
                    Converting intake items to official DD requests...
                </div>
            )}

            <div className="rc-stats-row">
                <div className="rc-stat-card" style={{ borderLeft: "3px solid #4338ca" }}>
                    <span className="rc-stat-value">{summary.total}</span>
                    <span className="rc-stat-label">Total Items</span>
                </div>
                <div className="rc-stat-card" style={{ borderLeft: "3px solid #1d4ed8" }}>
                    <span className="rc-stat-value">{summary.needsReview}</span>
                    <span className="rc-stat-label">Needs Review</span>
                    <span className="rc-stat-desc">Items in Open status</span>
                </div>
                <div className="rc-stat-card" style={{ borderLeft: "3px solid #92400e" }}>
                    <span className="rc-stat-value">{summary.possibleDuplicates}</span>
                    <span className="rc-stat-label">Possible Duplicates</span>
                    <span className="rc-stat-desc">Flagged by engine</span>
                </div>
                <div className="rc-stat-card" style={{ borderLeft: "3px solid #92400e" }}>
                    <span className="rc-stat-value">{summary.needsFollowUp}</span>
                    <span className="rc-stat-label">Needs Follow-Up</span>
                    <span className="rc-stat-desc">Clarification recommended</span>
                </div>
                <div className="rc-stat-card" style={{ borderLeft: "3px solid #991b1b" }}>
                    <span className="rc-stat-value">{summary.critical}</span>
                    <span className="rc-stat-label">Critical</span>
                    <span className="rc-stat-desc">High priority, open/overdue</span>
                </div>
            </div>

            <div className="rc-two-col">
                <div className="rc-card">
                    <div className="rc-card-header">
                        <h2>Classification by Category</h2>
                    </div>
                    <div className="rc-card-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {Object.entries(summary.categories).map(([cat, count]) => (
                            <div key={cat} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <span style={{ width: 140, fontSize: 12, fontWeight: 600, color: "#475569", flexShrink: 0 }}>{cat}</span>
                                <div style={{ flex: 1, height: 8, background: "#f1f5f9", borderRadius: 4, overflow: "hidden" }}>
                                    <div style={{ height: "100%", width: `${(count / summary.total) * 100}%`, background: "#4338ca", borderRadius: 4 }} />
                                </div>
                                <span style={{ fontSize: 12, fontWeight: 600, color: "#64748b", minWidth: 30, textAlign: "right" }}>{count}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="rc-card">
                    <div className="rc-card-header">
                        <h2>Suggested Team Routing</h2>
                    </div>
                    <div className="rc-card-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {Object.entries(summary.teams).map(([team, count]) => (
                            <div key={team} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <span style={{ width: 140, fontSize: 12, fontWeight: 600, color: "#475569", flexShrink: 0 }}>{team}</span>
                                <div style={{ flex: 1, height: 8, background: "#f1f5f9", borderRadius: 4, overflow: "hidden" }}>
                                    <div style={{ height: "100%", width: `${(count / summary.total) * 100}%`, background: "#1d4ed8", borderRadius: 4 }} />
                                </div>
                                <span style={{ fontSize: 12, fontWeight: 600, color: "#64748b", minWidth: 30, textAlign: "right" }}>{count}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="rc-card">
                <div className="rc-card-header">
                    <h2>Engine Warnings</h2>
                </div>
                <div className="rc-card-body" style={{ padding: 0 }}>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: "1px solid #f1f5f9" }}>
                            <span style={{ fontSize: 16, lineHeight: 1 }}>&#9888;</span>
                            <div>
                                <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#92400e" }}>{summary.possibleDuplicates} possible duplicate{summary.possibleDuplicates !== 1 ? "s" : ""} detected</span>
                                <span style={{ display: "block", fontSize: 11, color: "#64748b" }}>These items may already exist in other transactions. Review recommended before publishing.</span>
                            </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: "1px solid #f1f5f9" }}>
                            <span style={{ fontSize: 16, lineHeight: 1 }}>&#9888;</span>
                            <div>
                                <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#92400e" }}>{summary.needsFollowUp} item{summary.needsFollowUp !== 1 ? "s" : ""} need{summary.needsFollowUp === 1 ? "s" : ""} follow-up clarification</span>
                                <span style={{ display: "block", fontSize: 11, color: "#64748b" }}>Some requests have incomplete or ambiguous descriptions. Consider clarifying before publishing.</span>
                            </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px" }}>
                            <span style={{ fontSize: 16, lineHeight: 1 }}>&#128200;</span>
                            <div>
                                <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#1d4ed8" }}>{Object.keys(summary.categories).length} categories detected</span>
                                <span style={{ display: "block", fontSize: 11, color: "#64748b" }}>Classification engine assigned categories and teams. Review routing suggestions below.</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function IntakeDrawer({
    item,
    onClose,
    notes,
    onAddNote,
}: {
    item: RecapIntakeItem;
    onClose: () => void;
    notes: Note[];
    onAddNote: (body: string) => void;
}) {
    const navigate = useNavigate();
    const config = SOURCE_CONFIG[item.type] || { icon: "\u2753", label: item.type, cssClass: "rc-badge-open" };
    const [newNoteText, setNewNoteText] = useState("");

    const handleAction = (action: string) => {
        if (action === "review") {
            navigate("/recapitalization/intake/review");
            return;
        }
    };

    const handleAddNote = () => {
        if (!newNoteText.trim()) return;
        onAddNote(newNoteText.trim());
        setNewNoteText("");
    };

    return (
        <>
            <div className="rc-drawer-overlay" onClick={onClose} />
            <div className="rc-drawer iq-drawer">
                <div className="rc-drawer-header">
                    <div>
                        <h2>{item.title}</h2>
                        <div className="rc-drawer-sub">
                            <span className={`rc-badge ${config.cssClass}`} style={{ fontSize: 10, marginRight: 8 }}>
                                {config.label}
                            </span>
                            <span className={`rc-badge ${STATUS_BADGE[item.status] || "rc-badge-open"}`} style={{ fontSize: 10 }}>
                                {item.status}
                            </span>
                        </div>
                    </div>
                    <button className="rc-drawer-close" onClick={onClose}>&times;</button>
                </div>
                <div className="rc-drawer-body">
                    <div className="rc-drawer-section">
                        <div className="rc-drawer-section-title">Summary</div>
                        <p style={{ fontSize: 13, color: "#334155", lineHeight: 1.5, margin: 0 }}>
                            {item.description}
                        </p>
                    </div>

                    <div className="rc-drawer-section">
                        <div className="rc-drawer-section-title">Original Submission</div>
                        <div className="iq-detail-grid">
                            <div className="rc-drawer-field">
                                <span className="rc-drawer-field-label">Source</span>
                                <span className="rc-drawer-field-value">{config.label}</span>
                            </div>
                            <div className="rc-drawer-field">
                                <span className="rc-drawer-field-label">Submitted By</span>
                                <span className="rc-drawer-field-value">{item.submittedBy}</span>
                            </div>
                            <div className="rc-drawer-field">
                                <span className="rc-drawer-field-label">Transaction</span>
                                <span className="rc-drawer-field-value">{item.transactionName}</span>
                            </div>
                            <div className="rc-drawer-field">
                                <span className="rc-drawer-field-label">Submitted</span>
                                <span className="rc-drawer-field-value">{formatDate(item.submittedAt)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="rc-drawer-section">
                        <div className="rc-drawer-section-title">Suggested by Classification Engine</div>
                        <div className="iq-detail-grid">
                            <div className="rc-drawer-field">
                                <span className="rc-drawer-field-label">Category</span>
                                <span className="rc-drawer-field-value">{item.suggestedCategory || "\u2014"}</span>
                            </div>
                            <div className="rc-drawer-field">
                                <span className="rc-drawer-field-label">Owner</span>
                                <span className="rc-drawer-field-value">{item.suggestedOwner || "\u2014"}</span>
                            </div>
                            <div className="rc-drawer-field">
                                <span className="rc-drawer-field-label">Team</span>
                                <span className="rc-drawer-field-value">{item.suggestedTeam || "\u2014"}</span>
                            </div>
                            <div className="rc-drawer-field">
                                <span className="rc-drawer-field-label">Priority</span>
                                {item.suggestedPriority ? (
                                    <span className={`rc-badge ${PRIORITY_BADGE[item.suggestedPriority]}`} style={{ fontSize: 10, alignSelf: "flex-start" }}>
                                        {item.suggestedPriority}
                                    </span>
                                ) : (
                                    <span className="rc-drawer-field-value">\u2014</span>
                                )}
                            </div>
                        </div>
                        {(item.suggestedCommunities?.length ?? 0) > 0 && (
                            <div className="rc-drawer-field" style={{ marginTop: 4 }}>
                                <span className="rc-drawer-field-label">Communities</span>
                                <div className="rc-flex-center" style={{ gap: 4, flexWrap: "wrap", marginTop: 2 }}>
                                    {item.suggestedCommunities!.map((c) => (
                                        <span key={c} className="rc-badge rc-badge-open" style={{ fontSize: 10, padding: "1px 6px" }}>
                                            {c}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <hr className="rc-divider" />

                    <div className="rc-drawer-section">
                        <div className="rc-drawer-section-title">Activity</div>
                        <div className="rc-timeline">
                            <div className="rc-timeline-item">
                                <div className="rc-timeline-dot" />
                                <div className="rc-timeline-line" />
                                <div className="rc-timeline-content">
                                    <span className="rc-timeline-desc">Submitted by {item.submittedBy}</span>
                                    <span className="rc-timeline-meta">{timeAgo(item.submittedAt)}</span>
                                </div>
                            </div>
                            <div className="rc-timeline-item">
                                <div className="rc-timeline-dot" style={{ background: "#e2e8f0" }} />
                                <div className="rc-timeline-content">
                                    <span className="rc-timeline-desc" style={{ color: "#64748b" }}>Awaiting review</span>
                                    <span className="rc-timeline-meta">Pending action</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <hr className="rc-divider" />

                    <div className="rc-drawer-section">
                        <div className="rc-drawer-section-title">Notes &amp; Comments</div>
                        <div className="rc-notes-section">
                            {notes.map((note) => (
                                <div key={note.id} className="rc-note-item">
                                    <div className="rc-note-header">
                                        <span className="rc-note-author">{note.author}</span>
                                        <span>{timeAgo(note.timestamp)}</span>
                                    </div>
                                    <div className="rc-note-body">{note.body}</div>
                                </div>
                            ))}
                            <div className="rc-note-input">
                                <textarea
                                    placeholder="Add a note..."
                                    value={newNoteText}
                                    onChange={(e) => setNewNoteText(e.target.value)}
                                />
                                <button className="rc-btn rc-btn-primary rc-btn-sm" onClick={handleAddNote} style={{ alignSelf: "flex-end" }}>
                                    Add Note
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="rc-drawer-actions iq-drawer-actions">
                    <button className="rc-btn rc-btn-primary rc-btn-sm" onClick={() => handleAction("review")}>
                        Open Review
                    </button>
                    <button className="rc-btn rc-btn-secondary rc-btn-sm" onClick={() => handleAction("assign")}>
                        Assign
                    </button>
                    <button className="rc-btn rc-btn-secondary rc-btn-sm" onClick={() => handleAction("route")}>
                        Route to Team
                    </button>
                    <button className="rc-btn rc-btn-secondary rc-btn-sm" onClick={() => handleAction("convert")}>
                        Convert to Official Request
                    </button>
                    <button className="rc-btn rc-btn-secondary rc-btn-sm" onClick={() => handleAction("respond")}>
                        Respond
                    </button>
                    <button className="rc-btn rc-btn-ghost rc-btn-sm" style={{ color: "#991b1b" }} onClick={() => handleAction("reject")}>
                        Reject
                    </button>
                    <button className="rc-btn rc-btn-ghost rc-btn-sm" style={{ color: "#92400e" }} onClick={() => handleAction("duplicate")}>
                        Mark Duplicate
                    </button>
                    <button className="rc-btn rc-btn-ghost rc-btn-sm" style={{ color: "#92400e" }} onClick={() => handleAction("na")}>
                        Mark Not Applicable
                    </button>
                </div>
            </div>
        </>
    );
}

export default function RecapitalizationIntake() {
    return (
        <Routes>
            <Route index element={<IntakeQueue />} />
            <Route path="review" element={<ReviewEngine />} />
        </Routes>
    );
}

function IntakeQueue() {
    const navigate = useNavigate();
    const [selectedItem, setSelectedItem] = useState<RecapIntakeItem | null>(null);
    const [filterType, setFilterType] = useState<string>("All");
    const [searchQuery, setSearchQuery] = useState("");
    const [activeCardFilter, setActiveCardFilter] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [notesByItem, setNotesByItem] = useState<Record<string, Note[]>>({});
    const [importModalOpen, setImportModalOpen] = useState(false);

    const allItems = useMemo(() => getIntakeItems(), []);

    const stats = useMemo(() => {
        return {
            newRequests: allItems.filter((i) => i.type === "External New Request" && i.status === "Awaiting Review").length,
            questions: allItems.filter((i) => i.type === "External Question" && i.status === "Awaiting Review").length,
            clarifications: allItems.filter((i) => i.type === "External Clarification" && i.status === "Awaiting Review").length,
            accessRequests: allItems.filter((i) => i.type === "Access Request" && i.status === "Awaiting Review").length,
            brokerUploads: allItems.filter((i) => i.type === "Broker Upload" && i.status === "Awaiting Review").length,
            needsAssignment: allItems.filter((i) => !i.assignedTo && (i.status === "Awaiting Review" || i.status === "Assigned")).length,
        };
    }, [allItems]);

    const visibleItems = useMemo(() => {
        let result = allItems;
        if (activeCardFilter === "__needs_assignment__") {
            result = result.filter((i) => !i.assignedTo && (i.status === "Awaiting Review" || i.status === "Assigned"));
        } else if (activeCardFilter) {
            result = result.filter((i) => i.type === activeCardFilter);
        } else if (filterType !== "All") {
            result = result.filter((i) => i.type === filterType);
        }
        if (!searchQuery.trim()) return result;
        const q = searchQuery.toLowerCase();
        return result.filter(
            (i) =>
                i.title.toLowerCase().includes(q) ||
                i.description.toLowerCase().includes(q) ||
                i.transactionName.toLowerCase().includes(q) ||
                i.submittedBy.toLowerCase().includes(q),
        );
    }, [allItems, activeCardFilter, filterType, searchQuery]);

    const allVisibleSelected = visibleItems.length > 0 && visibleItems.every((i) => selectedIds.has(i.id));

    const handleCardFilter = (key: string) => {
        const mappedType = CARD_FILTER_MAP[key];
        if (activeCardFilter === mappedType) {
            setActiveCardFilter(null);
            setFilterType("All");
        } else {
            setActiveCardFilter(mappedType);
            if (mappedType && mappedType !== "__needs_assignment__") {
                setFilterType(mappedType);
            }
        }
    };

    const handleDropdownChange = (value: string) => {
        setFilterType(value);
        setActiveCardFilter(null);
    };

    const clearCardFilter = () => {
        setActiveCardFilter(null);
        setFilterType("All");
    };

    const toggleSelect = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const handleSelectAll = () => {
        if (allVisibleSelected) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(visibleItems.map((i) => i.id)));
        }
    };

    const clearSelection = () => {
        setSelectedIds(new Set());
    };

    const handleRowClick = (item: RecapIntakeItem) => {
        if (item.type === "Broker Upload") {
            setSelectedItem(item);
            if (!notesByItem[item.id]) {
                setNotesByItem((prev) => ({
                    ...prev,
                    [item.id]: DEFAULT_NOTES,
                }));
            }
        } else {
            navigate(`/recapitalization/workspace/${item.intakeId}`);
        }
    };

    const handleAddNote = (itemId: string, body: string) => {
        const note: Note = {
            id: `n-${Date.now()}`,
            author: "Current User",
            timestamp: new Date().toISOString(),
            body,
        };
        setNotesByItem((prev) => ({
            ...prev,
            [itemId]: [...(prev[itemId] || DEFAULT_NOTES), note],
        }));
    };

    return (
        <div className="rc-page iq-page">
            <RecapSubNav />

            <div className="rc-header">
                <div className="rc-header-left">
                    <h1>Intake Queue</h1>
                    {isDemoActive() && <span className="rc-badge rc-badge-visible" style={{ fontSize: 10, marginLeft: 8 }}>ABC Demo Active</span>}
                    <span className="rc-badge rc-badge-import" style={{ fontSize: 11, padding: "3px 10px" }}>
                        Command Center
                    </span>
                </div>
                <div className="rc-header-actions">
                    <button className="rc-btn rc-btn-ghost rc-btn-sm">Refresh</button>
                    <button className="rc-btn rc-btn-secondary rc-btn-sm" onClick={() => setImportModalOpen(true)}>Import DD Package</button>
                    <button className="rc-btn rc-btn-secondary rc-btn-sm">New Intake Item</button>
                </div>
            </div>

            <div className="iq-stats-row">
                <div
                    className={`iq-stat-card iq-stat-blue ${activeCardFilter === "External New Request" ? "iq-stat-filtered" : ""}`}
                    onClick={() => handleCardFilter("newRequests")}
                >
                    <div className="iq-stat-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                            <line x1="3" y1="9" x2="21" y2="9" />
                            <line x1="9" y1="21" x2="9" y2="9" />
                        </svg>
                    </div>
                    <span className="iq-stat-count">{stats.newRequests}</span>
                    <span className="iq-stat-label">New DD Requests</span>
                </div>
                <div
                    className={`iq-stat-card iq-stat-green ${activeCardFilter === "External Question" ? "iq-stat-filtered" : ""}`}
                    onClick={() => handleCardFilter("questions")}
                >
                    <div className="iq-stat-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#166534" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                            <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                    </div>
                    <span className="iq-stat-count">{stats.questions}</span>
                    <span className="iq-stat-label">Questions</span>
                </div>
                <div
                    className={`iq-stat-card iq-stat-amber ${activeCardFilter === "External Clarification" ? "iq-stat-filtered" : ""}`}
                    onClick={() => handleCardFilter("clarifications")}
                >
                    <div className="iq-stat-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                            <line x1="12" y1="9" x2="12" y2="13" />
                            <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                    </div>
                    <span className="iq-stat-count">{stats.clarifications}</span>
                    <span className="iq-stat-label">Clarifications</span>
                </div>
                <div
                    className={`iq-stat-card iq-stat-gray ${activeCardFilter === "Access Request" ? "iq-stat-filtered" : ""}`}
                    onClick={() => handleCardFilter("accessRequests")}
                >
                    <div className="iq-stat-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                    </div>
                    <span className="iq-stat-count">{stats.accessRequests}</span>
                    <span className="iq-stat-label">Access Requests</span>
                </div>
                <div
                    className={`iq-stat-card iq-stat-indigo ${activeCardFilter === "Broker Upload" ? "iq-stat-filtered" : ""}`}
                    onClick={() => handleCardFilter("brokerUploads")}
                >
                    <div className="iq-stat-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4338ca" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                            <polyline points="13 2 13 9 20 9" />
                            <path d="M9 15l3 3 3-3" />
                            <path d="M12 12v6" />
                        </svg>
                    </div>
                    <span className="iq-stat-count">{stats.brokerUploads}</span>
                    <span className="iq-stat-label">Broker Uploads Ready</span>
                </div>
                <div
                    className={`iq-stat-card iq-stat-rose ${activeCardFilter === "__needs_assignment__" ? "iq-stat-filtered" : ""}`}
                    onClick={() => handleCardFilter("needsAssignment")}
                >
                    <div className="iq-stat-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#be123c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                    </div>
                    <span className="iq-stat-count">{stats.needsAssignment}</span>
                    <span className="iq-stat-label">Needs Assignment</span>
                </div>
            </div>

            <div className="iq-inbox-section">
                <div className="rc-card">
                    <div className="rc-card-header">
                        <h2>
                            Intake Inbox
                            <span className="rc-text-muted" style={{ marginLeft: 8, fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
                                {visibleItems.length} items
                            </span>
                            {activeCardFilter && (
                                <button className="rc-clear-filter" onClick={clearCardFilter} style={{ marginLeft: 8 }}>
                                    Clear filter
                                </button>
                            )}
                        </h2>
                        <div className="rc-flex-center" style={{ gap: 8 }}>
                            <div className="iq-search-box">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="11" cy="11" r="8" />
                                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                </svg>
                                <input
                                    type="text"
                                    placeholder="Search intake..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <select
                                className="rc-filter-select"
                                value={filterType}
                                onChange={(e) => handleDropdownChange(e.target.value)}
                                style={{ minWidth: 140 }}
                            >
                                <option value="All">All Sources</option>
                                <option value="Broker Upload">Broker Upload</option>
                                <option value="External Question">External Question</option>
                                <option value="External Clarification">External Clarification</option>
                                <option value="External New Request">External New Request</option>
                                <option value="Access Request">Access Request</option>
                                <option value="Manual Internal Request">Manual Internal Request</option>
                            </select>
                        </div>
                    </div>

                    {selectedIds.size > 0 && (
                        <div className="rc-bulk-bar">
                            <span>
                                <span className="rc-bulk-count">{selectedIds.size}</span> selected
                            </span>
                            <div className="rc-bulk-sep" />
                            <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => alert("Assign action")}>Assign</button>
                            <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => alert("Route to Team action")}>Route to Team</button>
                            <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => alert("Mark Duplicate action")}>Mark Duplicate</button>
                            <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => alert("Mark Not Applicable action")}>Mark Not Applicable</button>
                            <button className="rc-btn rc-btn-ghost rc-btn-sm" style={{ color: "#991b1b" }} onClick={() => alert("Reject action")}>Reject</button>
                            <div className="rc-bulk-sep" />
                            <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={clearSelection}>Clear Selection</button>
                        </div>
                    )}

                    <div className="rc-card-body" style={{ padding: 0 }}>
                        {visibleItems.length > 0 ? (
                            <table className="rc-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: 16, paddingRight: 4 }}>
                                            <input
                                                type="checkbox"
                                                className="rc-checkbox-header"
                                                checked={allVisibleSelected}
                                                onChange={handleSelectAll}
                                            />
                                        </th>
                                        <th>Intake ID</th>
                                        <th>Type</th>
                                        <th>Title</th>
                                        <th>Transaction</th>
                                        <th>Source</th>
                                        <th>Community</th>
                                        <th>Submitted</th>
                                        <th>Status</th>
                                        <th>Assigned To</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {visibleItems.map((item, idx) => {
                                        const config = SOURCE_CONFIG[item.type] || { icon: "\u2753", label: item.type, cssClass: "rc-badge-open" };
                                        const isBrokerUpload = item.type === "Broker Upload";
                                        const rowBg = isBrokerUpload
                                            ? (idx % 2 === 1 ? "#edf2ff" : "#f8faff")
                                            : (idx % 2 === 1 ? "#fafbfc" : undefined);
                                        return (
                                            <tr
                                                key={item.id}
                                                className="rc-row-clickable"
                                                onClick={() => handleRowClick(item)}
                                                style={rowBg ? { background: rowBg } : undefined}
                                            >
                                                <td style={{ width: 16, paddingRight: 4 }} onClick={(e) => e.stopPropagation()}>
                                                    <input
                                                        type="checkbox"
                                                        className="rc-checkbox"
                                                        checked={selectedIds.has(item.id)}
                                                        onChange={() => toggleSelect(item.id)}
                                                    />
                                                </td>
                                                <td style={{ fontFamily: '"SF Mono", "Cascadia Code", "Consolas", monospace', fontSize: 12, fontWeight: 700, color: "#0f172a" }}>
                                                    {item.intakeId}
                                                </td>
                                                <td>
                                                    <span className={`rc-badge ${config.cssClass}`} style={{ fontSize: 10 }}>
                                                        {config.label}
                                                    </span>
                                                </td>
                                                <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600, color: "#0f172a" }}>
                                                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                        {isBrokerUpload && (
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4338ca" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                                                <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                                                                <polyline points="13 2 13 9 20 9" />
                                                            </svg>
                                                        )}
                                                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                            {isBrokerUpload ? (item.fileName || item.title) : item.title}
                                                        </span>
                                                    </span>
                                                </td>
                                                <td style={{ maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#475569" }}>
                                                    {item.transactionName}
                                                </td>
                                                <td style={{ color: "#475569" }}>{item.submittedBy}</td>
                                                <td style={{ maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#475569", fontSize: 12 }}>
                                                    {item.communityNames.length > 0
                                                        ? item.communityNames.slice(0, 2).join(", ") + (item.communityNames.length > 2 ? ` +${item.communityNames.length - 2}` : "")
                                                        : "\u2014"}
                                                </td>
                                                <td style={{ color: "#64748b", fontSize: 12 }}>{timeAgo(item.submittedAt)}</td>
                                                <td>
                                                    <span className={`rc-badge ${STATUS_BADGE[item.status] || "rc-badge-open"}`} style={{ fontSize: 10 }}>
                                                        {item.status}
                                                    </span>
                                                </td>
                                                <td style={{ fontSize: 12 }}>
                                                    {item.assignedTo || (
                                                        <span style={{ color: "#d97706", fontWeight: 600 }}>Unassigned</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        ) : (
                            <div className="iq-empty-inbox">
                                <div className="iq-empty-icon">
                                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
                                        <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
                                    </svg>
                                </div>
                                <span className="iq-empty-title">All caught up!</span>
                                <span className="iq-empty-sub">No items match your current filter.</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {selectedItem && (
                <IntakeDrawer
                    item={selectedItem}
                    onClose={() => setSelectedItem(null)}
                    notes={notesByItem[selectedItem.id] || DEFAULT_NOTES}
                    onAddNote={(body) => handleAddNote(selectedItem.id, body)}
                />
            )}

            {importModalOpen && (
                <ImportModal
                    onClose={() => setImportModalOpen(false)}
                    onImport={(name) => {
                        setImportModalOpen(false);
                    }}
                />
            )}
        </div>
    );
}

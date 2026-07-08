import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getPortalRequests, partnerApproveRequest, partnerReworkRequest } from "../../services/portalMockData";
import { getExternalMessages, getWorkArtifactsByRequest } from "../../services/recapDataService";
import "./PortalOverview.css";

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    Published: { bg: "#f0fdf4", text: "#166534", border: "#bbf7d0" },
    "Waiting Review": { bg: "#eff6ff", text: "#1e40af", border: "#bfdbfe" },
    Approved: { bg: "#f0fdf4", text: "#166534", border: "#bbf7d0" },
    "Rework Required": { bg: "#fff7ed", text: "#9a3412", border: "#fed7aa" },
    "In Progress": { bg: "#eff6ff", text: "#1e40af", border: "#bfdbfe" },
    "Intake Review": { bg: "#faf5ff", text: "#6b21a8", border: "#ddd6fe" },
    "Work Queue": { bg: "#fef3c7", text: "#92400e", border: "#fde68a" },
    "Quality Review": { bg: "#fffbeb", text: "#92400e", border: "#fde68a" },
    "Action Needed": { bg: "#fff7ed", text: "#9a3412", border: "#fed7aa" },
    Closed: { bg: "#f1f5f9", text: "#475569", border: "#e2e8f0" },
    "Closed / Duplicate": { bg: "#f1f5f9", text: "#475569", border: "#e2e8f0" },
    "Closed / Not Applicable": { bg: "#f1f5f9", text: "#475569", border: "#e2e8f0" },
};

function StatusBadge({ status }: { status: string }) {
    const c = STATUS_COLORS[status] || { bg: "#f8fafc", text: "#475569", border: "#e2e8f0" };
    return (
        <span className="po-status-badge" style={{ background: c.bg, color: c.text, borderColor: c.border }}>
            {status}
        </span>
    );
}

const STATUS_PROGRESS: Record<string, { step: number; label: string }> = {
    "Intake Review": { step: 1, label: "Intake Review" },
    "Work Queue": { step: 2, label: "Work Queue" },
    "In Progress": { step: 3, label: "In Progress" },
    "Quality Review": { step: 4, label: "Quality Review" },
    Published: { step: 5, label: "Published" },
    "Waiting Review": { step: 6, label: "Waiting Review" },
    Approved: { step: 7, label: "Approved" },
    "Rework Required": { step: 7, label: "Rework Required" },
};

const TRACKER_STEPS = [
    { step: 1, label: "Intake Review" },
    { step: 2, label: "Work Queue" },
    { step: 3, label: "In Progress" },
    { step: 4, label: "Quality Review" },
    { step: 5, label: "Published" },
    { step: 6, label: "Partner Review" },
];

function StatusTracker({ status }: { status: string }) {
    const current = STATUS_PROGRESS[status];
    if (!current) return null;
    const isPartnerStatus = status === "Waiting Review" || status === "Approved" || status === "Rework Required";
    return (
        <div style={{ marginBottom: 20 }}>
            <div className="po-tracker">
                {TRACKER_STEPS.map((s) => {
                    const isDone = s.step < current.step;
                    const isActive = s.step === current.step;
                    const dotClass = isDone ? "po-tracker-dot--done" : isActive ? "po-tracker-dot--active" : "";
                    const labelClass = isActive ? "po-tracker-label--active" : "";
                    return (
                        <div key={s.step} className="po-tracker-step">
                            {s.step < TRACKER_STEPS.length && (
                                <div className={`po-tracker-line${isDone ? " po-tracker-line--done" : ""}`} />
                            )}
                            <div className={`po-tracker-dot ${dotClass}`}>
                                {isDone ? "\u2713" : isActive ? "\u25CF" : s.step}
                            </div>
                            <span className={`po-tracker-label ${labelClass}`}>{s.label}</span>
                        </div>
                    );
                })}
            </div>
            <div style={{
                marginTop: 16, padding: "16px 20px",
                background: isPartnerStatus ? "linear-gradient(135deg, #f0fdf4, #faf5ff)" : "#f0f4ff",
                borderRadius: 12,
                border: `1px solid ${STATUS_COLORS[status]?.border || "#c7d2fe"}`,
            }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", display: "block", marginBottom: 6 }}>
                    {status === "Waiting Review" ? "Awaiting Your Review" : `Current Status: ${status}`}
                </div>
                <div style={{ fontSize: 14, color: "#334155", lineHeight: 1.5, display: "block" }}>
                    {status === "Intake Review" && "Your submission is being reviewed by the IntegraCare team to validate the request details. No action is needed from you at this time."}
                    {status === "Work Queue" && "This request has been accepted and is queued for assignment to a reviewer. You will be notified when work begins."}
                    {status === "In Progress" && "This request is actively being worked on by the IntegraCare team. Check back for updates."}
                    {status === "Quality Review" && "The work is complete and is undergoing a final quality review before publication."}
                    {status === "Published" && "The artifacts for this request are available. The team will be notified when you complete your review."}
                    {status === "Waiting Review" && "Due diligence artifacts are ready for your review. Please review the supporting materials and approve or request rework."}
                    {status === "Approved" && "You have approved this request. The IntegraCare team has been notified of your decision."}
                    {status === "Rework Required" && "You have requested rework on this request. The IntegraCare team will address your feedback."}
                    {status === "Action Needed" && "Additional information is needed from your side. Please check for open clarifications and respond promptly."}
                    {status === "Closed" && "This request has been closed. Contact the DD team if you have questions."}
                    {!["Intake Review", "Work Queue", "In Progress", "Quality Review", "Action Needed", "Closed", "Published", "Waiting Review", "Approved", "Rework Required"].includes(status) && "IntegraCare is processing this request."}
                </div>
            </div>
        </div>
    );
}

/* ── Partner Review Modal ── */
function PartnerReviewModal({
    mode,
    onClose,
    onConfirm,
}: {
    mode: "approve" | "rework";
    onClose: () => void;
    onConfirm: (comment?: string) => void;
}) {
    const [comment, setComment] = useState("");

    return (
        <div style={{ position: "fixed", inset: 0, zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(15, 23, 42, 0.4)", backdropFilter: "blur(2px)" }}>
            <div style={{
                background: "#fff", borderRadius: 20, maxWidth: 480, width: "90%",
                boxShadow: "0 20px 60px rgba(0,0,0,0.2)", overflow: "hidden",
                border: `2px solid ${mode === "approve" ? "#bbf7d0" : "#fed7aa"}`,
            }}>
                <div style={{ padding: "28px 28px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                        <div style={{
                            width: 40, height: 40, borderRadius: "50%",
                            background: mode === "approve" ? "#f0fdf4" : "#fff7ed",
                            color: mode === "approve" ? "#166534" : "#9a3412",
                            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
                        }}>
                            {mode === "approve" ? "\u2713" : "\u21BA"}
                        </div>
                        <div>
                            <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>
                                {mode === "approve" ? "Approve This Request" : "Request Rework"}
                            </div>
                            <div style={{ fontSize: 13, color: "#475569", marginTop: 2 }}>
                                {mode === "approve"
                                    ? "Confirm the artifacts meet your requirements."
                                    : "Provide feedback on what needs to change."}
                            </div>
                        </div>
                    </div>
                    {mode === "rework" && (
                        <div style={{ marginTop: 16 }}>
                            <label style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", display: "block", marginBottom: 6 }}>
                                Reason for rework <span style={{ color: "#991b1b" }}>*</span>
                            </label>
                            <textarea
                                value={comment}
                                onChange={e => setComment(e.target.value)}
                                placeholder="Describe what changes are needed..."
                                rows={4}
                                style={{
                                    width: "100%", padding: "12px 14px", fontSize: 14,
                                    border: "1px solid #c7d2fe", borderRadius: 10,
                                    outline: "none", resize: "vertical",
                                    fontFamily: "inherit", boxSizing: "border-box",
                                }}
                            />
                        </div>
                    )}
                    {mode === "approve" && (
                        <div style={{ marginTop: 16 }}>
                            <label style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", display: "block", marginBottom: 6 }}>
                                Comment (optional)
                            </label>
                            <textarea
                                value={comment}
                                onChange={e => setComment(e.target.value)}
                                placeholder="Add any additional comments..."
                                rows={3}
                                style={{
                                    width: "100%", padding: "12px 14px", fontSize: 14,
                                    border: "1px solid #c7d2fe", borderRadius: 10,
                                    outline: "none", resize: "vertical",
                                    fontFamily: "inherit", boxSizing: "border-box",
                                }}
                            />
                        </div>
                    )}
                </div>
                <div style={{ padding: "16px 28px 24px", display: "flex", justifyContent: "flex-end", gap: 10 }}>
                    <button className="rc-btn rc-btn-secondary" onClick={onClose} style={{ padding: "10px 20px", fontSize: 13, fontWeight: 600, borderRadius: 10, background: "#fff", border: "1px solid #c7d2fe" }}>
                        Cancel
                    </button>
                    <button
                        className="rc-btn rc-btn-primary"
                        onClick={() => onConfirm(comment || undefined)}
                        disabled={mode === "rework" && !comment.trim()}
                        style={{
                            padding: "10px 24px", fontSize: 13, fontWeight: 700, borderRadius: 10,
                            background: mode === "approve" ? "#166534" : "#ea580c",
                            border: "none", color: "#fff", cursor: "pointer",
                            opacity: mode === "rework" && !comment.trim() ? 0.5 : 1,
                        }}
                    >
                        {mode === "approve" ? "Confirm Approval" : "Submit Rework Request"}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function PortalRequestDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const allRequests = getPortalRequests();

    const req = allRequests.find((r) => r.id === id);
    const externalMessages = req ? getExternalMessages(req.id) : [];
    const publishedArtifacts = req ? getWorkArtifactsByRequest(req.requestId) : [];

    const [showScrollMore, setShowScrollMore] = useState(true);
    const [modalMode, setModalMode] = useState<"approve" | "rework" | null>(null);

    const handleApprove = (comment?: string) => {
        if (!req) return;
        partnerApproveRequest(req.id, comment);
        setModalMode(null);
    };

    const handleRework = (reason?: string) => {
        if (!req) return;
        if (reason) partnerReworkRequest(req.id, reason);
        setModalMode(null);
    };

    useEffect(() => {
        const handleScroll = () => {
            if (window.scrollY > 150) setShowScrollMore(false);
        };
        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    if (!req) {
        return (
            <div className="portal-overview">
                <div style={{ padding: 24, textAlign: "center" }}>
                    <h1 className="po-welcome-title">Request not found</h1>
                    <p className="po-welcome-sub" style={{ marginBottom: 20 }}>The request you are looking for does not exist or has been removed.</p>
                    <button className="rc-btn rc-btn-primary" onClick={() => navigate("/portal/requests")}>Back to Requests</button>
                </div>
            </div>
        );
    }

    const statusColor = (STATUS_COLORS[req.status] || STATUS_COLORS["Closed"]);

    return (
        <div className="portal-overview">
            {/* ── Top Back Bar ── */}
            <div style={{ marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <button className="rc-btn rc-btn-secondary" onClick={() => navigate(-1)} style={{ fontSize: 13, padding: "8px 16px", border: "1px solid #c7d2fe", background: "#fff", borderRadius: 10, fontWeight: 600 }}>
                    &larr; Back
                </button>
                <span className="po-requests-id" style={{ fontSize: 12, background: "#eef2ff", color: "#4338ca", padding: "4px 12px", borderRadius: 8, fontWeight: 600 }}>{req.requestId}</span>
            </div>

            {/* ── Hero / Summary Card ── */}
            <div className="po-detail-summary" style={{ marginBottom: 20 }}>
                <div style={{
                    position: "absolute", top: 0, left: 0, right: 0, height: 4,
                    background: `linear-gradient(90deg, ${statusColor.text}, ${statusColor.border})`,
                }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <h1 style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", margin: "0 0 4px", letterSpacing: "-0.02em" }}>{req.title}</h1>
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 6 }}>
                            <span style={{ fontSize: 13, color: "#475569" }}>{req.transactionName}</span>
                            {req.communityNames[0] && (
                                <>
                                    <span style={{ fontSize: 13, color: "#475569" }}>&middot;</span>
                                    <span style={{ fontSize: 13, color: "#475569" }}>{req.communityNames[0]}</span>
                                </>
                            )}
                        </div>
                    </div>
                    <StatusBadge status={req.status} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                    <div style={{ padding: "12px 14px", background: "#fff", borderRadius: 10, border: "1px solid #e0e7ff" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em", display: "block", marginBottom: 2 }}>Category</span>
                        <span style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{req.category || "\u2014"}</span>
                    </div>
                    <div style={{ padding: "12px 14px", background: "#fff", borderRadius: 10, border: "1px solid #e0e7ff" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em", display: "block", marginBottom: 2 }}>Priority</span>
                        <span style={{ fontSize: 14, fontWeight: 600, color: req.priority === "High" ? "#991b1b" : req.priority === "Low" ? "#166534" : "#92400e" }}>{req.priority || "\u2014"}</span>
                    </div>
                    <div style={{ padding: "12px 14px", background: "#fff", borderRadius: 10, border: "1px solid #e0e7ff" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em", display: "block", marginBottom: 2 }}>Submitted</span>
                        <span style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{req.submittedAt || "\u2014"}</span>
                    </div>
                    <div style={{ padding: "12px 14px", background: "#fff", borderRadius: 10, border: "1px solid #e0e7ff" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em", display: "block", marginBottom: 2 }}>Last Updated</span>
                        <span style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{req.updatedAt || req.neededBy || "\u2014"}</span>
                    </div>
                    <div style={{ padding: "12px 14px", background: "#fff", borderRadius: 10, border: "1px solid #e0e7ff" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em", display: "block", marginBottom: 2 }}>Transaction</span>
                        <span style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{req.transactionName}</span>
                    </div>
                    <div style={{ padding: "12px 14px", background: "#fff", borderRadius: 10, border: "1px solid #e0e7ff" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em", display: "block", marginBottom: 2 }}>Community</span>
                        <span style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{req.communityNames[0] || "\u2014"}</span>
                    </div>
                </div>
            </div>

            {/* ── Two-Column Lower Section ── */}
            <div className="po-detail-columns">
                {/* ── Left Column ── */}
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    {/* ── Status Tracker ── */}
                    {STATUS_PROGRESS[req.status] && <StatusTracker status={req.status} />}

                    {/* ── Supporting Artifacts ── */}
                    {publishedArtifacts.length > 0 && (
                        <div className="po-detail-card" style={{ borderLeft: req._publishedExternal ? "4px solid #166534" : undefined }}>
                            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", margin: "0 0 16px", display: "flex", alignItems: "center", gap: 10 }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4338ca" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><polyline points="13 2 13 9 20 9" /></svg>
                                Supporting Artifacts
                                <span style={{ fontSize: 12, fontWeight: 600, color: "#4338ca", background: "#eef2ff", padding: "2px 10px", borderRadius: 10 }}>{publishedArtifacts.length}</span>
                            </h3>
                            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                {publishedArtifacts.map((art) => (
                                    <div key={art.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", borderRadius: 8, transition: "background 0.15s", background: req._publishedExternal ? "#f0f4ff" : undefined }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4338ca" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
                                            </svg>
                                            <div>
                                                <span style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{art.name}</span>
                                                {art.size > 0 && <span style={{ fontSize: 12, color: "#475569", marginLeft: 6, fontWeight: 500 }}>{art.size >= 1048576 ? `${(art.size / 1048576).toFixed(1)} MB` : art.size >= 1024 ? `${(art.size / 1024).toFixed(0)} KB` : `${art.size} B`}</span>}
                                            </div>
                                        </div>
                                        <span style={{ fontSize: 12, color: "#475569", fontStyle: "italic" }}>Available</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Scroll More Cue ── */}
                    {showScrollMore && (
                        <div style={{
                            textAlign: "center", fontSize: 12, color: "#475569", padding: "4px 0 12px",
                            opacity: showScrollMore ? 1 : 0,
                            transition: "opacity 0.4s ease",
                            animation: "po-fade-in 0.6s ease",
                        }}>
                            More details below &darr;
                        </div>
                    )}
                </div>

                {/* ── Right Column ── */}
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    {/* ── Approve / Rework Action Buttons ── */}
                    {req.status === "Waiting Review" && req._publishedExternal && (
                        <div style={{ border: "2px solid #bbf7d0", borderRadius: 16, padding: 24, background: "linear-gradient(135deg, #f0fdf4 0%, #faf5ff 100%)" }}>
                            <div style={{ fontSize: 16, fontWeight: 800, color: "#166534", marginBottom: 8, textAlign: "center" }}>
                                Review Completed?
                            </div>
                            <div style={{ fontSize: 14, color: "#334155", marginBottom: 20, textAlign: "center", lineHeight: 1.5 }}>
                                Once you have reviewed all artifacts, choose an action below.
                            </div>
                            <div style={{ display: "flex", gap: 12 }}>
                                <button
                                    onClick={() => setModalMode("approve")}
                                    style={{
                                        flex: 1, padding: "14px 16px", fontSize: 15, fontWeight: 700, borderRadius: 12,
                                        border: "2px solid #166534", background: "#f0fdf4", color: "#166534",
                                        cursor: "pointer", transition: "all 0.15s",
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = "#166534"; e.currentTarget.style.color = "#fff"; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = "#f0fdf4"; e.currentTarget.style.color = "#166534"; }}
                                >
                                    Approve
                                </button>
                                <button
                                    onClick={() => setModalMode("rework")}
                                    style={{
                                        flex: 1, padding: "14px 16px", fontSize: 15, fontWeight: 700, borderRadius: 12,
                                        border: "2px solid #ea580c", background: "#fff7ed", color: "#9a3412",
                                        cursor: "pointer", transition: "all 0.15s",
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = "#ea580c"; e.currentTarget.style.color = "#fff"; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = "#fff7ed"; e.currentTarget.style.color = "#9a3412"; }}
                                >
                                    Request Rework
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── Approved Panel ── */}
                    {req.status === "Approved" && req._publishedExternal && (
                        <div style={{ border: "2px solid #bbf7d0", borderRadius: 16, padding: 24, background: "linear-gradient(135deg, #f0fdf4 0%, #faf5ff 100%)" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                                <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#166534", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                                    {"\u2713"}
                                </div>
                                <div>
                                    <div style={{ fontSize: 18, fontWeight: 800, color: "#166534" }}>Approved</div>
                                    <div style={{ fontSize: 13, color: "#475569", marginTop: 2 }}>Request approved by partner</div>
                                </div>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {req._completedBy && (
                                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "8px 0", borderBottom: "1px solid #dcfce7" }}>
                                        <span style={{ color: "#475569", fontWeight: 600 }}>Approved by</span>
                                        <span style={{ color: "#0f172a", fontWeight: 600 }}>{req._completedBy}</span>
                                    </div>
                                )}
                                {req._completedAt && (
                                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "8px 0", borderBottom: "1px solid #dcfce7" }}>
                                        <span style={{ color: "#475569", fontWeight: 600 }}>Approved on</span>
                                        <span style={{ color: "#0f172a", fontWeight: 600 }}>{req._completedAt}</span>
                                    </div>
                                )}
                                {req._completionNotes && (
                                    <div style={{ fontSize: 13, padding: "8px 0" }}>
                                        <span style={{ color: "#475569", fontWeight: 600, display: "block", marginBottom: 4 }}>Comment</span>
                                        <span style={{ color: "#334155", fontStyle: "italic" }}>{req._completionNotes}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── Rework Required Panel ── */}
                    {req.status === "Rework Required" && req._publishedExternal && (
                        <div style={{ border: "2px solid #fed7aa", borderRadius: 16, padding: 24, background: "linear-gradient(135deg, #fff7ed 0%, #fffbeb 100%)" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                                <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#ea580c", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                                    {"\u21BA"}
                                </div>
                                <div>
                                    <div style={{ fontSize: 18, fontWeight: 800, color: "#9a3412" }}>Rework Required</div>
                                    <div style={{ fontSize: 13, color: "#475569", marginTop: 2 }}>Partner requested changes</div>
                                </div>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {req._returnedBy && (
                                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "8px 0", borderBottom: "1px solid #fed7aa" }}>
                                        <span style={{ color: "#475569", fontWeight: 600 }}>Requested by</span>
                                        <span style={{ color: "#0f172a", fontWeight: 600 }}>{req._returnedBy}</span>
                                    </div>
                                )}
                                {req._completedAt && (
                                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "8px 0", borderBottom: "1px solid #fed7aa" }}>
                                        <span style={{ color: "#475569", fontWeight: 600 }}>Requested on</span>
                                        <span style={{ color: "#0f172a", fontWeight: 600 }}>{req._completedAt}</span>
                                    </div>
                                )}
                                {req._returnReason && (
                                    <div style={{ fontSize: 13, padding: "8px 0" }}>
                                        <span style={{ color: "#475569", fontWeight: 600, display: "block", marginBottom: 4 }}>Reason</span>
                                        <span style={{ color: "#9a3412", fontWeight: 600 }}>{req._returnReason}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── Publisher's Note ── */}
                    {req._publishedExternalNote && (
                        <div style={{ border: "1px solid #c7d2fe", borderRadius: 16, padding: 20, background: "#f5f7ff" }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em", display: "block", marginBottom: 8 }}>Publisher's Note</span>
                            <div style={{ fontSize: 14, color: "#334155", lineHeight: 1.6 }}>{req._publishedExternalNote}</div>
                        </div>
                    )}

                    {/* ── External Communication ── */}
                    <div className="po-detail-card" style={{ marginBottom: 0 }}>
                        <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", margin: "0 0 14px", display: "flex", alignItems: "center", gap: 8 }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4338ca" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                            </svg>
                            External Communication
                            {externalMessages.length > 0 && (
                                <span style={{ fontSize: 12, fontWeight: 600, color: "#4338ca", background: "#eef2ff", padding: "2px 10px", borderRadius: 10 }}>{externalMessages.length}</span>
                            )}
                        </h3>
                        {externalMessages.length > 0 ? (
                            <div>
                                {externalMessages.map((msg) => (
                                    <div key={msg.id} style={{ padding: "12px 14px", borderBottom: "1px solid #e0e7ff", borderRadius: 8, marginBottom: 4, background: "#f5f7ff" }}>
                                        <div style={{ fontSize: 14, color: "#0f172a", lineHeight: 1.5 }}>{msg.text}</div>
                                        <div style={{ fontSize: 12, color: "#475569", marginTop: 6, display: "flex", gap: 8 }}>
                                            <span style={{ fontWeight: 600 }}>{msg.author}</span>
                                            <span>&middot;</span>
                                            <span>{new Date(msg.timestamp).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ textAlign: "center", padding: "24px 0", border: "1px dashed #c7d2fe", borderRadius: 10, background: "#f5f7ff" }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 8px" }}>
                                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                </svg>
                                <div style={{ fontSize: 14, color: "#334155", marginBottom: 6 }}>No external communication has been recorded yet.</div>
                                <div style={{ fontSize: 12, color: "#475569", fontStyle: "italic" }}>Email notifications will be enabled in a future phase.</div>
                            </div>
                        )}
                        <div style={{ marginTop: 14, fontSize: 12, color: "#475569" }}>
                            For urgent requests, contact{" "}
                            <a href="mailto:support@integracare.com" style={{ color: "#4338ca", textDecoration: "underline" }}>support@integracare.com</a>
                        </div>
                    </div>
                </div>
            </div>

            {modalMode && (
                <PartnerReviewModal
                    mode={modalMode}
                    onClose={() => setModalMode(null)}
                    onConfirm={(comment) => {
                        if (modalMode === "approve") handleApprove(comment);
                        else handleRework(comment);
                    }}
                />
            )}
        </div>
    );
}

import { useParams, useNavigate } from "react-router-dom";
import { getPortalRequests, getPortalDocuments } from "../../services/portalMockData";
import { getExternalMessages, getWorkArtifactsByRequest } from "../../services/recapDataService";
import "./PortalOverview.css";

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    Published: { bg: "#f0fdf4", text: "#166534", border: "#bbf7d0" },
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
};

const TRACKER_STEPS = [
    { step: 1, label: "Intake Review" },
    { step: 2, label: "Work Queue" },
    { step: 3, label: "In Progress" },
    { step: 4, label: "Quality Review" },
    { step: 5, label: "Published" },
];

function StatusTracker({ status }: { status: string }) {
    const current = STATUS_PROGRESS[status];
    if (!current) return null;

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
            <div style={{ marginTop: 16, padding: "14px 18px", background: "#f8fafc", borderRadius: 10, border: `1px solid ${STATUS_COLORS[status]?.border || "#e2e8f0"}` }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", display: "block", marginBottom: 4 }}>Current Status: {status}</span>
                <span style={{ fontSize: 13, color: "#475569", lineHeight: 1.5, display: "block" }}>
                    {status === "Intake Review" && "Your submission is being reviewed by the IntegraCare team to validate the request details. No action is needed from you at this time."}
                    {status === "Work Queue" && "This request has been accepted and is queued for assignment to a reviewer. You will be notified when work begins."}
                    {status === "In Progress" && "This request is actively being worked on by the IntegraCare team. Check back for updates."}
                    {status === "Quality Review" && "The work is complete and is undergoing a final quality review before publication."}
                    {status === "Published" && "The documents and artifacts for this request are now available for your review."}
                    {status === "Action Needed" && "Additional information is needed from your side. Please check for open clarifications and respond promptly."}
                    {status === "Closed" && "This request has been closed. Contact the DD team if you have questions."}
                    {!["Intake Review", "Work Queue", "In Progress", "Quality Review", "Action Needed", "Closed", "Published"].includes(status) && "IntegraCare is processing this request."}
                </span>
                {status === "Intake Review" && (
                    <span style={{ fontSize: 12, color: "#6b21a8", fontWeight: 600, marginTop: 4, display: "inline-block" }}>
                        What happens next: IntegraCare will review the submission and route requests to the appropriate teams.
                    </span>
                )}
                {status === "Work Queue" && (
                    <span style={{ fontSize: 12, color: "#92400e", fontWeight: 600, marginTop: 4, display: "inline-block" }}>
                        What happens next: A reviewer will be assigned to process this request.
                    </span>
                )}
                {status === "In Progress" && (
                    <span style={{ fontSize: 12, color: "#1e40af", fontWeight: 600, marginTop: 4, display: "inline-block" }}>
                        What happens next: The reviewer is gathering and analyzing the requested information.
                    </span>
                )}
                {status === "Quality Review" && (
                    <span style={{ fontSize: 12, color: "#92400e", fontWeight: 600, marginTop: 4, display: "inline-block" }}>
                        What happens next: A senior reviewer will confirm completeness before publication.
                    </span>
                )}
            </div>
        </div>
    );
}

export default function PortalRequestDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const allRequests = getPortalRequests();
    const allDocs = getPortalDocuments();

    const req = allRequests.find((r) => r.id === id);
    const externalMessages = req ? getExternalMessages(req.id) : [];
    const publishedArtifacts = req ? getWorkArtifactsByRequest(req.requestId) : [];

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

    const relatedDocs = allDocs.filter((d) => d.relatedRequestId === req.requestId || d.transactionId === req.transactionId);
    const publishedDocs = relatedDocs.filter((d) => d.externalVisible !== false);
    const statusColor = (STATUS_COLORS[req.status] || STATUS_COLORS["Closed"]);

    return (
        <div className="portal-overview" style={{ maxWidth: 740 }}>
            {/* ── Top Back Bar ── */}
            <div style={{ marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <button className="rc-btn rc-btn-secondary" onClick={() => navigate(-1)} style={{ fontSize: 12, padding: "6px 14px", border: "1px solid #e2e8f0", background: "#fff", borderRadius: 8, fontWeight: 600 }}>
                    &larr; Back
                </button>
                <span className="po-requests-id" style={{ fontSize: 11, background: "#f1f5f9", padding: "4px 10px", borderRadius: 6 }}>{req.requestId}</span>
            </div>

            {/* ── Hero / Summary Card ── */}
            <div className="po-detail-summary" style={{ marginBottom: 20 }}>
                <div style={{
                    position: "absolute", top: 0, left: 0, right: 0, height: 4,
                    background: `linear-gradient(90deg, ${statusColor.text}, ${statusColor.border})`,
                }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: "0 0 4px", letterSpacing: "-0.02em" }}>{req.title}</h1>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 6 }}>
                            <span style={{ fontSize: 12, color: "#64748b" }}>{req.transactionName}</span>
                            {req.communityNames[0] && (
                                <>
                                    <span style={{ fontSize: 12, color: "#94a3b8" }}>&middot;</span>
                                    <span style={{ fontSize: 12, color: "#64748b" }}>{req.communityNames[0]}</span>
                                </>
                            )}
                        </div>
                    </div>
                    <StatusBadge status={req.status} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                    <div style={{ padding: "10px 14px", background: "#fff", borderRadius: 8, border: "1px solid #f1f5f9" }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.03em", display: "block", marginBottom: 2 }}>Category</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{req.category || "\u2014"}</span>
                    </div>
                    <div style={{ padding: "10px 14px", background: "#fff", borderRadius: 8, border: "1px solid #f1f5f9" }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.03em", display: "block", marginBottom: 2 }}>Priority</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: req.priority === "High" ? "#991b1b" : req.priority === "Low" ? "#166534" : "#92400e" }}>{req.priority || "\u2014"}</span>
                    </div>
                    <div style={{ padding: "10px 14px", background: "#fff", borderRadius: 8, border: "1px solid #f1f5f9" }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.03em", display: "block", marginBottom: 2 }}>Submitted</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{req.submittedAt || "\u2014"}</span>
                    </div>
                    <div style={{ padding: "10px 14px", background: "#fff", borderRadius: 8, border: "1px solid #f1f5f9" }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.03em", display: "block", marginBottom: 2 }}>Last Updated</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{req.updatedAt || req.neededBy || "\u2014"}</span>
                    </div>
                    <div style={{ padding: "10px 14px", background: "#fff", borderRadius: 8, border: "1px solid #f1f5f9" }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.03em", display: "block", marginBottom: 2 }}>Transaction</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{req.transactionName}</span>
                    </div>
                    <div style={{ padding: "10px 14px", background: "#fff", borderRadius: 8, border: "1px solid #f1f5f9" }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.03em", display: "block", marginBottom: 2 }}>Community</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{req.communityNames[0] || "\u2014"}</span>
                    </div>
                </div>
            </div>

            {/* ── Status Tracker ── */}
            {STATUS_PROGRESS[req.status] && <StatusTracker status={req.status} />}

            {/* ── Supporting Artifacts ── */}
            {publishedArtifacts.length > 0 && (
                <div className="po-detail-card" style={{ marginBottom: 20 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", margin: "0 0 14px", display: "flex", alignItems: "center", gap: 8 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><polyline points="13 2 13 9 20 9" /></svg>
                        Supporting Artifacts
                        <span style={{ fontSize: 11, fontWeight: 600, color: "#64748b", background: "#f1f5f9", padding: "1px 8px", borderRadius: 10 }}>{publishedArtifacts.length}</span>
                    </h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        {publishedArtifacts.map((art) => (
                            <div key={art.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: 8, transition: "background 0.15s" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
                                    </svg>
                                    <div>
                                        <span style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{art.name}</span>
                                        {art.size > 0 && <span style={{ fontSize: 11, color: "#64748b", marginLeft: 6, fontWeight: 500 }}>{art.size >= 1048576 ? `${(art.size / 1048576).toFixed(1)} MB` : art.size >= 1024 ? `${(art.size / 1024).toFixed(0)} KB` : `${art.size} B`}</span>}
                                    </div>
                                </div>
                                <span style={{ fontSize: 11, color: "#64748b", fontStyle: "italic" }}>Available</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Documents section (published) ── */}
            {req._publishedExternal && (
                <div style={{ border: "1px solid #bbf7d0", borderRadius: 14, padding: 24, background: "linear-gradient(135deg, #f0fdf4 0%, #faf5ff 100%)", marginBottom: 20 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                        <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#166534", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                        </div>
                        <span style={{ fontSize: 16, fontWeight: 800, color: "#166534" }}>Ready to Review</span>
                    </div>
                    {publishedDocs.length > 0 ? (
                        <div>
                            <span style={{ fontSize: 12, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em", display: "block", marginBottom: 10 }}>Documents ({publishedDocs.length})</span>
                            {publishedDocs.slice(0, 20).map((doc) => (
                                <div key={doc.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #dcfce7" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><polyline points="13 2 13 9 20 9" />
                                        </svg>
                                        <span style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{doc.name}</span>
                                        <span style={{ fontSize: 11, color: "#64748b" }}>{doc.category}</span>
                                    </div>
                                    <span style={{ fontSize: 11, color: "#64748b", fontStyle: "italic" }}>Available</span>
                                </div>
                            ))}
                        </div>
                    ) : req._publishedWithoutDocuments ? (
                        <div style={{ padding: 12, background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 8 }}>
                            <span style={{ fontSize: 12, color: "#92400e" }}>No documents available for this request.</span>
                        </div>
                    ) : (
                        <div style={{ padding: 12, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8 }}>
                            <span style={{ fontSize: 12, color: "#64748b", fontStyle: "italic" }}>Documents are being prepared for review.</span>
                        </div>
                    )}
                </div>
            )}

            {/* ── Publisher's Note ── */}
            {req._publishedExternalNote && (
                <div style={{ border: "1px solid #dbeafe", borderRadius: 12, padding: 20, background: "#f8faff", marginBottom: 20 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em", display: "block", marginBottom: 8 }}>Publisher's Note</span>
                    <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.6 }}>{req._publishedExternalNote}</div>
                </div>
            )}

            {/* ── External Communication ── */}
            <div className="po-detail-card" style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", margin: "0 0 14px", display: "flex", alignItems: "center", gap: 8 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    External Communication
                    {externalMessages.length > 0 && (
                        <span style={{ fontSize: 11, fontWeight: 600, color: "#64748b", background: "#f1f5f9", padding: "1px 8px", borderRadius: 10 }}>{externalMessages.length}</span>
                    )}
                </h3>
                {externalMessages.length > 0 ? (
                    <div>
                        {externalMessages.map((msg) => (
                            <div key={msg.id} style={{ padding: "12px 14px", borderBottom: "1px solid #f1f5f9", borderRadius: 8, marginBottom: 4, background: "#fafbfc" }}>
                                <div style={{ fontSize: 13, color: "#1e293b", lineHeight: 1.5 }}>{msg.text}</div>
                                <div style={{ fontSize: 11, color: "#64748b", marginTop: 6, display: "flex", gap: 8 }}>
                                    <span style={{ fontWeight: 600 }}>{msg.author}</span>
                                    <span>&middot;</span>
                                    <span>{new Date(msg.timestamp).toLocaleDateString()}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div style={{ textAlign: "center", padding: "24px 0", border: "1px dashed #e2e8f0", borderRadius: 10, background: "#fafbfc" }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 8px" }}>
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 6 }}>No external communication has been recorded yet.</div>
                        <div style={{ fontSize: 11, color: "#94a3b8", fontStyle: "italic" }}>Email notifications will be enabled in a future phase.</div>
                    </div>
                )}
                <div style={{ marginTop: 14, fontSize: 11, color: "#94a3b8" }}>
                    For urgent requests, contact{" "}
                    <a href="mailto:support@integracare.com" style={{ color: "#6366f1", textDecoration: "underline" }}>support@integracare.com</a>
                </div>
            </div>
        </div>
    );
}

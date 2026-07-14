import { useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getPortalRequests, partnerApproveRequest, partnerReworkRequest, partnerExceptionDecision } from "../../services/portalMockData";
import { getExternalMessages, getWorkArtifactsByRequest } from "../../services/recapDataService";
import { getExternalStatusInfo, getStatusPillStyle } from "../../services/externalStatusMapping";
import "./PortalOverview.css";

const EXTERNAL_LIFECYCLE = [
    { step: 1, key: "Submitted", label: "Submitted" },
    { step: 2, key: "Under Review", label: "Under Review" },
    { step: 3, key: "Awaiting Your Review", label: "Awaiting Your Review" },
    { step: 4, key: "Complete", label: "Complete" },
];

function TrackerContent({ status, stacked }: { status: string; stacked?: boolean }) {
    const isBranch = ["Information Requested", "Exception Review"].includes(status);
    const current = EXTERNAL_LIFECYCLE.find(s => s.key === status);
    const cls = stacked ? "po-tracker po-tracker--stacked" : "po-tracker";

    const steps = EXTERNAL_LIFECYCLE.map((s, idx) => {
        const stepNum = s.step;
        const isDone = stepNum < (current?.step || 1);
        const isActive = stepNum === (current?.step || 1);
        const isBranchActive = isBranch && idx === 1;
        const dotClass = isDone ? "po-tracker-dot--done" : isActive || isBranchActive ? "po-tracker-dot--active" : "";
        const labelClass = isActive || isBranchActive ? "po-tracker-label--active" : "";
        return (
            <div key={s.step} className="po-tracker-step">
                {idx < EXTERNAL_LIFECYCLE.length - 1 && (
                    <div className={`po-tracker-line${isDone ? " po-tracker-line--done" : ""}${isBranchActive && idx === 1 ? " po-tracker-line--done" : ""}`} />
                )}
                <div className={`po-tracker-dot ${dotClass}`} style={isBranchActive ? { background: "#ffffff", borderColor: "#7c3aed", color: "#7c3aed" } : {}}>
                    {isDone ? "\u2713" : isActive ? "\u25CF" : isBranchActive ? "!" : s.step}
                </div>
                <span className={`po-tracker-label ${labelClass}`} style={isBranchActive ? { color: "#7c3aed", fontWeight: 700 } : {}}>{s.label}</span>
            </div>
        );
    });

    if (!isBranch) return <div className={cls} style={{ justifyContent: "center" }}>{steps}</div>;

    return (
        <div className={cls} style={{ justifyContent: "center" }}>
            {steps}
            <div className="po-tracker-step">
                <div className="po-tracker-line po-tracker-line--done" />
                <div className="po-tracker-dot po-tracker-dot--active" style={{ background: status === "Information Requested" ? "#ffffff" : "#ffffff", borderColor: status === "Information Requested" ? "#d97706" : "#7c3aed", color: status === "Information Requested" ? "#d97706" : "#7c3aed", width: 28, height: 28 }}>
                    <span style={{ fontSize: 10 }}>{status === "Information Requested" ? "?" : "!"}</span>
                </div>
                <span className="po-tracker-label--active" style={{ fontSize: 11, color: status === "Information Requested" ? "#d97706" : "#7c3aed" }}>{status}</span>
            </div>
        </div>
    );
}

function StatusTracker({ status }: { status: string }) {
    return (
        <div style={{ marginBottom: 20 }}>
            <TrackerContent status={status} />
            <TrackerContent status={status} stacked />
        </div>
    );
}

function MetaCard({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div style={{ padding: "10px 14px", background: "#fff", border: "1px solid #e0e7ff", borderRadius: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 3 }}>{label}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{children}</div>
        </div>
    );
}

export default function PortalRequestDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const allRequests = getPortalRequests();
    const req = allRequests.find(r => r.id === id) || allRequests.find(r => r.requestId === id);
    const [showApprovedModal, setShowApprovedModal] = useState(false);
    const extInfo = req ? getExternalStatusInfo(req) : null;

    const handleViewDashboard = useCallback(() => {
        navigate("/portal");
    }, [navigate]);

    if (!req) {
        return (
            <div className="portal-overview">
                <h1 className="po-welcome-title">Request Not Found</h1>
                <p style={{ fontSize: 14, color: "#475569" }}>The requested item could not be found.</p>
                <button className="rc-btn rc-btn-primary" onClick={handleViewDashboard} style={{ marginTop: 12 }}>Back to Dashboard</button>
            </div>
        );
    }

    const handleApprove = () => {
        partnerApproveRequest(req.id);
        setShowApprovedModal(true);
    };

    const handleRework = () => {
        const reason = window.prompt("Please describe what needs to be revised:");
        if (reason) {
            partnerReworkRequest(req.id, reason);
        }
    };

    const handleExceptionDecision = (decision: "Approve Removal" | "Keep Request" | "Confirm Duplicate" | "Keep Separate") => {
        partnerExceptionDecision(req.id, decision);
        setShowApprovedModal(true);
    };

    const artifacts = getWorkArtifactsByRequest(req.id);
    const messages = getExternalMessages(req.id);
    const exceptionRec = req._exceptionRecommendation;
    const isComplete = extInfo?.isTerminal || req._completedAt;

    const isAwaitingReview = extInfo?.status === "Awaiting Your Review" && !isComplete;
    const isExceptionReview = extInfo?.status === "Exception Review" && !isComplete;

    return (
        <div className="portal-overview" style={{ maxWidth: 860, margin: "0 auto" }}>
            {/* Back link */}
            <div style={{ marginBottom: 12 }}>
                <button className="rc-btn rc-btn-ghost" onClick={handleViewDashboard} style={{ fontSize: 13, padding: "4px 8px" }} aria-label="Back to Dashboard">
                    &larr; Back to Dashboard
                </button>
            </div>

            {/* Tracker */}
            {extInfo && !isComplete && <StatusTracker status={extInfo.label} />}

            {/* Header */}
            <div style={{ marginBottom: 20 }}>
                <h1 className="po-welcome-title" style={{ fontSize: 22, marginBottom: 4 }}>{req.title}</h1>
                <div style={{ fontSize: 13, color: "#475569", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginTop: 4 }}>
                    <span><strong>Request ID:</strong> {req.requestId}</span>
                    <StatusBadge status={extInfo?.label || "Under Review"} />
                    {req._completedAt && <span style={{ fontSize: 12, color: "#166534", fontWeight: 600 }}>&#10003; Completed {new Date(req._completedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>}
                </div>
            </div>

            {/* Metadata cards */}
            {!isComplete && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10, marginBottom: 20 }}>
                    <MetaCard label="Category">{req.category || "\u2014"}</MetaCard>
                    <MetaCard label="Priority">{req.priority || "\u2014"}</MetaCard>
                    <MetaCard label="Submitted">{req.submittedAt || req.neededBy || "\u2014"}</MetaCard>
                    <MetaCard label="Last Updated">{req.updatedAt || "\u2014"}</MetaCard>
                    <MetaCard label="Transaction">{req.transactionName || req.transactionId || "\u2014"}</MetaCard>
                    <MetaCard label="Community">{req.communityNames[0] || "\u2014"}</MetaCard>
                </div>
            )}

            {/* Completed state */}
            {isComplete && (
                <div style={{ marginBottom: 24, padding: "24px 28px", borderRadius: 14, border: "2px solid #86efac", background: "#fff" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                        <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#dcfce7", color: "#166534", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                        </div>
                        <div>
                            <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>Review Complete</div>
                            <div style={{ fontSize: 14, color: "#334155", lineHeight: 1.5, marginTop: 2 }}>
                                {extInfo?.completionMessage || "You approved this request. The IntegraCare team has been notified of your decision."}
                            </div>
                            <div style={{ fontSize: 13, color: "#475569", marginTop: 4 }}>No further action is required.</div>
                        </div>
                    </div>
                    <div style={{ display: "flex", gap: 20, flexWrap: "wrap", fontSize: 13, color: "#334155", marginTop: 8, padding: "12px 14px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                        {req._completedBy && <span><strong>Approved by:</strong> {req._completedBy}</span>}
                        {req._completedAt && <span><strong>Approved date:</strong> {new Date(req._completedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>}
                        {req._exceptionDecision && (
                            <span><strong>Decision:</strong> {
                                req._exceptionDecision === "Confirm Duplicate" ? "Duplicate Confirmed" :
                                req._exceptionDecision === "Keep Separate" ? "Kept Separate" :
                                req._exceptionDecision === "Approve Removal" ? "Removal Approved" : "Kept Request"
                            }</span>
                        )}
                        {req._archiveReason && <span><strong>Final status:</strong> {req._archiveReason}</span>}
                    </div>
                    <button className="rc-btn rc-btn-primary" onClick={handleViewDashboard} style={{ marginTop: 16 }}>
                        Return to Dashboard
                    </button>
                </div>
            )}

            {/* Current Status Banner (for non-terminal states) */}
            {extInfo && !isComplete && (
                <div style={{
                    marginBottom: 20, padding: "16px 20px",
                    background: "#fff", borderRadius: 12,
                    border: isExceptionReview ? "2px solid #c4b5fd" : isAwaitingReview ? "2px solid #6ee7b7" : "2px solid #c7d2fe",
                }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>
                        {isAwaitingReview ? "Awaiting Your Review" : isExceptionReview ? "Exception Review" : extInfo.label}
                    </div>
                    <div style={{ fontSize: 14, color: "#334155", lineHeight: 1.5, marginBottom: 4 }}>
                        {extInfo.description}
                    </div>
                    <div style={{ fontSize: 13, color: "#475569", display: "flex", alignItems: "center", gap: 6 }}>
                        <strong>Next action owner:</strong> {extInfo.nextActionOwner}
                    </div>
                </div>
            )}

            {/* Exception Review Section */}
            {isExceptionReview && (
                <div style={{ marginBottom: 24 }}>
                    <MetaCard label={exceptionRec === "Duplicate" ? "Duplicate Recommendation" : "Not Applicable Recommendation"}>
                        <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                            {exceptionRec === "Duplicate"
                                ? "IntegraCare identified this request as a potential duplicate. Review the reason below and decide whether to confirm the duplicate or keep the request separate."
                                : "IntegraCare identified this request as potentially not applicable to this due diligence scope. Review the reason below and decide."}
                        </div>
                    </MetaCard>
                    {req._exceptionReason && (
                        <div style={{ marginTop: 10, padding: "12px 14px", background: "#fff", border: "1px solid #e0e7ff", borderRadius: 10 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 4 }}>Reason provided by IntegraCare</div>
                            <div style={{ fontSize: 13, color: "#0f172a", lineHeight: 1.5 }}>{req._exceptionReason}</div>
                        </div>
                    )}
                    <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
                        {exceptionRec === "Duplicate" ? (
                            <>
                                <button className="rc-btn rc-btn-primary" onClick={() => handleExceptionDecision("Confirm Duplicate")} style={{ padding: "10px 24px", fontSize: 14, fontWeight: 700 }}>
                                    Confirm Duplicate
                                </button>
                                <button className="rc-btn rc-btn-secondary" onClick={() => handleExceptionDecision("Keep Separate")} style={{ padding: "10px 24px", fontSize: 14, fontWeight: 700 }}>
                                    Keep as Separate Request
                                </button>
                            </>
                        ) : (
                            <>
                                <button className="rc-btn rc-btn-primary" onClick={() => handleExceptionDecision("Approve Removal")} style={{ padding: "10px 24px", fontSize: 14, fontWeight: 700 }}>
                                    Approve Removal
                                </button>
                                <button className="rc-btn rc-btn-secondary" onClick={() => handleExceptionDecision("Keep Request")} style={{ padding: "10px 24px", fontSize: 14, fontWeight: 700 }}>
                                    Keep Request
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Awaiting Your Review — Decision Panel */}
            {isAwaitingReview && (
                <div style={{ marginBottom: 24 }}>
                    <div style={{ padding: "20px 24px", borderRadius: 12, border: "2px solid #6ee7b7", background: "#fff" }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>Documents Ready for Review</div>
                        <div style={{ fontSize: 14, color: "#334155", marginBottom: 16, lineHeight: 1.6 }}>
                            The IntegraCare team has completed its work on this request. Review the supporting documents and either approve the request or request rework.
                        </div>
                        <div style={{ display: "flex", gap: 12 }}>
                            <button className="rc-btn rc-btn-primary" onClick={handleApprove} style={{ padding: "10px 24px", fontSize: 14, fontWeight: 700 }}>
                                Approve
                            </button>
                            <button className="rc-btn rc-btn-secondary" onClick={handleRework} style={{ padding: "10px 24px", fontSize: 14, fontWeight: 700, border: "1px solid #fed7aa", color: "#0f172a" }}>
                                Request Rework
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Information Requested Section */}
            {extInfo?.status === "Information Requested" && !isComplete && (
                <div style={{ marginBottom: 24, padding: "20px 24px", borderRadius: 12, border: "2px solid #fcd34d", background: "#fff" }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>Additional Information Required</div>
                    <div style={{ fontSize: 14, color: "#334155", marginBottom: 12, lineHeight: 1.6 }}>
                        IntegraCare needs additional information from you to continue processing this request. Please check the clarification section below.
                    </div>
                    {req._returnReason && (
                        <div style={{ padding: "10px 14px", background: "#fff", border: "1px solid #fde68a", borderRadius: 8, fontSize: 13, color: "#0f172a", marginBottom: 12, lineHeight: 1.5 }}>
                            <span style={{ fontWeight: 700, display: "block", marginBottom: 4, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.03em", color: "#0f172a" }}>Information requested</span>
                            {req._returnReason}
                        </div>
                    )}
                    <button className="rc-btn rc-btn-primary" onClick={() => navigate("/portal/clarifications")} style={{ padding: "10px 24px", fontSize: 14, fontWeight: 700 }}>
                        Respond
                    </button>
                </div>
            )}

            {/* Supporting Artifacts */}
            {artifacts.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 10 }}>Supporting Documents</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {artifacts.map(a => (
                            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, border: "1px solid #e0e7ff", background: "#fff" }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                    <polyline points="14 2 14 8 20 8" />
                                </svg>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.displayFileName || a.originalFileName || a.name}</div>
                                    <div style={{ fontSize: 11, color: "#475569", display: "flex", gap: 8 }}>
                                        <span>{a.artifactType || "Document"}</span>
                                        {a.size ? <span>{(a.size / 1024).toFixed(0)} KB</span> : null}
                                        <span style={{ color: "#166534", fontWeight: 600 }}>Available</span>
                                    </div>
                                </div>
                                <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => window.open(a.webUrl || "#", "_blank")} style={{ flexShrink: 0, fontSize: 12, fontWeight: 600, color: "#1d4ed8" }}>
                                    Open
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* External Communication */}
            <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 10 }}>Communication</h3>
                {messages.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {messages.map(m => (
                            <div key={m.id} style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #e0e7ff", background: "#fff" }}>
                                <div style={{ fontSize: 12, color: "#475569", marginBottom: 4 }}>
                                    <strong>{m.author}</strong> &bull; {new Date(m.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                                </div>
                                <div style={{ fontSize: 13, color: "#0f172a", lineHeight: 1.5 }}>{m.text}</div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div style={{ padding: "12px 14px", border: "1px solid #e0e7ff", borderRadius: 10, background: "#fff", fontSize: 13, color: "#475569" }}>
                        No communication history for this request.
                    </div>
                )}
            </div>

            {/* Success modal */}
            {showApprovedModal && (
                <div className="rc-modal-overlay" role="dialog" aria-modal="true" aria-label="Review Complete" onClick={() => setShowApprovedModal(false)}>
                    <div className="rc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
                        <div className="rc-modal-header">
                            <h2>Review Complete</h2>
                            <button className="rc-modal-close" onClick={() => setShowApprovedModal(false)} aria-label="Close">&times;</button>
                        </div>
                        <div className="rc-modal-body" style={{ padding: "20px", textAlign: "center" }}>
                            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#dcfce7", color: "#166534", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                            </div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>Review Complete</div>
                            <div style={{ fontSize: 14, color: "#334155", lineHeight: 1.5 }}>Your decision has been recorded. No further action is required.</div>
                        </div>
                        <div className="rc-modal-footer" style={{ justifyContent: "center" }}>
                            <button className="rc-btn rc-btn-primary" onClick={() => { setShowApprovedModal(false); navigate("/portal"); }}>Return to Dashboard</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const c = getStatusPillStyle(status);
    return (
        <span className="po-status-badge" style={{ background: c.bg, color: c.text, borderColor: c.border }}>
            {status}
        </span>
    );
}

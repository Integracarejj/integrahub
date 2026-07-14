import { useState } from "react";
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

const BRANCH_STATES = ["Information Requested", "Exception Review"];

function TrackerContent({ status, stacked }: { status: string; stacked?: boolean }) {
    const isBranch = BRANCH_STATES.includes(status);
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
                <div className={`po-tracker-dot ${dotClass}`} style={isBranchActive ? { background: "#7c3aed", borderColor: "#7c3aed" } : {}}>
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
                <div className="po-tracker-dot po-tracker-dot--active" style={{ background: status === "Information Requested" ? "#d97706" : "#7c3aed", borderColor: status === "Information Requested" ? "#d97706" : "#7c3aed", width: 28, height: 28 }}>
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

function ProcessGuide({ extInfo }: { extInfo: ReturnType<typeof getExternalStatusInfo> }) {
    return (
        <div style={{
            marginTop: 16, padding: "16px 20px",
            background: "#f8faff",
            borderRadius: 12,
            border: `1px solid ${getStatusPillStyle(extInfo.label).border || "#c7d2fe"}`,
        }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", display: "block", marginBottom: 6 }}>
                {extInfo.status === "Awaiting Your Review" ? "Awaiting Your Review" : `Current Status: ${extInfo.label}`}
            </div>
            <div style={{ fontSize: 14, color: "#334155", lineHeight: 1.5, display: "block", marginBottom: 6 }}>
                {extInfo.description}
            </div>
            <div style={{ fontSize: 13, color: "#475569", display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                <strong>Next action owner:</strong> {extInfo.nextActionOwner}
            </div>
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

    if (!req) {
        return (
            <div className="portal-overview">
                <h1 className="po-welcome-title">Request Not Found</h1>
                <p style={{ fontSize: 14, color: "#475569" }}>The requested item could not be found.</p>
                <button className="rc-btn rc-btn-primary" onClick={() => navigate("/portal/requests")} style={{ marginTop: 12 }}>Back to Requests</button>
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

    return (
        <div className="portal-overview">
            <div style={{ marginBottom: 16 }}>
                <button className="rc-btn rc-btn-ghost" onClick={() => navigate("/portal")} style={{ fontSize: 13, padding: "4px 8px" }}>
                    &larr; Back to Dashboard
                </button>
            </div>

            {extInfo && <StatusTracker status={extInfo.label} />}
            {extInfo && <ProcessGuide extInfo={extInfo} />}

            {/* Breadcrumb-like header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, marginTop: 20 }}>
                <div>
                    <h1 className="po-welcome-title" style={{ fontSize: 20, marginBottom: 4 }}>{req.title}</h1>
                    <div style={{ fontSize: 13, color: "#475569", display: "flex", gap: 12, flexWrap: "wrap" }}>
                        <span><strong>Request ID:</strong> {req.requestId}</span>
                        <span><strong>Category:</strong> {req.category}</span>
                        <span><strong>Community:</strong> {req.communityNames[0] || "\u2014"}</span>
                        <span className="po-status-badge" style={getStatusPillStyle(extInfo?.label || "Under Review")}>{extInfo?.label || "Under Review"}</span>
                    </div>
                </div>
            </div>

            {/* Exception Review section */}
            {extInfo?.status === "Exception Review" && !req._exceptionDecision && (
                <div style={{ marginBottom: 24, padding: "20px 24px", borderRadius: 12, border: "2px solid #ddd6fe", background: "#faf5ff" }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>
                        {exceptionRec === "Duplicate" ? "Duplicate Recommendation" : "Not Applicable Recommendation"}
                    </div>
                    <div style={{ fontSize: 14, color: "#334155", marginBottom: 12, lineHeight: 1.6 }}>
                        {exceptionRec === "Duplicate"
                            ? "IntegraCare has identified this request as a potential duplicate. Please review the reason below and decide whether to confirm the duplicate or keep the request separate."
                            : "IntegraCare has identified this request as potentially not applicable to this due diligence scope. Please review the reason below and decide."}
                    </div>
                    {req._exceptionReason && (
                        <div style={{ padding: "10px 14px", background: "#fff", border: "1px solid #ddd6fe", borderRadius: 8, fontSize: 13, color: "#0f172a", marginBottom: 16, lineHeight: 1.5 }}>
                            <span style={{ fontWeight: 700, display: "block", marginBottom: 4, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.03em", color: "#6d28d9" }}>Reason</span>
                            {req._exceptionReason}
                        </div>
                    )}
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                        {exceptionRec === "Duplicate" ? (
                            <>
                                <button className="rc-btn rc-btn-primary" onClick={() => handleExceptionDecision("Confirm Duplicate")} style={{ padding: "10px 24px", fontSize: 14, fontWeight: 700 }}>
                                    Confirm Duplicate
                                </button>
                                <button className="rc-btn rc-btn-secondary" onClick={() => handleExceptionDecision("Keep Separate")} style={{ padding: "10px 24px", fontSize: 14, fontWeight: 700 }}>
                                    Keep Separate
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

            {/* Standard Awaiting Your Review section */}
            {extInfo?.status === "Awaiting Your Review" && !req._exceptionDecision && (
                <div style={{ marginBottom: 24, padding: "20px 24px", borderRadius: 12, border: "2px solid #a7f3d0", background: "#f0fdf4" }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>Documents Ready for Review</div>
                    <div style={{ fontSize: 14, color: "#334155", marginBottom: 16, lineHeight: 1.6 }}>
                        The IntegraCare team has completed their work on this request. Please review the supporting documents below and either approve or request rework.
                    </div>
                    <div style={{ display: "flex", gap: 12 }}>
                        <button className="rc-btn rc-btn-primary" onClick={handleApprove} style={{ padding: "10px 24px", fontSize: 14, fontWeight: 700 }}>
                            Approve
                        </button>
                        <button className="rc-btn rc-btn-secondary" onClick={handleRework} style={{ padding: "10px 24px", fontSize: 14, fontWeight: 700, border: "1px solid #fed7aa", color: "#9a3412" }}>
                            Request Rework
                        </button>
                    </div>
                </div>
            )}

            {/* Information Requested section */}
            {extInfo?.status === "Information Requested" && !req._exceptionDecision && (
                <div style={{ marginBottom: 24, padding: "20px 24px", borderRadius: 12, border: "2px solid #fde68a", background: "#fffbeb" }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>Additional Information Required</div>
                    <div style={{ fontSize: 14, color: "#334155", marginBottom: 12, lineHeight: 1.6 }}>
                        IntegraCare needs additional information from you to continue processing this request. Please check the clarification section below.
                    </div>
                    {req._returnReason && (
                        <div style={{ padding: "10px 14px", background: "#fff", border: "1px solid #fde68a", borderRadius: 8, fontSize: 13, color: "#0f172a", marginBottom: 12, lineHeight: 1.5 }}>
                            <span style={{ fontWeight: 700, display: "block", marginBottom: 4, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.03em", color: "#92400e" }}>Information requested</span>
                            {req._returnReason}
                        </div>
                    )}
                    <div style={{ display: "flex", gap: 12 }}>
                        <button className="rc-btn rc-btn-primary" onClick={() => navigate("/portal/clarifications")} style={{ padding: "10px 24px", fontSize: 14, fontWeight: 700 }}>
                            Respond
                        </button>
                    </div>
                </div>
            )}

            {/* Completed approval section */}
            {extInfo?.isTerminal && (
                <div style={{ marginBottom: 24, padding: "20px 24px", borderRadius: 12, border: "2px solid #86efac", background: "#f0fdf4" }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "#166534", marginBottom: 4 }}>Review Complete</div>
                    <div style={{ fontSize: 14, color: "#334155", lineHeight: 1.6, marginBottom: 4 }}>
                        {extInfo.completionMessage || "You approved this request. The IntegraCare team has been notified of your decision."}
                    </div>
                    <div style={{ fontSize: 13, color: "#475569", display: "flex", flexDirection: "column", gap: 2, marginTop: 8 }}>
                        {req._completedBy && <span><strong>Approved by:</strong> {req._completedBy}</span>}
                        {req._completedAt && <span><strong>Approved date:</strong> {new Date(req._completedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>}
                        {req._exceptionDecision && <span><strong>Decision:</strong> {req._exceptionDecision === "Confirm Duplicate" ? "Duplicate Confirmed" : req._exceptionDecision === "Keep Separate" ? "Kept Separate" : req._exceptionDecision === "Approve Removal" ? "Removal Approved" : "Kept Request"}</span>}
                        {req._archiveReason && <span><strong>Final status:</strong> {req._archiveReason === "Duplicate" ? "Closed as Duplicate" : req._archiveReason === "Not Applicable" ? "Closed as Not Applicable" : req._archiveReason}</span>}
                    </div>
                    <button className="rc-btn rc-btn-primary" onClick={() => navigate("/portal")} style={{ marginTop: 16 }}>
                        Return to Dashboard
                    </button>
                </div>
            )}

            {/* Supporting Artifacts */}
            {artifacts.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 10 }}>Supporting Documents</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {artifacts.map(a => (
                            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 8, border: "1px solid #e0e7ff", background: "#fff" }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                    <polyline points="14 2 14 8 20 8" />
                                </svg>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name || a.displayFileName}</div>
                                    <div style={{ fontSize: 11, color: "#475569" }}>
                                        {a.artifactType || "Document"} &bull; {a.size ? `${(a.size / 1024).toFixed(0)} KB` : ""} &bull; {a.uploadedAt || a.uploadedBy ? `${a.uploadedAt || ""}${a.uploadedAt && a.uploadedBy ? " by " : ""}${a.uploadedBy || ""}` : ""}
                                    </div>
                                </div>
                                <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => window.open(a.webUrl || "#", "_blank")} style={{ flexShrink: 0 }}>
                                    View
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Clarifications */}
            {messages.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 10 }}>Communication</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {messages.map(m => (
                            <div key={m.id} style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e0e7ff", background: "#fff" }}>
                                <div style={{ fontSize: 12, color: "#475569", marginBottom: 4 }}>
                                    <strong>{m.author}</strong> &bull; {new Date(m.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                                </div>
                                <div style={{ fontSize: 13, color: "#0f172a", lineHeight: 1.5 }}>{m.text}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Success modal */}
            {showApprovedModal && (
                <div className="rc-modal-overlay" onClick={() => setShowApprovedModal(false)}>
                    <div className="rc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
                        <div className="rc-modal-header">
                            <h2>Review Complete</h2>
                            <button className="rc-modal-close" onClick={() => setShowApprovedModal(false)}>&times;</button>
                        </div>
                        <div className="rc-modal-body" style={{ padding: "20px", textAlign: "center" }}>
                            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#dcfce7", color: "#166534", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                            </div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: "#166534", marginBottom: 6 }}>Review Complete</div>
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

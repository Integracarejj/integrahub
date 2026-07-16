import { useState, useCallback, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getPortalRequests, partnerApproveRequest, partnerReworkRequest, partnerExceptionDecision, toExternalStatusInput } from "../../services/portalMockData";
import type { PortalRequest } from "../../services/portalMockData";
import { getExternalMessages, getWorkArtifactsByRequest, addWorkNote, addActivityEntry, updateRequestReturnReason } from "../../services/recapDataService";
import { getExternalStatusInfo, getStatusPillStyle } from "../../services/externalStatusMapping";
import "./PortalOverview.css";

function InformationRequestedSection({ req, onResponseSubmitted }: { req: PortalRequest; onResponseSubmitted: () => void }) {
    const [response, setResponse] = useState("");
    const [submitted, setSubmitted] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const clarificationQuestion = req._returnReason || "Please provide the requested information.";
    const questionAuthor = req.owner || "DD Operations";

    function handleSubmit() {
        if (!response.trim()) return;
        const reqId = req.id || req.intakeId || "";
        
        addWorkNote(reqId, response.trim(), "External Partner", "Clarification Response");
        
        addActivityEntry({
            type: "Status Change",
            description: `${req.requestId}: External partner responded to clarification.`,
            userId: "external-partner",
            userName: "External Partner",
            requestId: req.requestId || req.id,
            requestTitle: req.title || req.category || "",
            transactionId: req.transactionId,
            transactionName: req.transactionName || req.transactionId,
        });
        
        updateRequestReturnReason(reqId, null);
        
        setSubmitted(true);
        setShowConfirm(false);
        onResponseSubmitted();
    }

    if (submitted) {
        return (
            <div style={{ marginBottom: 24, padding: "20px 24px", borderRadius: 12, border: "2px solid #bbf7d0", background: "#f0fdf4" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
                    </div>
                    <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "#166534" }}>Response Submitted</div>
                        <div style={{ fontSize: 13, color: "#334155" }}>Your response was sent to IntegraCare. No further action is required from you right now.</div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ marginBottom: 24, padding: "20px 24px", borderRadius: 12, border: "2px solid #fcd34d", background: "#fff" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#fef3c7", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                </div>
                <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Additional Information Required</div>
                    <div style={{ fontSize: 12, color: "#475569" }}>IntegraCare needs additional information from you.</div>
                </div>
            </div>
            
            {/* Clarification Question */}
            <div style={{ marginBottom: 16, padding: "12px 14px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#92400e", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 6 }}>What's Needed</div>
                <div style={{ fontSize: 13, color: "#0f172a", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                    {clarificationQuestion || "No specific question recorded. Please provide the requested information."}
                </div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 6 }}>
                    Asked by {questionAuthor}
                </div>
            </div>

            {/* Response Area */}
            {!showConfirm ? (
                <>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6, display: "block" }}>Your Response <span style={{ color: "#dc2626" }}>*</span></label>
                    <textarea
                        value={response}
                        onChange={e => setResponse(e.target.value)}
                        placeholder="Enter your response to the question above..."
                        rows={4}
                        style={{ width: "100%", padding: "10px 12px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 6, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", outline: "none", color: "#0f172a", marginBottom: 12 }}
                    />
                    <button
                        className="rc-btn rc-btn-primary"
                        disabled={!response.trim()}
                        onClick={() => setShowConfirm(true)}
                        style={{ padding: "10px 24px", fontSize: 14, fontWeight: 700 }}
                    >
                        Submit Response
                    </button>
                </>
            ) : (
                <div style={{ padding: "14px 16px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>Confirm Submission</div>
                    <div style={{ fontSize: 12, color: "#334155", marginBottom: 10, lineHeight: 1.5 }}>
                        Your response will be sent to IntegraCare for review.
                    </div>
                    <div style={{ padding: "8px 10px", background: "#fff", border: "1px solid #bbf7d0", borderRadius: 6, fontSize: 12, color: "#166534", marginBottom: 12 }}>
                        <strong>Your Response:</strong><br />{response}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                        <button className="rc-btn rc-btn-ghost" onClick={() => setShowConfirm(false)}>Back</button>
                        <button className="rc-btn rc-btn-primary" onClick={handleSubmit}>Confirm & Submit</button>
                    </div>
                </div>
            )}
        </div>
    );
}

const EXTERNAL_LIFECYCLE = [
    { step: 1, key: "Submitted", label: "Submitted" },
    { step: 2, key: "Under Review", label: "Under Review" },
    { step: 3, key: "Awaiting Your Review", label: "Awaiting Your Review" },
    { step: 4, key: "Complete", label: "Complete" },
];

function getStepForStatus(status: string): number {
    switch (status) {
        case "Submitted": return 1;
        case "Under Review": return 2;
        case "Information Requested": return 2;
        case "Exception Review": return 2;
        case "Awaiting Your Review": return 3;
        case "Complete": return 4;
        default: return 1;
    }
}

function TrackerContent({ status, stacked }: { status: string; stacked?: boolean }) {
    const currentStep = getStepForStatus(status);
    const cls = stacked ? "po-tracker po-tracker--stacked" : "po-tracker";

    const steps = EXTERNAL_LIFECYCLE.map((s, idx) => {
        const stepNum = s.step;
        const isDone = stepNum < currentStep;
        const isActive = stepNum === currentStep;
        const dotClass = isDone ? "po-tracker-dot--done" : isActive ? "po-tracker-dot--active" : "";
        const labelClass = isActive ? "po-tracker-label--active" : "";
        return (
            <div key={s.step} className="po-tracker-step">
                {idx < EXTERNAL_LIFECYCLE.length - 1 && (
                    <div className={`po-tracker-line${isDone ? " po-tracker-line--done" : ""}`} />
                )}
                <div className={`po-tracker-dot ${dotClass}`}>
                    {isDone ? "\u2713" : isActive ? "\u25CF" : s.step}
                </div>
                <span className={`po-tracker-label ${labelClass}`}>{s.label}</span>
            </div>
        );
    });

    return <div className={cls} style={{ justifyContent: "center" }}>{steps}</div>;
}

function StatusTracker({ status }: { status: string }) {
    return (
        <div style={{ marginBottom: 20 }}>
            <TrackerContent status={status} />
            <TrackerContent status={status} stacked />
        </div>
    );
}

function StatusBanners({ req, extInfo }: { req: { _partnerDecision?: string | null; _partnerNote?: string | null; _partnerActionAt?: string | null; _exceptionRecommendation?: string | null; _exceptionReason?: string | null; _publishedExternal?: boolean; _rawStatus?: string; _workNotes?: Array<{ action?: string | null; author?: string }> | null; _returnReason?: string | null }; extInfo: { status: string; label: string; description: string } }) {
    const isReworked = req._partnerDecision === "Rework Required" && req._publishedExternal && extInfo.status === "Under Review";
    const isInfoRequested = extInfo.status === "Information Requested";
    const isExceptionReview = extInfo.status === "Exception Review";
    const isClarificationResponse = req._rawStatus === "Clarification Needed" && extInfo.status === "Under Review" && !!req._workNotes?.some(n => n.action === "Clarification Response") && !req._returnReason;

    return (
        <>
            {isClarificationResponse && (
                <div style={{ marginBottom: 16, padding: "14px 18px", borderRadius: 10, border: "2px solid #67e8f9", background: "#f0fdfa" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0e7490" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
                        <span style={{ fontSize: 14, fontWeight: 700, color: "#0e7490" }}>Response Submitted — IntegraCare Review</span>
                    </div>
                    <div style={{ fontSize: 13, color: "#155e75", lineHeight: 1.5 }}>
                        Your response was received and is being reviewed by IntegraCare. No action is required from you right now.
                    </div>
                </div>
            )}
            {isReworked && (
                <div style={{ marginBottom: 16, padding: "14px 18px", borderRadius: 10, border: "2px solid #fed7aa", background: "#fff7ed" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c2410c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" /><polyline points="22 2 22 8 16 8" /></svg>
                        <span style={{ fontSize: 14, fontWeight: 700, color: "#c2410c" }}>Rework Requested — IntegraCare Review</span>
                    </div>
                    <div style={{ fontSize: 13, color: "#7c2d12", lineHeight: 1.5 }}>
                        IntegraCare is reviewing your requested revisions. No action is required from you right now.
                    </div>
                    {req._partnerNote && (
                        <div style={{ marginTop: 8, padding: "8px 10px", background: "#fff", border: "1px solid #fed7aa", borderRadius: 6, fontSize: 12, color: "#7c2d12" }}>
                            <strong>Your reason:</strong> {req._partnerNote}
                        </div>
                    )}
                </div>
            )}
            {isInfoRequested && (
                <div style={{ marginBottom: 16, padding: "14px 18px", borderRadius: 10, border: "2px solid #fcd34d", background: "#fffbeb" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
                        <span style={{ fontSize: 14, fontWeight: 700, color: "#b45309" }}>Information Requested</span>
                    </div>
                    <div style={{ fontSize: 13, color: "#92400e", lineHeight: 1.5 }}>
                        IntegraCare needs additional information from you to continue processing this request. Please respond using the form below.
                    </div>
                </div>
            )}
            {isExceptionReview && (
                <div style={{ marginBottom: 16, padding: "14px 18px", borderRadius: 10, border: "2px solid #c4b5fd", background: "#f5f3ff" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                        <span style={{ fontSize: 14, fontWeight: 700, color: "#7c3aed" }}>Exception Review</span>
                    </div>
                    <div style={{ fontSize: 13, color: "#5b21b6", lineHeight: 1.5 }}>
                        IntegraCare has identified a potential exception for this request. Review the recommendation and decision options below.
                    </div>
                </div>
            )}
        </>
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
    const [refreshKey, setRefreshKey] = useState(0);
    const extInfo = req ? getExternalStatusInfo(toExternalStatusInput(req)) : null;

    // Re-fetch data when refreshKey changes
    useEffect(() => {
        // This effect triggers a re-render when refreshKey changes
        // The data is already re-fetched via getPortalRequests()
    }, [refreshKey]);

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
            setRefreshKey(k => k + 1);
        }
    };

    const handleExceptionDecision = (decision: "Approve Removal" | "Keep Request" | "Confirm Duplicate" | "Keep Separate") => {
        partnerExceptionDecision(req.id, decision);
        setShowApprovedModal(true);
    };

    const artifacts = getWorkArtifactsByRequest(req.id);
    const messages = getExternalMessages(req.id);
    const exceptionRec = req._exceptionRecommendation;
    const isComplete = !!extInfo?.isTerminal;

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
            {extInfo && !isComplete && <StatusBanners req={req} extInfo={extInfo} />}

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
                <div style={{ marginBottom: 28 }}>
                    <div style={{
                        padding: "20px 24px", borderRadius: 14,
                        background: "#fff",
                        border: exceptionRec === "Duplicate" ? "2px solid #c4b5fd" : "2px solid #a5b4fc",
                    }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                            <div style={{
                                width: 36, height: 36, borderRadius: "50%",
                                background: exceptionRec === "Duplicate" ? "#f5f3ff" : "#eef2ff",
                                color: exceptionRec === "Duplicate" ? "#7c3aed" : "#4338ca",
                                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                            }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                    <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                                </svg>
                            </div>
                            <div>
                                <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.01em" }}>
                                    {exceptionRec === "Duplicate" ? "Potential Duplicate" : "Potentially Not Applicable"}
                                </div>
                                <div style={{ fontSize: 13, color: "#334155", marginTop: 2 }}>
                                    {exceptionRec === "Duplicate"
                                        ? "IntegraCare identified this request as a potential duplicate. Review the reason below and decide."
                                        : "IntegraCare identified this request as potentially not applicable. Review the reason below and decide."}
                                </div>
                            </div>
                        </div>

                        {req._exceptionReason && (
                            <div style={{
                                padding: "14px 16px", background: "#f8faff",
                                border: "1px solid #e0e7ff", borderRadius: 10, marginBottom: 18,
                            }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 6 }}>
                                    Reason provided by IntegraCare
                                </div>
                                <div style={{ fontSize: 14, color: "#0f172a", lineHeight: 1.6, fontWeight: 500 }}>
                                    {req._exceptionReason}
                                </div>
                            </div>
                        )}

                        <div style={{ display: "flex", gap: 14, marginTop: 4 }}>
                            {exceptionRec === "Duplicate" ? (
                                <>
                                    <button
                                        className="rc-btn rc-btn-primary"
                                        onClick={() => handleExceptionDecision("Confirm Duplicate")}
                                        style={{ padding: "12px 32px", fontSize: 15, fontWeight: 700, borderRadius: 10 }}
                                    >
                                        Confirm Duplicate
                                    </button>
                                    <button
                                        className="rc-btn rc-btn-secondary"
                                        onClick={() => handleExceptionDecision("Keep Separate")}
                                        style={{
                                            padding: "12px 32px", fontSize: 15, fontWeight: 700, borderRadius: 10,
                                            border: "2px solid #c7d2fe", color: "#0f172a",
                                        }}
                                    >
                                        Keep as Separate Request
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        className="rc-btn rc-btn-primary"
                                        onClick={() => handleExceptionDecision("Approve Removal")}
                                        style={{ padding: "12px 32px", fontSize: 15, fontWeight: 700, borderRadius: 10 }}
                                    >
                                        Approve Removal
                                    </button>
                                    <button
                                        className="rc-btn rc-btn-secondary"
                                        onClick={() => handleExceptionDecision("Keep Request")}
                                        style={{
                                            padding: "12px 32px", fontSize: 15, fontWeight: 700, borderRadius: 10,
                                            border: "2px solid #c7d2fe", color: "#0f172a",
                                        }}
                                    >
                                        Keep Request
                                    </button>
                                </>
                            )}
                        </div>
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
                <InformationRequestedSection req={req} onResponseSubmitted={() => setRefreshKey(k => k + 1)} />
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

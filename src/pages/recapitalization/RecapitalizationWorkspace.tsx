import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { lookupWorkspaceItem, updateRequestStatus, updateRequestOwner, updateRequestExternalStatus, updateRequestCompletion, addActivityEntry, getWorkArtifactsByRequest, getActivity, saveWorkArtifacts, removeWorkArtifact, generateDisplayFileName, updateRequestStatusNotes, promoteToReusableKnowledge, getReusableKnowledgeRecommendation, addWorkNote, editWorkNote, deleteWorkNote, isDemoActive, addExternalMessage, getExternalMessages, updateRequestNotMine, updateRequestReturnToOwner, sendExceptionRecommendation } from "../../services/recapDataService";
import type { RecapRequest, WorkArtifact, WorkNoteEntry } from "../../services/recapDataService";
import ClarificationThread from "../../components/common/ClarificationThread";
import RecapSubNav from "./RecapSubNav";
import "./Recapitalization.css";

const TEAM_MEMBERS = ["Sarah Chen", "James Wright", "Lisa Park", "Tom Davies", "Mike O'Brien", "Anna Patel", "David Park", "Carlos Rivera", "Demo User (Test)"];

const STATUS_COLORS: Record<string, string> = {
    "Open": "#2563eb",
    "In Progress": "#f59e0b",
    "Blocked": "#dc2626",
    "Complete": "#22c55e",
    "Not Applicable": "#7c3aed",
    "Duplicate": "#dc2626",
};

function getInitials(name: string): string {
    return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

function RequestIdentityBlock({ displayId, displayTitle }: { displayId: string; displayTitle: string }) {
    return (
        <div style={{ fontSize: 12, color: "#334155", marginBottom: 14, display: "flex", flexDirection: "column", gap: 6, padding: "10px 12px", background: "#f8faff", borderRadius: 8, border: "1px solid #e0e7ff" }}>
            <div><span style={{ fontWeight: 700, color: "#0f172a", textTransform: "uppercase", fontSize: 10, letterSpacing: "0.03em", marginRight: 8 }}>Request ID</span><span style={{ fontFamily: '"SF Mono", "Cascadia Code", "Consolas", monospace', fontSize: 12, fontWeight: 600, color: "#0f172a" }}>{displayId}</span></div>
            <div><span style={{ fontWeight: 700, color: "#0f172a", textTransform: "uppercase", fontSize: 10, letterSpacing: "0.03em", marginRight: 8 }}>Deliverable</span><span style={{ color: "#0f172a", fontWeight: 500 }}>{displayTitle || "\u2014"}</span></div>
        </div>
    );
}

const BADGE_STYLES: Record<string, { bg: string; fg: string; border: string; label: string }> = {
    "Blocked": { bg: "#ffe4e6", fg: "#be123c", border: "#fecdd3", label: "text" },
    "Duplicate": { bg: "#ede9fe", fg: "#6d28d9", border: "#ddd6fe", label: "text" },
    "Not Applicable": { bg: "#f5f5f4", fg: "#78716c", border: "#e7e5e4", label: "text" },
    "Not Mine": { bg: "#dbeafe", fg: "#1d4ed8", border: "#bfdbfe", label: "text" },
    "Returned to Owner": { bg: "#fed7aa", fg: "#c2410c", border: "#fdba74", label: "text" },
    "Completed": { bg: "#dcfce7", fg: "#16a34a", border: "#bbf7d0", label: "text" },
    "Work Note": { bg: "#e0f2fe", fg: "#0284c7", border: "#bae6fd", label: "text" },
    "Note": { bg: "#e0f2fe", fg: "#0284c7", border: "#bae6fd", label: "text" },
    "DD Review": { bg: "#eef2ff", fg: "#4f46e5", border: "#c7d2fe", label: "text" },
    "Status Note": { bg: "#f1f5f9", fg: "#475569", border: "#e2e8f0", label: "text" },
};

function getBadgeStyle(action: string | null) {
    const key = action || "Status Note";
    const s = BADGE_STYLES[key] || BADGE_STYLES["DD Review"];
    return { display: "inline-block" as const, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: s.bg, color: s.fg, border: `1px solid ${s.border}`, lineHeight: "16px", letterSpacing: "0.02em" };
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

function ActionTile({ icon, label, desc, onClick }: { icon: React.ReactNode; label: string; desc: string; onClick: () => void }) {
    return (
        <div 
            onClick={onClick}
            style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", border: "1px solid #e0e7ff", borderRadius: 12, background: "#fff", cursor: "pointer", transition: "all 0.15s", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#93c5fd"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(37,99,235,0.08)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#e0e7ff"; e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.02)"; }}
        >
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "#f8faff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {icon}
            </div>
            <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{label}</div>
                <div style={{ fontSize: 11, color: "#475569", marginTop: 1 }}>{desc}</div>
            </div>
        </div>
    );
}

export default function RecapitalizationWorkspace() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const [wsRefreshKey, setWsRefreshKey] = useState(0);
    const result = useMemo(() => id ? lookupWorkspaceItem(id) : null, [id, wsRefreshKey]);

    const [internalOwner, setInternalOwner] = useState("");

    const [localQuestions, setLocalQuestions] = useState<WorkspaceQuestion[]>([]);

    const [needClarificationOpen, setNeedClarificationOpen] = useState(false);
    const [clarificationText, setClarificationText] = useState("");
    const [clarificationAdditionalContext, setClarificationAdditionalContext] = useState("");
    const [clarificationSubmitStep, setClarificationSubmitStep] = useState<"select" | "confirm" | "done">("select");
    const [blockModal, setBlockModal] = useState<{ step: "input" | "completed"; reason: string } | null>(null);
    const [duplicateModal, setDuplicateModal] = useState<{ reason: string; optionalId: string } | null>(null);
    const [notApplicableModal, setNotApplicableModal] = useState<{ reason: string } | null>(null);
    const [ddOpsRecommendModal, setDdOpsRecommendModal] = useState<{ type: "Duplicate" | "Not Applicable"; partnerNote: string } | null>(null);
    const [resolutionPrompt, setResolutionPrompt] = useState<{ note: string } | null>(null);
    const [completionModal, setCompletionModal] = useState<{ step: "input" | "completed"; note: string; readyForReview: boolean } | null>(null);
    const [notMine, setNotMine] = useState<{ req: RecapRequest; reason: string } | null>(null);
    const [workArtifacts, setWorkArtifacts] = useState<WorkArtifact[]>([]);
    const [wnComposerOpen, setWnComposerOpen] = useState(false);
    const [wnText, setWnText] = useState("");
    const [extMsgComposerOpen, setExtMsgComposerOpen] = useState(false);
    const [extMsgText, setExtMsgText] = useState("");
    const [extMsgConfirm, setExtMsgConfirm] = useState(false);
    const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
    const [editingNoteText, setEditingNoteText] = useState("");
    const workspaceUserKey = "integrasource.recap.workspaceUser";
    const [currentUser] = useState(() => localStorage.getItem(workspaceUserKey) || TEAM_MEMBERS[0]);
    const [actionFeedback, setActionFeedback] = useState<string | null>(null);
    const [completionDialog, setCompletionDialog] = useState<"blocked" | "clarification" | "dd-review" | "return-to-owner" | "duplicate" | "not-applicable" | "not-mine" | "resolved" | null>(null);
    const [publishExternal, setPublishExternal] = useState<{ step: number; selectedArtifacts: string[]; note: string } | null>(null);
    const [artifactDetail, setArtifactDetail] = useState<WorkArtifact | null>(null);
    const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
    const [dragOverUpload, setDragOverUpload] = useState(false);
    const [returnToOwnerModal, setReturnToOwnerModal] = useState<{ step: "input" | "completed"; reason: string } | null>(null);
    const [clarifyResponseModal, setClarifyResponseModal] = useState<{ response: string } | null>(null);
    const [clarificationSupportModalOpen, setClarificationSupportModalOpen] = useState(false);
    const [clarificationPath, setClarificationPath] = useState<"A" | "B" | null>(null);
    const [clarificationInternalResponse, setClarificationInternalResponse] = useState("");
    const [clarificationInternalNote, setClarificationInternalNote] = useState("");
    const [clarificationExternalQuestion, setClarificationExternalQuestion] = useState("");
    const [clarificationExternalInstructions, setClarificationExternalInstructions] = useState("");

    // Stable storage key for artifact persistence: use requestId > intakeId > route id
    const artifactStorageKey = useMemo(() => {
        if (!result) return id || "";
        const item = (result as any).item;
        return item?.requestId || item?.intakeId || item?.id || id || "";
    }, [result, id]);

    useEffect(() => {
        if (artifactStorageKey) setWorkArtifacts(getWorkArtifactsByRequest(artifactStorageKey));
    }, [artifactStorageKey]);

    useEffect(() => {
        if (actionFeedback) {
            const t = setTimeout(() => setActionFeedback(null), 4000);
            return () => clearTimeout(t);
        }
    }, [actionFeedback]);

    useEffect(() => {
        if (uploadSuccess) {
            const t = setTimeout(() => setUploadSuccess(null), 5000);
            return () => clearTimeout(t);
        }
    }, [uploadSuccess]);

    const backFrom = (location.state as any)?.from || "tracker";
    const isDdOps = backFrom === "dd-operations";
    const backLabel = backFrom === "my-work" ? "Back to My Work" : backFrom === "dd-operations" ? "Back to DD Operations" : "Back to Work Queue";
    const backPath = backFrom === "my-work" ? "/recapitalization/my-work" : backFrom === "dd-operations" ? "/recapitalization/dd-operations" : "/recapitalization/tracker";

    if (!result) {
        return (
            <div className="rc-page">
                <RecapSubNav />
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "80px 20px", gap: 12, textAlign: "center" }}>
                    <h2 style={{ fontSize: 20, color: "#0f172a", margin: 0 }}>Item Not Found</h2>
                    <p style={{ fontSize: 14, color: "#475569" }}>The requested workspace item could not be found.</p>
                    <button className="rc-btn rc-btn-primary" onClick={() => navigate("/recapitalization/intake")}>Back to Intake Queue</button>
            </div>
        </div>
    );
}

/* ── Shared Action Center State Card ── */

function WorkflowStateCard({
    icon,
    iconBg,
    title,
    subtitle,
    body,
    details,
    accentColor,
    bgColor,
    borderColor,
}: {
    icon: React.ReactNode;
    iconBg: string;
    title: string;
    subtitle: string;
    body: string;
    details?: { label: string; value: string }[];
    accentColor: string;
    bgColor: string;
    borderColor: string;
}) {
    return (
        <div style={{ marginBottom: 24, padding: "16px 20px", borderRadius: 12, background: bgColor, border: `2px solid ${borderColor}`, boxShadow: `0 2px 8px rgba(0,0,0,0.04)` }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: iconBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {icon}
                </div>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>{title}</div>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 6, padding: "3px 8px", borderRadius: 4, background: iconBg + "33", fontSize: 11, fontWeight: 600, color: accentColor }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                        {subtitle}
                    </div>
                    <div style={{ fontSize: 13, color: "#475569", marginTop: 8, lineHeight: 1.5 }}>{body}</div>
                    {details && details.length > 0 && (
                        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
                            {details.map((d, i) => (
                                <div key={i} style={{ display: "flex", gap: 6, fontSize: 12, color: "#334155", lineHeight: 1.5 }}>
                                    <span style={{ fontWeight: 700, color: "#475569", textTransform: "uppercase", fontSize: 10, letterSpacing: "0.03em", minWidth: 70, flexShrink: 0 }}>{d.label}</span>
                                    <span style={{ wordBreak: "break-word" }}>{d.value}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

    const { transaction } = result;
    const item = result.item as any;

    const displayId = item.requestId || item.intakeId || item.id;
    const displayTitle = item.title || item.fileName || "";
    const displayStatus = item.status;
    const communities = item.communityNames || [];
    const description = item.description || "";
    const submittedDate = item.submittedAt ? new Date(item.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : item.createdDate || "";

    const isBulkUpload = item.type === "Broker Upload";
    const isDuplicate = displayStatus === "Duplicate";
    const statusColor = STATUS_COLORS[displayStatus] || "#64748b";
    const isTerminal = displayStatus === "Completed" || displayStatus === "Closed" || displayStatus === "Closed / Duplicate" || displayStatus === "Closed / Not Applicable" || (!isDdOps && displayStatus === "Complete") || (["Duplicate", "Not Applicable"].includes(displayStatus) && !!(item as any)._exceptionDecision);
    const exceptionSentToPartner = ["Duplicate", "Not Applicable"].includes(displayStatus) && !!(item as any)._exceptionSentAt && !(item as any)._exceptionDecision;

    const completionSummary = useMemo(() => {
        if (result.type === "request") {
            const req = result.item as RecapRequest;
            if (req._completedBy) {
                return {
                    completedBy: req._completedBy,
                    completedDate: req._completedAt || "",
                    completionNotes: req._completionNotes || "",
                    supportingArtifacts: workArtifacts.filter(a => a.name).map(a => a.name),
                    reviewer: "",
                };
            }
        }
        return null;
    }, [result, workArtifacts]);

    useEffect(() => {
        setInternalOwner(item.suggestedOwner || item.owner || "");
    }, [item]);

    useEffect(() => {
        const reqId = item.requestId || item.id || "";
        if (reqId) {
            const existing = getExternalMessages(reqId);
            if (existing.length > 0) {
                setLocalQuestions(
                    existing.map(msg => ({
                        id: msg.id,
                        from: msg.author,
                        question: msg.text,
                        response: null,
                        status: "Answered" as const,
                        timestamp: msg.timestamp,
                    }))
                );
            }
        }
    }, [item, wsRefreshKey]);

    const [sections, setSections] = useState<Record<string, boolean>>({
        artifacts: true,
        workNotes: true,
        conversation: true,
        completionSummary: false,
    });

    const toggleSection = (key: string) => setSections(prev => ({ ...prev, [key]: !prev[key] }));

    interface WorkNote {
        id: string;
        text: string;
        author: string | null;
        timestamp: string | null;
        action: string | null;
    }

    const workNotes: WorkNote[] = useMemo(() => {
        const notes: WorkNote[] = [];
        const req = item as any;
        const reqId = req.requestId || req.id || "";

        // 1. Start with explicit _workNotes entries (highest fidelity, has author/timestamp)
        if (req._workNotes) {
            for (const wn of req._workNotes) {
                notes.push({
                    id: wn.id,
                    text: wn.text,
                    author: wn.author,
                    timestamp: wn.timestamp,
                    action: wn.action || null,
                });
            }
        }

        // 2. Supplement with activity entries not already covered
        const allActivities = getActivity(200);
        const reqActivities = allActivities.filter(
            a => a.requestId === reqId || a.requestId === req.id
        );

        for (const act of reqActivities) {
            let noteText: string | null = null;
            let action: string | null = null;
            if (notes.some(n => n.text === act.description || (act.description.includes(n.text) && n.text.length > 10))) continue;

            if (act.type === "Status Change" || act.type === "Note") {
                const desc = act.description;
                if (act.type === "Note") {
                    noteText = desc;
                    action = act.type;
                } else if (desc.includes("Reason:") || desc.includes("Notes:")) {
                    noteText = desc;
                    if (desc.toLowerCase().includes("returned to owner")) action = "Returned to Owner";
                    else if (desc.includes("Not Mine")) action = "Not Mine";
                    else if (desc.toLowerCase().includes("complete")) action = "Completed";
                    else if (desc.includes("Blocked")) action = "Blocked";
                    else if (desc.includes("Duplicate")) action = "Duplicate";
                    else if (desc.includes("Not Applicable")) action = "Not Applicable";
                }
            }

            if (noteText) {
                notes.push({
                    id: "act-" + act.id,
                    text: noteText,
                    author: act.userName,
                    timestamp: act.timestamp,
                    action,
                });
            }
        }

        // 3. Supplement with legacy fields not already covered
        const legacyChecks: { field: string | null | undefined; id: string; action: string; author: string | null; ts: string | null }[] = [
            { field: req._statusNotes, id: "wn-statusnotes", action: "Status Note", author: null, ts: null },
            { field: req._completionNotes, id: "wn-completion", action: "Completed", author: req._completedBy || null, ts: req._completedAt || null },
            { field: req._returnReason, id: "wn-return", action: "Returned to Owner", author: req._returnedBy || null, ts: null },
            { field: req._misassignedReason, id: "wn-notmine", action: "Not Mine", author: null, ts: null },
        ];

        for (const lc of legacyChecks) {
            if (lc.field && !notes.some(n => n.text.includes(lc.field!))) {
                notes.push({
                    id: lc.id,
                    text: lc.field!,
                    author: lc.author,
                    timestamp: lc.ts,
                    action: lc.action,
                });
            }
        }

        notes.sort((a, b) => {
            const aTime = a.timestamp || "";
            const bTime = b.timestamp || "";
            if (bTime !== aTime) return bTime.localeCompare(aTime);
            return 0;
        });

        return notes;
    }, [item, wsRefreshKey]);



    function doStatusChange(newStatus: RecapRequest["status"]) {
        const reqId = item.id || item.intakeId || "";
        updateRequestStatus(reqId, newStatus);
        addActivityEntry({
            type: "Status Change",
            description: `Status changed to ${newStatus}`,
            userId: "current-user",
            userName: currentUser,
            requestId: item.requestId || item.id,
            requestTitle: displayTitle || item.category || "",
            transactionId: item.transactionId,
            transactionName: item.transactionName || item.transactionId,
        });
        setWsRefreshKey(k => k + 1);
        setActionFeedback(`\u2713 Status updated to ${newStatus}`);
    }

    function doAssign(newOwner: string) {
        const reqId = item.id || item.intakeId || "";
        updateRequestOwner(reqId, newOwner || null);
        setInternalOwner(newOwner);
        addActivityEntry({
            type: "Assignment",
            description: `${displayId}: ${newOwner ? `Assigned to ${newOwner}` : "Unassigned"} by ${currentUser}`,
            userId: "current-user",
            userName: currentUser,
            requestId: item.requestId || item.id,
            requestTitle: displayTitle || item.category || "",
            transactionId: item.transactionId,
            transactionName: item.transactionName || item.transactionId,
        });
        setWsRefreshKey(k => k + 1);
        setActionFeedback(newOwner ? `\u2713 Assigned to ${newOwner}` : "\u2713 Unassigned");
    }

    function submitClarification() {
        if (!clarificationText.trim()) return;
        const reqId = item.id || item.intakeId || "";
        
        // Save the clarification question
        updateRequestStatus(reqId, "Clarification Needed" as RecapRequest["status"]);
        updateRequestStatusNotes(reqId, clarificationText.trim());
        addWorkNote(reqId, clarificationText.trim(), currentUser, "Clarification Needed");
        
        // Save additional context if provided
        if (clarificationAdditionalContext.trim()) {
            addWorkNote(reqId, clarificationAdditionalContext.trim(), currentUser, "Clarification Context");
        }
        
        // Add activity entry
        addActivityEntry({
            type: "Status Change",
            description: `${displayId}: Clarification requested by ${currentUser} and sent to DD Operations. Question: ${clarificationText.trim()}`,
            userId: "current-user",
            userName: currentUser,
            requestId: item.requestId || item.id,
            requestTitle: displayTitle || item.category || "",
            transactionId: item.transactionId,
            transactionName: item.transactionName || item.transactionId,
        });
        
        // Show success state
        setClarificationSubmitStep("done");
        setWsRefreshKey(k => k + 1);
    }

    function submitClarifyResponse() {
        if (!clarifyResponseModal?.response.trim()) return;
        const resp = clarifyResponseModal.response.trim();
        const reqId = item.id || item.intakeId || "";
        updateRequestStatus(reqId, "In Progress" as RecapRequest["status"]);
        updateRequestStatusNotes(reqId, resp);
        addWorkNote(reqId, resp, currentUser, "Clarification Response");
        addActivityEntry({
            type: "Status Change",
            description: `${displayId}: DD Ops responded to clarification request. Response: ${resp}`,
            userId: currentUser,
            userName: currentUser,
            requestId: item.requestId || item.id,
            requestTitle: displayTitle || item.category || "",
            transactionId: item.transactionId,
            transactionName: item.transactionName || item.transactionId,
        });
        setClarifyResponseModal(null);
        setWsRefreshKey(k => k + 1);
        setActionFeedback("Clarification response sent. Request returned to Active Work.");
    }

    function submitClarificationSupport() {
        const reqId = item.id || item.intakeId || "";
        if (clarificationPath === "A") {
            // Path A: Answer contributor internally and return
            updateRequestStatus(reqId, "In Progress" as RecapRequest["status"]);
            addWorkNote(reqId, clarificationInternalResponse.trim(), currentUser, "Clarification Response");
            if (clarificationInternalNote.trim()) {
                addWorkNote(reqId, clarificationInternalNote.trim(), currentUser, "Work Note");
            }
            addActivityEntry({
                type: "Status Change",
                description: `${displayId}: Clarification answered by DD Operations and returned to ${item.owner}.`,
                userId: currentUser,
                userName: currentUser,
                requestId: item.requestId || item.id,
                requestTitle: displayTitle || item.category || "",
                transactionId: item.transactionId,
                transactionName: item.transactionName || item.transactionId,
            });
            setClarificationSubmitStep("done");
            setActionFeedback("Clarification answered by DD Operations. Request returned to contributor.");
        } else if (clarificationPath === "B") {
            // Path B: Send to external partner
            updateRequestStatus(reqId, "Clarification Needed" as RecapRequest["status"]);
            addWorkNote(reqId, clarificationExternalQuestion.trim(), currentUser, "Clarification External Question");
            if (clarificationExternalInstructions.trim()) {
                addWorkNote(reqId, clarificationExternalInstructions.trim(), currentUser, "Work Note");
            }
            addActivityEntry({
                type: "Status Change",
                description: `${displayId}: Clarification sent to external partner by ${currentUser}.`,
                userId: currentUser,
                userName: currentUser,
                requestId: item.requestId || item.id,
                requestTitle: displayTitle || item.category || "",
                transactionId: item.transactionId,
                transactionName: item.transactionName || item.transactionId,
            });
            setClarificationSubmitStep("done");
            setActionFeedback("Clarification sent to external partner. Request paused internally.");
        }
        setWsRefreshKey(k => k + 1);
    }

    function handleArtifactUpload(files: File[]) {
        const idx = workArtifacts.length + 1;
        const newArtifacts = files.map((f, i) => ({
            id: "art-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
            name: f.name,
            size: f.size,
            uploadedAt: new Date().toISOString().split("T")[0],
            requestId: artifactStorageKey,
            intakeId: item?.intakeId,
            originalFileName: f.name,
            displayFileName: generateDisplayFileName(displayId || id, displayTitle || item?.category || "", idx + i, f.name),
            uploadedBy: currentUser,
            artifactType: "Work Artifact",
            isPrototype: true,
        }));
        const updated = [...workArtifacts, ...newArtifacts];
        setWorkArtifacts(updated);
        saveWorkArtifacts(artifactStorageKey, updated);
        if (files.length > 0) {
            setActionFeedback(`\u2713 ${files.length} artifact${files.length !== 1 ? "s" : ""} uploaded successfully`);
            setUploadSuccess(files.map(f => f.name).join(", "));
            addActivityEntry({ type: "Document", description: "Uploaded artifact" + (files.length > 1 ? "s" : "") + ": " + files.map(f => f.name).join(", "), userId: "current-user", userName: currentUser, requestId: id!, requestTitle: displayTitle || item?.category || "", transactionId: item?.transactionId || "", transactionName: item?.transactionName || item?.transactionId || "" });
        }
    }

    function doReturnToOwner() {
        if (!returnToOwnerModal?.reason.trim()) return;
        const reqId = item.id || item.intakeId || "";
        
        // Check if this is a clarification response return
        const hasExternalClarificationResponse = displayStatus === "Clarification Needed" && 
            item._workNotes?.some((n: WorkNoteEntry) => n.action === "Clarification Response");
        
        if (hasExternalClarificationResponse) {
            // For external clarification response, update status and add guidance
            updateRequestStatus(reqId, "In Progress" as RecapRequest["status"]);
            addWorkNote(reqId, returnToOwnerModal.reason.trim(), currentUser, "Clarification Guidance");
            addActivityEntry({
                type: "Status Change",
                description: `${displayId}: External clarification response returned to owner by ${currentUser} with guidance.`,
                userId: currentUser,
                userName: currentUser,
                requestId: item.requestId || item.id,
                requestTitle: displayTitle || item.category || "",
                transactionId: item.transactionId,
                transactionName: item.transactionName || item.transactionId,
            });
            setActionFeedback("External clarification response returned to owner with guidance.");
        } else {
            // Standard return to owner flow
            updateRequestReturnToOwner(reqId, returnToOwnerModal.reason.trim(), currentUser);
            setCompletionDialog("return-to-owner");
        }
        
        setWsRefreshKey(k => k + 1);
        setReturnToOwnerModal(null);
    }

    return (
        <div style={{ background: "#ffffff", minHeight: "100vh", paddingBottom: 40 }}>
            <RecapSubNav />
            <div className="rc-page" style={{ maxWidth: 1100, gap: 0 }}>
                {/* Breadcrumb */}
                <div style={{ marginBottom: 16 }}>
                    <button onClick={() => navigate(backPath)} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "#2563eb", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
                        {backLabel}
                    </button>
                </div>

                {/* Test identity hint (demo/preview only) */}
                {isDemoActive() && (
                    <div style={{ marginBottom: 12, fontSize: 11, color: "#475569", display: "flex", alignItems: "center", gap: 6 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
                        Testing as: <strong>{currentUser}</strong>
                        <span style={{ fontStyle: "italic", color: "#64748b" }}>(internal preview mode)</span>
                    </div>
                )}

                {/* Main Content Card */}
                <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e0e7ff", boxShadow: "0 4px 20px rgba(79,70,229,0.06)", overflow: "hidden" }}>
                    {/* Hero Section */}
                    <div style={{ padding: "28px 32px", display: "flex", gap: 28, flexWrap: "wrap" }}>
                        {/* Left: ID + Title */}
                        <div style={{ flex: "1 1 320px", minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                                <BluePill>Request ID</BluePill>
                                <span style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", fontFamily: '"SF Mono", "Cascadia Code", "Consolas", monospace', letterSpacing: "-0.01em" }}>{displayId}</span>
                                {item.intakeId && item.intakeId !== displayId && (
                                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: 8 }}>
                                        <span style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em" }}>Intake ID</span>
                                        <span style={{ fontSize: 13, fontWeight: 600, color: "#475569", fontFamily: '"SF Mono", "Cascadia Code", "Consolas", monospace' }}>{item.intakeId}</span>
                                    </div>
                                )}
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
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
                                    {communities.slice(0, 2).join(", ") || "\u2014"}
                                </span>
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
                                    {transaction.name}
                                </span>
                            </div>
                        </div>

                        {/* Right: Status + Assign */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 240, maxWidth: 280 }}>
                            {/* Status */}
                            <div>
                                <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 5 }}>Status</div>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 10px", fontSize: 13, fontWeight: 600, borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", color: "#0f172a" }}>
                                    {statusDot(statusColor)}
                                    <span>{displayStatus}</span>
                                </div>
                            </div>

                            {/* Owner */}
                            <div>
                                <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 5 }}>Owner</div>
                                <div style={{ position: "relative" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 32px 7px 10px", fontSize: 13, fontWeight: 500, borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", pointerEvents: "none" }}>
                                        {internalOwner ? (
                                            <>
                                                <span style={{ width: 22, height: 22, borderRadius: "50%", background: "#dbeafe", color: "#1d4ed8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{getInitials(internalOwner)}</span>
                                                <span style={{ color: "#0f172a" }}>{internalOwner}</span>
                                            </>
                                        ) : (
                                            <>
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                                                <span style={{ color: "#475569" }}>Unassigned</span>
                                            </>
                                        )}
                                    </div>
                                    <select
                                        id="ws-owner-select"
                                        value={internalOwner || ""}
                                        onChange={e => doAssign(e.target.value)}
                                        style={{ position: "absolute", inset: 0, width: "100%", opacity: 0, cursor: "pointer", fontSize: 13 }}
                                    >
                                        <option value="">Unassigned</option>
                                        {TEAM_MEMBERS.map(n => <option key={n} value={n}>{n}</option>)}
                                    </select>
                                </div>
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

                    {(!isTerminal || (!isDdOps && displayStatus === "Complete")) && !exceptionSentToPartner && (
                    <>
                    {isDdOps ? (
                      <div style={{ padding: "0 32px 24px" }}>
                        <div style={{ border: "2px solid #dbeafe", borderRadius: 16, padding: 28, background: "linear-gradient(135deg, #faf5ff 0%, #f0f7ff 100%)", boxShadow: "0 2px 12px rgba(37,99,235,0.06)" }}>
                          <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", marginBottom: 4 }}>DD Operations Review</div>
                          <div style={{ fontSize: 14, color: "#475569", marginBottom: 24 }}>Review the submitted work and choose the next step.</div>

                          {/* External Clarification Response Received Banner */}
                          {displayStatus === "Clarification Needed" && item._workNotes?.some((n: WorkNoteEntry) => n.action === "Clarification Response") && (
                            <div style={{ marginBottom: 20, padding: "16px 20px", borderRadius: 12, background: "#f0fdf4", border: "2px solid #bbf7d0", boxShadow: "0 2px 8px rgba(16,185,129,0.06)" }}>
                              <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
                                </div>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>External Clarification Response Received</div>
                                  <div style={{ fontSize: 13, color: "#475569", marginTop: 4, lineHeight: 1.5 }}>The external partner has responded to your information request.</div>
                                  {item._workNotes?.filter((n: WorkNoteEntry) => n.action === "Clarification Response").map((n: WorkNoteEntry) => (
                                    <div key={n.id} style={{ marginTop: 8, padding: "8px 12px", background: "rgba(255,255,255,0.7)", border: "1px solid #bbf7d0", borderRadius: 6, fontSize: 12, color: "#166534", lineHeight: 1.5 }}>
                                      <span style={{ fontWeight: 700, display: "block", marginBottom: 2, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.03em" }}>External Response:</span>
                                      {n.text}
                                    </div>
                                  ))}
                                  <div style={{ marginTop: 8, fontSize: 12, color: "#475569" }}>
                                    <strong>Next Action:</strong> Return to Owner with Response or Continue Internal Review
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          <div style={{ display: "flex", gap: 16, marginBottom: 28 }}>
                            {displayStatus === "Clarification Needed" && item._workNotes?.some((n: WorkNoteEntry) => n.action === "Clarification Response") ? (
                              <div
                                onClick={() => setReturnToOwnerModal({ step: "input", reason: "" })}
                                style={{ flex: 1, display: "flex", alignItems: "center", gap: 16, padding: "18px 20px", border: "2px solid #bbf7d0", borderRadius: 14, background: "#fff", cursor: "pointer", transition: "all 0.15s", boxShadow: "0 1px 4px rgba(0,0,0,0.02)" }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = "#22c55e"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(34,197,94,0.1)"; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = "#bbf7d0"; e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.02)"; }}
                              >
                                <div style={{ width: 44, height: 44, borderRadius: 12, background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
                                </div>
                                <div>
                                  <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>Return to Owner with Response</div>
                                  <div style={{ fontSize: 13, color: "#475569", marginTop: 2 }}>Share the external partner's answer with the contributor</div>
                                </div>
                              </div>
                            ) : (
                              <div
                                onClick={() => setReturnToOwnerModal({ step: "input", reason: "" })}
                                style={{ flex: 1, display: "flex", alignItems: "center", gap: 16, padding: "18px 20px", border: "2px solid #fed7aa", borderRadius: 14, background: "#fff", cursor: "pointer", transition: "all 0.15s", boxShadow: "0 1px 4px rgba(0,0,0,0.02)" }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = "#f59e0b"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(245,158,11,0.1)"; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = "#fed7aa"; e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.02)"; }}
                              >
                                <div style={{ width: 44, height: 44, borderRadius: 12, background: "#fffbeb", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>
                                </div>
                                <div>
                                  <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>Return to Owner</div>
                                  <div style={{ fontSize: 13, color: "#475569", marginTop: 2 }}>Send back with feedback</div>
                                </div>
                              </div>
                            )}

                            <div
                              onClick={workArtifacts.length > 0 && (displayStatus === "Complete" || displayStatus === "Needs Rework") ? () => setPublishExternal({ step: 1, selectedArtifacts: workArtifacts.map(a => a.name), note: "" }) : undefined}
                              style={{ flex: 1, display: "flex", alignItems: "center", gap: 16, padding: "18px 20px", border: "2px solid #bbf7d0", borderRadius: 14, background: "#fff", cursor: workArtifacts.length > 0 && (displayStatus === "Complete" || displayStatus === "Needs Rework") ? "pointer" : "not-allowed", transition: "all 0.15s", boxShadow: "0 1px 4px rgba(0,0,0,0.02)", opacity: workArtifacts.length > 0 && (displayStatus === "Complete" || displayStatus === "Needs Rework") ? 1 : 0.5 }}
                              onMouseEnter={e => { if (workArtifacts.length > 0) { e.currentTarget.style.borderColor = "#22c55e"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(34,197,94,0.1)"; }}}
                              onMouseLeave={e => { e.currentTarget.style.borderColor = "#bbf7d0"; e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.02)"; }}
                            >
                              <div style={{ width: 44, height: 44, borderRadius: 12, background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a3 3 0 1 0 3.99 3.98m-9.19-1.17L2 21l2.44-2.44m5.57-5.57L18 5l3 3L13.01 13.01" /></svg>
                              </div>
                              <div>
                                <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>{displayStatus === "Needs Rework" ? "Re-Publish External" : "Publish External"}</div>
                                <div style={{ fontSize: 13, color: "#475569", marginTop: 2 }}>
                                  {workArtifacts.length > 0 ? "Share approved artifacts with the external partner" : "Upload at least one work artifact before publishing."}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div style={{ marginBottom: 14 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 12 }}>Other Actions</div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                              <ActionTile icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0891b2" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>} label="Clarification Support" desc="Answer internally or request information" onClick={() => setClarificationSupportModalOpen(true)} />
                              <ActionTile icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>} label="Return to Owner" desc="Send back with feedback" onClick={() => setReturnToOwnerModal({ step: "input", reason: "" })} />
                              <ActionTile icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>} label="Reassign Owner" desc="Change the current owner" onClick={() => { const el = document.getElementById("ws-owner-select"); if (el) { (el as HTMLSelectElement).focus(); (el as HTMLSelectElement).click(); }}} />
                              <ActionTile icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6d28d9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>} label="Recommend Duplicate to Partner" desc="Validate and send recommendation" onClick={() => setDdOpsRecommendModal({ type: "Duplicate", partnerNote: "" })} />
                              <ActionTile icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>} label="Recommend Not Applicable to Partner" desc="Validate and send recommendation" onClick={() => setDdOpsRecommendModal({ type: "Not Applicable", partnerNote: "" })} />
                            </div>
                          </div>

                          {actionFeedback && (
                            <div style={{ padding: "8px 12px", marginTop: 8, borderRadius: 8, background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
                              <span style={{ flex: 1 }}>{actionFeedback}</span>
                              <button style={{ background: "none", border: "none", color: "#166534", cursor: "pointer", fontSize: 16, fontWeight: 700, padding: 0, lineHeight: 1 }} onClick={() => setActionFeedback(null)}>&times;</button>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div style={{ padding: "0 32px 24px" }}>
                        <div style={{ border: "2px solid #dbeafe", borderRadius: 16, padding: 28, background: "linear-gradient(135deg, #f8faff 0%, #f0f7ff 100%)", boxShadow: "0 2px 12px rgba(37,99,235,0.06)" }}>
                          <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", marginBottom: 4 }}>Action Center</div>
                          <div style={{ fontSize: 14, color: "#475569", marginBottom: 24 }}>What would you like to do next?</div>

                          {/* Submitted for DD Review waiting state */}
                          {displayStatus === "Complete" && !isDdOps && (
                            <div style={{ marginBottom: 24, padding: "16px 20px", borderRadius: 12, background: "#f0f7ff", border: "2px solid #dbeafe", boxShadow: "0 2px 8px rgba(37,99,235,0.06)" }}>
                              <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#dbeafe", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
                                </div>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Submitted for DD Review</div>
                                  <div style={{ fontSize: 13, color: "#475569", marginTop: 4, lineHeight: 1.5 }}>Your work has been submitted. Waiting for DD Operations to review.</div>
                                  <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8, padding: "4px 10px", borderRadius: 4, background: "#dbeafe", fontSize: 11, fontWeight: 600, color: "#1d4ed8" }}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                                    Waiting for DD Operations
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Needs Rework banner */}
                          {displayStatus === "Needs Rework" && !isDdOps && (
                            <div style={{ marginBottom: 24, padding: "16px 20px", borderRadius: 12, background: "#fff7ed", border: "2px solid #fed7aa", boxShadow: "0 2px 8px rgba(234,88,12,0.06)" }}>
                              <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#ffedd5", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>
                                </div>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Returned with Feedback</div>
                                  <div style={{ fontSize: 13, color: "#475569", marginTop: 4, lineHeight: 1.5 }}>DD Operations has returned this request with feedback. Review their notes and make the requested changes.</div>
                                  {item._returnReason && (
                                    <div style={{ marginTop: 8, padding: "8px 12px", background: "rgba(255,255,255,0.7)", border: "1px solid #fed7aa", borderRadius: 6, fontSize: 12, color: "#78350f", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                                      <span style={{ fontWeight: 700, display: "block", marginBottom: 2, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.03em" }}>Feedback from DD Operations:</span>
                                      {item._returnReason}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Blocked info panel */}
                          {displayStatus === "Blocked" && !isDdOps && (
                            <div style={{ marginBottom: 24, padding: "16px 20px", borderRadius: 12, background: "#fef2f2", border: "2px solid #fecaca", boxShadow: "0 2px 8px rgba(220,38,38,0.06)" }}>
                              <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" /></svg>
                                </div>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Work Blocked</div>
                                  <div style={{ fontSize: 13, color: "#475569", marginTop: 4, lineHeight: 1.5 }}>Waiting for DD Operations to review your blocker.</div>
                                  {item._statusNotes && (
                                    <div style={{ marginTop: 8, padding: "8px 12px", background: "rgba(255,255,255,0.7)", border: "1px solid #fecaca", borderRadius: 6, fontSize: 12, color: "#991b1b", lineHeight: 1.5 }}>
                                      <span style={{ fontWeight: 700, display: "block", marginBottom: 2 }}>Blocker reason:</span>
                                      {item._statusNotes}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Contributor Waiting State Cards */}
                          {displayStatus === "Clarification Needed" && !isDdOps && (
                            <WorkflowStateCard
                              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>}
                              iconBg="#d97706"
                              title="Clarification Requested"
                              subtitle="Waiting for DD Operations"
                              body="Your question has been sent to DD Operations for review."
                              details={item._statusNotes ? [{ label: "Question", value: item._statusNotes }] : undefined}
                              accentColor="#d97706"
                              bgColor="#fff7ed"
                              borderColor="#fed7aa"
                            />
                          )}

                          {displayStatus === "In Progress" && !isDdOps && item._workNotes?.some((n: WorkNoteEntry) => n.action === "Clarification Response") && (
                            <WorkflowStateCard
                              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>}
                              iconBg="#10b981"
                              title="Clarification Response Received"
                              subtitle="DD Operations has responded"
                              body="Your clarification question has been answered. Review the response and continue your work."
                              details={[
                                { label: "Response", value: item._statusNotes || "—" },
                                { label: "Question", value: item._workNotes?.find((n: WorkNoteEntry) => n.action === "Clarification Needed")?.text || "—" },
                              ]}
                              accentColor="#10b981"
                              bgColor="#f0fdf4"
                              borderColor="#bbf7d0"
                            />
                          )}

                          {["Duplicate", "Not Applicable"].includes(displayStatus) && !isTerminal && !isDdOps && !exceptionSentToPartner && (
                            <WorkflowStateCard
                              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">{displayStatus === "Duplicate"
                                ? <><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>
                                : <><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></>
                              }</svg>}
                              iconBg={displayStatus === "Duplicate" ? "#6d28d9" : "#4f46e5"}
                              title={displayStatus === "Duplicate" ? "Duplicate Review Pending" : "Not Applicable Review Pending"}
                              subtitle="Waiting for DD Operations"
                              body={displayStatus === "Duplicate"
                                ? "Your duplicate recommendation has been sent to DD Operations for review."
                                : "Your recommendation has been sent to DD Operations for review."}
                              details={displayStatus === "Duplicate" ? [
                                { label: "Reason", value: item._statusNotes || "—" },
                              ] : [
                                { label: "Reason", value: item._statusNotes || "—" },
                              ]}
                              accentColor={displayStatus === "Duplicate" ? "#6d28d9" : "#4f46e5"}
                              bgColor={displayStatus === "Duplicate" ? "#faf5ff" : "#f5f3ff"}
                              borderColor={displayStatus === "Duplicate" ? "#ddd6fe" : "#e0e7ff"}
                            />
                          )}

                          {["Duplicate", "Not Applicable"].includes(displayStatus) && !isTerminal && !isDdOps && exceptionSentToPartner && (
                            <WorkflowStateCard
                              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">{displayStatus === "Duplicate"
                                ? <><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>
                                : <><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></>
                              }</svg>}
                              iconBg={displayStatus === "Duplicate" ? "#6d28d9" : "#4f46e5"}
                              title={displayStatus === "Duplicate" ? "Duplicate Recommendation Sent" : "Removal Recommendation Sent"}
                              subtitle="Waiting on External Partner"
                              body={displayStatus === "Duplicate"
                                ? "DD Operations sent your duplicate recommendation to the external partner. Awaiting their decision."
                                : "DD Operations sent your recommendation to the external partner. Awaiting their decision."}
                              details={item._statusNotes ? [{ label: "Reason", value: item._statusNotes }] : undefined}
                              accentColor={displayStatus === "Duplicate" ? "#6d28d9" : "#4f46e5"}
                              bgColor={displayStatus === "Duplicate" ? "#faf5ff" : "#f5f3ff"}
                              borderColor={displayStatus === "Duplicate" ? "#ddd6fe" : "#e0e7ff"}
                            />
                          )}

                          {/* Primary Action Tiles */}
                          {displayStatus !== "Complete" && (
                          <div style={{ display: "flex", gap: 16, marginBottom: 28 }}>
                            <div
                              onClick={() => document.getElementById("artifact-upload-hidden")?.click()}
                              onDragOver={e => { e.preventDefault(); setDragOverUpload(true); }}
                              onDragEnter={e => { e.preventDefault(); setDragOverUpload(true); }}
                              onDragLeave={e => { e.preventDefault(); setDragOverUpload(false); }}
                              onDrop={e => { e.preventDefault(); setDragOverUpload(false); const files = Array.from(e.dataTransfer.files); if (files.length > 0) handleArtifactUpload(files); }}
                              style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: "24px 20px", border: `2px ${dragOverUpload ? "solid" : "dashed"} ${dragOverUpload ? "#3b82f6" : "#bfdbfe"}`, borderRadius: 14, background: dragOverUpload ? "#eff6ff" : "#fff", cursor: "pointer", transition: "all 0.15s", boxShadow: dragOverUpload ? "0 4px 16px rgba(37,99,235,0.1)" : "0 1px 4px rgba(0,0,0,0.02)", minHeight: 100 }}
                              onMouseEnter={e => { if (!dragOverUpload) { e.currentTarget.style.borderColor = "#6366f1"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(37,99,235,0.1)"; }}}
                              onMouseLeave={e => { if (!dragOverUpload) { e.currentTarget.style.borderColor = "#bfdbfe"; e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.02)"; }}}
                            >
                              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={dragOverUpload ? "#2563eb" : "#4f46e5"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                              <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>{dragOverUpload ? "Drop files to upload" : "Upload Artifact"}</div>
                              <div style={{ fontSize: 12, color: "#475569", textAlign: "center" }}>{dragOverUpload ? "" : "Drag files here or click to browse"}</div>
                              <input id="artifact-upload-hidden" type="file" multiple style={{ display: "none" }} onChange={e => { const files = Array.from(e.target.files || []); if (files.length > 0) handleArtifactUpload(files); e.target.value = ""; }} />
                            </div>

                            {(displayStatus === "Open" || displayStatus === "Assigned" || displayStatus === "Needs Rework") && (
                              <div onClick={() => doStatusChange("In Progress")} style={{ flex: 1, display: "flex", alignItems: "center", gap: 16, padding: "18px 20px", border: "2px solid #bfdbfe", borderRadius: 14, background: "#fff", cursor: "pointer", transition: "all 0.15s", boxShadow: "0 1px 4px rgba(0,0,0,0.02)" }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = "#3b82f6"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(37,99,235,0.1)"; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = "#bfdbfe"; e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.02)"; }}>
                                <div style={{ width: 44, height: 44, borderRadius: 12, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3" /></svg></div>
                                <div><div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>Accept Work</div><div style={{ fontSize: 13, color: "#475569", marginTop: 2 }}>Start working on this item</div></div>
                              </div>
                            )}
                            {displayStatus === "Blocked" && (
                              <div onClick={() => setResolutionPrompt({ note: "" })} style={{ flex: 1, display: "flex", alignItems: "center", gap: 16, padding: "18px 20px", border: "2px solid #bfdbfe", borderRadius: 14, background: "#fff", cursor: "pointer", transition: "all 0.15s", boxShadow: "0 1px 4px rgba(0,0,0,0.02)" }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = "#3b82f6"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(37,99,235,0.1)"; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = "#bfdbfe"; e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.02)"; }}>
                                <div style={{ width: 44, height: 44, borderRadius: 12, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg></div>
                                <div><div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>Resolve</div><div style={{ fontSize: 13, color: "#475569", marginTop: 2 }}>Mark as resolved</div></div>
                              </div>
                            )}
                            {displayStatus === "In Progress" && (
                              <div onClick={() => setCompletionModal({ step: "input", note: "", readyForReview: false })} style={{ flex: 1, display: "flex", alignItems: "center", gap: 16, padding: "18px 20px", border: "2px solid #bbf7d0", borderRadius: 14, background: "#fff", cursor: "pointer", transition: "all 0.15s", boxShadow: "0 1px 4px rgba(0,0,0,0.02)" }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = "#22c55e"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(34,197,94,0.1)"; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = "#bbf7d0"; e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.02)"; }}>
                                <div style={{ width: 44, height: 44, borderRadius: 12, background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg></div>
                                <div><div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>Submit for DD Review</div><div style={{ fontSize: 13, color: "#475569", marginTop: 2 }}>My work is complete and ready for DD Operations</div></div>
                              </div>
                            )}
                            {["Duplicate", "Not Applicable"].includes(displayStatus) && !isTerminal && (
                              <div onClick={() => doStatusChange("In Progress")} style={{ flex: 1, display: "flex", alignItems: "center", gap: 16, padding: "18px 20px", border: "2px solid #bfdbfe", borderRadius: 14, background: "#fff", cursor: "pointer", transition: "all 0.15s", boxShadow: "0 1px 4px rgba(0,0,0,0.02)" }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = "#3b82f6"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(37,99,235,0.1)"; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = "#bfdbfe"; e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.02)"; }}>
                                <div style={{ width: 44, height: 44, borderRadius: 12, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg></div>
                                <div><div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>Reopen</div><div style={{ fontSize: 13, color: "#475569", marginTop: 2 }}>Return to active work</div></div>
                              </div>
                            )}
                          </div>
                          )}

                          {uploadSuccess && (
                            <div style={{ padding: "8px 12px", marginBottom: 16, borderRadius: 8, background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
                              <span style={{ flex: 1 }}>1 artifact uploaded successfully</span>
                              <span style={{ fontSize: 11, color: "#475569", fontStyle: "italic" }}>{uploadSuccess}</span>
                              <button style={{ background: "none", border: "none", color: "#166534", cursor: "pointer", fontSize: 16, fontWeight: 700, padding: 0, lineHeight: 1 }} onClick={() => setUploadSuccess(null)}>&times;</button>
                            </div>
                          )}
                          {actionFeedback && !uploadSuccess && (
                            <div style={{ padding: "8px 12px", marginBottom: 16, borderRadius: 8, background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
                              <span style={{ flex: 1 }}>{actionFeedback}</span>
                              <button style={{ background: "none", border: "none", color: "#166534", cursor: "pointer", fontSize: 16, fontWeight: 700, padding: 0, lineHeight: 1 }} onClick={() => setActionFeedback(null)}>&times;</button>
                            </div>
                          )}

                          <div style={{ marginBottom: 14 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 12 }}>Other Actions</div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                              {["Open", "Assigned", "In Progress"].includes(displayStatus) && (
                                <>
                                  <ActionTile icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0891b2" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>} label="Clarification Support" desc="Ask DD Operations for help" onClick={() => setNeedClarificationOpen(true)} />
                                  <ActionTile icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" /></svg>} label="Block Work" desc="Waiting on something" onClick={() => setBlockModal({ step: "input", reason: "" })} />
                                  <ActionTile icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6d28d9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>} label="Mark Duplicate" desc="Possible duplicate" onClick={() => setDuplicateModal({ reason: "", optionalId: "" })} />
                                  <ActionTile icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>} label="Mark Not Applicable" desc="Not needed" onClick={() => setNotApplicableModal({ reason: "" })} />
                                </>
                              )}
                              <ActionTile icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>} label="Not Mine" desc="Return for reassignment" onClick={() => setNotMine({ req: result.item as RecapRequest, reason: "" })} />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    </>)}

                    {exceptionSentToPartner && isDdOps && (
                        <div style={{ padding: "0 32px 24px" }}>
                            <div style={{ marginBottom: 24, padding: "16px 20px", borderRadius: 12, background: "#f5f3ff", border: "2px solid #ddd6fe", boxShadow: "0 2px 8px rgba(109,40,217,0.06)" }}>
                                <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#ede9fe", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6d28d9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>
                                            {displayStatus === "Duplicate" ? "Duplicate Recommendation Sent" : "Removal Recommendation Sent"}
                                        </div>
                                        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 6, padding: "3px 10px", borderRadius: 4, background: "#ede9fe", fontSize: 11, fontWeight: 600, color: "#6d28d9" }}>
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                                            Waiting Partner Decision — Next action: External Partner
                                        </div>
                                        <div style={{ fontSize: 13, color: "#475569", marginTop: 8, lineHeight: 1.5 }}>
                                            {displayStatus === "Duplicate"
                                                ? "The duplicate recommendation has been sent to the external partner. They will decide to Confirm Duplicate or Keep Separate."
                                                : "The removal recommendation has been sent to the external partner. They will decide to Approve Removal or Keep Request."}
                                        </div>
                                        {(item as any)._statusNotes && (
                                            <div style={{ marginTop: 8, padding: "8px 12px", background: "rgba(255,255,255,0.7)", border: "1px solid #ddd6fe", borderRadius: 6, fontSize: 12, color: "#5b21b6", lineHeight: 1.5 }}>
                                                <span style={{ fontWeight: 700, display: "block", marginBottom: 2, textTransform: "uppercase", fontSize: 10, letterSpacing: "0.03em" }}>Reason</span>
                                                {(item as any)._statusNotes}
                                            </div>
                                        )}
                                        {(item as any)._exceptionSentAt && (
                                            <div style={{ fontSize: 11, color: "#475569", marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                                                Sent: {new Date((item as any)._exceptionSentAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {!isDdOps && (
                    <div style={{ padding: "0 32px 24px" }}>
                      <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: "16px 20px", background: "#fff", display: "flex", alignItems: "center", gap: 16 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: item._publishedExternal ? "#f0fdf4" : "#f0f7ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          {item._publishedExternal ? (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
                          ) : (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a3 3 0 1 0 3.99 3.98m-9.19-1.17L2 21l2.44-2.44m5.57-5.57L18 5l3 3L13.01 13.01" /></svg>
                          )}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{item._publishedExternal ? "Published External" : "Publish External"}</div>
                          <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>{item._publishedExternal ? "This deliverable is visible on the external portal" : "Share deliverable with the external broker/buyer portal"}</div>
                        </div>
                        {item._publishedExternal && displayStatus !== "Needs Rework" ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "6px 14px", fontSize: 12, fontWeight: 700, borderRadius: 6, background: "#f0fdf4", color: "#166534", border: "1px solid #86efac" }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
                            Published
                          </span>
                        ) : (
                          <button
                            onClick={() => setPublishExternal({ step: 1, selectedArtifacts: workArtifacts.map(a => a.name), note: "" })}
                            disabled={displayStatus !== "Complete" && displayStatus !== "Needs Rework"}
                            title={displayStatus !== "Complete" && displayStatus !== "Needs Rework" ? "Publishing requires the item to be submitted for DD Review first" : "Publish this deliverable"}
                            style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "6px 14px", fontSize: 12, fontWeight: 600, borderRadius: 6, background: displayStatus === "Complete" || displayStatus === "Needs Rework" ? "#1d4ed8" : "#f1f5f9", color: displayStatus === "Complete" || displayStatus === "Needs Rework" ? "#fff" : "#94a3b8", border: "none", cursor: displayStatus === "Complete" || displayStatus === "Needs Rework" ? "pointer" : "not-allowed" }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a3 3 0 1 0 3.99 3.98m-9.19-1.17L2 21l2.44-2.44m5.57-5.57L18 5l3 3L13.01 13.01" /></svg>
                            {displayStatus === "Needs Rework" ? "Re-Publish" : "Publish"}
                          </button>
                        )}
                      </div>
                    </div>
                    )}
                    
                    <div style={{ height: 1, background: "#e2e8f0" }} />

                    {/* Visibility Key */}
                    <div style={{ padding: "10px 32px", display: "flex", gap: 16, flexWrap: "wrap", fontSize: 11, color: "#475569", background: "#fafbff", borderBottom: "1px solid #e2e8f0" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                            <strong>Internal</strong>: Notes &amp; artifacts are internal-only until published
                        </span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a3 3 0 1 0 3.99 3.98m-9.19-1.17L2 21l2.44-2.44m5.57-5.57L18 5l3 3L13.01 13.01" /></svg>
                            <strong>External</strong>: Published documents &amp; clarifications are visible on portal
                        </span>
                    </div>

                    {/* Partner Decision Banner */}
                    {(item as any)._partnerDecision && (
                        <div style={{
                            margin: "0 32px", padding: "14px 18px", borderRadius: 10,
                            background: (item as any)._partnerDecision === "Approved" ? "#f0fdf4" : "#fff7ed",
                            border: `1px solid ${(item as any)._partnerDecision === "Approved" ? "#86efac" : "#fdba74"}`,
                            display: "flex", alignItems: "flex-start", gap: 12,
                            boxShadow: (item as any)._partnerDecision === "Approved"
                                ? "0 2px 8px rgba(22, 101, 52, 0.08)"
                                : "0 2px 8px rgba(154, 52, 18, 0.08)",
                        }}>
                            {(item as any)._partnerDecision === "Approved" ? (
                                <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#166534", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                </div>
                            ) : (
                                <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#ea580c", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                                    </svg>
                                </div>
                            )}
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 14, fontWeight: 700, color: (item as any)._partnerDecision === "Approved" ? "#166534" : "#9a3412" }}>
                                    {(item as any)._partnerDecision === "Approved" ? "Partner Approved This Request" : "Partner Requested Rework"}
                                </div>
                                {(item as any)._partnerNote && (
                                    <div style={{ fontSize: 13, color: (item as any)._partnerDecision === "Approved" ? "#334155" : "#78350f", marginTop: 4, lineHeight: 1.6, padding: "8px 10px", background: "rgba(255,255,255,0.6)", borderRadius: 6, border: `1px solid ${(item as any)._partnerDecision === "Approved" ? "#bbf7d0" : "#fed7aa"}`, whiteSpace: "pre-wrap" }}>
                                        {(item as any)._partnerNote}
                                    </div>
                                )}
                                {(item as any)._partnerActionAt && (
                                    <div style={{ fontSize: 11, color: "#475569", marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                                        {new Date((item as any)._partnerActionAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Exception Recommendation Banner */}
                    {["Duplicate", "Not Applicable"].includes(displayStatus) && (item as any)._exceptionRecommendation && !(item as any)._exceptionDecision && (
                        <div style={{ margin: "0 32px", padding: "14px 18px", borderRadius: 10, background: "#faf5ff", border: "1px solid #ddd6fe", display: "flex", alignItems: "flex-start", gap: 12 }}>
                            <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#7c3aed", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 14, fontWeight: 700, color: "#6d28d9" }}>
                                    Exception Recommendation Pending External Review
                                </div>
                                <div style={{ fontSize: 13, color: "#334155", marginTop: 4, lineHeight: 1.6 }}>
                                    This item was marked as <strong>{displayStatus}</strong> and is awaiting external partner review. The partner will decide whether to approve removal/merge or keep the item active.
                                </div>
                                {(item as any)._statusNotes && (
                                    <div style={{ marginTop: 8, padding: "8px 10px", background: "rgba(255,255,255,0.6)", border: "1px solid #ddd6fe", borderRadius: 6, fontSize: 12, color: "#5b21b6", lineHeight: 1.5 }}>
                                        <span style={{ fontWeight: 700, display: "block", marginBottom: 2, textTransform: "uppercase", fontSize: 10, letterSpacing: "0.03em" }}>Reason</span>
                                        {(item as any)._statusNotes}
                                    </div>
                                )}
                                {(item as any)._exceptionSentAt && (
                                    <div style={{ fontSize: 11, color: "#475569", marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                                        Sent for review: {new Date((item as any)._exceptionSentAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Exception Decision Banner */}
                    {["Duplicate", "Not Applicable"].includes(displayStatus) && (item as any)._exceptionDecision && (
                        <div style={{ margin: "0 32px", padding: "14px 18px", borderRadius: 10, background: (item as any)._exceptionDecision === "Approve Removal" || (item as any)._exceptionDecision === "Confirm Duplicate" ? "#f0fdf4" : "#fff7ed", border: `1px solid ${(item as any)._exceptionDecision === "Approve Removal" || (item as any)._exceptionDecision === "Confirm Duplicate" ? "#86efac" : "#fdba74"}`, display: "flex", alignItems: "flex-start", gap: 12 }}>
                            <div style={{ width: 24, height: 24, borderRadius: "50%", background: (item as any)._exceptionDecision === "Approve Removal" || (item as any)._exceptionDecision === "Confirm Duplicate" ? "#166534" : "#ea580c", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                                {(item as any)._exceptionDecision === "Approve Removal" || (item as any)._exceptionDecision === "Confirm Duplicate" ? (
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                ) : (
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                                )}
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 14, fontWeight: 700, color: (item as any)._exceptionDecision === "Approve Removal" || (item as any)._exceptionDecision === "Confirm Duplicate" ? "#166534" : "#9a3412" }}>
                                    {(item as any)._exceptionDecision === "Approve Removal" && "Partner Approved Removal"}
                                    {(item as any)._exceptionDecision === "Keep Request" && "Partner Requested to Keep Item Active"}
                                    {(item as any)._exceptionDecision === "Confirm Duplicate" && "Partner Confirmed Duplicate"}
                                    {(item as any)._exceptionDecision === "Keep Separate" && "Partner Requested to Keep Item Separate"}
                                </div>
                                {(item as any)._exceptionDecisionNote && (
                                    <div style={{ fontSize: 13, color: "#334155", marginTop: 4, lineHeight: 1.6, padding: "8px 10px", background: "rgba(255,255,255,0.6)", borderRadius: 6, border: `1px solid ${(item as any)._exceptionDecision === "Approve Removal" || (item as any)._exceptionDecision === "Confirm Duplicate" ? "#bbf7d0" : "#fed7aa"}`, whiteSpace: "pre-wrap" }}>
                                        {(item as any)._exceptionDecisionNote}
                                    </div>
                                )}
                                {(item as any)._exceptionDecisionAt && (
                                    <div style={{ fontSize: 11, color: "#475569", marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                                        {new Date((item as any)._exceptionDecisionAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div style={{ height: 1, background: "#e2e8f0" }} />

                    {/* Accordion Sections — with dividers between */}
                    <div>
                        <AccordionSection
                            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>}
                            title={`Artifacts (${(isBulkUpload && item.fileName ? 1 : 0) + workArtifacts.length})`}
                            isOpen={sections.artifacts}
                            onToggle={() => toggleSection("artifacts")}
                        >
                            {/* ── Original Submission ── */}
                            <div style={{ marginBottom: 16 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
                                    Original Submission
                                </div>
                                <p style={{ fontSize: 13, color: "#334155", lineHeight: 1.7, margin: 0 }}>{description}</p>
                                {isBulkUpload && item.fileName && (
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, padding: "8px 10px", background: "#f8faff", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 12, color: "#1e293b" }}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4338ca" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><polyline points="13 2 13 9 20 9" /></svg>
                                        <span style={{ fontWeight: 500 }}>{item.fileName}</span>
                                        {item.rowsFound && <span style={{ color: "#475569", fontSize: 11 }}>({item.rowsFound} rows found)</span>}
                                    </div>
                                )}
                            </div>

                            <div style={{ height: 1, background: "#e2e8f0", marginBottom: 16 }} />

                            {/* ── Work Artifacts ── */}
                            <div>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                                    Work Artifacts ({workArtifacts.length})
                                </div>

                                {/* Artifact list */}
                                {workArtifacts.length > 0 && (
                                    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
                                        {workArtifacts.map(art => (
                                            <div key={art.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", background: "#f8faff", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 12, color: "#1e293b" }}>
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><polyline points="13 2 13 9 20 9" /></svg>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <span
                                                        onClick={() => setArtifactDetail(art)}
                                                        style={{ fontWeight: 600, color: "#1d4ed8", cursor: "pointer", textDecoration: "none" }}
                                                        title="View artifact details"
                                                    >
                                                        {art.displayFileName || art.name}
                                                    </span>
                                                    {art.originalFileName && art.originalFileName !== art.name && art.originalFileName !== art.displayFileName && (
                                                        <span style={{ color: "#475569", fontSize: 11, marginLeft: 6 }}>(original: {art.originalFileName})</span>
                                                    )}
                                                    <div style={{ display: "flex", gap: 8, marginTop: 1, fontSize: 11, color: "#475569" }}>
                                                        <span>{(art.size / 1024).toFixed(0)} KB</span>
                                                        <span>{art.uploadedAt}</span>
                                                        {art.uploadedBy && <span>{art.uploadedBy}</span>}
                                                        {art.isPrototype && <span style={{ color: "#92400e", background: "#fffbeb", padding: "0 4px", borderRadius: 3, fontSize: 10, fontWeight: 600 }}>PROTOTYPE</span>}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => { removeWorkArtifact(artifactStorageKey, art.id); setWorkArtifacts(prev => prev.filter(a => a.id !== art.id)); }}
                                                    style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: "2px 4px" }}
                                                    title="Remove artifact"
                                                >&times;</button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div style={{ marginTop: 8, fontSize: 11, color: "#475569", fontStyle: "italic", display: "flex", alignItems: "center", gap: 6 }}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
                                    Internal artifacts stay internal until published to the external portal.
                                </div>
                            </div>

                            {/* ── Published Artifacts (if applicable) ── */}
                            {(item as any)._externalStatus === "Published External" && (
                                <>
                                    <div style={{ height: 1, background: "#e2e8f0", margin: "16px 0" }} />
                                    <div>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: "#166534", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#166534" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
                                            Published Artifacts
                                        </div>
                                        <div style={{ fontSize: 12, color: "#475569", padding: "8px 0" }}>
                                            {workArtifacts.length > 0
                                                ? `${workArtifacts.length} supporting artifact${workArtifacts.length !== 1 ? "s" : ""} published${workArtifacts.some(a => a.isPrototype) ? " (prototype metadata)" : ""}.`
                                                : "Published with no supporting artifacts."}
                                        </div>
                                    </div>
                                </>
                            )}
                        </AccordionSection>

                        <AccordionSection
                            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>}
                            title={`Work Notes (${workNotes.length})`}
                            isOpen={sections.workNotes}
                            onToggle={() => toggleSection("workNotes")}
                        >
                            {/* Add Work Note composer */}
                            <div style={{ marginBottom: 16, display: "flex", gap: 8, alignItems: "flex-start" }}>
                                {wnComposerOpen ? (
                                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6, padding: "12px 14px", background: "#f0f7ff", border: "1px solid #93c5fd", borderRadius: 8, boxShadow: "0 2px 6px rgba(37,99,235,0.08)" }}>
                                        <textarea
                                            value={wnText}
                                            onChange={e => setWnText(e.target.value)}
                                            placeholder="Type a work note..."
                                            rows={2}
                                            style={{ width: "100%", padding: "8px 10px", fontSize: 13, border: "1px solid #cbd5e1", borderRadius: 6, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", outline: "none" }}
                                            autoFocus
                                        />
                                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                                            <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => { setWnComposerOpen(false); setWnText(""); }}>Cancel</button>
                                            <button className="rc-btn rc-btn-primary rc-btn-sm" disabled={!wnText.trim()} onClick={() => {
                                                if (!wnText.trim()) return;
                                                const reqId = item.id || item.intakeId || "";
                                                addWorkNote(reqId, wnText.trim(), currentUser, "Work Note");
                                                setWsRefreshKey(k => k + 1);
                                                setWnText("");
                                                setWnComposerOpen(false);
                                            }}>Save</button>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setWnComposerOpen(true)}
                                        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 18px", fontSize: 13, fontWeight: 600, borderRadius: 8, background: "linear-gradient(135deg, #0ea5e9, #2563eb)", color: "#fff", border: "none", cursor: "pointer", boxShadow: "0 2px 8px rgba(37,99,235,0.25)", transition: "all 0.15s ease" }}
                                        onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 4px 12px rgba(37,99,235,0.35)")}
                                        onMouseLeave={e => (e.currentTarget.style.boxShadow = "0 2px 8px rgba(37,99,235,0.25)")}
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                                        Add Work Note
                                    </button>
                                )}
                            </div>

                            {workNotes.length === 0 ? (
                                <div style={{ padding: "12px 16px", color: "#475569", fontSize: 13, textAlign: "center", background: "#f8fafc", border: "1px dashed #cbd5e1", borderRadius: 8 }}>No work notes have been added yet.</div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                    {workNotes.map(n => {
                                        const isAuthor = n.author === currentUser;
                                        const badgeKey = n.action || "Status Note";
                                        const badgeRec = BADGE_STYLES[badgeKey] || BADGE_STYLES["DD Review"];
                                        const badgeStyle = getBadgeStyle(n.action);
                                        return (
                                        <div key={n.id} style={{
                                            padding: "12px 14px",
                                            background: "#fafbff",
                                            border: "1px solid #e2e8f0",
                                            borderRadius: 8,
                                            display: "flex",
                                            gap: 10,
                                            alignItems: "flex-start",
                                            transition: "box-shadow 0.15s ease, border-color 0.15s ease",
                                        }}
                                            onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 2px 8px rgba(15,23,42,0.06)"; e.currentTarget.style.borderColor = "#cbd5e1"; }}
                                            onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderColor = "#e2e8f0"; }}
                                        >
                                            <span style={{ width: 30, height: 30, borderRadius: "50%", background: badgeRec.bg, color: badgeRec.fg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0, marginTop: 1, border: `2px solid ${badgeRec.border}` }}>
                                                {n.author ? n.author.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() : "WN"}
                                            </span>
                                            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, flexWrap: "wrap" }}>
                                                    <span style={{ fontWeight: 700, color: "#0f172a", fontSize: 12 }}>{n.author || "System"}</span>
                                                    {n.action && (
                                                        <span style={badgeStyle}>
                                                            {n.action}
                                                        </span>
                                                    )}
                                                    {n.timestamp && (
                                                        <span style={{ color: "#475569", marginLeft: "auto", fontSize: 11, whiteSpace: "nowrap" }}>
                                                            {new Date(n.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                                                        </span>
                                                    )}
                                                    {isAuthor && (
                                                        <span style={{ display: "inline-flex", gap: 4, marginLeft: 6 }}>
                                                            {editingNoteId === n.id ? null : (
                                                                <button
                                                                    onClick={() => { setEditingNoteId(n.id); setEditingNoteText(n.text); }}
                                                                    style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "#64748b", lineHeight: 1 }}
                                                                    title="Edit note"
                                                                >
                                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => {
                                                                    const reqId = item.id || item.intakeId || "";
                                                                    deleteWorkNote(reqId, n.id);
                                                                    setWsRefreshKey(k => k + 1);
                                                                }}
                                                                style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "#f87171", lineHeight: 1 }}
                                                                title="Delete note"
                                                            >
                                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                                                            </button>
                                                        </span>
                                                    )}
                                                </div>
                                                {editingNoteId === n.id ? (
                                                    <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "10px 12px", background: "#f0f7ff", border: "1px solid #93c5fd", borderRadius: 8, marginTop: 4 }}>
                                                        <textarea
                                                            value={editingNoteText}
                                                            onChange={e => setEditingNoteText(e.target.value)}
                                                            rows={2}
                                                            style={{ width: "100%", padding: "8px 10px", fontSize: 13, border: "1px solid #cbd5e1", borderRadius: 6, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", outline: "none" }}
                                                            autoFocus
                                                        />
                                                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                                                            <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => setEditingNoteId(null)}>Cancel</button>
                                                            <button className="rc-btn rc-btn-primary rc-btn-sm" disabled={!editingNoteText.trim()} onClick={() => {
                                                                if (!editingNoteText.trim()) return;
                                                                const reqId = item.id || item.intakeId || "";
                                                                editWorkNote(reqId, n.id, editingNoteText.trim());
                                                                setWsRefreshKey(k => k + 1);
                                                                setEditingNoteId(null);
                                                            }}>Save</button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div style={{ fontSize: 13, color: "#1e293b", lineHeight: 1.6, marginTop: 4 }}>{n.text}</div>
                                                )}
                                            </div>
                                        </div>
                                        );
                                    })}
                                </div>
                            )}
                        </AccordionSection>

                        <div style={{ height: 1, background: "#e2e8f0" }} />

                        <AccordionSection
                            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>}
                            title={`External Communication (${localQuestions.length})`}
                            isOpen={sections.conversation}
                            onToggle={() => toggleSection("conversation")}
                        >
                            <div style={{ fontSize: 11, color: "#475569", fontStyle: "italic", marginBottom: 8 }}>
                                Messages between the internal team and external broker/buyer.
                            </div>
                            {localQuestions.length === 0 ? (
                                <div style={{ padding: "12px 0", color: "#475569", fontSize: 13 }}>No external communication has been recorded for this request yet.</div>
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
                                                        <span style={{ color: "#475569", marginLeft: "auto", fontSize: 11 }}>{q.timestamp}</span>
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

                            <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "flex-start" }}>
                                {extMsgComposerOpen ? (
                                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6, padding: "12px 14px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8 }}>
                                        {extMsgConfirm ? (
                                            <div style={{ padding: "8px 12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, fontSize: 12, color: "#991b1b", display: "flex", alignItems: "center", gap: 6 }}>
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                                                This message will be visible to the external partner. Continue?
                                            </div>
                                        ) : null}
                                        <textarea
                                            value={extMsgText}
                                            onChange={e => setExtMsgText(e.target.value)}
                                            placeholder="Type an external message..."
                                            rows={2}
                                            style={{ width: "100%", padding: "8px 10px", fontSize: 13, border: "1px solid #cbd5e1", borderRadius: 6, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", outline: "none" }}
                                            autoFocus
                                        />
                                        {extMsgConfirm ? (
                                            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                                                <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => { setExtMsgComposerOpen(false); setExtMsgText(""); setExtMsgConfirm(false); }}>Cancel</button>
                                                <button className="rc-btn rc-btn-primary rc-btn-sm" disabled={!extMsgText.trim()} onClick={() => {
                                                    if (!extMsgText.trim()) return;
                                                    const reqId = item.id || item.intakeId || "";
                                                    const result = addExternalMessage(reqId, extMsgText.trim(), currentUser);
                                                    if (result) {
                                                        setLocalQuestions(prev => [{
                                                            id: result.id,
                                                            from: result.author,
                                                            question: result.text,
                                                            response: null,
                                                            status: "Answered" as const,
                                                            timestamp: result.timestamp,
                                                        }, ...prev]);
                                                    }
                                                    setWsRefreshKey(k => k + 1);
                                                    setExtMsgText("");
                                                    setExtMsgComposerOpen(false);
                                                    setExtMsgConfirm(false);
                                                }}>Confirm & Send</button>
                                            </div>
                                        ) : (
                                            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                                                <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => { setExtMsgComposerOpen(false); setExtMsgText(""); }}>Cancel</button>
                                                <button className="rc-btn rc-btn-primary rc-btn-sm" disabled={!extMsgText.trim()} onClick={() => setExtMsgConfirm(true)}>Continue</button>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setExtMsgComposerOpen(true)}
                                        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 18px", fontSize: 13, fontWeight: 600, borderRadius: 8, background: "#166534", color: "#fff", border: "none", cursor: "pointer", boxShadow: "0 2px 8px rgba(22,101,52,0.25)" }}
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                                        Add External Message
                                    </button>
                                )}
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
                                        <div style={{ fontSize: 12, color: "#475569" }}>
                                            <span style={{ fontWeight: 600 }}>{completionSummary.supportingArtifacts.length}</span> supporting artifact{completionSummary.supportingArtifacts.length !== 1 ? "s" : ""} (see Artifacts section).
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div style={{ padding: "12px 0", color: "#475569", fontSize: 13, display: "flex", flexDirection: "column", gap: 6 }}>
                                    <span>This work item has not been submitted for DD Review yet.</span>
                                    <span style={{ fontSize: 12 }}>Use Submit for DD Review in the Action Center to record your completion summary.</span>
                                </div>
                            )}
                        </AccordionSection>
                    </div>
                </div>
            </div>

            {/* Need Clarification Modal - Contributor Simple Form */}
            {needClarificationOpen && (
                <div className="rc-modal-overlay" onClick={() => { setNeedClarificationOpen(false); setClarificationText(""); setClarificationAdditionalContext(""); setClarificationSubmitStep("select"); }}>
                    <div className="rc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
                        <div className="rc-modal-header">
                            <h2>Clarification Support</h2>
                            <button className="rc-modal-close" onClick={() => { setNeedClarificationOpen(false); setClarificationText(""); setClarificationAdditionalContext(""); setClarificationSubmitStep("select"); }}>&times;</button>
                        </div>
                        <div className="rc-modal-body" style={{ padding: "16px 20px" }}>
                            {clarificationSubmitStep === "select" && (
                                <>
                                    <div style={{ fontSize: 13, color: "#334155", marginBottom: 16, lineHeight: 1.5 }}>
                                        Describe what you need help with. Your question will be sent to the DD Operations team for review.
                                    </div>
                                    <div style={{ fontSize: 12, color: "#334155", marginBottom: 16, display: "flex", flexDirection: "column", gap: 8, padding: "10px 12px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e5e7eb" }}>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 4 }}>Request Context</div>
                                        <div><span style={{ fontWeight: 700, color: "#0f172a", textTransform: "uppercase", fontSize: 10, letterSpacing: "0.03em", marginRight: 6 }}>Request ID</span> {displayId}</div>
                                        <div><span style={{ fontWeight: 700, color: "#0f172a", textTransform: "uppercase", fontSize: 10, letterSpacing: "0.03em", marginRight: 6 }}>Deliverable</span> {displayTitle || item.category || "\u2014"}</div>
                                        <div><span style={{ fontWeight: 700, color: "#0f172a", textTransform: "uppercase", fontSize: 10, letterSpacing: "0.03em", marginRight: 6 }}>Owner</span> {item.owner || "\u2014"}</div>
                                        <div><span style={{ fontWeight: 700, color: "#0f172a", textTransform: "uppercase", fontSize: 10, letterSpacing: "0.03em", marginRight: 6 }}>Status</span> {displayStatus}</div>
                                        {item.transactionName && <div><span style={{ fontWeight: 700, color: "#0f172a", textTransform: "uppercase", fontSize: 10, letterSpacing: "0.03em", marginRight: 6 }}>Transaction</span> {item.transactionName}</div>}
                                        {item.communityNames && item.communityNames.length > 0 && <div><span style={{ fontWeight: 700, color: "#0f172a", textTransform: "uppercase", fontSize: 10, letterSpacing: "0.03em", marginRight: 6 }}>Community</span> {item.communityNames.join(", ")}</div>}
                                    </div>
                                    <label style={{ fontSize: 11, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 6, display: "block" }}>Question for DD Operations <span style={{ color: "#dc2626" }}>*</span></label>
                                    <textarea
                                        value={clarificationText}
                                        onChange={e => setClarificationText(e.target.value)}
                                        placeholder="Describe what you need clarified before you can continue..."
                                        rows={4}
                                        style={{ width: "100%", padding: "8px 10px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 6, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", outline: "none", color: "#0f172a", marginBottom: 12 }}
                                    />
                                    <label style={{ fontSize: 11, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 6, display: "block" }}>Additional Context (optional)</label>
                                    <textarea
                                        value={clarificationAdditionalContext}
                                        onChange={e => setClarificationAdditionalContext(e.target.value)}
                                        placeholder="Include anything you have already reviewed, attempted, or confirmed..."
                                        rows={3}
                                        style={{ width: "100%", padding: "8px 10px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 6, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", outline: "none", color: "#0f172a" }}
                                    />
                                </>
                            )}
                            {clarificationSubmitStep === "confirm" && (
                                <div style={{ padding: "14px 16px", border: "1px solid #e5e7eb", borderRadius: 10, background: "#f0fdf4" }}>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 10 }}>Send Clarification to DD Operations</div>
                                    <div style={{ fontSize: 12, color: "#334155", marginBottom: 10, lineHeight: 1.5 }}>
                                        Your question will be sent to DD Operations for review.
                                    </div>
                                    <div style={{ padding: "8px 10px", background: "#fff", border: "1px solid #bbf7d0", borderRadius: 6, fontSize: 12, color: "#166534", marginBottom: 8 }}>
                                        <strong>Your Question:</strong><br />{clarificationText}
                                    </div>
                                    <div style={{ fontSize: 12, color: "#334155", marginBottom: 8 }}>
                                        <strong>Recipient:</strong> DD Operations<br />
                                        <strong>Next Action Owner:</strong> DD Operations
                                    </div>
                                </div>
                            )}
                            {clarificationSubmitStep === "done" && (
                                <div style={{ padding: "14px 16px", border: "1px solid #bbf7d0", borderRadius: 10, background: "#f0fdf4", textAlign: "center" }}>
                                    <div style={{ fontSize: 16, fontWeight: 700, color: "#166534", marginBottom: 8 }}>✓ Clarification Sent</div>
                                    <div style={{ fontSize: 13, color: "#334155", marginBottom: 8 }}>Your question was sent to DD Operations. They will either provide guidance or request additional information from the external partner.</div>
                                    <div style={{ fontSize: 12, color: "#475569" }}>You will be notified when a response is available.</div>
                                    <div style={{ marginTop: 12, padding: "8px 10px", background: "#fff", border: "1px solid #bbf7d0", borderRadius: 6, fontSize: 12, color: "#166534", textAlign: "left" }}>
                                        <strong>Your Question:</strong><br />{clarificationText}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="rc-modal-footer">
                            {clarificationSubmitStep === "select" && (
                                <>
                                    <button className="rc-btn rc-btn-ghost" onClick={() => { setNeedClarificationOpen(false); setClarificationText(""); setClarificationAdditionalContext(""); }}>Cancel</button>
                                    <button className="rc-btn rc-btn-primary" disabled={!clarificationText.trim()} onClick={() => setClarificationSubmitStep("confirm")} style={{ background: "#0891b2" }}>Send to DD Operations</button>
                                </>
                            )}
                            {clarificationSubmitStep === "confirm" && (
                                <>
                                    <button className="rc-btn rc-btn-ghost" onClick={() => setClarificationSubmitStep("select")}>Back</button>
                                    <button className="rc-btn rc-btn-primary" onClick={submitClarification} style={{ background: "#0891b2" }}>Confirm & Send</button>
                                </>
                            )}
                            {clarificationSubmitStep === "done" && (
                                <button className="rc-btn rc-btn-primary" onClick={() => { setNeedClarificationOpen(false); setClarificationText(""); setClarificationAdditionalContext(""); setClarificationSubmitStep("select"); }}>Close</button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Respond to Clarification Modal */}
            {clarifyResponseModal && (
                <div className="rc-modal-overlay" onClick={() => setClarifyResponseModal(null)}>
                    <div className="rc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
                        <div className="rc-modal-header">
                            <h2>Respond to Clarification</h2>
                            <button className="rc-modal-close" onClick={() => setClarifyResponseModal(null)}>&times;</button>
                        </div>
                        <div className="rc-modal-body" style={{ padding: "16px 20px" }}>
                            <div style={{ fontSize: 12, color: "#334155", marginBottom: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                                <div><span style={{ fontWeight: 700, color: "#0f172a", textTransform: "uppercase", fontSize: 10, letterSpacing: "0.03em", marginRight: 6 }}>Request ID</span> {displayId}</div>
                                <div><span style={{ fontWeight: 700, color: "#0f172a", textTransform: "uppercase", fontSize: 10, letterSpacing: "0.03em", marginRight: 6 }}>Deliverable</span> {displayTitle || item.category || "\u2014"}</div>
                                <div><span style={{ fontWeight: 700, color: "#0f172a", textTransform: "uppercase", fontSize: 10, letterSpacing: "0.03em", marginRight: 6 }}>Asked by</span> {item.owner || "Contributor"}</div>
                            </div>
                            <label style={{ fontSize: 11, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 6, display: "block" }}>Original Question</label>
                            <div style={{ padding: "8px 10px", fontSize: 13, background: "#f8faff", border: "1px solid #dbeafe", borderRadius: 6, color: "#0f172a", marginBottom: 14, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                                {item._statusNotes || "—"}
                            </div>
                            <label style={{ fontSize: 11, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 6, display: "block" }}>Your Response <span style={{ color: "#dc2626" }}>*</span></label>
                            <textarea
                                value={clarifyResponseModal.response}
                                onChange={e => setClarifyResponseModal({ response: e.target.value })}
                                placeholder="Type your response to the contributor..."
                                rows={4}
                                style={{ width: "100%", padding: "8px 10px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 6, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", outline: "none", color: "#0f172a" }}
                            />
                        </div>
                        <div className="rc-modal-footer">
                            <button className="rc-btn rc-btn-ghost" onClick={() => setClarifyResponseModal(null)}>Cancel</button>
                            <button className="rc-btn rc-btn-primary" disabled={!clarifyResponseModal.response.trim()} onClick={submitClarifyResponse}>Send Response</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Clarification Support Modal */}
            {clarificationSupportModalOpen && (
                <div className="rc-modal-overlay" onClick={() => { setClarificationSupportModalOpen(false); setClarificationPath(null); setClarificationInternalResponse(""); setClarificationInternalNote(""); setClarificationExternalQuestion(""); setClarificationExternalInstructions(""); setClarificationSubmitStep("select"); }}>
                    <div className="rc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600, maxHeight: "85vh", overflow: "auto" }}>
                        <div className="rc-modal-header" style={{ borderBottom: "1px solid #e5e7eb", paddingBottom: 12 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <div style={{ width: 32, height: 32, borderRadius: 8, background: "#ecfeff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0891b2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                                </div>
                                <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", margin: 0 }}>Clarification Support</h2>
                            </div>
                            <button className="rc-modal-close" onClick={() => { setClarificationSupportModalOpen(false); setClarificationPath(null); setClarificationInternalResponse(""); setClarificationInternalNote(""); setClarificationExternalQuestion(""); setClarificationExternalInstructions(""); setClarificationSubmitStep("select"); }}>&times;</button>
                        </div>
                        <div className="rc-modal-body" style={{ padding: "16px 20px" }}>
                            {/* Context Section */}
                            <div style={{ marginBottom: 16, padding: "12px 14px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e5e7eb" }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 8 }}>Current Context</div>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12 }}>
                                    <div><span style={{ fontWeight: 600, color: "#0f172a" }}>Request ID</span> <span style={{ color: "#475569" }}>{displayId}</span></div>
                                    <div><span style={{ fontWeight: 600, color: "#0f172a" }}>Status</span> <span style={{ color: "#475569" }}>{displayStatus}</span></div>
                                    <div style={{ gridColumn: "1 / -1" }}><span style={{ fontWeight: 600, color: "#0f172a" }}>Deliverable</span> <span style={{ color: "#475569" }}>{displayTitle || item.category || "\u2014"}</span></div>
                                    <div><span style={{ fontWeight: 600, color: "#0f172a" }}>Owner</span> <span style={{ color: "#475569" }}>{item.owner || "\u2014"}</span></div>
                                    <div><span style={{ fontWeight: 600, color: "#0f172a" }}>Next Action</span> <span style={{ color: "#475569" }}>DD Operations</span></div>
                                </div>
                            </div>

                            {/* Original Question */}
                            <div style={{ marginBottom: 16 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 6 }}>Original Clarification Question</div>
                                <div style={{ padding: "10px 12px", fontSize: 13, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 6, color: "#92400e", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                                    {item._statusNotes || "Original question was not captured for this older record."}
                                </div>
                                <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>Asked by {item.owner || "Contributor"}</div>
                            </div>

                            {/* Clarification Thread */}
                            <div style={{ marginBottom: 16 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 6 }}>Clarification Thread</div>
                                <div style={{ maxHeight: 200, overflow: "auto" }}>
                                    <ClarificationThread 
                                        workNotes={item._workNotes || []} 
                                        statusNotes={item._statusNotes}
                                        questionAuthor={item.owner}
                                    />
                                </div>
                            </div>

                            {/* Path Selection */}
                            {clarificationSubmitStep === "select" && (
                                <>
                                    <div style={{ fontSize: 13, color: "#334155", marginBottom: 12, lineHeight: 1.5 }}>
                                        Review the contributor's question and choose how the clarification should be resolved.
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                        <div
                                            onClick={() => setClarificationPath("A")}
                                            style={{ padding: "14px 16px", border: clarificationPath === "A" ? "2px solid #0891b2" : "2px solid #e5e7eb", borderRadius: 10, background: clarificationPath === "A" ? "#ecfeff" : "#fff", cursor: "pointer", transition: "all 0.15s" }}
                                        >
                                            <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>Answer Contributor Internally</div>
                                            <div style={{ fontSize: 12, color: "#475569" }}>Provide guidance and return the request to the contributor.</div>
                                        </div>
                                        <div
                                            onClick={() => setClarificationPath("B")}
                                            style={{ padding: "14px 16px", border: clarificationPath === "B" ? "2px solid #0891b2" : "2px solid #e5e7eb", borderRadius: 10, background: clarificationPath === "B" ? "#ecfeff" : "#fff", cursor: "pointer", transition: "all 0.15s" }}
                                        >
                                            <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>Request Information from External Partner</div>
                                            <div style={{ fontSize: 12, color: "#475569" }}>Send a clear external-facing question and pause internal work until the partner responds.</div>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Path A Form */}
                            {clarificationSubmitStep === "select" && clarificationPath === "A" && (
                                <div style={{ marginTop: 16, padding: "14px 16px", border: "1px solid #e5e7eb", borderRadius: 10, background: "#f8fafc" }}>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 10 }}>Internal Response</div>
                                    <label style={{ fontSize: 11, fontWeight: 600, color: "#334155", marginBottom: 4, display: "block" }}>Response / Guidance <span style={{ color: "#dc2626" }}>*</span></label>
                                    <textarea
                                        value={clarificationInternalResponse}
                                        onChange={e => setClarificationInternalResponse(e.target.value)}
                                        placeholder="Provide your response to the contributor's question..."
                                        rows={3}
                                        style={{ width: "100%", padding: "8px 10px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 6, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", outline: "none", color: "#0f172a", marginBottom: 10 }}
                                    />
                                    <label style={{ fontSize: 11, fontWeight: 600, color: "#334155", marginBottom: 4, display: "block" }}>Additional Internal Note (optional)</label>
                                    <textarea
                                        value={clarificationInternalNote}
                                        onChange={e => setClarificationInternalNote(e.target.value)}
                                        placeholder="Add any internal notes for the record..."
                                        rows={2}
                                        style={{ width: "100%", padding: "8px 10px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 6, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", outline: "none", color: "#0f172a" }}
                                    />
                                </div>
                            )}

                            {/* Path B Form */}
                            {clarificationSubmitStep === "select" && clarificationPath === "B" && (
                                <div style={{ marginTop: 16, padding: "14px 16px", border: "1px solid #e5e7eb", borderRadius: 10, background: "#f8fafc" }}>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 10 }}>External Information Request</div>
                                    <label style={{ fontSize: 11, fontWeight: 600, color: "#334155", marginBottom: 4, display: "block" }}>External-Facing Question <span style={{ color: "#dc2626" }}>*</span></label>
                                    <textarea
                                        value={clarificationExternalQuestion}
                                        onChange={e => setClarificationExternalQuestion(e.target.value)}
                                        placeholder="Enter the question to send to the external partner..."
                                        rows={3}
                                        style={{ width: "100%", padding: "8px 10px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 6, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", outline: "none", color: "#0f172a", marginBottom: 10 }}
                                    />
                                    <label style={{ fontSize: 11, fontWeight: 600, color: "#334155", marginBottom: 4, display: "block" }}>Supporting Instructions (optional)</label>
                                    <textarea
                                        value={clarificationExternalInstructions}
                                        onChange={e => setClarificationExternalInstructions(e.target.value)}
                                        placeholder="Add any additional context for the partner..."
                                        rows={2}
                                        style={{ width: "100%", padding: "8px 10px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 6, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", outline: "none", color: "#0f172a" }}
                                    />
                                    <div style={{ marginTop: 10, padding: "8px 10px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 6, fontSize: 12, color: "#92400e" }}>
                                        <strong>Note:</strong> The external partner will see this question. Your internal contributor question will be preserved separately.
                                    </div>
                                </div>
                            )}

                            {/* Confirmation Step */}
                            {clarificationSubmitStep === "confirm" && (
                                <div style={{ marginTop: 16, padding: "14px 16px", border: "1px solid #e5e7eb", borderRadius: 10, background: "#f0fdf4" }}>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 10 }}>Confirm {clarificationPath === "A" ? "Internal Answer" : "External Request"}</div>
                                    <div style={{ fontSize: 12, color: "#334155", marginBottom: 10, lineHeight: 1.5 }}>
                                        {clarificationPath === "A" ? (
                                            <>This will save your response and return the request to <strong>{item.owner}</strong>. The request will move out of DD Operations review.</>
                                        ) : (
                                            <>This will send the question to the external partner. The request will be paused internally until they respond.</>
                                        )}
                                    </div>
                                    {clarificationPath === "A" && (
                                        <div style={{ padding: "8px 10px", background: "#fff", border: "1px solid #bbf7d0", borderRadius: 6, fontSize: 12, color: "#166534", marginBottom: 8 }}>
                                            <strong>Your Response:</strong><br />{clarificationInternalResponse}
                                        </div>
                                    )}
                                    {clarificationPath === "B" && (
                                        <div style={{ padding: "8px 10px", background: "#fff", border: "1px solid #bbf7d0", borderRadius: 6, fontSize: 12, color: "#166534", marginBottom: 8 }}>
                                            <strong>External Question:</strong><br />{clarificationExternalQuestion}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Success Step */}
                            {clarificationSubmitStep === "done" && (
                                <div style={{ marginTop: 16, padding: "14px 16px", border: "1px solid #bbf7d0", borderRadius: 10, background: "#f0fdf4", textAlign: "center" }}>
                                    <div style={{ fontSize: 16, fontWeight: 700, color: "#166534", marginBottom: 8 }}>✓ {clarificationPath === "A" ? "Response Saved" : "Request Sent"}</div>
                                    <div style={{ fontSize: 13, color: "#334155" }}>
                                        {clarificationPath === "A" ? "The request has been returned to the contributor with your guidance." : "The external partner will receive your question and respond."}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="rc-modal-footer" style={{ borderTop: "1px solid #e5e7eb", paddingTop: 12 }}>
                            {clarificationSubmitStep === "select" && (
                                <>
                                    <button className="rc-btn rc-btn-ghost" onClick={() => { setClarificationSupportModalOpen(false); setClarificationPath(null); setClarificationInternalResponse(""); setClarificationInternalNote(""); setClarificationExternalQuestion(""); setClarificationExternalInstructions(""); }}>Cancel</button>
                                    <button
                                        className="rc-btn rc-btn-primary"
                                        disabled={!clarificationPath || (clarificationPath === "A" && !clarificationInternalResponse.trim()) || (clarificationPath === "B" && !clarificationExternalQuestion.trim())}
                                        onClick={() => setClarificationSubmitStep("confirm")}
                                        style={{ background: "#0891b2" }}
                                    >
                                        Continue
                                    </button>
                                </>
                            )}
                            {clarificationSubmitStep === "confirm" && (
                                <>
                                    <button className="rc-btn rc-btn-ghost" onClick={() => setClarificationSubmitStep("select")}>Back</button>
                                    <button className="rc-btn rc-btn-primary" style={{ background: "#0891b2" }} onClick={submitClarificationSupport}>Confirm & {clarificationPath === "A" ? "Return to Contributor" : "Send to Partner"}</button>
                                </>
                            )}
                            {clarificationSubmitStep === "done" && (
                                <button className="rc-btn rc-btn-primary" onClick={() => { setClarificationSupportModalOpen(false); setClarificationPath(null); setClarificationInternalResponse(""); setClarificationInternalNote(""); setClarificationExternalQuestion(""); setClarificationExternalInstructions(""); setClarificationSubmitStep("select"); }}>Close</button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {duplicateModal && (
                <div className="rc-modal-overlay" onClick={() => setDuplicateModal(null)}>
                    <div className="rc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
                        <div className="rc-modal-header">
                            <h2>Mark as Possible Duplicate</h2>
                            <button className="rc-modal-close" onClick={() => setDuplicateModal(null)}>&times;</button>
                        </div>
                        <div className="rc-modal-body" style={{ padding: "16px 20px" }}>
                            <div style={{ fontSize: 13, color: "#334155", marginBottom: 14 }}>
                                Explain why you believe this request duplicates another request.
                            </div>
                            <div style={{ fontSize: 12, color: "#334155", marginBottom: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                                <div><span style={{ fontWeight: 700, color: "#0f172a", textTransform: "uppercase", fontSize: 10, letterSpacing: "0.03em", marginRight: 6 }}>Request ID</span> {displayId}</div>
                                <div><span style={{ fontWeight: 700, color: "#0f172a", textTransform: "uppercase", fontSize: 10, letterSpacing: "0.03em", marginRight: 6 }}>Deliverable</span> {displayTitle || item.category || "\u2014"}</div>
                            </div>
                            <label style={{ fontSize: 11, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 6, display: "block" }}>Reason <span style={{ color: "#dc2626" }}>*</span></label>
                            <textarea
                                value={duplicateModal.reason}
                                onChange={e => setDuplicateModal(prev => prev ? { ...prev, reason: e.target.value } : null)}
                                placeholder="Explain why this is a possible duplicate..."
                                rows={3}
                                style={{ width: "100%", padding: "8px 10px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 6, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", outline: "none", color: "#0f172a" }}
                            />
                            <div style={{ marginTop: 10, display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 10px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, fontSize: 12, fontWeight: 500, color: "#991b1b" }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                                This will send the request to DD Operations for duplicate review. It will remain visible under Returned / Needs Attention while the recommendation is reviewed.
                            </div>
                        </div>
                        <div className="rc-modal-footer">
                            <button className="rc-btn rc-btn-ghost" onClick={() => setDuplicateModal(null)}>Cancel</button>
                            <button className="rc-btn rc-btn-primary" disabled={!duplicateModal.reason.trim()} onClick={() => {
                                const reason = duplicateModal.reason.trim();
                                if (!reason) return;
                                const reqId = item.id || item.intakeId || "";
                                updateRequestStatus(reqId, "Duplicate" as RecapRequest["status"]);
                                updateRequestStatusNotes(reqId, reason);
                                addWorkNote(reqId, reason, currentUser, "Duplicate");
                                addActivityEntry({
                                    type: "Status Change",
                                    description: `${displayId}: Marked as Duplicate. Reason: ${reason}`,
                                    userId: "current-user",
                                    userName: currentUser,
                                    requestId: item.requestId || item.id,
                                    requestTitle: displayTitle || item.category || "",
                                    transactionId: item.transactionId,
                                    transactionName: item.transactionName || item.transactionId,
                                });
                                setWsRefreshKey(k => k + 1);
                                setDuplicateModal(null);
                                setCompletionDialog("duplicate");
                            }}>Submit for Review</button>
                        </div>
                    </div>
                </div>
            )}

            {notApplicableModal && (
                <div className="rc-modal-overlay" onClick={() => setNotApplicableModal(null)}>
                    <div className="rc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
                        <div className="rc-modal-header">
                            <h2>Recommend Not Applicable</h2>
                            <button className="rc-modal-close" onClick={() => setNotApplicableModal(null)}>&times;</button>
                        </div>
                        <div className="rc-modal-body" style={{ padding: "16px 20px" }}>
                            <div style={{ fontSize: 13, color: "#334155", marginBottom: 14 }}>
                                Explain why this request is not applicable to the transaction.
                            </div>
                            <div style={{ fontSize: 12, color: "#334155", marginBottom: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                                <div><span style={{ fontWeight: 700, color: "#0f172a", textTransform: "uppercase", fontSize: 10, letterSpacing: "0.03em", marginRight: 6 }}>Request ID</span> {displayId}</div>
                                <div><span style={{ fontWeight: 700, color: "#0f172a", textTransform: "uppercase", fontSize: 10, letterSpacing: "0.03em", marginRight: 6 }}>Deliverable</span> {displayTitle || item.category || "\u2014"}</div>
                            </div>
                            <label style={{ fontSize: 11, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 6, display: "block" }}>Reason <span style={{ color: "#dc2626" }}>*</span></label>
                            <textarea
                                value={notApplicableModal.reason}
                                onChange={e => setNotApplicableModal(prev => prev ? { ...prev, reason: e.target.value } : null)}
                                placeholder="Explain why this is not applicable..."
                                rows={3}
                                style={{ width: "100%", padding: "8px 10px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 6, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", outline: "none", color: "#0f172a" }}
                            />
                            <div style={{ marginTop: 10, display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 10px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, fontSize: 12, fontWeight: 500, color: "#991b1b" }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                                This will send your recommendation to DD Operations for review. If approved, it may be sent to the external partner for confirmation.
                            </div>
                        </div>
                        <div className="rc-modal-footer">
                            <button className="rc-btn rc-btn-ghost" onClick={() => setNotApplicableModal(null)}>Cancel</button>
                            <button className="rc-btn rc-btn-primary" disabled={!notApplicableModal.reason.trim()} onClick={() => {
                                const reason = notApplicableModal.reason.trim();
                                if (!reason) return;
                                const reqId = item.id || item.intakeId || "";
                                updateRequestStatus(reqId, "Not Applicable" as RecapRequest["status"]);
                                updateRequestStatusNotes(reqId, reason);
                                addWorkNote(reqId, reason, currentUser, "Not Applicable");
                                addActivityEntry({
                                    type: "Status Change",
                                    description: `${displayId}: Marked as Not Applicable. Reason: ${reason}`,
                                    userId: "current-user",
                                    userName: currentUser,
                                    requestId: item.requestId || item.id,
                                    requestTitle: displayTitle || item.category || "",
                                    transactionId: item.transactionId,
                                    transactionName: item.transactionName || item.transactionId,
                                });
                                setWsRefreshKey(k => k + 1);
                                setNotApplicableModal(null);
                                setCompletionDialog("not-applicable");
                            }}>Submit Recommendation</button>
                        </div>
                    </div>
                </div>
            )}

            {ddOpsRecommendModal && (
                <div className="rc-modal-overlay" onClick={() => setDdOpsRecommendModal(null)}>
                    <div className="rc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
                        <div className="rc-modal-header">
                            <h2>{ddOpsRecommendModal.type === "Duplicate" ? "Duplicate Recommendation Review" : "Not Applicable Recommendation Review"}</h2>
                            <button className="rc-modal-close" onClick={() => setDdOpsRecommendModal(null)}>&times;</button>
                        </div>
                        <div className="rc-modal-body" style={{ padding: "16px 20px" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                <RequestIdentityBlock displayId={displayId} displayTitle={displayTitle || item.category || ""} />
                                {item._statusNotes && (
                                    <div style={{ padding: "8px 10px", background: "#f5f3ff", border: "1px solid #ddd6fe", borderRadius: 6, fontSize: 12, color: "#5b21b6", lineHeight: 1.5 }}>
                                        <span style={{ fontWeight: 700, display: "block", marginBottom: 2, textTransform: "uppercase", fontSize: 10, letterSpacing: "0.03em" }}>Contributor reason:</span>
                                        {item._statusNotes}
                                    </div>
                                )}
                                <div style={{ fontSize: 13, color: "#334155" }}>
                                    {ddOpsRecommendModal.type === "Duplicate"
                                        ? "Validate the duplicate recommendation and send it to the external partner for decision."
                                        : "Validate the not applicable recommendation and send it to the external partner for decision."}
                                </div>
                                <label style={{ fontSize: 11, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                                    Partner-facing note <span style={{ color: "#6b7280", fontWeight: 400 }}>(optional)</span>
                                </label>
                                <textarea
                                    value={ddOpsRecommendModal.partnerNote}
                                    onChange={e => setDdOpsRecommendModal(prev => prev ? { ...prev, partnerNote: e.target.value } : null)}
                                    placeholder="Add any additional context for the external partner..."
                                    rows={3}
                                    style={{ width: "100%", padding: "8px 10px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 6, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", outline: "none", color: "#0f172a" }}
                                />
                                <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 10px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, fontSize: 12, fontWeight: 500, color: "#991b1b" }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                                    {ddOpsRecommendModal.type === "Duplicate"
                                        ? "This will ask the external partner to approve merging/removing this duplicate or keep it as a separate request."
                                        : "This will ask the external partner to approve removing this request from the active due diligence list."}
                                </div>
                            </div>
                        </div>
                        <div className="rc-modal-footer">
                            <button className="rc-btn rc-btn-ghost" onClick={() => setDdOpsRecommendModal(null)}>Cancel</button>
                            <button className="rc-btn rc-btn-primary" onClick={() => {
                                const note = ddOpsRecommendModal.partnerNote.trim() || item._statusNotes || "";
                                const reqId = item.id || item.intakeId || "";
                                const status = ddOpsRecommendModal.type as RecapRequest["status"];
                                updateRequestStatus(reqId, status);
                                if (ddOpsRecommendModal.partnerNote.trim()) {
                                    updateRequestStatusNotes(reqId, ddOpsRecommendModal.partnerNote.trim());
                                }
                                addWorkNote(reqId, note, currentUser, ddOpsRecommendModal.type);
                                sendExceptionRecommendation(reqId, ddOpsRecommendModal.type, note);
                                addActivityEntry({
                                    type: "Status Change",
                                    description: `${displayId}: ${ddOpsRecommendModal.type} recommendation sent to external partner. Note: ${note}`,
                                    userId: "current-user",
                                    userName: currentUser,
                                    requestId: item.requestId || item.id,
                                    requestTitle: displayTitle || item.category || "",
                                    transactionId: item.transactionId,
                                    transactionName: item.transactionName || item.transactionId,
                                });
                                setWsRefreshKey(k => k + 1);
                                setDdOpsRecommendModal(null);
                                setCompletionDialog(ddOpsRecommendModal.type === "Duplicate" ? "duplicate" : "not-applicable");
                            }}>Send Recommendation to Partner</button>
                        </div>
                    </div>
                </div>
            )}

            {blockModal && blockModal.step === "input" && (
                <div className="rc-modal-overlay" onClick={() => setBlockModal(null)}>
                    <div className="rc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
                        <div className="rc-modal-header">
                            <h2>Block Work</h2>
                            <button className="rc-modal-close" onClick={() => setBlockModal(null)}>&times;</button>
                        </div>
                        <div className="rc-modal-body" style={{ padding: "16px 20px" }}>
                            <div style={{ fontSize: 13, color: "#334155", marginBottom: 14 }}>
                                Tell DD Operations what is preventing you from completing this request.
                            </div>
                            <div style={{ fontSize: 12, color: "#334155", marginBottom: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                                <div><span style={{ fontWeight: 700, color: "#0f172a", textTransform: "uppercase", fontSize: 10, letterSpacing: "0.03em", marginRight: 6 }}>Request ID</span> {displayId}</div>
                                <div><span style={{ fontWeight: 700, color: "#0f172a", textTransform: "uppercase", fontSize: 10, letterSpacing: "0.03em", marginRight: 6 }}>Deliverable</span> {displayTitle || item.category || "\u2014"}</div>
                            </div>
                            <label style={{ fontSize: 11, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 6, display: "block" }}>Reason for Blocker <span style={{ color: "#dc2626" }}>*</span></label>
                            <textarea
                                value={blockModal.reason}
                                onChange={e => setBlockModal(prev => prev ? { ...prev, reason: e.target.value } : null)}
                                placeholder="What is blocking this request?"
                                rows={3}
                                style={{ width: "100%", padding: "8px 10px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 6, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", outline: "none", color: "#0f172a" }}
                            />
                            <div style={{ marginTop: 10, display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 10px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, fontSize: 12, fontWeight: 500, color: "#991b1b" }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                                This will notify DD Operations and move the request to Returned / Needs Attention in My Work.
                            </div>
                        </div>
                        <div className="rc-modal-footer">
                            <button className="rc-btn rc-btn-ghost" onClick={() => setBlockModal(null)}>Cancel</button>
                            <button className="rc-btn rc-btn-primary" disabled={!blockModal.reason.trim()} onClick={() => {
                                const reason = blockModal.reason.trim();
                                if (!reason) return;
                                const reqId = item.id || item.intakeId || "";
                                updateRequestStatus(reqId, "Blocked" as RecapRequest["status"]);
                                updateRequestStatusNotes(reqId, reason);
                                addWorkNote(reqId, reason, currentUser, "Blocked");
                                addActivityEntry({
                                    type: "Status Change",
                                    description: `${displayId}: Blocked. Reason: ${reason}`,
                                    userId: "current-user",
                                    userName: currentUser,
                                    requestId: item.requestId || item.id,
                                    requestTitle: displayTitle || item.category || "",
                                    transactionId: item.transactionId,
                                    transactionName: item.transactionName || item.transactionId,
                                });
                                setWsRefreshKey(k => k + 1);
                                setBlockModal(null);
                                setCompletionDialog("blocked");
                            }}>Confirm Block</button>
                        </div>
                    </div>
                </div>
            )}

            {completionModal && completionModal.step === "input" && (
                <div className="rc-modal-overlay" onClick={() => setCompletionModal(null)}>
                    <div className="rc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
                        <div className="rc-modal-header">
                            <h2>Submit for DD Review</h2>
                            <button className="rc-modal-close" onClick={() => setCompletionModal(null)}>&times;</button>
                        </div>
                        <div className="rc-modal-body" style={{ padding: "16px 20px" }}>
                            <div style={{ fontSize: 12, color: "#334155", marginBottom: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                                <div><span style={{ fontWeight: 700, color: "#0f172a", textTransform: "uppercase", fontSize: 10, letterSpacing: "0.03em", marginRight: 6 }}>Request ID</span> {displayId}</div>
                                <div><span style={{ fontWeight: 700, color: "#0f172a", textTransform: "uppercase", fontSize: 10, letterSpacing: "0.03em", marginRight: 6 }}>Deliverable</span> {displayTitle || item.category || "\u2014"}</div>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 6, fontSize: 12, fontWeight: 600, color: "#166534" }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
                                    Submitting for DD Operations Review
                                </div>
                                {workArtifacts.length === 0 && (
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, fontSize: 12, fontWeight: 500, color: "#991b1b" }}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                                        No artifact is attached to this request. Submitting for review will send it to DD Operations without supporting documentation.
                                    </div>
                                )}
                            </div>
                            <label style={{ fontSize: 11, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 6, display: "block" }}>Completion Notes</label>
                            <textarea
                                value={completionModal.note}
                                onChange={e => setCompletionModal(prev => prev ? { ...prev, note: e.target.value } : null)}
                                placeholder="Describe what was completed or any follow-up items..."
                                rows={4}
                                style={{ width: "100%", padding: "8px 10px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 6, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", outline: "none", color: "#0f172a" }}
                            />
                            <div style={{ fontSize: 11, color: "#475569", fontStyle: "italic", display: "flex", alignItems: "center", gap: 6 }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
                                Completion notes are saved in the Completion Summary section below.
                            </div>
                        </div>
                        <div className="rc-modal-footer">
                            <button className="rc-btn rc-btn-ghost" onClick={() => setCompletionModal(null)}>Cancel</button>
                            <button className="rc-btn rc-btn-primary" onClick={() => {
                                if (!completionModal) return;
                                const note = completionModal.note.trim();
                                const now = new Date().toISOString().split("T")[0];
                                const reqId = item.id || item.intakeId || "";
                                updateRequestCompletion(reqId, {
                                    completedBy: currentUser,
                                    completedAt: now,
                                    completionNotes: note,
                                });
                                if (note) {
                                    addWorkNote(reqId, note, currentUser, "Completed");
                                }
                                addActivityEntry({
                                    type: "Status Change",
                                    description: `Marked as Complete. Notes: ${note || "none provided"}`,
                                    userId: "current-user",
                                    userName: currentUser,
                                    requestId: item.requestId || item.id,
                                    requestTitle: displayTitle || item.category || "",
                                    transactionId: item.transactionId,
                                    transactionName: item.transactionName || item.transactionId,
                                });
                                setWsRefreshKey(k => k + 1);
                                setCompletionModal(prev => prev ? { ...prev, step: "completed" } : null);
                                setCompletionDialog("dd-review");
                            }}>Submit for DD Review</button>
                        </div>
                    </div>
                </div>
            )}

            {resolutionPrompt && (
                <div className="rc-modal-overlay" onClick={() => setResolutionPrompt(null)}>
                    <div className="rc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
                        <div className="rc-modal-header">
                            <h2>Resolve Blocker</h2>
                            <button className="rc-modal-close" onClick={() => setResolutionPrompt(null)}>&times;</button>
                        </div>
                        <div className="rc-modal-body" style={{ padding: "16px 20px" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                <RequestIdentityBlock displayId={displayId} displayTitle={displayTitle || item.category || ""} />
                                <div style={{ fontSize: 13, color: "#334155" }}>
                                    The blocker is being resolved and the request will return to active work.
                                </div>
                                {item._statusNotes && (
                                    <div style={{ padding: "8px 10px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, fontSize: 12, color: "#991b1b", lineHeight: 1.5 }}>
                                        <span style={{ fontWeight: 700, display: "block", marginBottom: 2 }}>Blocker reason:</span>
                                        {item._statusNotes}
                                    </div>
                                )}
                                <label style={{ fontSize: 11, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                                    Resolution note <span style={{ color: "#6b7280", fontWeight: 400 }}>(optional)</span>
                                </label>
                                <textarea
                                    value={resolutionPrompt.note}
                                    onChange={e => setResolutionPrompt({ note: e.target.value })}
                                    placeholder="Describe how the blocker was resolved..."
                                    rows={3}
                                    style={{ width: "100%", padding: "8px 10px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 6, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", outline: "none", color: "#0f172a" }}
                                />
                            </div>
                        </div>
                        <div className="rc-modal-footer">
                            <button className="rc-btn rc-btn-ghost" onClick={() => setResolutionPrompt(null)}>Cancel</button>
                            <button className="rc-btn rc-btn-primary" onClick={() => {
                                const note = resolutionPrompt.note.trim();
                                const reqId = item.id || item.intakeId || "";
                                doStatusChange("In Progress");
                                if (note) {
                                    addWorkNote(reqId, note, currentUser, "Work Note");
                                }
                                setResolutionPrompt(null);
                                setCompletionDialog("resolved");
                            }}>Resolve Blocker</button>
                        </div>
                    </div>
                </div>
            )}

            {notMine && (
                <div className="rc-modal-overlay" onClick={() => setNotMine(null)}>
                    <div className="rc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
                        <div className="rc-modal-header">
                            <h2>Request Reassignment</h2>
                            <button className="rc-modal-close" onClick={() => setNotMine(null)}>&times;</button>
                        </div>
                        <div className="rc-modal-body" style={{ padding: "16px 20px" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                <RequestIdentityBlock displayId={displayId} displayTitle={displayTitle || item.category || ""} />
                                <div style={{ fontSize: 13, color: "#334155" }}>
                                    Tell DD Operations why this request should be assigned to someone else.
                                </div>
                                <label style={{ fontSize: 11, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                                    Reason <span style={{ color: "#dc2626" }}>*</span>
                                </label>
                                <textarea
                                    value={notMine.reason}
                                    onChange={e => setNotMine(prev => prev ? { ...prev, reason: e.target.value } : null)}
                                    placeholder="Why is this item not yours?"
                                    rows={3}
                                    style={{ width: "100%", padding: "8px 10px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 6, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", outline: "none", color: "#0f172a" }}
                                />
                                <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 10px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, fontSize: 12, fontWeight: 500, color: "#991b1b" }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                                    This will notify DD Operations and move the request to Returned / Needs Attention while reassignment is reviewed.
                                </div>
                            </div>
                        </div>
                        <div className="rc-modal-footer">
                            <button className="rc-btn rc-btn-ghost" onClick={() => setNotMine(null)}>Cancel</button>
                            <button className="rc-btn rc-btn-primary" disabled={!notMine.reason.trim()} onClick={() => {
                                const reason = notMine.reason.trim();
                                if (!reason) return;
                                updateRequestNotMine(notMine.req.id, reason, currentUser);
                                setWsRefreshKey(k => k + 1);
                                setNotMine(null);
                                setCompletionDialog("not-mine");
                            }}>Request Reassignment</button>
                        </div>
                    </div>
                </div>
            )}

            {returnToOwnerModal && returnToOwnerModal.step === "input" && (
                <div className="rc-modal-overlay" onClick={() => setReturnToOwnerModal(null)}>
                    <div className="rc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
                        <div className="rc-modal-header">
                            <h2>Return to Owner</h2>
                            <button className="rc-modal-close" onClick={() => setReturnToOwnerModal(null)}>&times;</button>
                        </div>
                        <div className="rc-modal-body" style={{ padding: "16px 20px" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                <RequestIdentityBlock displayId={displayId} displayTitle={displayTitle || item.category || ""} />
                                <div style={{ fontSize: 13, color: "#334155" }}>
                                    Send this request back to the contributor with feedback. The status will change to <strong>Needs Rework</strong>.
                                </div>
                                <label style={{ fontSize: 11, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                                    Feedback <span style={{ color: "#dc2626" }}>*</span>
                                </label>
                                <textarea
                                    value={returnToOwnerModal.reason}
                                    onChange={e => setReturnToOwnerModal(prev => prev ? { ...prev, reason: e.target.value } : null)}
                                    placeholder="What needs to be revised?"
                                    rows={3}
                                    style={{ width: "100%", padding: "8px 10px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 6, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", outline: "none", color: "#0f172a" }}
                                />
                            </div>
                        </div>
                        <div className="rc-modal-footer">
                            <button className="rc-btn rc-btn-ghost" onClick={() => setReturnToOwnerModal(null)}>Cancel</button>
                            <button className="rc-btn rc-btn-primary" disabled={!returnToOwnerModal.reason.trim()} onClick={doReturnToOwner}>Send Back</button>
                        </div>
                    </div>
                </div>
            )}

            {artifactDetail && (
                <div className="rc-modal-overlay" onClick={() => setArtifactDetail(null)}>
                    <div className="rc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
                        <div className="rc-modal-header">
                            <h2>Artifact Details</h2>
                            <button className="rc-modal-close" onClick={() => setArtifactDetail(null)}>&times;</button>
                        </div>
                        <div className="rc-modal-body" style={{ padding: "16px 20px" }}>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 16px" }}>
                                <div>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 2 }}>File Name</div>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", wordBreak: "break-all" }}>{artifactDetail.displayFileName || artifactDetail.name}</div>
                                </div>
                                {artifactDetail.originalFileName && artifactDetail.originalFileName !== artifactDetail.displayFileName && artifactDetail.originalFileName !== artifactDetail.name && (
                                    <div>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 2 }}>Original File</div>
                                        <div style={{ fontSize: 13, color: "#334155", wordBreak: "break-all" }}>{artifactDetail.originalFileName}</div>
                                    </div>
                                )}
                                <div>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 2 }}>Request ID</div>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", fontFamily: '"SF Mono", monospace' }}>{artifactDetail.requestId}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 2 }}>Uploaded By</div>
                                    <div style={{ fontSize: 13, color: "#334155" }}>{artifactDetail.uploadedBy || "\u2014"}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 2 }}>Uploaded Date</div>
                                    <div style={{ fontSize: 13, color: "#334155" }}>{artifactDetail.uploadedAt}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 2 }}>File Size</div>
                                    <div style={{ fontSize: 13, color: "#334155" }}>{(artifactDetail.size / 1024).toFixed(0)} KB</div>
                                </div>
                                {artifactDetail.isPrototype && (
                                    <div>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 2 }}>Type</div>
                                        <span style={{ fontSize: 11, fontWeight: 600, color: "#92400e", background: "#fffbeb", padding: "0 6px", borderRadius: 3 }}>PROTOTYPE METADATA</span>
                                    </div>
                                )}
                            </div>
                            <div style={{ marginTop: 16, padding: "10px 12px", background: "#f8faff", border: "1px solid #dbeafe", borderRadius: 6, fontSize: 12, color: "#1e293b", lineHeight: 1.5 }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 4 }}><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
                                <span style={{ marginLeft: 4 }}>Prototype metadata only. SharePoint file open will be available after Graph integration.</span>
                            </div>
                        </div>
                        <div className="rc-modal-footer">
                            <button className="rc-btn rc-btn-primary" onClick={() => setArtifactDetail(null)}>Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Completion Dialogs */}
            <WorkflowCompletionDialog
                isOpen={completionDialog === "blocked"}
                onClose={() => setCompletionDialog(null)}
                icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" /></svg>}
                iconBg="#dc2626"
                title="Work Blocked"
                explanation="Your blocker has been sent to DD Operations."
                currentStatus="Blocked"
                whatHappensNext={[
                    "DD Operations will review the blocker.",
                    "They may resolve it, return the request with guidance, or reassign it.",
                    "This request will remain visible in My Work under Returned / Needs Attention.",
                ]}
                primaryAction={{ label: "Return to My Work", onClick: () => { setCompletionDialog(null); navigate("/recapitalization/my-work"); } }}
                secondaryAction={{ label: "Stay on Request", onClick: () => setCompletionDialog(null) }}
            />

            <WorkflowCompletionDialog
                isOpen={completionDialog === "clarification"}
                onClose={() => setCompletionDialog(null)}
                icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>}
                iconBg="#d97706"
                title="Clarification Sent"
                explanation="Your question has been sent to DD Operations."
                currentStatus="Needs Clarification"
                whatHappensNext={[
                    "DD Operations will review your question.",
                    "They may respond directly or send it to the external partner.",
                    "The request will remain visible under Returned / Needs Attention while you wait.",
                ]}
                primaryAction={{ label: "Return to My Work", onClick: () => { setCompletionDialog(null); navigate("/recapitalization/my-work"); } }}
                secondaryAction={{ label: "Stay on Request", onClick: () => setCompletionDialog(null) }}
            />

            <WorkflowCompletionDialog
                isOpen={completionDialog === "dd-review"}
                onClose={() => setCompletionDialog(null)}
                icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>}
                iconBg="#166534"
                title="Submitted for DD Review"
                explanation="Your work has been sent to DD Operations for review."
                currentStatus="Needs DD Review"
                whatHappensNext={[
                    "DD Operations will review the submitted artifacts and notes.",
                    "They may publish the work externally.",
                    "They may return the request to you with feedback.",
                ]}
                primaryAction={{ label: "Return to My Work", onClick: () => { setCompletionDialog(null); navigate("/recapitalization/my-work"); } }}
                secondaryAction={{ label: "Stay on Request", onClick: () => setCompletionDialog(null) }}
            />

            <WorkflowCompletionDialog
                isOpen={completionDialog === "return-to-owner"}
                onClose={() => setCompletionDialog(null)}
                icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>}
                iconBg="#d97706"
                title="Returned to Owner"
                explanation="Your feedback has been sent to the request owner."
                currentStatus="Needs Rework"
                whatHappensNext={[
                    "The owner will see this request under Returned / Needs Attention.",
                    "Your feedback will be shown prominently in their workspace.",
                    "The request will return to DD Operations after the owner resubmits it.",
                ]}
                primaryAction={{ label: "Return to DD Operations", onClick: () => { setCompletionDialog(null); navigate("/recapitalization/dd-operations"); } }}
                secondaryAction={{ label: "Stay on Request", onClick: () => setCompletionDialog(null) }}
            />

            <WorkflowCompletionDialog
                isOpen={completionDialog === "duplicate"}
                onClose={() => setCompletionDialog(null)}
                icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>}
                iconBg="#6d28d9"
                title="Possible Duplicate Submitted"
                explanation="Your duplicate recommendation has been sent to DD Operations."
                currentStatus="Duplicate Review Pending"
                whatHappensNext={[
                    "DD Operations will compare this request with related requests.",
                    "They may approve the duplicate recommendation or return it to you.",
                    "If approved, the recommendation may be sent to the external partner for confirmation.",
                    "The request will remain visible under Returned / Needs Attention while the review is pending.",
                ]}
                primaryAction={{ label: "Return to My Work", onClick: () => { setCompletionDialog(null); navigate("/recapitalization/my-work"); } }}
                secondaryAction={{ label: "Stay on Request", onClick: () => setCompletionDialog(null) }}
            />

            <WorkflowCompletionDialog
                isOpen={completionDialog === "not-applicable"}
                onClose={() => setCompletionDialog(null)}
                icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>}
                iconBg="#4f46e5"
                title="Not Applicable Recommendation Sent"
                explanation="Your recommendation has been sent to DD Operations."
                currentStatus="Not Applicable Review Pending"
                whatHappensNext={[
                    "DD Operations will review the recommendation.",
                    "They may return the request to you for more information.",
                    "If approved, the external partner may be asked to approve removal.",
                    "The request will remain visible under Returned / Needs Attention while the decision is pending.",
                ]}
                primaryAction={{ label: "Return to My Work", onClick: () => { setCompletionDialog(null); navigate("/recapitalization/my-work"); } }}
                secondaryAction={{ label: "Stay on Request", onClick: () => setCompletionDialog(null) }}
            />

            <WorkflowCompletionDialog
                isOpen={completionDialog === "not-mine"}
                onClose={() => setCompletionDialog(null)}
                icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>}
                iconBg="#2563eb"
                title="Reassignment Requested"
                explanation="DD Operations has been notified that this request needs a different owner."
                currentStatus="Needs Reassignment"
                whatHappensNext={[
                    "DD Operations will review your reason.",
                    "They may assign the request to another owner or return it to you.",
                    "The request will remain visible under Returned / Needs Attention until reassignment is complete.",
                ]}
                primaryAction={{ label: "Return to My Work", onClick: () => { setCompletionDialog(null); navigate("/recapitalization/my-work"); } }}
                secondaryAction={{ label: "Stay on Request", onClick: () => setCompletionDialog(null) }}
            />

            <WorkflowCompletionDialog
                isOpen={completionDialog === "resolved"}
                onClose={() => setCompletionDialog(null)}
                icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>}
                iconBg="#2563eb"
                title="Blocker Resolved"
                explanation="The blocker has been resolved and the request is ready to continue."
                currentStatus="In Progress"
                whatHappensNext={[
                    "The request has returned to active work.",
                    "The resolution will be visible in the activity history.",
                ]}
                primaryAction={{ label: "Return to My Work", onClick: () => { setCompletionDialog(null); navigate("/recapitalization/my-work"); } }}
                secondaryAction={{ label: "Stay on Request", onClick: () => setCompletionDialog(null) }}
            />

            {publishExternal && (
                <div className="rc-modal-overlay" onClick={() => { if (publishExternal.step < 3) setPublishExternal(null); }}>
                    <div className="rc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
                        <div className="rc-modal-header">
                            <h2>
                                {publishExternal.step === 1 && "Publish to External Portal"}
                                {publishExternal.step === 2 && "Confirm External Publication"}
                                {publishExternal.step === 3 && "Published Externally"}
                            </h2>
                            <button className="rc-modal-close" onClick={() => setPublishExternal(null)}>&times;</button>
                        </div>
                        <div className="rc-modal-body" style={{ padding: "16px 20px" }}>
                            {/* Step indicator */}
                            <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
                                {[1, 2, 3, 4].map(s => (
                                    <div key={s} style={{ flex: 1, height: 3, borderRadius: 2, background: s <= publishExternal.step ? "#1d4ed8" : "#e2e8f0", transition: "background 0.2s" }} />
                                ))}
                            </div>
                            <div style={{ fontSize: 11, color: "#475569", marginBottom: 12, fontWeight: 600 }}>Step {publishExternal.step} of 4</div>

                            {publishExternal.step === 1 && (
                                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", marginBottom: 4 }}>Review Details</div>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                        <div>
                                            <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 2 }}>Request ID</div>
                                            <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{displayId}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 2 }}>Intake ID</div>
                                            <div style={{ fontSize: 13, color: "#334155" }}>{item.intakeId || "\u2014"}</div>
                                        </div>
                                        <div style={{ gridColumn: "1 / -1" }}>
                                            <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 2 }}>Deliverable</div>
                                            <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{displayTitle || item.category || "\u2014"}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 2 }}>Completed By</div>
                                            <div style={{ fontSize: 13, color: "#334155" }}>{completionSummary?.completedBy || internalOwner || "\u2014"}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 2 }}>Completed Date</div>
                                            <div style={{ fontSize: 13, color: "#334155" }}>{completionSummary?.completedDate || "\u2014"}</div>
                                        </div>
                                    </div>
                                    {completionSummary?.completionNotes && (
                                        <div style={{ padding: "8px 12px", background: "#f8faff", border: "1px solid #dbeafe", borderRadius: 6 }}>
                                            <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 2 }}>Completion Summary</div>
                                            <div style={{ fontSize: 12, color: "#334155", lineHeight: 1.5 }}>{completionSummary.completionNotes}</div>
                                        </div>
                                    )}
                                    {workArtifacts.length > 0 ? (
                                        <div>
                                            <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 4 }}>Work Artifacts</div>
                                            {workArtifacts.map(art => (
                                                <label key={art.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", fontSize: 12, color: "#1e293b", cursor: "pointer" }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={publishExternal.selectedArtifacts.includes(art.name)}
                                                        onChange={e => {
                                                            if (e.target.checked) {
                                                                setPublishExternal(prev => prev ? { ...prev, selectedArtifacts: [...prev.selectedArtifacts, art.name] } : null);
                                                            } else {
                                                                setPublishExternal(prev => prev ? { ...prev, selectedArtifacts: prev.selectedArtifacts.filter(n => n !== art.name) } : null);
                                                            }
                                                        }}
                                                    />
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><polyline points="13 2 13 9 20 9" /></svg>
                                                    <span>{art.name}</span>
                                                </label>
                                            ))}
                                        </div>
                                    ) : (
                                        <div style={{ padding: "8px 12px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 6, fontSize: 12, color: "#92400e" }}>
                                            <strong>Warning:</strong> No artifacts are attached to this request. Publishing with no supporting documents will share minimal information.
                                        </div>
                                    )}
                                    <div style={{ padding: "8px 12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, fontSize: 12, color: "#991b1b", display: "flex", alignItems: "center", gap: 6 }}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                                        You are about to make this request and selected documents visible to the external broker/buyer portal.
                                    </div>
                                </div>
                            )}

                            {publishExternal.step === 2 && (
                                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>Confirm External Publication</div>
                                    <div style={{ padding: "8px 12px", background: "#f8faff", border: "1px solid #dbeafe", borderRadius: 6 }}>
                                        <div style={{ fontSize: 11, color: "#475569", marginBottom: 4 }}><strong>Request ID:</strong> {displayId}</div>
                                        <div style={{ fontSize: 11, color: "#475569", marginBottom: 4 }}><strong>Deliverable:</strong> {displayTitle || item.category || "\u2014"}</div>
                                        {publishExternal.selectedArtifacts.length > 0 && (
                                            <div style={{ fontSize: 11, color: "#475569" }}><strong>Documents ({publishExternal.selectedArtifacts.length}):</strong> {publishExternal.selectedArtifacts.join(", ")}</div>
                                        )}
                                    </div>
                                    <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.5 }}>
                                        Please confirm you want to publish these materials externally.
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 4 }}>Add optional note for external partner</div>
                                        <textarea
                                            value={publishExternal.note}
                                            onChange={e => setPublishExternal(prev => prev ? { ...prev, note: e.target.value } : null)}
                                            placeholder="e.g. Only available communities are included."
                                            rows={2}
                                            style={{ width: "100%", padding: "8px 10px", fontSize: 13, border: "1px solid #cbd5e1", borderRadius: 6, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", outline: "none" }}
                                        />
                                    </div>
                                </div>
                            )}

                            {publishExternal.step === 3 && (
                                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center", textAlign: "center", padding: "4px 0" }}>
                                        <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#166534" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
                                        </div>
                                        <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>{displayStatus === "Needs Rework" ? "Rework Published" : "Published Externally"}</div>
                                        <div style={{ fontSize: 14, color: "#334155", lineHeight: 1.5, maxWidth: 380 }}>
                                            The approved artifacts are now available to the external partner.
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 6, background: "#f1f5f9", fontSize: 12, fontWeight: 600, color: "#0f172a" }}>
                                            <span style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em" }}>Status:</span>
                                            Waiting Partner Review
                                        </div>
                                        {publishExternal.selectedArtifacts.length > 0 && (
                                            <div style={{ fontSize: 12, color: "#475569" }}>
                                                {publishExternal.selectedArtifacts.length} supporting artifact{publishExternal.selectedArtifacts.length !== 1 ? "s" : ""} published{workArtifacts.some(a => a.isPrototype) ? " (prototype metadata)" : ""}.
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ height: 1, background: "#e2e8f0" }} />

                                    <div>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 10 }}>What happens next?</div>
                                        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
                                            <li style={{ display: "flex", gap: 8, fontSize: 13, color: "#334155", lineHeight: 1.5 }}>
                                                <span style={{ width: 18, height: 18, borderRadius: "50%", background: "#eef2ff", color: "#4f46e5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>1</span>
                                                <span>The external partner can approve the request.</span>
                                            </li>
                                            <li style={{ display: "flex", gap: 8, fontSize: 13, color: "#334155", lineHeight: 1.5 }}>
                                                <span style={{ width: 18, height: 18, borderRadius: "50%", background: "#eef2ff", color: "#4f46e5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>2</span>
                                                <span>They can request rework and include comments.</span>
                                            </li>
                                            <li style={{ display: "flex", gap: 8, fontSize: 13, color: "#334155", lineHeight: 1.5 }}>
                                                <span style={{ width: 18, height: 18, borderRadius: "50%", background: "#eef2ff", color: "#4f46e5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>3</span>
                                                <span>Their decision will appear in Partner Action.</span>
                                            </li>
                                        </ul>
                                    </div>

                                    <div style={{ height: 1, background: "#e2e8f0" }} />

                                    {/* Promote to Reusable Knowledge */}
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polygon points="12 6 15 10 20 10 16 14 18 18 12 15 6 18 8 14 4 10 9 10" /></svg>
                                            Promote to Reusable Knowledge?
                                        </div>
                                        {workArtifacts.length === 0 ? (
                                            <div style={{ padding: "8px 12px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 12, color: "#475569" }}>
                                                No artifacts attached. Nothing can be promoted to Reusable Knowledge.
                                            </div>
                                        ) : (
                                            (() => {
                                                const rec = getReusableKnowledgeRecommendation(item.category || "");
                                                return (
                                                    <>
                                                        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
                                                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px" }}>
                                                                <div>
                                                                    <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 2 }}>Request ID</div>
                                                                    <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{displayId}</div>
                                                                </div>
                                                                <div>
                                                                    <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 2 }}>Deliverable</div>
                                                                    <div style={{ fontSize: 13, color: "#334155" }}>{displayTitle || item.category || "\u2014"}</div>
                                                                </div>
                                                            </div>
                                                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                                                <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 2 }}>Artifacts ({workArtifacts.length})</div>
                                                                {workArtifacts.map(art => (
                                                                    <div key={art.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "#f8faff", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 12, color: "#1e293b" }}>
                                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><polyline points="13 2 13 9 20 9" /></svg>
                                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                                            <span style={{ fontWeight: 500 }}>{art.displayFileName || art.originalFileName || art.name}</span>
                                                                            <div style={{ display: "flex", gap: 8, fontSize: 11, color: "#475569", marginTop: 1 }}>
                                                                                {art.artifactType && <span>{art.artifactType}</span>}
                                                                                <span>{(art.size / 1024).toFixed(0)} KB</span>
                                                                                <span>{art.uploadedAt}</span>
                                                                                {art.uploadedBy && <span>{art.uploadedBy}</span>}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                        <div style={{ padding: "8px 12px", borderRadius: 6, fontSize: 12, lineHeight: 1.5,
                                                            background: rec.action === "Promote" ? "#f0fdf4" : rec.action === "Do not promote" ? "#fef2f2" : "#fffbeb",
                                                            border: `1px solid ${rec.action === "Promote" ? "#bbf7d0" : rec.action === "Do not promote" ? "#fecaca" : "#fde68a"}`,
                                                            color: rec.action === "Promote" ? "#166534" : rec.action === "Do not promote" ? "#991b1b" : "#92400e",
                                                        }}>
                                                            <div style={{ fontWeight: 700, marginBottom: 2 }}>AI Recommendation: {rec.action}</div>
                                                            <div>{rec.reason}</div>
                                                        </div>
                                                    </>
                                                );
                                            })()
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="rc-modal-footer">
                            {publishExternal.step < 3 && (
                                <button className="rc-btn rc-btn-ghost" onClick={() => setPublishExternal(null)}>Cancel</button>
                            )}
                            {publishExternal.step === 2 && (
                                <button className="rc-btn rc-btn-secondary" onClick={() => setPublishExternal(prev => prev ? { ...prev, step: 1 } : null)}>Back</button>
                            )}
                            {publishExternal.step === 1 && (
                                <button className="rc-btn rc-btn-primary" onClick={() => setPublishExternal(prev => prev ? { ...prev, step: 2 } : null)}>Continue</button>
                            )}
                            {publishExternal.step === 2 && (
                                <button className="rc-btn rc-btn-primary" onClick={() => {
                                    const extNote = publishExternal?.note || undefined;
                                    setPublishExternal(prev => prev ? { ...prev, step: 3 } : null);
                                    updateRequestExternalStatus(item.id || item.intakeId || "", workArtifacts.length === 0, extNote);
                                    const artCount = workArtifacts.length;
                                    addActivityEntry({
                                        type: "Status Change",
                                        description: `${displayId}: Published externally by ${currentUser}` + (artCount > 0 ? ` (${artCount} artifact${artCount !== 1 ? "s" : ""})` : ""),
                                        userId: "current-user",
                                        userName: currentUser,
                                        requestId: item.requestId || item.id,
                                        requestTitle: displayTitle || item.category || "",
                                        transactionId: item.transactionId,
                                        transactionName: item.transactionName || item.transactionId,
                                    });
                                }}>Confirm Publish External</button>
                            )}
                            {publishExternal.step === 3 && (
                                <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
                                    {workArtifacts.length > 0 ? (
                                        <>
                                            <button className="rc-btn rc-btn-primary" style={{ width: "100%" }} onClick={() => {
                                                const reqId = item.id || item.intakeId || "";
                                                promoteToReusableKnowledge(reqId, "Promoted", workArtifacts.map(a => a.id), currentUser);
                                                setPublishExternal(null);
                                                setWsRefreshKey(k => k + 1);
                                                navigate(backPath);
                                            }}>Promote to Reusable Knowledge</button>
                                            <button className="rc-btn rc-btn-secondary" style={{ width: "100%" }} onClick={() => {
                                                const reqId = item.id || item.intakeId || "";
                                                promoteToReusableKnowledge(reqId, "Skipped", workArtifacts.map(a => a.id), currentUser);
                                                setPublishExternal(null);
                                                setWsRefreshKey(k => k + 1);
                                                navigate(backPath);
                                            }}>Skip for Now</button>
                                        </>
                                    ) : (
                                        <button className="rc-btn rc-btn-primary" style={{ width: "100%" }} onClick={() => {
                                            setPublishExternal(null);
                                            navigate(backPath);
                                        }}>Done</button>
                                    )}
                                    <button className="rc-btn rc-btn-ghost" style={{ width: "100%" }} onClick={() => { setPublishExternal(null); }}>Stay on Request</button>
                                </div>
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
                <span style={{ color: "#64748b", display: "flex" }}>
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

/* ── Shared Workflow Completion Dialog ── */

function WorkflowCompletionDialog({
    isOpen,
    onClose,
    icon,
    iconBg,
    title,
    explanation,
    currentStatus,
    whatHappensNext,
    primaryAction,
    secondaryAction,
}: {
    isOpen: boolean;
    onClose: () => void;
    icon: React.ReactNode;
    iconBg: string;
    title: string;
    explanation: string;
    currentStatus: string;
    whatHappensNext: string[];
    primaryAction: { label: string; onClick: () => void };
    secondaryAction?: { label: string; onClick: () => void };
}) {
    if (!isOpen) return null;
    return (
        <div className="rc-modal-overlay" onClick={onClose}>
            <div className="rc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
                <div className="rc-modal-body" style={{ padding: "24px 24px 16px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center", textAlign: "center", padding: "8px 0" }}>
                        <div style={{ width: 52, height: 52, borderRadius: "50%", background: iconBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {icon}
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>{title}</div>
                        <div style={{ fontSize: 14, color: "#334155", lineHeight: 1.6, maxWidth: 380 }}>{explanation}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 6, background: "#f1f5f9", fontSize: 12, fontWeight: 600, color: "#0f172a" }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em" }}>Status:</span>
                            {currentStatus}
                        </div>
                    </div>

                    {whatHappensNext.length > 0 && (
                        <>
                            <div style={{ height: 1, background: "#e2e8f0", margin: "16px 0" }} />
                            <div>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 10 }}>What happens next?</div>
                                <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
                                    {whatHappensNext.map((step, i) => (
                                        <li key={i} style={{ display: "flex", gap: 8, fontSize: 13, color: "#334155", lineHeight: 1.5 }}>
                                            <span style={{ width: 18, height: 18, borderRadius: "50%", background: "#eef2ff", color: "#4f46e5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
                                            <span>{step}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </>
                    )}
                </div>
                <div className="rc-modal-footer" style={{ flexDirection: "column", gap: 6, padding: "16px 24px 20px" }}>
                    <button className="rc-btn rc-btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={primaryAction.onClick}>{primaryAction.label}</button>
                    {secondaryAction && (
                        <button className="rc-btn rc-btn-ghost" style={{ width: "100%", justifyContent: "center" }} onClick={secondaryAction.onClick}>{secondaryAction.label}</button>
                    )}
                </div>
            </div>
        </div>
    );
}

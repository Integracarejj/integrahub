import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { RecapRequest } from "../../services/recapMockData";
import {
    acceptAuthoritativeWorkItem, addAuthoritativeWorkNote, approveAuthoritativeDisposition,
    assignAuthoritativeWorkItem, getAuthoritativeAssignees,
    blockAuthoritativeWorkItem, loadAuthoritativeWorkItemEvents, loadAuthoritativeWorkItems,
    loadAuthoritativeWorkNotes, markAuthoritativeWorkItemNotMine,
    markAuthoritativeWorkItemReadyToPublish, proposeAuthoritativeDisposition,
    requestAuthoritativeClarification, resolveAuthoritativeClarification,
    returnAuthoritativeDisposition, returnAuthoritativeWorkItemFromDdReview,
    submitAuthoritativeWorkItemForDdReview, unblockAuthoritativeWorkItem,
    updateAuthoritativeResponse, AuthoritativeWorkItemConflictError,
    type AuthoritativeWorkItemEvent, type AuthoritativeWorkNote,
} from "../../services/recapWorkItemPersistence";
import {
    downloadAuthoritativeArtifact, downloadAuthoritativeSourceDocument,
    loadAuthoritativeArtifacts, loadAuthoritativeSourceDocuments, uploadAuthoritativeArtifact,
    type AuthoritativeArtifact, type AuthoritativeSourceDocument,
} from "../../services/recapWorkArtifactPersistence";
import RecapSubNav from "./RecapSubNav";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import "./Recapitalization.css";

type ReasonAction = "block" | "clarify" | "not-mine" | "not-applicable" | "duplicate" | "resolve" | "unblock" | "return-review" | "return-disposition";
type WorkspaceAction = { label: string; description: string; primary?: boolean; action: () => void };

const STATUS_STYLE: Record<string, { color: string; background: string; border: string }> = {
    Queued: { color: "#475569", background: "#f8fafc", border: "#cbd5e1" },
    Assigned: { color: "#1d4ed8", background: "#eff6ff", border: "#bfdbfe" },
    "In Progress": { color: "#92400e", background: "#fffbeb", border: "#fde68a" },
    Blocked: { color: "#991b1b", background: "#fef2f2", border: "#fecaca" },
    "Clarification Needed": { color: "#9a3412", background: "#fff7ed", border: "#fed7aa" },
    "Needs DD Review": { color: "#3730a3", background: "#eef2ff", border: "#c7d2fe" },
    "Ready to Publish": { color: "#166534", background: "#f0fdf4", border: "#bbf7d0" },
};

const EVENT_LABELS: Record<string, string> = {
    Admitted: "Admitted", Assigned: "Assigned", Reassigned: "Reassigned", Accepted: "Accepted",
    ResponseUpdated: "Response updated", ClarificationRequested: "Clarification requested",
    ClarificationResolved: "Clarification resolved", Blocked: "Blocked", Unblocked: "Unblocked",
    DispositionProposed: "Disposition proposed", DispositionApproved: "Disposition approved",
    DispositionReturned: "Disposition returned", NotMine: "Marked Not Mine",
    SubmittedForDdReview: "Submitted for DD review", ReturnedFromDdReview: "Returned from DD review",
    ReadyToPublish: "Ready to Publish",
};

function dateTime(value?: string | null) {
    if (!value) return "—";
    return new Date(value).toLocaleString();
}

function eventDetails(event: AuthoritativeWorkItemEvent) {
    const details = event.details || {};
    const useful = ["reason", "resolution", "disposition"].map(key => details[key]).find(value => typeof value === "string");
    if (useful) return String(useful);
    if (event.priorStatus && event.resultingStatus && event.priorStatus !== event.resultingStatus) return `${event.priorStatus} → ${event.resultingStatus}`;
    return null;
}

export default function AuthoritativeRecapWorkspace({ initialItem }: { initialItem: RecapRequest }) {
    const navigate = useNavigate();
    const location = useLocation();
    const { user: currentIdentity } = useCurrentUser();
    const [item, setItem] = useState(initialItem);
    const [response, setResponse] = useState(initialItem.authoritativeResponse || "");
    const [events, setEvents] = useState<AuthoritativeWorkItemEvent[]>([]);
    const [notes, setNotes] = useState<AuthoritativeWorkNote[]>([]);
    const [artifacts, setArtifacts] = useState<AuthoritativeArtifact[]>([]);
    const [sources, setSources] = useState<AuthoritativeSourceDocument[]>([]);
    const [noteText, setNoteText] = useState("");
    const [reasonAction, setReasonAction] = useState<ReasonAction | null>(null);
    const [reason, setReason] = useState("");
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
    const [confirmation, setConfirmation] = useState<"accept" | "submit" | null>(null);
    const [uploadingName, setUploadingName] = useState<string | null>(null);
    const [assignment, setAssignment] = useState<{ userId: string; displayName: string } | null>(null);
    const capabilities = item.capabilities || {};
    const assignees = getAuthoritativeAssignees();
    const backFrom = (location.state as { from?: string } | null)?.from;
    const backPath = backFrom === "my-work" ? "/recapitalization/my-work" : backFrom === "dd-operations" ? "/recapitalization/dd-operations" : "/recapitalization/tracker";
    const backLabel = backFrom === "my-work" ? "Back to My Work" : backFrom === "dd-operations" ? "Back to DD Operations" : "Back to Work Queue";

    const refresh = async (preserveDraft = false) => {
        const rows = await loadAuthoritativeWorkItems();
        const latest = rows.find(row => row.id === item.id);
        if (latest) {
            setItem(latest);
            if (!preserveDraft) setResponse(latest.authoritativeResponse || "");
        }
        const [nextEvents, nextNotes, nextArtifacts, nextSources] = await Promise.all([
            loadAuthoritativeWorkItemEvents(item.id), loadAuthoritativeWorkNotes(item.id),
            loadAuthoritativeArtifacts(item.id), loadAuthoritativeSourceDocuments(item.id),
        ]);
        setEvents(nextEvents); setNotes(nextNotes); setArtifacts(nextArtifacts); setSources(nextSources);
    };

    useEffect(() => { void refresh().catch(error => setNotice({ kind: "error", text: error instanceof Error ? error.message : "Unable to load workspace" })); }, [item.id]);
    useEffect(() => { setItem(initialItem); setResponse(initialItem.authoritativeResponse || ""); }, [initialItem]);

    const run = async (operation: () => Promise<RecapRequest>, success: string, preserveDraft = false) => {
        if (busy) return false;
        setBusy(true); setNotice(null);
        try {
            const updated = await operation();
            setItem(updated);
            if (!preserveDraft) setResponse(updated.authoritativeResponse || "");
            setReasonAction(null); setReason("");
            await refresh(preserveDraft);
            setNotice({ kind: "ok", text: success });
            return true;
        } catch (error) {
            if (error instanceof AuthoritativeWorkItemConflictError) {
                const draft = response;
                await refresh(true).catch(() => undefined);
                setResponse(draft);
            }
            setNotice({ kind: "error", text: error instanceof Error ? error.message : "The action could not be completed" });
            return false;
        } finally { setBusy(false); }
    };

    const submitReason = () => {
        const value = reason.trim();
        if (!reasonAction || !value) return;
        const actions: Record<ReasonAction, () => Promise<RecapRequest>> = {
            block: () => blockAuthoritativeWorkItem(item.id, value),
            clarify: () => requestAuthoritativeClarification(item.id, value),
            "not-mine": () => markAuthoritativeWorkItemNotMine(item.id, value),
            "not-applicable": () => proposeAuthoritativeDisposition(item.id, "Not Applicable", value),
            duplicate: () => proposeAuthoritativeDisposition(item.id, "Duplicate", value),
            resolve: () => resolveAuthoritativeClarification(item.id, value),
            unblock: () => unblockAuthoritativeWorkItem(item.id, value),
            "return-review": () => returnAuthoritativeWorkItemFromDdReview(item.id, value),
            "return-disposition": () => returnAuthoritativeDisposition(item.id, value),
        };
        void run(actions[reasonAction], reasonAction === "not-applicable" || reasonAction === "duplicate" ? "Disposition proposed for DD Operations review." : "Authoritative workflow updated.");
    };

    const uploadFile = async (file: File) => {
        if (busy || !capabilities.canUploadArtifact) return;
        setUploadingName(file.name); setBusy(true); setNotice(null);
        try {
            await uploadAuthoritativeArtifact(item.id, file);
            await refresh(true);
            setNotice({ kind: "ok", text: `${file.name} uploaded successfully.` });
        } catch (error) {
            setNotice({ kind: "error", text: error instanceof Error ? error.message : "Upload failed" });
        } finally { setBusy(false); setUploadingName(null); }
    };

    const actionButtons = useMemo(() => [
        capabilities.canAccept && { label: "Accept Work", description: "Begin active work on this request", primary: true, action: () => setConfirmation("accept") },
        capabilities.canSubmitForDdReview && { label: "Submit for DD Review", description: "Send the completed response and artifacts to DD Operations", primary: true, action: () => setConfirmation("submit") },
        capabilities.canMarkNotMine && { label: "Not Mine", description: "Return this request for reassignment", action: () => { setReasonAction("not-mine"); setReason(""); } },
        capabilities.canBlock && { label: "Mark Blocked", description: "Pause work and record the blocker", action: () => { setReasonAction("block"); setReason(""); } },
        capabilities.canClarify && { label: "Request Clarification", description: "Ask DD Operations for clarification", action: () => { setReasonAction("clarify"); setReason(""); } },
        capabilities.canMarkNotApplicable && { label: "Propose Not Applicable", description: "Send an N/A proposal for DD review", action: () => { setReasonAction("not-applicable"); setReason(""); } },
        capabilities.canMarkDuplicate && { label: "Propose Duplicate", description: "Send a duplicate proposal for DD review", action: () => { setReasonAction("duplicate"); setReason(""); } },
        capabilities.canResolveClarification && { label: "Resolve Clarification", description: "Return the request to active work", primary: true, action: () => { setReasonAction("resolve"); setReason(""); } },
        capabilities.canUnblock && { label: "Resume Work", description: "Resolve the blocker and resume work", primary: true, action: () => { setReasonAction("unblock"); setReason(""); } },
        capabilities.canReviewDisposition && { label: "Approve Disposition", description: "Approve the owner's proposed disposition", primary: true, action: () => { void run(() => approveAuthoritativeDisposition(item.id), "Disposition approved."); } },
        capabilities.canReviewDisposition && { label: "Return Disposition", description: "Return the proposal for more work", action: () => { setReasonAction("return-disposition"); setReason(""); } },
        capabilities.canReturnFromDdReview && !capabilities.canReviewDisposition && { label: "Return to Contributor", description: "Return the request with guidance", action: () => { setReasonAction("return-review"); setReason(""); } },
        capabilities.canMarkReadyToPublish && !capabilities.canReviewDisposition && { label: "Mark Ready to Publish", description: "Complete internal DD review", primary: true, action: () => { void run(() => markAuthoritativeWorkItemReadyToPublish(item.id), "Marked Ready to Publish."); } },
    ].filter(Boolean) as WorkspaceAction[], [capabilities, item.id, busy]);

    return <div className="rc-page" style={{ maxWidth: 1120 }} data-testid="authoritative-recap-workspace">
        <RecapSubNav />
        <button className="rc-btn rc-btn-ghost" onClick={() => navigate(backPath)}>← {backLabel}</button>
        {currentIdentity?.userRecord && <div style={{ color: "#64748b", fontSize: 12 }}>Working as <strong>{currentIdentity.userRecord.displayName || currentIdentity.userRecord.email}</strong></div>}
        <section className="rc-card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 28, flexWrap: "wrap", padding: "24px 28px" }}>
                <div style={{ flex: "1 1 520px" }}><div style={{ color: "#64748b", fontSize: 12, fontWeight: 700, letterSpacing: ".04em" }}>{item.requestId}</div><h1 style={{ margin: "5px 0 8px", color: "#0f172a" }}>{item.title}</h1><div style={{ color: "#475569" }}>{item.transactionName}</div></div>
                <div data-testid="workspace-state-summary" style={{ width: 260, display: "grid", gap: 12 }}>
                    <div><div style={{ color: "#64748b", fontSize: 10, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 5 }}>Status</div><div data-testid="authoritative-status" style={{ padding: "9px 12px", borderRadius: 7, border: `1px solid ${(STATUS_STYLE[item.status] || STATUS_STYLE.Queued).border}`, background: (STATUS_STYLE[item.status] || STATUS_STYLE.Queued).background, color: (STATUS_STYLE[item.status] || STATUS_STYLE.Queued).color, fontWeight: 800 }}>{item.status}</div></div>
                    <div><div style={{ color: "#64748b", fontSize: 10, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 5 }}>Owner</div><div style={{ padding: "9px 12px", borderRadius: 7, border: "1px solid #d1d5db", background: "#fff", color: item.owner ? "#0f172a" : "#64748b", fontWeight: 700 }}>{item.owner || "Unassigned"}</div></div>
                    {!item.assignedUserId && capabilities.canAssign && <label style={{ fontSize: 12, color: "#1d4ed8", fontWeight: 700 }}>Assign Owner<select aria-label="Assign Owner" defaultValue="" disabled={busy} style={{ width: "100%", marginTop: 5 }} onChange={event => { const selected = assignees.find(candidate => candidate.id === event.target.value); if (selected) setAssignment({ userId: selected.id, displayName: selected.displayName || selected.email || "selected owner" }); event.currentTarget.value = ""; }}><option value="" disabled>Select an owner</option>{assignees.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.displayName || candidate.email}</option>)}</select></label>}
                </div>
            </div>
            {(item.authoritativeActiveReason || item.authoritativeProposedDisposition || notice) && <div style={{ borderTop: "1px solid #e2e8f0", padding: "14px 28px" }}>
                {item.authoritativeActiveReason && <div className="rc-alert rc-alert-warning"><strong>{item.authoritativeActiveReasonType}:</strong> {item.authoritativeActiveReason}</div>}
                {item.authoritativeProposedDisposition && <div className="rc-alert rc-alert-info"><strong>Proposed {item.authoritativeProposedDisposition}:</strong> {item.authoritativeDispositionReason}</div>}
                {notice && <div role={notice.kind === "error" ? "alert" : "status"} style={{ color: notice.kind === "error" ? "#b91c1c" : "#166534" }}>{notice.text}</div>}
            </div>}
        </section>

        {!item.assignedUserId && <div className="rc-alert rc-alert-info" style={{ margin: "16px 0" }}><strong>Assignment required.</strong> This request is queued and cannot be worked until DD Operations assigns an owner. {!capabilities.canAssign && <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => navigate("/recapitalization/dd-operations")}>Back to Work Queue</button>}</div>}
        {(actionButtons.length > 0 || capabilities.canUploadArtifact) && <section className="rc-card" style={{ padding: 22 }} data-testid="authoritative-action-center"><div style={{ marginBottom: 16 }}><h2 style={{ margin: 0 }}>Action Center</h2><div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>{item.status === "Assigned" ? "Accept or return the assignment before beginning work." : item.status === "In Progress" ? "Continue the response, supporting artifacts, or workflow." : "Actions available for the current authoritative state."}</div></div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10 }}>
            {capabilities.canUploadArtifact && <label style={{ border: "1px solid #93c5fd", background: "#eff6ff", borderRadius: 9, padding: 14, cursor: busy ? "wait" : "pointer" }}><strong style={{ color: "#1d4ed8" }}>Upload Artifact</strong><div style={{ color: "#475569", fontSize: 12, marginTop: 4 }}>Add supporting work through the Recap artifact path</div><input id="artifact-upload-hidden" aria-label="Upload Artifact" hidden type="file" disabled={busy} onChange={event => { const file = event.target.files?.[0]; if (file) void uploadFile(file); event.currentTarget.value = ""; }} /></label>}
            {actionButtons.map(action => <button key={action.label} disabled={busy} onClick={action.action} style={{ textAlign: "left", border: `1px solid ${action.primary ? "#93c5fd" : "#dbe2ea"}`, background: action.primary ? "#eff6ff" : "#fff", borderRadius: 9, padding: 14, cursor: busy ? "wait" : "pointer" }}><strong style={{ color: action.primary ? "#1d4ed8" : "#0f172a" }}>{action.label}</strong><div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>{action.description}</div></button>)}
        </div>{uploadingName && <div role="status" className="rc-artifact-upload-progress" style={{ marginTop: 12 }}>Uploading to SharePoint… {uploadingName}</div>}</section>}
        {reasonAction && <section className="rc-card" style={{ padding: 20 }}><h2>Reason or resolution</h2><textarea aria-label="Reason or resolution" rows={4} value={reason} onChange={event => setReason(event.target.value)} style={{ width: "100%" }} />{reason.length > 2000 && <div role="alert" style={{ color: "#b91c1c" }}>Reason must be 2,000 characters or fewer.</div>}<div style={{ display: "flex", gap: 8, marginTop: 10 }}><button className="rc-btn rc-btn-primary" disabled={busy || !reason.trim() || reason.length > 2000} onClick={submitReason}>Confirm</button><button className="rc-btn rc-btn-ghost" onClick={() => setReasonAction(null)}>Cancel</button></div></section>}

        {item.status === "Assigned" && <div className="rc-alert rc-alert-info" style={{ margin: "16px 0" }}><strong>Work has not started.</strong> The assigned owner must accept this request before the DD response and artifact upload workspace becomes active.</div>}
        {(capabilities.canUpdateResponse || !!item.authoritativeResponse) && <section className="rc-card" style={{ padding: 20 }}><h2>DD response</h2><textarea aria-label="DD response" rows={10} value={response} disabled={!capabilities.canUpdateResponse} onChange={event => setResponse(event.target.value)} style={{ width: "100%" }} />{response.length > 100000 && <div role="alert" style={{ color: "#b91c1c" }}>Response must be 100,000 characters or fewer. Nothing has been truncated or saved.</div>}<div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}><span style={{ color: "#64748b", fontSize: 12 }}>{response.length.toLocaleString()} / 100,000 characters</span>{capabilities.canUpdateResponse && <button className="rc-btn rc-btn-primary" disabled={busy || !response.trim() || response.length > 100000} onClick={() => void run(() => updateAuthoritativeResponse(item.id, response), "Response saved.", false)}>Save response</button>}</div>{item.authoritativeResponse && <div style={{ color: "#64748b", fontSize: 12, marginTop: 8 }}>Saved in the authoritative workspace.</div>}</section>}

        <section className="rc-card" style={{ padding: 20 }}><h2>Work Notes</h2>{capabilities.canAddWorkNote && <div><textarea aria-label="New work note" rows={3} value={noteText} onChange={event => setNoteText(event.target.value)} style={{ width: "100%" }} />{noteText.length > 4000 && <div role="alert" style={{ color: "#b91c1c" }}>Work note must be 4,000 characters or fewer.</div>}<button className="rc-btn rc-btn-primary" disabled={busy || !noteText.trim() || noteText.length > 4000} onClick={async () => { setBusy(true); try { await addAuthoritativeWorkNote(item.id, noteText.trim()); setNoteText(""); await refresh(true); setNotice({ kind: "ok", text: "Work note added." }); } catch (error) { setNotice({ kind: "error", text: error instanceof Error ? error.message : "Unable to add work note" }); } finally { setBusy(false); } }}>Add note</button></div>}{notes.length === 0 ? <p>No work notes recorded.</p> : <div>{notes.map(note => <article key={note.id} style={{ borderTop: "1px solid #e2e8f0", padding: "12px 0" }}><div><strong>{note.authorName || note.authorUserId}</strong> · {dateTime(note.createdAt)}{note.noteType !== "Work Note" ? ` · ${note.noteType}` : ""}</div><div style={{ marginTop: 4, whiteSpace: "pre-wrap" }}>{note.noteText}</div></article>)}</div>}</section>

        <section className="rc-card" style={{ padding: 20 }}><h2>Activity</h2>{events.length === 0 ? <p>No authoritative workflow activity has been recorded yet.</p> : events.map(event => <article key={event.id} style={{ borderTop: "1px solid #e2e8f0", padding: "12px 0" }}><div><strong>{EVENT_LABELS[event.eventType] || event.eventType}</strong> · {event.actorName || event.actorUserId} · {dateTime(event.occurredAt)}</div>{eventDetails(event) && <div style={{ marginTop: 4, color: "#475569" }}>{eventDetails(event)}</div>}</article>)}</section>

        {(capabilities.canViewArtifacts || capabilities.canUploadArtifact) && <section className="rc-card" style={{ padding: 20 }}><h2>Artifacts</h2>{sources.map(source => <div key={source.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "10px 0", borderTop: "1px solid #e2e8f0" }}><span><strong>Source:</strong> <span>{source.fileName}</span></span> <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => void downloadAuthoritativeSourceDocument(item.id, source.id, source.fileName)}>Download source</button></div>)}{artifacts.map(artifact => <div key={artifact.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "10px 0", borderTop: "1px solid #e2e8f0" }}><span>{artifact.fileName}</span> <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => void downloadAuthoritativeArtifact(item.id, artifact.id, artifact.fileName)}>Download</button></div>)}{artifacts.length === 0 && <p style={{ color: "#64748b" }}>No supporting artifacts uploaded yet.</p>}</section>}
        {assignment && <div className="rc-modal-overlay" role="dialog" aria-modal="true" aria-label="Assign Request?">
            <div className="rc-modal" style={{ maxWidth: 480 }}><div className="rc-modal-header"><h2>Assign Request?</h2></div><div className="rc-modal-body">Assign <strong>{item.requestId}</strong> — {item.title} to <strong>{assignment.displayName}</strong>?</div><div className="rc-modal-footer"><button className="rc-btn rc-btn-ghost" disabled={busy} onClick={() => setAssignment(null)}>Cancel</button><button className="rc-btn rc-btn-primary" disabled={busy} onClick={() => void run(() => assignAuthoritativeWorkItem(item.id, assignment.userId), `Assigned to ${assignment.displayName}.`).then(succeeded => { if (succeeded) setAssignment(null); })}>Assign</button></div></div>
        </div>}
        {confirmation && <div className="rc-modal-overlay" role="dialog" aria-modal="true" aria-label={confirmation === "accept" ? "Accept Work?" : "Submit for DD Review?"}>
            <div className="rc-modal" style={{ maxWidth: 480 }}><div className="rc-modal-header"><h2>{confirmation === "accept" ? "Accept Work?" : "Submit for DD Review?"}</h2></div><div className="rc-modal-body"><strong>{item.requestId}</strong> — {item.title}<p>{confirmation === "accept" ? "This moves the request to In Progress." : "DD Operations will review the authoritative response, notes, history, and artifacts."}</p></div><div className="rc-modal-footer"><button className="rc-btn rc-btn-ghost" onClick={() => setConfirmation(null)}>Cancel</button><button className="rc-btn rc-btn-primary" disabled={busy} onClick={() => { const selected = confirmation; setConfirmation(null); void run(selected === "accept" ? () => acceptAuthoritativeWorkItem(item.id) : () => submitAuthoritativeWorkItemForDdReview(item.id), selected === "accept" ? "Work accepted." : "Submitted for DD Operations review."); }}>{confirmation === "accept" ? "Accept Work" : "Submit for DD Review"}</button></div></div>
        </div>}
    </div>;
}

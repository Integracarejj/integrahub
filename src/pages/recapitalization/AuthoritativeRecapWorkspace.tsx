import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { RecapRequest } from "../../services/recapMockData";
import {
    acceptAuthoritativeWorkItem, addAuthoritativeWorkNote, approveAuthoritativeDisposition,
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
    const capabilities = item.capabilities || {};
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
        if (busy) return;
        setBusy(true); setNotice(null);
        try {
            const updated = await operation();
            setItem(updated);
            if (!preserveDraft) setResponse(updated.authoritativeResponse || "");
            setReasonAction(null); setReason("");
            await refresh(preserveDraft);
            setNotice({ kind: "ok", text: success });
        } catch (error) {
            if (error instanceof AuthoritativeWorkItemConflictError) {
                const draft = response;
                await refresh(true).catch(() => undefined);
                setResponse(draft);
            }
            setNotice({ kind: "error", text: error instanceof Error ? error.message : "The action could not be completed" });
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

    const actionButtons = useMemo(() => [
        capabilities.canAccept && ["Accept Work", () => setConfirmation("accept")],
        capabilities.canBlock && ["Mark Blocked", () => { setReasonAction("block"); setReason(""); }],
        capabilities.canClarify && ["Request Clarification", () => { setReasonAction("clarify"); setReason(""); }],
        capabilities.canMarkNotApplicable && ["Propose Not Applicable", () => { setReasonAction("not-applicable"); setReason(""); }],
        capabilities.canMarkDuplicate && ["Propose Duplicate", () => { setReasonAction("duplicate"); setReason(""); }],
        capabilities.canMarkNotMine && ["Not Mine", () => { setReasonAction("not-mine"); setReason(""); }],
        capabilities.canSubmitForDdReview && ["Submit for DD Review", () => setConfirmation("submit")],
        capabilities.canResolveClarification && ["Resolve Clarification", () => { setReasonAction("resolve"); setReason(""); }],
        capabilities.canUnblock && ["Resume Work", () => { setReasonAction("unblock"); setReason(""); }],
        capabilities.canReviewDisposition && ["Approve Disposition", () => run(() => approveAuthoritativeDisposition(item.id), "Disposition approved.")],
        capabilities.canReviewDisposition && ["Return Disposition", () => { setReasonAction("return-disposition"); setReason(""); }],
        capabilities.canReturnFromDdReview && !capabilities.canReviewDisposition && ["Return to Contributor", () => { setReasonAction("return-review"); setReason(""); }],
        capabilities.canMarkReadyToPublish && !capabilities.canReviewDisposition && ["Mark Ready to Publish", () => run(() => markAuthoritativeWorkItemReadyToPublish(item.id), "Marked Ready to Publish.")],
    ].filter(Boolean) as [string, () => void][], [capabilities, item.id, busy]);

    return <div className="rc-page" style={{ maxWidth: 1120 }} data-testid="authoritative-recap-workspace">
        <RecapSubNav />
        <button className="rc-btn rc-btn-ghost" onClick={() => navigate(backPath)}>← {backLabel}</button>
        {currentIdentity?.userRecord && <div style={{ color: "#64748b", fontSize: 12 }}>Working as <strong>{currentIdentity.userRecord.displayName || currentIdentity.userRecord.email}</strong></div>}
        <section className="rc-card" style={{ padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
                <div><div style={{ color: "#64748b", fontSize: 12 }}>{item.requestId}</div><h1 style={{ margin: "4px 0" }}>{item.title}</h1><div>{item.transactionName}</div></div>
                <div><strong data-testid="authoritative-status">{item.status}</strong><div style={{ color: "#64748b", marginTop: 4 }}>Owner: <strong>{item.owner || "Unassigned"}</strong></div></div>
            </div>
            {item.authoritativeActiveReason && <div className="rc-alert rc-alert-warning" style={{ marginTop: 16 }}><strong>{item.authoritativeActiveReasonType}:</strong> {item.authoritativeActiveReason}</div>}
            {item.authoritativeProposedDisposition && <div className="rc-alert rc-alert-info" style={{ marginTop: 16 }}><strong>Proposed {item.authoritativeProposedDisposition}:</strong> {item.authoritativeDispositionReason}</div>}
            {notice && <div role={notice.kind === "error" ? "alert" : "status"} style={{ marginTop: 16, color: notice.kind === "error" ? "#b91c1c" : "#166534" }}>{notice.text}</div>}
        </section>

        {actionButtons.length > 0 && <section className="rc-card" style={{ padding: 20 }}><h2>Available actions</h2><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{actionButtons.map(([label, action]) => <button key={label} disabled={busy} className="rc-btn rc-btn-primary" onClick={action}>{label}</button>)}</div></section>}
        {reasonAction && <section className="rc-card" style={{ padding: 20 }}><h2>Reason or resolution</h2><textarea aria-label="Reason or resolution" rows={4} value={reason} onChange={event => setReason(event.target.value)} style={{ width: "100%" }} />{reason.length > 2000 && <div role="alert" style={{ color: "#b91c1c" }}>Reason must be 2,000 characters or fewer.</div>}<div style={{ display: "flex", gap: 8, marginTop: 10 }}><button className="rc-btn rc-btn-primary" disabled={busy || !reason.trim() || reason.length > 2000} onClick={submitReason}>Confirm</button><button className="rc-btn rc-btn-ghost" onClick={() => setReasonAction(null)}>Cancel</button></div></section>}

        <section className="rc-card" style={{ padding: 20 }}><h2>DD response</h2><textarea aria-label="DD response" rows={10} value={response} disabled={!capabilities.canUpdateResponse} onChange={event => setResponse(event.target.value)} style={{ width: "100%" }} />{response.length > 100000 && <div role="alert" style={{ color: "#b91c1c" }}>Response must be 100,000 characters or fewer. Nothing has been truncated or saved.</div>}<div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}><span style={{ color: "#64748b", fontSize: 12 }}>{response.length.toLocaleString()} / 100,000 characters</span>{capabilities.canUpdateResponse && <button className="rc-btn rc-btn-primary" disabled={busy || !response.trim() || response.length > 100000} onClick={() => void run(() => updateAuthoritativeResponse(item.id, response), "Response saved.", false)}>Save response</button>}</div>{item.authoritativeResponse && <div style={{ color: "#64748b", fontSize: 12, marginTop: 8 }}>Saved in the authoritative workspace.</div>}</section>

        <section className="rc-card" style={{ padding: 20 }}><h2>Work Notes</h2>{capabilities.canAddWorkNote && <div><textarea aria-label="New work note" rows={3} value={noteText} onChange={event => setNoteText(event.target.value)} style={{ width: "100%" }} />{noteText.length > 4000 && <div role="alert" style={{ color: "#b91c1c" }}>Work note must be 4,000 characters or fewer.</div>}<button className="rc-btn rc-btn-primary" disabled={busy || !noteText.trim() || noteText.length > 4000} onClick={async () => { setBusy(true); try { await addAuthoritativeWorkNote(item.id, noteText.trim()); setNoteText(""); await refresh(true); setNotice({ kind: "ok", text: "Work note added." }); } catch (error) { setNotice({ kind: "error", text: error instanceof Error ? error.message : "Unable to add work note" }); } finally { setBusy(false); } }}>Add note</button></div>}{notes.length === 0 ? <p>No work notes recorded.</p> : <div>{notes.map(note => <article key={note.id} style={{ borderTop: "1px solid #e2e8f0", padding: "12px 0" }}><div><strong>{note.authorName || note.authorUserId}</strong> · {dateTime(note.createdAt)}{note.noteType !== "Work Note" ? ` · ${note.noteType}` : ""}</div><div style={{ marginTop: 4, whiteSpace: "pre-wrap" }}>{note.noteText}</div></article>)}</div>}</section>

        <section className="rc-card" style={{ padding: 20 }}><h2>Activity</h2>{events.length === 0 ? <p>No authoritative workflow activity has been recorded yet.</p> : events.map(event => <article key={event.id} style={{ borderTop: "1px solid #e2e8f0", padding: "12px 0" }}><div><strong>{EVENT_LABELS[event.eventType] || event.eventType}</strong> · {event.actorName || event.actorUserId} · {dateTime(event.occurredAt)}</div>{eventDetails(event) && <div style={{ marginTop: 4, color: "#475569" }}>{eventDetails(event)}</div>}</article>)}</section>

        <section className="rc-card" style={{ padding: 20 }}><h2>Artifacts</h2>{sources.map(source => <div key={source.id} style={{ marginBottom: 8 }}>Source: <span>{source.fileName}</span> <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => void downloadAuthoritativeSourceDocument(item.id, source.id, source.fileName)}>Download source</button></div>)}{artifacts.map(artifact => <div key={artifact.id} style={{ marginBottom: 8 }}><span>{artifact.fileName}</span> <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => void downloadAuthoritativeArtifact(item.id, artifact.id, artifact.fileName)}>Download</button></div>)}{uploadingName && <div role="status" className="rc-artifact-upload-progress">Uploading to SharePoint… {uploadingName}</div>}{capabilities.canUploadArtifact && <label className="rc-btn rc-btn-ghost" style={{ display: "inline-block" }}>Upload Artifact<input id="artifact-upload-hidden" hidden type="file" onChange={async event => { const file = event.target.files?.[0]; if (!file) return; setUploadingName(file.name); setBusy(true); try { await uploadAuthoritativeArtifact(item.id, file); await refresh(true); setNotice({ kind: "ok", text: `${file.name} uploaded successfully.` }); } catch (error) { setNotice({ kind: "error", text: error instanceof Error ? error.message : "Upload failed" }); } finally { setBusy(false); setUploadingName(null); event.target.value = ""; } }} /></label>}</section>
        {confirmation && <div className="rc-modal-overlay" role="dialog" aria-modal="true" aria-label={confirmation === "accept" ? "Accept Work?" : "Submit for DD Review?"}>
            <div className="rc-modal" style={{ maxWidth: 480 }}><div className="rc-modal-header"><h2>{confirmation === "accept" ? "Accept Work?" : "Submit for DD Review?"}</h2></div><div className="rc-modal-body"><strong>{item.requestId}</strong> — {item.title}<p>{confirmation === "accept" ? "This moves the request to In Progress." : "DD Operations will review the authoritative response, notes, history, and artifacts."}</p></div><div className="rc-modal-footer"><button className="rc-btn rc-btn-ghost" onClick={() => setConfirmation(null)}>Cancel</button><button className="rc-btn rc-btn-primary" disabled={busy} onClick={() => { const selected = confirmation; setConfirmation(null); void run(selected === "accept" ? () => acceptAuthoritativeWorkItem(item.id) : () => submitAuthoritativeWorkItemForDdReview(item.id), selected === "accept" ? "Work accepted." : "Submitted for DD Operations review."); }}>{confirmation === "accept" ? "Accept Work" : "Submit for DD Review"}</button></div></div>
        </div>}
    </div>;
}

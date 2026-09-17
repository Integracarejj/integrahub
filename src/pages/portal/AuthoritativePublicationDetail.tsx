import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { previewTransport } from "../../services/portalAdminPreview";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { isExternalOnlyRole } from "../../utils/accessRouting";
import { portalSignInUrl, PORTAL_SESSION_RECOVERY_FAILED } from "../../services/portalSessionRecovery";
import {
    decideAuthoritativePublication,
    downloadAuthoritativePublishedArtifact,
    loadAuthoritativePublication,
    previewPublishedArtifactFrom,
    type AuthoritativePublication,
} from "../../services/portalPublicationPersistence";
import "./AuthoritativePublicationDetail.css";
import "./PortalOverview.css";

export default function AuthoritativePublicationDetail({ publicationId, previewOrganization }: { publicationId?: string; previewOrganization?: string }) {
    const { publicationId: routeId } = useParams();
    const { user } = useCurrentUser();
    return <Detail key={`${user?.userRecord?.id}:${previewOrganization || "external"}:${publicationId || routeId || ""}`} id={publicationId || routeId || ""} previewOrganization={previewOrganization} />;
}

function RequestTitle({ title }: { title: string }) {
    const heading = useRef<HTMLHeadingElement>(null);
    const [overflow, setOverflow] = useState(false);
    const [expanded, setExpanded] = useState(false);
    useLayoutEffect(() => {
        const measure = () => {
            const element = heading.current;
            if (!element) return;
            const wasExpanded = element.classList.contains("apd-title-expanded");
            element.classList.remove("apd-title-expanded");
            setOverflow(element.scrollHeight > element.clientHeight + 1);
            if (wasExpanded) element.classList.add("apd-title-expanded");
        };
        measure();
        window.addEventListener("resize", measure);
        return () => window.removeEventListener("resize", measure);
    }, [title]);
    return <div className="apd-title-wrap">
        <h1 ref={heading} id="apd-request-title" className={`po-welcome-title apd-title${expanded ? " apd-title-expanded" : ""}`}>{title}</h1>
        {overflow && <button type="button" className="apd-text-control" aria-expanded={expanded} aria-controls="apd-request-title" onClick={() => setExpanded(value => !value)}>{expanded ? "Show less" : "Show full request"}</button>}
    </div>;
}

function ResponseSection({ publication }: { publication: AuthoritativePublication }) {
    const hasResponse = !!publication.responseSnapshotAvailable && !!publication.responseContent?.trim();
    const [open, setOpen] = useState(hasResponse);
    return <section className="apd-response">
        <div className="apd-response-heading"><h2>IntegraCare Response</h2><span>{hasResponse ? "Response provided" : "No response provided"}</span></div>
        <button type="button" className="apd-response-toggle" aria-expanded={open} aria-controls="apd-response-content" onClick={() => setOpen(value => !value)}>{open ? "Hide response" : "Show response"}<span aria-hidden="true">{open ? "⌃" : "⌄"}</span></button>
        <div id="apd-response-content" className="apd-response-content" hidden={!open}>
            {publication.responseSnapshotAvailable
                ? <p className="apd-copy apd-findings">{publication.responseContent?.trim() ? publication.responseContent : "No response was included."}</p>
                : <div className="apd-legacy"><strong>Response not available</strong><p>This earlier request does not include a saved response. Please review the supporting documents below.</p></div>}
        </div>
    </section>;
}

function Detail({ id, previewOrganization }: { id: string; previewOrganization?: string }) {
    const { user } = useCurrentUser();
    const adminPreview = !!previewOrganization && user?.userRecord?.role === "PlatformAdmin";
    const external = !previewOrganization && isExternalOnlyRole(user?.userRecord?.role);
    const [publication, setPublication] = useState<AuthoritativePublication | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [changes, setChanges] = useState(false);
    const [preview, setPreview] = useState<{ url: string; contentType: string; fileName: string } | null>(null);
    const [guidance, setGuidance] = useState("");
    const [showReviewGuidance, setShowReviewGuidance] = useState(false);
    const [refresh, setRefresh] = useState(0);

    useEffect(() => {
        if (!external && !adminPreview) return;
        let cancelled = false;
        setLoading(true);
        setPublication(null);
        setError(null);
        setChanges(false);
        const load = adminPreview ? previewTransport(previewOrganization!).load(id) : loadAuthoritativePublication(id);
        load.then(value => !cancelled && setPublication(value))
            .catch(loadError => !cancelled && setError(loadError instanceof Error ? loadError.message : "Request could not be loaded"))
            .finally(() => !cancelled && setLoading(false));
        return () => { cancelled = true; };
    }, [id, previewOrganization, adminPreview, external, refresh]);

    useEffect(() => () => {
        if (preview) URL.revokeObjectURL(preview.url);
    }, [preview]);

    const closePreview = () => setPreview(null);

    async function decide(action: "approve" | "rework") {
        if (adminPreview || !publication || busy || publication.status !== "Published") return;
        setBusy(true);
        setError(null);
        try {
            await decideAuthoritativePublication(publication, action, action === "rework" ? guidance.trim() : undefined);
            setPublication(await loadAuthoritativePublication(id));
            setChanges(false);
            setGuidance("");
        } catch (decisionError) {
            // A lost POST response leaves the outcome unknown. Read the server's
            // current state before offering another decision; never replay it.
            if (decisionError instanceof TypeError) {
                setPublication(null);
                setLoading(true);
                try {
                    const current = await loadAuthoritativePublication(id);
                    setPublication(current);
                    if (current.status !== "Published") {
                        setChanges(false);
                        setGuidance("");
                    } else {
                        setError("We could not confirm your decision. Review the current request before submitting again.");
                    }
                } catch (refreshError) {
                    setError(refreshError instanceof Error ? refreshError.message : "Request could not be loaded");
                } finally {
                    setLoading(false);
                }
                return;
            }
            setError(decisionError instanceof Error ? decisionError.message : "Your decision could not be saved");
        } finally {
            setBusy(false);
        }
    }

    if (!external && !adminPreview) {
        return <div className="portal-overview"><h1>External account required</h1><p>Demo personas do not grant access to requests for review.</p></div>;
    }

    return <main className="portal-overview apd-page">
        {!adminPreview && <Link className="apd-back" to="/portal/requests"><span aria-hidden="true">←</span> Requests</Link>}
        {loading && <div className="apd-card" role="status">Loading request...</div>}
        {error && <div className="apd-error" role="alert"><strong>{error}</strong>{error === PORTAL_SESSION_RECOVERY_FAILED
            ? <a className="rc-btn rc-btn-ghost" href={portalSignInUrl()}>Sign in again</a>
            : <button className="rc-btn rc-btn-ghost" disabled={busy} onClick={() => setRefresh(value => value + 1)}>Refresh request</button>}</div>}
        {publication && <>
            <header className="apd-review-header">
                <div className="apd-header-top">
                    <p className="apd-meta">{publication.transactionName}<span aria-hidden="true">·</span>{publication.requestId}<span aria-hidden="true">·</span>Submitted {new Date(publication.publishedAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}</p>
                    <button type="button" className="apd-guidance-button" aria-label="What do I do next?" title="What do I do next?" aria-expanded={showReviewGuidance} aria-controls="apd-review-guidance" onClick={() => setShowReviewGuidance(value => !value)}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M9.6 9a2.5 2.5 0 0 1 4.8 1c0 1.7-2.4 2-2.4 3.7" /><path d="M12 17.5h.01" /></svg>What do I do next?</button>
                </div>
                <RequestTitle title={publication.title} />
                {showReviewGuidance && <p id="apd-review-guidance" className="apd-guidance">{adminPreview ? "Review the supporting documents. Partner decisions are unavailable in this read-only preview." : "Review the supporting documents. Approve the request if everything looks complete, or request changes if IntegraCare needs to update something."}</p>}
            </header>

            {publication.description && <section className="apd-description">
                <h2>About this request</h2>
                <p className="apd-copy">{publication.description}</p>
            </section>}

            <div className={`apd-review-grid${adminPreview || publication.status !== "Published" ? " apd-review-grid-single" : ""}`}>
            <section className="apd-content apd-documents-section">
                <h2>Supporting Documents</h2>
                {publication.artifacts.length
                    ? <div className="apd-documents">{publication.artifacts.map(artifact => <article className="apd-document" key={artifact.id}>
                        <div className="apd-document-main"><strong>{artifact.fileName}</strong><span>Supporting document</span></div>
                        <div className="apd-document-actions">
                            {/^application\/pdf$|^image\//i.test(artifact.contentType) && <button className="rc-btn rc-btn-secondary rc-btn-sm" disabled={busy} onClick={async () => {
                                setBusy(true);
                                setError(null);
                                try {
                                    const result = await (adminPreview
                                        ? previewTransport(previewOrganization!).preview(publication.id, artifact)
                                        : previewPublishedArtifactFrom(`/api/portal/recapitalization/publications/${publication.id}/artifacts/${artifact.id}/content`, artifact));
                                    setPreview({ ...result, fileName: artifact.fileName });
                                } catch (previewError) {
                                    setError(previewError instanceof Error ? previewError.message : "Preview failed");
                                } finally {
                                    setBusy(false);
                                }
                            }}>Preview</button>}
                            <button aria-label={`Download ${artifact.fileName}`} className="rc-btn rc-btn-secondary rc-btn-sm" disabled={busy} onClick={async () => {
                                setBusy(true);
                                setError(null);
                                try {
                                    await (adminPreview
                                        ? previewTransport(previewOrganization!).download(publication.id, artifact)
                                        : downloadAuthoritativePublishedArtifact(publication.id, artifact));
                                } catch (downloadError) {
                                    setError(downloadError instanceof Error ? downloadError.message : "Download failed");
                                } finally {
                                    setBusy(false);
                                }
                            }}>Download</button>
                        </div>
                    </article>)}</div>
                    : <p className="apd-muted">No documents are available.</p>}
            </section>

            {!adminPreview && publication.status === "Published" && <section className="apd-decision">
                <h2>Your Decision</h2>
                <p>Ready to complete your review?</p>
                <div className="apd-actions">
                    <button className="rc-btn rc-btn-primary" disabled={busy || changes} onClick={() => void decide("approve")}>Approve Request</button>
                    <button className="rc-btn rc-btn-secondary" disabled={busy} onClick={() => setChanges(true)}>Request Changes</button>
                </div>
            </section>}
            </div>

            {adminPreview
                ? <section className="apd-card apd-preview-note">Read-only admin preview. Partner decisions require a real authorized external account.</section>
                : publication.status !== "Published" && <section className="apd-card apd-complete"><strong>{publication.status === "Approved" ? "Review complete" : publication.workItemStatus === "In Progress" ? "IntegraCare is working on your requested changes" : "Changes requested"}</strong></section>}

            {publication.status === "Rework Requested" && <section className="apd-card apd-partner-comments"><strong>Your comments</strong><p>{publication.partnerGuidance || "Changes were requested."}</p><p>Requested {publication.partnerActionAt ? new Date(publication.partnerActionAt).toLocaleString() : "just now"}. Returned to IntegraCare for updates.</p></section>}

            <ResponseSection key={`${publication.id}:${publication.version}`} publication={publication} />

            {preview && <div className="rc-modal-overlay" role="dialog" aria-modal="true" aria-label={`Preview ${preview.fileName}`}>
                <div className="rc-modal apd-preview">
                    <div className="rc-modal-header"><h2>{preview.fileName}</h2><button className="rc-btn rc-btn-ghost" onClick={closePreview}>Close</button></div>
                    {preview.contentType === "application/pdf" ? <iframe title={preview.fileName} src={preview.url} /> : <img src={preview.url} alt={preview.fileName} />}
                </div>
            </div>}

            {changes && <div className="rc-modal-overlay" role="dialog" aria-modal="true" aria-label="Request Changes">
                <div className="rc-modal">
                    <div className="rc-modal-header"><h2>Request Changes</h2></div>
                    <div className="rc-modal-body"><p>Tell the contributor what needs to change.</p><label className="rc-modal-field">Comments<textarea aria-label="Rework guidance" rows={4} maxLength={2000} value={guidance} onChange={event => setGuidance(event.target.value)} /></label></div>
                    <div className="rc-modal-footer"><button className="rc-btn rc-btn-ghost" disabled={busy} onClick={() => setChanges(false)}>Cancel</button><button className="rc-btn rc-btn-primary" disabled={busy || !guidance.trim()} onClick={() => void decide("rework")}>Request Changes</button></div>
                </div>
            </div>}
        </>}
    </main>;
}

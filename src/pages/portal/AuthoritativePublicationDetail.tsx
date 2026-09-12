import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { isExternalOnlyRole } from "../../utils/accessRouting";
import { decideAuthoritativePublication, downloadAuthoritativePublishedArtifact, loadAuthoritativePublication,
    type AuthoritativePublication } from "../../services/portalPublicationPersistence";

export default function AuthoritativePublicationDetail({ publicationId }: { publicationId?: string }) {
    const params = useParams();
    const { user } = useCurrentUser();
    const id = publicationId || params.publicationId || "";
    // Remount edition state when identity or route changes, including in-flight decisions.
    return <PublicationDetail key={`${user?.userRecord?.id}:${user?.userRecord?.role}:${id}`} publicationId={id} />;
}

function PublicationDetail({ publicationId }: { publicationId: string }) {
    const params = useParams();
    const id = publicationId || params.publicationId || "";
    const { user } = useCurrentUser();
    const external = isExternalOnlyRole(user?.userRecord?.role);
    const [publication, setPublication] = useState<AuthoritativePublication | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [rework, setRework] = useState(false);
    const [guidance, setGuidance] = useState("");
    const [refresh, setRefresh] = useState(0);
    useEffect(() => {
        if (!external) return;
        let cancelled = false;
        setLoading(true); setPublication(null); setError(null); setRework(false);
        loadAuthoritativePublication(id).then(value => { if (!cancelled) setPublication(value); })
            .catch(reason => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Publication could not be loaded"); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [id, external, refresh]);

    async function decide(action: "approve" | "rework") {
        if (!publication || busy || publication.status !== "Published") return;
        setBusy(true); setError(null);
        try {
            await decideAuthoritativePublication(publication, action, action === "rework" ? guidance.trim() : undefined);
            // Read the edition again so status/version and content remain server-owned.
            setPublication(await loadAuthoritativePublication(id));
            setRework(false); setGuidance("");
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "Partner decision failed");
        } finally { setBusy(false); }
    }

    if (!external) return <div className="portal-overview"><h1>External account required</h1>
        <p>Demo personas do not grant access to published requests. Sign in with an external account authorized for the target organization.</p></div>;
    return <div className="portal-overview">
        <Link to="/portal/requests">Back to Requests</Link>
        {loading && <p role="status">Loading published request...</p>}
        {error && <div role="alert"><p>{error}</p><button className="rc-btn rc-btn-ghost" disabled={busy} onClick={() => setRefresh(value => value + 1)}>Refresh publication</button></div>}
        {publication && <>
            <h1 className="po-welcome-title">{publication.requestId} — {publication.title}</h1>
            <p>{publication.transactionName} · {publication.externalOrganizationId} · Publication {publication.publicationNumber}</p>
            <p role="status">{publication.status === "Published" ? "Awaiting Your Review" : publication.status === "Approved" ? "Approved — Complete" : "Rework requested — awaiting a new publication"}</p>
            <p>Published: {new Date(publication.publishedAt).toLocaleString()}</p>
            <p>{publication.description}</p>
            {!publication.responseSnapshotAvailable && <p>Legacy edition: request and project labels reflect current metadata.</p>}
            <h2>Published response / findings</h2>
            <p style={{ whiteSpace: "pre-wrap" }}>{publication.responseSnapshotAvailable
                ? publication.responseContent || "No response was included in this edition."
                : "A response snapshot was not recorded for this edition. Current draft findings are not shown."}</p>
            <h2>Published documents — Publication {publication.publicationNumber}</h2>
            {publication.artifacts.length === 0 ? <p>No documents were included in this edition.</p> : <ul>
                {publication.artifacts.map(artifact => <li key={artifact.id}>{artifact.fileName} {" "}
                    <button className="rc-btn rc-btn-ghost" disabled={busy} onClick={async () => {
                        setBusy(true); setError(null);
                        try { await downloadAuthoritativePublishedArtifact(publication.id, artifact); }
                        catch (reason) { setError(reason instanceof Error ? reason.message : "Download failed"); }
                        finally { setBusy(false); }
                    }}>Download {artifact.fileName}</button></li>)}
            </ul>}
            {publication.partnerGuidance && <p style={{ whiteSpace: "pre-wrap" }}>Rework guidance: {publication.partnerGuidance}</p>}
            {publication.status === "Published" && <div>
                <button className="rc-btn rc-btn-primary" disabled={busy || rework} onClick={() => void decide("approve")}>Approve</button>{" "}
                <button className="rc-btn rc-btn-ghost" disabled={busy} onClick={() => setRework(true)}>Request Rework</button>
            </div>}
            {rework && <div className="rc-modal-overlay" role="dialog" aria-modal="true" aria-label="Request Rework?">
                <div className="rc-modal"><h2>Request Rework?</h2><p>The request returns to its contributor for revision before DD review and a new publication.</p>
                    <label>Rework guidance<textarea aria-label="Rework guidance" value={guidance} maxLength={2000} onChange={event => setGuidance(event.target.value)} /></label>
                    <button className="rc-btn rc-btn-ghost" disabled={busy} onClick={() => setRework(false)}>Cancel</button>
                    <button className="rc-btn rc-btn-primary" disabled={busy || !guidance.trim()} onClick={() => void decide("rework")}>Request Rework</button>
                </div>
            </div>}
        </>}
    </div>;
}

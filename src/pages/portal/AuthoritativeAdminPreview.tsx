import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { loadPreviewOrganizations, loadPreviewPublications } from "../../services/portalAdminPreview";
import type { AuthoritativePublication } from "../../services/portalPublicationPersistence";
import AuthoritativePublicationDetail from "./AuthoritativePublicationDetail";

export default function AuthoritativeAdminPreview() {
    const { user } = useCurrentUser();
    if (user?.userRecord?.role !== "PlatformAdmin") return <p role="alert">PlatformAdmin required.</p>;
    return <Preview key={user.userRecord.id} />;
}

export function AuthoritativeAdminPreviewDetail() {
    const { organizationId, publicationId } = useParams();
    const { user } = useCurrentUser();
    if (user?.userRecord?.role !== "PlatformAdmin") return <p role="alert">PlatformAdmin required.</p>;
    if (!organizationId || !publicationId) return <p role="alert">Preview publication is unavailable.</p>;
    return <main className="portal-overview"><p><Link to="/portal/admin-preview">Back to organization selection</Link></p><p>Authoritative External Preview — read-only</p>
        <AuthoritativePublicationDetail publicationId={publicationId} previewOrganization={organizationId} />
    </main>;
}

function Preview() {
    const [organizations, setOrganizations] = useState<Array<{ id: string }>>([]);
    const [organization, setOrganization] = useState("");
    const [error, setError] = useState("");
    useEffect(() => {
        let cancelled = false;
        loadPreviewOrganizations().then(rows => { if (!cancelled) setOrganizations(rows); })
            .catch(reason => { if (!cancelled) setError(reason.message); });
        return () => { cancelled = true; };
    }, []);
    return <main className="portal-overview">
        <h1>Authoritative External Preview</h1>
        <p>Read-only production publication data. You remain signed in as PlatformAdmin.</p>
        {error && <p role="alert">{error}</p>}
        <label>Preview organization <select value={organization} onChange={event => setOrganization(event.target.value)}>
            <option value="">Select an organization</option>
            {organizations.map(org => <option key={org.id} value={org.id}>{org.id}</option>)}
        </select></label>
        {organization && <OrganizationPublications key={organization} organization={organization} />}
    </main>;
}

function OrganizationPublications({ organization }: { organization: string }) {
    const navigate = useNavigate();
    const [publications, setPublications] = useState<AuthoritativePublication[]>([]);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        let cancelled = false;
        loadPreviewPublications(organization).then(rows => { if (!cancelled) setPublications(rows); })
            .catch(reason => { if (!cancelled) { setPublications([]); setError(reason.message); } })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [organization]);
    return <section>
        <h2>{organization}</h2>
        {loading && <p role="status">Loading publications...</p>}
        {error && <p role="alert">{error}</p>}
        {!loading && !error && publications.length === 0 && <p>No published editions for this organization.</p>}
        {publications.map(publication => <p key={publication.id}><button className="rc-btn rc-btn-ghost" onClick={() => navigate(`/portal/admin-preview/${encodeURIComponent(organization)}/publications/${encodeURIComponent(publication.id)}`)}>
            Open {publication.requestId} · {publication.transactionName} · Publication {publication.publicationNumber}
        </button></p>)}
    </section>;
}

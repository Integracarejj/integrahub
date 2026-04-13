import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import "./CapabilityDetailPage.css";

interface CapabilityApplication {
    id: string;
    name: string;
    status: string;
    businessOwner: string;
}

interface ApiCapability {
    id: string;
    name: string;
    applications: CapabilityApplication[];
}

export default function CapabilityDetailPage() {
    const { id } = useParams<{ id: string }>();

    const [capability, setCapability] = useState<ApiCapability | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {
        let mounted = true;

        (async () => {
            try {
                const res = await fetch(`/api/capabilities/${id}`);
                if (!res.ok) {
                    if (res.status === 404) {
                        setNotFound(true);
                    } else {
                        throw new Error(`Failed to load capability: ${res.status}`);
                    }
                    return;
                }
                const data: ApiCapability = await res.json();
                if (mounted) {
                    setCapability(data);
                }
            } catch (err) {
                if (mounted) {
                    setLoadError(err instanceof Error ? err.message : "Failed to load capability");
                }
            } finally {
                if (mounted) setLoading(false);
            }
        })();

        return () => {
            mounted = false;
        };
    }, [id]);

    if (loading) return <p>Loading capability...</p>;
    if (loadError) return <p>Failed to load capability.</p>;
    if (notFound) return <p>Capability not found.</p>;
    if (!capability) return <p>Capability not found.</p>;

    return (
        <div className="capability-detail-page">
            <header className="detail-header">
                <h1>{capability.name}</h1>
            </header>

            <section className="detail-section">
                <h2 className="detail-section-title">Applications</h2>
                {!capability.applications || capability.applications.length === 0 ? (
                    <p className="detail-empty">No applications assigned to this capability.</p>
                ) : (
                    <table className="detail-relationships-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Status</th>
                                <th>Business Owner</th>
                            </tr>
                        </thead>
                        <tbody>
                            {capability.applications.map((app) => (
                                <tr key={app.id}>
                                    <td>
                                        <Link to={`/applications/${app.id}`}>
                                            {app.name}
                                        </Link>
                                    </td>
                                    <td>{app.status}</td>
                                    <td>{app.businessOwner || "—"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </section>
        </div>
    );
}

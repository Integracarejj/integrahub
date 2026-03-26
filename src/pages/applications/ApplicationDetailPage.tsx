import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getApplications } from "../../services/applicationService";
import { getIntegrationViews } from "../../services/integrationService";
import type { Application } from "../../types/application";
import type { IntegrationView } from "../../types/integration";
import "./ApplicationDetailPage.css";

type RouteParams = {
    applicationId?: string;
    id?: string; // fallback safety
};

export default function ApplicationDetailPage() {
    const { applicationId, id } = useParams<RouteParams>();
    const appId = applicationId ?? id;

    const [application, setApplication] = useState<Application | null>(null);
    const [integrations, setIntegrations] = useState<IntegrationView[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        (async () => {
            try {
                const apps = await getApplications();
                const app = apps.find((a) => a.id === appId) ?? null;

                const allIntegrations = await getIntegrationViews();

                if (mounted) {
                    setApplication(app);
                    setIntegrations(allIntegrations);
                }
            } finally {
                if (mounted) setLoading(false);
            }
        })();

        return () => {
            mounted = false;
        };
    }, [appId]);

    const outboundIntegrations = useMemo(
        () =>
            integrations.filter(
                (i) => i.fromApplicationId === application?.id
            ),
        [integrations, application]
    );

    const inboundIntegrations = useMemo(
        () =>
            integrations.filter(
                (i) => i.toApplicationId === application?.id
            ),
        [integrations, application]
    );

    if (loading) return <p>Loading…</p>;
    if (!application) return <p>Application not found.</p>;

    return (
        <div className="application-detail-page">
            <header className="application-header">
                <h1>{application.name}</h1>
                <span className={`status ${application.status.toLowerCase()}`}>
                    {application.status}
                </span>
            </header>

            <section className="application-meta">
                <div>
                    <strong>Capability</strong>
                    <div>{application.capabilityId}</div>
                </div>
                <div>
                    <strong>Owner</strong>
                    <div>{application.owner}</div>
                </div>
                <div>
                    <strong>Type</strong>
                    <div>{application.type}</div>
                </div>
            </section>

            <section className="application-description">
                <p>{application.description}</p>
            </section>

            <section className="application-integrations">
                <h2>Integrations</h2>

                <div className="integration-group">
                    <h3>Outbound</h3>
                    {outboundIntegrations.length === 0 ? (
                        <p className="empty">No outbound integrations.</p>
                    ) : (
                        <table>
                            <thead>
                                <tr>
                                    <th>To</th>
                                    <th>Type</th>
                                    <th>Status</th>
                                    <th>Description</th>
                                </tr>
                            </thead>
                            <tbody>
                                {outboundIntegrations.map((i) => (
                                    <tr key={i.id}>
                                        <td>
                                            <Link to={`/applications/${i.toApplicationId}`}>
                                                {i.toApplicationName}
                                            </Link>
                                        </td>
                                        <td>{i.integrationType}</td>
                                        <td>{i.status}</td>
                                        <td>{i.description ?? "—"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="integration-group">
                    <h3>Inbound</h3>
                    {inboundIntegrations.length === 0 ? (
                        <p className="empty">No inbound integrations.</p>
                    ) : (
                        <table>
                            <thead>
                                <tr>
                                    <th>From</th>
                                    <th>Type</th>
                                    <th>Status</th>
                                    <th>Description</th>
                                </tr>
                            </thead>
                            <tbody>
                                {inboundIntegrations.map((i) => (
                                    <tr key={i.id}>
                                        <td>
                                            <Link to={`/applications/${i.fromApplicationId}`}>
                                                {i.fromApplicationName}
                                            </Link>
                                        </td>
                                        <td>{i.integrationType}</td>
                                        <td>{i.status}</td>
                                        <td>{i.description ?? "—"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </section>
        </div>
    );
}
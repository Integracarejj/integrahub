import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import "./ApplicationDetailPage.css";

type RouteParams = {
    applicationId?: string;
    id?: string;
};

interface ApiIntegration {
    id: string;
    targetApplicationId?: string;
    targetApplicationName?: string;
    sourceApplicationId?: string;
    sourceApplicationName?: string;
    integrationType: string;
    notes: string | null;
}

interface ApiApplication {
    id: string;
    name: string;
    type?: string;
    description?: string;
    purpose?: string;
    vendor?: string;
    capabilityId: string;
    capabilityName: string;
    status: string;
    businessContext: {
        purpose?: string;
        businessCriticality: string;
        impactIfDown: string;
    };
    ownership: {
        businessOwner: string;
    };
    integrations: ApiIntegration[];
    inboundIntegrations: ApiIntegration[];
}

interface ApplicationOption {
    id: string;
    name: string;
}

export default function ApplicationDetailPage() {
    const { applicationId, id } = useParams<RouteParams>();
    const appId = applicationId ?? id;

    const [application, setApplication] = useState<ApiApplication | null>(null);
    const [applications, setApplications] = useState<ApplicationOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [notFound, setNotFound] = useState(false);
    const [showAddIntegration, setShowAddIntegration] = useState(false);
    const [adding, setAdding] = useState(false);
    const [newIntegration, setNewIntegration] = useState({ connectedAppId: "", direction: "", integrationType: "", notes: "" });

    const INTEGRATION_TYPES = ["API", "File Transfer", "SSO", "Manual Import", "Webhook", "Database Sync", "Other"];
    const DIRECTION_OPTIONS = [
        { value: "from", label: "From this application" },
        { value: "into", label: "Into this application" },
        { value: "both", label: "Bidirectional" },
    ];

    useEffect(() => {
        let mounted = true;

        (async () => {
            try {
                const res = await fetch(`/api/applications/${appId}`);
                if (!res.ok) {
                    if (res.status === 404) {
                        setNotFound(true);
                    } else {
                        throw new Error(`Failed to load application: ${res.status}`);
                    }
                    return;
                }
                const data: ApiApplication = await res.json();
                if (mounted) {
                    setApplication(data);
                }
            } catch (err) {
                if (mounted) {
                    setLoadError(err instanceof Error ? err.message : "Failed to load application");
                }
            } finally {
                if (mounted) setLoading(false);
            }
        })();

        return () => {
            mounted = false;
        };
    }, [appId]);

    useEffect(() => {
        fetch("/api/applications")
            .then((res) => res.json())
            .then((data) => setApplications(data))
            .catch(() => setApplications([]));
    }, []);

    async function handleAddIntegration() {
        if (!newIntegration.connectedAppId || !newIntegration.direction) {
            return;
        }

        setAdding(true);
        try {
            if (newIntegration.direction === "both") {
                await fetch("/api/integrations", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        sourceApplicationId: appId,
                        targetApplicationId: newIntegration.connectedAppId,
                        integrationType: newIntegration.integrationType,
                        notes: newIntegration.notes,
                    }),
                });
                await fetch("/api/integrations", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        sourceApplicationId: newIntegration.connectedAppId,
                        targetApplicationId: appId,
                        integrationType: newIntegration.integrationType,
                        notes: newIntegration.notes,
                    }),
                });
            } else if (newIntegration.direction === "from") {
                await fetch("/api/integrations", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        sourceApplicationId: appId,
                        targetApplicationId: newIntegration.connectedAppId,
                        integrationType: newIntegration.integrationType,
                        notes: newIntegration.notes,
                    }),
                });
            } else {
                await fetch("/api/integrations", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        sourceApplicationId: newIntegration.connectedAppId,
                        targetApplicationId: appId,
                        integrationType: newIntegration.integrationType,
                        notes: newIntegration.notes,
                    }),
                });
            }

            const updated = await fetch(`/api/applications/${appId}`).then((r) => r.json());
            setApplication(updated);
            setShowAddIntegration(false);
            setNewIntegration({ connectedAppId: "", direction: "", integrationType: "", notes: "" });
        } catch (err) {
            setLoadError("Failed to add integration");
        } finally {
            setAdding(false);
        }
    }

    if (loading) return <p>Loading application...</p>;
    if (loadError) return <p>Failed to load application.</p>;
    if (notFound) return <p>Application not found.</p>;
    if (!application) return <p>Application not found.</p>;

    return (
        <div className="application-detail-page">
            <header className="detail-header">
                <div className="detail-header-row">
                    <div className="detail-header-top">
                        <h1>{application.name}</h1>
                        <span className="detail-status">{application.status}</span>
                    </div>
                    <Link to={`/applications/${appId}/edit`} className="detail-edit-btn">Edit</Link>
                </div>
            </header>

            <section className="detail-section">
                <h2 className="detail-section-title">Overview</h2>
                <dl className="detail-definition-list">
                    <div className="detail-definition-item">
                        <dt>Type</dt>
                        <dd>{application.type || "—"}</dd>
                    </div>
                    <div className="detail-definition-item">
                        <dt>Description</dt>
                        <dd>{application.description || "—"}</dd>
                    </div>
                    <div className="detail-definition-item">
                        <dt>Purpose</dt>
                        <dd>{(application.purpose ?? application.businessContext.purpose) || "—"}</dd>
                    </div>
                    <div className="detail-definition-item">
                        <dt>Vendor</dt>
                        <dd>{application.vendor || "—"}</dd>
                    </div>
                    <div className="detail-definition-item">
                        <dt>Capability</dt>
                        <dd>{application.capabilityName}</dd>
                    </div>
                </dl>
            </section>

            <section className="detail-section">
                <h2 className="detail-section-title">Ownership</h2>
                <dl className="detail-definition-list">
                    <div className="detail-definition-item">
                        <dt>Business Owner</dt>
                        <dd>{application.ownership.businessOwner || "—"}</dd>
                    </div>
                </dl>
            </section>

            <section className="detail-section">
                <h2 className="detail-section-title">Business Context</h2>
                <dl className="detail-definition-list">
                    <div className="detail-definition-item">
                        <dt>Business Criticality</dt>
                        <dd>{application.businessContext.businessCriticality}</dd>
                    </div>
                    <div className="detail-definition-item">
                        <dt>Impact If Down</dt>
                        <dd>{application.businessContext.impactIfDown || "—"}</dd>
                    </div>
                </dl>
            </section>

            <section className="detail-section">
                <h2 className="detail-section-title">Integrations</h2>
                <button className="primary-action-btn" onClick={() => setShowAddIntegration(!showAddIntegration)}>
                    {showAddIntegration ? "Cancel" : "+ Add Integration"}
                </button>

                {showAddIntegration && (
                    <div className="add-integration-modal">
                        <div className="form-group">
                            <label>Connected Application</label>
                            <select
                                value={newIntegration.connectedAppId}
                                onChange={(e) => setNewIntegration({ ...newIntegration, connectedAppId: e.target.value })}
                            >
                                <option value="">Select Application</option>
                                {applications
                                    .filter((a) => a.id !== appId)
                                    .map((a) => (
                                        <option key={a.id} value={a.id}>
                                            {a.name}
                                        </option>
                                    ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Direction</label>
                            <select
                                value={newIntegration.direction}
                                onChange={(e) => setNewIntegration({ ...newIntegration, direction: e.target.value })}
                            >
                                <option value="">Select Direction</option>
                                {DIRECTION_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Integration Type (optional)</label>
                            <select
                                value={newIntegration.integrationType}
                                onChange={(e) => setNewIntegration({ ...newIntegration, integrationType: e.target.value })}
                            >
                                <option value="">Select Type</option>
                                {INTEGRATION_TYPES.map((type) => (
                                    <option key={type} value={type}>
                                        {type}
                                    </option>
                                ))}
                            </select>
                            <span className="field-helper">e.g. API, SSO, File Transfer</span>
                        </div>
                        <div className="form-group full-width">
                            <label>Notes (optional)</label>
                            <input
                                type="text"
                                placeholder="Add notes..."
                                value={newIntegration.notes}
                                onChange={(e) => setNewIntegration({ ...newIntegration, notes: e.target.value })}
                            />
                        </div>
                        <div className="form-actions">
                            <button className="detail-btn primary" onClick={handleAddIntegration} disabled={adding}>
                                {adding ? "Adding..." : "Add Integration"}
                            </button>
                        </div>
                    </div>
                )}

                {(() => {
                    const outbound = application.integrations || [];
                    const inbound = application.inboundIntegrations || [];
                    
                    const outboundMap = new Map(outbound.map(i => [i.targetApplicationId, i]));
                    const inboundMap = new Map(inbound.map(i => [i.sourceApplicationId, i]));
                    
                    const allAppIds = new Set([...outboundMap.keys(), ...inboundMap.keys()]);
                    
                    const displayIntegrations = Array.from(allAppIds).map(appId => {
                        const out = outboundMap.get(appId);
                        const inb = inboundMap.get(appId);
                        
                        const name = out?.targetApplicationName || inb?.sourceApplicationName || "Unknown";
                        const type = out?.integrationType || inb?.integrationType || "";
                        const notes = out?.notes || inb?.notes || "";
                        
                        let direction = "Outbound";
                        if (out && inb) {
                            direction = "Bidirectional";
                        } else if (inb) {
                            direction = "Inbound";
                        }
                        
                        return {
                            id: out?.id || inb?.id,
                            appId,
                            name,
                            direction,
                            type,
                            notes,
                        };
                    }).sort((a, b) => a.name.localeCompare(b.name));

                    return (
                        <div className="integrations-list">
                            {displayIntegrations.length === 0 ? (
                                <p className="detail-empty">None</p>
                            ) : (
                                <table className="detail-relationships-table">
                                    <thead>
                                        <tr>
                                            <th>Connected Application</th>
                                            <th>Direction</th>
                                            <th>Type</th>
                                            <th>Notes</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {displayIntegrations.map((i) => (
                                            <tr key={i.id}>
                                                <td>
                                                    <Link to={`/applications/${i.appId}`}>
                                                        {i.name}
                                                    </Link>
                                                </td>
                                                <td>{i.direction}</td>
                                                <td>{i.type || "—"}</td>
                                                <td>{i.notes || "—"}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    );
                })()}
            </section>
        </div>
    );
}

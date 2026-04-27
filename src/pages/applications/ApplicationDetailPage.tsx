import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getAuthHeaders } from "../../utils/authHeaders";
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
        technicalOwner?: string;
    };
    security: {
        websiteUrl: string;
        loginUrl: string;
        backupOwner: string;
        ssoSupported: string;
        ssoEnabled: string;
        mfaSupported: string;
        mfaEnabled: string;
        dataClassification: string;
    };
    userCountBand: string;
    lastReviewedAt: string;
    notes: string;
    integrations: ApiIntegration[];
    inboundIntegrations: ApiIntegration[];
}

interface ApplicationOption {
    id: string;
    name: string;
}

interface PermissionInfo {
    userId: string;
    globalRole: string;
    assignments: Array<{
        applicationId: string;
        role: string;
    }>;
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
    const [permissions, setPermissions] = useState<PermissionInfo | null>(null);
    const [users, setUsers] = useState<{ id: string; displayName: string }[]>([]);
    const [editingTechOwner, setEditingTechOwner] = useState(false);
    const [selectedTechOwner, setSelectedTechOwner] = useState("");
    const [savingTechOwner, setSavingTechOwner] = useState(false);
    const [techOwnerError, setTechOwnerError] = useState<string | null>(null);

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

    useEffect(() => {
        fetch("/api/admin/users", { headers: { "Content-Type": "application/json" } })
            .then((res) => res.ok ? res.json() : [])
            .then((data) => setUsers(data.filter((u: { isActive: boolean }) => u.isActive).map((u: { id: string; displayName: string }) => ({ id: u.id, displayName: u.displayName }))))
            .catch(() => setUsers([]));
    }, []);

    useEffect(() => {
        const devUserEmail = localStorage.getItem("devUserEmail");
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };
        if (devUserEmail) {
            headers["x-dev-user-email"] = devUserEmail;
        }
        fetch("/api/me/permissions", { headers })
            .then((res) => res.ok ? res.json() : null)
            .then((data) => {
                if (data) {
                    setPermissions({
                        userId: data.user?.id ?? "",
                        globalRole: data.permissions?.globalRole ?? "Viewer",
                        assignments: data.permissions?.assignments ?? [],
                    });
                }
            })
            .catch(() => setPermissions(null));
    }, []);

    // DEV ONLY: Listen for dev user changes
    useEffect(() => {
        const handleStorage = () => {
            const devUserEmail = localStorage.getItem("devUserEmail");
            const headers: Record<string, string> = {
                "Content-Type": "application/json",
            };
            if (devUserEmail) {
                headers["x-dev-user-email"] = devUserEmail;
            }
            fetch("/api/me/permissions", { headers })
                .then((res) => res.ok ? res.json() : null)
                .then((data) => {
                    if (data) {
                        setPermissions({
                            userId: data.user?.id ?? "",
                            globalRole: data.permissions?.globalRole ?? "Viewer",
                            assignments: data.permissions?.assignments ?? [],
                        });
                    }
                })
                .catch(() => setPermissions(null));
        };
        window.addEventListener("storage", handleStorage);
        return () => window.removeEventListener("storage", handleStorage);
    }, []);

    function canEditApp(): boolean {
        if (!permissions) return false;
        if (permissions.globalRole === "PlatformAdmin") return true;
        const appAssignment = permissions.assignments.find(
            (a) => a.applicationId === appId && (a.role === "AppOwner" || a.role === "AppAdmin")
        );
        return !!appAssignment;
    }

    async function handleSaveTechOwner() {
        if (!application) return;
        setSavingTechOwner(true);
        setTechOwnerError(null);
        try {
            const res = await fetch(`/api/applications/${application.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: application.name,
                    capabilityId: application.capabilityId,
                    status: application.status || "Active",
                    type: application.type || "Standard",
                    businessOwner: application.ownership.businessOwner || "",
                    businessCriticality: application.businessContext.businessCriticality || "Medium",
                    impactIfDown: application.businessContext.impactIfDown || "",
                    technicalOwner: selectedTechOwner,
                }),
            });
            if (res.ok) {
                setApplication((prev) =>
                    prev ? { ...prev, ownership: { ...prev.ownership, technicalOwner: selectedTechOwner } } : null
                );
                setEditingTechOwner(false);
                setSelectedTechOwner("");
            } else {
                const data = await res.json();
                setTechOwnerError(data.detail || data.error || "Failed to save");
            }
        } catch {
            setTechOwnerError("Failed to save");
        } finally {
            setSavingTechOwner(false);
        }
    }

    async function handleClearTechOwner() {
        if (!application || !window.confirm("Remove technical owner?")) return;
        setSavingTechOwner(true);
        setTechOwnerError(null);
        try {
            const res = await fetch(`/api/applications/${application.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: application.name,
                    capabilityId: application.capabilityId,
                    status: application.status || "Active",
                    type: application.type || "Standard",
                    businessOwner: application.ownership.businessOwner || "",
                    businessCriticality: application.businessContext.businessCriticality || "Medium",
                    impactIfDown: application.businessContext.impactIfDown || "",
                    technicalOwner: "",
                }),
            });
            if (res.ok) {
                setApplication((prev) =>
                    prev ? { ...prev, ownership: { ...prev.ownership, technicalOwner: "" } } : null
                );
            } else {
                const data = await res.json();
                setTechOwnerError(data.error || "Failed to clear");
            }
        } catch {
            setTechOwnerError("Failed to clear");
        } finally {
            setSavingTechOwner(false);
        }
    }

    async function handleAddIntegration() {
        if (!newIntegration.connectedAppId || !newIntegration.direction) {
            return;
        }

        setAdding(true);
        try {
            if (newIntegration.direction === "both") {
                await fetch("/api/integrations", {
                    method: "POST",
                    headers: getAuthHeaders(),
                    body: JSON.stringify({
                        sourceApplicationId: appId,
                        targetApplicationId: newIntegration.connectedAppId,
                        integrationType: newIntegration.integrationType,
                        notes: newIntegration.notes,
                    }),
                });
                await fetch("/api/integrations", {
                    method: "POST",
                    headers: getAuthHeaders(),
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
                    headers: getAuthHeaders(),
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
                    headers: getAuthHeaders(),
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

    const hasBusinessOwner = !!application.ownership.businessOwner;
    const hasTechnicalOwner = !!application.ownership.technicalOwner;
    const ownershipComplete = hasBusinessOwner && hasTechnicalOwner;
    const isCritical = application.businessContext.businessCriticality === "Critical";
    const missingOwners: string[] = [];
    if (!hasBusinessOwner) missingOwners.push("business owner");
    if (!hasTechnicalOwner) missingOwners.push("technical owner");
    const ownershipAlert = missingOwners.length > 0 && (isCritical || missingOwners.length === 2);

    return (
        <div className="application-detail-page">
            <header className="detail-header">
                <div className="detail-header-row">
                    <div className="detail-header-top">
                        <h1>{application.name}</h1>
                        <span className="detail-status">{application.status}</span>
                    </div>
                    {canEditApp() && (
                        <Link to={`/applications/${appId}/edit`} className="detail-edit-btn">Edit</Link>
                    )}
                </div>
            </header>

            {(missingOwners.length > 0 || ownershipAlert) && (
                <div className={`ownership-alert ${isCritical && missingOwners.length > 0 ? "critical" : ownershipComplete ? "complete" : ""}`}>
                    {ownershipComplete ? (
                        <span>Ownership complete</span>
                    ) : (
                        <span>Ownership needs attention: Missing {missingOwners.join(" and ")}</span>
                    )}
                </div>
            )}

            <div className="detail-main-grid">
                <div className="detail-column">
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
                                <dt>Vendor</dt>
                                <dd>{application.vendor || "—"}</dd>
                            </div>
                            <div className="detail-definition-item">
                                <dt>Purpose</dt>
                                <dd>{(application.purpose ?? application.businessContext.purpose) || "—"}</dd>
                            </div>
                            <div className="detail-definition-item full-width">
                                <dt>Capability</dt>
                                <dd>{application.capabilityName}</dd>
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
                </div>

                <div className="detail-column">
                    <section className="detail-section">
                        <h2 className="detail-section-title">Ownership</h2>
                        <dl className="detail-definition-list">
                            <div className="detail-definition-item">
                                <dt>Business Owner</dt>
                                <dd>
                                    {application.ownership.businessOwner ? (
                                        application.ownership.businessOwner
                                    ) : (
                                        <span className="owner-badge">Needs owner</span>
                                    )}
                                </dd>
                            </div>
                            <div className="detail-definition-item">
                                <dt>Technical Owner</dt>
                                <dd>
                                    {editingTechOwner ? (
                                        <div className="tech-owner-edit">
                                            {techOwnerError && <span className="owner-error">{techOwnerError}</span>}
                                            <select
                                                value={selectedTechOwner}
                                                onChange={(e) => setSelectedTechOwner(e.target.value)}
                                                className="owner-select"
                                            >
                                                <option value="">Select owner...</option>
                                                {users.map((u) => (
                                                    <option key={u.id} value={u.displayName}>
                                                        {u.displayName}
                                                    </option>
                                                ))}
                                            </select>
                                            <button
                                                className="owner-save-btn"
                                                onClick={handleSaveTechOwner}
                                                disabled={savingTechOwner || !selectedTechOwner}
                                            >
                                                {savingTechOwner ? "..." : "Save"}
                                            </button>
                                            <button
                                                className="owner-cancel-btn"
                                                onClick={() => {
                                                    setEditingTechOwner(false);
                                                    setSelectedTechOwner("");
                                                    setTechOwnerError(null);
                                                }}
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    ) : application.ownership.technicalOwner ? (
                                        <>
                                            <span>{application.ownership.technicalOwner}</span>
                                            {canEditApp() && (
                                                <>
                                                    <button
                                                        className="owner-change-btn"
                                                        onClick={() => {
                                                            setEditingTechOwner(true);
                                                            setSelectedTechOwner(application.ownership.technicalOwner || "");
                                                        }}
                                                    >
                                                        Change
                                                    </button>
                                                    <button
                                                        className="owner-clear-btn"
                                                        onClick={handleClearTechOwner}
                                                    >
                                                        Clear
                                                    </button>
                                                </>
                                            )}
                                        </>
                                    ) : canEditApp() ? (
                                        <button
                                            className="owner-assign-btn"
                                            onClick={() => {
                                                setEditingTechOwner(true);
                                                setSelectedTechOwner("");
                                            }}
                                        >
                                            + Assign
                                        </button>
                                    ) : (
                                        <span className="owner-badge">Needs owner</span>
                                    )}
                                </dd>
                            </div>
                        </dl>
                    </section>

                    <section className="detail-section">
                        <h2 className="detail-section-title">Security & Access</h2>
                        <dl className="detail-definition-list">
                            <div className="detail-definition-item">
                                <dt>Website</dt>
                                <dd>{application.security?.websiteUrl ? <a href={application.security.websiteUrl} target="_blank" rel="noopener noreferrer">{application.security.websiteUrl}</a> : "—"}</dd>
                            </div>
                            <div className="detail-definition-item">
                                <dt>Login URL</dt>
                                <dd>{application.security?.loginUrl ? <a href={application.security.loginUrl} target="_blank" rel="noopener noreferrer">{application.security.loginUrl}</a> : "—"}</dd>
                            </div>
                            <div className="detail-definition-item">
                                <dt>Backup Owner</dt>
                                <dd>{application.security?.backupOwner || "—"}</dd>
                            </div>
                            <div className="detail-definition-item">
                                <dt>SSO</dt>
                                <dd>{application.security?.ssoSupported ? `Supported: ${application.security.ssoSupported}` : "—"} {application.security?.ssoEnabled ? ` | Enabled: ${application.security.ssoEnabled}` : ""}</dd>
                            </div>
                            <div className="detail-definition-item">
                                <dt>MFA</dt>
                                <dd>{application.security?.mfaSupported ? `Supported: ${application.security.mfaSupported}` : "—"} {application.security?.mfaEnabled ? ` | Enabled: ${application.security.mfaEnabled}` : ""}</dd>
                            </div>
                            <div className="detail-definition-item">
                                <dt>Data Classification</dt>
                                <dd>{application.security?.dataClassification || "—"}</dd>
                            </div>
                            <div className="detail-definition-item">
                                <dt>User Count</dt>
                                <dd>{application.userCountBand ? application.userCountBand.replace("_", "-") : "—"}</dd>
                            </div>
                            <div className="detail-definition-item">
                                <dt>Last Reviewed</dt>
                                <dd>{application.lastReviewedAt ? new Date(application.lastReviewedAt).toLocaleDateString() : "—"}</dd>
                            </div>
                            <div className="detail-definition-item full-width">
                                <dt>Notes</dt>
                                <dd>{application.notes || "—"}</dd>
                            </div>
                        </dl>
                    </section>

                    <section className="detail-section integrations-section">
                        <h2 className="detail-section-title">Integrations</h2>
                        {canEditApp() && (
                            <button className={showAddIntegration ? "secondary-action-btn" : "primary-action-btn"} onClick={() => setShowAddIntegration(!showAddIntegration)}>
                                {showAddIntegration ? "Cancel" : "+ Add Integration"}
                            </button>
                        )}

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
            </div>
        </div>
    );
}

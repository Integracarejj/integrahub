import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
    getApplications,
    updateApplication,
    updateOwnership,
    canEditApplication,
    canEditOwnership,
} from "../../services/applicationService";
import { getIntegrationViews } from "../../services/integrationService";
import type { Application } from "../../types/application";
import type { IntegrationView } from "../../types/integration";
import "./ApplicationDetailPage.css";

type RouteParams = {
    applicationId?: string;
    id?: string;
};

type BusinessContextState = {
    purpose: string;
    impactIfDown: string;
    businessFunctions: string;
    departmentsSupported: string;
};

type OwnershipState = {
    businessOwner: string;
    technicalOwner: string;
};

export default function ApplicationDetailPage() {
    const { applicationId, id } = useParams<RouteParams>();
    const appId = applicationId ?? id;

    const [application, setApplication] = useState<Application | null>(null);
    const [integrations, setIntegrations] = useState<IntegrationView[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [editingOwnership, setEditingOwnership] = useState(false);
    const [businessContextState, setBusinessContextState] = useState<BusinessContextState>({
        purpose: "",
        impactIfDown: "",
        businessFunctions: "",
        departmentsSupported: "",
    });
    const [ownershipState, setOwnershipState] = useState<OwnershipState>({
        businessOwner: "",
        technicalOwner: "",
    });

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

    useEffect(() => {
        if (application) {
            setBusinessContextState({
                purpose: application.businessContext.purpose,
                impactIfDown: application.businessContext.impactIfDown,
                businessFunctions: application.businessContext.businessFunctions.join(", "),
                departmentsSupported: application.businessContext.departmentsSupported.join(", "),
            });
            setOwnershipState({
                businessOwner: application.ownership.businessOwner,
                technicalOwner: application.ownership.technicalOwner,
            });
        }
    }, [application]);

    const dependsOn = useMemo(
        () =>
            integrations.filter((i) => i.fromApplicationId === application?.id),
        [integrations, application]
    );

    const usedBy = useMemo(
        () =>
            integrations.filter((i) => i.toApplicationId === application?.id),
        [integrations, application]
    );

    const isEditable = application ? canEditApplication(application) : false;
    const isOwnershipEditable = canEditOwnership();

    function handleEdit() {
        setEditing(true);
    }

    function handleCancel() {
        if (application) {
            setBusinessContextState({
                purpose: application.businessContext.purpose,
                impactIfDown: application.businessContext.impactIfDown,
                businessFunctions: application.businessContext.businessFunctions.join(", "),
                departmentsSupported: application.businessContext.departmentsSupported.join(", "),
            });
        }
        setEditing(false);
    }

    function handleSave() {
        if (!application) return;

        const updated = updateApplication(application.id, {
            businessContext: {
                ...application.businessContext,
                purpose: businessContextState.purpose.trim(),
                impactIfDown: businessContextState.impactIfDown.trim(),
                businessFunctions: businessContextState.businessFunctions
                    .split(",")
                    .map((s) => s.trim())
                    .filter((s) => s.length > 0),
                departmentsSupported: businessContextState.departmentsSupported
                    .split(",")
                    .map((s) => s.trim())
                    .filter((s) => s.length > 0),
            },
        });

        if (updated) {
            setApplication({ ...updated });
        }
        setEditing(false);
    }

    function handleBusinessContextChange(field: keyof BusinessContextState, value: string) {
        setBusinessContextState((prev) => ({ ...prev, [field]: value }));
    }

    function handleEditOwnership() {
        setEditingOwnership(true);
    }

    function handleCancelOwnership() {
        if (application) {
            setOwnershipState({
                businessOwner: application.ownership.businessOwner,
                technicalOwner: application.ownership.technicalOwner,
            });
        }
        setEditingOwnership(false);
    }

    function handleSaveOwnership() {
        if (!application) return;

        const updated = updateOwnership(application.id, {
            businessOwner: ownershipState.businessOwner.trim(),
            technicalOwner: ownershipState.technicalOwner.trim(),
        });

        if (updated) {
            setApplication({ ...updated });
        }
        setEditingOwnership(false);
    }

    function handleOwnershipChange(field: keyof OwnershipState, value: string) {
        setOwnershipState((prev) => ({ ...prev, [field]: value }));
    }

    if (loading) return <p>Loading…</p>;
    if (!application) return <p>Application not found.</p>;

    return (
        <div className="application-detail-page">
            <header className="detail-header">
                <div className="detail-header-row">
                    <div className="detail-header-top">
                        <h1>{application.name}</h1>
                        <span className="detail-status">{application.status}</span>
                    </div>
                    {isEditable && !editing && !editingOwnership && (
                        <button className="detail-edit-btn" onClick={handleEdit}>
                            Edit
                        </button>
                    )}
                    {editing && (
                        <div className="detail-edit-controls">
                            <button className="detail-save-btn" onClick={handleSave}>
                                Save
                            </button>
                            <button className="detail-cancel-btn" onClick={handleCancel}>
                                Cancel
                            </button>
                        </div>
                    )}
                </div>
                <p className="detail-description">{application.description}</p>
            </header>

            <section className="detail-section">
                <h2 className="detail-section-title">Overview</h2>
                <dl className="detail-definition-list">
                    <div className="detail-definition-item">
                        <dt>Capability</dt>
                        <dd>{application.capabilityId}</dd>
                    </div>
                    <div className="detail-definition-item">
                        <dt>Type</dt>
                        <dd>{application.type}</dd>
                    </div>
                </dl>
            </section>

            <section className="detail-section">
                <div className="detail-section-header">
                    <h2 className="detail-section-title">Ownership</h2>
                    {isOwnershipEditable && !editingOwnership && !editing && (
                        <button className="detail-edit-link" onClick={handleEditOwnership}>
                            Edit Ownership
                        </button>
                    )}
                    {editingOwnership && (
                        <div className="detail-edit-controls">
                            <button className="detail-save-btn" onClick={handleSaveOwnership}>
                                Save
                            </button>
                            <button className="detail-cancel-btn" onClick={handleCancelOwnership}>
                                Cancel
                            </button>
                        </div>
                    )}
                </div>
                <dl className="detail-definition-list">
                    {editingOwnership ? (
                        <>
                            <div className="detail-definition-item detail-edit-item">
                                <dt>Business Owner</dt>
                                <dd>
                                    <input
                                        type="text"
                                        className="detail-input"
                                        value={ownershipState.businessOwner}
                                        onChange={(e) =>
                                            handleOwnershipChange("businessOwner", e.target.value)
                                        }
                                    />
                                </dd>
                            </div>
                            <div className="detail-definition-item detail-edit-item">
                                <dt>Technical Owner</dt>
                                <dd>
                                    <input
                                        type="text"
                                        className="detail-input"
                                        value={ownershipState.technicalOwner}
                                        onChange={(e) =>
                                            handleOwnershipChange("technicalOwner", e.target.value)
                                        }
                                    />
                                </dd>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="detail-definition-item">
                                <dt>Business Owner</dt>
                                <dd>{application.ownership.businessOwner}</dd>
                            </div>
                            <div className="detail-definition-item">
                                <dt>Technical Owner</dt>
                                <dd>{application.ownership.technicalOwner}</dd>
                            </div>
                        </>
                    )}
                    {application.ownership.vendor && !editingOwnership && (
                        <div className="detail-definition-item">
                            <dt>Vendor</dt>
                            <dd>{application.ownership.vendor}</dd>
                        </div>
                    )}
                </dl>
            </section>

            <section className="detail-section">
                <h2 className="detail-section-title">Business Context</h2>
                <dl className="detail-definition-list">
                    {editing ? (
                        <>
                            <div className="detail-definition-item detail-edit-item">
                                <dt>Purpose</dt>
                                <dd>
                                    <textarea
                                        className="detail-textarea"
                                        value={businessContextState.purpose}
                                        onChange={(e) =>
                                            handleBusinessContextChange("purpose", e.target.value)
                                        }
                                        rows={3}
                                    />
                                </dd>
                            </div>
                            <div className="detail-definition-item detail-edit-item">
                                <dt>Business Criticality</dt>
                                <dd>{application.businessContext.businessCriticality}</dd>
                            </div>
                            <div className="detail-definition-item detail-edit-item">
                                <dt>Impact If Down</dt>
                                <dd>
                                    <textarea
                                        className="detail-textarea"
                                        value={businessContextState.impactIfDown}
                                        onChange={(e) =>
                                            handleBusinessContextChange("impactIfDown", e.target.value)
                                        }
                                        rows={2}
                                    />
                                </dd>
                            </div>
                            <div className="detail-definition-item detail-edit-item">
                                <dt>Departments Supported</dt>
                                <dd>
                                    <input
                                        type="text"
                                        className="detail-input"
                                        value={businessContextState.departmentsSupported}
                                        onChange={(e) =>
                                            handleBusinessContextChange(
                                                "departmentsSupported",
                                                e.target.value
                                            )
                                        }
                                    />
                                </dd>
                            </div>
                            <div className="detail-definition-item detail-edit-item">
                                <dt>Business Functions</dt>
                                <dd>
                                    <input
                                        type="text"
                                        className="detail-input"
                                        value={businessContextState.businessFunctions}
                                        onChange={(e) =>
                                            handleBusinessContextChange(
                                                "businessFunctions",
                                                e.target.value
                                            )
                                        }
                                    />
                                </dd>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="detail-definition-item">
                                <dt>Purpose</dt>
                                <dd>{application.businessContext.purpose}</dd>
                            </div>
                            <div className="detail-definition-item">
                                <dt>Business Criticality</dt>
                                <dd>{application.businessContext.businessCriticality}</dd>
                            </div>
                            <div className="detail-definition-item">
                                <dt>Impact If Down</dt>
                                <dd>{application.businessContext.impactIfDown}</dd>
                            </div>
                            <div className="detail-definition-item">
                                <dt>Departments Supported</dt>
                                <dd>
                                    {application.businessContext.departmentsSupported.join(", ")}
                                </dd>
                            </div>
                            <div className="detail-definition-item">
                                <dt>Business Functions</dt>
                                <dd>
                                    {application.businessContext.businessFunctions.join(", ")}
                                </dd>
                            </div>
                        </>
                    )}
                </dl>
            </section>

            <section className="detail-section">
                <h2 className="detail-section-title">Capabilities</h2>
                {application.capabilities.length === 0 ? (
                    <p className="detail-empty">No capabilities recorded.</p>
                ) : (
                    <ul className="detail-capability-list">
                        {application.capabilities.map((cap, i) => (
                            <li key={i} className="detail-capability-item">
                                <span className="detail-capability-name">{cap.name}</span>
                                {cap.description && (
                                    <span className="detail-capability-desc">
                                        {cap.description}
                                    </span>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section className="detail-section">
                <h2 className="detail-section-title">Depends On</h2>
                {dependsOn.length === 0 ? (
                    <p className="detail-empty">No outbound dependencies.</p>
                ) : (
                    <table className="detail-relationships-table">
                        <thead>
                            <tr>
                                <th>Application</th>
                                <th>Method</th>
                                <th>Frequency</th>
                            </tr>
                        </thead>
                        <tbody>
                            {dependsOn.map((i) => (
                                <tr key={i.id}>
                                    <td>
                                        <Link
                                            to={`/applications/${i.toApplicationId}`}
                                        >
                                            {i.toApplicationName}
                                        </Link>
                                    </td>
                                    <td>{i.method}</td>
                                    <td>{i.frequency}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </section>

            <section className="detail-section">
                <h2 className="detail-section-title">Used By</h2>
                {usedBy.length === 0 ? (
                    <p className="detail-empty">No inbound dependencies.</p>
                ) : (
                    <table className="detail-relationships-table">
                        <thead>
                            <tr>
                                <th>Application</th>
                                <th>Method</th>
                                <th>Frequency</th>
                            </tr>
                        </thead>
                        <tbody>
                            {usedBy.map((i) => (
                                <tr key={i.id}>
                                    <td>
                                        <Link
                                            to={`/applications/${i.fromApplicationId}`}
                                        >
                                            {i.fromApplicationName}
                                        </Link>
                                    </td>
                                    <td>{i.method}</td>
                                    <td>{i.frequency}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </section>
        </div>
    );
}

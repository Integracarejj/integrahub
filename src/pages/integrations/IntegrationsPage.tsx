import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
    getIntegrationViews,
    createIntegration,
} from "../../services/integrationService";
import type { IntegrationView } from "../../types/integration";
import "./IntegrationsPage.css";

type View = "table" | "map" | "workflow";

const VIEWS: { key: View; label: string }[] = [
    { key: "table", label: "Table View" },
    { key: "map", label: "Map View" },
    { key: "workflow", label: "Workflow View" },
];

interface ApplicationOption {
    id: string;
    name: string;
}

interface FormData {
    sourceApplicationId: string;
    targetApplicationId: string;
    integrationType: string;
    direction: "unidirectional" | "bidirectional";
    status: string;
    method: string;
    frequency: string;
    businessPurpose: string;
    dataExchanged: string;
    notes: string;
}

const INTEGRATION_TYPES = [
    "API",
    "Authentication",
    "Reporting Feed",
    "File Exchange",
    "Manual Process",
    "Database Sync",
    "ETL / Data Pipeline",
    "Document Distribution",
    "Data Export",
    "Data Import",
];

const STATUS_OPTIONS = ["Active", "Planned", "Retired", "Unknown"];
const METHOD_OPTIONS = [
    "API",
    "SFTP",
    "CSV Import",
    "Manual",
    "Database Sync",
    "Webhook",
    "Vendor Managed",
    "Unknown",
];
const FREQUENCY_OPTIONS = [
    "Real-time",
    "Daily",
    "Weekly",
    "Monthly",
    "Manual",
    "As needed",
    "Unknown",
];

const EMPTY_FORM: FormData = {
    sourceApplicationId: "",
    targetApplicationId: "",
    integrationType: "",
    direction: "unidirectional",
    status: "Active",
    method: "API",
    frequency: "Real-time",
    businessPurpose: "",
    dataExchanged: "",
    notes: "",
};

export default function IntegrationsPage() {
    const [rows, setRows] = useState<IntegrationView[]>([]);
    const [query, setQuery] = useState("");
    const [focusSystemId, setFocusSystemId] = useState<string>("");
    const [detail, setDetail] = useState<{
        kind: "integration";
        integration: IntegrationView;
    } | { kind: "focus"; applicationId: string } | null>(null);
    const [view, setView] = useState<View>("table");
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState<FormData>({ ...EMPTY_FORM });
    const [applications, setApplications] = useState<ApplicationOption[]>([]);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{
        type: "success" | "error";
        text: string;
    } | null>(null);
    const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

    const loadData = async () => {
        try {
            const data = await getIntegrationViews();
            setRows(data);
        } catch {
            // silently fail on refresh
        }
    };

    useEffect(() => {
        let mounted = true;

        (async () => {
            try {
                const data = await getIntegrationViews();
                if (mounted) setRows(data);
            } finally {
                if (mounted) setLoading(false);
            }
        })();

        fetch("/api/applications")
            .then((res) => res.json())
            .then((data) => {
                if (mounted) setApplications(data);
            })
            .catch(() => {
                if (mounted) setApplications([]);
            });

        return () => {
            mounted = false;
        };
    }, []);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();

        return rows.filter((r) => {
            if (!q) return true;

            return (
                r.fromApplicationName.toLowerCase().includes(q) ||
                r.toApplicationName.toLowerCase().includes(q) ||
                r.integrationType?.toLowerCase().includes(q) ||
                (r.businessPurpose ?? "").toLowerCase().includes(q) ||
                (r.notes ?? "").toLowerCase().includes(q)
            );
        });
    }, [rows, query]);

    const focusApps = useMemo(() => {
        const map = new Map<string, string>();
        rows.forEach((r) => {
            if (r.fromApplicationId && r.fromApplicationName)
                map.set(r.fromApplicationId, r.fromApplicationName);
            if (r.toApplicationId && r.toApplicationName)
                map.set(r.toApplicationId, r.toApplicationName);
        });
        return Array.from(map.entries())
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [rows]);

    const inbound = useMemo(
        () => rows.filter((r) => r.toApplicationId === focusSystemId),
        [rows, focusSystemId],
    );

    const outbound = useMemo(
        () => rows.filter((r) => r.fromApplicationId === focusSystemId),
        [rows, focusSystemId],
    );

    const continuationInfo = useMemo(() => {
        const moreDownstream = new Map<string, { count: number; names: string[] }>();
        const moreUpstream = new Map<string, { count: number; names: string[] }>();

        rows.forEach((r) => {
            if (r.toApplicationId !== focusSystemId) {
                const entry = moreDownstream.get(r.fromApplicationId);
                if (entry) {
                    if (!entry.names.includes(r.toApplicationName)) {
                        entry.names.push(r.toApplicationName);
                        entry.count++;
                    }
                } else {
                    moreDownstream.set(r.fromApplicationId, {
                        count: 1,
                        names: [r.toApplicationName],
                    });
                }
            }

            if (r.fromApplicationId !== focusSystemId) {
                const entry = moreUpstream.get(r.toApplicationId);
                if (entry) {
                    if (!entry.names.includes(r.fromApplicationName)) {
                        entry.names.push(r.fromApplicationName);
                        entry.count++;
                    }
                } else {
                    moreUpstream.set(r.toApplicationId, {
                        count: 1,
                        names: [r.fromApplicationName],
                    });
                }
            }
        });

        return { moreDownstream, moreUpstream };
    }, [rows, focusSystemId]);

    useEffect(() => {
        if (focusApps.length > 0 && !focusApps.some((a) => a.id === focusSystemId)) {
            setFocusSystemId(focusApps[0].id);
        }
    }, [focusApps]);

    useEffect(() => {
        setDetail(null);
    }, [focusSystemId]);

    function handleChange(field: keyof FormData, value: string) {
        setForm((prev) => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors((prev) => {
                const next = { ...prev };
                delete next[field];
                return next;
            });
        }
    }

    function validate(): boolean {
        const e: Partial<Record<keyof FormData, string>> = {};

        if (!form.sourceApplicationId) {
            e.sourceApplicationId = "Source Application is required";
        }
        if (!form.targetApplicationId) {
            e.targetApplicationId = "Target Application is required";
        }
        if (
            form.sourceApplicationId &&
            form.targetApplicationId &&
            form.sourceApplicationId === form.targetApplicationId
        ) {
            e.targetApplicationId = "Source and Target cannot be the same";
        }
        if (!form.integrationType) {
            e.integrationType = "Integration Type is required";
        }

        setErrors(e);
        return Object.keys(e).length === 0;
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!validate()) return;

        setSaving(true);
        setMessage(null);

        try {
            const body = {
                sourceApplicationId: form.sourceApplicationId,
                targetApplicationId: form.targetApplicationId,
                integrationType: form.integrationType,
                status: form.status,
                method: form.method,
                frequency: form.frequency,
                businessPurpose: form.businessPurpose,
                dataExchanged: form.dataExchanged,
                notes: form.notes,
            };

            await createIntegration(body);

            if (form.direction === "bidirectional") {
                await createIntegration({
                    ...body,
                    sourceApplicationId: form.targetApplicationId,
                    targetApplicationId: form.sourceApplicationId,
                });
            }

            setMessage({ type: "success", text: "Integration added successfully." });
            setForm({ ...EMPTY_FORM });
            setShowForm(false);
            await loadData();
        } catch (err) {
            setMessage({
                type: "error",
                text: err instanceof Error ? err.message : "Failed to add integration",
            });
        } finally {
            setSaving(false);
        }
    }

    function toggleForm() {
        setShowForm((prev) => {
            if (prev) {
                setForm({ ...EMPTY_FORM });
                setErrors({});
                setMessage(null);
            }
            return !prev;
        });
    }

    const appOptions = applications
        .filter((a) => a.id && a.name)
        .sort((a, b) => a.name.localeCompare(b.name));

    return (
        <div className="integrations-page">
            <header className="integrations-header">
                <div>
                    <h1>Integrations</h1>
                    <p className="subtitle">
                        Manage and understand how systems connect and exchange data.
                    </p>
                </div>

                <button className="btn btn-primary" onClick={toggleForm}>
                    {showForm ? "Cancel" : "+ Add Integration"}
                </button>
            </header>

            <nav className="view-switcher">
                {VIEWS.map((v) => (
                    <button
                        key={v.key}
                        className={`view-switcher-btn${view === v.key ? " active" : ""}`}
                        onClick={() => setView(v.key)}
                    >
                        {v.label}
                    </button>
                ))}
            </nav>

            {message && (
                <div className={`msg msg-${message.type}`}>{message.text}</div>
            )}

            {showForm && (
                <form className="add-integration-card" onSubmit={handleSubmit}>
                    <h2>New Integration</h2>

                    <div className="form-grid">
                        <div className="form-field">
                            <label htmlFor="sourceApplicationId">
                                Source Application <span className="required">*</span>
                            </label>
                            <select
                                id="sourceApplicationId"
                                value={form.sourceApplicationId}
                                onChange={(e) =>
                                    handleChange("sourceApplicationId", e.target.value)
                                }
                            >
                                <option value="">Select source…</option>
                                {appOptions.map((a) => (
                                    <option key={a.id} value={a.id}>
                                        {a.name}
                                    </option>
                                ))}
                            </select>
                            {errors.sourceApplicationId && (
                                <span className="field-error">
                                    {errors.sourceApplicationId}
                                </span>
                            )}
                        </div>

                        <div className="form-field">
                            <label htmlFor="targetApplicationId">
                                Target Application <span className="required">*</span>
                            </label>
                            <select
                                id="targetApplicationId"
                                value={form.targetApplicationId}
                                onChange={(e) =>
                                    handleChange("targetApplicationId", e.target.value)
                                }
                            >
                                <option value="">Select target…</option>
                                {appOptions.map((a) => (
                                    <option key={a.id} value={a.id}>
                                        {a.name}
                                    </option>
                                ))}
                            </select>
                            {errors.targetApplicationId && (
                                <span className="field-error">
                                    {errors.targetApplicationId}
                                </span>
                            )}
                        </div>

                        <div className="form-field">
                            <label htmlFor="integrationType">
                                Integration Type <span className="required">*</span>
                            </label>
                            <select
                                id="integrationType"
                                value={form.integrationType}
                                onChange={(e) =>
                                    handleChange("integrationType", e.target.value)
                                }
                            >
                                <option value="">Select type…</option>
                                {INTEGRATION_TYPES.map((t) => (
                                    <option key={t} value={t}>
                                        {t}
                                    </option>
                                ))}
                            </select>
                            {errors.integrationType && (
                                <span className="field-error">
                                    {errors.integrationType}
                                </span>
                            )}
                        </div>

                        <div className="form-field">
                            <label htmlFor="direction">Direction</label>
                            <select
                                id="direction"
                                value={form.direction}
                                onChange={(e) =>
                                    handleChange("direction", e.target.value)
                                }
                            >
                                <option value="unidirectional">Source → Target</option>
                                <option value="bidirectional">Bidirectional</option>
                            </select>
                        </div>

                        <div className="form-field">
                            <label htmlFor="status">Status</label>
                            <select
                                id="status"
                                value={form.status}
                                onChange={(e) => handleChange("status", e.target.value)}
                            >
                                {STATUS_OPTIONS.map((s) => (
                                    <option key={s} value={s}>
                                        {s}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="form-field">
                            <label htmlFor="method">Method</label>
                            <select
                                id="method"
                                value={form.method}
                                onChange={(e) => handleChange("method", e.target.value)}
                            >
                                {METHOD_OPTIONS.map((m) => (
                                    <option key={m} value={m}>
                                        {m}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="form-field">
                            <label htmlFor="frequency">Frequency</label>
                            <select
                                id="frequency"
                                value={form.frequency}
                                onChange={(e) =>
                                    handleChange("frequency", e.target.value)
                                }
                            >
                                {FREQUENCY_OPTIONS.map((f) => (
                                    <option key={f} value={f}>
                                        {f}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="form-field">
                            <label htmlFor="businessPurpose">Business Purpose</label>
                            <textarea
                                id="businessPurpose"
                                value={form.businessPurpose}
                                onChange={(e) =>
                                    handleChange("businessPurpose", e.target.value)
                                }
                                rows={2}
                            />
                        </div>

                        <div className="form-field">
                            <label htmlFor="dataExchanged">Data Exchanged</label>
                            <textarea
                                id="dataExchanged"
                                value={form.dataExchanged}
                                onChange={(e) =>
                                    handleChange("dataExchanged", e.target.value)
                                }
                                rows={2}
                            />
                        </div>

                        <div className="form-field full-width">
                            <label htmlFor="notes">Notes</label>
                            <textarea
                                id="notes"
                                value={form.notes}
                                onChange={(e) => handleChange("notes", e.target.value)}
                                rows={2}
                            />
                        </div>
                    </div>

                    <div className="form-actions">
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={saving}
                        >
                            {saving ? "Saving…" : "Add Integration"}
                        </button>
                    </div>
                </form>
            )}

            {view === "table" && (
                <>
                    <div className="table-controls">
                        <input
                            type="text"
                            placeholder="Search integrations…"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                        />
                    </div>

                    {loading ? (
                        <p>Loading…</p>
                    ) : filtered.length === 0 ? (
                        <p className="empty">No integrations found.</p>
                    ) : (
                        <table className="integrations-table">
                            <thead>
                                <tr>
                                    <th>From</th>
                                    <th />
                                    <th>To</th>
                                    <th>Type</th>
                                    <th>Status</th>
                                    <th>Method</th>
                                    <th>Frequency</th>
                                    <th>Business Purpose</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((r) => (
                                    <tr key={r.id} className={r.status !== "Active" ? "inactive" : ""}>
                                        <td>
                                            <Link to={`/applications/${r.fromApplicationId}`}>
                                                {r.fromApplicationName}
                                            </Link>
                                        </td>
                                        <td className="arrow">→</td>
                                        <td>
                                            <Link to={`/applications/${r.toApplicationId}`}>
                                                {r.toApplicationName}
                                            </Link>
                                        </td>
                                        <td>{r.integrationType || "—"}</td>
                                        <td>
                                            <span className={`integration-status status-${(r.status || "").toLowerCase()}`}>
                                                {r.status || "—"}
                                            </span>
                                        </td>
                                        <td>{r.method || "—"}</td>
                                        <td>{r.frequency || "—"}</td>
                                        <td className="context-cell">{r.businessPurpose || r.notes || "—"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </>
            )}

            {view === "map" && (
                <div className="placeholder-card">
                    <h2>Map View coming soon</h2>
                    <p>
                        This view will show selected systems and their connected
                        integrations in an interactive map, helping you visualize
                        the relationships between applications.
                    </p>
                </div>
            )}

            {view === "workflow" && (
                <div className="workflow-view">
                    {focusApps.length === 0 ? (
                        <div className="placeholder-card">
                            <h2>No integrations yet</h2>
                            <p>Add integrations to see the workflow view.</p>
                        </div>
                    ) : (
                        <>
                            <div className="workflow-controls">
                                <label htmlFor="focus-select">Focus System:</label>
                                <select
                                    id="focus-select"
                                    value={focusSystemId}
                                    onChange={(e) => setFocusSystemId(e.target.value)}
                                >
                                    {focusApps.map((a) => (
                                        <option key={a.id} value={a.id}>
                                            {a.name}
                                        </option>
                                    ))}
                                </select>
                                <span className="wf-helper-text">
                                    Select a system to see its immediate upstream and downstream
                                    connections. Click connected systems to follow the workflow.
                                </span>
                            </div>

                            <div className="workflow-layout">
                                <div className="workflow-column">
                                    <h3 className="wf-column-header">Upstream</h3>
                                    {inbound.length === 0 && (
                                        <p className="wf-empty">No upstream integrations</p>
                                    )}
                                    {inbound.map((int) => {
                                        const moreDst = continuationInfo.moreDownstream.get(int.fromApplicationId);
                                        return (
                                            <div key={int.id} className="wf-card">
                                                <div className="wf-card-top">
                                                    <button
                                                        className="wf-card-app"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setFocusSystemId(int.fromApplicationId);
                                                        }}
                                                        title={`Show workflow for ${int.fromApplicationName}`}
                                                    >
                                                        {int.fromApplicationName}
                                                    </button>
                                                    <button
                                                        className="wf-card-detail-btn"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setDetail(
                                                                detail?.kind === "integration" &&
                                                                    detail.integration.id === int.id
                                                                    ? null
                                                                    : { kind: "integration", integration: int },
                                                            );
                                                        }}
                                                        title="View integration details"
                                                    >
                                                        ⋯
                                                    </button>
                                                </div>
                                                <div className="wf-card-meta">
                                                    <span
                                                        className={`integration-status status-${(int.status || "").toLowerCase()}`}
                                                    >
                                                        {int.status || "—"}
                                                    </span>
                                                    <span className="wf-detail">
                                                        {int.integrationType || "—"}
                                                    </span>
                                                    <span className="wf-detail">
                                                        {int.method || "—"}
                                                    </span>
                                                    <span className="wf-detail">
                                                        {int.frequency || "—"}
                                                    </span>
                                                    {(int.businessPurpose || int.dataExchanged) && (
                                                        <span
                                                            className="wf-detail wf-purpose"
                                                            title={int.businessPurpose || int.dataExchanged || ""}
                                                        >
                                                            {int.businessPurpose || int.dataExchanged}
                                                        </span>
                                                    )}
                                                </div>
                                                {moreDst && (
                                                    <span className="wf-continuation">
                                                        Continues to {moreDst.count}{" "}
                                                        {moreDst.count === 1 ? "system" : "systems"}
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="wf-arrow-col">
                                    <span>→</span>
                                </div>

                                <div className="workflow-column focus-col">
                                    <div
                                        className="wf-card wf-focus-card wf-card-clickable"
                                        onClick={() =>
                                            setDetail(
                                                detail?.kind === "focus"
                                                    ? null
                                                    : { kind: "focus", applicationId: focusSystemId },
                                            )
                                        }
                                        title="Click for system details"
                                    >
                                        <span className="wf-focus-label">Focus System</span>
                                        <span className="wf-focus-name">
                                            {focusApps.find((a) => a.id === focusSystemId)?.name ||
                                                ""}
                                        </span>
                                    </div>
                                </div>

                                <div className="wf-arrow-col">
                                    <span>→</span>
                                </div>

                                <div className="workflow-column">
                                    <h3 className="wf-column-header">Downstream</h3>
                                    {outbound.length === 0 && (
                                        <p className="wf-empty">No downstream integrations</p>
                                    )}
                                    {outbound.map((int) => {
                                        const moreSrc = continuationInfo.moreUpstream.get(int.toApplicationId);
                                        return (
                                            <div key={int.id} className="wf-card">
                                                <div className="wf-card-top">
                                                    <button
                                                        className="wf-card-app"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setFocusSystemId(int.toApplicationId);
                                                        }}
                                                        title={`Show workflow for ${int.toApplicationName}`}
                                                    >
                                                        {int.toApplicationName}
                                                    </button>
                                                    <button
                                                        className="wf-card-detail-btn"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setDetail(
                                                                detail?.kind === "integration" &&
                                                                    detail.integration.id === int.id
                                                                    ? null
                                                                    : { kind: "integration", integration: int },
                                                            );
                                                        }}
                                                        title="View integration details"
                                                    >
                                                        ⋯
                                                    </button>
                                                </div>
                                                <div className="wf-card-meta">
                                                    <span
                                                        className={`integration-status status-${(int.status || "").toLowerCase()}`}
                                                    >
                                                        {int.status || "—"}
                                                    </span>
                                                    <span className="wf-detail">
                                                        {int.integrationType || "—"}
                                                    </span>
                                                    <span className="wf-detail">
                                                        {int.method || "—"}
                                                    </span>
                                                    <span className="wf-detail">
                                                        {int.frequency || "—"}
                                                    </span>
                                                    {(int.businessPurpose || int.dataExchanged) && (
                                                        <span
                                                            className="wf-detail wf-purpose"
                                                            title={int.businessPurpose || int.dataExchanged || ""}
                                                        >
                                                            {int.businessPurpose || int.dataExchanged}
                                                        </span>
                                                    )}
                                                </div>
                                                {moreSrc && (
                                                    <span className="wf-continuation">
                                                        Has upstream from {moreSrc.count}{" "}
                                                        {moreSrc.count === 1 ? "source" : "sources"}
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {detail && (
                                <div className="wf-detail-panel">
                                    <div className="wf-detail-header">
                                        <h3>
                                            {detail.kind === "focus"
                                                ? "System Detail"
                                                : "Integration Detail"}
                                        </h3>
                                        <button
                                            className="wf-detail-close"
                                            onClick={() => setDetail(null)}
                                        >
                                            ×
                                        </button>
                                    </div>
                                    {detail.kind === "focus" ? (
                                        <div className="wf-detail-grid">
                                            <div className="wf-detail-field">
                                                <span className="wf-detail-label">Name</span>
                                                <span className="wf-detail-value">
                                                    {focusApps.find((a) => a.id === detail.applicationId)
                                                        ?.name || ""}
                                                </span>
                                            </div>
                                            <p className="wf-detail-note">
                                                More system details available from the Applications
                                                page.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="wf-detail-grid">
                                            <div className="wf-detail-field">
                                                <span className="wf-detail-label">
                                                    Connected System
                                                </span>
                                                <span className="wf-detail-value">
                                                    {detail.integration.fromApplicationId ===
                                                    focusSystemId
                                                        ? detail.integration.toApplicationName
                                                        : detail.integration.fromApplicationName}
                                                </span>
                                            </div>
                                            <div className="wf-detail-field">
                                                <span className="wf-detail-label">Direction</span>
                                                <span className="wf-detail-value">
                                                    {detail.integration.fromApplicationId ===
                                                    focusSystemId
                                                        ? "Outbound"
                                                        : "Inbound"}
                                                </span>
                                            </div>
                                            <div className="wf-detail-field">
                                                <span className="wf-detail-label">Type</span>
                                                <span className="wf-detail-value">
                                                    {detail.integration.integrationType || "—"}
                                                </span>
                                            </div>
                                            <div className="wf-detail-field">
                                                <span className="wf-detail-label">Status</span>
                                                <span className="wf-detail-value">
                                                    {detail.integration.status || "—"}
                                                </span>
                                            </div>
                                            <div className="wf-detail-field">
                                                <span className="wf-detail-label">Method</span>
                                                <span className="wf-detail-value">
                                                    {detail.integration.method || "—"}
                                                </span>
                                            </div>
                                            <div className="wf-detail-field">
                                                <span className="wf-detail-label">Frequency</span>
                                                <span className="wf-detail-value">
                                                    {detail.integration.frequency || "—"}
                                                </span>
                                            </div>
                                            <div className="wf-detail-field wf-detail-field-full">
                                                <span className="wf-detail-label">
                                                    Business Purpose
                                                </span>
                                                <span className="wf-detail-value">
                                                    {detail.integration.businessPurpose || "—"}
                                                </span>
                                            </div>
                                            <div className="wf-detail-field wf-detail-field-full">
                                                <span className="wf-detail-label">
                                                    Data Exchanged
                                                </span>
                                                <span className="wf-detail-value">
                                                    {detail.integration.dataExchanged || "—"}
                                                </span>
                                            </div>
                                            {detail.integration.notes && (
                                                <div className="wf-detail-field wf-detail-field-full">
                                                    <span className="wf-detail-label">Notes</span>
                                                    <span className="wf-detail-value">
                                                        {detail.integration.notes}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="workflow-summary">
                                <span className="wf-summary-item">
                                    <strong>{inbound.length}</strong> inbound
                                </span>
                                <span className="wf-summary-item">
                                    <strong>{outbound.length}</strong> outbound
                                </span>
                                <span className="wf-summary-item">
                                    <strong>{inbound.length + outbound.length}</strong> total related
                                </span>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
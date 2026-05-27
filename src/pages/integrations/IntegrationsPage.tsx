import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
    getIntegrationViews,
    createIntegration,
} from "../../services/integrationService";
import type { IntegrationView } from "../../types/integration";
import "./IntegrationsPage.css";

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
    "File Transfer",
    "SSO",
    "Manual Import",
    "Webhook",
    "Database Sync",
    "Other",
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
                        Directional relationships between applications
                    </p>
                </div>

                <div className="controls">
                    <input
                        type="text"
                        placeholder="Search integrations…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                    <button className="btn btn-primary" onClick={toggleForm}>
                        {showForm ? "Cancel" : "+ Add Integration"}
                    </button>
                </div>
            </header>

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
        </div>
    );
}
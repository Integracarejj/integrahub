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
    type?: string;
    systemCategory?: string;
    architectureType?: string;
    status?: string;
    description?: string;
    purpose?: string;
    businessOwner?: string;
    technicalOwner?: string;
    businessCriticality?: string;
    primaryUseCases?: string;
    capabilityName?: string;
    ownership?: { businessOwner?: string; technicalOwner?: string };
    businessContext?: { purpose?: string; businessCriticality?: string; impactIfDown?: string };
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

function getUserEntryName(systemName: string): string {
    const lower = systemName.toLowerCase();
    if (lower.includes("talent") || lower.includes("learning") || lower.includes("lms")) return "Users / Employees";
    if (lower.includes("welcome") || lower.includes("home") || lower.includes("resident") || lower.includes("guest")) return "Users / Staff";
    if (lower.includes("paycor") || lower.includes("payroll")) return "Employees";
    return "End Users";
}

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

    // Detect systems bidirectionally connected to the focus system (reciprocal integrations)
    const connectedSystemIds = useMemo(() => {
        const focusIsSource = new Set(
            rows.filter((r) => r.fromApplicationId === focusSystemId)
                .map((r) => r.toApplicationId)
        );
        const focusIsTarget = new Set(
            rows.filter((r) => r.toApplicationId === focusSystemId)
                .map((r) => r.fromApplicationId)
        );
        return new Set([...focusIsSource].filter((id) => focusIsTarget.has(id)));
    }, [rows, focusSystemId]);

    // Directional inbound rows (focus is target), excluding bidirectional pairs
    const directionalInbound = useMemo(
        () => rows.filter((r) => r.toApplicationId === focusSystemId && !connectedSystemIds.has(r.fromApplicationId)),
        [rows, focusSystemId, connectedSystemIds],
    );

    // Directional outbound rows (focus is source), excluding bidirectional pairs
    const directionalOutbound = useMemo(
        () => rows.filter((r) => r.fromApplicationId === focusSystemId && !connectedSystemIds.has(r.toApplicationId)),
        [rows, focusSystemId, connectedSystemIds],
    );

    // Systems bidirectionally linked to the focus system
    const connectedSystems = useMemo(() => {
        const map = new Map<string, string>();
        rows.forEach((r) => {
            if (r.fromApplicationId === focusSystemId && connectedSystemIds.has(r.toApplicationId)) {
                map.set(r.toApplicationId, r.toApplicationName);
            }
            if (r.toApplicationId === focusSystemId && connectedSystemIds.has(r.fromApplicationId)) {
                map.set(r.fromApplicationId, r.fromApplicationName);
            }
        });
        return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
    }, [rows, focusSystemId, connectedSystemIds]);

    const upstreamSystems = useMemo(() => {
        const map = new Map<string, string>();
        directionalInbound.forEach((int) => map.set(int.fromApplicationId, int.fromApplicationName));
        return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
    }, [directionalInbound]);

    const downstreamSystems = useMemo(() => {
        const map = new Map<string, string>();
        directionalOutbound.forEach((int) => map.set(int.toApplicationId, int.toApplicationName));
        return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
    }, [directionalOutbound]);

    const appData = useMemo(() => {
        const map = new Map<string, ApplicationOption>();
        applications.forEach((a) => map.set(a.id, a));
        return map;
    }, [applications]);

    const showUserEntry = upstreamSystems.length === 0;

    const focusName = focusApps.find((a) => a.id === focusSystemId)?.name || "";

    function getNodeDisplayCategory(architectureType?: string): string {
        const t = (architectureType || "").toLowerCase();
        if (!t || t === "unknown") return "Unknown";
        switch (t) {
            case "manual process": return "People / Manual";
            case "saas":
            case "internal application":
            case "external vendor": return "Applications";
            case "platform":
            case "integration layer": return "Platforms";
            case "database":
            case "file repository": return "Data";
            case "reporting": return "Reporting";
            case "identity provider": return "Identity";
            default: return "Unknown";
        }
    }

    function getNodeColorClass(id: string, name: string): string {
        if (id === "__user__") return "wf-node-people-manual";
        const app = appData.get(id);
        const archType = app?.architectureType;
        if (archType) {
            const category = getNodeDisplayCategory(archType);
            switch (category) {
                case "People / Manual": return "wf-node-people-manual";
                case "Applications": return "wf-node-applications";
                case "Platforms": return "wf-node-platforms";
                case "Data": return "wf-node-data";
                case "Reporting": return "wf-node-reporting";
                case "Identity": return "wf-node-identity";
                default: return "wf-node-unknown";
            }
        }
        const type = app?.type || "";
        const category = app?.systemCategory || "";
        const lower = name.toLowerCase();
        if (category?.toLowerCase().includes("identity") || category?.toLowerCase().includes("iam") || category?.toLowerCase().includes("sso") || category?.toLowerCase().includes("auth") || lower.includes("identity") || lower.includes("okta") || lower.includes("sso") || lower.includes("azure ad") || lower.includes("active directory")) return "wf-node-identity";
        if (category?.toLowerCase().includes("reporting") || category?.toLowerCase().includes("analytics") || lower.includes("analytics") || lower.includes("bi ") || lower.includes("reporting")) return "wf-node-reporting";
        if (type === "Platform" || category?.toLowerCase().includes("platform")) return "wf-node-platforms";
        if (category?.toLowerCase().includes("database") || category?.toLowerCase().includes("data") || lower.includes("database") || lower.includes("sql") || lower.includes("data warehouse")) return "wf-node-data";
        if (type === "SaaS" || type === "Standard" || category?.toLowerCase().includes("saas")) return "wf-node-applications";
        return "wf-node-unknown";
    }

    function NodeCard({
        id,
        name,
        isFocus,
        faded,
        generated,
    }: {
        id: string;
        name: string;
        isFocus?: boolean;
        faded?: boolean;
        generated?: boolean;
    }) {
        const app = appData.get(id);
        const colorClass = getNodeColorClass(id, name);
        const displayCategory = getNodeDisplayCategory(app?.architectureType);

        const cardClass = [
            "wf-node-card",
            isFocus ? "wf-node-focus-card" : "",
            faded || generated ? "wf-node-context-card" : "",
            colorClass,
        ]
            .filter(Boolean)
            .join(" ");

        const handleClick =
            generated || id === "__user__"
                ? undefined
                : () => {
                      if (isFocus) {
                          setDetail(
                              detail?.kind === "focus"
                                  ? null
                                  : { kind: "focus", applicationId: id },
                          );
                      } else {
                          setFocusSystemId(id);
                      }
                  };

        const criticality = !generated
            ? (app?.businessCriticality || (app?.businessContext as { businessCriticality?: string } | undefined)?.businessCriticality)
            : undefined;

        return (
            <div
                className={cardClass}
                onClick={handleClick}
                title={
                    generated || id === "__user__"
                        ? undefined
                        : isFocus
                          ? "Click for system details"
                          : `Show workflow for ${name}`
                }
            >
                {generated && (
                    <span className="wf-node-gen-label">
                        <span className="wf-person-icon">👤</span>
                        User Entry
                    </span>
                )}
                {isFocus && <span className="wf-focus-label">Focus System</span>}
                <span className="wf-node-name">{name}</span>
                {!generated && (
                    <div className="wf-node-badges">
                        <span className="wf-node-category-badge">{displayCategory}</span>
                        {(app?.capabilityName || app?.systemCategory) && (
                            <span className="wf-node-cap-badge">{app.capabilityName || app.systemCategory}</span>
                        )}
                        {app?.status && (
                            <span className={`wf-node-status-badge ${(app.status || "").toLowerCase()}`}>
                                {app.status}
                            </span>
                        )}
                        {criticality && (
                            <span className="wf-node-crit-badge">{criticality}</span>
                        )}
                    </div>
                )}
            </div>
        );
    }

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

    function handleViewChange(newView: View) {
        setView(newView);
        if (newView === "table") {
            setFocusSystemId("");
            setDetail(null);
        }
    }

    const appOptions = applications
        .filter((a) => a.id && a.name)
        .sort((a, b) => a.name.localeCompare(b.name));

    return (
        <div className="integrations-page">
            <header className="integrations-header">
                <div>
                    <h1>Explore</h1>
                    <p className="subtitle">
                        Explore system relationships, workflows, and data movement.
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
                        onClick={() => handleViewChange(v.key)}
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
                        {query && (
                            <button
                                className="btn-clear-search"
                                onClick={() => setQuery("")}
                                title="Clear search"
                            >
                                ×
                            </button>
                        )}
                    </div>

                    {!loading && (
                        <div className="table-summary-row">
                            <span className="table-summary-text">
                                Showing {filtered.length} of {rows.length} integrations
                                {query.trim() ? (
                                    <> · Filtered by search: "<strong>{query}</strong>"</>
                                ) : (
                                    <> · Table View shows <strong>all</strong> integrations. Use Workflow View to explore one focused system.</>
                                )}
                            </span>
                        </div>
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
                                    <tr key={r.id}>
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
                                    Workflow shows direct upstream and downstream connections. Click any system to follow the chain.
                                </span>
                            </div>

                            <div className="workflow-chain">
                                {(upstreamSystems.length > 0 || showUserEntry) && (
                                    <div className="wf-section-label">Sources</div>
                                )}

                                {showUserEntry && (
                                    <div className="wf-node-row">
                                        <div className="wf-node-with-conn">
                                            <NodeCard
                                                id="__user__"
                                                name={getUserEntryName(focusName)}
                                                generated
                                            />
                                        </div>
                                    </div>
                                )}

                                {upstreamSystems.length > 0 && (
                                    <div className="wf-node-row">
                                        {upstreamSystems.map((sys) => {
                                            const conn = directionalInbound.find((i) => i.fromApplicationId === sys.id);
                                            const connLabel = conn ? (conn.integrationType || conn.method || conn.frequency || null) : null;
                                            return (
                                                <div key={sys.id} className="wf-node-with-conn">
                                                    <NodeCard id={sys.id} name={sys.name} />
                                                    {connLabel && <span className="wf-conn-label">{connLabel}</span>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {upstreamSystems.length === 0 && !showUserEntry && (
                                    <p className="wf-empty">No upstream systems documented yet</p>
                                )}

                                {(upstreamSystems.length > 0 || showUserEntry) && (
                                    <div className="wf-chain-arrow">↓</div>
                                )}

                                <div className="wf-section-label">Focus System</div>

                                <div className="wf-focus-stage">
                                    <NodeCard id={focusSystemId} name={focusName} isFocus />
                                    {connectedSystems.length > 0 && (
                                        <>
                                            <span className="wf-connected-sync">↻</span>
                                            <div className="wf-connected-panel">
                                                <div className="wf-conn-sys-label">Connected Systems</div>
                                                <div className="wf-connected-systems">
                                                    {connectedSystems.map((sys) => {
                                                        const conn = rows.find(
                                                            (r) =>
                                                                (r.fromApplicationId === focusSystemId && r.toApplicationId === sys.id) ||
                                                                (r.toApplicationId === focusSystemId && r.fromApplicationId === sys.id)
                                                        );
                                                        const connLabel = conn ? (conn.integrationType || conn.method || conn.frequency || null) : null;
                                                        return (
                                                            <div key={sys.id} className="wf-node-with-conn">
                                                                <NodeCard id={sys.id} name={sys.name} />
                                                                {connLabel && <span className="wf-conn-label">{connLabel}</span>}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {downstreamSystems.length > 0 && (
                                    <>
                                        <div className="wf-chain-arrow">↓</div>
                                        <div className="wf-section-label">Populates</div>
                                        <div className="wf-node-row">
                                            {downstreamSystems.map((sys) => {
                                                const conn = directionalOutbound.find((i) => i.toApplicationId === sys.id);
                                                const connLabel = conn ? (conn.integrationType || conn.method || conn.frequency || null) : null;
                                                return (
                                                    <div key={sys.id} className="wf-node-with-conn">
                                                        <NodeCard id={sys.id} name={sys.name} />
                                                        {connLabel && <span className="wf-conn-label">{connLabel}</span>}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </>
                                )}

                                {downstreamSystems.length === 0 && (
                                    <p className="wf-empty">No downstream systems documented yet</p>
                                )}
                            </div>

                            <div className="wf-legend">
                                <span className="wf-legend-title">Node Types</span>
                            <div className="wf-legend-items">
                                <span className="wf-legend-item"><span className="wf-legend-swatch wf-node-people-manual" />People / Manual</span>
                                <span className="wf-legend-item"><span className="wf-legend-swatch wf-node-applications" />Applications</span>
                                <span className="wf-legend-item"><span className="wf-legend-swatch wf-node-platforms" />Platforms</span>
                                <span className="wf-legend-item"><span className="wf-legend-swatch wf-node-data" />Data</span>
                                <span className="wf-legend-item"><span className="wf-legend-swatch wf-node-reporting" />Reporting</span>
                                <span className="wf-legend-item"><span className="wf-legend-swatch wf-node-identity" />Identity</span>
                                <span className="wf-legend-item"><span className="wf-legend-swatch wf-node-unknown" />Unknown</span>
                            </div>
                            </div>

                            {detail && detail.kind === "focus" && (
                                <div className="wf-detail-panel">
                                    <div className="wf-detail-header">
                                        <h3>{focusName}</h3>
                                        <button
                                            className="wf-detail-close"
                                            onClick={() => setDetail(null)}
                                        >
                                            ×
                                        </button>
                                    </div>
                                    <div className="wf-detail-sections">
                                        {(() => {
                                            const app = appData.get(detail.applicationId);
                                            if (!app) {
                                                return (
                                                    <div className="wf-detail-section wf-detail-section-full">
                                                        <h4 className="wf-detail-section-title">Overview</h4>
                                                        <div className="wf-detail-field">
                                                            <span className="wf-detail-label">Name</span>
                                                            <span className="wf-detail-value">{focusName}</span>
                                                        </div>
                                                    </div>
                                                );
                                            }
                                            const purpose = app.purpose || (app.businessContext as { purpose?: string } | undefined)?.purpose;
                                            const bizOwner = app.businessOwner || (app.ownership as { businessOwner?: string } | undefined)?.businessOwner;
                                            const techOwner = app.technicalOwner || (app.ownership as { technicalOwner?: string } | undefined)?.technicalOwner;
                                            const crit = app.businessCriticality || (app.businessContext as { businessCriticality?: string } | undefined)?.businessCriticality;
                                            const impactDown = (app.businessContext as { impactIfDown?: string } | undefined)?.impactIfDown;

                                            return (
                                                <>
                                                    <div className="wf-detail-section">
                                                        <h4 className="wf-detail-section-title">Overview</h4>
                                                        {app.description && (
                                                            <div className="wf-detail-field">
                                                                <span className="wf-detail-label">Description</span>
                                                                <span className="wf-detail-value">{app.description}</span>
                                                            </div>
                                                        )}
                                                        {purpose && (
                                                            <div className="wf-detail-field">
                                                                <span className="wf-detail-label">Purpose</span>
                                                                <span className="wf-detail-value">{purpose}</span>
                                                            </div>
                                                        )}
                                                        {!app.description && !purpose && (
                                                            <span className="wf-detail-empty">No overview data</span>
                                                        )}
                                                    </div>

                                                    <div className="wf-detail-section">
                                                        <h4 className="wf-detail-section-title">Ownership</h4>
                                                        {bizOwner && (
                                                            <div className="wf-detail-field">
                                                                <span className="wf-detail-label">Business Owner</span>
                                                                <span className="wf-detail-value">{bizOwner}</span>
                                                            </div>
                                                        )}
                                                        {techOwner && (
                                                            <div className="wf-detail-field">
                                                                <span className="wf-detail-label">Technical Owner</span>
                                                                <span className="wf-detail-value">{techOwner}</span>
                                                            </div>
                                                        )}
                                                        {!bizOwner && !techOwner && (
                                                            <span className="wf-detail-empty">No ownership data</span>
                                                        )}
                                                    </div>

                                                    <div className="wf-detail-section">
                                                        <h4 className="wf-detail-section-title">Business Context</h4>
                                                        {crit && (
                                                            <div className="wf-detail-field">
                                                                <span className="wf-detail-label">Criticality</span>
                                                                <span className="wf-detail-value">{crit}</span>
                                                            </div>
                                                        )}
                                                        {impactDown && (
                                                            <div className="wf-detail-field">
                                                                <span className="wf-detail-label">Impact If Down</span>
                                                                <span className="wf-detail-value">{impactDown}</span>
                                                            </div>
                                                        )}
                                                        {!crit && !impactDown && (
                                                            <span className="wf-detail-empty">No business context data</span>
                                                        )}
                                                    </div>

                                                    <div className="wf-detail-section">
                                                        <h4 className="wf-detail-section-title">Usage</h4>
                                                        {app.primaryUseCases && (
                                                            <div className="wf-detail-field">
                                                                <span className="wf-detail-label">Primary Use Cases</span>
                                                                <span className="wf-detail-value">{app.primaryUseCases}</span>
                                                            </div>
                                                        )}
                                                        {app.capabilityName && (
                                                            <div className="wf-detail-field">
                                                                <span className="wf-detail-label">Capability</span>
                                                                <span className="wf-detail-value">{app.capabilityName}</span>
                                                            </div>
                                                        )}
                                                        {!app.primaryUseCases && !app.capabilityName && (
                                                            <span className="wf-detail-empty">No usage data</span>
                                                        )}
                                                    </div>
                                                </>
                                            );
                                        })()}

                                        <div className="wf-detail-section wf-detail-section-full">
                                            <h4 className="wf-detail-section-title">Relationships</h4>
                                            {inbound.length > 0 && (
                                                <div className="wf-detail-int-group">
                                                    <span className="wf-detail-label">Inbound ({inbound.length})</span>
                                                    <div className="wf-detail-int-list">
                                                        {inbound.map((int) => (
                                                            <div
                                                                key={int.id}
                                                                className="wf-detail-int-row"
                                                                onClick={() =>
                                                                    setDetail({
                                                                        kind: "integration",
                                                                        integration: int,
                                                                    })
                                                                }
                                                                title="Click for integration details"
                                                            >
                                                                <span className="wf-detail-int-name">{int.fromApplicationName}</span>
                                                                <span className="wf-detail-int-type">{int.integrationType || "—"}</span>
                                                                <span className={`wf-detail-int-status status-${(int.status || "").toLowerCase()}`}>
                                                                    {int.status || "—"}
                                                                </span>
                                                                <span className="wf-detail-int-meta">
                                                                    {int.method || "—"} · {int.frequency || "—"}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            {outbound.length > 0 && (
                                                <div className="wf-detail-int-group">
                                                    <span className="wf-detail-label">Outbound ({outbound.length})</span>
                                                    <div className="wf-detail-int-list">
                                                        {outbound.map((int) => (
                                                            <div
                                                                key={int.id}
                                                                className="wf-detail-int-row"
                                                                onClick={() =>
                                                                    setDetail({
                                                                        kind: "integration",
                                                                        integration: int,
                                                                    })
                                                                }
                                                                title="Click for integration details"
                                                            >
                                                                <span className="wf-detail-int-name">{int.toApplicationName}</span>
                                                                <span className="wf-detail-int-type">{int.integrationType || "—"}</span>
                                                                <span className={`wf-detail-int-status status-${(int.status || "").toLowerCase()}`}>
                                                                    {int.status || "—"}
                                                                </span>
                                                                <span className="wf-detail-int-meta">
                                                                    {int.method || "—"} · {int.frequency || "—"}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            {inbound.length === 0 && outbound.length === 0 && (
                                                <span className="wf-detail-empty">No relationships</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {detail && detail.kind === "integration" && (
                                <div className="wf-detail-panel">
                                    <div className="wf-detail-header">
                                        <h3>Integration Detail</h3>
                                        <button
                                            className="wf-detail-close"
                                            onClick={() =>
                                                setDetail({
                                                    kind: "focus",
                                                    applicationId: focusSystemId,
                                                })
                                            }
                                        >
                                            ×
                                        </button>
                                    </div>
                                    <div className="wf-detail-sections">
                                        <div className="wf-detail-section wf-detail-section-full">
                                            <h4 className="wf-detail-section-title">Connection</h4>
                                            <div className="wf-detail-field">
                                                <span className="wf-detail-label">Source</span>
                                                <span className="wf-detail-value">
                                                    {detail.integration.fromApplicationName}
                                                </span>
                                            </div>
                                            <div className="wf-detail-field">
                                                <span className="wf-detail-label">Target</span>
                                                <span className="wf-detail-value">
                                                    {detail.integration.toApplicationName}
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
                                                <span className={`integration-status status-${(detail.integration.status || "").toLowerCase()}`}>
                                                    {detail.integration.status || "—"}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="wf-detail-section">
                                            <h4 className="wf-detail-section-title">Technical</h4>
                                            <div className="wf-detail-field">
                                                <span className="wf-detail-label">Method</span>
                                                <span className="wf-detail-value">{detail.integration.method || "—"}</span>
                                            </div>
                                            <div className="wf-detail-field">
                                                <span className="wf-detail-label">Frequency</span>
                                                <span className="wf-detail-value">{detail.integration.frequency || "—"}</span>
                                            </div>
                                        </div>
                                        <div className="wf-detail-section">
                                            <h4 className="wf-detail-section-title">Business</h4>
                                            <div className="wf-detail-field">
                                                <span className="wf-detail-label">Purpose</span>
                                                <span className="wf-detail-value">{detail.integration.businessPurpose || "—"}</span>
                                            </div>
                                            <div className="wf-detail-field">
                                                <span className="wf-detail-label">Data Exchanged</span>
                                                <span className="wf-detail-value">{detail.integration.dataExchanged || "—"}</span>
                                            </div>
                                            <div className="wf-detail-field">
                                                <span className="wf-detail-label">Notes</span>
                                                <span className="wf-detail-value">{detail.integration.notes || "—"}</span>
                                            </div>
                                        </div>
                                    </div>
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
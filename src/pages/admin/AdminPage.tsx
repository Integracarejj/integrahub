import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { usePermissions, isPlatformAdmin } from "../../hooks/usePermissions";
import { getAuthHeaders } from "../../utils/authHeaders";
import "./AdminPage.css";

interface Capability {
    id: string;
    name: string;
}

interface Application {
    id: string;
    name: string;
}

interface Integration {
    id: string;
    sourceApplicationId: string;
    targetApplicationId: string;
    sourceApplicationName: string;
    targetApplicationName: string;
    integrationType: string;
    notes: string;
    status?: string | null;
    businessPurpose?: string | null;
    dataExchanged?: string | null;
    frequency?: string | null;
    method?: string | null;
}

export default function AdminPage() {
    const { permissions, loading: permissionsLoading } = usePermissions();
    const [capabilities, setCapabilities] = useState<Capability[]>([]);
    const [applications, setApplications] = useState<Application[]>([]);
    const [integrations, setIntegrations] = useState<Integration[]>([]);
    const [loading, setLoading] = useState(true);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
    const [editingIntegrationId, setEditingIntegrationId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({ sourceApplicationId: "", targetApplicationId: "", integrationType: "", notes: "", status: "", businessPurpose: "", dataExchanged: "", frequency: "", method: "" });
    const [editModalDirection, setEditModalDirection] = useState<"unidirectional" | "bidirectional">("unidirectional");
    const [savingId, setSavingId] = useState<string | null>(null);

    const INTEGRATION_TYPES = ["API", "Authentication", "Reporting Feed", "File Exchange", "Manual Process", "Database Sync", "ETL / Data Pipeline", "Document Distribution", "Data Export", "Data Import"];
    const STATUS_OPTIONS = ["Active", "Planned", "Retired", "Unknown"];
    const FREQUENCY_OPTIONS = ["Real-time", "Daily", "Weekly", "Monthly", "Manual", "As needed", "Unknown"];
    const METHOD_OPTIONS = ["API", "SFTP", "CSV Import", "Manual", "Database Sync", "Webhook", "Vendor Managed", "Unknown"];

    useEffect(() => {
        loadData();
    }, []);

    if (permissionsLoading) {
        return <div className="admin-page" style={{ padding: "40px", textAlign: "center" }}><p>Loading...</p></div>;
    }

    if (!isPlatformAdmin(permissions)) {
        return (
            <div className="admin-page" style={{ padding: "40px", textAlign: "center" }}>
                <h1>Access Denied</h1>
                <p>You do not have access to this page.</p>
                <Link to="/" className="create-btn">Go to Home</Link>
            </div>
        );
    }

function loadData() {
        setLoading(true);
        Promise.all([
            fetch("/api/capabilities").then((res) => res.json()),
            fetch("/api/applications").then((res) => res.json()),
            fetch("/api/integrations").then((res) => res.json()),
        ])
            .then(([caps, apps, ints]) => {
                setCapabilities(caps);
                setApplications(apps);
                setIntegrations(ints);
                setLoading(false);
            })
            .catch(() => {
                setLoading(false);
            });
    }

    async function handleDeleteCapability(id: string, name: string) {
        if (!window.confirm(`Delete "${name}"?`)) return;
        setDeletingId(id);
        try {
            const res = await fetch(`/api/capabilities/${id}`, { method: "DELETE", headers: getAuthHeaders() });
            if (res.ok) loadData();
        } finally {
            setDeletingId(null);
        }
    }

    async function handleDeleteApplication(id: string, name: string) {
        if (!window.confirm(`Are you sure you want to delete application "${name}"?`)) {
            return;
        }

        setDeletingId(id);
        setDeleteError(null);

        try {
            const res = await fetch(`/api/applications/${id}`, {
                method: "DELETE",
                headers: getAuthHeaders(),
            });

            if (!res.ok) {
                const data = await res.json();
                setDeleteError(data.error || "Failed to delete application");
                return;
            }

            loadData();
        } catch (err) {
            setDeleteError("Failed to delete application");
        } finally {
            setDeletingId(null);
        }
    }

    async function handleDeleteIntegration(id: string) {
        if (!window.confirm("Are you sure you want to delete this integration?")) {
            return;
        }

        setDeletingId(id);
        setDeleteError(null);

        try {
            const res = await fetch(`/api/integrations/${id}`, {
                method: "DELETE",
                headers: getAuthHeaders(),
            });

            if (!res.ok) {
                const data = await res.json();
                setDeleteError(data.error || "Failed to delete integration");
                return;
            }

            loadData();
        } catch (err) {
            setDeleteError("Failed to delete integration");
        } finally {
            setDeletingId(null);
        }
    }

    function startEditIntegration(int: Integration) {
        setEditingIntegrationId(int.id);
        const isBidi = integrations.some(
            (i) => i.id !== int.id &&
                   i.sourceApplicationId === int.targetApplicationId &&
                   i.targetApplicationId === int.sourceApplicationId
        );
        setEditModalDirection(isBidi ? "bidirectional" : "unidirectional");
        setEditForm({
            sourceApplicationId: int.sourceApplicationId,
            targetApplicationId: int.targetApplicationId,
            integrationType: int.integrationType,
            notes: int.notes,
            status: int.status || "",
            businessPurpose: int.businessPurpose || "",
            dataExchanged: int.dataExchanged || "",
            frequency: int.frequency || "",
            method: int.method || "",
        });
    }

    function cancelEditIntegration() {
        setEditingIntegrationId(null);
        setEditModalDirection("unidirectional");
        setEditForm({ sourceApplicationId: "", targetApplicationId: "", integrationType: "", notes: "", status: "", businessPurpose: "", dataExchanged: "", frequency: "", method: "" });
    }

    async function saveEditIntegration(id: string) {
        if (!editForm.sourceApplicationId || !editForm.targetApplicationId) {
            return;
        }

        setSavingId(id);
        setDeleteError(null);

        try {
            const original = integrations.find((i) => i.id === id);
            const wasBidirectional = original ? integrations.some(
                (i) => i.id !== id &&
                       i.sourceApplicationId === original.targetApplicationId &&
                       i.targetApplicationId === original.sourceApplicationId
            ) : false;
            const wantsBidirectional = editModalDirection === "bidirectional";

            const res = await fetch(`/api/integrations/${id}`, {
                method: "PUT",
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    sourceApplicationId: editForm.sourceApplicationId,
                    targetApplicationId: editForm.targetApplicationId,
                    integrationType: editForm.integrationType,
                    notes: editForm.notes,
                    status: editForm.status || undefined,
                    businessPurpose: editForm.businessPurpose || null,
                    dataExchanged: editForm.dataExchanged || null,
                    frequency: editForm.frequency || undefined,
                    method: editForm.method || undefined,
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                setDeleteError(data.error || "Failed to update integration");
                return;
            }

            if (wasBidirectional && !wantsBidirectional) {
                const reciprocal = original ? integrations.find(
                    (i) => i.id !== id &&
                           i.sourceApplicationId === original.targetApplicationId &&
                           i.targetApplicationId === original.sourceApplicationId
                ) : null;
                if (reciprocal) {
                    await fetch(`/api/integrations/${reciprocal.id}`, {
                        method: "DELETE",
                        headers: getAuthHeaders(),
                    });
                }
            } else if (wantsBidirectional && original && (!wasBidirectional ||
                       original.sourceApplicationId !== editForm.sourceApplicationId ||
                       original.targetApplicationId !== editForm.targetApplicationId)) {
                if (wasBidirectional) {
                    const oldReciprocal = integrations.find(
                        (i) => i.id !== id &&
                               i.sourceApplicationId === original.targetApplicationId &&
                               i.targetApplicationId === original.sourceApplicationId
                    );
                    if (oldReciprocal) {
                        await fetch(`/api/integrations/${oldReciprocal.id}`, {
                            method: "DELETE",
                            headers: getAuthHeaders(),
                        });
                    }
                }
                await fetch("/api/integrations", {
                    method: "POST",
                    headers: getAuthHeaders(),
                    body: JSON.stringify({
                        sourceApplicationId: editForm.targetApplicationId,
                        targetApplicationId: editForm.sourceApplicationId,
                        integrationType: editForm.integrationType || "",
                        status: editForm.status || "Active",
                        method: editForm.method || "Unknown",
                        frequency: editForm.frequency || "Unknown",
                        businessPurpose: editForm.businessPurpose || null,
                        dataExchanged: editForm.dataExchanged || null,
                        notes: editForm.notes || "",
                    }),
                });
            }

            loadData();
            cancelEditIntegration();
        } catch (err) {
            setDeleteError("Failed to update integration");
        } finally {
            setSavingId(null);
        }
    }

    function toggleSection(section: string) {
        setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
    }

    function CollapsibleSection({
        title,
        sectionKey,
        children,
    }: {
        title: string;
        sectionKey: string;
        children: React.ReactNode;
    }) {
        const isExpanded = expandedSections[sectionKey] ?? false;
        return (
            <section className="admin-section">
                <button
                    className="collapsible-header"
                    onClick={() => toggleSection(sectionKey)}
                    type="button"
                >
                    <span className="collapsible-icon">{isExpanded ? "−" : "+"}</span>
                    <h2>{title}</h2>
                </button>
                {isExpanded && <div className="collapsible-content">{children}</div>}
            </section>
        );
    }

    return (
        <div className="admin-page">
            <header className="page-header">
                <h1>Admin</h1>
            </header>

            <div className="admin-actions">
                <div className="admin-card">
                    <h2>Create Application</h2>
                    <p>Add a new application to the catalog.</p>
                    <Link to="/applications/new" className="admin-btn">Create Application</Link>
                </div>

                <div className="admin-card">
                    <h2>Create Capability</h2>
                    <p>Add a new capability to the catalog.</p>
                    <Link to="/capabilities/new" className="admin-btn">Create Capability</Link>
                </div>

                <div className="admin-card">
                    <h2>Manage Users</h2>
                    <p>Add, edit, or deactivate user accounts.</p>
                    <Link to="/admin/users" className="admin-btn">Manage Users</Link>
                </div>

                <div className="admin-card">
                    <h2>Application Import</h2>
                    <p>Preview registry spreadsheet imports.</p>
                    <Link to="/admin/application-import" className="admin-btn">Application Import</Link>
                </div>

                <div className="admin-card">
                    <h2>Data Quality</h2>
                    <p>Review missing ownership, operational context, role mappings, integrations, and cleanup opportunities.</p>
                    <Link to="/admin/data-quality" className="admin-btn">Open Data Quality</Link>
                </div>
            </div>

            <CollapsibleSection title="Manage Capabilities" sectionKey="capabilities">
                {deleteError && <div className="form-error">{deleteError}</div>}
                {loading ? (
                    <p>Loading...</p>
                ) : capabilities.length === 0 ? (
                    <p>No capabilities found.</p>
                ) : (
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {capabilities.map((cap) => (
                                <tr key={cap.id}>
                                    <td>{cap.name}</td>
                                    <td>
                                        <Link to={`/capabilities/${cap.id}`} className="admin-link">View</Link>
                                        <Link to={`/capabilities/${cap.id}/edit`} className="admin-link">Edit</Link>
                                        <button
                                            className="admin-link danger"
                                            onClick={() => handleDeleteCapability(cap.id, cap.name)}
                                            disabled={deletingId === cap.id}
                                        >
                                            {deletingId === cap.id ? "Deleting..." : "Delete"}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </CollapsibleSection>

            <CollapsibleSection title="Manage Applications" sectionKey="applications">
                {deleteError && <div className="form-error">{deleteError}</div>}
                {loading ? (
                    <p>Loading...</p>
                ) : applications.length === 0 ? (
                    <p>No applications found.</p>
                ) : (
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {applications.map((app) => (
                                <tr key={app.id}>
                                    <td>{app.name}</td>
                                    <td>
                                        <Link to={`/applications/${app.id}`} className="admin-link">View</Link>
                                        <Link to={`/applications/${app.id}/edit`} className="admin-link">Edit</Link>
                                        <button
                                            className="admin-link danger"
                                            onClick={() => handleDeleteApplication(app.id, app.name)}
                                            disabled={deletingId === app.id}
                                        >
                                            {deletingId === app.id ? "Deleting..." : "Delete"}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </CollapsibleSection>

            <CollapsibleSection title="Manage Integrations" sectionKey="integrations">
                {deleteError && <div className="form-error">{deleteError}</div>}
                {loading ? (
                    <p>Loading...</p>
                ) : integrations.length === 0 ? (
                    <p>No integrations found.</p>
                ) : (
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Source</th>
                                <th>Target</th>
                                <th>Type</th>
                                <th>Status</th>
                                <th>Method</th>
                                <th>Frequency</th>
                                <th>Details</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {integrations.map((int) => (
                                <tr key={int.id}>
                                    <td>{int.sourceApplicationName}</td>
                                    <td>{int.targetApplicationName}</td>
                                    <td>{int.integrationType || "—"}</td>
                                    <td>{int.status || "—"}</td>
                                    <td>{int.method || "—"}</td>
                                    <td>{int.frequency || "—"}</td>
                                    <td className="context-cell">{int.businessPurpose || int.dataExchanged || int.notes || "—"}</td>
                                    <td>
                                        <button
                                            className="admin-link"
                                            onClick={() => startEditIntegration(int)}
                                        >
                                            Edit
                                        </button>
                                        <button
                                            className="admin-link danger"
                                            onClick={() => handleDeleteIntegration(int.id)}
                                            disabled={deletingId === int.id}
                                        >
                                            {deletingId === int.id ? "Deleting..." : "Delete"}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}

                {editingIntegrationId && (() => {
                    const editingInt = integrations.find((i) => i.id === editingIntegrationId);
                    if (!editingInt) return null;
                    return (
                        <div className="modal-overlay" onClick={cancelEditIntegration}>
                            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                                <h2>Edit Integration</h2>
                                <div className="modal-form-grid">
                                    <div className="form-field">
                                        <label>Source Application</label>
                                        <select
                                            value={editForm.sourceApplicationId}
                                            onChange={(e) => setEditForm({ ...editForm, sourceApplicationId: e.target.value })}
                                            className="edit-select modal-select"
                                        >
                                            <option value="">Select Source</option>
                                            {applications.map((app) => (
                                                <option key={app.id} value={app.id}>{app.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-field">
                                        <label>Target Application</label>
                                        <select
                                            value={editForm.targetApplicationId}
                                            onChange={(e) => setEditForm({ ...editForm, targetApplicationId: e.target.value })}
                                            className="edit-select modal-select"
                                        >
                                            <option value="">Select Target</option>
                                            {applications.map((app) => (
                                                <option key={app.id} value={app.id}>{app.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-field">
                                        <label>Direction</label>
                                        <select
                                            value={editModalDirection}
                                            onChange={(e) => setEditModalDirection(e.target.value as "unidirectional" | "bidirectional")}
                                            className="edit-select modal-select"
                                        >
                                            <option value="unidirectional">Source → Target</option>
                                            <option value="bidirectional">Bidirectional</option>
                                        </select>
                                    </div>
                                    <div className="form-field">
                                        <label>Integration Type</label>
                                        <select
                                            value={editForm.integrationType}
                                            onChange={(e) => setEditForm({ ...editForm, integrationType: e.target.value })}
                                            className="edit-select modal-select"
                                        >
                                            <option value="">Select Type</option>
                                            {INTEGRATION_TYPES.map((type) => (
                                                <option key={type} value={type}>{type}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-field">
                                        <label>Status</label>
                                        <select
                                            value={editForm.status}
                                            onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                                            className="edit-select modal-select"
                                        >
                                            <option value="">Select Status</option>
                                            {STATUS_OPTIONS.map((opt) => (
                                                <option key={opt} value={opt}>{opt}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-field">
                                        <label>Method</label>
                                        <select
                                            value={editForm.method}
                                            onChange={(e) => setEditForm({ ...editForm, method: e.target.value })}
                                            className="edit-select modal-select"
                                        >
                                            <option value="">Select Method</option>
                                            {METHOD_OPTIONS.map((opt) => (
                                                <option key={opt} value={opt}>{opt}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-field">
                                        <label>Frequency</label>
                                        <select
                                            value={editForm.frequency}
                                            onChange={(e) => setEditForm({ ...editForm, frequency: e.target.value })}
                                            className="edit-select modal-select"
                                        >
                                            <option value="">Select Frequency</option>
                                            {FREQUENCY_OPTIONS.map((opt) => (
                                                <option key={opt} value={opt}>{opt}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-field">
                                        <label>Business Purpose</label>
                                        <textarea
                                            value={editForm.businessPurpose}
                                            onChange={(e) => setEditForm({ ...editForm, businessPurpose: e.target.value })}
                                            className="edit-select modal-textarea"
                                            rows={2}
                                        />
                                    </div>
                                    <div className="form-field">
                                        <label>Data Exchanged</label>
                                        <textarea
                                            value={editForm.dataExchanged}
                                            onChange={(e) => setEditForm({ ...editForm, dataExchanged: e.target.value })}
                                            className="edit-select modal-textarea"
                                            rows={2}
                                        />
                                    </div>
                                    <div className="form-field">
                                        <label>Notes</label>
                                        <textarea
                                            value={editForm.notes}
                                            onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                                            className="edit-select modal-textarea"
                                            rows={2}
                                        />
                                    </div>
                                </div>
                                <div className="modal-actions">
                                    <button
                                        className="btn btn-primary"
                                        onClick={() => saveEditIntegration(editingIntegrationId)}
                                        disabled={savingId === editingIntegrationId}
                                    >
                                        {savingId === editingIntegrationId ? "Saving..." : "Save"}
                                    </button>
                                    <button
                                        className="btn btn-sm"
                                        onClick={cancelEditIntegration}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })()}
            </CollapsibleSection>
        </div>
    );
}

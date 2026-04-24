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
}

interface AdminUser {
    id: string;
    entraObjectId: string | null;
    email: string;
    displayName: string;
    role: string;
    isActive: boolean;
    updatedAt: string | null;
}

export default function AdminPage() {
    const { permissions, loading: permissionsLoading } = usePermissions();
    const [capabilities, setCapabilities] = useState<Capability[]>([]);
    const [applications, setApplications] = useState<Application[]>([]);
    const [integrations, setIntegrations] = useState<Integration[]>([]);
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [usersLoading, setUsersLoading] = useState(true);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
    const [editingIntegrationId, setEditingIntegrationId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({ sourceApplicationId: "", targetApplicationId: "", integrationType: "", notes: "" });
    const [savingId, setSavingId] = useState<string | null>(null);

    const [newUserEmail, setNewUserEmail] = useState("");
    const [newUserRole, setNewUserRole] = useState("Viewer");
    const [addingUser, setAddingUser] = useState(false);

    const INTEGRATION_TYPES = ["API", "File Transfer", "SSO", "Manual Import", "Webhook", "Database Sync", "Other"];

    useEffect(() => {
        loadData();
        loadUsers();
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

    function loadUsers() {
        setUsersLoading(true);
        fetch("/api/admin/users", { headers: getAuthHeaders() })
            .then((res) => (res.ok ? res.json() : []))
            .then((data) => setUsers(data))
            .catch(() => setUsers([]))
            .finally(() => setUsersLoading(false));
    }

    async function handleAddUser() {
        if (!newUserEmail.trim()) return;
        setAddingUser(true);
        try {
            const res = await fetch("/api/admin/users", {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify({ email: newUserEmail, role: newUserRole }),
            });
            if (res.ok) {
                setNewUserEmail("");
                setNewUserRole("Viewer");
                loadUsers();
            }
        } finally {
            setAddingUser(false);
        }
    }

    async function handleUpdateUserRole(userId: string, role: string) {
        setSavingId(userId);
        try {
            await fetch(`/api/admin/users/${userId}`, {
                method: "PUT",
                headers: getAuthHeaders(),
                body: JSON.stringify({ role }),
            });
            loadUsers();
        } finally {
            setSavingId(null);
        }
    }

    async function handleToggleUserActive(userId: string, isActive: boolean) {
        setSavingId(userId);
        try {
            await fetch(`/api/admin/users/${userId}`, {
                method: "PUT",
                headers: getAuthHeaders(),
                body: JSON.stringify({ isActive }),
            });
            loadUsers();
        } finally {
            setSavingId(null);
        }
    }

    async function handleDeleteUser(userId: string) {
        if (!window.confirm("Deactivate this user?")) return;
        setSavingId(userId);
        try {
            await fetch(`/api/admin/users/${userId}`, {
                method: "PUT",
                headers: getAuthHeaders(),
                body: JSON.stringify({ isActive: false }),
            });
            loadUsers();
        } finally {
            setSavingId(null);
        }
    }

    async function handleDeleteCapability(id: string, name: string) {
        if (!window.confirm(`Are you sure you want to delete "${name}"?`)) {
            return;
        }

        setDeletingId(id);
        setDeleteError(null);

        try {
            const res = await fetch(`/api/capabilities/${id}`, {
                method: "DELETE",
                headers: getAuthHeaders(),
            });

            if (!res.ok) {
                const data = await res.json();
                setDeleteError(data.error || "Failed to delete capability");
                return;
            }

            loadData();
        } catch (err) {
            setDeleteError("Failed to delete capability");
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
        setEditForm({
            sourceApplicationId: int.sourceApplicationId,
            targetApplicationId: int.targetApplicationId,
            integrationType: int.integrationType,
            notes: int.notes,
        });
    }

    function cancelEditIntegration() {
        setEditingIntegrationId(null);
        setEditForm({ sourceApplicationId: "", targetApplicationId: "", integrationType: "", notes: "" });
    }

    async function saveEditIntegration(id: string) {
        if (!editForm.sourceApplicationId || !editForm.targetApplicationId) {
            return;
        }

        setSavingId(id);
        setDeleteError(null);

        try {
            const res = await fetch(`/api/integrations/${id}`, {
                method: "PUT",
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    sourceApplicationId: editForm.sourceApplicationId,
                    targetApplicationId: editForm.targetApplicationId,
                    integrationType: editForm.integrationType,
                    notes: editForm.notes,
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                setDeleteError(data.error || "Failed to update integration");
                return;
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
                                <th>Source Application</th>
                                <th>Target Application</th>
                                <th>Type</th>
                                <th>Notes</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {integrations.map((int) => (
                                <tr key={int.id}>
                                    {editingIntegrationId === int.id ? (
                                        <>
                                            <td>
                                                <select
                                                    value={editForm.sourceApplicationId}
                                                    onChange={(e) => setEditForm({ ...editForm, sourceApplicationId: e.target.value })}
                                                    className="edit-select"
                                                >
                                                    <option value="">Select Source</option>
                                                    {applications.map((app) => (
                                                        <option key={app.id} value={app.id}>{app.name}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td>
                                                <select
                                                    value={editForm.targetApplicationId}
                                                    onChange={(e) => setEditForm({ ...editForm, targetApplicationId: e.target.value })}
                                                    className="edit-select"
                                                >
                                                    <option value="">Select Target</option>
                                                    {applications.map((app) => (
                                                        <option key={app.id} value={app.id}>{app.name}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td>
                                                <select
                                                    value={editForm.integrationType}
                                                    onChange={(e) => setEditForm({ ...editForm, integrationType: e.target.value })}
                                                    className="edit-select"
                                                >
                                                    <option value="">Select Type</option>
                                                    {INTEGRATION_TYPES.map((type) => (
                                                        <option key={type} value={type}>{type}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td>
                                                <input
                                                    type="text"
                                                    value={editForm.notes}
                                                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                                                    className="edit-input"
                                                    placeholder="Notes"
                                                />
                                            </td>
                                            <td>
                                                <button
                                                    className="admin-link"
                                                    onClick={() => saveEditIntegration(int.id)}
                                                    disabled={savingId === int.id}
                                                >
                                                    {savingId === int.id ? "Saving..." : "Save"}
                                                </button>
                                                <button
                                                    className="admin-link"
                                                    onClick={cancelEditIntegration}
                                                >
                                                    Cancel
                                                </button>
                                            </td>
                                        </>
                                    ) : (
                                        <>
                                            <td>{int.sourceApplicationName}</td>
                                            <td>{int.targetApplicationName}</td>
                                            <td>{int.integrationType || "—"}</td>
                                            <td>{int.notes || "—"}</td>
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
                                        </>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </CollapsibleSection>

            <CollapsibleSection title="User Management" sectionKey="users">
                {usersLoading ? (
                    <p>Loading...</p>
                ) : (
                    <>
                        <div className="add-user-form">
                            <input type="email" placeholder="User email" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} className="edit-input" />
                            <select value={newUserRole} onChange={(e) => setNewUserRole(e.target.value)} className="edit-select">
                                <option value="Viewer">Viewer</option>
                                <option value="Editor">Editor</option>
                                <option value="PlatformAdmin">PlatformAdmin</option>
                            </select>
                            <button className="admin-btn" onClick={handleAddUser} disabled={addingUser || !newUserEmail.trim()}>
                                {addingUser ? "Adding..." : "Add User"}
                            </button>
                        </div>
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>Role</th>
                                    <th>Active</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((user) => (
                                    <tr key={user.id}>
                                        <td>{user.displayName || "—"}</td>
                                        <td>{user.email}</td>
                                        <td>
                                            <select value={user.role} onChange={(e) => handleUpdateUserRole(user.id, e.target.value)} disabled={savingId === user.id} className="edit-select">
                                                <option value="Viewer">Viewer</option>
                                                <option value="Editor">Editor</option>
                                                <option value="PlatformAdmin">PlatformAdmin</option>
                                            </select>
                                        </td>
                                        <td>
                                            <input type="checkbox" checked={user.isActive} onChange={(e) => handleToggleUserActive(user.id, e.target.checked)} disabled={savingId === user.id} />
                                        </td>
                                        <td>
                                            <button className="admin-link danger" onClick={() => handleDeleteUser(user.id)} disabled={savingId === user.id || !user.isActive}>
                                                {savingId === user.id ? "Saving..." : "Deactivate"}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </>
                )}
            </CollapsibleSection>
        </div>
    );
}

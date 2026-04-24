import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { usePermissions, isPlatformAdmin } from "../../hooks/usePermissions";
import { getAuthHeaders } from "../../utils/authHeaders";
import "./AdminPage.css";

interface AdminUser {
    id: string;
    entraObjectId: string | null;
    email: string;
    displayName: string;
    role: string;
    isActive: boolean;
    updatedAt: string | null;
}

const ROLES = ["Viewer", "Editor", "PlatformAdmin"];

export default function AdminUsersPage() {
    const { permissions, loading: permissionsLoading } = usePermissions();
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const [newEmail, setNewEmail] = useState("");
    const [newDisplayName, setNewDisplayName] = useState("");
    const [newRole, setNewRole] = useState("Viewer");
    const [adding, setAdding] = useState(false);

    useEffect(() => {
        loadUsers();
    }, []);

    function loadUsers() {
        setLoading(true);
        fetch("/api/admin/users", { headers: getAuthHeaders() })
            .then((res) => (res.ok ? res.json() : []))
            .then((data) => setUsers(data))
            .catch(() => setUsers([]))
            .finally(() => setLoading(false));
    }

    async function handleAddUser() {
        if (!newEmail.trim()) return;
        setAdding(true);
        setError(null);
        try {
            const res = await fetch("/api/admin/users", {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    email: newEmail.trim(),
                    displayName: newDisplayName.trim() || undefined,
                    role: newRole,
                }),
            });
            if (res.ok) {
                setNewEmail("");
                setNewDisplayName("");
                setNewRole("Viewer");
                loadUsers();
            } else {
                const data = await res.json();
                setError(data.error || "Failed to add user");
            }
        } finally {
            setAdding(false);
        }
    }

    async function handleUpdateRole(userId: string, role: string) {
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

    async function handleToggleActive(userId: string, isActive: boolean) {
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

    return (
        <div className="admin-page">
            <header className="page-header">
                <h1>User Management</h1>
                <Link to="/admin" className="back-link">Back to Admin</Link>
            </header>

            <div className="admin-section">
                <h2>Add User</h2>
                {error && <div className="form-error">{error}</div>}
                <div className="add-user-form">
                    <div className="form-field">
                        <label htmlFor="newEmail">Email *</label>
                        <input
                            id="newEmail"
                            type="email"
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                            placeholder="user@example.com"
                            className="user-input"
                        />
                    </div>
                    <div className="form-field">
                        <label htmlFor="newDisplayName">Display Name</label>
                        <input
                            id="newDisplayName"
                            type="text"
                            value={newDisplayName}
                            onChange={(e) => setNewDisplayName(e.target.value)}
                            placeholder="Optional name"
                            className="user-input"
                        />
                    </div>
                    <div className="form-field">
                        <label htmlFor="newRole">Role</label>
                        <select
                            id="newRole"
                            value={newRole}
                            onChange={(e) => setNewRole(e.target.value)}
                            className="user-select"
                        >
                            {ROLES.map((r) => (
                                <option key={r} value={r}>{r}</option>
                            ))}
                        </select>
                    </div>
                    <button className="admin-btn" onClick={handleAddUser} disabled={adding || !newEmail.trim()}>
                        {adding ? "Adding..." : "Add User"}
                    </button>
                </div>
            </div>

            <div className="admin-section">
                <h2>Users</h2>
                {loading ? (
                    <p>Loading...</p>
                ) : users.length === 0 ? (
                    <p>No users found.</p>
                ) : (
                    <div className="user-table-container">
                        <table className="user-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>Role</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((user) => (
                                    <tr key={user.id}>
                                        <td>{user.displayName || "—"}</td>
                                        <td>{user.email}</td>
                                        <td>
                                            <select
                                                value={user.role}
                                                onChange={(e) => handleUpdateRole(user.id, e.target.value)}
                                                disabled={savingId === user.id}
                                                className="edit-select"
                                            >
                                                {ROLES.map((r) => (
                                                    <option key={r} value={r}>{r}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td>
                                            <span className={user.isActive ? "status-active" : "status-inactive"}>
                                                {user.isActive ? "Active" : "Inactive"}
                                            </span>
                                        </td>
                                        <td>
                                            <button
                                                className={`user-table-btn ${user.isActive ? "outline-danger" : "outline-secondary"}`}
                                                onClick={() => handleToggleActive(user.id, !user.isActive)}
                                                disabled={savingId === user.id}
                                            >
                                                {savingId === user.id ? "Saving..." : user.isActive ? "Deactivate" : "Reactivate"}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
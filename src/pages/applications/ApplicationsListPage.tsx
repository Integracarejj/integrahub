// src/pages/applications/ApplicationsListPage.tsx
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { usePermissions, isPlatformAdmin } from "../../hooks/usePermissions";
import "./ApplicationsListPage.css";

interface ApiApplication {
    id: string;
    name: string;
    description?: string;
    capabilityId: string;
    capabilityName: string;
    status: string;
    purpose?: string;
    vendor?: string;
    businessContext: {
        purpose?: string;
        businessCriticality: string;
        impactIfDown: string;
    };
    ownership: {
        businessOwner: string;
        technicalOwner?: string;
    };
}

interface Capability {
    id: string;
    name: string;
}

function filterApplications(
    apps: ApiApplication[],
    query: string
): ApiApplication[] {
    const terms = query
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter((t) => t.length > 0);

    if (terms.length === 0) {
        return apps;
    }

    return apps.filter((app) => {
        const purpose = app.purpose ?? app.businessContext.purpose;
        const searchableText = [
            app.name,
            app.description ?? "",
            purpose ?? "",
            app.vendor ?? "",
            app.businessContext.impactIfDown,
            app.businessContext.businessCriticality,
            app.ownership.businessOwner,
            app.ownership.technicalOwner ?? "",
        ]
            .join(" ")
            .toLowerCase();

        return terms.some((term) => searchableText.includes(term));
    });
}

const CRITICALITY_ORDER: Record<string, number> = {
    Critical: 1,
    High: 2,
    Medium: 3,
    Low: 4,
};

const CRITICALITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    Critical: { bg: "#fef2f2", text: "#991b1b", border: "#fecaca" },
    High: { bg: "#fff7ed", text: "#c2410c", border: "#fed7aa" },
    Medium: { bg: "#fefce8", text: "#a16207", border: "#fde047" },
    Low: { bg: "#f0fdf4", text: "#15803d", border: "#bbf7d0" },
};

function sortApplications(apps: ApiApplication[]): ApiApplication[] {
    return [...apps].sort((a, b) => {
        const critA = CRITICALITY_ORDER[a.businessContext.businessCriticality] ?? 99;
        const critB = CRITICALITY_ORDER[b.businessContext.businessCriticality] ?? 99;
        if (critA !== critB) return critA - critB;
        return a.name.localeCompare(b.name);
    });
}

export default function ApplicationsListPage() {
    const [applications, setApplications] = useState<ApiApplication[]>([]);
    const [capabilities, setCapabilities] = useState<Capability[]>([]);
    const [users, setUsers] = useState<{ id: string; displayName: string; email: string; isActive: boolean }[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editingOwnerId, setEditingOwnerId] = useState<string | null>(null);
    const [selectedOwner, setSelectedOwner] = useState("");
    const [savingOwner, setSavingOwner] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    const { permissions } = usePermissions();
    const isAdmin = isPlatformAdmin(permissions);

    useEffect(() => {
        fetch("/api/capabilities")
            .then((res) => res.ok ? res.json() : [])
            .then((data) => setCapabilities(data))
            .catch(() => setCapabilities([]));
    }, []);

    useEffect(() => {
        fetch("/api/admin/users", { headers: { "Content-Type": "application/json" } })
            .then((res) => res.ok ? res.json() : [])
            .then((data) => setUsers(data.filter((u: { isActive: boolean }) => u.isActive)))
            .catch(() => setUsers([]));
    }, []);

    useEffect(() => {
        fetch("/api/applications")
            .then((res) => {
                if (!res.ok) throw new Error("Failed to load applications");
                return res.json();
            })
            .then((data) => {
                setApplications(data);
                setLoading(false);
            })
            .catch((err) => {
                setError(err.message);
                setLoading(false);
            });
    }, []);

    const [searchParams] = useSearchParams();
    const initialSearch = searchParams.get("search") || "";
    const initialCapability = searchParams.get("capability") || "";
    const initialStatus = searchParams.get("status") || "";
    const initialCriticality = searchParams.get("criticality") || "";
    const [search, setSearch] = useState(initialSearch);
    const [capabilityFilter, setCapabilityFilter] = useState(initialCapability);
    const [statusFilter, setStatusFilter] = useState(initialStatus);
    const [criticalityFilter, setCriticalityFilter] = useState(initialCriticality);
    const [showInactive, setShowInactive] = useState(false);

    useEffect(() => {
        setSearch(searchParams.get("search") || "");
        setCapabilityFilter(searchParams.get("capability") || "");
        setStatusFilter(searchParams.get("status") || "");
        setCriticalityFilter(searchParams.get("criticality") || "");
    }, [searchParams]);

    const filteredApps = useMemo(() => {
        let result = applications;

        result = filterApplications(result, search);

        result = result.filter((app) => {
            if (!showInactive && app.status !== "Active") return false;
            return true;
        });

        if (capabilityFilter) {
            result = result.filter((app) => app.capabilityId === capabilityFilter);
        }

        if (statusFilter) {
            result = result.filter((app) => app.status === statusFilter);
        }

        if (criticalityFilter) {
            result = result.filter((app) => app.businessContext.businessCriticality === criticalityFilter);
        }

        return sortApplications(result);
    }, [applications, search, capabilityFilter, statusFilter, criticalityFilter, showInactive]);

    async function handleSaveOwner(appId: string) {
        if (!selectedOwner) return;
        setSavingOwner(true);
        setSaveError(null);
        try {
            const app = applications.find((a) => a.id === appId);
            if (!app) return;

            const res = await fetch(`/api/applications/${appId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: app.name,
                    capabilityId: app.capabilityId,
                    status: app.status || "Active",
                    type: (app as { type?: string }).type || "Standard",
                    businessOwner: app.ownership.businessOwner || "",
                    businessCriticality: app.businessContext.businessCriticality || "Medium",
                    impactIfDown: app.businessContext.impactIfDown || "",
                    technicalOwner: selectedOwner,
                }),
            });
            if (res.ok) {
                setApplications((prev) =>
                    prev.map((a) =>
                        a.id === appId
                            ? { ...a, ownership: { ...a.ownership, technicalOwner: selectedOwner } }
                            : a
                    )
                );
                setEditingOwnerId(null);
                setSelectedOwner("");
            } else {
                const data = await res.json();
                setSaveError(data.detail || data.error || "Failed to save");
            }
        } catch {
            setSaveError("Failed to save");
        } finally {
            setSavingOwner(false);
        }
    }

    async function handleClearOwner(appId: string) {
        if (!window.confirm("Remove this Technical Owner?")) return;
        setSavingOwner(true);
        setSaveError(null);
        try {
            const app = applications.find((a) => a.id === appId);
            if (!app) return;

            const res = await fetch(`/api/applications/${appId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: app.name,
                    capabilityId: app.capabilityId,
                    status: app.status || "Active",
                    type: (app as { type?: string }).type || "Standard",
                    businessOwner: app.ownership.businessOwner || "",
                    businessCriticality: app.businessContext.businessCriticality || "Medium",
                    impactIfDown: app.businessContext.impactIfDown || "",
                    technicalOwner: "",
                }),
            });
            if (res.ok) {
                setApplications((prev) =>
                    prev.map((a) =>
                        a.id === appId
                            ? { ...a, ownership: { ...a.ownership, technicalOwner: "" } }
                            : a
                    )
                );
            } else {
                const data = await res.json();
                setSaveError(data.error || "Failed to clear");
            }
        } catch {
            setSaveError("Failed to clear");
        } finally {
            setSavingOwner(false);
        }
    }

    if (loading) {
        return <div className="applications-page">Loading applications...</div>;
    }

    if (error) {
        return <div className="applications-page">Failed to load applications.</div>;
    }

    return (
        <div className="applications-page">
            <header className="page-header">
                <h1>Applications</h1>
                <div className="header-actions">
                    {isAdmin && <Link to="/admin" className="create-btn secondary">Admin</Link>}
                    <Link to="/applications/new" className="create-btn">Create Application</Link>
                </div>
            </header>

            <div className="filters">
                <input
                    type="text"
                    placeholder="Search by name, owner, vendor, or description"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />

                <select
                    value={capabilityFilter}
                    onChange={(e) => setCapabilityFilter(e.target.value)}
                >
                    <option value="">All Capabilities</option>
                    {capabilities.map((cap) => (
                        <option key={cap.id} value={cap.id}>
                            {cap.name}
                        </option>
                    ))}
                </select>

                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                >
                    <option value="">All Statuses</option>
                    <option value="Active">Active</option>
                    <option value="Planned">Planned</option>
                    <option value="Retired">Retired</option>
                </select>

                <select
                    value={criticalityFilter}
                    onChange={(e) => setCriticalityFilter(e.target.value)}
                >
                    <option value="">All Criticality</option>
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                </select>

                <label className="toggle">
                    <input
                        type="checkbox"
                        checked={showInactive}
                        onChange={(e) => setShowInactive(e.target.checked)}
                    />
                    Show inactive
                </label>
            </div>

            {(search || capabilityFilter || statusFilter || criticalityFilter) && (
                <div className="filter-summary">
                    {search && <span className="filter-tag">Search: {search}</span>}
                    {capabilityFilter && (
                        <span className="filter-tag">
                            Capability: {capabilities.find((c) => c.id === capabilityFilter)?.name || capabilityFilter}
                        </span>
                    )}
                    {statusFilter && <span className="filter-tag">Status: {statusFilter}</span>}
                    {criticalityFilter && <span className="filter-tag">Criticality: {criticalityFilter}</span>}
                    <Link to="/applications" className="clear-filters">Clear filters</Link>
                </div>
            )}

            <table className="applications-table">
                <thead>
                    <tr>
                        <th>Application</th>
                        <th>Capability</th>
                        <th>Status</th>
                        <th>Criticality</th>
                        <th>Business Owner</th>
                        <th>Technical Owner</th>
                        <th>Vendor</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredApps.map((app) => {
                        const colors = CRITICALITY_COLORS[app.businessContext.businessCriticality] || CRITICALITY_COLORS.Low;
                        const missingOwner = !app.ownership.technicalOwner;
                        return (
                            <tr key={app.id}>
                                <td>
                                    <Link to={`/applications/${app.id}`} className="app-name">
                                        {app.name}
                                    </Link>
                                </td>
                                <td>
                                    <Link to={`/capabilities/${app.capabilityId}`}>
                                        {app.capabilityName}
                                    </Link>
                                </td>
                                <td>{app.status}</td>
                                <td>
                                    <span
                                        className="criticality-badge"
                                        style={{
                                            backgroundColor: colors.bg,
                                            color: colors.text,
                                            borderColor: colors.border,
                                        }}
                                    >
                                        {app.businessContext.businessCriticality}
                                    </span>
                                </td>
                                <td>{app.ownership.businessOwner || "—"}</td>
                                <td>
                                    {editingOwnerId === app.id ? (
                                        <div className="owner-edit">
                                            {saveError && <span className="owner-error">{saveError}</span>}
                                            <select
                                                value={selectedOwner}
                                                onChange={(e) => setSelectedOwner(e.target.value)}
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
                                                onClick={() => handleSaveOwner(app.id)}
                                                disabled={savingOwner || !selectedOwner}
                                            >
                                                {savingOwner ? "..." : "Save"}
                                            </button>
                                            <button
                                                className="owner-cancel-btn"
                                                onClick={() => {
                                                    setEditingOwnerId(null);
                                                    setSelectedOwner("");
                                                }}
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    ) : missingOwner ? (
                                        isAdmin ? (
                                            <button
                                                className="owner-missing"
                                                onClick={() => {
                                                    setEditingOwnerId(app.id);
                                                    setSelectedOwner("");
                                                    setSaveError(null);
                                                }}
                                            >
                                                + Assign
                                            </button>
                                        ) : (
                                            <span className="owner-badge">Needs owner</span>
                                        )
                                    ) : (
                                        isAdmin ? (
                                            <div className="owner-display">
                                                <span>{app.ownership.technicalOwner}</span>
                                                <button
                                                    className="owner-action-btn"
                                                    onClick={() => {
                                                        setEditingOwnerId(app.id);
                                                        setSelectedOwner(app.ownership.technicalOwner || "");
                                                        setSaveError(null);
                                                    }}
                                                >
                                                    Change
                                                </button>
                                                <button
                                                    className="owner-action-btn owner-clear-btn"
                                                    onClick={() => handleClearOwner(app.id)}
                                                >
                                                    Clear
                                                </button>
                                            </div>
                                        ) : (
                                            app.ownership.technicalOwner
                                        )
                                    )}
                                </td>
                                <td>{app.vendor || "—"}</td>
                                <td>
                                    <Link
                                        to={`/applications/${app.id}`}
                                        className="action-link"
                                    >
                                        View
                                    </Link>
                                </td>
                            </tr>
                        );
                    })}

                    {filteredApps.length === 0 && (
                        <tr>
                            <td colSpan={8} className="empty">
                                No applications match the current filters.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
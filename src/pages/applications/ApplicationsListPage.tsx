// src/pages/applications/ApplicationsListPage.tsx
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
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
        ]
            .join(" ")
            .toLowerCase();

        return terms.some((term) => searchableText.includes(term));
    });
}

export default function ApplicationsListPage() {
    const [applications, setApplications] = useState<ApiApplication[]>([]);
    const [capabilities, setCapabilities] = useState<Capability[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch("/api/capabilities")
            .then((res) => res.ok ? res.json() : [])
            .then((data) => setCapabilities(data))
            .catch(() => setCapabilities([]));
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
            // type filter bypassed - API doesn't return type field yet
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

        return result;
    }, [applications, search, capabilityFilter, statusFilter, criticalityFilter, showInactive]);

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
                    <Link to="/admin" className="create-btn secondary">Admin</Link>
                    <Link to="/applications/new" className="create-btn">Create Application</Link>
                </div>
            </header>

            <div className="filters">
                <input
                    type="text"
                    placeholder="Search by name, description, or purpose"
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
                        <th>Name</th>
                        <th>Description</th>
                        <th>Purpose</th>
                        <th>Vendor</th>
                        <th>Capability</th>
                        <th>Criticality</th>
                        <th>Impact If Down</th>
                        <th>Owner</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredApps.map((app) => {
                        const purpose = app.purpose ?? app.businessContext.purpose;
                        return (
                        <tr key={app.id}>
                            <td>
                                <Link to={`/applications/${app.id}`}>{app.name}</Link>
                            </td>
                            <td>{app.description || "—"}</td>
                            <td>{purpose || "—"}</td>
                            <td>{app.vendor || "—"}</td>
                            <td><Link to={`/capabilities/${app.capabilityId}`}>{app.capabilityName}</Link></td>
                            <td>{app.businessContext.businessCriticality}</td>
                            <td>{app.businessContext.impactIfDown}</td>
                            <td>{app.ownership.businessOwner}</td>
                            <td>{app.status}</td>
                        </tr>
                        );
                    })}

                    {filteredApps.length === 0 && (
                        <tr>
                            <td colSpan={9} className="empty">
                                No applications match your filters.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}

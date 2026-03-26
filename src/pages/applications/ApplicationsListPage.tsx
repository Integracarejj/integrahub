// src/pages/applications/ApplicationsListPage.tsx
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getApplications, getCapabilities, getCapabilityName } from "../../services/applicationService";
import "./ApplicationsListPage.css";

export default function ApplicationsListPage() {
    const applications = getApplications();
    const capabilities = getCapabilities();

    const [search, setSearch] = useState("");
    const [capabilityFilter, setCapabilityFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [showInactive, setShowInactive] = useState(false);

    const filteredApps = useMemo(() => {
        return applications.filter((app) => {
            // Default behavior rules
            if (!showInactive && app.status !== "Active") return false;
            if (app.type === "Platform") return false;

            if (search && !app.name.toLowerCase().includes(search.toLowerCase())) {
                return false;
            }

            if (capabilityFilter && app.capabilityId !== capabilityFilter) {
                return false;
            }

            if (statusFilter && app.status !== statusFilter) {
                return false;
            }

            return true;
        });
    }, [applications, search, capabilityFilter, statusFilter, showInactive]);

    return (
        <div className="applications-page">
            <header className="page-header">
                <h1>Applications</h1>
            </header>

            <div className="filters">
                <input
                    type="text"
                    placeholder="Search applications..."
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
                    <option value="Legacy">Legacy</option>
                    <option value="Sunset">Sunset</option>
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

            <table className="applications-table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Capability</th>
                        <th>Owner</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredApps.map((app) => (
                        <tr key={app.id}>
                            <td>
                                <Link to={`/applications/${app.id}`}>{app.name}</Link>
                            </td>
                            <td>{getCapabilityName(app.capabilityId)}</td>
                            <td>{app.owner}</td>
                            <td>{app.status}</td>
                        </tr>
                    ))}

                    {filteredApps.length === 0 && (
                        <tr>
                            <td colSpan={4} className="empty">
                                No applications match your filters.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}

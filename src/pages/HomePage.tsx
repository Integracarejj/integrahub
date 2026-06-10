import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getDashboardDataQuality } from "../services/dashboardService";
import type { DashboardDataQualityMetrics, DashboardDataQualityLists } from "../types/dashboard";
import "./HomePage.css";

interface ApiApplication {
    id: string;
    name: string;
    status: string;
    systemCategory?: string | null;
    architectureType?: string | null;
    mobileSupportType?: string | null;
    apiAvailability?: string | null;
    reportingSource?: string | null;
    vendor?: string;
    businessContext: {
        businessCriticality?: string;
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

function isValueUseful(val: string | null | undefined): boolean {
    if (!val) return false;
    const v = val.trim().toLowerCase();
    return v !== "" && v !== "none" && v !== "no" && v !== "unknown";
}

export default function HomePage() {
    const navigate = useNavigate();
    const [applications, setApplications] = useState<ApiApplication[]>([]);
    const [capabilities, setCapabilities] = useState<Capability[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [dqMetrics, setDqMetrics] = useState<DashboardDataQualityMetrics | null>(null);
    const [dqLists, setDqLists] = useState<DashboardDataQualityLists | null>(null);
    const [dqLoading, setDqLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            fetch("/api/applications").then((res) => res.ok ? res.json() : []),
            fetch("/api/capabilities").then((res) => res.ok ? res.json() : []),
        ])
            .then(([apps, caps]) => {
                setApplications(apps);
                setCapabilities(caps);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    useEffect(() => {
        getDashboardDataQuality()
            .then(data => {
                setDqMetrics(data.metrics);
                setDqLists(data.lists);
                setDqLoading(false);
            })
            .catch(err => {
                console.error("Data Quality fetch failed:", err);
                setDqLoading(false);
            });
    }, []);

    const stats = useMemo(() => {
        const total = applications.length;
        const mobileCapable = applications.filter((app) =>
            isValueUseful(app.mobileSupportType)
        ).length;
        const apiEnabled = applications.filter((app) =>
            isValueUseful(app.apiAvailability)
        ).length;
        const reportingSource = applications.filter((app) =>
            isValueUseful(app.reportingSource)
        ).length;
        const critical = applications.filter(
            (app) => app.businessContext?.businessCriticality === "Critical"
        ).length;
        return { total, mobileCapable, apiEnabled, reportingSource, critical };
    }, [applications]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (search.trim()) {
            navigate(`/applications?search=${encodeURIComponent(search.trim())}`);
        }
    };

    const handleCapabilityClick = (capabilityId: string) => {
        navigate(`/applications?capability=${encodeURIComponent(capabilityId)}`);
    };

    if (loading) {
        return <div className="home-page">Loading...</div>;
    }

    return (
        <div className="home-page">
            <section className="home-search">
                <form onSubmit={handleSearch}>
                    <input
                        type="text"
                        className="home-search-input"
                        placeholder="Search systems, capabilities, or keywords..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </form>
            </section>

            <section className="home-stats">
                <Link to="/applications" className="stat-card stat-blue">
                    <span className="stat-value">{stats.total}</span>
                    <span className="stat-label">Total Systems</span>
                </Link>
                <Link to="/applications" className="stat-card stat-indigo">
                    <span className="stat-value">{stats.mobileCapable}</span>
                    <span className="stat-label">Mobile Capable</span>
                </Link>
                <Link to="/applications" className="stat-card stat-teal">
                    <span className="stat-value">{stats.apiEnabled}</span>
                    <span className="stat-label">API Enabled</span>
                </Link>
                <Link to="/applications" className="stat-card stat-amber">
                    <span className="stat-value">{stats.reportingSource}</span>
                    <span className="stat-label">Reporting Source</span>
                </Link>
                <Link to="/applications?criticality=Critical" className="stat-card stat-red">
                    <span className="stat-value">{stats.critical}</span>
                    <span className="stat-label">Critical Systems</span>
                </Link>
            </section>

            <section className="home-capabilities">
                <h2 className="section-title">Browse by Capability</h2>
                <div className="capability-grid">
                    {capabilities.map((cap) => (
                        <button
                            key={cap.id}
                            className="capability-card"
                            onClick={() => handleCapabilityClick(cap.id)}
                        >
                            {cap.name}
                        </button>
                    ))}
                </div>
            </section>

            {!dqLoading && dqMetrics && dqLists && (
                <section className="si-section">
                    <h2 className="section-title">System Intelligence</h2>
                    <p className="si-subtitle">Understand system reach, role coverage, and integration concentration.</p>

                    <div className="si-grid">
                        <div className="si-card">
                            <h3 className="si-card-title">Most Used Systems</h3>
                            <p className="si-card-subtitle">Top systems by role assignments</p>
                            <div className="si-card-list">
                                {dqLists.mostUsedSystemsByRoleCount.length === 0 ? (
                                    <span className="si-empty">No role mappings yet</span>
                                ) : (
                                    dqLists.mostUsedSystemsByRoleCount.slice(0, 5).map(s => (
                                        <Link key={s.id} to={`/applications/${s.id}`} className="si-card-item">
                                            <span className="si-item-name">{s.name}</span>
                                            <span className="si-item-stat">{s.roleCount} role{s.roleCount !== 1 ? "s" : ""}</span>
                                        </Link>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="si-card">
                            <h3 className="si-card-title">Most Connected Systems</h3>
                            <p className="si-card-subtitle">Top systems by integration count</p>
                            <div className="si-card-list">
                                {dqLists.mostConnectedSystems.length === 0 ? (
                                    <span className="si-empty">No integrations yet</span>
                                ) : (
                                    dqLists.mostConnectedSystems.slice(0, 5).map(s => (
                                        <Link key={s.id} to={`/applications/${s.id}`} className="si-card-item">
                                            <span className="si-item-name">{s.name}</span>
                                            <span className="si-item-stat">{s.connectionCount} connection{s.connectionCount !== 1 ? "s" : ""}</span>
                                        </Link>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="si-card">
                            <h3 className="si-card-title">Coverage Snapshot</h3>
                            <p className="si-card-subtitle">Role and integration coverage</p>
                            <div className="si-coverage">
                                <div className="si-coverage-row">
                                    <span className="si-coverage-label">Systems with role mappings</span>
                                    <span className="si-coverage-value si-coverage-good">{dqMetrics.systemsWithRoles}</span>
                                </div>
                                <div className="si-coverage-row">
                                    <span className="si-coverage-label">Systems with integrations</span>
                                    <span className="si-coverage-value si-coverage-good">{dqMetrics.systemsWithIntegrations}</span>
                                </div>
                                <div className="si-coverage-row">
                                    <span className="si-coverage-label">Systems without role mappings</span>
                                    <span className="si-coverage-value si-coverage-warn">{dqMetrics.systemsWithoutRoleMappings}</span>
                                </div>
                                <div className="si-coverage-row">
                                    <span className="si-coverage-label">Systems without integrations</span>
                                    <span className="si-coverage-value si-coverage-warn">{dqMetrics.systemsWithoutIntegrations}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            )}
        </div>
    );
}

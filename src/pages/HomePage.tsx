import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getDashboardDataQuality } from "../services/dashboardService";
import type { DashboardDataQualityMetrics, DashboardDataQualityLists } from "../types/dashboard";
import "./HomePage.css";

interface ApiApplication {
    id: string;
    name: string;
    status: string;
    businessContext: {
        businessCriticality?: string;
    };
}

interface Capability {
    id: string;
    name: string;
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
        const critical = applications.filter(
            (app) => (app as { businessContext?: { businessCriticality?: string } }).businessContext?.businessCriticality === "Critical"
        ).length;
        const planned = applications.filter(
            (app) => app.status === "Planned"
        ).length;
        return { total, critical, planned, capabilities: capabilities.length };
    }, [applications, capabilities]);

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
                    <span className="stat-label">Total Applications</span>
                </Link>
                <Link to="/applications?criticality=Critical" className="stat-card stat-green">
                    <span className="stat-value">{stats.critical}</span>
                    <span className="stat-label">Critical Applications</span>
                </Link>
                <Link to="/applications?status=Planned" className="stat-card stat-purple">
                    <span className="stat-value">{stats.planned}</span>
                    <span className="stat-label">Planned</span>
                </Link>
                <Link to="/applications" className="stat-card stat-orange">
                    <span className="stat-value">{stats.capabilities}</span>
                    <span className="stat-label">Capabilities</span>
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

            <section className="dq-section">
                <h2 className="section-title">Data Quality</h2>
                <p className="dq-subtitle">Find missing ownership, incomplete system records, and cleanup opportunities.</p>

                {dqLoading ? (
                    <p className="dq-loading">Loading quality metrics…</p>
                ) : dqMetrics ? (
                    <>
                        <div className="dq-summary-cards">
                            <Link to="#missing-owners" className="dq-card dq-card-red">
                                <span className="dq-card-value">{dqMetrics.systemsMissingBusinessOwner + dqMetrics.systemsMissingTechnicalOwner}</span>
                                <span className="dq-card-label">Missing Owners</span>
                            </Link>
                            <Link to="#missing-context" className="dq-card dq-card-orange">
                                <span className="dq-card-value">{dqMetrics.systemsMissingOperationalContext}</span>
                                <span className="dq-card-label">Missing Operational Context</span>
                            </Link>
                            <Link to="#without-roles" className="dq-card dq-card-yellow">
                                <span className="dq-card-value">{dqMetrics.systemsWithoutRoleMappings}</span>
                                <span className="dq-card-label">Systems Without Roles</span>
                            </Link>
                            <Link to="#without-integrations" className="dq-card dq-card-purple">
                                <span className="dq-card-value">{dqMetrics.systemsWithoutIntegrations}</span>
                                <span className="dq-card-label">Systems Without Integrations</span>
                            </Link>
                            <Link to="#cleanup-integrations" className="dq-card dq-card-gray">
                                <span className="dq-card-value">{dqMetrics.testOrCleanupIntegrations}</span>
                                <span className="dq-card-label">Cleanup Integrations</span>
                            </Link>
                        </div>

                        <div className="dq-lists">
                            {dqLists && (
                                <>
                                    <div className="dq-list-section" id="missing-owners">
                                        <h3 className="dq-list-title">Ownership Needs Attention</h3>
                                        {dqLists.missingOwners.length === 0 ? (
                                            <p className="dq-empty">All systems have owners assigned.</p>
                                        ) : (
                                            <div className="dq-list-items">
                                                {dqLists.missingOwners.map(s => (
                                                    <Link key={s.id} to={`/applications/${s.id}`} className="dq-list-item">
                                                        <span className="dq-item-name">{s.name}</span>
                                                        <span className="dq-item-detail">
                                                            {s.businessOwner ? "" : "No business owner"} {s.businessOwner && !s.technicalOwner ? " / " : ""} {s.technicalOwner ? "" : "No technical owner"}
                                                        </span>
                                                        <span className={"dq-item-status " + s.status.toLowerCase()}>{s.status}</span>
                                                    </Link>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="dq-list-section" id="missing-context">
                                        <h3 className="dq-list-title">Missing Operational Context</h3>
                                        {dqLists.missingOperationalContext.length === 0 ? (
                                            <p className="dq-empty">All systems have operational context.</p>
                                        ) : (
                                            <div className="dq-list-items">
                                                {dqLists.missingOperationalContext.map(s => (
                                                    <Link key={s.id} to={`/applications/${s.id}`} className="dq-list-item">
                                                        <span className="dq-item-name">{s.name}</span>
                                                        <span className="dq-item-detail">Missing use cases, departments, access process, and training URL</span>
                                                        <span className={"dq-item-status " + s.status.toLowerCase()}>{s.status}</span>
                                                    </Link>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="dq-list-section" id="without-roles">
                                        <h3 className="dq-list-title">Systems Without Role Mappings</h3>
                                        {dqLists.systemsWithoutRoles.length === 0 ? (
                                            <p className="dq-empty">All systems have role mappings.</p>
                                        ) : (
                                            <div className="dq-list-items">
                                                {dqLists.systemsWithoutRoles.map(s => (
                                                    <Link key={s.id} to={`/applications/${s.id}`} className="dq-list-item">
                                                        <span className="dq-item-name">{s.name}</span>
                                                        <span className={"dq-item-status " + s.status.toLowerCase()}>{s.status}</span>
                                                    </Link>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="dq-list-section" id="without-integrations">
                                        <h3 className="dq-list-title">Systems Without Integrations</h3>
                                        {dqLists.systemsWithoutIntegrations.length === 0 ? (
                                            <p className="dq-empty">All systems have integrations.</p>
                                        ) : (
                                            <div className="dq-list-items">
                                                {dqLists.systemsWithoutIntegrations.map(s => (
                                                    <Link key={s.id} to={`/applications/${s.id}`} className="dq-list-item">
                                                        <span className="dq-item-name">{s.name}</span>
                                                        <span className={"dq-item-status " + s.status.toLowerCase()}>{s.status}</span>
                                                    </Link>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="dq-list-section" id="cleanup-integrations">
                                        <h3 className="dq-list-title">Possible Test / Cleanup Integrations</h3>
                                        {dqLists.possibleTestIntegrations.length === 0 ? (
                                            <p className="dq-empty">No suspicious integrations found.</p>
                                        ) : (
                                            <div className="dq-list-items">
                                                {dqLists.possibleTestIntegrations.map(i => (
                                                    <Link key={i.id} to={`/integrations`} className="dq-list-item">
                                                        <span className="dq-item-name">{i.sourceApplicationName} → {i.targetApplicationName}</span>
                                                        <span className="dq-item-detail">{i.notes || i.businessPurpose || i.dataExchanged || ""}</span>
                                                    </Link>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="dq-list-section" id="most-used">
                                        <h3 className="dq-list-title">Most Used Systems <span className="dq-list-subtitle">(by role count)</span></h3>
                                        {dqLists.mostUsedSystemsByRoleCount.length === 0 ? (
                                            <p className="dq-empty">No role mappings exist.</p>
                                        ) : (
                                            <div className="dq-list-items">
                                                {dqLists.mostUsedSystemsByRoleCount.map(s => (
                                                    <Link key={s.id} to={`/applications/${s.id}`} className="dq-list-item">
                                                        <span className="dq-item-name">{s.name}</span>
                                                        <span className="dq-item-badge">{s.roleCount} role{s.roleCount !== 1 ? "s" : ""}</span>
                                                    </Link>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="dq-list-section" id="most-connected">
                                        <h3 className="dq-list-title">Most Connected Systems <span className="dq-list-subtitle">(by integration count)</span></h3>
                                        {dqLists.mostConnectedSystems.length === 0 ? (
                                            <p className="dq-empty">No integrations exist.</p>
                                        ) : (
                                            <div className="dq-list-items">
                                                {dqLists.mostConnectedSystems.map(s => (
                                                    <Link key={s.id} to={`/applications/${s.id}`} className="dq-list-item">
                                                        <span className="dq-item-name">{s.name}</span>
                                                        <span className="dq-item-badge">{s.connectionCount} connection{s.connectionCount !== 1 ? "s" : ""}</span>
                                                    </Link>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </>
                ) : (
                    <p className="dq-empty">Unable to load data quality metrics.</p>
                )}
            </section>
        </div>
    );
}
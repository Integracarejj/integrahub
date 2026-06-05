import { useCallback, useEffect, useMemo, useState } from "react";
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

interface DqAccordionSectionProps<T> {
    id: string;
    title: string;
    subtitle?: string;
    count: number;
    helperText: string;
    emptyText: string;
    items: T[];
    renderItem: (item: T) => React.ReactNode;
    expanded: boolean;
    onToggle: () => void;
}

function DqAccordionSection<T>({
    id,
    title,
    subtitle,
    count,
    helperText,
    emptyText,
    items,
    renderItem,
    expanded,
    onToggle,
}: DqAccordionSectionProps<T>) {
    const visibleItems = items.slice(0, 10);
    const totalItems = items.length;

    return (
        <div className="dq-accordion" id={id}>
            <button
                className="dq-accordion-header"
                onClick={onToggle}
                type="button"
                aria-expanded={expanded}
            >
                <span className="dq-accordion-header-left">
                    <svg
                        className={`dq-chevron ${expanded ? "dq-chevron-open" : ""}`}
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                    >
                        <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="dq-accordion-title">
                        {title}
                        {subtitle && <span className="dq-list-subtitle"> {subtitle}</span>}
                    </span>
                </span>
                <span className="dq-accordion-header-right">
                    <span className="dq-accordion-count">{count}</span>
                    <span className="dq-accordion-helper">{helperText}</span>
                </span>
            </button>
            {expanded && (
                <div className="dq-accordion-body">
                    {totalItems === 0 ? (
                        <p className="dq-empty">{emptyText}</p>
                    ) : (
                        <>
                            <div className="dq-list-items">
                                {visibleItems.map((item, i) => (
                                    <div key={i}>{renderItem(item)}</div>
                                ))}
                            </div>
                            {totalItems > 10 && (
                                <p className="dq-showing-n">Showing 10 of {totalItems}</p>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
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

    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

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

    const toggleSection = useCallback((key: string) => {
        setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
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
                                    <DqAccordionSection
                                        id="missing-owners"
                                        title="Ownership Needs Attention"
                                        count={dqMetrics.systemsMissingBusinessOwner + dqMetrics.systemsMissingTechnicalOwner}
                                        helperText="Systems missing business or technical owner"
                                        emptyText="All systems have owners assigned."
                                        items={dqLists.missingOwners}
                                        expanded={!!expandedSections["missing-owners"]}
                                        onToggle={() => toggleSection("missing-owners")}
                                        renderItem={s => (
                                            <Link key={s.id} to={`/applications/${s.id}`} className="dq-list-item">
                                                <span className="dq-item-name">{s.name}</span>
                                                <span className="dq-item-detail">
                                                    {s.businessOwner ? "" : "No business owner"}{s.businessOwner && !s.technicalOwner ? " / " : ""}{!s.businessOwner && !s.technicalOwner ? " " : ""}{s.technicalOwner ? "" : "No technical owner"}
                                                </span>
                                                <span className={"dq-item-status " + s.status.toLowerCase()}>{s.status}</span>
                                            </Link>
                                        )}
                                    />

                                    <DqAccordionSection
                                        id="missing-context"
                                        title="Missing Operational Context"
                                        count={dqMetrics.systemsMissingOperationalContext}
                                        helperText="Systems missing use cases, departments, access process, training URL"
                                        emptyText="All systems have operational context."
                                        items={dqLists.missingOperationalContext}
                                        expanded={!!expandedSections["missing-context"]}
                                        onToggle={() => toggleSection("missing-context")}
                                        renderItem={s => (
                                            <Link key={s.id} to={`/applications/${s.id}`} className="dq-list-item">
                                                <span className="dq-item-name">{s.name}</span>
                                                <span className="dq-item-detail">Missing use cases, departments, access process, and training URL</span>
                                                <span className={"dq-item-status " + s.status.toLowerCase()}>{s.status}</span>
                                            </Link>
                                        )}
                                    />

                                    <DqAccordionSection
                                        id="without-roles"
                                        title="Systems Without Role Mappings"
                                        count={dqMetrics.systemsWithoutRoleMappings}
                                        helperText="Systems not mapped to any role"
                                        emptyText="All systems have role mappings."
                                        items={dqLists.systemsWithoutRoles}
                                        expanded={!!expandedSections["without-roles"]}
                                        onToggle={() => toggleSection("without-roles")}
                                        renderItem={s => (
                                            <Link key={s.id} to={`/applications/${s.id}`} className="dq-list-item">
                                                <span className="dq-item-name">{s.name}</span>
                                                <span className={"dq-item-status " + s.status.toLowerCase()}>{s.status}</span>
                                            </Link>
                                        )}
                                    />

                                    <DqAccordionSection
                                        id="without-integrations"
                                        title="Systems Without Integrations"
                                        count={dqMetrics.systemsWithoutIntegrations}
                                        helperText="Systems with no integrations defined"
                                        emptyText="All systems have integrations."
                                        items={dqLists.systemsWithoutIntegrations}
                                        expanded={!!expandedSections["without-integrations"]}
                                        onToggle={() => toggleSection("without-integrations")}
                                        renderItem={s => (
                                            <Link key={s.id} to={`/applications/${s.id}`} className="dq-list-item">
                                                <span className="dq-item-name">{s.name}</span>
                                                <span className={"dq-item-status " + s.status.toLowerCase()}>{s.status}</span>
                                            </Link>
                                        )}
                                    />

                                    <DqAccordionSection
                                        id="cleanup-integrations"
                                        title="Possible Test / Cleanup Integrations"
                                        count={dqMetrics.testOrCleanupIntegrations}
                                        helperText="Integrations flagged as test, sample, or dummy"
                                        emptyText="No suspicious integrations found."
                                        items={dqLists.possibleTestIntegrations}
                                        expanded={!!expandedSections["cleanup-integrations"]}
                                        onToggle={() => toggleSection("cleanup-integrations")}
                                        renderItem={i => (
                                            <Link key={i.id} to={"/integrations"} className="dq-list-item">
                                                <span className="dq-item-name">{i.sourceApplicationName} &rarr; {i.targetApplicationName}</span>
                                                <span className="dq-item-detail">{i.notes || i.businessPurpose || i.dataExchanged || ""}</span>
                                            </Link>
                                        )}
                                    />

                                    <DqAccordionSection
                                        id="most-used"
                                        title="Most Used Systems"
                                        subtitle="by role count"
                                        count={dqLists.mostUsedSystemsByRoleCount.length}
                                        helperText="Systems ranked by number of role assignments"
                                        emptyText="No role mappings exist."
                                        items={dqLists.mostUsedSystemsByRoleCount}
                                        expanded={!!expandedSections["most-used"]}
                                        onToggle={() => toggleSection("most-used")}
                                        renderItem={s => (
                                            <Link key={s.id} to={`/applications/${s.id}`} className="dq-list-item">
                                                <span className="dq-item-name">{s.name}</span>
                                                <span className="dq-item-badge">{s.roleCount} role{s.roleCount !== 1 ? "s" : ""}</span>
                                            </Link>
                                        )}
                                    />

                                    <DqAccordionSection
                                        id="most-connected"
                                        title="Most Connected Systems"
                                        subtitle="by integration count"
                                        count={dqLists.mostConnectedSystems.length}
                                        helperText="Systems ranked by number of integrations"
                                        emptyText="No integrations exist."
                                        items={dqLists.mostConnectedSystems}
                                        expanded={!!expandedSections["most-connected"]}
                                        onToggle={() => toggleSection("most-connected")}
                                        renderItem={s => (
                                            <Link key={s.id} to={`/applications/${s.id}`} className="dq-list-item">
                                                <span className="dq-item-name">{s.name}</span>
                                                <span className="dq-item-badge">{s.connectionCount} connection{s.connectionCount !== 1 ? "s" : ""}</span>
                                            </Link>
                                        )}
                                    />
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

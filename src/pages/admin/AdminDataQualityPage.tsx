import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { usePermissions, isPlatformAdmin } from "../../hooks/usePermissions";
import { getDashboardDataQuality } from "../../services/dashboardService";
import type { DashboardDataQualityMetrics, DashboardDataQualityLists } from "../../types/dashboard";
import "./AdminDataQualityPage.css";

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
        <div className="adq-accordion" id={id}>
            <button
                className="adq-accordion-header"
                onClick={onToggle}
                type="button"
                aria-expanded={expanded}
            >
                <span className="adq-accordion-header-left">
                    <svg
                        className={`adq-chevron ${expanded ? "adq-chevron-open" : ""}`}
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                    >
                        <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="adq-accordion-title">
                        {title}
                        {subtitle && <span className="adq-list-subtitle"> {subtitle}</span>}
                    </span>
                </span>
                <span className="adq-accordion-header-right">
                    <span className="adq-accordion-count">{count}</span>
                    <span className="adq-accordion-helper">{helperText}</span>
                </span>
            </button>
            {expanded && (
                <div className="adq-accordion-body">
                    {totalItems === 0 ? (
                        <p className="adq-empty">{emptyText}</p>
                    ) : (
                        <>
                            <div className="adq-list-items">
                                {visibleItems.map((item, i) => (
                                    <div key={i}>{renderItem(item)}</div>
                                ))}
                            </div>
                            {totalItems > 10 && (
                                <p className="adq-showing-n">Showing 10 of {totalItems}</p>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

export default function AdminDataQualityPage() {
    const { permissions, loading: permissionsLoading } = usePermissions();
    const [dqMetrics, setDqMetrics] = useState<DashboardDataQualityMetrics | null>(null);
    const [dqLists, setDqLists] = useState<DashboardDataQualityLists | null>(null);
    const [dqLoading, setDqLoading] = useState(true);
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

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

    if (permissionsLoading) {
        return <div className="adq-page" style={{ padding: "40px", textAlign: "center" }}><p>Loading...</p></div>;
    }

    if (!isPlatformAdmin(permissions)) {
        return (
            <div className="adq-page" style={{ padding: "40px", textAlign: "center" }}>
                <h1>Access Denied</h1>
                <p>You do not have access to this page.</p>
                <Link to="/" className="create-btn">Go to Home</Link>
            </div>
        );
    }

    return (
        <div className="adq-page">
            <header className="adq-page-header">
                <h1>Data Quality</h1>
                <p className="adq-subtitle">Find missing ownership, incomplete records, unmapped systems, and cleanup opportunities.</p>
                <Link to="/admin" className="adq-back-link">Back to Admin</Link>
            </header>

            {dqLoading ? (
                <p className="adq-loading">Loading quality metrics…</p>
            ) : dqMetrics ? (
                <>
                    <div className="adq-summary-cards">
                        <div className="adq-card adq-card-red">
                            <span className="adq-card-value">{dqMetrics.systemsMissingBusinessOwner + dqMetrics.systemsMissingTechnicalOwner}</span>
                            <span className="adq-card-label">Missing Owners</span>
                        </div>
                        <div className="adq-card adq-card-orange">
                            <span className="adq-card-value">{dqMetrics.systemsMissingOperationalContext}</span>
                            <span className="adq-card-label">Missing Operational Context</span>
                        </div>
                        <div className="adq-card adq-card-yellow">
                            <span className="adq-card-value">{dqMetrics.systemsWithoutRoleMappings}</span>
                            <span className="adq-card-label">Systems Without Roles</span>
                        </div>
                        <div className="adq-card adq-card-purple">
                            <span className="adq-card-value">{dqMetrics.systemsWithoutIntegrations}</span>
                            <span className="adq-card-label">Systems Without Integrations</span>
                        </div>
                        <div className="adq-card adq-card-gray">
                            <span className="adq-card-value">{dqMetrics.testOrCleanupIntegrations}</span>
                            <span className="adq-card-label">Cleanup Integrations</span>
                        </div>
                    </div>

                    <div className="adq-lists">
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
                                        <Link key={s.id} to={`/applications/${s.id}`} className="adq-list-item">
                                            <span className="adq-item-name">{s.name}</span>
                                            <span className="adq-item-detail">
                                                {s.businessOwner ? "" : "No business owner"}{s.businessOwner && !s.technicalOwner ? " / " : ""}{!s.businessOwner && !s.technicalOwner ? " " : ""}{s.technicalOwner ? "" : "No technical owner"}
                                            </span>
                                            <span className={"adq-item-status " + s.status.toLowerCase()}>{s.status}</span>
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
                                        <Link key={s.id} to={`/applications/${s.id}`} className="adq-list-item">
                                            <span className="adq-item-name">{s.name}</span>
                                            <span className="adq-item-detail">Missing use cases, departments, access process, and training URL</span>
                                            <span className={"adq-item-status " + s.status.toLowerCase()}>{s.status}</span>
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
                                        <Link key={s.id} to={`/applications/${s.id}`} className="adq-list-item">
                                            <span className="adq-item-name">{s.name}</span>
                                            <span className={"adq-item-status " + s.status.toLowerCase()}>{s.status}</span>
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
                                        <Link key={s.id} to={`/applications/${s.id}`} className="adq-list-item">
                                            <span className="adq-item-name">{s.name}</span>
                                            <span className={"adq-item-status " + s.status.toLowerCase()}>{s.status}</span>
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
                                        <Link key={i.id} to={"/integrations"} className="adq-list-item">
                                            <span className="adq-item-name">{i.sourceApplicationName} &rarr; {i.targetApplicationName}</span>
                                            <span className="adq-item-detail">{i.notes || i.businessPurpose || i.dataExchanged || ""}</span>
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
                                        <Link key={s.id} to={`/applications/${s.id}`} className="adq-list-item">
                                            <span className="adq-item-name">{s.name}</span>
                                            <span className="adq-item-badge">{s.roleCount} role{s.roleCount !== 1 ? "s" : ""}</span>
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
                                        <Link key={s.id} to={`/applications/${s.id}`} className="adq-list-item">
                                            <span className="adq-item-name">{s.name}</span>
                                            <span className="adq-item-badge">{s.connectionCount} connection{s.connectionCount !== 1 ? "s" : ""}</span>
                                        </Link>
                                    )}
                                />
                            </>
                        )}
                    </div>
                </>
            ) : (
                <p className="adq-empty">Unable to load data quality metrics.</p>
            )}
        </div>
    );
}

import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getBusinessProcessDetail } from "../../services/businessProcessService";
import type { BusinessProcessDetail, BusinessProcessStep, BusinessProcessStepSystem } from "../../types/businessProcess";
import type { Application } from "../../types/application";
import {
    systemLabel,
    ProcessStageCard,
    ProcessSystemChip,
    ProcessStageDrawer,
} from "./ProcessComponents";
import "../integrations/ProcessView.css";
import "./ProcessDetailPage.css";

/* ─── Performance area mapping ─── */

interface PerfAreaLink {
    label: string;
    route: string;
    status: string;
    description: string;
}

const PROCESS_PERF_MAP: Record<string, PerfAreaLink> = {
    "employee lifecycle": { label: "Workforce", route: "/performance", status: "Future", description: "Hiring, onboarding, training, retention" },
    "prospect to resident": { label: "Sales & Occupancy", route: "/performance", status: "Future", description: "Leads, tours, move-ins, occupancy rates" },
    "resident care": { label: "Resident Care", route: "/performance", status: "Future", description: "Care delivery, wellness, service requests" },
    "maintenance & compliance": { label: "Maintenance & Compliance", route: "/performance/maintenance-compliance", status: "Active", description: "Work orders, preventive maintenance, regulatory compliance" },
};

function matchPerformanceAreas(processName: string): PerfAreaLink[] {
    const match = PROCESS_PERF_MAP[processName.toLowerCase()];
    return match ? [match] : [];
}

/* ─── Main page ─── */

export default function ProcessDetailPage() {
    const { id } = useParams<{ id: string }>();
    const [detail, setDetail] = useState<BusinessProcessDetail | null>(null);
    const [apps, setApps] = useState<Application[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedStages, setExpandedStages] = useState<Set<number>>(new Set());
    const [selectedStage, setSelectedStage] = useState<BusinessProcessStep | null>(null);

    useEffect(() => {
        if (!id) return;
        setLoading(true);
        setError(null);
        Promise.all([
            getBusinessProcessDetail(Number(id)),
            fetch("/api/applications").then(r => r.ok ? r.json() : []),
        ])
            .then(([data, appData]) => {
                setDetail(data);
                setApps(appData);
            })
            .catch(() => setError("Failed to load process detail."))
            .finally(() => setLoading(false));
    }, [id]);

    function openDrawer(step: BusinessProcessStep) {
        setSelectedStage(step);
    }

    function closeDrawer() {
        setSelectedStage(null);
    }

    function toggleStage(id: number) {
        setExpandedStages(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    /* ─── Derived data ─── */

    const allSystems = useMemo(() => {
        if (!detail) return [];
        return [
            ...detail.steps.flatMap(s => s.systems),
            ...(detail.unassignedSystems ?? []),
        ];
    }, [detail]);

    const uniqueSystemMap = useMemo(() => {
        const map = new Map<string, BusinessProcessStepSystem>();
        for (const sys of allSystems) {
            if (!map.has(sys.applicationId)) {
                map.set(sys.applicationId, sys);
            }
        }
        return map;
    }, [allSystems]);

    const uniqueSystemsList = useMemo(() => {
        return Array.from(uniqueSystemMap.values());
    }, [uniqueSystemMap]);

    const primaryUseCaseMap = useMemo(() => {
        const map = new Map<string, string>();
        for (const app of apps) {
            if (app.primaryUseCases) {
                map.set(app.id, app.primaryUseCases);
            }
        }
        return map;
    }, [apps]);

    const departmentNames = useMemo(() => {
        const names = new Set<string>();
        for (const sys of uniqueSystemsList) {
            const app = apps.find(a => a.id === sys.applicationId);
            if (app?.departments) {
                for (const d of app.departments) {
                    names.add(d.name);
                }
            }
        }
        return Array.from(names).sort();
    }, [uniqueSystemsList, apps]);

    const rolesInvolved = useMemo(() => {
        const roles = new Set<string>();
        for (const sys of allSystems) {
            if (sys.processRole) roles.add(sys.processRole);
        }
        return Array.from(roles).sort();
    }, [allSystems]);

    const perfAreas = useMemo(() => {
        if (!detail) return [];
        return matchPerformanceAreas(detail.processName);
    }, [detail]);

    const uniqueSystems = useMemo(() => {
        if (!detail) return 0;
        return new Set([
            ...detail.steps.flatMap(s => s.systems.map(sys => sys.applicationId)),
            ...(detail.unassignedSystems ?? []).map(sys => sys.applicationId),
        ]).size;
    }, [detail]);

    const connectedCapabilities = useMemo(() => {
        const names = new Set<string>();
        const connectedAppIds = new Set(uniqueSystemsList.map(sys => sys.applicationId));
        for (const app of apps) {
            if (connectedAppIds.has(app.id) && app.capabilities) {
                for (const cap of app.capabilities) {
                    if (cap.name) names.add(cap.name);
                }
            }
        }
        return Array.from(names).sort();
    }, [uniqueSystemsList, apps]);

    /* ─── Render states ─── */

    if (loading) {
        return (
            <div className="pv-page pd-page">
                <p className="pv-loading">Loading process detail…</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="pv-page pd-page">
                <p className="pv-loading" style={{ color: "#dc2626" }}>{error}</p>
            </div>
        );
    }

    if (!detail) {
        return (
            <div className="pv-page pd-page">
                <p className="pv-loading">Process not found.</p>
            </div>
        );
    }

    return (
        <div className="pv-page pd-page">
            <div className="pd-top-bar">
                <Link to="/processes" className="pd-back-link">&larr; All Processes</Link>
            </div>

            {/* ─── Section 1: Process Summary ─── */}
            <header className="pd-header">
                <div className="pd-header-top">
                    <div>
                        <h1 className="pd-name">{detail.processName}</h1>
                        {detail.processCategory && <span className="pd-category">{detail.processCategory}</span>}
                    </div>
                </div>
                {detail.description && <p className="pd-description">{detail.description}</p>}
                <div className="pd-meta-chips">
                    {detail.processOwner && (
                        <span className="pd-meta-chip">
                            <span className="pd-meta-chip-label">Owner</span>
                            <span className="pd-meta-chip-value">{detail.processOwner}</span>
                        </span>
                    )}
                    {detail.manualEffort && (
                        <span className={`pd-meta-chip pd-effort-${detail.manualEffort.toLowerCase()}`}>
                            <span className="pd-meta-chip-label">Manual Effort</span>
                            <span className="pd-meta-chip-value">{detail.manualEffort}</span>
                        </span>
                    )}
                    {detail.automationPotential && (
                        <span className={`pd-meta-chip pd-auto-${detail.automationPotential.toLowerCase()}`}>
                            <span className="pd-meta-chip-label">Auto Potential</span>
                            <span className="pd-meta-chip-value">{detail.automationPotential}</span>
                        </span>
                    )}
                </div>

                <div className="pd-summary">
                    <div className="pd-summary-card">
                        <span className="pd-summary-value">{uniqueSystems}</span>
                        <span className="pd-summary-label">Systems Used</span>
                    </div>
                    <div className="pd-summary-card">
                        <span className="pd-summary-value">{departmentNames.length}</span>
                        <span className="pd-summary-label">Departments Involved</span>
                    </div>
                    <div className="pd-summary-card">
                        <span className="pd-summary-value">{rolesInvolved.length}</span>
                        <span className="pd-summary-label">Roles Involved</span>
                    </div>
                </div>
            </header>

            {/* ─── Section 2: Business Flow ─── */}
            <section className="pd-section">
                <h2 className="pd-section-title">Business Flow</h2>
                <p className="pd-section-helper">Process stages and the systems that support each step.</p>
                <div className="pv-stages">
                    {detail.steps.length === 0 && (!detail.unassignedSystems || detail.unassignedSystems.length === 0) ? (
                        <div className="pv-empty-state">
                            <p>No stages or systems have been defined for this process yet.</p>
                        </div>
                    ) : (
                        <>
                            <div className="pd-flow">
                                {detail.steps.map((step, idx) => (
                                    <div key={step.id} className="pd-flow-step-wrap">
                                        <ProcessStageCard
                                            step={step}
                                            idx={idx}
                                            expanded={expandedStages.has(step.id)}
                                            onToggle={() => toggleStage(step.id)}
                                            onStageClick={openDrawer}
                                        />
                                        {idx < detail.steps.length - 1 && <div className="pd-flow-arrow">→</div>}
                                    </div>
                                ))}
                            </div>

                            {detail.unassignedSystems && detail.unassignedSystems.length > 0 && (
                                <div className="pv-stage pv-stage-unassigned" style={{ marginTop: 10 }}>
                                    <span className="pv-stage-num pv-stage-num-muted">—</span>
                                    <div className="pv-stage-body">
                                        <div className="pv-stage-hdr">
                                            <div className="pv-stage-hdr-l">
                                                <h3 className="pv-stage-name">Unassigned Systems</h3>
                                                <p className="pv-stage-desc">Systems in this process without a stage assignment.</p>
                                            </div>
                                            <div className="pv-stage-hdr-r">
                                                <span className="pv-stage-count">{systemLabel(detail.unassignedSystems.length)}</span>
                                            </div>
                                        </div>
                                        <div className="pv-chips">
                                            {detail.unassignedSystems.map(sys => (
                                                <ProcessSystemChip key={sys.mappingId} system={sys} />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </section>

            {/* ─── Section 3: Connected Systems ─── */}
            <section className="pd-section">
                <h2 className="pd-section-title">Connected Systems</h2>
                <p className="pd-section-helper">{uniqueSystemsList.length} {uniqueSystemsList.length === 1 ? "system" : "systems"} powering this process.</p>
                <div className="pd-systems-grid">
                    {uniqueSystemsList.map(sys => {
                        const useCase = primaryUseCaseMap.get(sys.applicationId);
                        return (
                            <Link key={sys.mappingId} to={`/applications/${sys.applicationId}`} className="pd-system-card">
                                <div className="pd-system-card-top">
                                    <span className="pd-system-card-name">{sys.applicationName}</span>
                                    <div className="pd-system-card-badges">
                                        {sys.systemCategory && (
                                            <span className="pv-badge">{sys.systemCategory}</span>
                                        )}
                                        {sys.businessCriticality && (
                                            <span className={`pv-badge pv-crit-${sys.businessCriticality.toLowerCase()}`}>
                                                {sys.businessCriticality}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                {useCase && (
                                    <p className="pd-system-card-use-case">{useCase}</p>
                                )}
                                <div className="pd-system-card-footer">
                                    <span className="pd-system-card-link">View System &rarr;</span>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            </section>

            {/* ─── Section 4: Performance Impact ─── */}
            {perfAreas.length > 0 && (
                <section className="pd-section">
                    <h2 className="pd-section-title">Performance Impact</h2>
                    <p className="pd-section-helper">Related operational performance areas affected by this process.</p>
                    <div className="pd-perf-grid">
                        {perfAreas.map(pa => (
                            <div key={pa.label} className="pd-perf-card">
                                <div className="pd-perf-card-top">
                                    <span className="pd-perf-name">{pa.label}</span>
                                    <span className={`pd-perf-status pd-perf-status-${pa.status.toLowerCase()}`}>
                                        {pa.status}
                                    </span>
                                </div>
                                <p className="pd-perf-desc">{pa.description}</p>
                                <div className="pd-perf-footer">
                                    {pa.route ? (
                                        <Link to={pa.route} className="pd-perf-link">View Performance Area</Link>
                                    ) : (
                                        <span className="pd-perf-link pd-perf-link-disabled">Coming Soon</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* ─── Section 5: Relationship Navigator ─── */}
            <section className="pd-section">
                <h2 className="pd-section-title">Relationship Navigator</h2>
                <p className="pd-section-helper">How this process connects across the operational landscape.</p>
                <div className="pd-rel-grid">

                    {/* ── Group 1: Process ── */}
                    <div className="pd-rel-card">
                        <div className="pd-rel-hdr">
                            <span className="pd-rel-title">Process</span>
                            <span className="pd-rel-value">{detail.processName}</span>
                        </div>
                        <div className="pd-rel-chips">
                            {detail.processCategory && (
                                <span className="pd-rel-chip pd-rel-chip-cat">{detail.processCategory}</span>
                            )}
                            {detail.processOwner && (
                                <span className="pd-rel-chip pd-rel-chip-meta">{detail.processOwner}</span>
                            )}
                        </div>
                        <div className="pd-rel-action">
                            <Link to="/processes" className="pd-rel-link">&larr; All Processes</Link>
                        </div>
                    </div>

                    {/* ── Group 2: Connected Systems ── */}
                    <div className="pd-rel-card">
                        <div className="pd-rel-hdr">
                            <span className="pd-rel-title">Connected Systems</span>
                            <span className="pd-rel-value">{uniqueSystemsList.length}</span>
                        </div>
                        <div className="pd-rel-chips">
                            {uniqueSystemsList.slice(0, 4).map(sys => (
                                <Link
                                    key={sys.mappingId}
                                    to={`/applications/${sys.applicationId}`}
                                    className="pd-rel-chip pd-rel-chip-sys"
                                >
                                    {sys.applicationName}
                                </Link>
                            ))}
                            {uniqueSystemsList.length > 4 && (
                                <span className="pd-rel-more">+{uniqueSystemsList.length - 4} more</span>
                            )}
                        </div>
                        <div className="pd-rel-action">
                            <Link to="/integrations" className="pd-rel-link">View all systems &rarr;</Link>
                        </div>
                    </div>

                    {/* ── Group 3: Capabilities ── */}
                    <div className="pd-rel-card">
                        <div className="pd-rel-hdr">
                            <span className="pd-rel-title">Capabilities</span>
                            <span className="pd-rel-value">{connectedCapabilities.length}</span>
                        </div>
                        <div className="pd-rel-chips">
                            {connectedCapabilities.length > 0 ? (
                                <>
                                    {connectedCapabilities.slice(0, 4).map(cap => (
                                        <span key={cap} className="pd-rel-chip pd-rel-chip-cap">{cap}</span>
                                    ))}
                                    {connectedCapabilities.length > 4 && (
                                        <span className="pd-rel-more">+{connectedCapabilities.length - 4} more</span>
                                    )}
                                </>
                            ) : (
                                <span className="pd-rel-empty">No capabilities linked</span>
                            )}
                        </div>
                        <div className="pd-rel-action">
                            <Link to="/capability-view" className="pd-rel-link">View capabilities &rarr;</Link>
                        </div>
                    </div>

                    {/* ── Group 4: Performance Areas ── */}
                    <div className="pd-rel-card">
                        <div className="pd-rel-hdr">
                            <span className="pd-rel-title">Performance Areas</span>
                            <span className="pd-rel-value">{perfAreas.length}</span>
                        </div>
                        <div className="pd-rel-chips">
                            {perfAreas.length > 0 ? (
                                <>
                                    {perfAreas.slice(0, 4).map(pa =>
                                        pa.route ? (
                                            <Link key={pa.label} to={pa.route} className={`pd-rel-chip pd-rel-chip-perf pd-rel-perf-${pa.status.toLowerCase()}`}>
                                                {pa.label}
                                            </Link>
                                        ) : (
                                            <span key={pa.label} className={`pd-rel-chip pd-rel-chip-perf pd-rel-perf-${pa.status.toLowerCase()}`}>
                                                {pa.label}
                                            </span>
                                        )
                                    )}
                                </>
                            ) : (
                                <span className="pd-rel-empty">No performance area mapped</span>
                            )}
                        </div>
                        <div className="pd-rel-action">
                            <Link to="/performance" className="pd-rel-link">View performance &rarr;</Link>
                        </div>
                    </div>

                </div>
            </section>

            {/* ─── Stage Drawer ─── */}
            {selectedStage && <div className="pv-drawer-backdrop" onClick={closeDrawer} />}
            {selectedStage && <ProcessStageDrawer stage={selectedStage} onClose={closeDrawer} />}
        </div>
    );
}

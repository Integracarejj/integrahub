import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
    getBusinessProcesses,
    getBusinessProcessDetail,
} from "../../services/businessProcessService";
import type { BusinessProcessDetail, BusinessProcessStep } from "../../types/businessProcess";
import "./ProcessView.css";

function getActorLabel(step: BusinessProcessStep): string | null {
    const name = step.stepName.toLowerCase();
    if (name.includes("recruit") || name.includes("sourc") || name.includes("applicant")) return "Candidate";
    if (name.includes("hiring") || name.includes("offer") || name.includes("onboard") || name.includes("orient")) return "New Hire";
    return null;
}

function getStageIcon(step: BusinessProcessStep): JSX.Element | null {
    const name = step.stepName.toLowerCase();
    if (name.includes("recruit") || name.includes("sourc") || name.includes("applicant")) {
        return (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <line x1="19" y1="8" x2="19" y2="14" />
                <line x1="22" y1="11" x2="16" y2="11" />
            </svg>
        );
    }
    if (name.includes("hiring") || name.includes("offer") || name.includes("onboard") || name.includes("orient")) {
        return (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
        );
    }
    if (name.includes("identity") || name.includes("access") || name.includes("auth") || name.includes("security")) {
        return (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
        );
    }
    if (name.includes("train") || name.includes("learn") || name.includes("educat") || name.includes("course")) {
        return (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
        );
    }
    if (name.includes("engagement") || name.includes("retention") || name.includes("reward") || name.includes("recogn")) {
        return (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
        );
    }
    return null;
}

function StepNumberIcon({ idx, actor, icon }: { idx: number; actor: string | null; icon: JSX.Element | null }) {
    return (
        <div className="pv-si-wrap">
            <span className="pv-si-num">{icon ? icon : idx + 1}</span>
            {actor && <span className="pv-si-actor">{actor}</span>}
        </div>
    );
}

function systemLabel(count: number): string {
    return count === 1 ? "1 system" : `${count} systems`;
}

export default function ProcessView() {
    const [processes, setProcesses] = useState<BusinessProcessDetail[]>([]);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [detail, setDetail] = useState<BusinessProcessDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [detailLoading, setDetailLoading] = useState(false);
    const [expandedStages, setExpandedStages] = useState<Set<number>>(new Set());

    useEffect(() => {
        getBusinessProcesses()
            .then(data => setProcesses(data as BusinessProcessDetail[]))
            .catch(() => setProcesses([]))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        if (selectedId == null) {
            setDetail(null);
            return;
        }
        setDetailLoading(true);
        setExpandedStages(new Set());
        getBusinessProcessDetail(selectedId)
            .then(data => setDetail(data))
            .catch(() => setDetail(null))
            .finally(() => setDetailLoading(false));
    }, [selectedId]);

    const systemsInProcess = detail
        ? detail.steps.reduce((sum, s) => sum + s.systems.length, 0) + (detail.unassignedSystems?.length ?? 0)
        : 0;

    const uniqueSystems = detail
        ? new Set([
              ...detail.steps.flatMap(s => s.systems.map(sys => sys.applicationId)),
              ...(detail.unassignedSystems ?? []).map(sys => sys.applicationId),
          ]).size
        : 0;

    const criticalSystems = detail
        ? detail.steps.flatMap(s => s.systems).filter(sys => sys.businessCriticality?.toLowerCase() === "critical").length
        : 0;

    function toggleStage(id: number) {
        setExpandedStages(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    return (
        <div className="pv-page">
            {loading ? (
                <p className="pv-loading">Loading processes…</p>
            ) : (
                <>
                    <div className="pv-top-bar">
                        <div className="pv-select-group">
                            <select
                                className="pv-select"
                                value={selectedId ?? ""}
                                onChange={e => setSelectedId(e.target.value ? Number(e.target.value) : null)}
                            >
                                <option value="">Select a process…</option>
                                {processes.map(p => (
                                    <option key={p.id} value={p.id}>{p.processName}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {!selectedId && processes.length === 0 && (
                        <div className="pv-empty">
                            <h2>No business processes yet</h2>
                            <p>Business processes show how systems work together to support key workflows like Prospect to Resident or Employee Lifecycle.</p>
                        </div>
                    )}

                    {!selectedId && processes.length > 0 && (
                        <div className="pv-empty">
                            <h2>Select a Process</h2>
                            <p>Choose a business process from the dropdown above to see how systems support each stage of the workflow.</p>
                        </div>
                    )}

                    {selectedId && detailLoading && (
                        <p className="pv-loading">Loading process detail…</p>
                    )}

                    {selectedId && !detailLoading && detail && (
                        <div className="pv-content">
                            <div className="pv-header">
                                <div>
                                    <h2 className="pv-name">{detail.processName}</h2>
                                    {detail.processCategory && <span className="pv-category">{detail.processCategory}</span>}
                                    {detail.description && <p className="pv-description">{detail.description}</p>}
                                </div>
                            </div>

                            <div className="pv-summary-cards">
                                <div className="pv-summary-card">
                                    <span className="pv-summary-value">{detail.steps.length}</span>
                                    <span className="pv-summary-label">Process Steps</span>
                                </div>
                                <div className="pv-summary-card">
                                    <span className="pv-summary-value">{systemsInProcess}</span>
                                    <span className="pv-summary-label">Systems in Process</span>
                                </div>
                                <div className="pv-summary-card">
                                    <span className="pv-summary-value">{uniqueSystems}</span>
                                    <span className="pv-summary-label">Unique Systems</span>
                                </div>
                                <div className="pv-summary-card">
                                    <span className="pv-summary-value">{criticalSystems}</span>
                                    <span className="pv-summary-label">Critical Systems</span>
                                </div>
                            </div>

                            <div className="pv-stages">
                                {detail.steps.length === 0 && (!detail.unassignedSystems || detail.unassignedSystems.length === 0) ? (
                                    <div className="pv-empty-state">
                                        <p>No stages or systems have been defined for this process yet.</p>
                                    </div>
                                ) : (
                                    <>
                                        {detail.steps.map((step, idx) => {
                                            const actor = getActorLabel(step);
                                            const icon = getStageIcon(step);
                                            const expanded = expandedStages.has(step.id);

                                            return (
                                                <div key={step.id} className="pv-stage">
                                                    <StepNumberIcon idx={idx} actor={actor} icon={icon} />

                                                    <div className="pv-stage-body">
                                                        <div className="pv-stage-hdr">
                                                            <div className="pv-stage-hdr-l">
                                                                <h3 className="pv-stage-name">{step.stepName}</h3>
                                                                {step.stepDescription && (
                                                                    <p className="pv-stage-desc">{step.stepDescription}</p>
                                                                )}
                                                            </div>
                                                            <div className="pv-stage-hdr-r">
                                                                <span className="pv-stage-count">{systemLabel(step.systems.length)}</span>
                                                                {step.systems.length > 0 && (
                                                                    <button
                                                                        className={`pv-expand-btn${expanded ? " pv-expand-btn--open" : ""}`}
                                                                        onClick={() => toggleStage(step.id)}
                                                                        title={expanded ? "Hide details" : "Show details"}
                                                                    >
                                                                        {expanded ? "−" : "+"}
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {step.systems.length > 0 ? (
                                                            expanded ? (
                                                                <div className="pv-detail-list">
                                                                    {step.systems.map(sys => (
                                                                        <div key={sys.mappingId} className="pv-detail-item">
                                                                            <div className="pv-detail-top">
                                                                                <Link to={`/applications/${sys.applicationId}`} className="pv-detail-name">
                                                                                    {sys.applicationName}
                                                                                </Link>
                                                                                <div className="pv-detail-badges">
                                                                                    {sys.systemCategory && <span className="pv-badge">{sys.systemCategory}</span>}
                                                                                    {sys.businessCriticality && (
                                                                                        <span className={`pv-badge pv-crit-${sys.businessCriticality.toLowerCase()}`}>
                                                                                            {sys.businessCriticality}
                                                                                        </span>
                                                                                    )}
                                                                                    {sys.status === "Active" && <span className="pv-badge pv-badge-active">Active</span>}
                                                                                    {sys.status === "Retired" && <span className="pv-badge pv-badge-retired">Retired</span>}
                                                                                    {sys.processRole && <span className="pv-badge pv-badge-role">{sys.processRole}</span>}
                                                                                </div>
                                                                            </div>
                                                                            {sys.systemCategory && (
                                                                                <p className="pv-detail-meta">{sys.systemCategory}</p>
                                                                            )}
                                                                            {sys.notes && <p className="pv-detail-notes">{sys.notes}</p>}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <div className="pv-chips">
                                                                    {step.systems.map(sys => (
                                                                        <div key={sys.mappingId} className="pv-chip">
                                                                            <Link to={`/applications/${sys.applicationId}`} className="pv-chip-name">
                                                                                {sys.applicationName}
                                                                            </Link>
                                                                            <div className="pv-chip-badges">
                                                                                {sys.systemCategory && <span className="pv-badge">{sys.systemCategory}</span>}
                                                                                {sys.businessCriticality && (
                                                                                    <span className={`pv-badge pv-crit-${sys.businessCriticality.toLowerCase()}`}>
                                                                                        {sys.businessCriticality}
                                                                                    </span>
                                                                                )}
                                                                                {sys.status === "Active" && <span className="pv-badge pv-badge-active">Active</span>}
                                                                                {sys.status === "Retired" && <span className="pv-badge pv-badge-retired">Retired</span>}
                                                                                {sys.processRole && <span className="pv-badge pv-badge-role">{sys.processRole}</span>}
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )
                                                        ) : (
                                                            <p className="pv-stage-empty">No systems mapped</p>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {detail.unassignedSystems && detail.unassignedSystems.length > 0 && (
                                            <div className="pv-stage pv-stage-unassigned">
                                                <div className="pv-si-wrap">
                                                    <span className="pv-si-num pv-si-num-muted">—</span>
                                                </div>
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
                                                            <div key={sys.mappingId} className="pv-chip">
                                                                <Link to={`/applications/${sys.applicationId}`} className="pv-chip-name">
                                                                    {sys.applicationName}
                                                                </Link>
                                                                <div className="pv-chip-badges">
                                                                    {sys.systemCategory && <span className="pv-badge">{sys.systemCategory}</span>}
                                                                    {sys.businessCriticality && (
                                                                        <span className={`pv-badge pv-crit-${sys.businessCriticality.toLowerCase()}`}>
                                                                            {sys.businessCriticality}
                                                                        </span>
                                                                    )}
                                                                    {sys.status === "Active" && <span className="pv-badge pv-badge-active">Active</span>}
                                                                    {sys.status === "Retired" && <span className="pv-badge pv-badge-retired">Retired</span>}
                                                                    {sys.processRole && <span className="pv-badge pv-badge-role">{sys.processRole}</span>}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

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

function StepNumberIcon({ idx, actor }: { idx: number; actor: string | null }) {
    return (
        <div className="pv-si-wrap">
            <span className="pv-si-num">{idx + 1}</span>
            {actor && <span className="pv-si-actor">{actor}</span>}
        </div>
    );
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
                                            const expanded = expandedStages.has(step.id);
                                            const hasNotes = step.systems.some(sys => sys.notes);

                                            return (
                                                <div key={step.id} className="pv-stage">
                                                    <StepNumberIcon idx={idx} actor={actor} />

                                                    <div className="pv-stage-body">
                                                        <div className="pv-stage-hdr">
                                                            <div className="pv-stage-hdr-l">
                                                                <h3 className="pv-stage-name">{step.stepName}</h3>
                                                                {step.stepDescription && (
                                                                    <p className="pv-stage-desc">{step.stepDescription}</p>
                                                                )}
                                                            </div>
                                                            <div className="pv-stage-hdr-r">
                                                                <span className="pv-stage-count">{step.systems.length}</span>
                                                                {hasNotes && (
                                                                    <button
                                                                        className="pv-expand-btn"
                                                                        onClick={() => toggleStage(step.id)}
                                                                        title={expanded ? "Hide details" : "Show details"}
                                                                    >
                                                                        {expanded ? "−" : "+"}
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {step.systems.length > 0 ? (
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
                                                                        {expanded && sys.notes && (
                                                                            <p className="pv-chip-notes">{sys.notes}</p>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
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
                                                            <span className="pv-stage-count">{detail.unassignedSystems.length}</span>
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

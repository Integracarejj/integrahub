import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
    getBusinessProcesses,
    getBusinessProcessDetail,
} from "../../services/businessProcessService";
import type { BusinessProcessDetail, BusinessProcessStep, BusinessProcessStepSystem } from "../../types/businessProcess";
import "./ProcessView.css";

/* ─── Helpers ─── */

function getActorLabel(step: BusinessProcessStep): string | null {
    const name = step.stepName.toLowerCase();
    if (name.includes("recruit") || name.includes("sourc") || name.includes("applicant")) return "Candidate";
    if (name.includes("hiring") || name.includes("offer") || name.includes("onboard") || name.includes("orient")) return "New Hire";
    return null;
}

function systemLabel(count: number): string {
    return count === 1 ? "1 system" : `${count} systems`;
}

/* ─── Actor Badge ─── */

function ProcessActorBadge({ label }: { label: string }) {
    return <span className="pv-actor-badge">{label}</span>;
}

/* ─── System Chip (collapsed) ─── */

function ProcessSystemChip({
    system,
    onSystemClick,
}: {
    system: BusinessProcessStepSystem;
    onSystemClick?: (applicationId: string) => void;
}) {
    return (
        <div
            className="pv-chip"
            style={onSystemClick ? { cursor: "pointer" } : undefined}
            onClick={onSystemClick ? () => onSystemClick(system.applicationId) : undefined}
        >
            <Link
                to={`/applications/${system.applicationId}`}
                className="pv-chip-name"
                onClick={e => e.stopPropagation()}
            >
                {system.applicationName}
            </Link>
            {system.systemCategory && <span className="pv-chip-cat">{system.systemCategory}</span>}
        </div>
    );
}

/* ─── System Detail (expanded) ─── */

function ProcessSystemDetailItem({
    system,
    onSystemClick,
}: {
    system: BusinessProcessStepSystem;
    onSystemClick?: (applicationId: string) => void;
}) {
    return (
        <div
            className="pv-detail-item"
            style={onSystemClick ? { cursor: "pointer" } : undefined}
            onClick={onSystemClick ? () => onSystemClick(system.applicationId) : undefined}
        >
            <div className="pv-detail-top">
                <Link
                    to={`/applications/${system.applicationId}`}
                    className="pv-detail-name"
                    onClick={e => e.stopPropagation()}
                >
                    {system.applicationName}
                </Link>
                <div className="pv-detail-badges">
                    {system.systemCategory && <span className="pv-badge">{system.systemCategory}</span>}
                    {system.businessCriticality && (
                        <span className={`pv-badge pv-crit-${system.businessCriticality.toLowerCase()}`}>
                            {system.businessCriticality}
                        </span>
                    )}
                    {system.status === "Active" && <span className="pv-badge pv-badge-active">Active</span>}
                    {system.status === "Retired" && <span className="pv-badge pv-badge-retired">Retired</span>}
                    {system.processRole && <span className="pv-badge pv-badge-role">{system.processRole}</span>}
                </div>
            </div>
            {system.notes && <p className="pv-detail-notes">{system.notes}</p>}
        </div>
    );
}

function ProcessSystemDetailList({
    systems,
    onSystemClick,
}: {
    systems: BusinessProcessStepSystem[];
    onSystemClick?: (applicationId: string) => void;
}) {
    if (systems.length === 0) return null;
    return (
        <div className="pv-detail-list">
            {systems.map(sys => (
                <ProcessSystemDetailItem key={sys.mappingId} system={sys} onSystemClick={onSystemClick} />
            ))}
        </div>
    );
}

/* ─── Stage Accordion Row ─── */

function ProcessStageCard({
    step,
    idx,
    expanded,
    onToggle,
    onStageClick,
    onSystemClick,
}: {
    step: BusinessProcessStep;
    idx: number;
    expanded: boolean;
    onToggle: () => void;
    onStageClick?: (stepId: number) => void;
    onSystemClick?: (applicationId: string) => void;
}) {
    const actor = getActorLabel(step);

    return (
        <div
            className="pv-stage"
            style={onStageClick ? { cursor: "pointer" } : undefined}
            onClick={onStageClick ? () => onStageClick(step.id) : undefined}
        >
            <span className="pv-stage-num">{idx + 1}</span>

            <div className="pv-stage-body">
                <div className="pv-stage-hdr">
                    <div className="pv-stage-hdr-l">
                        {actor && <ProcessActorBadge label={actor} />}
                        <h3 className="pv-stage-name">{step.stepName}</h3>
                        {step.stepDescription && (
                            <p className="pv-stage-desc">{step.stepDescription}</p>
                        )}
                    </div>
                    <div className="pv-stage-hdr-r">
                        {step.systems.length > 0 && (
                            <>
                                <span className="pv-stage-count">{systemLabel(step.systems.length)}</span>
                                <button
                                    className={`pv-expand-btn${expanded ? " pv-expand-btn--open" : ""}`}
                                    onClick={e => { e.stopPropagation(); onToggle(); }}
                                    title={expanded ? "Hide details" : "Show details"}
                                >
                                    {expanded ? "−" : "+"}
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {step.systems.length === 0 ? (
                    <p className="pv-stage-empty">No systems mapped</p>
                ) : expanded ? (
                    <ProcessSystemDetailList systems={step.systems} onSystemClick={onSystemClick} />
                ) : (
                    <div className="pv-chips">
                        {step.systems.map(sys => (
                            <ProcessSystemChip key={sys.mappingId} system={sys} onSystemClick={onSystemClick} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

/* ─── Main View ─── */

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
                                        {detail.steps.map((step, idx) => (
                                            <ProcessStageCard
                                                key={step.id}
                                                step={step}
                                                idx={idx}
                                                expanded={expandedStages.has(step.id)}
                                                onToggle={() => toggleStage(step.id)}
                                            />
                                        ))}

                                        {detail.unassignedSystems && detail.unassignedSystems.length > 0 && (
                                            <div className="pv-stage pv-stage-unassigned">
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
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

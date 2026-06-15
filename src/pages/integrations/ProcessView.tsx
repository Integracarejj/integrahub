import { useEffect, useState } from "react";
import {
    getBusinessProcesses,
    getBusinessProcessDetail,
} from "../../services/businessProcessService";
import type { BusinessProcessDetail, BusinessProcessStep } from "../../types/businessProcess";
import {
    systemLabel,
    ProcessStageCard,
    ProcessSystemChip,
    ProcessStageDrawer,
} from "../processes/ProcessComponents";
import "./ProcessView.css";

/* ─── Main View ─── */

export default function ProcessView() {
    const [processes, setProcesses] = useState<BusinessProcessDetail[]>([]);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [detail, setDetail] = useState<BusinessProcessDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [detailLoading, setDetailLoading] = useState(false);
    const [expandedStages, setExpandedStages] = useState<Set<number>>(new Set());
    const [selectedStage, setSelectedStage] = useState<BusinessProcessStep | null>(null);

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

    function openDrawer(step: BusinessProcessStep) {
        setSelectedStage(step);
    }

    function closeDrawer() {
        setSelectedStage(null);
    }

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
                                    <div className="pv-meta-chips">
                                        {detail.processOwner && (
                                            <span className="pv-meta-chip">
                                                <span className="pv-meta-chip-label">Owner</span>
                                                <span className="pv-meta-chip-value">{detail.processOwner}</span>
                                            </span>
                                        )}
                                        {detail.manualEffort && (
                                            <span className={`pv-meta-chip pv-effort-${detail.manualEffort.toLowerCase()}`}>
                                                <span className="pv-meta-chip-label">Manual Effort</span>
                                                <span className="pv-meta-chip-value">{detail.manualEffort}</span>
                                            </span>
                                        )}
                                        {detail.automationPotential && (
                                            <span className={`pv-meta-chip pv-auto-${detail.automationPotential.toLowerCase()}`}>
                                                <span className="pv-meta-chip-label">Auto Potential</span>
                                                <span className="pv-meta-chip-value">{detail.automationPotential}</span>
                                            </span>
                                        )}
                                    </div>
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
                                                onStageClick={openDrawer}
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
            {selectedStage && <div className="pv-drawer-backdrop" onClick={closeDrawer} />}
            {selectedStage && <ProcessStageDrawer stage={selectedStage} onClose={closeDrawer} />}
        </div>
    );
}

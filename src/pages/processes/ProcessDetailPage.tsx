import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getBusinessProcessDetail } from "../../services/businessProcessService";
import type { BusinessProcessDetail, BusinessProcessStep } from "../../types/businessProcess";
import {
    systemLabel,
    ProcessStageCard,
    ProcessSystemChip,
    ProcessStageDrawer,
} from "./ProcessComponents";
import "../integrations/ProcessView.css";

export default function ProcessDetailPage() {
    const { id } = useParams<{ id: string }>();
    const [detail, setDetail] = useState<BusinessProcessDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedStages, setExpandedStages] = useState<Set<number>>(new Set());
    const [selectedStage, setSelectedStage] = useState<BusinessProcessStep | null>(null);

    useEffect(() => {
        if (!id) return;
        setLoading(true);
        setError(null);
        getBusinessProcessDetail(Number(id))
            .then(data => setDetail(data))
            .catch(() => setError("Failed to load process detail."))
            .finally(() => setLoading(false));
    }, [id]);

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

    if (loading) {
        return (
            <div className="pv-page">
                <p className="pv-loading">Loading process detail…</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="pv-page">
                <p className="pv-loading" style={{ color: "#dc2626" }}>{error}</p>
            </div>
        );
    }

    if (!detail) {
        return (
            <div className="pv-page">
                <p className="pv-loading">Process not found.</p>
            </div>
        );
    }

    return (
        <div className="pv-page">
            <div className="pv-top-bar">
                <Link to="/processes" className="pv-back-link">&larr; All Processes</Link>
            </div>

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
                            {detail.businessRisk && (
                                <span className={`pv-meta-chip pv-risk-${detail.businessRisk.toLowerCase()}`}>
                                    <span className="pv-meta-chip-label">Risk</span>
                                    <span className="pv-meta-chip-value">{detail.businessRisk}</span>
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

            {selectedStage && <div className="pv-drawer-backdrop" onClick={closeDrawer} />}
            {selectedStage && <ProcessStageDrawer stage={selectedStage} onClose={closeDrawer} />}
        </div>
    );
}

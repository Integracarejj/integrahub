import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
    getBusinessProcesses,
    getBusinessProcessDetail,
} from "../../services/businessProcessService";
import type { BusinessProcessDetail } from "../../types/businessProcess";
import "./ProcessView.css";

export default function ProcessView() {
    const [processes, setProcesses] = useState<BusinessProcessDetail[]>([]);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [detail, setDetail] = useState<BusinessProcessDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [detailLoading, setDetailLoading] = useState(false);

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
                                            <div key={step.id} className="pv-stage">
                                                <div className="pv-stage-header">
                                                    <span className="pv-stage-step">{idx + 1}</span>
                                                    <div className="pv-stage-info">
                                                        <h3 className="pv-stage-name">{step.stepName}</h3>
                                                        {step.stepDescription && (
                                                            <p className="pv-stage-desc">{step.stepDescription}</p>
                                                        )}
                                                    </div>
                                                    <span className="pv-stage-count">{step.systems.length} system{step.systems.length !== 1 ? "s" : ""}</span>
                                                </div>

                                                {step.systems.length > 0 ? (
                                                    <div className="pv-stage-systems">
                                                        {step.systems.map(sys => (
                                                            <div key={sys.mappingId} className="pv-stage-system">
                                                                <div className="pv-stage-system-top">
                                                                    <Link to={`/applications/${sys.applicationId}`} className="pv-stage-system-name">
                                                                        {sys.applicationName}
                                                                    </Link>
                                                                </div>
                                                                <div className="pv-stage-system-badges">
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
                                                                {sys.notes && <p className="pv-stage-system-notes">{sys.notes}</p>}
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="pv-stage-empty">No systems mapped to this stage.</p>
                                                )}
                                            </div>
                                        ))}

                                        {detail.unassignedSystems && detail.unassignedSystems.length > 0 && (
                                            <div className="pv-stage">
                                                <div className="pv-stage-header pv-stage-header-unassigned">
                                                    <span className="pv-stage-step pv-stage-step-unassigned">—</span>
                                                    <div className="pv-stage-info">
                                                        <h3 className="pv-stage-name">Unassigned Systems</h3>
                                                        <p className="pv-stage-desc">Systems that belong to this process but have not been assigned to a stage.</p>
                                                    </div>
                                                    <span className="pv-stage-count">{detail.unassignedSystems.length} system{detail.unassignedSystems.length !== 1 ? "s" : ""}</span>
                                                </div>
                                                <div className="pv-stage-systems">
                                                    {detail.unassignedSystems.map(sys => (
                                                        <div key={sys.mappingId} className="pv-stage-system">
                                                            <div className="pv-stage-system-top">
                                                                <Link to={`/applications/${sys.applicationId}`} className="pv-stage-system-name">
                                                                    {sys.applicationName}
                                                                </Link>
                                                            </div>
                                                            <div className="pv-stage-system-badges">
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
                                                            {sys.notes && <p className="pv-stage-system-notes">{sys.notes}</p>}
                                                        </div>
                                                    ))}
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

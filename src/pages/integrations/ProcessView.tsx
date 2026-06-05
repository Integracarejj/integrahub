import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { usePermissions, isPlatformAdmin } from "../../hooks/usePermissions";
import {
    getBusinessProcesses,
    getBusinessProcessDetail,
    createBusinessProcess,
    updateBusinessProcess,
    addSystemToProcess,
    removeSystemFromProcess,
} from "../../services/businessProcessService";
import type { BusinessProcess, BusinessProcessDetail } from "../../types/businessProcess";
import "./ProcessView.css";

interface ApplicationOption {
    id: string;
    name: string;
    businessCriticality?: string;
    systemCategory?: string;
}

export default function ProcessView() {
    const { permissions } = usePermissions();
    const canAdmin = isPlatformAdmin(permissions);

    const [processes, setProcesses] = useState<BusinessProcess[]>([]);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [detail, setDetail] = useState<BusinessProcessDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [detailLoading, setDetailLoading] = useState(false);
    const [applications, setApplications] = useState<ApplicationOption[]>([]);

    const [showCreateForm, setShowCreateForm] = useState(false);
    const [createName, setCreateName] = useState("");
    const [createCategory, setCreateCategory] = useState("");
    const [createDescription, setCreateDescription] = useState("");
    const [creating, setCreating] = useState(false);

    const [showEditForm, setShowEditForm] = useState(false);
    const [editName, setEditName] = useState("");
    const [editCategory, setEditCategory] = useState("");
    const [editDescription, setEditDescription] = useState("");
    const [savingEdit, setSavingEdit] = useState(false);

    const [showAddForm, setShowAddForm] = useState(false);
    const [addAppId, setAddAppId] = useState("");
    const [addSequence, setAddSequence] = useState(0);
    const [addRole, setAddRole] = useState("");
    const [addNotes, setAddNotes] = useState("");
    const [adding, setAdding] = useState(false);

    const loadProcesses = useCallback(async () => {
        try {
            const data = await getBusinessProcesses();
            setProcesses(data);
            if (selectedId && !data.some(p => p.id === selectedId)) {
                setSelectedId(null);
                setDetail(null);
            }
        } catch {
            // silent
        } finally {
            setLoading(false);
        }
    }, [selectedId]);

    useEffect(() => {
        loadProcesses();
        fetch("/api/applications")
            .then(res => res.ok ? res.json() : [])
            .then(data => setApplications(data))
            .catch(() => setApplications([]));
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

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        if (!createName.trim()) return;
        setCreating(true);
        try {
            await createBusinessProcess({
                processName: createName.trim(),
                processCategory: createCategory.trim() || undefined,
                description: createDescription.trim() || undefined,
            });
            setCreateName("");
            setCreateCategory("");
            setCreateDescription("");
            setShowCreateForm(false);
            await loadProcesses();
        } catch {
            // silent
        } finally {
            setCreating(false);
        }
    }

    async function handleEdit(e: React.FormEvent) {
        e.preventDefault();
        if (!selectedId || !editName.trim()) return;
        setSavingEdit(true);
        try {
            await updateBusinessProcess(selectedId, {
                processName: editName.trim(),
                processCategory: editCategory.trim() || undefined,
                description: editDescription.trim() || undefined,
            });
            setShowEditForm(false);
            await loadProcesses();
            if (selectedId) {
                const data = await getBusinessProcessDetail(selectedId);
                setDetail(data);
            }
        } catch {
            // silent
        } finally {
            setSavingEdit(false);
        }
    }

    function startEdit() {
        if (!detail) return;
        setEditName(detail.processName);
        setEditCategory(detail.processCategory || "");
        setEditDescription(detail.description || "");
        setShowEditForm(true);
    }

    async function handleAddSystem(e: React.FormEvent) {
        e.preventDefault();
        if (!selectedId || !addAppId) return;
        setAdding(true);
        try {
            await addSystemToProcess(selectedId, {
                applicationId: addAppId,
                sequenceOrder: addSequence,
                processRole: addRole.trim() || undefined,
                notes: addNotes.trim() || undefined,
            });
            setAddAppId("");
            setAddRole("");
            setAddNotes("");
            setShowAddForm(false);
            const data = await getBusinessProcessDetail(selectedId);
            setDetail(data);
        } catch {
            // silent
        } finally {
            setAdding(false);
        }
    }

    async function handleRemoveSystem(mappingId: number) {
        if (!selectedId || !window.confirm("Remove this system from the process?")) return;
        try {
            await removeSystemFromProcess(selectedId, mappingId);
            const data = await getBusinessProcessDetail(selectedId);
            setDetail(data);
        } catch {
            // silent
        }
    }

    const appOptions = applications
        .filter(a => a.id && a.name)
        .sort((a, b) => a.name.localeCompare(b.name));

    const systemsInProcess = detail?.systems.length ?? 0;
    const connectedSystemIds = new Set<string>();
    detail?.systems.forEach(s => connectedSystemIds.add(s.applicationId));
    const criticalSystems = detail?.systems.filter(s => s.businessCriticality?.toLowerCase() === "critical").length ?? 0;

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

                        {canAdmin && (
                            <div className="pv-admin-actions">
                                {!showCreateForm && (
                                    <button className="btn btn-primary btn-sm" onClick={() => setShowCreateForm(true)}>
                                        + Create Process
                                    </button>
                                )}
                                {selectedId && detail && !showEditForm && (
                                    <button className="btn btn-sm" onClick={startEdit}>
                                        Edit Process
                                    </button>
                                )}
                                {selectedId && !showAddForm && (
                                    <button className="btn btn-sm" onClick={() => setShowAddForm(true)}>
                                        + Add System
                                    </button>
                                )}
                                {(showCreateForm || showEditForm || showAddForm) && (
                                    <button className="btn btn-sm" onClick={() => {
                                        setShowCreateForm(false);
                                        setShowEditForm(false);
                                        setShowAddForm(false);
                                    }}>
                                        Cancel
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {showCreateForm && canAdmin && (
                        <form className="pv-form-card" onSubmit={handleCreate}>
                            <h3 className="pv-form-title">Create Process</h3>
                            <div className="pv-form-grid">
                                <div className="pv-field">
                                    <label>Process Name *</label>
                                    <input type="text" value={createName} onChange={e => setCreateName(e.target.value)} required />
                                </div>
                                <div className="pv-field">
                                    <label>Category</label>
                                    <input type="text" value={createCategory} onChange={e => setCreateCategory(e.target.value)} placeholder="e.g. Resident Lifecycle" />
                                </div>
                                <div className="pv-field pv-field-wide">
                                    <label>Description</label>
                                    <textarea value={createDescription} onChange={e => setCreateDescription(e.target.value)} rows={2} />
                                </div>
                            </div>
                            <div className="pv-form-actions">
                                <button type="submit" className="btn btn-primary btn-sm" disabled={creating}>
                                    {creating ? "Creating…" : "Create"}
                                </button>
                            </div>
                        </form>
                    )}

                    {showEditForm && canAdmin && detail && (
                        <form className="pv-form-card" onSubmit={handleEdit}>
                            <h3 className="pv-form-title">Edit Process</h3>
                            <div className="pv-form-grid">
                                <div className="pv-field">
                                    <label>Process Name *</label>
                                    <input type="text" value={editName} onChange={e => setEditName(e.target.value)} required />
                                </div>
                                <div className="pv-field">
                                    <label>Category</label>
                                    <input type="text" value={editCategory} onChange={e => setEditCategory(e.target.value)} />
                                </div>
                                <div className="pv-field pv-field-wide">
                                    <label>Description</label>
                                    <textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} rows={2} />
                                </div>
                            </div>
                            <div className="pv-form-actions">
                                <button type="submit" className="btn btn-primary btn-sm" disabled={savingEdit}>
                                    {savingEdit ? "Saving…" : "Save"}
                                </button>
                            </div>
                        </form>
                    )}

                    {showAddForm && canAdmin && (
                        <form className="pv-form-card" onSubmit={handleAddSystem}>
                            <h3 className="pv-form-title">Add System to Process</h3>
                            <div className="pv-form-grid">
                                <div className="pv-field">
                                    <label>System *</label>
                                    <select value={addAppId} onChange={e => setAddAppId(e.target.value)} required>
                                        <option value="">Select system…</option>
                                        {appOptions.map(a => (
                                            <option key={a.id} value={a.id}>{a.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="pv-field">
                                    <label>Sequence Order</label>
                                    <input type="number" value={addSequence} onChange={e => setAddSequence(Number(e.target.value))} min={0} />
                                </div>
                                <div className="pv-field">
                                    <label>Process Role</label>
                                    <input type="text" value={addRole} onChange={e => setAddRole(e.target.value)} placeholder="e.g. Source System" />
                                </div>
                                <div className="pv-field pv-field-wide">
                                    <label>Notes</label>
                                    <textarea value={addNotes} onChange={e => setAddNotes(e.target.value)} rows={2} />
                                </div>
                            </div>
                            <div className="pv-form-actions">
                                <button type="submit" className="btn btn-primary btn-sm" disabled={adding}>
                                    {adding ? "Adding…" : "Add System"}
                                </button>
                            </div>
                        </form>
                    )}

                    {!selectedId && processes.length === 0 && (
                        <div className="pv-empty">
                            <h2>No business processes yet</h2>
                            <p>Business processes show how systems work together to support key workflows like Prospect to Resident or Employee Lifecycle.</p>
                            {canAdmin && (
                                <button className="btn btn-primary" onClick={() => setShowCreateForm(true)}>
                                    + Create Your First Process
                                </button>
                            )}
                        </div>
                    )}

                    {!selectedId && processes.length > 0 && (
                        <div className="pv-empty">
                            <h2>Select a Process</h2>
                            <p>Choose a business process from the dropdown above to see how systems support the workflow.</p>
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
                                    <span className="pv-summary-value">{connectedSystemIds.size}</span>
                                    <span className="pv-summary-label">Unique Systems</span>
                                </div>
                                <div className="pv-summary-card">
                                    <span className="pv-summary-value">{criticalSystems}</span>
                                    <span className="pv-summary-label">Critical Systems</span>
                                </div>
                            </div>

                            {detail.systems.length === 0 ? (
                                <div className="pv-empty-state">
                                    <p>No systems have been added to this process yet.</p>
                                    {canAdmin && (
                                        <button className="btn btn-primary btn-sm" onClick={() => setShowAddForm(true)}>
                                            + Add System
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="pv-flow">
                                    {detail.systems
                                        .sort((a, b) => a.sequenceOrder - b.sequenceOrder)
                                        .map((sys, idx) => (
                                            <div key={sys.mappingId} className="pv-step">
                                                <div className="pv-step-connector">
                                                    <span className="pv-step-number">{idx + 1}</span>
                                                    {idx < detail.systems.length - 1 && <div className="pv-step-line" />}
                                                </div>
                                                <div className="pv-step-card">
                                                    <div className="pv-step-card-top">
                                                        <Link to={`/applications/${sys.applicationId}`} className="pv-step-name">
                                                            {sys.applicationName}
                                                        </Link>
                                                        {canAdmin && (
                                                            <button
                                                                className="pv-step-remove"
                                                                onClick={() => handleRemoveSystem(sys.mappingId)}
                                                                title="Remove from process"
                                                            >
                                                                ×
                                                            </button>
                                                        )}
                                                    </div>
                                                    <div className="pv-step-badges">
                                                        {sys.systemCategory && <span className="pv-step-badge">{sys.systemCategory}</span>}
                                                        {sys.businessCriticality && (
                                                            <span className={`pv-step-badge pv-crit-${sys.businessCriticality.toLowerCase()}`}>
                                                                {sys.businessCriticality}
                                                            </span>
                                                        )}
                                                        {sys.processRole && <span className="pv-step-badge pv-role">{sys.processRole}</span>}
                                                    </div>
                                                    {sys.notes && <p className="pv-step-notes">{sys.notes}</p>}
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

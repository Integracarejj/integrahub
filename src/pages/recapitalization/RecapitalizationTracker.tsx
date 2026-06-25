import { useState, useMemo } from "react";
import { getRequests, getTransactions, getTeamMembers, getTeams, getActivityByTransaction, getDocumentsByTransaction, updateRequestStatus, updateRequestOwner, updateRequestPriority, updateRequestDueDate, updateRequestTeam } from "../../services/recapMockData";
import type { RecapRequest } from "../../services/recapMockData";
import "./Recapitalization.css";

function RequestDrawer({ request, onClose, onUpdate }: { request: RecapRequest; onClose: () => void; onUpdate: (id: string) => void }) {
    const activity = getActivityByTransaction(request.transactionId).slice(0, 8);
    const documents = getDocumentsByTransaction(request.transactionId).filter(d => d.requestId === request.id);
    const members = getTeamMembers();

    const [editMode, setEditMode] = useState<string | null>(null);
    const [statusValue, setStatusValue] = useState(request.status);
    const [ownerValue, setOwnerValue] = useState(request.owner || "");
    const [teamValue, setTeamValue] = useState(request.team);
    const [priorityValue, setPriorityValue] = useState(request.priority);
    const [dueDateValue, setDueDateValue] = useState(request.dueDate);

    function handleSave(field: string) {
        switch (field) {
            case "status": updateRequestStatus(request.id, statusValue as RecapRequest["status"]); break;
            case "owner": updateRequestOwner(request.id, ownerValue || null); break;
            case "team": updateRequestTeam(request.id, teamValue); break;
            case "priority": updateRequestPriority(request.id, priorityValue as RecapRequest["priority"]); break;
            case "dueDate": updateRequestDueDate(request.id, dueDateValue); break;
        }
        onUpdate(request.id);
        setEditMode(null);
    }

    return (
        <>
            <div className="rc-drawer-overlay" onClick={onClose} />
            <div className="rc-drawer">
                <div className="rc-drawer-header">
                    <div>
                        <h2>{request.title}</h2>
                        <div className="rc-drawer-sub">{request.requestId} &middot; {request.transactionName}</div>
                    </div>
                    <button className="rc-drawer-close" onClick={onClose}>&times;</button>
                </div>

                <div className="rc-drawer-body">
                    <div className="rc-drawer-section">
                        <div className="rc-drawer-section-title">Summary</div>
                        <div className="rc-detail-grid">
                            <div className="rc-drawer-field">
                                <span className="rc-drawer-field-label">Transaction</span>
                                <span className="rc-drawer-field-value" style={{ color: "#64748b" }}>{request.transactionName}</span>
                            </div>
                            <div className="rc-drawer-field">
                                <span className="rc-drawer-field-label">Broker/Buyer</span>
                                <span className="rc-drawer-field-value" style={{ color: "#64748b" }}>{request.brokerBuyer}</span>
                            </div>
                            <div className="rc-drawer-field">
                                <span className="rc-drawer-field-label">Communities</span>
                                <span className="rc-drawer-field-value" style={{ color: "#64748b" }}>{request.communityNames.join(", ") || "All Communities"}</span>
                            </div>
                            <div className="rc-drawer-field">
                                <span className="rc-drawer-field-label">Category</span>
                                <span className="rc-drawer-field-value">{request.category}</span>
                            </div>
                            <div className="rc-drawer-field">
                                <span className="rc-drawer-field-label">Submitted By</span>
                                <span className="rc-drawer-field-value" style={{ color: "#64748b" }}>{request.submittedBy}</span>
                            </div>
                            <div className="rc-drawer-field">
                                <span className="rc-drawer-field-label">Source</span>
                                <span className="rc-drawer-field-value">{request.source}</span>
                            </div>
                            <div className="rc-drawer-field">
                                <span className="rc-drawer-field-label">Created</span>
                                <span className="rc-drawer-field-value">{request.createdDate}</span>
                            </div>
                            <div className="rc-drawer-field">
                                <span className="rc-drawer-field-label">Last Updated</span>
                                <span className="rc-drawer-field-value">{request.lastUpdated}</span>
                            </div>
                        </div>
                    </div>

                    <hr className="rc-divider" />

                    <div className="rc-drawer-section">
                        <div className="rc-drawer-section-title">Assignment</div>
                        <div className="rc-detail-grid">
                            <div className="rc-drawer-field">
                                <span className="rc-drawer-field-label">Owner</span>
                                {editMode === "owner" ? (
                                    <div className="rc-flex-center rc-gap-sm">
                                        <select className="rc-filter-select" value={ownerValue} onChange={e => setOwnerValue(e.target.value)}>
                                            <option value="">Unassigned</option>
                                            {members.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                                        </select>
                                        <button className="rc-btn rc-btn-primary rc-btn-sm" onClick={() => handleSave("owner")}>Save</button>
                                        <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => setEditMode(null)}>Cancel</button>
                                    </div>
                                ) : (
                                    <div className="rc-flex-center">
                                        <span className="rc-drawer-field-value">{request.owner || "Unassigned"}</span>
                                        <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => setEditMode("owner")}>Edit</button>
                                    </div>
                                )}
                            </div>
                            <div className="rc-drawer-field">
                                <span className="rc-drawer-field-label">Team</span>
                                {editMode === "team" ? (
                                    <div className="rc-flex-center rc-gap-sm">
                                        <select className="rc-filter-select" value={teamValue} onChange={e => setTeamValue(e.target.value)}>
                                            {getTeams().map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                        <button className="rc-btn rc-btn-primary rc-btn-sm" onClick={() => handleSave("team")}>Save</button>
                                        <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => setEditMode(null)}>Cancel</button>
                                    </div>
                                ) : (
                                    <div className="rc-flex-center">
                                        <span className="rc-drawer-field-value">{request.team}</span>
                                        <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => setEditMode("team")}>Edit</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <hr className="rc-divider" />

                    <div className="rc-drawer-section">
                        <div className="rc-drawer-section-title">Status</div>
                        <div className="rc-detail-grid">
                            <div className="rc-drawer-field">
                                <span className="rc-drawer-field-label">Current Status</span>
                                {editMode === "status" ? (
                                    <div className="rc-flex-center rc-gap-sm">
                                        <select className="rc-filter-select" value={statusValue} onChange={e => setStatusValue(e.target.value as RecapRequest["status"])}>
                                            {["Open", "In Progress", "Clarification Needed", "Under Review", "Provided", "Overdue"].map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                        <button className="rc-btn rc-btn-primary rc-btn-sm" onClick={() => handleSave("status")}>Save</button>
                                        <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => setEditMode(null)}>Cancel</button>
                                    </div>
                                ) : (
                                    <div className="rc-flex-center">
                                        <span className={`rc-badge rc-badge-${statusValue === "Overdue" ? "overdue" : statusValue.toLowerCase().replace(/\s+/g, "-")}`}>{statusValue}</span>
                                        <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => setEditMode("status")}>Edit</button>
                                    </div>
                                )}
                            </div>
                            <div className="rc-drawer-field">
                                <span className="rc-drawer-field-label">Priority</span>
                                {editMode === "priority" ? (
                                    <div className="rc-flex-center rc-gap-sm">
                                        <select className="rc-filter-select" value={priorityValue} onChange={e => setPriorityValue(e.target.value as RecapRequest["priority"])}>
                                            {["High", "Medium", "Low"].map(p => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                        <button className="rc-btn rc-btn-primary rc-btn-sm" onClick={() => handleSave("priority")}>Save</button>
                                        <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => setEditMode(null)}>Cancel</button>
                                    </div>
                                ) : (
                                    <div className="rc-flex-center">
                                        <span className={`rc-badge rc-badge-${priorityValue.toLowerCase()}`}>{priorityValue}</span>
                                        <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => setEditMode("priority")}>Edit</button>
                                    </div>
                                )}
                            </div>
                            <div className="rc-drawer-field">
                                <span className="rc-drawer-field-label">Due Date</span>
                                {editMode === "dueDate" ? (
                                    <div className="rc-flex-center rc-gap-sm">
                                        <input type="date" className="rc-filter-select" value={dueDateValue} onChange={e => setDueDateValue(e.target.value)} />
                                        <button className="rc-btn rc-btn-primary rc-btn-sm" onClick={() => handleSave("dueDate")}>Save</button>
                                        <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => setEditMode(null)}>Cancel</button>
                                    </div>
                                ) : (
                                    <div className="rc-flex-center">
                                        <span className="rc-drawer-field-value">{request.dueDate}</span>
                                        <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => setEditMode("dueDate")}>Edit</button>
                                    </div>
                                )}
                            </div>
                            <div className="rc-drawer-field">
                                <span className="rc-drawer-field-label">External Visible</span>
                                <div className="rc-flex-center">
                                    <span className={`rc-badge ${request.externalVisible ? "rc-badge-visible" : "rc-badge-hidden"}`}>
                                        {request.externalVisible ? "Visible" : "Hidden"}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <hr className="rc-divider" />

                    <div className="rc-drawer-section">
                        <div className="rc-drawer-section-title">Documents ({documents.length})</div>
                        {documents.length === 0 ? (
                            <span className="rc-text-muted">No documents linked to this request</span>
                        ) : documents.map(doc => (
                            <div key={doc.id} className="rc-flex-center" style={{ justifyContent: "space-between" }}>
                                <span style={{ fontSize: 13, color: "#1e293b" }}>{doc.name}</span>
                                <span className="rc-text-muted">{doc.size}</span>
                            </div>
                        ))}
                    </div>

                    <hr className="rc-divider" />

                    <div className="rc-drawer-section">
                        <div className="rc-drawer-section-title">Activity</div>
                        <div className="rc-timeline">
                            {activity.map((act, i) => (
                                <div className="rc-timeline-item" key={act.id}>
                                    <div style={{ position: "relative" }}>
                                        <div className="rc-timeline-dot" />
                                        {i < activity.length - 1 && <div className="rc-timeline-line" />}
                                    </div>
                                    <div className="rc-timeline-content">
                                        <span className="rc-timeline-desc">{act.description}</span>
                                        <span className="rc-timeline-meta">{act.userName} &middot; {new Date(act.timestamp).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="rc-drawer-actions">
                    <button className="rc-btn rc-btn-primary rc-btn-sm" onClick={() => { setEditMode("status"); setStatusValue(statusValue); }}>Update Status</button>
                    <button className="rc-btn rc-btn-secondary rc-btn-sm" onClick={() => { setEditMode("owner"); setOwnerValue(request.owner || ""); }}>Assign Owner</button>
                    <button className="rc-btn rc-btn-secondary rc-btn-sm">Link Document</button>
                    <button className="rc-btn rc-btn-secondary rc-btn-sm">Internal Note</button>
                    <button className="rc-btn rc-btn-secondary rc-btn-sm">Respond Externally</button>
                    <button className="rc-btn rc-btn-ghost rc-btn-sm" style={{ color: "#991b1b" }}>Mark Duplicate</button>
                    <button className="rc-btn rc-btn-ghost rc-btn-sm" style={{ color: "#991b1b" }}>N/A</button>
                </div>
            </div>
        </>
    );
}

export default function RecapitalizationTracker() {
    const allRequests = getRequests();
    const transactions = getTransactions();
    const members = getTeamMembers();
    const teams = getTeams();

    const [search, setSearch] = useState("");
    const [filterTxn, setFilterTxn] = useState("all");
    const [filterStatus, setFilterStatus] = useState("all");
    const [filterPriority, setFilterPriority] = useState("all");
    const [filterTeam, setFilterTeam] = useState("all");
    const [filterOwner, setFilterOwner] = useState("all");

    const [overdueOnly, setOverdueOnly] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState<RecapRequest | null>(null);

    const filtered = useMemo(() => {
        let result = [...allRequests];
        if (search) {
            const q = search.toLowerCase();
            result = result.filter(r => r.title.toLowerCase().includes(q) || r.requestId.toLowerCase().includes(q) || r.brokerBuyer.toLowerCase().includes(q));
        }
        if (filterTxn !== "all") result = result.filter(r => r.transactionId === filterTxn);
        if (filterStatus !== "all") result = result.filter(r => r.status === filterStatus);
        if (filterPriority !== "all") result = result.filter(r => r.priority === filterPriority);
        if (filterTeam !== "all") result = result.filter(r => r.team === filterTeam);
        if (filterOwner !== "all") result = result.filter(r => (r.owner || "Unassigned") === filterOwner);
        if (overdueOnly) result = result.filter(r => r.status === "Overdue");
        return result;
    }, [allRequests, search, filterTxn, filterStatus, filterPriority, filterTeam, filterOwner, overdueOnly]);

    return (
        <div className="rc-page">
            <div className="rc-header">
                <h1>Request Tracker</h1>
                <div className="rc-header-actions">
                    <button className="rc-btn rc-btn-primary">Import DD Package</button>
                    <button className="rc-btn rc-btn-secondary">New Request</button>
                    <button className="rc-btn rc-btn-secondary">Bulk Update</button>
                    <button className="rc-btn rc-btn-secondary">Export</button>
                </div>
            </div>

            <div className="rc-card">
                <div className="rc-filter-bar">
                    <div className="rc-search-box">
                        <span style={{ color: "#94a3b8", fontSize: 14 }}>&#8981;</span>
                        <input placeholder="Search requests..." value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <select className="rc-filter-select" value={filterTxn} onChange={e => setFilterTxn(e.target.value)}>
                        <option value="all">All Transactions</option>
                        {transactions.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <select className="rc-filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                        <option value="all">All Statuses</option>
                        {["Open", "In Progress", "Clarification Needed", "Under Review", "Provided", "Overdue"].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <select className="rc-filter-select" value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
                        <option value="all">All Priorities</option>
                        {["High", "Medium", "Low"].map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <select className="rc-filter-select" value={filterTeam} onChange={e => setFilterTeam(e.target.value)}>
                        <option value="all">All Teams</option>
                        {teams.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <select className="rc-filter-select" value={filterOwner} onChange={e => setFilterOwner(e.target.value)}>
                        <option value="all">All Owners</option>
                        {members.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                        <option value="Unassigned">Unassigned</option>
                    </select>
                    <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#991b1b", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                        <input type="checkbox" checked={overdueOnly} onChange={e => setOverdueOnly(e.target.checked)} />
                        Overdue Only
                    </label>
                </div>
            </div>

            <div className="rc-card" style={{ overflow: "auto" }}>
                <table className="rc-table">
                    <thead>
                        <tr>
                            <th>Request ID</th>
                            <th>Transaction</th>
                            <th>Broker/Buyer</th>
                            <th>Community</th>
                            <th>Category</th>
                            <th style={{ minWidth: 200 }}>Title</th>
                            <th>Owner</th>
                            <th>Team</th>
                            <th>Status</th>
                            <th>Priority</th>
                            <th>Due</th>
                            <th>Updated</th>
                            <th>Visible</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map(req => (
                            <tr key={req.id} className="rc-row-clickable" onClick={() => setSelectedRequest(req)}>
                                <td style={{ fontWeight: 600, fontSize: 12, color: "#475569" }}>{req.requestId}</td>
                                <td className="rc-truncate">{req.transactionName}</td>
                                <td className="rc-truncate">{req.brokerBuyer}</td>
                                <td className="rc-truncate">{req.communityNames.join(", ") || "All"}</td>
                                <td>{req.category}</td>
                                <td className="rc-truncate" style={{ fontWeight: 500 }}>{req.title}</td>
                                <td style={{ color: req.owner ? "#1e293b" : "#94a3b8", fontSize: 12 }}>{req.owner || "—"}</td>
                                <td style={{ fontSize: 12 }}>{req.team}</td>
                                <td><span className={`rc-badge rc-badge-${req.status === "Overdue" ? "overdue" : req.status.toLowerCase().replace(/\s+/g, "-")}`}>{req.status}</span></td>
                                <td><span className={`rc-badge rc-badge-${req.priority.toLowerCase()}`}>{req.priority}</span></td>
                                <td style={{ fontSize: 12, color: req.status === "Overdue" ? "#991b1b" : "#475569", fontWeight: req.status === "Overdue" ? 600 : 400 }}>{req.dueDate}</td>
                                <td style={{ fontSize: 12, color: "#64748b" }}>{req.lastUpdated}</td>
                                <td><span className={`rc-badge ${req.externalVisible ? "rc-badge-visible" : "rc-badge-hidden"}`} style={{ fontSize: 10, padding: "2px 6px" }}>{req.externalVisible ? "Yes" : "No"}</span></td>
                                <td>
                                    <div className="rc-cell-actions">
                                        <button className="rc-btn rc-btn-ghost rc-btn-sm rc-btn-icon" title="Assign" onClick={e => { e.stopPropagation(); setSelectedRequest(req); }} style={{ fontSize: 14 }}>&#9998;</button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filtered.length === 0 && <div className="rc-empty-state">No requests match your filters</div>}
            </div>

            <div style={{ fontSize: 12, color: "#94a3b8" }}>Showing {filtered.length} of {allRequests.length} requests</div>

            {selectedRequest && (
                <RequestDrawer
                    request={selectedRequest}
                    onClose={() => setSelectedRequest(null)}
                    onUpdate={(id) => {
                        const updated = allRequests.find(r => r.id === id);
                        if (updated) setSelectedRequest({ ...updated });
                    }}
                />
            )}
        </div>
    );
}

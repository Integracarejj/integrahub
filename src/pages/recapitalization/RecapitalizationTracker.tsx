import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
    getRequests, getTransactions, getTeamMembers, getTeams,
    updateRequestStatus, updateRequestOwner, updateRequestTeam,
    updateRequestPriority, updateRequestDueDate, isDemoActive,
} from "../../services/recapDataService";
import type { RecapRequest } from "../../services/recapDataService";
import RecapSubNav from "./RecapSubNav";
import "./Recapitalization.css";

interface BulkEdit {
    owner: string;
    team: string;
    priority: string;
    status: string;
    dueDate: string;
    visible: string;
}

export default function RecapitalizationTracker() {
    const navigate = useNavigate();
    const transactions = getTransactions();
    const members = getTeamMembers();
    const teams = getTeams();
    const [refreshKey, setRefreshKey] = useState(0);
    const allRequests = useMemo(() => getRequests(), [refreshKey]);

    const [search, setSearch] = useState("");
    const [filterTxn, setFilterTxn] = useState("all");
    const [filterStatus, setFilterStatus] = useState("all");
    const [filterPriority, setFilterPriority] = useState("all");
    const [filterTeam, setFilterTeam] = useState("all");
    const [filterOwner, setFilterOwner] = useState("all");

    const [overdueOnly, setOverdueOnly] = useState(false);
    const [myItems, setMyItems] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const [bulkModalOpen, setBulkModalOpen] = useState(false);
    const [bulkEdit, setBulkEdit] = useState<BulkEdit>({ owner: "", team: "", priority: "", status: "", dueDate: "", visible: "" });
    const [bulkToast, setBulkToast] = useState("");

    const selectAllRef = useRef<HTMLInputElement>(null);

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
        if (myItems) result = result.filter(r => r.owner === "Sarah Chen");
        return result;
    }, [allRequests, search, filterTxn, filterStatus, filterPriority, filterTeam, filterOwner, overdueOnly, myItems]);

    const visibleIds = useMemo(() => new Set(filtered.map(r => r.id)), [filtered]);

    const allSelected = filtered.length > 0 && filtered.every(r => selectedIds.has(r.id));
    const someSelected = filtered.some(r => selectedIds.has(r.id));

    useEffect(() => {
        if (selectAllRef.current) {
            selectAllRef.current.indeterminate = someSelected && !allSelected;
        }
    }, [someSelected, allSelected]);

    function handleSelectAll() {
        if (allSelected) {
            setSelectedIds(prev => {
                const next = new Set(prev);
                for (const id of visibleIds) next.delete(id);
                return next;
            });
        } else {
            setSelectedIds(prev => {
                const next = new Set(prev);
                for (const id of visibleIds) next.add(id);
                return next;
            });
        }
    }

    function handleSelectOne(id: string) {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    }

    function clearSelection() {
        setSelectedIds(new Set());
    }

    function handleBulkChange(field: keyof BulkEdit, value: string) {
        setBulkEdit(prev => ({ ...prev, [field]: value }));
    }

    function handleBulkApply() {
        const ids = [...selectedIds];
        ids.forEach(id => {
            if (bulkEdit.owner) updateRequestOwner(id, bulkEdit.owner === "__unset" ? null : bulkEdit.owner);
            if (bulkEdit.team) updateRequestTeam(id, bulkEdit.team);
            if (bulkEdit.priority) updateRequestPriority(id, bulkEdit.priority as RecapRequest["priority"]);
            if (bulkEdit.status) updateRequestStatus(id, bulkEdit.status as RecapRequest["status"]);
            if (bulkEdit.dueDate) updateRequestDueDate(id, bulkEdit.dueDate);
        });
        setRefreshKey(k => k + 1);
        setBulkModalOpen(false);
        setBulkEdit({ owner: "", team: "", priority: "", status: "", dueDate: "", visible: "" });
        setBulkToast(`Updated ${ids.length} request${ids.length !== 1 ? "s" : ""}`);
        setTimeout(() => setBulkToast(""), 2500);
    }

    return (
        <div className="rc-page">
            <RecapSubNav />
            <div className="rc-header">
                <h1>Request Tracker</h1>
                <div className="rc-header-left" style={{ gap: 8 }}>
                    {isDemoActive() && <span className="rc-badge rc-badge-visible" style={{ fontSize: 10 }}>ABC Demo Active</span>}
                </div>
                <div className="rc-header-actions">
                    <button className="rc-btn rc-btn-primary" onClick={() => navigate("/recapitalization/intake/review")}>Import DD Package</button>
                    <button className="rc-btn rc-btn-secondary" onClick={() => { setBulkToast("New Request — coming in next sprint"); setTimeout(() => setBulkToast(""), 2500); }}>New Request</button>
                    <button className="rc-btn rc-btn-secondary" onClick={() => { setBulkToast("Export — coming next sprint"); setTimeout(() => setBulkToast(""), 2500); }}>Export</button>
                </div>
            </div>

            <div className="rc-card">
                <div className="rc-filter-bar">
                    <div className="rc-search-box">
                        <span style={{ color: "#64748b", fontSize: 14 }}>&#8981;</span>
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
                    <div className="rc-toggle-group">
                        <button className={`rc-toggle-btn${!myItems ? " rc-toggle-active" : ""}`} onClick={() => setMyItems(false)}>All Items</button>
                        <button className={`rc-toggle-btn${myItems ? " rc-toggle-active" : ""}`} onClick={() => setMyItems(true)}>My Items</button>
                    </div>
                </div>

                {selectedIds.size > 0 && (
                    <div className="rc-bulk-bar">
                        <span className="rc-bulk-count">{selectedIds.size}</span>
                        <span>selected</span>
                        <div className="rc-bulk-sep" />
                        <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => { setBulkEdit({ owner: "", team: "", priority: "", status: "", dueDate: "", visible: "" }); setBulkModalOpen(true); }}>Bulk Update</button>
                        <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => { setBulkToast("Assign — coming next sprint"); setTimeout(() => setBulkToast(""), 2500); }}>Assign</button>
                        <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => { setBulkToast("Route to Team — coming next sprint"); setTimeout(() => setBulkToast(""), 2500); }}>Route to Team</button>
                        <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => { setBulkToast("Mark Duplicate — coming next sprint"); setTimeout(() => setBulkToast(""), 2500); }}>Mark Duplicate</button>
                        <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => { setBulkToast("Mark Not Applicable — coming next sprint"); setTimeout(() => setBulkToast(""), 2500); }}>Mark Not Applicable</button>
                        <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => { setBulkToast("Reject — coming next sprint"); setTimeout(() => setBulkToast(""), 2500); }}>Reject</button>
                        <div className="rc-bulk-sep" />
                        <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={clearSelection}>Clear Selection</button>
                    </div>
                )}
            </div>

            <div className="rc-table-wrap-scroll">
                <table className="rc-table">
                    <thead>
                        <tr>
                            <th style={{ width: 36 }}>
                                <input
                                    ref={selectAllRef}
                                    type="checkbox"
                                    className="rc-checkbox-header"
                                    checked={allSelected}
                                    onChange={handleSelectAll}
                                />
                            </th>
                            <th>Intake ID</th>
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
                            <th className="nowrap">Due</th>
                            <th className="nowrap">Updated</th>
                            <th>Visible</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map(req => (
                            <tr key={req.id} className="rc-row-clickable" onClick={() => navigate(`/recapitalization/workspace/${req.intakeId}`)}>
                                <td style={{ width: 36 }} onClick={e => e.stopPropagation()}>
                                    <input
                                        type="checkbox"
                                        className="rc-checkbox"
                                        checked={selectedIds.has(req.id)}
                                        onChange={() => handleSelectOne(req.id)}
                                    />
                                </td>
                                <td style={{ fontFamily: '"SF Mono", "Cascadia Code", "Consolas", monospace', fontSize: 11, color: "#475569" }}>{req.intakeId}</td>
                                <td style={{ fontWeight: 600, fontSize: 12, color: "#334155" }}>{req.requestId}</td>
                                <td className="rc-truncate">{req.transactionName}</td>
                                <td className="rc-truncate">{req.brokerBuyer}</td>
                                <td className="rc-truncate">{req.communityNames.join(", ") || "All"}</td>
                                <td>{req.category}</td>
                                <td className="rc-truncate" style={{ fontWeight: 500 }}>{req.title}</td>
                                <td style={{ color: req.owner ? "#1e293b" : "#64748b", fontSize: 12 }}>{req.owner || "—"}</td>
                                <td style={{ fontSize: 12 }}>{req.team}</td>
                                <td><span className={`rc-badge rc-badge-${req.status === "Overdue" ? "overdue" : req.status.toLowerCase().replace(/\s+/g, "-")}`}>{req.status}</span></td>
                                <td><span className={`rc-badge rc-badge-${req.priority.toLowerCase()}`}>{req.priority}</span></td>
                                <td className="nowrap" style={{ fontSize: 12, color: req.status === "Overdue" ? "#991b1b" : "#475569", fontWeight: req.status === "Overdue" ? 600 : 400 }}>{req.dueDate}</td>
                                <td className="nowrap" style={{ fontSize: 12, color: "#475569" }}>{req.lastUpdated}</td>
                                <td><span className={`rc-badge ${req.externalVisible ? "rc-badge-visible" : "rc-badge-hidden"}`} style={{ fontSize: 10, padding: "2px 6px" }}>{req.externalVisible ? "Yes" : "No"}</span></td>
                                <td>
                                    <div className="rc-cell-actions">
                                        <button className="rc-btn rc-btn-ghost rc-btn-sm rc-btn-icon" title="Open Workspace" onClick={e => { e.stopPropagation(); navigate(`/recapitalization/workspace/${req.intakeId}`); }} style={{ fontSize: 14 }}>&#9998;</button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filtered.length === 0 && <div className="rc-empty-state">No requests match your filters</div>}
            </div>

            <div style={{ fontSize: 12, color: "#64748b" }}>Showing {filtered.length} of {allRequests.length} requests</div>

            {bulkModalOpen && (
                <div className="rc-modal-overlay" onClick={() => setBulkModalOpen(false)}>
                    <div className="rc-modal" onClick={e => e.stopPropagation()}>
                        <div className="rc-modal-header">
                            <h2>Bulk Update ({selectedIds.size} requests)</h2>
                            <button className="rc-modal-close" onClick={() => setBulkModalOpen(false)}>&times;</button>
                        </div>
                        <div className="rc-modal-body">
                            <div className="rc-modal-field">
                                <label>Assign Owner</label>
                                <select value={bulkEdit.owner} onChange={e => handleBulkChange("owner", e.target.value)}>
                                    <option value="">— No change —</option>
                                    <option value="__unset">Unassign</option>
                                    {members.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                                </select>
                            </div>
                            <div className="rc-modal-field">
                                <label>Route to Team</label>
                                <select value={bulkEdit.team} onChange={e => handleBulkChange("team", e.target.value)}>
                                    <option value="">— No change —</option>
                                    {teams.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div className="rc-modal-field">
                                <label>Set Priority</label>
                                <select value={bulkEdit.priority} onChange={e => handleBulkChange("priority", e.target.value)}>
                                    <option value="">— No change —</option>
                                    <option value="High">High</option>
                                    <option value="Medium">Medium</option>
                                    <option value="Low">Low</option>
                                </select>
                            </div>
                            <div className="rc-modal-field">
                                <label>Set Status</label>
                                <select value={bulkEdit.status} onChange={e => handleBulkChange("status", e.target.value)}>
                                    <option value="">— No change —</option>
                                    {["Open", "In Progress", "Clarification Needed", "Under Review", "Provided", "Overdue"].map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div className="rc-modal-field">
                                <label>Set Due Date</label>
                                <input type="date" value={bulkEdit.dueDate} onChange={e => handleBulkChange("dueDate", e.target.value)} />
                            </div>
                        </div>
                        <div className="rc-modal-footer">
                            <button className="rc-btn rc-btn-ghost" onClick={() => setBulkModalOpen(false)}>Cancel</button>
                            <button className="rc-btn rc-btn-primary" onClick={handleBulkApply} disabled={!bulkEdit.owner && !bulkEdit.team && !bulkEdit.priority && !bulkEdit.status && !bulkEdit.dueDate}>Apply to {selectedIds.size} Selected</button>
                        </div>
                    </div>
                </div>
            )}

            {bulkToast && (
                <div style={{ position: "fixed", bottom: 24, right: 24, background: "#0f172a", color: "#fff", padding: "10px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600, zIndex: 3000, boxShadow: "0 4px 16px rgba(0,0,0,0.2)" }}>
                    {bulkToast}
                </div>
            )}
        </div>
    );
}

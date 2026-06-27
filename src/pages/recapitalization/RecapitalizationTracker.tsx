import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
    getRequests, getTransactions, getTeamMembers, getTeams,
    updateRequestStatus, updateRequestOwner, updateRequestTeam,
    updateRequestPriority, updateRequestDueDate, isDemoActive,
    bulkUpdateDemoRequests,
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

const STATUS_OPTIONS = ["Open", "In Progress", "Pending External", "Blocked", "Ready for Review", "Complete", "Not Applicable", "Duplicate"];

export default function RecapitalizationTracker() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
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
    const [routeModalOpen, setRouteModalOpen] = useState(false);
    const [routeModalTeam, setRouteModalTeam] = useState("");
    const [detailModalItem, setDetailModalItem] = useState<RecapRequest | null>(null);
    const [respondModalOpen, setRespondModalOpen] = useState(false);
    const [respondText, setRespondText] = useState("");
    const [publishModalOpen, setPublishModalOpen] = useState(false);
    const [publishText, setPublishText] = useState("");

    const selectAllRef = useRef<HTMLInputElement>(null);

    const publishedBatchId = searchParams.get("publishedBatchId") || "";
    const sourcePackageId = searchParams.get("sourcePackageId") || "";
    const sourceIntakeId = searchParams.get("sourceIntakeId") || "";

    const hasFilter = publishedBatchId || sourcePackageId || sourceIntakeId;

    const filtered = useMemo(() => {
        // Only show published items (_publishedAt is set or _createdFromReview is true)
        let result = allRequests.filter(r => r._publishedAt || r._createdFromReview);
        // Sort: publishedAt DESC, createdDate DESC, requestId DESC
        result.sort((a, b) => {
            const aPub = a._convertedAt ? new Date(a._convertedAt).getTime() : 0;
            const bPub = b._convertedAt ? new Date(b._convertedAt).getTime() : 0;
            if (bPub !== aPub) return bPub - aPub;
            const aDate = a.createdDate ? new Date(a.createdDate).getTime() : 0;
            const bDate = b.createdDate ? new Date(b.createdDate).getTime() : 0;
            if (bDate !== aDate) return bDate - aDate;
            return (b.requestId || b.id).localeCompare(a.requestId || a.id);
        });
        if (publishedBatchId) {
            // Filter to items published in this batch — approximate via _publishedAt set recently
            const batchTime = parseInt(publishedBatchId.replace("batch-", ""), 10);
            if (!isNaN(batchTime)) {
                const batchDate = new Date(batchTime).toISOString().split("T")[0];
                result = result.filter(r => r._publishedAt === batchDate && r._createdFromReview);
            }
        }
        if (sourcePackageId) result = result.filter(r => r._sourcePackageId === sourcePackageId);
        if (sourceIntakeId) result = result.filter(r => r._sourceIntakeId === sourceIntakeId);
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
    }, [allRequests, search, filterTxn, filterStatus, filterPriority, filterTeam, filterOwner, overdueOnly, myItems, publishedBatchId, sourcePackageId, sourceIntakeId]);

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
        setTimeout(() => setBulkToast(""), 3000);
    }

    function handleStatusChange(req: RecapRequest, newStatus: string) {
        updateRequestStatus(req.id, newStatus as RecapRequest["status"]);
        setRefreshKey(k => k + 1);
        setBulkToast(`${req.requestId}: status changed to ${newStatus}`);
        setTimeout(() => setBulkToast(""), 3000);
    }

    function clearFilterParam() {
        const params = new URLSearchParams(searchParams);
        params.delete("publishedBatchId");
        params.delete("sourcePackageId");
        params.delete("sourceIntakeId");
        navigate(`/recapitalization/tracker${params.toString() ? "?" + params.toString() : ""}`, { replace: true });
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
                    <button className="rc-btn rc-btn-secondary" onClick={() => navigate("/recapitalization/intake/review")}>New Request</button>
                    <button className="rc-btn rc-btn-secondary" onClick={() => { setBulkToast("Export feature coming soon"); setTimeout(() => setBulkToast(""), 2500); }}>Export</button>
                </div>
            </div>

            {hasFilter && (
                <div style={{ padding: "8px 16px", marginBottom: 12, borderRadius: 8, fontSize: 13, fontWeight: 600, background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe", display: "flex", alignItems: "center", gap: 12 }}>
                    <span>Showing {filtered.length} request{filtered.length !== 1 ? "s" : ""} published from {sourcePackageId ? `package ${sourcePackageId}` : publishedBatchId ? `batch ${publishedBatchId}` : sourceIntakeId ? `intake ${sourceIntakeId}` : "filter"}.</span>
                    <button className="rc-btn rc-btn-ghost rc-btn-sm" style={{ color: "#1d4ed8", fontWeight: 600 }} onClick={clearFilterParam}>Clear Filter</button>
                </div>
            )}

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
                        {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
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
                        <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => { const ids = [...selectedIds]; const members = getTeamMembers(); if (members.length > 0) { bulkUpdateDemoRequests(ids, { owner: members[0].name, assignedTo: members[0].name }); setRefreshKey(k => k + 1); setBulkToast(`Assigned ${ids.length} request${ids.length !== 1 ? "s" : ""} to ${members[0].name}`); setTimeout(() => setBulkToast(""), 3000); } }}>Assign</button>
                        <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => { setRouteModalOpen(true); }}>Route to Team</button>
                        <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => { const ids = [...selectedIds]; ids.forEach(id => updateRequestStatus(id, "Duplicate" as any)); setRefreshKey(k => k + 1); setBulkToast(`Marked ${ids.length} request${ids.length !== 1 ? "s" : ""} as Duplicate`); setTimeout(() => setBulkToast(""), 3000); }}>Mark Duplicate</button>
                        <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => { const ids = [...selectedIds]; ids.forEach(id => updateRequestStatus(id, "Not Applicable" as any)); setRefreshKey(k => k + 1); setBulkToast(`Marked ${ids.length} request${ids.length !== 1 ? "s" : ""} as Not Applicable`); setTimeout(() => setBulkToast(""), 3000); }}>Mark Not Applicable</button>
                        <button className="rc-btn rc-btn-ghost rc-btn-sm" style={{ color: "#991b1b" }} onClick={() => { const ids = [...selectedIds]; ids.forEach(id => updateRequestStatus(id, "Rejected" as any)); setRefreshKey(k => k + 1); setBulkToast(`Rejected ${ids.length} request${ids.length !== 1 ? "s" : ""}`); setTimeout(() => setBulkToast(""), 3000); }}>Reject</button>
                        <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => { const ids = [...selectedIds]; ids.forEach(id => updateRequestStatus(id, "Complete" as any)); setRefreshKey(k => k + 1); setBulkToast(`Marked ${ids.length} request${ids.length !== 1 ? "s" : ""} Complete`); setTimeout(() => setBulkToast(""), 3000); }}>Mark Complete</button>
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
                            <th>Deliverable</th>
                            <th>Community</th>
                            <th>Status</th>
                            <th>Priority</th>
                            <th>Owner</th>
                            <th>Team</th>
                            <th className="nowrap">Due</th>
                            <th className="nowrap">Updated</th>
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
                                <td className="rc-truncate" style={{ fontWeight: 500, maxWidth: 200 }}>
                                    {req._publishedAt && new Date(req._publishedAt).getTime() > Date.now() - 86400000 && (
                                        <span className="rc-badge rc-badge-visible" style={{ fontSize: 9, padding: "1px 5px", marginRight: 6, verticalAlign: "middle" }}>Newly Published</span>
                                    )}
                                    {req.title.split(" - ").slice(1).join(" - ").trim() || req.title}
                                </td>
                                <td className="rc-truncate">{req.communityNames.join(", ") || "All"}</td>
                                <td onClick={e => e.stopPropagation()}>
                                    <select
                                        value={req.status}
                                        onChange={e => handleStatusChange(req, e.target.value)}
                                        style={{ fontSize: 10, padding: "2px 18px 2px 4px", borderRadius: 4, background: "#fff", color: "#111827", fontWeight: 600, minWidth: 100, cursor: "pointer", border: "1px solid #d1d5db" }}
                                    >
                                        {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </td>
                                <td><span className={`rc-badge rc-badge-${req.priority.toLowerCase()}`}>{req.priority}</span></td>
                                <td style={{ color: req.owner ? "#1e293b" : "#64748b", fontSize: 12 }}>{req.owner || "\u2014"}</td>
                                <td style={{ fontSize: 12 }}>{req.team}</td>
                                <td className="nowrap" style={{ fontSize: 12, color: req.status === "Overdue" ? "#991b1b" : "#475569", fontWeight: req.status === "Overdue" ? 600 : 400 }}>{req.dueDate}</td>
                                <td className="nowrap" style={{ fontSize: 12, color: "#475569" }}>{req.lastUpdated}</td>
                                <td>
                                    <div className="rc-cell-actions">
                                        <button className="rc-btn rc-btn-ghost rc-btn-sm rc-btn-icon" title="Open Workspace" onClick={e => { e.stopPropagation(); navigate(`/recapitalization/workspace/${req.intakeId}`); }} style={{ fontSize: 14 }}>&#9998;</button>
                                        <button className="rc-btn rc-btn-ghost rc-btn-sm rc-btn-icon" title="Respond Externally" onClick={e => { e.stopPropagation(); setDetailModalItem(req); setRespondModalOpen(true); }} style={{ fontSize: 12, color: "#1d4ed8" }}>R</button>
                                        <button className="rc-btn rc-btn-ghost rc-btn-sm rc-btn-icon" title="Publish Update" onClick={e => { e.stopPropagation(); setDetailModalItem(req); setPublishModalOpen(true); }} style={{ fontSize: 12, color: "#166534" }}>P</button>
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
                                    <option value="">\u2014 No change \u2014</option>
                                    <option value="__unset">Unassign</option>
                                    {members.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                                </select>
                            </div>
                            <div className="rc-modal-field">
                                <label>Route to Team</label>
                                <select value={bulkEdit.team} onChange={e => handleBulkChange("team", e.target.value)}>
                                    <option value="">\u2014 No change \u2014</option>
                                    {teams.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div className="rc-modal-field">
                                <label>Set Priority</label>
                                <select value={bulkEdit.priority} onChange={e => handleBulkChange("priority", e.target.value)}>
                                    <option value="">\u2014 No change \u2014</option>
                                    <option value="High">High</option>
                                    <option value="Medium">Medium</option>
                                    <option value="Low">Low</option>
                                </select>
                            </div>
                            <div className="rc-modal-field">
                                <label>Set Status</label>
                                <select value={bulkEdit.status} onChange={e => handleBulkChange("status", e.target.value)}>
                                    <option value="">\u2014 No change \u2014</option>
                                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
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

            {routeModalOpen && (
                <div className="rc-modal-overlay" onClick={() => setRouteModalOpen(false)}>
                    <div className="rc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
                        <div className="rc-modal-header">
                            <h2>Route to Team</h2>
                            <button className="rc-modal-close" onClick={() => setRouteModalOpen(false)}>&times;</button>
                        </div>
                        <div className="rc-modal-body" style={{ padding: "12px 16px" }}>
                            <select value={routeModalTeam} onChange={e => setRouteModalTeam(e.target.value)} style={{ width: "100%", padding: "6px 10px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 4 }}>
                                <option value="">Select a team...</option>
                                {teams.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div className="rc-modal-footer">
                            <button className="rc-btn rc-btn-ghost" onClick={() => setRouteModalOpen(false)}>Cancel</button>
                            <button className="rc-btn rc-btn-primary" disabled={!routeModalTeam} onClick={() => { const ids = [...selectedIds]; bulkUpdateDemoRequests(ids, { team: routeModalTeam }); setRefreshKey(k => k + 1); setRouteModalOpen(false); setRouteModalTeam(""); setBulkToast(`Routed ${ids.length} request${ids.length !== 1 ? "s" : ""} to ${routeModalTeam}`); setTimeout(() => setBulkToast(""), 3000); }}>Route to {routeModalTeam || "..."}</button>
                        </div>
                    </div>
                </div>
            )}

            {respondModalOpen && detailModalItem && (
                <div className="rc-modal-overlay" onClick={() => { setRespondModalOpen(false); setRespondText(""); }}>
                    <div className="rc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
                        <div className="rc-modal-header">
                            <h2>Ask Broker Question</h2>
                            <button className="rc-modal-close" onClick={() => { setRespondModalOpen(false); setRespondText(""); }}>&times;</button>
                        </div>
                        <div className="rc-modal-body" style={{ padding: "12px 16px" }}>
                            <div style={{ fontSize: 12, color: "#475569", marginBottom: 12, display: "flex", flexDirection: "column", gap: 4 }}>
                                <span><strong>Intake ID:</strong> {detailModalItem.intakeId}</span>
                                <span><strong>Request ID:</strong> {detailModalItem.requestId}</span>
                                <span><strong>Deliverable:</strong> {detailModalItem.title}</span>
                                <span><strong>Community:</strong> {detailModalItem.communityNames.join(", ")}</span>
                                <span><strong>Broker/Buyer:</strong> {detailModalItem.brokerBuyer}</span>
                                {detailModalItem.description && <span style={{ marginTop: 4, padding: "6px 8px", background: "#f8fafc", borderRadius: 4, fontSize: 11, color: "#64748b", lineHeight: 1.4 }}>{detailModalItem.description}</span>}
                            </div>
                            <textarea
                                value={respondText}
                                onChange={e => setRespondText(e.target.value)}
                                placeholder="Type your question or response..."
                                rows={4}
                                style={{ width: "100%", padding: "8px 10px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 6, resize: "vertical", font: "inherit", boxSizing: "border-box" }}
                            />
                        </div>
                        <div className="rc-modal-footer">
                            <button className="rc-btn rc-btn-ghost" onClick={() => { setRespondModalOpen(false); setRespondText(""); }}>Cancel</button>
                            <button className="rc-btn rc-btn-primary" disabled={!respondText.trim()} onClick={() => {
                                setBulkToast(`Question sent to ${detailModalItem.brokerBuyer} and added to the request activity.`);
                                setRespondModalOpen(false);
                                setRespondText("");
                                setTimeout(() => setBulkToast(""), 4000);
                            }}>Send Question</button>
                        </div>
                    </div>
                </div>
            )}

            {publishModalOpen && detailModalItem && (
                <div className="rc-modal-overlay" onClick={() => { setPublishModalOpen(false); setPublishText(""); }}>
                    <div className="rc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
                        <div className="rc-modal-header">
                            <h2>Publish Update</h2>
                            <button className="rc-modal-close" onClick={() => { setPublishModalOpen(false); setPublishText(""); }}>&times;</button>
                        </div>
                        <div className="rc-modal-body" style={{ padding: "12px 16px" }}>
                            <p style={{ fontSize: 12, color: "#475569", margin: "0 0 8px" }}>
                                Publish an update for <strong>{detailModalItem.title}</strong>:
                            </p>
                            <textarea
                                value={publishText}
                                onChange={e => setPublishText(e.target.value)}
                                placeholder="Describe the update..."
                                rows={4}
                                style={{ width: "100%", padding: "8px 10px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 6, resize: "vertical", font: "inherit", boxSizing: "border-box" }}
                            />
                        </div>
                        <div className="rc-modal-footer">
                            <button className="rc-btn rc-btn-ghost" onClick={() => { setPublishModalOpen(false); setPublishText(""); }}>Cancel</button>
                            <button className="rc-btn rc-btn-primary" disabled={!publishText.trim()} onClick={() => { updateRequestStatus(detailModalItem.id, "Under Review"); setRefreshKey(k => k + 1); setBulkToast(`Update published for ${detailModalItem.title}`); setPublishModalOpen(false); setPublishText(""); setTimeout(() => setBulkToast(""), 4000); }}>Publish Update</button>
                        </div>
                    </div>
                </div>
            )}

            {bulkToast && (
                <div style={{ position: "fixed", bottom: 24, right: 24, background: "#0f172a", color: "#fff", padding: "10px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600, zIndex: 3000, boxShadow: "0 4px 16px rgba(0,0,0,0.2)" }}>
                    {bulkToast}
                    <button style={{ background: "none", border: "none", color: "#fff", marginLeft: 8, cursor: "pointer", fontSize: 12 }} onClick={() => setBulkToast("")}>OK</button>
                </div>
            )}
        </div>
    );
}
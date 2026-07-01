import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
    getRequests, getTransactions, getTeamMembers, getTeams,
    updateRequestStatus, updateRequestOwner, updateRequestTeam, addActivityEntry,
    updateRequestPriority, updateRequestDueDate, updateRequestExternalStatus, isDemoActive,
    bulkUpdateDemoRequests, getDocuments,
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

const STATUS_OPTIONS = ["Open", "In Progress", "Blocked", "Complete", "Not Applicable", "Duplicate"];

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
    const [filterExternal, setFilterExternal] = useState("all");

    const [overdueOnly, setOverdueOnly] = useState(false);
    const [myItems, setMyItems] = useState(false);
    const myWorkUserKey = "integrasource.recap.myWorkUser";
    const [currentUser, setCurrentUser] = useState(() => localStorage.getItem(myWorkUserKey) || "Sarah Chen");
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const [bulkModalOpen, setBulkModalOpen] = useState(false);
    const [bulkEdit, setBulkEdit] = useState<BulkEdit>({ owner: "", team: "", priority: "", status: "", dueDate: "", visible: "" });
    const [bulkToast, setBulkToast] = useState("");
    const [routeModalOpen, setRouteModalOpen] = useState(false);
    const [routeModalTeam, setRouteModalTeam] = useState("");
    const [detailModalItem, setDetailModalItem] = useState<RecapRequest | null>(null);
    const [publishStep, setPublishStep] = useState(0);
    const [confirmAction, setConfirmAction] = useState<{ title: string; action: () => void } | null>(null);
    const [statusConfirm, setStatusConfirm] = useState<{ req: RecapRequest; newStatus: string } | null>(null);
    const [pendingAssign, setPendingAssign] = useState<{ req: RecapRequest; owner: string } | null>(null);

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
        if (myItems) result = result.filter(r => r.owner === currentUser);
        if (filterExternal === "internal") result = result.filter(r => !(r as any)._publishedExternal && r.status !== "Complete");
        if (filterExternal === "ready") result = result.filter(r => !(r as any)._publishedExternal && r.status === "Complete");
        if (filterExternal === "published") result = result.filter(r => (r as any)._publishedExternal);
        return result;
    }, [allRequests, search, filterTxn, filterStatus, filterPriority, filterTeam, filterOwner, filterExternal, overdueOnly, myItems, currentUser, publishedBatchId, sourcePackageId, sourceIntakeId]);

    const totalActiveRequests = useMemo(() => allRequests.filter(r => r._publishedAt || r._createdFromReview).length, [allRequests]);

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
        clearSelection();
        const parts: string[] = [];
        if (bulkEdit.owner) parts.push(`Owner: ${bulkEdit.owner === "__unset" ? "Unassigned" : bulkEdit.owner}`);
        if (bulkEdit.team) parts.push(`Team: ${bulkEdit.team}`);
        if (bulkEdit.status) parts.push(`Status: ${bulkEdit.status}`);
        if (bulkEdit.priority) parts.push(`Priority: ${bulkEdit.priority}`);
        if (bulkEdit.dueDate) parts.push(`Due: ${bulkEdit.dueDate}`);
        setBulkToast(`Bulk update complete. ${ids.length} request${ids.length !== 1 ? "s" : ""} updated.${parts.length > 0 ? " " + parts.join(" | ") : ""}`);
    }

    function handleStatusChange(req: RecapRequest, newStatus: RecapRequest["status"]) {
        updateRequestStatus(req.id, newStatus);
        addActivityEntry({
            type: "Status Change",
            description: `Status changed to ${newStatus}`,
            userId: "current-user",
            userName: "Sarah Chen",
            requestId: req.requestId || req.id,
            requestTitle: req.title,
            transactionId: req.transactionId,
            transactionName: req.transactionName || req.transactionId,
        });
        setRefreshKey(k => k + 1);
        setBulkToast(`${req.requestId}: status changed to ${newStatus}`);
    }

    function hasDocuments(req: RecapRequest): boolean {
        const docs = getDocuments();
        return docs.some(d => d.requestId === req.requestId || d.requestTitle === req.title);
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
                <h1>Work Queue</h1>
                <div className="rc-header-left" style={{ gap: 8 }}>
                    {isDemoActive() && <span className="rc-badge rc-badge-visible" style={{ fontSize: 10 }}>ABC Demo Active</span>}
                </div>
                <div className="rc-header-actions">
                    <div className="rc-action-key" style={{ display: "flex", gap: 12, alignItems: "center", marginRight: 8 }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600, color: "#111827" }}>P</span>
                        <span style={{ fontSize: 11, color: "#475569" }}>Publish External</span>
                    </div>
                    <button className="rc-btn rc-btn-primary" onClick={() => navigate("/recapitalization/intake/review")}>Import DD Package</button>
                    <button className="rc-btn rc-btn-secondary" onClick={() => navigate("/recapitalization/intake/review")}>New Request</button>
                    <button className="rc-btn rc-btn-secondary" onClick={() => setBulkToast("Export feature coming soon")}>Export</button>
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
                        <span style={{ color: "#475569", fontSize: 14 }}>&#8981;</span>
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
                    <select className="rc-filter-select" value={filterExternal} onChange={e => setFilterExternal(e.target.value)} style={{ fontSize: 11, minWidth: 100 }}>
                        <option value="all">All External</option>
                        <option value="internal">Internal Only</option>
                        <option value="ready">Ready to Publish</option>
                        <option value="published">Published External</option>
                    </select>
                    <div className="rc-toggle-group">
                        <button className={`rc-toggle-btn${!myItems ? " rc-toggle-active" : ""}`} onClick={() => setMyItems(false)}>All Items</button>
                        <button className={`rc-toggle-btn${myItems ? " rc-toggle-active" : ""}`} onClick={() => {
                            setMyItems(true);
                            const stored = localStorage.getItem(myWorkUserKey);
                            if (stored) setCurrentUser(stored);
                        }}>My Items</button>
                    </div>
                    {myItems && (
                        <select
                            className="rc-filter-select"
                            value={currentUser}
                            onChange={e => { setCurrentUser(e.target.value); localStorage.setItem(myWorkUserKey, e.target.value); }}
                            style={{ fontSize: 11, minWidth: 120 }}
                            title="Switch user to test My Work views (demo)"
                        >
                            {members.map(m => <option key={m.id} value={m.name}>{m.name} {m.id === "user-demo" ? "(Test Persona)" : ""}</option>)}
                        </select>
                    )}
                </div>

                {selectedIds.size > 0 && (
                    <div className="rc-bulk-bar">
                        <span className="rc-bulk-count">{selectedIds.size}</span>
                        <span>selected</span>
                        <div className="rc-bulk-sep" />
                        <button className="rc-btn rc-btn-primary rc-btn-sm" onClick={() => { setBulkEdit({ owner: "", team: "", priority: "", status: "", dueDate: "", visible: "" }); setBulkModalOpen(true); }}>Bulk Update</button>
                        <div className="rc-bulk-sep" />
                        <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={clearSelection}>Clear Selection</button>
                    </div>
                )}
            </div>

            {bulkToast && (
                <div style={{ padding: "8px 14px", marginBottom: 12, borderRadius: 6, background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 10 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
                    <span>{bulkToast}</span>
                    <button style={{ background: "none", border: "none", color: "#166534", marginLeft: "auto", cursor: "pointer", fontSize: 14, fontWeight: 700, padding: 0, lineHeight: 1 }} onClick={() => setBulkToast("")}>&times;</button>
                </div>
            )}

            <div className="rc-table-wrap-scroll">
                <table className="rc-table" style={{ width: "100%", tableLayout: "auto" }}>
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
                            <th style={{ minWidth: 90, whiteSpace: "nowrap" }}>Request ID</th>
                            <th style={{ minWidth: 160 }}>Deliverable</th>
                            <th style={{ minWidth: 60, whiteSpace: "nowrap" }}>Status</th>
                            <th style={{ minWidth: 55, whiteSpace: "nowrap" }}>External</th>
                            <th style={{ minWidth: 50, whiteSpace: "nowrap" }}>Priority</th>
                            <th style={{ minWidth: 80, whiteSpace: "nowrap" }}>Owner</th>
                            <th style={{ minWidth: 60 }}>Category</th>
                            <th style={{ minWidth: 60, whiteSpace: "nowrap" }}>Due</th>
                            <th style={{ width: 32 }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map(req => (
                            <tr key={req.id} className="rc-row-clickable" onClick={() => navigate(`/recapitalization/workspace/${req.intakeId}`, { state: { from: "work-queue" } })}>
                                <td style={{ width: 36 }} onClick={e => e.stopPropagation()}>
                                    <input
                                        type="checkbox"
                                        className="rc-checkbox"
                                        checked={selectedIds.has(req.id)}
                                        onChange={() => handleSelectOne(req.id)}
                                    />
                                </td>
                                <td style={{ fontWeight: 600, fontSize: 12, color: "#111827" }}>{req.requestId}</td>
                                <td className="rc-truncate" style={{ fontWeight: 500, maxWidth: 200, color: "#111827" }}>
                                    {req._publishedAt && new Date(req._publishedAt).getTime() > Date.now() - 86400000 && (
                                        <span className="rc-badge rc-badge-visible" style={{ fontSize: 9, padding: "1px 5px", marginRight: 6, verticalAlign: "middle" }}>New</span>
                                    )}
                                    {req.title.split(" - ").slice(1).join(" - ").trim() || req.title}
                                </td>
                                <td onClick={e => e.stopPropagation()}>
                                    <select
                                        value={req.status}
                                        onChange={e => {
                                            const newStatus = e.target.value;
                                            if (newStatus !== req.status) {
                                                setStatusConfirm({ req, newStatus });
                                            }
                                        }}
                                        style={{ fontSize: 11, padding: "2px 18px 2px 4px", borderRadius: 4, background: "#fff", color: "#111827", fontWeight: 600, minWidth: 100, cursor: "pointer", border: "1px solid #cbd5e1" }}
                                    >
                                        {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </td>
                                <td style={{ fontSize: 11 }}>
                                    {(req as any)._publishedExternal ? (
                                        <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, background: "#f0fdf4", color: "#166534", border: "1px solid #86efac" }}>Published</span>
                                    ) : req.status === "Complete" ? (
                                        <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, background: "#fffbeb", color: "#b45309", border: "1px solid #fde68a" }}>Ready</span>
                                    ) : (
                                        <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe" }}>Internal</span>
                                    )}
                                </td>
                                <td><span className={`rc-badge rc-badge-${req.priority.toLowerCase()}`}>{req.priority}</span></td>
                                <td onClick={e => e.stopPropagation()} style={{ fontSize: 12 }}>
                                    <select
                                        value={req.owner || ""}
                                        onChange={e => { if (e.target.value !== (req.owner || "")) setPendingAssign({ req, owner: e.target.value }); }}
                                        style={{ fontSize: 12, padding: "1px 18px 1px 4px", borderRadius: 4, background: "#fff", color: req.owner ? "#111827" : "#475569", fontWeight: 500, minWidth: 100, cursor: "pointer", border: "1px solid #cbd5e1", maxWidth: 120 }}
                                    >
                                        <option value="">Unassigned</option>
                                        {members.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                                    </select>
                                </td>
                                <td style={{ fontSize: 12, color: req.category ? "#334155" : "#94a3b8" }}>{req.category || "\u2014"}</td>
                                <td className="nowrap" style={{ fontSize: 12, color: req.status === "Overdue" ? "#dc2626" : "#334155", fontWeight: req.status === "Overdue" ? 600 : 400 }}>{req.dueDate}</td>
                                <td>
                                    <div className="rc-cell-actions">
                                        <button className="rc-btn rc-btn-ghost rc-btn-sm rc-btn-icon" title="Publish External" onClick={e => { e.stopPropagation(); setDetailModalItem(req); setPublishStep(1); }} style={{ fontSize: 12, fontWeight: 700, color: "#166534" }}>P</button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filtered.length === 0 && <div className="rc-empty-state">No requests match your filters</div>}
            </div>
            {pendingAssign && (
                <div className="rc-modal-overlay" onClick={() => setPendingAssign(null)}>
                    <div className="rc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
                        <div className="rc-modal-header">
                            <h2>Assign Owner</h2>
                            <button className="rc-modal-close" onClick={() => setPendingAssign(null)}>&times;</button>
                        </div>
                        <div className="rc-modal-body" style={{ padding: "16px 20px" }}>
                            <div style={{ fontSize: 14, color: "#1e293b", fontWeight: 500, margin: 0 }}>
                                Assign <strong>{pendingAssign.req.requestId}</strong> &mdash; {pendingAssign.req.title.split(" - ").slice(1).join(" - ").trim() || pendingAssign.req.title} to <strong>{pendingAssign.owner || "Unassigned"}</strong>?
                            </div>
                        </div>
                        <div className="rc-modal-footer">
                            <button className="rc-btn rc-btn-ghost" onClick={() => setPendingAssign(null)}>Cancel</button>
                            <button className="rc-btn rc-btn-primary" onClick={() => {
                                const v = pendingAssign.owner;
                                updateRequestOwner(pendingAssign.req.id, v || null);
                                setRefreshKey(k => k + 1);
                                setBulkToast(v ? `Assigned ${pendingAssign.req.requestId} to ${v}` : `${pendingAssign.req.requestId}: Unassigned`);
                                setPendingAssign(null);
                            }}>Assign</button>
                        </div>
                    </div>
                </div>
            )}

            {statusConfirm && (
                <div className="rc-modal-overlay" onClick={() => setStatusConfirm(null)}>
                    <div className="rc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
                        <div className="rc-modal-header">
                            <h2>Change Status</h2>
                            <button className="rc-modal-close" onClick={() => setStatusConfirm(null)}>&times;</button>
                        </div>
                        <div className="rc-modal-body" style={{ padding: "16px 20px" }}>
                            <div style={{ fontSize: 14, color: "#1e293b", fontWeight: 500, margin: 0 }}>
                                Change <strong>{statusConfirm.req.requestId}</strong> &mdash; {statusConfirm.req.title.split(" - ").slice(1).join(" - ").trim() || statusConfirm.req.title} to <strong>{statusConfirm.newStatus}</strong>?
                            </div>
                        </div>
                        <div className="rc-modal-footer">
                            <button className="rc-btn rc-btn-ghost" onClick={() => setStatusConfirm(null)}>Cancel</button>
                            <button className="rc-btn rc-btn-primary" onClick={() => {
                                handleStatusChange(statusConfirm.req, statusConfirm.newStatus as RecapRequest["status"]);
                                setStatusConfirm(null);
                            }}>Change Status</button>
                        </div>
                    </div>
                </div>
            )}

            <div style={{ fontSize: 12, color: "#475569" }}>Showing {filtered.length} of {totalActiveRequests} requests</div>
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
                                    <option value="">No change</option>
                                    <option value="__unset">Unassign</option>
                                    {members.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                                </select>
                            </div>
                            <div className="rc-modal-field">
                                <label>Route to Team</label>
                                <select value={bulkEdit.team} onChange={e => handleBulkChange("team", e.target.value)}>
                                    <option value="">No change</option>
                                    {teams.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div className="rc-modal-field">
                                <label>Set Priority</label>
                                <select value={bulkEdit.priority} onChange={e => handleBulkChange("priority", e.target.value)}>
                                    <option value="">No change</option>
                                    <option value="High">High</option>
                                    <option value="Medium">Medium</option>
                                    <option value="Low">Low</option>
                                </select>
                            </div>
                            <div className="rc-modal-field">
                                <label>Set Status</label>
                                <select value={bulkEdit.status} onChange={e => handleBulkChange("status", e.target.value)}>
                                    <option value="">No change</option>
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
                            <button className="rc-btn rc-btn-primary" disabled={!routeModalTeam} onClick={() => { const ids = [...selectedIds]; bulkUpdateDemoRequests(ids, { team: routeModalTeam }); setRefreshKey(k => k + 1); setRouteModalOpen(false); setRouteModalTeam(""); setBulkToast(`Routed ${ids.length} request${ids.length !== 1 ? "s" : ""} to ${routeModalTeam}`); }}>Route to {routeModalTeam || "..."}</button>
                        </div>
                    </div>
                </div>
            )}

            {confirmAction && (
                <div className="rc-modal-overlay" onClick={() => setConfirmAction(null)}>
                    <div className="rc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
                        <div className="rc-modal-header">
                            <h2>Confirm</h2>
                            <button className="rc-modal-close" onClick={() => setConfirmAction(null)}>&times;</button>
                        </div>
                        <div className="rc-modal-body" style={{ padding: "16px", textAlign: "center" }}>
                            <p style={{ fontSize: 14, fontWeight: 600, color: "#1e293b", margin: 0 }}>{confirmAction.title}</p>
                        </div>
                        <div className="rc-modal-footer">
                            <button className="rc-btn rc-btn-ghost" onClick={() => setConfirmAction(null)}>Cancel</button>
                            <button className="rc-btn rc-btn-primary" onClick={() => { confirmAction.action(); setConfirmAction(null); }}>Confirm</button>
                        </div>
                    </div>
                </div>
            )}

            {publishStep > 0 && detailModalItem && (
                <div className="rc-modal-overlay" onClick={() => { if (publishStep < 3) setPublishStep(0); }}>
                    <div className="rc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
                        <div className="rc-modal-header">
                            <h2>
                                {detailModalItem.status !== "Complete" ? "Publish External" :
                                    publishStep === 1 ? "Publish to External Portal" :
                                    publishStep === 2 ? "Confirm External Publication" :
                                    "Published Externally"}
                            </h2>
                            <button className="rc-modal-close" onClick={() => setPublishStep(0)}>&times;</button>
                        </div>
                        <div className="rc-modal-body" style={{ padding: "16px 20px" }}>
                            {detailModalItem.status !== "Complete" ? (
                                <div style={{ padding: "12px 16px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 6, fontSize: 13, color: "#92400e" }}>
                                    <strong>&#9888; Complete internal work before publishing externally.</strong>
                                    <div style={{ marginTop: 6 }}>Current status: <strong>{detailModalItem.status}</strong></div>
                                </div>
                            ) : (
                                <>
                                    <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
                                        {[1, 2, 3].map(s => (
                                            <div key={s} style={{ flex: 1, height: 3, borderRadius: 2, background: s <= publishStep ? "#1d4ed8" : "#e2e8f0", transition: "background 0.2s" }} />
                                        ))}
                                    </div>
                                    <div style={{ fontSize: 11, color: "#334155", marginBottom: 12, fontWeight: 600 }}>Step {publishStep} of 3</div>

                                    {publishStep === 1 && (
                                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                            <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", marginBottom: 4 }}>Review Details</div>
                                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                                <div>
                                                    <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 2 }}>Request ID</div>
                                                    <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{detailModalItem.requestId}</div>
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 2 }}>Intake ID</div>
                                                    <div style={{ fontSize: 13, color: "#334155" }}>{detailModalItem.intakeId}</div>
                                                </div>
                                                <div style={{ gridColumn: "1 / -1" }}>
                                                    <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 2 }}>Deliverable</div>
                                                    <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{detailModalItem.title}</div>
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 2 }}>Status</div>
                                                    <div style={{ fontSize: 13, color: "#334155" }}>{detailModalItem.status}</div>
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 2 }}>Community</div>
                                                    <div style={{ fontSize: 13, color: "#334155" }}>{detailModalItem.communityNames.join(", ") || "\u2014"}</div>
                                                </div>
                                            </div>
                                            {!hasDocuments(detailModalItem) && (
                                                <div style={{ padding: "8px 12px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 6, fontSize: 12, color: "#92400e", display: "flex", alignItems: "center", gap: 6 }}>
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                                                    No supporting documents or work artifacts attached to this request. Publishing without artifacts will make only metadata visible externally.
                                                </div>
                                            )}
                                            <div style={{ padding: "8px 12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, fontSize: 12, color: "#991b1b", display: "flex", alignItems: "center", gap: 6 }}>
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                                                You are about to make this request and documents visible to the external broker/buyer portal.
                                            </div>
                                        </div>
                                    )}

                                    {publishStep === 2 && (
                                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                            <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>Confirm External Publication</div>
                                            <div style={{ padding: "8px 12px", background: "#f8faff", border: "1px solid #dbeafe", borderRadius: 6 }}>
                                                <div style={{ fontSize: 11, color: "#334155", marginBottom: 4 }}><strong>Request ID:</strong> {detailModalItem.requestId}</div>
                                                <div style={{ fontSize: 11, color: "#334155", marginBottom: 4 }}><strong>Deliverable:</strong> {detailModalItem.title}</div>
                                            </div>
                                            <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.5 }}>
                                                Please confirm you want to publish these materials externally.
                                            </div>
                                        </div>
                                    )}

                                    {publishStep === 3 && (
                                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                            <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center", textAlign: "center", padding: "8px 0" }}>
                                                <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#166534" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
                                                </div>
                                                <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>Published Externally</div>
                                                <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.5, maxWidth: 380 }}>
                                                    {detailModalItem.requestId} &mdash; {detailModalItem.title} is now visible to the external portal.
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                        <div className="rc-modal-footer">
                            {detailModalItem.status !== "Complete" ? (
                                <button className="rc-btn rc-btn-primary" onClick={() => setPublishStep(0)}>Close</button>
                            ) : (
                                <>
                                    {publishStep < 3 && (
                                        <button className="rc-btn rc-btn-ghost" onClick={() => setPublishStep(0)}>Cancel</button>
                                    )}
                                    {publishStep === 2 && (
                                        <button className="rc-btn rc-btn-secondary" onClick={() => setPublishStep(1)}>Back</button>
                                    )}
                                    {publishStep === 1 && (
                                        <button className="rc-btn rc-btn-primary" onClick={() => setPublishStep(2)}>Continue</button>
                                    )}
                                    {publishStep === 2 && (
                                        <button className="rc-btn rc-btn-primary" onClick={() => {
                                            updateRequestExternalStatus(detailModalItem.id);
                                            setRefreshKey(k => k + 1);
                                            setPublishStep(3);
                                        }}>Confirm Publish External</button>
                                    )}
                                    {publishStep === 3 && (
                                        <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
                                            <button className="rc-btn rc-btn-primary" style={{ width: "100%" }} onClick={() => {
                                                setPublishStep(0);
                                                setBulkToast(`\u2713 Published "${detailModalItem.title}" externally.`);
                                            }}>Done</button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}


        </div>
    );
}
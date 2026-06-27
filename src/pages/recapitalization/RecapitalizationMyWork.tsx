import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { getRequests, isDemoActive, getTeamMembers, updateRequestStatus } from "../../services/recapDataService";
import type { RecapRequest } from "../../services/recapDataService";
import RecapSubNav from "./RecapSubNav";
import "./Recapitalization.css";

const STATUS_OPTIONS = ["Open", "In Progress", "Waiting on Broker", "Blocked", "Ready for Review", "Complete", "Not Applicable", "Duplicate"];

export default function RecapitalizationMyWork() {
    const navigate = useNavigate();
    const [activeUser, setActiveUser] = useState("Sarah Chen");
    const [detailItem, setDetailItem] = useState<RecapRequest | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const [bulkToast, setBulkToast] = useState("");
    const members = getTeamMembers();
    const allRequests = useMemo(() => getRequests(), [refreshKey]);

    const myItems = useMemo(() => {
        const user = members.find(m => m.name === activeUser);
        const userTeam = user?.team || "";
        const assignedToMe = allRequests
            .filter(r => r.owner === activeUser || r.assignedTo === activeUser)
            .sort((a, b) => {
                const aAssigned = a.lastUpdated || "";
                const bAssigned = b.lastUpdated || "";
                if (bAssigned !== aAssigned) return bAssigned.localeCompare(aAssigned);
                const aDue = a.dueDate || "9999-99-99";
                const bDue = b.dueDate || "9999-99-99";
                if (aDue !== bDue) return aDue.localeCompare(bDue);
                const pMap: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
                return (pMap[a.priority] || 1) - (pMap[b.priority] || 1);
            });
        const myTeam = allRequests
            .filter(r => r.team === userTeam && r.owner !== activeUser && r.assignedTo !== activeUser)
            .sort((a, b) => {
                const aDue = a.dueDate || "9999-99-99";
                const bDue = b.dueDate || "9999-99-99";
                if (aDue !== bDue) return aDue.localeCompare(bDue);
                const pMap: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
                return (pMap[a.priority] || 1) - (pMap[b.priority] || 1);
            });
        return { assignedToMe, myTeam };
    }, [allRequests, activeUser, members]);

    const dueSoon = useMemo(() => {
        const today = new Date();
        const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
        return myItems.assignedToMe.filter(r => {
            const s = r.status as string;
            if (s === "Complete" || s === "Provided" || s === "Under Review") return false;
            const due = new Date(r.dueDate);
            return due >= today && due <= weekFromNow;
        });
    }, [myItems.assignedToMe]);

    const waitingOnBroker = useMemo(() => myItems.assignedToMe.filter(r => (r.status as string) === "Waiting on Broker" || (r.status as string) === "Clarification Needed"), [myItems.assignedToMe]);
    const blocked = useMemo(() => myItems.assignedToMe.filter(r => (r.status as string) === "Blocked"), [myItems.assignedToMe]);
    const readyForReview = useMemo(() => myItems.assignedToMe.filter(r => (r.status as string) === "Ready for Review" || (r.status as string) === "Under Review"), [myItems.assignedToMe]);

    function handleStatusChange(req: RecapRequest, newStatus: string) {
        updateRequestStatus(req.id, newStatus as RecapRequest["status"]);
        setRefreshKey(k => k + 1);
        setBulkToast(`${req.requestId}: status changed to ${newStatus}`);
        setTimeout(() => setBulkToast(""), 3000);
    }

    const StatusBadge = ({ status }: { status: string }) => {
        const cls = status === "Overdue" ? "overdue" : status.toLowerCase().replace(/\s+/g, "-");
        return <span className={`rc-badge rc-badge-${cls}`} style={{ fontSize: 10 }}>{status}</span>;
    };

    const PriorityBadge = ({ priority }: { priority: string }) => (
        <span className={`rc-badge rc-badge-${priority.toLowerCase()}`} style={{ fontSize: 10 }}>{priority}</span>
    );

    function renderTable(items: RecapRequest[], emptyMsg: string) {
        if (items.length === 0) return <div className="rc-empty-state" style={{ padding: 20 }}>{emptyMsg}</div>;
        return (
            <table className="rc-table">
                <thead>
                    <tr>
                        <th style={{ minWidth: 160 }}>Deliverable</th>
                        <th style={{ minWidth: 80 }}>Community</th>
                        <th style={{ minWidth: 60 }}>Priority</th>
                        <th style={{ minWidth: 110 }}>Status</th>
                        <th style={{ minWidth: 80 }}>Due</th>
                        <th style={{ minWidth: 80 }}>Assigned</th>
                        <th style={{ minWidth: 80 }}>Team</th>
                        <th style={{ minWidth: 80 }}>Request ID</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map(req => (
                        <tr key={req.id} className="rc-row-clickable" onClick={() => navigate(`/recapitalization/workspace/${req.intakeId}`)}>
                            <td className="rc-truncate" style={{ fontWeight: 500, maxWidth: 200 }}>{req.title.split(" - ").slice(1).join(" - ").trim() || req.title}</td>
                            <td style={{ fontSize: 12, color: "#475569" }}>{req.communityNames[0] || "\u2014"}</td>
                            <td><PriorityBadge priority={req.priority} /></td>
                            <td onClick={e => e.stopPropagation()}>
                                <select
                                    value={req.status}
                                    onChange={e => handleStatusChange(req, e.target.value)}
                                    style={{ fontSize: 10, padding: "2px 18px 2px 4px", borderRadius: 4, background: "#fff", color: "#111827", fontWeight: 600, minWidth: 100, cursor: "pointer", border: "1px solid #d1d5db" }}
                                >
                                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </td>
                            <td className="nowrap" style={{ fontSize: 12, color: req.status === "Overdue" ? "#991b1b" : "#475569", fontWeight: req.status === "Overdue" ? 600 : 400 }}>{req.dueDate}</td>
                            <td style={{ fontSize: 12, color: req.lastUpdated ? "#475569" : "#94a3b8" }}>{req.lastUpdated || "\u2014"}</td>
                            <td style={{ fontSize: 12 }}>{req.team}</td>
                            <td style={{ fontFamily: '"SF Mono", "Cascadia Code", "Consolas", monospace', fontSize: 11, color: "#475569" }}>{req.requestId}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    }

    return (
        <div className="rc-page">
            <RecapSubNav />
            {bulkToast && (
                <div style={{ padding: "8px 16px", marginBottom: 12, borderRadius: 8, fontSize: 13, fontWeight: 600, background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0" }}>
                    {bulkToast}
                    <button style={{ background: "none", border: "none", color: "#166534", marginLeft: 8, cursor: "pointer", fontSize: 12 }} onClick={() => setBulkToast("")}>OK</button>
                </div>
            )}
            <div className="rc-header">
                <div className="rc-header-left">
                    <h1>My Work</h1>
                    {isDemoActive() && <span className="rc-badge rc-badge-visible" style={{ fontSize: 10, marginLeft: 8 }}>Live Demo Data</span>}
                </div>
                <div className="rc-header-actions">
                    <select className="rc-filter-select" value={activeUser} onChange={e => setActiveUser(e.target.value)}>
                        {members.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                    </select>
                </div>
            </div>

            <div className="rc-stats-row">
                <div className="rc-stat-card">
                    <span className="rc-stat-value">{myItems.assignedToMe.length}</span>
                    <span className="rc-stat-label">Assigned to Me</span>
                </div>
                <div className="rc-stat-card" style={{ borderLeft: "3px solid #d97706" }}>
                    <span className="rc-stat-value">{dueSoon.length}</span>
                    <span className="rc-stat-label">Due Soon</span>
                    <span className="rc-stat-desc">Within 7 days</span>
                </div>
                <div className="rc-stat-card" style={{ borderLeft: "3px solid #92400e" }}>
                    <span className="rc-stat-value">{waitingOnBroker.length}</span>
                    <span className="rc-stat-label">Waiting on Broker</span>
                </div>
                <div className="rc-stat-card" style={{ borderLeft: "3px solid #991b1b" }}>
                    <span className="rc-stat-value">{blocked.length}</span>
                    <span className="rc-stat-label">Blocked</span>
                </div>
                <div className="rc-stat-card" style={{ borderLeft: "3px solid #166534" }}>
                    <span className="rc-stat-value">{readyForReview.length}</span>
                    <span className="rc-stat-label">Ready for Review</span>
                </div>
            </div>

            <div className="rc-card">
                <div className="rc-card-header">
                    <h2>Assigned to Me ({myItems.assignedToMe.length})</h2>
                </div>
                <div className="rc-card-body" style={{ padding: 0 }}>
                    {renderTable(myItems.assignedToMe, "No items assigned to you.")}
                </div>
            </div>

            <div className="rc-card">
                <div className="rc-card-header">
                    <h2>My Team ({myItems.myTeam.length})</h2>
                </div>
                <div className="rc-card-body" style={{ padding: 0 }}>
                    {renderTable(myItems.myTeam, "No items for your team.")}
                </div>
            </div>

            <div style={{ fontSize: 12, color: "#64748b", textAlign: "right" }}>
                Showing {myItems.assignedToMe.length + myItems.myTeam.length} of {allRequests.length} total requests
            </div>

            {detailItem && (
                <div className="rc-modal-overlay" onClick={() => setDetailItem(null)}>
                    <div className="rc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
                        <div className="rc-modal-header">
                            <h2>{detailItem.title}</h2>
                            <button className="rc-modal-close" onClick={() => setDetailItem(null)}>&times;</button>
                        </div>
                        <div className="rc-modal-body">
                            <div className="rc-detail-grid">
                                <div className="rc-drawer-field">
                                    <span className="rc-drawer-field-label">Request ID</span>
                                    <span className="rc-drawer-field-value">{detailItem.requestId}</span>
                                </div>
                                <div className="rc-drawer-field">
                                    <span className="rc-drawer-field-label">Intake ID</span>
                                    <span className="rc-drawer-field-value">{detailItem.intakeId}</span>
                                </div>
                                <div className="rc-drawer-field">
                                    <span className="rc-drawer-field-label">Status</span>
                                    <span className="rc-drawer-field-value"><StatusBadge status={detailItem.status} /></span>
                                </div>
                                <div className="rc-drawer-field">
                                    <span className="rc-drawer-field-label">Priority</span>
                                    <span className="rc-drawer-field-value"><PriorityBadge priority={detailItem.priority} /></span>
                                </div>
                                <div className="rc-drawer-field">
                                    <span className="rc-drawer-field-label">Team</span>
                                    <span className="rc-drawer-field-value">{detailItem.team}</span>
                                </div>
                                <div className="rc-drawer-field">
                                    <span className="rc-drawer-field-label">Due Date</span>
                                    <span className="rc-drawer-field-value">{detailItem.dueDate}</span>
                                </div>
                                <div className="rc-drawer-field">
                                    <span className="rc-drawer-field-label">Assigned To</span>
                                    <span className="rc-drawer-field-value">{detailItem.owner || "Unassigned"}</span>
                                </div>
                                <div className="rc-drawer-field">
                                    <span className="rc-drawer-field-label">Updated</span>
                                    <span className="rc-drawer-field-value">{detailItem.lastUpdated}</span>
                                </div>
                            </div>
                        </div>
                        <div className="rc-modal-footer">
                            <button className="rc-btn rc-btn-secondary" onClick={() => setDetailItem(null)}>Close</button>
                            <button className="rc-btn rc-btn-primary" onClick={() => { setDetailItem(null); navigate(`/recapitalization/workspace/${detailItem.intakeId}`); }}>Open Workspace</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
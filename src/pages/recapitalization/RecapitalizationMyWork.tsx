import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { getRequests, isDemoActive, getTeamMembers } from "../../services/recapDataService";
import type { RecapRequest } from "../../services/recapDataService";
import RecapSubNav from "./RecapSubNav";
import "./Recapitalization.css";

export default function RecapitalizationMyWork() {
    const navigate = useNavigate();
    const [activeUser, setActiveUser] = useState("Sarah Chen");
    const [detailItem, setDetailItem] = useState<RecapRequest | null>(null);
    const members = getTeamMembers();
    const allRequests = getRequests();

    const myItems = useMemo(() => {
        const user = members.find(m => m.name === activeUser);
        const userTeam = user?.team || "";
        const assignedToMe = allRequests.filter(r => r.owner === activeUser || r.assignedTo === activeUser);
        const myTeam = allRequests.filter(r => r.team === userTeam && r.owner !== activeUser && r.assignedTo !== activeUser);
        return { assignedToMe, myTeam };
    }, [allRequests, activeUser, members]);

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
                        <th style={{ minWidth: 80 }}>Request ID</th>
                        <th style={{ minWidth: 100 }}>Intake ID</th>
                        <th style={{ minWidth: 160 }}>Title</th>
                        <th style={{ minWidth: 70 }}>Team</th>
                        <th style={{ minWidth: 60 }}>Status</th>
                        <th style={{ minWidth: 60 }}>Priority</th>
                        <th style={{ minWidth: 80 }}>Due</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map(req => (
                        <tr key={req.id} className="rc-row-clickable" onClick={() => navigate(`/recapitalization/workspace/${req.intakeId}`)}>
                            <td style={{ fontWeight: 600, fontSize: 12, color: "#334155" }}>{req.requestId}</td>
                            <td style={{ fontFamily: '"SF Mono", "Cascadia Code", "Consolas", monospace', fontSize: 11, color: "#475569" }}>{req.intakeId}</td>
                            <td className="rc-truncate" style={{ fontWeight: 500, maxWidth: 220 }}>{req.title}</td>
                            <td style={{ fontSize: 12 }}>{req.team}</td>
                            <td><StatusBadge status={req.status} /></td>
                            <td><PriorityBadge priority={req.priority} /></td>
                            <td className="nowrap" style={{ fontSize: 12, color: req.status === "Overdue" ? "#991b1b" : "#475569", fontWeight: req.status === "Overdue" ? 600 : 400 }}>{req.dueDate}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    }

    return (
        <div className="rc-page">
            <RecapSubNav />
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

import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { getRequests, getTeamMembers, updateRequestStatus, getDocuments } from "../../services/recapDataService";
import type { RecapRequest } from "../../services/recapDataService";
import RecapSubNav from "./RecapSubNav";
import "./Recapitalization.css";

const STATUS_OPTIONS = ["Open", "In Progress", "Blocked", "Complete", "Not Applicable", "Duplicate"];

type ViewTab = "assigned-to-me" | "my-team" | "needs-dd-review" | "ready-to-publish" | "recently-updated";

export default function RecapitalizationDdOperations() {
    const navigate = useNavigate();
    const [activeUser, setActiveUser] = useState("David Park");
    const [activeView, setActiveView] = useState<ViewTab>("assigned-to-me");
    const [statusConfirm, setStatusConfirm] = useState<{ req: RecapRequest; newStatus: string } | null>(null);
    const [artifactWarning, setArtifactWarning] = useState<{ req: RecapRequest; newStatus: string } | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const members = getTeamMembers();
    const ddMembers = useMemo(() => members.filter(m => m.team === "DD Management"), [members]);

    const allRequests = useMemo(() => getRequests(), [refreshKey]);

    const workItems = useMemo(() => {
        const published = allRequests.filter(r => r._publishedAt || r._createdFromReview);
        return published.length > 0 ? published : allRequests;
    }, [allRequests]);

    const assignedToMe = useMemo(() => {
        return workItems
            .filter(r => r.owner === activeUser || r.assignedTo === activeUser)
            .sort((a, b) => {
                const aDate = a.lastUpdated || "";
                const bDate = b.lastUpdated || "";
                if (bDate !== aDate) return bDate.localeCompare(aDate);
                const aDue = a.dueDate || "9999-99-99";
                const bDue = b.dueDate || "9999-99-99";
                if (aDue !== bDue) return aDue.localeCompare(bDue);
                const pMap: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
                return (pMap[a.priority] || 1) - (pMap[b.priority] || 1);
            });
    }, [workItems, activeUser]);

    const myTeamItems = useMemo(() => {
        return [...workItems].sort((a, b) => {
            const aDate = a.lastUpdated || "";
            const bDate = b.lastUpdated || "";
            return bDate.localeCompare(aDate);
        });
    }, [workItems]);

    const needsDDReview = useMemo(() => {
        return workItems
            .filter(r => r.status === "Complete" && r._externalStatus !== "Published External")
            .sort((a, b) => {
                const aDue = a.dueDate || "9999-99-99";
                const bDue = b.dueDate || "9999-99-99";
                if (aDue !== bDue) return aDue.localeCompare(bDue);
                const pMap: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
                return (pMap[a.priority] || 1) - (pMap[b.priority] || 1);
            });
    }, [workItems]);

    const readyToPublish = useMemo(() => {
        return workItems
            .filter(r => r.status === "Complete" && r._externalStatus === "Ready to Publish")
            .sort((a, b) => {
                const aDue = a.dueDate || "9999-99-99";
                const bDue = b.dueDate || "9999-99-99";
                if (aDue !== bDue) return aDue.localeCompare(bDue);
                const pMap: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
                return (pMap[a.priority] || 1) - (pMap[b.priority] || 1);
            });
    }, [workItems]);

    const recentlyUpdated = useMemo(() => {
        return [...workItems]
            .filter(r => r.lastUpdated)
            .sort((a, b) => (b.lastUpdated || "").localeCompare(a.lastUpdated || ""));
    }, [workItems]);

    const activeItems = useMemo(() => {
        switch (activeView) {
            case "assigned-to-me": return assignedToMe;
            case "my-team": return myTeamItems;
            case "needs-dd-review": return needsDDReview;
            case "ready-to-publish": return readyToPublish;
            case "recently-updated": return recentlyUpdated;
        }
    }, [activeView, assignedToMe, myTeamItems, needsDDReview, readyToPublish, recentlyUpdated]);

    function hasDocuments(req: RecapRequest): boolean {
        const docs = getDocuments();
        return docs.some(d => d.requestId === req.requestId || d.requestTitle === req.title);
    }

    function handleStatusChange(req: RecapRequest, newStatus: string) {
        updateRequestStatus(req.id, newStatus as RecapRequest["status"]);
        setRefreshKey(k => k + 1);
    }

    const emptyMessages: Record<ViewTab, string> = {
        "assigned-to-me": "No items assigned to you.",
        "my-team": "No items in the work queue.",
        "needs-dd-review": "No items needing DD review.",
        "ready-to-publish": "No items ready to publish.",
        "recently-updated": "No recently updated items.",
    };

    const tabLabels: Record<ViewTab, string> = {
        "assigned-to-me": "Assigned to Me",
        "my-team": "My Team",
        "needs-dd-review": "Needs DD Review",
        "ready-to-publish": "Ready to Publish",
        "recently-updated": "Recently Updated",
    };

    const PriorityBadge = ({ priority }: { priority: string }) => (
        <span className={`rc-badge rc-badge-${priority.toLowerCase()}`} style={{ fontSize: 10 }}>{priority}</span>
    );

    const ExternalStatus = ({ req }: { req: RecapRequest }) => {
        switch (req._externalStatus) {
            case "Published External":
                return <span style={{ color: "#166534", fontWeight: 600, fontSize: 11, background: "#f0fdf4", padding: "1px 6px", borderRadius: 4 }}>Published External</span>;
            case "Ready to Publish":
                return <span style={{ color: "#92400e", fontWeight: 600, fontSize: 11, background: "#fffbeb", padding: "1px 6px", borderRadius: 4 }}>Ready to Publish</span>;
            default:
                return <span style={{ color: "#475569", fontSize: 11 }}>Internal Only</span>;
        }
    };

    function renderTable(items: RecapRequest[], emptyMsg: string) {
        if (items.length === 0) return <div className="rc-empty-state" style={{ padding: 20 }}>{emptyMsg}</div>;
        return (
            <table className="rc-table">
                <thead>
                    <tr>
                        <th style={{ minWidth: 100 }}>Request ID</th>
                        <th style={{ minWidth: 200 }}>Deliverable</th>
                        <th style={{ minWidth: 90 }}>Community</th>
                        <th style={{ minWidth: 100 }}>Status</th>
                        <th style={{ minWidth: 100 }}>External Status</th>
                        <th style={{ minWidth: 70 }}>Priority</th>
                        <th style={{ minWidth: 80 }}>Owner</th>
                        <th style={{ minWidth: 80 }}>Category</th>
                        <th style={{ minWidth: 80 }}>Due</th>
                        <th style={{ minWidth: 80 }}>Updated</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map(req => (
                        <tr key={req.id} className="rc-row-clickable" onClick={() => navigate(`/recapitalization/workspace/${req.intakeId}`, { state: { from: "dd-operations" } })}>
                            <td style={{ fontFamily: '"SF Mono", "Cascadia Code", "Consolas", monospace', fontSize: 11, color: "#475569" }}>{req.requestId}</td>
                            <td className="rc-truncate" style={{ fontWeight: 500, maxWidth: 240 }}>{req.title.split(" - ").slice(1).join(" - ").trim() || req.title}</td>
                            <td style={{ fontSize: 12, color: "#475569" }}>{req.communityNames[0] || "\u2014"}</td>
                            <td onClick={e => e.stopPropagation()}>
                                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                    <select
                                        value={req.status}
                                        onChange={e => {
                                            const newStatus = e.target.value;
                                            if (newStatus !== req.status) {
                                                if (newStatus === "Complete" && !hasDocuments(req)) {
                                                    setArtifactWarning({ req, newStatus });
                                                } else {
                                                    setStatusConfirm({ req, newStatus });
                                                }
                                            }
                                        }}
                                        style={{ fontSize: 10, padding: "2px 18px 2px 4px", borderRadius: 4, background: "#fff", color: "#111827", fontWeight: 600, minWidth: 100, cursor: "pointer", border: "1px solid #d1d5db" }}
                                    >
                                        {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                            </td>
                            <td><ExternalStatus req={req} /></td>
                            <td><PriorityBadge priority={req.priority} /></td>
                            <td style={{ fontSize: 12, color: "#475569" }}>{req.owner || "\u2014"}</td>
                            <td style={{ fontSize: 12, color: "#475569" }}>{req.category}</td>
                            <td className="nowrap" style={{ fontSize: 12, color: req.status === "Overdue" ? "#991b1b" : "#475569", fontWeight: req.status === "Overdue" ? 600 : 400 }}>{req.dueDate}</td>
                            <td style={{ fontSize: 12, color: "#475569" }}>{req.lastUpdated}</td>
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
                    <h1>DD Operations</h1>
                </div>
                <div className="rc-header-actions">
                    <select className="rc-filter-select" value={activeUser} onChange={e => setActiveUser(e.target.value)}>
                        {ddMembers.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                    </select>
                </div>
            </div>

            <div className="rc-view-tabs" style={{ display: "flex", gap: 0, marginBottom: 16, borderBottom: "2px solid #e2e8f0" }}>
                {(["assigned-to-me", "my-team", "needs-dd-review", "ready-to-publish", "recently-updated"] as const).map(view => (
                    <button key={view} onClick={() => setActiveView(view)}
                        style={{ padding: "8px 16px", fontSize: 13, fontWeight: activeView === view ? 700 : 500, color: activeView === view ? "#1d4ed8" : "#475569", background: "none", border: "none", borderBottom: activeView === view ? "2px solid #1d4ed8" : "2px solid transparent", marginBottom: -2, cursor: "pointer", transition: "all 0.15s" }}>
                        {tabLabels[view]}
                    </button>
                ))}
            </div>

            <div className="rc-card">
                <div className="rc-card-header">
                    <h2>{tabLabels[activeView]} ({activeItems.length})</h2>
                </div>
                <div className="rc-card-body" style={{ padding: 0 }}>
                    {renderTable(activeItems, emptyMessages[activeView])}
                </div>
            </div>

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
                                handleStatusChange(statusConfirm.req, statusConfirm.newStatus);
                                setStatusConfirm(null);
                            }}>Change Status</button>
                        </div>
                    </div>
                </div>
            )}

            {artifactWarning && (
                <div className="rc-modal-overlay" onClick={() => setArtifactWarning(null)}>
                    <div className="rc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
                        <div className="rc-modal-header">
                            <h2>No Artifact Attached</h2>
                            <button className="rc-modal-close" onClick={() => setArtifactWarning(null)}>&times;</button>
                        </div>
                        <div className="rc-modal-body" style={{ padding: "16px 20px" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                <div style={{ fontSize: 14, color: "#991b1b", fontWeight: 600 }}>
                                    No artifact is attached to this request. Marking complete will send it to DD Review without supporting documentation.
                                </div>
                                <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.5 }}>
                                    <strong>{artifactWarning.req.requestId}</strong> &mdash; {artifactWarning.req.title.split(" - ").slice(1).join(" - ").trim() || artifactWarning.req.title}
                                </div>
                            </div>
                        </div>
                        <div className="rc-modal-footer">
                            <button className="rc-btn rc-btn-ghost" onClick={() => setArtifactWarning(null)}>Cancel</button>
                            <button className="rc-btn rc-btn-primary" onClick={() => {
                                const req = artifactWarning.req;
                                const newStatus = artifactWarning.newStatus;
                                setArtifactWarning(null);
                                handleStatusChange(req, newStatus);
                            }}>Mark Complete Anyway</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

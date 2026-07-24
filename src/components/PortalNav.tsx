import { useState } from "react";
import { NavLink } from "react-router-dom";
import { getPortalActivity } from "../services/portalMockData";
import type { RecapActivity } from "../services/recapDataService";
import "./PortalNav.css";

const PORTAL_NAV_ITEMS = [
    { to: "/portal", label: "Overview", end: true },
    { to: "/portal/transactions", label: "Transactions", end: false },
    { to: "/portal/requests", label: "Requests", end: false },
    { to: "/portal/submit", label: "Submit / Communicate", end: false },
    { to: "/portal/documents", label: "Available Documents", end: false },
    { to: "/portal/help", label: "Help", end: false },
];

interface PortalNavProps {
    open: boolean;
    onClose: () => void;
}

function isExternalSafeNavActivity(act: RecapActivity): boolean {
    if (act.type === "Note" || act.type === "Assignment") return false;
    if (act.type === "Comment") return false;
    const desc = act.description.toLowerCase();
    if (desc.includes("work note") || desc.includes("reusable knowledge") || desc.includes("promote")) return false;
    if (desc.includes("not mine") || desc.includes("returned to owner") || desc.includes("demo user") || desc.includes("system user")) return false;
    if (desc.includes("marked as duplicate") || desc.includes("dd ops") || desc.includes("dd operations") || desc.includes("work queue mechanics")) return false;
    if (desc.includes("internal status") || desc.includes("owner") && (desc.includes("returned") || desc.includes("reassign"))) return false;
    if (act.type === "Status Change") {
        if (desc.includes("publish") || desc.includes("external") || desc.includes("submitted") || desc.includes("received") || desc.includes("package")) return true;
        if (desc.includes("request received") || desc.includes("artifacts are ready")) return true;
        if (desc.includes("approved") || desc.includes("rework") || desc.includes("partner")) return true;
        return false;
    }
    if (act.type === "Submission") return true;
    return true;
}

function ActivityIcon({ type }: { type: RecapActivity["type"] }) {
    const icons: Record<string, { icon: string; color: string; bg: string }> = {
        "Status Change": { icon: "\u25C6", color: "#3b82f6", bg: "#eff6ff" },
        Submission: { icon: "\uD83D\uDCE4", color: "#10b981", bg: "#f0fdf4" },
        Document: { icon: "\uD83D\uDCC4", color: "#f59e0b", bg: "#fffbeb" },
        Comment: { icon: "\uD83D\uDCAC", color: "#475569", bg: "#f8fafc" },
    };
    const meta = icons[type] || { icon: "\u25C6", color: "#64748b", bg: "#f8fafc" };
    return (
        <span style={{ width: 22, height: 22, borderRadius: "50%", background: meta.bg, color: meta.color, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, flexShrink: 0 }}>
            {meta.icon}
        </span>
    );
}

export default function PortalNav({ open, onClose }: PortalNavProps) {
    const [activityOpen, setActivityOpen] = useState(false);
    const [commOpen, setCommOpen] = useState(false);
    const allActivity = getPortalActivity(20);

    const externalSafe = allActivity.filter(isExternalSafeNavActivity);

    function handleNavClick() {
        onClose();
    }

    return (
        <aside className={`portal-sidebar ${open ? "portal-sidebar--open" : ""}`}>
            <div className="portal-sidebar-header">
            </div>
            <nav className="portal-nav">
                {PORTAL_NAV_ITEMS.map(item => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.end}
                        className={({ isActive }) =>
                            isActive ? "portal-nav-link active" : "portal-nav-link"
                        }
                        onClick={handleNavClick}
                    >
                        <span className="portal-nav-label">{item.label}</span>
                    </NavLink>
                ))}
            </nav>

            {/* ── Collapsible: Recent Activity ── */}
            <div className="pnav-collapsible">
                <button
                    className="pnav-collapsible-header"
                    onClick={() => setActivityOpen(prev => !prev)}
                >
                    <span>Recent Activity</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {externalSafe.length > 0 && (
                            <span className="pnav-badge">{externalSafe.length}</span>
                        )}
                        <span className={`pnav-chevron ${activityOpen ? "pnav-chevron--open" : ""}`}>
                            &#9654;
                        </span>
                    </span>
                </button>
                {activityOpen && (
                    <div className="pnav-collapsible-body">
                        {externalSafe.length === 0 ? (
                            <div className="pnav-empty">No external activity recorded yet.</div>
                        ) : (
                            externalSafe.slice(0, 6).map((act) => (
                                <div key={act.id} className="pnav-activity-item">
                                    <ActivityIcon type={act.type} />
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                        <div className="pnav-activity-text">{act.description}</div>
                                        <div className="pnav-activity-meta">
                                            {act.timestamp ? new Date(act.timestamp).toLocaleDateString() : ""}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            {/* ── Collapsible: External Communication ── */}
            <div className="pnav-collapsible">
                <button
                    className="pnav-collapsible-header"
                    onClick={() => setCommOpen(prev => !prev)}
                >
                    <span>External Communication</span>
                    <span className={`pnav-chevron ${commOpen ? "pnav-chevron--open" : ""}`}>
                        &#9654;
                    </span>
                </button>
                {commOpen && (
                    <div className="pnav-collapsible-body">
                        <div className="pnav-empty">
                            <div>No external communication recorded yet.</div>
                            <div style={{ fontSize: 10, marginTop: 4, fontStyle: "italic" }}>Email notifications coming in a future phase.</div>
                        </div>
                    </div>
                )}
            </div>

            <div className="portal-sidebar-footer">
                <span className="portal-sidebar-version">Recapitalization Portal v1.0</span>
                <span className="portal-sidebar-copy">&copy; 2026 IntegraCare</span>
            </div>
        </aside>
    );
}

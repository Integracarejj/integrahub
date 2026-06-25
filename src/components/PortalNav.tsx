import { NavLink } from "react-router-dom";
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

export default function PortalNav({ open, onClose }: PortalNavProps) {
    function handleNavClick() {
        onClose();
    }

    return (
        <aside className={`portal-sidebar ${open ? "portal-sidebar--open" : ""}`}>
            <div className="portal-sidebar-header">
                <span className="portal-sidebar-badge">Portal</span>
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
            <div className="portal-sidebar-footer">
                <span className="portal-sidebar-version">Recapitalization Portal v1.0</span>
                <span className="portal-sidebar-copy">&copy; 2026 IntegraCare</span>
            </div>
        </aside>
    );
}

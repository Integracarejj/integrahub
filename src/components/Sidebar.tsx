import { NavLink } from "react-router-dom";
import { usePermissions, isPlatformAdmin } from "../hooks/usePermissions";
import "./Sidebar.css";

const NAV_ITEMS = [
    { to: "/", label: "Home", icon: "🏠", end: true },
    { to: "/topics", label: "Business Topics", icon: "🧭" },
    { to: "/applications", label: "Systems", icon: "🖥️" },
    { to: "/processes", label: "Processes", icon: "🔄" },
    { to: "/performance", label: "Performance", icon: "📈" },
    { to: "/integrations", label: "Explore", icon: "🗺️" },
    { to: "/recapitalization", label: "Recapitalization", icon: "💼" },
];

interface SidebarProps {
    open: boolean;
    onClose: () => void;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
    const { permissions } = usePermissions();
    const isAdmin = isPlatformAdmin(permissions);

    function handleNavClick() {
        onClose();
    }

    return (
        <aside className={`sidebar ${open ? "sidebar--open" : ""}`}>
            <nav className="sidebar-nav">
                {NAV_ITEMS.map(item => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.end}
                        className={({ isActive }) =>
                            isActive ? "sidebar-link active" : "sidebar-link"
                        }
                        onClick={handleNavClick}
                    >
                        <span className="sidebar-link-icon">{item.icon}</span>
                        <span className="sidebar-link-label">{item.label}</span>
                    </NavLink>
                ))}

                {isAdmin && (
                    <NavLink
                        to="/admin"
                        className={({ isActive }) =>
                            isActive ? "sidebar-link active" : "sidebar-link"
                        }
                        onClick={handleNavClick}
                    >
                        <span className="sidebar-link-icon">⚙️</span>
                        <span className="sidebar-link-label">Admin</span>
                    </NavLink>
                )}

                {isAdmin && (
                    <NavLink
                        to="/portal"
                        className={({ isActive }) =>
                            isActive ? "sidebar-link active" : "sidebar-link"
                        }
                        onClick={handleNavClick}
                    >
                        <span className="sidebar-link-icon">🔐</span>
                        <span className="sidebar-link-label">External Portal Preview</span>
                    </NavLink>
                )}
            </nav>

            <div className="sidebar-footer">
                <span className="sidebar-footer-version">IntegraSource v2.0</span>
                <span className="sidebar-footer-copy">&copy; 2025 IntegraCare</span>
            </div>
        </aside>
    );
}

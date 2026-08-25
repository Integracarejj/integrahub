import { NavLink } from "react-router-dom";
import { usePermissions, isPlatformAdmin } from "../hooks/usePermissions";
import { INTERNAL_NAV_ITEMS } from "../navigation/internalNavigation";
import "./Sidebar.css";

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
                {INTERNAL_NAV_ITEMS.map(item => (
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

import { NavLink } from "react-router-dom";
import { usePermissions, isPlatformAdmin } from "../hooks/usePermissions";
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
                <NavLink
                    to="/"
                    end
                    className={({ isActive }) =>
                        isActive ? "sidebar-link active" : "sidebar-link"
                    }
                    onClick={handleNavClick}
                >
                    Dashboard
                </NavLink>

                <NavLink
                    to="/applications"
                    className={({ isActive }) =>
                        isActive ? "sidebar-link active" : "sidebar-link"
                    }
                    onClick={handleNavClick}
                >
                    Applications
                </NavLink>

                <NavLink
                    to="/integrations"
                    className={({ isActive }) =>
                        isActive ? "sidebar-link active" : "sidebar-link"
                    }
                    onClick={handleNavClick}
                >
                    Integrations
                </NavLink>

                <NavLink
                    to="/platforms"
                    className={({ isActive }) =>
                        isActive ? "sidebar-link active" : "sidebar-link"
                    }
                    onClick={handleNavClick}
                >
                    Platforms
                </NavLink>

                {isAdmin && (
                    <NavLink
                        to="/admin"
                        className={({ isActive }) =>
                            isActive ? "sidebar-link active" : "sidebar-link"
                        }
                        onClick={handleNavClick}
                    >
                        Admin
                    </NavLink>
                )}
            </nav>
        </aside>
    );
}

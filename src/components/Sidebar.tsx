import { NavLink } from "react-router-dom";
import { usePermissions, isPlatformAdmin } from "../hooks/usePermissions";
import "./Sidebar.css";

export default function Sidebar() {
    const { permissions } = usePermissions();
    const isAdmin = isPlatformAdmin(permissions);

    return (
        <aside className="sidebar">
            <nav className="sidebar-nav">
                <NavLink
                    to="/"
                    end
                    className={({ isActive }) =>
                        isActive ? "sidebar-link active" : "sidebar-link"
                    }
                >
                    Dashboard
                </NavLink>

                <NavLink
                    to="/applications"
                    className={({ isActive }) =>
                        isActive ? "sidebar-link active" : "sidebar-link"
                    }
                >
                    Applications
                </NavLink>

                <NavLink
                    to="/integrations"
                    className={({ isActive }) =>
                        isActive ? "sidebar-link active" : "sidebar-link"
                    }
                >
                    Integrations
                </NavLink>

                <NavLink
                    to="/platforms"
                    className={({ isActive }) =>
                        isActive ? "sidebar-link active" : "sidebar-link"
                    }
                >
                    Platforms
                </NavLink>

                {isAdmin && (
                    <NavLink
                        to="/admin"
                        className={({ isActive }) =>
                            isActive ? "sidebar-link active" : "sidebar-link"
                        }
                    >
                        Admin
                    </NavLink>
                )}
            </nav>
        </aside>
    );
}

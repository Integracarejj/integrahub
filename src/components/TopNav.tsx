// src/components/TopNav.tsx
import { Link, NavLink } from "react-router-dom";
import { useState } from "react";
import { usePermissions, isPlatformAdmin } from "../hooks/usePermissions";
import { useCurrentUser } from "../hooks/useCurrentUser";
import "./TopNav.css";

const DEV_USERS = [
    { email: "", label: "Real User" },
    { email: "admin@example.com", label: "Platform Admin" },
    { email: "viewer@example.com", label: "Viewer" },
    { email: "test.user@example.com", label: "Test User" },
];

function getDevUserEmail(): string {
    return localStorage.getItem("devUserEmail") || "";
}

export default function TopNav() {
    const [devUserEmail, setDevUserEmail] = useState(getDevUserEmail);
    const { permissions } = usePermissions();
    const { user: currentUser } = useCurrentUser();
    const isAdmin = isPlatformAdmin(permissions);

    const isDevMode = import.meta.env.DEV;

    function handleDevUserChange(email: string) {
        setDevUserEmail(email);
        localStorage.setItem("devUserEmail", email);
    }

    const displayName = currentUser?.userRecord?.displayName 
        || currentUser?.principalName 
        || "Signed In";
    const displayRole = currentUser?.userRecord?.role || "Viewer";

    return (
        <header className="top-nav">
            <div className="top-nav-inner">
                <Link to="/" className="brand">
                    <span className="logo-integra">Integra</span>
                    <span className="logo-source">Source</span>
                </Link>

                <nav className="nav-links">
                    <NavLink
                        to="/applications"
                        className={({ isActive }) =>
                            isActive ? "nav-link active" : "nav-link"
                        }
                    >
                        Applications
                    </NavLink>

                    <NavLink
                        to="/integrations"
                        className={({ isActive }) =>
                            isActive ? "nav-link active" : "nav-link"
                        }
                    >
                        Integrations
                    </NavLink>

                    <NavLink
                        to="/platforms"
                        className={({ isActive }) =>
                            isActive ? "nav-link active" : "nav-link"
                        }
                    >
                        Platforms
                    </NavLink>

                    {isAdmin && (
                        <NavLink
                            to="/admin"
                            className={({ isActive }) =>
                                isActive ? "nav-link active" : "nav-link"
                            }
                        >
                            Admin
                        </NavLink>
                    )}
                </nav>

                <div className="user-profile">
                    <span className="user-name">{displayName}</span>
                    <span className="user-role">{displayRole}</span>
                </div>

                {isDevMode && (
                    <select
                        className="dev-user-select"
                        value={devUserEmail}
                        onChange={(e) => handleDevUserChange(e.target.value)}
                        title="DEV ONLY: Switch test user"
                    >
                        {DEV_USERS.map((u) => (
                            <option key={u.email} value={u.email}>{u.label}</option>
                        ))}
                    </select>
                )}
            </div>
        </header>
    );
}
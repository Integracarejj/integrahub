// src/components/TopNav.tsx
import { Link, NavLink } from "react-router-dom";
import { useEffect, useState } from "react";
import { usePermissions, isPlatformAdmin } from "../hooks/usePermissions";
import "./TopNav.css";

const DEV_USERS = [
    { email: "", label: "Real User" },
    { email: "admin@example.com", label: "Platform Admin" },
    { email: "viewer@example.com", label: "Viewer" },
    { email: "test.user@example.com", label: "Test User" },
];

export default function TopNav() {
    const [devUserEmail, setDevUserEmail] = useState(() => localStorage.getItem("devUserEmail") || "");
    const permissions = usePermissions();
    const isAdmin = isPlatformAdmin(permissions);

    useEffect(() => {
        localStorage.setItem("devUserEmail", devUserEmail);
        window.dispatchEvent(new StorageEvent("storage", { key: "devUserEmail" }));
    }, [devUserEmail]);

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

                <select
                    className="dev-user-select"
                    value={devUserEmail}
                    onChange={(e) => setDevUserEmail(e.target.value)}
                    title="DEV ONLY: Switch test user"
                >
                    {DEV_USERS.map((u) => (
                        <option key={u.email} value={u.email}>{u.label}</option>
                    ))}
                </select>
            </div>
        </header>
    );
}
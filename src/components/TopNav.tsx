// src/components/TopNav.tsx
import { Link, NavLink } from "react-router-dom";
import "./TopNav.css";

export default function TopNav() {
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
                </nav>
            </div>
        </header>
    );
}
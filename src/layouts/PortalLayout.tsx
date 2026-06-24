import { useState } from "react";
import { Outlet, Link } from "react-router-dom";
import { useCurrentUser } from "../hooks/useCurrentUser";
import PortalNav from "../components/PortalNav";
import "./PortalLayout.css";

export default function PortalLayout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { user } = useCurrentUser();

    const displayName = user?.userRecord?.displayName
        || user?.principalName
        || "Signed In";

    const isPreviewMode = user?.hasAppAccess && !user?.isPortalUser;

    return (
        <div className="portal-shell">
            {isPreviewMode && (
                <div className="portal-preview-banner">
                    <span className="portal-preview-icon">&#128274;</span>
                    <span>Preview Mode — Internal Only. Data shown is mock/sample data.</span>
                </div>
            )}
            <header className="portal-topnav">
                <div className="portal-topnav-inner">
                    <div className="portal-topnav-left">
                        <button
                            className="portal-sidebar-toggle"
                            onClick={() => setSidebarOpen(prev => !prev)}
                            aria-label="Toggle portal navigation"
                        >
                            <span className="portal-hamburger-icon" />
                        </button>
                        <Link to="/portal" className="portal-brand">
                            <span className="portal-brand-integra">Integra</span>
                            <span className="portal-brand-source">Source</span>
                            <span className="portal-brand-sep">|</span>
                            <span className="portal-brand-portal">Recapitalization Portal</span>
                        </Link>
                    </div>
                    <div className="portal-topnav-right">
                        <div className="portal-user-profile">
                            <span className="portal-user-name">{displayName}</span>
                            <span className="portal-user-role">{isPreviewMode ? "Preview Mode" : "Portal Access"}</span>
                        </div>
                    </div>
                </div>
            </header>
            <div className="portal-body">
                <PortalNav open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
                <main className="portal-content">
                    <Outlet />
                </main>
            </div>
            {sidebarOpen && (
                <div className="portal-backdrop" onClick={() => setSidebarOpen(false)} />
            )}
        </div>
    );
}

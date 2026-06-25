import { useState } from "react";
import { Outlet, Link } from "react-router-dom";
import { useCurrentUser } from "../hooks/useCurrentUser";
import PortalNav from "../components/PortalNav";
import { getActivePersona, getPersonas, setActivePersona } from "../services/portalMockData";
import type { ExternalDemoPersona } from "../services/portalMockData";
import "./PortalLayout.css";

export default function PortalLayout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [personaSwitcherOpen, setPersonaSwitcherOpen] = useState(false);
    const [currentPersona, setCurrentPersona] = useState<ExternalDemoPersona>(getActivePersona);
    const { user } = useCurrentUser();

    const displayName = user?.userRecord?.displayName
        || user?.principalName
        || "Signed In";

    const isPreviewMode = user?.hasAppAccess && !user?.isPortalUser;

    const allPersonas = getPersonas();

    const handleSwitchPersona = (id: string) => {
        setActivePersona(id);
        setCurrentPersona(getActivePersona());
        setPersonaSwitcherOpen(false);
        window.location.reload();
    };

    return (
        <div className="portal-shell">
            {isPreviewMode && (
                <div className="portal-preview-banner">
                    <span className="portal-preview-icon">&#128274;</span>
                    <span>Preview Mode &mdash; external portal demo. Persona-scoped mock data only.</span>
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
                    <div className="portal-topnav-right" style={{ gap: 12 }}>
                        <div
                            className="portal-user-profile"
                            style={{ cursor: "pointer", position: "relative" }}
                            onClick={() => setPersonaSwitcherOpen((prev) => !prev)}
                        >
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 0 }}>
                                <span className="portal-user-name" style={{ fontSize: 13 }}>{currentPersona.displayName}</span>
                                <span className="portal-user-role" style={{ fontSize: 10 }}>{currentPersona.role} &middot; {currentPersona.companyName}</span>
                                <span style={{ fontSize: 9, color: "#94a3b8" }}>{currentPersona.email}</span>
                            </div>
                            <div style={{
                                width: 36, height: 36, borderRadius: "50%",
                                background: currentPersona.role === "Broker" ? "#eef2ff" : currentPersona.role === "Buyer" ? "#f0fdf4" : "#fff7ed",
                                color: currentPersona.role === "Broker" ? "#4338ca" : currentPersona.role === "Buyer" ? "#166534" : "#92400e",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 14, fontWeight: 700, flexShrink: 0,
                            }}>
                                {currentPersona.displayName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                            </div>
                        </div>

                        {personaSwitcherOpen && (
                            <>
                                <div
                                    style={{ position: "fixed", inset: 0, zIndex: 999 }}
                                    onClick={() => setPersonaSwitcherOpen(false)}
                                />
                                <div style={{
                                    position: "absolute", top: "100%", right: 0, zIndex: 1000,
                                    background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10,
                                    boxShadow: "0 8px 24px rgba(0,0,0,0.12)", minWidth: 280,
                                    overflow: "hidden", marginTop: 4,
                                }}>
                                    <div style={{ padding: "10px 14px", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid #f1f5f9" }}>
                                        Switch Persona
                                    </div>
                                    {allPersonas.map((p) => (
                                        <div
                                            key={p.id}
                                            onClick={() => handleSwitchPersona(p.id)}
                                            style={{
                                                display: "flex", alignItems: "center", gap: 10,
                                                padding: "10px 14px", cursor: "pointer",
                                                background: p.id === currentPersona.id ? "#f8faff" : "transparent",
                                                borderBottom: "1px solid #f8fafc",
                                            }}
                                            onMouseEnter={(e) => { e.currentTarget.style.background = "#f8fafc"; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.background = p.id === currentPersona.id ? "#f8faff" : "transparent"; }}
                                        >
                                            <div style={{
                                                width: 32, height: 32, borderRadius: "50%",
                                                background: p.role === "Broker" ? "#eef2ff" : p.role === "Buyer" ? "#f0fdf4" : "#fff7ed",
                                                color: p.role === "Broker" ? "#4338ca" : p.role === "Buyer" ? "#166534" : "#92400e",
                                                display: "flex", alignItems: "center", justifyContent: "center",
                                                fontSize: 12, fontWeight: 700, flexShrink: 0,
                                            }}>
                                                {p.displayName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{p.displayName}</div>
                                                <div style={{ fontSize: 11, color: "#64748b" }}>{p.role} &middot; {p.companyName}</div>
                                                <div style={{ fontSize: 10, color: "#94a3b8" }}>{p.email}</div>
                                            </div>
                                            {p.id === currentPersona.id && (
                                                <span style={{ fontSize: 11, fontWeight: 700, color: "#4f46e5" }}>Active</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
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

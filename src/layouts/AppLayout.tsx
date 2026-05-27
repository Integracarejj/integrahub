import { useState } from "react";
import { Outlet } from "react-router-dom";
import TopNav from "../components/TopNav";
import Sidebar from "../components/Sidebar";
import "./AppLayout.css";

export default function AppLayout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="app-shell">
            <TopNav onToggleSidebar={() => setSidebarOpen((prev) => !prev)} />
            <div className="app-body">
                <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
                <main className="app-content">
                    <Outlet />
                </main>
            </div>
            {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}
        </div>
    );
}
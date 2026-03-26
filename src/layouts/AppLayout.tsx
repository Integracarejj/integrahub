// src/layouts/AppLayout.tsx
import { Outlet } from "react-router-dom";
import TopNav from "../components/TopNav";
import "./AppLayout.css";

export default function AppLayout() {
    return (
        <div className="app-shell">
            <TopNav />

            <main className="app-content">
                <Outlet />
            </main>
        </div>
    );
}
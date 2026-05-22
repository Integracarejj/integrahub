import { Outlet } from "react-router-dom";
import TopNav from "../components/TopNav";
import Sidebar from "../components/Sidebar";
import "./AppLayout.css";

export default function AppLayout() {
    return (
        <div className="app-shell">
            <TopNav />
            <div className="app-body">
                <Sidebar />
                <main className="app-content">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
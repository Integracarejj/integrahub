import { useState } from "react";
import RecapSubNav from "./RecapSubNav";
import { isDemoActive, initDemo, resetDemo, getDemoTransaction } from "../../services/recapDataService";
import "./Recapitalization.css";

const SETTING_GROUPS = [
    {
        title: "Categories",
        items: [
            { name: "Financial Statements", desc: "Audited financials, P&L, balance sheets", value: "Active" },
            { name: "Licenses", desc: "State licenses, certifications, survey results", value: "Active" },
            { name: "Environmental", desc: "Phase I/II reports, environmental assessments", value: "Active" },
            { name: "Insurance", desc: "Liability, workers comp, property insurance", value: "Active" },
            { name: "Legal", desc: "Litigation summary, contracts, regulatory", value: "Active" },
            { name: "HR / Staffing", desc: "Staffing rosters, wage reports, turnover", value: "Active" },
        ],
    },
    {
        title: "Teams",
        items: [
            { name: "Financial Analysis", desc: "6 members — Sarah Chen, Mike O'Brien, Carlos Rivera", value: "Active" },
            { name: "Regulatory", desc: "2 members — James Wright", value: "Active" },
            { name: "Environmental", desc: "2 members — Lisa Park", value: "Active" },
            { name: "Risk Management", desc: "2 members — Tom Davies", value: "Active" },
            { name: "HR & Operations", desc: "2 members — Anna Patel", value: "Active" },
        ],
    },
    {
        title: "Configuration",
        items: [
            { name: "Assignment Rules", desc: "Auto-assign based on category and team load", value: "Enabled" },
            { name: "External Visibility Default", desc: "Default setting for new requests", value: "Visible" },
            { name: "SharePoint Site Mapping", desc: "Recapitalization Hub site for document storage", value: "Not configured" },
            { name: "Notification Rules", desc: "Email and in-app notification triggers", value: "Basic" },
            { name: "Status Workflow", desc: "Allowed status transitions and required fields", value: "Standard" },
        ],
    },
];

export default function RecapitalizationSettings() {
    const [demoLoaded, setDemoLoaded] = useState(isDemoActive());
    const [demoToast, setDemoToast] = useState("");
    const [_refreshKey, setRefreshKey] = useState(0);
    const demoTxn = demoLoaded ? getDemoTransaction() : null;

    const showToast = (msg: string) => {
        setDemoToast(msg);
        setTimeout(() => setDemoToast(""), 2500);
    };

    const handleLoadDemo = () => {
        initDemo();
        setDemoLoaded(true);
        setRefreshKey(k => k + 1);
        showToast("ABC Company Portfolio demo loaded — 300 requests, 5 communities");
    };

    const handleResetDemo = () => {
        initDemo();
        setRefreshKey(k => k + 1);
        showToast("Demo data reset to initial state");
    };

    const handleClearDemo = () => {
        resetDemo();
        setDemoLoaded(false);
        setRefreshKey(k => k + 1);
        showToast("Demo data cleared — returning to standard mock data");
    };

    return (
        <div className="rc-page">
            <RecapSubNav />
            <div className="rc-header">
                <h1>Settings</h1>
                <div className="rc-header-actions">
                    <button className="rc-btn rc-btn-primary rc-btn-sm">Save Changes</button>
                </div>
            </div>

            {SETTING_GROUPS.map(group => (
                <div key={group.title} className="rc-card">
                    <div className="rc-card-header">
                        <h2>{group.title}</h2>
                        <button className="rc-btn rc-btn-ghost rc-btn-sm">Manage</button>
                    </div>
                    <div className="rc-card-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {group.items.map(item => (
                            <div key={item.name} className="rc-setting-card">
                                <div className="rc-setting-info">
                                    <span className="rc-setting-name">{item.name}</span>
                                    <span className="rc-setting-desc">{item.desc}</span>
                                </div>
                                <span className="rc-setting-value">{item.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            ))}

            <div className="rc-placeholder-banner">
                <div className="rc-placeholder-banner-icon">&#9881;</div>
                <div>
                    <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: "var(--is-text-heading, #0f172a)", marginBottom: 4 }}>
                        Configuration is mock-only for Phase 1
                    </span>
                    <span style={{ display: "block", fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
                        Settings pages and configuration values shown here are placeholder previews. Actual configuration will use database-backed storage once the tracker schema is deployed.
                    </span>
                </div>
            </div>

            <div className="rc-card" style={{ border: "1px solid #dbeafe" }}>
                <div className="rc-card-header">
                    <h2>Demo Data</h2>
                    <span className={`rc-badge ${demoLoaded ? "rc-badge-visible" : "rc-badge-hidden"}`} style={{ fontSize: 10 }}>
                        {demoLoaded ? "Demo Active" : "Not Loaded"}
                    </span>
                </div>
                <div className="rc-card-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {demoTxn && (
                        <div className="rc-setting-card">
                            <div className="rc-setting-info">
                                <span className="rc-setting-name">{demoTxn.name}</span>
                                <span className="rc-setting-desc">{demoTxn.description} &middot; {demoTxn.communities.length} communities &middot; {demoTxn.totalRequests} requests</span>
                            </div>
                            <span className="rc-setting-value">{demoTxn.status}</span>
                        </div>
                    )}
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <button className="rc-btn rc-btn-primary" onClick={handleLoadDemo} disabled={demoLoaded}>
                            Load ABC Company Portfolio Demo
                        </button>
                        <button className="rc-btn rc-btn-secondary" onClick={handleResetDemo} disabled={!demoLoaded}>
                            Reset Demo Data
                        </button>
                        <button className="rc-btn rc-btn-ghost" onClick={handleClearDemo} disabled={!demoLoaded}>
                            Clear Recap Demo Data
                        </button>
                    </div>
                    {demoToast && (
                        <span style={{ fontSize: 12, color: "#166534", fontWeight: 600 }}>{demoToast}</span>
                    )}
                </div>
            </div>
        </div>
    );
}

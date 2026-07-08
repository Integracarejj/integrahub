import { useState } from "react";
import RecapSubNav from "./RecapSubNav";
import { isRecapDataWiped, setRecapWiped } from "../../services/recapDataService";
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
    const [wiped, setWiped] = useState(isRecapDataWiped());
    const [toast, setToast] = useState("");
    const [confirmOpen, setConfirmOpen] = useState(false);

    const showBanner = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(""), 4000);
    };

    const handleWipe = () => {
        setRecapWiped();
        setWiped(true);
        setConfirmOpen(false);
        showBanner("Recapitalization test data wiped. Intake, Work Queue, My Work, DD Ops, and Activity Feed are now empty.");
    };

    return (
        <div className="rc-page">
            <RecapSubNav />
            {toast && (
                <div style={{
                    padding: "10px 16px", margin: "0 24px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                    background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0",
                }}>
                    {toast}
                </div>
            )}

            {confirmOpen && (
                <div className="rc-modal-overlay" onClick={() => setConfirmOpen(false)}>
                    <div className="rc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
                        <div className="rc-modal-header">
                            <h2>Wipe Recapitalization Test Data</h2>
                            <button className="rc-modal-close" onClick={() => setConfirmOpen(false)}>&times;</button>
                        </div>
                        <div className="rc-modal-body" style={{ padding: "16px 20px", fontSize: 13, color: "#334155", lineHeight: 1.6 }}>
                            <p style={{ margin: 0 }}>
                                This will clear all Recapitalization test data from Intake, Work Queue, My Work, DD Operations, External Portal Preview, and Activity Feed. This is for testing only.
                            </p>
                        </div>
                        <div className="rc-modal-footer">
                            <button className="rc-btn rc-btn-ghost" onClick={() => setConfirmOpen(false)}>Cancel</button>
                            <button className="rc-btn rc-btn-primary" onClick={handleWipe} style={{ background: "#dc2626", borderColor: "#dc2626" }}>Wipe Recapitalization Test Data</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="rc-header">
                <h1>Settings</h1>
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
                    <span style={{ display: "block", fontSize: 12, color: "#475569", lineHeight: 1.5 }}>
                        Settings pages and configuration values shown here are placeholder previews. Actual configuration will use database-backed storage once the tracker schema is deployed.
                    </span>
                </div>
            </div>

            <div className="rc-card" style={{ border: "1px solid #fecaca" }}>
                <div className="rc-card-header">
                    <h2>Test Data Management</h2>
                    <span className="rc-badge rc-badge-visible" style={{ fontSize: 10, background: wiped ? "#fef2f2" : "#f0fdf4", color: wiped ? "#991b1b" : "#166534" }}>
                        {wiped ? "Data Wiped" : "Seeded Data Active"}
                    </span>
                </div>
                <div className="rc-card-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <p style={{ fontSize: 12, color: "#475569", margin: 0, lineHeight: 1.5 }}>
                        {wiped
                            ? "All recap test data has been wiped. Navigate to Intake Queue and import a package to start fresh."
                            : "Seeded demo and mock data is currently active across Intake, Work Queue, My Work, and DD Operations."
                        }
                    </p>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <button className="rc-btn rc-btn-primary" onClick={() => setConfirmOpen(true)} style={{ background: "#dc2626", borderColor: "#dc2626" }}>
                            Wipe Recapitalization Test Data
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

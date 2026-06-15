import { Link } from "react-router-dom";
import "./MaintenanceCompliancePage.css";

const kpis = [
    { label: "Compliance Score", value: "—" },
    { label: "Open Work Orders", value: "—" },
    { label: "30+ Day Work Orders", value: "—" },
    { label: "Room Readiness", value: "—" },
];

const communities = [
    { name: "Clearview", value: 82 },
    { name: "Maple Ridge", value: 67 },
    { name: "Riverbend", value: 54 },
    { name: "Lakeside", value: 43 },
];

const focusAreas = [
    {
        title: "Regulatory Compliance",
        measures: "License renewals, survey readiness, citation tracking.",
        examples: "Compliance score, citations per period, survey pass rate.",
    },
    {
        title: "Preventive Maintenance",
        measures: "Scheduled vs. completed PM work orders, overdue rate.",
        examples: "PM completion %, PM overdue count, mean time to complete.",
    },
    {
        title: "Work Order Backlog",
        measures: "Open, aging, and priority distribution of work orders.",
        examples: "Backlog size, avg days open, priority breakdown.",
    },
    {
        title: "Room Readiness",
        measures: "Turn time, pre-move inspections, readiness rate.",
        examples: "Avg turn days, rooms ready on time %, inspection pass rate.",
    },
    {
        title: "User Adoption",
        measures: "TELS login activity, feature usage, training completion.",
        examples: "Active users %, feature adoption rate, training completion %.",
    },
];

export default function MaintenanceCompliancePage() {
    return (
        <div className="mcom-page">
            <div className="mcom-top-bar">
                <Link to="/performance" className="mcom-back-link">&larr; All Performance Areas</Link>
            </div>

            <header className="mcom-header">
                <div>
                    <h1>Maintenance & Compliance</h1>
                    <p className="mcom-subtitle">
                        Operational view for facilities readiness, work orders, preventive maintenance, and regulatory compliance.
                    </p>
                    <div className="mcom-chips">
                        <span className="mcom-source-chip">TELS</span>
                    </div>
                </div>
            </header>

            <div className="mcom-kpi-row">
                {kpis.map(k => (
                    <div key={k.label} className="mcom-kpi-card">
                        <span className="mcom-kpi-value">{k.value}</span>
                        <span className="mcom-kpi-label">{k.label}</span>
                        <span className="mcom-kpi-badge">Coming soon</span>
                    </div>
                ))}
            </div>

            <section className="mcom-section">
                <h2 className="mcom-section-title">Communities Requiring Attention</h2>
                <p className="mcom-section-note">Sample visualization only — pending TELS data feed.</p>
                <div className="mcom-bars">
                    {communities.map(c => (
                        <div key={c.name} className="mcom-bar-row">
                            <span className="mcom-bar-label">{c.name}</span>
                            <div className="mcom-bar-track">
                                <div className="mcom-bar-fill" style={{ width: `${c.value}%` }} />
                            </div>
                            <span className="mcom-bar-value">{c.value}%</span>
                        </div>
                    ))}
                </div>
            </section>

            <section className="mcom-section">
                <h2 className="mcom-section-title">Compliance Score Trend</h2>
                <p className="mcom-section-note">Sample trend only — pending TELS data feed.</p>
                <div className="mcom-trend-placeholder">
                    <div className="mcom-trend-line">
                        <svg viewBox="0 0 400 100" className="mcom-trend-svg" preserveAspectRatio="none">
                            <polyline
                                points="0,80 50,60 100,70 150,40 200,50 250,30 300,35 350,20 400,25"
                                fill="none"
                                stroke="#6366f1"
                                strokeWidth="2"
                            />
                        </svg>
                    </div>
                </div>
            </section>

            <section className="mcom-section">
                <h2 className="mcom-section-title">Operational Focus Areas</h2>
                <div className="mcom-focus-grid">
                    {focusAreas.map(f => (
                        <div key={f.title} className="mcom-focus-card">
                            <h3 className="mcom-focus-title">{f.title}</h3>
                            <p className="mcom-focus-measures"><strong>What it measures:</strong> {f.measures}</p>
                            <p className="mcom-focus-examples"><strong>Future metrics:</strong> {f.examples}</p>
                        </div>
                    ))}
                </div>
            </section>

            <section className="mcom-section mcom-related">
                <h2 className="mcom-section-title">Related System</h2>
                <div className="mcom-related-content">
                    <span className="mcom-source-chip">TELS</span>
                </div>

                <h2 className="mcom-section-title" style={{ marginTop: 20 }}>Related Process</h2>
                <p className="mcom-related-text">Process mapping planned.</p>
            </section>
        </div>
    );
}

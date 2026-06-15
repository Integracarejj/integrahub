import { Link } from "react-router-dom";
import "./MaintenanceCompliancePage.css";

const kpis = [
    {
        label: "Open Work Orders",
        value: "46",
        subtext: "155 opened / 153 closed",
        status: "Elevated",
        accent: "orange",
    },
    {
        label: "30+ Day Work Orders",
        value: "20",
        subtext: "Aging backlog",
        status: "Critical",
        accent: "red",
    },
    {
        label: "Regulatory Overdue",
        value: "59",
        subtext: "Compliance tasks overdue",
        status: "Critical",
        accent: "red",
    },
    {
        label: "PM Overdue",
        value: "48",
        subtext: "Preventive maintenance overdue",
        status: "Critical",
        accent: "red",
    },
    {
        label: "Mobile Adoption",
        value: "64%",
        subtext: "207 mobile / 115 web",
        status: "Adoption",
        accent: "blue",
    },
    {
        label: "Asset Tagging",
        value: "98%",
        subtext: "4,050 of 4,122 active assets tagged",
        status: "Healthy",
        accent: "green",
    },
];

function severity(issues: number): { label: string; className: string } {
    if (issues >= 60) return { label: "Critical", className: "sev-critical" };
    if (issues >= 20) return { label: "Elevated", className: "sev-elevated" };
    return { label: "Watch", className: "sev-watch" };
}

const communities = [
    { name: "Exton Senior Living", issues: 90 },
    { name: "Glen Mills Senior Living", issues: 48 },
    { name: "Chestnut Ridge Retirement Living", issues: 7 },
];

const maxIssues = Math.max(...communities.map(c => c.issues));

const snapshotItems = [
    {
        title: "Work Order Movement",
        lines: ["155 opened", "153 closed"],
    },
    {
        title: "Compliance Pressure",
        lines: ["59 regulatory overdue", "48 PM overdue"],
    },
    {
        title: "Adoption",
        lines: ["64% mobile sign-in rate"],
    },
    {
        title: "Asset Readiness",
        lines: ["98% tagged"],
    },
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

            <div className="mcom-draft-banner">
                Draft data from TELS scorecard &middot; Week of 6/7/2026–6/13/2026 &middot; Not live feed
            </div>

            <div className="mcom-kpi-row">
                {kpis.map(k => (
                    <div key={k.label} className={`mcom-kpi-card mcom-kpi-${k.accent}`}>
                        <div className="mcom-kpi-top">
                            <span className="mcom-kpi-value">{k.value}</span>
                            <span className={`mcom-kpi-status mcom-kpi-status-${k.accent}`}>{k.status}</span>
                        </div>
                        <span className="mcom-kpi-label">{k.label}</span>
                        <span className="mcom-kpi-subtext">{k.subtext}</span>
                    </div>
                ))}
            </div>

            <div className="mcom-two-col">
                <section className="mcom-section mcom-col">
                    <h2 className="mcom-section-title">Community Attention Score</h2>
                    <p className="mcom-section-helper">
                        Draft issue count from TELS scorecard. Higher number means more overdue, open, skipped, or unresolved maintenance/compliance items.
                    </p>
                    <div className="mcom-bars">
                        {communities.map(c => {
                            const sev = severity(c.issues);
                            return (
                                <div key={c.name} className="mcom-bar-row">
                                    <span className="mcom-bar-label">{c.name}</span>
                                    <div className="mcom-bar-track">
                                        <div
                                            className={`mcom-bar-fill ${sev.className}`}
                                            style={{ width: `${(c.issues / maxIssues) * 100}%` }}
                                        />
                                    </div>
                                    <span className="mcom-bar-value">{c.issues}</span>
                                    <span className={`mcom-bar-sev ${sev.className}`}>{sev.label}</span>
                                </div>
                            );
                        })}
                    </div>
                    <div className="mcom-legend">
                        <span className="mcom-legend-item"><span className="mcom-legend-dot sev-critical" /> Critical</span>
                        <span className="mcom-legend-item"><span className="mcom-legend-dot sev-elevated" /> Elevated</span>
                        <span className="mcom-legend-item"><span className="mcom-legend-dot sev-watch" /> Watch</span>
                    </div>
                </section>

                <section className="mcom-section mcom-col">
                    <h2 className="mcom-section-title">What This Means</h2>
                    <div className="mcom-insight-card">
                        <p className="mcom-insight-text">
                            Draft TELS data suggests attention is concentrated in a small number of communities, with the highest pressure coming from overdue compliance items, preventive maintenance, and aging work orders.
                        </p>
                    </div>

                    <h2 className="mcom-section-title" style={{ marginTop: 20 }}>Operational Snapshot</h2>
                    <div className="mcom-snapshot-grid">
                        {snapshotItems.map(s => (
                            <div key={s.title} className="mcom-snapshot-card">
                                <h3 className="mcom-snapshot-title">{s.title}</h3>
                                <ul className="mcom-snapshot-list">
                                    {s.lines.map((line, i) => (
                                        <li key={i}>{line}</li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </section>
            </div>

            <section className="mcom-section">
                <h2 className="mcom-section-title">Operational Focus Areas</h2>
                <div className="mcom-focus-grid">
                    {focusAreas.map(f => (
                        <div key={f.title} className="mcom-focus-card">
                            <h3 className="mcom-focus-title">{f.title}</h3>
                            <p className="mcom-focus-text"><span className="mcom-focus-label">Measures</span> {f.measures}</p>
                            <p className="mcom-focus-text"><span className="mcom-focus-label">Future metrics</span> {f.examples}</p>
                        </div>
                    ))}
                </div>
            </section>

            <section className="mcom-section mcom-related">
                <h2 className="mcom-section-title">Related System</h2>
                <div className="mcom-related-content">
                    <span className="mcom-source-chip">TELS</span>
                </div>
                <h2 className="mcom-section-title" style={{ marginTop: 14 }}>Related Process</h2>
                <p className="mcom-related-text">Process mapping planned.</p>
            </section>
        </div>
    );
}

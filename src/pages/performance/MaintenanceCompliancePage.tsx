import { useState } from "react";
import { Link } from "react-router-dom";
import "./MaintenanceCompliancePage.css";

/* ─── Draft data ─── */

interface CommunityRow {
    name: string;
    attentionScore: number;
    newlyOpened: number;
    closed: number;
    totalOpen: number;
    days30Plus: number;
    avgDaysOpen: number;
    weeklyOverdue: number;
    monthlyOverdue: number;
    skipped: number;
    attentionStatus: string;
    mobileSignIns: number;
    webSignIns: number;
    mobilePct: number;
    taggedAssets: number;
    totalActiveAssets: number;
    untaggedAssets: number;
    taggedPct: number;
}

const allCommunities: CommunityRow[] = [
    { name: "Exton Senior Living", attentionScore: 90, newlyOpened: 42, closed: 38, totalOpen: 18, days30Plus: 9, avgDaysOpen: 34, weeklyOverdue: 22, monthlyOverdue: 35, skipped: 7, attentionStatus: "Critical", mobileSignIns: 38, webSignIns: 12, mobilePct: 76, taggedAssets: 487, totalActiveAssets: 492, untaggedAssets: 5, taggedPct: 99 },
    { name: "Glen Mills Senior Living", attentionScore: 48, newlyOpened: 31, closed: 29, totalOpen: 11, days30Plus: 6, avgDaysOpen: 28, weeklyOverdue: 14, monthlyOverdue: 20, skipped: 5, attentionStatus: "Elevated", mobileSignIns: 52, webSignIns: 18, mobilePct: 74, taggedAssets: 612, totalActiveAssets: 623, untaggedAssets: 11, taggedPct: 98 },
    { name: "Chestnut Ridge Retirement Living", attentionScore: 7, newlyOpened: 14, closed: 15, totalOpen: 4, days30Plus: 1, avgDaysOpen: 12, weeklyOverdue: 2, monthlyOverdue: 4, skipped: 1, attentionStatus: "Watch", mobileSignIns: 29, webSignIns: 22, mobilePct: 57, taggedAssets: 401, totalActiveAssets: 412, untaggedAssets: 11, taggedPct: 97 },
    { name: "Willow Creek Assisted Living", attentionScore: 0, newlyOpened: 18, closed: 19, totalOpen: 5, days30Plus: 2, avgDaysOpen: 14, weeklyOverdue: 0, monthlyOverdue: 0, skipped: 0, attentionStatus: "Healthy", mobileSignIns: 31, webSignIns: 20, mobilePct: 61, taggedAssets: 536, totalActiveAssets: 540, untaggedAssets: 4, taggedPct: 99 },
    { name: "Oak Valley Senior Community", attentionScore: 0, newlyOpened: 22, closed: 21, totalOpen: 4, days30Plus: 1, avgDaysOpen: 10, weeklyOverdue: 0, monthlyOverdue: 0, skipped: 0, attentionStatus: "Healthy", mobileSignIns: 27, webSignIns: 15, mobilePct: 64, taggedAssets: 483, totalActiveAssets: 490, untaggedAssets: 7, taggedPct: 99 },
    { name: "Sunrise Meadows", attentionScore: 0, newlyOpened: 10, closed: 11, totalOpen: 2, days30Plus: 0, avgDaysOpen: 8, weeklyOverdue: 0, monthlyOverdue: 0, skipped: 0, attentionStatus: "Healthy", mobileSignIns: 18, webSignIns: 14, mobilePct: 56, taggedAssets: 371, totalActiveAssets: 378, untaggedAssets: 7, taggedPct: 98 },
    { name: "Silver Spring Estates", attentionScore: 0, newlyOpened: 8, closed: 9, totalOpen: 1, days30Plus: 0, avgDaysOpen: 6, weeklyOverdue: 0, monthlyOverdue: 0, skipped: 0, attentionStatus: "Healthy", mobileSignIns: 7, webSignIns: 9, mobilePct: 44, taggedAssets: 298, totalActiveAssets: 302, untaggedAssets: 4, taggedPct: 99 },
    { name: "Harmony Village", attentionScore: 0, newlyOpened: 10, closed: 11, totalOpen: 1, days30Plus: 1, avgDaysOpen: 9, weeklyOverdue: 0, monthlyOverdue: 0, skipped: 0, attentionStatus: "Healthy", mobileSignIns: 15, webSignIns: 5, mobilePct: 75, taggedAssets: 862, totalActiveAssets: 885, untaggedAssets: 23, taggedPct: 97 },
];

function attentionScore(issues: number): { label: string; className: string } {
    if (issues >= 60) return { label: "Critical", className: "sev-critical" };
    if (issues >= 20) return { label: "Elevated", className: "sev-elevated" };
    if (issues >= 1) return { label: "Watch", className: "sev-watch" };
    return { label: "Healthy", className: "sev-healthy" };
}

const communitiesWithScore = allCommunities.filter(c => c.attentionScore > 0);
const maxIssues = Math.max(...communitiesWithScore.map(c => c.attentionScore));

/* ─── KPI config ─── */

interface KpiConfig {
    key: string;
    label: string;
    value: string;
    subtext: string;
    status: string;
    accent: string;
    description: string;
}

const kpis: KpiConfig[] = [
    {
        key: "open-wo",
        label: "Open Work Orders",
        value: "46",
        subtext: "155 opened / 153 closed",
        status: "Elevated",
        accent: "orange",
        description: "Total open work orders across all communities. Includes newly opened items not yet closed. A lower number indicates healthier facilities operations.",
    },
    {
        key: "30day-wo",
        label: "30+ Day Work Orders",
        value: "20",
        subtext: "Aging backlog",
        status: "Critical",
        accent: "red",
        description: "Work orders open longer than 30 days. Aging backlogs increase operational risk and may indicate resource or process gaps.",
    },
    {
        key: "reg-overdue",
        label: "Regulatory Overdue",
        value: "59",
        subtext: "Compliance tasks overdue",
        status: "Critical",
        accent: "red",
        description: "Regulatory and compliance-related tasks past their due date. Includes inspections, license renewals, and mandated reporting.",
    },
    {
        key: "pm-overdue",
        label: "PM Overdue",
        value: "48",
        subtext: "Preventive maintenance overdue",
        status: "Critical",
        accent: "red",
        description: "Scheduled preventive maintenance tasks that have passed their due date. Overdue PM increases risk of equipment failure and unplanned repairs.",
    },
    {
        key: "mobile-adoption",
        label: "Mobile Adoption",
        value: "64%",
        subtext: "207 mobile / 115 web",
        status: "Adoption",
        accent: "blue",
        description: "Percentage of TELS sign-ins occurring via mobile devices. Higher mobile adoption correlates with faster work order response times.",
    },
    {
        key: "asset-tagging",
        label: "Asset Tagging",
        value: "98%",
        subtext: "4,050 of 4,122 active assets tagged",
        status: "Healthy",
        accent: "green",
        description: "Percentage of active assets that have been tagged and inventoried in TELS. Full tagging enables accurate maintenance tracking and compliance reporting.",
    },
];

/* ─── Modal content helpers ─── */

function KpiModalContent({ kpi, onClose }: { kpi: KpiConfig; onClose: () => void }) {
    return (
        <div className="mcom-modal-overlay" onClick={onClose}>
            <div className="mcom-modal" onClick={e => e.stopPropagation()}>
                <div className="mcom-modal-hdr">
                    <h2 className="mcom-modal-title">{kpi.label}</h2>
                    <button className="mcom-modal-close" onClick={onClose}>&times;</button>
                </div>
                <p className="mcom-modal-desc">{kpi.description}</p>
                <p className="mcom-modal-draft">Draft data from TELS scorecard &middot; Not live feed</p>
                <div className="mcom-modal-table-wrap">
                    <table className="mcom-modal-table">
                        <thead>
                            <tr>{kpiModalColumns(kpi.key).map(col => <th key={col}>{col}</th>)}</tr>
                        </thead>
                        <tbody>
                            {allCommunities.map(c => (
                                <tr key={c.name}>
                                    {kpiModalCells(kpi.key, c).map((cell, i) => <td key={i}>{cell}</td>)}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function kpiModalColumns(key: string): string[] {
    switch (key) {
        case "open-wo":
            return ["Community", "Newly Opened", "Closed", "Total Open", "30+ Days Open"];
        case "30day-wo":
            return ["Community", "30+ Days Open", "Total Open", "Avg Days Open"];
        case "reg-overdue":
        case "pm-overdue":
            return ["Community", "Weekly Overdue", "Monthly Overdue", "Skipped", "Attention Status"];
        case "mobile-adoption":
            return ["Community", "Mobile Sign Ins", "Web Sign Ins", "Mobile %"];
        case "asset-tagging":
            return ["Community", "Tagged Assets", "Total Active", "Untagged", "Tagged %"];
        default:
            return [];
    }
}

function kpiModalCells(key: string, c: CommunityRow): (string | number)[] {
    switch (key) {
        case "open-wo":
            return [c.name, c.newlyOpened, c.closed, c.totalOpen, c.days30Plus];
        case "30day-wo":
            return [c.name, c.days30Plus, c.totalOpen, c.avgDaysOpen];
        case "reg-overdue":
            return [c.name, c.weeklyOverdue, c.monthlyOverdue, c.skipped, c.attentionStatus];
        case "pm-overdue":
            return [c.name, c.weeklyOverdue, c.monthlyOverdue, c.skipped, c.attentionStatus];
        case "mobile-adoption":
            return [c.name, c.mobileSignIns, c.webSignIns, `${c.mobilePct}%`];
        case "asset-tagging":
            return [c.name, c.taggedAssets, c.totalActiveAssets, c.untaggedAssets, `${c.taggedPct}%`];
        default:
            return [];
    }
}

function CommunityDetailModal({ community, onClose }: { community: CommunityRow; onClose: () => void }) {
    return (
        <div className="mcom-modal-overlay" onClick={onClose}>
            <div className="mcom-modal" onClick={e => e.stopPropagation()}>
                <div className="mcom-modal-hdr">
                    <h2 className="mcom-modal-title">{community.name}</h2>
                    <button className="mcom-modal-close" onClick={onClose}>&times;</button>
                </div>
                <p className="mcom-modal-draft">Draft data from TELS scorecard &middot; Not live feed</p>
                <div className="mcom-community-detail">
                    {community.attentionScore > 0 && (
                        <div className="mcom-detail-row">
                            <span className="mcom-detail-label">Attention Score</span>
                            <span className="mcom-detail-value">{community.attentionScore}</span>
                            <span className={`mcom-bar-sev ${attentionScore(community.attentionScore).className}`}>
                                {attentionScore(community.attentionScore).label}
                            </span>
                        </div>
                    )}
                    <div className="mcom-detail-row">
                        <span className="mcom-detail-label">Regulatory Overdue</span>
                        <span className="mcom-detail-value">{community.weeklyOverdue + community.monthlyOverdue}</span>
                    </div>
                    <div className="mcom-detail-row">
                        <span className="mcom-detail-label">PM Overdue</span>
                        <span className="mcom-detail-value">{community.monthlyOverdue}</span>
                    </div>
                    <div className="mcom-detail-row">
                        <span className="mcom-detail-label">Skipped Tasks</span>
                        <span className="mcom-detail-value">{community.skipped}</span>
                    </div>
                    <div className="mcom-detail-row">
                        <span className="mcom-detail-label">Open Work Orders</span>
                        <span className="mcom-detail-value">{community.totalOpen}</span>
                    </div>
                    <div className="mcom-detail-row">
                        <span className="mcom-detail-label">30+ Day Work Orders</span>
                        <span className="mcom-detail-value">{community.days30Plus}</span>
                    </div>
                    <div className="mcom-detail-row">
                        <span className="mcom-detail-label">Mobile Sign Ins</span>
                        <span className="mcom-detail-value">{community.mobileSignIns}</span>
                    </div>
                    <div className="mcom-detail-row">
                        <span className="mcom-detail-label">Web Sign Ins</span>
                        <span className="mcom-detail-value">{community.webSignIns}</span>
                    </div>
                    <div className="mcom-detail-row">
                        <span className="mcom-detail-label">Asset Tagging</span>
                        <span className="mcom-detail-value">{community.taggedPct}%</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

function AllCommunitiesModal({ onClose }: { onClose: () => void }) {
    return (
        <div className="mcom-modal-overlay" onClick={onClose}>
            <div className="mcom-modal mcom-modal-wide" onClick={e => e.stopPropagation()}>
                <div className="mcom-modal-hdr">
                    <h2 className="mcom-modal-title">All Communities</h2>
                    <button className="mcom-modal-close" onClick={onClose}>&times;</button>
                </div>
                <p className="mcom-modal-draft">Draft data from TELS scorecard &middot; Not live feed</p>
                <div className="mcom-modal-table-wrap">
                    <table className="mcom-modal-table">
                        <thead>
                            <tr>
                                <th>Community</th>
                                <th>Attention Score</th>
                                <th>Open Work Orders</th>
                                <th>30+ Day WO</th>
                                <th>Mobile Sign Ins</th>
                                <th>Web Sign Ins</th>
                            </tr>
                        </thead>
                        <tbody>
                            {allCommunities.map(c => (
                                <tr key={c.name}>
                                    <td>{c.name}</td>
                                    <td>
                                        {c.attentionScore > 0 ? (
                                            <span className={`mcom-table-sev ${attentionScore(c.attentionScore).className}`}>
                                                {c.attentionScore}
                                            </span>
                                        ) : (
                                            <span className="mcom-table-zero">0</span>
                                        )}
                                    </td>
                                    <td>{c.totalOpen}</td>
                                    <td>{c.days30Plus}</td>
                                    <td>{c.mobileSignIns}</td>
                                    <td>{c.webSignIns}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

/* ─── Main page ─── */

export default function MaintenanceCompliancePage() {
    const [activeModal, setActiveModal] = useState<"all-communities" | string | null>(null);

    function openKpiModal(key: string) { setActiveModal(`kpi-${key}`); }
    function openCommunityDetail(name: string) { setActiveModal(`community-${name}`); }
    function openAllCommunities() { setActiveModal("all-communities"); }
    function closeModal() { setActiveModal(null); }

    const selectedKpi = typeof activeModal === "string" && activeModal?.startsWith("kpi-")
        ? kpis.find(k => `kpi-${k.key}` === activeModal) ?? null
        : null;

    const selectedCommunity = typeof activeModal === "string" && activeModal?.startsWith("community-")
        ? allCommunities.find(c => `community-${c.name}` === activeModal) ?? null
        : null;

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
                    <button key={k.key} className={`mcom-kpi-card mcom-kpi-${k.accent}`} onClick={() => openKpiModal(k.key)}>
                        <div className="mcom-kpi-top">
                            <span className="mcom-kpi-value">{k.value}</span>
                            <span className={`mcom-kpi-status mcom-kpi-status-${k.accent}`}>{k.status}</span>
                        </div>
                        <span className="mcom-kpi-label">{k.label}</span>
                        <span className="mcom-kpi-subtext">{k.subtext}</span>
                        <span className="mcom-kpi-detail-link">View details</span>
                    </button>
                ))}
            </div>

            <div className="mcom-two-col">
                <section className="mcom-section mcom-col">
                    <h2 className="mcom-section-title">Community Attention Score</h2>
                    <p className="mcom-section-helper">
                        Draft issue count from TELS scorecard. Higher number means more overdue, open, skipped, or unresolved maintenance/compliance items. Only communities with a non-zero draft attention score are shown.
                    </p>
                    <div className="mcom-bars">
                        {communitiesWithScore.map(c => {
                            const sev = attentionScore(c.attentionScore);
                            return (
                                <button key={c.name} className="mcom-bar-row" onClick={() => openCommunityDetail(c.name)}>
                                    <span className="mcom-bar-label">{c.name}</span>
                                    <div className="mcom-bar-track">
                                        <div
                                            className={`mcom-bar-fill ${sev.className}`}
                                            style={{ width: `${(c.attentionScore / maxIssues) * 100}%` }}
                                        />
                                    </div>
                                    <span className="mcom-bar-value">{c.attentionScore}</span>
                                    <span className={`mcom-bar-sev ${sev.className}`}>{sev.label}</span>
                                </button>
                            );
                        })}
                    </div>
                    <div className="mcom-legend">
                        <span className="mcom-legend-item"><span className="mcom-legend-dot sev-critical" /> Critical</span>
                        <span className="mcom-legend-item"><span className="mcom-legend-dot sev-elevated" /> Elevated</span>
                        <span className="mcom-legend-item"><span className="mcom-legend-dot sev-watch" /> Watch</span>
                        <span className="mcom-legend-item"><span className="mcom-legend-dot sev-healthy" /> Healthy</span>
                    </div>
                    <button className="mcom-secondary-link" onClick={openAllCommunities}>View all communities</button>
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
                        <div className="mcom-snapshot-card">
                            <h3 className="mcom-snapshot-title">Work Order Movement</h3>
                            <ul className="mcom-snapshot-list">
                                <li>155 opened</li>
                                <li>153 closed</li>
                            </ul>
                        </div>
                        <div className="mcom-snapshot-card">
                            <h3 className="mcom-snapshot-title">Compliance Pressure</h3>
                            <ul className="mcom-snapshot-list">
                                <li>59 regulatory overdue</li>
                                <li>48 PM overdue</li>
                            </ul>
                        </div>
                        <div className="mcom-snapshot-card">
                            <h3 className="mcom-snapshot-title">Adoption</h3>
                            <ul className="mcom-snapshot-list">
                                <li>64% mobile sign-in rate</li>
                            </ul>
                        </div>
                        <div className="mcom-snapshot-card">
                            <h3 className="mcom-snapshot-title">Asset Readiness</h3>
                            <ul className="mcom-snapshot-list">
                                <li>98% tagged</li>
                            </ul>
                        </div>
                    </div>
                </section>
            </div>

            <section className="mcom-section">
                <h2 className="mcom-section-title">Operational Focus Areas</h2>
                <div className="mcom-focus-grid">
                    <div className="mcom-focus-card">
                        <h3 className="mcom-focus-title">Regulatory Compliance</h3>
                        <p className="mcom-focus-text"><span className="mcom-focus-label">Measures</span> License renewals, survey readiness, citation tracking.</p>
                        <p className="mcom-focus-text"><span className="mcom-focus-label">Future metrics</span> Compliance score, citations per period, survey pass rate.</p>
                    </div>
                    <div className="mcom-focus-card">
                        <h3 className="mcom-focus-title">Preventive Maintenance</h3>
                        <p className="mcom-focus-text"><span className="mcom-focus-label">Measures</span> Scheduled vs. completed PM work orders, overdue rate.</p>
                        <p className="mcom-focus-text"><span className="mcom-focus-label">Future metrics</span> PM completion %, PM overdue count, mean time to complete.</p>
                    </div>
                    <div className="mcom-focus-card">
                        <h3 className="mcom-focus-title">Work Order Backlog</h3>
                        <p className="mcom-focus-text"><span className="mcom-focus-label">Measures</span> Open, aging, and priority distribution of work orders.</p>
                        <p className="mcom-focus-text"><span className="mcom-focus-label">Future metrics</span> Backlog size, avg days open, priority breakdown.</p>
                    </div>
                    <div className="mcom-focus-card">
                        <h3 className="mcom-focus-title">Room Readiness</h3>
                        <p className="mcom-focus-text"><span className="mcom-focus-label">Measures</span> Turn time, pre-move inspections, readiness rate.</p>
                        <p className="mcom-focus-text"><span className="mcom-focus-label">Future metrics</span> Avg turn days, rooms ready on time %, inspection pass rate.</p>
                    </div>
                    <div className="mcom-focus-card">
                        <h3 className="mcom-focus-title">User Adoption</h3>
                        <p className="mcom-focus-text"><span className="mcom-focus-label">Measures</span> TELS login activity, feature usage, training completion.</p>
                        <p className="mcom-focus-text"><span className="mcom-focus-label">Future metrics</span> Active users %, feature adoption rate, training completion %.</p>
                    </div>
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

            {activeModal === "all-communities" && (
                <AllCommunitiesModal onClose={closeModal} />
            )}
            {selectedKpi && (
                <KpiModalContent kpi={selectedKpi} onClose={closeModal} />
            )}
            {selectedCommunity && (
                <CommunityDetailModal community={selectedCommunity} onClose={closeModal} />
            )}
        </div>
    );
}

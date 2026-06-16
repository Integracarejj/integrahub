import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { getLatestMaintenanceComplianceMetrics } from "../../services/performanceMetricsService";
import { getBusinessProcesses } from "../../services/businessProcessService";
import type { CommunityBreakdown, PerformanceMetricSnapshot } from "../../types/performanceMetrics";
import type { BusinessProcess } from "../../types/businessProcess";
import "./MaintenanceCompliancePage.css";

/* ─── Helpers ─── */

function attentionScore(issues: number): { label: string; className: string } {
    if (issues >= 60) return { label: "Critical", className: "sev-critical" };
    if (issues >= 20) return { label: "Elevated", className: "sev-elevated" };
    if (issues >= 1) return { label: "Watch", className: "sev-watch" };
    return { label: "Healthy", className: "sev-healthy" };
}

function formatSnapshotDate(d: string | Date): string {
    const date = typeof d === "string" ? new Date(d) : d;
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}

function pct(a: number, b: number): number {
    if (b === 0) return 0;
    return Math.round((a / b) * 100);
}

function toAppId(systemName: string): string {
    return "app-" + systemName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

/* ─── Map DB → display ─── */

interface CommunityDisplay {
    name: string;
    attentionScore: number;
    newlyOpened: number;
    closed: number;
    totalOpen: number;
    days30Plus: number;
    regulatoryOverdue: number;
    pmOverdue: number;
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

function toDisplay(rows: CommunityBreakdown[]): CommunityDisplay[] {
    return rows.map(r => ({
        name: r.communityName,
        attentionScore: r.attentionScore,
        newlyOpened: r.newlyOpenedWorkOrders,
        closed: r.closedWorkOrders,
        totalOpen: r.totalOpenWorkOrders,
        days30Plus: r.thirtyDayOpenWorkOrders,
        regulatoryOverdue: r.regulatoryOverdue,
        pmOverdue: r.pmOverdue,
        skipped: r.skippedTasks,
        attentionStatus: r.attentionStatus,
        mobileSignIns: r.mobileSignIns,
        webSignIns: r.webSignIns,
        mobilePct: pct(r.mobileSignIns, r.mobileSignIns + r.webSignIns),
        taggedAssets: r.taggedAssets,
        totalActiveAssets: r.totalActiveAssets,
        untaggedAssets: r.totalActiveAssets - r.taggedAssets,
        taggedPct: pct(r.taggedAssets, r.totalActiveAssets),
    }));
}

/* ─── Fallback hardcoded data ─── */

const FALLBACK_COMMUNITIES: CommunityDisplay[] = [
    { name: "Exton Senior Living", attentionScore: 90, newlyOpened: 42, closed: 38, totalOpen: 18, days30Plus: 9, regulatoryOverdue: 35, pmOverdue: 22, skipped: 7, attentionStatus: "Critical", mobileSignIns: 38, webSignIns: 12, mobilePct: 76, taggedAssets: 487, totalActiveAssets: 492, untaggedAssets: 5, taggedPct: 99 },
    { name: "Glen Mills Senior Living", attentionScore: 48, newlyOpened: 31, closed: 29, totalOpen: 11, days30Plus: 6, regulatoryOverdue: 20, pmOverdue: 14, skipped: 5, attentionStatus: "Elevated", mobileSignIns: 52, webSignIns: 18, mobilePct: 74, taggedAssets: 612, totalActiveAssets: 623, untaggedAssets: 11, taggedPct: 98 },
    { name: "Chestnut Ridge Retirement Living", attentionScore: 7, newlyOpened: 14, closed: 15, totalOpen: 4, days30Plus: 1, regulatoryOverdue: 4, pmOverdue: 2, skipped: 1, attentionStatus: "Watch", mobileSignIns: 29, webSignIns: 22, mobilePct: 57, taggedAssets: 401, totalActiveAssets: 412, untaggedAssets: 11, taggedPct: 97 },
    { name: "Willow Creek Assisted Living", attentionScore: 0, newlyOpened: 18, closed: 19, totalOpen: 5, days30Plus: 2, regulatoryOverdue: 0, pmOverdue: 0, skipped: 0, attentionStatus: "Healthy", mobileSignIns: 31, webSignIns: 20, mobilePct: 61, taggedAssets: 536, totalActiveAssets: 540, untaggedAssets: 4, taggedPct: 99 },
    { name: "Oak Valley Senior Community", attentionScore: 0, newlyOpened: 22, closed: 21, totalOpen: 4, days30Plus: 1, regulatoryOverdue: 0, pmOverdue: 0, skipped: 0, attentionStatus: "Healthy", mobileSignIns: 27, webSignIns: 15, mobilePct: 64, taggedAssets: 483, totalActiveAssets: 490, untaggedAssets: 7, taggedPct: 99 },
    { name: "Sunrise Meadows", attentionScore: 0, newlyOpened: 10, closed: 11, totalOpen: 2, days30Plus: 0, regulatoryOverdue: 0, pmOverdue: 0, skipped: 0, attentionStatus: "Healthy", mobileSignIns: 18, webSignIns: 14, mobilePct: 56, taggedAssets: 371, totalActiveAssets: 378, untaggedAssets: 7, taggedPct: 98 },
    { name: "Silver Spring Estates", attentionScore: 0, newlyOpened: 8, closed: 9, totalOpen: 1, days30Plus: 0, regulatoryOverdue: 0, pmOverdue: 0, skipped: 0, attentionStatus: "Healthy", mobileSignIns: 7, webSignIns: 9, mobilePct: 44, taggedAssets: 298, totalActiveAssets: 302, untaggedAssets: 4, taggedPct: 99 },
    { name: "Harmony Village", attentionScore: 0, newlyOpened: 10, closed: 11, totalOpen: 1, days30Plus: 1, regulatoryOverdue: 0, pmOverdue: 0, skipped: 0, attentionStatus: "Healthy", mobileSignIns: 15, webSignIns: 5, mobilePct: 75, taggedAssets: 862, totalActiveAssets: 885, untaggedAssets: 23, taggedPct: 97 },
];

/* ─── KPI computation ─── */

interface KpiConfig {
    key: string;
    label: string;
    value: string;
    subtext: string;
    status: string;
    accent: string;
    description: string;
}

function computeKpis(communities: CommunityDisplay[]): KpiConfig[] {
    const sumNewlyOpened = communities.reduce((s, c) => s + c.newlyOpened, 0);
    const sumClosed = communities.reduce((s, c) => s + c.closed, 0);
    const sumTotalOpen = communities.reduce((s, c) => s + c.totalOpen, 0);
    const sumDays30 = communities.reduce((s, c) => s + c.days30Plus, 0);
    const sumRegOverdue = communities.reduce((s, c) => s + c.regulatoryOverdue, 0);
    const sumPMOverdue = communities.reduce((s, c) => s + c.pmOverdue, 0);
    const sumMobile = communities.reduce((s, c) => s + c.mobileSignIns, 0);
    const sumWeb = communities.reduce((s, c) => s + c.webSignIns, 0);
    const sumTagged = communities.reduce((s, c) => s + c.taggedAssets, 0);
    const sumTotal = communities.reduce((s, c) => s + c.totalActiveAssets, 0);

    const mobilePct = pct(sumMobile, sumMobile + sumWeb);
    const taggedPct = pct(sumTagged, sumTotal);

    return [
        {
            key: "open-wo",
            label: "Open Work Orders",
            value: String(sumTotalOpen),
            subtext: `${sumNewlyOpened} opened / ${sumClosed} closed`,
            status: sumTotalOpen >= 30 ? "Elevated" : "Watch",
            accent: "orange",
            description: "Total open work orders across all communities. Includes newly opened items not yet closed. A lower number indicates healthier facilities operations.",
        },
        {
            key: "30day-wo",
            label: "30+ Day Work Orders",
            value: String(sumDays30),
            subtext: "Aging backlog",
            status: sumDays30 >= 10 ? "Critical" : sumDays30 >= 1 ? "Elevated" : "Healthy",
            accent: "red",
            description: "Work orders open longer than 30 days. Aging backlogs increase operational risk and may indicate resource or process gaps.",
        },
        {
            key: "reg-overdue",
            label: "Regulatory Overdue",
            value: String(sumRegOverdue),
            subtext: "Compliance tasks overdue",
            status: sumRegOverdue >= 20 ? "Critical" : sumRegOverdue >= 1 ? "Elevated" : "Healthy",
            accent: "red",
            description: "Regulatory and compliance-related tasks past their due date. Includes inspections, license renewals, and mandated reporting.",
        },
        {
            key: "pm-overdue",
            label: "PM Overdue",
            value: String(sumPMOverdue),
            subtext: "Preventive maintenance overdue",
            status: sumPMOverdue >= 20 ? "Critical" : sumPMOverdue >= 1 ? "Elevated" : "Healthy",
            accent: "red",
            description: "Scheduled preventive maintenance tasks that have passed their due date. Overdue PM increases risk of equipment failure and unplanned repairs.",
        },
        {
            key: "mobile-adoption",
            label: "Mobile Adoption",
            value: `${mobilePct}%`,
            subtext: `${sumMobile} mobile / ${sumWeb} web`,
            status: "Adoption",
            accent: "blue",
            description: "Percentage of TELS sign-ins occurring via mobile devices. Higher mobile adoption correlates with faster work order response times.",
        },
        {
            key: "asset-tagging",
            label: "Asset Tagging",
            value: `${taggedPct}%`,
            subtext: `${sumTagged.toLocaleString()} of ${sumTotal.toLocaleString()} active assets tagged`,
            status: taggedPct >= 95 ? "Healthy" : taggedPct >= 80 ? "Adoption" : "Elevated",
            accent: "green",
            description: "Percentage of active assets that have been tagged and inventoried in TELS. Full tagging enables accurate maintenance tracking and compliance reporting.",
        },
    ];
}

/* ─── Modal content helpers ─── */

function KpiModalContent({ kpi, communities, snapshot, onClose }: { kpi: KpiConfig; communities: CommunityDisplay[]; snapshot: PerformanceMetricSnapshot | null; onClose: () => void }) {
    const sorted = useMemo(() => {
        const copy = [...communities];
        const key = kpi.key;
        if (key === "30day-wo") copy.sort((a, b) => b.days30Plus - a.days30Plus);
        else if (key === "reg-overdue") copy.sort((a, b) => b.regulatoryOverdue - a.regulatoryOverdue);
        else if (key === "pm-overdue") copy.sort((a, b) => b.pmOverdue - a.pmOverdue);
        else if (key === "mobile-adoption") copy.sort((a, b) => b.mobilePct - a.mobilePct);
        else if (key === "asset-tagging") copy.sort((a, b) => b.taggedPct - a.taggedPct);
        return copy;
    }, [communities, kpi.key]);

    return (
        <div className="mcom-modal-overlay" onClick={onClose}>
            <div className="mcom-modal" onClick={e => e.stopPropagation()}>
                <div className="mcom-modal-hdr">
                    <h2 className="mcom-modal-title">{kpi.label}</h2>
                    <button className="mcom-modal-close" onClick={onClose}>&times;</button>
                </div>
                <p className="mcom-modal-desc">{kpi.description}</p>
                <p className="mcom-modal-draft">
                    {snapshot
                        ? `${snapshot.snapshotLabel} · Week of ${formatSnapshotDate(snapshot.periodStartDate)}–${formatSnapshotDate(snapshot.periodEndDate)} · Not live feed`
                        : "Draft data from TELS scorecard · Not live feed"}
                </p>
                <div className="mcom-modal-table-wrap">
                    <table className="mcom-modal-table">
                        <thead>
                            <tr>{kpiModalColumns(kpi.key).map(col => <th key={col}>{col}</th>)}</tr>
                        </thead>
                        <tbody>
                            {sorted.map(c => (
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
            return ["Community", "30+ Day Open Work Orders"];
        case "reg-overdue":
            return ["Community", "Regulatory Overdue"];
        case "pm-overdue":
            return ["Community", "PM Overdue"];
        case "mobile-adoption":
            return ["Community", "Mobile Sign Ins", "Web Sign Ins", "Adoption %"];
        case "asset-tagging":
            return ["Community", "Tagged Assets", "Total Assets", "Tagging %"];
        default:
            return [];
    }
}

function kpiModalCells(key: string, c: CommunityDisplay): (string | number)[] {
    switch (key) {
        case "open-wo":
            return [c.name, c.newlyOpened, c.closed, c.totalOpen, c.days30Plus];
        case "30day-wo":
            return [c.name, c.days30Plus];
        case "reg-overdue":
            return [c.name, c.regulatoryOverdue];
        case "pm-overdue":
            return [c.name, c.pmOverdue];
        case "mobile-adoption":
            return [c.name, c.mobileSignIns, c.webSignIns, `${c.mobilePct}%`];
        case "asset-tagging":
            return [c.name, c.taggedAssets, c.totalActiveAssets, `${c.taggedPct}%`];
        default:
            return [];
    }
}

function CommunityDetailModal({ community, snapshot, onClose }: { community: CommunityDisplay; snapshot: PerformanceMetricSnapshot | null; onClose: () => void }) {
    return (
        <div className="mcom-modal-overlay" onClick={onClose}>
            <div className="mcom-modal" onClick={e => e.stopPropagation()}>
                <div className="mcom-modal-hdr">
                    <h2 className="mcom-modal-title">{community.name}</h2>
                    <button className="mcom-modal-close" onClick={onClose}>&times;</button>
                </div>
                <p className="mcom-modal-draft">
                    {snapshot
                        ? `${snapshot.snapshotLabel} · Week of ${formatSnapshotDate(snapshot.periodStartDate)}–${formatSnapshotDate(snapshot.periodEndDate)} · Not live feed`
                        : "Draft data from TELS scorecard · Not live feed"}
                </p>
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
                        <span className="mcom-detail-value">{community.regulatoryOverdue}</span>
                    </div>
                    <div className="mcom-detail-row">
                        <span className="mcom-detail-label">PM Overdue</span>
                        <span className="mcom-detail-value">{community.pmOverdue}</span>
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

function AllCommunitiesModal({ communities, snapshot, onClose }: { communities: CommunityDisplay[]; snapshot: PerformanceMetricSnapshot | null; onClose: () => void }) {
    return (
        <div className="mcom-modal-overlay" onClick={onClose}>
            <div className="mcom-modal mcom-modal-wide" onClick={e => e.stopPropagation()}>
                <div className="mcom-modal-hdr">
                    <h2 className="mcom-modal-title">All Communities</h2>
                    <button className="mcom-modal-close" onClick={onClose}>&times;</button>
                </div>
                <p className="mcom-modal-draft">
                    {snapshot
                        ? `${snapshot.snapshotLabel} · Week of ${formatSnapshotDate(snapshot.periodStartDate)}–${formatSnapshotDate(snapshot.periodEndDate)} · Not live feed`
                        : "Draft data from TELS scorecard · Not live feed"}
                </p>
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
                            {communities.map(c => (
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
    const [snapshot, setSnapshot] = useState<PerformanceMetricSnapshot | null>(null);
    const [communities, setCommunities] = useState<CommunityDisplay[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isFallback, setIsFallback] = useState(false);
    const [hasData, setHasData] = useState(true);
    const [relatedProcess, setRelatedProcess] = useState<BusinessProcess | null | undefined>(undefined);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            try {
                const result = await getLatestMaintenanceComplianceMetrics();
                if (cancelled) return;

                if (result.snapshot && result.communities.length > 0) {
                    setSnapshot(result.snapshot);
                    setCommunities(toDisplay(result.communities));
                    setHasData(true);
                } else {
                    setSnapshot(null);
                    setCommunities([]);
                    setHasData(false);
                }
            } catch {
                if (cancelled) return;
                setSnapshot(null);
                setCommunities(FALLBACK_COMMUNITIES);
                setIsFallback(true);
                setError("Using local fallback draft data.");
                setHasData(true);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        load();
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        let cancelled = false;
        getBusinessProcesses()
            .then(processes => {
                if (cancelled) return;
                const match = processes.find(p => p.processName === "Maintenance & Compliance");
                setRelatedProcess(match ?? null);
            })
            .catch(() => {
                if (cancelled) return;
                setRelatedProcess(null);
            });
        return () => { cancelled = true; };
    }, []);

    function openKpiModal(key: string) { setActiveModal(`kpi-${key}`); }
    function openCommunityDetail(name: string) { setActiveModal(`community-${name}`); }
    function openAllCommunities() { setActiveModal("all-communities"); }
    function closeModal() { setActiveModal(null); }

    const kpis = useMemo(() => computeKpis(communities), [communities]);

    const selectedKpi = typeof activeModal === "string" && activeModal?.startsWith("kpi-")
        ? kpis.find(k => `kpi-${k.key}` === activeModal) ?? null
        : null;

    const selectedCommunity = typeof activeModal === "string" && activeModal?.startsWith("community-")
        ? communities.find(c => `community-${c.name}` === activeModal) ?? null
        : null;

    const communitiesWithScore = communities.filter(c => c.attentionScore > 0);
    const maxIssues = Math.max(...communitiesWithScore.map(c => c.attentionScore), 0);

    const sumOpen = communities.reduce((s, c) => s + c.newlyOpened, 0);
    const sumClosed = communities.reduce((s, c) => s + c.closed, 0);
    const sumRegOverdue = communities.reduce((s, c) => s + c.regulatoryOverdue, 0);
    const sumPMOverdue = communities.reduce((s, c) => s + c.pmOverdue, 0);
    const sumMobile = communities.reduce((s, c) => s + c.mobileSignIns, 0);
    const sumWeb = communities.reduce((s, c) => s + c.webSignIns, 0);
    const sumTagged = communities.reduce((s, c) => s + c.taggedAssets, 0);
    const sumTotal = communities.reduce((s, c) => s + c.totalActiveAssets, 0);
    const mobilePct = pct(sumMobile, sumMobile + sumWeb);
    const taggedPct = pct(sumTagged, sumTotal);

    if (loading) {
        return (
            <div className="mcom-page">
                <div className="mcom-top-bar">
                    <Link to="/performance" className="mcom-back-link">&larr; All Performance Areas</Link>
                </div>
                <header className="mcom-header">
                    <div>
                        <h1>Maintenance & Compliance</h1>
                        <p className="mcom-subtitle">Loading performance metrics&hellip;</p>
                    </div>
                </header>
            </div>
        );
    }

    if (!hasData) {
        return (
            <div className="mcom-page">
                <div className="mcom-top-bar">
                    <Link to="/performance" className="mcom-back-link">&larr; All Performance Areas</Link>
                </div>
                <header className="mcom-header">
                    <div>
                        <h1>Maintenance & Compliance</h1>
                        <p className="mcom-subtitle">No TELS performance snapshot found.</p>
                    </div>
                </header>
            </div>
        );
    }

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

            {isFallback && (
                <div className="mcom-draft-banner" style={{ borderColor: "#f59e0b", color: "#92400e", background: "#fffbeb" }}>
                    {error}
                </div>
            )}

            {!isFallback && snapshot && (
                <div className="mcom-draft-banner">
                    {snapshot.snapshotLabel} &middot; Week of {formatSnapshotDate(snapshot.periodStartDate)}–{formatSnapshotDate(snapshot.periodEndDate)} &middot; Not live feed
                </div>
            )}

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
                                            style={{ width: `${maxIssues > 0 ? (c.attentionScore / maxIssues) * 100 : 0}%` }}
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
                            {communitiesWithScore.length > 0
                                ? `Draft TELS data suggests attention is concentrated in ${communitiesWithScore.length} ${communitiesWithScore.length === 1 ? "community" : "communities"}, with the highest pressure coming from overdue compliance items, preventive maintenance, and aging work orders.`
                                : "No draft attention issues detected in the current TELS snapshot."}
                        </p>
                    </div>

                    <h2 className="mcom-section-title" style={{ marginTop: 20 }}>Operational Snapshot</h2>
                    <div className="mcom-snapshot-grid">
                        <div className="mcom-snapshot-card">
                            <h3 className="mcom-snapshot-title">Work Order Movement</h3>
                            <ul className="mcom-snapshot-list">
                                <li>{sumOpen} opened</li>
                                <li>{sumClosed} closed</li>
                            </ul>
                        </div>
                        <div className="mcom-snapshot-card">
                            <h3 className="mcom-snapshot-title">Compliance Pressure</h3>
                            <ul className="mcom-snapshot-list">
                                <li>{sumRegOverdue} regulatory overdue</li>
                                <li>{sumPMOverdue} PM overdue</li>
                            </ul>
                        </div>
                        <div className="mcom-snapshot-card">
                            <h3 className="mcom-snapshot-title">Adoption</h3>
                            <ul className="mcom-snapshot-list">
                                <li>{mobilePct}% mobile sign-in rate</li>
                            </ul>
                        </div>
                        <div className="mcom-snapshot-card">
                            <h3 className="mcom-snapshot-title">Asset Readiness</h3>
                            <ul className="mcom-snapshot-list">
                                <li>{taggedPct}% tagged</li>
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
                    {snapshot ? (
                        <Link to={`/applications/${toAppId(snapshot.sourceSystem)}`} className="mcom-source-chip mcom-source-link">
                            {snapshot.sourceSystem}
                        </Link>
                    ) : (
                        <span className="mcom-source-chip">TELS</span>
                    )}
                </div>
                <h2 className="mcom-section-title" style={{ marginTop: 14 }}>Related Process</h2>
                {relatedProcess ? (
                    <Link to={`/processes/${relatedProcess.id}`} className="mcom-related-link">
                        {relatedProcess.processName}
                    </Link>
                ) : (
                    <p className="mcom-related-text">Process mapping planned.</p>
                )}
            </section>

            {activeModal === "all-communities" && (
                <AllCommunitiesModal communities={communities} snapshot={snapshot} onClose={closeModal} />
            )}
            {selectedKpi && (
                <KpiModalContent kpi={selectedKpi} communities={communities} snapshot={snapshot} onClose={closeModal} />
            )}
            {selectedCommunity && (
                <CommunityDetailModal community={selectedCommunity} snapshot={snapshot} onClose={closeModal} />
            )}
        </div>
    );
}

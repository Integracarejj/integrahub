import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "./CapabilityViewPage.css";

interface ApiApplication {
    id: string;
    name: string;
    status: string;
    systemCategory?: string | null;
    capabilityId: string;
    capabilityName: string;
    architectureType?: string | null;
    mobileSupportType?: string | null;
    apiAvailability?: string | null;
    reportingAvailability?: string | null;
    businessContext: {
        businessCriticality?: string;
    };
}

function isValueUseful(val: string | null | undefined): boolean {
    if (!val) return false;
    const v = val.trim().toLowerCase();
    return v !== "" && v !== "none" && v !== "no" && v !== "unknown" && v !== "no reporting identified";
}

function mapGroup(app: ApiApplication): string {
    const cat = (app.systemCategory || "").toLowerCase();
    const cap = (app.capabilityName || "").toLowerCase();
    const name = app.name.toLowerCase();

    if (
        name.includes("azure ad") || name.includes("active directory") ||
        cat.includes("identity") || cat.includes("access") ||
        cap.includes("identity") || cap.includes("access")
    ) return "Identity & Access";

    if (
        name.includes("outlook") || name.includes("exchange") || name.includes("sharepoint") || name.includes("teams") ||
        cat.includes("collaboration") || cat.includes("communication") || cat.includes("document") ||
        cap.includes("collaboration") || cap.includes("communication")
    ) return "Collaboration / Communication";

    if (
        cat.includes("sales") || cat.includes("marketing") || cat.includes("crm") ||
        cap.includes("sales") || cap.includes("marketing") || cap.includes("crm")
    ) return "Sales & Marketing";

    if (
        cat.includes("clinical") || cat.includes("resident") || cat.includes("pharmacy") ||
        cat.includes("emar") ||
        cap.includes("clinical") || cap.includes("resident") || cap.includes("patient")
    ) return "Resident Care / Clinical";

    if (
        cat.includes("operation") || cat.includes("facilities") ||
        cap.includes("operation") || cap.includes("facilities")
    ) return "Operations & Facilities";

    if (
        cat.includes("hr") || cat.includes("workforce") || cat.includes("payroll") ||
        cat.includes("learning") || cat.includes("employee") ||
        cap.includes("hr") || cap.includes("workforce") || cap.includes("payroll") ||
        cap.includes("learning") || cap.includes("talent")
    ) return "Workforce / HR";

    if (
        cat.includes("financial") || cat.includes("accounting") ||
        cap.includes("financial") || cap.includes("accounting") || cap.includes("finance")
    ) return "Finance";

    if (
        cat.includes("analytics") || cat.includes("reporting") ||
        cap.includes("analytics") || cap.includes("reporting") ||
        cat.includes("data")
    ) return "Analytics & Reporting";

    return "Other";
}

const groupDescriptions: Record<string, string> = {
    "Sales & Marketing": "Systems supporting lead generation, referrals, tours, and prospect conversion.",
    "Resident Care / Clinical": "Systems supporting resident care, clinical operations, pharmacy, safety, and engagement.",
    "Operations & Facilities": "Systems supporting maintenance, work orders, facilities, and operational readiness.",
    "Workforce / HR": "Systems supporting employees, payroll, learning, engagement, and scheduling.",
    "Finance": "Systems supporting financial operations and accounting.",
    "Analytics & Reporting": "Platforms supporting data, reporting, dashboards, and analytics.",
    "Identity & Access": "Systems supporting authentication, access, and identity management.",
    "Collaboration / Communication": "Systems supporting communication, documents, and collaboration.",
    "Other": "Systems not yet assigned to a primary capability group.",
};

const groupOrder = [
    "Sales & Marketing",
    "Resident Care / Clinical",
    "Operations & Facilities",
    "Workforce / HR",
    "Finance",
    "Analytics & Reporting",
    "Identity & Access",
    "Collaboration / Communication",
    "Other",
];

type FilterKey = "all" | "critical" | "reporting" | "mobile" | "api";

interface FilterChip {
    key: FilterKey;
    label: string;
}

const filterChips: FilterChip[] = [
    { key: "all", label: "All" },
    { key: "critical", label: "Critical" },
    { key: "reporting", label: "Reporting" },
    { key: "mobile", label: "Mobile" },
    { key: "api", label: "API" },
];

function matchesFilter(app: ApiApplication, filter: FilterKey): boolean {
    if (filter === "all") return true;
    if (filter === "critical") return app.businessContext?.businessCriticality === "Critical";
    if (filter === "reporting") return isValueUseful(app.reportingAvailability);
    if (filter === "mobile") return isValueUseful(app.mobileSupportType);
    if (filter === "api") return isValueUseful(app.apiAvailability);
    return true;
}

export default function CapabilityViewPage() {
    const [applications, setApplications] = useState<ApiApplication[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
    const [modalFilter, setModalFilter] = useState<FilterKey | null>(null);

    useEffect(() => {
        if (modalFilter === null) return;
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") setModalFilter(null);
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [modalFilter]);

    useEffect(() => {
        fetch("/api/applications")
            .then((res) => res.ok ? res.json() : [])
            .then((data) => {
                setApplications(data);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    const groups = useMemo(() => {
        const groupMap: Record<string, ApiApplication[]> = {};
        for (const group of groupOrder) {
            groupMap[group] = [];
        }
        for (const app of applications) {
            const groupName = mapGroup(app);
            if (groupMap[groupName]) {
                groupMap[groupName].push(app);
            } else {
                groupMap["Other"].push(app);
            }
        }
        return groupOrder
            .filter((g) => groupMap[g].length > 0)
            .map((g) => ({ name: g, systems: groupMap[g] }));
    }, [applications]);

    const summaryStats = useMemo(() => {
        const total = applications.length;
        let critical = 0;
        let reporting = 0;
        let mobile = 0;
        let api = 0;
        for (const app of applications) {
            if (app.businessContext?.businessCriticality === "Critical") critical++;
            if (isValueUseful(app.reportingAvailability)) reporting++;
            if (isValueUseful(app.mobileSupportType)) mobile++;
            if (isValueUseful(app.apiAvailability)) api++;
        }
        return { total, critical, reporting, mobile, api };
    }, [applications]);

    const modalMeta = useMemo(() => {
        if (!modalFilter) return { title: "", systems: [] as ApiApplication[] };
        const titleMap: Record<FilterKey, string> = {
            all: "All Systems",
            critical: "Critical Systems",
            reporting: "Reporting Enabled Systems",
            mobile: "Mobile Enabled Systems",
            api: "API Enabled Systems",
        };
        const systems = modalFilter === "all"
            ? applications
            : applications.filter((app) => matchesFilter(app, modalFilter));
        return { title: titleMap[modalFilter], systems };
    }, [modalFilter, applications]);

    if (loading) {
        return <div className="capability-view-page"><p className="cv-loading">Loading...</p></div>;
    }

    return (
        <div className="capability-view-page">
            <header className="cv-header">
                <h1>Capability View</h1>
                <p className="cv-subtitle">
                    {applications.length} systems grouped by business and technology capability
                </p>
            </header>

            <div className="cv-summary">
                <button className="cv-summary-card" onClick={() => setModalFilter("all")}>
                    <span className="cv-summary-value">{summaryStats.total}</span>
                    <span className="cv-summary-label">Total Systems</span>
                </button>
                <button className="cv-summary-card" onClick={() => setModalFilter("critical")}>
                    <span className="cv-summary-value cv-summary-critical">{summaryStats.critical}</span>
                    <span className="cv-summary-label">Critical</span>
                </button>
                <button className="cv-summary-card" onClick={() => setModalFilter("reporting")}>
                    <span className="cv-summary-value cv-summary-reporting">{summaryStats.reporting}</span>
                    <span className="cv-summary-label">Reporting Enabled</span>
                </button>
                <button className="cv-summary-card" onClick={() => setModalFilter("mobile")}>
                    <span className="cv-summary-value cv-summary-mobile">{summaryStats.mobile}</span>
                    <span className="cv-summary-label">Mobile Enabled</span>
                </button>
                <button className="cv-summary-card" onClick={() => setModalFilter("api")}>
                    <span className="cv-summary-value cv-summary-api">{summaryStats.api}</span>
                    <span className="cv-summary-label">API Enabled</span>
                </button>
            </div>

            <div className="cv-filters">
                {filterChips.map((chip) => (
                    <button
                        key={chip.key}
                        className={`cv-filter-chip${activeFilter === chip.key ? " active" : ""}`}
                        onClick={() => setActiveFilter(chip.key)}
                    >
                        {chip.label}
                    </button>
                ))}
            </div>

            <div className="cv-grid">
                {groups.map((group) => {
                    const filteredSystems = group.systems.filter((app) => matchesFilter(app, activeFilter));
                    return (
                        <div key={group.name} className="cv-card">
                            <div className="cv-card-header">
                                <div className="cv-card-header-text">
                                    <h2 className="cv-card-title">{group.name}</h2>
                                    <p className="cv-card-desc">{groupDescriptions[group.name]}</p>
                                </div>
                                <span className="cv-card-count">{group.systems.length}</span>
                            </div>
                            {filteredSystems.length === 0 ? (
                                <div className="cv-empty">No systems match this filter.</div>
                            ) : (
                                <ul className="cv-system-list">
                                    {filteredSystems.map((app) => {
                                        const isCritical = app.businessContext?.businessCriticality === "Critical";
                                        const hasMobile = isValueUseful(app.mobileSupportType);
                                        const hasReporting = isValueUseful(app.reportingAvailability);
                                        const hasApi = isValueUseful(app.apiAvailability);

                                        return (
                                            <li key={app.id} className="cv-system-item">
                                                <Link to={`/applications/${app.id}`} className="cv-system-link">
                                                    <span className="cv-system-name">{app.name}</span>
                                                    <span className="cv-system-chips">
                                                        {isCritical && <span className="cv-chip cv-chip-critical">Critical</span>}
                                                        {hasMobile && <span className="cv-chip cv-chip-mobile">Mobile</span>}
                                                        {hasReporting && <span className="cv-chip cv-chip-reporting">Reporting</span>}
                                                        {hasApi && <span className="cv-chip cv-chip-api">API</span>}
                                                    </span>
                                                </Link>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    );
                })}
            </div>

            {modalFilter !== null && (
                <div className="cv-modal-backdrop" onClick={() => setModalFilter(null)}>
                    <div className="cv-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
                        <div className="cv-modal-hdr">
                            <div className="cv-modal-hdr-text">
                                <h2 className="cv-modal-title">{modalMeta.title}</h2>
                                <p className="cv-modal-subtitle">{modalMeta.systems.length} {modalMeta.systems.length === 1 ? "system" : "systems"}</p>
                            </div>
                            <button className="cv-modal-close" onClick={() => setModalFilter(null)} aria-label="Close">&times;</button>
                        </div>
                        {modalMeta.systems.length === 0 ? (
                            <div className="cv-modal-empty">No systems found.</div>
                        ) : (
                            <ul className="cv-modal-list">
                                {modalMeta.systems.map((app) => {
                                    const groupName = mapGroup(app);
                                    const isCritical = app.businessContext?.businessCriticality === "Critical";
                                    const hasMobile = isValueUseful(app.mobileSupportType);
                                    const hasReporting = isValueUseful(app.reportingAvailability);
                                    const hasApi = isValueUseful(app.apiAvailability);

                                    return (
                                        <li key={app.id} className="cv-modal-item">
                                            <Link to={`/applications/${app.id}`} className="cv-modal-link" onClick={() => setModalFilter(null)}>
                                                <div className="cv-modal-item-main">
                                                    <span className="cv-modal-item-name">{app.name}</span>
                                                    <span className="cv-modal-item-group">{groupName}</span>
                                                </div>
                                                <span className="cv-system-chips">
                                                    {isCritical && <span className="cv-chip cv-chip-critical">Critical</span>}
                                                    {hasMobile && <span className="cv-chip cv-chip-mobile">Mobile</span>}
                                                    {hasReporting && <span className="cv-chip cv-chip-reporting">Reporting</span>}
                                                    {hasApi && <span className="cv-chip cv-chip-api">API</span>}
                                                </span>
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

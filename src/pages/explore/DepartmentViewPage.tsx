import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "./DepartmentViewPage.css";

interface Department {
    id: string;
    name: string;
    sortOrder?: number;
}

interface ApiApplication {
    id: string;
    name: string;
    status: string;
    systemCategory?: string | null;
    businessContext: {
        businessCriticality?: string;
    };
    mobileSupportType?: string | null;
    apiAvailability?: string | null;
    reportingAvailability?: string | null;
    departments?: { id: string; name: string }[];
}

function isValueUseful(val: string | null | undefined): boolean {
    if (!val) return false;
    const v = val.trim().toLowerCase();
    return v !== "" && v !== "none" && v !== "no" && v !== "unknown" && v !== "no reporting identified";
}

type FilterKey = "all" | "critical" | "reporting" | "mobile" | "api";

const filterChips: { key: FilterKey; label: string }[] = [
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

type ModalKey = FilterKey | "departments";

export default function DepartmentViewPage() {
    const [departments, setDepartments] = useState<Department[]>([]);
    const [applications, setApplications] = useState<ApiApplication[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
    const [modalKey, setModalKey] = useState<ModalKey | null>(null);

    useEffect(() => {
        if (modalKey === null) return;
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") setModalKey(null);
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [modalKey]);

    useEffect(() => {
        Promise.all([
            fetch("/api/departments").then((res) => res.ok ? res.json() : []),
            fetch("/api/applications").then((res) => res.ok ? res.json() : []),
        ])
            .then(([deptData, appData]) => {
                setDepartments(deptData);
                setApplications(appData);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    const assignedApps = useMemo(() => {
        return applications.filter((app) => app.departments && app.departments.length > 0);
    }, [applications]);

    const summaryStats = useMemo(() => {
        const assignedSet = new Set(assignedApps.map((a) => a.id));
        let critical = 0;
        let reporting = 0;
        let mobile = 0;
        let api = 0;
        for (const app of assignedApps) {
            if (app.businessContext?.businessCriticality === "Critical") critical++;
            if (isValueUseful(app.reportingAvailability)) reporting++;
            if (isValueUseful(app.mobileSupportType)) mobile++;
            if (isValueUseful(app.apiAvailability)) api++;
        }
        return {
            totalDepartments: departments.length,
            totalAssigned: assignedSet.size,
            critical,
            reporting,
            mobile,
            api,
        };
    }, [departments, assignedApps]);

    const deptAppMap = useMemo(() => {
        const map: Record<string, ApiApplication[]> = {};
        for (const dept of departments) {
            map[dept.id] = [];
        }
        for (const app of applications) {
            if (app.departments) {
                for (const dept of app.departments) {
                    if (map[dept.id]) {
                        map[dept.id].push(app);
                    }
                }
            }
        }
        return map;
    }, [departments, applications]);

    const modalMeta = useMemo(() => {
        if (!modalKey) return { title: "", subtitle: "", type: "systems" as const, systems: [] as ApiApplication[], depts: [] as { name: string; systemCount: number; criticalCount: number }[] };
        if (modalKey === "departments") {
            const depts = departments.map((d) => {
                const systems = deptAppMap[d.id] || [];
                const criticalCount = systems.filter((a) => a.businessContext?.businessCriticality === "Critical").length;
                return { name: d.name, systemCount: systems.length, criticalCount };
            });
            return {
                title: "All Departments",
                subtitle: `${departments.length} departments`,
                type: "departments" as const,
                depts,
                systems: [],
            };
        }
        const titleMap: Record<string, string> = {
            all: "Assigned Systems",
            critical: "Critical Systems",
            reporting: "Reporting Enabled Systems",
            mobile: "Mobile Enabled Systems",
            api: "API Enabled Systems",
        };
        const systems = modalKey === "all"
            ? assignedApps
            : assignedApps.filter((app) => matchesFilter(app, modalKey));
        return {
            title: titleMap[modalKey],
            subtitle: `${systems.length} ${systems.length === 1 ? "system" : "systems"}`,
            type: "systems" as const,
            systems,
            depts: [],
        };
    }, [modalKey, departments, assignedApps, deptAppMap]);

    if (loading) {
        return <div className="dv-page"><p className="dv-loading">Loading...</p></div>;
    }

    return (
        <div className="dv-page">
            <header className="dv-header">
                <h1>Department View</h1>
                <p className="dv-subtitle">
                    {departments.length} departments — {summaryStats.totalAssigned} systems assigned
                </p>
            </header>

            <div className="dv-summary">
                <button className="dv-summary-card" onClick={() => setModalKey("departments")}>
                    <span className="dv-summary-value">{summaryStats.totalDepartments}</span>
                    <span className="dv-summary-label">Total Departments</span>
                </button>
                <button className="dv-summary-card" onClick={() => setModalKey("all")}>
                    <span className="dv-summary-value">{summaryStats.totalAssigned}</span>
                    <span className="dv-summary-label">Total Assigned Systems</span>
                </button>
                <button className="dv-summary-card" onClick={() => setModalKey("critical")}>
                    <span className="dv-summary-value dv-summary-critical">{summaryStats.critical}</span>
                    <span className="dv-summary-label">Critical Systems</span>
                </button>
                <button className="dv-summary-card" onClick={() => setModalKey("reporting")}>
                    <span className="dv-summary-value dv-summary-reporting">{summaryStats.reporting}</span>
                    <span className="dv-summary-label">Reporting Enabled</span>
                </button>
                <button className="dv-summary-card" onClick={() => setModalKey("mobile")}>
                    <span className="dv-summary-value dv-summary-mobile">{summaryStats.mobile}</span>
                    <span className="dv-summary-label">Mobile Enabled</span>
                </button>
                {summaryStats.api > 0 && (
                    <button className="dv-summary-card" onClick={() => setModalKey("api")}>
                        <span className="dv-summary-value dv-summary-api">{summaryStats.api}</span>
                        <span className="dv-summary-label">API Enabled</span>
                    </button>
                )}
            </div>

            <div className="dv-filters">
                {filterChips.map((chip) => (
                    <button
                        key={chip.key}
                        className={`dv-filter-chip${activeFilter === chip.key ? " active" : ""}`}
                        onClick={() => setActiveFilter(chip.key)}
                    >
                        {chip.label}
                    </button>
                ))}
            </div>

            <div className="dv-grid">
                {departments.map((dept) => {
                    const allSystems = deptAppMap[dept.id] || [];
                    const filteredSystems = allSystems.filter((app) => matchesFilter(app, activeFilter));
                    const critCount = allSystems.filter((a) => a.businessContext?.businessCriticality === "Critical").length;
                    const reportCount = allSystems.filter((a) => isValueUseful(a.reportingAvailability)).length;

                    return (
                        <div key={dept.id} className="dv-card">
                            <div className="dv-card-header">
                                <div className="dv-card-header-text">
                                    <h2 className="dv-card-title">{dept.name}</h2>
                                    <p className="dv-card-meta">
                                        {allSystems.length} {allSystems.length === 1 ? "System" : "Systems"}
                                        {critCount > 0 && ` · ${critCount} Critical`}
                                        {reportCount > 0 && ` · ${reportCount} Reporting`}
                                    </p>
                                </div>
                                <span className="dv-card-count">{allSystems.length}</span>
                            </div>
                            {allSystems.length === 0 ? (
                                <div className="dv-empty">No systems assigned to this department.</div>
                            ) : filteredSystems.length === 0 ? (
                                <div className="dv-empty">No systems match this filter.</div>
                            ) : (
                                <ul className="dv-system-list">
                                    {filteredSystems.map((app) => {
                                        const isCritical = app.businessContext?.businessCriticality === "Critical";
                                        const hasMobile = isValueUseful(app.mobileSupportType);
                                        const hasReporting = isValueUseful(app.reportingAvailability);
                                        const hasApi = isValueUseful(app.apiAvailability);

                                        return (
                                            <li key={app.id} className="dv-system-item">
                                                <Link to={`/applications/${app.id}`} className="dv-system-link">
                                                    <span className="dv-system-name">{app.name}</span>
                                                    <span className="dv-system-chips">
                                                        {isCritical && <span className="dv-chip dv-chip-critical">Critical</span>}
                                                        {hasMobile && <span className="dv-chip dv-chip-mobile">Mobile</span>}
                                                        {hasReporting && <span className="dv-chip dv-chip-reporting">Reporting</span>}
                                                        {hasApi && <span className="dv-chip dv-chip-api">API</span>}
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

            {modalKey !== null && (
                <div className="dv-modal-backdrop" onClick={() => setModalKey(null)}>
                    <div className="dv-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
                        <div className="dv-modal-hdr">
                            <div className="dv-modal-hdr-text">
                                <h2 className="dv-modal-title">{modalMeta.title}</h2>
                                <p className="dv-modal-subtitle">{modalMeta.subtitle}</p>
                            </div>
                            <button className="dv-modal-close" onClick={() => setModalKey(null)} aria-label="Close">&times;</button>
                        </div>
                        {modalMeta.type === "departments" ? (
                            <ul className="dv-modal-list">
                                {modalMeta.depts.map((d) => (
                                    <li key={d.name} className="dv-modal-item">
                                        <div className="dv-modal-dept">
                                            <span className="dv-modal-dept-name">{d.name}</span>
                                            <span className="dv-modal-dept-meta">
                                                {d.systemCount} {d.systemCount === 1 ? "system" : "systems"}
                                                {d.criticalCount > 0 ? ` · ${d.criticalCount} critical` : ""}
                                            </span>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : modalMeta.systems.length === 0 ? (
                            <div className="dv-modal-empty">No systems found.</div>
                        ) : (
                            <ul className="dv-modal-list">
                                {modalMeta.systems.map((app) => {
                                    const isCritical = app.businessContext?.businessCriticality === "Critical";
                                    const hasMobile = isValueUseful(app.mobileSupportType);
                                    const hasReporting = isValueUseful(app.reportingAvailability);
                                    const hasApi = isValueUseful(app.apiAvailability);
                                    const deptNames = (app.departments || []).map((d) => d.name).join(", ");

                                    return (
                                        <li key={app.id} className="dv-modal-item">
                                            <Link to={`/applications/${app.id}`} className="dv-modal-link" onClick={() => setModalKey(null)}>
                                                <div className="dv-modal-item-main">
                                                    <span className="dv-modal-item-name">{app.name}</span>
                                                    <span className="dv-modal-item-secondary">
                                                        {deptNames}
                                                        {app.systemCategory ? ` · ${app.systemCategory}` : ""}
                                                    </span>
                                                </div>
                                                <span className="dv-system-chips">
                                                    {isCritical && <span className="dv-chip dv-chip-critical">Critical</span>}
                                                    {hasMobile && <span className="dv-chip dv-chip-mobile">Mobile</span>}
                                                    {hasReporting && <span className="dv-chip dv-chip-reporting">Reporting</span>}
                                                    {hasApi && <span className="dv-chip dv-chip-api">API</span>}
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

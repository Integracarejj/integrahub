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

function mapGroup(systemCategory: string | null | undefined, capabilityName: string | null | undefined): string {
    const cat = (systemCategory || "").toLowerCase();
    const cap = (capabilityName || "").toLowerCase();

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

    if (
        cat.includes("identity") || cat.includes("access") ||
        cap.includes("identity") || cap.includes("access") ||
        cap.includes("azure ad") || cap.includes("active directory")
    ) return "Identity & Access";

    if (
        cat.includes("collaboration") || cat.includes("communication") ||
        cat.includes("document") ||
        cap.includes("collaboration") || cap.includes("communication") ||
        cap.includes("outlook") || cap.includes("sharepoint") || cap.includes("exchange")
    ) return "Collaboration / Communication";

    return "Other";
}

export default function CapabilityViewPage() {
    const [applications, setApplications] = useState<ApiApplication[]>([]);
    const [loading, setLoading] = useState(true);

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

        for (const group of groupOrder) {
            groupMap[group] = [];
        }

        for (const app of applications) {
            const groupName = mapGroup(app.systemCategory, app.capabilityName);
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

    if (loading) {
        return <div className="capability-view-page"><p>Loading...</p></div>;
    }

    return (
        <div className="capability-view-page">
            <header className="cv-header">
                <h1>Capability View</h1>
                <p className="cv-subtitle">
                    {applications.length} systems grouped by business and technology capability
                </p>
            </header>

            <div className="cv-grid">
                {groups.map((group) => (
                    <div key={group.name} className="cv-card">
                        <div className="cv-card-header">
                            <h2 className="cv-card-title">{group.name}</h2>
                            <span className="cv-card-count">{group.systems.length}</span>
                        </div>
                        <ul className="cv-system-list">
                            {group.systems.map((app) => {
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
                    </div>
                ))}
            </div>
        </div>
    );
}

import { Link } from "react-router-dom";
import "./PerformancePage.css";

interface DomainCard {
    title: string;
    description: string;
    sourceSystems: string[];
    status: "Future" | "Planned";
    route?: string;
}

const domains: DomainCard[] = [
    {
        title: "Maintenance & Compliance",
        description:
            "Track facilities, work orders, room readiness, preventive maintenance, and regulatory compliance.",
        sourceSystems: ["TELS"],
        status: "Planned",
        route: "/performance/maintenance-compliance",
    },
    {
        title: "Sales & Occupancy",
        description:
            "Track leads, inquiries, tours, move-ins, occupancy, and conversion performance.",
        sourceSystems: ["WelcomeHome", "APFM", "ECP", "Power BI"],
        status: "Future",
    },
    {
        title: "Workforce",
        description:
            "Track hiring, onboarding, training, engagement, scheduling, and retention.",
        sourceSystems: ["Paycor", "TalentLMS", "Bonusly", "OnShift", "Azure AD"],
        status: "Future",
    },
    {
        title: "Resident Care",
        description:
            "Track care delivery, wellness, service requests, incidents, and resident support workflows.",
        sourceSystems: ["ECP", "PointClickCare", "TELS"],
        status: "Future",
    },
    {
        title: "Financial Performance",
        description:
            "Track billing, AP, revenue cycle, budget activity, and financial workflow performance.",
        sourceSystems: ["Acumatica", "Power BI"],
        status: "Future",
    },
];

export default function PerformancePage() {
    return (
        <div className="perf-page">
            <header className="perf-header">
                <h1>Performance</h1>
                <p className="perf-subtitle">
                    Operational metrics across the organization — how the business performs.
                </p>
            </header>

            <div className="perf-grid">
                {domains.map(d => (
                    <div key={d.title} className="perf-card">
                        <div className="perf-card-body">
                            <div className="perf-card-top">
                                <h2 className="perf-card-title">{d.title}</h2>
                                <span className={`perf-status perf-status-${d.status.toLowerCase()}`}>
                                    {d.status}
                                </span>
                            </div>
                            <p className="perf-card-desc">{d.description}</p>
                            <div className="perf-card-systems">
                                {d.sourceSystems.map(sys => (
                                    <span key={sys} className="perf-system-chip">{sys}</span>
                                ))}
                            </div>
                        </div>
                        <div className="perf-card-footer">
                            {d.route ? (
                                <Link to={d.route} className="perf-card-link">View Area</Link>
                            ) : (
                                <span className="perf-card-link perf-card-link--disabled">Coming Soon</span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

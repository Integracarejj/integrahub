import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { BUSINESS_TOPICS, getTopicBySlug, TOPIC_STYLES } from "../../data/topics";
import "./TopicDetailPage.css";

const SYSTEM_ROUTES: Record<string, string> = {
    "ECP": "/applications/app-ecp",
    "WelcomeHome": "/applications/app-welcomehome",
    "Power BI": "/applications/app-powerbi",
    "TELS": "/applications/app-tels",
    "Azure AD": "/applications/app-azuread",
    "Azure SQL Database": "/applications/app-azure-sql-db",
    "TalentLMS": "/applications/app-talentlms",
    "Paycor": "/applications/app-paycor",
    "OnShift": "/applications/app-onshift",
    "Acumatica": "/applications/app-acumatica",
    "SharePoint": "/applications/app-sharepoint",
};

const PROCESS_ROUTES: Record<string, string> = {
    "Prospect to Resident": "/processes",
    "Employee Lifecycle": "/processes",
    "Resident Care": "/processes",
    "Maintenance & Compliance": "/processes",
};

const PERF_ROUTES: Record<string, string> = {
    "Sales & Occupancy": "/performance",
    "Workforce": "/performance",
    "Financial Performance": "/performance",
    "Resident Care": "/performance",
    "Maintenance & Compliance": "/performance/maintenance-compliance",
};

export default function TopicDetailPage() {
    const { topicSlug } = useParams<{ topicSlug: string }>();
    const topic = topicSlug ? getTopicBySlug(topicSlug) : undefined;
    const style = topicSlug ? (TOPIC_STYLES[topicSlug] || { icon: "📄", color: "#6366f1", bg: "#f5f3ff" }) : null;

    const nav = useMemo(() => {
        if (!topicSlug) return null;
        const idx = BUSINESS_TOPICS.findIndex(t => t.slug === topicSlug);
        if (idx === -1) return null;
        return {
            prev: idx > 0 ? BUSINESS_TOPICS[idx - 1] : null,
            next: idx < BUSINESS_TOPICS.length - 1 ? BUSINESS_TOPICS[idx + 1] : null,
        };
    }, [topicSlug]);

    const nextSteps = useMemo(() => {
        if (!topic) return [];
        const steps: { icon: string; title: string; desc: string; href: string }[] = [];

        const firstSysRoute = topic.relatedSystems
            .map(s => SYSTEM_ROUTES[s])
            .find(Boolean);
        if (firstSysRoute) {
            steps.push({ icon: "🖥️", title: "View Related Systems", desc: "Explore the applications that support this business area.", href: firstSysRoute });
        }

        const firstProcRoute = topic.relatedProcesses
            .map(p => PROCESS_ROUTES[p])
            .find(Boolean);
        if (firstProcRoute) {
            steps.push({ icon: "🔄", title: "View Related Process", desc: "See how this topic fits into the broader workflow.", href: firstProcRoute });
        }

        const firstPerfRoute = topic.relatedPerformanceAreas
            .map(p => PERF_ROUTES[p])
            .find(Boolean);
        if (firstPerfRoute) {
            steps.push({ icon: "📈", title: "View Performance Area", desc: "Track performance metrics and KPIs for this area.", href: firstPerfRoute });
        }

        return steps;
    }, [topic]);

    if (!topic || !style) {
        return (
            <div className="td-page">
                <div className="td-not-found">
                    <h1>Topic Not Found</h1>
                    <p>The business topic you are looking for does not exist.</p>
                    <Link to="/topics" className="td-back-link">&larr; All Topics</Link>
                </div>
            </div>
        );
    }

    return (
        <div className="td-page">
            <div className="td-top-bar">
                <Link to="/topics" className="td-back-link">&larr; All Topics</Link>
                {nav && (
                    <div className="td-nav-arrows">
                        {nav.prev && <Link to={`/topics/${nav.prev.slug}`} className="td-nav-arrow">&larr; {nav.prev.name}</Link>}
                        {nav.next && <Link to={`/topics/${nav.next.slug}`} className="td-nav-arrow">{nav.next.name} &rarr;</Link>}
                    </div>
                )}
            </div>

            <header className="td-header" style={{ background: `linear-gradient(135deg, ${style.bg} 0%, #fff 80%)` }}>
                <div className="td-header-row">
                    <div className="td-header-icon" style={{ background: style.bg, color: style.color }}>{style.icon}</div>
                    <div className="td-header-info">
                        <div className="td-header-top">
                            <h1 className="td-name">{topic.name}</h1>
                            <span className="td-group" style={{ background: style.bg, color: style.color }}>{topic.group}</span>
                        </div>
                        <p className="td-description">{topic.description}</p>
                    </div>
                </div>
            </header>

            {nextSteps.length > 0 && (
                <section className="td-section td-section-steps">
                    <h2 className="td-section-title">Recommended Next Steps</h2>
                    <div className="td-steps-grid">
                        {nextSteps.map(step => (
                            <Link key={step.title} to={step.href} className="td-step-card" style={{ borderColor: style.bg }}>
                                <span className="td-step-icon" style={{ background: style.bg }}>{step.icon}</span>
                                <div className="td-step-info">
                                    <span className="td-step-title">{step.title}</span>
                                    <span className="td-step-desc">{step.desc}</span>
                                </div>
                                <span className="td-step-arrow" style={{ color: style.color }}>&rarr;</span>
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            <div className="td-grid">
                <div className="td-card td-card-why" style={{ borderLeftColor: style.color }}>
                    <h2 className="td-card-title" style={{ color: style.color }}>Why It Matters</h2>
                    <p className="td-card-text">{topic.whyItMatters}</p>
                </div>

                <div className="td-card">
                    <h2 className="td-card-title">Related Systems</h2>
                    {topic.relatedSystems.length > 0 ? (
                        <div className="td-chip-list">
                            {topic.relatedSystems.map(sys => {
                                const route = SYSTEM_ROUTES[sys];
                                return route ? (
                                    <Link key={sys} to={route} className="td-chip td-chip-sys td-chip-link">{sys}</Link>
                                ) : (
                                    <span key={sys} className="td-chip td-chip-sys">{sys}</span>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="td-empty">None identified</p>
                    )}
                </div>

                <div className="td-card">
                    <h2 className="td-card-title">Related Processes</h2>
                    {topic.relatedProcesses.length > 0 ? (
                        <div className="td-chip-list">
                            {topic.relatedProcesses.map(proc => {
                                const route = PROCESS_ROUTES[proc];
                                return route ? (
                                    <Link key={proc} to={route} className="td-chip td-chip-proc td-chip-link">{proc}</Link>
                                ) : (
                                    <span key={proc} className="td-chip td-chip-proc">{proc}</span>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="td-empty">None identified</p>
                    )}
                </div>

                <div className="td-card">
                    <h2 className="td-card-title">Performance Areas</h2>
                    {topic.relatedPerformanceAreas.length > 0 ? (
                        <div className="td-chip-list">
                            {topic.relatedPerformanceAreas.map(pa => {
                                const route = PERF_ROUTES[pa];
                                return route ? (
                                    <Link key={pa} to={route} className="td-chip td-chip-perf td-chip-link">{pa}</Link>
                                ) : (
                                    <span key={pa} className="td-chip td-chip-perf">{pa}</span>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="td-empty">None identified</p>
                    )}
                </div>

                <div className="td-card">
                    <h2 className="td-card-title">Key Metrics</h2>
                    {topic.relatedMetrics.length > 0 ? (
                        <ul className="td-metric-list">
                            {topic.relatedMetrics.map(m => (
                                <li key={m}>{m}</li>
                            ))}
                        </ul>
                    ) : (
                        <p className="td-empty">None identified</p>
                    )}
                </div>

                {topic.reportingLinks && topic.reportingLinks.length > 0 && (
                    <div className="td-card td-card-full">
                        <h2 className="td-card-title">Reporting & Dashboards</h2>
                        <div className="td-reporting-list">
                            {topic.reportingLinks.map((rl, i) => (
                                <div key={i} className="td-reporting-item">
                                    <div className="td-reporting-info">
                                        <span className="td-reporting-label">{rl.label}</span>
                                        <span className="td-reporting-desc">{rl.description}</span>
                                    </div>
                                    <div className="td-reporting-right">
                                        {rl.href ? (
                                            <Link to={rl.href} className="td-reporting-link">View &rarr;</Link>
                                        ) : (
                                            <span className={`td-reporting-status td-reporting-status--${(rl.status || "Unknown").toLowerCase()}`}>
                                                {rl.status || "Unknown"}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="td-card td-card-full">
                    <h2 className="td-card-title">Common Questions</h2>
                    <div className="td-qa-list">
                        {topic.commonQuestions.map((qa, i) => (
                            <details key={i} className="td-qa-item" style={{ borderColor: style.bg }}>
                                <summary className="td-qa-q" style={{ background: style.bg }}>{qa.question}</summary>
                                <p className="td-qa-a">{qa.answer}</p>
                            </details>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

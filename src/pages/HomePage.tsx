import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { BUSINESS_TOPICS, TOPIC_STYLES } from "../data/topics";
import "./HomePage.css";

const POPULAR_SLUGS = [
    "census", "occupancy", "staffing", "revenue-cycle",
];

const OPS_ITEMS = [
    { icon: "🖥️", title: "Systems", desc: "Browse all applications and their capabilities", link: "/applications", cta: "View Systems" },
    { icon: "🔄", title: "Processes", desc: "Explore business processes and workflows", link: "/processes", cta: "View Processes" },
    { icon: "🔗", title: "Integrations", desc: "View system connections and data flow", link: "/integrations", cta: "View Integrations" },
    { icon: "🏢", title: "Departments & Capabilities", desc: "Understand system coverage by department", link: "/department-view", cta: "View Coverage" },
];

const PERF_ITEMS = [
    { icon: "📈", title: "Sales & Occupancy", desc: "Lead-to-move-in funnel and occupancy rates", link: "/performance", cta: "View Performance" },
    { icon: "🏥", title: "Resident Care", desc: "Care quality, clinical compliance, wellness", link: "/performance", cta: "View Performance" },
    { icon: "👥", title: "Workforce", desc: "Staffing, retention, training, labor costs", link: "/performance", cta: "View Performance" },
    { icon: "💳", title: "Financial Performance", desc: "Revenue, billing, budget, AP", link: "/performance", cta: "View Performance" },
    { icon: "🔧", title: "Maintenance & Compliance", desc: "Work orders, PM, safety, regulatory", link: "/performance/maintenance-compliance", cta: "View Performance" },
];

export default function HomePage() {
    const navigate = useNavigate();
    const [search, setSearch] = useState("");
    const [operatesOpen, setOperatesOpen] = useState(false);
    const [performsOpen, setPerformsOpen] = useState(false);

    const popular = BUSINESS_TOPICS.filter(t => POPULAR_SLUGS.includes(t.slug));

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (search.trim()) {
            navigate(`/topics?search=${encodeURIComponent(search.trim())}`);
        }
    };

    const toggleOperates = () => setOperatesOpen(prev => !prev);
    const togglePerforms = () => setPerformsOpen(prev => !prev);

    return (
        <div className="home-page">
            <section className="hp-hero">
                <div className="hp-hero-bg" />
                <div className="hp-hero-content">
                    <h1 className="hp-hero-title">Welcome to IntegraSource</h1>
                    <p className="hp-hero-subtitle">
                        Understand how the business operates and performs.
                    </p>
                    <form className="hp-search" onSubmit={handleSearch}>
                        <span className="hp-search-icon">🔍</span>
                        <input
                            type="text"
                            className="hp-search-input"
                            placeholder="Search business topics, systems, or processes..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                        <button type="submit" className="hp-search-btn">Search</button>
                    </form>
                    <p className="hp-search-hints">
                        Try searching:{" "}
                        <Link to="/topics?search=census">census</Link>
                        <span className="hp-hint-sep">, </span>
                        <Link to="/topics?search=occupancy">occupancy</Link>
                        <span className="hp-hint-sep">, </span>
                        <Link to="/topics?search=move-ins">move-ins</Link>
                        <span className="hp-hint-sep">, </span>
                        <Link to="/topics?search=ECP">ECP</Link>
                        <span className="hp-hint-sep">, </span>
                        <Link to="/topics?search=maintenance">maintenance</Link>
                        <span className="hp-hint-sep">, </span>
                        <Link to="/topics?search=payroll">payroll</Link>
                    </p>
                </div>
            </section>

            <section className="hp-section">
                <div className="hp-section-hdr">
                    <div>
                        <h2 className="hp-section-title">Popular Business Topics</h2>
                        <p className="hp-section-desc">
                            Start with the topics that matter most to your role.
                        </p>
                    </div>
                    <Link to="/topics" className="hp-section-link">View all topics &rarr;</Link>
                </div>
                <div className="hp-topic-grid">
                    {popular.map(topic => {
                        const style = TOPIC_STYLES[topic.slug] || { icon: "📄", color: "#6366f1", bg: "#f5f3ff" };
                        return (
                            <Link key={topic.slug} to={`/topics/${topic.slug}`} className="hp-topic-card" style={{ borderColor: style.color }}>
                                <div className="hp-topic-icon" style={{ background: style.bg, color: style.color }}>{style.icon}</div>
                                <span className="hp-topic-name">{topic.name}</span>
                                <span className="hp-topic-desc">{topic.description}</span>
                                <span className="hp-topic-link">Explore &rarr;</span>
                            </Link>
                        );
                    })}
                </div>
            </section>

            <div className="hp-pillar-cue">
                <h2 className="hp-pillar-cue-title">Explore IntegraSource by business pillar</h2>
                <p className="hp-pillar-cue-desc">
                    Start with how the business operates, or jump into how it performs.
                </p>
            </div>

            <div className="hp-pillars">
                {/* How the Business Operates */}
                <div className={`hp-pillar ${operatesOpen ? "hp-pillar--open" : ""}`}>
                    <button
                        className="hp-pillar-header"
                        onClick={toggleOperates}
                        aria-expanded={operatesOpen}
                        aria-label={operatesOpen ? "Collapse How the Business Operates" : "Expand How the Business Operates"}
                    >
                        <div className="hp-pillar-header-text">
                            <span className="hp-pillar-header-icon">🖥️</span>
                            <div>
                                <span className="hp-pillar-header-title">How the Business Operates</span>
                                <span className="hp-pillar-header-sub">Explore systems, processes, integrations, and coverage.</span>
                            </div>
                        </div>
                        <div className="hp-pillar-header-right">
                            <div className="hp-pillar-chips">
                                <span className="hp-pillar-chip">{OPS_ITEMS.length} pathways</span>
                                <span className="hp-pillar-chip">25 systems</span>
                                <span className="hp-pillar-chip">10 integrations</span>
                            </div>
                            <span className="hp-pillar-chevron-btn" aria-hidden="true">
                                {operatesOpen ? "▲" : "▼"}
                            </span>
                        </div>
                    </button>
                    <div className="hp-pillar-body">
                        <div className="hp-pillar-grid">
                            {OPS_ITEMS.map(item => (
                                <Link key={item.title} to={item.link} className="hp-pillar-card">
                                    <span className="hp-pillar-card-icon">{item.icon}</span>
                                    <div className="hp-pillar-card-info">
                                        <span className="hp-pillar-card-title">{item.title}</span>
                                        <span className="hp-pillar-card-desc">{item.desc}</span>
                                    </div>
                                    <span className="hp-pillar-card-link">{item.cta} &rarr;</span>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>

                {/* How the Business Performs */}
                <div className={`hp-pillar ${performsOpen ? "hp-pillar--open" : ""}`}>
                    <button
                        className="hp-pillar-header"
                        onClick={togglePerforms}
                        aria-expanded={performsOpen}
                        aria-label={performsOpen ? "Collapse How the Business Performs" : "Expand How the Business Performs"}
                    >
                        <div className="hp-pillar-header-text">
                            <span className="hp-pillar-header-icon">📈</span>
                            <div>
                                <span className="hp-pillar-header-title">How the Business Performs</span>
                                <span className="hp-pillar-header-sub">Monitor operational performance across key business areas.</span>
                            </div>
                        </div>
                        <div className="hp-pillar-header-right">
                            <div className="hp-pillar-chips">
                                <span className="hp-pillar-chip">{PERF_ITEMS.length} areas</span>
                                <span className="hp-pillar-chip">TELS active</span>
                                <span className="hp-pillar-chip">More coming</span>
                            </div>
                            <span className="hp-pillar-chevron-btn" aria-hidden="true">
                                {performsOpen ? "▲" : "▼"}
                            </span>
                        </div>
                    </button>
                    <div className="hp-pillar-body">
                        <div className="hp-pillar-grid">
                            {PERF_ITEMS.map(item => (
                                <Link key={item.title} to={item.link} className="hp-pillar-card">
                                    <span className="hp-pillar-card-icon">{item.icon}</span>
                                    <div className="hp-pillar-card-info">
                                        <span className="hp-pillar-card-title">{item.title}</span>
                                        <span className="hp-pillar-card-desc">{item.desc}</span>
                                    </div>
                                    <span className="hp-pillar-card-link">{item.cta} &rarr;</span>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

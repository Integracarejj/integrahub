import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { BUSINESS_TOPICS, TOPIC_STYLES } from "../data/topics";
import "./HomePage.css";

const POPULAR_SLUGS = [
    "census", "occupancy", "move-ins", "resident-care", "maintenance",
    "compliance", "staffing", "revenue-cycle",
];

const PERF_AREAS = [
    { label: "Sales & Occupancy", icon: "📈", route: "/performance", desc: "Lead-to-move-in funnel and occupancy rates" },
    { label: "Resident Care", icon: "🏥", route: "/performance", desc: "Care quality, clinical compliance, wellness" },
    { label: "Workforce", icon: "👥", route: "/performance", desc: "Staffing, retention, training, labor costs" },
    { label: "Financial Performance", icon: "💳", route: "/performance", desc: "Revenue, billing, budget, AP" },
    { label: "Maintenance & Compliance", icon: "🔧", route: "/performance/maintenance-compliance", desc: "Work orders, PM, safety, regulatory" },
];

const OPS_CARDS = [
    { title: "Systems", icon: "🖥️", desc: "Browse all applications and their capabilities", link: "/applications", cta: "View Systems" },
    { title: "Processes", icon: "🔄", desc: "Explore business processes and workflows", link: "/processes", cta: "View Processes" },
    { title: "Integrations", icon: "🔗", desc: "View system connections and data flow", link: "/integrations", cta: "View Integrations" },
    { title: "Departments & Capabilities", icon: "🏢", desc: "Understand system coverage by department", link: "/capability-view", cta: "View Coverage" },
];

export default function HomePage() {
    const navigate = useNavigate();
    const [search, setSearch] = useState("");

    const popular = BUSINESS_TOPICS.filter(t => POPULAR_SLUGS.includes(t.slug));

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (search.trim()) {
            navigate(`/topics?search=${encodeURIComponent(search.trim())}`);
        }
    };

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

            <section className="hp-section hp-section-panel">
                <h2 className="hp-section-title">How the Business Operates</h2>
                <p className="hp-section-desc">
                    Explore the systems, processes, and structure that keep the organization running.
                </p>
                <div className="hp-ops-grid">
                    {OPS_CARDS.map(card => (
                        <Link key={card.title} to={card.link} className="hp-ops-card">
                            <span className="hp-ops-card-icon">{card.icon}</span>
                            <h3 className="hp-ops-card-title">{card.title}</h3>
                            <p className="hp-ops-card-desc">{card.desc}</p>
                            <span className="hp-ops-card-link">{card.cta} &rarr;</span>
                        </Link>
                    ))}
                </div>
            </section>

            <section className="hp-section hp-section-panel">
                <h2 className="hp-section-title">How the Business Performs</h2>
                <p className="hp-section-desc">
                    Monitor performance across key operational areas.
                </p>
                <div className="hp-perf-grid">
                    {PERF_AREAS.map(pa => (
                        <Link key={pa.label} to={pa.route} className="hp-perf-card">
                            <span className="hp-perf-icon">{pa.icon}</span>
                            <span className="hp-perf-label">{pa.label}</span>
                            <span className="hp-perf-desc">{pa.desc}</span>
                            <span className="hp-perf-link">View Performance &rarr;</span>
                        </Link>
                    ))}
                </div>
            </section>
        </div>
    );
}

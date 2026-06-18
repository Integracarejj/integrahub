import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { BUSINESS_TOPICS } from "../data/topics";
import "./HomePage.css";

const POPULAR_SLUGS = [
    "census", "occupancy", "move-ins", "resident-care", "maintenance",
    "compliance", "staffing", "revenue-cycle", "lead-generation", "conversion",
];

const PERF_AREAS = [
    { label: "Sales & Occupancy", icon: "📈", route: "/performance" },
    { label: "Resident Care", icon: "🏥", route: "/performance" },
    { label: "Workforce", icon: "👥", route: "/performance" },
    { label: "Financial Performance", icon: "💰", route: "/performance" },
    { label: "Maintenance & Compliance", icon: "🔧", route: "/performance/maintenance-compliance" },
];

const OPS_CARDS = [
    { title: "Systems", desc: "Browse all applications and their capabilities", link: "/applications", color: "#2563eb" },
    { title: "Processes", desc: "Explore business processes and workflows", link: "/processes", color: "#7c3aed" },
    { title: "Integrations", desc: "View system connections and data flow", link: "/integrations", color: "#059669" },
    { title: "Departments & Capabilities", desc: "Understand system coverage by department", link: "/capability-view", color: "#d97706" },
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
                <h1 className="hp-hero-title">IntegraSource</h1>
                <p className="hp-hero-subtitle">
                    Operational Intelligence Portal
                </p>
                <form className="hp-search" onSubmit={handleSearch}>
                    <input
                        type="text"
                        className="hp-search-input"
                        placeholder="Search business topics, systems, or processes..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </form>
            </section>

            <section className="hp-section">
                <h2 className="hp-section-title">Popular Business Topics</h2>
                <p className="hp-section-desc">
                    Start with the topics that matter most to your role.
                </p>
                <div className="hp-topic-grid">
                    {popular.map(topic => (
                        <Link key={topic.slug} to={`/topics/${topic.slug}`} className="hp-topic-card">
                            <span className="hp-topic-name">{topic.name}</span>
                            <span className="hp-topic-desc">{topic.description}</span>
                            <span className="hp-topic-link">Explore &rarr;</span>
                        </Link>
                    ))}
                </div>
            </section>

            <section className="hp-section">
                <h2 className="hp-section-title">How the Business Operates</h2>
                <p className="hp-section-desc">
                    Explore the systems, processes, and structure that keep the organization running.
                </p>
                <div className="hp-ops-grid">
                    {OPS_CARDS.map(card => (
                        <Link key={card.title} to={card.link} className="hp-ops-card" style={{ borderTopColor: card.color }}>
                            <h3 className="hp-ops-card-title">{card.title}</h3>
                            <p className="hp-ops-card-desc">{card.desc}</p>
                            <span className="hp-ops-card-link">View &rarr;</span>
                        </Link>
                    ))}
                </div>
            </section>

            <section className="hp-section">
                <h2 className="hp-section-title">How the Business Performs</h2>
                <p className="hp-section-desc">
                    Monitor performance across key operational areas.
                </p>
                <div className="hp-perf-grid">
                    {PERF_AREAS.map(pa => (
                        <Link key={pa.label} to={pa.route} className="hp-perf-card">
                            <span className="hp-perf-icon">{pa.icon}</span>
                            <span className="hp-perf-label">{pa.label}</span>
                            <span className="hp-perf-link">View Performance &rarr;</span>
                        </Link>
                    ))}
                </div>
            </section>
        </div>
    );
}

import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BUSINESS_TOPICS, searchTopics, TOPIC_STYLES } from "../../data/topics";
import "./TopicsPage.css";

const GROUP_ORDER = ["Operations", "Workforce", "Finance", "Sales"];

const GROUP_ACCENTS: Record<string, { color: string; bg: string }> = {
    Operations: { color: "#2563eb", bg: "#eff6ff" },
    Workforce: { color: "#0d9488", bg: "#f0fdfa" },
    Finance: { color: "#ea580c", bg: "#fff7ed" },
    Sales: { color: "#7c3aed", bg: "#f5f3ff" },
};

export default function TopicsPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const query = searchParams.get("search") || "";
    const [localSearch, setLocalSearch] = useState(query);

    const filtered = useMemo(() => {
        if (!query) return null;
        return searchTopics(query);
    }, [query]);

    const grouped = useMemo(() => {
        const source = filtered ?? BUSINESS_TOPICS;
        const map = new Map<string, typeof source>();
        for (const topic of source) {
            const group = topic.group;
            if (!map.has(group)) map.set(group, []);
            map.get(group)!.push(topic);
        }
        const ordered = GROUP_ORDER.filter(g => map.has(g));
        return ordered.map(g => ({ group: g, topics: map.get(g)! }));
    }, [filtered]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (localSearch.trim()) {
            setSearchParams({ search: localSearch.trim() });
        } else {
            setSearchParams({});
        }
    };

    return (
        <div className="topics-page">
            <section className="tp-hero">
                <h1 className="tp-hero-title">Business Topics</h1>
                <p className="tp-hero-desc">
                    Operational topics mapped to systems, processes, and performance metrics.
                </p>
                <form className="tp-search" onSubmit={handleSubmit}>
                    <span className="tp-search-icon">🔍</span>
                    <input
                        type="text"
                        className="tp-search-input"
                        placeholder="Filter topics..."
                        value={localSearch}
                        onChange={e => setLocalSearch(e.target.value)}
                    />
                    <button type="submit" className="tp-search-btn">Search</button>
                </form>
            </section>

            {!query && (
                <nav className="tp-jump">
                    {grouped.map(({ group, topics }) => (
                        <a key={group} href={`#${group.toLowerCase()}`} className="tp-jump-item">
                            {group}
                        </a>
                    ))}
                </nav>
            )}

            {query && (
                <div className="tp-search-status">
                    {filtered && filtered.length > 0 ? (
                        <span>Showing {filtered.length} result{filtered.length !== 1 ? "s" : ""} for "<strong>{query}</strong>"</span>
                    ) : (
                        <span>No results found for "<strong>{query}</strong>"</span>
                    )}
                </div>
            )}

            {grouped.map(({ group, topics }) => {
                const accent = GROUP_ACCENTS[group] || { color: "#6366f1", bg: "#f5f3ff" };
                return (
                    <section key={group} id={group.toLowerCase()} className="tp-group">
                        <h2 className="tp-group-title" style={{ color: accent.color, borderBottomColor: accent.bg }}>
                            {group} <span className="tp-group-count">{topics.length} topic{topics.length !== 1 ? "s" : ""}</span>
                        </h2>
                        <div className="tp-grid">
                            {topics.map(topic => {
                                const style = TOPIC_STYLES[topic.slug] || { icon: "📄", color: "#6366f1", bg: "#f5f3ff" };
                                return (
                                    <Link key={topic.slug} to={`/topics/${topic.slug}`} className="tp-card" style={{ borderColor: style.color }}>
                                        <div className="tp-card-top">
                                            <div className="tp-card-icon" style={{ background: style.bg, color: style.color }}>{style.icon}</div>
                                            <div className="tp-card-meta">
                                                {topic.relatedSystems.length > 0 && (
                                                    <span className="tp-card-stat">{topic.relatedSystems.length} system{topic.relatedSystems.length !== 1 ? "s" : ""}</span>
                                                )}
                                                {topic.relatedProcesses.length > 0 && (
                                                    <span className="tp-card-stat">{topic.relatedProcesses.length} process{topic.relatedProcesses.length !== 1 ? "es" : ""}</span>
                                                )}
                                            </div>
                                        </div>
                                        <h3 className="tp-card-name">{topic.name}</h3>
                                        <p className="tp-card-desc">{topic.description}</p>
                                        <span className="tp-card-link">View Topic &rarr;</span>
                                    </Link>
                                );
                            })}
                        </div>
                    </section>
                );
            })}

            <div className="tp-back-top">
                <a href="#top" className="tp-back-top-link">Back to top &uarr;</a>
            </div>
        </div>
    );
}

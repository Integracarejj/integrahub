import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BUSINESS_TOPICS, searchTopics } from "../../data/topics";
import "./TopicsPage.css";

const GROUP_ORDER = ["Operations", "Workforce", "Finance", "Sales"];

export default function TopicsPage() {
    const [searchParams] = useSearchParams();
    const query = searchParams.get("search") || "";

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

    return (
        <div className="topics-page">
            <div className="topics-hdr">
                <h1 className="topics-title">Business Topics</h1>
                <p className="topics-subtitle">
                    Operational topics mapped to systems, processes, and performance metrics.
                </p>
            </div>

            {query && (
                <div className="topics-search-status">
                    {filtered && filtered.length > 0 ? (
                        <span>Showing {filtered.length} result{filtered.length !== 1 ? "s" : ""} for "<strong>{query}</strong>"</span>
                    ) : (
                        <span>No results found for "<strong>{query}</strong>"</span>
                    )}
                </div>
            )}

            {grouped.map(({ group, topics }) => (
                <section key={group} className="topics-group">
                    <h2 className="topics-group-title">{group}</h2>
                    <div className="topics-grid">
                        {topics.map(topic => (
                            <Link key={topic.slug} to={`/topics/${topic.slug}`} className="topics-card">
                                <h3 className="topics-card-name">{topic.name}</h3>
                                <p className="topics-card-desc">{topic.description}</p>
                                <div className="topics-card-meta">
                                    {topic.relatedSystems.length > 0 && (
                                        <span className="topics-card-stat">{topic.relatedSystems.length} system{topic.relatedSystems.length !== 1 ? "s" : ""}</span>
                                    )}
                                    {topic.relatedProcesses.length > 0 && (
                                        <span className="topics-card-stat">{topic.relatedProcesses.length} process{topic.relatedProcesses.length !== 1 ? "es" : ""}</span>
                                    )}
                                    {topic.relatedMetrics.length > 0 && (
                                        <span className="topics-card-stat">{topic.relatedMetrics.length} metric{topic.relatedMetrics.length !== 1 ? "s" : ""}</span>
                                    )}
                                </div>
                                <span className="topics-card-link">View Topic &rarr;</span>
                            </Link>
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
}

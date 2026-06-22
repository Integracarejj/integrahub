import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { BUSINESS_TOPICS, getTopicBySlug, TOPIC_STYLES } from "../../data/topics";
import "./TopicDetailPage.css";

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

            <div className="td-grid">
                <div className="td-card td-card-why" style={{ borderLeftColor: style.color }}>
                    <h2 className="td-card-title" style={{ color: style.color }}>Why It Matters</h2>
                    <p className="td-card-text">{topic.whyItMatters}</p>
                </div>

                <div className="td-card">
                    <h2 className="td-card-title">Related Systems</h2>
                    {topic.relatedSystems.length > 0 ? (
                        <div className="td-chip-list">
                            {topic.relatedSystems.map(sys => (
                                <span key={sys} className="td-chip td-chip-sys">{sys}</span>
                            ))}
                        </div>
                    ) : (
                        <p className="td-empty">None identified</p>
                    )}
                </div>

                <div className="td-card">
                    <h2 className="td-card-title">Related Processes</h2>
                    {topic.relatedProcesses.length > 0 ? (
                        <div className="td-chip-list">
                            {topic.relatedProcesses.map(proc => (
                                <span key={proc} className="td-chip td-chip-proc">{proc}</span>
                            ))}
                        </div>
                    ) : (
                        <p className="td-empty">None identified</p>
                    )}
                </div>

                <div className="td-card">
                    <h2 className="td-card-title">Performance Areas</h2>
                    {topic.relatedPerformanceAreas.length > 0 ? (
                        <div className="td-chip-list">
                            {topic.relatedPerformanceAreas.map(pa => (
                                <span key={pa} className="td-chip td-chip-perf">{pa}</span>
                            ))}
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

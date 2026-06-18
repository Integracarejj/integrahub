import { useParams, Link } from "react-router-dom";
import { getTopicBySlug } from "../../data/topics";
import "./TopicDetailPage.css";

export default function TopicDetailPage() {
    const { topicSlug } = useParams<{ topicSlug: string }>();
    const topic = topicSlug ? getTopicBySlug(topicSlug) : undefined;

    if (!topic) {
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
            </div>

            <header className="td-header">
                <div className="td-header-top">
                    <div>
                        <h1 className="td-name">{topic.name}</h1>
                        <span className="td-group">{topic.group}</span>
                    </div>
                </div>
                <p className="td-description">{topic.description}</p>
            </header>

            <div className="td-grid">
                <div className="td-card td-card-full">
                    <h2 className="td-card-title">Why It Matters</h2>
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
                            <details key={i} className="td-qa-item">
                                <summary className="td-qa-q">{qa.question}</summary>
                                <p className="td-qa-a">{qa.answer}</p>
                            </details>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

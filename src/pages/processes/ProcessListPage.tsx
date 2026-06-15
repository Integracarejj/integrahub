import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getBusinessProcesses } from "../../services/businessProcessService";
import type { BusinessProcess } from "../../types/businessProcess";
import "./ProcessListPage.css";

export default function ProcessListPage() {
    const [processes, setProcesses] = useState<BusinessProcess[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        getBusinessProcesses()
            .then(data => {
                setProcesses(data);
                setLoading(false);
            })
            .catch(() => {
                setError("Failed to load business processes.");
                setLoading(false);
            });
    }, []);

    if (loading) {
        return (
            <div className="process-list-page">
                <p className="process-list-loading">Loading processes…</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="process-list-page">
                <p className="process-list-error">{error}</p>
            </div>
        );
    }

    return (
        <div className="process-list-page">
            <header className="process-list-header">
                <h1>Processes</h1>
                <p className="process-list-subtitle">
                    Business processes show how systems work together to support key workflows.
                </p>
            </header>

            {processes.length === 0 ? (
                <div className="process-list-empty">
                    <h2>No business processes yet</h2>
                    <p>Business processes show how systems work together to support key workflows like Prospect to Resident or Employee Lifecycle.</p>
                </div>
            ) : (
                <div className="process-grid">
                    {processes.map(p => (
                        <Link key={p.id} to={`/processes/${p.id}`} className="process-card">
                            <div className="process-card-body">
                                <h2 className="process-card-name">{p.processName}</h2>
                                {p.processCategory && (
                                    <span className="process-card-category">{p.processCategory}</span>
                                )}
                                {p.description && (
                                    <p className="process-card-desc">{p.description}</p>
                                )}
                            </div>
                            <div className="process-card-footer">
                                <span className="process-card-link">View Process</span>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}

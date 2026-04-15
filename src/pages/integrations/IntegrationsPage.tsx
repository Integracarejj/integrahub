import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getIntegrationViews } from "../../services/integrationService";
import type { IntegrationView } from "../../types/integration";
import "./IntegrationsPage.css";

export default function IntegrationsPage() {
    const [rows, setRows] = useState<IntegrationView[]>([]);
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        (async () => {
            try {
                const data = await getIntegrationViews();
                if (mounted) setRows(data);
            } finally {
                if (mounted) setLoading(false);
            }
        })();

        return () => {
            mounted = false;
        };
    }, []);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();

        return rows.filter((r) => {
            if (!q) return true;

            return (
                r.fromApplicationName.toLowerCase().includes(q) ||
                r.toApplicationName.toLowerCase().includes(q) ||
                r.integrationType?.toLowerCase().includes(q) ||
                (r.description ?? "").toLowerCase().includes(q)
            );
        });
    }, [rows, query]);

    return (
        <div className="integrations-page">
            <header className="integrations-header">
                <div>
                    <h1>Integrations</h1>
                    <p className="subtitle">
                        Directional relationships between applications (read‑only)
                    </p>
                </div>

                <div className="controls">
                    <input
                        type="text"
                        placeholder="Search integrations…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                </div>
            </header>

            {loading ? (
                <p>Loading…</p>
            ) : filtered.length === 0 ? (
                <p className="empty">No integrations found.</p>
            ) : (
                <table className="integrations-table">
                    <thead>
                        <tr>
                            <th>From</th>
                            <th />
                            <th>To</th>
                            <th>Type</th>
                            <th>Notes</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((r) => (
                            <tr key={r.id}>
                                <td>
                                    <Link to={`/applications/${r.fromApplicationId}`}>
                                        {r.fromApplicationName}
                                    </Link>
                                </td>
                                <td className="arrow">→</td>
                                <td>
                                    <Link to={`/applications/${r.toApplicationId}`}>
                                        {r.toApplicationName}
                                    </Link>
                                </td>
                                <td>{r.integrationType || "—"}</td>
                                <td>{r.description || "—"}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}
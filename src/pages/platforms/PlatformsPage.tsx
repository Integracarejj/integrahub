// src/pages/platforms/PlatformsPage.tsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getApplications } from "../../services/applicationService";
import type { Application } from "../../types/application";
import "./PlatformsPage.css";

export default function PlatformsPage() {
    const [apps, setApps] = useState<Application[]>([]);
    const [query, setQuery] = useState("");
    const [showInactive, setShowInactive] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        (async () => {
            try {
                const data = await getApplications();
                if (mounted) setApps(data);
            } finally {
                if (mounted) setLoading(false);
            }
        })();

        return () => {
            mounted = false;
        };
    }, []);

    const platforms = useMemo(() => {
        const q = query.trim().toLowerCase();

        return apps.filter((app) => {
            if (app.type !== "Platform") return false;
            if (!showInactive && app.status !== "Active") return false;
            if (!q) return true;

            return (
                app.name.toLowerCase().includes(q) ||
                app.owner.toLowerCase().includes(q) ||
                (app.description ?? "").toLowerCase().includes(q)
            );
        });
    }, [apps, query, showInactive]);

    return (
        <div className="platforms-page">
            <header className="platforms-header">
                <div>
                    <h1>Platforms</h1>
                    <p className="subtitle">
                        Shared technical platforms that support multiple applications.
                    </p>
                </div>

                <div className="controls">
                    <input
                        type="text"
                        placeholder="Search platforms…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />

                    <label className="toggle">
                        <input
                            type="checkbox"
                            checked={showInactive}
                            onChange={(e) => setShowInactive(e.target.checked)}
                        />
                        Show inactive
                    </label>
                </div>
            </header>

            {loading ? (
                <p>Loading…</p>
            ) : platforms.length === 0 ? (
                <p className="empty">No platforms found.</p>
            ) : (
                <table className="platforms-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Owner</th>
                            <th>Status</th>
                            <th>Description</th>
                        </tr>
                    </thead>
                    <tbody>
                        {platforms.map((app) => (
                            <tr
                                key={app.id}
                                className={app.status !== "Active" ? "inactive" : ""}
                            >
                                <td>
                                    <Link to={`/applications/${app.id}`}>{app.name}</Link>
                                </td>
                                <td>{app.owner}</td>
                                <td>{app.status}</td>
                                <td>{app.description ?? "—"}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}

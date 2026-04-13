import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./HomePage.css";

interface ApiApplication {
    id: string;
    name: string;
    status: string;
    businessContext: {
        businessCriticality?: string;
    };
}

interface Capability {
    id: string;
    name: string;
}

export default function HomePage() {
    const navigate = useNavigate();
    const [applications, setApplications] = useState<ApiApplication[]>([]);
    const [capabilities, setCapabilities] = useState<Capability[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    useEffect(() => {
        Promise.all([
            fetch("/api/applications").then((res) => res.ok ? res.json() : []),
            fetch("/api/capabilities").then((res) => res.ok ? res.json() : []),
        ])
            .then(([apps, caps]) => {
                setApplications(apps);
                setCapabilities(caps);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    const stats = useMemo(() => {
        const total = applications.length;
        const critical = applications.filter(
            (app) => (app as { businessContext?: { businessCriticality?: string } }).businessContext?.businessCriticality === "Critical"
        ).length;
        const planned = applications.filter(
            (app) => app.status === "Planned"
        ).length;
        return { total, critical, planned, capabilities: capabilities.length };
    }, [applications, capabilities]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (search.trim()) {
            navigate(`/applications?search=${encodeURIComponent(search.trim())}`);
        }
    };

    const handleCapabilityClick = (capabilityId: string) => {
        navigate(`/applications?capability=${encodeURIComponent(capabilityId)}`);
    };

    if (loading) {
        return <div className="home-page">Loading...</div>;
    }

    return (
        <div className="home-page">
            <section className="home-search">
                <form onSubmit={handleSearch}>
                    <input
                        type="text"
                        className="home-search-input"
                        placeholder="Search systems, capabilities, or keywords..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </form>
            </section>

            <section className="home-stats">
                <Link to="/applications" className="stat-card stat-blue">
                    <span className="stat-value">{stats.total}</span>
                    <span className="stat-label">Total Applications</span>
                </Link>
                <Link to="/applications?criticality=Critical" className="stat-card stat-green">
                    <span className="stat-value">{stats.critical}</span>
                    <span className="stat-label">Critical Applications</span>
                </Link>
                <Link to="/applications?status=Planned" className="stat-card stat-purple">
                    <span className="stat-value">{stats.planned}</span>
                    <span className="stat-label">Planned</span>
                </Link>
                <Link to="/applications" className="stat-card stat-orange">
                    <span className="stat-value">{stats.capabilities}</span>
                    <span className="stat-label">Capabilities</span>
                </Link>
            </section>

            <section className="home-capabilities">
                <h2 className="section-title">Browse by Capability</h2>
                <div className="capability-grid">
                    {capabilities.map((cap) => (
                        <button
                            key={cap.id}
                            className="capability-card"
                            onClick={() => handleCapabilityClick(cap.id)}
                        >
                            {cap.name}
                        </button>
                    ))}
                </div>
            </section>
        </div>
    );
}
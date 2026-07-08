import { useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getPortalRequests, getActivePersona, getPortalTransactions } from "../../services/portalMockData";
import "./PortalOverview.css";

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    Published: { bg: "#f0fdf4", text: "#166534", border: "#bbf7d0" },
    "In Progress": { bg: "#eff6ff", text: "#1e40af", border: "#bfdbfe" },
    "Intake Review": { bg: "#faf5ff", text: "#6b21a8", border: "#ddd6fe" },
    "Work Queue": { bg: "#fef3c7", text: "#92400e", border: "#fde68a" },
    "Quality Review": { bg: "#fffbeb", text: "#92400e", border: "#fde68a" },
    "Action Needed": { bg: "#fff7ed", text: "#9a3412", border: "#fed7aa" },
    Closed: { bg: "#f1f5f9", text: "#475569", border: "#e2e8f0" },
    "Closed / Duplicate": { bg: "#f1f5f9", text: "#475569", border: "#e2e8f0" },
    "Closed / Not Applicable": { bg: "#f1f5f9", text: "#475569", border: "#e2e8f0" },
};

function StatusBadge({ status }: { status: string }) {
    const c = STATUS_COLORS[status] || { bg: "#f8fafc", text: "#475569", border: "#e2e8f0" };
    return (
        <span className="po-status-badge" style={{ background: c.bg, color: c.text, borderColor: c.border }}>
            {status}
        </span>
    );
}

export default function PortalRequests() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const allRequests = getPortalRequests();
    const persona = getActivePersona();
    const txn = getPortalTransactions()[0];

    const statusFromUrl = searchParams.get("status") || "all";
    const [search, setSearch] = useState("");
    const [filterStatus, setFilterStatus] = useState(statusFromUrl);
    const [filterCategory, setFilterCategory] = useState("all");
    const [filterCommunity, setFilterCommunity] = useState("all");

    const filtered = useMemo(() => {
        let result = [...allRequests];
        if (search) {
            const q = search.toLowerCase();
            result = result.filter(r => r.title.toLowerCase().includes(q) || r.requestId.toLowerCase().includes(q) || r.category.toLowerCase().includes(q));
        }
        if (filterStatus !== "all") result = result.filter(r => r.status === filterStatus);
        if (filterCategory !== "all") result = result.filter(r => r.category === filterCategory);
        if (filterCommunity !== "all") result = result.filter(r => r.communityNames.includes(filterCommunity));
        return result;
    }, [allRequests, search, filterStatus, filterCategory, filterCommunity]);

    const communities = txn?.communities || [];
    const categories = [...new Set(allRequests.map(r => r.category).filter(Boolean))];

    return (
        <div className="portal-overview">
            <h1 className="po-welcome-title">Requests</h1>
            <p className="po-welcome-sub" style={{ marginBottom: 20 }}>
                {persona.role === "Owner / Seller" && "Documents requested from ABC Company for the due diligence process. Use the Upload button to provide requested materials."}
                {persona.role === "Buyer" && "All due diligence requests for the ABC Company Portfolio. Track progress and submit new requests as needed."}
                {persona.role === "Broker" && "All due diligence requests across the transaction. Filter by community or status to find what needs attention."}
            </p>

            <div className="po-filter-row">
                <div className="po-search-box">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                        type="text"
                        placeholder="Search requests..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <select className="po-filter-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                    <option value="all">All Statuses</option>
                    <option value="Intake Review">Intake Review</option>
                    <option value="Work Queue">Work Queue</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Quality Review">Quality Review</option>
                    <option value="Published">Published</option>
                    <option value="Action Needed">Action Needed</option>
                    <option value="Closed">Closed</option>
                </select>
                {categories.length > 0 && (
                    <select className="po-filter-select" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                        <option value="all">All Categories</option>
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                )}
                <select className="po-filter-select" value={filterCommunity} onChange={(e) => setFilterCommunity(e.target.value)}>
                    <option value="all">All Communities</option>
                    {communities.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
            </div>

            <div className="po-requests-table">
                <div className="po-requests-header" style={{ gridTemplateColumns: "0.6fr 1.8fr 1fr 0.9fr 0.7fr 0.7fr" }}>
                    <span>ID</span><span>Request</span><span>Status</span><span>Category</span><span>Community</span><span>Updated</span>
                </div>
                {filtered.map((req) => (
                    <div key={req.id} className="po-requests-row" style={{ gridTemplateColumns: "0.6fr 1.8fr 1fr 0.9fr 0.7fr 0.7fr" }} onClick={() => navigate(`/portal/requests/${req.id}`)}>
                        <span className="po-requests-id">{req.requestId}</span>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            <span className="po-requests-title">{req.title}</span>
                        </div>
                        <span>
                            <StatusBadge status={req.status} />
                            {req._publishedExternal && (
                                <span style={{ marginLeft: 4, fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "#dcfce7", color: "#166534", fontWeight: 600, whiteSpace: "nowrap", verticalAlign: "middle" }}>
                                    Ready to Review
                                </span>
                            )}
                        </span>
                        <span className="po-requests-txn">{req.category || "\u2014"}</span>
                        <span className="po-requests-txn">{req.communityNames[0] || "\u2014"}</span>
                        <span className="po-requests-txn">{req.updatedAt || req.neededBy || "\u2014"}</span>
                    </div>
                ))}
                {filtered.length === 0 && (
                    <div style={{ padding: "36px 24px", textAlign: "center", fontSize: 15, color: "#334155" }}>No requests match your filters.</div>
                )}
            </div>
            <div style={{ marginTop: 8, fontSize: 13, color: "#475569" }}>
                Showing {filtered.length} of {allRequests.length} requests
            </div>
        </div>
    );
}

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
    const [filterCommunity, setFilterCommunity] = useState("all");

    const filtered = useMemo(() => {
        let result = [...allRequests];
        if (search) {
            const q = search.toLowerCase();
            result = result.filter(r => r.title.toLowerCase().includes(q) || r.category.toLowerCase().includes(q));
        }
        if (filterStatus !== "all") result = result.filter(r => r.status === filterStatus);
        if (filterCommunity !== "all") result = result.filter(r => r.communityNames.includes(filterCommunity));
        return result;
    }, [allRequests, search, filterStatus, filterCommunity]);

    const communities = txn?.communities || [];

    return (
        <div className="portal-overview">
            <h1 className="po-welcome-title">Requests</h1>
            <p className="po-welcome-sub" style={{ marginBottom: 20 }}>
                {persona.role === "Owner / Seller" && "Documents requested from ABC Company for the due diligence process. Use the Upload button to provide requested materials."}
                {persona.role === "Buyer" && "All due diligence requests for the ABC Company Portfolio. Track progress and submit new requests as needed."}
                {persona.role === "Broker" && "All due diligence requests across the transaction. Filter by community or status to find what needs attention."}
            </p>

            <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, border: "1px solid #e2e8f0", borderRadius: 8, padding: "4px 10px", background: "#fff", flex: 1, minWidth: 200 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                        type="text"
                        placeholder="Search requests..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{ border: "none", outline: "none", fontSize: 13, flex: 1, padding: "4px 0", background: "transparent" }}
                    />
                </div>
                <select className="rc-filter-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ minWidth: 130 }}>
                    <option value="all">All Statuses</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Intake Review">Intake Review</option>
                    <option value="Work Queue">Work Queue</option>
                    <option value="Quality Review">Quality Review</option>
                    <option value="Action Needed">Action Needed</option>
                    <option value="Published">Published</option>
                    <option value="Closed">Closed</option>
                </select>
                <select className="rc-filter-select" value={filterCommunity} onChange={(e) => setFilterCommunity(e.target.value)} style={{ minWidth: 140 }}>
                    <option value="all">All Communities</option>
                    {communities.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
            </div>

            <div style={{ border: "1px solid var(--is-border, #e2e8f0)", borderRadius: 10, overflow: "hidden", boxShadow: "var(--is-shadow-card, 0 8px 20px rgba(15, 23, 42, 0.08))" }}>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 0.9fr 0.8fr 0.7fr 0.6fr", gap: 8, padding: "10px 14px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    <span>Request</span>
                    <span>Community</span>
                    <span>Status</span>
                    <span>Updated</span>
                    <span>Documents</span>
                    <span></span>
                </div>
                {filtered.map((req) => (
                    <div key={req.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 0.9fr 0.8fr 0.7fr 0.6fr", gap: 8, padding: "10px 14px", borderBottom: "1px solid #f1f5f9", fontSize: 13, alignItems: "center", cursor: "pointer" }} onClick={() => navigate(`/portal/requests/${req.id}`)}>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                            <span style={{ fontWeight: 600, color: "var(--is-text-heading, #0f172a)" }}>{req.title}</span>
                            <span style={{ fontSize: 10, color: "#94a3b8" }}>Request ID: {req.requestId}</span>
                        </div>
                        <span style={{ fontSize: 12, color: "var(--is-text-helper, #334155)" }}>{req.communityNames[0] || "\u2014"}</span>
                        <span>
                            <StatusBadge status={req.status} />
                            {req._publishedExternal && (
                                <span style={{ marginLeft: 4, fontSize: 9, padding: "1px 5px", borderRadius: 3, background: "#dcfce7", color: "#166534", fontWeight: 600, whiteSpace: "nowrap", verticalAlign: "middle" }}>
                                    Ready to Review
                                </span>
                            )}
                        </span>
                        <span style={{ fontSize: 12, color: "var(--is-text-helper, #334155)" }}>{req.updatedAt || req.neededBy || "\u2014"}</span>
                        <span>
                            {req._publishedExternal ? (
                                req._publishedWithoutDocuments ? (
                                    <span style={{ fontSize: 10, color: "#92400e", fontStyle: "italic" }}>No documents</span>
                                ) : (
                                    <span style={{ fontSize: 10, color: "#166534", fontWeight: 600 }}>Available</span>
                                )
                            ) : (
                                <span style={{ fontSize: 10, color: "#94a3b8" }}>{"\u2014"}</span>
                            )}
                        </span>
                        <span>
                            {req._publishedExternal ? (
                                req._publishedWithoutDocuments ? (
                                    <span style={{ fontSize: 10, color: "#166534", fontWeight: 600 }}>Review</span>
                                ) : (
                                    <span style={{ fontSize: 10, color: "#166534", fontWeight: 600 }}>View Documents</span>
                                )
                            ) : (
                                <span style={{ fontSize: 10, color: "#6366f1", fontWeight: 600 }}>View</span>
                            )}
                        </span>
                    </div>
                ))}
                {filtered.length === 0 && (
                    <div style={{ padding: "24px", textAlign: "center", fontSize: 13, color: "#64748b" }}>No requests match your filters.</div>
                )}
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: "#64748b" }}>
                Showing {filtered.length} of {allRequests.length} requests
            </div>
        </div>
    );
}

import { useState, useMemo } from "react";
import { getPortalRequests, getActivePersona, getPortalTransactions } from "../../services/portalMockData";
import "./PortalOverview.css";

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    "Provided": { bg: "#f0fdf4", text: "#166534", border: "#bbf7d0" },
    "In Progress": { bg: "#eff6ff", text: "#1e40af", border: "#bfdbfe" },
    "Clarification Needed": { bg: "#fff7ed", text: "#9a3412", border: "#fed7aa" },
    "Under Review": { bg: "#faf5ff", text: "#6b21a8", border: "#ddd6fe" },
    "Open": { bg: "#fff7ed", text: "#9a3412", border: "#fed7aa" },
    "Overdue": { bg: "#fef2f2", text: "#991b1b", border: "#fecaca" },
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
    const allRequests = getPortalRequests();
    const persona = getActivePersona();
    const txn = getPortalTransactions()[0];

    const [search, setSearch] = useState("");
    const [filterStatus, setFilterStatus] = useState("all");
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
                    <option value="Open">Open</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Clarification Needed">Clarification Needed</option>
                    <option value="Under Review">Under Review</option>
                    <option value="Provided">Provided</option>
                    <option value="Overdue">Overdue</option>
                </select>
                <select className="rc-filter-select" value={filterCommunity} onChange={(e) => setFilterCommunity(e.target.value)} style={{ minWidth: 140 }}>
                    <option value="all">All Communities</option>
                    {communities.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
            </div>

            <div style={{ border: "1px solid var(--is-border, #e2e8f0)", borderRadius: 10, overflow: "hidden", boxShadow: "var(--is-shadow-card, 0 8px 20px rgba(15, 23, 42, 0.08))" }}>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 1fr 0.9fr 0.8fr 0.9fr 0.7fr", gap: 8, padding: "10px 14px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    <span>Title</span>
                    <span>Community</span>
                    <span>Category</span>
                    <span>Status</span>
                    <span>Priority</span>
                    <span>Needed By</span>
                    <span></span>
                </div>
                {filtered.map((req) => (
                    <div key={req.id} style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 1fr 0.9fr 0.8fr 0.9fr 0.7fr", gap: 8, padding: "10px 14px", borderBottom: "1px solid #f1f5f9", fontSize: 13, alignItems: "center" }}>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                            <span style={{ fontWeight: 600, color: "var(--is-text-heading, #0f172a)" }}>{req.title}</span>
                            <span style={{ fontSize: 10, color: "#94a3b8" }}>{req.requestId}</span>
                        </div>
                        <span style={{ fontSize: 12, color: "var(--is-text-helper, #334155)" }}>{req.communityNames[0] || "\u2014"}</span>
                        <span style={{ fontSize: 12, color: "var(--is-text-helper, #334155)" }}>{req.category}</span>
                        <span><StatusBadge status={req.status} /></span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: req.priority === "High" ? "#991b1b" : req.priority === "Medium" ? "#92400e" : "#166534" }}>{req.priority}</span>
                        <span style={{ fontSize: 12, color: "var(--is-text-helper, #334155)" }}>{req.neededBy}</span>
                        <span>
                            {persona.role === "Owner / Seller" && req.status !== "Provided" && req.status !== "Under Review" && (
                                <button className="rc-btn rc-btn-primary rc-btn-sm" style={{ fontSize: 10 }} onClick={() => window.alert("Upload document mock")}>Upload</button>
                            )}
                            {persona.role === "Buyer" && (
                                <button className="rc-btn rc-btn-ghost rc-btn-sm" style={{ fontSize: 10 }} onClick={() => window.alert("Request clarification mock")}>Clarify</button>
                            )}
                            {persona.role === "Broker" && (
                                <button className="rc-btn rc-btn-ghost rc-btn-sm" style={{ fontSize: 10 }} onClick={() => window.alert("Route / assign mock")}>Route</button>
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

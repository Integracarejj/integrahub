import { useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getPortalRequests, getActivePersona, getPortalTransactions, toExternalStatusInput } from "../../services/portalMockData";
import { getExternalStatusInfo, getStatusPillStyle, getExceptionContext } from "../../services/externalStatusMapping";
import "./PortalOverview.css";

function StatusBadge({ status }: { status: string }) {
    const c = getStatusPillStyle(status);
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
        if (filterStatus !== "all") {
            if (filterStatus === "Action Needed") {
                result = result.filter(r => getExternalStatusInfo(toExternalStatusInput(r)).externalActionRequired);
            } else {
                result = result.filter(r => getExternalStatusInfo(toExternalStatusInput(r)).label === filterStatus);
            }
        }
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
                    <option value="Submitted">Submitted</option>
                    <option value="Under Review">Under Review</option>
                    <option value="Information Requested">Information Requested</option>
                    <option value="Awaiting Your Review">Awaiting Your Review</option>
                    <option value="Exception Review">Exception Review</option>
                    <option value="Complete">Complete</option>
                    <option value="Action Needed">Action Needed</option>
                </select>
                <select className="po-filter-select" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                    <option value="all">All Categories</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select className="po-filter-select" value={filterCommunity} onChange={(e) => setFilterCommunity(e.target.value)}>
                    <option value="all">All Communities</option>
                    {communities.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
            </div>

            <div className="rc-card">
                <div className="po-requests-table">
                    <div className="po-requests-header" style={{ gridTemplateColumns: "0.5fr 2.5fr 0.9fr 0.8fr 0.9fr 0.7fr 0.7fr 0.7fr" }}>
                        <span>ID</span><span>Request</span><span>Status</span><span>Review Type</span><span>Category</span><span>Community</span><span>Updated</span><span style={{ textAlign: "center" }}>Action</span>
                    </div>
                    {filtered.length === 0 ? (
                        <div className="po-empty-state" style={{ padding: "40px 20px", textAlign: "center" }}>
                            <p style={{ fontSize: 14, color: "#475569" }}>No requests match the selected filters.</p>
                        </div>
                    ) : filtered.map((req) => {
                        const extInfo = getExternalStatusInfo(toExternalStatusInput(req));
                        const excCtx = getExceptionContext(req);
                        return (
                            <div key={req.id} className="po-requests-row" style={{ gridTemplateColumns: "0.5fr 2.5fr 0.9fr 0.8fr 0.9fr 0.7fr 0.7fr 0.7fr" }} onClick={() => navigate(`/portal/requests/${req.id}`)} title={req.requestId}>
                                <span className="po-requests-id">{req.requestId.split("-").length >= 3 ? req.requestId.split("-")[0] + "-" + req.requestId.split("-").slice(-1)[0] : req.requestId}</span>
                                <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
                                    <span className="po-requests-title" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={req.title}>{req.title.split(" - ").slice(1).join(" - ").trim() || req.title}</span>
                                    {extInfo.status === "Awaiting Your Review" && (
                                        <span style={{ fontSize: 11, color: "#047857", fontWeight: 500 }}>Document ready for approval</span>
                                    )}
                                    {excCtx.contextLabel && (
                                        <span style={{ fontSize: 11, color: "#6d28d9", fontWeight: 500 }}>{excCtx.contextLabel}</span>
                                    )}
                                    {extInfo.status === "Information Requested" && (
                                        <span style={{ fontSize: 11, color: "#92400e", fontWeight: 500 }}>IntegraCare needs additional information</span>
                                    )}
                                </div>
                                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                    <StatusBadge status={extInfo.label} />
                                </span>
                                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                    {excCtx.recommendationType ? (
                                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#0f172a", fontWeight: 600, fontSize: 11, background: "#fff", padding: "2px 8px", borderRadius: 4, border: excCtx.recommendationType === "Duplicate" ? "1px solid #c4b5fd" : "1px solid #a5b4fc", whiteSpace: "nowrap" }}>
                                            {excCtx.recommendationType === "Duplicate" ? "Duplicate" : "Not Applicable"}
                                        </span>
                                    ) : (
                                        <span style={{ color: "#94a3b8", fontSize: 12 }}>{"\u2014"}</span>
                                    )}
                                </span>
                                <span className="po-requests-txn">{req.category || "\u2014"}</span>
                                <span className="po-requests-txn">{req.communityNames[0] || "\u2014"}</span>
                                <span className="po-requests-txn">{req.updatedAt || req.neededBy || "\u2014"}</span>
                                <span style={{ display: "flex", justifyContent: "center" }}>
                                    {extInfo.externalActionRequired && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); navigate(`/portal/requests/${req.id}`); }}
                                            style={{
                                                fontSize: 12, padding: "6px 16px", borderRadius: 8,
                                                background: "#1d4ed8", color: "#fff", border: "none",
                                                cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap",
                                            }}
                                            onMouseEnter={e => { (e.target as HTMLElement).style.background = "#1e40af"; }}
                                            onMouseLeave={e => { (e.target as HTMLElement).style.background = "#1d4ed8"; }}
                                        >
                                            {extInfo.externalActionLabel || "Open"}
                                        </button>
                                    )}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

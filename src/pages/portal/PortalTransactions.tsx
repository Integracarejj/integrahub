import { useNavigate } from "react-router-dom";
import { getPortalTransactions, getActivePersona, getPortalRequests } from "../../services/portalMockData";
import "./PortalOverview.css";

const STATUS_COLORS: Record<string, string> = {
    Active: "#166534",
    Pending: "#92400e",
    Completed: "#1e40af",
};

export default function PortalTransactions() {
    const navigate = useNavigate();
    const transactions = getPortalTransactions();
    const persona = getActivePersona();
    const allRequests = getPortalRequests();

    const txnCounts = transactions.map((txn) => {
        const txnRequests = allRequests.filter((r) => r.transactionId === txn.id);
        return {
            id: txn.id,
            total: txnRequests.length,
            inProgress: txnRequests.filter((r) => r.status === "In Progress").length,
            qualityReview: txnRequests.filter((r) => r.status === "Quality Review").length,
            published: txnRequests.filter((r) => r._publishedExternal || r.externalStatus === "Published External").length,
            actionNeeded: txnRequests.filter((r) => r.status === "Action Needed").length,
            intake: txnRequests.filter((r) => r.status === "Intake Review").length,
            workQueue: txnRequests.filter((r) => r.status === "Work Queue").length,
        };
    });

    return (
        <div className="portal-overview">
            <h1 className="po-welcome-title">Transaction</h1>
            <p className="po-welcome-sub" style={{ marginBottom: 20 }}>
                {persona.role === "Owner / Seller" && "Your transaction with 123 Corporation. View progress and upload requested documents."}
                {persona.role === "Buyer" && "Your target acquisition. Track due diligence progress and review available documents."}
                {persona.role === "Broker" && "Active transaction you are coordinating. Monitor status and manage the DD package."}
            </p>

            {transactions.length === 0 ? (
                <div className="po-empty-state">
                    <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>No transactions available for your account.</p>
                </div>
            ) : (
                transactions.map((txn) => {
                    const c = txnCounts.find((x) => x.id === txn.id)!;
                    return (
                        <div key={txn.id} className="po-txn-summary" style={{ marginBottom: 16 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                                <div>
                                    <div style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>{txn.name}</div>
                                    <p style={{ fontSize: 13, color: "#475569", margin: 0 }}>{txn.description}</p>
                                </div>
                                <span className="po-status-badge" style={{
                                    background: txn.status === "Active" ? "#f0fdf4" : txn.status === "Pending" ? "#fff7ed" : "#eff6ff",
                                    color: STATUS_COLORS[txn.status],
                                    borderColor: txn.status === "Active" ? "#bbf7d0" : txn.status === "Pending" ? "#fed7aa" : "#bfdbfe",
                                }}>
                                    {txn.status}
                                </span>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
                                <div><span style={{ fontSize: 11, color: "#64748b", display: "block" }}>Owner / Seller</span><span style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{txn.sellerName}</span></div>
                                <div><span style={{ fontSize: 11, color: "#64748b", display: "block" }}>Buyer</span><span style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{txn.buyerName}</span></div>
                                <div><span style={{ fontSize: 11, color: "#64748b", display: "block" }}>Broker</span><span style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{txn.brokerName}</span></div>
                                <div><span style={{ fontSize: 11, color: "#64748b", display: "block" }}>Target Close</span><span style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{txn.targetClose}</span></div>
                            </div>

                            {txn.communities.length > 0 && (
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 16 }}>
                                    {txn.communities.map((c) => (
                                        <span key={c.id} style={{ fontSize: 10, padding: "2px 8px", background: "#eef2ff", color: "#4338ca", borderRadius: 4, fontWeight: 600 }}>{c.name}</span>
                                    ))}
                                </div>
                            )}

                            <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 16, marginBottom: 16 }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em", display: "block", marginBottom: 12 }}>Request Summary</span>
                                <div className="po-txn-summary-grid">
                                    <div className="po-txn-stat">
                                        <div className="po-txn-stat-value" style={{ color: "#1e293b" }}>{c.total}</div>
                                        <div className="po-txn-stat-label">Total</div>
                                    </div>
                                    <div className="po-txn-stat">
                                        <div className="po-txn-stat-value" style={{ color: "#4338ca" }}>{c.intake}</div>
                                        <div className="po-txn-stat-label">Intake Review</div>
                                    </div>
                                    {c.workQueue > 0 && (
                                        <div className="po-txn-stat">
                                            <div className="po-txn-stat-value" style={{ color: "#92400e" }}>{c.workQueue}</div>
                                            <div className="po-txn-stat-label">Work Queue</div>
                                        </div>
                                    )}
                                    <div className="po-txn-stat">
                                        <div className="po-txn-stat-value" style={{ color: "#1d4ed8" }}>{c.inProgress}</div>
                                        <div className="po-txn-stat-label">In Progress</div>
                                    </div>
                                    {c.qualityReview > 0 && (
                                        <div className="po-txn-stat">
                                            <div className="po-txn-stat-value" style={{ color: "#92400e" }}>{c.qualityReview}</div>
                                            <div className="po-txn-stat-label">Quality Review</div>
                                        </div>
                                    )}
                                    <div className="po-txn-stat">
                                        <div className="po-txn-stat-value" style={{ color: "#166534" }}>{c.published}</div>
                                        <div className="po-txn-stat-label">Published</div>
                                    </div>
                                    {c.actionNeeded > 0 && (
                                        <div className="po-txn-stat">
                                            <div className="po-txn-stat-value" style={{ color: "#9a3412" }}>{c.actionNeeded}</div>
                                            <div className="po-txn-stat-label">Action Needed</div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div style={{ textAlign: "center" }}>
                                <button
                                    className="rc-btn rc-btn-primary"
                                    onClick={() => navigate("/portal/requests")}
                                    style={{ padding: "10px 28px", fontSize: 13, fontWeight: 700, borderRadius: 8 }}
                                >
                                    View Requests
                                </button>
                            </div>
                        </div>
                    );
                })
            )}
        </div>
    );
}

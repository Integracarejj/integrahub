import { getPortalTransactions, getActivePersona } from "../../services/portalMockData";
import "./PortalOverview.css";

const STATUS_COLORS: Record<string, string> = {
    Active: "#166534",
    Pending: "#92400e",
    Completed: "#1e40af",
};

export default function PortalTransactions() {
    const transactions = getPortalTransactions();
    const persona = getActivePersona();

    return (
        <div className="portal-overview">
            <h1 className="po-welcome-title">Transaction</h1>
            <p className="po-welcome-sub" style={{ marginBottom: 20 }}>
                {persona.role === "Owner / Seller" && "Your transaction with 123 Corporation. View progress and upload requested documents."}
                {persona.role === "Buyer" && "Your target acquisition. Track due diligence progress and review available documents."}
                {persona.role === "Broker" && "Active transaction you are coordinating. Monitor status and manage the DD package."}
            </p>

            <div className="po-summary-row">
                {transactions.map((txn) => (
                    <div key={txn.id} className="po-txn-card">
                        <div className="po-txn-card-top">
                            <span className="po-txn-name">{txn.name}</span>
                            <span
                                className="po-status-badge"
                                style={{
                                    background: txn.status === "Active" ? "#f0fdf4" : txn.status === "Pending" ? "#fff7ed" : "#eff6ff",
                                    color: STATUS_COLORS[txn.status],
                                    borderColor: txn.status === "Active" ? "#bbf7d0" : txn.status === "Pending" ? "#fed7aa" : "#bfdbfe",
                                }}
                            >
                                {txn.status}
                            </span>
                        </div>
                        <p className="po-txn-desc">{txn.description}</p>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                            <div><span style={{ fontSize: 11, color: "#64748b", display: "block" }}>Owner / Seller</span><span style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{txn.sellerName}</span></div>
                            <div><span style={{ fontSize: 11, color: "#64748b", display: "block" }}>Buyer</span><span style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{txn.buyerName}</span></div>
                            <div><span style={{ fontSize: 11, color: "#64748b", display: "block" }}>Broker</span><span style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{txn.brokerName}</span></div>
                            <div><span style={{ fontSize: 11, color: "#64748b", display: "block" }}>Target Close</span><span style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{txn.targetClose}</span></div>
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {txn.communities.map((c) => (
                                <span key={c.id} style={{ fontSize: 10, padding: "2px 8px", background: "#eef2ff", color: "#4338ca", borderRadius: 4, fontWeight: 600 }}>{c.name}</span>
                            ))}
                        </div>
                        <div style={{ marginTop: 12, borderTop: "1px solid #f1f5f9", paddingTop: 12 }}>
                            <div style={{ display: "flex", gap: 16 }}>
                                <div style={{ textAlign: "center", flex: 1 }}>
                                    <div style={{ fontSize: 18, fontWeight: 700, color: "#1e293b" }}>{txn.totalRequests}</div>
                                    <div style={{ fontSize: 10, color: "#64748b" }}>Total</div>
                                </div>
                                <div style={{ textAlign: "center", flex: 1 }}>
                                    <div style={{ fontSize: 18, fontWeight: 700, color: "#166534" }}>{txn.providedCount}</div>
                                    <div style={{ fontSize: 10, color: "#64748b" }}>Provided</div>
                                </div>
                                <div style={{ textAlign: "center", flex: 1 }}>
                                    <div style={{ fontSize: 18, fontWeight: 700, color: "#1d4ed8" }}>{txn.inProgressCount}</div>
                                    <div style={{ fontSize: 10, color: "#64748b" }}>In Progress</div>
                                </div>
                                <div style={{ textAlign: "center", flex: 1 }}>
                                    <div style={{ fontSize: 18, fontWeight: 700, color: "#92400e" }}>{txn.clarificationNeededCount}</div>
                                    <div style={{ fontSize: 10, color: "#64748b" }}>Clarifications</div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
                {transactions.length === 0 && (
                    <div style={{ padding: 24, textAlign: "center", fontSize: 13, color: "#64748b" }}>
                        No transactions available for your account.
                    </div>
                )}
            </div>
        </div>
    );
}

import { useNavigate } from "react-router-dom";
import { getTransactions, isRecapDataWiped } from "../../services/recapDataService";
import RecapSubNav from "./RecapSubNav";
import "./Recapitalization.css";

export default function RecapitalizationTransactions() {
    const navigate = useNavigate();
    const wiped = isRecapDataWiped();
    const transactions = getTransactions();

    return (
        <div className="rc-page">
            <RecapSubNav />
            <div className="rc-header">
                <h1>Transactions</h1>
                <div className="rc-header-actions">
                    <button className="rc-btn rc-btn-secondary rc-btn-sm">New Transaction</button>
                </div>
            </div>

            {wiped && transactions.length === 0 && (
                <div className="rc-empty-state">No transactions — all test data has been wiped.</div>
            )}

            {transactions.map(txn => {
                const pct = txn.totalRequests > 0 ? Math.round(txn.providedCount / txn.totalRequests * 100) : 0;
                return (
                    <div key={txn.id} className="rc-card" style={{ cursor: "pointer" }} onClick={() => navigate("/recapitalization/tracker")}>
                        <div className="rc-card-body">
                            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 12 }}>
                                <div>
                                    <h2 style={{ marginBottom: 4 }}>{txn.name}</h2>
                                    <span className="rc-text-muted">{txn.description}</span>
                                </div>
                                <span className={`rc-badge rc-badge-${txn.status === "Active" ? "in-progress" : "open"}`}>
                                    {txn.status}
                                </span>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
                                <div><span className="rc-text-muted" style={{ display: "block" }}>Owner / Seller</span><span style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{txn.sellerName}</span></div>
                                <div><span className="rc-text-muted" style={{ display: "block" }}>Buyer</span><span style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{txn.buyerName}</span></div>
                                <div><span className="rc-text-muted" style={{ display: "block" }}>Broker</span><span style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{txn.brokerName}</span></div>
                                <div><span className="rc-text-muted" style={{ display: "block" }}>Target Close</span><span style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{txn.targetClose}</span></div>
                                <div><span className="rc-text-muted" style={{ display: "block" }}>Communities</span><span style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{txn.communities.length}</span></div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                                <div style={{ flex: 1, height: 8, background: "#f1f5f9", borderRadius: 4, overflow: "hidden" }}>
                                    <div style={{ height: "100%", width: `${pct}%`, background: pct > 75 ? "#166534" : pct > 40 ? "#1d4ed8" : "#92400e", borderRadius: 4 }} />
                                </div>
                                <span style={{ fontSize: 12, fontWeight: 600, color: "#475569", whiteSpace: "nowrap" }}>
                                    {txn.providedCount} / {txn.totalRequests} ({pct}%)
                                </span>
                            </div>
                            <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
                                <span className="rc-text-muted">In Progress: {txn.inProgressCount}</span>
                                <span className="rc-text-muted">Clarification Needed: {txn.clarificationNeededCount}</span>
                                {txn.overdueCount > 0 && <span style={{ fontSize: 12, fontWeight: 600, color: "#991b1b" }}>Overdue: {txn.overdueCount}</span>}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

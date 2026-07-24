import { useNavigate } from "react-router-dom";
import { getPortalTransactions, getActivePersona, getPortalRequests, getPersonaIdentity, getAggregateTransactionStats } from "../../services/portalMockData";
import "./PortalOverview.css";

const STATUS_COLORS: Record<string, string> = {
    Active: "#166534",
    Pending: "#92400e",
    Completed: "#1e40af",
};

export default function PortalTransactions() {
    const navigate = useNavigate();
    const persona = getActivePersona();
    const identity = getPersonaIdentity();
    const allRequests = getPortalRequests();

    // getPortalTransactions() now returns only authorized transactions
    const transactions = getPortalTransactions();
    const orgName = identity?.organization?.name || persona.companyName;

    // Build aggregate stats for "All Transactions" view
    const aggregateStats = getAggregateTransactionStats();

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
            <h1 className="po-welcome-title">Transactions</h1>
            <p className="po-welcome-sub" style={{ marginBottom: 20 }}>
                {persona.role === "Owner / Seller" && `Your transactions with ${orgName}. View progress and upload requested documents.`}
                {persona.role === "Buyer" && `Your due diligence transactions. Track progress and review available documents.`}
                {persona.role === "Broker" && `Active transactions you are coordinating. Monitor status and manage DD packages.`}
            </p>

            {transactions.length === 0 ? (
                <div className="po-empty-state">
                    <p style={{ fontSize: 16, color: "#334155", margin: 0 }}>No transactions available for your account.</p>
                </div>
            ) : (
                <>
                    {/* Aggregate "All Transactions" card */}
                    <div className="po-txn-summary" style={{ marginBottom: 20, border: "2px solid #e0e7ff", background: "#f8faff" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                            <div>
                                <div style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>All {orgName} Transactions</div>
                                <p style={{ fontSize: 13, color: "#334155", margin: 0 }}>Aggregate overview across {transactions.length} transaction{transactions.length !== 1 ? "s" : ""}</p>
                            </div>
                            <span className="po-status-badge" style={{ background: "#eff6ff", color: "#1e40af", borderColor: "#bfdbfe" }}>
                                Aggregate
                            </span>
                        </div>

                        <div style={{ borderTop: "1px solid #e0e7ff", paddingTop: 14 }}>
                            <div className="po-txn-summary-grid">
                                <div className="po-txn-stat">
                                    <div className="po-txn-stat-value" style={{ color: "#0f172a" }}>{aggregateStats.totalRequests}</div>
                                    <div className="po-txn-stat-label">Total Requests</div>
                                </div>
                                <div className="po-txn-stat">
                                    <div className="po-txn-stat-value" style={{ color: "#4338ca" }}>{transactions.length}</div>
                                    <div className="po-txn-stat-label">Transactions</div>
                                </div>
                                <div className="po-txn-stat">
                                    <div className="po-txn-stat-value" style={{ color: "#1d4ed8" }}>{aggregateStats.byStatus["In Progress"] || 0}</div>
                                    <div className="po-txn-stat-label">In Progress</div>
                                </div>
                                <div className="po-txn-stat">
                                    <div className="po-txn-stat-value" style={{ color: "#166534" }}>{aggregateStats.byStatus["Awaiting Your Review"] || 0}</div>
                                    <div className="po-txn-stat-label">Awaiting Review</div>
                                </div>
                                <div className="po-txn-stat">
                                    <div className="po-txn-stat-value" style={{ color: "#166534" }}>{aggregateStats.byStatus["Complete"] || 0}</div>
                                    <div className="po-txn-stat-label">Complete</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Individual transaction cards */}
                    {transactions.map((txn) => {
                        const c = txnCounts.find((x) => x.id === txn.id)!;
                        return (
                            <div key={txn.id} className="po-txn-summary" style={{ marginBottom: 16 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                                    <div>
                                        <div style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>{txn.name}</div>
                                        <p style={{ fontSize: 14, color: "#334155", margin: 0 }}>{txn.description}</p>
                                    </div>
                                    <span className="po-status-badge" style={{
                                        background: txn.status === "Active" ? "#f0fdf4" : txn.status === "Pending" ? "#fff7ed" : "#eff6ff",
                                        color: STATUS_COLORS[txn.status],
                                        borderColor: txn.status === "Active" ? "#bbf7d0" : txn.status === "Pending" ? "#fed7aa" : "#bfdbfe",
                                    }}>
                                        {txn.status}
                                    </span>
                                </div>

                                <div style={{ borderTop: "1px solid #e0e7ff", paddingTop: 14, marginBottom: 14 }}>
                                    <span style={{ fontSize: 13, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.03em", display: "block", marginBottom: 10 }}>Request Summary</span>
                                    <div className="po-txn-summary-grid">
                                        <div className="po-txn-stat">
                                            <div className="po-txn-stat-value" style={{ color: "#0f172a" }}>{c.total}</div>
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
                                        <div className="po-txn-stat">
                                            <div className="po-txn-stat-value" style={{ color: "#166534" }}>{c.published}</div>
                                            <div className="po-txn-stat-label">Published</div>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ textAlign: "center" }}>
                                    <button
                                        className="rc-btn rc-btn-primary"
                                        onClick={() => navigate("/portal/requests")}
                                        style={{ padding: "12px 32px", fontSize: 14, fontWeight: 700, borderRadius: 10 }}
                                    >
                                        View Requests
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </>
            )}
        </div>
    );
}

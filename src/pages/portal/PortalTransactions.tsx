import { getPortalTransactions } from "../../services/portalMockData";
import "./PortalOverview.css";

export default function PortalTransactions() {
    const transactions = getPortalTransactions();

    const STATUS_COLORS: Record<string, string> = {
        Active: "#166534",
        Pending: "#92400e",
        Completed: "#1e40af",
    };

    return (
        <div className="portal-overview">
            <h1 className="po-welcome-title">Transactions</h1>
            <p className="po-welcome-sub" style={{ marginBottom: 20 }}>
                Active and pending recapitalization transactions assigned to your organization.
            </p>

            <div className="po-summary-row">
                {transactions.map(txn => (
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
                        <div className="po-txn-meta">
                            <span>Buyer: {txn.buyerName}</span>
                            <span>Broker: {txn.brokerName}</span>
                            <span>Target Close: {txn.targetClose}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

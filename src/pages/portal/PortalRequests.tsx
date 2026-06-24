import { getPortalRequests } from "../../services/portalMockData";

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    "Provided": { bg: "#f0fdf4", text: "#166534", border: "#bbf7d0" },
    "In Progress": { bg: "#eff6ff", text: "#1e40af", border: "#bfdbfe" },
    "Clarification Needed": { bg: "#fff7ed", text: "#9a3412", border: "#fed7aa" },
    "Under Review": { bg: "#faf5ff", text: "#6b21a8", border: "#ddd6fe" },
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
    const requests = getPortalRequests();

    return (
        <div className="portal-overview">
            <h1 className="po-welcome-title">Requests</h1>
            <p className="po-welcome-sub" style={{ marginBottom: 20 }}>
                All due diligence requests across your active transactions.
            </p>

            <div style={{ border: "1px solid var(--is-border, #93c5fd)", borderRadius: 10, overflow: "hidden", boxShadow: "var(--is-shadow-card, 0 8px 20px rgba(15, 23, 42, 0.08))" }}>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1fr 0.8fr 0.8fr", gap: 8, padding: "10px 14px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    <span>Title</span>
                    <span>Transaction</span>
                    <span>Category</span>
                    <span>Status</span>
                    <span>Priority</span>
                    <span>Needed By</span>
                </div>
                {requests.map(req => (
                    <div key={req.id} style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1fr 0.8fr 0.8fr", gap: 8, padding: "10px 14px", borderBottom: "1px solid #f1f5f9", fontSize: 13, alignItems: "center" }}>
                        <span style={{ fontWeight: 600, color: "var(--is-text-heading, #0f172a)" }}>{req.title}</span>
                        <span style={{ fontSize: 12, color: "var(--is-text-helper, #334155)" }}>{req.transactionName}</span>
                        <span style={{ fontSize: 12, color: "var(--is-text-helper, #334155)" }}>{req.category}</span>
                        <span><StatusBadge status={req.status} /></span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: req.priority === "High" ? "#991b1b" : req.priority === "Medium" ? "#92400e" : "#166534" }}>{req.priority}</span>
                        <span style={{ fontSize: 12, color: "var(--is-text-helper, #334155)" }}>{req.neededBy}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

import { useState } from "react";
import { getPortalTransactions, getPortalRequests, submitPortalClarification, getPortalClarifications } from "../../services/portalMockData";

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    "Open": { bg: "#fff7ed", text: "#9a3412", border: "#fed7aa" },
    "Resolved": { bg: "#f0fdf4", text: "#166534", border: "#bbf7d0" },
};

function StatusBadge({ status }: { status: string }) {
    const c = STATUS_COLORS[status] || { bg: "#f8fafc", text: "#475569", border: "#e2e8f0" };
    return (
        <span className="po-status-badge" style={{ background: c.bg, color: c.text, borderColor: c.border }}>
            {status}
        </span>
    );
}

export default function PortalClarifications() {
    const transactions = getPortalTransactions();
    const existingClarifications = getPortalClarifications();

    const [txnId, setTxnId] = useState(transactions.length > 0 ? transactions[0].id : "");
    const [requestId, setRequestId] = useState("");
    const [details, setDetails] = useState("");
    const [submitted, setSubmitted] = useState(false);

    const availableRequests = getPortalRequests().filter(r => r.transactionId === txnId);

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        console.log("Submitting clarification request:", { transactionId: txnId, requestId, details });
        const selReq = availableRequests.find(r => r.id === requestId);
        submitPortalClarification({ transactionId: txnId, requestId, details, communityIds: [], communityNames: [], requestTitle: selReq?.title || "Selected request" });
        setSubmitted(true);
        setDetails("");
        setTimeout(() => setSubmitted(false), 3000);
    }

    return (
        <div className="portal-overview">
            <h1 className="po-welcome-title">Request Clarification</h1>
            <p className="po-welcome-sub" style={{ marginBottom: 20 }}>
                Request clarification on an existing due diligence request.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>
                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <label style={{ fontSize: 13, fontWeight: 600, color: "var(--is-text-heading)" }}>Transaction</label>
                        <select value={txnId} onChange={e => { setTxnId(e.target.value); setRequestId(""); }} style={{ padding: "8px 12px", fontSize: 14, border: "1px solid #d1d5db", borderRadius: 6, background: "#fff", color: "#111827" }}>
                            {transactions.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <label style={{ fontSize: 13, fontWeight: 600, color: "var(--is-text-heading)" }}>Existing Request</label>
                        <select value={requestId} onChange={e => setRequestId(e.target.value)} required style={{ padding: "8px 12px", fontSize: 14, border: "1px solid #d1d5db", borderRadius: 6, background: "#fff", color: "#111827" }}>
                            <option value="">Select a request...</option>
                            {availableRequests.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
                        </select>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <label style={{ fontSize: 13, fontWeight: 600, color: "var(--is-text-heading)" }}>Clarification Details</label>
                        <textarea value={details} onChange={e => setDetails(e.target.value)} required rows={5} placeholder="Describe what needs clarification..." style={{ padding: "8px 12px", fontSize: 14, border: "1px solid #d1d5db", borderRadius: 6, resize: "vertical", color: "#111827", font: "inherit" }} />
                    </div>
                    <button type="submit" style={{ padding: "10px 22px", fontSize: 14, fontWeight: 600, color: "#fff", background: "#4f46e5", border: "none", borderRadius: 8, cursor: "pointer", alignSelf: "flex-start" }}>
                        Submit Clarification Request
                    </button>
                    {submitted && (
                        <p style={{ color: "#166534", fontSize: 14, fontWeight: 600, margin: 0 }}>Clarification request submitted successfully.</p>
                    )}
                </form>

                <div>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--is-text-heading)", margin: "0 0 10px" }}>Previous Clarifications</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {existingClarifications.slice(0, 4).map(c => (
                            <div key={c.id} style={{ border: "1px solid var(--is-border-soft, #bfdbfe)", borderRadius: 8, padding: 12, background: "#fff" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--is-text-heading)" }}>{c.requestTitle}</span>
                                    <StatusBadge status={c.status} />
                                </div>
                                <p style={{ fontSize: 12, color: "var(--is-text-helper, #334155)", margin: 0, lineHeight: 1.4 }}>{c.details.substring(0, 120)}{c.details.length > 120 ? "..." : ""}</p>
                                {c.response && (
                                    <p style={{ fontSize: 12, color: "#166534", margin: "6px 0 0", lineHeight: 1.4, borderTop: "1px solid #e2e8f0", paddingTop: 6 }}>
                                        <strong>Response:</strong> {c.response.substring(0, 120)}{c.response.length > 120 ? "..." : ""}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

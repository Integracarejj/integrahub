import { useState } from "react";
import { getPortalTransactions, submitPortalNewRequest } from "../../services/portalMockData";

const CATEGORIES = ["Financial", "Operational", "Compliance", "Legal", "Regulatory", "Clinical", "Workforce", "IT Systems"];
const PRIORITIES = ["High", "Medium", "Low"];

export default function PortalNewRequest() {
    const transactions = getPortalTransactions();

    const [txnId, setTxnId] = useState(transactions.length > 0 ? transactions[0].id : "");
    const [category, setCategory] = useState("Financial");
    const [title, setTitle] = useState("");
    const [details, setDetails] = useState("");
    const [priority, setPriority] = useState("Medium");
    const [neededBy, setNeededBy] = useState("");
    const [submitted, setSubmitted] = useState(false);

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        console.log("Submitting new request:", { transactionId: txnId, category, title, details, priority, neededBy });
        submitPortalNewRequest({ transactionId: txnId, category, title, details, priority, neededBy });
        setSubmitted(true);
        setTitle("");
        setDetails("");
        setNeededBy("");
        setTimeout(() => setSubmitted(false), 3000);
    }

    return (
        <div className="portal-overview" style={{ maxWidth: 700 }}>
            <h1 className="po-welcome-title">Submit New Due Diligence Request</h1>
            <p className="po-welcome-sub" style={{ marginBottom: 20 }}>
                Submit a new request for due diligence materials from the DD team.
            </p>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: "var(--is-text-heading)" }}>Transaction</label>
                    <select value={txnId} onChange={e => setTxnId(e.target.value)} style={{ padding: "8px 12px", fontSize: 14, border: "1px solid #d1d5db", borderRadius: 6, background: "#fff", color: "#111827" }}>
                        {transactions.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: "var(--is-text-heading)" }}>Category</label>
                    <select value={category} onChange={e => setCategory(e.target.value)} style={{ padding: "8px 12px", fontSize: 14, border: "1px solid #d1d5db", borderRadius: 6, background: "#fff", color: "#111827" }}>
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: "var(--is-text-heading)" }}>Request Title</label>
                    <input type="text" value={title} onChange={e => setTitle(e.target.value)} required placeholder="e.g., Medicare Cost Reports (2023-2025)" style={{ padding: "8px 12px", fontSize: 14, border: "1px solid #d1d5db", borderRadius: 6, color: "#111827" }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: "var(--is-text-heading)" }}>Request Details</label>
                    <textarea value={details} onChange={e => setDetails(e.target.value)} required rows={5} placeholder="Describe what you need, including specific documents, date ranges, facilities, etc." style={{ padding: "8px 12px", fontSize: 14, border: "1px solid #d1d5db", borderRadius: 6, resize: "vertical", color: "#111827", font: "inherit" }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <label style={{ fontSize: 13, fontWeight: 600, color: "var(--is-text-heading)" }}>Priority</label>
                        <select value={priority} onChange={e => setPriority(e.target.value)} style={{ padding: "8px 12px", fontSize: 14, border: "1px solid #d1d5db", borderRadius: 6, background: "#fff", color: "#111827" }}>
                            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <label style={{ fontSize: 13, fontWeight: 600, color: "var(--is-text-heading)" }}>Needed By</label>
                        <input type="date" value={neededBy} onChange={e => setNeededBy(e.target.value)} required style={{ padding: "8px 12px", fontSize: 14, border: "1px solid #d1d5db", borderRadius: 6, color: "#111827" }} />
                    </div>
                </div>
                <button type="submit" style={{ padding: "10px 22px", fontSize: 14, fontWeight: 600, color: "#fff", background: "#4f46e5", border: "none", borderRadius: 8, cursor: "pointer", alignSelf: "flex-start" }}>
                    Submit Request
                </button>
                {submitted && (
                    <p style={{ color: "#166534", fontSize: 14, fontWeight: 600, margin: 0 }}>Request submitted successfully.</p>
                )}
            </form>
        </div>
    );
}

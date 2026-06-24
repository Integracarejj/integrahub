import { useState } from "react";
import { getPortalTransactions, submitPortalQuestion, getPortalQuestions } from "../../services/portalMockData";

const QUESTION_TYPES = ["Financial", "Operational", "Legal", "Compliance", "Regulatory", "General"];

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    "Open": { bg: "#fff7ed", text: "#9a3412", border: "#fed7aa" },
    "Answered": { bg: "#f0fdf4", text: "#166534", border: "#bbf7d0" },
    "Closed": { bg: "#f8fafc", text: "#475569", border: "#e2e8f0" },
};

function StatusBadge({ status }: { status: string }) {
    const c = STATUS_COLORS[status] || { bg: "#f8fafc", text: "#475569", border: "#e2e8f0" };
    return (
        <span className="po-status-badge" style={{ background: c.bg, color: c.text, borderColor: c.border }}>
            {status}
        </span>
    );
}

export default function PortalQuestions() {
    const transactions = getPortalTransactions();
    const existingQuestions = getPortalQuestions();

    const [txnId, setTxnId] = useState(transactions.length > 0 ? transactions[0].id : "");
    const [qType, setQType] = useState("General");
    const [subject, setSubject] = useState("");
    const [details, setDetails] = useState("");
    const [submitted, setSubmitted] = useState(false);

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        console.log("Submitting question:", { transactionId: txnId, questionType: qType, subject, details });
        submitPortalQuestion({ transactionId: txnId, questionType: qType, subject, details });
        setSubmitted(true);
        setSubject("");
        setDetails("");
        setTimeout(() => setSubmitted(false), 3000);
    }

    return (
        <div className="portal-overview">
            <h1 className="po-welcome-title">Ask a General Question</h1>
            <p className="po-welcome-sub" style={{ marginBottom: 20 }}>
                Submit a general question about any transaction. The DD team will respond as soon as possible.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>
                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <label style={{ fontSize: 13, fontWeight: 600, color: "var(--is-text-heading)" }}>Transaction</label>
                        <select value={txnId} onChange={e => setTxnId(e.target.value)} style={{ padding: "8px 12px", fontSize: 14, border: "1px solid #d1d5db", borderRadius: 6, background: "#fff", color: "#111827" }}>
                            {transactions.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <label style={{ fontSize: 13, fontWeight: 600, color: "var(--is-text-heading)" }}>Question Type</label>
                        <select value={qType} onChange={e => setQType(e.target.value)} style={{ padding: "8px 12px", fontSize: 14, border: "1px solid #d1d5db", borderRadius: 6, background: "#fff", color: "#111827" }}>
                            {QUESTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <label style={{ fontSize: 13, fontWeight: 600, color: "var(--is-text-heading)" }}>Subject</label>
                        <input type="text" value={subject} onChange={e => setSubject(e.target.value)} required placeholder="Brief subject line" style={{ padding: "8px 12px", fontSize: 14, border: "1px solid #d1d5db", borderRadius: 6, color: "#111827" }} />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <label style={{ fontSize: 13, fontWeight: 600, color: "var(--is-text-heading)" }}>Question Details</label>
                        <textarea value={details} onChange={e => setDetails(e.target.value)} required rows={5} placeholder="Describe your question in detail..." style={{ padding: "8px 12px", fontSize: 14, border: "1px solid #d1d5db", borderRadius: 6, resize: "vertical", color: "#111827", font: "inherit" }} />
                    </div>
                    <button type="submit" style={{ padding: "10px 22px", fontSize: 14, fontWeight: 600, color: "#fff", background: "#4f46e5", border: "none", borderRadius: 8, cursor: "pointer", alignSelf: "flex-start" }}>
                        Submit Question
                    </button>
                    {submitted && (
                        <p style={{ color: "#166534", fontSize: 14, fontWeight: 600, margin: 0 }}>Question submitted successfully.</p>
                    )}
                </form>

                <div>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--is-text-heading)", margin: "0 0 10px" }}>Previous Questions</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {existingQuestions.slice(0, 4).map(q => (
                            <div key={q.id} style={{ border: "1px solid var(--is-border-soft, #bfdbfe)", borderRadius: 8, padding: 12, background: "#fff" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--is-text-heading)" }}>{q.subject}</span>
                                    <StatusBadge status={q.status} />
                                </div>
                                <p style={{ fontSize: 12, color: "var(--is-text-helper, #334155)", margin: 0, lineHeight: 1.4 }}>{q.details.substring(0, 100)}{q.details.length > 100 ? "..." : ""}</p>
                                {q.answer && (
                                    <p style={{ fontSize: 12, color: "#166534", margin: "6px 0 0", lineHeight: 1.4, borderTop: "1px solid #e2e8f0", paddingTop: 6 }}>
                                        <strong>Answer:</strong> {q.answer.substring(0, 120)}{q.answer.length > 120 ? "..." : ""}
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

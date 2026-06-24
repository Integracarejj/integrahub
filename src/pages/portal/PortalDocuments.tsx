import { getPortalDocuments } from "../../services/portalMockData";

export default function PortalDocuments() {
    const documents = getPortalDocuments();

    return (
        <div className="portal-overview">
            <h1 className="po-welcome-title">Documents</h1>
            <p className="po-welcome-sub" style={{ marginBottom: 20 }}>
                Due diligence documents available to you. Only documents marked as externally visible are shown.
            </p>

            <div style={{ border: "1px solid var(--is-border, #93c5fd)", borderRadius: 10, overflow: "hidden", boxShadow: "var(--is-shadow-card, 0 8px 20px rgba(15, 23, 42, 0.08))" }}>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1fr", gap: 8, padding: "10px 14px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    <span>Name</span>
                    <span>Transaction</span>
                    <span>Category</span>
                    <span>Uploaded</span>
                </div>
                {documents.map(doc => (
                    <div key={doc.id} style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1fr", gap: 8, padding: "10px 14px", borderBottom: "1px solid #f1f5f9", fontSize: 13, alignItems: "center" }}>
                        <span style={{ fontWeight: 600, color: "var(--is-text-heading, #0f172a)" }}>{doc.name}</span>
                        <span style={{ fontSize: 12, color: "var(--is-text-helper, #334155)" }}>{doc.transactionName}</span>
                        <span style={{ fontSize: 12, color: "var(--is-text-helper, #334155)" }}>{doc.category}</span>
                        <span style={{ fontSize: 12, color: "var(--is-text-helper, #334155)" }}>{doc.uploadedAt}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

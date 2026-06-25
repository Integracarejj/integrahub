import { getPortalDocuments } from "../../services/portalMockData";
import "./PortalOverview.css";

export default function PortalDocuments() {
    const documents = getPortalDocuments();

    return (
        <div className="portal-overview">
            <h1 className="po-welcome-title">Available Documents</h1>
            <p className="po-welcome-sub" style={{ marginBottom: 8 }}>
                Documents are stored in <strong>SharePoint</strong>. This page shows documents that have been marked externally visible for your transactions.
            </p>
            <p className="po-welcome-sub" style={{ marginBottom: 20, fontSize: 13, color: "#475569" }}>
                To request access to a document or report an issue, use the <strong>Submit / Communicate</strong> page.
            </p>

            <div style={{ border: "1px solid var(--is-border, #93c5fd)", borderRadius: 10, overflow: "hidden", boxShadow: "var(--is-shadow-card, 0 8px 20px rgba(15, 23, 42, 0.08))" }}>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 0.8fr 0.8fr 0.8fr", gap: 8, padding: "10px 14px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    <span>Document Name</span>
                    <span>Transaction</span>
                    <span>Category</span>
                    <span>Community</span>
                    <span>Uploaded</span>
                    <span>Source</span>
                </div>
                {documents.map(doc => (
                    <div key={doc.id} style={{
                        display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 0.8fr 0.8fr 0.8fr", gap: 8,
                        padding: "10px 14px", borderBottom: "1px solid #f1f5f9", fontSize: 13, alignItems: "center"
                    }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            <span style={{ fontWeight: 600, color: "var(--is-text-heading, #0f172a)" }}>{doc.name}</span>
                            {doc.relatedRequestTitle && (
                                <span style={{ fontSize: 11, color: "#64748b" }}>Related: {doc.relatedRequestTitle}</span>
                            )}
                        </div>
                        <span style={{ fontSize: 12, color: "var(--is-text-helper, #334155)" }}>{doc.transactionName}</span>
                        <span style={{ fontSize: 12, color: "var(--is-text-helper, #334155)" }}>{doc.category}</span>
                        <span style={{ fontSize: 12, color: "var(--is-text-helper, #334155)", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {doc.communityNames.length > 0 ? doc.communityNames.join(", ") : "—"}
                        </span>
                        <span style={{ fontSize: 12, color: "var(--is-text-helper, #334155)" }}>{doc.uploadedAt}</span>
                        <span>
                            <span style={{
                                display: "inline-flex", alignItems: "center", gap: 4,
                                fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 4,
                                background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0",
                                whiteSpace: "nowrap",
                            }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="7 10 12 15 17 10" />
                                    <line x1="12" y1="15" x2="12" y2="3" />
                                </svg>
                                SharePoint
                            </span>
                        </span>
                    </div>
                ))}
                {documents.length === 0 && (
                    <div style={{ padding: "24px", textAlign: "center", fontSize: 13, color: "#64748b" }}>
                        No documents are currently available for your transactions.
                    </div>
                )}
            </div>

            <div style={{
                marginTop: 20, border: "1px dashed #d1d5db", borderRadius: 10, padding: "18px 20px",
                background: "#f9fafb", display: "flex", alignItems: "center", gap: 12,
            }}>
                <div style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    width: 40, height: 40, background: "#eef2ff", borderRadius: 8, flexShrink: 0,
                    color: "#4f46e5", fontWeight: 700, fontSize: 18,
                }}>
                    &#8679;
                </div>
                <div style={{ flex: 1 }}>
                    <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: "var(--is-text-heading, #0f172a)", marginBottom: 2 }}>
                        Bulk Upload to SharePoint
                    </span>
                    <span style={{ display: "block", fontSize: 12, color: "#64748b", lineHeight: 1.4 }}>
                        Bulk document upload and direct integration with SharePoint is planned as a future enhancement. For now, contact the DD team to upload documents.
                    </span>
                </div>
                <span style={{
                    fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 4,
                    background: "#f8fafc", color: "#94a3b8", border: "1px solid #e2e8f0",
                }}>
                    Future
                </span>
            </div>
        </div>
    );
}

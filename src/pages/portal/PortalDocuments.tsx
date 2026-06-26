import { useState, useMemo } from "react";
import { getPortalDocuments, getActivePersona } from "../../services/portalMockData";
import "./PortalOverview.css";

export default function PortalDocuments() {
    const documents = getPortalDocuments();
    const persona = getActivePersona();

    const [groupBy, setGroupBy] = useState<"community" | "category">("category");

    const groups = useMemo(() => {
        const map: Record<string, typeof documents> = {};
        documents.forEach((doc) => {
            const key = groupBy === "category" ? doc.category : (doc.communityNames[0] || "Other");
            if (!map[key]) map[key] = [];
            map[key].push(doc);
        });
        return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
    }, [documents, groupBy]);

    const personaIntro = {
        "Broker": "Documents uploaded and published across communities. Group by category or community to browse.",
        "Owner / Seller": "Documents you have uploaded and those published by the DD team. Group by category or community.",
        "Buyer": "Documents made available for your review. Group by category or community to browse.",
    };

    return (
        <div className="portal-overview">
            <h1 className="po-welcome-title">Available Documents</h1>
            <p className="po-welcome-sub" style={{ marginBottom: 8 }}>
                {personaIntro[persona.role] || "Documents across the ABC Company Portfolio transaction."}
            </p>
            <p className="po-welcome-sub" style={{ marginBottom: 20, fontSize: 13, color: "#475569" }}>
                Documents are stored in <strong>SharePoint</strong>. This page shows documents marked externally visible for this transaction.
            </p>

            <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Group by:</span>
                <div className="rc-toggle-group">
                    <button className={`rc-toggle-btn${groupBy === "category" ? " rc-toggle-active" : ""}`} onClick={() => setGroupBy("category")}>Category</button>
                    <button className={`rc-toggle-btn${groupBy === "community" ? " rc-toggle-active" : ""}`} onClick={() => setGroupBy("community")}>Community</button>
                </div>
                <span style={{ fontSize: 12, color: "#64748b" }}>{documents.length} documents</span>
            </div>

            {groups.map(([key, docs]) => (
                <div key={key} style={{ marginBottom: 16 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", margin: "0 0 8px", display: "flex", alignItems: "center", gap: 8 }}>
                        {groupBy === "category" ? (
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4338ca", display: "inline-block" }} />
                        ) : (
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#1d4ed8", display: "inline-block" }} />
                        )}
                        {key}
                        <span style={{ fontSize: 11, fontWeight: 400, color: "#94a3b8" }}>({docs.length})</span>
                    </h3>
                    <div style={{ border: "1px solid var(--is-border, #e2e8f0)", borderRadius: 10, overflow: "hidden", boxShadow: "var(--is-shadow-card, 0 8px 20px rgba(15, 23, 42, 0.08))" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 0.8fr 0.7fr", gap: 8, padding: "8px 14px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                            <span>Name</span>
                            <span>{groupBy === "category" ? "Community" : "Category"}</span>
                            <span>Related Request</span>
                            <span>Uploaded</span>
                            <span></span>
                        </div>
                        {docs.map((doc) => (
                            <div key={doc.id} style={{
                                display: "grid", gridTemplateColumns: "2fr 1fr 1fr 0.8fr 0.7fr", gap: 8,
                                padding: "8px 14px", borderBottom: "1px solid #f1f5f9", fontSize: 12, alignItems: "center",
                            }}>
                                <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                                    <span style={{ fontWeight: 600, color: "var(--is-text-heading, #0f172a)" }}>{doc.name}</span>
                                    <span style={{ fontSize: 10, color: "#94a3b8" }}>{doc.size}</span>
                                </div>
                                <span style={{ color: "#475569" }}>
                                    {groupBy === "category" ? (doc.communityNames[0] || "\u2014") : doc.category}
                                </span>
                                <span style={{ fontSize: 11, color: "#64748b" }}>{doc.relatedRequestTitle || "\u2014"}</span>
                                <span style={{ color: "#64748b" }}>{doc.uploadedAt}</span>
                                <span>
                                    {persona.role === "Buyer" && (
                                        <button className="rc-btn rc-btn-ghost rc-btn-sm" style={{ fontSize: 10 }} onClick={() => window.alert("Download mock")}>Download</button>
                                    )}
                                    {persona.role === "Owner / Seller" && (
                                        <span style={{ fontSize: 10, color: "#166534", fontWeight: 600 }}>Uploaded</span>
                                    )}
                                    {persona.role === "Broker" && (
                                        <span style={{ fontSize: 10, color: "#4f46e5", fontWeight: 600 }}>Published</span>
                                    )}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            ))}

            {documents.length === 0 && (
                <div style={{ padding: 24, textAlign: "center", fontSize: 13, color: "#64748b", border: "1px solid #e2e8f0", borderRadius: 10 }}>
                    No documents are currently available for your transactions.
                </div>
            )}
        </div>
    );
}

import { useParams, useNavigate } from "react-router-dom";
import { getPortalRequests, getPortalDocuments } from "../../services/portalMockData";
import "./PortalOverview.css";

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    Published: { bg: "#f0fdf4", text: "#166534", border: "#bbf7d0" },
    "In Progress": { bg: "#eff6ff", text: "#1e40af", border: "#bfdbfe" },
    "Intake Review": { bg: "#faf5ff", text: "#6b21a8", border: "#ddd6fe" },
    "Quality Review": { bg: "#fffbeb", text: "#92400e", border: "#fde68a" },
    "Action Needed": { bg: "#fff7ed", text: "#9a3412", border: "#fed7aa" },
    Closed: { bg: "#f1f5f9", text: "#475569", border: "#e2e8f0" },
};

function StatusBadge({ status }: { status: string }) {
    const c = STATUS_COLORS[status] || { bg: "#f8fafc", text: "#475569", border: "#e2e8f0" };
    return (
        <span className="po-status-badge" style={{ background: c.bg, color: c.text, borderColor: c.border }}>
            {status}
        </span>
    );
}

export default function PortalRequestDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const allRequests = getPortalRequests();
    const allDocs = getPortalDocuments();

    const req = allRequests.find((r) => r.id === id);

    if (!req) {
        return (
            <div className="portal-overview">
                <div style={{ padding: 24, textAlign: "center" }}>
                    <h1 className="po-welcome-title">Request not found</h1>
                    <p className="po-welcome-sub" style={{ marginBottom: 20 }}>The request you are looking for does not exist or has been removed.</p>
                    <button className="rc-btn rc-btn-primary" onClick={() => navigate("/portal/requests")}>Back to Requests</button>
                </div>
            </div>
        );
    }

    const relatedDocs = allDocs.filter((d) => d.relatedRequestId === req.requestId || d.transactionId === req.transactionId);

    return (
        <div className="portal-overview" style={{ maxWidth: 740 }}>
            <div style={{ marginBottom: 20 }}>
                <span style={{ fontSize: 12, color: "#6366f1", fontWeight: 600, cursor: "pointer" }} onClick={() => navigate(-1)}>&larr; Back</span>
            </div>

            <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 24, background: "#fff", marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                    <div>
                        <h1 className="po-welcome-title" style={{ fontSize: 20 }}>{req.title}</h1>
                        <span style={{ fontSize: 12, color: "#64748b", fontFamily: '"SF Mono", "Cascadia Code", "Consolas", monospace' }}>{req.requestId}</span>
                    </div>
                    <StatusBadge status={req.status} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                    <div>
                        <span style={{ fontSize: 11, color: "#64748b", display: "block" }}>Category</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{req.category}</span>
                    </div>
                    <div>
                        <span style={{ fontSize: 11, color: "#64748b", display: "block" }}>Community</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{req.communityNames[0] || "\u2014"}</span>
                    </div>
                    <div>
                        <span style={{ fontSize: 11, color: "#64748b", display: "block" }}>Last Updated</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{req.updatedAt || req.neededBy || "\u2014"}</span>
                    </div>
                    <div>
                        <span style={{ fontSize: 11, color: "#64748b", display: "block" }}>Priority</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{req.priority}</span>
                    </div>
                    <div>
                        <span style={{ fontSize: 11, color: "#64748b", display: "block" }}>Transaction</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{req.transactionName}</span>
                    </div>
                    <div>
                        <span style={{ fontSize: 11, color: "#64748b", display: "block" }}>Team</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{req.team}</span>
                    </div>
                </div>
            </div>

            {req._publishedExternal && (
                <div style={{ border: "1px solid #bbf7d0", borderRadius: 10, padding: 20, background: "#f0fdf4", marginBottom: 20 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#166534" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span style={{ fontSize: 14, fontWeight: 700, color: "#166534" }}>Published &mdash; Ready to Review</span>
                    </div>
                    {relatedDocs.length > 0 ? (
                        <div>
                            <span style={{ fontSize: 12, fontWeight: 700, color: "#166534", display: "block", marginBottom: 8 }}>Documents ({relatedDocs.length})</span>
                            {relatedDocs.slice(0, 10).map((doc) => (
                                <div key={doc.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid #dcfce7" }}>
                                    <div>
                                        <span style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{doc.name}</span>
                                        <span style={{ fontSize: 11, color: "#64748b", marginLeft: 8 }}>{doc.category}</span>
                                    </div>
                                    <span style={{ fontSize: 11, color: "#6366f1", fontWeight: 600, cursor: "pointer" }}>Download</span>
                                </div>
                            ))}
                        </div>
                    ) : req._publishedWithoutDocuments ? (
                        <span style={{ fontSize: 12, color: "#92400e", fontStyle: "italic" }}>No documents available for this request.</span>
                    ) : (
                        <span style={{ fontSize: 12, color: "#64748b" }}>Documents are being prepared for review.</span>
                    )}
                </div>
            )}

            <div style={{ border: "1px dashed #d1d5db", borderRadius: 10, padding: 20, textAlign: "center", background: "#fafbfc" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 6px" }}>
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <div style={{ fontSize: 13, color: "#64748b", marginBottom: 6 }}>No external communication has been recorded yet.</div>
                <div style={{ fontSize: 11, color: "#94a3b8", fontStyle: "italic" }}>Email notifications will be enabled in a future phase.</div>
            </div>
        </div>
    );
}

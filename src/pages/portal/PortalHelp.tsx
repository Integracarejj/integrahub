import { getActivePersona } from "../../services/portalMockData";

export default function PortalHelp() {
    const persona = getActivePersona();

    return (
        <div className="portal-overview" style={{ maxWidth: 740 }}>
            <h1 className="po-welcome-title">Help</h1>
            <p className="po-welcome-sub" style={{ marginBottom: 20 }}>
                Frequently asked questions and role guides for the Recapitalization Portal.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 28 }}>
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 18, background: "#fff" }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", margin: "0 0 6px" }}>Your Role: {persona.role}</h3>
                    <p style={{ fontSize: 13, color: "#334155", margin: 0, lineHeight: 1.6 }}>
                        {persona.role === "Broker" && "As a Broker, you coordinate the due diligence package between the Owner/Seller and the Buyer. You can upload DD packages, monitor bottlenecks, route clarifications, and track overall progress."}
                        {persona.role === "Owner / Seller" && "As the Owner/Seller, your primary responsibility is to upload requested documents and respond to clarifications from the Buyer and DD team. The portal shows what documents have been requested and which are still outstanding."}
                        {persona.role === "Buyer" && "As the Buyer, you review available documents, track diligence progress, and submit new requests as needed. The portal shows what documents have been provided and what is still in progress."}
                    </p>
                </div>
            </div>

            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 12 }}>External Portal Roles</h2>

            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 28 }}>
                <div style={{ border: "1px solid #eef2ff", borderRadius: 10, padding: 16, background: "#f8faff" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#eef2ff", color: "#4338ca", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>MB</div>
                        <div>
                            <span style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", display: "block" }}>Broker</span>
                            <span style={{ fontSize: 11, color: "#64748b" }}>ABCto123 Associates &middot; broker@mail.com</span>
                        </div>
                    </div>
                    <p style={{ fontSize: 13, color: "#334155", margin: 0, lineHeight: 1.6 }}>
                        The Broker manages the end-to-end due diligence process. They upload the initial DD package (typically an Excel request list), coordinate requests between the seller and buyer, answer clarifications, route items to the right teams, and monitor bottlenecks. The Broker has the most comprehensive view of the transaction.
                    </p>
                </div>

                <div style={{ border: "1px solid #fff7ed", borderRadius: 10, padding: 16, background: "#fffbeb" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#fff7ed", color: "#92400e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>AC</div>
                        <div>
                            <span style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", display: "block" }}>Owner / Seller</span>
                            <span style={{ fontSize: 11, color: "#64748b" }}>ABC Company &middot; abc@mail.com</span>
                        </div>
                    </div>
                    <p style={{ fontSize: 13, color: "#334155", margin: 0, lineHeight: 1.6 }}>
                        The Owner/Seller is the company being acquired. Their role in the portal is focused on fulfilling document requests from the buyer and DD team. They can see which documents have been requested, upload the requested materials, and respond to any clarifications. They do not see admin-level controls or other companies' data.
                    </p>
                </div>

                <div style={{ border: "1px solid #f0fdf4", borderRadius: 10, padding: 16, background: "#f0fdfa" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#f0fdf4", color: "#166534", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>JR</div>
                        <div>
                            <span style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", display: "block" }}>Buyer</span>
                            <span style={{ fontSize: 11, color: "#64748b" }}>123 Corporation &middot; 123@mail.com</span>
                        </div>
                    </div>
                    <p style={{ fontSize: 13, color: "#334155", margin: 0, lineHeight: 1.6 }}>
                        The Buyer is the acquiring party. They use the portal to review documents made available by the seller, track due diligence progress, submit new requests, and ask questions about the transaction. The Buyer sees only their active transaction and cannot view seller-only obligations or unrelated transactions.
                    </p>
                </div>
            </div>

            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 12 }}>Frequently Asked Questions</h2>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 16, background: "#fff" }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", margin: "0 0 4px" }}>What is the Recapitalization Portal?</h3>
                    <p style={{ fontSize: 13, color: "#334155", margin: 0, lineHeight: 1.6 }}>
                        The Recapitalization Portal is a secure, external-facing platform for brokers, sellers, and buyers participating in IntegraCare recapitalization transactions. It provides visibility into the due diligence process, document sharing, and a structured channel for questions and requests. Each role sees only the data relevant to their responsibilities.
                    </p>
                </div>
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 16, background: "#fff" }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", margin: "0 0 4px" }}>How do I submit a due diligence request?</h3>
                    <p style={{ fontSize: 13, color: "#334155", margin: 0, lineHeight: 1.6 }}>
                        Navigate to <strong>Submit / Communicate</strong> from the sidebar, select the transaction, fill in the details, choose a priority, and submit. The DD team will review and begin work on your request.
                    </p>
                </div>
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 16, background: "#fff" }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", margin: "0 0 4px" }}>How do I ask a general question?</h3>
                    <p style={{ fontSize: 13, color: "#334155", margin: 0, lineHeight: 1.6 }}>
                        Use the <strong>Ask a General Question</strong> tab on the Submit / Communicate page to submit general questions about the transaction. The DD team will respond, and you can track the status on that same page.
                    </p>
                </div>
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 16, background: "#fff" }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", margin: "0 0 4px" }}>What is the difference between a Question and a Clarification?</h3>
                    <p style={{ fontSize: 13, color: "#334155", margin: 0, lineHeight: 1.6 }}>
                        A <strong>Question</strong> is a general inquiry about the transaction. A <strong>Clarification</strong> is specifically about an existing due diligence request where you need more information or explanation about what was provided.
                    </p>
                </div>
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 16, background: "#fff" }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", margin: "0 0 4px" }}>Who can see my questions and requests?</h3>
                    <p style={{ fontSize: 13, color: "#334155", margin: 0, lineHeight: 1.6 }}>
                        Only the IntegraCare DD team and users assigned to your transaction can see your submissions. Internal IntegraSource users who are not on the DD team cannot access the portal.
                    </p>
                </div>
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 16, background: "#fff" }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", margin: "0 0 4px" }}>How do I upload documents?</h3>
                    <p style={{ fontSize: 13, color: "#334155", margin: 0, lineHeight: 1.6 }}>
                        {persona.role === "Owner / Seller" && "Navigate to the Requests page and click Upload next to any open or in-progress request. You can also use the Submit / Communicate page to respond to clarifications."}
                        {persona.role === "Broker" && "Use the Upload DD Package tab on the Submit / Communicate page to upload bulk request lists. Individual document upload is available from the Requests page."}
                        {persona.role === "Buyer" && "Document upload is managed by the Broker and Owner/Seller. You can view and download available documents from the Documents page."}
                    </p>
                </div>
            </div>
        </div>
    );
}

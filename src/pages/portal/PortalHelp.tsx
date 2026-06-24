export default function PortalHelp() {
    return (
        <div className="portal-overview" style={{ maxWidth: 700 }}>
            <h1 className="po-welcome-title">Help</h1>
            <p className="po-welcome-sub" style={{ marginBottom: 24 }}>
                Frequently asked questions about the Recapitalization Portal.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ border: "1px solid var(--is-border-soft, #bfdbfe)", borderRadius: 10, padding: 18, background: "#fff" }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--is-text-heading)", margin: "0 0 6px" }}>What is the Recapitalization Portal?</h3>
                    <p style={{ fontSize: 13, color: "var(--is-text-helper, #334155)", margin: 0, lineHeight: 1.6 }}>
                        The Recapitalization Portal is a secure, external-facing platform for brokers and buyers participating in IntegraCare recapitalization transactions. It provides visibility into the due diligence process, document sharing, and a structured channel for questions and requests.
                    </p>
                </div>
                <div style={{ border: "1px solid var(--is-border-soft, #bfdbfe)", borderRadius: 10, padding: 18, background: "#fff" }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--is-text-heading)", margin: "0 0 6px" }}>How do I submit a due diligence request?</h3>
                    <p style={{ fontSize: 13, color: "var(--is-text-helper, #334155)", margin: 0, lineHeight: 1.6 }}>
                        Navigate to <strong>Submit New Request</strong> from the sidebar, select the transaction, fill in the details, choose a priority, and submit. The DD team will review and begin work on your request.
                    </p>
                </div>
                <div style={{ border: "1px solid var(--is-border-soft, #bfdbfe)", borderRadius: 10, padding: 18, background: "#fff" }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--is-text-heading)", margin: "0 0 6px" }}>How do I ask a general question?</h3>
                    <p style={{ fontSize: 13, color: "var(--is-text-helper, #334155)", margin: 0, lineHeight: 1.6 }}>
                        Use the <strong>Ask Question</strong> page to submit general questions about a transaction. The DD team will respond to your question, and you can track the status on that same page.
                    </p>
                </div>
                <div style={{ border: "1px solid var(--is-border-soft, #bfdbfe)", borderRadius: 10, padding: 18, background: "#fff" }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--is-text-heading)", margin: "0 0 6px" }}>What is the difference between a Question and a Clarification?</h3>
                    <p style={{ fontSize: 13, color: "var(--is-text-helper, #334155)", margin: 0, lineHeight: 1.6 }}>
                        A <strong>Question</strong> is a general inquiry about a transaction. A <strong>Clarification</strong> is specifically about an existing due diligence request where you need more information or explanation about what was provided.
                    </p>
                </div>
                <div style={{ border: "1px solid var(--is-border-soft, #bfdbfe)", borderRadius: 10, padding: 18, background: "#fff" }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--is-text-heading)", margin: "0 0 6px" }}>Who can see my questions and requests?</h3>
                    <p style={{ fontSize: 13, color: "var(--is-text-helper, #334155)", margin: 0, lineHeight: 1.6 }}>
                        Only the IntegraCare DD team and users assigned to your transaction can see your submissions. Internal IntegraSource users who are not on the DD team cannot access the portal.
                    </p>
                </div>
            </div>
        </div>
    );
}

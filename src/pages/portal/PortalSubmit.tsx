import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
    getPortalTransactions,
    getPortalRequests,
    getPortalQuestions,
    getPortalClarifications,
    submitPortalQuestion,
    submitPortalClarification,
    submitPortalNewRequest,
    submitBrokerUploadPackage,
    confirmBrokerPackage,
    getActivePersona,
} from "../../services/portalMockData";
import "./PortalSubmit.css";

const QUESTION_TYPES = ["Financial", "Operational", "Legal", "Compliance", "Regulatory", "Clinical", "Workforce", "General"];
const CATEGORIES = ["Financial", "Operational", "Compliance", "Legal", "Regulatory", "Clinical", "Workforce", "IT Systems"];
const PRIORITIES = ["High", "Medium", "Low"];

const PERSONA_TAGLINES: Record<string, string> = {
    "Broker": "Coordinate a request or submit a package.",
    "Buyer": "Ask a question or submit a new diligence request.",
    "Owner / Seller": "Respond to a request or upload supporting documents.",
};

interface CommunitySelectorProps {
    communities: { id: string; name: string }[];
    selectedIds: string[];
    onChange: (ids: string[]) => void;
}

function CommunitySelector({ communities, selectedIds, onChange }: CommunitySelectorProps) {
    if (communities.length === 0) return null;

    const allSelected = selectedIds.length === communities.length;

    function toggleAll() {
        if (allSelected) {
            onChange([]);
        } else {
            onChange(communities.map(c => c.id));
        }
    }

    function toggleOne(id: string) {
        if (selectedIds.includes(id)) {
            onChange(selectedIds.filter(s => s !== id));
        } else {
            onChange([...selectedIds, id]);
        }
    }

    return (
        <div className="cs-container">
            <label className="cs-label">Community Scope</label>
            <div className="cs-chips">
                {communities.length > 1 && (
                    <button
                        type="button"
                        className={`cs-chip ${allSelected ? "cs-chip-active" : ""}`}
                        onClick={toggleAll}
                    >
                        All Communities
                    </button>
                )}
                {communities.map(c => (
                    <button
                        key={c.id}
                        type="button"
                        className={`cs-chip ${selectedIds.includes(c.id) ? "cs-chip-active" : ""}`}
                        onClick={() => toggleOne(c.id)}
                    >
                        {c.name}
                    </button>
                ))}
            </div>
        </div>
    );
}

function QuestionForm({ transactions }: { transactions: ReturnType<typeof getPortalTransactions> }) {
    const [txnId, setTxnId] = useState(transactions[0]?.id || "");
    const [communityIds, setCommunityIds] = useState<string[]>([]);
    const [questionType, setQuestionType] = useState("General");
    const [subject, setSubject] = useState("");
    const [details, setDetails] = useState("");
    const [submitted, setSubmitted] = useState(false);
    const txn = transactions.find(t => t.id === txnId);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!subject.trim() || !details.trim()) return;
        submitPortalQuestion({
            transactionId: txnId,
            communityIds,
            communityNames: (txn?.communities || []).filter(c => communityIds.includes(c.id)).map(c => c.name),
            questionType,
            subject: subject.trim(),
            details: details.trim(),
        });
        setSubmitted(true);
    };

    if (submitted) {
        return <div className="ps-success-banner">Your question has been submitted. The DD team will respond within 2 business days.</div>;
    }

    return (
        <form onSubmit={handleSubmit} className="ps-form">
            <div className="ps-field">
                <label>Transaction</label>
                <select value={txnId} onChange={e => setTxnId(e.target.value)} className="ps-select">
                    {transactions.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
            </div>
            {txn && <CommunitySelector communities={txn.communities} selectedIds={communityIds} onChange={setCommunityIds} />}
            <div className="ps-field">
                <label>Question Type</label>
                <select value={questionType} onChange={e => setQuestionType(e.target.value)} className="ps-select">
                    {QUESTION_TYPES.map(qt => <option key={qt} value={qt}>{qt}</option>)}
                </select>
            </div>
            <div className="ps-field">
                <label>Subject</label>
                <input type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Brief subject line" className="ps-input" />
            </div>
            <div className="ps-field">
                <label>Details</label>
                <textarea value={details} onChange={e => setDetails(e.target.value)} placeholder="Describe your question in detail..." className="ps-textarea" rows={5} />
            </div>
            <button type="submit" className="rc-btn rc-btn-primary" disabled={!subject.trim() || !details.trim()}>Submit Question</button>
        </form>
    );
}

function ClarificationForm({ transactions }: { transactions: ReturnType<typeof getPortalTransactions> }) {
    const allRequests = getPortalRequests();
    const [txnId, setTxnId] = useState(transactions[0]?.id || "");
    const [communityIds, setCommunityIds] = useState<string[]>([]);
    const [requestId, setRequestId] = useState("");
    const [details, setDetails] = useState("");
    const [submitted, setSubmitted] = useState(false);
    const txn = transactions.find(t => t.id === txnId);
    const txnRequests = allRequests.filter(r => r.transactionId === txnId);
    const selectedReq = txnRequests.find(r => r.id === requestId);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!requestId || !details.trim()) return;
        submitPortalClarification({
            transactionId: txnId,
            communityIds,
            communityNames: (txn?.communities || []).filter(c => communityIds.includes(c.id)).map(c => c.name),
            requestId: selectedReq?.requestId || requestId,
            requestTitle: selectedReq?.title || "",
            details: details.trim(),
        });
        setSubmitted(true);
    };

    if (submitted) {
        return <div className="ps-success-banner">Your clarification request has been submitted. The DD team will respond within 2 business days.</div>;
    }

    return (
        <form onSubmit={handleSubmit} className="ps-form">
            <div className="ps-field">
                <label>Transaction</label>
                <select value={txnId} onChange={e => { setTxnId(e.target.value); setRequestId(""); }} className="ps-select">
                    {transactions.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
            </div>
            {txn && <CommunitySelector communities={txn.communities} selectedIds={communityIds} onChange={setCommunityIds} />}
            <div className="ps-field">
                <label>Existing Request</label>
                <select value={requestId} onChange={e => setRequestId(e.target.value)} className="ps-select">
                    <option value="">Select a request...</option>
                    {txnRequests.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
                </select>
            </div>
            <div className="ps-field">
                <label>Clarification Details</label>
                <textarea value={details} onChange={e => setDetails(e.target.value)} placeholder="What needs clarification?" className="ps-textarea" rows={5} />
            </div>
            <button type="submit" className="rc-btn rc-btn-primary" disabled={!requestId || !details.trim()}>Submit Clarification</button>
        </form>
    );
}

function NewRequestForm({ transactions }: { transactions: ReturnType<typeof getPortalTransactions> }) {
    const [txnId, setTxnId] = useState(transactions[0]?.id || "");
    const [communityIds, setCommunityIds] = useState<string[]>([]);
    const [category, setCategory] = useState("Financial");
    const [title, setTitle] = useState("");
    const [details, setDetails] = useState("");
    const [priority, setPriority] = useState("Medium");
    const [neededBy, setNeededBy] = useState("");
    const [submitted, setSubmitted] = useState(false);
    const txn = transactions.find(t => t.id === txnId);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !details.trim() || !neededBy) return;
        submitPortalNewRequest({
            transactionId: txnId,
            communityIds,
            communityNames: (txn?.communities || []).filter(c => communityIds.includes(c.id)).map(c => c.name),
            category,
            title: title.trim(),
            details: details.trim(),
            priority,
            neededBy,
        });
        setSubmitted(true);
    };

    if (submitted) {
        return <div className="ps-success-banner">Your new due diligence request has been submitted. The DD team will review it shortly.</div>;
    }

    return (
        <form onSubmit={handleSubmit} className="ps-form">
            <div className="ps-field">
                <label>Transaction</label>
                <select value={txnId} onChange={e => setTxnId(e.target.value)} className="ps-select">
                    {transactions.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
            </div>
            {txn && <CommunitySelector communities={txn.communities} selectedIds={communityIds} onChange={setCommunityIds} />}
            <div className="ps-field">
                <label>Category</label>
                <select value={category} onChange={e => setCategory(e.target.value)} className="ps-select">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
            </div>
            <div className="ps-field">
                <label>Title</label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. 2024 Financial Audit Report" className="ps-input" />
            </div>
            <div className="ps-field">
                <label>Details</label>
                <textarea value={details} onChange={e => setDetails(e.target.value)} placeholder="Describe what you need..." className="ps-textarea" rows={5} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div className="ps-field">
                    <label>Priority</label>
                    <select value={priority} onChange={e => setPriority(e.target.value)} className="ps-select">
                        {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                </div>
                <div className="ps-field">
                    <label>Needed By</label>
                    <input type="date" value={neededBy} onChange={e => setNeededBy(e.target.value)} className="ps-input" />
                </div>
            </div>
            <button type="submit" className="rc-btn rc-btn-primary" disabled={!title.trim() || !details.trim() || !neededBy}>Submit Request</button>
        </form>
    );
}

function BrokerUploadForm() {
    const [uploadState, setUploadState] = useState<"idle" | "analyzing" | "complete">("idle");
    const [analysis, setAnalysis] = useState<{ detected: number; needsReview: number; duplicates: number; followUp: number; categories: string[] } | null>(null);
    const [submitted, setSubmitted] = useState(false);

    const handleUpload = () => {
        setUploadState("analyzing");
        setTimeout(() => {
            const result = submitBrokerUploadPackage();
            setAnalysis(result);
            setUploadState("complete");
        }, 1200);
    };

    const handleSubmit = () => {
        confirmBrokerPackage();
        setSubmitted(true);
    };

    if (submitted) {
        return (
            <div>
                <div className="ps-success-banner">Package submitted successfully! 300 requests published to the request tracker.</div>
                <p style={{ fontSize: 13, color: "#64748b", marginTop: 12 }}>Visit the <a href="/portal/requests">Requests</a> page to view the published items.</p>
            </div>
        );
    }

    return (
        <div>
            <p style={{ fontSize: 13, color: "#475569", marginBottom: 16, lineHeight: 1.5 }}>
                Upload an Excel DD request list or ZIP package containing requests and supporting documents. The classification engine will analyze the content and prepare it for the IntegraCare DD team.
            </p>
            <div
                style={{ border: "2px dashed #cbd5e1", borderRadius: 14, padding: "32px 20px", textAlign: "center", cursor: "pointer", background: "#fafbfc" }}
                onClick={handleUpload}
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = "#4f46e5"; e.currentTarget.style.background = "#f8faff"; }}
                onDragLeave={(e) => { e.currentTarget.style.borderColor = "#cbd5e1"; e.currentTarget.style.background = "#fafbfc"; }}
                onDrop={(e) => { e.preventDefault(); handleUpload(); }}
            >
                {uploadState === "idle" && (
                    <>
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 8px" }}>
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                        <h3 style={{ fontSize: 15, fontWeight: 700, color: "#1e293b", margin: "0 0 4px" }}>Upload DD Package</h3>
                        <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 12px" }}>Drop your file here or click to browse</p>
                        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                            <button className="rc-btn rc-btn-primary rc-btn-sm" onClick={(e) => { e.stopPropagation(); handleUpload(); }}>Browse Files</button>
                            <button className="rc-btn rc-btn-secondary rc-btn-sm" onClick={(e) => { e.stopPropagation(); handleUpload(); }}>Load ABC Gold Standard Demo Package</button>
                        </div>
                    </>
                )}
                {uploadState === "analyzing" && (
                    <div>
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 8px" }}>
                            <polyline points="23 4 23 10 17 10" />
                            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                        </svg>
                        <h3 style={{ fontSize: 15, fontWeight: 700, color: "#1e293b", margin: "0 0 4px" }}>Analyzing package...</h3>
                        <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>Classification engine processing</p>
                    </div>
                )}
                {uploadState === "complete" && analysis && (
                    <div>
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#166534" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 8px" }}>
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <h3 style={{ fontSize: 15, fontWeight: 700, color: "#166534", margin: "0 0 8px" }}>Package Analyzed</h3>
                        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 10 }}>
                            <div style={{ textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 700, color: "#1e293b" }}>{analysis.detected}</div><div style={{ fontSize: 11, color: "#64748b" }}>Requests</div></div>
                            <div style={{ textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 700, color: "#1d4ed8" }}>{analysis.needsReview}</div><div style={{ fontSize: 11, color: "#64748b" }}>Review</div></div>
                            <div style={{ textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 700, color: "#92400e" }}>{analysis.duplicates}</div><div style={{ fontSize: 11, color: "#64748b" }}>Duplicates</div></div>
                            <div style={{ textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 700, color: "#92400e" }}>{analysis.followUp}</div><div style={{ fontSize: 11, color: "#64748b" }}>Follow-Up</div></div>
                        </div>
                        <div style={{ display: "flex", gap: 4, justifyContent: "center", flexWrap: "wrap", marginBottom: 10 }}>
                            {analysis.categories.map((cat) => (
                                <span key={cat} style={{ fontSize: 10, padding: "2px 8px", background: "#eef2ff", color: "#4338ca", borderRadius: 4, fontWeight: 600 }}>{cat}</span>
                            ))}
                        </div>
                        <button className="rc-btn rc-btn-primary" onClick={(e) => { e.stopPropagation(); handleSubmit(); }}>Submit Package to IntegraCare</button>
                    </div>
                )}
            </div>
        </div>
    );
}

/* ── Main Submit Page ────────────────────────────────────────── */

export default function PortalSubmit() {
    const [searchParams] = useSearchParams();
    const persona = getActivePersona();
    const typeParam = searchParams.get("type") || "question";

    const transactions = getPortalTransactions();
    const questions = getPortalQuestions();
    const clarifications = getPortalClarifications();

    const isBroker = persona.role === "Broker";

    const TABS: { id: string; label: string }[] = [
        { id: "question", label: "Ask a General Question" },
        { id: "clarification", label: "Clarify an Existing Request" },
        { id: "new-request", label: "Submit a New DD Request" },
    ];
    if (isBroker) TABS.push({ id: "upload-package", label: "Upload DD Package" });

    const initialTab = TABS.some(t => t.id === typeParam) ? typeParam : "question";
    const [activeTab, setActiveTab] = useState(initialTab);

    return (
        <div className="portal-overview ps-page">
            <h1 className="po-welcome-title">Submit / Communicate</h1>
            <p className="po-welcome-sub" style={{ marginBottom: 20 }}>
                {PERSONA_TAGLINES[persona.role] || "Submit a question, clarification, or new request."}
            </p>

            <div className="ps-layout">
                <div className="ps-main">
                    <div className="ps-segmented">
                        {TABS.map(tab => (
                            <button
                                key={tab.id}
                                className={`ps-segmented-btn ${activeTab === tab.id ? "ps-segmented-btn-active" : ""}`}
                                onClick={() => setActiveTab(tab.id)}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="ps-form-container">
                        {activeTab === "question" && <QuestionForm transactions={transactions} />}
                        {activeTab === "clarification" && <ClarificationForm transactions={transactions} />}
                        {activeTab === "new-request" && <NewRequestForm transactions={transactions} />}
                        {activeTab === "upload-package" && isBroker && <BrokerUploadForm />}
                    </div>
                </div>

                <div className="ps-sidebar">
                    <div className="ps-sidebar-section">
                        <h3 className="ps-sidebar-title">My Recent Questions</h3>
                        {questions.slice(0, 3).map(q => (
                            <div key={q.id} className="ps-sidebar-item">
                                <div className="ps-sidebar-item-title">{q.subject}</div>
                                <div className="ps-sidebar-item-meta">
                                    <span className={`ps-sidebar-status ${q.status === "Answered" ? "ps-sidebar-status-resolved" : ""}`}>{q.status}</span>
                                    <span>{q.submittedAt}</span>
                                </div>
                            </div>
                        ))}
                        {questions.length === 0 && <div className="ps-sidebar-empty">No questions yet.</div>}
                    </div>

                    <div className="ps-sidebar-section">
                        <h3 className="ps-sidebar-title">My Recent Clarifications</h3>
                        {clarifications.slice(0, 3).map(c => (
                            <div key={c.id} className="ps-sidebar-item">
                                <div className="ps-sidebar-item-title">{c.requestTitle}</div>
                                <div className="ps-sidebar-item-meta">
                                    <span className={`ps-sidebar-status ${c.status === "Resolved" ? "ps-sidebar-status-resolved" : ""}`}>{c.status}</span>
                                    <span>{c.submittedAt}</span>
                                </div>
                            </div>
                        ))}
                        {clarifications.length === 0 && <div className="ps-sidebar-empty">No clarifications yet.</div>}
                    </div>

                    <div className="ps-sidebar-section ps-sidebar-tips">
                        <h3 className="ps-sidebar-title">Tips</h3>
                        <ul style={{ fontSize: 12, color: "#475569", margin: 0, paddingLeft: 16, lineHeight: 1.8 }}>
                            {isBroker && <li>Use <strong>Upload DD Package</strong> to submit a bulk request list.</li>}
                            {!isBroker && <li>Use <strong>Submit a New DD Request</strong> for new items.</li>}
                            <li>Include community scope to speed up routing.</li>
                            <li>Check the <strong>Requests</strong> page for existing items before submitting duplicates.</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}

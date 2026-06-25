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
} from "../../services/portalMockData";
import "./PortalSubmit.css";

type ActionType = "question" | "clarification" | "new-request";

const QUESTION_TYPES = ["Financial", "Operational", "Legal", "Compliance", "Regulatory", "Clinical", "Workforce", "General"];
const CATEGORIES = ["Financial", "Operational", "Compliance", "Legal", "Regulatory", "Clinical", "Workforce", "IT Systems"];
const PRIORITIES = ["High", "Medium", "Low"];

const ACTION_META: Record<ActionType, { label: string; icon: string; desc: string }> = {
    "question": { label: "Ask a General Question", icon: "\u003F", desc: "Submit a general question about a transaction or community." },
    "clarification": { label: "Clarify an Existing Request", icon: "\u0021", desc: "Request clarification on information previously provided." },
    "new-request": { label: "Submit a New Due Diligence Request", icon: "\u002B", desc: "Request new due diligence materials from the DD team." },
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
        <div className="ps-community-selector">
            <label className="ps-label">Communities</label>
            <div className="ps-community-actions">
                <button
                    type="button"
                    className={`ps-community-btn ${allSelected ? "ps-community-btn--active" : ""}`}
                    onClick={toggleAll}
                >
                    Portfolio-Level / All Communities
                </button>
            </div>
            <div className="ps-community-grid">
                {communities.map(c => (
                    <button
                        key={c.id}
                        type="button"
                        className={`ps-community-chip ${selectedIds.includes(c.id) ? "ps-community-chip--selected" : ""}`}
                        onClick={() => toggleOne(c.id)}
                    >
                        {c.name}
                    </button>
                ))}
            </div>
            {selectedIds.length > 0 && selectedIds.length < communities.length && (
                <span className="ps-community-hint">{selectedIds.length} community{selectedIds.length !== 1 ? "ies" : "y"} selected</span>
            )}
        </div>
    );
}

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    "Open": { bg: "#fff7ed", text: "#9a3412", border: "#fed7aa" },
    "Answered": { bg: "#f0fdf4", text: "#166534", border: "#bbf7d0" },
    "Closed": { bg: "#f8fafc", text: "#475569", border: "#e2e8f0" },
    "Resolved": { bg: "#f0fdf4", text: "#166534", border: "#bbf7d0" },
};

function SmallBadge({ status }: { status: string }) {
    const c = STATUS_COLORS[status] || { bg: "#f8fafc", text: "#475569", border: "#e2e8f0" };
    return (
        <span className="ps-badge" style={{ background: c.bg, color: c.text, borderColor: c.border }}>
            {status}
        </span>
    );
}

function QuestionForm({ onSuccess }: { onSuccess: () => void }) {
    const transactions = getPortalTransactions();
    const [txnId, setTxnId] = useState(transactions.length > 0 ? transactions[0].id : "");
    const [qType, setQType] = useState("General");
    const [subject, setSubject] = useState("");
    const [details, setDetails] = useState("");
    const [communityIds, setCommunityIds] = useState<string[]>([]);

    const txn = transactions.find(t => t.id === txnId);

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        console.log("Question:", { transactionId: txnId, questionType: qType, subject, details, communityIds });
        submitPortalQuestion({ transactionId: txnId, questionType: qType, subject, details, communityIds });
        onSuccess();
        setSubject("");
        setDetails("");
    }

    return (
        <form onSubmit={handleSubmit} className="ps-form">
            <div className="ps-field">
                <label className="ps-label">Transaction</label>
                <select className="ps-select" value={txnId} onChange={e => { setTxnId(e.target.value); setCommunityIds([]); }}>
                    {transactions.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
            </div>

            {txn && txn.communities && txn.communities.length > 0 && (
                <CommunitySelector
                    communities={txn.communities}
                    selectedIds={communityIds}
                    onChange={setCommunityIds}
                />
            )}

            {(!txn || !txn.communities || txn.communities.length === 0) && (
                <div className="ps-field">
                    <label className="ps-label">Community <span className="ps-optional">optional</span></label>
                    <input className="ps-input" type="text" placeholder="Community name (if applicable)" />
                </div>
            )}

            <div className="ps-field">
                <label className="ps-label">Question Type</label>
                <select className="ps-select" value={qType} onChange={e => setQType(e.target.value)}>
                    {QUESTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
            </div>

            <div className="ps-field">
                <label className="ps-label">Subject</label>
                <input className="ps-input" type="text" value={subject} onChange={e => setSubject(e.target.value)} required placeholder="Brief subject line" />
            </div>

            <div className="ps-field">
                <label className="ps-label">Question Details</label>
                <textarea className="ps-textarea" value={details} onChange={e => setDetails(e.target.value)} required rows={4} placeholder="Describe your question in detail..." />
            </div>

            <button type="submit" className="ps-submit-btn">Submit Question</button>
        </form>
    );
}

function ClarificationForm({ onSuccess }: { onSuccess: () => void }) {
    const transactions = getPortalTransactions();
    const [txnId, setTxnId] = useState(transactions.length > 0 ? transactions[0].id : "");
    const [requestId, setRequestId] = useState("");
    const [details, setDetails] = useState("");
    const [communityIds, setCommunityIds] = useState<string[]>([]);

    const availableRequests = getPortalRequests().filter(r => r.transactionId === txnId);
    const txn = transactions.find(t => t.id === txnId);

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        console.log("Clarification:", { transactionId: txnId, requestId, details, communityIds });
        submitPortalClarification({ transactionId: txnId, requestId, details, communityIds });
        onSuccess();
        setDetails("");
    }

    return (
        <form onSubmit={handleSubmit} className="ps-form">
            <div className="ps-field">
                <label className="ps-label">Transaction</label>
                <select className="ps-select" value={txnId} onChange={e => { setTxnId(e.target.value); setRequestId(""); setCommunityIds([]); }}>
                    {transactions.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
            </div>

            {txn && txn.communities && txn.communities.length > 0 && (
                <CommunitySelector
                    communities={txn.communities}
                    selectedIds={communityIds}
                    onChange={setCommunityIds}
                />
            )}

            <div className="ps-field">
                <label className="ps-label">Existing Request</label>
                <select className="ps-select" value={requestId} onChange={e => setRequestId(e.target.value)} required>
                    <option value="">Select a request...</option>
                    {availableRequests.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
                </select>
            </div>

            <div className="ps-field">
                <label className="ps-label">Clarification Details</label>
                <textarea className="ps-textarea" value={details} onChange={e => setDetails(e.target.value)} required rows={4} placeholder="Describe what needs clarification..." />
            </div>

            <button type="submit" className="ps-submit-btn">Submit Clarification Request</button>
        </form>
    );
}

function NewRequestForm({ onSuccess }: { onSuccess: () => void }) {
    const transactions = getPortalTransactions();
    const [txnId, setTxnId] = useState(transactions.length > 0 ? transactions[0].id : "");
    const [category, setCategory] = useState("Financial");
    const [title, setTitle] = useState("");
    const [details, setDetails] = useState("");
    const [priority, setPriority] = useState("Medium");
    const [neededBy, setNeededBy] = useState("");
    const [communityIds, setCommunityIds] = useState<string[]>([]);
    const [notes, setNotes] = useState("");

    const txn = transactions.find(t => t.id === txnId);

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        console.log("New Request:", { transactionId: txnId, category, title, details, priority, neededBy, communityIds, notes });
        submitPortalNewRequest({ transactionId: txnId, category, title, details, priority, neededBy, communityIds });
        onSuccess();
        setTitle("");
        setDetails("");
        setNeededBy("");
        setNotes("");
    }

    return (
        <form onSubmit={handleSubmit} className="ps-form">
            <div className="ps-field">
                <label className="ps-label">Transaction</label>
                <select className="ps-select" value={txnId} onChange={e => { setTxnId(e.target.value); setCommunityIds([]); }}>
                    {transactions.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
            </div>

            {txn && txn.communities && txn.communities.length > 0 && (
                <CommunitySelector
                    communities={txn.communities}
                    selectedIds={communityIds}
                    onChange={setCommunityIds}
                />
            )}

            {(!txn || !txn.communities || txn.communities.length === 0) && (
                <div className="ps-field">
                    <label className="ps-label">Communities Impacted <span className="ps-optional">optional</span></label>
                    <input className="ps-input" type="text" placeholder="e.g., All facilities, or specific community names" />
                </div>
            )}

            <div className="ps-field">
                <label className="ps-label">Category</label>
                <select className="ps-select" value={category} onChange={e => setCategory(e.target.value)}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
            </div>

            <div className="ps-field">
                <label className="ps-label">Request Title</label>
                <input className="ps-input" type="text" value={title} onChange={e => setTitle(e.target.value)} required placeholder="e.g., Medicare Cost Reports (2023-2025)" />
            </div>

            <div className="ps-field">
                <label className="ps-label">Request Details</label>
                <textarea className="ps-textarea" value={details} onChange={e => setDetails(e.target.value)} required rows={4} placeholder="Describe what you need, including specific documents, date ranges, facilities, etc." />
            </div>

            <div className="ps-row">
                <div className="ps-field">
                    <label className="ps-label">Priority</label>
                    <select className="ps-select" value={priority} onChange={e => setPriority(e.target.value)}>
                        {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                </div>
                <div className="ps-field">
                    <label className="ps-label">Needed By</label>
                    <input className="ps-input" type="date" value={neededBy} onChange={e => setNeededBy(e.target.value)} required />
                </div>
            </div>

            <div className="ps-field">
                <label className="ps-label">Supporting Attachment <span className="ps-optional">optional — coming soon</span></label>
                <div className="ps-upload-placeholder">
                    <span>Attachments will be supported in a future update.</span>
                </div>
            </div>

            <div className="ps-field">
                <label className="ps-label">Notes <span className="ps-optional">optional</span></label>
                <textarea className="ps-textarea" value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Any additional context or instructions..." />
            </div>

            <button type="submit" className="ps-submit-btn">Submit Request</button>
        </form>
    );
}

export default function PortalSubmit() {
    const [searchParams, setSearchParams] = useSearchParams();
    const typeParam = searchParams.get("type") as ActionType | null;
    const [action, setAction] = useState<ActionType>(typeParam || "question");
    const [showSuccess, setShowSuccess] = useState<string | null>(null);

    function handleActionChange(newAction: ActionType) {
        setAction(newAction);
        setSearchParams({ type: newAction }, { replace: true });
    }

    function handleSuccess() {
        setShowSuccess(action);
        setTimeout(() => setShowSuccess(null), 3000);
    }

    const meta = ACTION_META[action];
    const existingQuestions = getPortalQuestions().slice(0, 3);
    const existingClarifications = getPortalClarifications().slice(0, 3);

    return (
        <div className="portal-overview">
            <h1 className="ps-title">Submit / Communicate</h1>
            <p className="ps-subtitle">Choose what you need to do below, then fill out the form.</p>

            <div className="ps-segmented">
                {(Object.keys(ACTION_META) as ActionType[]).map(key => (
                    <button
                        key={key}
                        type="button"
                        className={`ps-segmented-btn ${action === key ? "ps-segmented-btn--active" : ""}`}
                        onClick={() => handleActionChange(key)}
                    >
                        <span className="ps-segmented-icon">{ACTION_META[key].icon}</span>
                        <span className="ps-segmented-label">{ACTION_META[key].label}</span>
                    </button>
                ))}
            </div>

            {showSuccess && (
                <div className="ps-success-banner">
                    Your {showSuccess === "question" ? "question" : showSuccess === "clarification" ? "clarification request" : "new request"} was submitted successfully.
                </div>
            )}

            <div className="ps-main">
                <div className="ps-form-section">
                    <div className="ps-form-header">
                        <span className="ps-form-icon">{meta.icon}</span>
                        <div>
                            <h2 className="ps-form-title">{meta.label}</h2>
                            <p className="ps-form-desc">{meta.desc}</p>
                        </div>
                    </div>

                    {action === "question" && <QuestionForm onSuccess={handleSuccess} />}
                    {action === "clarification" && <ClarificationForm onSuccess={handleSuccess} />}
                    {action === "new-request" && <NewRequestForm onSuccess={handleSuccess} />}
                </div>

                <div className="ps-sidebar-panel">
                    {action === "question" && existingQuestions.length > 0 && (
                        <div className="ps-panel-card">
                            <h3 className="ps-panel-title">Recent Questions</h3>
                            <div className="ps-panel-list">
                                {existingQuestions.map(q => (
                                    <div key={q.id} className="ps-panel-item">
                                        <div className="ps-panel-item-top">
                                            <span className="ps-panel-item-subject">{q.subject}</span>
                                            <SmallBadge status={q.status} />
                                        </div>
                                        <span className="ps-panel-item-meta">{q.transactionName}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {action === "clarification" && existingClarifications.length > 0 && (
                        <div className="ps-panel-card">
                            <h3 className="ps-panel-title">Recent Clarifications</h3>
                            <div className="ps-panel-list">
                                {existingClarifications.map(c => (
                                    <div key={c.id} className="ps-panel-item">
                                        <div className="ps-panel-item-top">
                                            <span className="ps-panel-item-subject">{c.requestTitle}</span>
                                            <SmallBadge status={c.status} />
                                        </div>
                                        <span className="ps-panel-item-meta">{c.transactionName}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="ps-panel-card">
                        <h3 className="ps-panel-title">Tips</h3>
                        <ul className="ps-tips-list">
                            <li>Be specific about what you need — include date ranges, facility names, and document types when possible.</li>
                            <li>Use the community selector to target specific communities within a transaction.</li>
                            <li>For portfolio-level requests, select "All Communities".</li>
                            <li>The DD team typically responds within 2 business days.</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}

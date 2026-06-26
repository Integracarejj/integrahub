import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
    getPortalRequests, getPortalTransactions,
    getActivePersona, submitBrokerUploadPackage, confirmBrokerPackage,
    getPortalDocuments, getPortalClarifications, getPortalQuestions,
    getPortalSubmissionsList, loadABCDemoPackage,
    parseUploadedXLSX, extractCategoriesFromParsedRows,
} from "../../services/portalMockData";
import type { ExternalDemoPersona } from "../../services/portalMockData";
import "./PortalOverview.css";

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    "Provided": { bg: "#f0fdf4", text: "#166534", border: "#bbf7d0" },
    "In Progress": { bg: "#eff6ff", text: "#1e40af", border: "#bfdbfe" },
    "Clarification Needed": { bg: "#fff7ed", text: "#9a3412", border: "#fed7aa" },
    "Under Review": { bg: "#faf5ff", text: "#6b21a8", border: "#ddd6fe" },
    "Open": { bg: "#fff7ed", text: "#9a3412", border: "#fed7aa" },
    "Overdue": { bg: "#fef2f2", text: "#991b1b", border: "#fecaca" },
    "Answered": { bg: "#f0fdf4", text: "#166534", border: "#bbf7d0" },
};

function StatusBadge({ status }: { status: string }) {
    const c = STATUS_COLORS[status] || { bg: "#f8fafc", text: "#475569", border: "#e2e8f0" };
    return (
        <span className="po-status-badge" style={{ background: c.bg, color: c.text, borderColor: c.border }}>
            {status}
        </span>
    );
}

/* ── Broker Overview ────────────────────────────────────────── */

interface AnalysisResult {
    submissionId: string;
    detected: number;
    needsReview: number;
    duplicates: number;
    followUp: number;
    categories: string[];
    packageName: string;
    isABCDemo: boolean;
}

type UploadState = "idle" | "selected" | "analyzing" | "complete" | "submitted";

function BrokerOverview({ persona }: { persona: ExternalDemoPersona }) {
    const navigate = useNavigate();
    const requests = getPortalRequests();
    const transactions = getPortalTransactions();
    const txn = transactions[0];
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [uploadState, setUploadState] = useState<UploadState>("idle");
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
    const [banner, setBanner] = useState<string | null>(null);

    const submissions = getPortalSubmissionsList();
    const needingClarification = requests.filter(r => r.status === "Clarification Needed").length;
    const waitingOnInternal = requests.filter(r => r.status === "In Progress" || r.status === "Open").length;
    const provided = requests.filter(r => r.status === "Provided" || r.status === "Under Review").length;

    const resetUpload = useCallback(() => {
        setUploadState("idle");
        setSelectedFile(null);
        setAnalysis(null);
        setBanner(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    }, []);

    const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setUploadState("idle");
            setAnalysis(null);
            setBanner(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
            setSelectedFile(file);
            setUploadState("selected");
            setBanner(`File selected: ${file.name}`);
            setTimeout(() => setBanner(null), 4000);
        }
    };

    const handleBrowseClick = () => {
        fileInputRef.current?.click();
    };

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const file = e.dataTransfer.files?.[0];
        if (file) {
            setUploadState("idle");
            setAnalysis(null);
            setBanner(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
            setSelectedFile(file);
            setUploadState("selected");
            setBanner(`File selected: ${file.name}`);
            setTimeout(() => setBanner(null), 4000);
        }
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "copy";
    }, []);

    const handleDragEnter = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleAnalyzePackage = async () => {
        if (!selectedFile) return;
        setUploadState("analyzing");
        setBanner(null);
        try {
            const parsed = await parseUploadedXLSX(selectedFile);
            const cats = extractCategoriesFromParsedRows(parsed.rows);
            const result = submitBrokerUploadPackage(selectedFile.name, parsed.count, cats);
            setAnalysis(result);
            setUploadState("complete");
        } catch (err) {
            setBanner(`Error parsing file: ${err instanceof Error ? err.message : "Unknown error"}`);
            setUploadState("selected");
            setTimeout(() => setBanner(null), 5000);
        }
    };

    const handleLoadABCDemo = () => {
        loadABCDemoPackage();
        setUploadState("analyzing");
        setSelectedFile(null);
        setBanner("Loading ABC Gold Standard Demo Package...");
        setTimeout(() => {
            const result = submitBrokerUploadPackage("ABC Gold Standard Demo Package");
            setAnalysis(result);
            setUploadState("complete");
            setBanner("ABC Gold Standard Demo Package loaded and analyzed.");
            setTimeout(() => setBanner(null), 5000);
        }, 1500);
    };

    const handleSubmitPackage = () => {
        if (!analysis) return;
        confirmBrokerPackage(analysis.submissionId);
        setUploadState("submitted");
        setBanner("Package submitted successfully!");
    };

    const dropZoneProps = {
        onDrop: handleDrop,
        onDragOver: handleDragOver,
        onDragEnter: handleDragEnter,
        onDragLeave: handleDragLeave,
    };

    return (
        <div className="portal-overview">
            {banner && (
                <div style={{
                    padding: "10px 16px", marginBottom: 16, borderRadius: 8, fontSize: 13, fontWeight: 600,
                    background: uploadState === "submitted" ? "#f0fdf4" : "#eff6ff",
                    color: uploadState === "submitted" ? "#166534" : "#1d4ed8",
                    border: `1px solid ${uploadState === "submitted" ? "#bbf7d0" : "#bfdbfe"}`,
                }}>
                    {banner}
                </div>
            )}

            <div className="po-welcome">
                <div className="po-welcome-text">
                    <h1 className="po-welcome-title">Broker Dashboard</h1>
                    <p className="po-welcome-sub">{persona.companyName} &middot; {txn?.name || "ABC Company Portfolio"}</p>
                </div>
            </div>

            {uploadState !== "submitted" && (
                <div className="po-upload-section" style={{
                    border: "2px dashed #cbd5e1", borderRadius: 14, padding: 28, marginBottom: 20,
                    textAlign: "center", background: "#fafbfc",
                }} {...dropZoneProps}>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        style={{ display: "none" }}
                        onChange={handleFileSelected}
                    />

                    {uploadState === "idle" && (
                        <>
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 10px" }}>
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="17 8 12 3 7 8" />
                                <line x1="12" y1="3" x2="12" y2="15" />
                            </svg>
                            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", margin: "0 0 4px" }}>Upload Due Diligence Package</h3>
                            <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 16px" }}>Upload Excel request list or ZIP package containing requests and supporting documents.</p>
                            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                                <button className="rc-btn rc-btn-primary" onClick={handleBrowseClick}>Browse Files</button>
                                <button className="rc-btn rc-btn-secondary" onClick={handleLoadABCDemo}>Load ABC Gold Standard Demo Package</button>
                            </div>
                        </>
                    )}

                    {uploadState === "selected" && (
                        <>
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 10px" }}>
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                                <line x1="12" y1="18" x2="12" y2="12" />
                                <line x1="9" y1="15" x2="15" y2="15" />
                            </svg>
                            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", margin: "0 0 4px" }}>File Selected</h3>
                            <p style={{ fontSize: 14, color: "#4f46e5", fontWeight: 600, margin: "0 0 14px" }}>{selectedFile!.name}</p>
                            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                                <button className="rc-btn rc-btn-primary" onClick={handleAnalyzePackage}>Analyze Package</button>
                                <button className="rc-btn rc-btn-secondary" onClick={resetUpload}>Start Over</button>
                            </div>
                        </>
                    )}

                    {uploadState === "analyzing" && (
                        <div>
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 10px" }}>
                                <polyline points="23 4 23 10 17 10" />
                                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                            </svg>
                            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", margin: "0 0 4px" }}>Analyzing package...</h3>
                            <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>Reading spreadsheet and classifying {selectedFile?.name}...</p>
                            <div style={{ width: "60%", height: 6, background: "#e2e8f0", borderRadius: 3, margin: "12px auto 0", overflow: "hidden" }}>
                                <div style={{ width: "60%", height: "100%", background: "#4f46e5", borderRadius: 3 }} />
                            </div>
                        </div>
                    )}

                    {uploadState === "complete" && analysis && (
                        <div>
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#166534" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 10px" }}>
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#166534", margin: "0 0 4px" }}>Package Analyzed</h3>
                            <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 14px" }}>
                                {analysis.packageName}{analysis.isABCDemo ? " (Gold Standard Demo)" : ""} &mdash; {analysis.detected} request rows identified.
                            </p>
                            <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap", marginBottom: 14 }}>
                                <div style={{ textAlign: "center" }}><div style={{ fontSize: 20, fontWeight: 700, color: "#1e293b" }}>{analysis.detected}</div><div style={{ fontSize: 11, color: "#64748b" }}>Requests</div></div>
                                <div style={{ textAlign: "center" }}><div style={{ fontSize: 20, fontWeight: 700, color: "#1d4ed8" }}>{analysis.needsReview}</div><div style={{ fontSize: 11, color: "#64748b" }}>Needs Review</div></div>
                                <div style={{ textAlign: "center" }}><div style={{ fontSize: 20, fontWeight: 700, color: "#92400e" }}>{analysis.duplicates}</div><div style={{ fontSize: 11, color: "#64748b" }}>Duplicates</div></div>
                                <div style={{ textAlign: "center" }}><div style={{ fontSize: 20, fontWeight: 700, color: "#92400e" }}>{analysis.followUp}</div><div style={{ fontSize: 11, color: "#64748b" }}>Follow-Up</div></div>
                            </div>
                            <div style={{ display: "flex", gap: 4, justifyContent: "center", flexWrap: "wrap", marginBottom: 14 }}>
                                {analysis.categories.map((cat) => (
                                    <span key={cat} style={{ fontSize: 10, padding: "2px 8px", background: "#eef2ff", color: "#4338ca", borderRadius: 4, fontWeight: 600 }}>{cat}</span>
                                ))}
                            </div>
                            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                                <button className="rc-btn rc-btn-primary" onClick={handleSubmitPackage}>Submit Package to IntegraCare</button>
                                <button className="rc-btn rc-btn-secondary" onClick={resetUpload}>Start Over</button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {uploadState === "submitted" && (
                <div className="po-upload-section" style={{ border: "1px solid #bbf7d0", borderRadius: 14, padding: 20, marginBottom: 20, background: "#f0fdf4" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#166534" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <div>
                            <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: "#166534" }}>Package submitted successfully!</span>
                            <span style={{ display: "block", fontSize: 12, color: "#475569" }}>
                                IntegraCare will review and publish approved requests.
                            </span>
                        </div>
                    </div>
                    <button className="rc-btn rc-btn-secondary" onClick={resetUpload} style={{ marginTop: 12 }}>Upload Another Package</button>
                </div>
            )}

            <div className="po-stats-row">
                <div className="po-stat-card">
                    <span className="po-stat-value">{requests.length}</span>
                    <span className="po-stat-label">Total Requests</span>
                </div>
                <div className="po-stat-card">
                    <span className="po-stat-value po-stat-value--green">{provided}</span>
                    <span className="po-stat-label">Provided</span>
                </div>
                <div className="po-stat-card">
                    <span className="po-stat-value po-stat-value--blue">{waitingOnInternal}</span>
                    <span className="po-stat-label">Waiting on Internal</span>
                </div>
                <div className="po-stat-card">
                    <span className="po-stat-value po-stat-value--amber">{needingClarification}</span>
                    <span className="po-stat-label">Needs Clarification</span>
                </div>
            </div>

            {submissions.length > 0 && (
                <div className="po-section">
                    <h2 className="po-section-title">Recent Submissions</h2>
                    <div className="po-requests-table">
                        <div className="po-requests-header">
                            <span>Package</span><span>File</span><span>Submitted</span><span>Requests</span><span>Status</span>
                        </div>
                        {submissions.slice().reverse().map((sub) => (
                            <div key={sub.id} className="po-requests-row">
                                <span className="po-requests-title">{sub.packageName}</span>
                                <span style={{ fontSize: 12, color: "#64748b" }}>{sub.fileName}</span>
                                <span style={{ fontSize: 12, color: "#475569" }}>{new Date(sub.submittedAt).toLocaleDateString()}</span>
                                <span style={{ fontSize: 12, color: "#475569" }}>{sub.requestCount}</span>
                                <span><StatusBadge status={sub.status === "Submitted" ? "Provided" : sub.status} /></span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="po-section">
                <h2 className="po-section-title">Recent Requests</h2>
                <div className="po-requests-table">
                    <div className="po-requests-header">
                        <span>Title</span><span>Community</span><span>Status</span><span>Priority</span><span>Needed By</span><span>Owner</span>
                    </div>
                    {requests.slice(0, 10).map((req) => (
                        <div key={req.id} className="po-requests-row" onClick={() => navigate("/portal/requests")} style={{ cursor: "pointer" }}>
                            <span className="po-requests-title">{req.title}</span>
                            <span style={{ fontSize: 12, color: "#64748b" }}>{req.communityNames[0] || "\u2014"}</span>
                            <span><StatusBadge status={req.status} /></span>
                            <span className={`po-priority po-priority--${req.priority.toLowerCase()}`}>{req.priority}</span>
                            <span className="po-needed-by">{req.neededBy}</span>
                            <span style={{ fontSize: 12, color: req.owner ? "#1e293b" : "#94a3b8" }}>{req.owner || "Unassigned"}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

/* ── Owner/Seller Overview ──────────────────────────────────── */

function OwnerSellerOverview({ persona }: { persona: ExternalDemoPersona }) {
    const navigate = useNavigate();
    const requests = getPortalRequests();
    const missingDocs = requests.filter(r => r.status === "Open" || r.status === "Overdue");
    const readyToUpload = requests.filter(r => r.status === "In Progress" || r.status === "Clarification Needed");
    const provided = requests.filter(r => r.status === "Provided" || r.status === "Under Review");
    const clarificationsNeeded = getPortalClarifications().filter(c => c.status === "Open");
    const transactions = getPortalTransactions();
    const txn = transactions[0];

    const communities = txn?.communities || [];
    const communityProgress = communities.map((c) => {
        const total = requests.filter(r => r.communityNames.includes(c.name)).length;
        const done = requests.filter(r => r.communityNames.includes(c.name) && (r.status === "Provided" || r.status === "Under Review")).length;
        return { name: c.name, total, done };
    });

    return (
        <div className="portal-overview">
            <div className="po-welcome">
                <div className="po-welcome-text">
                    <h1 className="po-welcome-title">Owner / Seller Dashboard</h1>
                    <p className="po-welcome-sub">{persona.companyName} &middot; {txn?.name || "ABC Company Portfolio"}</p>
                </div>
            </div>

            <div className="po-stats-row">
                <div className="po-stat-card">
                    <span className="po-stat-value po-stat-value--amber">{missingDocs.length}</span>
                    <span className="po-stat-label">Documents Requested</span>
                </div>
                <div className="po-stat-card">
                    <span className="po-stat-value po-stat-value--blue">{readyToUpload.length}</span>
                    <span className="po-stat-label">Ready to Upload</span>
                </div>
                <div className="po-stat-card">
                    <span className="po-stat-value po-stat-value--green">{provided.length}</span>
                    <span className="po-stat-label">Provided</span>
                </div>
                <div className="po-stat-card">
                    <span className="po-stat-value po-stat-value--amber">{clarificationsNeeded.length}</span>
                    <span className="po-stat-label">Clarifications Needing Response</span>
                </div>
            </div>

            <div className="po-action-row">
                <button className="po-action-card" onClick={() => navigate("/portal/requests")}>
                    <span className="po-action-icon">&#128196;</span>
                    <span className="po-action-title">Upload Documents</span>
                    <span className="po-action-desc">Upload requested documents for the due diligence process</span>
                </button>
                <button className="po-action-card" onClick={() => navigate("/portal/submit?type=clarification")}>
                    <span className="po-action-icon">&#9993;</span>
                    <span className="po-action-title">Respond to Clarifications</span>
                    <span className="po-action-desc">{clarificationsNeeded.length} clarification{clarificationsNeeded.length !== 1 ? "s" : ""} need{clarificationsNeeded.length === 1 ? "s" : ""} your response</span>
                </button>
                <button className="po-action-card" onClick={() => navigate("/portal/submit")}>
                    <span className="po-action-icon">&#9997;</span>
                    <span className="po-action-title">Submit Documents</span>
                    <span className="po-action-desc">Upload supporting documents for open requests</span>
                </button>
            </div>

            <div className="po-section">
                <h2 className="po-section-title">Documents Requested from ABC Company</h2>
                <div className="po-requests-table">
                    <div className="po-requests-header">
                        <span>Title</span><span>Community</span><span>Status</span><span>Priority</span><span>Needed By</span><span></span>
                    </div>
                    {missingDocs.concat(readyToUpload).slice(0, 8).map((req) => (
                        <div key={req.id} className="po-requests-row" onClick={() => navigate("/portal/requests")} style={{ cursor: "pointer" }}>
                            <span className="po-requests-title">{req.title}</span>
                            <span style={{ fontSize: 12, color: "#64748b" }}>{req.communityNames[0] || "\u2014"}</span>
                            <span><StatusBadge status={req.status} /></span>
                            <span className={`po-priority po-priority--${req.priority.toLowerCase()}`}>{req.priority}</span>
                            <span className="po-needed-by">{req.neededBy}</span>
                            <span><button className="rc-btn rc-btn-primary rc-btn-sm" onClick={(e) => { e.stopPropagation(); alert("Upload document mock"); }}>Upload</button></span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="po-section">
                <h2 className="po-section-title">Progress by Community</h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
                    {communityProgress.map((cp) => (
                        <div key={cp.name} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 14, background: "#fff" }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", marginBottom: 6 }}>{cp.name}</div>
                            <div style={{ height: 8, background: "#f1f5f9", borderRadius: 4, overflow: "hidden", marginBottom: 4 }}>
                                <div style={{ height: "100%", width: cp.total > 0 ? `${(cp.done / cp.total) * 100}%` : "0%", background: "#166534", borderRadius: 4 }} />
                            </div>
                            <div style={{ fontSize: 11, color: "#64748b" }}>{cp.done}/{cp.total} provided</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

/* ── Buyer Overview ─────────────────────────────────────────── */

function BuyerOverview({ persona }: { persona: ExternalDemoPersona }) {
    const navigate = useNavigate();
    const requests = getPortalRequests();
    const documents = getPortalDocuments();
    const transactions = getPortalTransactions();
    const txn = transactions[0];
    const openClarifications = getPortalClarifications().filter(c => c.status === "Open");
    const openQuestions = getPortalQuestions().filter(q => q.status === "Open");

    const availableDocs = documents.filter(d => d.externalVisible !== false).length;
    const provided = requests.filter(r => r.status === "Provided" || r.status === "Under Review").length;
    const inProgress = requests.filter(r => r.status === "In Progress").length;
    const open = requests.filter(r => r.status === "Open").length;

    const recentPublished = documents.slice(0, 3);

    return (
        <div className="portal-overview">
            <div className="po-welcome">
                <div className="po-welcome-text">
                    <h1 className="po-welcome-title">Buyer Dashboard</h1>
                    <p className="po-welcome-sub">{persona.companyName} &middot; {txn?.name || "ABC Company Portfolio"}</p>
                </div>
            </div>

            <div className="po-stats-row">
                <div className="po-stat-card">
                    <span className="po-stat-value po-stat-value--green">{availableDocs}</span>
                    <span className="po-stat-label">Available Documents</span>
                </div>
                <div className="po-stat-card">
                    <span className="po-stat-value po-stat-value--blue">{inProgress}</span>
                    <span className="po-stat-label">In Progress</span>
                </div>
                <div className="po-stat-card">
                    <span className="po-stat-value po-stat-value--green">{provided}</span>
                    <span className="po-stat-label">Provided</span>
                </div>
                <div className="po-stat-card">
                    <span className="po-stat-value po-stat-value--amber">{open}</span>
                    <span className="po-stat-label">Open Requests</span>
                </div>
            </div>

            <div className="po-action-row">
                <button className="po-action-card" onClick={() => navigate("/portal/documents")}>
                    <span className="po-action-icon">&#128193;</span>
                    <span className="po-action-title">Browse Available Documents</span>
                    <span className="po-action-desc">{availableDocs} documents available across 5 communities</span>
                </button>
                <button className="po-action-card" onClick={() => navigate("/portal/submit?type=new-request")}>
                    <span className="po-action-icon">&#43;</span>
                    <span className="po-action-title">Submit New DD Request</span>
                    <span className="po-action-desc">Submit a new due diligence request for review</span>
                </button>
                <button className="po-action-card" onClick={() => navigate("/portal/requests")}>
                    <span className="po-action-icon">&#128202;</span>
                    <span className="po-action-title">Track Diligence Progress</span>
                    <span className="po-action-desc">View status of all due diligence requests</span>
                </button>
            </div>

            <div className="po-bottom-row">
                <div className="po-section">
                    <h2 className="po-section-title">Recently Published Documents</h2>
                    {recentPublished.length === 0 ? (
                        <div style={{ padding: 16, fontSize: 13, color: "#64748b" }}>No documents published yet.</div>
                    ) : (
                        <div className="po-requests-table">
                            <div className="po-requests-header">
                                <span>Name</span><span>Category</span><span>Community</span><span>Uploaded</span>
                            </div>
                            {recentPublished.map((doc) => (
                                <div key={doc.id} className="po-requests-row" onClick={() => navigate("/portal/documents")} style={{ cursor: "pointer" }}>
                                    <span className="po-requests-title">{doc.name}</span>
                                    <span style={{ fontSize: 12, color: "#64748b" }}>{doc.category}</span>
                                    <span style={{ fontSize: 12, color: "#64748b" }}>{doc.communityNames[0] || "\u2014"}</span>
                                    <span className="po-needed-by">{doc.uploadedAt}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="po-section po-section--narrow">
                    <h2 className="po-section-title">Open Items</h2>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {open > 0 && (
                            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 10, background: "#fff7ed", borderRadius: 8, border: "1px solid #fed7aa" }}>
                                <span style={{ fontSize: 16 }}>&#9888;</span>
                                <div>
                                    <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#92400e" }}>{open} open request{open !== 1 ? "s" : ""}</span>
                                    <span style={{ fontSize: 11, color: "#64748b" }}>Awaiting seller response</span>
                                </div>
                            </div>
                        )}
                        {openClarifications.length > 0 && (
                            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 10, background: "#eff6ff", borderRadius: 8, border: "1px solid #bfdbfe" }}>
                                <span style={{ fontSize: 16 }}>&#9993;</span>
                                <div>
                                    <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#1d4ed8" }}>{openClarifications.length} clarification{openClarifications.length !== 1 ? "s" : ""} pending</span>
                                    <span style={{ fontSize: 11, color: "#64748b" }}>Awaiting response</span>
                                </div>
                            </div>
                        )}
                        {openQuestions.length > 0 && (
                            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 10, background: "#f0fdf4", borderRadius: 8, border: "1px solid #bbf7d0" }}>
                                <span style={{ fontSize: 16 }}>&#63;</span>
                                <div>
                                    <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#166534" }}>{openQuestions.length} open question{openQuestions.length !== 1 ? "s" : ""}</span>
                                    <span style={{ fontSize: 11, color: "#64748b" }}>Awaiting answer</span>
                                </div>
                            </div>
                        )}
                        {open === 0 && openClarifications.length === 0 && openQuestions.length === 0 && (
                            <div style={{ fontSize: 13, color: "#64748b", padding: 10 }}>No open items.</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ── Main Export ────────────────────────────────────────────── */

export default function PortalOverview() {
    const persona = getActivePersona();

    if (persona.role === "Broker") return <BrokerOverview persona={persona} />;
    if (persona.role === "Owner / Seller") return <OwnerSellerOverview persona={persona} />;
    if (persona.role === "Buyer") return <BuyerOverview persona={persona} />;

    return <BrokerOverview persona={persona} />;
}

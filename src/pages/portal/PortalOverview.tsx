import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
    getPortalRequests, getPortalTransactions,
    getActivePersona, submitBrokerUploadPackage, confirmBrokerPackage,
    getPortalSubmissionsList,
    parseUploadedXLSX, extractCategoriesFromParsedRows,
    saveParsedRows, toExternalStatusInput,
    getPersonaIdentity, getLastCreatedTransactionId, clearLastCreatedTransactionId,
} from "../../services/portalMockData";
import { getExternalStatusInfo, getStatusPillStyle, getExceptionContext } from "../../services/externalStatusMapping";
import "./PortalOverview.css";

const STAT_HELPERS: Record<string, string> = {
    "Submitted": "Package received, awaiting initial review",
    "Under Review": "IntegraCare is processing this request",
    "In Progress": "IntegraCare is actively working on this request",
    "Rework Review": "IntegraCare is reviewing your requested changes",
    "Information Requested": "IntegraCare needs additional information",
    "Blocker Information Requested": "IntegraCare needs information to resolve a blocker",
    "Awaiting Your Review": "Documents ready for your review",
    "Exception Review": "Needs your decision on an exception recommendation",
    "Complete": "Review complete — no further action required",
    "Removed": "Confirmed duplicate or not applicable — removed from scope",
    "Total Requests": "All active requests",
};

function shortId(id: string): string {
    const parts = id.split("-");
    if (parts.length >= 3) {
        return parts[0] + "-" + parts[parts.length - 1];
    }
    return id;
}

function StatusBadge({ status }: { status: string }) {
    const c = getStatusPillStyle(status);
    return (
        <span className="po-status-badge" style={{ background: c.bg, color: c.text, borderColor: c.border }}>
            {status}
        </span>
    );
}

interface AnalysisResult {
    submissionId: string;
    detected: number;
    needsReview: number;
    duplicates: number;
    followUp: number;
    categories: string[];
    packageName: string;
}

type UploadState = "idle" | "selected" | "analyzing" | "complete" | "submitted";

/* ── Main Dashboard ── */

export default function PortalOverview() {
    const navigate = useNavigate();
    const persona = getActivePersona();
    const identity = getPersonaIdentity();
    const portalRequests = getPortalRequests();
    const submissions = getPortalSubmissionsList();

    // Transaction selector: filter requests by authorized transaction
    const authorizedTxns = identity?.authorizedTransactions || [];
    const allPortalTxns = identity?.allTransactions || [];
    const authorizedTxnIds = new Set(authorizedTxns.map(a => a.transactionId));
    const personaTxns = allPortalTxns.filter(t => authorizedTxnIds.has(t.id));

    // Default to the last-created transaction if available, otherwise first authorized
    const lastCreatedTxnId = getLastCreatedTransactionId();
    const defaultTxnId = lastCreatedTxnId && authorizedTxnIds.has(lastCreatedTxnId)
        ? lastCreatedTxnId
        : personaTxns.length > 0 ? personaTxns[0].id : "";
    const [selectedTxnId, setSelectedTxnId] = useState<string>(defaultTxnId);

    // Consume the "last created" hint once so it doesn't persist across future visits
    useEffect(() => { if (lastCreatedTxnId) clearLastCreatedTransactionId(); }, [lastCreatedTxnId]);

    const transactions = getPortalTransactions();
    const txn = transactions.find(t => t.id === selectedTxnId) || transactions[0];

    const scopedRequests = selectedTxnId
        ? portalRequests.filter(r => r.transactionId === selectedTxnId)
        : portalRequests;

    const fileInputRef = useRef<HTMLInputElement>(null);
    const dropZoneRef = useRef<HTMLDivElement>(null);
    const [uploadState, setUploadState] = useState<UploadState>("idle");
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
    const [banner, setBanner] = useState<string | null>(null);

    /* ── Derived Stats using centralized external status mapping ── */
    const portalStatuses = scopedRequests.map(r => getExternalStatusInfo(toExternalStatusInput(r)));
    const submittedCount = portalStatuses.filter(s => s.status === "Submitted").length;
    const underReviewCount = portalStatuses.filter(s => s.status === "Under Review").length;
    const inProgressCount = portalStatuses.filter(s => s.status === "In Progress").length;
    const infoRequestedCount = portalStatuses.filter(s => s.status === "Information Requested").length;
    const awaitingReviewCount = portalStatuses.filter(s => s.status === "Awaiting Your Review").length;
    const exceptionReviewCount = portalStatuses.filter(s => s.status === "Exception Review").length;
    const completeCount = portalStatuses.filter(s => s.status === "Complete").length;
    const removedCount = portalStatuses.filter(s => s.status.startsWith("Removed")).length;
    const reworkSubmittedCount = portalStatuses.filter(s => s.status === "Rework Review").length;
    const blockerInfoRequestedCount = portalStatuses.filter(s => s.status === "Blocker Information Requested").length;
    const visibleRequests = scopedRequests.filter(r => { const st = getExternalStatusInfo(toExternalStatusInput(r)).status; return st !== "Complete" && !st.startsWith("Removed"); });

    const [dashboardSearch, setDashboardSearch] = useState("");
    const [dashboardFilterStatus, setDashboardFilterStatus] = useState("all");
    const [dashboardFilterCategory, setDashboardFilterCategory] = useState("all");
    const dashboardCategories = [...new Set(scopedRequests.map(r => r.category))];
    const dashboardBase = dashboardFilterStatus !== "all" ? scopedRequests : visibleRequests;
    const dashboardFiltered = dashboardBase.filter(r => {
        const ext = getExternalStatusInfo(toExternalStatusInput(r));
        if (dashboardFilterStatus !== "all") {
            if (dashboardFilterStatus === "Exception Review" || dashboardFilterStatus === "Rework Review" || dashboardFilterStatus === "Blocker Information Requested") {
                if (ext.status !== dashboardFilterStatus) return false;
            }
            else if (dashboardFilterStatus === "Removed") {
                if (!ext.status.startsWith("Removed")) return false;
            }
            else if (ext.label !== dashboardFilterStatus) return false;
        }
        if (dashboardFilterCategory !== "all" && r.category !== dashboardFilterCategory) return false;
        if (dashboardSearch) {
            const q = dashboardSearch.toLowerCase();
            if (!r.title.toLowerCase().includes(q) && !r.requestId.toLowerCase().includes(q)) return false;
        }
        return true;
    });

    /* ── Refresh / Polling ── */
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
    useEffect(() => {
        const interval = setInterval(() => setLastUpdated(new Date()), 60000);
        return () => clearInterval(interval);
    }, []);
    useEffect(() => {
        const onVisible = () => {
            if (document.visibilityState === "visible") setLastUpdated(new Date());
        };
        document.addEventListener("visibilitychange", onVisible);
        return () => document.removeEventListener("visibilitychange", onVisible);
    }, []);

    /* ── Window-level drag/drop ── */
    useEffect(() => {
        const prevent = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
        };
        window.addEventListener("dragover", prevent);
        window.addEventListener("drop", prevent);
        return () => {
            window.removeEventListener("dragover", prevent);
            window.removeEventListener("drop", prevent);
        };
    }, []);

    const resetUpload = useCallback(() => {
        setUploadState("idle");
        setSelectedFile(null);
        setAnalysis(null);
        setBanner(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    }, []);

    const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setUploadState("idle");
            setAnalysis(null);
            setBanner(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
            await runFileAnalysis(file);
        }
    };

    const handleBrowseClick = () => {
        fileInputRef.current?.click();
    };

    useEffect(() => {
        const el = dropZoneRef.current;
        if (!el) return;
        const prevent = (e: Event) => { e.preventDefault(); e.stopPropagation(); };
        const onDrop = async (e: DragEvent) => {
            e.preventDefault(); e.stopPropagation();
            const file = e.dataTransfer?.files?.[0];
            if (file) {
                setUploadState("idle"); setAnalysis(null); setBanner(null);
                await runFileAnalysis(file);
            }
        };
        el.addEventListener("dragenter", prevent);
        el.addEventListener("dragover", prevent);
        el.addEventListener("dragleave", prevent);
        el.addEventListener("drop", onDrop);
        return () => {
            el.removeEventListener("dragenter", prevent);
            el.removeEventListener("dragover", prevent);
            el.removeEventListener("dragleave", prevent);
            el.removeEventListener("drop", onDrop);
        };
    }, []);

    const runFileAnalysis = async (file: File) => {
        setSelectedFile(file);
        setUploadState("analyzing");
        setBanner(null);
        try {
            const parsed = await parseUploadedXLSX(file);
            if (parsed.count === 0) {
                setBanner("We couldn't identify any due diligence requests in this spreadsheet. Please verify the file format and try again.");
                setUploadState("idle");
                setSelectedFile(null);
                setTimeout(() => setBanner(null), 8000);
                return;
            }
            saveParsedRows(parsed.rows);
            const cats = extractCategoriesFromParsedRows(parsed.rows);
            const result = submitBrokerUploadPackage(file.name, parsed.count, cats, selectedTxnId || undefined);
            setAnalysis(result);
            setUploadState("complete");
        } catch (err) {
            setBanner(`Error parsing file: ${err instanceof Error ? err.message : "Unknown error"}`);
            setUploadState("idle");
            setSelectedFile(null);
            setTimeout(() => setBanner(null), 8000);
        }
    };

    const handleSubmitPackage = () => {
        if (!analysis) return;
        confirmBrokerPackage(analysis.submissionId);
        setUploadState("submitted");
    };

    const hasSubmitted = selectedTxnId
        ? submissions.some(s => s.transactionId === selectedTxnId) || uploadState === "submitted"
        : submissions.length > 0 || uploadState === "submitted";
    const showOnlyUpload = !hasSubmitted && uploadState !== "submitted";

    /* ── Scroll ref and state ── */
    const requestsRef = useRef<HTMLDivElement>(null);
    const handleViewRequests = useCallback(() => {
        requestsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        setTimeout(() => requestsRef.current?.querySelector<HTMLElement>("input, select, a, button")?.focus(), 600);
    }, []);

    return (
        <div className="portal-overview">
            {banner && (
                <div style={{
                    padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600,
                    background: uploadState === "submitted" ? "#f0fdf4" : "#eff6ff",
                    color: uploadState === "submitted" ? "#166534" : "#1d4ed8",
                    border: `1px solid ${uploadState === "submitted" ? "#bbf7d0" : "#bfdbfe"}`,
                }}>
                    {banner}
                </div>
            )}

            {/* ── Compact Dashboard Header (no hero card) ── */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
                <div>
                    <p className="po-welcome-sub" style={{ fontSize: 15, margin: 0, color: "#334155" }}>{persona.companyName}{txn ? ` \u00b7 ${txn.name}` : ""}</p>
                </div>
                {personaTxns.length > 1 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <label style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Transaction:</label>
                        <select
                            value={selectedTxnId}
                            onChange={(e) => { setSelectedTxnId(e.target.value); setDashboardFilterStatus("all"); setDashboardFilterCategory("all"); setDashboardSearch(""); }}
                            style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "1px solid #e2e8f0", background: "#fff" }}
                        >
                            {personaTxns.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            {/* ── Upload Panel (shown before any submission) ── */}
            {showOnlyUpload && (
                <div style={{ maxWidth: 720, margin: "0 auto" }}>
                    <div style={{ textAlign: "center", marginBottom: 24 }}>
                        <h2 style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", marginBottom: 8, letterSpacing: "-0.02em" }}>Upload your due diligence request list to begin</h2>
                        <p style={{ fontSize: 15, color: "#334155", maxWidth: 600, margin: "0 auto", lineHeight: 1.6 }}>
                            Upload an Excel file (.xlsx, .xls, .csv) with your due diligence requests.
                        </p>
                    </div>

                    <div ref={dropZoneRef} className="po-upload-hero" style={{ marginBottom: 24 }}>
                        <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={handleFileSelected} />

                        {uploadState === "idle" && (
                            <>
                                <div className="po-upload-hero-icon">
                                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                        <polyline points="17 8 12 3 7 8" />
                                        <line x1="12" y1="3" x2="12" y2="15" />
                                    </svg>
                                </div>
                                <h3 style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", margin: "0 0 6px", letterSpacing: "-0.02em" }}>Upload Due Diligence Package</h3>
                                <p style={{ fontSize: 15, color: "#334155", margin: "0 0 20px" }}>Upload Excel request list (.xlsx, .xls, .csv)</p>
                                <button className="rc-btn rc-btn-primary" onClick={handleBrowseClick} style={{ padding: "14px 40px", fontSize: 16, fontWeight: 700, borderRadius: 12 }}>Browse Files</button>
                            </>
                        )}

                        {uploadState === "analyzing" && (
                            <div>
                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 12px" }}>
                                    <polyline points="23 4 23 10 17 10" />
                                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                                </svg>
                                <h3 style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", margin: "0 0 6px" }}>Analyzing package...</h3>
                                <p style={{ fontSize: 15, color: "#334155", margin: 0 }}>Reading {selectedFile?.name}...</p>
                                <div style={{ width: "50%", height: 6, background: "#c7d2fe", borderRadius: 3, margin: "14px auto 0", overflow: "hidden" }}>
                                    <div style={{ width: "60%", height: "100%", background: "#4f46e5", borderRadius: 3 }} />
                                </div>
                            </div>
                        )}

                        {uploadState === "complete" && analysis && (
                            <div>
                                <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#dcfce7", color: "#166534", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", border: "3px solid #bbf7d0" }}>
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                </div>
                                <h3 style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", margin: "0 0 8px", letterSpacing: "-0.02em" }}>Package Successfully Analyzed</h3>
                                <p style={{ fontSize: 16, color: "#334155", margin: "0 0 6px", fontWeight: 600 }}>
                                    We identified <strong style={{ color: "#0f172a" }}>{analysis.detected}</strong> potential due diligence request{analysis.detected !== 1 ? "s" : ""} in <strong style={{ color: "#0f172a" }}>{analysis.packageName}</strong>.
                                </p>
                                <p style={{ fontSize: 14, color: "#dc2626", margin: "0 0 4px", fontWeight: 700 }}>
                                    Your package has not yet been submitted to IntegraCare.
                                </p>
                                <p style={{ fontSize: 14, color: "#334155", margin: "0 0 20px", lineHeight: 1.6 }}>
                                    Review the summary below, then select <strong>Submit Package</strong> to send these requests to the IntegraCare Due Diligence Team.
                                </p>
                                <div style={{ textAlign: "center", marginBottom: 18 }}>
                                    <div style={{ fontSize: 42, fontWeight: 800, color: "#0f172a", lineHeight: 1 }}>{analysis.detected}</div>
                                    <div style={{ fontSize: 14, color: "#334155", fontWeight: 600 }}>Requests Detected</div>
                                </div>
                                <div style={{ background: "#f8faff", borderRadius: 12, border: "1px solid #dbeafe", padding: "16px 20px", marginBottom: 20, textAlign: "left" }}>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 10 }}>After submission</div>
                                    <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.8, display: "flex", flexDirection: "column", gap: 2 }}>
                                        <span>&bull; IntegraCare will review, classify, assign, and process each request</span>
                                        <span>&bull; Clarification may be requested if additional information is needed</span>
                                        <span>&bull; Approved documents will be returned through this portal for your review</span>
                                    </div>
                                </div>
                                <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                                    <button className="rc-btn rc-btn-primary" onClick={handleSubmitPackage} style={{ padding: "14px 40px", fontSize: 16, fontWeight: 700, borderRadius: 12 }}>Submit Package</button>
                                    <button className="rc-btn rc-btn-secondary" onClick={resetUpload} style={{ padding: "14px 24px", fontSize: 14, borderRadius: 12, border: "1px solid #d1d5db", color: "#0f172a", background: "#fff" }}>Upload Different Package</button>
                                </div>
                            </div>
                        )}
                    </div>

                    {uploadState === "idle" && (
                        <div style={{ maxWidth: 620, margin: "0 auto" }}>
                            <h3 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", marginBottom: 16, textAlign: "center" }}>How it works</h3>
                            <div className="po-how-it-works">
                                {[
                                    { step: "1", title: "Upload", desc: "Upload your due diligence request list as an Excel file" },
                                    { step: "2", title: "Review", desc: "IntegraCare reviews and routes your requests" },
                                    { step: "3", title: "Track", desc: "Monitor progress and published results here" },
                                ].map(s => (
                                    <div key={s.step} className="po-how-step">
                                        <div className="po-how-step-number">{s.step}</div>
                                        <div className="po-how-step-title">{s.title}</div>
                                        <div className="po-how-step-desc">{s.desc}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── Enhanced Submitted Banner ── */}
            {uploadState === "submitted" && analysis && (
                <div style={{ marginBottom: 0 }}>
                    <div className="po-submitted-banner" style={{ padding: "28px 32px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 18, justifyContent: "center", flexWrap: "wrap", marginBottom: 20 }}>
                            <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#166534", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "3px solid #86efac" }}>
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                            </div>
                            <div style={{ textAlign: "left" }}>
                                <div style={{ fontSize: 22, fontWeight: 800, color: "#166534", marginBottom: 4, letterSpacing: "-0.02em" }}>Package Submitted Successfully</div>
                                <div style={{ fontSize: 15, color: "#334155", lineHeight: 1.5 }}>
                                    <strong>{analysis.detected}</strong> request{analysis.detected !== 1 ? "s" : ""} have entered IntegraCare&rsquo;s review process.
                                </div>
                                <div style={{ fontSize: 13, color: "#475569", marginTop: 4 }}>
                                    No action is required from you right now. The IntegraCare team owns the next step.
                                </div>
                            </div>
                            <button className="rc-btn rc-btn-primary" onClick={resetUpload} style={{ padding: "10px 24px", fontSize: 13, fontWeight: 700 }}>Upload Another Package</button>
                        </div>
                        <div style={{ borderTop: "1px solid #bbf7d0", paddingTop: 16, maxWidth: 700, margin: "0 auto" }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 12, textAlign: "center" }}>How the review process works</div>
                            <div style={{ display: "flex", gap: 4, alignItems: "flex-start", justifyContent: "center", flexWrap: "wrap" }}>
                                {[
                                    { step: "1", title: "Submitted", desc: "Package received successfully." },
                                    { step: "2", title: "Initial Review", desc: "IntegraCare verifies the requests, classifications, and duplicates." },
                                    { step: "3", title: "Internal Processing", desc: "Requests are assigned to the appropriate team members." },
                                    { step: "4", title: "Questions, if needed", desc: "You may receive clarification requests or other items requiring your response." },
                                    { step: "5", title: "Ready for Your Review", desc: "Completed documents are published for your approval or rework." },
                                    { step: "6", title: "Complete", desc: "The request is closed after your approval." },
                                ].map(s => (
                                    <div key={s.step} style={{ flex: "0 1 150px", textAlign: "center", padding: "8px 6px" }}>
                                        <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#dcfce7", color: "#166534", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, margin: "0 auto 6px", border: "2px solid #bbf7d0" }}>{s.step}</div>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", marginBottom: 2 }}>{s.title}</div>
                                        <div style={{ fontSize: 11, color: "#475569", lineHeight: 1.3 }}>{s.desc}</div>
                                    </div>
                                ))}
                            </div>
                            <div style={{ fontSize: 12, color: "#475569", textAlign: "center", marginTop: 8, fontStyle: "italic" }}>
                                Requests may move through the process at different times. Your dashboard will update as each item progresses.
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Compact upload panel when user has submissions but is uploading another ── */}
            {!showOnlyUpload && uploadState !== "idle" && uploadState !== "submitted" && (
                <div className="po-compact-upload" style={{ padding: "16px 20px", marginBottom: 0 }}>
                    <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={handleFileSelected} />
                    {uploadState === "analyzing" && (
                        <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "center" }}>
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="1.5" style={{ flexShrink: 0 }}>
                                <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                            </svg>
                            <span style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>Analyzing {selectedFile?.name}...</span>
                        </div>
                    )}
                    {uploadState === "complete" && analysis && (
                        <div style={{ display: "flex", alignItems: "center", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#166534" strokeWidth="1.5" style={{ flexShrink: 0 }}>
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                            <span style={{ fontSize: 16, fontWeight: 700, color: "#166534" }}>Package Ready</span>
                            <span style={{ fontSize: 14, color: "#334155" }}>{analysis.detected} request{analysis.detected !== 1 ? "s" : ""} detected in {analysis.packageName}</span>
                            <button className="rc-btn rc-btn-primary" onClick={handleSubmitPackage} style={{ padding: "8px 20px", fontSize: 13, fontWeight: 700 }}>Submit Package</button>
                            <button className="rc-btn rc-btn-secondary" onClick={resetUpload} style={{ padding: "8px 14px", fontSize: 13 }}>Upload Different Package</button>
                        </div>
                    )}
                </div>
            )}

            {/* ── Persistent "Submit Another Package" entry when requests exist ── */}
            {hasSubmitted && uploadState === "idle" && (
                <div style={{ textAlign: "center", padding: "12px 0", marginBottom: 0 }}>
                    <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={handleFileSelected} />
                    <button
                        className="rc-btn rc-btn-secondary"
                        onClick={handleBrowseClick}
                        style={{ padding: "10px 24px", fontSize: 13, fontWeight: 700, borderRadius: 8, border: "1px solid #d1d5db" }}
                    >
                        Submit Another Package
                    </button>
                </div>
            )}

            {hasSubmitted && (
            <>
            <div className="po-stats-row">
                <div className={`po-stat-card${dashboardFilterStatus === "all" && dashboardFilterCategory === "all" ? " po-stat-card--active" : ""}`} style={{ cursor: "pointer" }} onClick={() => { setDashboardFilterStatus("all"); setDashboardFilterCategory("all"); setDashboardSearch(""); }}>
                    <span className="po-stat-value">{visibleRequests.length}</span>
                    <span className="po-stat-label">Total Requests</span>
                    <span className="po-stat-helper">{STAT_HELPERS["Total Requests"]}</span>
                </div>
                {submittedCount > 0 && (
                    <div className={`po-stat-card${dashboardFilterStatus === "Submitted" ? " po-stat-card--active" : ""}`} style={{ cursor: "pointer" }} onClick={() => { setDashboardFilterStatus("Submitted"); setDashboardFilterCategory("all"); }}>
                        <span className="po-stat-value po-stat-value--blue">{submittedCount}</span>
                        <span className="po-stat-label">Submitted</span>
                        <span className="po-stat-helper">{STAT_HELPERS["Submitted"]}</span>
                    </div>
                )}
                {underReviewCount > 0 && (
                    <div className={`po-stat-card${dashboardFilterStatus === "Under Review" ? " po-stat-card--active" : ""}`} style={{ cursor: "pointer" }} onClick={() => { setDashboardFilterStatus("Under Review"); setDashboardFilterCategory("all"); }}>
                        <span className="po-stat-value po-stat-value--blue">{underReviewCount}</span>
                        <span className="po-stat-label">Under Review</span>
                        <span className="po-stat-helper">{STAT_HELPERS["Under Review"]}</span>
                    </div>
                )}
                {inProgressCount > 0 && (
                    <div className={`po-stat-card${dashboardFilterStatus === "In Progress" ? " po-stat-card--active" : ""}`} style={{ cursor: "pointer", border: "2px solid #d4a937" }} onClick={() => { setDashboardFilterStatus("In Progress"); setDashboardFilterCategory("all"); }}>
                        <span className="po-stat-value" style={{ color: "#a16207" }}>{inProgressCount}</span>
                        <span className="po-stat-label">In Progress</span>
                        <span className="po-stat-helper">{STAT_HELPERS["In Progress"]}</span>
                    </div>
                )}
                {infoRequestedCount > 0 && (
                    <div className={`po-stat-card${dashboardFilterStatus === "Information Requested" ? " po-stat-card--active" : ""}`} style={{ cursor: "pointer" }} onClick={() => { setDashboardFilterStatus("Information Requested"); setDashboardFilterCategory("all"); }}>
                        <span className="po-stat-value po-stat-value--amber">{infoRequestedCount}</span>
                        <span className="po-stat-label">Information Requested</span>
                        <span className="po-stat-helper">{STAT_HELPERS["Information Requested"]}</span>
                    </div>
                )}
                {awaitingReviewCount > 0 && (
                    <div className={`po-stat-card${dashboardFilterStatus === "Awaiting Your Review" ? " po-stat-card--active" : ""}`} style={{ cursor: "pointer", border: "2px solid #2dd4bf" }} onClick={() => { setDashboardFilterStatus("Awaiting Your Review"); setDashboardFilterCategory("all"); }}>
                        <span className="po-stat-value po-stat-value--teal">{awaitingReviewCount}</span>
                        <span className="po-stat-label">Awaiting Your Review</span>
                        <span className="po-stat-helper">{STAT_HELPERS["Awaiting Your Review"]}</span>
                    </div>
                )}
                {exceptionReviewCount > 0 && (
                    <div className={`po-stat-card${dashboardFilterStatus === "Exception Review" ? " po-stat-card--active" : ""}`} style={{ cursor: "pointer", border: "2px solid #fb923c" }} onClick={() => { setDashboardFilterStatus("Exception Review"); setDashboardFilterCategory("all"); }}>
                        <span className="po-stat-value po-stat-value--orange">{exceptionReviewCount}</span>
                        <span className="po-stat-label">Exception Review</span>
                        <span className="po-stat-helper">{STAT_HELPERS["Exception Review"]}</span>
                    </div>
                )}
                {completeCount > 0 && (
                    <div className={`po-stat-card${dashboardFilterStatus === "Complete" ? " po-stat-card--active" : ""} po-stat-card--highlight`} style={{ cursor: "pointer" }} onClick={() => { setDashboardFilterStatus("Complete"); setDashboardFilterCategory("all"); }}>
                        <span className="po-stat-value po-stat-value--green">{completeCount}</span>
                        <span className="po-stat-label">Complete</span>
                        <span className="po-stat-helper">{STAT_HELPERS["Complete"]}</span>
                    </div>
                )}
                {reworkSubmittedCount > 0 && (
                    <div className={`po-stat-card${dashboardFilterStatus === "Rework Review" ? " po-stat-card--active" : ""}`} style={{ cursor: "pointer" }} onClick={() => { setDashboardFilterStatus("Rework Review"); setDashboardFilterCategory("all"); }}>
                        <span className="po-stat-value po-stat-value--amber">{reworkSubmittedCount}</span>
                        <span className="po-stat-label">Rework Submitted</span>
                        <span className="po-stat-helper">{STAT_HELPERS["Rework Review"]}</span>
                    </div>
                )}
                {blockerInfoRequestedCount > 0 && (
                    <div className={`po-stat-card${dashboardFilterStatus === "Blocker Information Requested" ? " po-stat-card--active" : ""}`} style={{ cursor: "pointer", border: "2px solid #fca5a5" }} onClick={() => { setDashboardFilterStatus("Blocker Information Requested"); setDashboardFilterCategory("all"); }}>
                        <span className="po-stat-value" style={{ color: "#dc2626" }}>{blockerInfoRequestedCount}</span>
                        <span className="po-stat-label">Blocker Info Needed</span>
                        <span className="po-stat-helper">{STAT_HELPERS["Blocker Information Requested"]}</span>
                    </div>
                )}
                {removedCount > 0 && (
                    <div className={`po-stat-card${dashboardFilterStatus === "Removed" ? " po-stat-card--active" : ""}`} style={{ cursor: "pointer", border: "2px solid #c4b5fd" }} onClick={() => { setDashboardFilterStatus("Removed"); setDashboardFilterCategory("all"); }}>
                        <span className="po-stat-value" style={{ color: "#6d28d9" }}>{removedCount}</span>
                        <span className="po-stat-label">Removed from Scope</span>
                        <span className="po-stat-helper">Duplicate or Not Applicable</span>
                    </div>
                )}
            </div>

            <div style={{ fontSize: 12, color: "#334155", textAlign: "right", marginBottom: 12 }}>
                Last updated: {lastUpdated.toLocaleTimeString()}
            </div>

            {/* ── View Submitted Requests Cue ── */}
            {visibleRequests.length > 0 && (
                <div style={{ textAlign: "center", padding: "8px 0 4px" }}>
                    <button
                        onClick={handleViewRequests}
                        className="rc-btn rc-btn-primary"
                        style={{ padding: "10px 28px", fontSize: 14, fontWeight: 700, borderRadius: 10 }}
                        aria-label="View submitted requests"
                    >
                        View Submitted Requests &darr;
                    </button>
                    <div style={{ fontSize: 13, color: "#475569", marginTop: 6 }}>
                        Your requests are listed below and will update as they move through the review process.
                    </div>
                </div>
            )}

            {/* ── Full-Width Requests Grid ── */}
            <div className="po-dashboard-grid" ref={requestsRef}>
                <div className="po-section">
                    <h2 className="po-section-title">Submitted Requests</h2>
                    {visibleRequests.length === 0 ? (
                        <div className="po-empty-state">
                            <div style={{ marginBottom: 12 }}>
                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto" }}>
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="17 8 12 3 7 8" />
                                    <line x1="12" y1="3" x2="12" y2="15" />
                                </svg>
                            </div>
                            <p style={{ fontSize: 16, color: "#334155", margin: "0 0 6px", fontWeight: 600 }}>No requests have been submitted yet.</p>
                            <p style={{ fontSize: 14, color: "#475569", margin: 0, lineHeight: 1.5 }}>Upload your first due diligence package to begin.</p>
                        </div>
                    ) : (
                        <>
                            <div className="po-filter-row">
                                <div className="po-search-box">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                                    <input type="text" placeholder="Search..." aria-label="Search requests" value={dashboardSearch} onChange={e => setDashboardSearch(e.target.value)} />
                                </div>
                                <select className="po-filter-select" aria-label="Filter by status" value={dashboardFilterStatus} onChange={e => setDashboardFilterStatus(e.target.value)}>
                                    <option value="all">All Statuses</option>
                                    <option value="Submitted">Submitted</option>
                                    <option value="Under Review">Under Review</option>
                                    <option value="In Progress">In Progress</option>
                                    <option value="Information Requested">Information Requested</option>
                                    <option value="Awaiting Your Review">Awaiting Your Review</option>
                                    <option value="Exception Review">Exception Review</option>
                                    <option value="Rework Review">Rework Submitted</option>
                                    <option value="Complete">Complete</option>
                                    <option value="Removed">Removed from Scope</option>
                                </select>
                                <select className="po-filter-select" aria-label="Filter by category" value={dashboardFilterCategory} onChange={e => setDashboardFilterCategory(e.target.value)}>
                                    <option value="all">All Categories</option>
                                    {dashboardCategories.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div className="po-requests-table">
                                <div className="po-requests-header" style={{ gridTemplateColumns: "0.5fr 2fr 0.9fr 0.8fr 0.9fr 0.7fr 0.7fr" }}>
                                    <span>ID</span><span>Request</span><span>Status</span><span>Review Type</span><span>Category</span><span>Community</span><span>Updated</span>
                                </div>
                                {dashboardFiltered.slice(0, 10).map((req) => {
                                    const excCtx = getExceptionContext(req);
                                    const extInfo = getExternalStatusInfo(toExternalStatusInput(req));
                                    const isClarResp = req._rawStatus === "Clarification Needed" && extInfo.status === "Under Review" && !!req._workNotes?.some(n => n.action === "Clarification Response") && !req._returnReason;
                                    const isReworking = req._partnerDecision === "Rework Required" && extInfo.status === "Rework Review";
                                    return (
                                    <div key={req.id} className="po-requests-row" style={{ gridTemplateColumns: "0.5fr 2fr 0.9fr 0.8fr 0.9fr 0.7fr 0.7fr" }} onClick={() => navigate(`/portal/requests/${req.id}`)} title={req.requestId}>
                                        <span className="po-requests-id">{shortId(req.requestId)}</span>
                                        <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
                                            <span className="po-requests-title" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={req.title}>{req.title.split(" - ").slice(1).join(" - ").trim() || req.title}</span>
                                            {isClarResp && (
                                                <span style={{ fontSize: 11, color: "#0e7490", fontWeight: 500 }}>Response received — no action required</span>
                                            )}
                                            {isReworking && (
                                                <span style={{ fontSize: 11, color: "#c2410c", fontWeight: 500 }}>Rework requested — IntegraCare reviewing</span>
                                            )}
                                        </div>
                                        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                            <StatusBadge status={req.status} />
                                        </span>
                                        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                            {excCtx.recommendationType ? (
                                                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#0f172a", fontWeight: 600, fontSize: 11, background: "#fff", padding: "2px 8px", borderRadius: 4, border: excCtx.recommendationType === "Duplicate" ? "1px solid #c4b5fd" : "1px solid #a5b4fc", whiteSpace: "nowrap" }}>
                                                    {excCtx.recommendationType === "Duplicate" ? "Duplicate" : "Not Applicable"}
                                                </span>
                                            ) : (
                                                <span style={{ color: "#94a3b8", fontSize: 12 }}>{"\u2014"}</span>
                                            )}
                                        </span>
                                        <span className="po-requests-txn">{req.category || "\u2014"}</span>
                                        <span className="po-requests-txn">{req.communityNames[0] || "\u2014"}</span>
                                        <span className="po-requests-txn">{req.updatedAt || req.neededBy || "\u2014"}</span>
                                    </div>
                                    );
                                })}
                            </div>
                            {dashboardFiltered.length > 10 && (
                                <div style={{ textAlign: "right", marginTop: 6 }}>
                                    <span style={{ fontSize: 13, color: "#4f46e5", fontWeight: 600, cursor: "pointer" }} onClick={() => navigate("/portal/requests")}>View all requests &rarr;</span>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
            </>
            )}

        </div>
    );
}

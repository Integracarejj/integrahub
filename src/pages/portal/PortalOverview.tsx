import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
    getPortalRequests, getPortalTransactions,
    getActivePersona, submitBrokerUploadPackage, confirmBrokerPackage,
    getPortalSubmissionsList,
    parseUploadedXLSX, extractCategoriesFromParsedRows,
    saveParsedRows,
} from "../../services/portalMockData";
import "./PortalOverview.css";

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    Published: { bg: "#f0fdf4", text: "#166534", border: "#bbf7d0" },
    "Waiting Review": { bg: "#eff6ff", text: "#1e40af", border: "#bfdbfe" },
    Approved: { bg: "#f0fdf4", text: "#166534", border: "#bbf7d0" },
    "Rework Required": { bg: "#fff7ed", text: "#9a3412", border: "#fed7aa" },
    "In Progress": { bg: "#eff6ff", text: "#1e40af", border: "#bfdbfe" },
    "Intake Review": { bg: "#faf5ff", text: "#6b21a8", border: "#ddd6fe" },
    "Work Queue": { bg: "#fef3c7", text: "#92400e", border: "#fde68a" },
    "Quality Review": { bg: "#fffbeb", text: "#92400e", border: "#fde68a" },
    "Action Needed": { bg: "#fff7ed", text: "#9a3412", border: "#fed7aa" },
    "Clarification Requested": { bg: "#fff7ed", text: "#9a3412", border: "#fed7aa" },
    Closed: { bg: "#f1f5f9", text: "#475569", border: "#e2e8f0" },
    "Closed / Duplicate": { bg: "#f1f5f9", text: "#475569", border: "#e2e8f0" },
    "Closed / Not Applicable": { bg: "#f1f5f9", text: "#475569", border: "#e2e8f0" },
    "Exception Review": { bg: "#faf5ff", text: "#6b21a8", border: "#ddd6fe" },
    "Duplicate Decision Needed": { bg: "#faf5ff", text: "#6d28d9", border: "#ddd6fe" },
    "Removal Approval Needed": { bg: "#eef2ff", text: "#4338ca", border: "#c7d2fe" },
    "Possible Duplicate": { bg: "#faf5ff", text: "#6d28d9", border: "#ddd6fe" },
    "Not Applicable Review": { bg: "#eef2ff", text: "#4338ca", border: "#c7d2fe" },
};

const STAT_HELPERS: Record<string, string> = {
    "Intake Review": "Awaiting initial review",
    "Work Queue": "Queued for processing",
    "In Progress": "Actively being worked on",
    "Quality Review": "Final review in progress",
    "Waiting Review": "Awaiting partner decision",
    Approved: "Completed and approved",
    "Rework Required": "Returned for rework",
    "Action Needed": "Requires your action — review or respond",
    "Exception Review": "Needs your decision on duplicate or removal",
    "Duplicate Decision Needed": "Needs your decision on duplicate",
    "Removal Approval Needed": "Needs your decision on removal",
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
    const c = STATUS_COLORS[status] || { bg: "#f8fafc", text: "#475569", border: "#e2e8f0" };
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
    const transactions = getPortalTransactions();
    const txn = transactions[0];
    const portalRequests = getPortalRequests();
    const submissions = getPortalSubmissionsList();

    const fileInputRef = useRef<HTMLInputElement>(null);
    const dropZoneRef = useRef<HTMLDivElement>(null);
    const [uploadState, setUploadState] = useState<UploadState>("idle");
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
    const [banner, setBanner] = useState<string | null>(null);

    /* ── Derived Stats ── */
    const waitingReviewCount = portalRequests.filter(r => r.status === "Waiting Review" && (r._publishedExternal || r.externalStatus === "Published External")).length;
    const approvedCount = portalRequests.filter(r => r.status === "Approved" && (r._publishedExternal || r.externalStatus === "Published External")).length;
    const reworkRequiredCount = portalRequests.filter(r => r.status === "Rework Required" && (r._publishedExternal || r.externalStatus === "Published External")).length;
    const publishedCount = portalRequests.filter(r => (r._publishedExternal || r.externalStatus === "Published External") && r.status !== "Waiting Review" && r.status !== "Approved" && r.status !== "Rework Required").length;
    const qualityReviewCount = portalRequests.filter(r => r.status === "Quality Review" && !r._publishedExternal && r.externalStatus !== "Published External").length;
    const intakeCount = portalRequests.filter(r => r.status === "Intake Review").length;
    const workQueueCount = portalRequests.filter(r => r.status === "Work Queue").length;
    const actionNeededCount = portalRequests.filter(r => r.status === "Action Needed" || r.status === "Clarification Requested" || r.status === "Duplicate Decision Needed" || r.status === "Removal Approval Needed").length;
    const exceptionReviewCount = portalRequests.filter(r => r.status === "Exception Review" || r.status === "Duplicate Decision Needed" || r.status === "Removal Approval Needed").length;
    const inProgress = portalRequests.filter(r => r.status === "In Progress").length;
    const visibleRequests = portalRequests.filter(r => r.status !== "Closed" && r.status !== "Closed / Duplicate" && r.status !== "Closed / Not Applicable");

    const [dashboardSearch, setDashboardSearch] = useState("");
    const [dashboardFilterStatus, setDashboardFilterStatus] = useState("all");
    const [dashboardFilterCategory, setDashboardFilterCategory] = useState("all");
    const dashboardCategories = [...new Set(portalRequests.map(r => r.category))];
    const dashboardFiltered = visibleRequests.filter(r => {
        if (dashboardFilterStatus !== "all") {
            if (dashboardFilterStatus === "Action Needed") {
                if (r.status !== "Action Needed" && r.status !== "Clarification Requested") return false;
            }
            else if (dashboardFilterStatus === "Exception Review") {
                if (r.status !== "Exception Review" && r.status !== "Duplicate Decision Needed" && r.status !== "Removal Approval Needed") return false;
            }
            else if (r.status !== dashboardFilterStatus) return false;
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
            const result = submitBrokerUploadPackage(file.name, parsed.count, cats);
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
        setBanner("Package submitted successfully!");
    };

    const hasSubmitted = submissions.length > 0 || uploadState === "submitted";
    const showOnlyUpload = submissions.length === 0 && uploadState !== "submitted";

    /* ── Scroll indicator state ── */
    const [showScrollHint, setShowScrollHint] = useState(true);
    useEffect(() => {
        const handleScroll = () => {
            if (window.scrollY > 100) setShowScrollHint(false);
        };
        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                <div>
                    <p className="po-welcome-sub" style={{ fontSize: 15, margin: 0, color: "#334155" }}>{persona.companyName}{txn ? ` \u00b7 ${txn.name}` : ""}</p>
                </div>
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
                                <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#dcfce7", color: "#166534", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", border: "3px solid #bbf7d0" }}>
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                </div>
                                <h3 style={{ fontSize: 24, fontWeight: 800, color: "#166534", margin: "0 0 6px", letterSpacing: "-0.02em" }}>Package Ready</h3>
                                <p style={{ fontSize: 15, color: "#334155", margin: "0 0 6px" }}>
                                    {analysis.packageName} &mdash; {analysis.detected} request{analysis.detected !== 1 ? "s" : ""} detected.
                                </p>
                                <p style={{ fontSize: 13, color: "#475569", margin: "0 0 20px", fontStyle: "italic" }}>
                                    IntegraCare will review all request rows internally before publishing to your dashboard.
                                </p>
                                <div style={{ textAlign: "center", marginBottom: 18 }}>
                                    <div style={{ fontSize: 42, fontWeight: 800, color: "#166534", lineHeight: 1 }}>{analysis.detected}</div>
                                    <div style={{ fontSize: 14, color: "#334155", fontWeight: 600 }}>Requests Detected</div>
                                </div>
                                <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                                    <button className="rc-btn rc-btn-primary" onClick={handleSubmitPackage} style={{ padding: "14px 36px", fontSize: 15, fontWeight: 700, borderRadius: 12 }}>Confirm &amp; Submit to IntegraCare</button>
                                    <button className="rc-btn rc-btn-secondary" onClick={resetUpload} style={{ padding: "14px 24px", fontSize: 14, borderRadius: 12 }}>Start Over</button>
                                </div>
                            </div>
                        )}
                    </div>

                    {uploadState === "idle" && (
                        <div style={{ maxWidth: 620, margin: "0 auto" }}>
                            <h3 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", marginBottom: 16, textAlign: "center" }}>How it works</h3>
                            <div className="po-how-it-works">
                                {[
                                    { step: "1", title: "Upload", desc: "Upload your DD request list as an Excel file" },
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

            {/* ── Compact Submitted Banner ── */}
            {uploadState === "submitted" && analysis && (
                <div style={{ marginBottom: 0 }}>
                    <div className="po-submitted-banner" style={{ padding: "28px 32px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 18, justifyContent: "center", flexWrap: "wrap" }}>
                            <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#166534", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "3px solid #86efac" }}>
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                            </div>
                            <div style={{ textAlign: "left" }}>
                                <div style={{ fontSize: 20, fontWeight: 800, color: "#166534", marginBottom: 4, letterSpacing: "-0.02em" }}>Package Submitted</div>
                                <div style={{ fontSize: 14, color: "#334155", lineHeight: 1.5 }}>
                                    {analysis.detected} request{analysis.detected !== 1 ? "s" : ""} are now in Intake Review. You will be notified when items are published.
                                </div>
                            </div>
                            <button className="rc-btn rc-btn-primary" onClick={resetUpload} style={{ padding: "10px 24px", fontSize: 13, fontWeight: 700 }}>Upload Another Package</button>
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
                            <button className="rc-btn rc-btn-primary" onClick={handleSubmitPackage} style={{ padding: "8px 20px", fontSize: 13, fontWeight: 700 }}>Confirm &amp; Submit</button>
                            <button className="rc-btn rc-btn-secondary" onClick={resetUpload} style={{ padding: "8px 14px", fontSize: 13 }}>Start Over</button>
                        </div>
                    )}
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
                {intakeCount > 0 && (
                    <div className={`po-stat-card${dashboardFilterStatus === "Intake Review" ? " po-stat-card--active" : ""}`} style={{ cursor: "pointer" }} onClick={() => { setDashboardFilterStatus("Intake Review"); setDashboardFilterCategory("all"); }}>
                        <span className="po-stat-value po-stat-value--indigo">{intakeCount}</span>
                        <span className="po-stat-label">Intake Review</span>
                        <span className="po-stat-helper">{STAT_HELPERS["Intake Review"]}</span>
                    </div>
                )}
                {workQueueCount > 0 && (
                    <div className={`po-stat-card${dashboardFilterStatus === "Work Queue" ? " po-stat-card--active" : ""}`} style={{ cursor: "pointer" }} onClick={() => { setDashboardFilterStatus("Work Queue"); setDashboardFilterCategory("all"); }}>
                        <span className="po-stat-value po-stat-value--amber">{workQueueCount}</span>
                        <span className="po-stat-label">Work Queue</span>
                        <span className="po-stat-helper">{STAT_HELPERS["Work Queue"]}</span>
                    </div>
                )}
                <div className={`po-stat-card${dashboardFilterStatus === "In Progress" ? " po-stat-card--active" : ""}`} style={{ cursor: "pointer" }} onClick={() => { setDashboardFilterStatus("In Progress"); setDashboardFilterCategory("all"); }}>
                    <span className="po-stat-value po-stat-value--blue">{inProgress}</span>
                    <span className="po-stat-label">In Progress</span>
                    <span className="po-stat-helper">{STAT_HELPERS["In Progress"]}</span>
                </div>
                <div className={`po-stat-card${dashboardFilterStatus === "Quality Review" ? " po-stat-card--active" : ""}`} style={{ cursor: "pointer" }} onClick={() => { setDashboardFilterStatus("Quality Review"); setDashboardFilterCategory("all"); }}>
                    <span className="po-stat-value po-stat-value--amber">{qualityReviewCount}</span>
                    <span className="po-stat-label">Quality Review</span>
                    <span className="po-stat-helper">{STAT_HELPERS["Quality Review"]}</span>
                </div>
                {waitingReviewCount > 0 && (
                    <div className={`po-stat-card${dashboardFilterStatus === "Waiting Review" ? " po-stat-card--active" : ""}`} style={{ cursor: "pointer" }} onClick={() => { setDashboardFilterStatus("Waiting Review"); setDashboardFilterCategory("all"); }}>
                        <span className="po-stat-value po-stat-value--green">{waitingReviewCount}</span>
                        <span className="po-stat-label">Waiting Review</span>
                        <span className="po-stat-helper">{STAT_HELPERS["Waiting Review"]}</span>
                    </div>
                )}
                {approvedCount > 0 && (
                    <div className={`po-stat-card${dashboardFilterStatus === "Approved" ? " po-stat-card--active" : ""} po-stat-card--highlight`} style={{ cursor: "pointer" }} onClick={() => { setDashboardFilterStatus("Approved"); setDashboardFilterCategory("all"); }}>
                        <span className="po-stat-value po-stat-value--green">{approvedCount}</span>
                        <span className="po-stat-label">Approved</span>
                        <span className="po-stat-helper">{STAT_HELPERS["Approved"]}</span>
                    </div>
                )}
                {reworkRequiredCount > 0 && (
                    <div className={`po-stat-card${dashboardFilterStatus === "Rework Required" ? " po-stat-card--active" : ""}`} style={{ cursor: "pointer" }} onClick={() => { setDashboardFilterStatus("Rework Required"); setDashboardFilterCategory("all"); }}>
                        <span className="po-stat-value po-stat-value--amber">{reworkRequiredCount}</span>
                        <span className="po-stat-label">Rework Required</span>
                        <span className="po-stat-helper">{STAT_HELPERS["Rework Required"]}</span>
                    </div>
                )}
                {publishedCount > 0 && (
                    <div className={`po-stat-card${dashboardFilterStatus === "Published" ? " po-stat-card--active" : ""}`} style={{ cursor: "pointer" }} onClick={() => { setDashboardFilterStatus("Published"); setDashboardFilterCategory("all"); }}>
                        <span className="po-stat-value po-stat-value--green">{publishedCount}</span>
                        <span className="po-stat-label">Published</span>
                        <span className="po-stat-helper">Awaiting partner action</span>
                    </div>
                )}
                {actionNeededCount > 0 && (
                    <div className={`po-stat-card${dashboardFilterStatus === "Action Needed" ? " po-stat-card--active" : ""}`} style={{ cursor: "pointer" }} onClick={() => { setDashboardFilterStatus("Action Needed"); setDashboardFilterCategory("all"); }}>
                        <span className="po-stat-value po-stat-value--red">{actionNeededCount}</span>
                        <span className="po-stat-label">Action Needed</span>
                        <span className="po-stat-helper">{STAT_HELPERS["Action Needed"]}</span>
                    </div>
                )}
                {exceptionReviewCount > 0 && (
                    <div className={`po-stat-card${dashboardFilterStatus === "Exception Review" ? " po-stat-card--active" : ""}`} style={{ cursor: "pointer" }} onClick={() => { setDashboardFilterStatus("Exception Review"); setDashboardFilterCategory("all"); }}>
                        <span className="po-stat-value po-stat-value--indigo">{exceptionReviewCount}</span>
                        <span className="po-stat-label">Exception Review</span>
                        <span className="po-stat-helper">{STAT_HELPERS["Exception Review"]}</span>
                    </div>
                )}
            </div>
            <div style={{ fontSize: 12, color: "#475569", textAlign: "right", marginBottom: 12 }}>
                Last updated: {lastUpdated.toLocaleTimeString()}
            </div>

            {/* ── Scroll Hint ── */}
            {showScrollHint && visibleRequests.length > 0 && (
                <div style={{
                    textAlign: "center", fontSize: 12, color: "#475569", padding: "2px 0 8px",
                    opacity: showScrollHint ? 1 : 0,
                    transition: "opacity 0.4s ease",
                    animation: "po-fade-in 0.6s ease",
                }}>
                    Scroll for requests &darr;
                </div>
            )}

            {/* ── Full-Width Requests Grid ── */}
            <div className="po-dashboard-grid">
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
                            <p style={{ fontSize: 14, color: "#475569", margin: 0, lineHeight: 1.5 }}>Select <strong>Confirm &amp; Submit</strong> above to begin processing your due diligence package.</p>
                        </div>
                    ) : (
                        <>
                            <div className="po-filter-row">
                                <div className="po-search-box">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                                    <input type="text" placeholder="Search..." value={dashboardSearch} onChange={e => setDashboardSearch(e.target.value)} />
                                </div>
                                <select className="po-filter-select" value={dashboardFilterStatus} onChange={e => setDashboardFilterStatus(e.target.value)}>
                                    <option value="all">All Statuses</option>
                                    <option value="Intake Review">Intake Review</option>
                                    <option value="Work Queue">Work Queue</option>
                                    <option value="In Progress">In Progress</option>
                                    <option value="Quality Review">Quality Review</option>
                                    <option value="Published">Published</option>
                                    <option value="Waiting Review">Waiting Review</option>
                                    <option value="Approved">Approved</option>
                                    <option value="Rework Required">Rework Required</option>
                                    <option value="Action Needed">Action Needed</option>
                                    <option value="Exception Review">Exception Review</option>
                                    <option value="Duplicate Decision Needed">Duplicate Decision Needed</option>
                                    <option value="Removal Approval Needed">Removal Approval Needed</option>
                                    <option value="Clarification Requested">Clarification Requested</option>
                                </select>
                                <select className="po-filter-select" value={dashboardFilterCategory} onChange={e => setDashboardFilterCategory(e.target.value)}>
                                    <option value="all">All Categories</option>
                                    {dashboardCategories.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div className="po-requests-table">
                                <div className="po-requests-header" style={{ gridTemplateColumns: "0.5fr 2fr 1fr 0.9fr 0.7fr 0.7fr" }}>
                                    <span>ID</span><span>Request</span><span>Status</span><span>Category</span><span>Community</span><span>Updated</span>
                                </div>
                                {dashboardFiltered.slice(0, 10).map((req) => (
                                    <div key={req.id} className="po-requests-row" style={{ gridTemplateColumns: "0.5fr 2fr 1fr 0.9fr 0.7fr 0.7fr" }} onClick={() => navigate(`/portal/requests/${req.id}`)} title={req.requestId}>
                                        <span className="po-requests-id">{shortId(req.requestId)}</span>
                                        <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
                                            <span className="po-requests-title" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={req.title}>{req.title.split(" - ").slice(1).join(" - ").trim() || req.title}</span>
                                            {req._exceptionReason && (
                                                <span style={{ fontSize: 10, color: "#6b21a8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 280 }} title={req._exceptionReason}>
                                                    {req._exceptionReason.slice(0, 100)}{req._exceptionReason.length > 100 ? "..." : ""}
                                                </span>
                                            )}
                                        </div>
                                        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                            <StatusBadge status={req.status} />
                                        </span>
                                        <span className="po-requests-txn">{req.category || "\u2014"}</span>
                                        <span className="po-requests-txn">{req.communityNames[0] || "\u2014"}</span>
                                        <span className="po-requests-txn">{req.updatedAt || req.neededBy || "\u2014"}</span>
                                    </div>
                                ))}
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

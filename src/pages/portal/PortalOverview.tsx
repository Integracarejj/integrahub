import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
    getPortalRequests, getPortalTransactions,
    getActivePersona, submitBrokerUploadPackage, confirmBrokerPackage,
    getPortalSubmissionsList, loadABCDemoPackage,
    parseUploadedXLSX, extractCategoriesFromParsedRows,
    saveParsedRows,
} from "../../services/portalMockData";
import { getActivity } from "../../services/recapDataService";
import type { RecapActivity } from "../../services/recapDataService";
import "./PortalOverview.css";

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    Published: { bg: "#f0fdf4", text: "#166534", border: "#bbf7d0" },
    "In Progress": { bg: "#eff6ff", text: "#1e40af", border: "#bfdbfe" },
    "Intake Review": { bg: "#faf5ff", text: "#6b21a8", border: "#ddd6fe" },
    "Work Queue": { bg: "#fef3c7", text: "#92400e", border: "#fde68a" },
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



/* ── Activity Icon ── */

function ActivityIcon({ type }: { type: RecapActivity["type"] }) {
    const icons: Record<string, { icon: string; color: string; bg: string }> = {
        "Status Change": { icon: "\u25C6", color: "#3b82f6", bg: "#eff6ff" },
        Assignment: { icon: "\uD83D\uDC64", color: "#8b5cf6", bg: "#f5f3ff" },
        Note: { icon: "\uD83D\uDCDD", color: "#06b6d4", bg: "#ecfeff" },
        Submission: { icon: "\uD83D\uDCE4", color: "#10b981", bg: "#f0fdf4" },
        Document: { icon: "\uD83D\uDCC4", color: "#f59e0b", bg: "#fffbeb" },
        Comment: { icon: "\uD83D\uDCAC", color: "#64748b", bg: "#f8fafc" },
    };
    const meta = icons[type] || { icon: "\u25C6", color: "#94a3b8", bg: "#f8fafc" };
    return (
        <span style={{ width: 28, height: 28, borderRadius: "50%", background: meta.bg, color: meta.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>
            {meta.icon}
        </span>
    );
}

/* ── External-Safe Activity Filter ── */

function isExternalSafeActivity(act: RecapActivity): boolean {
    if (act.type === "Note" || act.type === "Assignment") return false;
    const desc = act.description.toLowerCase();
    if (desc.includes("work note")) return false;
    if (desc.includes("reusable knowledge") || desc.includes("promote")) return false;
    if (act.type === "Document" && desc.includes("artifact") && !desc.includes("published")) return false;
    if (act.type === "Status Change" && !desc.includes("publish") && !desc.includes("external")) return false;
    return true;
}

function ActivityFeed({ activities }: { activities: RecapActivity[] }) {
    const externalSafe = activities.filter(isExternalSafeActivity);
    if (externalSafe.length === 0) {
        return <div style={{ padding: 16, fontSize: 13, color: "#64748b", textAlign: "center" }}>No external activity has been recorded yet.</div>;
    }
    return (
        <div className="po-requests-table">
            {externalSafe.slice(0, 8).map((act) => (
                <div key={act.id} className="po-activity-item">
                    <ActivityIcon type={act.type} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: "#1e293b", lineHeight: 1.4 }}>{act.description}</div>
                        <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                            {act.userName}
                            {act.requestId && <> &middot; <span style={{ fontFamily: '"SF Mono", "Cascadia Code", "Consolas", monospace' }}>{act.requestId}</span></>}
                            {act.timestamp && <> &middot; {new Date(act.timestamp).toLocaleDateString()}</>}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

/* ── External Communication Panel ── */

function ExternalCommPanel() {
    return (
        <div style={{ border: "1px dashed #d1d5db", borderRadius: 10, padding: 20, textAlign: "center", background: "#fafbfc" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 6px" }}>
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <div style={{ fontSize: 13, color: "#64748b", marginBottom: 6 }}>No external communication has been recorded yet.</div>
            <div style={{ fontSize: 11, color: "#94a3b8", fontStyle: "italic", marginBottom: 8 }}>Email notifications will be enabled in a future phase.</div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>
                For urgent requests, contact{" "}
                <a href="mailto:support@integracare.com" style={{ color: "#6366f1", textDecoration: "underline" }}>support@integracare.com</a>
            </div>
        </div>
    );
}

/* ── Main Dashboard ── */

export default function PortalOverview() {
    const navigate = useNavigate();
    const persona = getActivePersona();
    const transactions = getPortalTransactions();
    const txn = transactions[0];
    const portalRequests = getPortalRequests();
    const submissions = getPortalSubmissionsList();
    const allActivity = getActivity(20);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const dropZoneRef = useRef<HTMLDivElement>(null);
    const [uploadState, setUploadState] = useState<UploadState>("idle");
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
    const [banner, setBanner] = useState<string | null>(null);

    /* ── Derived Stats ── */
    const publishedCount = portalRequests.filter(r => r._publishedExternal || r.externalStatus === "Published External").length;
    const qualityReviewCount = portalRequests.filter(r => r.status === "Quality Review" && !r._publishedExternal && r.externalStatus !== "Published External").length;
    const intakeCount = portalRequests.filter(r => r.status === "Intake Review").length;
    const workQueueCount = portalRequests.filter(r => r.status === "Work Queue").length;
    const actionNeededCount = portalRequests.filter(r => r.status === "Action Needed").length;
    const inProgress = portalRequests.filter(r => r.status === "In Progress").length;
    const visibleRequests = portalRequests.filter(r => r.status !== "Closed");

    const [dashboardSearch, setDashboardSearch] = useState("");
    const [dashboardFilterStatus, setDashboardFilterStatus] = useState("all");
    const [dashboardFilterCategory, setDashboardFilterCategory] = useState("all");
    const dashboardCategories = [...new Set(portalRequests.map(r => r.category))];
    const dashboardFiltered = visibleRequests.filter(r => {
        if (dashboardFilterStatus !== "all" && r.status !== dashboardFilterStatus) return false;
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
                setBanner("We could not identify due diligence request rows in this file. Please check the format or contact support.");
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

    const showUploadFirst = submissions.length === 0 && uploadState === "idle";

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

            {/* ── Welcome Header ── */}
            <div className="po-welcome">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                        <h1 className="po-welcome-title">Due Diligence Dashboard</h1>
                        <p className="po-welcome-sub">{persona.companyName} &middot; {txn?.name || "ABC Company Portfolio"}</p>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 4, background: persona.role === "Broker" ? "#eef2ff" : persona.role === "Buyer" ? "#f0fdf4" : "#fff7ed", color: persona.role === "Broker" ? "#4338ca" : persona.role === "Buyer" ? "#166534" : "#92400e", border: "1px solid", borderColor: persona.role === "Broker" ? "#c7d2fe" : persona.role === "Buyer" ? "#bbf7d0" : "#fed7aa" }}>
                        {persona.role}
                    </span>
                </div>
            </div>

            {/* ── Upload Package Card ── */}
            {showUploadFirst && (
            <>
                <div style={{ textAlign: "center", padding: "40px 20px", marginBottom: 20 }}>
                    <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>Upload your due diligence request list to begin</h2>
                    <p style={{ fontSize: 14, color: "#64748b", maxWidth: 500, margin: "0 auto 24px", lineHeight: 1.6 }}>
                        The process starts when you provide your request list or package. Upload an Excel file (.xlsx, .xls, .csv) with your due diligence requests and we will route them to the IntegraCare team for review.
                    </p>
                    <div ref={dropZoneRef} style={{ border: "2px dashed #cbd5e1", borderRadius: 14, padding: 28, textAlign: "center", background: "#fafbfc", maxWidth: 520, margin: "0 auto 28px" }}>
                        <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={handleFileSelected} />
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 10px" }}>
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                        <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", margin: "0 0 4px" }}>Upload Due Diligence Package</h3>
                        <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 16px" }}>Upload Excel request list (.xlsx, .xls, .csv) containing your due diligence requests.</p>
                        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                            <button className="rc-btn rc-btn-primary" onClick={handleBrowseClick}>Browse Files</button>
                            <button className="rc-btn rc-btn-secondary" onClick={handleLoadABCDemo}>Load ABC Gold Standard Demo Package</button>
                        </div>
                    </div>
                    <div style={{ maxWidth: 520, margin: "0 auto" }}>
                        <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 12 }}>How it works</h3>
                        <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
                            {[
                                { step: "1", title: "Upload", desc: "Upload your DD request list as an Excel file" },
                                { step: "2", title: "Review", desc: "IntegraCare reviews and routes your requests" },
                                { step: "3", title: "Track", desc: "Monitor progress and published results here" },
                            ].map(s => (
                                <div key={s.step} style={{ flex: 1, textAlign: "center", padding: "12px 8px", border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff" }}>
                                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#eef2ff", color: "#4338ca", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 6px", fontSize: 13, fontWeight: 700 }}>{s.step}</div>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 2 }}>{s.title}</div>
                                    <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.4 }}>{s.desc}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </>
            )}

            {!showUploadFirst && uploadState !== "submitted" && (
                <div ref={dropZoneRef} style={{
                    border: "2px dashed #cbd5e1", borderRadius: 14, padding: 28, marginBottom: 20,
                    textAlign: "center", background: "#fafbfc",
                }}>
                    <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={handleFileSelected} />

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
                            <p style={{ fontSize: 13, color: "#475569", margin: "0 0 14px" }}>
                                {analysis.packageName}{analysis.isABCDemo ? " (Gold Standard Demo)" : ""} &mdash; {analysis.detected} request rows identified.
                                {analysis.duplicates > 0 && <> <span style={{ color: "#92400e" }}>{analysis.duplicates} potential duplicate{analysis.duplicates > 1 ? "s" : ""} detected.</span></>}
                            </p>
                            <p style={{ fontSize: 12, color: "#475569", margin: "0 0 14px", fontStyle: "italic" }}>
                                IntegraCare will review all request rows internally before publishing approved requests to the tracker.
                            </p>
                            <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap", marginBottom: 14 }}>
                                <div style={{ textAlign: "center" }}><div style={{ fontSize: 20, fontWeight: 700, color: "#1e293b" }}>{analysis.detected}</div><div style={{ fontSize: 11, color: "#64748b" }}>Total Requests</div></div>
                                {analysis.duplicates > 0 && (
                                    <div style={{ textAlign: "center" }}><div style={{ fontSize: 20, fontWeight: 700, color: "#92400e" }}>{analysis.duplicates}</div><div style={{ fontSize: 11, color: "#64748b" }}>Duplicates</div></div>
                                )}
                            </div>
                            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                                <button className="rc-btn rc-btn-primary" onClick={handleSubmitPackage}>Submit Package to IntegraCare</button>
                                <button className="rc-btn rc-btn-secondary" onClick={resetUpload}>Start Over</button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {uploadState === "submitted" && analysis && (
                <div style={{ marginBottom: 20 }}>
                    <div style={{ border: "1px solid #bbf7d0", borderRadius: 14, padding: 20, background: "#f0fdf4" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#166534" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                            <div>
                                <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: "#166534" }}>Package submitted successfully!</span>
                                <span style={{ display: "block", fontSize: 12, color: "#475569" }}>
                                    {analysis.detected} request{analysis.detected !== 1 ? "s" : ""} submitted for review. IntegraCare will review and publish approved requests.
                                </span>
                            </div>
                        </div>
                    </div>
                    <button className="rc-btn rc-btn-secondary" onClick={resetUpload} style={{ marginTop: 12 }}>Upload Another Package</button>
                </div>
            )}

            {!showUploadFirst && (
            <>
            <div className="po-stats-row">
                <div className="po-stat-card" style={{ cursor: "pointer" }} onClick={() => { setDashboardFilterStatus("all"); setDashboardFilterCategory("all"); setDashboardSearch(""); }}>
                    <span className="po-stat-value">{visibleRequests.length}</span>
                    <span className="po-stat-label">Total Requests</span>
                </div>
                {intakeCount > 0 && (
                    <div className="po-stat-card" style={{ cursor: "pointer" }} onClick={() => { setDashboardFilterStatus("Intake Review"); setDashboardFilterCategory("all"); }}>
                        <span className="po-stat-value po-stat-value--indigo">{intakeCount}</span>
                        <span className="po-stat-label">Intake Review</span>
                    </div>
                )}
                {workQueueCount > 0 && (
                    <div className="po-stat-card" style={{ cursor: "pointer" }} onClick={() => { setDashboardFilterStatus("Work Queue"); setDashboardFilterCategory("all"); }}>
                        <span className="po-stat-value po-stat-value--amber">{workQueueCount}</span>
                        <span className="po-stat-label">Work Queue</span>
                    </div>
                )}
                <div className="po-stat-card" style={{ cursor: "pointer" }} onClick={() => { setDashboardFilterStatus("In Progress"); setDashboardFilterCategory("all"); }}>
                    <span className="po-stat-value po-stat-value--blue">{inProgress}</span>
                    <span className="po-stat-label">In Progress</span>
                </div>
                <div className="po-stat-card" style={{ cursor: "pointer" }} onClick={() => { setDashboardFilterStatus("Quality Review"); setDashboardFilterCategory("all"); }}>
                    <span className="po-stat-value po-stat-value--amber">{qualityReviewCount}</span>
                    <span className="po-stat-label">Quality Review</span>
                </div>
                <div className="po-stat-card" style={{ cursor: "pointer", ...(publishedCount > 0 ? { borderColor: "#166534", background: "#f0fdf4" } : {}) }} onClick={() => { setDashboardFilterStatus("Published"); setDashboardFilterCategory("all"); }}>
                    <span className="po-stat-value po-stat-value--green">{publishedCount}</span>
                    <span className="po-stat-label">{publishedCount > 0 ? "Published / Ready to Review" : "Published"}</span>
                </div>
                {actionNeededCount > 0 && (
                    <div className="po-stat-card" style={{ cursor: "pointer" }} onClick={() => { setDashboardFilterStatus("Action Needed"); setDashboardFilterCategory("all"); }}>
                        <span className="po-stat-value po-stat-value--red">{actionNeededCount}</span>
                        <span className="po-stat-label">Action Needed</span>
            </div>
            )}
        </div>
            <div style={{ fontSize: 11, color: "#94a3b8", textAlign: "right", marginBottom: 16 }}>
                Last updated: {lastUpdated.toLocaleTimeString()}
            </div>

            {/* ── Bottom Grid: Requests + Activity/Comm ── */}
            <div className="po-dashboard-grid">
                {/* ── Submitted Requests ── */}
                <div className="po-section">
                    <h2 className="po-section-title">Submitted Requests</h2>
                    {visibleRequests.length === 0 ? (
                        <div style={{ border: "1px dashed #d1d5db", borderRadius: 10, padding: 24, textAlign: "center", background: "#fafbfc" }}>
                            <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>No requests submitted yet. Upload a package to get started.</p>
                        </div>
                    ) : (
                        <>
                            <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 4, border: "1px solid #e2e8f0", borderRadius: 6, padding: "2px 8px", background: "#fff", flex: 1, minWidth: 150 }}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                                    <input type="text" placeholder="Search..." value={dashboardSearch} onChange={e => setDashboardSearch(e.target.value)} style={{ border: "none", outline: "none", fontSize: 12, flex: 1, padding: "4px 0", background: "transparent" }} />
                                </div>
                                <select className="rc-filter-select" value={dashboardFilterStatus} onChange={e => setDashboardFilterStatus(e.target.value)} style={{ minWidth: 110, fontSize: 11 }}>
                                    <option value="all">All Statuses</option>
                                    <option value="Intake Review">Intake Review</option>
                                    <option value="Work Queue">Work Queue</option>
                                    <option value="In Progress">In Progress</option>
                                    <option value="Quality Review">Quality Review</option>
                                    <option value="Published">Published</option>
                                    <option value="Action Needed">Action Needed</option>
                                    <option value="Closed">Closed</option>
                                </select>
                                <select className="rc-filter-select" value={dashboardFilterCategory} onChange={e => setDashboardFilterCategory(e.target.value)} style={{ minWidth: 110, fontSize: 11 }}>
                                    <option value="all">All Categories</option>
                                    {dashboardCategories.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div style={{ border: "1px solid var(--is-border, #93c5fd)", borderRadius: 10, overflow: "hidden", boxShadow: "var(--is-shadow-card, 0 8px 20px rgba(15, 23, 42, 0.08))" }}>
                            <div style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 1fr 0.8fr", gap: 8, padding: "10px 14px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                                <span>Request</span><span>Community</span><span>Status</span><span>Updated</span>
                            </div>
                            {dashboardFiltered.slice(0, 10).map((req) => (
                                <div key={req.id} style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 1fr 0.8fr", gap: 8, padding: "10px 14px", borderBottom: "1px solid #f1f5f9", fontSize: 13, alignItems: "center", cursor: "pointer" }} onClick={() => navigate(`/portal/requests/${req.id}`)}>
                                    <span style={{ fontWeight: 600, color: "var(--is-text-heading, #0f172a)" }}>{req.title.split(" - ").slice(1).join(" - ").trim() || req.title}</span>
                                    <span style={{ fontSize: 12, color: "var(--is-text-helper, #334155)" }}>{req.communityNames[0] || "\u2014"}</span>
                                    <span>
                                        <StatusBadge status={req.status} />
                                        {req._publishedExternal && (
                                            <span style={{ marginLeft: 4, fontSize: 9, padding: "1px 5px", borderRadius: 3, background: "#dcfce7", color: "#166534", fontWeight: 600, whiteSpace: "nowrap", verticalAlign: "middle" }}>
                                                Ready to Review
                                            </span>
                                        )}
                                    </span>
                                    <span style={{ fontSize: 12, color: "var(--is-text-helper, #334155)" }}>{req.updatedAt || req.neededBy || "\u2014"}</span>
                                </div>
                            ))}
                        </div>
                        </>
                    )}
                            {dashboardFiltered.length > 10 && (
                        <div style={{ textAlign: "right", marginTop: 6 }}>
                            <span style={{ fontSize: 12, color: "#6366f1", fontWeight: 600, cursor: "pointer" }} onClick={() => navigate("/portal/requests")}>View all requests &rarr;</span>
                        </div>
                    )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {/* ── Recent Activity ── */}
                    <div className="po-section">
                        <h2 className="po-section-title">Recent Activity</h2>
                        <ActivityFeed activities={allActivity} />
                    </div>

                    {/* ── External Communication ── */}
                    <div className="po-section">
                        <h2 className="po-section-title">External Communication</h2>
                        <ExternalCommPanel />
                    </div>
                </div>
            </div>
            </>
            )}

        </div>
    );
}

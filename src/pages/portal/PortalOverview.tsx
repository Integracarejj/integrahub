import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
    getPortalRequests, getPortalTransactions,
    getActivePersona, submitBrokerUploadPackage, confirmBrokerPackage,
    getPortalDocuments, getPortalClarifications, getPortalQuestions,
    getPortalSubmissionsList, loadABCDemoPackage,
    parseUploadedXLSX, extractCategoriesFromParsedRows,
    getOnlyPortalCreatedRequests, saveParsedRows,
} from "../../services/portalMockData";
import type { ExternalDemoPersona, ParseDiagnostics, PortalPackageSubmission } from "../../services/portalMockData";
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
    const portalRequests = getOnlyPortalCreatedRequests();
    const transactions = getPortalTransactions();
    const txn = transactions[0];
    const fileInputRef = useRef<HTMLInputElement>(null);

    const dropZoneRef = useRef<HTMLDivElement>(null);
    const [uploadState, setUploadState] = useState<UploadState>("idle");
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
    const [banner, setBanner] = useState<string | null>(null);
    const [debug, setDebug] = useState<ParseDiagnostics | null>(null);

    const submissions = getPortalSubmissionsList();
    const needingClarification = portalRequests.filter(r => r.status === "Clarification Needed").length;
    const [selectedPackage, setSelectedPackage] = useState<PortalPackageSubmission | null>(null);

    // Window-level drag/drop — prevents browser from navigating to dropped files
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
        setDebug(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    }, []);

    const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setUploadState("idle");
            setAnalysis(null);
            setBanner(null);
            setDebug(null);
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

    // Native drag/drop listeners — guaranteed preventDefault, no browser "+copy" behavior
    useEffect(() => {
        const el = dropZoneRef.current;
        if (!el) return;

        const prevent = (e: Event) => {
            e.preventDefault();
            e.stopPropagation();
        };

        const onDrop = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            const file = e.dataTransfer?.files?.[0];
            if (file) {
                setUploadState("idle");
                setAnalysis(null);
                setBanner(null);
                setDebug(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
                setSelectedFile(file);
                setUploadState("selected");
                setBanner(`File selected: ${file.name}`);
                setTimeout(() => setBanner(null), 4000);
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

    const handleAnalyzePackage = async () => {
        if (!selectedFile) return;
        setUploadState("analyzing");
        setBanner(null);
        setDebug(null);
        try {
            const parsed = await parseUploadedXLSX(selectedFile);
            setDebug(parsed.diagnostics);
            saveParsedRows(parsed.rows);
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
                <div ref={dropZoneRef} className="po-upload-section" style={{
                    border: "2px dashed #cbd5e1", borderRadius: 14, padding: 28, marginBottom: 20,
                    textAlign: "center", background: "#fafbfc",
                }}>
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
                    <div className="po-upload-section" style={{ border: "1px solid #bbf7d0", borderRadius: 14, padding: 20, background: "#f0fdf4" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
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
                        {(() => {
                            const steps = [
                                { label: "Submitted", done: true, desc: "Package received" },
                                { label: "Internal Review", done: true, desc: "Under review by IntegraCare" },
                                { label: "Assigned", done: false, desc: "Awaiting internal assignment" },
                                { label: "Published to Tracker", done: false, desc: "Pending review approval" },
                                { label: "Complete", done: false, desc: "All requests processed" },
                            ];
                            return (
                                <div style={{ display: "flex", alignItems: "flex-start", gap: 0, marginBottom: 8 }}>
                                    {steps.map((s, i) => (
                                        <div key={s.label} style={{ flex: 1, textAlign: "center", position: "relative" }}>
                                            {i > 0 && (
                                                <div style={{ position: "absolute", top: 12, left: 0, right: "50%", height: 2, background: s.done ? "#166534" : "#e2e8f0", zIndex: 0 }} />
                                            )}
                                            <div style={{ position: "relative", zIndex: 1, width: 24, height: 24, borderRadius: "50%", background: s.done ? "#166534" : "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}>
                                                {s.done ? (
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="20 6 9 17 4 12" />
                                                    </svg>
                                                ) : (
                                                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#94a3b8" }} />
                                                )}
                                            </div>
                                            <div style={{ marginTop: 6, fontSize: 10, fontWeight: 700, color: s.done ? "#166534" : "#94a3b8" }}>{s.label}</div>
                                            <div style={{ fontSize: 9, color: "#94a3b8" }}>{s.desc}</div>
                                        </div>
                                    ))}
                                </div>
                            );
                        })()}
                    </div>
                    <button className="rc-btn rc-btn-secondary" onClick={resetUpload} style={{ marginTop: 12 }}>Upload Another Package</button>
                </div>
            )}

            {debug && uploadState === "complete" && (
                <div className="po-section" style={{ marginBottom: 16 }}>
                    <h2 className="po-section-title" style={{ fontSize: 13, color: "#4f46e5" }}>
                        Parse Debug Panel
                        <span style={{ fontWeight: 400, fontSize: 11, color: "#64748b", marginLeft: 8 }}>(Preview Mode only &mdash; remove before production)</span>
                    </h2>
                    <div style={{ border: "1px solid #c7d2fe", borderRadius: 10, padding: 14, background: "#f8faff", fontSize: 12, fontFamily: '"SF Mono", "Cascadia Code", "Consolas", monospace', lineHeight: 1.7 }}>
                        <div><strong>File:</strong> {debug.fileName} <span style={{ color: "#64748b" }}>({(debug.fileSize / 1024).toFixed(1)} KB)</span></div>
                        <div><strong>Sheet:</strong> {debug.selectedSheet} <span style={{ color: "#64748b" }}>of [{debug.sheetNames.join(", ")}]</span></div>
                        <div><strong>Headers:</strong> [{debug.rawHeaders.join(", ")}]</div>
                        <div><strong>Total physical rows (from !ref):</strong> {debug.totalPhysicalRows}</div>
                        <div>
                            <strong>Accepted:</strong> <span style={{ color: debug.acceptedCount > 0 ? "#166534" : "#991b1b", fontWeight: 700 }}>{debug.acceptedCount}</span>
                            &nbsp;|&nbsp;
                            <strong>Skipped:</strong> <span style={{ color: debug.skippedCount > 0 ? "#92400e" : "#64748b", fontWeight: 700 }}>{debug.skippedCount}</span>
                        </div>
                        {debug.skippedCount > 0 && (
                            <details style={{ marginTop: 6 }}>
                                <summary style={{ cursor: "pointer", fontWeight: 600, color: "#92400e" }}>
                                    {debug.skippedCount} skipped row{debug.skippedCount !== 1 ? "s" : ""} &mdash; top skip reasons
                                </summary>
                                <div style={{ marginTop: 4, maxHeight: 200, overflowY: "auto" }}>
                                    {debug.skipReasons.slice(0, 20).map((sr, si) => (
                                        <div key={si} style={{ padding: "4px 0", borderBottom: "1px solid #e2e8f0", fontSize: 11 }}>
                                            <span style={{ color: "#64748b", fontWeight: 600 }}>Row {sr.rowIndex}:</span> {sr.reason}
                                            {Object.keys(sr.sampleValues).length > 0 && (
                                                <span style={{ color: "#94a3b8", marginLeft: 4 }}>
                                                    [{Object.entries(sr.sampleValues).filter(([_, v]) => v.trim().length > 0).map(([k]) => k).join(", ")}]
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </details>
                        )}
                        <details style={{ marginTop: 6 }}>
                            <summary style={{ cursor: "pointer", fontWeight: 600, color: "#4338ca" }}>
                                First {debug.firstTenAccepted.length} accepted row{debug.firstTenAccepted.length !== 1 ? "s" : ""}
                            </summary>
                            <div style={{ marginTop: 4, maxHeight: 200, overflowY: "auto" }}>
                                {debug.firstTenAccepted.map((r, ri) => (
                                    <div key={ri} style={{ padding: "4px 0", borderBottom: "1px solid #e2e8f0", fontSize: 11, color: "#334155" }}>
                                        <strong>#{ri + 1}</strong>{" "}
                                        {Object.entries(r).filter(([_, v]) => v.trim().length > 0).map(([k, v]) => `${k}="${v.slice(0, 60)}"`).join(", ")}
                                    </div>
                                ))}
                            </div>
                        </details>
                    </div>
                </div>
            )}

            {submissions.length > 0 ? (
                <div className="po-stats-row">
                    <div className="po-stat-card">
                        <span className="po-stat-value">{submissions.reduce((s, sub) => s + sub.requestCount, 0)}</span>
                        <span className="po-stat-label">Total Submitted</span>
                    </div>
                    <div className="po-stat-card">
                        <span className="po-stat-value po-stat-value--green">{submissions.filter(s => s.status === "Submitted").length}</span>
                        <span className="po-stat-label">Packages In Review</span>
                    </div>
                    <div className="po-stat-card">
                        <span className="po-stat-value po-stat-value--blue">{submissions.length}</span>
                        <span className="po-stat-label">Total Packages</span>
                    </div>
                    <div className="po-stat-card">
                        <span className="po-stat-value po-stat-value--amber">{needingClarification}</span>
                        <span className="po-stat-label">Needs Clarification</span>
                    </div>
                </div>
            ) : (
                <div className="po-section" style={{ padding: "24px 16px", textAlign: "center", border: "1px dashed #d1d5db", borderRadius: 12, background: "#fafbfc" }}>
                    <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>Upload and submit a package to see your submission metrics here.</p>
                </div>
            )}

            {submissions.length > 0 && (
                <div className="po-section">
                    <h2 className="po-section-title">Recent Submissions</h2>
                    <div className="po-requests-table">
                        <div className="po-requests-header">
                            <span>Package</span><span>File</span><span>Submitted</span><span>Requests</span><span>Status</span>
                        </div>
                        {submissions.slice().reverse().map((sub) => (
                            <div key={sub.id} className="po-requests-row" onClick={() => setSelectedPackage(sub)} style={{ cursor: "pointer" }}>
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

            {selectedPackage && (
                <div className="rc-modal-overlay" onClick={() => setSelectedPackage(null)}>
                    <div className="rc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
                        <div className="rc-modal-header">
                            <h2>{selectedPackage.packageName}</h2>
                            <button className="rc-modal-close" onClick={() => setSelectedPackage(null)}>&times;</button>
                        </div>
                        <div className="rc-modal-body" style={{ gap: 0 }}>
                            <div className="iq-detail-grid" style={{ marginBottom: 16 }}>
                                <div className="rc-drawer-field">
                                    <span className="rc-drawer-field-label">File</span>
                                    <span className="rc-drawer-field-value" style={{ fontSize: 12 }}>{selectedPackage.fileName}</span>
                                </div>
                                <div className="rc-drawer-field">
                                    <span className="rc-drawer-field-label">Submitted</span>
                                    <span className="rc-drawer-field-value" style={{ fontSize: 12 }}>{new Date(selectedPackage.submittedAt).toLocaleString()}</span>
                                </div>
                                <div className="rc-drawer-field">
                                    <span className="rc-drawer-field-label">Requests</span>
                                    <span className="rc-drawer-field-value" style={{ fontSize: 12 }}>{selectedPackage.requestCount}</span>
                                </div>
                                <div className="rc-drawer-field">
                                    <span className="rc-drawer-field-label">Status</span>
                                    <span className="rc-drawer-field-value" style={{ fontSize: 12 }}><StatusBadge status={selectedPackage.status === "Submitted" ? "Provided" : selectedPackage.status} /></span>
                                </div>
                            </div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>Progress</div>
                            {(() => {
                                const sub = selectedPackage;
                                const isSubmitted = sub.status === "Submitted";
                                const steps = [
                                    { label: "Submitted", done: true, date: sub.submittedAt, desc: "Package received. All files have been uploaded successfully." },
                                    { label: "Internal Review", done: isSubmitted, date: isSubmitted ? sub.submittedAt : "", desc: "IntegraCare is reviewing, categorizing, and removing duplicates from the submitted requests." },
                                    { label: "Assigned", done: false, desc: "Internal teams and owners are being assigned to each request." },
                                    { label: "Published to Tracker", done: false, desc: "Approved requests are made visible in the DD Request Tracker." },
                                    { label: "Complete", done: false, desc: "All requests have been processed and published." },
                                ];
                                return (
                                    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                                        {steps.map((s, i) => (
                                            <div key={s.label} style={{ display: "flex", gap: 10, paddingBottom: 12, position: "relative" }}>
                                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 20, flexShrink: 0 }}>
                                                    <div style={{ width: 16, height: 16, borderRadius: "50%", background: s.done ? "#166534" : "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                                                        {s.done ? (
                                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                                        ) : (
                                                            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#94a3b8" }} />
                                                        )}
                                                    </div>
                                                    {i < steps.length - 1 && <div style={{ width: 1, flex: 1, background: s.done ? "#166534" : "#e2e8f0", minHeight: 16 }} />}
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontSize: 13, fontWeight: 700, color: s.done ? "#166534" : "#94a3b8", marginBottom: 2 }}>{s.label}</div>
                                                    <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.4 }}>{s.desc}</div>
                                                    {s.date && <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{new Date(s.date).toLocaleDateString()}</div>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })()}
                            <div style={{ marginTop: 12, padding: "10px 14px", background: "#f1f5f9", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12, color: "#475569", lineHeight: 1.5 }}>
                                <strong>Note:</strong> Item-level status will be available after IntegraCare completes internal review and publishes approved requests to the tracker.
                                This timeline shows the overall package progress and is informational only.
                            </div>
                        </div>
                        <div className="rc-modal-footer">
                            <button className="rc-btn rc-btn-secondary" onClick={() => setSelectedPackage(null)}>Close</button>
                        </div>
                    </div>
                </div>
            )}

            {portalRequests.length > 0 && (
            <div className="po-section">
                <h2 className="po-section-title">Recent Requests</h2>
                <div className="po-requests-table">
                    <div className="po-requests-header">
                        <span>Title</span><span>Community</span><span>Status</span><span>Priority</span><span>Needed By</span><span>Owner</span>
                    </div>
                    {portalRequests.slice(0, 10).map((req) => (
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
            )}
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
    const publishedRequests = requests.filter(r => r.externalStatus === "Published External").slice(0, 5);

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
                    <h2 className="po-section-title">Recently Published</h2>
                    {recentPublished.length === 0 && publishedRequests.length === 0 ? (
                        <div style={{ padding: 16, fontSize: 13, color: "#64748b" }}>No items published yet.</div>
                    ) : (
                        <div className="po-requests-table">
                            <div className="po-requests-header">
                                <span>Item</span><span>Category</span><span>Status</span><span>Updated</span>
                            </div>
                            {publishedRequests.map((req) => (
                                <div key={req.id} className="po-requests-row" onClick={() => navigate("/portal/requests")} style={{ cursor: "pointer" }}>
                                    <span className="po-requests-title">
                                        {req.title}
                                        <span style={{ fontSize: 10, color: "#64748b", marginLeft: 6 }}>{req.requestId}</span>
                                        {req._publishedWithoutDocuments && (
                                            <span style={{ fontSize: 10, color: "#92400e", fontStyle: "italic", display: "block", marginTop: 1 }}>
                                                Published without supporting document
                                            </span>
                                        )}
                                    </span>
                                    <span style={{ fontSize: 12, color: "#64748b" }}>{req.category}</span>
                                    <span><span style={{ display: "inline-block", padding: "1px 6px", borderRadius: 3, fontSize: 10, fontWeight: 700, background: "#f0fdf4", color: "#166534", border: "1px solid #86efac" }}>Published</span></span>
                                    <span className="po-needed-by">{req.updatedAt || "\u2014"}</span>
                                </div>
                            ))}
                            {recentPublished.map((doc) => (
                                <div key={doc.id} className="po-requests-row" onClick={() => navigate("/portal/documents")} style={{ cursor: "pointer" }}>
                                    <span className="po-requests-title">{doc.name}</span>
                                    <span style={{ fontSize: 12, color: "#64748b" }}>{doc.category}</span>
                                    <span><span style={{ display: "inline-block", padding: "1px 6px", borderRadius: 3, fontSize: 10, fontWeight: 700, background: "#f0fdf4", color: "#166534", border: "1px solid #86efac" }}>Available</span></span>
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

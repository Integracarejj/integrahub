import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getActivePersona, getPersonaIdentity, toExternalStatusInput } from "../../services/portalMockData";
import { getExternalStatusInfo, getStatusPillStyle, getExceptionContext } from "../../services/externalStatusMapping";
import ProjectBadge from "../../components/common/ProjectBadge";
import { usePortalReadModel } from "../../hooks/usePortalReadModel";
import { downloadAuthoritativePublishedArtifact, previewPublishedArtifactFrom, type AuthoritativePublication, type AuthoritativePublicationArtifact } from "../../services/portalPublicationPersistence";
import "./PortalOverview.css";
import "./PortalRequests.css";

function StatusBadge({ status }: { status: string }) {
    const c = getStatusPillStyle(status);
    return (
        <span className="po-status-badge" style={{ background: c.bg, color: c.text, borderColor: c.border }}>
            {status}
        </span>
    );
}

export default function PortalRequests() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const readModel = usePortalReadModel();
    const allRequests = readModel.requests;
    const persona = getActivePersona();
    const allTxns = readModel.transactions;
    const identity = getPersonaIdentity();
    const orgName = identity?.organization?.name || persona.companyName;

    const transactionId = searchParams.get("transactionId");
    const txn = transactionId ? allTxns.find(t => t.id === transactionId) || null : null;

    const statusFromUrl = searchParams.get("status") || "all";
    const [search, setSearch] = useState("");
    const [filterStatus, setFilterStatus] = useState(statusFromUrl);
    const [filterCategory, setFilterCategory] = useState("all");
    const [filterCommunity, setFilterCommunity] = useState("all");
    const [filterPackage, setFilterPackage] = useState("all");
    const [filterProject, setFilterProject] = useState("all");
    const [documentChooser, setDocumentChooser] = useState<{ publication: AuthoritativePublication; mode: "preview" | "download" } | null>(null);
    const [documentPreview, setDocumentPreview] = useState<{ url: string; contentType: string; fileName: string } | null>(null);
    const [documentBusy, setDocumentBusy] = useState(false);
    const [documentError, setDocumentError] = useState<string | null>(null);
    const documentGeneration = useRef(0);
    const publicationByWorkItem = useMemo(() => new Map(readModel.publications.map(item => [item.workItemId, item])), [readModel.publications]);
    useEffect(() => () => { if (documentPreview) URL.revokeObjectURL(documentPreview.url); }, [documentPreview]);
    useEffect(() => () => { documentGeneration.current++; }, []);
    useEffect(() => { documentGeneration.current++; setDocumentChooser(null); setDocumentPreview(null); setDocumentError(null); setDocumentBusy(false); }, [readModel.publications]);

    async function documentAction(publication: AuthoritativePublication, artifact: AuthoritativePublicationArtifact, mode: "preview" | "download") {
        if (documentBusy) return;
        const generation = documentGeneration.current;
        setDocumentBusy(true);
        setDocumentError(null);
        try {
            if (mode === "download") await downloadAuthoritativePublishedArtifact(publication.id, artifact);
            else {
                const result = await previewPublishedArtifactFrom(`/api/portal/recapitalization/publications/${publication.id}/artifacts/${artifact.id}/content`, artifact);
                if (generation === documentGeneration.current) setDocumentPreview({ ...result, fileName: artifact.fileName });
                else URL.revokeObjectURL(result.url);
            }
        } catch (error) {
            if (generation === documentGeneration.current) setDocumentError(error instanceof Error ? error.message : "Document could not be opened");
        } finally {
            if (generation === documentGeneration.current) setDocumentBusy(false);
        }
    }

    function chooseDocument(publication: AuthoritativePublication, mode: "preview" | "download") {
        const eligible = mode === "preview" ? publication.artifacts.filter(item => /^application\/pdf$|^image\//i.test(item.contentType)) : publication.artifacts;
        if (eligible.length === 1) void documentAction(publication, eligible[0], mode);
        else setDocumentChooser({ publication, mode });
    }

    const scopedRequests = useMemo(() => {
        if (!transactionId || !txn) return allRequests;
        return allRequests.filter(r => r.transactionId === transactionId);
    }, [allRequests, transactionId, txn]);

    // Extract unique package names from requests that have them
    const packageNames = useMemo(() => {
        const names = new Set<string>();
        scopedRequests.forEach(r => {
            if (r._sourcePackageName) names.add(r._sourcePackageName);
        });
        return [...names].sort();
    }, [scopedRequests]);

    const filtered = useMemo(() => {
        let result = [...scopedRequests];
        if (search) {
            const q = search.toLowerCase();
            result = result.filter(r => r.title.toLowerCase().includes(q) || r.requestId.toLowerCase().includes(q) || r.category.toLowerCase().includes(q));
        }
        if (filterStatus !== "all") {
            if (filterStatus === "Action Needed") {
                result = result.filter(r => getExternalStatusInfo(toExternalStatusInput(r)).externalActionRequired);
            } else {
                result = result.filter(r => getExternalStatusInfo(toExternalStatusInput(r)).label === filterStatus);
            }
        }
        if (filterCategory !== "all") result = result.filter(r => r.category === filterCategory);
        if (filterCommunity !== "all") result = result.filter(r => r.communityNames.includes(filterCommunity));
        if (filterPackage !== "all") result = result.filter(r => r._sourcePackageName === filterPackage);
        if (filterProject !== "all") result = result.filter(r => r.transactionName === filterProject);
        return result;
    }, [scopedRequests, search, filterStatus, filterCategory, filterCommunity, filterPackage, filterProject]);

    const communities = txn?.communities || allTxns.flatMap(t => t.communities).filter((c, i, a) => a.findIndex(x => x.id === c.id) === i) || [];
    const categories = [...new Set(scopedRequests.map(r => r.category).filter(Boolean))];
    const projectNames = [...new Set(scopedRequests.map(r => r.transactionName).filter(Boolean))].sort();

    return (
        <div className={`portal-overview${readModel.isRealExternal ? " pr-external" : ""}`}>
            {txn ? (
                <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 12, color: "#4f46e5", fontWeight: 600, marginBottom: 4, cursor: "pointer" }} onClick={() => navigate("/portal/requests")}>
                        &larr; All Transactions
                    </div>
                    <h1 className="po-welcome-title" style={{ marginBottom: 2 }}>{txn.name}</h1>
                    <p className="po-welcome-sub" style={{ marginBottom: 0 }}>
                        {orgName} &middot; {scopedRequests.length} request{scopedRequests.length !== 1 ? "s" : ""}
                    </p>
                </div>
            ) : (
                <>
                    <h1 className="po-welcome-title">Requests</h1>
                    <p className="po-welcome-sub" style={{ marginBottom: 20 }}>
                        {readModel.isRealExternal ? "Published requests and submissions for your authorized organizations." : persona.role === "Owner / Seller" && "Documents requested from ABC Company for the due diligence process. Use the Upload button to provide requested materials."}
                        {!readModel.isRealExternal && persona.role === "Buyer" && "All due diligence requests for the ABC Company Portfolio. Track progress and submit new requests as needed."}
                        {!readModel.isRealExternal && persona.role === "Broker" && "All due diligence requests across the transaction. Filter by community or status to find what needs attention."}
                    </p>
                </>
            )}

            <div className="po-filter-row">
                <div className="po-search-box">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                        type="text"
                        placeholder="Search requests..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <select className="po-filter-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                    <option value="all">All Statuses</option>
                    <option value="Submitted">Submitted</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Under Review">Under Review</option>
                    <option value="Information Requested">Information Requested</option>
                    <option value="Awaiting Your Review">Awaiting Your Review</option>
                    <option value="Changes Requested">Changes Requested</option>
                    <option value="Exception Review">Exception Review</option>
                    <option value="Complete">Complete</option>
                    <option value="Action Needed">Action Needed</option>
                </select>
                <select className="po-filter-select" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                    <option value="all">All Categories</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select className="po-filter-select" value={filterCommunity} onChange={(e) => setFilterCommunity(e.target.value)}>
                    <option value="all">All Communities</option>
                    {communities.map((c: any) => <option key={c.id || c} value={c.name || c}>{c.name || c}</option>)}
                </select>
                {projectNames.length > 1 && (
                    <select className="po-filter-select" value={filterProject} onChange={(e) => setFilterProject(e.target.value)} style={{ minWidth: 140 }}>
                        <option value="all">All Projects</option>
                        {projectNames.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                )}
                {packageNames.length > 1 && (
                    <select className="po-filter-select" value={filterPackage} onChange={(e) => setFilterPackage(e.target.value)} style={{ minWidth: 140 }}>
                        <option value="all">All Packages</option>
                        {packageNames.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                )}
            </div>

            {readModel.loading && <div className="po-empty-state"><p>Loading submitted requests...</p></div>}
            {readModel.error && <div className="po-empty-state"><p>{readModel.error}</p></div>}
            {documentError && !documentChooser && <div className="pr-error" role="alert">{documentError}<button className="rc-btn rc-btn-ghost" onClick={() => setDocumentError(null)}>Dismiss</button></div>}

            {!readModel.loading && !readModel.error && <div className="rc-card">
                <div className="po-requests-table">
                    <div className="po-requests-header" style={readModel.isRealExternal ? undefined : { gridTemplateColumns: "0.5fr 2.2fr 0.9fr 0.9fr 0.8fr 0.9fr 0.7fr 0.7fr" }}>
                        <span>ID</span><span>Request</span><span>Project</span><span>Status</span>{!readModel.isRealExternal && <span>Review Type</span>}<span>Category</span><span>Community</span><span>Updated</span>{readModel.isRealExternal && <span>Actions</span>}
                    </div>
                    {filtered.length === 0 ? (
                        <div className="po-empty-state" style={{ padding: "40px 20px", textAlign: "center" }}>
                            <p style={{ fontSize: 14, color: "#475569" }}>No requests match the selected filters.</p>
                        </div>
                    ) : filtered.map((req) => {
                        const publication = publicationByWorkItem.get(req.id);
                        const extInfo = getExternalStatusInfo(toExternalStatusInput(req));
                        const excCtx = getExceptionContext(req);
                        const isClarResp = req._rawStatus === "Clarification Needed" && extInfo.status === "Under Review" && !!req._workNotes?.some(n => n.action === "Clarification Response") && !req._returnReason;
                        const isReworking = req._partnerDecision === "Rework Required" && extInfo.status === "Under Review";
                        return (
                            <div key={req.id} className="po-requests-row" style={readModel.isRealExternal ? undefined : { gridTemplateColumns: "0.5fr 2.2fr 0.9fr 0.9fr 0.8fr 0.9fr 0.7fr 0.7fr", cursor: "pointer" }} onClick={readModel.isRealExternal ? undefined : () => navigate(`/portal/requests/${req.id}`)} title={req.requestId}>
                                <span className="po-requests-id">{req.requestId.split("-").length >= 3 ? req.requestId.split("-")[0] + "-" + req.requestId.split("-").slice(-1)[0] : req.requestId}</span>
                                <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
                                    <span className="po-requests-title" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={req.title}>{req.title.split(" - ").slice(1).join(" - ").trim() || req.title}</span>
                                    {publication && !readModel.isRealExternal && <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={event => { event.stopPropagation(); navigate(`/portal/publications/${publication.id}`); }}>Open {req.requestId} · Publication {publication.publicationNumber}</button>}
                                    {req._sourcePackageName && (
                                        <span style={{ fontSize: 10, color: "#64748b", fontWeight: 400 }}>{req._sourceFileName || req._sourcePackageName}</span>
                                    )}
                                    {extInfo.status === "Awaiting Your Review" && !readModel.isRealExternal && (
                                        <span style={{ fontSize: 11, color: "#047857", fontWeight: 500 }}>Document ready for approval</span>
                                    )}
                                    {excCtx.contextLabel && (
                                        <span style={{ fontSize: 11, color: "#6d28d9", fontWeight: 500 }}>{excCtx.contextLabel}</span>
                                    )}
                                    {extInfo.status === "Information Requested" && (
                                        <span style={{ fontSize: 11, color: "#92400e", fontWeight: 500 }}>IntegraCare needs additional information</span>
                                    )}
                                    {isClarResp && (
                                        <span style={{ fontSize: 11, color: "#0e7490", fontWeight: 500 }}>Response received — no action required</span>
                                    )}
                                    {isReworking && (
                                        <span style={{ fontSize: 11, color: "#c2410c", fontWeight: 500 }}>Rework requested — IntegraCare reviewing</span>
                                    )}
                                </div>
                                <span style={{ display: "flex", alignItems: "center" }}>
                                    {readModel.isRealExternal ? <span className="pr-project" title={req.transactionName}>{req.transactionName}</span> : <ProjectBadge name={req.transactionName} />}
                                </span>
                                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                    <StatusBadge status={extInfo.label} />
                                </span>
                                {!readModel.isRealExternal && <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                    {excCtx.recommendationType ? (
                                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#0f172a", fontWeight: 600, fontSize: 11, background: "#fff", padding: "2px 8px", borderRadius: 4, border: excCtx.recommendationType === "Duplicate" ? "1px solid #c4b5fd" : "1px solid #a5b4fc", whiteSpace: "nowrap" }}>
                                            {excCtx.recommendationType === "Duplicate" ? "Duplicate" : "Not Applicable"}
                                        </span>
                                    ) : (
                                        <span style={{ color: "#94a3b8", fontSize: 12 }}>{"\u2014"}</span>
                                    )}
                                </span>}
                                <span className="po-requests-txn">{req.category || "\u2014"}</span>
                                <span className="po-requests-txn">{req.communityNames[0] || "\u2014"}</span>
                                <span className="po-requests-txn">{readModel.isRealExternal ? String(req.updatedAt || req.neededBy || "\u2014").slice(0, 10) : req.updatedAt || req.neededBy || "\u2014"}</span>
                                {readModel.isRealExternal && <div className="pr-actions">
                                    {publication && publication.artifacts.length > 0 && <>
                                        {publication.artifacts.some(item => /^application\/pdf$|^image\//i.test(item.contentType)) && <button type="button" className="pr-action" aria-label={`Preview documents for ${req.requestId}`} title="Preview documents" disabled={documentBusy} onClick={() => chooseDocument(publication, "preview")}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.6"/></svg></button>}
                                        <button type="button" className="pr-action" aria-label={`Download documents for ${req.requestId}`} title="Download documents" disabled={documentBusy} onClick={() => chooseDocument(publication, "download")}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3v12m-4-4 4 4 4-4M4 18v3h16v-3"/></svg></button>
                                    </>}
                                    {publication && <button type="button" className="pr-open" aria-label={`Open request ${req.requestId}: ${req.title}`} title="Open request" onClick={() => navigate(`/portal/publications/${publication.id}`)}><span aria-hidden="true">›</span></button>}
                                </div>}
                            </div>
                        );
                    })}
                </div>
            </div>}
            {documentChooser && <div className="rc-modal-overlay" role="dialog" aria-modal="true" aria-label={`${documentChooser.mode === "preview" ? "Preview" : "Download"} documents for ${documentChooser.publication.requestId}`}>
                <div className="rc-modal pr-chooser"><div className="rc-modal-header"><h2>{documentChooser.mode === "preview" ? "Preview supporting documents" : "Download supporting documents"}</h2><button className="rc-btn rc-btn-ghost" onClick={() => setDocumentChooser(null)}>Close</button></div>
                    {documentError && <div className="pr-error" role="alert">{documentError}</div>}
                    <div className="pr-chooser-list">{documentChooser.publication.artifacts.filter(item => documentChooser.mode === "download" || /^application\/pdf$|^image\//i.test(item.contentType)).map(item => <button key={item.id} className="pr-chooser-item" disabled={documentBusy} onClick={() => { void documentAction(documentChooser.publication, item, documentChooser.mode); if (documentChooser.mode === "preview") setDocumentChooser(null); }}><span>{item.fileName}</span><strong>{documentChooser.mode === "preview" ? "Preview" : "Download"}</strong></button>)}</div>
                </div>
            </div>}
            {documentPreview && <div className="rc-modal-overlay" role="dialog" aria-modal="true" aria-label={`Preview ${documentPreview.fileName}`}><div className="rc-modal pr-preview"><div className="rc-modal-header"><h2>{documentPreview.fileName}</h2><button className="rc-btn rc-btn-ghost" onClick={() => setDocumentPreview(null)}>Close</button></div>{documentPreview.contentType === "application/pdf" ? <iframe title={documentPreview.fileName} src={documentPreview.url} /> : <img src={documentPreview.url} alt={documentPreview.fileName} />}</div></div>}
        </div>
    );
}

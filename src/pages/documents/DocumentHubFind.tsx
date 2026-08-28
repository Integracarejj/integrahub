import { useEffect, useRef, useState } from "react";
import { ArtifactUploadError, downloadArtifact, listArtifacts, type ArtifactDestination, type ArtifactLibraryKey, type ArtifactListQuery, type ArtifactRecord } from "../../services/artifactPersistence";
import { formatDocumentSize, INTERNAL_WORK_USES, internalWorkUseLabel } from "./documentHubState";

const FILE_TYPES = [
    ["pdf", "PDF"], ["word", "Word"], ["excel", "Excel"], ["powerpoint", "PowerPoint"],
    ["text", "Text / CSV"], ["images", "Images"],
] as const;

function formatDate(value: string | null): string {
    if (!value) return "Not available";
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}

function friendlyType(extension: string): string {
    const value = extension.toLowerCase();
    if (value === "pdf") return "PDF";
    if (["doc", "docx"].includes(value)) return "Word";
    if (["xls", "xlsx"].includes(value)) return "Excel";
    if (["ppt", "pptx"].includes(value)) return "PowerPoint";
    if (["txt", "csv"].includes(value)) return "Text / CSV";
    if (["png", "jpg", "jpeg", "gif", "webp", "tif", "tiff"].includes(value)) return "Image";
    return extension.toUpperCase();
}

function availabilityLabel(artifact: ArtifactRecord): string {
    return artifact.storageDestination === "Knowledge" ? "Knowledge" : `Working · ${internalWorkUseLabel(artifact.libraryKey as ArtifactLibraryKey)}`;
}

export const FIND_PAGE_SIZE = 10;
export const SEARCH_DEBOUNCE_MS = 300;

export default function DocumentHubFind({ refreshKey = 0 }: { refreshKey?: number }) {
    const [searchText, setSearchText] = useState("");
    const [query, setQuery] = useState<ArtifactListQuery>({ q: "", destination: "", libraryKey: "", fileType: "", dateRange: "all", sort: "newest", page: 1, pageSize: FIND_PAGE_SIZE });
    const [artifacts, setArtifacts] = useState<ArtifactRecord[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refresh, setRefresh] = useState(0);
    const [selected, setSelected] = useState<ArtifactRecord | null>(null);
    const [downloadState, setDownloadState] = useState<"idle" | "loading">("idle");
    const [downloadError, setDownloadError] = useState<string | null>(null);
    const requestSequence = useRef(0);

    useEffect(() => {
        const value = searchText.trim();
        const timer = window.setTimeout(() => setQuery(current => current.q === value ? current : { ...current, q: value, page: 1 }), SEARCH_DEBOUNCE_MS);
        return () => window.clearTimeout(timer);
    }, [searchText]);

    useEffect(() => {
        const sequence = ++requestSequence.current;
        const controller = new AbortController();
        setLoading(true); setError(null);
        listArtifacts(query, fetch, controller.signal).then(result => {
            if (sequence !== requestSequence.current) return;
            setArtifacts(result.artifacts); setTotal(result.total); setLoading(false);
            setSelected(current => current && result.artifacts.some(item => item.id === current.id) ? current : null);
        }).catch(cause => {
            if (controller.signal.aborted || sequence !== requestSequence.current) return;
            setError(cause instanceof ArtifactUploadError ? cause.message : "Document Hub could not load documents. Please retry.");
            setLoading(false);
        });
        return () => controller.abort();
    }, [query, refresh, refreshKey]);

    useEffect(() => {
        if (!selected) return;
        function closeOnEscape(event: KeyboardEvent) { if (event.key === "Escape") setSelected(null); }
        window.addEventListener("keydown", closeOnEscape);
        return () => window.removeEventListener("keydown", closeOnEscape);
    }, [selected]);

    function updateQuery(values: Partial<ArtifactListQuery>) {
        setQuery(current => ({ ...current, ...values, page: values.page ?? 1 }));
    }

    async function downloadSelected() {
        if (!selected || downloadState === "loading") return;
        setDownloadState("loading"); setDownloadError(null);
        try { await downloadArtifact(selected.id, selected.fileName); }
        catch (cause) { setDownloadError(cause instanceof ArtifactUploadError ? cause.message : "Document Hub could not download this file."); }
        finally { setDownloadState("idle"); }
    }

    const page = query.page || 1;
    const pageSize = query.pageSize || FIND_PAGE_SIZE;
    const lastPage = Math.max(1, Math.ceil(total / pageSize));

    return <section className="document-hub-find-workspace" aria-labelledby="find-title">
        <div className="document-hub-find-heading"><div><h2 id="find-title">Find Documents</h2><p>Search and download documents stored in Document Hub.</p></div><span>{loading ? "Loading…" : total === 0 ? "No documents found" : `${total} ${total === 1 ? "document" : "documents"} found`}</span></div>
        <form className="document-hub-search" onSubmit={event => { event.preventDefault(); updateQuery({ q: searchText.trim() }); }}>
            <label htmlFor="document-hub-search">Search documents</label>
            <div><input id="document-hub-search" value={searchText} onChange={event => setSearchText(event.target.value)} placeholder="Search documents" maxLength={200} />
                <button type="submit">Search</button></div>
        </form>
        <div className="document-hub-filters">
            <label>Availability<select aria-label="Availability" value={query.destination} onChange={event => updateQuery({ destination: event.target.value as ArtifactDestination | "", libraryKey: "" })}><option value="">All</option><option value="Working">Working</option><option value="Knowledge">Knowledge</option></select></label>
            <label>Work area<select aria-label="Work area" value={query.libraryKey} disabled={query.destination === "Knowledge"} onChange={event => updateQuery({ libraryKey: event.target.value as ArtifactLibraryKey | "", destination: "Working" })}><option value="">All work areas</option>{INTERNAL_WORK_USES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <label>File type<select aria-label="File type" value={query.fileType} onChange={event => updateQuery({ fileType: event.target.value as ArtifactListQuery["fileType"] })}><option value="">All types</option>{FILE_TYPES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
            <label>Uploaded<select aria-label="Uploaded date" value={query.dateRange} onChange={event => updateQuery({ dateRange: event.target.value as ArtifactListQuery["dateRange"] })}><option value="all">All time</option><option value="today">Today</option><option value="7days">Last 7 days</option><option value="30days">Last 30 days</option></select></label>
            <label>Sort<select aria-label="Sort" value={query.sort} onChange={event => updateQuery({ sort: event.target.value as ArtifactListQuery["sort"] })}><option value="newest">Newest uploaded</option><option value="name">Name</option><option value="area">Use</option></select></label>
        </div>
        {loading && <div className="document-hub-find-state" role="status"><span className="document-hub-spinner" /> Loading documents…</div>}
        {!loading && error && <div className="document-hub-find-state error" role="alert"><strong>Documents could not be loaded</strong><span>{error}</span><button type="button" onClick={() => setRefresh(value => value + 1)}>Retry</button></div>}
        {!loading && !error && artifacts.length === 0 && <div className="document-hub-find-state empty"><strong>No documents found</strong><span>Change the filters, clear the search, or switch to Provide Documents.</span></div>}
        {!loading && !error && artifacts.length > 0 && <>
            <div className="document-hub-results" role="list">
                {artifacts.map(artifact => <button type="button" role="listitem" key={artifact.id} className={selected?.id === artifact.id ? "selected" : ""} onClick={() => { setSelected(artifact); setDownloadError(null); }}>
                    <span className="document-hub-result-name"><strong>{artifact.fileName}</strong><small>{formatDocumentSize(artifact.size)}</small></span>
                    <span><small>Availability</small>{availabilityLabel(artifact)}</span><span><small>Type</small>{friendlyType(artifact.extension)}</span><span><small>Uploaded</small>{formatDate(artifact.uploadedAt)}</span>
                </button>)}
            </div>
            <div className="document-hub-pagination"><span>Page {page} of {lastPage}</span><div><button type="button" disabled={page <= 1} onClick={() => updateQuery({ page: page - 1 })}>Previous</button><button type="button" disabled={page >= lastPage} onClick={() => updateQuery({ page: page + 1 })}>Next</button></div></div>
        </>}
        {selected && <aside className="document-hub-detail" aria-label="Document details" aria-modal="true" role="dialog">
            <div className="document-hub-detail-heading"><div><small>Document details</small><h3>{selected.fileName}</h3></div><button type="button" aria-label="Close document details" onClick={() => setSelected(null)}>×</button></div>
            <dl><div><dt>Availability</dt><dd>{availabilityLabel(selected)}</dd></div><div><dt>Type</dt><dd>{friendlyType(selected.extension)}</dd></div><div><dt>Size</dt><dd>{formatDocumentSize(selected.size)}</dd></div><div><dt>Uploaded</dt><dd>{formatDate(selected.uploadedAt)}</dd></div>{selected.description && <div><dt>Description</dt><dd>{selected.description}</dd></div>}{selected.effectiveDate && <div><dt>Effective date</dt><dd>{formatDate(selected.effectiveDate)}</dd></div>}</dl>
            {downloadError && <p className="document-hub-download-error" role="alert">{downloadError}</p>}
            <button type="button" className="document-hub-primary" onClick={downloadSelected} disabled={downloadState === "loading"}>{downloadState === "loading" ? "Downloading…" : "Download"}</button>
        </aside>}
    </section>;
}

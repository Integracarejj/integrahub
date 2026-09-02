import { useCallback, useEffect, useRef, useState } from "react";
import { ArtifactUploadError, downloadArtifact, getArtifactMetadataOptions, listArtifacts, moveArtifact, removeArtifact, updateArtifactMetadata, type ArtifactDestination, type ArtifactLibraryKey, type ArtifactListQuery, type ArtifactMetadataInput, type ArtifactMetadataOptions, type ArtifactRecord } from "../../services/artifactPersistence";
import { formatDocumentSize, INTERNAL_WORK_USES, internalWorkUseLabel } from "./documentHubState";
import { useCurrentUser } from "../../hooks/useCurrentUser";

const FILE_TYPES = [
    ["pdf", "PDF"], ["word", "Word"], ["excel", "Excel"], ["powerpoint", "PowerPoint"],
    ["text", "Text / CSV"], ["images", "Images"],
] as const;

export const MOVE_RETENTION_HELPER = "Move changes the document's active IntegraIQ location. Historical copies may be retained for audit and recovery.";
export const REMOVE_FROM_HUB_CONFIRMATION = "It will no longer appear in Document Hub search or be available for download here. The underlying file is retained for audit and recovery.";

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

export function canEditArtifactMetadata(role: string | null | undefined): boolean {
    return role === "Editor" || role === "PlatformAdmin";
}

export function artifactMetadataHasChanges(initial: ArtifactMetadataInput | null, current: ArtifactMetadataInput | null): boolean {
    if (!initial || !current) return false;
    return (["documentTitle", "documentTypeKey", "businessTopicSlug", "documentOrigin", "description"] as const)
        .some(key => (initial[key] || "") !== (current[key] || ""));
}

export function isNoOpArtifactMove(artifact: Pick<ArtifactRecord, "storageDestination" | "libraryKey">,
    destination: ArtifactDestination, workArea: ArtifactLibraryKey | null): boolean {
    return artifact.storageDestination === destination && (artifact.libraryKey || null) === (workArea || null);
}

export default function DocumentHubFind({ refreshKey = 0, canEditMetadata: canEditOverride }: { refreshKey?: number; canEditMetadata?: boolean }) {
    const { user: currentUser } = useCurrentUser();
    const canEditMetadata = canEditOverride ?? canEditArtifactMetadata(currentUser?.userRecord?.role);
    const [searchText, setSearchText] = useState("");
    const [query, setQuery] = useState<ArtifactListQuery>({ q: "", destination: "", libraryKey: "", fileType: "", dateRange: "all", sort: "newest", page: 1, pageSize: FIND_PAGE_SIZE });
    const [artifacts, setArtifacts] = useState<ArtifactRecord[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [hasLoadedResults, setHasLoadedResults] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [refresh, setRefresh] = useState(0);
    const [selected, setSelected] = useState<ArtifactRecord | null>(null);
    const [downloadState, setDownloadState] = useState<"idle" | "loading">("idle");
    const [downloadError, setDownloadError] = useState<string | null>(null);
    const [metadataOptions, setMetadataOptions] = useState<ArtifactMetadataOptions>({ documentTypes: [], businessTopics: [] });
    const [editValues, setEditValues] = useState<ArtifactMetadataInput | null>(null);
    const [editInitialValues, setEditInitialValues] = useState<ArtifactMetadataInput | null>(null);
    const [editError, setEditError] = useState<string | null>(null);
    const [saveConfirmation, setSaveConfirmation] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [lifecycleMode, setLifecycleMode] = useState<"menu" | "move" | "remove" | null>(null);
    const [moveDestination, setMoveDestination] = useState<ArtifactDestination>("Knowledge");
    const [moveWorkArea, setMoveWorkArea] = useState<ArtifactLibraryKey | null>(null);
    const [moveKey, setMoveKey] = useState<string | null>(null);
    const [removalReason, setRemovalReason] = useState("");
    const [lifecycleBusy, setLifecycleBusy] = useState(false);
    const [lifecycleError, setLifecycleError] = useState<string | null>(null);
    const [lifecycleConfirmation, setLifecycleConfirmation] = useState<string | null>(null);
    const drawerOpen = selected !== null;
    const requestSequence = useRef(0);
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const selectedTriggerRef = useRef<HTMLButtonElement | null>(null);

    useEffect(() => { getArtifactMetadataOptions().then(setMetadataOptions).catch(() => undefined); }, []);

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
            setArtifacts(result.artifacts); setTotal(result.total); setHasLoadedResults(true); setLoading(false);
            setSelected(current => current && result.artifacts.some(item => item.id === current.id) ? current : null);
        }).catch(cause => {
            if (controller.signal.aborted || sequence !== requestSequence.current) return;
            setError(cause instanceof ArtifactUploadError ? cause.message : "Document Hub could not load documents. Please retry.");
            setLoading(false);
        });
        return () => controller.abort();
    }, [query, refresh, refreshKey]);

    const closeDrawer = useCallback(() => {
        if (artifactMetadataHasChanges(editInitialValues, editValues)
            && !window.confirm("Discard your unsaved document detail changes?")) return false;
        setSelected(null); setEditValues(null); setEditInitialValues(null); setEditError(null); setSaveConfirmation(null);
        setLifecycleMode(null); setLifecycleError(null); setMoveKey(null); setRemovalReason("");
        window.setTimeout(() => selectedTriggerRef.current?.focus(), 0);
        return true;
    }, [editInitialValues, editValues]);

    useEffect(() => {
        if (!selected) return;
        closeButtonRef.current?.focus();
    }, [selected?.id]);

    useEffect(() => {
        if (!drawerOpen) return;
        const scrollX = window.scrollX;
        const scrollY = window.scrollY;
        const previousOverflow = document.body.style.overflow;
        const previousPaddingRight = document.body.style.paddingRight;
        const scrollbarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
        const bodyPaddingRight = Number.parseFloat(window.getComputedStyle(document.body).paddingRight) || 0;
        document.body.style.overflow = "hidden";
        if (scrollbarWidth > 0) document.body.style.paddingRight = `${bodyPaddingRight + scrollbarWidth}px`;
        return () => {
            document.body.style.overflow = previousOverflow;
            document.body.style.paddingRight = previousPaddingRight;
            window.scrollTo(scrollX, scrollY);
        };
    }, [drawerOpen]);

    useEffect(() => {
        if (!selected) return;
        function closeOnEscape(event: KeyboardEvent) { if (event.key === "Escape") closeDrawer(); }
        window.addEventListener("keydown", closeOnEscape);
        return () => window.removeEventListener("keydown", closeOnEscape);
    }, [selected, closeDrawer]);

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

    function beginEdit() {
        if (!selected) return;
        const values = { documentTitle: selected.documentTitle || null, documentTypeKey: selected.documentType?.key || null,
            businessTopicSlug: selected.businessTopic?.slug || null, documentOrigin: selected.documentOrigin || null,
            description: selected.description || null };
        setEditValues(values); setEditInitialValues(values); setEditError(null); setSaveConfirmation(null);
    }

    async function saveEdit() {
        if (!selected || !editValues || saving) return;
        setSaving(true); setEditError(null); setSaveConfirmation(null);
        try {
            const updated = await updateArtifactMetadata(selected.id, editValues);
            setSelected(updated); setArtifacts(rows => rows.map(row => row.id === updated.id ? updated : row));
            setEditValues(null); setEditInitialValues(null); setSaveConfirmation("Document details updated");
        } catch (cause) {
            setEditError(cause instanceof ArtifactUploadError ? cause.message : "Document details could not be saved.");
        } finally { setSaving(false); }
    }

    function beginMove() {
        if (!selected) return;
        setMoveDestination(selected.storageDestination);
        setMoveWorkArea(selected.libraryKey);
        setMoveKey(crypto.randomUUID());
        setLifecycleError(null); setLifecycleMode("move");
    }

    async function submitMove() {
        if (!selected || !moveKey || lifecycleBusy || isNoOpArtifactMove(selected, moveDestination, moveWorkArea)) return;
        setLifecycleBusy(true); setLifecycleError(null);
        try {
            const updated = await moveArtifact(selected.id, moveDestination, moveDestination === "Working" ? moveWorkArea : null, moveKey);
            setSelected(updated); setArtifacts(rows => rows.map(row => row.id === updated.id ? updated : row));
            setLifecycleMode(null); setMoveKey(null); setSaveConfirmation("Document moved"); setRefresh(value => value + 1);
        } catch (cause) {
            setLifecycleError(cause instanceof ArtifactUploadError ? cause.message : "Document could not be moved.");
        } finally { setLifecycleBusy(false); }
    }

    async function submitRemove() {
        if (!selected || lifecycleBusy) return;
        setLifecycleBusy(true); setLifecycleError(null);
        try {
            await removeArtifact(selected.id, removalReason.trim() || null);
            const removedId = selected.id;
            setArtifacts(rows => rows.filter(row => row.id !== removedId));
            setTotal(value => Math.max(0, value - 1)); setSelected(null); setLifecycleMode(null);
            setRemovalReason(""); setLifecycleConfirmation("Removed from Document Hub"); setRefresh(value => value + 1);
        } catch (cause) {
            setLifecycleError(cause instanceof ArtifactUploadError ? cause.message : "Document could not be removed from Document Hub.");
        } finally { setLifecycleBusy(false); }
    }

    const page = query.page || 1;
    const pageSize = query.pageSize || FIND_PAGE_SIZE;
    const lastPage = Math.max(1, Math.ceil(total / pageSize));

    return <section className="document-hub-find-workspace" aria-labelledby="find-title">
        <div className="document-hub-find-heading"><div><h2 id="find-title">Find Documents</h2><p>Search and download documents stored in Document Hub.</p></div><span aria-live="polite">{loading ? (hasLoadedResults ? `Updating… · ${total} ${total === 1 ? "document" : "documents"}` : "Loading…") : total === 0 ? "No documents found" : `${total} ${total === 1 ? "document" : "documents"} found`}</span></div>
        <form className="document-hub-search" onSubmit={event => { event.preventDefault(); updateQuery({ q: searchText.trim() }); }}>
            <label htmlFor="document-hub-search">Search documents</label>
            <div><input id="document-hub-search" value={searchText} onChange={event => setSearchText(event.target.value)} placeholder="Search documents" maxLength={200} />
                <button type="submit">Search</button></div>
        </form>
        <div className="document-hub-filters">
            <label>Availability<select aria-label="Availability" value={query.destination} onChange={event => updateQuery({ destination: event.target.value as ArtifactDestination | "", libraryKey: "" })}><option value="">All</option><option value="Working">Working</option><option value="Knowledge">Knowledge</option></select></label>
            <label>Work area<select aria-label="Work area" value={query.libraryKey} disabled={query.destination === "Knowledge"} onChange={event => updateQuery({ libraryKey: event.target.value as ArtifactLibraryKey | "", destination: "Working" })}><option value="">All work areas</option>{INTERNAL_WORK_USES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <label>File type<select aria-label="File type" value={query.fileType} onChange={event => updateQuery({ fileType: event.target.value as ArtifactListQuery["fileType"] })}><option value="">All types</option>{FILE_TYPES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
            <label>Document type<select aria-label="Document type" value={query.documentTypeKey || ""} onChange={event => updateQuery({ documentTypeKey: event.target.value })}><option value="">All document types</option>{metadataOptions.documentTypes.map(type => <option key={type.key} value={type.key}>{type.displayName}</option>)}</select></label>
            <label>Business topic<select aria-label="Business topic" value={query.businessTopicSlug || ""} onChange={event => updateQuery({ businessTopicSlug: event.target.value })}><option value="">All topics</option>{metadataOptions.businessTopics.map(topic => <option key={topic.slug} value={topic.slug}>{topic.name}</option>)}</select></label>
            <label>Uploaded<select aria-label="Uploaded date" value={query.dateRange} onChange={event => updateQuery({ dateRange: event.target.value as ArtifactListQuery["dateRange"] })}><option value="all">All time</option><option value="today">Today</option><option value="7days">Last 7 days</option><option value="30days">Last 30 days</option></select></label>
            <label>Sort<select aria-label="Sort" value={query.sort} onChange={event => updateQuery({ sort: event.target.value as ArtifactListQuery["sort"] })}><option value="newest">Newest uploaded</option><option value="name">Name</option><option value="area">Use</option></select></label>
        </div>
        {lifecycleConfirmation && <p className="document-hub-save-success document-hub-lifecycle-confirmation" role="status"><span aria-hidden="true">✓</span> {lifecycleConfirmation}</p>}
        {loading && !hasLoadedResults && <div className="document-hub-find-state" role="status"><span className="document-hub-spinner" /> Loading documents…</div>}
        {error && <div className={`document-hub-find-state error${hasLoadedResults ? " document-hub-refetch-error" : ""}`} role="alert"><strong>Documents could not be loaded</strong><span>{error}</span><button type="button" onClick={() => setRefresh(value => value + 1)}>Retry</button></div>}
        {hasLoadedResults && artifacts.length === 0 && <div className="document-hub-find-state empty"><strong>No documents found</strong><span>Change the filters, clear the search, or switch to Provide Documents.</span></div>}
        {hasLoadedResults && artifacts.length > 0 && <>
            <div className={`document-hub-results${loading ? " is-updating" : ""}`} role="list" aria-busy={loading}>
                {artifacts.map(artifact => <button type="button" role="listitem" key={artifact.id} className={selected?.id === artifact.id ? "selected" : ""} onClick={event => { selectedTriggerRef.current = event.currentTarget; setSelected(artifact); setDownloadError(null); setEditError(null); setSaveConfirmation(null); setLifecycleConfirmation(null); setLifecycleMode(null); setLifecycleError(null); setMoveKey(null); setRemovalReason(""); setEditValues(null); setEditInitialValues(null); }}>
                    <span className="document-hub-result-name"><strong>{artifact.documentTitle || artifact.fileName}</strong><small>{artifact.documentTitle ? artifact.fileName : formatDocumentSize(artifact.size)}</small></span>
                    <span><small>Availability</small>{availabilityLabel(artifact)}</span><span><small>Business context</small>{[artifact.documentType?.displayName, artifact.businessTopic?.name].filter(Boolean).join(" · ") || friendlyType(artifact.extension)}</span><span><small>Uploaded</small>{formatDate(artifact.uploadedAt)}</span>
                </button>)}
            </div>
            <div className="document-hub-pagination"><span>Page {page} of {lastPage}</span><div><button type="button" disabled={page <= 1} onClick={() => updateQuery({ page: page - 1 })}>Previous</button><button type="button" disabled={page >= lastPage} onClick={() => updateQuery({ page: page + 1 })}>Next</button></div></div>
        </>}
        {selected && <div className="document-hub-detail-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) closeDrawer(); }}>
            <aside className={`document-hub-detail${canEditMetadata ? "" : " metadata-read-only"}`} aria-label="Document details" aria-modal="true" role="dialog" onMouseDown={event => event.stopPropagation()}>
            <header className="document-hub-detail-heading"><div><small>Document details</small><h3>{selected.documentTitle || selected.fileName}</h3></div><button ref={closeButtonRef} type="button" aria-label="Close document details" onClick={closeDrawer}>×</button></header>
            <div className="document-hub-detail-body">
                {saveConfirmation && <p className="document-hub-save-success" role="status"><span aria-hidden="true">✓</span> {saveConfirmation}</p>}
                {!editValues ? <>
                    <section className="document-hub-detail-section"><h4>Document</h4><dl><div><dt>Title</dt><dd>{selected.documentTitle || selected.fileName}</dd></div><div><dt>Original filename</dt><dd>{selected.fileName}</dd></div><div><dt>Document type</dt><dd>{selected.documentType?.displayName || "Not provided"}</dd></div><div><dt>Business topic</dt><dd>{selected.businessTopic?.name || "Not provided"}</dd></div>{selected.description && <div className="document-hub-detail-wide"><dt>Description</dt><dd>{selected.description}</dd></div>}<div><dt>Document origin</dt><dd>{selected.documentOrigin || "Not provided"}</dd></div></dl></section>
                    <section className="document-hub-detail-section"><h4>Availability</h4><dl><div><dt>Destination</dt><dd>{selected.storageDestination}</dd></div>{selected.storageDestination === "Working" && <div><dt>Working area</dt><dd>{internalWorkUseLabel(selected.libraryKey as ArtifactLibraryKey)}</dd></div>}</dl></section>
                    <section className="document-hub-detail-section"><h4>Upload details</h4><dl><div><dt>Uploaded by</dt><dd>{selected.submittedByDisplayName || "Unknown user"}</dd></div><div><dt>Uploaded</dt><dd>{formatDate(selected.uploadedAt)}</dd></div>{selected.effectiveDate && <div><dt>Effective date</dt><dd>{formatDate(selected.effectiveDate)}</dd></div>}<div><dt>File type</dt><dd>{friendlyType(selected.extension)}</dd></div><div><dt>Size</dt><dd>{formatDocumentSize(selected.size)}</dd></div></dl></section>
                    {lifecycleMode === "menu" && <section className="document-hub-manage-panel" aria-label="Manage document options"><h4>Manage document</h4><p>Correct where this document is available or withdraw it from normal Document Hub use.</p><div><button type="button" onClick={beginMove}>Move document</button><button type="button" className="danger" onClick={() => { setLifecycleMode("remove"); setLifecycleError(null); }}>Remove from Document Hub</button></div></section>}
                    {lifecycleMode === "move" && <section className="document-hub-lifecycle-form" aria-label="Move document"><h4>Move document</h4><p className="document-hub-lifecycle-note">{MOVE_RETENTION_HELPER}</p><p>Current: <strong>{availabilityLabel(selected)}</strong></p><fieldset><legend>Move to</legend><label><input type="radio" name="move-destination" value="Working" checked={moveDestination === "Working"} onChange={() => { setMoveDestination("Working"); setMoveWorkArea(selected.storageDestination === "Working" ? selected.libraryKey : null); }} /> Working</label><label><input type="radio" name="move-destination" value="Knowledge" checked={moveDestination === "Knowledge"} onChange={() => { setMoveDestination("Knowledge"); setMoveWorkArea(null); }} /> Knowledge</label></fieldset>{moveDestination === "Working" && <label>Work area<select aria-label="Move Work area" value={moveWorkArea || ""} onChange={event => setMoveWorkArea(event.target.value as ArtifactLibraryKey)}><option value="">Choose a work area</option>{INTERNAL_WORK_USES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>}<p>New: <strong>{moveDestination === "Knowledge" ? "Knowledge" : moveWorkArea ? `Working · ${internalWorkUseLabel(moveWorkArea)}` : "Choose a Work area"}</strong></p>{isNoOpArtifactMove(selected, moveDestination, moveWorkArea) && <p className="document-hub-lifecycle-note">Choose a different destination or Work area.</p>}{lifecycleError && <p className="document-hub-download-error" role="alert">{lifecycleError}</p>}</section>}
                    {lifecycleMode === "remove" && <section className="document-hub-lifecycle-form danger" aria-label="Remove from Document Hub"><h4>Remove “{selected.documentTitle || selected.fileName}” from Document Hub?</h4><p>{REMOVE_FROM_HUB_CONFIRMATION}</p><label>Reason <span>(optional)</span><textarea rows={3} maxLength={500} value={removalReason} onChange={event => setRemovalReason(event.target.value)} /></label>{lifecycleError && <p className="document-hub-download-error" role="alert">{lifecycleError}</p>}</section>}
                </> : <div className="document-hub-edit-form"><label>Document title<input value={editValues.documentTitle || ""} maxLength={255} onChange={event => setEditValues({ ...editValues, documentTitle: event.target.value || null })} /></label><label>Document type<select value={editValues.documentTypeKey || ""} onChange={event => setEditValues({ ...editValues, documentTypeKey: event.target.value || null })}><option value="">Not provided</option>{metadataOptions.documentTypes.map(type => <option key={type.key} value={type.key}>{type.displayName}</option>)}</select></label><label>Business topic<select value={editValues.businessTopicSlug || ""} onChange={event => setEditValues({ ...editValues, businessTopicSlug: event.target.value || null })}><option value="">Not provided</option>{metadataOptions.businessTopics.map(topic => <option key={topic.slug} value={topic.slug}>{topic.name}</option>)}</select></label><label>Document origin<input value={editValues.documentOrigin || ""} maxLength={255} onChange={event => setEditValues({ ...editValues, documentOrigin: event.target.value || null })} /></label><label>Description<textarea rows={5} maxLength={2000} value={editValues.description || ""} onChange={event => setEditValues({ ...editValues, description: event.target.value || null })} /></label>{editError && <p className="document-hub-download-error" role="alert">{editError}</p>}</div>}
                {downloadError && <p className="document-hub-download-error" role="alert">{downloadError}</p>}
            </div>
            <footer className="document-hub-detail-footer">{editValues ? <><button type="button" className="document-hub-secondary" onClick={() => { setEditValues(null); setEditInitialValues(null); setEditError(null); }}>Cancel</button><button type="button" className="document-hub-primary" onClick={saveEdit} disabled={saving}>{saving ? "Saving…" : "Save details"}</button></> : lifecycleMode === "move" ? <><button type="button" className="document-hub-secondary" onClick={() => { setLifecycleMode("menu"); setLifecycleError(null); }}>Cancel</button><button type="button" className="document-hub-primary" onClick={submitMove} disabled={lifecycleBusy || !moveWorkArea && moveDestination === "Working" || isNoOpArtifactMove(selected, moveDestination, moveWorkArea)}>{lifecycleBusy ? "Moving…" : "Move document"}</button></> : lifecycleMode === "remove" ? <><button type="button" className="document-hub-secondary" onClick={() => { setLifecycleMode("menu"); setLifecycleError(null); }}>Cancel</button><button type="button" className="document-hub-danger" onClick={submitRemove} disabled={lifecycleBusy}>{lifecycleBusy ? "Removing from Document Hub…" : "Remove from Document Hub"}</button></> : <><button type="button" className="document-hub-edit-details" onClick={beginEdit}>Edit details</button>{canEditMetadata && <button type="button" className="document-hub-manage" onClick={() => setLifecycleMode(lifecycleMode === "menu" ? null : "menu")}>Manage document</button>}<button type="button" className="document-hub-primary" onClick={downloadSelected} disabled={downloadState === "loading"}>{downloadState === "loading" ? "Downloading…" : "Download"}</button></>}</footer>
            </aside>
        </div>}
    </section>;
}

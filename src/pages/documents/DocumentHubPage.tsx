import { useEffect, useRef, useState } from "react";
import { ArtifactUploadError, getArtifactMetadataOptions, uploadArtifact, type ArtifactLibraryKey, type ArtifactMetadataOptions } from "../../services/artifactPersistence";
import { addDocumentFiles, applyDestinationToAll, BUSINESS_DESTINATIONS, canUploadBatch, documentAvailabilityLabel, documentExtension, documentStatusLabel, formatDocumentSize, INTERNAL_WORK_USES, markDocumentFailed, markDocumentUploaded, markDocumentUploading, readyDocuments, removeStagedDocument, setDocumentBusinessDestination, setDocumentDestination, shouldShowBulkWorkAreaControl, storeButtonLabel, updateDocumentMetadata, uploadDocumentsSequentially, WORK_AREA_PLACEHOLDER, type StagedDocument } from "./documentHubState";
import "./DocumentHubPage.css";
import DocumentHubFind from "./DocumentHubFind";

type HubMode = "provide" | "find";

export function StoredDocumentConfirmation({ item, onView }: { item: StagedDocument; onView: () => void }) {
    return <div className="document-hub-completion" role="status">
        <strong><span aria-hidden="true">✓</span> Document stored successfully</strong>
        <span className="document-hub-completion-file">{item.file.name}</span>
        <span className="document-hub-completion-location">Available in: <b>{documentAvailabilityLabel(item)}</b></span>
        <p>Your document is now available in Document Hub.</p>
        <button type="button" onClick={onView}>View in Find Documents</button>
    </div>;
}

function newIdempotencyKey(): string {
    return globalThis.crypto.randomUUID();
}

export default function DocumentHubPage() {
    const [mode, setMode] = useState<HubMode>("provide");
    const [items, setItems] = useState<StagedDocument[]>([]);
    const [dragActive, setDragActive] = useState(false);
    const [batchRunning, setBatchRunning] = useState(false);
    const [bulkDestination, setBulkDestination] = useState<ArtifactLibraryKey | "">("");
    const [catalogVersion, setCatalogVersion] = useState(0);
    const [metadataOptions, setMetadataOptions] = useState<ArtifactMetadataOptions>({ documentTypes: [], businessTopics: [] });
    const [showFieldHelp, setShowFieldHelp] = useState(false);
    const fileInput = useRef<HTMLInputElement>(null);
    const uploadInFlight = useRef(false);

    useEffect(() => { getArtifactMetadataOptions().then(setMetadataOptions).catch(() => undefined); }, []);

    const metadataFor = (item: StagedDocument) => ({ documentTitle: item.documentTitle || null,
        documentTypeKey: item.documentTypeKey || null, businessTopicSlug: item.businessTopicSlug || null,
        documentOrigin: item.documentOrigin || null, description: item.description || null });

    function addFiles(files: FileList | File[]) {
        if (!files.length) return;
        const selectedFiles = Array.from(files);
        setItems(current => addDocumentFiles(current, selectedFiles, newIdempotencyKey));
        if (fileInput.current) fileInput.current.value = "";
    }

    function applyBulkDestination(destination: ArtifactLibraryKey | "") {
        setBulkDestination(destination);
        if (destination) setItems(current => applyDestinationToAll(current, destination, newIdempotencyKey));
    }

    async function uploadOne(item: StagedDocument) {
        if (uploadInFlight.current || (item.businessDestination === "Working" && !item.destination) || item.validationError || !["ready", "failed"].includes(item.phase)) return;
        uploadInFlight.current = true;
        setItems(current => markDocumentUploading(current, item.id));
        try {
            const artifact = await uploadArtifact(item.file, item.businessDestination as "Working" | "Knowledge", item.destination || null, item.idempotencyKey, fetch, metadataFor(item));
            setItems(current => markDocumentUploaded(current, item.id, artifact)); setCatalogVersion(value => value + 1);
        } catch (error) {
            const message = error instanceof ArtifactUploadError ? error.message : "Document Hub could not store this file. Please retry.";
            setItems(current => markDocumentFailed(current, item.id, message));
        } finally {
            uploadInFlight.current = false;
        }
    }

    async function submitBatch() {
        if (uploadInFlight.current || !canUploadBatch(items, batchRunning)) return;
        uploadInFlight.current = true;
        setBatchRunning(true);
        await uploadDocumentsSequentially(
            items,
            item => uploadArtifact(item.file, item.businessDestination as "Working" | "Knowledge", item.destination || null, item.idempotencyKey, fetch, metadataFor(item)),
            item => setItems(current => markDocumentUploading(current, item.id)),
            (item, artifact) => { setItems(current => markDocumentUploaded(current, item.id, artifact)); setCatalogVersion(value => value + 1); },
            (item, error) => {
                const message = error instanceof ArtifactUploadError ? error.message : "Document Hub could not store this file. Please retry.";
                setItems(current => markDocumentFailed(current, item.id, message));
            },
        );
        uploadInFlight.current = false;
        setBatchRunning(false);
    }

    const readyCount = readyDocuments(items).length;
    const pendingCount = items.filter(item => item.phase === "ready").length;
    const hasUploaded = items.some(item => item.phase === "uploaded");

    return (
        <main className="document-hub-page">
            <header className="document-hub-header">
                <div>
                    <h1>Document Hub</h1>
                    <p>Provide trusted documents now and find them through authoritative IntegraIQ metadata.</p>
                </div>
            </header>

            <nav className="document-hub-tabs" aria-label="Document Hub modes">
                <button type="button" className={mode === "provide" ? "active" : ""} aria-selected={mode === "provide"} onClick={() => setMode("provide")}><span aria-hidden="true">⇧</span>Provide Documents</button>
                <button type="button" className={mode === "find" ? "active" : ""} aria-selected={mode === "find"} onClick={() => setMode("find")}><span aria-hidden="true">⌕</span>Find Documents</button>
            </nav>

            {mode === "find" ? (
                <DocumentHubFind refreshKey={catalogVersion} />
            ) : (
                <section className="document-hub-provide" aria-labelledby="provide-title">
                    <div className="document-hub-section-heading">
                        <div><h2 id="provide-title">Provide Documents</h2><p>Add documents for internal work, choose where they belong, then store them.</p></div>
                    </div>

                    <ol className="document-hub-process" aria-label="Document storage process">
                        <li><strong>1</strong> Add documents</li><li><strong>2</strong> Prepare</li><li><strong>3</strong> Store</li>
                    </ol>

                    <div className={`document-hub-dropzone${dragActive ? " drag-active" : ""}`}
                        onDragEnter={event => { event.preventDefault(); setDragActive(true); }} onDragOver={event => event.preventDefault()}
                        onDragLeave={event => { event.preventDefault(); setDragActive(false); }}
                        onDrop={event => { event.preventDefault(); setDragActive(false); addFiles(event.dataTransfer.files); }}>
                        <input ref={fileInput} id="document-hub-file" type="file" hidden multiple
                            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.png,.jpg,.jpeg,.gif,.webp,.tif,.tiff"
                            onChange={event => event.target.files && addFiles(event.target.files)} />
                        <div className="document-hub-drop-prompt">
                            <div className="document-hub-upload-icon" aria-hidden="true">⇧</div>
                            <h3>Drop documents here</h3><p>or</p>
                            <button type="button" className="document-hub-browse" onClick={() => fileInput.current?.click()}>Browse files</button>
                            <small>PDF, Office, text, CSV, and common image formats · Up to 10 MiB each</small>
                        </div>
                    </div>

                    {items.length > 0 && <div className="document-hub-staging">
                        <div className="document-hub-staging-header">
                            <div><h3>Documents to upload</h3><p>{items.length} {items.length === 1 ? "document" : "documents"}</p></div>
                            {shouldShowBulkWorkAreaControl(items) && <label>Set work area for all Working documents
                                <select value={bulkDestination} disabled={batchRunning} onChange={event => applyBulkDestination(event.target.value as ArtifactLibraryKey | "")}>
                                    <option value="">{WORK_AREA_PLACEHOLDER}</option>
                                    {INTERNAL_WORK_USES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                                </select>
                            </label>}
                        </div>
                        <div className="document-hub-file-list">
                            {items.map(item => <article className={`document-hub-file-row ${item.phase}`} key={item.id}>
                                <div className="document-hub-file-icon" aria-hidden="true">{documentExtension(item.file.name)}</div>
                                {item.phase === "uploaded" ? <StoredDocumentConfirmation item={item} onView={() => setMode("find")} /> : <>
                                <div className="document-hub-file-name"><strong>{item.file.name}</strong><span>{formatDocumentSize(item.file.size)} · {item.file.type || "Unknown type"}</span></div>
                                <div className="document-hub-preparation">
                                    <fieldset className="document-hub-destinations" disabled={["uploading", "uploaded"].includes(item.phase)}>
                                        <legend>Choose where this document should be available</legend>
                                        {BUSINESS_DESTINATIONS.map(destination => <label key={destination.value}
                                            className={`destination-${destination.value.toLowerCase()} ${item.businessDestination === destination.value ? "selected" : ""}${destination.enabled ? "" : " disabled"}`.trim()}>
                                            <input type="radio" name={`destination-${item.id}`} value={destination.value}
                                                checked={item.businessDestination === destination.value} disabled={!destination.enabled}
                                                onChange={() => setItems(current => setDocumentBusinessDestination(current, item.id, destination.value, newIdempotencyKey))} />
                                            <span><strong>{destination.value}</strong><small>{destination.description}</small>{destination.note && <em>{destination.note}</em>}</span>
                                        </label>)}
                                    </fieldset>
                                    {item.businessDestination === "Working" && <label className="document-hub-work-area">Work area
                                        <select value={item.destination} disabled={["uploading", "uploaded"].includes(item.phase)} onChange={event => setItems(current => setDocumentDestination(current, item.id, event.target.value as ArtifactLibraryKey | "", newIdempotencyKey))}>
                                            <option value="">{WORK_AREA_PLACEHOLDER}</option>
                                            {INTERNAL_WORK_USES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                                        </select>
                                    </label>}
                                    {!!item.businessDestination && <section className="document-hub-metadata" aria-label="Optional document details">
                                        <div className="document-hub-metadata-heading"><div><strong>Help others find this document</strong><small>Optional details make this document easier to find and understand.</small></div><button type="button" onClick={() => setShowFieldHelp(true)}>Fields explained</button></div>
                                        <div className="document-hub-metadata-grid">
                                            <label>Document title<input value={item.documentTitle} maxLength={255} onChange={event => setItems(current => updateDocumentMetadata(current, item.id, { documentTitle: event.target.value }))} /></label>
                                            <label>Document type<select value={item.documentTypeKey} onChange={event => setItems(current => updateDocumentMetadata(current, item.id, { documentTypeKey: event.target.value }))}><option value="">Choose a type</option>{metadataOptions.documentTypes.map(type => <option key={type.key} value={type.key}>{type.displayName}</option>)}</select></label>
                                            <label>Business topic<input list={`topics-${item.id}`} value={item.businessTopicQuery} placeholder="Search topics" onChange={event => { const value = event.target.value; const match = metadataOptions.businessTopics.find(topic => topic.name === value); setItems(current => updateDocumentMetadata(current, item.id, { businessTopicQuery: value, businessTopicSlug: match?.slug || "" })); }} /><datalist id={`topics-${item.id}`}>{metadataOptions.businessTopics.map(topic => <option key={topic.slug} value={topic.name}>{topic.group}</option>)}</datalist></label>
                                            <label>Document origin<input value={item.documentOrigin} maxLength={255} placeholder="Created internally, DHS, consultant…" onChange={event => setItems(current => updateDocumentMetadata(current, item.id, { documentOrigin: event.target.value }))} /></label>
                                        </div>
                                        {!item.descriptionExpanded ? <button type="button" className="document-hub-add-description" onClick={() => setItems(current => updateDocumentMetadata(current, item.id, { descriptionExpanded: true }))}>+ Add description</button> : <label className="document-hub-description">Description<textarea value={item.description} maxLength={2000} rows={3} onChange={event => setItems(current => updateDocumentMetadata(current, item.id, { description: event.target.value }))} /></label>}
                                    </section>}
                                </div>
                                <div className={`document-hub-status ${item.phase}`} role={item.phase === "failed" || item.phase === "invalid" ? "alert" : "status"}>
                                    {item.phase === "ready" && <strong>{documentStatusLabel(item)}</strong>}
                                    {item.phase === "invalid" && <><strong>Invalid</strong><span>{item.validationError}</span></>}
                                    {item.phase === "uploading" && <strong><span className="document-hub-spinner" /> Uploading…</strong>}
                                    {item.phase === "failed" && <><strong>Failed</strong><span>{item.uploadError}</span><button type="button" onClick={() => uploadOne(item)} disabled={batchRunning}>Retry</button></>}
                                </div>
                                </>}
                                <button type="button" className="document-hub-remove" onClick={() => setItems(current => removeStagedDocument(current, item.id))} disabled={item.phase === "uploading"}>Remove</button>
                            </article>)}
                        </div>
                    </div>}

                    <div className="document-hub-submit-row">
                        <div className="document-hub-ready-summary">{readyCount > 0 ? <><strong>Ready to store</strong>{readyCount === 1 ? (() => { const ready = readyDocuments(items)[0]; const type = metadataOptions.documentTypes.find(option => option.key === ready.documentTypeKey)?.displayName; const topic = metadataOptions.businessTopics.find(option => option.slug === ready.businessTopicSlug)?.name; return <span><b>{ready.documentTitle || ready.file.name}</b><small>{ready.file.name}</small><small>{documentAvailabilityLabel(ready)}</small>{(type || topic) && <small>{[type, topic].filter(Boolean).join(" · ")}</small>}{ready.documentOrigin && <small>Origin: {ready.documentOrigin}</small>}</span>; })() : <span>{readyCount} documents are ready and will be stored in their selected destinations.</span>}</> : <span>{hasUploaded ? "Stored documents remain visible. Add more documents at any time." : pendingCount > 0 ? "Choose an available destination and any required work area for every valid document." : "Documents are stored only after you confirm."}</span>}</div>
                        <button type="button" className="document-hub-primary" onClick={submitBatch} disabled={!canUploadBatch(items, batchRunning)}>{storeButtonLabel(items, batchRunning)}</button>
                    </div>
                    {showFieldHelp && <div className="document-hub-help-backdrop" role="presentation" onMouseDown={() => setShowFieldHelp(false)}><section className="document-hub-help" role="dialog" aria-modal="true" aria-labelledby="metadata-help-title" onMouseDown={event => event.stopPropagation()}><button type="button" aria-label="Close fields explained" onClick={() => setShowFieldHelp(false)}>×</button><h2 id="metadata-help-title">Fields explained</h2><dl><div><dt>Document title</dt><dd>A clear business-friendly name. Example: Project Liberty Financial Review.</dd></div><div><dt>Document type</dt><dd>What kind of business document this is, such as a Policy, Contract, or Report / Analysis.</dd></div><div><dt>Business topic</dt><dd>The main business subject. It helps others find the document by business area.</dd></div><div><dt>Document origin</dt><dd>Where it originally came from, such as Created internally, DHS, a municipality, consultant, or vendor.</dd></div><div><dt>Description</dt><dd>A short explanation of what the document contains or why it matters.</dd></div></dl></section></div>}
                </section>
            )}
        </main>
    );
}

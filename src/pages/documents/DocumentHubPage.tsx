import { useRef, useState } from "react";
import { ArtifactUploadError, uploadArtifact, type ArtifactLibraryKey } from "../../services/artifactPersistence";
import { addDocumentFiles, applyDestinationToAll, canUploadBatch, documentExtension, formatDocumentSize, markDocumentFailed, markDocumentUploaded, markDocumentUploading, readyDocuments, removeStagedDocument, setDocumentDestination, uploadDocumentsSequentially, type StagedDocument } from "./documentHubState";
import "./DocumentHubPage.css";

type HubMode = "provide" | "find";
const DESTINATIONS: ArtifactLibraryKey[] = ["Projects", "Legal", "Operations"];

function newIdempotencyKey(): string {
    return globalThis.crypto.randomUUID();
}

export default function DocumentHubPage() {
    const [mode, setMode] = useState<HubMode>("provide");
    const [items, setItems] = useState<StagedDocument[]>([]);
    const [dragActive, setDragActive] = useState(false);
    const [batchRunning, setBatchRunning] = useState(false);
    const [bulkDestination, setBulkDestination] = useState<ArtifactLibraryKey | "">("");
    const fileInput = useRef<HTMLInputElement>(null);
    const uploadInFlight = useRef(false);

    function addFiles(files: FileList | File[]) {
        if (!files.length) return;
        setItems(current => addDocumentFiles(current, Array.from(files), newIdempotencyKey));
        if (fileInput.current) fileInput.current.value = "";
    }

    function applyBulkDestination(destination: ArtifactLibraryKey | "") {
        setBulkDestination(destination);
        if (destination) setItems(current => applyDestinationToAll(current, destination, newIdempotencyKey));
    }

    async function uploadOne(item: StagedDocument) {
        if (uploadInFlight.current || !item.destination || item.validationError || !["ready", "failed"].includes(item.phase)) return;
        uploadInFlight.current = true;
        setItems(current => markDocumentUploading(current, item.id));
        try {
            const artifact = await uploadArtifact(item.file, item.destination, item.idempotencyKey);
            setItems(current => markDocumentUploaded(current, item.id, artifact));
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
            item => uploadArtifact(item.file, item.destination as ArtifactLibraryKey, item.idempotencyKey),
            item => setItems(current => markDocumentUploading(current, item.id)),
            (item, artifact) => setItems(current => markDocumentUploaded(current, item.id, artifact)),
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
                    <p className="document-hub-eyebrow">IntegraIQ</p>
                    <h1>Document Hub</h1>
                    <p>Provide trusted documents now and find them through authoritative IntegraIQ metadata.</p>
                </div>
            </header>

            <nav className="document-hub-tabs" aria-label="Document Hub modes">
                <button type="button" className={mode === "provide" ? "active" : ""} aria-selected={mode === "provide"} onClick={() => setMode("provide")}><span aria-hidden="true">⇧</span>Provide Documents</button>
                <button type="button" className={mode === "find" ? "active" : ""} aria-selected={mode === "find"} onClick={() => setMode("find")}><span aria-hidden="true">⌕</span>Find Documents</button>
            </nav>

            {mode === "find" ? (
                <section className="document-hub-find" aria-labelledby="find-title">
                    <div className="document-hub-find-icon" aria-hidden="true">⌕</div>
                    <h2 id="find-title">Find Documents</h2>
                    <p>Search and retrieval will be available in the next release.</p>
                </section>
            ) : (
                <section className="document-hub-provide" aria-labelledby="provide-title">
                    <div className="document-hub-section-heading">
                        <div><h2 id="provide-title">Provide Documents</h2><p>Add documents, choose a Working destination for each, then upload.</p></div>
                        <span>10 MiB each</span>
                    </div>

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
                            <div><h3>Staged documents</h3><p>{items.length} {items.length === 1 ? "document" : "documents"}</p></div>
                            <label>Apply destination to all
                                <select value={bulkDestination} disabled={batchRunning} onChange={event => applyBulkDestination(event.target.value as ArtifactLibraryKey | "")}>
                                    <option value="">Choose destination</option>
                                    {DESTINATIONS.map(destination => <option key={destination} value={destination}>{destination} Working</option>)}
                                </select>
                            </label>
                        </div>
                        <div className="document-hub-file-list">
                            {items.map(item => <article className={`document-hub-file-row ${item.phase}`} key={item.id}>
                                <div className="document-hub-file-icon" aria-hidden="true">{documentExtension(item.file.name)}</div>
                                <div className="document-hub-file-name"><strong>{item.file.name}</strong><span>{formatDocumentSize(item.file.size)} · {item.file.type || "Unknown type"}</span></div>
                                <label>Store in
                                    <select value={item.destination} disabled={["uploading", "uploaded"].includes(item.phase)} onChange={event => setItems(current => setDocumentDestination(current, item.id, event.target.value as ArtifactLibraryKey | "", newIdempotencyKey))}>
                                        <option value="">Choose destination</option>
                                        {DESTINATIONS.map(destination => <option key={destination} value={destination}>{destination} Working</option>)}
                                    </select>
                                </label>
                                <div className={`document-hub-status ${item.phase}`} role={item.phase === "failed" || item.phase === "invalid" ? "alert" : "status"}>
                                    {item.phase === "ready" && <><strong>Ready</strong>{!item.destination && <span>Destination required</span>}</>}
                                    {item.phase === "invalid" && <><strong>Invalid</strong><span>{item.validationError}</span></>}
                                    {item.phase === "uploading" && <strong><span className="document-hub-spinner" /> Uploading…</strong>}
                                    {item.phase === "uploaded" && <><strong>✓ Uploaded</strong><span>Artifact ID: {item.artifact?.id}</span></>}
                                    {item.phase === "failed" && <><strong>Upload failed</strong><span>{item.uploadError}</span><button type="button" onClick={() => uploadOne(item)} disabled={batchRunning}>Retry</button></>}
                                </div>
                                <button type="button" className="document-hub-remove" onClick={() => setItems(current => removeStagedDocument(current, item.id))} disabled={item.phase === "uploading"}>Remove</button>
                            </article>)}
                        </div>
                    </div>}

                    <div className="document-hub-submit-row">
                        <span>{hasUploaded ? "Completed uploads remain visible. Add more documents at any time." : pendingCount > 0 && readyCount < pendingCount ? "Choose a destination for every ready document." : "Documents upload only after you confirm."}</span>
                        <button type="button" className="document-hub-primary" onClick={submitBatch} disabled={!canUploadBatch(items, batchRunning)}>{batchRunning ? "Uploading…" : `Upload ${readyCount === 1 ? "document" : `${readyCount} documents`}`}</button>
                    </div>
                </section>
            )}
        </main>
    );
}

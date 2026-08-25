import { useRef, useState } from "react";
import { ArtifactUploadError, uploadArtifact, type ArtifactLibraryKey } from "../../services/artifactPersistence";
import { beginDocumentUpload, canSubmitDocument, completeDocumentUpload, EMPTY_UPLOAD_STATE, failDocumentUpload, formatDocumentSize, removeDocumentFile, selectDocumentFile, type DocumentHubUploadState } from "./documentHubState";
import "./DocumentHubPage.css";

type HubMode = "provide" | "find";
const DESTINATIONS: ArtifactLibraryKey[] = ["Projects", "Legal", "Operations"];

function newIdempotencyKey(): string {
    return globalThis.crypto.randomUUID();
}

export default function DocumentHubPage() {
    const [mode, setMode] = useState<HubMode>("provide");
    const [state, setState] = useState<DocumentHubUploadState>(EMPTY_UPLOAD_STATE);
    const [dragActive, setDragActive] = useState(false);
    const fileInput = useRef<HTMLInputElement>(null);
    const uploadInFlight = useRef(false);

    function chooseFile(file: File | undefined) {
        if (!file || uploadInFlight.current) return;
        setState(current => selectDocumentFile(current, file, newIdempotencyKey));
        if (fileInput.current) fileInput.current.value = "";
    }

    function chooseDestination(destination: ArtifactLibraryKey | "") {
        setState(current => ({
            ...current,
            destination,
            idempotencyKey: current.file ? newIdempotencyKey() : current.idempotencyKey,
            phase: current.file ? "ready" : current.phase,
            uploadError: null,
            artifact: null,
        }));
    }

    async function submitUpload() {
        if (uploadInFlight.current || !canSubmitDocument(state) || !state.file || !state.destination || !state.idempotencyKey) return;
        uploadInFlight.current = true;
        setState(beginDocumentUpload);
        try {
            const artifact = await uploadArtifact(state.file, state.destination, state.idempotencyKey);
            setState(current => completeDocumentUpload(current, artifact));
        } catch (error) {
            const message = error instanceof ArtifactUploadError ? error.message : "Document Hub could not store this file. Please retry.";
            setState(current => failDocumentUpload(current, message));
        } finally {
            uploadInFlight.current = false;
        }
    }

    function resetUpload() {
        uploadInFlight.current = false;
        setState(EMPTY_UPLOAD_STATE);
        setDragActive(false);
        if (fileInput.current) fileInput.current.value = "";
    }

    return (
        <main className="document-hub-page">
            <header className="document-hub-header">
                <div>
                    <p className="document-hub-eyebrow">IntegraIQ</p>
                    <h1>Document Hub</h1>
                    <p>Provide trusted documents now and find them through authoritative IntegraIQ metadata.</p>
                </div>
                <div className="document-hub-storage-note"><span aria-hidden="true">●</span> Secure Working storage</div>
            </header>

            <nav className="document-hub-tabs" aria-label="Document Hub modes">
                <button type="button" className={mode === "provide" ? "active" : ""} aria-selected={mode === "provide"} onClick={() => setMode("provide")}>Provide</button>
                <button type="button" className={mode === "find" ? "active" : ""} aria-selected={mode === "find"} onClick={() => setMode("find")}>Find</button>
            </nav>

            {mode === "find" ? (
                <section className="document-hub-find" aria-labelledby="find-title">
                    <div className="document-hub-find-icon" aria-hidden="true">⌕</div>
                    <h2 id="find-title">Find trusted documents</h2>
                    <p>Authoritative search and retrieval are coming in the next Document Hub release.</p>
                </section>
            ) : (
                <section className="document-hub-provide" aria-labelledby="provide-title">
                    <div className="document-hub-section-heading">
                        <div><h2 id="provide-title">Provide a document</h2><p>Choose one document and its Working destination before uploading.</p></div>
                        <span>10 MiB maximum</span>
                    </div>

                    {state.phase === "success" && state.artifact ? (
                        <div className="document-hub-result document-hub-success" role="status">
                            <div className="document-hub-result-icon" aria-hidden="true">✓</div>
                            <div>
                                <p className="document-hub-result-label">Upload complete</p>
                                <h3>{state.artifact.fileName}</h3>
                                <p>Your document is safely stored in <strong>{state.artifact.libraryKey} Working</strong>.</p>
                                <dl>
                                    <div><dt>Status</dt><dd>{state.artifact.ingestionState}</dd></div>
                                    <div><dt>Artifact ID</dt><dd>{state.artifact.id}</dd></div>
                                </dl>
                                <button type="button" className="document-hub-primary" onClick={resetUpload}>Upload another document</button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div
                                className={`document-hub-dropzone${dragActive ? " drag-active" : ""}${state.file ? " has-file" : ""}`}
                                onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }}
                                onDragOver={(event) => event.preventDefault()}
                                onDragLeave={(event) => { event.preventDefault(); setDragActive(false); }}
                                onDrop={(event) => { event.preventDefault(); setDragActive(false); chooseFile(event.dataTransfer.files[0]); }}
                            >
                                <input ref={fileInput} id="document-hub-file" type="file" hidden
                                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.png,.jpg,.jpeg,.gif,.webp,.tif,.tiff"
                                    onChange={(event) => chooseFile(event.target.files?.[0])} />
                                {!state.file ? (
                                    <div className="document-hub-drop-prompt">
                                        <div className="document-hub-upload-icon" aria-hidden="true">⇧</div>
                                        <h3>Drop a document here</h3>
                                        <p>or</p>
                                        <button type="button" className="document-hub-browse" onClick={() => fileInput.current?.click()}>Browse files</button>
                                        <small>PDF, Office, text, CSV, and common image formats · Up to 10 MiB</small>
                                    </div>
                                ) : (
                                    <div className="document-hub-file-summary">
                                        <div className="document-hub-file-icon" aria-hidden="true">DOC</div>
                                        <div><strong>{state.file.name}</strong><span>{formatDocumentSize(state.file.size)} · {state.file.type}</span></div>
                                        <div className="document-hub-file-actions">
                                            <button type="button" onClick={() => fileInput.current?.click()} disabled={state.phase === "uploading"}>Replace</button>
                                            <button type="button" onClick={() => setState(current => removeDocumentFile(current))} disabled={state.phase === "uploading"}>Remove</button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {state.validationError && <div className="document-hub-message error" role="alert">{state.validationError}</div>}

                            <div className="document-hub-controls">
                                <label htmlFor="document-hub-destination">Working destination</label>
                                <select id="document-hub-destination" value={state.destination} disabled={state.phase === "uploading"}
                                    onChange={(event) => chooseDestination(event.target.value as ArtifactLibraryKey | "")}>
                                    <option value="">Choose a destination</option>
                                    {DESTINATIONS.map(destination => <option key={destination} value={destination}>{destination} Working</option>)}
                                </select>
                                <p>Document Hub chooses the secure SharePoint location. Infrastructure identifiers are never exposed.</p>
                            </div>

                            {state.phase === "uploading" && (
                                <div className="document-hub-message uploading" role="status"><span className="document-hub-spinner" /> <div><strong>Uploading securely…</strong><p>Keep this page open while Document Hub stores your file.</p></div></div>
                            )}
                            {state.phase === "failure" && (
                                <div className="document-hub-message error persistent" role="alert"><div><strong>Upload not completed</strong><p>{state.uploadError}</p></div><button type="button" onClick={submitUpload}>Retry upload</button></div>
                            )}

                            <div className="document-hub-submit-row">
                                <span>{state.file && !state.destination ? "Choose a destination to enable upload." : "Your document will not upload until you confirm."}</span>
                                <button type="button" className="document-hub-primary" onClick={submitUpload}
                                    disabled={!canSubmitDocument(state)}>{state.phase === "uploading" ? "Uploading…" : "Upload document"}</button>
                            </div>
                        </>
                    )}
                </section>
            )}
        </main>
    );
}

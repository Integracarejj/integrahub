import type { ArtifactLibraryKey, ArtifactRecord } from "../../services/artifactPersistence";

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const WORK_AREA_PLACEHOLDER = "Choose a work area";
export type DocumentDestination = "Working" | "Knowledge" | "External";
export const BUSINESS_DESTINATIONS: ReadonlyArray<{
    value: DocumentDestination; description: string; enabled: boolean; note?: string;
}> = [
    { value: "Working", description: "Active internal work and collaboration.", enabled: true },
    { value: "Knowledge", description: "Trusted internal reference.", enabled: true },
    { value: "External", description: "Controlled sharing with an approved transaction/project.", enabled: false, note: "Coming next" },
];

export function shouldShowBulkWorkAreaControl(items: readonly StagedDocument[]): boolean {
    return items.length >= 2 && items.every(item => item.businessDestination === "Working");
}

export const INTERNAL_WORK_USES: ReadonlyArray<{ value: ArtifactLibraryKey; label: string }> = [
    { value: "Projects", label: "Project work" },
    { value: "Legal", label: "Legal work" },
    { value: "Operations", label: "Operational work" },
];

export function internalWorkUseLabel(libraryKey: ArtifactLibraryKey): string {
    return INTERNAL_WORK_USES.find(option => option.value === libraryKey)?.label || "Internal Work";
}

const MIME_BY_EXTENSION: Readonly<Record<string, readonly string[]>> = Object.freeze({
    pdf: ["application/pdf"], doc: ["application/msword"],
    docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    xls: ["application/vnd.ms-excel"], xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    ppt: ["application/vnd.ms-powerpoint"], pptx: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
    txt: ["text/plain"], csv: ["text/csv", "application/csv"], png: ["image/png"],
    jpg: ["image/jpeg"], jpeg: ["image/jpeg"], gif: ["image/gif"], webp: ["image/webp"],
    tif: ["image/tiff"], tiff: ["image/tiff"],
});

export type UploadPhase = "empty" | "ready" | "uploading" | "success" | "failure";

export interface DocumentHubUploadState {
    file: File | null;
    destination: ArtifactLibraryKey | "";
    idempotencyKey: string | null;
    phase: UploadPhase;
    validationError: string | null;
    uploadError: string | null;
    artifact: ArtifactRecord | null;
}

export const EMPTY_UPLOAD_STATE: DocumentHubUploadState = {
    file: null, destination: "", idempotencyKey: null, phase: "empty",
    validationError: null, uploadError: null, artifact: null,
};

export function validateDocumentFile(file: File): string | null {
    if (file.size < 1) return "Choose a non-empty document.";
    if (file.size > MAX_DOCUMENT_BYTES) return "This file exceeds the 10 MiB maximum.";
    const dot = file.name.lastIndexOf(".");
    const extension = dot > 0 ? file.name.slice(dot + 1).toLowerCase() : "";
    if (!MIME_BY_EXTENSION[extension]?.includes(file.type.toLowerCase())) {
        return "This file type is not supported by Document Hub.";
    }
    return null;
}

export function selectDocumentFile(
    state: DocumentHubUploadState,
    file: File,
    generateIdempotencyKey: () => string,
): DocumentHubUploadState {
    const validationError = validateDocumentFile(file);
    if (validationError) return { ...state, file: null, idempotencyKey: null, phase: "empty", validationError, uploadError: null, artifact: null };
    return { ...state, file, idempotencyKey: generateIdempotencyKey(), phase: "ready", validationError: null, uploadError: null, artifact: null };
}

export function removeDocumentFile(state: DocumentHubUploadState): DocumentHubUploadState {
    return { ...state, file: null, idempotencyKey: null, phase: "empty", validationError: null, uploadError: null, artifact: null };
}

export function canSubmitDocument(state: DocumentHubUploadState): boolean {
    return state.phase !== "uploading" && !!state.file && !!state.destination && !!state.idempotencyKey && !state.validationError;
}

export function beginDocumentUpload(state: DocumentHubUploadState): DocumentHubUploadState {
    return canSubmitDocument(state) ? { ...state, phase: "uploading", uploadError: null } : state;
}

export function failDocumentUpload(state: DocumentHubUploadState, message: string): DocumentHubUploadState {
    return { ...state, phase: "failure", uploadError: message, artifact: null };
}

export function completeDocumentUpload(state: DocumentHubUploadState, artifact: ArtifactRecord): DocumentHubUploadState {
    return { ...state, phase: "success", uploadError: null, artifact };
}

export function formatDocumentSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface StagedDocument {
    id: string;
    file: File;
    destination: ArtifactLibraryKey | "";
    businessDestination: DocumentDestination | "";
    idempotencyKey: string;
    phase: "ready" | "invalid" | "uploading" | "uploaded" | "failed";
    validationError: string | null;
    uploadError: string | null;
    artifact: ArtifactRecord | null;
}

type KeyGenerator = () => string;

function localFileKey(file: File): string {
    return `${file.name}\u0000${file.size}\u0000${file.lastModified}\u0000${file.type}`;
}

export function addDocumentFiles(items: readonly StagedDocument[], files: Iterable<File>, generateKey: KeyGenerator): StagedDocument[] {
    const seen = new Set(items.map(item => localFileKey(item.file)));
    const added: StagedDocument[] = [];
    for (const file of files) {
        const fingerprint = localFileKey(file);
        if (seen.has(fingerprint)) continue;
        seen.add(fingerprint);
        const validationError = validateDocumentFile(file);
        added.push({
            id: generateKey(), file, destination: "", businessDestination: "", idempotencyKey: generateKey(),
            phase: validationError ? "invalid" : "ready", validationError,
            uploadError: null, artifact: null,
        });
    }
    return [...items, ...added];
}

export function setDocumentBusinessDestination(items: readonly StagedDocument[], id: string, businessDestination: DocumentDestination | "", generateKey: KeyGenerator): StagedDocument[] {
    return items.map(item => {
        if (item.id !== id || item.phase === "uploading" || item.phase === "uploaded") return item;
        const changed = item.businessDestination !== businessDestination;
        return {
            ...item, businessDestination,
            destination: businessDestination === "Working" ? item.destination : "",
            idempotencyKey: changed ? generateKey() : item.idempotencyKey,
            uploadError: null, phase: item.validationError ? "invalid" : "ready",
        };
    });
}

export function removeStagedDocument(items: readonly StagedDocument[], id: string): StagedDocument[] {
    return items.filter(item => item.id !== id);
}

export function setDocumentDestination(items: readonly StagedDocument[], id: string, destination: ArtifactLibraryKey | "", generateKey: KeyGenerator): StagedDocument[] {
    return items.map(item => {
        if (item.id !== id || item.phase === "uploading" || item.phase === "uploaded") return item;
        return {
            ...item, destination,
            idempotencyKey: item.destination === destination ? item.idempotencyKey : generateKey(),
            uploadError: null, phase: item.validationError ? "invalid" : "ready",
        };
    });
}

export function applyDestinationToAll(items: readonly StagedDocument[], destination: ArtifactLibraryKey, generateKey: KeyGenerator): StagedDocument[] {
    return items.map(item => {
        if (item.phase === "uploading" || item.phase === "uploaded" || item.destination === destination) return item;
        return {
            ...item, destination, idempotencyKey: generateKey(), uploadError: null,
            phase: item.validationError ? "invalid" : "ready",
        };
    });
}

export function readyDocuments(items: readonly StagedDocument[]): StagedDocument[] {
    return items.filter(item => item.phase === "ready" && !item.validationError
        && (item.businessDestination === "Knowledge" || (item.businessDestination === "Working" && !!item.destination)));
}

export async function uploadDocumentsSequentially(
    items: readonly StagedDocument[],
    upload: (item: StagedDocument) => Promise<ArtifactRecord>,
    onStart: (item: StagedDocument) => void,
    onSuccess: (item: StagedDocument, artifact: ArtifactRecord) => void,
    onFailure: (item: StagedDocument, error: unknown) => void,
): Promise<void> {
    for (const item of readyDocuments(items)) {
        onStart(item);
        try {
            onSuccess(item, await upload(item));
        } catch (error) {
            onFailure(item, error);
        }
    }
}

export function canUploadBatch(items: readonly StagedDocument[], batchRunning: boolean): boolean {
    if (batchRunning) return false;
    const pending = items.filter(item => item.phase === "ready");
    return pending.length > 0 && pending.every(item => !item.validationError
        && (item.businessDestination === "Knowledge" || (item.businessDestination === "Working" && !!item.destination)));
}

export function markDocumentUploading(items: readonly StagedDocument[], id: string): StagedDocument[] {
    return items.map(item => item.id === id ? { ...item, phase: "uploading", uploadError: null } : item);
}

export function markDocumentFailed(items: readonly StagedDocument[], id: string, message: string): StagedDocument[] {
    return items.map(item => item.id === id ? { ...item, phase: "failed", uploadError: message, artifact: null } : item);
}

export function markDocumentUploaded(items: readonly StagedDocument[], id: string, artifact: ArtifactRecord): StagedDocument[] {
    return items.map(item => item.id === id ? { ...item, phase: "uploaded", uploadError: null, artifact } : item);
}

export function documentExtension(fileName: string): string {
    const dot = fileName.lastIndexOf(".");
    return dot > 0 ? fileName.slice(dot + 1).toUpperCase() : "FILE";
}

export function documentStatusLabel(item: StagedDocument): string {
    if (item.phase === "ready") {
        if (!item.businessDestination) return "Choose a destination.";
        return item.businessDestination === "Knowledge" || item.destination ? "Ready" : "Choose a work area.";
    }
    if (item.phase === "invalid") return "Invalid";
    if (item.phase === "uploading") return "Uploading";
    if (item.phase === "uploaded") return "Uploaded";
    return "Failed";
}

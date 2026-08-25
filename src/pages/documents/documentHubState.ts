import type { ArtifactLibraryKey, ArtifactRecord } from "../../services/artifactPersistence";

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

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

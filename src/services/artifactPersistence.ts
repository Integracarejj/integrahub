export type ArtifactLibraryKey = "Projects" | "Legal" | "Operations";

export interface ArtifactRecord {
    id: string;
    fileName: string;
    extension: string;
    contentType: string;
    size: number;
    ingestionState: "Pending" | "Uploaded" | "Failed";
    classificationState: "Unclassified" | "Suggested" | "Confirmed";
    lifecycleState: "Active" | "Archived" | "Removed" | "Superseded";
    storageDestination: "Working";
    libraryKey: ArtifactLibraryKey;
    sourceOrigin: string;
    sourceModule: string;
    sourceContext: string | null;
    description: string | null;
    effectiveDate: string | null;
    submittedByUserId: string;
    uploadedAt: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface ArtifactListQuery {
    q?: string;
    libraryKey?: ArtifactLibraryKey | "";
    fileType?: "" | "pdf" | "word" | "excel" | "powerpoint" | "text" | "images";
    dateRange?: "all" | "today" | "7days" | "30days";
    sort?: "newest" | "name" | "area";
    page?: number;
    pageSize?: number;
}

export interface ArtifactListResult {
    artifacts: ArtifactRecord[];
    total: number;
    page: number;
    pageSize: number;
}

export class ArtifactUploadError extends Error {
    status: number | null;

    constructor(message: string, status: number | null = null) {
        super(message);
        this.name = "ArtifactUploadError";
        this.status = status;
    }
}

function isArtifactRecord(value: unknown): value is ArtifactRecord {
    if (!value || typeof value !== "object") return false;
    const row = value as Partial<ArtifactRecord>;
    return typeof row.id === "string" && typeof row.fileName === "string"
        && typeof row.size === "number" && typeof row.libraryKey === "string"
        && typeof row.ingestionState === "string" && typeof row.classificationState === "string"
        && typeof row.lifecycleState === "string" && row.storageDestination === "Working";
}

async function jsonResponse(response: Response): Promise<unknown> {
    try { return await response.json(); } catch { return null; }
}

function responseError(payload: unknown, fallback: string): string {
    return payload && typeof payload === "object" && typeof (payload as { error?: unknown }).error === "string"
        ? (payload as { error: string }).error : fallback;
}

export async function listArtifacts(query: ArtifactListQuery = {}, fetchImpl: typeof fetch = fetch): Promise<ArtifactListResult> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) if (value !== "" && value != null) params.set(key, String(value));
    let response: Response;
    try { response = await fetchImpl(`/api/artifacts${params.size ? `?${params}` : ""}`, { credentials: "include" }); }
    catch { throw new ArtifactUploadError("Document Hub could not load documents. Check your connection and retry."); }
    const payload = await jsonResponse(response);
    if (!response.ok) throw new ArtifactUploadError(responseError(payload, "Document Hub could not load documents. Please retry."), response.status);
    const value = payload as Partial<ArtifactListResult> | null;
    if (!value || !Array.isArray(value.artifacts) || !value.artifacts.every(isArtifactRecord)
        || !Number.isInteger(value.total) || !Number.isInteger(value.page) || !Number.isInteger(value.pageSize)) {
        throw new ArtifactUploadError("Document Hub returned an invalid document list.", response.status);
    }
    return value as ArtifactListResult;
}

export async function getArtifact(id: string, fetchImpl: typeof fetch = fetch): Promise<ArtifactRecord> {
    const response = await fetchImpl(`/api/artifacts/${encodeURIComponent(id)}`, { credentials: "include" });
    const payload = await jsonResponse(response);
    if (!response.ok) throw new ArtifactUploadError(responseError(payload, "Document Hub could not load this document."), response.status);
    const artifact = payload && typeof payload === "object" ? (payload as { artifact?: unknown }).artifact : null;
    if (!isArtifactRecord(artifact)) throw new ArtifactUploadError("Document Hub returned invalid document details.", response.status);
    return artifact;
}

export type SaveArtifactDownload = (blob: Blob, fileName: string) => void;

function saveArtifactDownload(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = fileName; anchor.click();
    URL.revokeObjectURL(url);
}

export async function downloadArtifact(id: string, fileName: string, fetchImpl: typeof fetch = fetch, save: SaveArtifactDownload = saveArtifactDownload): Promise<void> {
    let response: Response;
    try { response = await fetchImpl(`/api/artifacts/${encodeURIComponent(id)}/content`, { credentials: "include" }); }
    catch { throw new ArtifactUploadError("The download could not reach Document Hub. Check your connection and retry."); }
    if (!response.ok) throw new ArtifactUploadError(responseError(await jsonResponse(response), "Document Hub could not download this file."), response.status);
    save(await response.blob(), fileName);
}

export async function uploadArtifact(
    file: File,
    libraryKey: ArtifactLibraryKey,
    idempotencyKey: string,
    fetchImpl: typeof fetch = fetch,
): Promise<ArtifactRecord> {
    let response: Response;
    try {
        response = await fetchImpl("/api/artifacts", {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/octet-stream",
                "X-File-Name": encodeURIComponent(file.name),
                "X-File-Content-Type": file.type,
                "X-Artifact-Destination": libraryKey,
                "Idempotency-Key": idempotencyKey,
            },
            body: file,
        });
    } catch {
        throw new ArtifactUploadError("The upload could not reach Document Hub. Check your connection and retry.");
    }

    const payload = await jsonResponse(response);

    if (!response.ok) {
        const message = responseError(payload, "Document Hub could not store this file. Please retry.");
        throw new ArtifactUploadError(message, response.status);
    }

    const artifact = payload && typeof payload === "object" ? (payload as { artifact?: unknown }).artifact : null;
    if (!isArtifactRecord(artifact)) throw new ArtifactUploadError("Document Hub returned an invalid upload response.", response.status);
    return artifact;
}

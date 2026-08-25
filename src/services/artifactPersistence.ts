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

    let payload: unknown = null;
    try { payload = await response.json(); } catch { /* A safe generic error is used below. */ }

    if (!response.ok) {
        const message = payload && typeof payload === "object" && typeof (payload as { error?: unknown }).error === "string"
            ? (payload as { error: string }).error
            : "Document Hub could not store this file. Please retry.";
        throw new ArtifactUploadError(message, response.status);
    }

    const artifact = payload && typeof payload === "object" ? (payload as { artifact?: unknown }).artifact : null;
    if (!isArtifactRecord(artifact)) throw new ArtifactUploadError("Document Hub returned an invalid upload response.", response.status);
    return artifact;
}

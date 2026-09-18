import { getAuthHeaders } from "../utils/apiFetch";
import { portalFetch } from "./portalSessionRecovery";
import { requestAuthoritativeRevalidation } from "../hooks/useAuthoritativeRevalidation";

export interface AuthoritativePublicationArtifact { id: string; fileName: string; contentType: string }
export interface AuthoritativePublication {
    id: string; workItemId: string; publicationNumber: number; status: "Published" | "Approved" | "Rework Requested";
    externalOrganizationId: string; publishedAt: string; partnerActionAt: string | null;
    partnerGuidance: string | null; version: string; requestId: string; title: string; description: string;
    transactionId: string; transactionName: string; workItemStatus: string;
    artifacts: AuthoritativePublicationArtifact[];
    responseContent?: string | null;
    responseSnapshotAvailable?: boolean;
    sourceIntakeRequestKey?: string | null;
}

async function request(path: string, init?: RequestInit) {
    const response = await portalFetch(`/api/portal/recapitalization/publications${path}`, {
        credentials: "include", ...init,
        headers: { "Content-Type": "application/json", ...getAuthHeaders(), ...(init?.headers || {}) },
    });
    if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || "Publication operation failed");
    return response.json();
}

export async function loadAuthoritativePublications() {
    return (await request("", { cache: "no-store" })).publications as AuthoritativePublication[];
}

export async function loadAuthoritativePublication(publicationId: string) {
    return (await request(`/${encodeURIComponent(publicationId)}`, { cache: "no-store" })).publication as AuthoritativePublication;
}

export async function decideAuthoritativePublication(publication: AuthoritativePublication, action: "approve" | "rework", guidance?: string) {
    const decided = (await request(`/${publication.id}/decision`, { method: "POST", body: JSON.stringify({ action, guidance, expectedVersion: publication.version }) })).publication as AuthoritativePublication;
    requestAuthoritativeRevalidation();
    return decided;
}

export async function downloadAuthoritativePublishedArtifact(publicationId: string, artifact: AuthoritativePublicationArtifact) {
    return downloadPublishedArtifactFrom(`/api/portal/recapitalization/publications/${publicationId}/artifacts/${artifact.id}/content`, artifact);
}

export async function downloadPublishedArtifactFrom(path: string, artifact: AuthoritativePublicationArtifact) {
    const response = await portalFetch(path, { headers: getAuthHeaders() });
    if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || "Download failed");
    const url = URL.createObjectURL(await response.blob());
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = artifact.fileName; anchor.click(); URL.revokeObjectURL(url);
}

export async function previewPublishedArtifactFrom(path: string, artifact: AuthoritativePublicationArtifact) {
    const response = await portalFetch(path, { headers: getAuthHeaders() });
    if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || "Preview failed");
    const contentType = response.headers.get("content-type") || artifact.contentType;
    if (!/^application\/pdf$|^image\//i.test(contentType)) throw new Error("Preview is not available for this document type");
    return { url: URL.createObjectURL(await response.blob()), contentType };
}

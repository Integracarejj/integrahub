import { getAuthHeaders } from "../utils/apiFetch";

export interface AuthoritativePublicationArtifact { id: string; fileName: string; contentType: string }
export interface AuthoritativePublication {
    id: string; workItemId: string; publicationNumber: number; status: "Published" | "Approved" | "Rework Requested";
    externalOrganizationId: string; publishedAt: string; partnerActionAt: string | null;
    partnerGuidance: string | null; version: string; requestId: string; title: string; description: string;
    transactionId: string; transactionName: string; workItemStatus: string;
    artifacts: AuthoritativePublicationArtifact[];
}

async function request(path: string, init?: RequestInit) {
    const response = await fetch(`/api/portal/recapitalization/publications${path}`, {
        credentials: "include", ...init,
        headers: { "Content-Type": "application/json", ...getAuthHeaders(), ...(init?.headers || {}) },
    });
    if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || "Publication operation failed");
    return response.json();
}

export async function loadAuthoritativePublications() {
    return (await request("")).publications as AuthoritativePublication[];
}

export async function decideAuthoritativePublication(publication: AuthoritativePublication, action: "approve" | "rework", guidance?: string) {
    return (await request(`/${publication.id}/decision`, { method: "POST", body: JSON.stringify({ action, guidance, expectedVersion: publication.version }) })).publication as AuthoritativePublication;
}

export async function downloadAuthoritativePublishedArtifact(publicationId: string, artifact: AuthoritativePublicationArtifact) {
    const response = await fetch(`/api/portal/recapitalization/publications/${publicationId}/artifacts/${artifact.id}/content`, { credentials: "include", headers: getAuthHeaders() });
    if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || "Download failed");
    const url = URL.createObjectURL(await response.blob());
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = artifact.fileName; anchor.click(); URL.revokeObjectURL(url);
}

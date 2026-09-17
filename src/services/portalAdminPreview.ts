import { getAuthHeaders } from "../utils/apiFetch";
import { downloadPublishedArtifactFrom, previewPublishedArtifactFrom, type AuthoritativePublication } from "./portalPublicationPersistence";
import { portalFetch } from "./portalSessionRecovery";

const base = "/api/admin/recap-external-preview";
async function read(path: string) {
    const response = await portalFetch(base + path, { headers: getAuthHeaders(), cache: "no-store" });
    if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || "Admin preview could not be loaded");
    return response.json();
}
export async function loadPreviewOrganizations(): Promise<Array<{ id: string }>> {
    return (await read("/organizations")).organizations;
}
export async function loadPreviewPublications(org: string): Promise<AuthoritativePublication[]> {
    return (await read(`/${encodeURIComponent(org)}/publications`)).publications;
}
export function previewTransport(org: string) {
    const path = `/${encodeURIComponent(org)}/publications`;
    return {
        load: async (id: string): Promise<AuthoritativePublication> => (await read(`${path}/${encodeURIComponent(id)}`)).publication,
        preview: (id: string, artifact: { id: string; fileName: string; contentType: string }) => previewPublishedArtifactFrom(`${base}${path}/${encodeURIComponent(id)}/artifacts/${encodeURIComponent(artifact.id)}/content`, artifact),
        download: (id: string, artifact: { id: string; fileName: string; contentType: string }) =>
            downloadPublishedArtifactFrom(`${base}${path}/${encodeURIComponent(id)}/artifacts/${encodeURIComponent(artifact.id)}/content`, artifact),
    };
}

import { getAuthHeaders } from "../utils/apiFetch";

export interface AuthoritativeArtifact {
    id: string; fileName: string; contentType: string; size: number;
    status: string; uploadedBy: string | null; uploadedAt: string | null;
}
export interface AuthoritativeSourceDocument {
    id: string; fileName: string; contentType: string; size: number; uploadedAt: string | null;
}

async function jsonResponse(response: Response) {
    if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || "Artifact operation failed");
    return response.json();
}

export async function loadAuthoritativeArtifacts(workItemId: string): Promise<AuthoritativeArtifact[]> {
    const response = await fetch(`/api/recapitalization/work-items/${workItemId}/artifacts`, { credentials: "include", headers: getAuthHeaders() });
    return (await jsonResponse(response)).artifacts || [];
}
export async function loadAuthoritativeSourceDocuments(workItemId: string): Promise<AuthoritativeSourceDocument[]> {
    const response = await fetch(`/api/recapitalization/work-items/${workItemId}/source-documents`, { credentials: "include", headers: getAuthHeaders() });
    return (await jsonResponse(response)).documents || [];
}
export async function uploadAuthoritativeArtifact(workItemId: string, file: File): Promise<AuthoritativeArtifact> {
    const response = await fetch(`/api/recapitalization/work-items/${workItemId}/artifacts`, {
        method: "POST", credentials: "include", body: file,
        headers: { ...getAuthHeaders(), "Content-Type": "application/octet-stream", "x-file-name": encodeURIComponent(file.name), "x-file-content-type": file.type || "application/octet-stream" },
    });
    return (await jsonResponse(response)).artifact;
}
async function download(path: string, fileName: string) {
    const response = await fetch(path, { credentials: "include", headers: getAuthHeaders() });
    if (!response.ok) throw new Error("Download failed");
    const url = URL.createObjectURL(await response.blob());
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function downloadAuthoritativeArtifact(workItemId: string, artifactId: string, fileName: string) {
    return download(`/api/recapitalization/work-items/${workItemId}/artifacts/${artifactId}/content`, fileName);
}
export function downloadAuthoritativeSourceDocument(workItemId: string, documentId: string, fileName: string) {
    return download(`/api/recapitalization/work-items/${workItemId}/source-documents/${documentId}/content`, fileName);
}

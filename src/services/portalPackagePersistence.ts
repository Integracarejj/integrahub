import { getAuthHeaders } from "../utils/apiFetch";

function headers(contentType: string): Record<string, string> {
    return { ...getAuthHeaders(), "Content-Type": contentType };
}

async function readError(response: Response): Promise<string> {
    try { return (await response.json())?.error || "Request failed"; } catch { return "Request failed"; }
}

export interface AuthoritativePortalTransaction {
    id: string;
    name: string;
    status: "Active" | "Pending" | "Completed" | "Cancelled";
    owningExternalOrganizationId: string;
}

export async function listAuthoritativeRecapTransactions(): Promise<AuthoritativePortalTransaction[]> {
    const response = await fetch("/api/portal/recapitalization/transactions", {
        credentials: "include",
        headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error(await readError(response));
    const body = await response.json();
    return Array.isArray(body?.transactions) ? body.transactions : [];
}

export async function createAuthoritativeRecapTransactionRecord(name: string): Promise<AuthoritativePortalTransaction> {
    const response = await fetch("/api/portal/recapitalization/transactions", {
        method: "POST",
        credentials: "include",
        headers: headers("application/json"),
        body: JSON.stringify({ name }),
    });
    if (!response.ok) throw new Error(await readError(response));
    const body = await response.json();
    if (!body?.id || !body?.name || !body?.owningExternalOrganizationId) throw new Error("Transaction creation returned an invalid response");
    return body;
}

export async function createAuthoritativeRecapTransaction(name: string): Promise<string> {
    return (await createAuthoritativeRecapTransactionRecord(name)).id;
}

export async function persistIncomingPackage(businessTransactionId: string, sourcePackageId: string, file: File): Promise<void> {
    const response = await fetch(`/api/portal/recapitalization/transactions/${encodeURIComponent(businessTransactionId)}/incoming-documents`, {
        method: "POST",
        credentials: "include",
        headers: {
            ...headers("application/octet-stream"),
            "x-file-name": encodeURIComponent(file.name),
            "x-package-id": sourcePackageId,
        },
        body: file,
    });
    if (!response.ok) throw new Error(await readError(response));
}

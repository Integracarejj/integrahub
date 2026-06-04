import type { RoleDefinition, SystemRoleUsageRecord, RoleUsageFormData } from "../types/role";
import { getAuthHeaders } from "../utils/authHeaders";

export async function getRoleDefinitions(): Promise<RoleDefinition[]> {
    const res = await fetch("/api/roles");
    if (!res.ok) throw new Error("Failed to fetch role definitions");
    return res.json();
}

export async function getRoleUsageByRole(roleCode: string): Promise<SystemRoleUsageRecord[]> {
    const res = await fetch(`/api/role-usage/by-role/${encodeURIComponent(roleCode)}`);
    if (!res.ok) throw new Error("Failed to fetch role usage");
    return res.json();
}

export async function createRoleUsage(data: RoleUsageFormData): Promise<void> {
    const res = await fetch("/api/role-usage", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Failed to create role usage");
    }
}

export async function updateRoleUsage(id: number, data: Partial<RoleUsageFormData>): Promise<void> {
    const res = await fetch(`/api/role-usage/${encodeURIComponent(String(id))}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Failed to update role usage");
    }
}

export async function deleteRoleUsage(id: number): Promise<void> {
    const res = await fetch(`/api/role-usage/${encodeURIComponent(String(id))}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error("Failed to delete role usage");
}

import type { BusinessProcess, BusinessProcessDetail, BusinessProcessStepSystem } from "../types/businessProcess";

export async function getApplicationBusinessProcesses(applicationId: string): Promise<Pick<BusinessProcess, "id" | "processName" | "processCategory" | "description">[]> {
    const res = await fetch(`/api/business-processes/by-application/${applicationId}`);
    if (!res.ok) throw new Error("Failed to fetch application business processes");
    return res.json();
}

export async function getBusinessProcesses(): Promise<BusinessProcess[]> {
    const res = await fetch("/api/business-processes");
    if (!res.ok) throw new Error("Failed to fetch business processes");
    return res.json();
}

export async function getBusinessProcessDetail(id: number): Promise<BusinessProcessDetail> {
    const res = await fetch(`/api/business-processes/${id}`);
    if (!res.ok) throw new Error("Failed to fetch business process detail");
    return res.json();
}

export async function createBusinessProcess(data: { processName: string; processCategory?: string; description?: string }): Promise<BusinessProcess> {
    const res = await fetch("/api/business-processes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to create process" }));
        throw new Error(err.error);
    }
    return res.json();
}

export async function updateBusinessProcess(id: number, data: { processName: string; processCategory?: string; description?: string }): Promise<BusinessProcess> {
    const res = await fetch(`/api/business-processes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to update process" }));
        throw new Error(err.error);
    }
    return res.json();
}

export async function deleteBusinessProcess(id: number): Promise<void> {
    const res = await fetch(`/api/business-processes/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete process");
}

export async function addSystemToProcess(id: number, data: { applicationId: string; sequenceOrder?: number; processRole?: string; notes?: string }): Promise<BusinessProcessStepSystem> {
    const res = await fetch(`/api/business-processes/${id}/systems`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to add system" }));
        throw new Error(err.error);
    }
    return res.json();
}

export async function updateSystemMapping(id: number, mappingId: number, data: { sequenceOrder?: number; processRole?: string; notes?: string }): Promise<BusinessProcessStepSystem> {
    const res = await fetch(`/api/business-processes/${id}/systems/${mappingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to update system mapping" }));
        throw new Error(err.error);
    }
    return res.json();
}

export async function removeSystemFromProcess(id: number, mappingId: number): Promise<void> {
    const res = await fetch(`/api/business-processes/${id}/systems/${mappingId}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to remove system from process");
}

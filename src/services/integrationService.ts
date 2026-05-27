import type { IntegrationView } from "../types/integration";
import { getAuthHeaders } from "../utils/authHeaders";

export interface IntegrationFormData {
    sourceApplicationId: string;
    targetApplicationId: string;
    integrationType: string;
    status: string;
    method: string;
    frequency: string;
    businessPurpose: string;
    dataExchanged: string;
    notes: string;
}

export async function getIntegrationViews(): Promise<IntegrationView[]> {
    const res = await fetch("/api/integrations");
    if (!res.ok) {
        throw new Error("Failed to fetch integrations");
    }
    const data = await res.json();

    return data.map((i: any) => ({
        id: i.id,
        fromApplicationId: i.sourceApplicationId,
        toApplicationId: i.targetApplicationId,
        fromApplicationName: i.sourceApplicationName,
        toApplicationName: i.targetApplicationName,
        integrationType: i.integrationType,
        status: i.status || "Unknown",
        method: i.method || "Unknown",
        frequency: i.frequency || "Unknown",
        businessPurpose: i.businessPurpose || null,
        dataExchanged: i.dataExchanged || null,
        notes: i.notes || null,
    }));
}

export async function createIntegration(
    data: IntegrationFormData
): Promise<void> {
    const body = {
        sourceApplicationId: data.sourceApplicationId,
        targetApplicationId: data.targetApplicationId,
        integrationType: data.integrationType,
        status: data.status || "Active",
        method: data.method || "Unknown",
        frequency: data.frequency || "Unknown",
        businessPurpose: data.businessPurpose || null,
        dataExchanged: data.dataExchanged || null,
        notes: data.notes || null,
    };

    const res = await fetch("/api/integrations", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Failed to create integration");
    }
}
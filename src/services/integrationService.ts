import type { IntegrationView } from "../types/integration";

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
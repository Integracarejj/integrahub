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
        status: "Active",
        direction: "Outbound",
        method: "API",
        frequency: "Real-time",
        description: i.notes,
    }));
}
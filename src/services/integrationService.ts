import integrations from "../data/integrations.json";
import applications from "../data/applications.json";
import type { Integration, IntegrationView } from "../types/integration";

// NOTE: We intentionally keep this service self-contained (JSON-backed).
// Later, you can swap internals to call an API without changing callers.

type AppLike = {
    id: string;
    name: string;
};

function toAppIndex(apps: AppLike[]): Record<string, string> {
    return apps.reduce<Record<string, string>>((acc, app) => {
        acc[app.id] = app.name;
        return acc;
    }, {});
}

function safeName(appIndex: Record<string, string>, id: string): string {
    return appIndex[id] ?? `Unknown (${id})`;
}

export async function getIntegrations(): Promise<Integration[]> {
    // Keeping async signature so swapping to API later is painless.
    return integrations as Integration[];
}

export async function getIntegrationViews(): Promise<IntegrationView[]> {
    const appIndex = toAppIndex(applications as AppLike[]);
    const rows = (integrations as Integration[]).map((i) => ({
        ...i,
        fromApplicationName: safeName(appIndex, i.fromApplicationId),
        toApplicationName: safeName(appIndex, i.toApplicationId),
    }));

    // Calm default ordering: by From app name, then To app name
    rows.sort((a, b) => {
        const fromCmp = a.fromApplicationName.localeCompare(b.fromApplicationName);
        if (fromCmp !== 0) return fromCmp;
        return a.toApplicationName.localeCompare(b.toApplicationName);
    });

    return rows;
}
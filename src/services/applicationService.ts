import applications from "../data/applications.json";
import capabilities from "../data/capabilities.json";
import type { Application } from "../types/application";
import type { Capability } from "../types/capability";

let applicationStore: Application[] = [...(applications as Application[])];

export function getApplications(): Application[] {
    return applicationStore;
}

export function getApplicationById(id: string): Application | undefined {
    return applicationStore.find((app) => app.id === id);
}

export function getCapabilities(): Capability[] {
    return capabilities as Capability[];
}

export function getCapabilityName(capabilityId: string): string {
    const cap = (capabilities as Capability[]).find(
        (c) => c.id === capabilityId
    );
    return cap ? cap.name : "Unknown";
}

export function updateApplication(
    id: string,
    updates: Partial<Pick<Application, "businessContext">>
): Application | undefined {
    const index = applicationStore.findIndex((app) => app.id === id);
    if (index === -1) return undefined;

    applicationStore[index] = {
        ...applicationStore[index],
        businessContext: {
            ...applicationStore[index].businessContext,
            ...updates.businessContext,
        },
    };

    return applicationStore[index];
}

export function updateOwnership(
    id: string,
    updates: Partial<Pick<Application["ownership"], "businessOwner" | "technicalOwner">>
): Application | undefined {
    const index = applicationStore.findIndex((app) => app.id === id);
    if (index === -1) return undefined;

    applicationStore[index] = {
        ...applicationStore[index],
        ownership: {
            ...applicationStore[index].ownership,
            ...updates,
        },
    };

    return applicationStore[index];
}

export type MockUser = {
    name: string;
    role: string;
};

const MOCK_CURRENT_USER: MockUser = {
    name: "Chief Human Resources Officer",
    role: "PlatformAdmin",
};

export function getCurrentUser(): MockUser {
    return MOCK_CURRENT_USER;
}

export function canEditApplication(app: Application): boolean {
    const user = getCurrentUser();

    if (user.role === "PlatformAdmin") return true;

    if (
        user.name === app.ownership.businessOwner ||
        user.name === app.ownership.technicalOwner
    ) {
        return true;
    }

    return false;
}

export function canEditOwnership(): boolean {
    const user = getCurrentUser();
    return user.role === "PlatformAdmin";
}

export function searchApplications(
    apps: Application[],
    query: string
): Application[] {
    const terms = query
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter((t) => t.length > 0);

    if (terms.length === 0) {
        return apps;
    }

    return apps.filter((app) => {
        const capabilityName = getCapabilityName(app.capabilityId);

        const searchableText = [
            app.name,
            capabilityName,
            app.businessContext.purpose,
            app.businessContext.impactIfDown,
            app.businessContext.businessCriticality,
            ...app.businessContext.businessFunctions,
            ...app.businessContext.departmentsSupported,
            ...app.capabilities.map((c) => c.name),
            ...app.capabilities.map((c) => c.description ?? ""),
            app.ownership.businessOwner,
            app.ownership.technicalOwner,
            app.ownership.vendor ?? "",
        ]
            .join(" ")
            .toLowerCase();

        return terms.some((term) => searchableText.includes(term));
    });
}

import applications from "../data/applications.json";
import capabilities from "../data/capabilities.json";
import type { Application } from "../types/application";
import type { Capability } from "../types/capability";

export function getApplications(): Application[] {
    return applications as Application[];
}

export function getApplicationById(id: string): Application | undefined {
    return (applications as Application[]).find((app) => app.id === id);
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

export type ApplicationStatus = "Active" | "Legacy" | "Sunset";

export type ApplicationType = "Standard" | "Platform";

export interface Application {
    id: string;
    name: string;
    capabilityId: string;
    owner: string;
    status: ApplicationStatus;
    type: ApplicationType;
    description?: string;
}
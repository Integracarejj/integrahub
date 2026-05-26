export type IntegrationStatus = "Active" | "Planned" | "Retired" | "Unknown";

export type IntegrationMethod =
    | "API"
    | "SFTP"
    | "CSV Import"
    | "Manual"
    | "Database Sync"
    | "Webhook"
    | "Vendor Managed"
    | "Unknown";

export type IntegrationFrequency =
    | "Real-time"
    | "Daily"
    | "Weekly"
    | "Monthly"
    | "Manual"
    | "As needed"
    | "Unknown";

export interface Integration {
    id: string;
    fromApplicationId: string;
    toApplicationId: string;
    integrationType: string;
    status: IntegrationStatus;
    method: IntegrationMethod;
    frequency: IntegrationFrequency;
    businessPurpose?: string | null;
    dataExchanged?: string | null;
    notes?: string | null;
}

export interface IntegrationView extends Integration {
    fromApplicationName: string;
    toApplicationName: string;
}

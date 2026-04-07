export type IntegrationStatus = "Active" | "Inactive";

export type IntegrationDirection = "Inbound" | "Outbound";

export type IntegrationMethod =
    | "API"
    | "File Transfer"
    | "CSV Export"
    | "Webhook"
    | "Manual"
    | "SSO"
    | "Database"
    | "Other";

export type IntegrationFrequency =
    | "Real-time"
    | "Daily"
    | "Weekly"
    | "Monthly"
    | "Ad-hoc"
    | "On-demand";

export interface Integration {
    id: string;
    fromApplicationId: string;
    toApplicationId: string;
    integrationType: IntegrationMethod;
    direction: IntegrationDirection;
    method: IntegrationMethod;
    frequency: IntegrationFrequency;
    dataType?: string;
    status: IntegrationStatus;
    description?: string;
}

export interface IntegrationView extends Integration {
    fromApplicationName: string;
    toApplicationName: string;
}

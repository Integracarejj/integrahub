export type IntegrationStatus = "Active" | "Inactive";

export type IntegrationType =
    | "API"
    | "SFTP"
    | "CSV Export"
    | "Webhook"
    | "Manual"
    | "SSO"
    | "Other";

export interface Integration {
    id: string;
    fromApplicationId: string;
    toApplicationId: string;
    integrationType: IntegrationType;
    status: IntegrationStatus;
    description?: string;
}

/**
 * View model for the global Integrations list.
 * Enriched with app names for display + linking.
 */
export interface IntegrationView extends Integration {
    fromApplicationName: string;
    toApplicationName: string;
}
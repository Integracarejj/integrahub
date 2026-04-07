export type ApplicationStatus = "Active" | "Legacy" | "Sunset";

export type ApplicationType = "Standard" | "Platform";

export type BusinessCriticality = "High" | "Medium" | "Low";

export type HostingModel = "SaaS" | "Azure" | "On-Prem" | "Hybrid";

export interface ApplicationCapability {
    name: string;
    description?: string;
}

export interface ApplicationIntegration {
    integrationId: string;
    direction: "Inbound" | "Outbound";
    method: IntegrationMethod;
    frequency: IntegrationFrequency;
    dataType?: string;
}

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

export interface Application {
    id: string;
    name: string;
    status: ApplicationStatus;
    type: ApplicationType;

    businessContext: {
        purpose: string;
        businessCriticality: BusinessCriticality;
        businessFunctions: string[];
        departmentsSupported: string[];
        impactIfDown: string;
    };

    ownership: {
        businessOwner: string;
        technicalOwner: string;
        vendor?: string;
    };

    capabilities: ApplicationCapability[];
    capabilityId: string;

    integrations: ApplicationIntegration[];

    platformStack: {
        hostingModel: HostingModel;
        platformVendor?: string;
        runtimePlatform?: string;
        dataStoreType?: string;
    };

    description?: string;
}

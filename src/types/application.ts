export type ApplicationStatus = "Active" | "Legacy" | "Sunset";

export type ApplicationType = "Standard" | "Platform";

export type BusinessCriticality = "High" | "Medium" | "Low";

export type HostingModel = "SaaS" | "Azure" | "On-Prem" | "Hybrid";

export interface ApplicationCapability {
    name: string;
    description?: string;
}

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

export interface ApplicationIntegration {
    integrationId: string;
    direction: "Inbound" | "Outbound";
    method: IntegrationMethod;
    frequency: IntegrationFrequency;
    dataType?: string;
}

export interface Application {
    id: string;
    name: string;
    status: ApplicationStatus;
    type: ApplicationType;
    systemCategory?: string | null;

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

    primaryUseCases?: string | null;
    departmentsSupported?: string | null;
    accessRequestProcess?: string | null;
    trainingDocumentationUrl?: string | null;
}

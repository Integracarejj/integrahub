export interface BusinessProcess {
    id: number;
    processName: string;
    processCategory: string | null;
    description: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface BusinessProcessSystem {
    mappingId: number;
    businessProcessId: number;
    applicationId: string;
    sequenceOrder: number;
    processRole: string | null;
    notes: string | null;
    applicationName: string;
    systemCategory: string | null;
    businessCriticality: string | null;
    applicationStatus: string | null;
}

export interface BusinessProcessDetail extends BusinessProcess {
    systems: BusinessProcessSystem[];
}

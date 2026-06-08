export interface BusinessProcess {
    id: number;
    processName: string;
    processCategory: string | null;
    description: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface BusinessProcessStepSystem {
    mappingId: number;
    businessProcessId: number;
    businessProcessStepId: number | null;
    applicationId: string;
    notes: string | null;
    applicationName: string;
    systemCategory: string | null;
    businessCriticality: string | null;
    applicationStatus: string | null;
}

export interface BusinessProcessStep {
    id: number;
    businessProcessId: number;
    stepName: string;
    stepDescription: string | null;
    sequenceOrder: number;
    createdAt: string;
    updatedAt: string;
    systems: BusinessProcessStepSystem[];
}

export interface BusinessProcessDetail extends BusinessProcess {
    steps: BusinessProcessStep[];
    unassignedSystems: BusinessProcessStepSystem[];
}

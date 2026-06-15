export interface BusinessProcess {
    id: number;
    processName: string;
    processCategory: string | null;
    description: string | null;
    processOwner?: string | null;
    businessRisk?: string | null;
    manualEffort?: string | null;
    automationPotential?: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface BusinessProcessStepSystem {
    mappingId: number;
    businessProcessId: number;
    businessProcessStepId: number | null;
    applicationId: string;
    sequenceOrder: number;
    processRole: string | null;
    notes: string | null;
    applicationName: string;
    systemCategory: string | null;
    businessCriticality: string | null;
    status: string | null;
}

export interface ProcessRelatedIntegration {
    integrationId: number;
    sourceApplicationId?: string | null;
    sourceApplicationName?: string | null;
    targetApplicationId?: string | null;
    targetApplicationName?: string | null;
    integrationType?: string | null;
    method?: string | null;
    frequency?: string | null;
    status?: string | null;
    businessPurpose?: string | null;
    dataExchanged?: string | null;
    notes?: string | null;
}

export interface BusinessProcessStep {
    id: number;
    businessProcessId: number;
    stepName: string;
    stepDescription: string | null;
    businessPurpose: string | null;
    keyActivities: string | null;
    manualActivities?: string | null;
    automationOpportunities?: string | null;
    primaryActors: string | null;
    inputs: string | null;
    outputs: string | null;
    riskNotes: string | null;
    sequenceOrder: number;
    createdAt: string;
    updatedAt: string;
    systems: BusinessProcessStepSystem[];
    relatedIntegrations?: ProcessRelatedIntegration[];
}

export interface BusinessProcessDetail extends BusinessProcess {
    steps: BusinessProcessStep[];
    unassignedSystems: BusinessProcessStepSystem[];
}

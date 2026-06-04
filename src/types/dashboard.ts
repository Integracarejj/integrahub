export interface DashboardDataQualityMetrics {
    totalSystems: number;
    activeSystems: number;
    criticalSystems: number;
    systemsMissingBusinessOwner: number;
    systemsMissingTechnicalOwner: number;
    systemsMissingBackupOwner: number;
    systemsMissingCriticality: number;
    systemsMissingPurpose: number;
    systemsMissingOperationalContext: number;
    systemsWithoutIntegrations: number;
    systemsWithoutRoleMappings: number;
    testOrCleanupIntegrations: number;
    systemsWithRoles: number;
    systemsWithIntegrations: number;
}

export interface SystemBrief {
    id: string;
    name: string;
    status: string;
}

export interface MissingOwnerSystem extends SystemBrief {
    businessOwner: string | null;
    technicalOwner: string | null;
}

export interface MissingOperationalContextSystem extends SystemBrief {
    primaryUseCases: string | null;
    departmentsSupported: string | null;
    accessRequestProcess: string | null;
    trainingDocumentationUrl: string | null;
}

export interface TestIntegration {
    id: string;
    sourceApplicationId: string;
    targetApplicationId: string;
    sourceApplicationName: string;
    targetApplicationName: string;
    notes: string | null;
    businessPurpose: string | null;
    dataExchanged: string | null;
}

export interface SystemWithCount {
    id: string;
    name: string;
    roleCount?: number;
    connectionCount?: number;
}

export interface DashboardDataQualityLists {
    missingOwners: MissingOwnerSystem[];
    missingOperationalContext: MissingOperationalContextSystem[];
    systemsWithoutRoles: SystemBrief[];
    systemsWithoutIntegrations: SystemBrief[];
    possibleTestIntegrations: TestIntegration[];
    mostUsedSystemsByRoleCount: SystemWithCount[];
    mostConnectedSystems: SystemWithCount[];
}

export interface DashboardDataQualityResponse {
    metrics: DashboardDataQualityMetrics;
    lists: DashboardDataQualityLists;
}

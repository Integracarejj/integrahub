export interface RoleDefinition {
    id: string;
    roleCode: string;
    roleName: string;
    roleGroup: string;
    description: string | null;
    isActive: boolean;
}

export interface SystemRoleUsageRecord {
    id: string;
    applicationId: string;
    roleDefinitionId: string;
    usageType: string;
    usagePurpose: string | null;
    isPrimary: boolean;
    notes: string | null;
    createdAt: string;
    updatedAt: string;
    applicationName: string;
    applicationType: string | null;
    systemCategory: string | null;
    architectureType: string | null;
    applicationStatus: string | null;
    roleCode: string;
    roleName: string;
    roleGroup: string;
}

export interface RoleUsageFormData {
    applicationId: string;
    roleDefinitionId: string;
    usageType: string;
    usagePurpose: string;
    isPrimary: boolean;
    notes: string;
}

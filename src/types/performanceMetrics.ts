export interface PerformanceMetricSnapshot {
    id: number;
    performanceArea: string;
    sourceSystem: string;
    snapshotLabel: string;
    periodStartDate: string;
    periodEndDate: string;
    isDraft: boolean;
    createdAt: string;
}

export interface CommunityBreakdown {
    id: number;
    snapshotId: number;
    communityName: string;
    newlyOpenedWorkOrders: number;
    closedWorkOrders: number;
    totalOpenWorkOrders: number;
    thirtyDayOpenWorkOrders: number;
    regulatoryOverdue: number;
    pmOverdue: number;
    skippedTasks: number;
    mobileSignIns: number;
    webSignIns: number;
    taggedAssets: number;
    totalActiveAssets: number;
    attentionScore: number;
    attentionStatus: string;
    createdAt: string;
}

export interface MaintenanceComplianceResponse {
    snapshot: PerformanceMetricSnapshot | null;
    communities: CommunityBreakdown[];
}

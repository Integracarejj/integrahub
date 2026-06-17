import type { MaintenanceComplianceResponse, TrendsResponse } from "../types/performanceMetrics";

export async function getLatestMaintenanceComplianceMetrics(): Promise<MaintenanceComplianceResponse> {
    const res = await fetch("/api/performance-metrics/maintenance-compliance/latest");
    if (!res.ok) throw new Error("Failed to fetch maintenance & compliance metrics");
    return res.json();
}

export async function getMaintenanceComplianceTrends(): Promise<TrendsResponse> {
    const res = await fetch("/api/performance-metrics/maintenance-compliance/trends");
    if (!res.ok) throw new Error("Failed to fetch maintenance compliance trends");
    return res.json();
}

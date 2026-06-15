import type { MaintenanceComplianceResponse } from "../types/performanceMetrics";

export async function getLatestMaintenanceComplianceMetrics(): Promise<MaintenanceComplianceResponse> {
    const res = await fetch("/api/performance-metrics/maintenance-compliance/latest");
    if (!res.ok) throw new Error("Failed to fetch maintenance & compliance metrics");
    return res.json();
}

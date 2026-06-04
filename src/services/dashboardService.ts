import type { DashboardDataQualityResponse } from "../types/dashboard";

export async function getDashboardDataQuality(): Promise<DashboardDataQualityResponse> {
    const res = await fetch("/api/dashboard/data-quality");
    if (!res.ok) throw new Error("Failed to fetch data quality metrics");
    return res.json();
}

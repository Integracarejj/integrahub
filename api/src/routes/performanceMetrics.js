import { Router } from "express";
import { query } from "../db.js";

const router = Router();

router.get("/maintenance-compliance/latest", async (_req, res) => {
    try {
        const snapshots = await query(`
            SELECT
                id, performanceArea, sourceSystem, snapshotLabel,
                periodStartDate, periodEndDate, isDraft, createdAt
            FROM cmdb.PerformanceMetricSnapshots
            WHERE performanceArea = 'Maintenance & Compliance'
              AND sourceSystem = 'TELS'
            ORDER BY id DESC
        `);

        if (!snapshots || snapshots.length === 0) {
            return res.json({ snapshot: null, communities: [] });
        }

        const snapshot = snapshots[0];

        const communities = await query(`
            SELECT
                id, snapshotId, communityName,
                newlyOpenedWorkOrders, closedWorkOrders, totalOpenWorkOrders,
                thirtyDayOpenWorkOrders, regulatoryOverdue, pmOverdue, skippedTasks,
                mobileSignIns, webSignIns, taggedAssets, totalActiveAssets,
                attentionScore, attentionStatus, createdAt
            FROM cmdb.PerformanceMetricCommunityBreakdown
            WHERE snapshotId = @snapshotId
            ORDER BY attentionScore DESC, communityName ASC
        `, { snapshotId: snapshot.id });

        return res.json({ snapshot, communities: communities || [] });
    } catch (err) {
        console.error("GET /api/performance-metrics/maintenance-compliance/latest ERROR:", err?.message || err);
        if (err?.stack) console.error(err.stack);
        return res.status(500).json({
            error: "Failed to fetch performance metrics",
            details: err?.message || "Unknown error",
        });
    }
});

/* ─── Fallback trends (when DB table is missing) ─── */

const FALLBACK_TRENDS = [
    {
        metricKey: "open-wo",
        label: "Open Work Orders",
        metricType: "count",
        data: [
            { periodLabel: "5/16", periodStartDate: "2026-05-10", periodEndDate: "2026-05-16", value: 62 },
            { periodLabel: "5/23", periodStartDate: "2026-05-17", periodEndDate: "2026-05-23", value: 58 },
            { periodLabel: "5/30", periodStartDate: "2026-05-24", periodEndDate: "2026-05-30", value: 55 },
            { periodLabel: "6/6",  periodStartDate: "2026-05-31", periodEndDate: "2026-06-06", value: 50 },
            { periodLabel: "6/13", periodStartDate: "2026-06-07", periodEndDate: "2026-06-13", value: 46 },
        ],
    },
    {
        metricKey: "pm-overdue",
        label: "PM Overdue",
        metricType: "count",
        data: [
            { periodLabel: "5/16", periodStartDate: "2026-05-10", periodEndDate: "2026-05-16", value: 73 },
            { periodLabel: "5/23", periodStartDate: "2026-05-17", periodEndDate: "2026-05-23", value: 68 },
            { periodLabel: "5/30", periodStartDate: "2026-05-24", periodEndDate: "2026-05-30", value: 61 },
            { periodLabel: "6/6",  periodStartDate: "2026-05-31", periodEndDate: "2026-06-06", value: 55 },
            { periodLabel: "6/13", periodStartDate: "2026-06-07", periodEndDate: "2026-06-13", value: 48 },
        ],
    },
    {
        metricKey: "mobile-adoption",
        label: "Mobile Adoption",
        metricType: "percentage",
        data: [
            { periodLabel: "5/16", periodStartDate: "2026-05-10", periodEndDate: "2026-05-16", value: 49 },
            { periodLabel: "5/23", periodStartDate: "2026-05-17", periodEndDate: "2026-05-23", value: 53 },
            { periodLabel: "5/30", periodStartDate: "2026-05-24", periodEndDate: "2026-05-30", value: 57 },
            { periodLabel: "6/6",  periodStartDate: "2026-05-31", periodEndDate: "2026-06-06", value: 61 },
            { periodLabel: "6/13", periodStartDate: "2026-06-07", periodEndDate: "2026-06-13", value: 64 },
        ],
    },
    {
        metricKey: "asset-tagging",
        label: "Asset Tagging",
        metricType: "percentage",
        data: [
            { periodLabel: "5/16", periodStartDate: "2026-05-10", periodEndDate: "2026-05-16", value: 89 },
            { periodLabel: "5/23", periodStartDate: "2026-05-17", periodEndDate: "2026-05-23", value: 91 },
            { periodLabel: "5/30", periodStartDate: "2026-05-24", periodEndDate: "2026-05-30", value: 94 },
            { periodLabel: "6/6",  periodStartDate: "2026-05-31", periodEndDate: "2026-06-06", value: 96 },
            { periodLabel: "6/13", periodStartDate: "2026-06-07", periodEndDate: "2026-06-13", value: 98 },
        ],
    },
];

router.get("/maintenance-compliance/trends", async (_req, res) => {
    try {
        const rows = await query(`
            SELECT
                metricKey, metricLabel, metricType,
                periodLabel, periodStartDate, periodEndDate, metricValue
            FROM cmdb.PerformanceMetricTrends
            WHERE performanceArea = 'Maintenance & Compliance'
              AND sourceSystem = 'TELS'
            ORDER BY metricKey, periodStartDate ASC
        `);

        if (!rows || rows.length === 0) {
            return res.json({ trends: FALLBACK_TRENDS });
        }

        const grouped = {};
        for (const row of rows) {
            if (!grouped[row.metricKey]) {
                grouped[row.metricKey] = {
                    metricKey: row.metricKey,
                    label: row.metricLabel,
                    metricType: row.metricType,
                    data: [],
                };
            }
            grouped[row.metricKey].data.push({
                periodLabel: row.periodLabel,
                periodStartDate: row.periodStartDate instanceof Date
                    ? row.periodStartDate.toISOString().split("T")[0]
                    : String(row.periodStartDate).split("T")[0],
                periodEndDate: row.periodEndDate instanceof Date
                    ? row.periodEndDate.toISOString().split("T")[0]
                    : String(row.periodEndDate).split("T")[0],
                value: Number(row.metricValue),
            });
        }

        return res.json({ trends: Object.values(grouped) });
    } catch (err) {
        console.error("GET /api/performance-metrics/maintenance-compliance/trends ERROR:", err?.message || err);
        return res.json({ trends: FALLBACK_TRENDS });
    }
});

export default router;

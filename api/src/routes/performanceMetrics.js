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

export default router;

import { Router } from "express";
import { query } from "../db.js";

const router = Router();

router.get("/data-quality", async (_req, res) => {
    try {
        const [metrics] = await query(`
            SELECT
                (SELECT COUNT(*) FROM cmdb.Applications) AS totalSystems,
                (SELECT COUNT(*) FROM cmdb.Applications WHERE status = 'Active') AS activeSystems,
                (SELECT COUNT(*) FROM cmdb.Applications WHERE businessCriticality = 'Critical') AS criticalSystems,
                (SELECT COUNT(*) FROM cmdb.Applications WHERE businessOwner IS NULL OR businessOwner = '') AS systemsMissingBusinessOwner,
                (SELECT COUNT(*) FROM cmdb.Applications WHERE technicalOwner IS NULL OR technicalOwner = '') AS systemsMissingTechnicalOwner,
                (SELECT COUNT(*) FROM cmdb.Applications WHERE backupOwner IS NULL OR backupOwner = '') AS systemsMissingBackupOwner,
                (SELECT COUNT(*) FROM cmdb.Applications WHERE businessCriticality IS NULL OR businessCriticality = '' OR businessCriticality = 'Unknown') AS systemsMissingCriticality,
                (SELECT COUNT(*) FROM cmdb.Applications WHERE purpose IS NULL OR purpose = '') AS systemsMissingPurpose,
                (SELECT COUNT(*) FROM cmdb.Applications WHERE (primaryUseCases IS NULL OR primaryUseCases = '') AND (departmentsSupported IS NULL OR departmentsSupported = '') AND (accessRequestProcess IS NULL OR accessRequestProcess = '') AND (trainingDocumentationUrl IS NULL OR trainingDocumentationUrl = '')) AS systemsMissingOperationalContext,
                (SELECT COUNT(*) FROM cmdb.Applications a WHERE NOT EXISTS (SELECT 1 FROM cmdb.ApplicationIntegrations WHERE sourceApplicationId = a.id OR targetApplicationId = a.id)) AS systemsWithoutIntegrations,
                (SELECT COUNT(*) FROM cmdb.Applications a WHERE NOT EXISTS (SELECT 1 FROM cmdb.SystemRoleUsage WHERE applicationId = a.id)) AS systemsWithoutRoleMappings,
                (SELECT COUNT(*) FROM cmdb.ApplicationIntegrations WHERE (notes LIKE '%test%' OR businessPurpose LIKE '%test%' OR dataExchanged LIKE '%test%' OR notes LIKE '%delete me%' OR businessPurpose LIKE '%delete me%' OR dataExchanged LIKE '%delete me%' OR notes LIKE '%sample%' OR businessPurpose LIKE '%sample%' OR dataExchanged LIKE '%sample%' OR notes LIKE '%dummy%' OR businessPurpose LIKE '%dummy%' OR dataExchanged LIKE '%dummy%')) AS testOrCleanupIntegrations,
                (SELECT COUNT(*) FROM cmdb.Applications a WHERE EXISTS (SELECT 1 FROM cmdb.SystemRoleUsage WHERE applicationId = a.id)) AS systemsWithRoles,
                (SELECT COUNT(*) FROM cmdb.Applications a WHERE EXISTS (SELECT 1 FROM cmdb.ApplicationIntegrations WHERE sourceApplicationId = a.id OR targetApplicationId = a.id)) AS systemsWithIntegrations
        `);

        const [
            missingOwners,
            missingOperationalContext,
            systemsWithoutRoles,
            systemsWithoutIntegrations,
            possibleTestIntegrations,
            mostUsedSystemsByRoleCount,
            mostConnectedSystems,
        ] = await Promise.all([
            query(`
                SELECT id, name, businessOwner, technicalOwner, status
                FROM cmdb.Applications
                WHERE businessOwner IS NULL OR businessOwner = '' OR technicalOwner IS NULL OR technicalOwner = ''
                ORDER BY name
            `),
            query(`
                SELECT id, name, primaryUseCases, departmentsSupported, accessRequestProcess, trainingDocumentationUrl, status
                FROM cmdb.Applications
                WHERE (primaryUseCases IS NULL OR primaryUseCases = '')
                  AND (departmentsSupported IS NULL OR departmentsSupported = '')
                  AND (accessRequestProcess IS NULL OR accessRequestProcess = '')
                  AND (trainingDocumentationUrl IS NULL OR trainingDocumentationUrl = '')
                ORDER BY name
            `),
            query(`
                SELECT a.id, a.name, a.status
                FROM cmdb.Applications a
                WHERE NOT EXISTS (SELECT 1 FROM cmdb.SystemRoleUsage WHERE applicationId = a.id)
                ORDER BY a.name
            `),
            query(`
                SELECT a.id, a.name, a.status
                FROM cmdb.Applications a
                WHERE NOT EXISTS (SELECT 1 FROM cmdb.ApplicationIntegrations WHERE sourceApplicationId = a.id OR targetApplicationId = a.id)
                ORDER BY a.name
            `),
            query(`
                SELECT
                    i.id,
                    i.sourceApplicationId,
                    i.targetApplicationId,
                    sa.name AS sourceApplicationName,
                    ta.name AS targetApplicationName,
                    i.notes,
                    i.businessPurpose,
                    i.dataExchanged
                FROM cmdb.ApplicationIntegrations i
                INNER JOIN cmdb.Applications sa ON i.sourceApplicationId = sa.id
                INNER JOIN cmdb.Applications ta ON i.targetApplicationId = ta.id
                WHERE i.notes LIKE '%test%' OR i.businessPurpose LIKE '%test%' OR i.dataExchanged LIKE '%test%'
                   OR i.notes LIKE '%delete me%' OR i.businessPurpose LIKE '%delete me%' OR i.dataExchanged LIKE '%delete me%'
                   OR i.notes LIKE '%sample%' OR i.businessPurpose LIKE '%sample%' OR i.dataExchanged LIKE '%sample%'
                   OR i.notes LIKE '%dummy%' OR i.businessPurpose LIKE '%dummy%' OR i.dataExchanged LIKE '%dummy%'
                ORDER BY sa.name, ta.name
            `),
            query(`
                SELECT a.id, a.name, COUNT(sru.id) AS roleCount
                FROM cmdb.Applications a
                INNER JOIN cmdb.SystemRoleUsage sru ON a.id = sru.applicationId
                GROUP BY a.id, a.name
                ORDER BY roleCount DESC
            `),
            query(`
                SELECT a.id, a.name, COUNT(DISTINCT ai.id) AS connectionCount
                FROM cmdb.Applications a
                LEFT JOIN cmdb.ApplicationIntegrations ai ON a.id = ai.sourceApplicationId OR a.id = ai.targetApplicationId
                GROUP BY a.id, a.name
                ORDER BY connectionCount DESC
            `),
        ]);

        res.json({
            metrics,
            lists: {
                missingOwners,
                missingOperationalContext,
                systemsWithoutRoles,
                systemsWithoutIntegrations,
                possibleTestIntegrations,
                mostUsedSystemsByRoleCount,
                mostConnectedSystems,
            },
        });
    } catch (err) {
        console.error("GET /api/dashboard/data-quality failed:", err);
        res.status(500).json({
            error: "Failed to fetch data quality metrics",
            details: err?.message || "Unknown error",
        });
    }
});

export default router;

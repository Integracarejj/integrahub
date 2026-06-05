import { Router } from "express";
import { query } from "../db.js";

const router = Router();

const EMPTY_METRICS = {
    totalSystems: 0, activeSystems: 0, criticalSystems: 0,
    systemsMissingBusinessOwner: 0, systemsMissingTechnicalOwner: 0,
    systemsMissingBackupOwner: 0, systemsMissingCriticality: 0,
    systemsMissingPurpose: 0, systemsMissingOperationalContext: 0,
    systemsWithoutIntegrations: 0, systemsWithoutRoleMappings: 0,
    testOrCleanupIntegrations: 0, systemsWithRoles: 0, systemsWithIntegrations: 0,
};

async function safeQuery(label, sql) {
    try {
        console.log(`  running query: ${label}`);
        const result = await query(sql);
        console.log(`  query "${label}" returned`, Array.isArray(result) ? `${result.length} rows` : typeof result);
        return Array.isArray(result) ? result : [];
    } catch (err) {
        console.error(`  query "${label}" FAILED:`, err?.message || err);
        return [];
    }
}

router.get("/data-quality", async (_req, res) => {
    try {
        console.log("GET /api/dashboard/data-quality started");

        // --- METRICS (single row of scalar counts) ---
        const metricsRows = await safeQuery("metrics", `
            SELECT
                (SELECT COUNT(*) FROM cmdb.Applications) AS totalSystems,
                (SELECT COUNT(*) FROM cmdb.Applications WHERE status = 'Active') AS activeSystems,
                (SELECT COUNT(*) FROM cmdb.Applications WHERE businessCriticality = 'Critical') AS criticalSystems,
                (SELECT COUNT(*) FROM cmdb.Applications WHERE businessOwner IS NULL OR businessOwner = '') AS systemsMissingBusinessOwner,
                (SELECT COUNT(*) FROM cmdb.Applications WHERE technicalOwner IS NULL OR technicalOwner = '') AS systemsMissingTechnicalOwner,
                (SELECT COUNT(*) FROM cmdb.Applications WHERE backupOwner IS NULL OR backupOwner = '') AS systemsMissingBackupOwner,
                (SELECT COUNT(*) FROM cmdb.Applications WHERE businessCriticality IS NULL OR businessCriticality = '' OR businessCriticality = 'Unknown') AS systemsMissingCriticality,
                (SELECT COUNT(*) FROM cmdb.Applications WHERE purpose IS NULL OR purpose = '') AS systemsMissingPurpose,
                (SELECT COUNT(*) FROM cmdb.Applications
                 WHERE (primaryUseCases IS NULL OR primaryUseCases = '')
                   AND (departmentsSupported IS NULL OR departmentsSupported = '')
                   AND (accessRequestProcess IS NULL OR accessRequestProcess = '')
                   AND (trainingDocumentationUrl IS NULL OR trainingDocumentationUrl = '')
                ) AS systemsMissingOperationalContext,
                (SELECT COUNT(*) FROM cmdb.Applications a
                 WHERE NOT EXISTS (SELECT 1 FROM cmdb.ApplicationIntegrations WHERE sourceApplicationId = a.id OR targetApplicationId = a.id)
                ) AS systemsWithoutIntegrations,
                (SELECT COUNT(*) FROM cmdb.Applications a
                 WHERE NOT EXISTS (SELECT 1 FROM cmdb.SystemRoleUsage WHERE applicationId = a.id)
                ) AS systemsWithoutRoleMappings,
                (SELECT COUNT(*) FROM cmdb.ApplicationIntegrations
                 WHERE (notes LIKE '%test%' OR businessPurpose LIKE '%test%' OR dataExchanged LIKE '%test%')
                    OR (notes LIKE '%delete me%' OR businessPurpose LIKE '%delete me%' OR dataExchanged LIKE '%delete me%')
                    OR (notes LIKE '%sample%' OR businessPurpose LIKE '%sample%' OR dataExchanged LIKE '%sample%')
                    OR (notes LIKE '%dummy%' OR businessPurpose LIKE '%dummy%' OR dataExchanged LIKE '%dummy%')
                ) AS testOrCleanupIntegrations,
                (SELECT COUNT(*) FROM cmdb.Applications a
                 WHERE EXISTS (SELECT 1 FROM cmdb.SystemRoleUsage WHERE applicationId = a.id)
                ) AS systemsWithRoles,
                (SELECT COUNT(*) FROM cmdb.Applications a
                 WHERE EXISTS (SELECT 1 FROM cmdb.ApplicationIntegrations WHERE sourceApplicationId = a.id OR targetApplicationId = a.id)
                ) AS systemsWithIntegrations
        `);

        const metrics = (metricsRows && metricsRows.length > 0)
            ? metricsRows[0]
            : { ...EMPTY_METRICS };

        console.log("Metrics obtained:", JSON.stringify(metrics));

        // --- LISTS (run sequentially to avoid any pool contention) ---
        const lists = {};

        lists.missingOwners = await safeQuery("missingOwners", `
            SELECT id, name, businessOwner, technicalOwner, status
            FROM cmdb.Applications
            WHERE businessOwner IS NULL OR businessOwner = '' OR technicalOwner IS NULL OR technicalOwner = ''
            ORDER BY name
        `);

        lists.missingOperationalContext = await safeQuery("missingOperationalContext", `
            SELECT id, name, primaryUseCases, departmentsSupported, accessRequestProcess, trainingDocumentationUrl, status
            FROM cmdb.Applications
            WHERE (primaryUseCases IS NULL OR primaryUseCases = '')
              AND (departmentsSupported IS NULL OR departmentsSupported = '')
              AND (accessRequestProcess IS NULL OR accessRequestProcess = '')
              AND (trainingDocumentationUrl IS NULL OR trainingDocumentationUrl = '')
            ORDER BY name
        `);

        lists.systemsWithoutRoles = await safeQuery("systemsWithoutRoles", `
            SELECT a.id, a.name, a.status
            FROM cmdb.Applications a
            WHERE NOT EXISTS (SELECT 1 FROM cmdb.SystemRoleUsage WHERE applicationId = a.id)
            ORDER BY a.name
        `);

        lists.systemsWithoutIntegrations = await safeQuery("systemsWithoutIntegrations", `
            SELECT a.id, a.name, a.status
            FROM cmdb.Applications a
            WHERE NOT EXISTS (SELECT 1 FROM cmdb.ApplicationIntegrations WHERE sourceApplicationId = a.id OR targetApplicationId = a.id)
            ORDER BY a.name
        `);

        lists.possibleTestIntegrations = await safeQuery("possibleTestIntegrations", `
            SELECT
                i.id,
                i.sourceApplicationId,
                i.targetApplicationId,
                ISNULL(sa.name, 'Unknown') AS sourceApplicationName,
                ISNULL(ta.name, 'Unknown') AS targetApplicationName,
                i.notes,
                i.businessPurpose,
                i.dataExchanged
            FROM cmdb.ApplicationIntegrations i
            LEFT JOIN cmdb.Applications sa ON i.sourceApplicationId = sa.id
            LEFT JOIN cmdb.Applications ta ON i.targetApplicationId = ta.id
            WHERE (i.notes LIKE '%test%' OR i.businessPurpose LIKE '%test%' OR i.dataExchanged LIKE '%test%')
               OR (i.notes LIKE '%delete me%' OR i.businessPurpose LIKE '%delete me%' OR i.dataExchanged LIKE '%delete me%')
               OR (i.notes LIKE '%sample%' OR i.businessPurpose LIKE '%sample%' OR i.dataExchanged LIKE '%sample%')
               OR (i.notes LIKE '%dummy%' OR i.businessPurpose LIKE '%dummy%' OR i.dataExchanged LIKE '%dummy%')
            ORDER BY ISNULL(sa.name, ''), ISNULL(ta.name, '')
        `);

        lists.mostUsedSystemsByRoleCount = await safeQuery("mostUsedSystemsByRoleCount", `
            SELECT a.id, a.name, COUNT(sru.id) AS roleCount
            FROM cmdb.Applications a
            INNER JOIN cmdb.SystemRoleUsage sru ON a.id = sru.applicationId
            GROUP BY a.id, a.name
            ORDER BY COUNT(sru.id) DESC
        `);

        lists.mostConnectedSystems = await safeQuery("mostConnectedSystems", `
            SELECT a.id, a.name, COUNT(DISTINCT ai.id) AS connectionCount
            FROM cmdb.Applications a
            LEFT JOIN cmdb.ApplicationIntegrations ai ON a.id = ai.sourceApplicationId OR a.id = ai.targetApplicationId
            GROUP BY a.id, a.name
            ORDER BY COUNT(DISTINCT ai.id) DESC
        `);

        console.log("All queries complete. Sending response.");

        return res.json({ metrics, lists });
    } catch (err) {
        console.error("GET /api/dashboard/data-quality UNEXPECTED ERROR:", err?.message || err);
        if (err?.stack) console.error(err.stack);
        return res.status(500).json({
            error: "Failed to fetch data quality metrics",
            details: err?.message || "Unknown error",
        });
    }
});

export default router;

import { Router } from "express";
import { query } from "../db.js";
import { forbidden } from "../auth/applicationPermissions.js";

function isPlatformAdmin(user) {
    return user?.globalRole === "PlatformAdmin";
}

const router = Router();

router.get("/", async (_req, res, next) => {
    try {
        const rows = await query(`
            SELECT id, processName, processCategory, description, processOwner, businessRisk, manualEffort, automationPotential, isActive, createdAt, updatedAt
            FROM cmdb.BusinessProcesses
            WHERE isActive = 1
            ORDER BY processName
        `);
        res.json(rows);
    } catch (err) {
        console.error("GET /api/business-processes failed:", err.message);
        next(err);
    }
});

router.get("/by-application/:applicationId", async (req, res, next) => {
    try {
        const rows = await query(`
            SELECT DISTINCT bp.id, bp.processName, bp.processCategory, bp.description
            FROM cmdb.BusinessProcesses bp
            INNER JOIN cmdb.BusinessProcessSystems bps ON bp.id = bps.businessProcessId
            WHERE bp.isActive = 1 AND bps.applicationId = @applicationId
            ORDER BY bp.processName
        `, { applicationId: req.params.applicationId });
        res.json(rows);
    } catch (err) {
        console.error("GET /api/business-processes/by-application/:applicationId failed:", err.message);
        next(err);
    }
});

router.get("/:id", async (req, res, next) => {
    try {
        const processes = await query(`
            SELECT id, processName, processCategory, description, processOwner, businessRisk, manualEffort, automationPotential, isActive, createdAt, updatedAt
            FROM cmdb.BusinessProcesses
            WHERE id = @id
        `, { id: req.params.id });

        if (processes.length === 0) return res.status(404).json({ error: "Process not found" });

        const process = processes[0];

        const steps = await query(`
            SELECT
                id AS id,
                businessProcessId AS businessProcessId,
                stepName AS stepName,
                stepDescription AS stepDescription,
                businessPurpose AS businessPurpose,
                keyActivities AS keyActivities,
                manualActivities AS manualActivities,
                automationOpportunities AS automationOpportunities,
                primaryActors AS primaryActors,
                inputs AS inputs,
                outputs AS outputs,
                riskNotes AS riskNotes,
                sequenceOrder AS sequenceOrder,
                createdAt AS createdAt,
                updatedAt AS updatedAt
            FROM cmdb.BusinessProcessSteps
            WHERE businessProcessId = @id
            ORDER BY sequenceOrder
        `, { id: req.params.id });

        const systems = await query(`
            SELECT
                bps.id AS mappingId,
                bps.businessProcessId,
                bps.businessProcessStepId,
                bps.applicationId,
                bps.sequenceOrder,
                bps.processRole,
                bps.notes,
                a.name AS applicationName,
                a.systemCategory,
                a.businessCriticality,
                a.status
            FROM cmdb.BusinessProcessSystems bps
            INNER JOIN cmdb.Applications a ON bps.applicationId = a.id
            WHERE bps.businessProcessId = @id
            ORDER BY bps.sequenceOrder, a.name
        `, { id: req.params.id });

        const stepIntegrations = await query(`
            SELECT DISTINCT
                i.id AS integrationId,
                i.sourceApplicationId,
                src.name AS sourceApplicationName,
                i.targetApplicationId,
                tgt.name AS targetApplicationName,
                i.integrationType,
                i.method,
                i.frequency,
                i.status,
                i.businessPurpose,
                i.dataExchanged,
                i.notes,
                bps.businessProcessStepId AS stepId
            FROM cmdb.ApplicationIntegrations i
            INNER JOIN cmdb.BusinessProcessSystems bps
                ON (i.sourceApplicationId = bps.applicationId OR i.targetApplicationId = bps.applicationId)
                AND bps.businessProcessId = @id
            LEFT JOIN cmdb.Applications src ON i.sourceApplicationId = src.id
            LEFT JOIN cmdb.Applications tgt ON i.targetApplicationId = tgt.id
            WHERE bps.businessProcessStepId IS NOT NULL
        `, { id: req.params.id });

        const stepsWithSystems = steps.map(step => {
            const rel = stepIntegrations
                .filter(si => si.stepId === step.id)
                .map(({ stepId, ...integration }) => ({ ...integration }));
            return {
                ...step,
                systems: systems.filter(s => s.businessProcessStepId === step.id),
                relatedIntegrations: rel,
            };
        });

        const unassigned = systems.filter(s => !s.businessProcessStepId);

        res.json({ ...process, steps: stepsWithSystems, unassignedSystems: unassigned });
    } catch (err) {
        console.error("GET /api/business-processes/:id failed —", err.message);
        if (err.query) console.error("  SQL:", err.query);
        if (err.parameters) console.error("  Params:", JSON.stringify(err.parameters));
        console.error(err.stack);
        next(err);
    }
});

router.post("/", async (req, res, next) => {
    if (!isPlatformAdmin(req.user)) return forbidden(res);

    try {
        const { processName, processCategory, description, processOwner, businessRisk, manualEffort, automationPotential } = req.body;
        if (!processName || !processName.trim()) {
            return res.status(400).json({ error: "processName is required" });
        }

        const result = await query(`
            INSERT INTO cmdb.BusinessProcesses (processName, processCategory, description, processOwner, businessRisk, manualEffort, automationPotential, isActive, createdAt, updatedAt)
            OUTPUT INSERTED.id
            VALUES (@processName, @processCategory, @description, @processOwner, @businessRisk, @manualEffort, @automationPotential, 1, GETDATE(), GETDATE())
        `, {
            processName: processName.trim(),
            processCategory: processCategory?.trim() || null,
            description: description?.trim() || null,
            processOwner: processOwner?.trim() || null,
            businessRisk: businessRisk?.trim() || null,
            manualEffort: manualEffort?.trim() || null,
            automationPotential: automationPotential?.trim() || null,
        });

        const newId = result[0].id;

        const rows = await query(`
            SELECT id, processName, processCategory, description, processOwner, businessRisk, manualEffort, automationPotential, isActive, createdAt, updatedAt
            FROM cmdb.BusinessProcesses
            WHERE id = @id
        `, { id: newId });

        res.status(201).json(rows[0]);
    } catch (err) {
        console.error("POST /api/business-processes failed:", err.message);
        next(err);
    }
});

router.put("/:id", async (req, res, next) => {
    if (!isPlatformAdmin(req.user)) return forbidden(res);

    try {
        const { processName, processCategory, description, processOwner, businessRisk, manualEffort, automationPotential } = req.body;

        await query(`
            UPDATE cmdb.BusinessProcesses
            SET processName = @processName,
                processCategory = @processCategory,
                description = @description,
                processOwner = @processOwner,
                businessRisk = @businessRisk,
                manualEffort = @manualEffort,
                automationPotential = @automationPotential,
                updatedAt = GETDATE()
            WHERE id = @id
        `, {
            id: req.params.id,
            processName: processName?.trim() || "",
            processCategory: processCategory?.trim() || null,
            description: description?.trim() || null,
            processOwner: processOwner?.trim() || null,
            businessRisk: businessRisk?.trim() || null,
            manualEffort: manualEffort?.trim() || null,
            automationPotential: automationPotential?.trim() || null,
        });

        const rows = await query(`
            SELECT id, processName, processCategory, description, processOwner, businessRisk, manualEffort, automationPotential, isActive, createdAt, updatedAt
            FROM cmdb.BusinessProcesses
            WHERE id = @id
        `, { id: req.params.id });

        if (rows.length === 0) return res.status(404).json({ error: "Process not found" });
        res.json(rows[0]);
    } catch (err) {
        console.error("PUT /api/business-processes/:id failed:", err.message);
        next(err);
    }
});

router.delete("/:id", async (req, res, next) => {
    if (!isPlatformAdmin(req.user)) return forbidden(res);

    try {
        await query(`
            UPDATE cmdb.BusinessProcesses
            SET isActive = 0, updatedAt = GETDATE()
            WHERE id = @id
        `, { id: req.params.id });

        res.json({ ok: true });
    } catch (err) {
        console.error("DELETE /api/business-processes/:id failed:", err.message);
        next(err);
    }
});

router.post("/:id/systems", async (req, res, next) => {
    if (!isPlatformAdmin(req.user)) return forbidden(res);

    try {
        const { applicationId, sequenceOrder, processRole, notes } = req.body;
        if (!applicationId) {
            return res.status(400).json({ error: "applicationId is required" });
        }

        const result = await query(`
            INSERT INTO cmdb.BusinessProcessSystems (businessProcessId, applicationId, sequenceOrder, processRole, notes, createdAt, updatedAt)
            OUTPUT INSERTED.id
            VALUES (@businessProcessId, @applicationId, @sequenceOrder, @processRole, @notes, GETDATE(), GETDATE())
        `, {
            businessProcessId: req.params.id,
            applicationId,
            sequenceOrder: sequenceOrder != null ? sequenceOrder : 0,
            processRole: processRole?.trim() || null,
            notes: notes?.trim() || null,
        });

        const newId = result[0].id;

        const rows = await query(`
            SELECT
                bps.id AS mappingId,
                bps.businessProcessId,
                bps.applicationId,
                bps.sequenceOrder,
                bps.processRole,
                bps.notes,
                a.name AS applicationName,
                a.systemCategory,
                a.businessCriticality,
                a.status AS applicationStatus
            FROM cmdb.BusinessProcessSystems bps
            INNER JOIN cmdb.Applications a ON bps.applicationId = a.id
            WHERE bps.id = @id
        `, { id: newId });

        res.status(201).json(rows[0]);
    } catch (err) {
        console.error("POST /api/business-processes/:id/systems failed:", err.message);
        next(err);
    }
});

router.put("/:id/systems/:mappingId", async (req, res, next) => {
    if (!isPlatformAdmin(req.user)) return forbidden(res);

    try {
        const { sequenceOrder, processRole, notes } = req.body;

        await query(`
            UPDATE cmdb.BusinessProcessSystems
            SET sequenceOrder = @sequenceOrder,
                processRole = @processRole,
                notes = @notes,
                updatedAt = GETDATE()
            WHERE id = @mappingId AND businessProcessId = @businessProcessId
        `, {
            businessProcessId: req.params.id,
            mappingId: req.params.mappingId,
            sequenceOrder: sequenceOrder != null ? sequenceOrder : 0,
            processRole: processRole?.trim() || null,
            notes: notes?.trim() || null,
        });

        const rows = await query(`
            SELECT
                bps.id AS mappingId,
                bps.businessProcessId,
                bps.applicationId,
                bps.sequenceOrder,
                bps.processRole,
                bps.notes,
                a.name AS applicationName,
                a.systemCategory,
                a.businessCriticality,
                a.status AS applicationStatus
            FROM cmdb.BusinessProcessSystems bps
            INNER JOIN cmdb.Applications a ON bps.applicationId = a.id
            WHERE bps.id = @id
        `, { id: req.params.mappingId });

        if (rows.length === 0) return res.status(404).json({ error: "Mapping not found" });
        res.json(rows[0]);
    } catch (err) {
        console.error("PUT /api/business-processes/:id/systems/:mappingId failed:", err.message);
        next(err);
    }
});

router.delete("/:id/systems/:mappingId", async (req, res, next) => {
    if (!isPlatformAdmin(req.user)) return forbidden(res);

    try {
        await query(`
            DELETE FROM cmdb.BusinessProcessSystems
            WHERE id = @mappingId AND businessProcessId = @businessProcessId
        `, {
            businessProcessId: req.params.id,
            mappingId: req.params.mappingId,
        });

        res.json({ ok: true });
    } catch (err) {
        console.error("DELETE /api/business-processes/:id/systems/:mappingId failed:", err.message);
        next(err);
    }
});

export default router;

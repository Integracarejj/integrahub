import { Router } from "express";
import { query } from "../db.js";
import { canManageIntegration } from "../auth/integrationPermissions.js";
import { forbidden } from "../auth/applicationPermissions.js";

const router = Router();

router.get("/", async (_req, res) => {
    console.log("GET /api/integrations called");
    try {
        const rows = await query(`
            SELECT
                i.id,
                i.sourceApplicationId,
                i.targetApplicationId,
                i.integrationType,
                i.notes,
                sa.name AS sourceApplicationName,
                ta.name AS targetApplicationName
            FROM cmdb.ApplicationIntegrations i
            INNER JOIN cmdb.Applications sa ON i.sourceApplicationId = sa.id
            INNER JOIN cmdb.Applications ta ON i.targetApplicationId = ta.id
            ORDER BY sa.name, ta.name
        `);

        const integrations = rows.map(row => ({
            id: row.id,
            sourceApplicationId: row.sourceApplicationId,
            targetApplicationId: row.targetApplicationId,
            sourceApplicationName: row.sourceApplicationName,
            targetApplicationName: row.targetApplicationName,
            integrationType: row.integrationType,
            notes: row.notes,
        }));

        res.json(integrations);
    } catch (err) {
        console.error("GET /api/integrations failed:", err);
        res.status(500).json({
            error: "Failed to fetch integrations",
            details: err?.message || "Unknown error",
        });
    }
});

router.post("/", async (req, res) => {
    console.log("POST /api/integrations called");
    const { sourceApplicationId, targetApplicationId, integrationType, notes } = req.body;

    if (!sourceApplicationId) {
        return res.status(400).json({ error: "sourceApplicationId is required" });
    }
    if (!targetApplicationId) {
        return res.status(400).json({ error: "targetApplicationId is required" });
    }

    if (!(await canManageIntegration(req.user, sourceApplicationId))) {
        return forbidden(res);
    }

    try {
        const sourceCheck = await query(
            "SELECT id FROM cmdb.Applications WHERE id = @id",
            { id: sourceApplicationId }
        );
        if (sourceCheck.length === 0) {
            return res.status(400).json({ error: "sourceApplicationId does not exist" });
        }

        const targetCheck = await query(
            "SELECT id FROM cmdb.Applications WHERE id = @id",
            { id: targetApplicationId }
        );
        if (targetCheck.length === 0) {
            return res.status(400).json({ error: "targetApplicationId does not exist" });
        }

        const integrationId = "int-" + Date.now();

        await query(
            `INSERT INTO cmdb.ApplicationIntegrations (id, sourceApplicationId, targetApplicationId, integrationType, notes)
             VALUES (@id, @sourceApplicationId, @targetApplicationId, @integrationType, @notes)`,
            {
                id: integrationId,
                sourceApplicationId,
                targetApplicationId,
                integrationType: integrationType || "",
                notes: notes || "",
            }
        );

        res.status(201).json({ id: integrationId, sourceApplicationId, targetApplicationId, integrationType, notes });
    } catch (err) {
        console.error("POST /api/integrations failed:", err);
        res.status(500).json({
            error: "Failed to create integration",
            details: err?.message || "Unknown error",
        });
    }
});

router.delete("/:id", async (req, res) => {
    console.log(`DELETE /api/integrations/${req.params.id} called`);
    const id = req.params.id.replace(/[^a-zA-Z0-9_-]/g, "");

    const existing = await query(
        "SELECT sourceApplicationId FROM cmdb.ApplicationIntegrations WHERE id = @id",
        { id }
    );

    if (existing.length === 0) {
        return res.status(404).json({ error: "Integration not found" });
    }

    const sourceApplicationId = existing[0].sourceApplicationId;

    if (!(await canManageIntegration(req.user, sourceApplicationId))) {
        return forbidden(res);
    }

    try {
        await query("DELETE FROM cmdb.ApplicationIntegrations WHERE id = @id", { id });

        res.status(200).json({ success: true });
    } catch (err) {
        console.error(`DELETE /api/integrations/${req.params.id} failed:`, err);
        res.status(500).json({
            error: "Failed to delete integration",
            details: err?.message || "Unknown error",
        });
    }
});

router.put("/:id", async (req, res) => {
    console.log(`PUT /api/integrations/${req.params.id} called`);
    const id = req.params.id.replace(/[^a-zA-Z0-9_-]/g, "");
    const { sourceApplicationId, targetApplicationId, integrationType, notes } = req.body;

    const existing = await query(
        "SELECT sourceApplicationId FROM cmdb.ApplicationIntegrations WHERE id = @id",
        { id }
    );

    if (existing.length === 0) {
        return res.status(404).json({ error: "Integration not found" });
    }

    const currentSourceId = existing[0].sourceApplicationId;
    const sourceToCheck = sourceApplicationId || currentSourceId;

    if (!(await canManageIntegration(req.user, sourceToCheck))) {
        return forbidden(res);
    }

    try {
        if (sourceApplicationId) {
            const sourceCheck = await query(
                "SELECT id FROM cmdb.Applications WHERE id = @id",
                { id: sourceApplicationId }
            );
            if (sourceCheck.length === 0) {
                return res.status(400).json({ error: "sourceApplicationId does not exist" });
            }
        }

        if (targetApplicationId) {
            const targetCheck = await query(
                "SELECT id FROM cmdb.Applications WHERE id = @id",
                { id: targetApplicationId }
            );
            if (targetCheck.length === 0) {
                return res.status(400).json({ error: "targetApplicationId does not exist" });
            }
        }

        const updateFields = [];
        const params = { id };

        if (sourceApplicationId) {
            updateFields.push("sourceApplicationId = @sourceApplicationId");
            params.sourceApplicationId = sourceApplicationId;
        }
        if (targetApplicationId) {
            updateFields.push("targetApplicationId = @targetApplicationId");
            params.targetApplicationId = targetApplicationId;
        }
        if (integrationType !== undefined) {
            updateFields.push("integrationType = @integrationType");
            params.integrationType = integrationType || "";
        }
        if (notes !== undefined) {
            updateFields.push("notes = @notes");
            params.notes = notes || "";
        }

        if (updateFields.length === 0) {
            return res.status(400).json({ error: "No fields to update" });
        }

        await query(
            `UPDATE cmdb.ApplicationIntegrations SET ${updateFields.join(", ")} WHERE id = @id`,
            params
        );

        res.status(200).json({ success: true });
    } catch (err) {
        console.error(`PUT /api/integrations/${req.params.id} failed:`, err);
        res.status(500).json({
            error: "Failed to update integration",
            details: err?.message || "Unknown error",
        });
    }
});

export default router;
import { Router } from "express";
import { query } from "../db.js";
import { canCreateApplication, forbidden } from "../auth/applicationPermissions.js";

const router = Router();

router.post("/", async (req, res) => {
    console.log("POST /api/capabilities called");

    if (!(await canCreateApplication(req.user))) {
        return forbidden(res);
    }

    try {
        const { name } = req.body;

        if (!name) {
            return res.status(400).json({ error: "name is required" });
        }

        const normalizedName = name.trim().replace(/\s+/g, " ");

        const duplicateName = await query(
            "SELECT id FROM cmdb.Capabilities WHERE LOWER(name) = LOWER(@name)",
            { name: normalizedName }
        );
        if (duplicateName.length > 0) {
            return res.status(409).json({ error: "A capability with this name already exists" });
        }

        const generatedId = "cap-" + normalizedName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

        await query(
            "INSERT INTO cmdb.Capabilities (id, name) VALUES (@id, @name)",
            { id: generatedId, name: normalizedName }
        );

        res.status(201).json({ id: generatedId, name: normalizedName });
    } catch (err) {
        console.error("POST /api/capabilities failed:", err);
        res.status(500).json({
            error: "Failed to create capability",
            details: err?.message || "Unknown error",
        });
    }
});

router.get("/", async (_req, res) => {
    console.log("GET /api/capabilities called");
    try {
        const rows = await query(`
            SELECT id, name
            FROM cmdb.Capabilities
            ORDER BY name
        `);

        res.json(rows);
    } catch (err) {
        console.error("GET /api/capabilities failed:", err);
        res.status(500).json({
            error: "Failed to fetch capabilities",
            details: err?.message || "Unknown error",
        });
    }
});

router.get("/:id", async (req, res) => {
    console.log(`GET /api/capabilities/${req.params.id} called`);
    try {
        const id = req.params.id.replace(/[^a-zA-Z0-9_-]/g, "");

        const capabilityRows = await query(`
            SELECT id, name
            FROM cmdb.Capabilities
            WHERE id = @id
        `, { id });

        if (capabilityRows.length === 0) {
            return res.status(404).json({ error: "Capability not found" });
        }

        const applicationRows = await query(`
            SELECT
                a.id,
                a.name,
                a.status,
                a.businessOwner
            FROM cmdb.Applications a
            WHERE a.capabilityId = @id
            ORDER BY a.name
        `, { id });

        const applications = applicationRows.map(row => ({
            id: row.id,
            name: row.name,
            status: row.status,
            businessOwner: row.businessOwner,
        }));

        const capability = {
            ...capabilityRows[0],
            applications,
        };

        res.json(capability);
    } catch (err) {
        console.error(`GET /api/capabilities/${req.params.id} failed:`, err);
        res.status(500).json({
            error: "Failed to fetch capability",
            details: err?.message || "Unknown error",
        });
    }
});

router.put("/:id", async (req, res) => {
    console.log(`PUT /api/capabilities/${req.params.id} called`);

    if (!(await canCreateApplication(req.user))) {
        return forbidden(res);
    }

    try {
        const { name } = req.body;
        const id = req.params.id.replace(/[^a-zA-Z0-9_-]/g, "");

        if (!name) {
            return res.status(400).json({ error: "name is required" });
        }

        const normalizedName = name.trim().replace(/\s+/g, " ");

        const existing = await query(
            "SELECT id FROM cmdb.Capabilities WHERE id = @id",
            { id }
        );
        if (existing.length === 0) {
            return res.status(404).json({ error: "Capability not found" });
        }

        const duplicateName = await query(
            "SELECT id FROM cmdb.Capabilities WHERE LOWER(name) = LOWER(@name) AND id != @id",
            { name: normalizedName, id }
        );
        if (duplicateName.length > 0) {
            return res.status(409).json({ error: "A capability with this name already exists" });
        }

        await query(
            "UPDATE cmdb.Capabilities SET name = @name WHERE id = @id",
            { id, name: normalizedName }
        );

        res.status(200).json({ id, name: normalizedName });
    } catch (err) {
        console.error(`PUT /api/capabilities/${req.params.id} failed:`, err);
        res.status(500).json({
            error: "Failed to update capability",
            details: err?.message || "Unknown error",
        });
    }
});

router.delete("/:id", async (req, res) => {
    console.log(`DELETE /api/capabilities/${req.params.id} called`);

    if (!(await canCreateApplication(req.user))) {
        return forbidden(res);
    }

    try {
        const id = req.params.id.replace(/[^a-zA-Z0-9_-]/g, "");

        const existing = await query(
            "SELECT id FROM cmdb.Capabilities WHERE id = @id",
            { id }
        );
        if (existing.length === 0) {
            return res.status(404).json({ error: "Capability not found" });
        }

        const applicationCheck = await query(
            "SELECT id FROM cmdb.Applications WHERE capabilityId = @id",
            { id }
        );
        if (applicationCheck.length > 0) {
            return res.status(409).json({ error: "Cannot delete capability: it is referenced by one or more applications" });
        }

        await query(
            "DELETE FROM cmdb.Capabilities WHERE id = @id",
            { id }
        );

        res.status(204).send();
    } catch (err) {
        console.error(`DELETE /api/capabilities/${req.params.id} failed:`, err);
        res.status(500).json({
            error: "Failed to delete capability",
            details: err?.message || "Unknown error",
        });
    }
});

export default router;

import { Router } from "express";
import { query } from "../db.js";
import { forbidden } from "../auth/applicationPermissions.js";

const router = Router();

router.get("/", async (_req, res, next) => {
    try {
        const rows = await query(`
            SELECT id, roleCode, roleName, roleGroup, description, isActive
            FROM cmdb.RoleDefinitions
            WHERE isActive = 1
            ORDER BY roleGroup, roleName
        `);
        res.json(rows);
    } catch (err) {
        console.error("GET /api/roles failed:", err);
        next(err);
    }
});

router.get("/:code", async (req, res, next) => {
    try {
        const rows = await query(
            `SELECT id, roleCode, roleName, roleGroup, description, isActive
             FROM cmdb.RoleDefinitions
             WHERE roleCode = @code AND isActive = 1`,
            { code: req.params.code }
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: "Role not found" });
        }
        res.json(rows[0]);
    } catch (err) {
        console.error("GET /api/roles/:code failed:", err);
        next(err);
    }
});

export default router;

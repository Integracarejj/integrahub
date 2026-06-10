import { Router } from "express";
import { query } from "../db.js";

const router = Router();

router.get("/", async (_req, res) => {
    try {
        const rows = await query(
            "SELECT id, name, sortOrder FROM cmdb.Departments ORDER BY sortOrder, name"
        );
        res.json(rows);
    } catch (err) {
        console.error("GET /api/departments failed:", err);
        res.status(500).json({ error: "Failed to fetch departments" });
    }
});

export default router;

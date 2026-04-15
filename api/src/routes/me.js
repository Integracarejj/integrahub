import { Router } from "express";
import { query } from "../db.js";

const router = Router();

router.get("/permissions", async (req, res) => {
    console.log("GET /api/me/permissions called");

    if (!req.user) {
        return res.json({
            user: null,
            permissions: {
                globalRole: "Viewer",
                assignments: [],
            },
        });
    }

    try {
        const assignmentRows = await query(
            `SELECT ara.applicationId, ara.role 
             FROM cmdb.ApplicationRoleAssignments ara 
             WHERE ara.userId = @userId`,
            { userId: req.user.id }
        );

        const assignments = assignmentRows.map(row => ({
            applicationId: row.applicationId,
            role: row.role,
        }));

        return res.json({
            user: {
                id: req.user.id,
                entraObjectId: req.user.entraObjectId,
                email: req.user.email,
                name: req.user.name,
                globalRole: req.user.globalRole,
            },
            permissions: {
                globalRole: req.user.globalRole,
                assignments,
            },
        });
    } catch (err) {
        console.error("GET /api/me/permissions failed:", err);
        return res.status(500).json({
            error: "Failed to fetch permissions",
            details: err?.message || "Unknown error",
        });
    }
});

export default router;

import { Router } from "express";
import { query } from "../db.js";
import { forbidden } from "../auth/applicationPermissions.js";

function isPlatformAdmin(user) {
    return user?.globalRole === "PlatformAdmin";
}

const VALID_USAGE_TYPES = ["Primary", "Secondary", "Reporting / Visibility", "Administrative", "Occasional"];

const router = Router();

router.get("/by-role/:roleCode", async (req, res, next) => {
    try {
        const rows = await query(`
            SELECT
                sru.id,
                sru.applicationId,
                sru.roleDefinitionId,
                sru.usageType,
                sru.usagePurpose,
                sru.isPrimary,
                sru.notes,
                sru.createdAt,
                sru.updatedAt,
                a.name AS applicationName,
                a.type AS applicationType,
                a.systemCategory,
                a.architectureType,
                a.status AS applicationStatus,
                rd.roleCode,
                rd.roleName,
                rd.roleGroup
            FROM cmdb.SystemRoleUsage sru
            INNER JOIN cmdb.RoleDefinitions rd ON sru.roleDefinitionId = rd.id
            INNER JOIN cmdb.Applications a ON sru.applicationId = a.id
            WHERE rd.roleCode = @roleCode
            ORDER BY
                CASE sru.usageType
                    WHEN 'Primary' THEN 1
                    WHEN 'Secondary' THEN 2
                    WHEN 'Reporting / Visibility' THEN 3
                    WHEN 'Administrative' THEN 4
                    WHEN 'Occasional' THEN 5
                    ELSE 6
                END,
                a.name
        `, { roleCode: req.params.roleCode });

        res.json(rows);
    } catch (err) {
        console.error("GET /api/role-usage/by-role/:roleCode failed:", err.message);
        next(err);
    }
});

router.post("/", async (req, res, next) => {
    if (!isPlatformAdmin(req.user)) {
        return forbidden(res);
    }

    const { applicationId, roleDefinitionId, roleId, roleCode, usageType, usagePurpose, isPrimary, notes } = req.body;

    if (!applicationId) {
        return res.status(400).json({ error: "applicationId is required" });
    }

    if (!usageType || !VALID_USAGE_TYPES.includes(usageType)) {
        return res.status(400).json({ error: `usageType must be one of: ${VALID_USAGE_TYPES.join(", ")}` });
    }

    const resolvedRoleId = roleDefinitionId || roleId || null;
    if (!resolvedRoleId && !roleCode) {
        return res.status(400).json({ error: "roleDefinitionId, roleId, or roleCode is required" });
    }

    try {
        const appCheck = await query("SELECT id FROM cmdb.Applications WHERE id = @id", { id: applicationId });
        if (appCheck.length === 0) {
            return res.status(400).json({ error: "applicationId does not exist" });
        }

        let finalRoleDefId;

        if (resolvedRoleId) {
            const numId = Number(resolvedRoleId);
            if (!Number.isInteger(numId) || numId < 1) {
                return res.status(400).json({ error: "roleDefinitionId must be a positive integer" });
            }
            const roleCheck = await query(
                "SELECT id FROM cmdb.RoleDefinitions WHERE id = @id",
                { id: numId }
            );
            if (roleCheck.length === 0) {
                return res.status(400).json({ error: "roleDefinitionId does not exist" });
            }
            finalRoleDefId = numId;
        } else if (roleCode) {
            const roleRow = await query(
                "SELECT id FROM cmdb.RoleDefinitions WHERE roleCode = @code",
                { code: roleCode }
            );
            if (roleRow.length === 0) {
                return res.status(400).json({ error: "roleCode does not match any role" });
            }
            finalRoleDefId = roleRow[0].id;
        }

        const insertResult = await query(`
            INSERT INTO cmdb.SystemRoleUsage
                (applicationId, roleDefinitionId, usageType, usagePurpose, isPrimary, notes, createdAt, updatedAt)
            OUTPUT INSERTED.id
            VALUES
                (@applicationId, @roleDefinitionId, @usageType, @usagePurpose, @isPrimary, @notes, SYSUTCDATETIME(), SYSUTCDATETIME())
        `, {
            applicationId: String(applicationId),
            roleDefinitionId: Number(finalRoleDefId),
            usageType: String(usageType),
            usagePurpose: usagePurpose || "",
            isPrimary: isPrimary ? 1 : 0,
            notes: notes || "",
        });

        const newId = insertResult[0]?.id;

        if (!newId) {
            console.error("POST /api/role-usage: OUTPUT INSERTED.id returned no id, insertResult=", JSON.stringify(insertResult));
            return res.status(500).json({ error: "Insert succeeded but could not retrieve new id" });
        }

        const newRecord = await query(`
            SELECT
                sru.id,
                sru.applicationId,
                sru.roleDefinitionId,
                sru.usageType,
                sru.usagePurpose,
                sru.isPrimary,
                sru.notes,
                sru.createdAt,
                sru.updatedAt,
                a.name AS applicationName,
                a.type AS applicationType,
                a.systemCategory,
                a.architectureType,
                a.status AS applicationStatus,
                rd.roleCode,
                rd.roleName,
                rd.roleGroup
            FROM cmdb.SystemRoleUsage sru
            INNER JOIN cmdb.RoleDefinitions rd ON sru.roleDefinitionId = rd.id
            INNER JOIN cmdb.Applications a ON sru.applicationId = a.id
            WHERE sru.id = @id
        `, { id: newId });

        if (newRecord.length === 0) {
            console.error("POST /api/role-usage: created record not found for id", newId);
            return res.status(500).json({ error: "Created record not found" });
        }

        res.status(201).json(newRecord[0]);
    } catch (err) {
        console.error("POST /api/role-usage failed:", err.message);
        console.error("POST /api/role-usage body:", JSON.stringify(req.body));
        res.status(500).json({
            error: "Failed to create role usage",
            details: err.message || "Unknown error",
        });
    }
});

router.put("/:id", async (req, res, next) => {
    if (!isPlatformAdmin(req.user)) {
        return forbidden(res);
    }

    const recordId = Number(req.params.id);

    if (!Number.isInteger(recordId) || recordId < 1) {
        return res.status(400).json({ error: "Invalid id" });
    }

    try {
        const existing = await query(
            "SELECT id FROM cmdb.SystemRoleUsage WHERE id = @id",
            { id: recordId }
        );
        if (existing.length === 0) {
            return res.status(404).json({ error: "Role usage not found" });
        }

        const { applicationId, roleDefinitionId, roleId, usageType, usagePurpose, isPrimary, notes } = req.body;

        if (usageType && !VALID_USAGE_TYPES.includes(usageType)) {
            return res.status(400).json({ error: `usageType must be one of: ${VALID_USAGE_TYPES.join(", ")}` });
        }

        const updateFields = [];
        const params = { id: recordId };

        if (applicationId !== undefined) {
            updateFields.push("applicationId = @applicationId");
            params.applicationId = String(applicationId);
        }

        const resolvedUpdateRoleId = roleDefinitionId || roleId;
        if (resolvedUpdateRoleId !== undefined) {
            const numId = Number(resolvedUpdateRoleId);
            if (!Number.isInteger(numId) || numId < 1) {
                return res.status(400).json({ error: "roleDefinitionId must be a positive integer" });
            }
            updateFields.push("roleDefinitionId = @roleDefinitionId");
            params.roleDefinitionId = numId;
        }

        if (usageType !== undefined) {
            updateFields.push("usageType = @usageType");
            params.usageType = String(usageType);
        }
        if (usagePurpose !== undefined) {
            updateFields.push("usagePurpose = @usagePurpose");
            params.usagePurpose = usagePurpose || "";
        }
        if (isPrimary !== undefined) {
            updateFields.push("isPrimary = @isPrimary");
            params.isPrimary = isPrimary ? 1 : 0;
        }
        if (notes !== undefined) {
            updateFields.push("notes = @notes");
            params.notes = notes || "";
        }

        if (updateFields.length === 0) {
            return res.status(400).json({ error: "No fields to update" });
        }

        updateFields.push("updatedAt = GETDATE()");

        await query(
            `UPDATE cmdb.SystemRoleUsage SET ${updateFields.join(", ")} WHERE id = @id`,
            params
        );

        const updated = await query(`
            SELECT
                sru.id,
                sru.applicationId,
                sru.roleDefinitionId,
                sru.usageType,
                sru.usagePurpose,
                sru.isPrimary,
                sru.notes,
                sru.createdAt,
                sru.updatedAt,
                a.name AS applicationName,
                a.type AS applicationType,
                a.systemCategory,
                a.architectureType,
                a.status AS applicationStatus,
                rd.roleCode,
                rd.roleName,
                rd.roleGroup
            FROM cmdb.SystemRoleUsage sru
            INNER JOIN cmdb.RoleDefinitions rd ON sru.roleDefinitionId = rd.id
            INNER JOIN cmdb.Applications a ON sru.applicationId = a.id
            WHERE sru.id = @id
        `, { id: recordId });

        res.json(updated[0] || { success: true });
    } catch (err) {
        console.error("PUT /api/role-usage/:id failed:", err.message);
        console.error("PUT /api/role-usage params:", { id: req.params.id, body: JSON.stringify(req.body) });
        res.status(500).json({
            error: "Failed to update role usage",
            details: err.message || "Unknown error",
        });
    }
});

router.delete("/:id", async (req, res, next) => {
    if (!isPlatformAdmin(req.user)) {
        return forbidden(res);
    }

    const recordId = Number(req.params.id);

    if (!Number.isInteger(recordId) || recordId < 1) {
        return res.status(400).json({ error: "Invalid id" });
    }

    try {
        const existing = await query(
            "SELECT id FROM cmdb.SystemRoleUsage WHERE id = @id",
            { id: recordId }
        );
        if (existing.length === 0) {
            return res.status(404).json({ error: "Role usage not found" });
        }

        await query("DELETE FROM cmdb.SystemRoleUsage WHERE id = @id", { id: recordId });
        res.json({ success: true });
    } catch (err) {
        console.error("DELETE /api/role-usage/:id failed:", err.message);
        res.status(500).json({
            error: "Failed to delete role usage",
            details: err.message || "Unknown error",
        });
    }
});

export default router;

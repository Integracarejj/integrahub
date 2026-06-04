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
        console.error("GET /api/role-usage/by-role/:roleCode failed:", err);
        next(err);
    }
});

router.post("/", async (req, res, next) => {
    if (!isPlatformAdmin(req.user)) {
        return forbidden(res);
    }

    const { applicationId, roleDefinitionId, roleCode, usageType, usagePurpose, isPrimary, notes } = req.body;

    if (!applicationId) return res.status(400).json({ error: "applicationId is required" });
    if (!usageType || !VALID_USAGE_TYPES.includes(usageType)) {
        return res.status(400).json({ error: `usageType must be one of: ${VALID_USAGE_TYPES.join(", ")}` });
    }

    if (!roleDefinitionId && !roleCode) {
        return res.status(400).json({ error: "roleDefinitionId or roleCode is required" });
    }

    try {
        const appCheck = await query("SELECT id FROM cmdb.Applications WHERE id = @id", { id: applicationId });
        if (appCheck.length === 0) {
            return res.status(400).json({ error: "applicationId does not exist" });
        }

        let resolvedRoleId = roleDefinitionId;

        if (!resolvedRoleId && roleCode) {
            const roleRow = await query(
                "SELECT id FROM cmdb.RoleDefinitions WHERE roleCode = @code",
                { code: roleCode }
            );
            if (roleRow.length === 0) {
                return res.status(400).json({ error: "roleCode does not match any role" });
            }
            resolvedRoleId = roleRow[0].id;
        }

        const roleCheck = await query("SELECT id FROM cmdb.RoleDefinitions WHERE id = @id", { id: resolvedRoleId });
        if (roleCheck.length === 0) {
            return res.status(400).json({ error: "roleDefinitionId does not exist" });
        }

        const insertResult = await query(`
            INSERT INTO cmdb.SystemRoleUsage (applicationId, roleDefinitionId, usageType, usagePurpose, isPrimary, notes)
            OUTPUT INSERTED.id
            VALUES (@applicationId, @roleDefinitionId, @usageType, @usagePurpose, @isPrimary, @notes)
        `, {
            applicationId,
            roleDefinitionId: Number(resolvedRoleId),
            usageType,
            usagePurpose: usagePurpose || null,
            isPrimary: isPrimary ? 1 : 0,
            notes: notes || null,
        });

        const newId = insertResult[0]?.id;

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

        res.status(201).json(newRecord[0] || { id: newId });
    } catch (err) {
        console.error("POST /api/role-usage failed:", err);
        console.error("POST /api/role-usage body:", JSON.stringify(req.body));
        next(err);
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
        const existing = await query("SELECT id FROM cmdb.SystemRoleUsage WHERE id = @id", { id: recordId });
        if (existing.length === 0) {
            return res.status(404).json({ error: "Role usage not found" });
        }

        const { applicationId, roleDefinitionId, usageType, usagePurpose, isPrimary, notes } = req.body;

        if (usageType && !VALID_USAGE_TYPES.includes(usageType)) {
            return res.status(400).json({ error: `usageType must be one of: ${VALID_USAGE_TYPES.join(", ")}` });
        }

        const updateFields = [];
        const params = { id: recordId };

        if (applicationId !== undefined) {
            updateFields.push("applicationId = @applicationId");
            params.applicationId = applicationId;
        }
        if (roleDefinitionId !== undefined) {
            updateFields.push("roleDefinitionId = @roleDefinitionId");
            params.roleDefinitionId = Number(roleDefinitionId);
        }
        if (usageType !== undefined) {
            updateFields.push("usageType = @usageType");
            params.usageType = usageType;
        }
        if (usagePurpose !== undefined) {
            updateFields.push("usagePurpose = @usagePurpose");
            params.usagePurpose = usagePurpose || null;
        }
        if (isPrimary !== undefined) {
            updateFields.push("isPrimary = @isPrimary");
            params.isPrimary = isPrimary ? 1 : 0;
        }
        if (notes !== undefined) {
            updateFields.push("notes = @notes");
            params.notes = notes || null;
        }

        if (updateFields.length === 0) {
            return res.status(400).json({ error: "No fields to update" });
        }

        updateFields.push("updatedAt = GETDATE()");

        await query(
            `UPDATE cmdb.SystemRoleUsage SET ${updateFields.join(", ")} WHERE id = @id`,
            params
        );

        res.json({ success: true });
    } catch (err) {
        console.error("PUT /api/role-usage/:id failed:", err);
        console.error("PUT /api/role-usage params:", { id: req.params.id, body: JSON.stringify(req.body) });
        next(err);
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
        const existing = await query("SELECT id FROM cmdb.SystemRoleUsage WHERE id = @id", { id: recordId });
        if (existing.length === 0) {
            return res.status(404).json({ error: "Role usage not found" });
        }

        await query("DELETE FROM cmdb.SystemRoleUsage WHERE id = @id", { id: recordId });
        res.json({ success: true });
    } catch (err) {
        console.error("DELETE /api/role-usage/:id failed:", err);
        next(err);
    }
});

export default router;

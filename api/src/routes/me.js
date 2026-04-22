import { Router } from "express";
import { query } from "../db.js";

const router = Router();

const DEV_USER_HEADER = "x-dev-user-email";
const AZURE_CLIENT_PRINCIPAL_ID = "x-ms-client-principal-id";
const AZURE_CLIENT_PRINCIPAL_NAME = "x-ms-client-principal-name";
const ENTRA_OBJECT_ID_HEADER = "x-entra-object-id";

function getAuthSource(req) {
    if (req.headers[DEV_USER_HEADER]) return "dev";
    if (req.headers[AZURE_CLIENT_PRINCIPAL_ID] || req.headers[ENTRA_OBJECT_ID_HEADER]) return "azure";
    return "none";
}

function getPrincipalId(req) {
    return req.headers[AZURE_CLIENT_PRINCIPAL_ID] || req.headers[ENTRA_OBJECT_ID_HEADER] || null;
}

function getPrincipalName(req) {
    return req.headers[AZURE_CLIENT_PRINCIPAL_NAME] || null;
}

function getResolvedEmail(req) {
    if (req.user) return req.user.email;
    if (req.headers[DEV_USER_HEADER]) return req.headers[DEV_USER_HEADER];
    if (req.headers[AZURE_CLIENT_PRINCIPAL_NAME]) return req.headers[AZURE_CLIENT_PRINCIPAL_NAME];
    return null;
}

router.get("/", async (req, res) => {
    const authSource = getAuthSource(req);
    const principalId = getPrincipalId(req);
    const principalName = getPrincipalName(req);
    const resolvedEmail = getResolvedEmail(req);

    let userRecord = null;
    if (req.user) {
        const rows = await query(
            "SELECT id, entraObjectId, email, displayName, role FROM cmdb.Users WHERE id = @id",
            { id: req.user.id }
        );
        if (rows[0]) {
            userRecord = {
                id: rows[0].id,
                entraObjectId: rows[0].entraObjectId,
                email: rows[0].email,
                displayName: rows[0].displayName,
                role: rows[0].role,
            };
        }
    }

    return res.json({
        isAuthenticated: !!req.user,
        authSource,
        principalId,
        principalName,
        resolvedEmail,
        userRecord,
    });
});

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
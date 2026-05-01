import { Router } from "express";
import { query } from "../db.js";

const router = Router();

function requirePlatformAdmin(req, res, next) {
    if (!req.user || req.user.globalRole !== "PlatformAdmin") {
        return res.status(403).json({ error: "Access denied. PlatformAdmin required." });
    }
    return next();
}

router.use(requirePlatformAdmin);

router.get("/", async (req, res) => {
    try {
        const rows = await query(`
            SELECT id, entraObjectId, email, displayName, role, isActive, updatedAt
            FROM cmdb.Users
            ORDER BY displayName
        `);

        const users = rows.map(row => ({
            id: row.id,
            entraObjectId: row.entraObjectId,
            email: row.email,
            displayName: row.displayName,
            role: row.role,
            isActive: !!row.isActive,
            updatedAt: row.updatedAt,
        }));

        return res.json(users);
    } catch (err) {
        console.error("GET /api/admin/users failed:", err);
        return res.status(500).json({ error: "Failed to fetch users" });
    }
});

router.post("/", async (req, res) => {
    const { email: rawEmail, displayName, role } = req.body;

    if (!rawEmail) {
        return res.status(400).json({ error: "Email is required" });
    }

    const email = rawEmail.trim().toLowerCase();

    if (!email.includes("@")) {
        return res.status(400).json({ error: "Invalid email format" });
    }

    const allowedDomain = "@integracare.com";
    if (!email.endsWith(allowedDomain)) {
        return res.status(400).json({ error: `Only ${allowedDomain} emails are allowed` });
    }

    const existingRows = await query(
        "SELECT id FROM cmdb.Users WHERE email = @email",
        { email }
    );

    if (existingRows.length > 0) {
        return res.status(400).json({ error: "A user with this email already exists" });
    }

    const validRoles = ["PlatformAdmin", "Editor", "Viewer"];
    const userRole = role && validRoles.includes(role) ? role : "Viewer";

    try {
        const newId = `user-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        const name = displayName?.trim() || email.split("@")[0];

        await query(`
            INSERT INTO cmdb.Users (id, entraObjectId, email, displayName, role, isActive, createdAt)
            VALUES (@id, NULL, @email, @displayName, @role, 1, GETUTCDATE())
        `, {
            id: newId,
            email,
            displayName: name,
            role: userRole,
        });

        return res.status(201).json({
            id: newId,
            email,
            displayName: name,
            role: userRole,
            isActive: true,
        });
    } catch (err) {
        console.error("POST /api/admin/users failed:", err);
        return res.status(500).json({ error: "Failed to create user" });
    }
});

router.put("/:id", async (req, res) => {
    const { id } = req.params;
    const { role, isActive } = req.body;

    const validRoles = ["PlatformAdmin", "Editor", "Viewer"];
    if (role && !validRoles.includes(role)) {
        return res.status(400).json({ error: "Invalid role" });
    }

    try {
        const updates = [];
        const params = { id };

        if (role) {
            updates.push("role = @role");
            params.role = role;
        }

        if (typeof isActive === "boolean") {
            updates.push("isActive = @isActive");
            params.isActive = isActive ? 1 : 0;
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: "No fields to update" });
        }

        updates.push("updatedAt = GETUTCDATE()");

        await query(`
            UPDATE cmdb.Users SET ${updates.join(", ")} WHERE id = @id
        `, params);

        const rows = await query(
            "SELECT id, entraObjectId, email, displayName, role, isActive, updatedAt FROM cmdb.Users WHERE id = @id",
            { id }
        );

        if (!rows[0]) {
            return res.status(404).json({ error: "User not found" });
        }

        return res.json({
            id: rows[0].id,
            entraObjectId: rows[0].entraObjectId,
            email: rows[0].email,
            displayName: rows[0].displayName,
            role: rows[0].role,
            isActive: !!rows[0].isActive,
            updatedAt: rows[0].updatedAt,
        });
    } catch (err) {
        console.error("PUT /api/admin/users/:id failed:", err);
        return res.status(500).json({ error: "Failed to update user" });
    }
});

export function validateGraphConfig() {
    // Resolve tenantId: GRAPH_TENANT_ID first, then AZURE_TENANT_ID
    const graphTenantId = process.env.GRAPH_TENANT_ID;
    const azureTenantId = process.env.AZURE_TENANT_ID;
    const tenantId = graphTenantId || azureTenantId;
    const tenantIdSource = graphTenantId ? "GRAPH_TENANT_ID" : (azureTenantId ? "AZURE_TENANT_ID" : null);

    // Resolve clientId: GRAPH_CLIENT_ID first, then AZURE_CLIENT_ID
    const graphClientId = process.env.GRAPH_CLIENT_ID;
    const azureClientId = process.env.AZURE_CLIENT_ID;
    const clientId = graphClientId || azureClientId;
    const clientIdSource = graphClientId ? "GRAPH_CLIENT_ID" : (azureClientId ? "AZURE_CLIENT_ID" : null);

    // Resolve clientSecret: GRAPH_CLIENT_SECRET first, then AZURE_CLIENT_SECRET
    const graphClientSecret = process.env.GRAPH_CLIENT_SECRET;
    const azureClientSecret = process.env.AZURE_CLIENT_SECRET;
    const clientSecret = graphClientSecret || azureClientSecret;
    const clientSecretSource = graphClientSecret ? "GRAPH_CLIENT_SECRET" : (azureClientSecret ? "AZURE_CLIENT_SECRET" : null);

    // Domain filter
    const domainFilter = process.env.GRAPH_USER_DOMAIN_FILTER || "integracare.com";
    const domainFilterSource = process.env.GRAPH_USER_DOMAIN_FILTER ? "GRAPH_USER_DOMAIN_FILTER" : "default";

    const missingConfigKeys = [];
    if (!tenantId) missingConfigKeys.push("tenantId");
    if (!clientId) missingConfigKeys.push("clientId");
    if (!clientSecret) missingConfigKeys.push("clientSecret");

    const graphConfigPresent = missingConfigKeys.length === 0;

    return {
        graphConfigPresent,
        missingConfigKeys,
        expectedDomainFilter: domainFilter,
        configSource: {
            tenantId: tenantIdSource,
            clientId: clientIdSource,
            clientSecret: clientSecretSource,
            domainFilter: domainFilterSource,
        },
    };
}

router.get("/sync/readiness", (req, res) => {
    const config = validateGraphConfig();

    return res.json({
        graphConfigPresent: config.graphConfigPresent,
        missingConfigKeys: config.missingConfigKeys,
        expectedDomainFilter: config.expectedDomainFilter,
        configSource: config.configSource,
        message: config.graphConfigPresent
            ? "Microsoft Graph sync is ready to configure. Ensure app permissions (User.Read.All or Directory.Read.All) and admin consent are granted."
            : `Missing Graph config: ${config.missingConfigKeys.join(", ")}. Add these to Azure App Service Configuration.`,
    });
});

router.get("/sync/test-graph", async (req, res) => {
    const config = validateGraphConfig();

    if (!config.graphConfigPresent) {
        return res.json({
            tokenSuccess: false,
            graphCallSuccess: false,
            userCountReturned: 0,
            sampleUsers: [],
            error: `Missing config: ${config.missingConfigKeys.join(", ")}`,
        });
    }

    try {
        const tenantId = config.configSource.tenantId === "GRAPH_TENANT_ID"
            ? process.env.GRAPH_TENANT_ID
            : process.env.AZURE_TENANT_ID;
        const clientId = config.configSource.clientId === "GRAPH_CLIENT_ID"
            ? process.env.GRAPH_CLIENT_ID
            : process.env.AZURE_CLIENT_ID;
        const clientSecret = config.configSource.clientSecret === "GRAPH_CLIENT_SECRET"
            ? process.env.GRAPH_CLIENT_SECRET
            : process.env.AZURE_CLIENT_SECRET;

        const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
        const tokenRes = await fetch(tokenUrl, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                grant_type: "client_credentials",
                scope: "https://graph.microsoft.com/.default",
            }),
        });

        if (!tokenRes.ok) {
            const tokenError = await tokenRes.text();
            return res.json({
                tokenSuccess: false,
                graphCallSuccess: false,
                userCountReturned: 0,
                sampleUsers: [],
                error: `Token request failed: ${tokenRes.status}. Check client ID and secret.`,
            });
        }

        const tokenData = await tokenRes.json();
        const accessToken = tokenData.access_token;

        const graphUrl = "https://graph.microsoft.com/v1.0/users?$top=3&$select=id,displayName,mail,userPrincipalName,jobTitle,department,officeLocation,accountEnabled";
        const graphRes = await fetch(graphUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!graphRes.ok) {
            const graphError = await graphRes.text();
            return res.json({
                tokenSuccess: true,
                graphCallSuccess: false,
                userCountReturned: 0,
                sampleUsers: [],
                error: `Graph call failed: ${graphRes.status}. Ensure app permissions (User.Read.All or Directory.Read.All) and admin consent are granted.`,
            });
        }

        const graphData = await graphRes.json();
        const users = (graphData.value || []).slice(0, 3).map((u) => ({
            id: u.id,
            displayName: u.displayName,
            mail: u.mail,
            userPrincipalName: u.userPrincipalName,
            jobTitle: u.jobTitle,
            department: u.department,
            officeLocation: u.officeLocation,
            accountEnabled: u.accountEnabled,
        }));

        return res.json({
            tokenSuccess: true,
            graphCallSuccess: true,
            userCountReturned: users.length,
            sampleUsers: users,
            error: null,
        });
    } catch (err) {
        return res.json({
            tokenSuccess: false,
            graphCallSuccess: false,
            userCountReturned: 0,
            sampleUsers: [],
            error: `Unexpected error: ${err.message}`,
        });
    }
});

export default router;
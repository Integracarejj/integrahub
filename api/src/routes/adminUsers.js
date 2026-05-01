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

    // Excluded emails
    const excludedEmailsRaw = process.env.GRAPH_SYNC_EXCLUDED_EMAILS || "";
    const excludedEmails = excludedEmailsRaw
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.length > 0);
    const excludedEmailsCount = excludedEmails.length;

    const missingConfigKeys = [];
    if (!tenantId) missingConfigKeys.push("tenantId");
    if (!clientId) missingConfigKeys.push("clientId");
    if (!clientSecret) missingConfigKeys.push("clientSecret");

    const graphConfigPresent = missingConfigKeys.length === 0;

    return {
        graphConfigPresent,
        missingConfigKeys,
        expectedDomainFilter: domainFilter,
        excludedEmails,
        excludedEmailsCount,
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
        excludedEmailsConfiguredCount: config.excludedEmailsCount,
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

async function getGraphToken(config) {
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
        throw new Error(`Token request failed: ${tokenRes.status}`);
    }

    const tokenData = await tokenRes.json();
    return tokenData.access_token;
}

async function fetchAllGraphUsers(accessToken, domainFilter, excludedEmails = []) {
    let graphUrl = `https://graph.microsoft.com/v1.0/users?$select=id,displayName,mail,userPrincipalName,jobTitle,department,officeLocation,accountEnabled`;
    let graphUsers = [];
    let pages = 0;

    while (graphUrl && pages < 50) {  // Safety limit
        const graphRes = await fetch(graphUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!graphRes.ok) {
            throw new Error(`Graph call failed: ${graphRes.status}`);
        }

        const graphData = await graphRes.json();
        const users = (graphData.value || []).map((u) => {
            const mail = (u.mail || "").toLowerCase();
            const upn = (u.userPrincipalName || "").toLowerCase();
            const isExt = upn.includes("#ext#");
            const hasDomain = mail.endsWith(`@${domainFilter}`) || upn.endsWith(`@${domainFilter}`);

            return {
                graphId: u.id,
                displayName: u.displayName || "",
                mail: mail || null,
                userPrincipalName: upn,
                jobTitle: u.jobTitle || null,
                department: u.department || null,
                officeLocation: u.officeLocation || null,
                accountEnabled: u.accountEnabled !== false,
                normalizedEmail: mail || upn,
                isExt,
                hasDomain,
            };
        });

        graphUsers = graphUsers.concat(users);
        graphUrl = graphData["@odata.nextLink"] || null;
        pages++;
    }

    return graphUsers;
}

async function getSyncCandidates(config, accessToken) {
    const domainFilter = config.expectedDomainFilter;
    const excludedEmails = config.excludedEmails;

    const graphUsers = await fetchAllGraphUsers(accessToken, domainFilter, excludedEmails);

    const excludedByEmail = graphUsers.filter((u) => {
        return excludedEmails.includes(u.normalizedEmail);
    });

    const graphUsersAfterDomainFilter = graphUsers.filter((u) => {
        return u.hasDomain && !u.isExt;
    }).length;

    const syncCandidates = graphUsers.filter((u) => {
        if (!u.accountEnabled) return false;
        if (u.isExt) return false;
        if (!u.hasDomain) return false;
        if (!u.normalizedEmail) return false;
        if (excludedEmails.includes(u.normalizedEmail)) return false;
        return true;
    });

    return {
        graphUsers,
        excludedByEmail,
        graphUsersAfterDomainFilter,
        syncCandidates,
    };
}

function compareWithCmdb(syncCandidates, existingUsers) {
    const existingByEntraId = {};
    const existingByEmail = {};
    const platformAdminIds = new Set();

    existingUsers.forEach((u) => {
        if (u.entraObjectId) {
            existingByEntraId[u.entraObjectId.toLowerCase()] = u;
        }
        if (u.email) {
            existingByEmail[u.email.toLowerCase()] = u;
        }
        if (u.role === "PlatformAdmin") {
            platformAdminIds.add(u.id);
        }
    });

    const wouldCreate = [];
    const wouldUpdate = [];
    const wouldDeactivate = [];
    const unchanged = [];
    const skippedPlatformAdmins = [];

    const processedEmails = new Set();

    syncCandidates.forEach((gu) => {
        if (processedEmails.has(gu.normalizedEmail)) return;
        processedEmails.add(gu.normalizedEmail);

        let existing = null;
        if (gu.graphId) {
            existing = existingByEntraId[gu.graphId.toLowerCase()];
        }
        if (!existing && gu.normalizedEmail) {
            existing = existingByEmail[gu.normalizedEmail];
        }

        if (!existing) {
            wouldCreate.push({
                displayName: gu.displayName,
                email: gu.normalizedEmail,
                entraObjectId: gu.graphId,
                jobTitle: gu.jobTitle,
                department: gu.department,
                officeLocation: gu.officeLocation,
            });
        } else if (existing.isActive) {
            const changes = {};
            if (existing.displayName !== gu.displayName) changes.displayName = { from: existing.displayName, to: gu.displayName };
            if ((existing.email || "").toLowerCase() !== gu.normalizedEmail) changes.email = { from: existing.email, to: gu.normalizedEmail };
            if ((existing.entraObjectId || "").toLowerCase() !== (gu.graphId || "").toLowerCase()) changes.entraObjectId = { from: existing.entraObjectId, to: gu.graphId };
            if (existing.jobTitle !== gu.jobTitle) changes.jobTitle = { from: existing.jobTitle, to: gu.jobTitle };
            if (existing.department !== gu.department) changes.department = { from: existing.department, to: gu.department };
            if (existing.officeLocation !== gu.officeLocation) changes.officeLocation = { from: existing.officeLocation, to: gu.officeLocation };

            if (Object.keys(changes).length > 0) {
                wouldUpdate.push({
                    id: existing.id,
                    displayName: existing.displayName,
                    changes,
                });
            } else {
                unchanged.push({
                    id: existing.id,
                    displayName: existing.displayName,
                });
            }
        }
    });

    // Find users to deactivate (in cmdb but not in syncCandidates)
    const syncEmails = new Set(syncCandidates.map((u) => u.normalizedEmail));
    const syncEntraIds = new Set(syncCandidates.filter((u) => u.graphId).map((u) => u.graphId.toLowerCase()));

    existingUsers.forEach((eu) => {
        if (!eu.isActive) return; // Already inactive
        if (platformAdminIds.has(eu.id)) {
            skippedPlatformAdmins.push({
                id: eu.id,
                displayName: eu.displayName,
                reason: "PlatformAdmin preserved",
            });
            return;
        }

        const matchByEntra = eu.entraObjectId && syncEntraIds.has(eu.entraObjectId.toLowerCase());
        const matchByEmail = eu.email && syncEmails.has(eu.email.toLowerCase());
        if (!matchByEntra && !matchByEmail) {
            wouldDeactivate.push({
                id: eu.id,
                displayName: eu.displayName,
                reason: "Not found in Graph sync candidates",
            });
        }
    });

    return {
        wouldCreate,
        wouldUpdate,
        wouldDeactivate,
        unchanged,
        skippedPlatformAdmins,
        platformAdminIds,
    };
}

router.get("/sync/dry-run", async (req, res) => {
    const config = validateGraphConfig();

    if (!config.graphConfigPresent) {
        return res.json({
            graphUsersProcessed: 0,
            graphUsersAfterDomainFilter: 0,
            graphUsersAfterExclusions: 0,
            excludedByEmailCount: 0,
            existingCmdbUsers: 0,
            wouldCreateCount: 0,
            wouldUpdateCount: 0,
            wouldDeactivateCount: 0,
            unchangedCount: 0,
            skippedPlatformAdminCount: 0,
            samples: {
                wouldCreate: [],
                wouldUpdate: [],
                wouldDeactivate: [],
                excludedByEmail: [],
                skippedPlatformAdmins: [],
            },
            error: `Missing config: ${config.missingConfigKeys.join(", ")}`,
        });
    }

    try {
        const accessToken = await getGraphToken(config);
        const { graphUsers, excludedByEmail, graphUsersAfterDomainFilter, syncCandidates } = await getSyncCandidates(config, accessToken);

        const existingUsers = await query(`
            SELECT id, entraObjectId, email, displayName, role, isActive, jobTitle, department, officeLocation
            FROM cmdb.Users
        `);

        const comparison = compareWithCmdb(syncCandidates, existingUsers);

        return res.json({
            graphUsersProcessed: graphUsers.length,
            graphUsersAfterDomainFilter,
            graphUsersAfterExclusions: syncCandidates.length,
            excludedByEmailCount: excludedByEmail.length,
            existingCmdbUsers: existingUsers.length,
            wouldCreateCount: comparison.wouldCreate.length,
            wouldUpdateCount: comparison.wouldUpdate.length,
            wouldDeactivateCount: comparison.wouldDeactivate.length,
            unchangedCount: comparison.unchanged.length,
            skippedPlatformAdminCount: comparison.skippedPlatformAdmins.length,
            samples: {
                wouldCreate: comparison.wouldCreate.slice(0, 10),
                wouldUpdate: comparison.wouldUpdate.slice(0, 10),
                wouldDeactivate: comparison.wouldDeactivate.slice(0, 10),
                excludedByEmail: excludedByEmail.slice(0, 10).map((u) => ({
                    displayName: u.displayName,
                    email: u.normalizedEmail,
                })),
                skippedPlatformAdmins: comparison.skippedPlatformAdmins.slice(0, 10),
            },
            error: null,
        });
    } catch (err) {
        return res.json({
            graphUsersProcessed: 0,
            graphUsersAfterDomainFilter: 0,
            graphUsersAfterExclusions: 0,
            excludedByEmailCount: 0,
            existingCmdbUsers: 0,
            wouldCreateCount: 0,
            wouldUpdateCount: 0,
            wouldDeactivateCount: 0,
            unchangedCount: 0,
            skippedPlatformAdminCount: 0,
            samples: {
                wouldCreate: [],
                wouldUpdate: [],
                wouldDeactivate: [],
                excludedByEmail: [],
                skippedPlatformAdmins: [],
            },
            error: `Dry-run failed: ${err.message}`,
        });
    }
});

router.post("/sync/run", async (req, res) => {
    const config = validateGraphConfig();

    if (!config.graphConfigPresent) {
        return res.status(400).json({
            createdCount: 0,
            updatedCount: 0,
            deactivatedCount: 0,
            skippedPlatformAdminCount: 0,
            excludedByEmailCount: 0,
            samples: {
                created: [],
                updated: [],
                deactivated: [],
                skippedPlatformAdmins: [],
            },
            error: `Missing config: ${config.missingConfigKeys.join(", ")}`,
        });
    }

    try {
        const accessToken = await getGraphToken(config);
        const { graphUsers, excludedByEmail, syncCandidates } = await getSyncCandidates(config, accessToken);

        const existingUsers = await query(`
            SELECT id, entraObjectId, email, displayName, role, isActive, jobTitle, department, officeLocation
            FROM cmdb.Users
        `);

        const comparison = compareWithCmdb(syncCandidates, existingUsers);

        // Start transaction for all writes
        const created = [];
        const updated = [];
        const deactivated = [];
        const skippedPlatformAdmins = [...comparison.skippedPlatformAdmins];

        await query(`BEGIN TRANSACTION`);

        try {
            // Create new users
            for (const u of comparison.wouldCreate) {
                const newId = u.entraObjectId || `user-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
                try {
                    await query(`
                        INSERT INTO cmdb.Users (id, entraObjectId, email, displayName, role, isActive, jobTitle, department, officeLocation, graphLastSyncedAt, createdAt)
                        VALUES (@id, @entraObjectId, @email, @displayName, 'Viewer', 1, @jobTitle, @department, @officeLocation, GETUTCDATE(), GETUTCDATE())
                    `, {
                        id: newId,
                        entraObjectId: u.entraObjectId,
                        email: u.email,
                        displayName: u.displayName,
                        jobTitle: u.jobTitle,
                        department: u.department,
                        officeLocation: u.officeLocation,
                    });
                    created.push({
                        id: newId,
                        displayName: u.displayName,
                        email: u.email,
                    });
                } catch (err) {
                    throw new Error(`Failed to create user ${u.displayName}: ${err.message}`);
                }
            }

            // Update existing users
            for (const u of comparison.wouldUpdate) {
                try {
                    const existing = existingUsers.find((eu) => eu.id === u.id);
                    if (!existing) continue;

                    const updates = [];
                    const params = { id: u.id };

                    if (u.changes.displayName) {
                        updates.push("displayName = @displayName");
                        params.displayName = u.changes.displayName.to;
                    }
                    if (u.changes.email) {
                        updates.push("email = @email");
                        params.email = u.changes.email.to;
                    }
                    if (u.changes.entraObjectId) {
                        updates.push("entraObjectId = @entraObjectId");
                        params.entraObjectId = u.changes.entraObjectId.to;
                    }
                    if (u.changes.jobTitle) {
                        updates.push("jobTitle = @jobTitle");
                        params.jobTitle = u.changes.jobTitle.to;
                    }
                    if (u.changes.department) {
                        updates.push("department = @department");
                        params.department = u.changes.department.to;
                    }
                    if (u.changes.officeLocation) {
                        updates.push("officeLocation = @officeLocation");
                        params.officeLocation = u.changes.officeLocation.to;
                    }

                    updates.push("isActive = 1");
                    updates.push("graphLastSyncedAt = GETUTCDATE()");

                    await query(`
                        UPDATE cmdb.Users SET ${updates.join(", ")} WHERE id = @id
                    `, params);

                    updated.push({
                        id: u.id,
                        displayName: u.displayName,
                        changes: u.changes,
                    });
                } catch (err) {
                    throw new Error(`Failed to update user ${u.displayName}: ${err.message}`);
                }
            }

            // Deactivate users not in sync candidates (skip PlatformAdmins, skip already inactive)
            const syncEmails = new Set(syncCandidates.map((u) => u.normalizedEmail));
            const syncEntraIds = new Set(syncCandidates.filter((u) => u.graphId).map((u) => u.graphId.toLowerCase()));

            for (const eu of existingUsers) {
                if (!eu.isActive) continue; // Already inactive
                if (comparison.platformAdminIds.has(eu.id)) continue; // Skip PlatformAdmins

                const matchByEntra = eu.entraObjectId && syncEntraIds.has(eu.entraObjectId.toLowerCase());
                const matchByEmail = eu.email && syncEmails.has(eu.email.toLowerCase());

                if (!matchByEntra && !matchByEmail) {
                    try {
                        await query(`
                            UPDATE cmdb.Users SET isActive = 0, graphLastSyncedAt = GETUTCDATE() WHERE id = @id
                        `, { id: eu.id });
                        deactivated.push({
                            id: eu.id,
                            displayName: eu.displayName,
                        });
                    } catch (err) {
                        throw new Error(`Failed to deactivate user ${eu.displayName}: ${err.message}`);
                    }
                }
            }

            await query(`COMMIT TRANSACTION`);

            return res.json({
                createdCount: created.length,
                updatedCount: updated.length,
                deactivatedCount: deactivated.length,
                skippedPlatformAdminCount: skippedPlatformAdmins.length,
                excludedByEmailCount: excludedByEmail.length,
                samples: {
                    created: created.slice(0, 10),
                    updated: updated.slice(0, 10),
                    deactivated: deactivated.slice(0, 10),
                    skippedPlatformAdmins: skippedPlatformAdmins.slice(0, 10),
                },
                error: null,
            });
        } catch (err) {
            await query(`ROLLBACK TRANSACTION`);
            throw err;
        }
    } catch (err) {
        return res.status(500).json({
            createdCount: 0,
            updatedCount: 0,
            deactivatedCount: 0,
            skippedPlatformAdminCount: 0,
            excludedByEmailCount: 0,
            samples: {
                created: [],
                updated: [],
                deactivated: [],
                skippedPlatformAdmins: [],
            },
            error: `Sync failed: ${err.message}`,
        });
    }
});
export default router;
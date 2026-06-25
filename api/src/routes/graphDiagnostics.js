import { Router } from "express";
import { validateGraphConfig, getGraphToken } from "./adminUsers.js";

const router = Router();

function requirePlatformAdmin(req, res, next) {
    if (!req.user || req.user.globalRole !== "PlatformAdmin") {
        return res.status(403).json({ error: "Access denied. PlatformAdmin required." });
    }
    return next();
}

router.use(requirePlatformAdmin);

function resolveCredential(config, key) {
    const source = config.configSource[key];
    const envKey = source === `GRAPH_${key.toUpperCase()}`
        ? `GRAPH_${key.toUpperCase()}`
        : `AZURE_${key.toUpperCase()}`;
    return { value: process.env[envKey], source: envKey };
}

function decodeJwtPayload(token) {
    try {
        const parts = token.split(".");
        if (parts.length !== 3) return null;
        let base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        while (base64.length % 4 !== 0) base64 += "=";
        const json = Buffer.from(base64, "base64").toString("utf-8");
        return JSON.parse(json);
    } catch {
        return null;
    }
}

function safeTruncate(value) {
    if (!value || typeof value !== "string") return null;
    if (value.length <= 12) return value;
    return value.substring(0, 8) + "...";
}

async function testTokenAcquisition() {
    const config = validateGraphConfig();
    if (!config.graphConfigPresent) {
        return {
            success: false,
            tokenObtained: false,
            appId: null,
            tenantId: null,
            error: `Missing config keys: ${config.missingConfigKeys.join(", ")}`,
        };
    }

    try {
        const token = await getGraphToken(config);
        if (!token) {
            return { success: false, tokenObtained: false, appId: null, tenantId: null, error: "Token was empty" };
        }

        const payload = decodeJwtPayload(token);
        return {
            success: true,
            tokenObtained: true,
            appId: payload?.appid ? safeTruncate(payload.appid) : null,
            tenantId: payload?.tid ? safeTruncate(payload.tid) : null,
            error: null,
        };
    } catch (err) {
        return {
            success: false,
            tokenObtained: false,
            appId: null,
            tenantId: null,
            error: err.message,
        };
    }
}

async function testOrganizationRead(token) {
    try {
        const res = await fetch("https://graph.microsoft.com/v1.0/organization", {
            headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
            const body = await res.text();
            return { success: false, organizationId: null, organizationName: null, error: `HTTP ${res.status}: ${body.substring(0, 200)}` };
        }

        const data = await res.json();
        const org = data.value?.[0];
        return {
            success: true,
            organizationId: org?.id ? safeTruncate(org.id) : null,
            organizationName: org?.displayName || null,
            error: null,
        };
    } catch (err) {
        return { success: false, organizationId: null, organizationName: null, error: err.message };
    }
}

async function testUsersRead(token) {
    try {
        const res = await fetch(
            "https://graph.microsoft.com/v1.0/users?$top=5&$select=id,displayName,userPrincipalName,mail,userType",
            { headers: { Authorization: `Bearer ${token}` } },
        );

        if (!res.ok) {
            const body = await res.text();
            return { success: false, usersReturned: 0, guestUserCount: 0, sampleUsers: [], error: `HTTP ${res.status}: ${body.substring(0, 200)}` };
        }

        const data = await res.json();
        const guestCount = (data.value || []).filter((u) => u.userType === "Guest").length;
        const samples = (data.value || []).map((u) => ({
            id: safeTruncate(u.id),
            displayName: u.displayName,
            userPrincipalName: u.userPrincipalName,
            mail: u.mail,
            userType: u.userType,
        }));

        return {
            success: true,
            usersReturned: (data.value || []).length,
            guestUserCount: guestCount,
            sampleUsers: samples,
            error: null,
        };
    } catch (err) {
        return { success: false, usersReturned: 0, guestUserCount: 0, sampleUsers: [], error: err.message };
    }
}

async function testGroupsRead(token) {
    try {
        const res = await fetch(
            "https://graph.microsoft.com/v1.0/groups?$top=5&$select=id,displayName,description,groupTypes,visibility",
            { headers: { Authorization: `Bearer ${token}` } },
        );

        if (!res.ok) {
            const body = await res.text();
            return { success: false, groupsReturned: 0, sampleGroups: [], error: `HTTP ${res.status}: ${body.substring(0, 200)}` };
        }

        const data = await res.json();
        const samples = (data.value || []).map((g) => ({
            id: safeTruncate(g.id),
            displayName: g.displayName,
            description: g.description || null,
            groupTypes: g.groupTypes || [],
            visibility: g.visibility || null,
        }));

        return {
            success: true,
            groupsReturned: (data.value || []).length,
            sampleGroups: samples,
            error: null,
        };
    } catch (err) {
        return { success: false, groupsReturned: 0, sampleGroups: [], error: err.message };
    }
}

function getSharePointConfig() {
    const hostname = process.env.RECAP_SHAREPOINT_HOSTNAME || null;
    const sitePath = process.env.RECAP_SHAREPOINT_SITE_PATH || null;
    const configured = !!(hostname && sitePath);
    return { configured, hostname, sitePath };
}

async function testSharePointDiscovery(token) {
    const spConfig = getSharePointConfig();
    if (!spConfig.configured) {
        return {
            tested: false,
            siteFound: false,
            siteId: null,
            siteName: null,
            drives: [],
            error: "RECAP_SHAREPOINT_HOSTNAME and/or RECAP_SHAREPOINT_SITE_PATH not configured",
        };
    }

    try {
        const siteUrl = `https://graph.microsoft.com/v1.0/sites/${spConfig.hostname}:${spConfig.sitePath}`;
        const siteRes = await fetch(siteUrl, {
            headers: { Authorization: `Bearer ${token}` },
        });

        if (!siteRes.ok) {
            const body = await siteRes.text();
            return {
                tested: true,
                siteFound: false,
                siteId: null,
                siteName: null,
                drives: [],
                error: `Site lookup failed: HTTP ${siteRes.status}: ${body.substring(0, 200)}`,
            };
        }

        const siteData = await siteRes.json();
        const siteId = siteData.id || null;
        const siteName = siteData.displayName || siteData.name || null;

        // List drives for the site
        let drives = [];
        let drivesError = null;
        if (siteId) {
            const drivesRes = await fetch(
                `https://graph.microsoft.com/v1.0/sites/${siteId}/drives`,
                { headers: { Authorization: `Bearer ${token}` } },
            );

            if (drivesRes.ok) {
                const drivesData = await drivesRes.json();
                drives = (drivesData.value || []).map((d) => ({
                    id: safeTruncate(d.id),
                    name: d.name,
                    driveType: d.driveType,
                    webUrl: d.webUrl,
                }));
            } else {
                const body = await drivesRes.text();
                drivesError = `Drives list failed: HTTP ${drivesRes.status}: ${body.substring(0, 200)}`;
            }
        }

        return {
            tested: true,
            siteFound: true,
            siteId: siteId ? safeTruncate(siteId) : null,
            siteName,
            drives,
            drivesError,
            error: null,
        };
    } catch (err) {
        return {
            tested: true,
            siteFound: false,
            siteId: null,
            siteName: null,
            drives: [],
            error: err.message,
        };
    }
}

async function testSharePointDocumentRead(token, drives) {
    if (!drives || drives.length === 0) {
        return {
            tested: false,
            childrenReturned: 0,
            sampleChildren: [],
            error: "No drives available to list",
        };
    }

    try {
        const driveId = drives[0]?.id;
        if (!driveId) {
            return { tested: false, childrenReturned: 0, sampleChildren: [], error: "Drive ID unavailable" };
        }

        const res = await fetch(
            `https://graph.microsoft.com/v1.0/drives/${driveId}/root/children?$top=5&$select=id,name,folder,size,lastModifiedDateTime,webUrl`,
            { headers: { Authorization: `Bearer ${token}` } },
        );

        if (!res.ok) {
            const body = await res.text();
            return { tested: true, childrenReturned: 0, sampleChildren: [], error: `HTTP ${res.status}: ${body.substring(0, 200)}` };
        }

        const data = await res.json();
        const samples = (data.value || []).map((c) => ({
            id: safeTruncate(c.id),
            name: c.name,
            isFolder: !!c.folder,
            size: c.size || 0,
            lastModified: c.lastModifiedDateTime || null,
            webUrl: c.webUrl || null,
        }));

        return {
            tested: true,
            childrenReturned: (data.value || []).length,
            sampleChildren: samples,
            error: null,
        };
    } catch (err) {
        return { tested: false, childrenReturned: 0, sampleChildren: [], error: err.message };
    }
}

async function testWrite(token, drives) {
    if (process.env.GRAPH_DIAGNOSTICS_ALLOW_WRITE !== "true") {
        return {
            tested: false,
            folderCreated: false,
            folderDeleted: false,
            error: "GRAPH_DIAGNOSTICS_ALLOW_WRITE is not set to true",
        };
    }

    if (!drives || drives.length === 0) {
        return {
            tested: true,
            folderCreated: false,
            folderDeleted: false,
            error: "No drives available for write test",
        };
    }

    const driveId = drives[0]?.id;
    if (!driveId) {
        return {
            tested: true,
            folderCreated: false,
            folderDeleted: false,
            error: "Drive ID unavailable",
        };
    }

    const folderName = `_integrasource_graph_test_${Date.now()}`;
    let folderId = null;

    try {
        // Create folder
        const createRes = await fetch(
            `https://graph.microsoft.com/v1.0/drives/${driveId}/root/children`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    name: folderName,
                    folder: {},
                    "@microsoft.graph.conflictBehavior": "fail",
                }),
            },
        );

        if (!createRes.ok) {
            const body = await createRes.text();
            return {
                tested: true,
                folderCreated: false,
                folderDeleted: false,
                error: `Create folder failed: HTTP ${createRes.status}: ${body.substring(0, 200)}`,
            };
        }

        const createData = await createRes.json();
        folderId = createData.id;

        // Delete folder
        const deleteRes = await fetch(
            `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${folderId}`,
            { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
        );

        if (!deleteRes.ok && deleteRes.status !== 404) {
            const body = await deleteRes.text();
            return {
                tested: true,
                folderCreated: true,
                folderDeleted: false,
                error: `Delete folder failed: HTTP ${deleteRes.status}: ${body.substring(0, 200)}`,
                folderName,
            };
        }

        return {
            tested: true,
            folderCreated: true,
            folderDeleted: deleteRes.ok || deleteRes.status === 404,
            error: null,
            folderName,
        };
    } catch (err) {
        return {
            tested: true,
            folderCreated: !!folderId,
            folderDeleted: false,
            error: err.message,
        };
    }
}

router.get("/diagnostics", async (req, res) => {
    const configSummary = validateGraphConfig();
    const spConfig = getSharePointConfig();
    const tenantInfo = resolveCredential(configSummary, "tenantId");
    const clientInfo = resolveCredential(configSummary, "clientId");

    const tokenAcquisition = await testTokenAcquisition();

    // If token acquisition failed, skip subsequent tests
    let organizationRead = null;
    let usersRead = null;
    let groupsRead = null;
    let sharePointDiscovery = null;
    let sharePointDocumentRead = null;
    let writeTest = null;

    if (tokenAcquisition.tokenObtained) {
        try {
            const config = validateGraphConfig();
            const token = await getGraphToken(config);

            organizationRead = await testOrganizationRead(token);
            usersRead = await testUsersRead(token);
            groupsRead = await testGroupsRead(token);

            sharePointDiscovery = await testSharePointDiscovery(token);

            if (sharePointDiscovery.tested && sharePointDiscovery.siteFound && sharePointDiscovery.drives.length > 0) {
                sharePointDocumentRead = await testSharePointDocumentRead(token, sharePointDiscovery.drives);
                writeTest = await testWrite(token, sharePointDiscovery.drives);
            } else if (sharePointDiscovery.tested && sharePointDiscovery.siteFound && sharePointDiscovery.drivesError) {
                sharePointDocumentRead = {
                    tested: false,
                    childrenReturned: 0,
                    sampleChildren: [],
                    error: sharePointDiscovery.drivesError,
                };
            } else {
                sharePointDocumentRead = {
                    tested: false,
                    childrenReturned: 0,
                    sampleChildren: [],
                    error: "SharePoint not configured or site not found",
                };
            }
        } catch (err) {
            const errResult = { success: false, error: err.message };
            organizationRead = errResult;
            usersRead = { ...errResult, usersReturned: 0, guestUserCount: 0, sampleUsers: [] };
            groupsRead = { ...errResult, groupsReturned: 0, sampleGroups: [] };
            sharePointDiscovery = { tested: false, siteFound: false, siteId: null, siteName: null, drives: [], error: err.message };
            sharePointDocumentRead = { tested: false, childrenReturned: 0, sampleChildren: [], error: err.message };
        }
    }

    const result = {
        timestamp: new Date().toISOString(),
        config: {
            credentialsConfigured: configSummary.graphConfigPresent,
            credentialSource: {
                tenantId: tenantInfo.source,
                clientId: clientInfo.source,
                clientSecret: configSummary.configSource.clientSecret,
            },
            missingConfigKeys: configSummary.missingConfigKeys,
            sharepointConfigured: spConfig.configured,
            sharepointHostname: spConfig.hostname,
            sharepointSitePath: spConfig.sitePath,
            writeTestAllowed: process.env.GRAPH_DIAGNOSTICS_ALLOW_WRITE === "true",
        },
        tests: {
            tokenAcquisition,
            organizationRead,
            usersRead,
            groupsRead,
            sharePointDiscovery,
            sharePointDocumentRead,
            writeTest,
        },
    };

    return res.json(result);
});

export default router;

import { Router } from "express";
import { loadSharePointConfig, SharePointConfigError } from "../integrations/sharepoint/config.js";
import { ClientSecretGraphAuthProvider } from "../integrations/sharepoint/auth.js";
import { SharePointGraphClient } from "../integrations/sharepoint/graphClient.js";
import { checkSharePointConnectivity } from "../integrations/sharepoint/connectivity.js";

const router = Router();

router.use((req, res, next) => {
    if (!req.user || req.user.globalRole !== "PlatformAdmin") {
        return res.status(403).json({ error: "Access denied. PlatformAdmin required." });
    }
    return next();
});

router.get("/health", async (_req, res) => {
    try {
        const config = loadSharePointConfig();
        const authProvider = new ClientSecretGraphAuthProvider(config.credentials);
        const graphClient = new SharePointGraphClient(authProvider);
        const result = await checkSharePointConnectivity(graphClient, config.sites);
        return res.status(result.ok ? 200 : 502).json(result);
    } catch (error) {
        if (error instanceof SharePointConfigError) {
            return res.status(503).json({ ok: false, error: error.message, sites: [] });
        }
        return res.status(502).json({ ok: false, error: "SharePoint connectivity check failed", sites: [] });
    }
});

export default router;

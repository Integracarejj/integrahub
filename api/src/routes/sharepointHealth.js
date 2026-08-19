import { Router } from "express";
import { getSharePointSiteTarget, loadSharePointConfig, SharePointConfigError } from "../integrations/sharepoint/config.js";
import { ClientSecretGraphAuthProvider } from "../integrations/sharepoint/auth.js";
import { SharePointGraphClient } from "../integrations/sharepoint/graphClient.js";
import { checkSharePointConnectivity } from "../integrations/sharepoint/connectivity.js";

export function createSharePointHealthRouter({
    loadConfig = loadSharePointConfig,
    authProviderFactory = (credentials) => new ClientSecretGraphAuthProvider(credentials),
    graphClientFactory = (authProvider) => new SharePointGraphClient(authProvider),
    connectivityCheck = checkSharePointConnectivity,
} = {}) {
    const router = Router();
    router.use((req, res, next) => {
        if (!req.user || req.user.globalRole !== "PlatformAdmin") {
            return res.status(403).json({ error: "Access denied. PlatformAdmin required." });
        }
        return next();
    });

    router.get("/health", async (req, res) => {
        try {
            const config = loadConfig();
            const requestedSite = String(req.query.site || "").trim();
            let sites = config.sites;
            if (requestedSite) {
                try {
                    sites = [getSharePointSiteTarget(config, requestedSite)];
                } catch (error) {
                    if (error instanceof SharePointConfigError) return res.status(400).json({ ok: false, error: "Unknown SharePoint site key", sites: [] });
                    throw error;
                }
            }
            const authProvider = authProviderFactory(config.credentials);
            const graphClient = graphClientFactory(authProvider);
            const result = await connectivityCheck(graphClient, sites);
            return res.status(result.ok ? 200 : 502).json(result);
        } catch (error) {
            if (error instanceof SharePointConfigError) {
                return res.status(503).json({ ok: false, error: error.message, sites: [] });
            }
            return res.status(502).json({ ok: false, error: "SharePoint connectivity check failed", sites: [] });
        }
    });
    return router;
}

export default createSharePointHealthRouter();

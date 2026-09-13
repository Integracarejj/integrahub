import { Router } from "express";
import { recapPublicationService } from "../services/recapPublicationService.js";
import { publicationFailure } from "./portal.js";

export function createRecapExternalPreviewRouter({ service = recapPublicationService } = {}) {
    const router = Router();
    router.use((req, res, next) => {
        res.set("Cache-Control", "no-store");
        // The shared resolver supports development identity overrides. They must
        // never grant administrative access to authoritative preview data.
        if (req.headers["x-dev-user-email"] !== undefined || req.headers["x-entra-object-id"] !== undefined) {
            return res.status(403).json({ error: "Identity overrides are not allowed for authoritative admin preview" });
        }
        if (!req.user?.id) return res.status(401).json({ error: "Authentication required" });
        if (req.user.globalRole !== "PlatformAdmin") return res.status(403).json({ error: "PlatformAdmin preview required" });
        if (req.method !== "GET") return res.status(403).json({ error: "Authoritative admin preview is read-only" });
        next();
    });
    router.get("/organizations", async (req, res) => {
        try { res.json({ organizations: await service.listAdminPreviewOrganizations(req.user) }); }
        catch (error) { publicationFailure(res, error); }
    });
    router.get("/:organizationId/publications", async (req, res) => {
        try { res.json({ publications: await service.listAdminPreview(req.params.organizationId, req.user) }); }
        catch (error) { publicationFailure(res, error); }
    });
    router.get("/:organizationId/publications/:publicationId", async (req, res) => {
        try { res.json({ publication: await service.getAdminPreview(req.params.organizationId, req.params.publicationId, req.user) }); }
        catch (error) { publicationFailure(res, error); }
    });
    router.get("/:organizationId/publications/:publicationId/artifacts/:artifactId/content", async (req, res) => {
        try {
            const file = await service.downloadAdminPreview(req.params.organizationId, req.params.publicationId, req.params.artifactId, req.user);
            res.set("Content-Type", file.contentType || "application/octet-stream");
            res.set("Content-Disposition", `attachment; filename="${String(file.fileName || "download").replace(/[\r\n"]/g, "_")}"`);
            res.send(file.content);
        } catch (error) { publicationFailure(res, error); }
    });
    return router;
}

export default createRecapExternalPreviewRouter();

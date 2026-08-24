import { Router, raw } from "express";
import { requireInternalUser } from "../middleware/authorization.js";
import { GraphAuthenticationError } from "../integrations/sharepoint/auth.js";
import { GraphRequestError } from "../integrations/sharepoint/graphClient.js";
import { SharePointConfigError } from "../integrations/sharepoint/config.js";
import { recapWorkArtifactService, MAX_WORK_ARTIFACT_BYTES, WorkArtifactConflictError, WorkArtifactForbiddenError, WorkArtifactNotFoundError, WorkArtifactValidationError } from "../services/recapWorkArtifactService.js";

function safeName(name) { return String(name || "download").replace(/[\r\n"]/g, "_"); }
function failure(res, error) {
    if (error instanceof WorkArtifactValidationError) return res.status(400).json({ error: error.message });
    if (error instanceof WorkArtifactForbiddenError) return res.status(403).json({ error: "Work artifact access denied" });
    if (error instanceof WorkArtifactNotFoundError) return res.status(404).json({ error: error.message });
    if (error instanceof WorkArtifactConflictError) return res.status(409).json({ error: error.message });
    if (error instanceof SharePointConfigError) return res.status(503).json({ error: "SharePoint integration is not configured" });
    if (error instanceof GraphAuthenticationError) return res.status(502).json({ error: "Microsoft Graph authentication failed" });
    if (error instanceof GraphRequestError) return res.status(502).json({ error: "SharePoint artifact operation failed", graphCode: error.graphCode });
    console.error("Recap work artifact operation failed", error instanceof Error ? error.message : "Unknown error");
    return res.status(500).json({ error: "Work artifact operation failed" });
}

export function createRecapWorkArtifactRouter(service = recapWorkArtifactService) {
    const router = Router({ mergeParams: true });
    router.use(requireInternalUser);
    router.get("/", async (req, res) => { try { return res.json({ artifacts: await service.list(req.params.id, req.user) }); } catch (error) { return failure(res, error); } });
    router.post("/", raw({ type: "application/octet-stream", limit: MAX_WORK_ARTIFACT_BYTES }), async (req, res) => {
        try {
            const artifact = await service.upload({ workItemId: req.params.id, originalFileName: decodeURIComponent(String(req.headers["x-file-name"] || "")), contentType: req.headers["x-file-content-type"], content: req.body, actor: req.user });
            return res.status(201).json({ artifact });
        } catch (error) {
            if (error?.type === "entity.too.large") return res.status(413).json({ error: "Work artifact exceeds the 10 MiB limit" });
            return failure(res, error);
        }
    });
    router.get("/:artifactId/content", async (req, res) => { try {
        const file = await service.downloadArtifact(req.params.id, req.params.artifactId, req.user);
        res.set("Content-Type", file.contentType || "application/octet-stream");
        res.set("Content-Disposition", `attachment; filename="${safeName(file.fileName)}"`);
        return res.send(file.content);
    } catch (error) { return failure(res, error); } });
    router.use((error, _req, res, next) => {
        if (error?.type === "entity.too.large") return res.status(413).json({ error: "Work artifact exceeds the 10 MiB limit" });
        return next(error);
    });
    return router;
}

export function createRecapSourceDocumentRouter(service = recapWorkArtifactService) {
    const router = Router({ mergeParams: true });
    router.use(requireInternalUser);
    router.get("/", async (req, res) => { try { return res.json({ documents: await service.listSources(req.params.id, req.user) }); } catch (error) { return failure(res, error); } });
    router.get("/:documentId/content", async (req, res) => { try {
        const file = await service.downloadSource(req.params.id, req.params.documentId, req.user);
        res.set("Content-Type", file.contentType || "application/octet-stream");
        res.set("Content-Disposition", `attachment; filename="${safeName(file.fileName)}"`);
        return res.send(file.content);
    } catch (error) { return failure(res, error); } });
    return router;
}

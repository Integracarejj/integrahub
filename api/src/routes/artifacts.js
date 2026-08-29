import { Router, raw } from "express";
import { requireInternalUser } from "../middleware/authorization.js";
import { GraphAuthenticationError } from "../integrations/sharepoint/auth.js";
import { GraphRequestError } from "../integrations/sharepoint/graphClient.js";
import { SharePointConfigError } from "../integrations/sharepoint/config.js";
import { ArtifactLockError, ArtifactPlacementReadError, ArtifactPlacementWriteError } from "../services/artifactRepository.js";
import { artifactService, MAX_ARTIFACT_BYTES, ArtifactConflictError, ArtifactForbiddenError,
    ArtifactIntegrityError, ArtifactNotFoundError, ArtifactRecoveryRequiredError, ArtifactValidationError } from "../services/artifactService.js";

function safeName(name) { return String(name || "download").replace(/[\r\n"]/g, "_"); }

function safeGraphDiagnostics(diagnostics) {
    if (!diagnostics || typeof diagnostics !== "object") return null;
    const safe = {};
    for (const key of ["expectedSize", "observedSize", "contentLengthPresent", "contentEncodingPresent"]) {
        if (typeof diagnostics[key] === "number" || typeof diagnostics[key] === "boolean") safe[key] = diagnostics[key];
    }
    return Object.keys(safe).length ? safe : null;
}

function safeIntegrityDiagnostics(diagnostics) {
    if (!diagnostics || typeof diagnostics !== "object") return null;
    const safe = {};
    for (const key of ["expectedStoredSize", "observedSize", "sizeMatched", "hashMatched", "storedIdentityExisted", "lifecycleStage"]) {
        if (["number", "boolean", "string"].includes(typeof diagnostics[key]) || diagnostics[key] === null) safe[key] = diagnostics[key];
    }
    return safe;
}

function failure(res, error) {
    if (error instanceof ArtifactValidationError) return res.status(400).json({ error: error.message });
    if (error instanceof ArtifactForbiddenError) return res.status(403).json({ error: "Artifact Hub access denied" });
    if (error instanceof ArtifactNotFoundError) return res.status(404).json({ error: error.message });
    if (error instanceof ArtifactConflictError || error instanceof ArtifactLockError) return res.status(409).json({ error: error.message });
    if (error instanceof ArtifactIntegrityError) {
        console.error("Artifact content integrity check failed", safeIntegrityDiagnostics(error.diagnostics));
        return res.status(409).json({ error: "Artifact content integrity check failed", code: "artifact_content_mismatch" });
    }
    if (error instanceof ArtifactPlacementReadError || error instanceof ArtifactPlacementWriteError) return res.status(503).json({ error: "Artifact placement requires reconciliation" });
    if (error instanceof ArtifactRecoveryRequiredError) return res.status(503).json({ error: "Artifact upload is durable but requires retry before completion" });
    if (error instanceof SharePointConfigError) return res.status(503).json({ error: "Artifact Hub SharePoint integration is not configured" });
    if (error instanceof GraphAuthenticationError) return res.status(502).json({ error: "Microsoft Graph authentication failed" });
    if (error instanceof GraphRequestError) {
        console.error("Artifact Hub Graph operation failed", { operation: error.operation, status: error.status,
            graphCode: error.graphCode, diagnostics: safeGraphDiagnostics(error.diagnostics) });
        return res.status(502).json({ error: "SharePoint artifact operation failed", graphCode: error.graphCode });
    }
    console.error("Artifact Hub operation failed", error instanceof Error ? error.message : "Unknown error");
    return res.status(500).json({ error: "Artifact Hub operation failed" });
}

export function createArtifactRouter(service = artifactService) {
    const router = Router();
    router.use(requireInternalUser);

    router.get("/", async (req, res) => {
        try { return res.json(await service.list(req.query, req.user)); }
        catch (error) { return failure(res, error); }
    });
    router.post("/", raw({ type: "application/octet-stream", limit: MAX_ARTIFACT_BYTES }), async (req, res) => {
        try {
            const artifact = await service.upload({
                originalFileName: decodeURIComponent(String(req.headers["x-file-name"] || "")),
                contentType: req.headers["x-file-content-type"], content: req.body,
                destination: String(req.headers["x-artifact-destination"] || ""),
                workArea: req.headers["x-artifact-work-area"] == null ? null : String(req.headers["x-artifact-work-area"]),
                idempotencyKey: String(req.headers["idempotency-key"] || ""),
                sourceContext: req.headers["x-source-context"] == null ? null : String(req.headers["x-source-context"]), actor: req.user,
            });
            return res.status(201).json({ artifact });
        } catch (error) {
            if (error?.type === "entity.too.large") return res.status(413).json({ error: "Artifact exceeds the 10 MiB limit" });
            return failure(res, error);
        }
    });
    router.get("/:id", async (req, res) => {
        try { return res.json({ artifact: await service.get(req.params.id, req.user) }); }
        catch (error) { return failure(res, error); }
    });
    router.get("/:id/content", async (req, res) => {
        try {
            const file = await service.download(req.params.id, req.user);
            res.set("Content-Type", file.contentType || "application/octet-stream");
            res.set("Content-Disposition", `attachment; filename="${safeName(file.fileName)}"`);
            return res.send(file.content);
        } catch (error) { return failure(res, error); }
    });
    router.use((error, _req, res, next) => {
        if (error?.type === "entity.too.large") return res.status(413).json({ error: "Artifact exceeds the 10 MiB limit" });
        return next(error);
    });
    return router;
}

export default createArtifactRouter();

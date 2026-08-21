import { Router } from "express";
import { requireInternalUser } from "../middleware/authorization.js";
import { cosmDocumentService, CosmDocumentNotFoundError, CosmDocumentValidationError } from "../services/cosmDocumentService.js";

export function getCosmModuleInfo(_req, res) {
    return res.json({ ok: true, module: "cosm" });
}

export function createCosmRouter(service = cosmDocumentService) {
    const router = Router();
    router.use(requireInternalUser);
    router.get("/", getCosmModuleInfo);
    router.get("/documents", async (_req, res) => {
        try {
            return res.json({ documents: await service.listDocuments() });
        } catch (error) {
            console.error("COSM document listing failed", error instanceof Error ? error.message : "Unknown error");
            return res.status(500).json({ error: "COSM document listing failed" });
        }
    });
    router.get("/documents/:id", async (req, res) => {
        try {
            return res.json({ document: await service.getDocument(req.params.id) });
        } catch (error) {
            if (error instanceof CosmDocumentValidationError) return res.status(400).json({ error: error.message });
            if (error instanceof CosmDocumentNotFoundError) return res.status(404).json({ error: error.message });
            console.error("COSM document detail failed", error instanceof Error ? error.message : "Unknown error");
            return res.status(500).json({ error: "COSM document detail failed" });
        }
    });
    return router;
}

export default createCosmRouter();

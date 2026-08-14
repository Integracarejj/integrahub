import { Router } from "express";
import { requireInternalUser, requireRole } from "../middleware/authorization.js";
import { SharePointConfigError } from "../integrations/sharepoint/config.js";
import { GraphAuthenticationError } from "../integrations/sharepoint/auth.js";
import { GraphRequestError } from "../integrations/sharepoint/graphClient.js";
import { TransactionValidationError } from "../services/recapTransactionService.js";
import { recapWorkspaceProvisioningService, WorkspaceConflictError, WorkspaceNotFoundError } from "../services/recapWorkspaceProvisioningService.js";

export function createRecapWorkspaceRouter(service = recapWorkspaceProvisioningService) {
    const router = Router();
    router.use(requireInternalUser);
    router.post("/:id/sharepoint-workspace", requireRole(["PlatformAdmin", "Editor"]), async (req, res) => {
        try {
            return res.status(200).json(await service.provisionWorkspace(req.params.id));
        } catch (error) {
            if (error instanceof TransactionValidationError) return res.status(400).json({ error: "Invalid transaction ID" });
            if (error instanceof WorkspaceNotFoundError) return res.status(404).json({ error: error.message });
            if (error instanceof WorkspaceConflictError) return res.status(409).json({ error: error.message });
            if (error instanceof SharePointConfigError) return res.status(503).json({ error: "SharePoint integration is not configured" });
            if (error instanceof GraphAuthenticationError) return res.status(502).json({ error: "Microsoft Graph authentication failed" });
            if (error instanceof GraphRequestError) {
                return res.status(502).json({ error: "SharePoint workspace provisioning failed", stage: error.operation, graphCode: error.graphCode });
            }
            console.error("Recap workspace provisioning failed", error instanceof Error ? error.message : "Unknown error");
            return res.status(500).json({ error: "Recapitalization workspace operation failed" });
        }
    });
    return router;
}

export default createRecapWorkspaceRouter();

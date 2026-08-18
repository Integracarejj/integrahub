import { Router } from "express";
import { requireInternalUser } from "../middleware/authorization.js";
import { recapIntakeService } from "../services/recapIntakeService.js";

const router = Router();

router.get("/", requireInternalUser, async (_req, res) => {
    try {
        return res.json({ packages: await recapIntakeService.listPackages() });
    } catch (error) {
        console.error("Recapitalization intake listing failed", error instanceof Error ? error.message : "Unknown error");
        return res.status(500).json({ error: "Intake listing failed" });
    }
});

export default router;

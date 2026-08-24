import { Router } from "express";
import { requireInternalUser } from "../middleware/authorization.js";
import { recapWorkItemService, RecapWorkItemValidationError } from "../services/recapWorkItemService.js";

const router = Router();
router.use(requireInternalUser);

function failure(res, error) {
    if (error instanceof RecapWorkItemValidationError) return res.status(400).json({ error: error.message || "Invalid work item request" });
    if (/cannot|not found|Eligible internal/i.test(error?.message || "")) return res.status(409).json({ error: "Work item transition rejected" });
    console.error("Recapitalization work item operation failed", error instanceof Error ? error.message : "Unknown error");
    return res.status(503).json({ error: "Work item storage is unavailable" });
}

router.get("/", async (req, res) => { try { return res.json(await recapWorkItemService.list(req.user)); } catch (error) { return failure(res, error); } });
router.post("/admit", async (req, res) => { try { return res.status(201).json({ workItems: await recapWorkItemService.admit(req.body) }); } catch (error) { return failure(res, error); } });
router.post("/:id/assign", async (req, res) => { try { return res.json({ workItem: await recapWorkItemService.assign(req.params.id, req.body?.assignedUserId, req.user) }); } catch (error) { return failure(res, error); } });
router.post("/:id/accept", async (req, res) => { try { return res.json({ workItem: await recapWorkItemService.accept(req.params.id, req.user) }); } catch (error) { return failure(res, error); } });
router.post("/:id/not-mine", async (req, res) => { try { return res.json({ workItem: await recapWorkItemService.markNotMine(req.params.id, req.body?.reason, req.user) }); } catch (error) { return failure(res, error); } });

export default router;

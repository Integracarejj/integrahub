import { Router } from "express";
import { requireInternalUser } from "../middleware/authorization.js";
import { recapWorkItemService, RecapWorkItemAuthorizationError, RecapWorkItemConflictError, RecapWorkItemValidationError } from "../services/recapWorkItemService.js";

function failure(res, error) {
    if (error instanceof RecapWorkItemValidationError) return res.status(400).json({ error: error.message || "Invalid work item request" });
    if (error instanceof RecapWorkItemAuthorizationError) return res.status(403).json({ error: "DD Operations access required" });
    if (error instanceof RecapWorkItemConflictError) return res.status(409).json({ error: "Work item changed; refresh and try again" });
    if (/cannot|not found|Eligible internal/i.test(error?.message || "")) return res.status(409).json({ error: "Work item transition rejected" });
    console.error("Recapitalization work item operation failed", error instanceof Error ? error.message : "Unknown error");
    return res.status(503).json({ error: "Work item storage is unavailable" });
}

export function createRecapWorkItemsRouter(service = recapWorkItemService) {
    const router = Router();
    router.use(requireInternalUser);
    router.get("/", async (req, res) => { try { return res.json(await service.list(req.user)); } catch (error) { return failure(res, error); } });
    router.post("/admit", async (req, res) => { try { return res.status(201).json({ workItems: await service.admit(req.body, req.user) }); } catch (error) { return failure(res, error); } });
    router.post("/:id/assign", async (req, res) => { try { return res.json({ workItem: await service.assign(req.params.id, req.body?.assignedUserId, req.user, req.body?.expectedVersion) }); } catch (error) { return failure(res, error); } });
    router.post("/:id/accept", async (req, res) => { try { return res.json({ workItem: await service.accept(req.params.id, req.user, req.body?.expectedVersion) }); } catch (error) { return failure(res, error); } });
    router.post("/:id/response", async (req, res) => { try { return res.json({ workItem: await service.updateResponse(req.params.id, req.body, req.user) }); } catch (error) { return failure(res, error); } });
    router.post("/:id/clarification", async (req, res) => { try { return res.json({ workItem: await service.requestClarification(req.params.id, req.body, req.user) }); } catch (error) { return failure(res, error); } });
    router.post("/:id/clarification/resolve", async (req, res) => { try { return res.json({ workItem: await service.resolveClarification(req.params.id, req.body, req.user) }); } catch (error) { return failure(res, error); } });
    router.post("/:id/block", async (req, res) => { try { return res.json({ workItem: await service.block(req.params.id, req.body, req.user) }); } catch (error) { return failure(res, error); } });
    router.post("/:id/unblock", async (req, res) => { try { return res.json({ workItem: await service.unblock(req.params.id, req.body, req.user) }); } catch (error) { return failure(res, error); } });
    router.post("/:id/disposition", async (req, res) => { try { return res.json({ workItem: await service.proposeDisposition(req.params.id, req.body, req.user) }); } catch (error) { return failure(res, error); } });
    router.post("/:id/disposition/approve", async (req, res) => { try { return res.json({ workItem: await service.approveDisposition(req.params.id, req.body, req.user) }); } catch (error) { return failure(res, error); } });
    router.post("/:id/disposition/return", async (req, res) => { try { return res.json({ workItem: await service.returnDisposition(req.params.id, req.body, req.user) }); } catch (error) { return failure(res, error); } });
    router.post("/:id/submit-dd-review", async (req, res) => { try { return res.json({ workItem: await service.submitForDdReview(req.params.id, req.user, req.body?.expectedVersion) }); } catch (error) { return failure(res, error); } });
    router.post("/:id/return-from-dd-review", async (req, res) => { try { return res.json({ workItem: await service.returnFromDdReview(req.params.id, req.body, req.user) }); } catch (error) { return failure(res, error); } });
    router.post("/:id/ready-to-publish", async (req, res) => { try { return res.json({ workItem: await service.markReadyToPublish(req.params.id, req.user, req.body?.expectedVersion) }); } catch (error) { return failure(res, error); } });
    router.post("/:id/not-mine", async (req, res) => { try { return res.json({ workItem: await service.markNotMine(req.params.id, req.body, req.user) }); } catch (error) { return failure(res, error); } });
    router.get("/:id/events", async (req, res) => { try { return res.json({ events: await service.listEvents(req.params.id) }); } catch (error) { return failure(res, error); } });
    router.get("/:id/notes", async (req, res) => { try { return res.json({ notes: await service.listNotes(req.params.id) }); } catch (error) { return failure(res, error); } });
    router.post("/:id/notes", async (req, res) => { try { return res.status(201).json({ note: await service.addNote(req.params.id, req.body, req.user) }); } catch (error) { return failure(res, error); } });
    return router;
}

export default createRecapWorkItemsRouter();

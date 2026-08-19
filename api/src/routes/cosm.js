import { Router } from "express";
import { requireInternalUser } from "../middleware/authorization.js";

export function getCosmModuleInfo(_req, res) {
    return res.json({ ok: true, module: "cosm" });
}

const router = Router();
router.use(requireInternalUser);
router.get("/", getCosmModuleInfo);

export default router;

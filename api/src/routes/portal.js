import { Router } from "express";
import { query } from "../db.js";
import { requireExternalPortalUser, requireRole, requireTransactionAccess } from "../middleware/authorization.js";

const router = Router();

/**
 * All portal API routes require portal user authentication.
 */
router.use(requireExternalPortalUser);

/**
 * GET /api/portal/transactions
 * Returns transactions accessible to the current user.
 *
 * TODO: Filter by cmdb.UserTransactionAccess once the table is created.
 * TODO: Only expose fields marked externalVisible.
 */
router.get("/transactions", async (req, res) => {
    try {
        // Placeholder: Return mock-like empty response.
        // Phase 2 will query cmdb.Transactions joined with cmdb.UserTransactionAccess.
        console.log(`Portal: GET /transactions for user ${req.user.id}`);

        // TODO: Real query against cmdb.Transactions with scoping.
        return res.json({
            transactions: [],
            message: "Portal transaction listing not yet implemented. See docs/recap-portal-db-design.md for planned schema.",
        });
    } catch (err) {
        console.error("GET /api/portal/transactions failed:", err);
        return res.status(500).json({ error: "Failed to fetch transactions" });
    }
});

/**
 * GET /api/portal/transactions/:transactionId/requests
 * Returns due diligence requests for a specific transaction.
 *
 * TODO: Scope by transaction access. Only expose external-visible fields.
 */
router.get("/transactions/:transactionId/requests", requireTransactionAccess, async (req, res) => {
    try {
        const { transactionId } = req.params;

        // TODO: Query cmdb.DueDiligenceRequests WHERE transactionId = @transactionId
        // AND only return fields where externalVisible = 1 or isExternalVisible = true.
        console.log(`Portal: GET /transactions/${transactionId}/requests`);

        return res.json({
            requests: [],
            message: "Request listing not yet implemented. See docs/recap-portal-db-design.md for planned schema.",
        });
    } catch (err) {
        console.error("GET /api/portal/transactions/:id/requests failed:", err);
        return res.status(500).json({ error: "Failed to fetch requests" });
    }
});

/**
 * POST /api/portal/questions
 * Submit a general question about a transaction.
 *
 * TODO: Audit log all submissions.
 */
router.post("/questions", async (req, res) => {
    try {
        const { transactionId, questionType, subject, details } = req.body;

        if (!transactionId || !subject || !details) {
            return res.status(400).json({ error: "transactionId, subject, and details are required" });
        }

        // TODO: Insert into cmdb.DueDiligenceQuestions
        console.log(`Portal: POST /questions by user ${req.user.id}`, { transactionId, questionType, subject });

        return res.status(201).json({
            id: `q-${Date.now()}`,
            status: "Open",
            message: "Question submitted successfully. The DD team will respond shortly.",
        });
    } catch (err) {
        console.error("POST /api/portal/questions failed:", err);
        return res.status(500).json({ error: "Failed to submit question" });
    }
});

/**
 * POST /api/portal/clarifications
 * Request clarification on an existing due diligence request.
 *
 * TODO: Audit log all submissions.
 */
router.post("/clarifications", async (req, res) => {
    try {
        const { transactionId, requestId, details } = req.body;

        if (!transactionId || !requestId || !details) {
            return res.status(400).json({ error: "transactionId, requestId, and details are required" });
        }

        // TODO: Insert into cmdb.DueDiligenceClarifications
        console.log(`Portal: POST /clarifications by user ${req.user.id}`, { transactionId, requestId });

        return res.status(201).json({
            id: `cl-${Date.now()}`,
            status: "Open",
            message: "Clarification request submitted successfully.",
        });
    } catch (err) {
        console.error("POST /api/portal/clarifications failed:", err);
        return res.status(500).json({ error: "Failed to submit clarification request" });
    }
});

/**
 * POST /api/portal/requests
 * Submit a new due diligence request.
 *
 * TODO: Audit log all submissions.
 */
router.post("/requests", async (req, res) => {
    try {
        const { transactionId, category, title, details, priority, neededBy } = req.body;

        if (!transactionId || !title || !details) {
            return res.status(400).json({ error: "transactionId, title, and details are required" });
        }

        // TODO: Insert into cmdb.DueDiligenceRequests
        console.log(`Portal: POST /requests by user ${req.user.id}`, { transactionId, category, title, priority });

        return res.status(201).json({
            id: `req-${Date.now()}`,
            status: "Under Review",
            message: "Due diligence request submitted successfully.",
        });
    } catch (err) {
        console.error("POST /api/portal/requests failed:", err);
        return res.status(500).json({ error: "Failed to submit request" });
    }
});

/**
 * GET /api/portal/documents
 * Returns externally visible documents for the user's transactions.
 *
 * TODO: Scope by cmdb.UserTransactionAccess and only return externalVisible documents.
 */
router.get("/documents", async (req, res) => {
    try {
        // TODO: Query cmdb.DueDiligenceDocuments WHERE externalVisible = 1
        // AND transactionId IN (SELECT transactionId FROM cmdb.UserTransactionAccess WHERE userId = @userId)
        console.log(`Portal: GET /documents for user ${req.user.id}`);

        return res.json({
            documents: [],
            message: "Document listing not yet implemented. See docs/recap-portal-db-design.md for planned schema.",
        });
    } catch (err) {
        console.error("GET /api/portal/documents failed:", err);
        return res.status(500).json({ error: "Failed to fetch documents" });
    }
});

export default router;

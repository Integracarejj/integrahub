import { Router, raw } from "express";
import { query } from "../db.js";
import { requireExternalPortalUser, requireRole, requireTransactionAccess } from "../middleware/authorization.js";
import { recapTransactionService, TransactionValidationError } from "../services/recapTransactionService.js";
import { recapIncomingDocumentService, IncomingDocumentConflictError, IncomingDocumentForbiddenError, IncomingDocumentValidationError, MAX_INCOMING_PACKAGE_BYTES } from "../services/recapIncomingDocumentService.js";
import { GraphAuthenticationError } from "../integrations/sharepoint/auth.js";
import { GraphRequestError } from "../integrations/sharepoint/graphClient.js";
import { SharePointConfigError } from "../integrations/sharepoint/config.js";

const router = Router();

/**
 * All portal API routes require portal user authentication.
 */
router.use(requireExternalPortalUser);

router.post("/recapitalization/transactions", requireRole("ExternalBroker"), async (req, res) => {
    try {
        const organizationId = await recapIncomingDocumentService.getExternalOrganizationForUser(req.user.id);
        if (!organizationId) return res.status(403).json({ error: "External organization membership is required" });
        const transaction = await recapTransactionService.createTransaction({
            name: req.body?.name,
            owningExternalOrganizationId: organizationId,
        }, req.user);
        return res.status(201).json({
            id: transaction.businessTransactionId,
            name: transaction.name,
            status: transaction.status,
            owningExternalOrganizationId: transaction.owningExternalOrganizationId,
        });
    } catch (error) {
        if (error instanceof TransactionValidationError) return res.status(400).json({ error: "Invalid transaction", field: error.field });
        console.error("External recap transaction creation failed", error instanceof Error ? error.message : "Unknown error");
        return res.status(500).json({ error: "Transaction creation failed" });
    }
});

router.post(
    "/recapitalization/transactions/:id/incoming-documents",
    requireRole("ExternalBroker"),
    raw({ type: "application/octet-stream", limit: MAX_INCOMING_PACKAGE_BYTES }),
    async (req, res) => {
        try {
            const originalFileName = decodeURIComponent(String(req.headers["x-file-name"] || ""));
            const sourcePackageId = String(req.headers["x-package-id"] || "");
            const document = await recapIncomingDocumentService.uploadIncomingPackage({
                businessTransactionId: req.params.id,
                sourcePackageId,
                originalFileName,
                content: req.body,
                actor: req.user,
            });
            return res.status(201).json(document);
        } catch (error) {
            if (error instanceof URIError || error instanceof IncomingDocumentValidationError) return res.status(400).json({ error: "Invalid incoming package" });
            if (error instanceof IncomingDocumentForbiddenError) return res.status(403).json({ error: "Transaction access denied" });
            if (error instanceof IncomingDocumentConflictError) return res.status(409).json({ error: error.message });
            if (error instanceof SharePointConfigError) return res.status(503).json({ error: "SharePoint integration is not configured" });
            if (error instanceof GraphAuthenticationError) return res.status(502).json({ error: "Microsoft Graph authentication failed" });
            if (error instanceof GraphRequestError) return res.status(502).json({ error: "Incoming package persistence failed", graphCode: error.graphCode });
            if (error?.type === "entity.too.large") return res.status(413).json({ error: "Package file is too large" });
            console.error("Incoming package persistence failed", error instanceof Error ? error.message : "Unknown error");
            return res.status(500).json({ error: "Incoming package persistence failed" });
        }
    },
);

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

router.use((error, _req, res, next) => {
    if (error?.type === "entity.too.large") return res.status(413).json({ error: "Package file is too large" });
    return next(error);
});

export default router;

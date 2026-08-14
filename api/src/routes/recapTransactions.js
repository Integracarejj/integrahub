import { Router } from "express";
import { requireInternalUser, requireRole } from "../middleware/authorization.js";
import { recapTransactionService, TransactionValidationError } from "../services/recapTransactionService.js";

function toApiTransaction(transaction) {
    return {
        id: transaction.businessTransactionId,
        name: transaction.name,
        status: transaction.status,
        owningExternalOrganizationId: transaction.owningExternalOrganizationId,
        createdAt: transaction.createdAt,
        updatedAt: transaction.updatedAt,
    };
}

function sendError(res, error, operation) {
    if (error instanceof TransactionValidationError) {
        return res.status(400).json({ error: "Validation failed", field: error.field, detail: error.message });
    }
    console.error(`${operation} failed`, error instanceof Error ? error.message : "Unknown error");
    return res.status(500).json({ error: "Recapitalization transaction operation failed" });
}

export function createRecapTransactionsRouter(service = recapTransactionService) {
    const router = Router();
    router.use(requireInternalUser);

    router.get("/", async (req, res) => {
        try {
            const transactions = await service.listTransactions({ status: req.query.status, limit: req.query.limit ?? 100 });
            return res.json({ transactions: transactions.map(toApiTransaction) });
        } catch (error) {
            return sendError(res, error, "List recap transactions");
        }
    });

    router.get("/:id", async (req, res) => {
        try {
            const transaction = await service.getTransactionById(req.params.id);
            if (!transaction) return res.status(404).json({ error: "Transaction not found" });
            return res.json(toApiTransaction(transaction));
        } catch (error) {
            return sendError(res, error, "Get recap transaction");
        }
    });

    router.post("/", requireRole(["PlatformAdmin", "Editor"]), async (req, res) => {
        try {
            const transaction = await service.createTransaction(req.body, req.user);
            return res.status(201).json(toApiTransaction(transaction));
        } catch (error) {
            return sendError(res, error, "Create recap transaction");
        }
    });

    return router;
}

export default createRecapTransactionsRouter();

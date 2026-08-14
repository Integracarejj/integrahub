import { randomUUID } from "node:crypto";
import { query as defaultQuery } from "../db.js";

const VALID_STATUSES = new Set(["Active", "Pending", "Completed", "Cancelled"]);
const BUSINESS_ID_PREFIX = "REC";
const BUSINESS_ID_DIGITS = 8;

export class TransactionValidationError extends Error {
    constructor(field, message) {
        super(message);
        this.name = "TransactionValidationError";
        this.field = field;
    }
}

export function formatBusinessTransactionId(year, sequenceValue) {
    const numericYear = Number(year);
    const sequence = BigInt(sequenceValue);
    if (!Number.isInteger(numericYear) || numericYear < 2000 || numericYear > 9999 || sequence < 1n) {
        throw new Error("Cannot format invalid transaction sequence values");
    }
    const serial = sequence.toString();
    if (serial.length > BUSINESS_ID_DIGITS) throw new Error("Recapitalization transaction sequence is exhausted");
    return `${BUSINESS_ID_PREFIX}-${numericYear}-${serial.padStart(BUSINESS_ID_DIGITS, "0")}`;
}

function normalizeCreateInput(input = {}) {
    const name = typeof input.name === "string" ? input.name.trim().replace(/\s+/g, " ") : "";
    const status = input.status ?? "Active";
    const owningExternalOrganizationId = input.owningExternalOrganizationId == null
        ? null
        : String(input.owningExternalOrganizationId).trim();

    if (!name) throw new TransactionValidationError("name", "name is required");
    if (name.length > 256) throw new TransactionValidationError("name", "name must be 256 characters or less");
    if (!VALID_STATUSES.has(status)) throw new TransactionValidationError("status", "status is not allowed");
    if (owningExternalOrganizationId && owningExternalOrganizationId.length > 64) {
        throw new TransactionValidationError("owningExternalOrganizationId", "owningExternalOrganizationId must be 64 characters or less");
    }
    return { name, status, owningExternalOrganizationId: owningExternalOrganizationId || null };
}

function normalizeLookupId(id) {
    const value = typeof id === "string" ? id.trim() : "";
    if (!value || !/^REC-\d{4}-\d{8}$/i.test(value)) {
        throw new TransactionValidationError("id", "transaction ID is invalid");
    }
    return value;
}

export function createRecapTransactionService({
    query = defaultQuery,
    generateUuid = randomUUID,
} = {}) {
    return {
        async createTransaction(input, actor) {
            const values = normalizeCreateInput(input);
            const createdBy = actor?.id == null ? "" : String(actor.id).trim();
            if (!createdBy) throw new TransactionValidationError("actor", "authenticated actor is required");
            if (createdBy.length > 255) throw new TransactionValidationError("actor", "authenticated actor ID must be 255 characters or less");

            const sequenceRows = await query(`
                SELECT NEXT VALUE FOR cmdb.RecapTransactionNumberSequence AS sequenceValue,
                       DATEPART(year, SYSUTCDATETIME()) AS businessYear
            `);
            const { sequenceValue, businessYear } = sequenceRows[0] || {};
            if (sequenceValue == null || businessYear == null) throw new Error("Transaction sequence did not return a value");

            const databaseId = generateUuid();
            const businessTransactionId = formatBusinessTransactionId(businessYear, sequenceValue);
            const rows = await query(`
                INSERT INTO cmdb.RecapTransactions
                    (id, businessTransactionId, name, status, owningExternalOrganizationId, createdBy)
                OUTPUT
                    INSERTED.id AS databaseId,
                    INSERTED.businessTransactionId,
                    INSERTED.name,
                    INSERTED.status,
                    INSERTED.owningExternalOrganizationId,
                    INSERTED.createdAt,
                    INSERTED.updatedAt
                VALUES
                    (@databaseId, @businessTransactionId, @name, @status, @owningExternalOrganizationId, @createdBy)
            `, { databaseId, businessTransactionId, ...values, createdBy });
            if (!rows[0]) throw new Error("Created transaction could not be returned");
            return rows[0];
        },

        async getTransactionById(id) {
            const normalizedId = normalizeLookupId(id);
            const rows = await query(`
                SELECT id AS databaseId, businessTransactionId, name, status,
                       owningExternalOrganizationId, createdAt, updatedAt
                FROM cmdb.RecapTransactions
                WHERE businessTransactionId = @id
            `, { id: normalizedId });
            return rows[0] || null;
        },

        async listTransactions({ status, limit = 100 } = {}) {
            if (status != null && !VALID_STATUSES.has(status)) {
                throw new TransactionValidationError("status", "status is not allowed");
            }
            const normalizedLimit = Number(limit);
            if (!Number.isInteger(normalizedLimit) || normalizedLimit < 1 || normalizedLimit > 200) {
                throw new TransactionValidationError("limit", "limit must be an integer from 1 to 200");
            }
            return query(`
                SELECT TOP (@limit)
                       id AS databaseId, businessTransactionId, name, status,
                       owningExternalOrganizationId, createdAt, updatedAt
                FROM cmdb.RecapTransactions
                WHERE (@status IS NULL OR status = @status)
                ORDER BY updatedAt DESC, businessTransactionId DESC
            `, { status: status || null, limit: normalizedLimit });
        },
    };
}

export const recapTransactionService = createRecapTransactionService();

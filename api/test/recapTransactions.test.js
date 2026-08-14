import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createRecapTransactionService, formatBusinessTransactionId, TransactionValidationError } from "../src/services/recapTransactionService.js";
import { createRecapTransactionsRouter } from "../src/routes/recapTransactions.js";

test("business transaction IDs are deterministic, readable, and fixed width", () => {
    assert.equal(formatBusinessTransactionId(2026, 1), "REC-2026-00000001");
    assert.equal(formatBusinessTransactionId(2027, 42), "REC-2027-00000042");
    assert.throws(() => formatBusinessTransactionId(2026, 0));
});

test("create uses a concurrency-safe database sequence and server UUID", async () => {
    const calls = [];
    const query = async (statement, params) => {
        calls.push({ statement, params });
        if (statement.includes("NEXT VALUE FOR")) return [{ sequenceValue: 17, businessYear: 2026 }];
        return [{
            databaseId: params.databaseId,
            businessTransactionId: params.businessTransactionId,
            name: params.name,
            status: params.status,
            owningExternalOrganizationId: params.owningExternalOrganizationId,
            createdAt: "2026-08-14T12:00:00.000Z",
            updatedAt: "2026-08-14T12:00:00.000Z",
        }];
    };
    const service = createRecapTransactionService({ query, generateUuid: () => "11111111-1111-4111-8111-111111111111" });
    const result = await service.createTransaction(
        { name: "  Project   Keystone  ", owningExternalOrganizationId: "org-1" },
        { id: "durable-user-id", email: "mutable-email@example.com" },
    );
    assert.equal(result.businessTransactionId, "REC-2026-00000017");
    assert.equal(calls[1].params.databaseId, "11111111-1111-4111-8111-111111111111");
    assert.equal(calls[1].params.name, "Project Keystone");
    assert.equal(calls[1].params.createdBy, "durable-user-id");
});

test("separate sequence allocations produce unique business IDs", async () => {
    let sequence = 0;
    const query = async (statement, params) => statement.includes("NEXT VALUE FOR")
        ? [{ sequenceValue: ++sequence, businessYear: 2026 }]
        : [{ ...params, createdAt: "now", updatedAt: "now" }];
    let uuid = 0;
    const service = createRecapTransactionService({ query, generateUuid: () => `00000000-0000-4000-8000-${String(++uuid).padStart(12, "0")}` });
    const results = await Promise.all([
        service.createTransaction({ name: "One" }, { id: "user" }),
        service.createTransaction({ name: "Two" }, { id: "user" }),
    ]);
    assert.deepEqual(results.map((result) => result.businessTransactionId).sort(), ["REC-2026-00000001", "REC-2026-00000002"]);
});

test("create validates required and bounded fields before querying", async () => {
    let queried = false;
    const service = createRecapTransactionService({ query: async () => { queried = true; return []; } });
    await assert.rejects(service.createTransaction({}, { id: "user" }), (error) => error instanceof TransactionValidationError && error.field === "name");
    await assert.rejects(service.createTransaction({ name: "Valid", status: "Deleted" }, { id: "user" }), (error) => error.field === "status");
    await assert.rejects(service.createTransaction({ name: "Valid" }, { id: "x".repeat(256) }), (error) => error.field === "actor");
    assert.equal(queried, false);
});

test("get and list query by durable IDs and validate filters", async () => {
    const calls = [];
    const service = createRecapTransactionService({ query: async (statement, params) => { calls.push({ statement, params }); return [{ businessTransactionId: "REC-2026-00000001" }]; } });
    assert.equal((await service.getTransactionById("REC-2026-00000001")).businessTransactionId, "REC-2026-00000001");
    assert.equal((await service.listTransactions({ status: "Active", limit: 25 })).length, 1);
    assert.equal(calls[1].params.limit, 25);
    await assert.rejects(service.getTransactionById("../../unsafe"), (error) => error.field === "id");
    await assert.rejects(service.listTransactions({ limit: 201 }), (error) => error.field === "limit");
});

async function withServer(user, service, callback) {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { req.user = user; next(); });
    app.use("/api/recapitalization/transactions", createRecapTransactionsRouter(service));
    const server = app.listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    try {
        const { port } = server.address();
        await callback(`http://127.0.0.1:${port}`);
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
}

const row = { databaseId: "private-db-id", businessTransactionId: "REC-2026-00000001", name: "Project", status: "Active", owningExternalOrganizationId: null, createdAt: "created", updatedAt: "updated" };

test("routes require internal authentication and restrict creation to editors/admins", async () => {
    const service = { listTransactions: async () => [row], getTransactionById: async () => row, createTransaction: async () => row };
    await withServer(null, service, async (base) => assert.equal((await fetch(`${base}/api/recapitalization/transactions`)).status, 401));
    await withServer({ id: "external", globalRole: "ExternalBroker", portalRole: "ExternalBroker" }, service, async (base) => assert.equal((await fetch(`${base}/api/recapitalization/transactions`)).status, 403));
    await withServer({ id: "viewer", globalRole: "Viewer", portalRole: null }, service, async (base) => assert.equal((await fetch(`${base}/api/recapitalization/transactions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Project" }) })).status, 403));
    await withServer({ id: "editor", globalRole: "Editor", portalRole: null }, service, async (base) => assert.equal((await fetch(`${base}/api/recapitalization/transactions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Project" }) })).status, 201));
});

test("API omits database identity and sanitizes service failures", async () => {
    const originalError = console.error;
    console.error = () => {};
    try {
        await withServer({ id: "admin", globalRole: "PlatformAdmin", portalRole: null }, {
            listTransactions: async () => [row],
            getTransactionById: async () => { throw new Error("password=do-not-expose"); },
            createTransaction: async () => row,
        }, async (base) => {
            const list = await (await fetch(`${base}/api/recapitalization/transactions`)).json();
            assert.equal(list.transactions[0].id, "REC-2026-00000001");
            assert.equal("databaseId" in list.transactions[0], false);
            const response = await fetch(`${base}/api/recapitalization/transactions/REC-2026-00000001`);
            assert.equal(response.status, 500);
            assert.equal(JSON.stringify(await response.json()).includes("do-not-expose"), false);
        });
    } finally {
        console.error = originalError;
    }
});

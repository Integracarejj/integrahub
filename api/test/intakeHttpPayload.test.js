import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { configureJsonBodyParsing, jsonBodyErrorHandler } from "../src/middleware/jsonBodyParsing.js";

async function withServer(handler) {
    const app = express();
    configureJsonBodyParsing(app);
    let received = null;
    app.post("/api/portal/recapitalization/transactions/:id/intake", (req, res) => {
        received = req.body;
        res.status(201).json({ reachedServiceBoundary: true, requestCount: req.body.requests.length });
    });
    app.post("/api/ordinary", (_req, res) => res.json({ ok: true }));
    app.use(jsonBodyErrorHandler);
    const server = app.listen(0, "127.0.0.1");
    await new Promise(resolve => server.once("listening", resolve));
    try { await handler({ baseUrl: `http://127.0.0.1:${server.address().port}`, getReceived: () => received }); }
    finally { await new Promise(resolve => server.close(resolve)); }
}

function payloadOfSize(descriptionLength) {
    return { sourcePackageId: "sub-large", requests: [{ title: "Large request", description: "x".repeat(descriptionLength), category: "Legal", priority: "Medium" }] };
}

test("real intake HTTP path accepts a 300 KB JSON payload and reaches the route boundary", async () => {
    await withServer(async ({ baseUrl, getReceived }) => {
        const response = await fetch(`${baseUrl}/api/portal/recapitalization/transactions/REC-2026-00000003/intake`, {
            method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payloadOfSize(300 * 1024)),
        });
        assert.equal(response.status, 201);
        assert.deepEqual(await response.json(), { reachedServiceBoundary: true, requestCount: 1 });
        assert.equal(getReceived().sourcePackageId, "sub-large");
    });
});

test("normal payload remains accepted", async () => {
    await withServer(async ({ baseUrl }) => {
        const response = await fetch(`${baseUrl}/api/portal/recapitalization/transactions/REC-1/intake`, {
            method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payloadOfSize(20)),
        });
        assert.equal(response.status, 201);
    });
});

test("payload beyond 1 MiB fails with a sanitized JSON 413", async () => {
    await withServer(async ({ baseUrl }) => {
        const response = await fetch(`${baseUrl}/api/portal/recapitalization/transactions/REC-1/intake`, {
            method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payloadOfSize(1100 * 1024)),
        });
        assert.equal(response.status, 413);
        assert.deepEqual(await response.json(), { error: "Intake payload exceeds the 1mb limit" });
    });
});

import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createSharePointHealthRouter } from "../src/routes/sharepointHealth.js";

const config = {
    credentials: { tenantId: "tenant", clientId: "client", clientSecret: "secret" },
    sites: [
        { key: "working", hostname: "host", sitePath: "/sites/working", libraryName: "Recapitalization Working" },
        { key: "knowledge", hostname: "host", sitePath: "/sites/knowledge", libraryName: null },
    ],
};

async function withServer(user, request) {
    const selected = [];
    const app = express();
    app.use((req, _res, next) => { req.user = user; next(); });
    app.use("/api/admin/sharepoint", createSharePointHealthRouter({
        loadConfig: () => config,
        authProviderFactory: () => ({ getAccessToken: async () => "token" }),
        graphClientFactory: () => ({ shared: true }),
        connectivityCheck: async (client, sites) => {
            selected.push({ client, keys: sites.map((site) => site.key) });
            return { ok: true, sites: sites.map((site) => ({ key: site.key, ok: true })) };
        },
    }));
    const server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    try {
        const { port } = server.address();
        const response = await fetch(`http://127.0.0.1:${port}${request}`);
        return { status: response.status, body: await response.json(), selected };
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
}

test("SharePoint health remains PlatformAdmin-only", async () => {
    const result = await withServer({ globalRole: "ExternalBroker" }, "/api/admin/sharepoint/health?site=knowledge");
    assert.equal(result.status, 403);
    assert.equal(result.selected.length, 0);
});

test("SharePoint health selects knowledge independently without falling back", async () => {
    const result = await withServer({ globalRole: "PlatformAdmin" }, "/api/admin/sharepoint/health?site=knowledge");
    assert.equal(result.status, 200);
    assert.deepEqual(result.selected[0].keys, ["knowledge"]);
    assert.deepEqual(result.body.sites, [{ key: "knowledge", ok: true }]);
});

test("SharePoint health rejects an unknown site key before Graph access", async () => {
    const result = await withServer({ globalRole: "PlatformAdmin" }, "/api/admin/sharepoint/health?site=unknown");
    assert.equal(result.status, 400);
    assert.equal(result.body.error, "Unknown SharePoint site key");
    assert.equal(result.selected.length, 0);
});

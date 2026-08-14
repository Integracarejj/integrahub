import test from "node:test";
import assert from "node:assert/strict";
import { loadSharePointConfig, SharePointConfigError } from "../src/integrations/sharepoint/config.js";
import { ClientSecretGraphAuthProvider, GraphAuthenticationError } from "../src/integrations/sharepoint/auth.js";
import { SharePointGraphClient, GraphRequestError } from "../src/integrations/sharepoint/graphClient.js";
import { checkSharePointConnectivity } from "../src/integrations/sharepoint/connectivity.js";

const response = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

test("SharePoint config reads only dedicated credentials and defaults", () => {
    const config = loadSharePointConfig({
        SHAREPOINT_TENANT_ID: "sp-tenant",
        SHAREPOINT_CLIENT_ID: "sp-client",
        SHAREPOINT_CLIENT_SECRET: "sp-secret",
        AZURE_TENANT_ID: "unrelated-tenant",
    });
    assert.deepEqual(config.credentials, { tenantId: "sp-tenant", clientId: "sp-client", clientSecret: "sp-secret" });
    assert.deepEqual(config.sites.map(({ key, sitePath, libraryName }) => ({ key, sitePath, libraryName })), [
        { key: "working", sitePath: "/sites/tIntegraSourceWorking", libraryName: "Recapitalization Working" },
        { key: "external", sitePath: "/sites/ICC_External", libraryName: "Documents" },
    ]);
});

test("SharePoint config reports missing variable names without values", () => {
    assert.throws(
        () => loadSharePointConfig({ SHAREPOINT_CLIENT_SECRET: "highly-sensitive" }),
        (error) => error instanceof SharePointConfigError
            && error.message.includes("SHAREPOINT_TENANT_ID")
            && !error.message.includes("highly-sensitive"),
    );
});

test("client-secret provider sends the client credentials Graph scope", async () => {
    let request;
    const provider = new ClientSecretGraphAuthProvider(
        { tenantId: "tenant/id", clientId: "client", clientSecret: "secret" },
        async (url, options) => { request = { url, options }; return response(200, { access_token: "token" }); },
    );
    assert.equal(await provider.getAccessToken(), "token");
    assert.equal(request.options.method, "POST");
    assert.match(request.url, /tenant%2Fid\/oauth2\/v2\.0\/token$/);
    assert.equal(request.options.body.get("client_id"), "client");
    assert.equal(request.options.body.get("client_secret"), "secret");
    assert.equal(request.options.body.get("grant_type"), "client_credentials");
    assert.equal(request.options.body.get("scope"), "https://graph.microsoft.com/.default");
});

test("token failures are sanitized", async () => {
    const provider = new ClientSecretGraphAuthProvider(
        { tenantId: "tenant", clientId: "client", clientSecret: "do-not-leak" },
        async () => response(401, { error_description: "do-not-leak" }),
    );
    await assert.rejects(provider.getAccessToken(), (error) => error instanceof GraphAuthenticationError
        && error.message === "Microsoft Graph token request failed (HTTP 401)"
        && !error.message.includes("do-not-leak"));
});

test("Graph client resolves sites, lists drives, selects a library, and lists root items", async () => {
    const calls = [];
    const client = new SharePointGraphClient({ getAccessToken: async () => "private-token" }, async (url, options) => {
        calls.push({ url, options });
        if (url.includes("/sites/integracare.sharepoint.com:")) return response(200, { id: "site-1", name: "site", displayName: "Site", webUrl: "https://site" });
        if (url.endsWith("/sites/site-1/drives")) return response(200, { value: [{ id: "drive-1", name: "Documents", driveType: "documentLibrary" }] });
        return response(200, { value: [{ id: "item-1", name: "Folder", folder: {}, size: 0, lastModifiedDateTime: "2026-01-01T00:00:00Z" }] });
    });
    const site = await client.resolveSite("integracare.sharepoint.com", "/sites/ICC_External");
    const drive = await client.findDriveByName(site.id, "Documents");
    const children = await client.listRootChildren(drive.id);
    assert.equal(site.id, "site-1");
    assert.equal(drive.id, "drive-1");
    assert.equal(calls[0].url, "https://graph.microsoft.com/v1.0/sites/integracare.sharepoint.com:/sites/ICC_External");
    assert.deepEqual(children[0], { id: "item-1", name: "Folder", webUrl: null, type: "folder", size: 0, lastModifiedDateTime: "2026-01-01T00:00:00Z" });
    assert.ok(calls.every(({ options }) => options.method === "GET"));
    assert.ok(calls.every(({ options }) => options.headers.Authorization === "Bearer private-token"));
});

test("drive lookup follows Graph pagination and keeps next links on the Graph v1 endpoint", async () => {
    const calls = [];
    const client = new SharePointGraphClient({ getAccessToken: async () => "token" }, async (url) => {
        calls.push(url);
        if (calls.length === 1) return response(200, {
            value: [{ id: "other", name: "Other" }],
            "@odata.nextLink": "https://graph.microsoft.com/v1.0/sites/site/drives?$skiptoken=safe",
        });
        return response(200, { value: [{ id: "expected", name: "Documents" }] });
    });
    assert.equal((await client.findDriveByName("site", "Documents")).id, "expected");
    assert.equal(calls.length, 2);

    const unsafe = new SharePointGraphClient({ getAccessToken: async () => "token" }, async () => response(200, {
        value: [],
        "@odata.nextLink": "https://example.com/collect-token",
    }));
    await assert.rejects(unsafe.listDrives("site"), (error) => error.graphCode === "invalid_next_link");
});

test("Graph errors expose status and code but omit response details and token", async () => {
    const client = new SharePointGraphClient({ getAccessToken: async () => "private-token" }, async () => response(403, {
        error: { code: "accessDenied", message: "contains private-token" },
    }));
    await assert.rejects(client.resolveSite("host", "/sites/site"), (error) => error instanceof GraphRequestError
        && error.status === 403
        && error.graphCode === "accessDenied"
        && !error.message.includes("private-token"));
});

test("missing library produces a specific sanitized error", async () => {
    const client = new SharePointGraphClient({ getAccessToken: async () => "token" }, async () => response(200, { value: [] }));
    await assert.rejects(client.findDriveByName("site", "Expected"), (error) => error.graphCode === "library_not_found");
});

test("connectivity check composes each read and reports sanitized state", async () => {
    const calls = [];
    const graphClient = {
        async resolveSite(hostname, sitePath) { calls.push(["site", hostname, sitePath]); return { id: `site-${calls.length}` }; },
        async findDriveByName(siteId, name) { calls.push(["drive", siteId, name]); return { id: `drive-${calls.length}` }; },
        async listRootChildren(driveId) { calls.push(["root", driveId]); return [{ id: "item" }]; },
    };
    const result = await checkSharePointConnectivity(graphClient, [{ key: "working", hostname: "host", sitePath: "/site", libraryName: "Library" }]);
    assert.deepEqual(result, { ok: true, sites: [{ key: "working", siteResolved: true, libraryResolved: true, rootReadable: true, rootItemCount: 1, error: null }] });
    assert.deepEqual(calls.map(([operation]) => operation), ["site", "drive", "root"]);
});

test("folder creation uses only the narrow drive-item children endpoint and sanitizes failures", async () => {
    const calls = [];
    const client = new SharePointGraphClient({ getAccessToken: async () => "private-token" }, async (url, options) => {
        calls.push({ url, options });
        return response(201, { id: "folder-1", name: "Transactions", webUrl: "https://site/folder", folder: {}, parentReference: { id: "root" } });
    });
    const folder = await client.createChildFolder("drive/1", "parent/1", "Transactions");
    assert.equal(folder.type, "folder");
    assert.equal(calls[0].url, "https://graph.microsoft.com/v1.0/drives/drive%2F1/items/parent%2F1/children");
    assert.equal(calls[0].options.method, "POST");
    assert.deepEqual(JSON.parse(calls[0].options.body), { name: "Transactions", folder: {}, "@microsoft.graph.conflictBehavior": "fail" });

    const failing = new SharePointGraphClient({ getAccessToken: async () => "private-token" }, async () => response(403, { error: { code: "accessDenied", message: "private-token must not leak" } }));
    await assert.rejects(failing.createChildFolder("drive", "parent", "Folder"), (error) => error.graphCode === "accessDenied" && !error.message.includes("private-token"));
});

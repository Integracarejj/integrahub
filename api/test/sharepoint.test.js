import test from "node:test";
import assert from "node:assert/strict";
import { getArtifactDestinationTarget, getSharePointSiteTarget, loadSharePointConfig, SharePointConfigError } from "../src/integrations/sharepoint/config.js";
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
        { key: "knowledge", sitePath: "/sites/tIntegraSourceKnowledge", libraryName: "Documents" },
        { key: "external", sitePath: "/sites/ICC_External", libraryName: "Documents" },
    ]);
    assert.equal(getSharePointSiteTarget(config, "working").sitePath, "/sites/tIntegraSourceWorking");
    assert.equal(getSharePointSiteTarget(config, "knowledge").sitePath, "/sites/tIntegraSourceKnowledge");
    assert.equal(getSharePointSiteTarget(config, "knowledge").libraryName, "Documents");
    assert.deepEqual(config.artifactDestinations.map(({ key, libraryName }) => ({ key, libraryName })), [
        { key: "Projects", libraryName: "Projects Working" },
        { key: "Legal", libraryName: "Legal Working" },
        { key: "Operations", libraryName: "Operations Working" },
    ]);
    assert.equal(getArtifactDestinationTarget(config, "Projects").sitePath, "/sites/tIntegraSourceWorking");
    assert.equal(getArtifactDestinationTarget(config, "Legal").libraryName, "Legal Working");
    assert.throws(() => getArtifactDestinationTarget(config, "Recapitalization"), SharePointConfigError);
    assert.throws(() => getSharePointSiteTarget(config, "unknown"), SharePointConfigError);
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

test("item metadata lookup requests and returns safe size and modification fields", async () => {
    const calls = [];
    const client = new SharePointGraphClient({ getAccessToken: async () => "private-token" }, async (url) => {
        calls.push(url);
        return response(200, { id: "private-item", name: "private-name.docx", size: 15196,
            lastModifiedDateTime: "2026-08-28T12:00:00Z", file: {}, parentReference: { id: "private-parent" } });
    });
    const item = await client.getItem("private-drive", "private-item");
    assert.match(calls[0], /\$select=id,name,webUrl,folder,file,parentReference,size,lastModifiedDateTime/);
    assert.deepEqual({ size: item.size, type: item.type, lastModifiedDateTime: item.lastModifiedDateTime },
        { size: 15196, type: "file", lastModifiedDateTime: "2026-08-28T12:00:00Z" });
});

test("missing library produces a specific sanitized error", async () => {
    const client = new SharePointGraphClient({ getAccessToken: async () => "token" }, async () => response(200, { value: [] }));
    await assert.rejects(client.findDriveByName("site", "Expected"), (error) => error.graphCode === "library_not_found");
});

test("connectivity check composes each read and reports sanitized state", async () => {
    const calls = [];
    const graphClient = {
        async resolveSite(hostname, sitePath) { calls.push(["site", hostname, sitePath]); return { id: `site-${calls.length}` }; },
        async listDrives(siteId) { calls.push(["drives", siteId]); return [{ id: `drive-${calls.length}`, name: "Library", webUrl: "https://site/library" }]; },
        async listRootChildren(driveId) { calls.push(["root", driveId]); return [{ id: "item", name: "Folder", type: "folder", webUrl: "https://site/folder", size: 99 }]; },
    };
    const result = await checkSharePointConnectivity(graphClient, [{ key: "working", hostname: "host", sitePath: "/site", libraryName: "Library" }]);
    assert.equal(result.ok, true);
    assert.deepEqual(result.sites[0].site, { id: "site-1" });
    assert.equal(result.sites[0].drives[0].name, "Library");
    assert.equal(result.sites[0].rootReadable, true);
    assert.deepEqual(result.sites[0].rootItems, [{ id: "item", name: "Folder", type: "folder", webUrl: "https://site/folder" }]);
    assert.deepEqual(calls.map(([operation]) => operation), ["site", "drives", "root"]);
});

test("working and knowledge resolve independently through one shared Graph client", async () => {
    const calls = [];
    const graphClient = {
        async resolveSite(hostname, sitePath) { calls.push(["site", hostname, sitePath]); return { id: `id:${sitePath}`, displayName: sitePath, webUrl: `https://${hostname}${sitePath}` }; },
        async listDrives(siteId) { calls.push(["drives", siteId]); return [{ id: `drive:${siteId}`, name: siteId.includes("Working") ? "Recapitalization Working" : "Documents", webUrl: "https://library" }]; },
        async listRootChildren(driveId) { calls.push(["root", driveId]); return [{ id: `root-item:${driveId}`, name: "Existing Folder", type: "folder", webUrl: "https://library/folder" }]; },
    };
    const config = loadSharePointConfig({ SHAREPOINT_TENANT_ID: "tenant", SHAREPOINT_CLIENT_ID: "client", SHAREPOINT_CLIENT_SECRET: "secret" });
    const targets = [getSharePointSiteTarget(config, "working"), getSharePointSiteTarget(config, "knowledge")];
    const result = await checkSharePointConnectivity(graphClient, targets);
    assert.equal(result.ok, true);
    assert.deepEqual(result.sites.map(({ key, siteResolved, drivesListed }) => ({ key, siteResolved, drivesListed })), [
        { key: "working", siteResolved: true, drivesListed: true },
        { key: "knowledge", siteResolved: true, drivesListed: true },
    ]);
    const knowledge = result.sites.find((site) => site.key === "knowledge");
    assert.equal(knowledge.libraryResolved, true);
    assert.equal(knowledge.rootReadable, true);
    assert.equal(knowledge.rootItemCount, 1);
    assert.deepEqual(knowledge.rootItems, [{ id: `root-item:drive:id:/sites/tIntegraSourceKnowledge`, name: "Existing Folder", type: "folder", webUrl: "https://library/folder" }]);
    assert.ok(calls.some((call) => call[0] === "root" && call[1] === "drive:id:/sites/tIntegraSourceKnowledge"));
    assert.deepEqual(calls.filter(([operation]) => operation === "site").map(([, , path]) => path), [
        "/sites/tIntegraSourceWorking",
        "/sites/tIntegraSourceKnowledge",
    ]);
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

test("small-file upload preserves an OOXML-like binary Buffer exactly and never exposes remote failure content", async () => {
    const calls = [];
    const client = new SharePointGraphClient({ getAccessToken: async () => "private-token" }, async (url, options) => {
        calls.push({ url, options });
        return response(201, { id: "file-1", name: "Package #1.xlsx", webUrl: "https://site/file", size: 12, file: {}, parentReference: { id: "incoming" } });
    });
    const content = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x08, 0xff, 0x80, 0x00, 0x7f]);
    const item = await client.uploadNewFile("drive/1", "incoming/1", "Package #1.xlsx", content);
    assert.equal(item.id, "file-1");
    assert.equal(item.size, content.length);
    assert.equal(calls[0].url, "https://graph.microsoft.com/v1.0/drives/drive%2F1/items/incoming%2F1:/Package%20%231.xlsx:/content");
    assert.equal(calls[0].options.method, "PUT");
    assert.equal(calls[0].options.headers.Authorization, "Bearer private-token");
    assert.equal(calls[0].options.headers["Content-Type"], "application/octet-stream");
    assert.equal(calls[0].options.headers["Content-Length"], undefined);
    assert.equal(calls[0].options.headers["If-Match"], "0");
    assert.equal(Buffer.isBuffer(calls[0].options.body), true);
    assert.equal(calls[0].options.body.byteLength, content.byteLength);
    assert.equal(calls[0].options.body, content);
    assert.deepEqual(calls[0].options.body, content);

    const failing = new SharePointGraphClient({ getAccessToken: async () => "private-token" }, async () => response(500, { error: { code: "serviceUnavailable", message: "private-token secret" } }));
    await assert.rejects(failing.uploadNewFile("drive", "incoming", "file.xlsx", content), (error) => error.graphCode === "serviceUnavailable" && !error.message.includes("private-token"));
});

test("file download reads incrementally and enforces expected and maximum sizes", async () => {
    const client = new SharePointGraphClient({ getAccessToken: async () => "private-token" }, async () => new Response("abcd", { status: 200, headers: { "content-type": "application/pdf" } }));
    const file = await client.downloadFile("drive", "item", { maxBytes: 4, expectedSize: 4 });
    assert.equal(file.content.toString(), "abcd");
    assert.equal(file.contentType, "application/pdf");

    const oversized = new SharePointGraphClient({ getAccessToken: async () => "private-token" }, async () => new Response("abcde", { status: 200 }));
    await assert.rejects(oversized.downloadFile("drive", "item", { maxBytes: 4, expectedSize: 4 }), error => error.graphCode === "response_too_large");

    const changed = new SharePointGraphClient({ getAccessToken: async () => "private-token" }, async () => new Response("abc", { status: 200 }));
    await assert.rejects(changed.downloadFile("drive", "item", { maxBytes: 4, expectedSize: 4 }), error => error.graphCode === "content_length_mismatch");
});

test("binary download ignores non-authoritative transport length but still rejects true truncation", async () => {
    const word = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0xff, 0x80, 0x7f]);
    const complete = new SharePointGraphClient({ getAccessToken: async () => "private-token" }, async () =>
        new Response(word, { status: 200, headers: { "content-length": "3", "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document" } }));
    const downloaded = await complete.downloadFile("drive", "item", { maxBytes: 20, expectedSize: word.length });
    assert.deepEqual(downloaded.content, word);

    const truncated = new SharePointGraphClient({ getAccessToken: async () => "private-token" }, async () =>
        new Response(word.subarray(0, word.length - 1), { status: 200 }));
    await assert.rejects(truncated.downloadFile("drive", "item", { maxBytes: 20, expectedSize: word.length }),
        error => error.graphCode === "content_length_mismatch"
            && error.diagnostics.expectedSize === word.length && error.diagnostics.observedSize === word.length - 1
            && error.diagnostics.contentLengthPresent === false);
});

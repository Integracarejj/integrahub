import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { GraphRequestError } from "../src/integrations/sharepoint/graphClient.js";
import { buildTransactionFolderName, createRecapWorkspaceProvisioningService, REQUIRED_WORKSPACE_FOLDERS, WorkspaceConflictError } from "../src/services/recapWorkspaceProvisioningService.js";
import { createRecapWorkspaceRouter } from "../src/routes/recapWorkspace.js";

const transaction = { databaseId: "11111111-1111-4111-8111-111111111111", businessTransactionId: "REC-2026-00000001", name: "SharePoint Integration Test" };
const config = { credentials: {}, sites: [{ key: "working", hostname: "working.example", sitePath: "/sites/working", libraryName: "Recapitalization Working" }, { key: "knowledge", hostname: "knowledge.example", sitePath: "/sites/knowledge", libraryName: "Documents" }, { key: "external", hostname: "external.example", sitePath: "/sites/external", libraryName: "Documents" }] };

function makeHarness({ transactionExists = true, mapping = null, rootChildren = [], workspaceChildren = [] } = {}) {
    let storedMapping = mapping;
    const calls = [];
    const children = new Map([["drive-root", [...rootChildren]]]);
    for (const item of rootChildren) if (item.name === "Transactions") children.set(item.id, [...workspaceChildren]);
    const graph = {
        async resolveSite(host, path) { calls.push(["site", host, path]); return { id: "site-working" }; },
        async findDriveByName(siteId, name) { calls.push(["drive", siteId, name]); return { id: "drive-working" }; },
        async getDriveRoot() { return { id: "drive-root", name: "root", type: "folder" }; },
        async listChildren(_driveId, parentId) { return [...(children.get(parentId) || [])]; },
        async findChildByExactName(_driveId, parentId, name) { return (children.get(parentId) || []).find((item) => item.name.toLowerCase() === name.toLowerCase()) || null; },
        async createChildFolder(_driveId, parentId, name) {
            calls.push(["create", parentId, name]);
            const item = { id: `item-${calls.filter((call) => call[0] === "create").length}`, name, type: "folder", parentId, webUrl: `https://working/${encodeURIComponent(name)}` };
            const list = children.get(parentId) || [];
            list.push(item);
            children.set(parentId, list);
            children.set(item.id, []);
            return item;
        },
        async getItem(_driveId, itemId) {
            for (const list of children.values()) {
                const item = list.find((candidate) => candidate.id === itemId);
                if (item) return item;
            }
            throw new GraphRequestError("SharePoint item resolution", 404, "itemNotFound");
        },
    };
    const mappingRepository = {
        async withProvisioningLock(_id, _siteKey, work) { calls.push(["lock"]); return work(); },
        async getByTransaction() { return storedMapping; },
        async createOrGet(value) { calls.push(["mapping", value]); storedMapping = storedMapping || { ...value }; return storedMapping; },
        async refreshLocation(_id, _key, item) { calls.push(["refresh", item]); storedMapping = { ...storedMapping, folderName: item.name, webUrl: item.webUrl }; },
    };
    const service = createRecapWorkspaceProvisioningService({
        transactionService: { getTransactionById: async () => transactionExists ? transaction : null },
        mappingRepository,
        loadConfig: () => config,
        graphClientFactory: () => graph,
    });
    return { service, calls, graph, getMapping: () => storedMapping };
}

test("transaction folder naming preserves ID, sanitizes names, and bounds length", () => {
    assert.equal(buildTransactionFolderName("REC-2026-00000001", "  Bad / Name:*? ...  "), "REC-2026-00000001 - Bad - Name-");
    assert.equal(
        buildTransactionFolderName("REC-2026-00000001", "\"*:< >?/\\|\u0001   "),
        "REC-2026-00000001 - - -",
    );
    assert.equal(buildTransactionFolderName("REC-2026-00000001", "...   "), "REC-2026-00000001 - Transaction");
    const longName = buildTransactionFolderName("REC-2026-00000001", "x".repeat(500));
    assert.equal(longName.length, 180);
    assert.ok(longName.startsWith("REC-2026-00000001 - "));
});

test("nonexistent authoritative transaction performs zero Graph operations", async () => {
    const harness = makeHarness({ transactionExists: false });
    await assert.rejects(harness.service.provisionWorkspace("REC-2026-99999999"), (error) => error.name === "WorkspaceNotFoundError");
    assert.deepEqual(harness.calls, []);
});

test("first provision creates managed root, transaction root, six children, and UUID mapping", async () => {
    const harness = makeHarness();
    const result = await harness.service.provisionWorkspace(transaction.businessTransactionId);
    assert.equal(result.transactionsRoot, "created");
    assert.equal(result.workspace.status, "created");
    assert.deepEqual(result.folders.created, [...REQUIRED_WORKSPACE_FOLDERS]);
    assert.equal(harness.getMapping().recapTransactionId, transaction.databaseId);
    assert.deepEqual(harness.calls[0], ["lock"]);
    assert.deepEqual(harness.calls.filter((call) => call[0] === "site")[0], ["site", "working.example", "/sites/working"]);
    assert.deepEqual(harness.calls.filter((call) => call[0] === "drive")[0], ["drive", "site-working", "Recapitalization Working"]);
    assert.equal(harness.calls.some((call) => JSON.stringify(call).includes("knowledge.example")), false);
    assert.equal(harness.calls.some((call) => JSON.stringify(call).includes("external.example")), false);
});

test("existing Transactions folder is reused and a conflicting file fails safely", async () => {
    const folder = { id: "transactions", name: "Transactions", type: "folder", parentId: "drive-root", webUrl: "url" };
    const reused = makeHarness({ rootChildren: [folder] });
    assert.equal((await reused.service.provisionWorkspace(transaction.businessTransactionId)).transactionsRoot, "reused");
    assert.equal(reused.calls.some((call) => call[0] === "create" && call[2] === "Transactions"), false);

    const conflict = makeHarness({ rootChildren: [{ ...folder, type: "file" }] });
    await assert.rejects(conflict.service.provisionWorkspace(transaction.businessTransactionId), WorkspaceConflictError);
    assert.equal(conflict.calls.some((call) => call[0] === "mapping"), false);
});

test("a concurrent exact-folder create is re-read and safely reused", async () => {
    const harness = makeHarness();
    const originalFind = harness.graph.findChildByExactName;
    let transactionsLookupCount = 0;
    harness.graph.findChildByExactName = async (drive, parent, name) => {
        if (parent === "drive-root" && name === "Transactions") {
            transactionsLookupCount += 1;
            if (transactionsLookupCount === 1) return null;
            return { id: "raced-transactions", name, type: "folder", parentId: parent, webUrl: "url" };
        }
        return originalFind(drive, parent, name);
    };
    const originalCreate = harness.graph.createChildFolder;
    harness.graph.createChildFolder = async (drive, parent, name) => {
        if (parent === "drive-root" && name === "Transactions") {
            throw new GraphRequestError("SharePoint child folder creation", 409, "nameAlreadyExists");
        }
        return originalCreate(drive, parent, name);
    };
    const result = await harness.service.provisionWorkspace(transaction.businessTransactionId);
    assert.equal(result.transactionsRoot, "reused");
    assert.equal(transactionsLookupCount, 2);
});

test("mapped workspace is reused by item ID, tolerates rename, and repairs one missing child", async () => {
    const managed = { id: "transactions", name: "Transactions", type: "folder", parentId: "drive-root", webUrl: "root-url" };
    const workspace = { id: "workspace", name: "Manually Renamed", type: "folder", parentId: "transactions", webUrl: "renamed-url" };
    const existingChildren = REQUIRED_WORKSPACE_FOLDERS.filter((name) => name !== "Artifacts").map((name, index) => ({ id: `child-${index}`, name, type: "folder", parentId: "workspace", webUrl: "url" }));
    const mapping = { recapTransactionId: transaction.databaseId, siteKey: "working", siteId: "site-working", driveId: "drive-working", rootItemId: "workspace", folderName: "Old Name", webUrl: "old-url" };
    const harness = makeHarness({ mapping, rootChildren: [managed], workspaceChildren: [workspace] });
    // The fake stores transaction candidates under Transactions; put required children under the mapped workspace.
    const originalList = harness.graph.listChildren;
    harness.graph.listChildren = async (driveId, parentId) => parentId === "workspace" ? existingChildren : originalList(driveId, parentId);
    harness.graph.findChildByExactName = async (driveId, parentId, name) => (await harness.graph.listChildren(driveId, parentId)).find((item) => item.name === name) || null;
    const originalCreate = harness.graph.createChildFolder;
    harness.graph.createChildFolder = async (driveId, parentId, name) => {
        if (parentId === "workspace") { harness.calls.push(["create", parentId, name]); return { id: "repaired", name, type: "folder", parentId, webUrl: "url" }; }
        return originalCreate(driveId, parentId, name);
    };
    const result = await harness.service.provisionWorkspace(transaction.businessTransactionId);
    assert.equal(result.workspace.status, "reused");
    assert.deepEqual(result.folders.created, ["Artifacts"]);
    assert.ok(harness.calls.some((call) => call[0] === "refresh"));
    assert.equal(harness.calls.filter((call) => call[0] === "create" && call[1] === "transactions").length, 0);
});

test("missing mapped item and conflicting child never create a replacement workspace", async () => {
    const managed = { id: "transactions", name: "Transactions", type: "folder", parentId: "drive-root", webUrl: "url" };
    const mapping = { recapTransactionId: transaction.databaseId, siteKey: "working", siteId: "site-working", driveId: "drive-working", rootItemId: "deleted", folderName: "Old", webUrl: "old" };
    const missing = makeHarness({ mapping, rootChildren: [managed] });
    await assert.rejects(missing.service.provisionWorkspace(transaction.businessTransactionId), WorkspaceConflictError);
    assert.equal(missing.calls.some((call) => call[0] === "create"), false);

    const workspace = { id: "workspace", name: "Workspace", type: "folder", parentId: "transactions", webUrl: "url" };
    const conflictingMapping = { ...mapping, rootItemId: "workspace" };
    const conflict = makeHarness({ mapping: conflictingMapping, rootChildren: [managed], workspaceChildren: [workspace] });
    conflict.graph.findChildByExactName = async (_drive, parent, name) => parent === "workspace" && name === "Reports" ? { id: "file", name, type: "file" } : parent === "drive-root" ? managed : null;
    await assert.rejects(conflict.service.provisionWorkspace(transaction.businessTransactionId), WorkspaceConflictError);
});

test("mapped workspace moved outside Transactions fails before child writes", async () => {
    const managed = { id: "transactions", name: "Transactions", type: "folder", parentId: "drive-root", webUrl: "url" };
    const moved = { id: "workspace", name: "Moved Workspace", type: "folder", parentId: "somewhere-else", webUrl: "moved-url" };
    const mapping = { recapTransactionId: transaction.databaseId, siteKey: "working", siteId: "site-working", driveId: "drive-working", rootItemId: "workspace", folderName: moved.name, webUrl: moved.webUrl };
    const harness = makeHarness({ mapping, rootChildren: [managed], workspaceChildren: [moved] });
    await assert.rejects(harness.service.provisionWorkspace(transaction.businessTransactionId), WorkspaceConflictError);
    assert.equal(harness.calls.some((call) => call[0] === "create"), false);
});

test("partial child failure leaves root mapping and retry can converge", async () => {
    const harness = makeHarness();
    const originalCreate = harness.graph.createChildFolder;
    let failed = false;
    harness.graph.createChildFolder = async (drive, parent, name) => {
        if (name === "Artifacts" && !failed) { failed = true; throw new GraphRequestError("SharePoint child folder creation", 503, "serviceUnavailable"); }
        return originalCreate(drive, parent, name);
    };
    await assert.rejects(harness.service.provisionWorkspace(transaction.businessTransactionId), GraphRequestError);
    const mappedRootId = harness.getMapping()?.rootItemId;
    assert.ok(mappedRootId);
    const retry = await harness.service.provisionWorkspace(transaction.businessTransactionId);
    assert.equal(retry.workspace.status, "reused");
    assert.equal(harness.getMapping().rootItemId, mappedRootId);
    assert.deepEqual(retry.folders.created, ["Artifacts", "Reports", "AI Generated", "Archive"]);
});

async function withServer(user, service, callback) {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { req.user = user; next(); });
    app.use("/api/recapitalization/transactions", createRecapWorkspaceRouter(service));
    const server = app.listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    try { await callback(`http://127.0.0.1:${server.address().port}`); }
    finally { await new Promise((resolve) => server.close(resolve)); }
}

test("provisioning route enforces roles and ignores SharePoint injection fields", async () => {
    const seen = [];
    const service = { provisionWorkspace: async (id) => { seen.push(id); return { transactionId: id, workspaceProvisioned: true }; } };
    const path = "/api/recapitalization/transactions/REC-2026-00000001/sharepoint-workspace";
    await withServer(null, service, async (base) => assert.equal((await fetch(base + path, { method: "POST" })).status, 401));
    await withServer({ id: "ext", globalRole: "ExternalBroker", portalRole: "ExternalBroker" }, service, async (base) => assert.equal((await fetch(base + path, { method: "POST" })).status, 403));
    await withServer({ id: "viewer", globalRole: "Viewer", portalRole: null }, service, async (base) => assert.equal((await fetch(base + path, { method: "POST" })).status, 403));
    for (const role of ["Editor", "PlatformAdmin"]) {
        await withServer({ id: role, globalRole: role, portalRole: null }, service, async (base) => {
            const response = await fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ site: "external", driveId: "attacker", path: "/unsafe" }) });
            assert.equal(response.status, 200);
        });
    }
    assert.deepEqual(seen, ["REC-2026-00000001", "REC-2026-00000001"]);
});

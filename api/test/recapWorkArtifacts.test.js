import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRecapWorkArtifactService, WorkArtifactConflictError, WorkArtifactForbiddenError, WorkArtifactValidationError } from "../src/services/recapWorkArtifactService.js";
import { GraphRequestError } from "../src/integrations/sharepoint/graphClient.js";

const WORK_ID = "11111111-1111-4111-8111-111111111111";
const ART_ID = "22222222-2222-4222-8222-222222222222";
const DOC_ID = "33333333-3333-4333-8333-333333333333";
const baseContext = { workItemId: WORK_ID, requestNumber: "DD-2026-0001", title: "Rent Roll", status: "In Progress", assignedUserId: "owner-a", transactionDatabaseId: "txn-db", businessTransactionId: "REC-2026-00000001", sourcePackageId: "pkg-a" };

function harness({ context = baseContext, uploadError = null, preexistingArtifact = null } = {}) {
    const calls = [];
    let artifact = null;
    let folder = null;
    let lockTail = Promise.resolve();
    const repository = {
        getWorkItemContext: async id => { calls.push(["context", id]); return context; },
        findByContent: async () => { calls.push(["find-content"]); return artifact; },
        getFolder: async () => folder,
        createOrGetFolder: async values => { calls.push(["folder-metadata", values]); folder = { ...values }; return folder; },
        createPending: async values => { calls.push(["pending", values]); artifact = { id: ART_ID, status: "Pending", ...values }; return artifact; },
        restartFailed: async () => calls.push(["restart"]),
        markUploaded: async (_id, _drive, item) => { calls.push(["uploaded", item]); artifact = { ...artifact, status: "Uploaded", uploadedAt: "now" }; return artifact; },
        markFailed: async () => { calls.push(["failed"]); artifact = { ...artifact, status: "Failed" }; },
        list: async id => { calls.push(["list", id]); return [{ id: ART_ID, originalFileName: "report.pdf", contentType: "application/pdf", contentSize: 4, status: "Uploaded", uploadedBy: "Owner", uploadedAt: "now" }]; },
        getForDownload: async (workId, artifactId) => { calls.push(["artifact-download", workId, artifactId]); return workId === WORK_ID && artifactId === ART_ID ? { originalFileName: "report.pdf", contentType: "application/pdf", driveId: "drive", itemId: "file" } : null; },
        listSourceDocuments: async value => { calls.push(["sources", value]); return [{ id: DOC_ID, originalFileName: "source.xlsx", contentSize: 5, uploadedAt: "then" }]; },
        getSourceForDownload: async (value, id) => { calls.push(["source-download", value, id]); return id === DOC_ID ? { originalFileName: "source.xlsx", driveId: "drive", itemId: "source" } : null; },
    };
    const graph = {
        findChildByExactName: async (_drive, parent, name) => {
            calls.push(["find", parent, name]);
            if (parent === "workspace" && name === "Artifacts") return { id: "artifacts-root", name, type: "folder" };
            if (parent === "work-folder") return preexistingArtifact;
            return null;
        },
        createChildFolder: async (_drive, parent, name) => { calls.push(["create-folder", parent, name]); return { id: "work-folder", parentId: parent, name, type: "folder", webUrl: "folder-url" }; },
        getItem: async () => ({ id: "work-folder", parentId: "artifacts-root", name: "folder", type: "folder" }),
        uploadNewFile: async (_drive, parent, name, content) => { calls.push(["upload", parent, name, content.length]); if (uploadError) throw uploadError; return { id: "file", name, size: content.length, type: "file", webUrl: "file-url" }; },
        downloadFile: async (_drive, item) => { calls.push(["download", item]); return { content: Buffer.from("data"), contentType: "application/pdf" }; },
    };
    const service = createRecapWorkArtifactService({ repository,
        workspaceService: { provisionWorkspace: async id => calls.push(["provision", id]) },
        mappingRepository: { withProvisioningLock: async (_id, _key, work) => {
            const previous = lockTail;
            let release;
            lockTail = new Promise(resolve => { release = resolve; });
            await previous;
            calls.push(["lock"]);
            try { return await work(); } finally { release(); }
        }, getByTransaction: async () => ({ siteId: "site", driveId: "drive", rootItemId: "workspace" }) },
        loadConfig: () => ({}), graphClientFactory: () => graph });
    return { service, calls, getArtifact: () => artifact };
}

test("migration 014 creates durable folder and artifact metadata without file bytes", async () => {
    const sql = await readFile(new URL("../src/migrations/014_recap_work_artifacts.sql", import.meta.url), "utf8");
    assert.match(sql, /CREATE TABLE cmdb\.RecapWorkItemSharePointFolders/);
    assert.match(sql, /CREATE TABLE cmdb\.RecapWorkArtifacts/);
    assert.match(sql, /FOREIGN KEY \(workItemId\) REFERENCES cmdb\.RecapWorkItems/);
    assert.match(sql, /ROWVERSION/);
    assert.doesNotMatch(sql, /VARBINARY|FILESTREAM/);
});

test("owner upload derives its transaction and WorkItem folder and completes only after Graph", async () => {
    const value = harness();
    const result = await value.service.upload({ workItemId: WORK_ID, originalFileName: "report.pdf", contentType: "application/pdf", content: Buffer.from("data"), actor: { id: "owner-a", globalRole: "Viewer" }, transactionId: "spoof", driveId: "spoof" });
    assert.equal(result.status, "Uploaded");
    assert.ok(value.calls.some(call => call[0] === "provision" && call[1] === baseContext.businessTransactionId));
    assert.ok(value.calls.some(call => call[0] === "find" && call[1] === "workspace" && call[2] === "Artifacts"));
    assert.ok(value.calls.some(call => call[0] === "create-folder" && call[2].startsWith("DD-2026-0001 - Rent Roll")));
    assert.ok(value.calls.some(call => call[0] === "upload" && call[1] === "work-folder"));
    assert.equal(JSON.stringify(value.calls).includes("spoof"), false);
});

test("upload rejects non-owner and every non-active state before SharePoint work", async () => {
    for (const status of ["Assigned", "Needs DD Review", "Ready to Publish"]) {
        const value = harness({ context: { ...baseContext, status } });
        await assert.rejects(() => value.service.upload({ workItemId: WORK_ID, originalFileName: "file.pdf", contentType: "application/pdf", content: Buffer.from("x"), actor: { id: "owner-a" } }), WorkArtifactForbiddenError);
        assert.equal(value.calls.some(call => call[0] === "provision"), false);
    }
    await assert.rejects(() => harness().service.upload({ workItemId: WORK_ID, originalFileName: "file.pdf", contentType: "application/pdf", content: Buffer.from("x"), actor: { id: "other", globalRole: "PlatformAdmin" } }), WorkArtifactForbiddenError);
});

test("file extension, content type, and 10 MiB limit are server validated", async () => {
    const value = harness();
    await assert.rejects(() => value.service.upload({ workItemId: WORK_ID, originalFileName: "bad.exe", contentType: "application/octet-stream", content: Buffer.from("x"), actor: { id: "owner-a" } }), WorkArtifactValidationError);
    await assert.rejects(() => value.service.upload({ workItemId: WORK_ID, originalFileName: "file.pdf", contentType: "application/x-msdownload", content: Buffer.from("x"), actor: { id: "owner-a" } }), WorkArtifactValidationError);
    await assert.rejects(() => value.service.upload({ workItemId: WORK_ID, originalFileName: "file.pdf", contentType: "application/pdf", content: Buffer.alloc(10 * 1024 * 1024 + 1), actor: { id: "owner-a" } }), WorkArtifactValidationError);
});

test("Graph failure leaves metadata non-visible and retry reuses the failed identity", async () => {
    const failure = harness({ uploadError: new Error("Graph unavailable") });
    await assert.rejects(() => failure.service.upload({ workItemId: WORK_ID, originalFileName: "file.pdf", contentType: "application/pdf", content: Buffer.from("x"), actor: { id: "owner-a" } }));
    assert.ok(failure.calls.some(call => call[0] === "failed"));
    assert.equal(failure.calls.some(call => call[0] === "uploaded"), false);
});

test("concurrent identical uploads refresh metadata inside the lock and create only once", async () => {
    const value = harness();
    const request = { workItemId: WORK_ID, originalFileName: "file.pdf", contentType: "application/pdf", content: Buffer.from("x"), actor: { id: "owner-a" } };
    const results = await Promise.all([value.service.upload(request), value.service.upload(request)]);
    assert.deepEqual(results.map(result => result.status), ["Uploaded", "Uploaded"]);
    assert.equal(value.calls.filter(call => call[0] === "pending").length, 1);
    assert.equal(value.calls.filter(call => call[0] === "upload").length, 1);
    assert.equal(value.calls.filter(call => call[0] === "find-content").length, 2);
    assert.ok(value.calls.findIndex(call => call[0] === "lock") < value.calls.findIndex(call => call[0] === "find-content"));
});

test("same-name same-size SharePoint content is rejected without marking metadata uploaded", async () => {
    const value = harness({ preexistingArtifact: { id: "unowned-file", type: "file", size: 1, webUrl: "file-url" } });
    await assert.rejects(() => value.service.upload({ workItemId: WORK_ID, originalFileName: "file.pdf", contentType: "application/pdf", content: Buffer.from("x"), actor: { id: "owner-a" } }), WorkArtifactConflictError);
    assert.equal(value.calls.some(call => call[0] === "uploaded"), false);
    assert.equal(value.calls.filter(call => call[0] === "failed").length, 1);
});

test("a raced SharePoint create conflict fails closed without associating the remote item", async () => {
    const value = harness({ uploadError: new GraphRequestError("upload", 409, "nameAlreadyExists") });
    await assert.rejects(() => value.service.upload({ workItemId: WORK_ID, originalFileName: "file.pdf", contentType: "application/pdf", content: Buffer.from("x"), actor: { id: "owner-a" } }), WorkArtifactConflictError);
    assert.equal(value.calls.some(call => call[0] === "uploaded"), false);
    assert.equal(value.calls.filter(call => call[0] === "failed").length, 1);
});

test("listing, artifact download, and original submission access are WorkItem-scoped", async () => {
    const value = harness();
    assert.equal((await value.service.list(WORK_ID, { id: "owner-a" }))[0].fileName, "report.pdf");
    assert.equal((await value.service.listSources(WORK_ID, { id: "ops", globalRole: "DDTeam" }))[0].fileName, "source.xlsx");
    assert.equal((await value.service.downloadArtifact(WORK_ID, ART_ID, { id: "ops", globalRole: "PlatformAdmin" })).fileName, "report.pdf");
    assert.equal((await value.service.downloadSource(WORK_ID, DOC_ID, { id: "owner-a" })).fileName, "source.xlsx");
    await assert.rejects(() => value.service.list(WORK_ID, { id: "other", globalRole: "Viewer" }), WorkArtifactForbiddenError);
    await assert.rejects(() => value.service.downloadArtifact(WORK_ID, DOC_ID, { id: "owner-a" }), /not found/);
    assert.ok(value.calls.some(call => call[0] === "artifact-download" && call[1] === WORK_ID && call[2] === DOC_ID));
});

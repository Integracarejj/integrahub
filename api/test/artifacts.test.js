import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import express from "express";
import { createArtifactService, ArtifactConflictError, ArtifactForbiddenError, ArtifactRecoveryRequiredError, ArtifactValidationError, MAX_ARTIFACT_BYTES } from "../src/services/artifactService.js";
import { createArtifactRouter } from "../src/routes/artifacts.js";
import { GraphRequestError } from "../src/integrations/sharepoint/graphClient.js";
import { createArtifactRepository } from "../src/services/artifactRepository.js";

const ARTIFACT_ID = "11111111-1111-4111-8111-111111111111";
const EDITOR = { id: "editor-1", globalRole: "Editor" };
const PDF = Buffer.from("pdf bytes");

function harness({ uploadError = null, finalizeError = null, remote = null, downloadContent = PDF } = {}) {
    const calls = [];
    let row = null;
    let lockTail = Promise.resolve();
    const repository = {
        withIdempotencyLock: async (_actor, _key, work) => { const prior = lockTail; let release; lockTail = new Promise(resolve => { release = resolve; }); await prior; calls.push(["lock"]); try { return await work(); } finally { release(); } },
        getByIdempotency: async () => row,
        createPending: async values => { calls.push(["pending", values]); row = { ...values, ingestionState: "Pending", classificationState: "Unclassified", lifecycleState: "Active", storageDestination: "Working", createdAt: "created", updatedAt: "updated" }; return row; },
        restartFailed: async () => { calls.push(["restart"]); row = { ...row, ingestionState: "Pending" }; return row; },
        recordGraphReceipt: async (_id, identity) => { calls.push(["receipt", identity]); row = { ...row, ...identity }; return row; },
        markUploaded: async () => { calls.push(["uploaded"]); if (finalizeError) throw finalizeError; row = { ...row, ingestionState: "Uploaded", uploadedAt: "uploaded" }; return row; },
        markFailed: async (_id, _actor, _key, reason) => { calls.push(["failed", reason]); row = { ...row, ingestionState: "Failed" }; },
        getById: async id => id === ARTIFACT_ID ? row : null,
        list: async () => row ? [row] : [],
        appendEvent: async event => calls.push(["event", event]),
    };
    const graph = {
        resolveSite: async () => { calls.push(["site"]); return { id: "site" }; },
        findDriveByName: async (_site, name) => { calls.push(["drive", name]); return { id: "drive" }; },
        getDriveRoot: async () => ({ id: "root", type: "folder" }),
        findChildByExactName: async () => remote,
        uploadNewFile: async (_drive, _root, name, content) => { calls.push(["graph-upload", name, content.length]); if (uploadError) throw uploadError; return { id: "item", name, size: content.length, type: "file", webUrl: "private-url" }; },
        getItem: async () => remote,
        downloadFile: async (_drive, _item, bounds) => { calls.push(["graph-download", bounds]); return { content: downloadContent, contentType: "application/pdf" }; },
    };
    const service = createArtifactService({ repository, generateUuid: () => ARTIFACT_ID,
        loadConfig: () => ({ credentials: {}, artifactDestinations: [
            { key: "Projects", hostname: "host", sitePath: "/working", libraryName: "Projects Working" },
            { key: "Legal", hostname: "host", sitePath: "/working", libraryName: "Legal Working" },
            { key: "Operations", hostname: "host", sitePath: "/working", libraryName: "Operations Working" },
        ] }), graphClientFactory: () => graph });
    const request = { originalFileName: "Quarterly Report.pdf", contentType: "application/pdf", content: PDF,
        libraryKey: "Projects", idempotencyKey: "request-0001", sourceContext: "effort-42", actor: EDITOR };
    return { service, repository, graph, request, calls, getRow: () => row, setRow: value => { row = value; } };
}

test("migration 015 is additive, separates states, protects identity, audit, and manual history", async () => {
    const migration = await readFile(new URL("../src/migrations/015_artifact_hub_foundation.sql", import.meta.url), "utf8");
    assert.match(migration, /CREATE TABLE cmdb\.SchemaMigrations/);
    assert.match(migration, /contentSha256 CHAR\(64\)/);
    assert.match(migration, /CREATE TABLE cmdb\.Artifacts/);
    assert.match(migration, /ingestionState/); assert.match(migration, /classificationState/); assert.match(migration, /lifecycleState/);
    assert.match(migration, /UQ_Artifacts_Idempotency UNIQUE \(submittedByUserId, idempotencyKey\)/);
    assert.match(migration, /CREATE UNIQUE INDEX UQ_Artifacts_GraphItem/);
    assert.match(migration, /CREATE TABLE cmdb\.ArtifactEvents/);
    assert.match(migration, /TR_ArtifactEvents_AppendOnly/);
    const checksums = [...migration.matchAll(/DECLARE @contentSha256 CHAR\(64\) = '([0-9A-F]{64})'/g)].map(match => match[1]);
    assert.equal(checksums.length, 1);
    const normalized = migration.replace(/\r\n/g, "\n").replace(/(DECLARE @contentSha256 CHAR\(64\) = ')[0-9A-F]{64}(')/g, `$1${"0".repeat(64)}$2`);
    assert.equal(checksums[0].toLowerCase(), createHash("sha256").update(normalized).digest("hex"));
    assert.match(migration, /SET XACT_ABORT ON/);
    assert.match(migration, /BEGIN TRY[\s\S]*BEGIN TRANSACTION/);
    assert.match(migration, /INSERT INTO cmdb\.SchemaMigrations[\s\S]*COMMIT TRANSACTION/);
    assert.match(migration, /BEGIN CATCH[\s\S]*ROLLBACK TRANSACTION;[\s\S]*THROW;/);
    assert.equal((migration.match(/\bGO\b/g) || []).length, 0);
    assert.doesNotMatch(migration, /REPLACE_WITH/);
    assert.doesNotMatch(migration, /DROP TABLE|TRUNCATE TABLE|DELETE FROM cmdb\./i);
    assert.doesNotMatch(migration, /RecapWorkArtifacts\s+(SET|DROP|DELETE|UPDATE)/i);
});

test("repository creates Pending plus initial audit atomically and uses a transaction-owned application lock", async () => {
    const statements = []; const transaction = { begin: async () => statements.push("BEGIN"), commit: async () => statements.push("COMMIT"), rollback: async () => statements.push("ROLLBACK") };
    const artifact = { id: ARTIFACT_ID, ingestionState: "Pending" };
    const query = async statement => { statements.push(statement); return statement.includes("FROM cmdb.Artifacts") ? [artifact] : []; };
    const queryInTransaction = async (_transaction, statement) => {
        statements.push(statement);
        if (statement.includes("sp_getapplock")) return [{ lockResult: 0 }];
        return [];
    };
    const repository = createArtifactRepository({ query, getPool: async () => ({}), queryInTransaction,
        createTransaction: () => transaction, generateUuid: () => "22222222-2222-4222-8222-222222222222" });
    const values = { id: ARTIFACT_ID, originalFileName: "file.pdf", storedFileName: "stored.pdf", fileExtension: "pdf",
        contentType: "application/pdf", contentSize: 1, contentSha256: "a".repeat(64), libraryKey: "Projects",
        sourceOrigin: "Internal Artifact Upload", sourceModule: "ArtifactHub", sourceContext: null,
        submittedByUserId: EDITOR.id, idempotencyKey: "request-0001" };
    await repository.createPending(values);
    assert.ok(statements.some(statement => String(statement).includes("INSERT INTO cmdb.Artifacts")));
    assert.ok(statements.some(statement => String(statement).includes("INSERT INTO cmdb.ArtifactEvents")));
    assert.ok(statements.indexOf("BEGIN") < statements.findIndex(statement => String(statement).includes("INSERT INTO cmdb.Artifacts")));
    assert.ok(statements.indexOf("COMMIT") > statements.findIndex(statement => String(statement).includes("INSERT INTO cmdb.ArtifactEvents")));
    await repository.withIdempotencyLock(EDITOR.id, "request-0001", async () => "locked");
    assert.ok(statements.some(statement => String(statement).includes("@LockOwner = 'Transaction'")));
});

test("valid Editor upload creates Pending before Graph and persists exact Graph identity", async () => {
    const value = harness();
    const result = await value.service.upload(value.request);
    assert.equal(result.ingestionState, "Uploaded");
    assert.equal(result.classificationState, "Unclassified");
    assert.equal(result.libraryKey, "Projects");
    assert.equal(value.calls.findIndex(([name]) => name === "pending") < value.calls.findIndex(([name]) => name === "graph-upload"), true);
    assert.deepEqual(value.calls.find(([name]) => name === "receipt")[1], { siteId: "site", driveId: "drive", itemId: "item", webUrl: "private-url" });
    assert.match(value.calls.find(([name]) => name === "graph-upload")[1], new RegExp(`^${ARTIFACT_ID}-[0-9a-f]{12}-Quarterly Report\\.pdf$`));
    assert.equal("siteId" in result, false);
});

test("upload rejects external, Viewer, invalid destination, size, and MIME pair before Graph", async () => {
    for (const actor of [{ id: "external", globalRole: "ExternalBroker" }, { id: "viewer", globalRole: "Viewer" }]) {
        const value = harness();
        await assert.rejects(value.service.upload({ ...value.request, actor }), ArtifactForbiddenError);
        assert.equal(value.calls.length, 0);
    }
    const invalid = harness();
    await assert.rejects(invalid.service.upload({ ...invalid.request, libraryKey: "Recapitalization", siteId: "spoof", driveId: "spoof" }), ArtifactValidationError);
    await assert.rejects(invalid.service.upload({ ...invalid.request, originalFileName: "payload.exe", contentType: "application/octet-stream" }), ArtifactValidationError);
    await assert.rejects(invalid.service.upload({ ...invalid.request, contentType: "image/png" }), ArtifactValidationError);
    await assert.rejects(invalid.service.upload({ ...invalid.request, content: Buffer.alloc(MAX_ARTIFACT_BYTES + 1) }), ArtifactValidationError);
    assert.equal(invalid.calls.some(([name]) => name === "site"), false);
});

test("Graph failure records Failed and a retry reuses the same Artifact identity", async () => {
    const value = harness({ uploadError: new GraphRequestError("upload", 503, "serviceUnavailable") });
    await assert.rejects(value.service.upload(value.request), GraphRequestError);
    assert.equal(value.getRow().ingestionState, "Failed");
    assert.deepEqual(value.calls.find(([name]) => name === "failed"), ["failed", "serviceUnavailable"]);
});

test("Graph create collision fails closed and never records a remote identity", async () => {
    const value = harness({ uploadError: new GraphRequestError("upload", 412, "preconditionFailed") });
    await assert.rejects(value.service.upload(value.request), ArtifactConflictError);
    assert.equal(value.getRow().ingestionState, "Failed");
    assert.equal(value.calls.some(([name]) => name === "receipt"), false);
});

test("idempotent retries and concurrent requests produce one Graph upload", async () => {
    const value = harness();
    const results = await Promise.all([value.service.upload(value.request), value.service.upload(value.request)]);
    assert.deepEqual(results.map(result => result.id), [ARTIFACT_ID, ARTIFACT_ID]);
    assert.equal(value.calls.filter(([name]) => name === "pending").length, 1);
    assert.equal(value.calls.filter(([name]) => name === "graph-upload").length, 1);
});

test("same idempotency key with changed bytes conflicts while a different key creates a distinct artifact", async () => {
    const value = harness();
    await value.service.upload(value.request);
    await assert.rejects(value.service.upload({ ...value.request, content: Buffer.from("different") }), ArtifactConflictError);
    const other = harness();
    await other.service.upload({ ...other.request, idempotencyKey: "request-0002", content: Buffer.from("different") });
    assert.equal(other.calls.filter(([name]) => name === "graph-upload").length, 1);
});

test("Graph success followed by SQL failure remains Pending and retry verifies instead of duplicating bytes", async () => {
    const value = harness({ finalizeError: new Error("SQL unavailable") });
    await assert.rejects(value.service.upload(value.request), ArtifactRecoveryRequiredError);
    assert.equal(value.getRow().ingestionState, "Pending");
    assert.equal(value.getRow().itemId, "item");
    assert.equal(value.calls.filter(([name]) => name === "graph-upload").length, 1);
    assert.equal(value.calls.some(([name]) => name === "failed"), false);

    const stored = value.getRow();
    const retry = harness({ remote: { id: "item", name: stored.storedFileName, size: PDF.length, type: "file", webUrl: "private-url" } });
    retry.setRow(stored);
    await retry.service.upload(retry.request);
    assert.equal(retry.calls.filter(([name]) => name === "graph-upload").length, 0);
    assert.equal(retry.calls.filter(([name]) => name === "graph-download").length, 1);
});

test("unverified deterministic-name collision fails closed", async () => {
    const hash = createHash("sha256").update(PDF).digest("hex");
    const pending = { id: ARTIFACT_ID, originalFileName: "Quarterly Report.pdf",
        storedFileName: `${ARTIFACT_ID}-${hash.slice(0, 12)}-Quarterly Report.pdf`, fileExtension: "pdf",
        contentType: "application/pdf", contentSize: PDF.length, contentSha256: hash, libraryKey: "Projects",
        sourceOrigin: "Internal Artifact Upload", sourceModule: "ArtifactHub", sourceContext: "effort-42",
        submittedByUserId: EDITOR.id, idempotencyKey: "request-0001", ingestionState: "Pending",
        classificationState: "Unclassified", lifecycleState: "Active", storageDestination: "Working" };
    const collision = harness({ remote: { id: "other", name: pending.storedFileName, size: PDF.length, type: "file" }, downloadContent: Buffer.from("bad bytes") });
    collision.setRow(pending);
    await assert.rejects(collision.service.upload(collision.request), ArtifactConflictError);
    assert.equal(collision.calls.some(([name]) => name === "receipt"), false);
});

test("read/list/download allow internal roles, omit Graph identity, and audit download", async () => {
    const value = harness(); await value.service.upload(value.request);
    assert.equal((await value.service.get(ARTIFACT_ID, { id: "viewer", globalRole: "Viewer" })).id, ARTIFACT_ID);
    assert.equal((await value.service.list({}, { id: "dd", globalRole: "DDTeam" }))[0].libraryKey, "Projects");
    const file = await value.service.download(ARTIFACT_ID, { id: "viewer", globalRole: "Viewer" });
    assert.equal(file.content.toString(), PDF.toString());
    assert.equal(value.calls.some(([name, event]) => name === "event" && event.eventType === "ArtifactDownloaded"), true);
    await assert.rejects(value.service.download(ARTIFACT_ID, { id: "external", globalRole: "ExternalBuyer" }), ArtifactForbiddenError);
});

test("HTTP routes fail closed for external users and preserve application-only download contract", async () => {
    const calls = [];
    const service = { list: async () => [], get: async () => ({}), upload: async input => { calls.push(input); return { id: ARTIFACT_ID }; },
        download: async () => ({ content: PDF, contentType: "application/pdf", fileName: "report.pdf" }) };
    const app = express();
    app.use((req, _res, next) => { req.user = req.headers["x-role"] ? { id: "actor", globalRole: req.headers["x-role"] } : null; next(); });
    app.use("/api/artifacts", createArtifactRouter(service));
    const server = app.listen(0, "127.0.0.1"); await new Promise(resolve => server.once("listening", resolve));
    try {
        const base = `http://127.0.0.1:${server.address().port}/api/artifacts`;
        assert.equal((await fetch(base, { headers: { "x-role": "ExternalBroker" } })).status, 403);
        const response = await fetch(`${base}/${ARTIFACT_ID}/content`, { headers: { "x-role": "Viewer" } });
        assert.equal(response.status, 200); assert.equal(response.headers.get("content-disposition"), 'attachment; filename="report.pdf"');
        assert.equal(response.headers.has("x-graph-item-id"), false);
    } finally { await new Promise(resolve => server.close(resolve)); }
});

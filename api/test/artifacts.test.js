import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import express from "express";
import { createArtifactService, ArtifactConflictError, ArtifactForbiddenError, ArtifactIntegrityError, ArtifactRecoveryRequiredError, ArtifactValidationError, MAX_ARTIFACT_BYTES, MAX_STORED_ARTIFACT_BYTES } from "../src/services/artifactService.js";
import { createArtifactRouter } from "../src/routes/artifacts.js";
import { GraphRequestError } from "../src/integrations/sharepoint/graphClient.js";
import { ArtifactPlacementReadError, ArtifactPlacementWriteError, ArtifactStoredIdentityConflictError, createArtifactRepository } from "../src/services/artifactRepository.js";

const ARTIFACT_ID = "11111111-1111-4111-8111-111111111111";
const EDITOR = { id: "editor-1", globalRole: "Editor" };
const PDF = Buffer.from("pdf bytes");

function harness({ uploadError = null, receiptError = null, finalizeError = null, remote = null, downloadContent = PDF,
    uploadResponseSize = null, postUploadSize = null } = {}) {
    const calls = [];
    const telemetry = [];
    let row = null;
    let placement = null;
    let physicalContent = downloadContent;
    let lockTail = Promise.resolve();
    const repository = {
        withIdempotencyLock: async (_actor, _key, work) => { const prior = lockTail; let release; lockTail = new Promise(resolve => { release = resolve; }); await prior; calls.push(["lock"]); try { return await work(); } finally { release(); } },
        getByIdempotency: async () => row,
        createPending: async values => { calls.push(["pending", values]); row = { ...values, ingestionState: "Pending", classificationState: "Unclassified", lifecycleState: "Active", createdAt: "created", updatedAt: "updated" }; placement = { id: "placement-1", artifactId: values.id, placementType: values.storageDestination, placementStatus: "Pending", siteKey: values.siteKey, legacyLibraryKey: values.libraryKey, createdByUserId: values.submittedByUserId, siteId: null, driveId: null, itemId: null, webUrl: null, storedContentSize: null, storedContentSha256: null, storedObservedAt: null, activatedAt: null }; return row; },
        restartFailed: async () => { calls.push(["restart"]); row = { ...row, ingestionState: "Pending" }; placement = { ...placement, placementStatus: "Pending" }; return row; },
        recordGraphReceipt: async (_id, identity) => { calls.push(["receipt", identity]); if (receiptError) throw receiptError; row = { ...row, ...identity }; placement = { ...placement, ...identity }; return row; },
        markUploaded: async () => { calls.push(["uploaded"]); if (finalizeError) throw finalizeError; row = { ...row, ingestionState: "Uploaded", uploadedAt: "uploaded" }; placement = { ...placement, placementStatus: "Active", activatedAt: row.uploadedAt }; return row; },
        establishStoredIdentity: async (_id, identity) => {
            calls.push(["stored-identity", identity]);
            if (placement.storedContentSize == null && placement.storedContentSha256 == null) {
                placement = { ...placement, ...identity, storedObservedAt: "observed" };
                return { ...identity, storedObservedAt: "observed", established: true };
            }
            if (placement.storedContentSize !== identity.storedContentSize || placement.storedContentSha256 !== identity.storedContentSha256) {
                throw new ArtifactStoredIdentityConflictError();
            }
            return { ...placement, established: false };
        },
        markFailed: async (_id, _actor, _key, reason) => { calls.push(["failed", reason]); row = { ...row, ingestionState: "Failed" }; placement = { ...placement, placementStatus: "Failed" }; },
        getById: async id => id === ARTIFACT_ID ? row : null,
        getForRead: async id => { calls.push(["read", id]); return id === ARTIFACT_ID ? { ...row,
            storedContentSize: placement?.storedContentSize ?? null,
            storedContentSha256: placement?.storedContentSha256 ?? null,
            storedObservedAt: placement?.storedObservedAt ?? null } : null; },
        list: async filters => { calls.push(["list", filters]); return { rows: row ? [row] : [], total: row ? 1 : 0 }; },
        appendEvent: async event => calls.push(["event", event]),
    };
    const graph = {
        resolveSite: async () => { calls.push(["site"]); return { id: "site" }; },
        findDriveByName: async (_site, name) => { calls.push(["drive", name]); return { id: "drive" }; },
        getDriveRoot: async () => ({ id: "root", type: "folder" }),
        findChildByExactName: async () => remote,
        uploadNewFile: async (_drive, _root, name, content) => { calls.push(["graph-upload", name, content.length]); if (uploadError) throw uploadError; return { id: "item", name,
            size: uploadResponseSize ?? content.length, lastModifiedDateTime: "2026-08-28T12:49:52Z", type: "file", webUrl: "private-url" }; },
        getItem: async (_drive, itemId) => { calls.push(["graph-metadata", itemId]); return remote || (row ? { id: itemId, name: row.storedFileName,
            size: postUploadSize ?? row.contentSize, lastModifiedDateTime: "2026-08-28T12:49:53Z", type: "file", webUrl: row.webUrl } : null); },
        downloadFile: async (_drive, _item, bounds) => {
            calls.push(["graph-download", bounds]);
            if (physicalContent.length > bounds.maxBytes) throw new GraphRequestError("SharePoint file download", 200, "response_too_large");
            if (bounds.expectedSize != null && physicalContent.length !== bounds.expectedSize) {
                throw new GraphRequestError("SharePoint file download", 200, "content_length_mismatch", {
                    expectedSize: bounds.expectedSize, observedSize: physicalContent.length,
                    contentLengthPresent: false, contentEncodingPresent: false,
                });
            }
            return { content: physicalContent, contentType: "application/pdf" };
        },
    };
    const service = createArtifactService({ repository, generateUuid: () => ARTIFACT_ID,
        loadConfig: () => ({ credentials: {}, sites: [
            { key: "knowledge", hostname: "host", sitePath: "/knowledge", libraryName: "Documents" },
        ], artifactDestinations: [
            { key: "Projects", hostname: "host", sitePath: "/working", libraryName: "Projects Working" },
            { key: "Legal", hostname: "host", sitePath: "/working", libraryName: "Legal Working" },
            { key: "Operations", hostname: "host", sitePath: "/working", libraryName: "Operations Working" },
        ] }), graphClientFactory: () => graph, logInfo: (message, fields) => telemetry.push({ message, ...fields }) });
    const request = { originalFileName: "Quarterly Report.pdf", contentType: "application/pdf", content: PDF,
        libraryKey: "Projects", idempotencyKey: "request-0001", sourceContext: "effort-42", actor: EDITOR };
    return { service, repository, graph, request, calls, telemetry, getRow: () => row, getPlacement: () => placement,
        setRow: value => { row = value; }, setPlacement: value => { placement = value; },
        setDownloadContent: value => { physicalContent = value; },
        clearUploadError: () => { uploadError = null; } };
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

test("repository creates Pending Artifact, Working placement, and initial audit atomically and uses a transaction-owned application lock", async () => {
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
    assert.ok(statements.some(statement => String(statement).includes("INSERT INTO cmdb.ArtifactPlacements")));
    assert.ok(statements.some(statement => String(statement).includes("@storageDestination, 'Pending', @siteKey")));
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
    assert.deepEqual(value.getPlacement(), { id: "placement-1", artifactId: ARTIFACT_ID, placementType: "Working",
        placementStatus: "Active", siteKey: "working", legacyLibraryKey: "Projects", createdByUserId: EDITOR.id,
        siteId: "site", driveId: "drive", itemId: "item", webUrl: "private-url",
        storedContentSize: PDF.length, storedContentSha256: createHash("sha256").update(PDF).digest("hex"),
        storedObservedAt: "observed", activatedAt: "uploaded" });
    assert.deepEqual([value.getRow().siteId, value.getRow().driveId, value.getRow().itemId, value.getRow().webUrl],
        [value.getPlacement().siteId, value.getPlacement().driveId, value.getPlacement().itemId, value.getPlacement().webUrl]);
    assert.match(value.calls.find(([name]) => name === "graph-upload")[1], new RegExp(`^${ARTIFACT_ID}-[0-9a-f]{12}-Quarterly Report\\.pdf$`));
    assert.equal("siteId" in result, false);
});

test("optional business metadata is created atomically without changing source identity", async () => {
    const value = harness();
    const artifact = await value.service.upload({ ...value.request, documentTitle: "Quarterly Financial Review",
        documentTypeKey: "report-analysis", businessTopicSlug: "budget", documentOrigin: "DHS", description: "Approved quarterly review." });
    const pending = value.calls.find(([name]) => name === "pending")[1];
    assert.equal(pending.documentTitle, "Quarterly Financial Review");
    assert.equal(pending.documentTypeKey, "report-analysis");
    assert.equal(pending.businessTopicSlug, "budget");
    assert.equal(pending.documentOrigin, "DHS");
    assert.equal(pending.description, "Approved quarterly review.");
    assert.equal(pending.contentSize, value.request.content.length);
    assert.equal(pending.idempotencyKey, value.request.idempotencyKey);
    assert.equal(artifact.documentTitle, "Quarterly Financial Review");
    assert.equal("submittedByUserId" in artifact, false);
});

test("metadata-only repository update cannot mutate source or stored placement identity", async () => {
    const statements = [];
    const transaction = { begin: async () => undefined, commit: async () => undefined, rollback: async () => undefined };
    const repository = createArtifactRepository({ query: async () => [{ id: ARTIFACT_ID }], getPool: async () => ({}), createTransaction: () => transaction,
        queryInTransaction: async (_transaction, statement) => { statements.push(statement); return statement.includes("UPDATE cmdb.Artifacts") ? [{ id: ARTIFACT_ID }] : []; } });
    await repository.updateMetadata(ARTIFACT_ID, { documentTitle: "Corrected", documentOrigin: "Vendor",
        documentTypeKey: "other", businessTopicSlug: "compliance", description: "Corrected context" }, EDITOR.id);
    const update = statements.find(statement => statement.includes("UPDATE cmdb.Artifacts"));
    assert.match(update, /SET documentTitle = @documentTitle/);
    for (const protectedName of ["originalFileName", "contentSize", "contentSha256", "idempotencyKey", "storageDestination",
        "libraryKey", "siteId", "driveId", "itemId", "storedContentSize", "storedContentSha256", "storedObservedAt"]) {
        assert.equal(update.includes(`${protectedName} =`), false, protectedName);
    }
    assert.equal(statements.some(statement => statement.includes("UPDATE cmdb.ArtifactPlacements")), false);
});

test("metadata update authorization is enforced independently of the frontend", async () => {
    const value = harness();
    await assert.rejects(value.service.updateMetadata(ARTIFACT_ID, { documentTitle: "Unauthorized" },
        { id: "viewer", globalRole: "Viewer" }), ArtifactForbiddenError);
    assert.equal(value.calls.some(([name]) => name === "metadata-update"), false);
});

test("metadata PATCH returns 403 for an authenticated read-only user before repository access", async () => {
    const service = createArtifactService({ repository: new Proxy({}, { get: () => () => { throw new Error("repository must not be called"); } }) });
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { req.user = { id: "viewer", globalRole: "Viewer" }; next(); });
    app.use("/api/artifacts", createArtifactRouter(service));
    const server = app.listen(0, "127.0.0.1"); await new Promise(resolve => server.once("listening", resolve));
    try {
        const response = await fetch(`http://127.0.0.1:${server.address().port}/api/artifacts/${ARTIFACT_ID}/metadata`, {
            method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ documentTitle: "Unauthorized" }),
        });
        assert.equal(response.status, 403);
        assert.deepEqual(await response.json(), { error: "Artifact Hub access denied" });
    } finally { await new Promise(resolve => server.close(resolve)); }
});

test("OOXML-like upload catalogs the exact service Buffer length and hash sent to Graph", async () => {
    const content = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x08, 0xff, 0x80, 0x00, 0x7f]);
    const value = harness({ downloadContent: content });
    await value.service.upload({ ...value.request, originalFileName: "report.docx",
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", content });
    assert.equal(value.getRow().contentSize, content.byteLength);
    assert.equal(value.getRow().contentSha256, createHash("sha256").update(content).digest("hex"));
    assert.equal(value.calls.find(([name]) => name === "graph-upload")[2], content.byteLength);
});

test("upload telemetry reports matching Graph response and immediate metadata sizes", async () => {
    const content = Buffer.alloc(15196, 0x5a);
    const value = harness({ uploadResponseSize: 15196, postUploadSize: 15196, downloadContent: content });
    const result = await value.service.upload({ ...value.request, content });
    assert.equal(result.ingestionState, "Uploaded");
    assert.deepEqual(value.telemetry, [
        { message: "Artifact upload size telemetry", stage: "artifact-upload-response", inputByteSize: 15196,
            uploadResponseByteSize: 15196, uploadResponseMatchesInput: true, sizeDeltaBytes: 0,
            uploadResponseLastModifiedDateTime: "2026-08-28T12:49:52Z" },
        { message: "Artifact upload size telemetry", stage: "artifact-post-upload-metadata", inputByteSize: 15196,
            postUploadDriveItemSize: 15196, postUploadMatchesInput: true, sizeDeltaBytes: 0,
            postUploadLastModifiedDateTime: "2026-08-28T12:49:53Z" },
    ]);
});

test("upload telemetry observes divergence present in the Graph upload response without blocking success", async () => {
    const stored = Buffer.alloc(20960, 0x6b);
    const value = harness({ uploadResponseSize: 20960, postUploadSize: 20960, downloadContent: stored });
    const result = await value.service.upload({ ...value.request, content: Buffer.alloc(15196, 0x5a) });
    assert.equal(result.ingestionState, "Uploaded");
    assert.deepEqual(value.telemetry.map(entry => [entry.stage, entry.inputByteSize,
        entry.uploadResponseByteSize ?? entry.postUploadDriveItemSize,
        entry.uploadResponseMatchesInput ?? entry.postUploadMatchesInput, entry.sizeDeltaBytes]), [
        ["artifact-upload-response", 15196, 20960, false, 5764],
        ["artifact-post-upload-metadata", 15196, 20960, false, 5764],
    ]);
});

test("upload telemetry observes divergence after the Graph upload response and exposes no sensitive fields", async () => {
    const value = harness({ uploadResponseSize: 15196, postUploadSize: 20960, downloadContent: Buffer.alloc(20960, 0x6b) });
    const result = await value.service.upload({ ...value.request, content: Buffer.alloc(15196, 0x5a) });
    assert.equal(result.ingestionState, "Uploaded");
    assert.equal(value.telemetry[0].uploadResponseMatchesInput, true);
    assert.equal(value.telemetry[1].postUploadMatchesInput, false);
    assert.equal(value.telemetry[1].sizeDeltaBytes, 5764);
    const serialized = JSON.stringify(value.telemetry);
    for (const forbidden of [ARTIFACT_ID, "site", "drive", "item", "Quarterly Report.pdf", "private-url", "token", createHash("sha256").update(Buffer.alloc(15196, 0x5a)).digest("hex")]) {
        assert.equal(serialized.includes(forbidden), false);
    }
    for (const forbiddenKey of ["siteId", "driveId", "itemId", "storedFileName", "originalFileName", "content", "token", "url", "hash"]) {
        assert.equal(Object.hasOwn(value.telemetry[0], forbiddenKey) || Object.hasOwn(value.telemetry[1], forbiddenKey), false);
    }
});

test("transformed Office upload preserves source identity and records placement physical identity", async () => {
    const source = Buffer.alloc(15193, 0x31);
    const stored = Buffer.alloc(21210, 0x42);
    const value = harness({ uploadResponseSize: stored.length, postUploadSize: stored.length, downloadContent: stored });
    const result = await value.service.upload({ ...value.request, originalFileName: "DocumentHub_SizeTest.docx",
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", content: source });
    assert.equal(result.ingestionState, "Uploaded");
    assert.equal(value.getRow().contentSize, source.length);
    assert.equal(value.getRow().contentSha256, createHash("sha256").update(source).digest("hex"));
    assert.equal(value.getPlacement().storedContentSize, stored.length);
    assert.equal(value.getPlacement().storedContentSha256, createHash("sha256").update(stored).digest("hex"));
    assert.notEqual(value.getRow().contentSha256, value.getPlacement().storedContentSha256);
});

test("near-limit source accepts a transformed physical representation through 20 MiB and rejects larger physical content", async () => {
    const source = Buffer.alloc(MAX_ARTIFACT_BYTES, 0x31);
    const stored = Buffer.alloc(MAX_ARTIFACT_BYTES + 1, 0x42);
    const accepted = harness({ uploadResponseSize: stored.length, postUploadSize: stored.length, downloadContent: stored });
    await accepted.service.upload({ ...accepted.request, content: source });
    assert.equal(accepted.getRow().contentSize, MAX_ARTIFACT_BYTES);
    assert.equal(accepted.getPlacement().storedContentSize, MAX_ARTIFACT_BYTES + 1);
    assert.equal(accepted.calls.find(([name]) => name === "graph-download")[1].maxBytes, MAX_STORED_ARTIFACT_BYTES);

    const rejected = harness({ uploadResponseSize: MAX_STORED_ARTIFACT_BYTES + 1,
        postUploadSize: MAX_STORED_ARTIFACT_BYTES + 1, downloadContent: Buffer.from("not-read") });
    await assert.rejects(rejected.service.upload(rejected.request), ArtifactRecoveryRequiredError);
    assert.equal(rejected.getRow().ingestionState, "Pending");
    assert.equal(rejected.getPlacement().storedContentSize, null);
    assert.equal(rejected.calls.some(([name]) => name === "graph-download"), false);
});

test("transformed placement downloads by stored identity and retains the original browser filename", async () => {
    const source = Buffer.alloc(15196, 0x31);
    const stored = Buffer.alloc(20960, 0x42);
    const value = harness({ uploadResponseSize: stored.length, postUploadSize: stored.length, downloadContent: stored });
    await value.service.upload({ ...value.request, originalFileName: "Test_DocHub1.docx",
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", content: source });
    const file = await value.service.download(ARTIFACT_ID, { id: "viewer", globalRole: "Viewer" });
    assert.equal(file.fileName, "Test_DocHub1.docx");
    assert.deepEqual(file.content, stored);
    assert.equal(value.calls.some(([name, event]) => name === "event" && event.eventType === "ArtifactDownloaded"), true);
});

test("same-size and different-size SharePoint mutation fail against established placement identity", async () => {
    const original = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x10]);
    const value = harness({ uploadResponseSize: original.length, postUploadSize: original.length, downloadContent: original });
    await value.service.upload({ ...value.request, originalFileName: "report.docx",
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", content: original });

    value.setDownloadContent(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x11]));
    await assert.rejects(value.service.download(ARTIFACT_ID, { id: "viewer", globalRole: "Viewer" }),
        error => error instanceof ArtifactIntegrityError && error.diagnostics.sizeMatched === true
            && error.diagnostics.hashMatched === false);

    value.setDownloadContent(Buffer.concat([original, Buffer.from([0x12])]));
    await assert.rejects(value.service.download(ARTIFACT_ID, { id: "viewer", globalRole: "Viewer" }),
        error => error instanceof ArtifactIntegrityError && error.diagnostics.sizeMatched === false
            && error.diagnostics.expectedStoredSize === original.length);
});

test("stored SHA casing is normalized without changing physical identity", async () => {
    const original = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x10]);
    const value = harness({ uploadResponseSize: original.length, postUploadSize: original.length, downloadContent: original });
    await value.service.upload({ ...value.request, originalFileName: "case.docx",
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", content: original });
    value.setPlacement({ ...value.getPlacement(), storedContentSha256: value.getPlacement().storedContentSha256.toUpperCase() });
    assert.deepEqual((await value.service.download(ARTIFACT_ID,
        { id: "viewer", globalRole: "Viewer" })).content, original);
});

test("legacy placement lazily establishes stored identity on first successful download", async () => {
    const physical = Buffer.alloc(20960, 0x42);
    const value = harness({ downloadContent: physical, postUploadSize: physical.length });
    const sourceHash = createHash("sha256").update(Buffer.alloc(15196, 0x31)).digest("hex");
    value.setRow({ id: ARTIFACT_ID, originalFileName: "legacy.docx", storedFileName: "private-legacy.docx",
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", contentSize: 15196,
        contentSha256: sourceHash, ingestionState: "Uploaded", classificationState: "Unclassified", lifecycleState: "Active",
        storageDestination: "Working", libraryKey: "Projects", siteId: "site", driveId: "drive", itemId: "item" });
    value.setPlacement({ id: "placement-1", artifactId: ARTIFACT_ID, placementType: "Working", placementStatus: "Active",
        siteId: "site", driveId: "drive", itemId: "item", storedContentSize: null, storedContentSha256: null, storedObservedAt: null });
    const file = await value.service.download(ARTIFACT_ID, { id: "viewer", globalRole: "Viewer" });
    assert.deepEqual(file.content, physical);
    assert.equal(value.getPlacement().storedContentSize, physical.length);
    assert.equal(value.getPlacement().storedContentSha256, createHash("sha256").update(physical).digest("hex"));
    assert.equal(value.calls.find(([name]) => name === "graph-download")[1].expectedSize, physical.length);
});

test("Knowledge upload uses Documents and creates one Knowledge placement without Work area", async () => {
    const value = harness();
    const result = await value.service.upload({ ...value.request, libraryKey: undefined, destination: "Knowledge", workArea: null });
    assert.equal(result.storageDestination, "Knowledge");
    assert.equal(result.libraryKey, null);
    assert.equal(value.calls.filter(([name]) => name === "pending").length, 1);
    assert.deepEqual(value.calls.find(([name]) => name === "drive"), ["drive", "Documents"]);
    assert.deepEqual(value.getPlacement(), { id: "placement-1", artifactId: ARTIFACT_ID, placementType: "Knowledge",
        placementStatus: "Active", siteKey: "knowledge", legacyLibraryKey: null, createdByUserId: EDITOR.id,
        siteId: "site", driveId: "drive", itemId: "item", webUrl: "private-url",
        storedContentSize: PDF.length, storedContentSha256: createHash("sha256").update(PDF).digest("hex"),
        storedObservedAt: "observed", activatedAt: "uploaded" });
    await value.service.upload({ ...value.request, libraryKey: undefined, destination: "Knowledge", workArea: null });
    assert.equal(value.calls.filter(([name]) => name === "pending").length, 1);
    assert.equal(value.calls.filter(([name]) => name === "graph-upload").length, 1);
});

test("upload rejects external, Viewer, invalid destination, size, and MIME pair before Graph", async () => {
    for (const actor of [{ id: "external", globalRole: "ExternalBroker" }, { id: "viewer", globalRole: "Viewer" }]) {
        const value = harness();
        await assert.rejects(value.service.upload({ ...value.request, actor }), ArtifactForbiddenError);
        assert.equal(value.calls.length, 0);
    }
    const invalid = harness();
    await assert.rejects(invalid.service.upload({ ...invalid.request, libraryKey: "Recapitalization", siteId: "spoof", driveId: "spoof" }), ArtifactValidationError);
    await assert.rejects(invalid.service.upload({ ...invalid.request, libraryKey: "Knowledge" }), ArtifactValidationError);
    await assert.rejects(invalid.service.upload({ ...invalid.request, libraryKey: "External" }), ArtifactValidationError);
    await assert.rejects(invalid.service.upload({ ...invalid.request, originalFileName: "payload.exe", contentType: "application/octet-stream" }), ArtifactValidationError);
    await assert.rejects(invalid.service.upload({ ...invalid.request, contentType: "image/png" }), ArtifactValidationError);
    await assert.rejects(invalid.service.upload({ ...invalid.request, content: Buffer.alloc(MAX_ARTIFACT_BYTES + 1) }), ArtifactValidationError);
    assert.equal(invalid.calls.some(([name]) => name === "site"), false);
});

test("Graph failure records Failed and a retry reuses the same Artifact identity", async () => {
    const value = harness({ uploadError: new GraphRequestError("upload", 503, "serviceUnavailable") });
    await assert.rejects(value.service.upload(value.request), GraphRequestError);
    assert.equal(value.getRow().ingestionState, "Failed");
    assert.equal(value.getPlacement().placementStatus, "Failed");
    assert.equal(value.getPlacement().itemId, null);
    assert.deepEqual(value.calls.find(([name]) => name === "failed"), ["failed", "serviceUnavailable"]);
    value.clearUploadError();
    await value.service.upload(value.request);
    assert.equal(value.calls.filter(([name]) => name === "pending").length, 1);
    assert.equal(value.calls.filter(([name]) => name === "restart").length, 1);
    assert.equal(value.getPlacement().id, "placement-1");
    assert.equal(value.getPlacement().placementStatus, "Active");
    assert.deepEqual([value.getRow().siteId, value.getRow().driveId, value.getRow().itemId, value.getRow().webUrl],
        [value.getPlacement().siteId, value.getPlacement().driveId, value.getPlacement().itemId, value.getPlacement().webUrl]);
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
    assert.equal(value.getPlacement().id, "placement-1");
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

test("transformed upload with receipt survives finalization failure and retry uses stored rather than source identity", async () => {
    const source = Buffer.alloc(15193, 0x31); const physical = Buffer.alloc(21210, 0x42);
    const request = { ...harness().request, originalFileName: "recovery.docx",
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", content: source };
    const value = harness({ finalizeError: new Error("SQL unavailable"), uploadResponseSize: physical.length,
        postUploadSize: physical.length, downloadContent: physical });
    await assert.rejects(value.service.upload(request), ArtifactRecoveryRequiredError);
    assert.equal(value.getRow().ingestionState, "Pending");
    assert.equal(value.getRow().itemId, "item");
    assert.equal(value.calls.filter(([name]) => name === "graph-upload").length, 1);
    assert.equal(value.calls.some(([name]) => name === "failed"), false);

    const stored = value.getRow();
    const storedPlacement = value.getPlacement();
    const retry = harness({ remote: { id: "item", name: stored.storedFileName, size: physical.length, type: "file", webUrl: "private-url" },
        downloadContent: physical });
    retry.setRow(stored);
    retry.setPlacement(storedPlacement);
    await retry.service.upload(request);
    assert.equal(retry.calls.filter(([name]) => name === "graph-upload").length, 0);
    assert.equal(retry.calls.filter(([name]) => name === "graph-download").length, 1);
    assert.equal(retry.getPlacement().id, "placement-1");
    assert.equal(retry.getPlacement().placementStatus, "Active");
    assert.equal(retry.getRow().contentSize, source.length);
    assert.equal(retry.getPlacement().storedContentSize, physical.length);
});

test("receipt-less transformed item remains Pending for reconciliation without adoption, failure, or duplicate upload", async () => {
    const source = Buffer.alloc(15193, 0x31); const physical = Buffer.alloc(21210, 0x42);
    const value = harness({ receiptError: new Error("SQL unavailable"), uploadResponseSize: physical.length,
        postUploadSize: physical.length, downloadContent: physical });
    const request = { ...value.request, originalFileName: "receiptless.docx",
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", content: source,
        libraryKey: undefined, destination: "Working", workArea: "Operations" };
    await assert.rejects(value.service.upload(request), ArtifactRecoveryRequiredError);
    assert.equal(value.getRow().ingestionState, "Pending");
    assert.equal(value.getRow().itemId, undefined);
    assert.equal(value.getPlacement().id, "placement-1");
    assert.equal(value.getPlacement().placementStatus, "Pending");
    assert.equal(value.calls.filter(([name]) => name === "graph-upload").length, 1);

    const stored = value.getRow();
    const retry = harness({ remote: { id: "item", name: stored.storedFileName, size: physical.length, type: "file", webUrl: "private-url" },
        downloadContent: physical });
    retry.setRow(stored); retry.setPlacement(value.getPlacement());
    await assert.rejects(retry.service.upload(request), ArtifactRecoveryRequiredError);
    assert.equal(retry.calls.filter(([name]) => name === "graph-upload").length, 0);
    assert.equal(retry.calls.filter(([name]) => name === "graph-download").length, 0);
    assert.equal(retry.calls.filter(([name]) => name === "receipt").length, 0);
    assert.equal(retry.calls.some(([name]) => name === "failed"), false);
    assert.equal(retry.getPlacement().id, "placement-1");
    assert.equal(retry.getPlacement().placementStatus, "Pending");
    assert.equal(retry.getRow().ingestionState, "Pending");
    assert.equal(retry.getRow().itemId, undefined);
});

test("placement update predicates qualify identity columns in joined SQL", async () => {
    const statements = [];
    const transaction = { begin: async () => undefined, commit: async () => undefined, rollback: async () => undefined };
    const repository = createArtifactRepository({ query: async () => [{ id: ARTIFACT_ID }], getPool: async () => ({}), createTransaction: () => transaction,
        queryInTransaction: async (_transaction, statement) => {
            statements.push(statement);
            return statement.includes("UPDATE cmdb.Artifacts") ? [{ id: ARTIFACT_ID }] : [{ id: "placement-1" }];
        } });
    await repository.recordGraphReceipt(ARTIFACT_ID, { siteId: "site", driveId: "drive", itemId: "item", webUrl: "url" });
    const placementUpdate = statements.find(statement => statement.includes("UPDATE placement"));
    assert.match(placementUpdate, /placement\.itemId IS NULL/);
    assert.match(placementUpdate, /placement\.siteId = @siteId/);
    assert.match(placementUpdate, /placement\.driveId = @driveId/);
    assert.match(placementUpdate, /placement\.itemId = @itemId/);
});

test("stored identity establishment locks one placement and cannot overwrite a concurrent different identity", async () => {
    const statements = [];
    let stored = { id: "placement-1", storedContentSize: null, storedContentSha256: null, storedObservedAt: null };
    const transaction = { begin: async () => statements.push("BEGIN"), commit: async () => statements.push("COMMIT"), rollback: async () => statements.push("ROLLBACK") };
    const repository = createArtifactRepository({ getPool: async () => ({}), createTransaction: () => transaction,
        queryInTransaction: async (_transaction, statement, params) => {
            statements.push(statement);
            if (statement.includes("WITH (UPDLOCK, HOLDLOCK)")) return [{ ...stored }];
            if (statement.includes("UPDATE cmdb.ArtifactPlacements")) {
                stored = { ...stored, storedContentSize: params.storedContentSize,
                    storedContentSha256: params.storedContentSha256, storedObservedAt: "observed" };
                return [{ ...stored }];
            }
            return [];
        } });
    const firstHash = "a".repeat(64);
    const secondHash = "b".repeat(64);
    assert.equal((await repository.establishStoredIdentity(ARTIFACT_ID,
        { storedContentSize: 21210, storedContentSha256: firstHash })).established, true);
    assert.equal((await repository.establishStoredIdentity(ARTIFACT_ID,
        { storedContentSize: 21210, storedContentSha256: firstHash })).established, false);
    assert.equal((await repository.establishStoredIdentity(ARTIFACT_ID,
        { storedContentSize: 21210, storedContentSha256: firstHash.toUpperCase() })).established, false);
    await assert.rejects(repository.establishStoredIdentity(ARTIFACT_ID,
        { storedContentSize: 21210, storedContentSha256: secondHash }), ArtifactStoredIdentityConflictError);
    assert.equal(stored.storedContentSha256, firstHash);
    assert.ok(statements.some(statement => String(statement).includes("WITH (UPDLOCK, HOLDLOCK)")));
    assert.ok(statements.includes("ROLLBACK"));
});

test("repository rolls back Artifact state when a Working placement is missing or duplicated", async () => {
    for (const placementCount of [0, 2]) {
        const statements = [];
        const transaction = { begin: async () => statements.push("BEGIN"), commit: async () => statements.push("COMMIT"), rollback: async () => statements.push("ROLLBACK") };
        const repository = createArtifactRepository({ query: async () => [], getPool: async () => ({}), createTransaction: () => transaction,
            queryInTransaction: async (_transaction, statement) => {
                statements.push(statement);
                if (statement.includes("UPDATE cmdb.Artifacts")) return [{ id: ARTIFACT_ID, uploadedAt: new Date() }];
                if (statement.includes("ArtifactPlacements placement")) return Array.from({ length: placementCount }, (_, index) => ({ id: String(index) }));
                return [];
            } });
        await assert.rejects(repository.markUploaded(ARTIFACT_ID, EDITOR.id, "request-0001"), ArtifactPlacementWriteError);
        assert.equal(statements.includes("ROLLBACK"), true);
        assert.equal(statements.includes("COMMIT"), false);
    }
});

test("unverified deterministic-name match remains Pending and is never adopted", async () => {
    const hash = createHash("sha256").update(PDF).digest("hex");
    const pending = { id: ARTIFACT_ID, originalFileName: "Quarterly Report.pdf",
        storedFileName: `${ARTIFACT_ID}-${hash.slice(0, 12)}-Quarterly Report.pdf`, fileExtension: "pdf",
        contentType: "application/pdf", contentSize: PDF.length, contentSha256: hash, libraryKey: "Projects",
        sourceOrigin: "Internal Artifact Upload", sourceModule: "ArtifactHub", sourceContext: "effort-42",
        submittedByUserId: EDITOR.id, idempotencyKey: "request-0001", ingestionState: "Pending",
        classificationState: "Unclassified", lifecycleState: "Active", storageDestination: "Working" };
    const collision = harness({ remote: { id: "other", name: pending.storedFileName, size: PDF.length, type: "file" }, downloadContent: Buffer.from("bad bytes") });
    collision.setRow(pending);
    await assert.rejects(collision.service.upload(collision.request), ArtifactRecoveryRequiredError);
    assert.equal(collision.calls.some(([name]) => name === "receipt"), false);
    assert.equal(collision.calls.some(([name]) => name === "graph-download"), false);
    assert.equal(collision.calls.some(([name]) => name === "graph-upload"), false);
    assert.equal(collision.calls.some(([name]) => name === "failed"), false);
    assert.equal(collision.getRow().ingestionState, "Pending");
});

test("read/list/download allow internal roles, omit Graph identity, and audit download", async () => {
    const value = harness(); await value.service.upload(value.request);
    const detail = await value.service.get(ARTIFACT_ID, { id: "viewer", globalRole: "Viewer" });
    assert.equal(detail.id, ARTIFACT_ID);
    for (const privateField of ["siteId", "driveId", "itemId", "webUrl", "storedFileName", "contentSha256", "idempotencyKey"]) {
        assert.equal(privateField in detail, false);
    }
    const listed = await value.service.list({}, { id: "dd", globalRole: "DDTeam" });
    assert.equal(listed.artifacts[0].libraryKey, "Projects");
    assert.deepEqual({ total: listed.total, page: listed.page, pageSize: listed.pageSize }, { total: 1, page: 1, pageSize: 25 });
    const file = await value.service.download(ARTIFACT_ID, { id: "viewer", globalRole: "Viewer" });
    assert.equal(file.content.toString(), PDF.toString());
    assert.equal(value.calls.filter(([name]) => name === "read").length, 2);
    assert.equal(value.calls.some(([name, event]) => name === "event" && event.eventType === "ArtifactDownloaded"), true);
    await assert.rejects(value.service.download(ARTIFACT_ID, { id: "external", globalRole: "ExternalBuyer" }), ArtifactForbiddenError);
});

test("list validates and maps search, area, type, date, pagination, and newest-first defaults", async () => {
    const value = harness(); await value.service.upload(value.request);
    const result = await value.service.list({ q: "Quarterly", libraryKey: "Projects", fileType: "word", dateRange: "7days", page: "2", pageSize: "25", sort: "name" }, { id: "viewer", globalRole: "Viewer" });
    assert.equal(result.total, 1);
    const filters = value.calls.find(([name]) => name === "list")[1];
    assert.equal(filters.q, "Quarterly"); assert.equal(filters.libraryKey, "Projects");
    assert.deepEqual(filters.extensions, ["doc", "docx"]); assert.equal(filters.offset, 25);
    assert.match(filters.uploadedFrom, /^\d{4}-\d{2}-\d{2}$/); assert.equal(filters.sort, "name");
    for (const invalid of [{ pageSize: 101 }, { q: "x".repeat(201) }, { fileType: "video" }, { dateRange: "year" }, { sort: "private" }]) {
        await assert.rejects(value.service.list(invalid, { id: "viewer", globalRole: "Viewer" }), ArtifactValidationError);
    }
    await assert.rejects(value.service.list({}, { id: "external", globalRole: "ExternalBroker" }), ArtifactForbiddenError);
});

test("repository search is bounded to active uploaded rows with count, filters, pagination, and safe sorting", async () => {
    const calls = [];
    const repository = createArtifactRepository({ query: async (statement, params) => {
        calls.push([statement, params]);
        if (statement.includes("SELECT TOP (1)")) return [];
        return statement.includes("SELECT COUNT_BIG(*) AS total") ? [{ total: 3 }] : [];
    } });
    const result = await repository.list({ pageSize: 25, offset: 0, libraryKey: "Legal", documentTypeKey: "contract-agreement",
        businessTopicSlug: "compliance", q: "Agreement", extensions: ["pdf"], uploadedFrom: "2026-08-01", sort: "newest" });
    assert.equal(result.total, 3); assert.equal(calls.length, 3);
    for (const [statement] of calls.slice(1)) {
        assert.match(statement, /lifecycleState = 'Active'/); assert.match(statement, /ingestionState = 'Uploaded'/);
        assert.match(statement, /originalFileName LIKE/); assert.match(statement, /fileExtension IN \(@extension0\)/);
        assert.match(statement, /documentTitle LIKE/); assert.match(statement, /documentOrigin LIKE/);
        assert.match(statement, /documentType\.displayName LIKE/); assert.match(statement, /businessTopic\.displayName LIKE/);
        assert.match(statement, /artifact\.documentTypeKey = @documentTypeKey/); assert.match(statement, /artifact\.businessTopicSlug = @businessTopicSlug/);
        assert.match(statement, /OUTER APPLY/); assert.match(statement, /placementType = artifact\.storageDestination/);
    }
    assert.match(calls[0][0], /placementCount > 1/);
    assert.match(calls[1][0], /COALESCE\(working\.legacyLibraryKey, artifact\.libraryKey\) = @libraryKey/);
    assert.match(calls[2][0], /ORDER BY artifact\.uploadedAt DESC/);
    assert.match(calls[2][0], /OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY/);
});

test("placement-aware detail fails closed for migrated missing, mismatched, or duplicate Working placements", async () => {
    const base = { id: ARTIFACT_ID, ingestionState: "Uploaded", storageDestination: "Working", createdAt: new Date("2026-01-01"),
        placementMigrationAppliedAt: new Date("2026-02-01"), legacyArtifactLibraryKey: "Projects",
        legacyArtifactSiteId: "site", legacyArtifactDriveId: "legacy-drive", legacyArtifactItemId: "legacy-item",
        legacyArtifactWebUrl: "legacy-url", placementLibraryKey: "Projects", placementSiteId: "site",
        placementDriveId: "legacy-drive", placementItemId: "legacy-item", placementWebUrl: "legacy-url" };
    for (const row of [
        { ...base, workingPlacementCount: 0 },
        { ...base, workingPlacementCount: 2 },
        { ...base, workingPlacementCount: 1, placementItemId: "different-item" },
    ]) {
        const repository = createArtifactRepository({ query: async () => [row] });
        await assert.rejects(repository.getForRead(ARTIFACT_ID), ArtifactPlacementReadError);
    }
});

test("placement-aware detail prefers exact Working placement and permits explicit post-migration legacy fallback", async () => {
    const base = { id: ARTIFACT_ID, ingestionState: "Uploaded", storageDestination: "Working", createdAt: new Date("2026-01-01"),
        placementMigrationAppliedAt: new Date("2026-02-01"), workingPlacementCount: 1,
        legacyArtifactLibraryKey: "Projects", legacyArtifactSiteId: "legacy-site", legacyArtifactDriveId: "legacy-drive",
        legacyArtifactItemId: "legacy-item", legacyArtifactWebUrl: "legacy-url", placementLibraryKey: "Projects",
        placementSiteId: "legacy-site", placementDriveId: "legacy-drive", placementItemId: "legacy-item",
        placementWebUrl: "legacy-url", libraryKey: "Projects", siteId: "legacy-site", driveId: "legacy-drive",
        itemId: "legacy-item", webUrl: "legacy-url" };
    const exact = createArtifactRepository({ query: async () => [base] });
    assert.equal((await exact.getForRead(ARTIFACT_ID)).itemId, "legacy-item");

    const postMigration = { ...base, createdAt: new Date("2026-03-01"), workingPlacementCount: 0,
        workingPlacementId: null, placementLibraryKey: null, placementSiteId: null, placementDriveId: null,
        placementItemId: null, placementWebUrl: null };
    const fallback = createArtifactRepository({ query: async () => [postMigration] });
    assert.equal((await fallback.getForRead(ARTIFACT_ID)).itemId, "legacy-item");

    const missingKnowledge = { ...postMigration, storageDestination: "Knowledge", libraryKey: null, legacyArtifactLibraryKey: null };
    const knowledgeRepository = createArtifactRepository({ query: async () => [missingKnowledge] });
    await assert.rejects(knowledgeRepository.getForRead(ARTIFACT_ID), ArtifactPlacementReadError);
});

test("download resolves through placement-aware repository identity and preserves event behavior", async () => {
    const calls = [];
    const placementRow = { id: ARTIFACT_ID, originalFileName: "report.pdf", contentType: "application/pdf",
        contentSize: PDF.length, ingestionState: "Uploaded", lifecycleState: "Active",
        driveId: "placement-drive", itemId: "placement-item", storedContentSize: PDF.length,
        storedContentSha256: createHash("sha256").update(PDF).digest("hex") };
    const repository = {
        getForRead: async () => placementRow,
        getById: async () => { throw new Error("legacy detail lookup must not be used"); },
        establishStoredIdentity: async (_id, identity) => { calls.push(["stored-identity", identity]); return { ...identity, established: true }; },
        appendEvent: async event => calls.push(["event", event]),
    };
    const graph = { downloadFile: async (driveId, itemId, bounds) => {
        calls.push(["download", driveId, itemId, bounds]);
        return { content: PDF, contentType: "application/pdf" };
    } };
    const service = createArtifactService({ repository, loadConfig: () => ({}), graphClientFactory: () => graph });
    const file = await service.download(ARTIFACT_ID, { id: "viewer", globalRole: "Viewer" });
    assert.equal(file.fileName, "report.pdf");
    assert.deepEqual(calls[0].slice(0, 3), ["download", "placement-drive", "placement-item"]);
    assert.equal(calls[1][1].eventType, "ArtifactDownloaded");
});

test("HTTP routes fail closed for external users and preserve application-only download contract", async () => {
    const calls = [];
    const service = { list: async () => ({ artifacts: [], total: 0, page: 1, pageSize: 25 }), get: async () => ({}), upload: async input => { calls.push(input); return { id: ARTIFACT_ID }; },
        download: async () => ({ content: PDF, contentType: "application/pdf", fileName: "report.pdf" }) };
    const app = express();
    app.use((req, _res, next) => { req.user = req.headers["x-role"] ? { id: "actor", globalRole: req.headers["x-role"] } : null; next(); });
    app.use("/api/artifacts", createArtifactRouter(service));
    const server = app.listen(0, "127.0.0.1"); await new Promise(resolve => server.once("listening", resolve));
    try {
        const base = `http://127.0.0.1:${server.address().port}/api/artifacts`;
        assert.equal((await fetch(base, { headers: { "x-role": "ExternalBroker" } })).status, 403);
        const word = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0xff, 0x80, 0x00, 0x7f]);
        const uploaded = await fetch(base, { method: "POST", headers: { "x-role": "Editor",
            "content-type": "application/octet-stream", "x-file-name": "report.docx",
            "x-file-content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "x-artifact-destination": "Knowledge", "idempotency-key": "binary-route-test" }, body: word });
        assert.equal(uploaded.status, 201);
        assert.equal(Buffer.isBuffer(calls[0].content), true);
        assert.equal(calls[0].content.byteLength, word.byteLength);
        assert.deepEqual(calls[0].content, word);
        const response = await fetch(`${base}/${ARTIFACT_ID}/content`, { headers: { "x-role": "Viewer" } });
        assert.equal(response.status, 200); assert.equal(response.headers.get("content-disposition"), 'attachment; filename="report.pdf"');
        assert.equal(response.headers.has("x-graph-item-id"), false);
    } finally { await new Promise(resolve => server.close(resolve)); }
});

test("physical integrity mismatch returns sanitized 409 and logs only safe diagnostics", async () => {
    const diagnostics = { expectedStoredSize: 15196, observedSize: 20960, sizeMatched: false,
        hashMatched: null, storedIdentityExisted: true, lifecycleStage: "download",
        itemId: "private-item", hash: "a".repeat(64), url: "https://private" };
    const service = { download: async () => { throw new ArtifactIntegrityError(diagnostics); } };
    const app = express();
    app.use((req, _res, next) => { req.user = { id: "viewer", globalRole: "Viewer" }; next(); });
    app.use("/api/artifacts", createArtifactRouter(service));
    const logged = [];
    const originalError = console.error;
    console.error = (...values) => logged.push(values);
    const server = app.listen(0, "127.0.0.1"); await new Promise(resolve => server.once("listening", resolve));
    try {
        const response = await fetch(`http://127.0.0.1:${server.address().port}/api/artifacts/${ARTIFACT_ID}/content`);
        assert.equal(response.status, 409);
        assert.deepEqual(await response.json(), { error: "Artifact content integrity check failed", code: "artifact_content_mismatch" });
        const serialized = JSON.stringify(logged);
        for (const forbidden of ["private-item", "a".repeat(64), "https://private", "itemId", "url"]) {
            assert.equal(serialized.includes(forbidden), false);
        }
        assert.match(serialized, /expectedStoredSize/);
        assert.match(serialized, /lifecycleStage/);
    } finally {
        console.error = originalError;
        await new Promise(resolve => server.close(resolve));
    }
});

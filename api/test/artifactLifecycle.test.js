import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createArtifactService, ArtifactConflictError, ArtifactForbiddenError,
    ArtifactIntegrityError, ArtifactLifecycleRecoveryRequiredError, ArtifactNotFoundError,
    ArtifactValidationError } from "../src/services/artifactService.js";

const ID = "11111111-1111-4111-8111-111111111111";
const ACTOR = { id: "editor-1", globalRole: "Editor" };
const BYTES = Buffer.from("stored physical document bytes");
const HASH = createHash("sha256").update(BYTES).digest("hex");

function lifecycleHarness({ destination = "Knowledge", libraryKey = null, uploadError = null, failFinalizeOnce = false,
    sourceBytes = BYTES, recordedSourceBytes = sourceBytes, destinationBytes = sourceBytes } = {}) {
    const calls = [];
    let row = {
        id: ID, originalFileName: "Employee Handbook.docx", storedFileName: `${ID}-stored-Employee Handbook.docx`,
        fileExtension: "docx", contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        contentSize: 15196, contentSha256: "a".repeat(64), ingestionState: "Uploaded", classificationState: "Confirmed",
        lifecycleState: "Active", storageDestination: destination, libraryKey, siteId: "source-site", driveId: "source-drive",
        itemId: "source-item", sourceOrigin: "Internal Artifact Upload", sourceModule: "ArtifactHub", sourceContext: null,
        documentTitle: "Employee Handbook", documentTypeKey: "policy", documentTypeName: "Policy",
        businessTopicSlug: "employee-lifecycle", businessTopicName: "Employee Lifecycle", businessTopicGroup: "Workforce",
        documentOrigin: "HR", description: "Current handbook", effectiveDate: null, submittedByDisplayName: "Editor",
        uploadedAt: "2026-08-30", createdAt: "2026-08-30", updatedAt: "2026-08-30",
        workingPlacementId: "source-placement", storedContentSize: recordedSourceBytes.length,
        storedContentSha256: createHash("sha256").update(recordedSourceBytes).digest("hex"),
    };
    let pending = null;
    let oldStatus = "Active";
    let finalizeFailures = failFinalizeOnce ? 1 : 0;
    const events = [];
    const repository = {
        withLifecycleLock: async (_id, work) => work(),
        getForRead: async id => id === ID && row.lifecycleState === "Active" ? { ...row } : null,
        getById: async id => id === ID ? { ...row } : null,
        getMoveOperation: async (_id, key) => pending?.operationKey === key ? { ...pending } : null,
        beginMove: async (_id, values) => {
            calls.push(["begin", values]);
            pending = { id: "target-placement", artifactId: ID, placementType: values.placementType,
                placementStatus: "Pending", legacyLibraryKey: values.legacyLibraryKey, operationKey: values.operationKey,
                siteId: null, driveId: null, itemId: null, webUrl: null };
            events.push({ eventType: "ArtifactMoveStarted" });
            return { ...pending };
        },
        recordMoveReceipt: async (_id, _key, identity) => { calls.push(["receipt", identity]); pending = { ...pending, ...identity }; return { ...pending }; },
        completeMove: async (_id, _key, sourcePlacementId) => {
            calls.push(["complete", sourcePlacementId]);
            if (finalizeFailures-- > 0) throw new Error("sql unavailable");
            oldStatus = "Retracted"; pending = { ...pending, placementStatus: "Active" };
            row = { ...row, storageDestination: pending.placementType, libraryKey: pending.legacyLibraryKey,
                siteId: pending.siteId, driveId: pending.driveId, itemId: pending.itemId,
                workingPlacementId: pending.id, storedContentSize: pending.storedContentSize,
                storedContentSha256: pending.storedContentSha256 };
            events.push({ eventType: "ArtifactMoved" });
            return { ...row };
        },
        recordMoveFailure: async (_id, key, _actor, reason) => events.push({ eventType: "ArtifactMoveFailed", key, reason }),
        appendEvent: async event => { events.push(event); },
        establishStoredIdentity: async () => undefined,
        remove: async (_id, _actor, reason) => {
            calls.push(["remove", reason]); row = { ...row, lifecycleState: "Removed" };
            events.push({ eventType: "ArtifactRemoved", reason }); return { id: ID, removed: true };
        },
    };
    const graph = {
        resolveSite: async (_host, path) => ({ id: `site:${path}` }),
        findDriveByName: async (_site, name) => ({ id: `drive:${name}` }),
        getDriveRoot: async () => ({ id: "root", type: "folder" }),
        findChildByExactName: async () => null,
        uploadNewFile: async (_drive, _root, name, content) => {
            calls.push(["upload", content]); if (uploadError) throw uploadError;
            return { id: "target-item", name, size: content.length, type: "file", webUrl: "private" };
        },
        getItem: async (drive, item) => ({ id: item, name: row.storedFileName,
            size: drive === "source-drive" ? sourceBytes.length : destinationBytes.length,
            type: "file", webUrl: "private" }),
        downloadFile: async (drive, item) => { calls.push(["download", drive, item]);
            return { content: drive === "source-drive" ? sourceBytes : destinationBytes, contentType: row.contentType }; },
    };
    const service = createArtifactService({ repository, graphClientFactory: () => graph,
        loadConfig: () => ({ credentials: {}, sites: [{ key: "knowledge", hostname: "host", sitePath: "/knowledge", libraryName: "Documents" }],
            artifactDestinations: ["Projects", "Legal", "Operations"].map(key => ({ key, hostname: "host", sitePath: "/working", libraryName: `${key} Working` })) }) });
    return { service, calls, events, row: () => row, pending: () => pending, oldStatus: () => oldStatus };
}

test("migration 020 adds retry identity, strict active/pending cardinality, and Move events safely", async () => {
    const migration = await readFile(new URL("../src/migrations/020_artifact_lifecycle.sql", import.meta.url), "utf8");
    assert.match(migration, /operationKey VARCHAR\(128\).*NULL/);
    assert.match(migration, /UQ_ArtifactPlacements_ActiveArtifact[\s\S]*placementStatus = 'Active'/);
    assert.match(migration, /UQ_ArtifactPlacements_PendingArtifact[\s\S]*placementStatus = 'Pending'/);
    assert.match(migration, /UQ_ArtifactPlacements_Operation/);
    assert.match(migration, /EXEC\(N'CREATE UNIQUE INDEX UQ_ArtifactPlacements_Operation/);
    assert.match(migration, /columnInfo\.collation_name = 'Latin1_General_100_BIN2'/);
    for (const event of ["ArtifactMoveStarted", "ArtifactMoved", "ArtifactMoveFailed", "ArtifactRemoved"]) assert.match(migration, new RegExp(event));
    assert.doesNotMatch(migration, /DELETE FROM|DROP TABLE|TRUNCATE TABLE|ALTER TABLE cmdb\.Artifacts/);
    const checksum = migration.match(/DECLARE @contentSha256 CHAR\(64\) = '([0-9A-F]{64})'/)?.[1];
    const normalized = migration.replace(/\r\n/g, "\n").replace(/(DECLARE @contentSha256 CHAR\(64\) = ')[0-9A-F]{64}(')/g, `$1${"0".repeat(64)}$2`);
    assert.equal(checksum?.toLowerCase(), createHash("sha256").update(normalized).digest("hex"));
    assert.match(migration, /SET XACT_ABORT ON[\s\S]*BEGIN TRY[\s\S]*BEGIN TRANSACTION/);
    assert.match(migration, /INSERT INTO cmdb\.SchemaMigrations[\s\S]*COMMIT TRANSACTION/);
});

for (const scenario of [
    { name: "Knowledge to Working", from: ["Knowledge", null], to: ["Working", "Operations"] },
    { name: "Working to Knowledge", from: ["Working", "Projects"], to: ["Knowledge", null] },
    { name: "Working area to Working area", from: ["Working", "Projects"], to: ["Working", "Legal"] },
]) test(`move preserves logical identity and metadata for ${scenario.name}`, async () => {
    const value = lifecycleHarness({ destination: scenario.from[0], libraryKey: scenario.from[1] });
    const before = { ...value.row() };
    const moved = await value.service.move(ID, { destination: scenario.to[0], workArea: scenario.to[1], idempotencyKey: `move-${scenario.name.replaceAll(" ", "-")}` }, ACTOR);
    assert.equal(moved.id, ID); assert.equal(moved.storageDestination, scenario.to[0]); assert.equal(moved.libraryKey, scenario.to[1]);
    for (const field of ["originalFileName", "contentSize", "contentSha256", "documentTitle", "description"]) assert.equal(value.row()[field], before[field]);
    assert.equal(value.oldStatus(), "Retracted"); assert.equal(value.pending().placementStatus, "Active");
    assert.deepEqual(value.calls.find(call => call[0] === "upload")[1], BYTES);
    assert.equal(value.pending().storedContentSize, BYTES.length);
    assert.equal(value.pending().storedContentSha256, HASH);
    await value.service.download(ID, ACTOR);
    assert.deepEqual(value.calls.filter(call => call[0] === "download").at(-1).slice(1),
        [`drive:${scenario.to[1] ? `${scenario.to[1]} Working` : "Documents"}`, "target-item"]);
    assert.equal(value.events.some(event => event.eventType === "ArtifactMoved"), true);
});

test("move rejects no-op, External, and unauthorized requests", async () => {
    const value = lifecycleHarness({ destination: "Working", libraryKey: "Projects" });
    await assert.rejects(value.service.move(ID, { destination: "Working", workArea: "Projects", idempotencyKey: "move-noop" }, ACTOR), ArtifactValidationError);
    await assert.rejects(value.service.move(ID, { destination: "External", workArea: null, idempotencyKey: "move-external" }, ACTOR), ArtifactValidationError);
    await assert.rejects(value.service.move(ID, { destination: "Knowledge", workArea: null, idempotencyKey: "move-viewer" }, { id: "viewer", globalRole: "Viewer" }), ArtifactForbiddenError);
});

test("failed and interrupted moves retain the old active placement and retry without a duplicate upload", async () => {
    const failed = lifecycleHarness({ uploadError: new Error("graph unavailable") });
    await assert.rejects(failed.service.move(ID, { destination: "Working", workArea: "Legal", idempotencyKey: "move-failed" } , ACTOR));
    assert.equal(failed.row().storageDestination, "Knowledge"); assert.equal(failed.oldStatus(), "Active");
    assert.equal(failed.pending().placementStatus, "Pending");

    const retry = lifecycleHarness({ failFinalizeOnce: true });
    const request = { destination: "Working", workArea: "Legal", idempotencyKey: "move-retry" };
    await assert.rejects(retry.service.move(ID, request, ACTOR), ArtifactLifecycleRecoveryRequiredError);
    await retry.service.move(ID, request, ACTOR);
    assert.equal(retry.calls.filter(call => call[0] === "upload").length, 1);
    assert.equal(retry.row().storageDestination, "Working"); assert.equal(retry.oldStatus(), "Retracted");
});

test("Move records a transformed Office destination as its own physical identity", async () => {
    const transformed = Buffer.from("SharePoint-transformed destination Office bytes");
    const value = lifecycleHarness({ destinationBytes: transformed });
    const before = { ...value.row() };
    await value.service.move(ID, { destination: "Working", workArea: "Operations", idempotencyKey: "move-transformed" }, ACTOR);
    assert.equal(value.row().contentSize, before.contentSize);
    assert.equal(value.row().contentSha256, before.contentSha256);
    assert.equal(value.pending().storedContentSize, transformed.length);
    assert.equal(value.pending().storedContentSha256, createHash("sha256").update(transformed).digest("hex"));
    assert.notEqual(value.pending().storedContentSha256, before.storedContentSha256);
    assert.equal(value.oldStatus(), "Retracted");
});

test("Move rejects changed source-placement bytes before any destination upload", async () => {
    const recorded = Buffer.from("recorded SharePoint source bytes");
    const changed = Buffer.from("mutated SharePoint source bytes!");
    const value = lifecycleHarness({ sourceBytes: changed, recordedSourceBytes: recorded });
    await assert.rejects(value.service.move(ID, { destination: "Working", workArea: "Operations",
        idempotencyKey: "move-source-mismatch" }, ACTOR), error => error instanceof ArtifactIntegrityError
            && error.diagnostics.lifecycleStage === "download");
    assert.equal(value.calls.some(call => call[0] === "upload"), false);
    assert.equal(value.oldStatus(), "Active");
    assert.equal(value.row().storageDestination, "Knowledge");
    assert.equal(value.pending().placementStatus, "Pending");
});

test("remove is authorized, audited, non-destructive, and deterministic", async () => {
    const value = lifecycleHarness();
    await assert.rejects(value.service.remove(ID, {}, { id: "viewer", globalRole: "Viewer" }), ArtifactForbiddenError);
    assert.deepEqual(await value.service.remove(ID, { reason: "Duplicate" }, ACTOR), { id: ID, removed: true });
    assert.equal(value.row().lifecycleState, "Removed"); assert.equal(value.oldStatus(), "Active");
    assert.equal(value.calls.some(call => call[0] === "delete"), false);
    assert.equal(value.events.some(event => event.eventType === "ArtifactRemoved"), true);
    assert.equal(value.row().id, ID); assert.equal(value.pending(), null);
    await assert.rejects(value.service.download(ID, ACTOR), ArtifactNotFoundError);
    await assert.rejects(value.service.remove(ID, {}, ACTOR), ArtifactConflictError);
});

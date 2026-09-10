import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import express from "express";
import {
    createRecapPublicationService, RecapPublicationConflictError, RecapPublicationForbiddenError,
    RecapPublicationNotFoundError, RecapPublicationRecoveryRequiredError, RecapPublicationValidationError,
} from "../src/services/recapPublicationService.js";
import { createRecapPublicationRepository } from "../src/services/recapPublicationRepository.js";
import { createRecapWorkItemsRouter } from "../src/routes/recapWorkItems.js";

const WORK = "11111111-1111-4111-8111-111111111111";
const PUBLICATION = "22222222-2222-4222-8222-222222222222";
const ARTIFACT = "33333333-3333-4333-8333-333333333333";
const VERSION = "0x0000000000000001";
const SOURCE = Buffer.from("authoritative bytes");

function harness({ status = "Ready to Publish", member = true, publicationStatus = null, failAfterUpload = false, unknownCollision = false, beginRace = false, loseUploadResponse = false } = {}) {
    const calls = [];
    let publication = publicationStatus ? { id: PUBLICATION, workItemId: WORK, publicationNumber: 1, operationKey: "publish:key", targetExternalOrganizationId: "ORG-A", status: publicationStatus, version: VERSION, publishedAt: "now" } : null;
    let artifactStatus = "Pending";
    const items = new Map([
        ["source", { id: "source", name: "report - abc.pdf", type: "file", size: SOURCE.length, content: SOURCE }],
        ["copy", { id: "copy", name: "report - abc.pdf", type: "file", size: SOURCE.length, content: SOURCE }],
        ["root", { id: "root", name: "root", type: "folder" }],
    ]);
    let next = 0;
    let pendingMetadataFailure = failAfterUpload;
    const repository = {
        getInternalContext: async () => ({ workItemId: WORK, requestNumber: "DD-2026-1", title: "Report", status, workItemVersion: VERSION, assignedUserId: "owner", businessTransactionId: "REC-2026-00000001", transactionName: "Keystone", owningExternalOrganizationId: "ORG-A" }),
        getByOperation: async (_workItemId, operationKey) => publication?.operationKey === operationKey ? publication : null,
        begin: async (_context, operationKey) => { calls.push(["begin", operationKey]); if (status !== "Ready to Publish" || (publication?.status === "Pending" && publication.operationKey !== operationKey)) throw new Error("cannot be started"); publication = { id: PUBLICATION, workItemId: WORK, publicationNumber: 1, operationKey, targetExternalOrganizationId: "ORG-A", status: "Pending", version: VERSION }; if (beginRace) throw new Error("Publication cannot be started or is stale"); return publication; },
        listArtifacts: async () => [{ publicationId: PUBLICATION, artifactId: ARTIFACT, sourceDriveId: "working-drive", sourceItemId: "source", storedFileName: "report - abc.pdf", status: artifactStatus, originalFileName: "report.pdf", contentType: "application/pdf", knowledgeSiteId: artifactStatus === "Pending" ? null : "knowledge-site", knowledgeDriveId: artifactStatus === "Pending" ? null : "knowledge-drive", knowledgeItemId: artifactStatus === "Pending" ? null : "copy" }],
        recordReceipt: async (_publicationId, _artifactId, identity) => { calls.push(["receipt", identity]); artifactStatus = "Receipt"; },
        activateArtifact: async (_publicationId, _artifactId, identity) => { calls.push(["activate", identity]); artifactStatus = "Active"; },
        complete: async () => { calls.push(["complete"]); publication = { ...publication, status: "Published", publishedAt: "now", version: VERSION }; return publication; },
        listForExternalUser: async userId => member && userId === "partner" && publication?.status !== "Pending" ? [{ ...publication, requestNumber: "DD-2026-1", title: "Report", description: "D", businessTransactionId: "REC-2026-00000001", transactionName: "Keystone", workItemStatus: publication.status === "Approved" ? "Completed" : "Waiting Partner Review" }] : [],
        getExternalPublication: async userId => member && userId === "partner" && publication?.status === "Published" ? publication : null,
        getExternalArtifact: async userId => member && userId === "partner" ? { knowledgeDriveId: "knowledge-drive", knowledgeItemId: "copy", storedFileName: "report - abc.pdf", storedContentSize: SOURCE.length, storedContentSha256: createHash("sha256").update(SOURCE).digest("hex"), originalFileName: "report.pdf", contentType: "application/pdf" } : null,
        partnerAction: async (_id, userId, org, action, guidance) => { calls.push(["partner", userId, org, action, guidance]); publication = { ...publication, status: action === "approve" ? "Approved" : "Rework Requested", partnerGuidance: guidance, version: "0x0000000000000002" }; return publication; },
    };
    const graph = {
        resolveSite: async () => ({ id: "knowledge-site" }), findDriveByName: async () => ({ id: "knowledge-drive" }), getDriveRoot: async () => items.get("root"),
        findChildByExactName: async (_drive, parent, name) => (unknownCollision && name === "report - abc.pdf" ? items.get("copy") : null) || [...items.values()].find(item => item.parentId === parent && item.name === name) || null,
        createChildFolder: async (_drive, parentId, name) => { const item = { id: `folder-${++next}`, parentId, name, type: "folder" }; items.set(item.id, item); return item; },
        getItem: async (_drive, id) => { if (id === "copy" && pendingMetadataFailure) { pendingMetadataFailure = false; throw new Error("response lost"); } return items.get(id); },
        downloadFile: async (_drive, id, options) => { calls.push(["download", id, options]); return { content: items.get(id).content, contentType: "application/pdf" }; },
        uploadNewFile: async (_drive, parentId, name, content) => { calls.push(["upload", parentId, name]); const item = { id: "copy", parentId, name, type: "file", size: content.length, content: Buffer.from(content), webUrl: "private" }; items.set(item.id, item); if (loseUploadResponse) throw new Error("upload response lost"); return item; },
    };
    const service = createRecapPublicationService({ repository, loadConfig: () => ({ sites: [{ key: "knowledge", hostname: "host", sitePath: "/knowledge", libraryName: "Documents" }] }), graphClientFactory: () => graph });
    return { service, calls, repository, getPublication: () => publication };
}

test("migration 022 defines authoritative publication history and recalculable checksum", async () => {
    const sql = await readFile(new URL("../src/migrations/022_recap_external_publication.sql", import.meta.url), "utf8");
    assert.match(sql, /CREATE TABLE cmdb\.RecapPublications/); assert.match(sql, /CREATE TABLE cmdb\.RecapPublishedArtifacts/);
    assert.match(sql, /'Waiting Partner Review'/); assert.match(sql, /'PartnerRequestedRework'/);
    assert.match(sql, /publicationEligibility VARCHAR\(16\)[\s\S]*'Active'/);
    assert.match(sql, /publicationEligibility = ''Superseded''/);
    assert.match(sql, /sys\.default_constraints[\s\S]*DF_RecapWorkArtifacts_PublicationEligibility[\s\S]*'''Active'''/);
    assert.match(sql, /columnInfo\.name = 'supersededByArtifactId'[\s\S]*typeInfo\.name = 'uniqueidentifier'/);
    assert.match(sql, /columnInfo\.name = 'supersededAt'[\s\S]*typeInfo\.name = 'datetime2'[\s\S]*columnInfo\.scale = 3/);
    assert.match(sql, /columnInfo\.name = 'supersededByUserId'[\s\S]*typeInfo\.name = 'varchar'/);
    assert.match(sql, /FK_RecapWorkArtifacts_SupersededByArtifact/);
    assert.match(sql, /FK_RecapWorkArtifacts_SupersededByUser/);
    assert.match(sql, /status IN \('Pending', 'Receipt', 'Active'\)/);
    assert.match(sql, /publicationCardinalityScope AS \(CASE WHEN status IN \('Pending', 'Published'\) THEN 0 ELSE 1 END\) PERSISTED/);
    assert.match(sql, /publicationCardinalityKey AS \(CASE WHEN status IN \('Pending', 'Published'\) THEN workItemId ELSE id END\) PERSISTED/);
    assert.match(sql, /CREATE UNIQUE INDEX UQ_RecapPublications_OpenWorkItem\s+ON cmdb\.RecapPublications\(publicationCardinalityScope, publicationCardinalityKey\);/);
    assert.match(sql, /indexInfo\.has_filter = 0/);
    const checksum = sql.match(/DECLARE @contentSha256 CHAR\(64\) = '([0-9A-F]{64})'/)?.[1];
    const normalized = sql.replace(/\r\n/g, "\n").replace(/(DECLARE @contentSha256 CHAR\(64\) = ')[0-9A-F]{64}(')/, `$1${"0".repeat(64)}$2`);
    assert.equal(checksum, createHash("sha256").update(normalized).digest("hex").toUpperCase());
});

test("migration 022 never references a computed column from a filtered-index predicate", async () => {
    const sql = await readFile(new URL("../src/migrations/022_recap_external_publication.sql", import.meta.url), "utf8");
    const computedColumns = new Set([...sql.matchAll(/^\s*([A-Za-z][A-Za-z0-9]*)\s+AS\s*\(/gm)].map(match => match[1]));
    const indexStatements = [...sql.matchAll(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+[\s\S]*?;/gi)].map(match => match[0]);

    for (const statement of indexStatements) {
        const predicate = statement.match(/\bWHERE\b([\s\S]*?);/i)?.[1];
        if (!predicate) continue;
        for (const column of computedColumns) {
            assert.doesNotMatch(predicate, new RegExp(`\\b${column}\\b`, "i"), `${column} is computed and cannot appear in a filtered-index predicate`);
        }
    }
});

test("publish copies exact Working bytes to deterministic Knowledge hierarchy and retains source", async () => {
    const value = harness();
    const result = await value.service.publish(WORK, { expectedVersion: VERSION, idempotencyKey: "publish:key" }, { id: "dd", globalRole: "DDTeam" });
    assert.equal(result.status, "Published"); assert.equal(result.externalOrganizationId, "ORG-A");
    assert.equal(value.calls.filter(call => call[0] === "upload").length, 1);
    assert.ok(value.calls.some(call => call[0] === "download" && call[1] === "source"));
    assert.ok(value.calls.some(call => call[0] === "receipt")); assert.ok(value.calls.some(call => call[0] === "activate")); assert.ok(value.calls.some(call => call[0] === "complete"));
});

test("publication retry with the same operation returns the durable publication without another copy", async () => {
    const value = harness(); const input = { expectedVersion: VERSION, idempotencyKey: "publish:key" };
    await value.service.publish(WORK, input, { id: "dd", globalRole: "PlatformAdmin" });
    await value.service.publish(WORK, input, { id: "dd", globalRole: "PlatformAdmin" });
    assert.equal(value.calls.filter(call => call[0] === "upload").length, 1);
});

test("partial Knowledge copy failure is recoverable without duplicate destination bytes", async () => {
    const value = harness({ failAfterUpload: true }); const input = { expectedVersion: VERSION, idempotencyKey: "publish:key" };
    await assert.rejects(() => value.service.publish(WORK, input, { id: "dd", globalRole: "DDTeam" }), RecapPublicationRecoveryRequiredError);
    assert.equal((await value.service.publish(WORK, input, { id: "dd", globalRole: "DDTeam" })).status, "Published");
    assert.equal(value.calls.filter(call => call[0] === "upload").length, 1);
});

test("unknown Knowledge filename collision fails closed while a receipt-bound item resumes", async () => {
    const collision = harness({ unknownCollision: true });
    await assert.rejects(() => collision.service.publish(WORK, { expectedVersion: VERSION, idempotencyKey: "publish:key" }, { id: "dd", globalRole: "DDTeam" }), /unverified item/);
    assert.equal(collision.calls.some(call => call[0] === "receipt"), false);
    const receipt = harness({ failAfterUpload: true });
    await assert.rejects(() => receipt.service.publish(WORK, { expectedVersion: VERSION, idempotencyKey: "publish:key" }, { id: "dd", globalRole: "DDTeam" }), RecapPublicationRecoveryRequiredError);
    await receipt.service.publish(WORK, { expectedVersion: VERSION, idempotencyKey: "publish:key" }, { id: "dd", globalRole: "DDTeam" });
    assert.equal(receipt.calls.filter(call => call[0] === "upload").length, 1);
});

test("response loss before receipt leaves an unknown orphan that cannot be adopted", async () => {
    const value = harness({ loseUploadResponse: true });
    const request = () => value.service.publish(WORK, { expectedVersion: VERSION, idempotencyKey: "publish:key" }, { id: "dd", globalRole: "DDTeam" });
    await assert.rejects(request, /upload response lost/);
    await assert.rejects(request, /unverified item/);
    assert.equal(value.calls.some(call => call[0] === "receipt"), false);
});

test("same-operation begin race converges on the winning durable publication", async () => {
    const value = harness({ beginRace: true });
    assert.equal((await value.service.publish(WORK, { expectedVersion: VERSION, idempotencyKey: "publish:key" }, { id: "dd", globalRole: "DDTeam" })).status, "Published");
    assert.equal(value.calls.filter(call => call[0] === "upload").length, 1);
});

test("a different operation cannot adopt an existing open publication", async () => {
    const value = harness({ publicationStatus: "Pending" });
    await assert.rejects(() => value.service.publish(WORK, { expectedVersion: VERSION, idempotencyKey: "publish:different" }, { id: "dd", globalRole: "DDTeam" }), RecapPublicationConflictError);
    assert.equal(value.calls.some(call => call[0] === "upload"), false);
});

test("publish fails closed for unauthorized actors, invalid state, and invalid operation identity", async () => {
    await assert.rejects(() => harness().service.publish(WORK, { expectedVersion: VERSION, idempotencyKey: "publish:key" }, { id: "viewer", globalRole: "Viewer" }), RecapPublicationForbiddenError);
    await assert.rejects(() => harness().service.publish(WORK, { expectedVersion: VERSION, idempotencyKey: "short" }, { id: "dd", globalRole: "DDTeam" }), RecapPublicationValidationError);
    await assert.rejects(() => harness({ status: "Needs DD Review" }).service.publish(WORK, { expectedVersion: VERSION, idempotencyKey: "publish:key" }, { id: "dd", globalRole: "DDTeam" }), /cannot be started/);
});

test("external read and Knowledge download are organization-scoped and server-mediated", async () => {
    const value = harness({ publicationStatus: "Published" });
    assert.equal((await value.service.listExternal({ id: "partner", portalRole: "ExternalBuyer" }))[0].requestId, "DD-2026-1");
    assert.deepEqual(await value.service.listExternal({ id: "outsider", portalRole: "ExternalBuyer" }), []);
    assert.equal((await value.service.downloadExternal(PUBLICATION, ARTIFACT, { id: "partner", portalRole: "ExternalBuyer" })).fileName, "report.pdf");
    await assert.rejects(() => value.service.downloadExternal(PUBLICATION, ARTIFACT, { id: "outsider", portalRole: "ExternalBuyer" }), RecapPublicationNotFoundError);
    await assert.rejects(() => value.service.downloadExternal(PUBLICATION, ARTIFACT, { id: "partner", portalRole: "Viewer" }), RecapPublicationForbiddenError);
});

test("external portal Graph failures expose no Graph classification", async () => {
    const source = await readFile(new URL("../src/routes/portal.js", import.meta.url), "utf8");
    assert.match(source, /portal Graph operation failed[\s\S]*graphCode/);
    assert.doesNotMatch(source, /res\.status\(502\)\.json\(\{[^}]*graphCode/);
});

test("partner approve and rework are durable, organization-bound, and rework requires guidance", async () => {
    const approved = harness({ publicationStatus: "Published" });
    assert.equal((await approved.service.partnerAction(PUBLICATION, { action: "approve", expectedVersion: VERSION }, { id: "partner", portalRole: "ExternalBuyer" })).status, "Approved");
    const rework = harness({ publicationStatus: "Published" });
    await assert.rejects(() => rework.service.partnerAction(PUBLICATION, { action: "rework", expectedVersion: VERSION }, { id: "partner", portalRole: "ExternalBuyer" }), RecapPublicationValidationError);
    const result = await rework.service.partnerAction(PUBLICATION, { action: "rework", guidance: "Revise section 4", expectedVersion: VERSION }, { id: "partner", portalRole: "ExternalBuyer" });
    assert.equal(result.status, "Rework Requested"); assert.equal(result.partnerGuidance, "Revise section 4");
    assert.deepEqual(rework.calls.find(call => call[0] === "partner"), ["partner", "partner", "ORG-A", "rework", "Revise section 4"]);
    await assert.rejects(() => harness({ member: false, publicationStatus: "Published" }).service.partnerAction(PUBLICATION, { action: "approve", expectedVersion: VERSION }, { id: "partner", portalRole: "ExternalBuyer" }), RecapPublicationNotFoundError);
});

test("publication repository scopes external reads and atomically preserves publication history on partner action", async () => {
    const calls = []; const repository = createRecapPublicationRepository({ query: async (sql, values) => { calls.push({ sql, values }); return []; } });
    await repository.listForExternalUser("partner", null);
    await repository.getExternalArtifact("partner", PUBLICATION, ARTIFACT);
    await repository.partnerAction(PUBLICATION, "partner", "ORG-A", "rework", "Revise", VERSION);
    assert.match(calls[0].sql, /ExternalUserOrganizations[\s\S]*targetExternalOrganizationId/);
    assert.match(calls[0].sql, /laterPublication\.publicationNumber > publication\.publicationNumber[\s\S]*laterPublication\.status IN \('Published', 'Approved', 'Rework Requested'\)/);
    assert.match(calls[1].sql, /published\.status = 'Active'[\s\S]*ExternalUserOrganizations/);
    assert.match(calls[2].sql, /WITH \(UPDLOCK, HOLDLOCK\)[\s\S]*status = 'Published'[\s\S]*INSERT INTO cmdb\.RecapWorkItemEvents/);
    assert.match(calls[2].sql, /UPDATE cmdb\.RecapWorkItems SET status = @workStatus/);
    assert.doesNotMatch(calls[2].sql, /DELETE FROM cmdb\.RecapPublications|DELETE FROM cmdb\.RecapPublishedArtifacts/);
    assert.match((await (async () => { const recorded = []; const subject = createRecapPublicationRepository({ query: async sql => { recorded.push(sql); return []; } }); await subject.begin({ workItemId: WORK, owningExternalOrganizationId: "ORG-A" }, "publish:key", "dd", VERSION); return recorded[0]; })()), /publicationEligibility = 'Active'/);
});

test("internal publish endpoint preserves actor and application identities", async () => {
    const calls = [];
    const app = express(); app.use(express.json());
    app.use((req, _res, next) => { req.user = { id: "dd", globalRole: "DDTeam" }; next(); });
    app.use("/api/recapitalization/work-items", createRecapWorkItemsRouter({}, { publish: async (workItemId, input, actor) => { calls.push({ workItemId, input, actor }); return { id: PUBLICATION, status: "Published" }; } }));
    const server = app.listen(0, "127.0.0.1"); await new Promise(resolve => server.once("listening", resolve));
    try {
        const response = await fetch(`http://127.0.0.1:${server.address().port}/api/recapitalization/work-items/${WORK}/publish-external`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ expectedVersion: VERSION, idempotencyKey: "publish:key" }) });
        assert.equal(response.status, 200); assert.equal((await response.json()).publication.status, "Published");
        assert.deepEqual(calls, [{ workItemId: WORK, input: { expectedVersion: VERSION, idempotencyKey: "publish:key" }, actor: { id: "dd", globalRole: "DDTeam" } }]);
    } finally { await new Promise(resolve => server.close(resolve)); }
});

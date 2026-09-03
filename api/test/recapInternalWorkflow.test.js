import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import express from "express";
import { createRecapWorkItemRepository } from "../src/services/recapWorkItemRepository.js";
import { createRecapWorkItemService, RecapWorkItemAuthorizationError, RecapWorkItemConflictError, RecapWorkItemValidationError } from "../src/services/recapWorkItemService.js";
import { createRecapWorkItemsRouter } from "../src/routes/recapWorkItems.js";

const ID = "11111111-1111-4111-8111-111111111111";
const row = (status = "In Progress", assignedUserId = "owner") => ({
    workItemId: ID, intakeRequestId: ID, requestNumber: "DD-2026-00000001", status,
    assignedUserId, priority: "High", communityNamesJson: "[]", needsReassignment: false,
    version: "0x0000000000000001",
});
const owner = { id: "owner", globalRole: "Editor" };
const viewer = { id: "owner", globalRole: "Viewer" };
const stranger = { id: "other", globalRole: "Editor" };
const ops = { id: "ops", globalRole: "DDTeam" };

test("migration 021 is additive, transactional, checksummed, rerunnable, and fail-closed", async () => {
    const sql = await readFile(new URL("../src/migrations/021_recap_internal_workflow.sql", import.meta.url), "utf8");
    const checksum = sql.match(/DECLARE @contentSha256 CHAR\(64\) = '([0-9A-F]{64})'/)?.[1];
    const normalized = sql.replace(/\r\n/g, "\n").replace(/(DECLARE @contentSha256 CHAR\(64\) = ')[0-9A-F]{64}(')/g, `$1${"0".repeat(64)}$2`);
    assert.equal(checksum, createHash("sha256").update(normalized).digest("hex").toUpperCase());
    assert.match(sql, /SET XACT_ABORT ON[\s\S]*BEGIN TRY[\s\S]*BEGIN TRANSACTION/);
    assert.match(sql, /@existingChecksum = @contentSha256[\s\S]*Migration 021 already applied/);
    assert.match(sql, /Unrecorded or partial Recap internal workflow schema already exists/);
    assert.match(sql, /status IN \([\s\S]*'Clarification Needed'[\s\S]*'Blocked'[\s\S]*'Not Applicable'[\s\S]*'Duplicate'/);
    assert.doesNotMatch(sql, /'Waiting Partner Review'|'Needs Rework'|'Approved'/);
    assert.match(sql, /CREATE TABLE cmdb\.RecapWorkItemEvents/);
    assert.match(sql, /CREATE TABLE cmdb\.RecapWorkNotes/);
    assert.match(sql, /EXEC\(N'ALTER TABLE cmdb\.RecapWorkItems ADD CONSTRAINT FK_RecapWorkItems_ResponseUpdater[\s\S]*CK_RecapWorkItems_ActiveReason[\s\S]*CK_RecapWorkItems_Disposition[\s\S]*CK_RecapWorkItems_Response[\s\S]*\);'\);/);
    assert.match(sql, /status NOT IN \(''Not Applicable'', ''Duplicate''\)[\s\S]*status = ''Needs DD Review'' OR status = proposedDisposition/);
    assert.ok(sql.indexOf("EXEC(N'ALTER TABLE cmdb.RecapWorkItems ADD CONSTRAINT FK_RecapWorkItems_ResponseUpdater")
        > sql.indexOf("responseContent NVARCHAR(MAX) NULL"));
    assert.match(sql, /IF XACT_STATE\(\) <> 0 ROLLBACK TRANSACTION/);
});

test("repository mutations condition on state/version and append events in the same transaction", async () => {
    const calls = [];
    const repository = createRecapWorkItemRepository({ query: async (sql, values) => { calls.push({ sql, values }); return [row()]; } });
    await repository.updateResponse(ID, "Response", owner, "0x0000000000000001");
    await repository.requestClarification(ID, "Need detail", owner);
    await repository.resolveClarification(ID, "Guidance", ops);
    await repository.block(ID, "Dependency", owner);
    await repository.unblock(ID, "Resolved", ops);
    await repository.proposeDisposition(ID, "Duplicate", "Same request", owner);
    await repository.approveDisposition(ID, ops);
    await repository.returnDisposition(ID, "Keep working", ops);
    for (const call of calls) {
        assert.match(call.sql, /BEGIN TRANSACTION[\s\S]*OUTPUT deleted\.status, inserted\.status[\s\S]*INSERT INTO cmdb\.RecapWorkItemEvents[\s\S]*COMMIT TRANSACTION/);
        assert.match(call.sql, /workItem\.version = CONVERT\(binary\(8\), @expectedVersion, 1\)/);
        assert.doesNotMatch(call.sql, /@expectedVersion IS NULL/);
    }
    assert.match(calls[0].sql, /assignedUserId = @actorId AND workItem\.status = 'In Progress'/);
    assert.match(calls[1].sql, /activeReasonType = 'Clarification'/);
    assert.match(calls[3].sql, /activeReasonType = 'Blocker'/);
    assert.match(calls[5].sql, /proposedDisposition = @disposition/);
    assert.match(calls[6].sql, /status = proposedDisposition/);
    assert.match(calls[7].sql, /proposedDisposition = NULL/);
    assert.match(calls[0].sql, /IF @@ROWCOUNT = 0[\s\S]*ROLLBACK[\s\S]*THROW[\s\S]*INSERT INTO cmdb\.RecapWorkItemEvents/);
});

test("state-aware assignment preserves exceptions, resets accepted work, and rejects review/terminal states", async () => {
    let statement;
    const repository = createRecapWorkItemRepository({ query: async (sql) => { statement = sql; return [row("Assigned", "new-owner")]; } });
    await repository.assign(ID, "new-owner", "ops", "0x0000000000000001");
    assert.match(statement, /CASE WHEN status IN \('Queued', 'Assigned', 'In Progress'\) THEN 'Assigned' ELSE status END/);
    assert.match(statement, /status IN \('Queued', 'Assigned', 'In Progress', 'Clarification Needed', 'Blocked'\)/);
    assert.doesNotMatch(statement, /status IN \([^)]*'Needs DD Review'/);
    assert.match(statement, /acceptedAt = NULL/);
    assert.match(statement, /CASE WHEN previousAssignedUserId IS NULL THEN 'Assigned' ELSE 'Reassigned' END/);
});

function serviceWith(overrides = {}) {
    const state = row();
    const repository = {
        get: async () => state,
        updateResponse: async (_id, responseContent) => [{ ...state, responseContent }],
        requestClarification: async () => [{ ...state, status: "Clarification Needed", activeReasonType: "Clarification", activeReason: "Need detail" }],
        resolveClarification: async () => [{ ...state, status: "In Progress", activeReasonType: null, activeReason: null }],
        block: async () => [{ ...state, status: "Blocked", activeReasonType: "Blocker", activeReason: "Dependency" }],
        unblock: async () => [{ ...state, status: "In Progress", activeReasonType: null, activeReason: null }],
        proposeDisposition: async (_id, disposition, reason) => [{ ...state, status: "Needs DD Review", proposedDisposition: disposition, dispositionReason: reason }],
        approveDisposition: async () => [{ ...state, status: "Duplicate", proposedDisposition: "Duplicate" }],
        returnDisposition: async () => [{ ...state, status: "In Progress", proposedDisposition: null }],
        listEvents: async () => [{ detailsJson: '{"reason":"safe"}' }],
        listNotes: async () => [{ noteText: "first" }, { noteText: "second" }],
        addNote: async (_id, noteText, noteType, actor) => [{ noteText, noteType, authorUserId: actor.id }],
        ...overrides,
    };
    return createRecapWorkItemService({ repository });
}

test("DD response is owner-only, bounded, validated, and returned authoritatively", async () => {
    const service = serviceWith();
    assert.equal((await service.updateResponse(ID, { responseContent: "Answer", expectedVersion: row().version }, owner)).responseContent, "Answer");
    await assert.rejects(() => service.updateResponse(ID, { responseContent: "Answer" }, viewer), RecapWorkItemAuthorizationError);
    await assert.rejects(() => service.updateResponse(ID, { responseContent: "Answer" }, stranger), RecapWorkItemAuthorizationError);
    await assert.rejects(() => service.updateResponse(ID, { responseContent: " " }, owner), RecapWorkItemValidationError);
});

test("authoritative mutations require valid rowversion and surface stale writes as typed conflicts", async () => {
    let mutations = 0;
    const service = serviceWith({
        updateResponse: async () => { mutations += 1; throw new Error("Work item transition cannot be applied or is stale"); },
    });
    await assert.rejects(() => service.updateResponse(ID, { responseContent: "Answer" }, owner), RecapWorkItemValidationError);
    await assert.rejects(() => service.updateResponse(ID, { responseContent: "Answer", expectedVersion: "bad" }, owner), RecapWorkItemValidationError);
    assert.equal(mutations, 0);
    await assert.rejects(
        () => service.updateResponse(ID, { responseContent: "Answer", expectedVersion: row().version }, owner),
        RecapWorkItemConflictError,
    );
    assert.equal(mutations, 1);

    const successful = serviceWith();
    assert.equal((await successful.updateResponse(ID, { responseContent: "Answer", expectedVersion: row().version }, owner)).responseContent, "Answer");
});

test("authoritative content accepts limits and rejects oversize without persistence", async () => {
    let mutations = 0;
    const service = serviceWith({
        updateResponse: async (_id, responseContent) => { mutations += 1; return [{ ...row(), responseContent }]; },
        requestClarification: async () => { mutations += 1; return [row("Clarification Needed")]; },
        addNote: async () => { mutations += 1; return [{ noteText: "unexpected" }]; },
    });
    const maximumResponse = "r".repeat(100000);
    assert.equal((await service.updateResponse(ID, { responseContent: maximumResponse, expectedVersion: row().version }, owner)).responseContent.length, 100000);
    assert.equal(mutations, 1);
    await assert.rejects(() => service.updateResponse(ID, { responseContent: `${maximumResponse}r`, expectedVersion: row().version }, owner), RecapWorkItemValidationError);
    await assert.rejects(() => service.requestClarification(ID, { reason: "r".repeat(2001), expectedVersion: row().version }, owner), RecapWorkItemValidationError);
    await assert.rejects(() => service.addNote(ID, { noteText: "n".repeat(4001) }, owner), RecapWorkItemValidationError);
    assert.equal(mutations, 1);
});

test("clarification and blocker paths require reasons, owners to enter, and operations to resume", async () => {
    const service = serviceWith();
    assert.equal((await service.requestClarification(ID, { reason: "Need detail", expectedVersion: row().version }, owner)).status, "Clarification Needed");
    assert.equal((await service.block(ID, { reason: "Dependency", expectedVersion: row().version }, owner)).status, "Blocked");
    await assert.rejects(() => service.requestClarification(ID, { reason: "" }, owner), RecapWorkItemValidationError);
    await assert.rejects(() => service.block(ID, { reason: "Dependency" }, stranger), RecapWorkItemAuthorizationError);
    await assert.rejects(() => service.resolveClarification(ID, { resolution: "Guidance" }, owner), RecapWorkItemAuthorizationError);
    assert.equal((await service.resolveClarification(ID, { resolution: "Guidance", expectedVersion: row().version }, ops)).status, "In Progress");
    assert.equal((await service.unblock(ID, { resolution: "Resolved", expectedVersion: row().version }, ops)).status, "In Progress");
});

test("dispositions are proposed by the owner and decided only by operations", async () => {
    const service = serviceWith();
    assert.equal((await service.proposeDisposition(ID, { disposition: "Duplicate", reason: "Same request", expectedVersion: row().version }, owner)).status, "Needs DD Review");
    await assert.rejects(() => service.approveDisposition(ID, {}, owner), RecapWorkItemAuthorizationError);
    assert.equal((await service.approveDisposition(ID, { expectedVersion: row().version }, ops)).status, "Duplicate");
    assert.equal((await service.returnDisposition(ID, { reason: "Keep working", expectedVersion: row().version }, ops)).status, "In Progress");
});

test("work notes are append-only, chronological on read, and mutation-authorized", async () => {
    const service = serviceWith();
    assert.equal((await service.addNote(ID, { noteText: "Internal context" }, owner)).authorUserId, "owner");
    assert.deepEqual((await service.listNotes(ID)).map(note => note.noteText), ["first", "second"]);
    await assert.rejects(() => service.addNote(ID, { noteText: "No" }, viewer), RecapWorkItemAuthorizationError);
    await assert.rejects(() => service.addNote(ID, { noteText: "No" }, stranger), RecapWorkItemAuthorizationError);
});

test("audit details are projected without exposing raw JSON storage", async () => {
    const events = await serviceWith().listEvents(ID);
    assert.deepEqual(events[0].details, { reason: "safe" });
    assert.equal("detailsJson" in events[0], false);
});

test("Not Mine clears ownership and records the prior assignment through an atomic event", async () => {
    let statement;
    const repository = createRecapWorkItemRepository({ query: async sql => { statement = sql; return [row("Queued", null)]; } });
    await repository.markNotMine(ID, "Wrong specialty", owner);
    assert.match(statement, /assignedUserId = NULL[\s\S]*assignedByUserId = NULL[\s\S]*status = 'Queued'/);
    assert.match(statement, /OUTPUT deleted\.status, inserted\.status, deleted\.assignedUserId, inserted\.assignedUserId/);
    assert.match(statement, /INSERT INTO cmdb\.RecapWorkItemEvents[\s\S]*priorAssignedUserId, resultingAssignedUserId[\s\S]*'MarkedNotMine'/);
});

test("event and note retrieval are durably ordered oldest first", async () => {
    const calls = [];
    const repository = createRecapWorkItemRepository({ query: async sql => { calls.push(sql); return []; } });
    await repository.listEvents(ID);
    await repository.listNotes(ID);
    assert.match(calls[0], /ORDER BY eventRow\.occurredAt, eventRow\.id/);
    assert.match(calls[1], /ORDER BY note\.createdAt, note\.id/);
});

async function directStatus(actor, path, body) {
    const service = serviceWith();
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { req.user = actor; next(); });
    app.use("/api/recapitalization/work-items", createRecapWorkItemsRouter(service));
    const server = app.listen(0);
    await new Promise(resolve => server.once("listening", resolve));
    try {
        const { port } = server.address();
        return (await fetch(`http://127.0.0.1:${port}/api/recapitalization/work-items/${ID}${path}`, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        })).status;
    } finally {
        await new Promise(resolve => server.close(resolve));
    }
}

test("direct APIs reject unauthorized internal workflow mutations with 403", async () => {
    assert.equal(await directStatus(viewer, "/response", { responseContent: "Answer" }), 403);
    assert.equal(await directStatus(stranger, "/block", { reason: "Dependency" }), 403);
    assert.equal(await directStatus(owner, "/disposition/approve", {}), 403);
    assert.equal(await directStatus(viewer, "/notes", { noteText: "No" }), 403);
});

test("a valid stale rowversion returns a sanitized HTTP 409", async () => {
    const service = serviceWith({ updateResponse: async () => { throw new Error("Work item transition cannot be applied or is stale"); } });
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { req.user = owner; next(); });
    app.use("/api/recapitalization/work-items", createRecapWorkItemsRouter(service));
    const server = app.listen(0);
    await new Promise(resolve => server.once("listening", resolve));
    try {
        const response = await fetch(`http://127.0.0.1:${server.address().port}/api/recapitalization/work-items/${ID}/response`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ responseContent: "Answer", expectedVersion: row().version }),
        });
        assert.equal(response.status, 409);
        assert.deepEqual(await response.json(), { error: "Work item changed; refresh and try again" });
    } finally {
        await new Promise(resolve => server.close(resolve));
    }
});

test("an oversized authoritative response returns HTTP 400 without mutation", async () => {
    let mutations = 0;
    const service = serviceWith({ updateResponse: async () => { mutations += 1; return [row()]; } });
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { req.user = owner; next(); });
    app.use("/api/recapitalization/work-items", createRecapWorkItemsRouter(service));
    const server = app.listen(0);
    await new Promise(resolve => server.once("listening", resolve));
    try {
        const response = await fetch(`http://127.0.0.1:${server.address().port}/api/recapitalization/work-items/${ID}/response`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ responseContent: "r".repeat(100001), expectedVersion: row().version }),
        });
        assert.equal(response.status, 400);
        assert.equal(mutations, 0);
    } finally {
        await new Promise(resolve => server.close(resolve));
    }
});

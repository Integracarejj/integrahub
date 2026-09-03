import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import express from "express";
import { createRecapWorkItemRepository } from "../src/services/recapWorkItemRepository.js";
import { createRecapWorkItemService, RecapWorkItemAuthorizationError, RecapWorkItemValidationError } from "../src/services/recapWorkItemService.js";
import { createRecapWorkItemsRouter } from "../src/routes/recapWorkItems.js";

const ID1 = "11111111-1111-4111-8111-111111111111";
const ID2 = "22222222-2222-4222-8222-222222222222";
const WORK = { workItemId: ID1, intakeRequestId: ID2, requestNumber: "DD-2026-00000001", status: "Queued", priority: "High", communityNamesJson: "[]", needsReassignment: false };

test("migration defines durable identity, constraints, narrow statuses, and rowversion", async () => {
    const sql = await readFile(new URL("../src/migrations/011_recap_work_items.sql", import.meta.url), "utf8");
    assert.match(sql, /CREATE TABLE cmdb\.RecapWorkItems/);
    assert.match(sql, /UNIQUE \(intakeRequestId\)/);
    assert.match(sql, /UNIQUE \(requestNumber\)/);
    assert.match(sql, /FOREIGN KEY \(intakeRequestId\).*RecapIntakeRequests/);
    assert.match(sql, /FOREIGN KEY \(assignedUserId\).*cmdb\.Users/);
    assert.match(sql, /status IN \('Queued', 'Assigned', 'In Progress'\)/);
    assert.match(sql, /ROWVERSION/);
});

test("migration 013 extends only the normal DD review lifecycle without colliding with COSM 012", async () => {
    const sql = await readFile(new URL("../src/migrations/013_recap_dd_review_lifecycle.sql", import.meta.url), "utf8");
    assert.match(sql, /DROP CONSTRAINT CK_RecapWorkItems_Status/);
    assert.match(sql, /'Queued', 'Assigned', 'In Progress', 'Needs DD Review', 'Ready to Publish'/);
    assert.doesNotMatch(sql, /Published|Blocked|Clarification/);
});

test("admission is transactional, idempotent, snapshots reviewed fields, and recalculates package conversion", async () => {
    let statement; let params;
    const repository = createRecapWorkItemRepository({ query: async (sql, values) => { statement = sql; params = values; return [WORK]; } });
    const rows = await repository.admit([{ intakeRequestId: ID2, title: "Reviewed", priority: "High" }]);
    assert.equal(rows[0].requestNumber, "DD-2026-00000001");
    assert.match(statement, /BEGIN TRANSACTION/);
    assert.match(statement, /NOT EXISTS[\s\S]*existing\.intakeRequestId/);
    assert.match(statement, /NEXT VALUE FOR cmdb\.RecapWorkItemNumberSequence/);
    assert.match(statement, /THEN 'Awaiting Review' ELSE 'Converted'/);
    assert.match(statement, /COALESCE\(NULLIF\(item\.title/);
    assert.equal(params.itemCount, 1);
});

test("work item service validates UUIDs and whitelists reviewed snapshots", async () => {
    let admitted;
    const service = createRecapWorkItemService({ repository: {
        admit: async items => { admitted = items; return [WORK]; },
    } });
    const operations = { id: "ops", globalRole: "DDTeam" };
    await assert.rejects(() => service.admit({ intakeRequestIds: ["not-a-uuid"] }, operations), RecapWorkItemValidationError);
    await service.admit({ intakeRequestIds: [ID2], reviewedItems: [{ intakeRequestId: ID2, title: " Reviewed ", priority: "invalid", organizationId: "spoof" }] }, operations);
    assert.equal(admitted[0].title, "Reviewed");
    assert.equal(admitted[0].priority, null);
    assert.equal("organizationId" in admitted[0], false);
});

test("admitted work items remain listable in a subsequent session and repeated admission is idempotent", async () => {
    const stored = new Map();
    const repository = {
        async admit(items) {
            for (const item of items) if (!stored.has(item.intakeRequestId)) stored.set(item.intakeRequestId, { ...WORK, intakeRequestId: item.intakeRequestId });
            return items.map(item => stored.get(item.intakeRequestId));
        },
        async list() { return { workItems: [...stored.values()], assignees: [] }; },
    };
    const sessionA = createRecapWorkItemService({ repository });
    const operations = { id: "ops", globalRole: "DDTeam" };
    await sessionA.admit({ intakeRequestIds: [ID2] }, operations);
    await sessionA.admit({ intakeRequestIds: [ID2] }, operations);
    const sessionB = createRecapWorkItemService({ repository });
    const listed = await sessionB.list();
    assert.equal(stored.size, 1);
    assert.equal(listed.workItems.length, 1);
    assert.equal(listed.workItems[0].intakeRequestId, ID2);
});

test("admission and assignment require DD Operations authority", async () => {
    const calls = [];
    const service = createRecapWorkItemService({ repository: {
        admit: async items => { calls.push(["admit", items]); return [WORK]; },
        assign: async (...args) => { calls.push(["assign", args]); return [{ ...WORK, status: "Assigned", assignedUserId: "owner-a" }]; },
    } });
    for (const globalRole of ["Viewer", "Editor"]) {
        const actor = { id: globalRole.toLowerCase(), globalRole };
        await assert.rejects(() => service.admit({ intakeRequestIds: [ID2] }, actor), RecapWorkItemAuthorizationError);
        await assert.rejects(() => service.assign(ID1, "owner-a", actor), RecapWorkItemAuthorizationError);
    }
    await service.admit({ intakeRequestIds: [ID2] }, { id: "ops", globalRole: "DDTeam" });
    await service.assign(ID1, "owner-a", { id: "ops", globalRole: "DDTeam" });
    await service.assign(ID1, "owner-b", { id: "admin", globalRole: "PlatformAdmin" });
    assert.deepEqual(calls.map(call => call[0]), ["admit", "assign", "assign"]);
});

async function routeStatus(user, path) {
    const service = createRecapWorkItemService({ repository: {
        admit: async () => [WORK], assign: async () => [{ ...WORK, status: "Assigned", assignedUserId: "owner-a" }],
    } });
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { req.user = user; next(); });
    app.use("/api/recapitalization/work-items", createRecapWorkItemsRouter(service));
    const server = app.listen(0);
    await new Promise(resolve => server.once("listening", resolve));
    try {
        const { port } = server.address();
        const response = await fetch(`http://127.0.0.1:${port}/api/recapitalization/work-items${path}`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: path === "/admit" ? JSON.stringify({ intakeRequestIds: [ID2] }) : JSON.stringify({ assignedUserId: "owner-a" }),
        });
        return response.status;
    } finally {
        await new Promise(resolve => server.close(resolve));
    }
}

test("direct API admission and assignment calls return 403 for unauthorized internal roles", async () => {
    for (const globalRole of ["Viewer", "Editor"]) {
        const actor = { id: globalRole.toLowerCase(), globalRole };
        assert.equal(await routeStatus(actor, "/admit"), 403);
        assert.equal(await routeStatus(actor, `/${ID1}/assign`), 403);
    }
    assert.equal(await routeStatus({ id: "ops", globalRole: "DDTeam" }, "/admit"), 201);
    assert.equal(await routeStatus({ id: "admin", globalRole: "PlatformAdmin" }, `/${ID1}/assign`), 200);
});

test("accept capability is exposed only for the current assignee while Assigned", async () => {
    const repository = {
        async list() {
            return { workItems: [
                { ...WORK, status: "Assigned", assignedUserId: "user-a" },
                { ...WORK, workItemId: ID2, status: "In Progress", assignedUserId: "user-a" },
            ], assignees: [] };
        },
    };
    const service = createRecapWorkItemService({ repository });
    const ownerView = await service.list({ id: "user-a", globalRole: "Viewer" });
    const adminView = await service.list({ id: "admin-b", globalRole: "PlatformAdmin" });
    assert.equal(ownerView.workItems[0].capabilities.canAccept, true);
    assert.equal(ownerView.workItems[1].capabilities.canAccept, false);
    assert.equal(adminView.workItems[0].capabilities.canAccept, false);
});

test("assignment, accept, and Not Mine use server actor identity and atomic transition predicates", async () => {
    const calls = [];
    const repository = createRecapWorkItemRepository({ query: async (sql, values) => { calls.push({ sql, values }); return [WORK]; } });
    await repository.assign(ID1, "target-user", "actor-user");
    await repository.accept(ID1, { id: "target-user", globalRole: "Viewer" });
    await repository.markNotMine(ID1, "Wrong specialty", { id: "target-user", globalRole: "Viewer" });
    assert.match(calls[0].sql, /role IN \('PlatformAdmin', 'Editor', 'Viewer', 'DDTeam'\)/);
    assert.deepEqual(calls[0].values, { id: ID1, targetUserId: "target-user", actorId: "actor-user" });
    assert.match(calls[1].sql, /assignedUserId = @actorId/);
    assert.doesNotMatch(calls[1].sql, /isOperations/);
    assert.match(calls[1].sql, /status = 'Assigned'/);
    assert.doesNotMatch(calls[1].sql, /status IN \('Assigned', 'In Progress'\)/);
    assert.deepEqual(calls[1].values, { id: ID1, actorId: "target-user" });
    assert.match(calls[1].sql, /acceptedAt = SYSUTCDATETIME\(\)/);
    assert.match(calls[2].sql, /needsReassignment = 1/);
    assert.match(calls[2].sql, /assignedUserId = NULL/);
});

test("normal DD lifecycle transitions are atomic, owner-preserving, and role-enforced", async () => {
    const calls = [];
    const repository = createRecapWorkItemRepository({ query: async (sql, values) => { calls.push({ sql, values }); return [{ ...WORK, assignedUserId: "owner-a" }]; } });
    await repository.submitForDdReview(ID1, { id: "owner-a" });
    await repository.returnFromDdReview(ID1);
    await repository.markReadyToPublish(ID1);
    assert.match(calls[0].sql, /assignedUserId = @actorId[\s\S]*status = 'In Progress'/);
    assert.match(calls[0].sql, /status = 'Needs DD Review'/);
    assert.match(calls[1].sql, /assignedUserId IS NOT NULL[\s\S]*status = 'Needs DD Review'/);
    assert.match(calls[1].sql, /SET status = 'In Progress'/);
    assert.doesNotMatch(calls[1].sql, /assignedUserId\s*=/);
    assert.match(calls[2].sql, /SET status = 'Ready to Publish'/);
    assert.doesNotMatch(calls[2].sql, /assignedUserId\s*=/);

    const service = createRecapWorkItemService({ repository: {
        returnFromDdReview: async () => [{ ...WORK, status: "In Progress", assignedUserId: "owner-a" }],
        markReadyToPublish: async () => [{ ...WORK, status: "Ready to Publish", assignedUserId: "owner-a" }],
    } });
    await assert.rejects(() => service.returnFromDdReview(ID1, { id: "owner-a", globalRole: "Viewer" }), RecapWorkItemAuthorizationError);
    await assert.rejects(() => service.markReadyToPublish(ID1, { id: "owner-a", globalRole: "Editor" }), RecapWorkItemAuthorizationError);
    assert.equal((await service.returnFromDdReview(ID1, { id: "ops", globalRole: "DDTeam" })).status, "In Progress");
    assert.equal((await service.markReadyToPublish(ID1, { id: "admin", globalRole: "PlatformAdmin" })).status, "Ready to Publish");
});

test("authoritative capability projection is state, owner, and operations-role specific", async () => {
    const rows = [
        { ...WORK, status: "Assigned", assignedUserId: "owner-a" },
        { ...WORK, workItemId: ID2, status: "In Progress", assignedUserId: "owner-a" },
        { ...WORK, workItemId: "33333333-3333-4333-8333-333333333333", status: "Needs DD Review", assignedUserId: "owner-a" },
        { ...WORK, workItemId: "44444444-4444-4444-8444-444444444444", status: "Ready to Publish", assignedUserId: "owner-a" },
    ];
    const service = createRecapWorkItemService({ repository: { list: async () => ({ workItems: rows, assignees: [] }) } });
    const owner = (await service.list({ id: "owner-a", globalRole: "Viewer" })).workItems;
    assert.equal(owner[0].capabilities.canAssign, false);
    assert.equal(owner[0].capabilities.canReassign, false);
    assert.equal(owner[0].capabilities.canMarkNotMine, true);
    assert.equal(owner[0].capabilities.canAccept, true);
    assert.equal(owner[1].capabilities.canSubmitForDdReview, true);
    assert.equal(owner[1].capabilities.canComplete, false);
    assert.equal(owner[1].capabilities.canUploadArtifact, true);
    assert.equal(owner[2].capabilities.canSubmitForDdReview, false);
    assert.equal(owner[2].capabilities.canReturnFromDdReview, false);
    assert.equal(owner[3].capabilities.canPublish, false);
    assert.equal(owner[3].capabilities.canUploadArtifact, false);
    const ops = (await service.list({ id: "ops", globalRole: "DDTeam" })).workItems;
    assert.equal(ops[0].capabilities.canAssign, false);
    assert.equal(ops[0].capabilities.canReassign, true);
    const queuedService = createRecapWorkItemService({ repository: { list: async () => ({ workItems: [WORK], assignees: [] }) } });
    const queued = (await queuedService.list({ id: "ops", globalRole: "DDTeam" })).workItems[0];
    assert.equal(queued.capabilities.canAssign, true);
    assert.equal(queued.capabilities.canReassign, false);
    assert.equal(ops[1].capabilities.canSubmitForDdReview, false);
    assert.equal(ops[2].capabilities.canReturnFromDdReview, true);
    assert.equal(ops[2].capabilities.canMarkReadyToPublish, true);
    assert.equal(ops[2].capabilities.canViewArtifacts, true);
    assert.equal(ops[3].capabilities.canMarkReadyToPublish, false);
});

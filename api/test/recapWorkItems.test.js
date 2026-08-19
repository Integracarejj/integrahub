import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRecapWorkItemRepository } from "../src/services/recapWorkItemRepository.js";
import { createRecapWorkItemService, RecapWorkItemValidationError } from "../src/services/recapWorkItemService.js";

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
    await assert.rejects(() => service.admit({ intakeRequestIds: ["not-a-uuid"] }), RecapWorkItemValidationError);
    await service.admit({ intakeRequestIds: [ID2], reviewedItems: [{ intakeRequestId: ID2, title: " Reviewed ", priority: "invalid", organizationId: "spoof" }] });
    assert.equal(admitted[0].title, "Reviewed");
    assert.equal(admitted[0].priority, null);
    assert.equal("organizationId" in admitted[0], false);
});

test("assignment, accept, and Not Mine use server actor identity and atomic transition predicates", async () => {
    const calls = [];
    const repository = createRecapWorkItemRepository({ query: async (sql, values) => { calls.push({ sql, values }); return [WORK]; } });
    await repository.assign(ID1, "target-user", "actor-user");
    await repository.accept(ID1, { id: "target-user", globalRole: "Viewer" });
    await repository.markNotMine(ID1, "Wrong specialty", { id: "target-user", globalRole: "Viewer" });
    assert.match(calls[0].sql, /role IN \('PlatformAdmin', 'Editor', 'Viewer', 'DDTeam'\)/);
    assert.deepEqual(calls[0].values, { id: ID1, targetUserId: "target-user", actorId: "actor-user" });
    assert.match(calls[1].sql, /assignedUserId = @actorId OR @isOperations = 1/);
    assert.match(calls[1].sql, /acceptedAt = COALESCE\(acceptedAt/);
    assert.match(calls[2].sql, /needsReassignment = 1/);
    assert.match(calls[2].sql, /assignedUserId = NULL/);
});

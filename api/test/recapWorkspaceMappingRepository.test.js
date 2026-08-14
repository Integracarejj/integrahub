import test from "node:test";
import assert from "node:assert/strict";
import { createRecapWorkspaceMappingRepository, WorkspaceProvisioningLockError } from "../src/services/recapWorkspaceMappingRepository.js";

function makeRepository(lockResult) {
    const events = [];
    const transaction = {
        async begin() { events.push("begin"); },
        async commit() { events.push("commit"); },
        async rollback() { events.push("rollback"); },
    };
    const repository = createRecapWorkspaceMappingRepository({
        query: async () => [],
        getPool: async () => ({}),
        createTransaction: () => transaction,
        queryInTransaction: async (_transaction, statement, params) => {
            events.push({ statement, params });
            return [{ lockResult }];
        },
    });
    return { repository, events };
}

test("provisioning lock is transaction-owned, UUID-scoped, and committed after work", async () => {
    const { repository, events } = makeRepository(0);
    const result = await repository.withProvisioningLock("uuid-1", "working", async () => {
        events.push("work");
        return "ready";
    });
    assert.equal(result, "ready");
    assert.deepEqual(events.slice(0, 2).map((event) => typeof event === "string" ? event : "lock"), ["begin", "lock"]);
    assert.match(events[1].statement, /sp_getapplock/);
    assert.match(events[1].statement, /@LockOwner = 'Transaction'/);
    assert.equal(events[1].params.resource, "recap-workspace:working:uuid-1");
    assert.deepEqual(events.slice(2), ["work", "commit"]);
});

test("failed lock acquisition rolls back and never runs provisioning", async () => {
    const { repository, events } = makeRepository(-1);
    let ran = false;
    await assert.rejects(
        repository.withProvisioningLock("uuid-1", "working", async () => { ran = true; }),
        WorkspaceProvisioningLockError,
    );
    assert.equal(ran, false);
    assert.equal(events.at(-1), "rollback");
});

test("provisioning failure rolls back and preserves the original error", async () => {
    const { repository, events } = makeRepository(0);
    const expected = new Error("Graph failed");
    await assert.rejects(repository.withProvisioningLock("uuid-1", "working", async () => { throw expected; }), (error) => error === expected);
    assert.equal(events.at(-1), "rollback");
});

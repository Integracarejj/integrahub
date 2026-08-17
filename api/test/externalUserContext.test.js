import test from "node:test";
import assert from "node:assert/strict";
import { createExternalUserContextService } from "../src/services/externalUserContextService.js";
import { requireInternalUser } from "../src/middleware/authorization.js";

test("external context returns authorized memberships and the authoritative default", async () => {
    let parameters;
    const service = createExternalUserContextService({
        query: async (_sql, values) => {
            parameters = values;
            return [
                { externalOrganizationId: "TEST-BROKER-ORG", isDefault: true },
                { externalOrganizationId: "SECOND-ORG", isDefault: false },
            ];
        },
    });

    assert.deepEqual(await service.getForUser("user-1"), {
        organizations: [
            { id: "TEST-BROKER-ORG", isDefault: true },
            { id: "SECOND-ORG", isDefault: false },
        ],
        defaultOrganizationId: "TEST-BROKER-ORG",
        isConfigured: true,
    });
    assert.deepEqual(parameters, { userId: "user-1" });
});

test("external context fails closed when the user has no organization membership", async () => {
    const service = createExternalUserContextService({ query: async () => [] });
    assert.deepEqual(await service.getForUser("user-2"), {
        organizations: [],
        defaultOrganizationId: null,
        isConfigured: false,
    });
});

test("internal middleware rejects external-only roles and preserves DDTeam internal access", () => {
    const status = [];
    const response = { status(code) { status.push(code); return this; }, json() {} };
    let nextCalled = false;

    requireInternalUser({ user: { globalRole: "ExternalBroker", portalRole: "ExternalBroker" } }, response, () => { nextCalled = true; });
    assert.deepEqual(status, [403]);
    assert.equal(nextCalled, false);

    status.length = 0;
    requireInternalUser({ user: { globalRole: "DDTeam", portalRole: "DDTeam" } }, response, () => { nextCalled = true; });
    assert.deepEqual(status, []);
    assert.equal(nextCalled, true);
});

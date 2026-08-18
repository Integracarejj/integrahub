import test from "node:test";
import assert from "node:assert/strict";
import { createExternalUserContextService } from "../src/services/externalUserContextService.js";
import { denyExternalOnlyUser, requireInternalUser } from "../src/middleware/authorization.js";

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

test("authorized transaction listing is SQL-scoped through user organization membership", async () => {
    let sql;
    let parameters;
    const service = createExternalUserContextService({
        query: async (statement, values) => {
            sql = statement;
            parameters = values;
            return [{
                id: "REC-2026-00000002",
                name: "Project Liberty",
                status: "Active",
                owningExternalOrganizationId: "TEST-BROKER-ORG",
            }];
        },
    });

    assert.deepEqual(await service.listAuthorizedTransactions("external-user"), [{
        id: "REC-2026-00000002",
        name: "Project Liberty",
        status: "Active",
        owningExternalOrganizationId: "TEST-BROKER-ORG",
        recoverablePackage: null,
    }]);
    assert.match(sql, /ExternalUserOrganizations/);
    assert.match(sql, /RecapIncomingDocuments/);
    assert.match(sql, /RecapIntakePackages/);
    assert.match(sql, /membership\.externalOrganizationId = transactionRow\.owningExternalOrganizationId/);
    assert.deepEqual(parameters, { userId: "external-user" });
});

test("authorized transaction listing exposes only durable incomplete package recovery identity", async () => {
    const service = createExternalUserContextService({ query: async () => [{
        id: "REC-2026-00000003", name: "Project Keystone", status: "Active",
        owningExternalOrganizationId: "TEST-BROKER-ORG", recoverableSourcePackageId: "sub-keystone",
        recoverableOriginalFileName: "Project Keystone.xlsx", recoverableContentSize: 184442,
    }] });
    const [transaction] = await service.listAuthorizedTransactions("external-user");
    assert.deepEqual(transaction.recoverablePackage, {
        sourcePackageId: "sub-keystone", originalFileName: "Project Keystone.xlsx", contentSize: 184442,
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

test("global internal API boundary blocks external-only roles without changing internal users", () => {
    for (const role of ["ExternalBroker", "ExternalBuyer"]) {
        let status;
        let nextCalled = false;
        const response = { status(code) { status = code; return this; }, json() {} };
        denyExternalOnlyUser({ user: { globalRole: role } }, response, () => { nextCalled = true; });
        assert.equal(status, 403);
        assert.equal(nextCalled, false);
    }

    for (const role of ["Viewer", "Editor", "PlatformAdmin", "DDTeam"]) {
        let nextCalled = false;
        denyExternalOnlyUser({ user: { globalRole: role } }, {}, () => { nextCalled = true; });
        assert.equal(nextCalled, true);
    }
});

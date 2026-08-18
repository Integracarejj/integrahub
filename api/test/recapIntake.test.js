import test from "node:test";
import assert from "node:assert/strict";
import { createRecapIntakeService, RecapIntakeForbiddenError, RecapIntakeValidationError } from "../src/services/recapIntakeService.js";
import { createRecapIntakeRepository } from "../src/services/recapIntakeRepository.js";

const document = {
    recapTransactionId: "11111111-1111-1111-1111-111111111111",
    originalFileName: "Project Liberty.xlsx",
    externalOrganizationId: "TEST-BROKER-ORG",
    packageName: "Project Liberty",
};

test("finalization persists every parsed request with authoritative actor and organization identity", async () => {
    let persisted;
    const service = createRecapIntakeService({
        query: async (_sql, params) => {
            assert.deepEqual(params, { businessTransactionId: "REC-2026-00000002", sourcePackageId: "sub-1", uploadedBy: "user-1" });
            return [document];
        },
        repository: { async persistPackage(values) { persisted = values; return { id: "pkg-1", created: true, requestCount: values.requests.length }; } },
    });
    const result = await service.finalizePackage({
        businessTransactionId: "REC-2026-00000002", sourcePackageId: "sub-1",
        requests: [
            { title: "Rent roll", category: "Financial", priority: "High", description: "Current roll" },
            { title: "Licenses", category: "Regulatory", priority: "Medium", description: "All licenses" },
        ],
    }, { id: "user-1", name: "Jeremy Joyner", email: "joyner.jeremy@ymail.com" });
    assert.equal(result.requestCount, 2);
    assert.equal(persisted.externalOrganizationId, "TEST-BROKER-ORG");
    assert.equal(persisted.submittedBy, "user-1");
    assert.equal(persisted.submittedByName, "Jeremy Joyner");
    assert.deepEqual(persisted.requests.map(row => row.title), ["Rent roll", "Licenses"]);
});

test("finalization rejects packages that are not uploaded by the authenticated actor and invalid rows", async () => {
    const forbidden = createRecapIntakeService({ query: async () => [], repository: {} });
    await assert.rejects(forbidden.finalizePackage({ businessTransactionId: "REC-1", sourcePackageId: "sub-1", requests: [] }, { id: "other" }), RecapIntakeForbiddenError);
    const invalid = createRecapIntakeService({ query: async () => [document], repository: {} });
    await assert.rejects(invalid.finalizePackage({ businessTransactionId: "REC-1", sourcePackageId: "sub-1", requests: [{ description: "missing title" }] }, { id: "user-1" }), RecapIntakeValidationError);
});

test("repository uses one locked transaction and the existing package identity on retry", async () => {
    const calls = [];
    let sequence = 0;
    const repository = createRecapIntakeRepository({
        generateUuid: () => `00000000-0000-0000-0000-${String(++sequence).padStart(12, "0")}`,
        query: async (sql, values) => {
            calls.push({ sql, values });
            return [{ id: calls.length === 1 ? values.newPackageId : "00000000-0000-0000-0000-999999999999" }];
        },
    });
    const values = { ...document, sourcePackageId: "sub-1", submittedBy: "user-1", submittedByName: "Jeremy", submittedByEmail: "j@example.com", requests: [{ title: "One", category: "Legal", description: "", team: null, owner: null, priority: "Medium", dueDate: null, communityNamesJson: "[]" }] };
    const first = await repository.persistPackage(values);
    const retry = await repository.persistPackage(values);
    assert.equal(first.created, true);
    assert.equal(retry.created, false);
    assert.match(calls[0].sql, /WITH \(UPDLOCK, HOLDLOCK\)/);
    assert.match(calls[0].sql, /BEGIN TRANSACTION/);
    assert.match(calls[0].sql, /UNIQUE \(intakePackageId, sourceRowNumber\)|OPENJSON/);
    assert.equal(JSON.parse(calls[0].values.requestsJson).length, 1);
});

test("listing keeps two authoritative projects separate", async () => {
    const repository = { listPackages: async () => [
        { packageId: "p1", sourcePackageId: "s1", packageName: "Liberty", originalFileName: "Liberty.xlsx", requestCount: 1, status: "Awaiting Review", submittedBy: "u", submittedByName: "User", externalOrganizationId: "ORG", createdAt: "2026-01-01", businessTransactionId: "REC-1", transactionName: "Liberty", sourceRowNumber: 1, category: "Legal", title: "A", description: "", priority: "High", communityNamesJson: "[]" },
        { packageId: "p2", sourcePackageId: "s2", packageName: "Keystone", originalFileName: "Keystone.xlsx", requestCount: 1, status: "Awaiting Review", submittedBy: "u", submittedByName: "User", externalOrganizationId: "ORG", createdAt: "2026-01-02", businessTransactionId: "REC-2", transactionName: "Keystone", sourceRowNumber: 1, category: "Finance", title: "B", description: "", priority: "Medium", communityNamesJson: "[]" },
    ] };
    const packages = await createRecapIntakeService({ repository }).listPackages();
    assert.deepEqual(packages.map(row => [row.transactionId, row.requests[0].title]), [["REC-1", "A"], ["REC-2", "B"]]);
});

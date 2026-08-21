import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { readFileSync } from "node:fs";
import { createCosmDocumentRepository } from "../src/services/cosmDocumentRepository.js";
import { createCosmDocumentService, CosmDocumentNotFoundError, CosmDocumentValidationError } from "../src/services/cosmDocumentService.js";
import { createCosmRouter } from "../src/routes/cosm.js";

const DOCUMENT_ID = "11111111-1111-4111-8111-111111111111";
const VERSION_ID = "22222222-2222-4222-8222-222222222222";
const row = {
    id: DOCUMENT_ID, documentNumber: "COSM-ACT-003", title: "Resident Incident Response",
    category: "Resident Care", subcategory: "Incident Management", department: "Operations",
    audience: "Community Leaders", status: "Active", effectiveDate: "2026-08-01",
    reviewDate: "2027-08-01", expirationDate: null, ownerUserId: "owner-1",
    ownerDisplayName: "Document Owner", ownerEmail: "owner@example.com",
    contentStewardUserId: "steward-1", contentStewardDisplayName: "Content Steward",
    contentStewardEmail: "steward@example.com", supersedesDocumentId: null,
    supersedesDocumentNumber: null, createdAt: "2026-07-01T00:00:00Z", updatedAt: "2026-08-01T00:00:00Z",
    currentVersionId: VERSION_ID, versionSequence: 2, fileName: "incident-response.pdf",
    mimeType: "application/pdf", contentSize: 4096, webUrl: "https://example.invalid/document",
    effectiveAt: "2026-08-01T12:00:00Z", processingErrorCode: "DO_NOT_EXPOSE", sharePointSiteId: "private-site",
};
const version = {
    id: VERSION_ID, versionSequence: 2, lifecycleState: "Effective", fileName: "incident-response.pdf",
    mimeType: "application/pdf", contentSize: 4096, webUrl: "https://example.invalid/document",
    effectiveAt: "2026-08-01T12:00:00Z", uploadedAt: "2026-07-31T12:00:00Z", createdAt: "2026-07-31T12:00:00Z",
};

test("migration defines durable document and version identities with constrained lifecycle", () => {
    const sql = readFileSync(new URL("../src/migrations/012_cosm_document_foundation.sql", import.meta.url), "utf8");
    assert.match(sql, /CREATE TABLE cmdb\.CosmDocuments/);
    assert.match(sql, /CONSTRAINT UQ_CosmDocuments_DocumentNumber UNIQUE \(documentNumber\)/);
    assert.match(sql, /CHECK \(status IN \('Draft', 'Active', 'Superseded', 'Retired'\)\)/);
    assert.match(sql, /CREATE TABLE cmdb\.CosmDocumentVersions/);
    assert.match(sql, /CONSTRAINT UQ_CosmDocumentVersions_Sequence UNIQUE \(documentId, versionSequence\)/);
    assert.match(sql, /CHECK \(lifecycleState IN \('Draft', 'Effective', 'Historical'\)\)/);
    assert.match(sql, /FOREIGN KEY \(documentId\) REFERENCES cmdb\.CosmDocuments\(id\)/);
    assert.match(sql, /ALTER TABLE cmdb\.CosmDocuments WITH CHECK[\s\S]*FOREIGN KEY \(currentVersionId\) REFERENCES cmdb\.CosmDocumentVersions\(id\)/);
    assert.match(sql, /WHERE sharePointSiteKey IS NOT NULL AND driveId IS NOT NULL AND itemId IS NOT NULL AND sharePointVersionId IS NOT NULL/);
    assert.doesNotMatch(sql, /UNIQUE \(fileName\)|PRIMARY KEY \(documentNumber\)|PRIMARY KEY \(title\)/);
});

test("repository applies the employee-visible Active and Effective boundary", async () => {
    const calls = [];
    const repository = createCosmDocumentRepository({ query: async (sql, params) => { calls.push({ sql, params }); return []; } });
    assert.deepEqual(await repository.listDocuments(), []);
    assert.equal(await repository.getDocument(DOCUMENT_ID), null);
    await repository.listVersions(DOCUMENT_ID);
    assert.match(calls[0].sql, /documentRow\.status = 'Active' AND versionRow\.lifecycleState = 'Effective'/);
    assert.match(calls[1].sql, /documentRow\.id = @id/);
    assert.deepEqual(calls[1].params, { id: DOCUMENT_ID });
    assert.match(calls[2].sql, /lifecycleState IN \('Effective', 'Historical'\)/);
});

test("service maps application-oriented list and detail responses without SQL-only metadata", async () => {
    const service = createCosmDocumentService({ repository: {
        listDocuments: async () => [row], getDocument: async () => row, listVersions: async () => [version],
    } });
    const list = await service.listDocuments();
    assert.equal(list[0].id, DOCUMENT_ID);
    assert.equal(list[0].documentNumber, "COSM-ACT-003");
    assert.equal(list[0].currentVersion.id, VERSION_ID);
    assert.equal("sharePointSiteId" in list[0].currentVersion, false);
    assert.equal("processingErrorCode" in list[0], false);

    const detail = await service.getDocument(DOCUMENT_ID);
    assert.deepEqual(detail.owner, { id: "owner-1", displayName: "Document Owner", email: "owner@example.com" });
    assert.equal(detail.versions[0].lifecycleState, "Effective");
    assert.equal("contentSha256" in detail.versions[0], false);
    assert.equal("createdBy" in detail, false);
});

test("service validates technical UUID identity and reports an unknown document", async () => {
    let queried = false;
    const invalid = createCosmDocumentService({ repository: { getDocument: async () => { queried = true; } } });
    await assert.rejects(invalid.getDocument("incident-response.pdf"), CosmDocumentValidationError);
    assert.equal(queried, false);
    const missing = createCosmDocumentService({ repository: { getDocument: async () => null } });
    await assert.rejects(missing.getDocument(DOCUMENT_ID), CosmDocumentNotFoundError);
});

async function withServer(user, service, callback) {
    const app = express();
    app.use((req, _res, next) => { req.user = user; next(); });
    app.use("/api/cosm", createCosmRouter(service));
    const server = app.listen(0);
    await new Promise(resolve => server.once("listening", resolve));
    try {
        const { port } = server.address();
        await callback(`http://127.0.0.1:${port}`);
    } finally {
        await new Promise(resolve => server.close(resolve));
    }
}

test("document routes allow every current internal role and return an empty foundation", async () => {
    const service = { listDocuments: async () => [], getDocument: async () => { throw new CosmDocumentNotFoundError("COSM document not found"); } };
    for (const globalRole of ["PlatformAdmin", "Editor", "Viewer", "DDTeam"]) {
        await withServer({ id: globalRole, globalRole }, service, async base => {
            const response = await fetch(`${base}/api/cosm/documents`);
            assert.equal(response.status, 200);
            assert.deepEqual(await response.json(), { documents: [] });
        });
    }
});

test("document routes deny external and unauthenticated callers and return clean not-found responses", async () => {
    const service = { listDocuments: async () => [], getDocument: async () => { throw new CosmDocumentNotFoundError("COSM document not found"); } };
    for (const user of [null, { id: "broker", globalRole: "ExternalBroker" }, { id: "buyer", globalRole: "ExternalBuyer" }]) {
        await withServer(user, service, async base => {
            const response = await fetch(`${base}/api/cosm/documents`);
            assert.equal(response.status, user ? 403 : 401);
        });
    }
    await withServer({ id: "viewer", globalRole: "Viewer" }, service, async base => {
        const response = await fetch(`${base}/api/cosm/documents/${DOCUMENT_ID}`);
        assert.equal(response.status, 404);
        assert.deepEqual(await response.json(), { error: "COSM document not found" });
    });
});

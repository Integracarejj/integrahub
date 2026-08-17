import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { GraphRequestError } from "../src/integrations/sharepoint/graphClient.js";
import express from "express";
import portalRouter from "../src/routes/portal.js";
import { createRecapIncomingDocumentService, IncomingDocumentConflictError, IncomingDocumentForbiddenError } from "../src/services/recapIncomingDocumentService.js";

const transaction = { databaseId: "uuid-1", businessTransactionId: "REC-2026-00000001", name: "Test", owningExternalOrganizationId: "org-a" };

function harness({ transactionValue = transaction, organizationId = "org-a", accessibleOrganizations = [organizationId], existingDocument = null, collision = null, uploadError = null } = {}) {
    const calls = [];
    let document = existingDocument;
    const graph = {
        async findChildByExactName(_drive, parent, name) {
            calls.push(["find", parent, name]);
            if (parent === "workspace" && name === "Incoming Documents") return { id: "incoming", name, type: "folder" };
            if (parent === "incoming") return collision;
            return null;
        },
        async uploadNewFile(drive, parent, name, content) {
            calls.push(["upload", drive, parent, name, content.toString()]);
            if (uploadError) throw uploadError;
            return { id: "file-1", name, type: "file", size: content.length, webUrl: "https://site/file" };
        },
    };
    const documentRepository = {
        async getDefaultExternalOrganizationForUser() { return organizationId; },
        async userHasExternalOrganization(_userId, requestedOrganizationId) { return accessibleOrganizations.includes(requestedOrganizationId); },
        async getByPackage() { return document; },
        async createPending(values) { calls.push(["pending", values]); document = { id: "doc-1", status: "Pending", ...values }; return document; },
        async markUploaded(_id, values) { calls.push(["complete", values]); document = { ...document, ...values, status: "Uploaded", uploadedAt: "now" }; return document; },
    };
    const service = createRecapIncomingDocumentService({
        transactionService: { getTransactionById: async () => transactionValue },
        workspaceService: { provisionWorkspace: async (id) => calls.push(["provision", id]) },
        mappingRepository: {
            async withProvisioningLock(_id, _key, work) { calls.push(["lock"]); return work(); },
            async getByTransaction() { return { driveId: "drive", rootItemId: "workspace" }; },
        },
        documentRepository,
        loadConfig: () => ({}),
        graphClientFactory: () => graph,
    });
    return { service, calls };
}

const input = { businessTransactionId: transaction.businessTransactionId, sourcePackageId: "sub-123", originalFileName: "DD Package.xlsx", content: Buffer.from("package bytes"), actor: { id: "user-a" } };

test("authoritative transaction and matching external organization are required before Graph work", async () => {
    const missing = harness({ transactionValue: null });
    await assert.rejects(missing.service.uploadIncomingPackage(input), /not found/);
    assert.deepEqual(missing.calls, []);
    const forbidden = harness({ organizationId: "org-b" });
    await assert.rejects(forbidden.service.uploadIncomingPackage(input), IncomingDocumentForbiddenError);
    assert.equal(forbidden.calls.some(call => call[0] === "provision"), false);
});

test("upload reuses provisioning and targets only Incoming Documents with deterministic naming", async () => {
    const value = harness();
    const result = await value.service.uploadIncomingPackage(input);
    assert.equal(result.status, "Uploaded");
    assert.ok(value.calls.some(call => call[0] === "provision" && call[1] === transaction.businessTransactionId));
    const upload = value.calls.find(call => call[0] === "upload");
    assert.deepEqual(upload.slice(1, 3), ["drive", "incoming"]);
    assert.match(upload[3], /^DD Package - sub-123\.xlsx$/);
});

test("upload authorization accepts any authoritative membership, not only the creation default", async () => {
    const value = harness({ organizationId: "org-b", accessibleOrganizations: ["org-a", "org-b"] });
    assert.equal((await value.service.uploadIncomingPackage(input)).status, "Uploaded");
});

test("same package retry is idempotent and changed bytes are rejected", async () => {
    const sha = createHash("sha256").update(input.content).digest("hex");
    const uploaded = { id: "doc", recapTransactionId: "uuid-1", sourcePackageId: "sub-123", originalFileName: "DD Package.xlsx", storedFileName: "DD Package - sub-123.xlsx", contentSha256: sha, contentSize: input.content.length, status: "Uploaded", webUrl: "url", uploadedAt: "now" };
    const retry = harness({ existingDocument: uploaded });
    await retry.service.uploadIncomingPackage(input);
    assert.equal(retry.calls.some(call => call[0] === "upload"), false);
    await assert.rejects(retry.service.uploadIncomingPackage({ ...input, content: Buffer.from("different") }), IncomingDocumentConflictError);
});

test("unknown SharePoint collision and Graph failures do not complete metadata", async () => {
    const collision = harness({ collision: { id: "other", name: "DD Package - sub-123.xlsx", type: "file", size: 99 } });
    await assert.rejects(collision.service.uploadIncomingPackage(input), IncomingDocumentConflictError);
    assert.equal(collision.calls.some(call => call[0] === "complete"), false);

    const graphError = new GraphRequestError("SharePoint incoming file upload", 503, "serviceUnavailable");
    const failure = harness({ uploadError: graphError });
    await assert.rejects(failure.service.uploadIncomingPackage(input), (error) => error === graphError);
    assert.equal(failure.calls.some(call => call[0] === "complete"), false);

    const raced = harness({ uploadError: new GraphRequestError("SharePoint incoming file upload", 412, null) });
    await assert.rejects(raced.service.uploadIncomingPackage(input), IncomingDocumentConflictError);
    assert.equal(raced.calls.some(call => call[0] === "complete"), false);
});

async function routeStatus(user) {
    const app = express();
    app.use((req, _res, next) => { req.user = user; next(); });
    app.use("/api/portal", portalRouter);
    const server = app.listen(0);
    await new Promise(resolve => server.once("listening", resolve));
    try {
        const response = await fetch(`http://127.0.0.1:${server.address().port}/api/portal/recapitalization/transactions/REC-2026-00000001/incoming-documents`, {
            method: "POST",
            headers: { "Content-Type": "application/octet-stream", "x-file-name": "file.xlsx", "x-package-id": "sub-1" },
            body: "bytes",
        });
        return response.status;
    } finally {
        await new Promise(resolve => server.close(resolve));
    }
}

test("incoming package route rejects unauthenticated and non-broker portal users", async () => {
    assert.equal(await routeStatus(null), 401);
    assert.equal(await routeStatus({ id: "buyer", globalRole: "ExternalBuyer", portalRole: "ExternalBuyer" }), 403);
});

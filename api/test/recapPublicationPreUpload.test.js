import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createRecapPublicationService } from "../src/services/recapPublicationService.js";
import { GraphRequestError, SharePointGraphClient } from "../src/integrations/sharepoint/graphClient.js";
import { loadSharePointConfig } from "../src/integrations/sharepoint/config.js";
import { createRecapWorkItemsRouter } from "../src/routes/recapWorkItems.js";

const WORK = "11111111-1111-4111-8111-111111111111";
const PUB = "22222222-2222-4222-8222-222222222222";
const INPUT = { expectedVersion: "0x0000000000000001", idempotencyKey: "publish:private-operation" };
const ACTOR = { id: "dd", globalRole: "DDTeam" };
const TITLE = "Confirm LTC and its subsidiaries have no lease or other contractual arrangement with the proposed EIK or affiliates.";
const LIBERTY_REQUEST_PART = "Confirm LTC and its subsidiaries have no lease or other contractual arrangement with the proposed EIK or";
const folderPhases = ["publication-root-folder", "transaction-folder", "request-folder", "publication-folder"];
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

// Real Graph client, injected HTTP transport and in-memory repository. Never uses
// production credentials, SQL, or network. IDs and hash suffixes are fixtures.
function harness({ failPhase = null, existingFolders = false, configFailure = false, authFailure = false,
    requestTitle = TITLE, expectedRequestPart = LIBERTY_REQUEST_PART } = {}) {
    const folderNames = ["Recapitalization Published", "REC-2026-00000002 - Project Liberty",
        `DD-2026-00000178 - ${expectedRequestPart}`, "Publication 1"];
    const calls = [], logs = [], folders = new Map(), files = new Map();
    let publication = null;
    let failure = failPhase;
    const artifacts = ["RFF_Cert_2027.pdf", "State Survey Report.docx"].map((name, i) => ({
        artifactId: `33333333-3333-4333-8333-33333333333${i}`,
        originalFileName: name, storedFileName: name.replace(/(\.[^.]+)$/, " - abcdef012345$1"),
        sourceDriveId: "working-drive", sourceItemId: `source-${i}`, status: "Pending",
        contentType: i ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/pdf",
    }));
    const content = [Buffer.from("%PDF-test bytes"), Buffer.from([0x50, 0x4b, 3, 4, 0xff, 0x80])];
    if (existingFolders) folderNames.forEach((name, i) => folders.set(`folder-${i}`, {
        id: `folder-${i}`, name, folder: {}, parentReference: { id: i ? `folder-${i - 1}` : "root" },
    }));
    function check(phase) {
        calls.push(phase);
        return failure === phase ? json({ error: { code: "accessDenied", message: "Bearer private-token secret document bytes" } }, 403) : null;
    }
    const repository = {
        getByOperation: async (_work, key) => publication?.operationKey === key ? { ...publication } : null,
        getInternalContext: async () => ({ workItemId: WORK, requestNumber: "DD-2026-00000178", title: requestTitle,
            businessTransactionId: "REC-2026-00000002", transactionName: "Project Liberty", owningExternalOrganizationId: "TEST-BROKER-ORG" }),
        begin: async (_context, operationKey) => {
            calls.push("begin");
            publication = { id: PUB, workItemId: WORK, publicationNumber: 1, status: "Pending", operationKey, targetExternalOrganizationId: "TEST-BROKER-ORG" };
            return { ...publication };
        },
        listArtifacts: async () => {
            if (failure === "publication-artifacts") throw new Error("Artifact snapshot read failed");
            return artifacts.map(a => ({ ...a }));
        },
        recordReceipt: async (_pub, id, identity) => { calls.push("receipt"); Object.assign(artifacts.find(a => a.artifactId === id), identity, { status: "Receipt" }); },
        activateArtifact: async (_pub, id) => { calls.push("activate"); artifacts.find(a => a.artifactId === id).status = "Active"; },
        complete: async () => { calls.push("complete"); publication.status = "Published"; return { ...publication }; },
    };
    const client = new SharePointGraphClient({ getAccessToken: async () => {
        if (authFailure) throw new Error("Microsoft Graph token request failed (HTTP 401)");
        return "private-token";
    } }, async (url, options) => {
        assert.equal(options.headers.Authorization, "Bearer private-token");
        const path = new URL(url).pathname;
        if (path.startsWith("/v1.0/sites/integracare.sharepoint.com:")) {
            assert.equal(path, "/v1.0/sites/integracare.sharepoint.com:/sites/tIntegraSourceKnowledge");
            return check("knowledge-site") || json({ id: "knowledge-site" });
        }
        if (path === "/v1.0/sites/knowledge-site/drives") return check("knowledge-library") || json({ value: [{ id: "knowledge-drive", name: "Documents" }] });
        if (path === "/v1.0/drives/knowledge-drive/root") return check("knowledge-root") || json({ id: "root", name: "root", folder: {} });
        const child = path.match(/^\/v1.0\/drives\/knowledge-drive\/items\/(root|folder-\d)\/children$/);
        if (child) {
            const parent = child[1], index = parent === "root" ? 0 : Number(parent.slice(-1)) + 1;
            const phase = index < 4 ? folderPhases[index] : "destination-preflight";
            if (options.method === "POST") {
                const body = JSON.parse(options.body);
                // SharePoint rejects trailing spaces/periods, including those exposed
                // by truncation. Do not let a permissive mock hide this contract.
                if (/[. ]$/.test(body.name)) return json({ error: { code: "invalidRequest" } }, 400);
                assert.deepEqual(body, { name: folderNames[index], folder: {}, "@microsoft.graph.conflictBehavior": "fail" });
                const error = check(`${phase}-create`);
                if (error) return error;
                const item = { id: `folder-${index}`, name: body.name, folder: {}, parentReference: { id: parent } };
                folders.set(item.id, item);
                return json(item, 201);
            }
            return check(phase) || json({ value: [...folders.values(), ...files.values()].filter(item => item.parentReference?.id === parent) });
        }
        const source = path.match(/^\/v1.0\/drives\/working-drive\/items\/source-(\d)(\/content)?$/);
        if (source) {
            const index = Number(source[1]);
            if (source[2]) {
                assert.equal(options.redirect, "follow");
                return check("source-download") || new Response(content[index]);
            }
            assert.ok(new URL(url).searchParams.get("$select").split(",").includes("size"));
            return check("source-metadata") || json({ id: `source-${index}`, name: artifacts[index].storedFileName, file: {}, size: content[index].length });
        }
        const upload = path.match(/^\/v1.0\/drives\/knowledge-drive\/items\/folder-3:\/(.+):\/content$/);
        if (upload) {
            const name = decodeURIComponent(upload[1]), index = artifacts.findIndex(a => a.storedFileName === name);
            assert.ok(index >= 0);
            assert.equal(options.method, "PUT");
            assert.equal(options.headers["If-Match"], "0");
            assert.equal(options.headers["Content-Type"], "application/octet-stream");
            assert.deepEqual(options.body, content[index]);
            const error = check("destination-upload");
            if (error) return error;
            const item = { id: `copy-${index}`, name, file: {}, size: content[index].length, parentReference: { id: "folder-3" } };
            files.set(item.id, item);
            return json(item, 201);
        }
        const copied = path.match(/^\/v1.0\/drives\/knowledge-drive\/items\/copy-(\d)(\/content)?$/);
        if (copied) return copied[2] ? new Response(content[Number(copied[1])]) : json(files.get(`copy-${copied[1]}`));
        assert.fail(`Unexpected mock Graph call: ${options.method} ${url}`);
    });
    const service = createRecapPublicationService({ repository, graphClientFactory: () => client,
        loadConfig: () => {
            if (configFailure) throw new Error("SharePoint integration is not configured");
            return loadSharePointConfig({ SHAREPOINT_TENANT_ID: "tenant", SHAREPOINT_CLIENT_ID: "client", SHAREPOINT_CLIENT_SECRET: "secret" });
        },
        logError: (...args) => logs.push(args),
    });
    return { service, calls, logs, artifacts, folders, files, getPublication: () => publication, clearFailure: () => { failure = null; } };
}

for (const existingFolders of [false, true]) {
    test(`fresh Liberty publication copies PDF and DOCX with ${existingFolders ? "reused" : "new"} Knowledge folders`, async () => {
        const h = harness({ existingFolders });
        assert.equal((await h.service.publish(WORK, INPUT, ACTOR)).status, "Published");
        assert.deepEqual(h.calls.filter(c => !c.endsWith("-create")).slice(0, 12), ["begin", "knowledge-site", "knowledge-library", "knowledge-root",
            ...folderPhases, "source-metadata", "source-download", "destination-preflight", "destination-upload"]);
        assert.equal(h.calls.filter(c => c.endsWith("-create")).length, existingFolders ? 0 : 4);
        assert.equal(h.files.size, 2);
        assert.deepEqual(h.artifacts.map(a => a.status), ["Active", "Active"]);
        assert.deepEqual(h.logs, []);
    });
}

test("publication folder parts remain valid after truncation and reserved-character cleanup", async () => {
    for (const [requestTitle, expectedRequestPart] of [
        ["A".repeat(104) + ". continuation", "A".repeat(104)],
        ["A".repeat(103) + ". continuation", "A".repeat(103)],
        ['  Lease / EIK: "Affiliates"?  ', "Lease - EIK- -Affiliates-"],
        ["...   ", "Recap"],
    ]) {
        const h = harness({ requestTitle, expectedRequestPart });
        assert.equal((await h.service.publish(WORK, INPUT, ACTOR)).status, "Published");
        assert.equal(h.folders.get("folder-2").name, `DD-2026-00000178 - ${expectedRequestPart}`);
    }
});

for (const phase of ["publication-artifacts", "knowledge-site", "knowledge-library", "knowledge-root", ...folderPhases,
    ...folderPhases.map(p => `${p}-create`), "source-metadata", "source-download", "destination-preflight", "destination-upload"]) {
    test(`${phase} failure records context and preserves Pending state; same operation resumes Publication 1`, async () => {
        const h = harness({ failPhase: phase });
        await assert.rejects(h.service.publish(WORK, INPUT, ACTOR));
        assert.equal(h.getPublication().status, "Pending");
        assert.deepEqual(h.artifacts.map(a => a.status), ["Pending", "Pending"]);
        assert.equal(h.calls.includes("receipt"), false);
        assert.equal(h.files.size, 0);
        assert.equal(h.logs.length, 1);
        const [message, detail] = h.logs[0];
        assert.equal(message, "Recap publication phase failed");
        assert.equal(detail.phase, phase.replace(/-create$/, ""));
        assert.equal(detail.workItemId, WORK);
        assert.equal(detail.requestNumber, "DD-2026-00000178");
        assert.equal(detail.publicationId, PUB);
        assert.equal(detail.publicationNumber, 1);
        assert.equal(detail.graphStatus, phase === "publication-artifacts" ? null : 403);
        // downloadFile intentionally omits the remote error body/code.
        assert.equal(detail.graphCode, ["publication-artifacts", "source-download"].includes(phase) ? null : "accessDenied");
        assert.equal(detail.causeName, phase === "publication-artifacts" ? "Error" : "GraphRequestError");
        assert.match(detail.causeMessage, phase === "publication-artifacts" ? /snapshot read failed/ : phase === "source-download" ? /HTTP 403/ : /HTTP 403.*accessDenied/);
        assert.equal(detail.artifactId, /^(source|destination)-/.test(phase) ? h.artifacts[0].artifactId : null);
        assert.doesNotMatch(JSON.stringify(h.logs), /private-token|secret|document bytes|private-operation|Authorization/);
        h.clearFailure();
        assert.equal((await h.service.publish(WORK, INPUT, ACTOR)).publicationNumber, 1);
        assert.equal(h.calls.filter(c => c === "begin").length, 1);
        assert.equal(h.folders.size, 4);
        assert.equal(h.files.size, 2);
    });
}

test("configuration and authentication failures identify the phase without recording credentials", async () => {
    for (const option of ["configFailure", "authFailure"]) {
        const h = harness({ [option]: true });
        await assert.rejects(h.service.publish(WORK, INPUT, ACTOR));
        assert.equal(h.logs[0][1].phase, option === "configFailure" ? "knowledge-config" : "knowledge-site");
        assert.equal(h.getPublication().status, "Pending");
        assert.equal(h.calls.includes("receipt"), false);
        assert.doesNotMatch(JSON.stringify(h.logs), /private-token|private-operation|secret/);
    }
});

test("real publication service pre-upload failure keeps HTTP 503 generic", async () => {
    const h = harness({ failPhase: "source-download" });
    const app = express(); app.use(express.json());
    app.use((req, _res, next) => { req.user = ACTOR; next(); });
    app.use("/work-items", createRecapWorkItemsRouter({}, h.service));
    const server = app.listen(0, "127.0.0.1");
    await new Promise(resolve => server.once("listening", resolve));
    try {
        const response = await fetch(`http://127.0.0.1:${server.address().port}/work-items/${WORK}/publish-external`, {
            method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(INPUT),
        });
        assert.equal(response.status, 503);
        assert.deepEqual(await response.json(), { error: "Work item storage is unavailable" });
        assert.equal(h.logs[0][1].phase, "source-download");
        assert.deepEqual(h.artifacts.map(a => a.status), ["Pending", "Pending"]);
    } finally { await new Promise(resolve => server.close(resolve)); }
});

function diagnosticService(overrides = {}) {
    return createRecapPublicationService({
        repository: {
            getByOperation: async () => ({ id: PUB, publicationNumber: 1, status: "Pending" }),
            getInternalContext: async () => ({ requestNumber: "DD-2026-00000178", owningExternalOrganizationId: "ORG" }),
            listArtifacts: async () => [],
        },
        loadConfig: () => ({ sites: [{ key: "knowledge" }] }),
        ...overrides,
    });
}

test("Knowledge target validation precedes client construction", async () => {
    let constructed = false;
    const logs = [];
    const service = diagnosticService({
        loadConfig: () => ({ sites: [] }),
        graphClientFactory: () => { constructed = true; throw new Error("Factory must not run"); },
        logError: (...args) => logs.push(args),
    });
    await assert.rejects(service.publish(WORK, INPUT, ACTOR), { name: "SharePointConfigError" });
    assert.equal(constructed, false);
    assert.equal(logs[0][1].phase, "knowledge-config");
});

test("diagnostics preserve exact thrown values even when logging throws", async () => {
    for (const thrown of [null, undefined, "non-Error failure", new Error("Original failure"), new GraphRequestError("lookup", null, null)]) {
        for (const loggerThrows of [false, true]) {
            const logs = [];
            const service = diagnosticService({
                graphClientFactory: () => ({ resolveSite: async () => { throw thrown; } }),
                logError: (...args) => { logs.push(args); if (loggerThrows) throw new Error("Logger failed"); },
            });
            let rejected = false;
            try { await service.publish(WORK, INPUT, ACTOR); }
            catch (error) { rejected = true; assert.equal(error, thrown); }
            assert.equal(rejected, true);
            assert.equal(logs.length, 1);
            assert.equal(logs[0][1].graphStatus, null);
            assert.equal(logs[0][1].graphCode, null);
        }
    }
});

test("diagnostics exclude structured Graph metadata and redact operation keys in error fields", async () => {
    const raw = { headers: { Authorization: "Bearer secret-token" }, content: "private document bytes" };
    const errors = [new GraphRequestError("lookup", raw, raw), new GraphRequestError(INPUT.idempotencyKey, 403, INPUT.idempotencyKey)];
    errors[1].name = INPUT.idempotencyKey;
    for (const original of errors) {
        const logs = [];
        const service = diagnosticService({
            graphClientFactory: () => ({ resolveSite: async () => { throw original; } }),
            logError: (...args) => logs.push(args),
        });
        await assert.rejects(service.publish(WORK, INPUT, ACTOR), error => error === original);
        assert.doesNotMatch(JSON.stringify(logs), /secret-token|Authorization|private document bytes|publish:private-operation/);
        if (original === errors[0]) {
            assert.equal(logs[0][1].graphCode, null);
            assert.equal(logs[0][1].graphStatus, null);
        }
    }
});

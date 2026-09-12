import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import express from "express";
import { createPortalRouter } from "../src/routes/portal.js";
import { createRecapPublicationService } from "../src/services/recapPublicationService.js";
import { createRecapPublicationRepository } from "../src/services/recapPublicationRepository.js";

const PUB = "22222222-2222-4222-8222-222222222222";
const ART = "33333333-3333-4333-8333-333333333333";
const WORK = "11111111-1111-4111-8111-111111111111";
const VERSION = "0x0000000000000001";

test("edition detail uses its snapshot instead of current Working response and preserves decision version", async () => {
    const row = { id: PUB, status: "Published", version: VERSION, responseContent: "Unpublished draft", title: "Changed title",
        contentSnapshotJson: JSON.stringify({ title: "Published title", requestNumber: "DD-2026-00000178", responseContent: "Published findings" }) };
    const service = createRecapPublicationService({ repository: {
        getExternalPublication: async () => row, listForExternalUser: async () => [row],
        listArtifacts: async () => [{ artifactId: ART, originalFileName: "Edition 1.pdf", contentType: "application/pdf" }],
    } });
    for (const role of ["ExternalBroker", "ExternalBuyer"]) {
        const actor = { id: "member", portalRole: role };
        const detail = await service.getExternal(PUB, actor);
        assert.equal(detail.title, "Published title");
        assert.equal(detail.responseContent, "Published findings");
        assert.equal(detail.responseSnapshotAvailable, true);
        assert.equal(detail.version, VERSION);
        assert.deepEqual((await service.listExternal(actor))[0], detail);
    }
    row.contentSnapshotJson = null;
    const legacy = await service.getExternal(PUB, { id: "member", portalRole: "ExternalBroker" });
    assert.equal(legacy.responseSnapshotAvailable, false);
    assert.equal(legacy.responseContent, null);
    row.contentSnapshotJson = JSON.stringify({ responseContent: "" });
    const blank = await service.getExternal(PUB, { id: "member", portalRole: "ExternalBroker" });
    assert.equal(blank.responseSnapshotAvailable, true);
    assert.equal(blank.responseContent, "");
    row.contentSnapshotJson = JSON.stringify({ responseContent: null });
    assert.equal((await service.getExternal(PUB, { id: "member", portalRole: "ExternalBroker" })).responseSnapshotAvailable, true);
});

test("new editions capture once; Pending retries and legacy retries never recapture Working findings", async () => {
    const editions = [];
    const snapshots = new Map();
    let working = "First findings", fail = true, begins = 0;
    const repository = {
        getByOperation: async (_work, key) => editions.find(row => row.operationKey === key),
        getInternalContext: async () => ({ workItemId: WORK, owningExternalOrganizationId: "ORG-A", responseContent: working }),
        begin: async (_context, key) => {
            begins++;
            const row = { id: `${PUB}-${begins}`, publicationNumber: begins, operationKey: key, status: "Pending",
                contentSnapshotJson: JSON.stringify({ responseContent: working }) };
            editions.push(row);
            snapshots.set(row.id, [{ publicationId: row.id, artifactId: ART, status: "Active" }]);
            return row;
        },
        listArtifacts: async id => snapshots.get(id),
        complete: async id => { const row = editions.find(item => item.id === id); row.status = "Published"; return row; },
    };
    const service = createRecapPublicationService({ repository, logError: () => {},
        loadConfig: () => {
            if (fail) throw new Error("simulated pre-upload failure");
            return { sites: [{ key: "knowledge", hostname: "host", sitePath: "/knowledge", libraryName: "Documents" }] };
        },
        graphClientFactory: () => ({ resolveSite: async () => ({ id: "site" }), findDriveByName: async () => ({ id: "drive" }),
            getDriveRoot: async () => ({ id: "root" }), findChildByExactName: async () => ({ id: "folder", type: "folder" }) }),
    });
    const publish = key => service.publish(WORK, { idempotencyKey: key, expectedVersion: VERSION }, { id: "dd", globalRole: "DDTeam" });
    await assert.rejects(publish("edition:1"), /simulated pre-upload failure/);
    const firstJson = editions[0].contentSnapshotJson;
    working = "Later mutable findings";
    fail = false;
    assert.equal((await publish("edition:1")).responseContent, "First findings");
    assert.equal(begins, 1);
    assert.equal(editions[0].contentSnapshotJson, firstJson);
    assert.equal((await publish("edition:1")).responseContent, "First findings");
    // Repository lifecycle checks are covered separately: emulate completed rework/review here.
    editions[0].status = "Rework Requested";
    const second = await publish("edition:2");
    assert.equal(second.publicationNumber, 2);
    assert.equal(second.responseContent, working);
    assert.equal(editions[0].contentSnapshotJson, firstJson);
    assert.equal(begins, 2);
    editions.push({ id: "legacy", operationKey: "legacy:1", status: "Pending", contentSnapshotJson: null });
    snapshots.set("legacy", []);
    const legacy = await publish("legacy:1");
    assert.equal(legacy.responseSnapshotAvailable, false);
    assert.equal(legacy.responseContent, null);
    assert.equal(begins, 2);
});

test("repository scopes edition lookup/list/content and captures findings only at publication begin", async () => {
    const calls = [];
    const repository = createRecapPublicationRepository({ query: async (sql, params) => { calls.push({ sql, params }); return []; } });
    await repository.listForExternalUser("member");
    await repository.getExternalPublication("member", PUB);
    await repository.getExternalArtifact("member", PUB, ART);
    for (const call of calls) {
        assert.match(call.sql, /membership\.userId = @userId/);
        assert.match(call.sql, /membership\.externalOrganizationId = publication\.targetExternalOrganizationId/);
        assert.equal(call.params.userId, "member");
    }
    assert.match(calls[0].sql, /CONVERT\(varchar\(18\), publication.version, 1\) AS version/);
    assert.match(calls[1].sql, /publication.id = @publicationId/);
    assert.match(calls[2].sql, /published.publicationId = @publicationId AND published.artifactId = @artifactId AND published.status = 'Active'/);
    await repository.begin({ workItemId: WORK, owningExternalOrganizationId: "TEST-BROKER-ORG" }, "publish:key", "dd", VERSION);
    assert.match(calls[3].sql, /WITH \(UPDLOCK, HOLDLOCK\)[\s\S]*INSERT INTO cmdb.RecapPublications[\s\S]*contentSnapshotJson[\s\S]*workItem.responseContent[\s\S]*FOR JSON PATH, INCLUDE_NULL_VALUES, WITHOUT_ARRAY_WRAPPER[\s\S]*COMMIT/);
    for (const action of ["approve", "rework"]) {
        await repository.partnerAction(PUB, "member", "TEST-BROKER-ORG", action, "Revise", VERSION);
        const call = calls.at(-1);
        assert.equal(call.params.workStatus, action === "approve" ? "Completed" : "In Progress");
        assert.match(call.sql, /status = 'Waiting Partner Review'/);
        assert.match(call.sql, /publication.version = CONVERT\(binary\(8\), @expectedVersion, 1\)/);
        assert.match(call.sql, /WITH \(UPDLOCK, HOLDLOCK\)[\s\S]*publication.status = 'Published'/);
        assert.match(call.sql, /membership.userId = @userId AND membership.externalOrganizationId = @organizationId/);
        assert.doesNotMatch(call.sql, /SET[^;]*assignedUserId\s*=/);
        assert.doesNotMatch(call.sql, /SET contentSnapshotJson|Needs DD Review|DELETE FROM/);
    }
    await repository.complete(PUB, "dd");
    assert.doesNotMatch(calls.at(-1).sql, /SET[^;]*contentSnapshotJson\s*=/);
});

test("external HTTP endpoints deny cross-org and guessed edition/artifact IDs before Graph or partner writes", async () => {
    let graphCalls = 0, decisions = 0;
    let decisionStatus = "Published";
    const bytes = Buffer.from("edition bytes");
    const service = createRecapPublicationService({
        loadConfig: () => ({}),
        graphClientFactory: () => { graphCalls++; return {
            getItem: async () => ({ id: "copy", name: "stored.pdf", type: "file" }),
            downloadFile: async () => ({ content: bytes }),
        }; },
        repository: {
            listForExternalUser: async user => user === "test-member" ? [{ id: PUB, status: "Published", version: VERSION }] : [],
            getExternalPublication: async (user, id) => user === "test-member" && id === PUB ? { id: PUB, status: decisionStatus, version: VERSION, targetExternalOrganizationId: "TEST-BROKER-ORG" } : null,
            getExternalArtifact: async (user, pub, artifact) => user === "test-member" && pub === PUB && artifact === ART
                ? { knowledgeDriveId: "knowledge", knowledgeItemId: "copy", storedFileName: "stored.pdf", originalFileName: "edition.pdf",
                    storedContentSize: bytes.length, storedContentSha256: createHash("sha256").update(bytes).digest("hex") } : null,
            listArtifacts: async () => [],
            partnerAction: async (id, user, org, action, _guidance, version) => {
                assert.equal(id, PUB); assert.equal(user, "test-member"); assert.equal(org, "TEST-BROKER-ORG");
                if (version !== VERSION || decisionStatus !== "Published") throw new Error("Partner action cannot be applied or is stale");
                decisions++; decisionStatus = action === "approve" ? "Approved" : "Rework Requested";
                return { id: PUB, status: decisionStatus, version: "0x0000000000000002" };
            },
        },
    });
    const app = express(); app.use(express.json());
    app.use((req, _res, next) => {
        if (req.headers["x-test-user"]) req.user = { id: req.headers["x-test-user"], portalRole: req.headers["x-test-role"] || "ExternalBroker" };
        next();
    });
    app.use("/portal", createPortalRouter({ publicationService: service }));
    const server = app.listen(0, "127.0.0.1"); await new Promise(resolve => server.once("listening", resolve));
    const base = `http://127.0.0.1:${server.address().port}/portal/recapitalization/publications`;
    try {
        assert.equal((await fetch(base)).status, 401);
        for (const role of ["ExternalBroker", "ExternalBuyer"]) {
            const headers = { "x-test-user": "atlas-member", "x-test-role": role, "content-type": "application/json" };
            assert.deepEqual(await (await fetch(base + "?organizationId=TEST-BROKER-ORG", { headers })).json(), { publications: [] });
            assert.equal((await fetch(`${base}/${PUB}`, { headers })).status, 404);
            assert.equal((await fetch(`${base}/${PUB}/artifacts/${ART}/content`, { headers })).status, 404);
            assert.equal((await fetch(`${base}/${PUB}/decision`, { method: "POST", headers,
                body: JSON.stringify({ action: "approve", expectedVersion: VERSION, organizationId: "TEST-BROKER-ORG" }) })).status, 404);
        }
        const headers = { "x-test-user": "test-member" };
        assert.equal((await fetch(`${base}/${PUB}`, { headers })).status, 200);
        assert.equal((await fetch(`${base}/${WORK}`, { headers })).status, 404);
        assert.equal((await fetch(`${base}/DD-2026-00000178`, { headers })).status, 400);
        assert.equal((await fetch(`${base}/${PUB}/artifacts/${WORK}/content`, { headers })).status, 404);
        assert.equal((await fetch(`${base}/${PUB}`, { headers: { ...headers, "x-test-role": "DDTeam" } })).status, 403);
        assert.equal(graphCalls, 0); assert.equal(decisions, 0);
        assert.equal((await (await fetch(base, { headers })).json()).publications.length, 1);
        assert.equal(await (await fetch(`${base}/${PUB}/artifacts/${ART}/content`, { headers })).text(), bytes.toString());
        const decide = (action, version = VERSION) => fetch(`${base}/${PUB}/decision`, { method: "POST",
            headers: { ...headers, "content-type": "application/json" },
            body: JSON.stringify({ action, guidance: "Revise", expectedVersion: version, organizationId: "CLIENT-SPOOF" }) });
        assert.equal((await decide("approve", "0x0000000000000000")).status, 409);
        const responses = await Promise.all([decide("approve"), decide("rework")]);
        assert.deepEqual(responses.map(item => item.status).sort(), [200, 409]);
        assert.equal((await decide("approve")).status, 409);
        assert.equal(decisions, 1);
    } finally { await new Promise(resolve => server.close(resolve)); }
});

test("migration 024 adds nullable edition JSON without backfilling mutable response content", async () => {
    const sql = await readFile(new URL("../src/migrations/024_recap_publication_content_snapshot.sql", import.meta.url), "utf8");
    assert.match(sql, /ADD contentSnapshotJson NVARCHAR\(MAX\) NULL/);
    assert.match(sql, /ISJSON\(contentSnapshotJson\) = 1/);
    assert.doesNotMatch(sql, /UPDATE\s+cmdb\./i);
    const literal = sql.match(/DECLARE @contentSha256 CHAR\(64\) = '([A-F0-9]{64})'/)[1];
    const normalized = sql.replace(/\r\n/g, "\n").replace(/(DECLARE @contentSha256 CHAR\(64\) = ')[A-F0-9]{64}/, "$1" + "0".repeat(64));
    assert.equal(literal, createHash("sha256").update(normalized).digest("hex").toUpperCase());
});

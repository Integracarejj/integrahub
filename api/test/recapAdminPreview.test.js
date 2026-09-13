import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createHash } from "node:crypto";
import { createRecapExternalPreviewRouter } from "../src/routes/recapExternalPreview.js";
import { createPortalRouter } from "../src/routes/portal.js";
import { createRecapPublicationService } from "../src/services/recapPublicationService.js";
import { createRecapPublicationRepository } from "../src/services/recapPublicationRepository.js";

const PUB = "22222222-2222-4222-8222-222222222222";
const ART = "33333333-3333-4333-8333-333333333333";
const admin = { id: "admin", globalRole: "PlatformAdmin" };

test("admin preview requires explicit PlatformAdmin, valid server organization, and is read-only", async () => {
    let reads = 0, downloads = 0;
    const bytes = Buffer.from("edition bytes");
    const service = createRecapPublicationService({
        repository: {
            listAdminPreviewOrganizations: async () => { reads++; return [{ id: "TEST-BROKER-ORG" }, { id: "OTHER" }]; },
            listForAdminPreview: async org => org === "TEST-BROKER-ORG" ? [{ id: PUB, status: "Published", contentSnapshotJson: null }] : [],
            getAdminPreviewPublication: async (org, id) => org === "TEST-BROKER-ORG" && id === PUB ? { id, status: "Published", contentSnapshotJson: null } : null,
            listArtifacts: async () => [{ artifactId: ART, originalFileName: "report.pdf" }],
            getAdminPreviewArtifact: async (org, id, artifact) => org === "TEST-BROKER-ORG" && id === PUB && artifact === ART
                ? { knowledgeDriveId: "drive", knowledgeItemId: "copy", storedFileName: "stored.pdf", originalFileName: "report.pdf",
                    storedContentSize: bytes.length, storedContentSha256: createHash("sha256").update(bytes).digest("hex") } : null,
        },
        loadConfig: () => ({}), graphClientFactory: () => ({
            getItem: async () => ({ id: "copy", name: "stored.pdf", type: "file" }),
            downloadFile: async () => { downloads++; return { content: bytes }; },
        }),
    });
    const app = express();
    app.use((req, _res, next) => { if (req.headers["x-role"]) req.user = { id: "actor", globalRole: req.headers["x-role"] }; next(); });
    app.use("/preview", createRecapExternalPreviewRouter({ service }));
    app.use("/external", createPortalRouter({ publicationService: service }));
    const server = app.listen(0, "127.0.0.1"); await new Promise(resolve => server.once("listening", resolve));
    const base = `http://127.0.0.1:${server.address().port}/preview`;
    const call = (path, role = "PlatformAdmin", method = "GET") => fetch(base + path, { method, headers: role ? { "x-role": role } : {} });
    try {
        assert.equal((await call("/organizations", null)).status, 401);
        for (const role of ["ExternalBroker", "ExternalBuyer", "DDTeam", "Viewer", "Editor"]) {
            for (const path of ["/organizations", "/TEST-BROKER-ORG/publications", `/TEST-BROKER-ORG/publications/${PUB}`, `/TEST-BROKER-ORG/publications/${PUB}/artifacts/${ART}/content`]) {
                assert.equal((await call(path + "?organizationId=TEST-BROKER-ORG&preview=true", role)).status, 403);
            }
            await assert.rejects(service.listAdminPreview("TEST-BROKER-ORG", { id: "actor", globalRole: role }));
        }
        assert.equal(reads, 0);
        for (const override of ["x-dev-user-email", "x-entra-object-id"]) {
            const spoofed = await fetch(base + "/organizations", { headers: { "x-role": "PlatformAdmin", [override]: "known-admin" } });
            assert.equal(spoofed.status, 403);
        }
        assert.equal(reads, 0);
        assert.equal((await call("/organizations")).status, 200);
        assert.equal((await call("/MISSING/publications")).status, 404);
        assert.deepEqual((await (await call("/OTHER/publications")).json()).publications, []);
        assert.equal((await (await call("/TEST-BROKER-ORG/publications")).json()).publications.length, 1);
        const detail = await (await call(`/TEST-BROKER-ORG/publications/${PUB}`)).json();
        assert.equal(detail.publication.responseSnapshotAvailable, false);
        assert.equal(detail.publication.responseContent, null);
        assert.equal((await call(`/OTHER/publications/${PUB}`)).status, 404);
        assert.equal((await call(`/OTHER/publications/${PUB}/artifacts/${ART}/content`)).status, 404);
        assert.equal((await call(`/TEST-BROKER-ORG/publications/${PUB}/artifacts/${PUB}/content`)).status, 404);
        assert.equal(downloads, 0);
        assert.equal(await (await call(`/TEST-BROKER-ORG/publications/${PUB}/artifacts/${ART}/content`)).text(), bytes.toString());
        for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
            for (const action of ["approve", "rework"]) assert.equal((await call(`/TEST-BROKER-ORG/publications/${PUB}/decision?action=${action}`, "PlatformAdmin", method)).status, 403);
        }
        await assert.rejects(service.partnerAction(PUB, { action: "approve", expectedVersion: "0x0000000000000001" }, admin));
        const normalDecision = await fetch(base.replace("/preview", "/external") + `/recapitalization/publications/${PUB}/decision?organizationId=TEST-BROKER-ORG&preview=true`, {
            method: "POST", headers: { "x-role": "PlatformAdmin" },
        });
        assert.equal(normalDecision.status, 403);
    } finally { await new Promise(resolve => server.close(resolve)); }
});

test("preview SQL scopes every read to selected target org; real-user membership SQL remains separate", async () => {
    const calls = [];
    const repo = createRecapPublicationRepository({ query: async (sql, params) => { calls.push({ sql, params }); return []; } });
    await repo.listForAdminPreview("ORG");
    await repo.getAdminPreviewPublication("ORG", PUB);
    await repo.getAdminPreviewArtifact("ORG", PUB, ART);
    for (const { sql, params } of calls) {
        assert.match(sql, /publication.targetExternalOrganizationId = @organizationId/);
        assert.equal(params.organizationId, "ORG");
        assert.doesNotMatch(sql, /INSERT|UPDATE|DELETE/);
    }
    assert.match(calls[2].sql, /published.publicationId = @publicationId AND published.artifactId = @artifactId AND published.status = 'Active'/);
    calls.length = 0;
    await repo.listForExternalUser("external"); await repo.getExternalPublication("external", PUB); await repo.getExternalArtifact("external", PUB, ART);
    for (const { sql } of calls) assert.match(sql, /membership.userId = @userId[\s\S]*membership.externalOrganizationId = publication.targetExternalOrganizationId/);
});

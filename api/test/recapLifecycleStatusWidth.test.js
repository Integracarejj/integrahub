import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const migrationUrl = new URL("../src/migrations/023_recap_lifecycle_status_width.sql", import.meta.url);

function valuesFromConstraint(sql, constraintName) {
    const body = sql.match(new RegExp(`CONSTRAINT ${constraintName} CHECK \\(status IN \\(([\\s\\S]*?)\\)\\);`))?.[1] || "";
    return [...body.matchAll(/'([^']+)'/g)].map(match => match[1]);
}

test("migration 023 widens every affected lifecycle column and has a recalculable checksum", async () => {
    const sql = await readFile(migrationUrl, "utf8");
    assert.match(sql, /ALTER TABLE cmdb\.RecapWorkItems ALTER COLUMN status VARCHAR\(32\) NOT NULL/);
    assert.match(sql, /ALTER TABLE cmdb\.RecapWorkArtifacts ALTER COLUMN publicationEligibility VARCHAR\(32\) NOT NULL/);
    assert.match(sql, /WITH CHECK ADD CONSTRAINT CK_RecapWorkItems_Status/);
    assert.match(sql, /WITH CHECK ADD CONSTRAINT CK_RecapWorkArtifacts_PublicationEligibility/);
    assert.match(sql, /CHECK CONSTRAINT CK_RecapWorkItems_Status/);
    assert.match(sql, /CHECK CONSTRAINT CK_RecapWorkArtifacts_PublicationEligibility/);
    assert.match(sql, /THROW 51095, 'Migration 023 post-change schema verification failed.'/);
    assert.ok(sql.indexOf("THROW 51095") < sql.indexOf("INSERT INTO cmdb.SchemaMigrations"));
    assert.match(sql, /indexInfo\.is_unique = 0 AND indexInfo\.has_filter = 1/);
    assert.match(sql, /\(1, 'workItemId', 0\), \(2, 'publicationEligibility', 0\), \(3, 'uploadedAt', 1\)/);
    assert.match(sql, /filter_definition[\s\S]*status=''Uploaded''/);
    const checksum = sql.match(/DECLARE @contentSha256 CHAR\(64\) = '([0-9A-F]{64})'/)?.[1];
    const normalized = sql.replace(/\r\n/g, "\n").replace(/(DECLARE @contentSha256 CHAR\(64\) = ')[0-9A-F]{64}(')/, `$1${"0".repeat(64)}$2`);
    assert.equal(checksum, createHash("sha256").update(normalized).digest("hex").toUpperCase());
});

test("every authoritative work-item status fits the physical status column", async () => {
    const sql = await readFile(migrationUrl, "utf8");
    const capacity = Number(sql.match(/RecapWorkItems ALTER COLUMN status VARCHAR\((\d+)\)/)?.[1]);
    const statuses = valuesFromConstraint(sql, "CK_RecapWorkItems_Status");
    assert.deepEqual(new Set(statuses), new Set([
        "Queued", "Assigned", "In Progress", "Clarification Needed", "Blocked", "Needs DD Review",
        "Ready to Publish", "Waiting Partner Review", "Completed", "Not Applicable", "Duplicate",
    ]));
    for (const status of statuses) assert.ok(status.length <= capacity, `${status} exceeds VARCHAR(${capacity})`);
});

test("migration 022 lifecycle literals fit their corrected physical columns", async () => {
    const sql = await readFile(migrationUrl, "utf8");
    const eligibilityCapacity = Number(sql.match(/RecapWorkArtifacts ALTER COLUMN publicationEligibility VARCHAR\((\d+)\)/)?.[1]);
    for (const value of ["Active", "PendingReplacement", "Superseded"]) {
        assert.ok(value.length <= eligibilityCapacity, `${value} exceeds VARCHAR(${eligibilityCapacity})`);
    }
    assert.ok("Rework Requested".length <= 24);
    assert.ok("PartnerRequestedRework".length <= 40);
    assert.ok("Waiting Partner Review".length <= 24);
});

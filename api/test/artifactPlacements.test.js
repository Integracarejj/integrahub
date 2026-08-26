import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL("../src/migrations/016_artifact_placements.sql", import.meta.url);

test("migration 016 adds an additive placement foundation with immutable history", async () => {
    const migration = await readFile(migrationUrl, "utf8");
    assert.match(migration, /CREATE TABLE cmdb\.ArtifactPlacements/);
    assert.match(migration, /FK_ArtifactPlacements_Artifact FOREIGN KEY \(artifactId\) REFERENCES cmdb\.Artifacts\(id\)/);
    assert.match(migration, /FK_ArtifactPlacements_Creator FOREIGN KEY \(createdByUserId\) REFERENCES cmdb\.Users\(id\)/);
    assert.match(migration, /version ROWVERSION NOT NULL/);
    assert.match(migration, /placementType IN \('Working', 'Knowledge', 'External'\)/);
    assert.match(migration, /placementStatus IN \('Pending', 'Active', 'Failed', 'Retracted', 'Archived'\)/);
    assert.match(migration, /siteKey IN \('working', 'knowledge', 'external'\)/);
    assert.doesNotMatch(migration, /placementType = 'External'\s+AND siteKey = 'external'/);
    assert.match(migration, /CK_ArtifactPlacements_GraphIdentity/);
    assert.match(migration, /CK_ArtifactPlacements_ActiveIdentity/);
    assert.match(migration, /siteId IS NULL AND driveId IS NULL AND itemId IS NULL AND webUrl IS NULL/);
    assert.match(migration, /siteId IS NOT NULL AND driveId IS NOT NULL AND itemId IS NOT NULL/);
    assert.match(migration, /placementStatus <> 'Active'[\s\S]*activatedAt IS NOT NULL/);
    assert.match(migration, /CREATE UNIQUE INDEX UQ_ArtifactPlacements_GraphItem[\s\S]*WHERE siteId IS NOT NULL AND driveId IS NOT NULL AND itemId IS NOT NULL/);
    assert.doesNotMatch(migration, /UNIQUE\s*\(artifactId,\s*placementType\)/i);
    assert.doesNotMatch(migration, /ON DELETE CASCADE/i);
    assert.doesNotMatch(migration, /ArtifactExternalPlacements|ArtifactCommunities|ArtifactPlacementEvents/);

    const checksums = [...migration.matchAll(/DECLARE @contentSha256 CHAR\(64\) = '([0-9A-F]{64})'/g)].map(match => match[1]);
    assert.equal(checksums.length, 1);
    const normalized = migration.replace(/\r\n/g, "\n").replace(/(DECLARE @contentSha256 CHAR\(64\) = ')[0-9A-F]{64}(')/g, `$1${"0".repeat(64)}$2`);
    assert.equal(checksums[0], createHash("sha256").update(normalized).digest("hex").toUpperCase());
    assert.match(migration, /SET XACT_ABORT ON/);
    assert.match(migration, /BEGIN TRY[\s\S]*BEGIN TRANSACTION/);
    assert.match(migration, /INSERT INTO cmdb\.SchemaMigrations[\s\S]*COMMIT TRANSACTION/);
    assert.match(migration, /BEGIN CATCH[\s\S]*ROLLBACK TRANSACTION;[\s\S]*THROW;/);
    assert.equal((migration.match(/\bGO\b/g) || []).length, 0);
    assert.doesNotMatch(migration, /DROP TABLE|TRUNCATE TABLE|DELETE FROM cmdb\.|UPDATE cmdb\.Artifacts/i);
});

test("migration 016 maps every existing Artifact to one compatible Working placement", async () => {
    const migration = await readFile(migrationUrl, "utf8");
    assert.match(migration, /INSERT INTO cmdb\.ArtifactPlacements/);
    assert.match(migration, /NEWID\(\), artifact\.id, 'Working'/);
    assert.match(migration, /WHEN 'Uploaded' THEN 'Active'/);
    assert.match(migration, /WHEN 'Pending' THEN 'Pending'/);
    assert.match(migration, /WHEN 'Failed' THEN 'Failed'/);
    assert.match(migration, /'working', artifact\.siteId, artifact\.driveId, artifact\.itemId, artifact\.webUrl/);
    assert.match(migration, /artifact\.libraryKey, artifact\.submittedByUserId, artifact\.createdAt, artifact\.updatedAt/);
    assert.match(migration, /artifact\.ingestionState = 'Uploaded' THEN artifact\.uploadedAt/);
    assert.match(migration, /COUNT_BIG\(\*\) FROM cmdb\.ArtifactPlacements[\s\S]*COUNT_BIG\(\*\) FROM cmdb\.Artifacts/);
    assert.match(migration, /placementType <> 'Working'/);
    assert.doesNotMatch(migration, /INSERT INTO cmdb\.Artifacts|UPDATE cmdb\.Artifacts|ALTER TABLE cmdb\.Artifacts/);
});

test("migration 016 leaves migration 015 and runtime contracts outside its scope", async () => {
    const migration = await readFile(migrationUrl, "utf8");
    assert.doesNotMatch(migration, /CREATE TABLE cmdb\.Artifacts/);
    assert.doesNotMatch(migration, /routes|services|frontend|SharePointGraphClient/);
    assert.match(migration, /storageDestination <> 'Working'/);
    assert.match(migration, /libraryKey NOT IN \('Projects', 'Legal', 'Operations'\)/);
    assert.match(migration, /Existing Artifact data is incompatible/);
});

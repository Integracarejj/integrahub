import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const MIGRATION_URL = new URL("../src/migrations/018_artifact_placement_stored_identity.sql", import.meta.url);

test("migration 018 adds nullable all-or-none physical identity only to Artifact placements", async () => {
    const migration = await readFile(MIGRATION_URL, "utf8");
    assert.match(migration, /ALTER TABLE cmdb\.ArtifactPlacements ADD[\s\S]*storedContentSize BIGINT NULL/);
    assert.match(migration, /storedContentSha256 CHAR\(64\) NULL/);
    assert.match(migration, /storedObservedAt DATETIME2\(3\) NULL/);
    assert.match(migration, /CK_ArtifactPlacements_StoredIdentity/);
    assert.match(migration, /storedContentSize IS NOT NULL\s+AND storedContentSize BETWEEN 1 AND 20971520/);
    assert.match(migration, /EXEC\(N'ALTER TABLE cmdb\.ArtifactPlacements ADD CONSTRAINT CK_ArtifactPlacements_StoredIdentity CHECK/);
    assert.doesNotMatch(migration, /\nALTER TABLE cmdb\.ArtifactPlacements ADD CONSTRAINT CK_ArtifactPlacements_StoredIdentity CHECK/);
    assert.doesNotMatch(migration, /ALTER TABLE cmdb\.Artifacts ADD|UPDATE cmdb\.|DELETE FROM|DROP TABLE|TRUNCATE TABLE/);
});

test("migration 018 rejects every partial stored identity combination", async () => {
    const migration = await readFile(MIGRATION_URL, "utf8");
    for (const required of ["storedContentSize IS NOT NULL", "storedContentSha256 IS NOT NULL", "storedObservedAt IS NOT NULL"]) {
        assert.match(migration, new RegExp(required));
    }
    const valid = ({ size, hash, observedAt }) => (size == null && hash == null && observedAt == null)
        || (size != null && size >= 1 && size <= 20 * 1024 * 1024
            && typeof hash === "string" && /^[0-9a-f]{64}$/i.test(hash) && observedAt != null);
    const size = 21210; const hash = "a".repeat(64); const observedAt = "2026-08-29T00:00:00.000Z";
    for (const partial of [
        { size }, { hash }, { observedAt }, { size, hash }, { size, observedAt }, { hash, observedAt },
    ]) assert.equal(valid(partial), false);
    assert.equal(valid({ size: null, hash: null, observedAt: null }), true);
    assert.equal(valid({ size, hash, observedAt }), true);
});

test("migration 018 is checksummed, transactional, rerunnable, and rejects partial adoption", async () => {
    const migration = await readFile(MIGRATION_URL, "utf8");
    const checksum = migration.match(/DECLARE @contentSha256 CHAR\(64\) = '([0-9A-F]{64})'/)?.[1];
    const normalized = migration.replace(/\r\n/g, "\n")
        .replace(/(DECLARE @contentSha256 CHAR\(64\) = ')[0-9A-F]{64}(')/g, `$1${"0".repeat(64)}$2`);
    assert.equal(checksum?.toLowerCase(), createHash("sha256").update(normalized).digest("hex"));
    assert.match(migration, /SET XACT_ABORT ON/);
    assert.match(migration, /BEGIN TRY[\s\S]*BEGIN TRANSACTION/);
    assert.match(migration, /@existingChecksum = @contentSha256[\s\S]*Migration 018 already applied/);
    assert.match(migration, /SELECT contentSha256 FROM cmdb\.SchemaMigrations WHERE migrationName = @migrationName/);
    assert.match(migration, /INSERT INTO cmdb\.SchemaMigrations \(migrationName, contentSha256, releaseName, appliedBy\)/);
    assert.doesNotMatch(migration, /migrationChecksum|\brelease\b/);
    assert.match(migration, /typeInfo\.name = 'bigint'[\s\S]*columnInfo\.max_length = 8/);
    assert.match(migration, /typeInfo\.name = 'char'[\s\S]*columnInfo\.max_length = 64/);
    assert.match(migration, /typeInfo\.name = 'datetime2'[\s\S]*columnInfo\.scale = 3/);
    assert.match(migration, /constraintInfo\.is_disabled = 0 AND constraintInfo\.is_not_trusted = 0/);
    assert.match(migration, /CHARINDEX\('storedContentSize IS NOT NULL'/);
    assert.match(migration, /CHARINDEX\('storedContentSha256 IS NOT NULL'/);
    assert.match(migration, /CHARINDEX\('storedObservedAt IS NOT NULL'/);
    assert.match(migration, /CHARINDEX\('20971520'/);
    assert.match(migration, /Unrecorded Artifact placement stored identity schema already exists/);
    assert.match(migration, /INSERT INTO cmdb\.SchemaMigrations[\s\S]*COMMIT TRANSACTION/);
    assert.match(migration, /BEGIN CATCH[\s\S]*ROLLBACK TRANSACTION[\s\S]*THROW/);
});

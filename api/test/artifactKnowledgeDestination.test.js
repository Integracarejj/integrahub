import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

test("migration 017 permits only truthful Working and Knowledge compatibility combinations", async () => {
    const migration = await readFile(new URL("../src/migrations/017_artifact_knowledge_destination.sql", import.meta.url), "utf8");
    assert.match(migration, /ALTER COLUMN libraryKey VARCHAR\(16\) NULL/);
    assert.match(migration, /storageDestination = 'Working'[\s\S]*libraryKey IN \('Projects', 'Legal', 'Operations'\)/);
    assert.match(migration, /storageDestination = 'Knowledge'[\s\S]*libraryKey IS NULL/);
    assert.doesNotMatch(migration, /storageDestination = 'External'/);
    assert.match(migration, /DROP CONSTRAINT CK_Artifacts_StorageDestination/);
    assert.match(migration, /DROP CONSTRAINT CK_Artifacts_LibraryKey/);
    assert.doesNotMatch(migration, /DROP INDEX|CREATE UNIQUE INDEX/);
});

test("migration 017 is transactional, checksummed, rerunnable, and fail closed", async () => {
    const migration = await readFile(new URL("../src/migrations/017_artifact_knowledge_destination.sql", import.meta.url), "utf8");
    const checksum = migration.match(/DECLARE @contentSha256 CHAR\(64\) = '([0-9A-F]{64})'/)?.[1];
    const normalized = migration.replace(/\r\n/g, "\n").replace(/(DECLARE @contentSha256 CHAR\(64\) = ')[0-9A-F]{64}(')/g, `$1${"0".repeat(64)}$2`);
    assert.equal(checksum?.toLowerCase(), createHash("sha256").update(normalized).digest("hex"));
    assert.match(migration, /SET XACT_ABORT ON/);
    assert.match(migration, /BEGIN TRY[\s\S]*BEGIN TRANSACTION/);
    assert.match(migration, /@existingChecksum = @contentSha256[\s\S]*Migration 017 already applied/);
    assert.match(migration, /INSERT INTO cmdb\.SchemaMigrations[\s\S]*COMMIT TRANSACTION/);
    assert.match(migration, /BEGIN CATCH[\s\S]*ROLLBACK TRANSACTION[\s\S]*THROW/);
});

test("migration 017 does not alter migrations 015 or 016 and preserves existing Working rows", async () => {
    const migration = await readFile(new URL("../src/migrations/017_artifact_knowledge_destination.sql", import.meta.url), "utf8");
    assert.match(migration, /EXISTS \(SELECT 1 FROM cmdb\.Artifacts WHERE storageDestination <> 'Working'/);
    assert.doesNotMatch(migration, /UPDATE cmdb\.Artifacts|DELETE FROM cmdb\.Artifacts|INSERT INTO cmdb\.ArtifactPlacements/);
});

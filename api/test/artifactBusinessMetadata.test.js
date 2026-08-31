import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const migrationUrl = new URL("../src/migrations/019_artifact_business_metadata.sql", import.meta.url);

test("migration 019 adds only nullable Artifact metadata and controlled registries", async () => {
    const migration = await readFile(migrationUrl, "utf8");
    assert.match(migration, /CREATE TABLE cmdb\.DocumentTypes/);
    assert.match(migration, /CREATE TABLE cmdb\.BusinessTopics/);
    assert.match(migration, /documentTitle NVARCHAR\(255\) NULL/);
    assert.match(migration, /documentOrigin NVARCHAR\(255\) NULL/);
    assert.match(migration, /documentTypeKey VARCHAR\(64\) NULL/);
    assert.match(migration, /businessTopicSlug VARCHAR\(64\) NULL/);
    assert.match(migration, /FK_Artifacts_DocumentType/);
    assert.match(migration, /FK_Artifacts_BusinessTopic/);
    assert.match(migration, /EXEC\(N'ALTER TABLE cmdb\.Artifacts ADD documentTitle/);
    assert.doesNotMatch(migration, /UPDATE cmdb\.Artifacts|ALTER TABLE cmdb\.ArtifactPlacements|DELETE FROM|TRUNCATE TABLE/);
});

test("migration 019 preserves the frontend Business Topic vocabulary and Document Type values", async () => {
    const migration = await readFile(migrationUrl, "utf8");
    const topicSource = await readFile(new URL("../../src/data/topics.ts", import.meta.url), "utf8");
    const slugs = [...topicSource.matchAll(/\n\s*slug: "([a-z0-9-]+)"/g)].map(match => match[1]);
    assert.equal(slugs.length, 19);
    for (const slug of slugs) assert.match(migration, new RegExp(`\\('${slug}',`));
    for (const name of ["Policy", "Procedure", "Contract / Agreement", "Financial", "Report / Analysis",
        "Government / Regulatory Guidance", "Project Document", "Meeting / Notes", "Form / Template",
        "Presentation", "Reference Material", "Other"]) assert.match(migration, new RegExp(`N'${name.replace("/", "\\/")}'`));
});

test("migration 019 is transactional, rerunnable, and checksummed", async () => {
    const migration = await readFile(migrationUrl, "utf8");
    const checksum = migration.match(/DECLARE @contentSha256 CHAR\(64\) = '([0-9A-F]{64})'/)?.[1];
    const normalized = migration.replace(/\r\n/g, "\n")
        .replace(/(DECLARE @contentSha256 CHAR\(64\) = ')[0-9A-F]{64}(')/g, `$1${"0".repeat(64)}$2`);
    assert.equal(checksum?.toLowerCase(), createHash("sha256").update(normalized).digest("hex"));
    assert.match(migration, /SET XACT_ABORT ON/);
    assert.match(migration, /BEGIN TRY[\s\S]*BEGIN TRANSACTION/);
    assert.match(migration, /@existingChecksum = @contentSha256[\s\S]*Migration 019 already applied/);
    assert.match(migration, /typeInfo\.name = 'nvarchar' AND columnInfo\.max_length = 510 AND columnInfo\.is_nullable = 1/);
    assert.match(migration, /expected\(columnName, typeName, maxLength, isNullable\)/);
    assert.match(migration, /foreignKey\.is_disabled = 0 AND foreignKey\.is_not_trusted = 0/);
    assert.match(migration, /sys\.foreign_key_columns mapping/);
    assert.match(migration, /EXEC sys\.sp_executesql[\s\S]*EXCEPT SELECT documentTypeKey, displayName, isActive, sortOrder FROM cmdb\.DocumentTypes/);
    assert.match(migration, /SELECT COUNT\(\*\) FROM cmdb\.BusinessTopics\) = 19/);
    assert.match(migration, /authoritative registry seeds are incomplete/);
    assert.match(migration, /Unrecorded Artifact business metadata schema already exists/);
    assert.match(migration, /INSERT INTO cmdb\.SchemaMigrations \(migrationName, contentSha256, releaseName, appliedBy\)[\s\S]*COMMIT TRANSACTION/);
});

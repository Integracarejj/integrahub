import * as fs from "node:fs";
import * as path from "node:path";
import * as XLSX from "xlsx";

/**
 * Runtime xlsx fixture generation.
 *
 * The parser used by the portal upload flow (parseUploadedXLSX in
 * src/services/portalMockData.ts) accepts a simple "# / Request Title"
 * worksheet — see src/__tests__/flexible-parser.test.ts for the exact
 * format it classifies as a REQUEST column.
 *
 * We build the workbooks with the repo-local `xlsx` devDependency and write
 * them under test-results/fixtures so the repository stays binary-free.
 */

export const KEYSTONE_FILE = "keystone.xlsx";
export const LIBERTY_FILE = "liberty.xlsx";
export const KEYSTONE_TITLE = "E2E Keystone Request";
export const LIBERTY_TITLE = "E2E Liberty Request";
export const REWORK_FILE = "project-rework-approval.xlsx";
export const REWORK_TITLE = "Project Rework Approval Request";
export const REWORK_ARTIFACT_FILE = "rework-approval-artifact.txt";
export const NOT_APPLICABLE_FILE = "project-not-applicable.xlsx";
export const NOT_APPLICABLE_TITLE = "Project Not Applicable Request";
export const DUPLICATE_FILE = "project-duplicate.xlsx";
export const DUPLICATE_PRIMARY_TITLE = "Project Duplicate Primary Request";
export const DUPLICATE_CANDIDATE_TITLE = "Project Duplicate Candidate Request";
export const NOT_MINE_FILE = "project-not-mine-reassignment.xlsx";
export const NOT_MINE_TITLE = "Project Not Mine Reassignment Request";
export const ATLAS_ISOLATION_FILE = "project-atlas-isolation.xlsx";
export const ATLAS_ISOLATION_TITLE = "Project Atlas Isolation Request";
export const SUMMIT_ISOLATION_FILE = "project-summit-isolation.xlsx";
export const SUMMIT_ISOLATION_TITLE = "Project Summit Isolation Request";

// Playwright workers are separate Node processes. Keep generated files in a
// process-scoped directory so concurrent workers never rewrite a fixture while
// another browser is uploading it.
const FIXTURE_DIR = path.join(process.cwd(), "test-results", "fixtures", `worker-${process.pid}`);

interface FixtureSet {
    keystone: string;
    liberty: string;
    rework: string;
    reworkArtifact: string;
    notApplicable: string;
    duplicate: string;
    notMine: string;
    atlasIsolation: string;
    summitIsolation: string;
}

function buildWorkbook(rows: (string | number)[][]): Buffer {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "DD Requests");
    return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

function ensureFixtures(): FixtureSet {
    fs.mkdirSync(FIXTURE_DIR, { recursive: true });

    const keystone = path.join(FIXTURE_DIR, KEYSTONE_FILE);
    const liberty = path.join(FIXTURE_DIR, LIBERTY_FILE);
    const rework = path.join(FIXTURE_DIR, REWORK_FILE);
    const reworkArtifact = path.join(FIXTURE_DIR, REWORK_ARTIFACT_FILE);
    const notApplicable = path.join(FIXTURE_DIR, NOT_APPLICABLE_FILE);
    const duplicate = path.join(FIXTURE_DIR, DUPLICATE_FILE);
    const notMine = path.join(FIXTURE_DIR, NOT_MINE_FILE);
    const atlasIsolation = path.join(FIXTURE_DIR, ATLAS_ISOLATION_FILE);
    const summitIsolation = path.join(FIXTURE_DIR, SUMMIT_ISOLATION_FILE);

    fs.writeFileSync(keystone, buildWorkbook([
        ["#", "Request Title"],
        [1, KEYSTONE_TITLE],
    ]));

    fs.writeFileSync(liberty, buildWorkbook([
        ["#", "Request Title"],
        [1, LIBERTY_TITLE],
    ]));

    fs.writeFileSync(rework, buildWorkbook([
        ["#", "Request Title"],
        [1, REWORK_TITLE],
    ]));
    fs.writeFileSync(reworkArtifact, "IntegraIQ deterministic external rework approval artifact.\n", "utf8");
    fs.writeFileSync(notApplicable, buildWorkbook([
        ["#", "Request Title"],
        [1, NOT_APPLICABLE_TITLE],
    ]));
    fs.writeFileSync(duplicate, buildWorkbook([
        ["#", "Request Title"],
        [1, DUPLICATE_PRIMARY_TITLE],
        [2, DUPLICATE_CANDIDATE_TITLE],
    ]));
    fs.writeFileSync(notMine, buildWorkbook([
        ["#", "Request Title"],
        [1, NOT_MINE_TITLE],
    ]));
    fs.writeFileSync(atlasIsolation, buildWorkbook([
        ["#", "Request Title"],
        [1, ATLAS_ISOLATION_TITLE],
    ]));
    fs.writeFileSync(summitIsolation, buildWorkbook([
        ["#", "Request Title"],
        [1, SUMMIT_ISOLATION_TITLE],
    ]));

    return { keystone, liberty, rework, reworkArtifact, notApplicable, duplicate, notMine, atlasIsolation, summitIsolation };
}

let cached: FixtureSet | null = null;

export function getFixturePaths(): FixtureSet {
    if (!cached) cached = ensureFixtures();
    return cached;
}

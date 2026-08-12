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

// Playwright workers are separate Node processes. Keep generated files in a
// process-scoped directory so concurrent workers never rewrite a fixture while
// another browser is uploading it.
const FIXTURE_DIR = path.join(process.cwd(), "test-results", "fixtures", `worker-${process.pid}`);

interface FixtureSet {
    keystone: string;
    liberty: string;
    rework: string;
    reworkArtifact: string;
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

    return { keystone, liberty, rework, reworkArtifact };
}

let cached: FixtureSet | null = null;

export function getFixturePaths(): FixtureSet {
    if (!cached) cached = ensureFixtures();
    return cached;
}

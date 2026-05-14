import { readFile, utils } from "xlsx";
import { readFileSync } from "node:fs";

const API_BASE = process.env.API_BASE || "http://localhost:4000";

function getAuthHeaders() {
    const headers = { "Content-Type": "application/json" };
    const devEmail = process.env.DEV_USER_EMAIL;
    if (devEmail) {
        headers["x-dev-user-email"] = devEmail;
    }
    return headers;
}

const excelPath = process.argv[2];
if (!excelPath) {
    console.error("Usage: node scripts/test-app-import-preview.js <path-to-excel-file>");
    console.error("  Set DEV_USER_EMAIL env var for auth (or ensure Easy Auth headers are present)");
    process.exit(1);
}

let workbook;
try {
    const data = readFileSync(excelPath);
    workbook = read(data, { type: "buffer" });
} catch (err) {
    console.error(`Failed to read Excel file "${excelPath}":`, err.message);
    process.exit(1);
}

const sheetName = workbook.SheetNames[0];
if (!sheetName) {
    console.error("Excel file has no worksheets");
    process.exit(1);
}

const sheet = workbook.Sheets[sheetName];
const rawRows = utils.sheet_to_json(sheet, { defval: "" });

console.log(`Read ${rawRows.length} rows from sheet "${sheetName}"`);

const COLUMN_MAP = [
    ["Application", "application"],
    ["Category", "category"],
    ["Vendor", "vendor"],
    ["Website", "website"],
    ["Description", "description"],
    ["Data Classification", "dataClassification"],
    ["Confidentiality Risk", "confidentialityRisk"],
    ["Integrity Risk", "integrityRisk"],
    ["Availability Risk", "availabilityRisk"],
    ["Owner", "owner"],
    ["Owner-Backup", "ownerBackup"],
    ["Number of Users", "numberOfUsers"],
    ["Comments", "comments"],
];

const mappedRows = rawRows.map((raw) => {
    const row = {};
    for (const [excelCol, jsonKey] of COLUMN_MAP) {
        row[jsonKey] = raw[excelCol] || "";
    }
    return row;
});

const url = `${API_BASE}/api/admin/applications/import-preview`;
console.log(`POST ${url}`);

try {
    const res = await fetch(url, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(mappedRows),
    });

    if (!res.ok) {
        const errText = await res.text();
        console.error(`Request failed (${res.status}):`, errText);
        process.exit(1);
    }

    const result = await res.json();

    console.log("\n=== Import Preview Results ===\n");
    console.log(`Total rows:       ${result.summary.totalRows}`);
    console.log(`Exact matches:    ${result.summary.exactMatches}`);
    console.log(`Likely matches:   ${result.summary.likelyMatches}`);
    console.log(`Would create:     ${result.summary.wouldCreate}`);
    console.log(`Would update:     ${result.summary.wouldUpdate}`);
    console.log(`Needs review:     ${result.summary.needsReview}`);

    if (result.exactMatches.length > 0) {
        console.log("\n--- Exact Matches ---");
        for (const m of result.exactMatches) {
            console.log(`  "${m.registryRow.name}" ↔ "${m.existingApplication.name}"`);
        }
    }

    if (result.likelyMatches.length > 0) {
        console.log("\n--- Likely Matches ---");
        for (const m of result.likelyMatches) {
            console.log(`  "${m.registryRow.name}" ~ "${m.existingApplication.name}"`);
        }
    }

    if (result.wouldCreate.length > 0) {
        console.log("\n--- Would Create ---");
        for (const c of result.wouldCreate) {
            const cap = c.suggestedCapability
                ? ` → ${c.suggestedCapability.name} (${c.suggestedCapability.id})`
                : " → no capability suggestion";
            console.log(`  "${c.registryRow.name}"${cap}`);
        }
    }

    if (result.needsReview.length > 0) {
        console.log("\n--- Needs Review ---");
        for (const r of result.needsReview) {
            console.log(`  ${r.reason}: ${JSON.stringify(r.row)}`);
        }
    }
} catch (err) {
    console.error("Request failed:", err.message);
    process.exit(1);
}

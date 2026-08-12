import fs from "node:fs";
import path from "node:path";
import type { Page, TestInfo } from "@playwright/test";
import { test, expect, gotoApp } from "./helpers/auth";
import { getFixturePaths, KEYSTONE_FILE, LIBERTY_FILE, KEYSTONE_TITLE, LIBERTY_TITLE } from "./helpers/fixtures";

/**
 * External Overview "Upload Another Package" destination routing.
 *
 * Regression for the Azure defect: the second package SILENTLY inherited the
 * first package's project/transaction, so Package B (liberty) was published
 * externally as PROJECT KEYSTONE.
 *
 * The fix makes the destination an explicit user choice:
 *   - Different Project → creates a DISTINCT transaction (Test A)
 *   - Same Project      → reuses the explicitly selected transaction (Test B)
 *
 * These tests ONLY exercise upload routing / project assignment. No internal
 * workflow steps (intake / tracker / workspace / publish) are run here — those
 * flows already have passing Playwright coverage.
 */

const PERSONA_USER_EMAIL = "broker@mail.com";

interface SubmissionRecord {
    id: string;
    fileName: string;
    packageName: string;
    status: string;
    transactionId?: string;
    transactionName: string;
    orgId?: string;
    orgName?: string;
    userId?: string;
    userName?: string;
    submittedAt: string;
    requestCount: number;
}

interface PortalSnapshot {
    persona: string | null;
    lastCreatedTransactionId: string | null;
    transactions: { id: string; name: string; orgId?: string; status?: string }[];
    transactionAccess: { transactionId: string; orgId?: string; userId?: string }[];
    submissions: SubmissionRecord[];
    authorizedTxnIds: string[];
    personaUserId: string | null;
    personaOrgId: string | null;
}

/* ── TEST A — additional package → NEW PROJECT creates a DISTINCT transaction ── */

test("Test A — additional package chosen as Different Project creates a distinct transaction", async ({ page }, testInfo: TestInfo) => {
    test.setTimeout(120_000);

    const fixtures = getFixturePaths();
    const evidence: Record<string, unknown> = {};

    try {
        /* ── Clean slate ── */
        await gotoApp(page, "/recapitalization/settings");
        await wipeRecapData(page);

        /* ── First package: keystone.xlsx (auto-creates its own project) ── */
        await gotoApp(page, "/portal");
        await expect(page.getByRole("heading", { name: "Upload your due diligence request list to begin" })).toBeVisible();
        await uploadFirstPackage(page, fixtures.keystone);

        /* ── Additional package: EXPLICIT Different Project → name "Liberty" ── */
        await page.getByRole("button", { name: "Upload Another Package" }).click();
        await expect(page.getByText("Is this package for the same project or a different project?")).toBeVisible({ timeout: 15_000 });
        await page.getByRole("radio", { name: "Different Project" }).check();
        await page.getByLabel("Project Name", { exact: true }).fill("Liberty");
        await uploadAdditionalPackage(page, fixtures.liberty);

        /* ── Assert routing: DISTINCT transactions ── */
        const snap = await capturePortalSnapshot(page);
        const subA = findSubmission(snap, KEYSTONE_FILE);
        const subB = findSubmission(snap, LIBERTY_FILE);
        expect(subA, "keystone submission missing").toBeDefined();
        expect(subB, "liberty submission missing").toBeDefined();

        const txnA = subA!.transactionId;
        const txnB = subB!.transactionId;
        expect(txnA, "Package A must record a transactionId").toBeTruthy();
        expect(txnB, "Package B must record a transactionId").toBeTruthy();
        expect(txnA, "New Project must create a DISTINCT transaction (no silent inheritance)").not.toBe(txnB);
        expect(subA!.transactionName).toBe("keystone");
        expect(subB!.transactionName).toBe("Liberty");
        expect(subA!.orgId).toBe("org-atlas");
        expect(subB!.orgId).toBe("org-atlas");

        // Atlas (org-atlas / broker) is authorized for BOTH transactions.
        expect(authorizedTxnIds(snap)).toEqual([txnA!, txnB!].sort());

        /* ── External project labels on the Overview dashboard ── */
        await expect(page.getByText("Package Submitted Successfully")).toBeVisible();
        const ksRow = page.locator(".po-requests-row", { hasText: KEYSTONE_TITLE });
        const lbRow = page.locator(".po-requests-row", { hasText: LIBERTY_TITLE });
        await expect(ksRow).toHaveCount(1);
        await expect(lbRow).toHaveCount(1);
        await expect(ksRow).toContainText("keystone"); // Project Keystone label
        await expect(lbRow).toContainText("Liberty");  // Project Liberty label
        const projectFilter = page.getByLabel("Filter by project");
        await expect(projectFilter).toBeVisible();
        await expect(projectFilter.locator("option")).toHaveText(["All Projects", "Liberty", "keystone"]);

        evidence.verdict = {
            packageA: { transactionId: txnA, transactionName: subA!.transactionName },
            packageB: { transactionId: txnB, transactionName: subB!.transactionName },
            distinct: txnA !== txnB,
        };
        console.log("TEST-A-VERDICT", JSON.stringify(evidence.verdict));
    } finally {
        exportEvidence(testInfo, "test-a-new-project", evidence);
    }
});

/* ── TEST B — additional package → EXISTING PROJECT reuses the selected transaction ── */

test("Test B — additional package chosen as Same Project reuses the selected transaction", async ({ page }, testInfo: TestInfo) => {
    test.setTimeout(120_000);

    const fixtures = getFixturePaths();
    const evidence: Record<string, unknown> = {};

    try {
        /* ── Clean slate ── */
        await gotoApp(page, "/recapitalization/settings");
        await wipeRecapData(page);

        /* ── First package: keystone.xlsx (auto-creates its own project) ── */
        await gotoApp(page, "/portal");
        await expect(page.getByRole("heading", { name: "Upload your due diligence request list to begin" })).toBeVisible();
        await uploadFirstPackage(page, fixtures.keystone);

        /* ── Additional package: EXPLICIT Same Project → keystone ── */
        await page.getByRole("button", { name: "Upload Another Package" }).click();
        await expect(page.getByText("Is this package for the same project or a different project?")).toBeVisible({ timeout: 15_000 });
        await page.getByRole("radio", { name: "Same Project" }).check();
        await page.getByLabel("Select Project", { exact: true }).selectOption({ label: "keystone" });
        await uploadAdditionalPackage(page, fixtures.liberty);

        /* ── Assert routing: SAME transaction, still Project Keystone ── */
        const snap = await capturePortalSnapshot(page);
        const subA = findSubmission(snap, KEYSTONE_FILE);
        const subB = findSubmission(snap, LIBERTY_FILE);
        expect(subA, "keystone submission missing").toBeDefined();
        expect(subB, "supplemental submission missing").toBeDefined();

        const txnA = subA!.transactionId;
        const txnB = subB!.transactionId;
        expect(txnA, "Package A must record a transactionId").toBeTruthy();
        expect(txnB, "Package B must record a transactionId").toBeTruthy();
        expect(txnB, "Existing Project must reuse the selected transaction").toBe(txnA);
        expect(subA!.transactionName).toBe("keystone");
        expect(subB!.transactionName).toBe("keystone"); // still Project Keystone
        expect(subA!.orgId).toBe("org-atlas");
        expect(subB!.orgId).toBe("org-atlas");

        // A single authorized project remains (no extra transaction created).
        expect(authorizedTxnIds(snap)).toEqual([txnA!]);

        /* ── External project label on the Overview dashboard stays keystone ── */
        await expect(page.getByText("Package Submitted Successfully")).toBeVisible();
        const ksRow = page.locator(".po-requests-row", { hasText: KEYSTONE_TITLE });
        const lbRow = page.locator(".po-requests-row", { hasText: LIBERTY_TITLE });
        await expect(ksRow).toHaveCount(1);
        await expect(lbRow).toHaveCount(1);
        await expect(ksRow).toContainText("keystone"); // Project Keystone label
        await expect(lbRow).toContainText("keystone"); // still Project Keystone
        const projectFilter = page.getByLabel("Filter by project");
        await expect(projectFilter).toBeVisible();
        await expect(projectFilter.locator("option")).toHaveText(["All Projects", "keystone"]);

        evidence.verdict = {
            packageA: { transactionId: txnA, transactionName: subA!.transactionName },
            packageB: { transactionId: txnB, transactionName: subB!.transactionName },
            sameTransaction: txnA === txnB,
        };
        console.log("TEST-B-VERDICT", JSON.stringify(evidence.verdict));
    } finally {
        exportEvidence(testInfo, "test-b-existing-project", evidence);
    }
});

/* ── Helpers ── */

async function uploadFirstPackage(page: Page, fixturePath: string): Promise<void> {
    await page.locator('input[type="file"]').first().setInputFiles(fixturePath);
    await expect(page.getByRole("heading", { name: "Package Successfully Analyzed" })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Submit Package" }).click();
    await expect(page.getByText("Package Submitted Successfully")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Upload Another Package" })).toBeVisible();
}

async function uploadAdditionalPackage(page: Page, fixturePath: string): Promise<void> {
    await page.locator('input[type="file"]').first().setInputFiles(fixturePath);
    await expect(page.getByRole("heading", { name: "Package Successfully Analyzed" })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Submit Package" }).click();
    await expect(page.getByText("Package Submitted Successfully")).toBeVisible({ timeout: 30_000 });
}

async function wipeRecapData(page: Page): Promise<void> {
    await page.getByRole("button", { name: "Wipe Recapitalization Test Data" }).first().click();
    await expect(page.locator(".rc-modal")).toBeVisible();
    await page.locator(".rc-modal").getByRole("button", { name: "Wipe Recapitalization Test Data" }).click();
    await expect(page.locator(".rc-modal")).toHaveCount(0, { timeout: 10_000 });
    const state = await page.evaluate(() => ({
        flag: localStorage.getItem("integrasource.recap.wiped"),
        transactions: localStorage.getItem("integrasource.recap.portalTransactions"),
        requests: localStorage.getItem("integrasource.recap.demo.portalRequests"),
        access: localStorage.getItem("integrasource.recap.portalTransactionAccess"),
    }));
    expect(state.flag).toBe("true");
    expect(state.transactions).toBeFalsy();
    expect(state.requests).toBeFalsy();
    expect(state.access).toBeFalsy();
}

async function capturePortalSnapshot(page: Page): Promise<PortalSnapshot> {
    return page.evaluate((personaEmail: string) => {
        const get = (key: string): unknown => {
            try {
                const raw = localStorage.getItem(key);
                return raw ? JSON.parse(raw) : null;
            } catch {
                return null;
            }
        };
        const users = (get("integrasource.recap.portalUsers") || []) as { id: string; email: string; organizationId?: string }[];
        const personaUser = users.find(u => u.email === personaEmail) || null;
        const access = (get("integrasource.recap.portalTransactionAccess") || []) as { transactionId: string; orgId?: string; userId?: string }[];
        const authorizedTxnIds = personaUser
            ? [...new Set(access.filter(a => a.userId === personaUser.id).map(a => a.transactionId))]
            : [];
        return {
            persona: localStorage.getItem("integrasource.recap.portalPersona"),
            lastCreatedTransactionId: localStorage.getItem("integrasource.recap.lastCreatedTransactionId"),
            transactions: (get("integrasource.recap.portalTransactions") || []) as PortalSnapshot["transactions"],
            transactionAccess: access,
            submissions: (get("integrasource.recap.demo.portalSubmissions") || []) as SubmissionRecord[],
            authorizedTxnIds,
            personaUserId: personaUser?.id || null,
            personaOrgId: personaUser?.organizationId || null,
        };
    }, PERSONA_USER_EMAIL);
}

function findSubmission(snapshot: PortalSnapshot, fileName: string): SubmissionRecord | undefined {
    return (snapshot.submissions || []).find(s => s.fileName === fileName);
}

function authorizedTxnIds(snapshot: PortalSnapshot): string[] {
    return [...new Set(snapshot.authorizedTxnIds)].sort();
}

function exportEvidence(testInfo: TestInfo, label: string, evidence: Record<string, unknown>): void {
    try {
        const out = testInfo.outputPath(`overview-routing-${label}-${testInfo.testId}.json`);
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.writeFileSync(out, JSON.stringify(evidence, null, 2), "utf8");
        console.log("EVIDENCE-EXPORT", out);
    } catch (err) {
        console.warn("exportEvidence failed:", err);
    }
}

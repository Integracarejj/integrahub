import fs from "node:fs";
import path from "node:path";
import type { TestInfo } from "@playwright/test";
import { test, expect, gotoApp, Page } from "./helpers/auth";
import { getFixturePaths, KEYSTONE_FILE, LIBERTY_FILE, KEYSTONE_TITLE, LIBERTY_TITLE } from "./helpers/fixtures";

/**
 * Multi-package external publication — end-to-end browser reproduction.
 *
 * Goal: drive the REAL UI (not service calls) to submit TWO broker packages
 * ("keystone", "liberty") into the SAME transaction, process both requests
 * through the internal workflow (Intake review → Work Queue → Accept →
 * Submit for DD Review → Publish External), then verify the external portal
 * shows BOTH requests with "Awaiting Your Review".
 *
 * The production defect this targets: service-level tests pass, but on the
 * real browser the SECOND (and later) package fails to appear externally.
 * If the second-package assertions fail here, that is a successful
 * reproduction — the failure stays visible.
 *
 * Transaction strategy: the broker persona is pre-scoped to a single DEMO
 * transaction (txn-abc-portfolio), and getPortalRequests() EXCLUDES those
 * demo transaction ids. Uploading to the persona's default transaction would
 * therefore be invisible on the portal. Instead we use the real
 * /portal/submit → "New Transaction" UI to create a fresh transaction named
 * "keystone", upload both packages into it, and verify BOTH appear on the
 * external portal afterwards. All workflow steps (review, move, accept,
 * complete, publish) are driven through the real UI.
 */

const AWAITING = "Awaiting Your Review";

test("two broker packages → same transaction → both published externally", async ({ page }, testInfo: TestInfo) => {
    test.setTimeout(300_000);

    const fixtures = getFixturePaths();

    // Start a persistent diagnostics session so the whole flow is traced,
    // regardless of whether the reproduction passes or fails.
    await startDiagSession(page);

    try {

    /* ── 1. Portal: create "keystone" transaction, upload + submit keystone ── */
    await gotoApp(page, "/portal/submit");
    await page.getByRole("button", { name: "Upload DD Package" }).click();
    await uploadViaSubmitForm(page, fixtures.keystone, { newTxnName: "keystone" });

    /* ── 2. Portal: upload + submit liberty into the SAME transaction ── */
    await uploadViaSubmitForm(page, fixtures.liberty, { txnLabel: "keystone" });

    /* ── 3. Intake: open the package review, mark BOTH requests ready ── */
    await gotoApp(page, "/recapitalization/intake");
    await expect(page.getByRole("heading", { name: "Intake Queue" })).toBeVisible();

    const keystoneIntakeRow = page.locator("tr", { hasText: "keystone.xlsx" }).first();
    await expect(keystoneIntakeRow).toBeVisible();
    await keystoneIntakeRow.click();

    await expect(page).toHaveURL(/\/recapitalization\/intake\/review\/[^/]+/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "Intake Workbench" })).toBeVisible();

    await setReviewState(page, KEYSTONE_TITLE);
    await setReviewState(page, LIBERTY_TITLE);

    await page.getByRole("button", { name: "Move Ready Items" }).click();
    await expect(page.getByRole("heading", { name: "Moved to Work Queue!" })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Open Work Queue" }).click();
    await expect(page).toHaveURL(/\/recapitalization\/tracker/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "Work Queue" })).toBeVisible();

    /* ── 4. Workspace: accept, complete, publish — for BOTH requests ── */
    await processRequestInWorkspace(page, KEYSTONE_TITLE);
    await processRequestInWorkspace(page, LIBERTY_TITLE);

    /* ── 5. External portal: BOTH requests published, no duplicates ── */
    await gotoApp(page, "/portal/requests");
    await expect(page.getByRole("heading", { name: "Requests" })).toBeVisible();

    for (const title of [KEYSTONE_TITLE, LIBERTY_TITLE]) {
        const rows = page.locator(".po-requests-row", { hasText: title });
        await expect(rows.first()).toBeVisible();
        await expect(rows).toHaveCount(1);
        await expect(rows.locator(".po-status-badge").first()).toHaveText(AWAITING);
    }

    /* ── 6. Per-package filter isolates each package ── */
    const packageFilter = page.locator(".po-filter-select").filter({ hasText: "All Packages" }).first();
    await expect(packageFilter).toBeVisible();

    await packageFilter.selectOption({ label: "keystone" });
    await expect(page.locator(".po-requests-row", { hasText: KEYSTONE_TITLE })).toHaveCount(1);
    await expect(page.locator(".po-requests-row", { hasText: LIBERTY_TITLE })).toHaveCount(0);

    await packageFilter.selectOption({ label: "liberty" });
    await expect(page.locator(".po-requests-row", { hasText: KEYSTONE_TITLE })).toHaveCount(0);
    await expect(page.locator(".po-requests-row", { hasText: LIBERTY_TITLE })).toHaveCount(1);

    await packageFilter.selectOption({ label: "All Packages" });
    await expect(page.locator(".po-requests-row", { hasText: KEYSTONE_TITLE })).toHaveCount(1);
    await expect(page.locator(".po-requests-row", { hasText: LIBERTY_TITLE })).toHaveCount(1);

    } finally {
        // Export the diagnostics session artifact on success AND failure.
        await stopAndExportDiag(page, testInfo);
    }
});

/* ── Helpers ── */

async function startDiagSession(page: Page): Promise<void> {
    try {
        await gotoApp(page, "/recapitalization/settings");
        await page.getByRole("button", { name: "Start Diagnostics Session" }).click();
        await expect(page.getByText(/Diagnostics session started/)).toBeVisible({ timeout: 10_000 });
        await expect(page.getByRole("button", { name: "Start Diagnostics Session" })).toBeDisabled();
    } catch (err) {
        console.warn("startDiagSession failed — continuing without diagnostics:", err);
    }
}

async function stopAndExportDiag(page: Page, testInfo: TestInfo): Promise<void> {
    try {
        await gotoApp(page, "/recapitalization/settings");
        const endBtn = page.getByRole("button", { name: "End Diagnostics Session" });
        if (await endBtn.isVisible().catch(() => false)) {
            await endBtn.click();
            await expect(page.getByText(/Diagnostics session ended/)).toBeVisible({ timeout: 10_000 });
        }
        const raw = await page.evaluate(() => localStorage.getItem("integrasource.recap.diagSession"));
        if (raw) {
            const out = testInfo.outputPath(`integraiq-diagnostics-${testInfo.testId}.json`);
            fs.mkdirSync(path.dirname(out), { recursive: true });
            fs.writeFileSync(out, raw, "utf8");
            console.log("DIAG-EXPORT", out);
        }
    } catch (err) {
        console.warn("stopAndExportDiag failed:", err);
    }
}

async function uploadViaSubmitForm(
    page: Page,
    fixturePath: string,
    opts: { newTxnName?: string; txnLabel?: string },
): Promise<void> {
    if (opts.newTxnName) {
        await page.getByRole("button", { name: "New Transaction" }).click();
        await page.getByPlaceholder("New transaction name").fill(opts.newTxnName);
    } else {
        await page.locator(".ps-select").first().selectOption({ label: opts.txnLabel! });
    }

    await page.locator('input[type="file"]').first().setInputFiles(fixturePath);
    await expect(page.getByRole("heading", { name: "File Selected" })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Analyze Package" }).click();
    await expect(page.getByRole("heading", { name: "Package Analyzed" })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Submit Package to IntegraCare" }).click();
    await expect(page.getByText(/Package submitted successfully!/)).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Upload Another Package" }).click();

    if (opts.newTxnName) {
        // New Transaction mode persists after submit — cancel it so the liberty
        // upload can be scoped to the existing "keystone" transaction (otherwise
        // Analyze would auto-create a SECOND transaction).
        await page.getByRole("button", { name: "Cancel", exact: true }).click();
        await expect(page.locator(".ps-select").first()).toBeVisible();
    }

    await expect(page.locator(".po-upload-zone").first()).toBeVisible({ timeout: 15_000 });
}

async function setReviewState(page: Page, title: string): Promise<void> {
    const row = page.locator("tr", { hasText: title }).first();
    await expect(row).toBeVisible();
    const reviewStateSelect = row.locator("select").filter({ has: page.locator("option", { hasText: "Move to Work Queue" }) }).first();
    await reviewStateSelect.selectOption({ label: "Move to Work Queue" });
    await expect(row.getByText("Ready", { exact: true })).toBeVisible();
}

async function processRequestInWorkspace(page: Page, title: string): Promise<void> {
    // Tracker → workspace
    const row = page.locator("tr", { hasText: title }).first();
    await expect(row).toBeVisible();
    await row.click();
    await expect(page).toHaveURL(/\/recapitalization\/workspace\/[^/]+/, { timeout: 20_000 });

    // Accept Work
    await expect(page.getByText("Accept Work", { exact: true })).toBeVisible({ timeout: 20_000 });
    await page.getByText("Accept Work", { exact: true }).click();

    // Submit for DD Review (completion tile)
    await expect(page.getByText("Submit for DD Review", { exact: true }).first()).toBeVisible({ timeout: 20_000 });
    await page.getByText("Submit for DD Review", { exact: true }).first().click();

    // Completion modal
    const modal = page.locator(".rc-modal");
    await modal.locator("textarea").fill(`E2E completion for ${title}`);
    await modal.getByRole("button", { name: "Submit for DD Review" }).click();

    // Completion dialog → stay on request
    const stayBtn = page.getByRole("button", { name: "Stay on Request" });
    await expect(stayBtn).toBeVisible({ timeout: 20_000 });
    await stayBtn.click();

    // Publish External (workspace publish bar)
    const publishBtn = page.getByRole("button", { name: "Publish", exact: true });
    await expect(publishBtn).toBeVisible();
    await expect(publishBtn).toBeEnabled({ timeout: 20_000 });
    await publishBtn.click();

    const pubModal = page.locator(".rc-modal");
    await pubModal.getByRole("button", { name: "Continue" }).click();
    await pubModal.getByRole("button", { name: "Confirm Publish External" }).click();
    // No artifacts attached → step 3 offers "Done"
    await pubModal.getByRole("button", { name: "Done", exact: true }).click();

    // Back on the Work Queue
    await expect(page).toHaveURL(/\/recapitalization\/tracker/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "Work Queue" })).toBeVisible();
}

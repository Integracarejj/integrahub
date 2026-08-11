import fs from "node:fs";
import path from "node:path";
import type { Locator, Page, TestInfo } from "@playwright/test";
import { test, expect, gotoApp } from "./helpers/auth";
import { getFixturePaths, KEYSTONE_FILE, LIBERTY_FILE, KEYSTONE_TITLE, LIBERTY_TITLE } from "./helpers/fixtures";

/**
 * Overview uploads → one transaction per package → identity survival.
 *
 * Goal: drive the REAL Overview (/portal) upload flow — not the
 * /portal/submit form — to submit TWO broker packages ("keystone",
 * "liberty"), confirm each package auto-creates its OWN transaction
 * (txnA != txnB) named after the file, then push both requests through the
 * internal workflow (Intake review → Move to Work Queue → Assign → Accept
 * Work) verifying request identity fields (requestId, canonical id,
 * transactionId, transactionName, submissionId, orgId) survive every hop,
 * ending with Atlas still authorized for BOTH transactions.
 *
 * Transaction strategy: the test starts from a wipe reset, so the Overview
 * has zero persona transactions and each file upload auto-creates a fresh
 * transaction named after the file. We stay on /portal between the two
 * uploads (no remount), so the second upload does NOT get scoped into the
 * first package's transaction. (A remount would default selectedTxnId to the
 * lastCreatedTransactionId and fold both packages into a single transaction.)
 */

const OWNER = "Sarah Chen";

test("Overview uploads create one transaction per package; identities survive intake → assign → accept", async ({ page }, testInfo: TestInfo) => {
    test.setTimeout(300_000);

    const fixtures = getFixturePaths();

    // Persistent diagnostics session tracing the whole flow — started BEFORE
    // the wipe so the reset itself is captured too.
    await startDiagSession(page);

    try {

    /* ── 0. Wipe reset: clean slate (no transactions, requests, or access) ── */
    await wipeRecapData(page);

    /* ── 1. Upload keystone.xlsx through the real Overview, submit ── */
    await gotoApp(page, "/portal");
    await expect(page.getByRole("heading", { name: "Upload your due diligence request list to begin" })).toBeVisible();
    await page.locator('input[type="file"]').first().setInputFiles(fixtures.keystone);
    await expect(page.getByRole("heading", { name: "Package Successfully Analyzed" })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Submit Package" }).click();
    await expect(page.getByText("Package Submitted Successfully")).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Upload Another Package" }).click();
    await expect(page.getByText("Drop your due diligence package here")).toBeVisible();

    /* ── 2. Upload liberty.xlsx through the real Overview, submit (no remount) ── */
    await page.locator('input[type="file"]').first().setInputFiles(fixtures.liberty);
    await expect(page.getByRole("heading", { name: "Package Successfully Analyzed" })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Submit Package" }).click();
    await expect(page.getByText("Package Submitted Successfully")).toBeVisible({ timeout: 30_000 });

    /* ── 3. Capture identities right after upload ── */
    const afterUpload = await snapshotPortal(page);
    const keystone = req(afterUpload, KEYSTONE_TITLE);
    const liberty = req(afterUpload, LIBERTY_TITLE);
    const keystoneSub = afterUpload.submissions.find(s => s.fileName === KEYSTONE_FILE);
    const libertySub = afterUpload.submissions.find(s => s.fileName === LIBERTY_FILE);
    expect(keystoneSub, "keystone submission missing").toBeTruthy();
    expect(libertySub, "liberty submission missing").toBeTruthy();

    const txnA = keystoneSub!.transactionId as string;
    const txnB = libertySub!.transactionId as string;
    expect(txnA).toBeTruthy();
    expect(txnB).toBeTruthy();
    expect(txnA).not.toBe(txnB);

    expect(keystoneSub!.transactionName).toBe("keystone");
    expect(libertySub!.transactionName).toBe("liberty");

    expect(keystone.transactionId).toBe(txnA);
    expect(keystone.transactionName).toBe("keystone");
    expect(keystone.orgId).toBe("org-atlas");
    expect(liberty.transactionId).toBe(txnB);
    expect(liberty.transactionName).toBe("liberty");
    expect(liberty.orgId).toBe("org-atlas");

    // Atlas (ext-user-alex / org-atlas) is authorized for BOTH transactions.
    expect(authorizedTxnIds(afterUpload)).toEqual([txnA, txnB].sort());

    /* ── 4. Intake: mark keystone ready, Move to Work Queue ── */
    await gotoApp(page, "/recapitalization/intake");
    await expect(page.getByRole("heading", { name: "Intake Queue" })).toBeVisible();
    await page.locator("tr", { hasText: KEYSTONE_FILE }).first().click();
    await expect(page).toHaveURL(/\/recapitalization\/intake\/review\/[^/]+/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "Intake Workbench" })).toBeVisible();
    await setReviewState(page, KEYSTONE_TITLE);
    await page.getByRole("button", { name: "Move Ready Items" }).click();
    await expect(page.getByRole("heading", { name: "Moved to Work Queue!" })).toBeVisible({ timeout: 30_000 });

    /* ── 5. After keystone move: transactionId unchanged, liberty untouched ── */
    const afterKeystoneMove = await snapshotPortal(page);
    expect(req(afterKeystoneMove, KEYSTONE_TITLE).transactionId).toBe(txnA);
    expect(req(afterKeystoneMove, KEYSTONE_TITLE)._publishedAt).toBeTruthy();
    expect(req(afterKeystoneMove, LIBERTY_TITLE).transactionId).toBe(txnB);
    expect(req(afterKeystoneMove, LIBERTY_TITLE)._publishedAt).toBeFalsy();

    /* ── 6. Return to Intake, repeat for liberty ── */
    await page.getByRole("button", { name: "Back to Intake" }).click();
    await expect(page).toHaveURL(/\/recapitalization\/intake/, { timeout: 20_000 });
    await page.locator("tr", { hasText: LIBERTY_FILE }).first().click();
    await expect(page).toHaveURL(/\/recapitalization\/intake\/review\/[^/]+/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "Intake Workbench" })).toBeVisible();
    await setReviewState(page, LIBERTY_TITLE);
    await page.getByRole("button", { name: "Move Ready Items" }).click();
    await expect(page.getByRole("heading", { name: "Moved to Work Queue!" })).toBeVisible({ timeout: 30_000 });

    /* ── 7. After Intake → Work Queue: both published, identities unchanged ── */
    const afterBothMoved = await snapshotPortal(page);
    expect(req(afterBothMoved, KEYSTONE_TITLE).transactionId).toBe(txnA);
    expect(req(afterBothMoved, KEYSTONE_TITLE)._publishedAt).toBeTruthy();
    expect(req(afterBothMoved, LIBERTY_TITLE).transactionId).toBe(txnB);
    expect(req(afterBothMoved, LIBERTY_TITLE)._publishedAt).toBeTruthy();

    await page.getByRole("button", { name: "Open Work Queue" }).click();
    await expect(page).toHaveURL(/\/recapitalization\/tracker/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "Work Queue" })).toBeVisible();

    /* ── 8. Work Queue: each request present exactly once, in its own transaction ── */
    const keystoneRow = page.locator("tr", { hasText: KEYSTONE_TITLE });
    const libertyRow = page.locator("tr", { hasText: LIBERTY_TITLE });
    await expect(keystoneRow).toHaveCount(1);
    await expect(libertyRow).toHaveCount(1);
    await expect(keystoneRow.locator("td").nth(3)).toHaveText(/keystone/i);
    await expect(libertyRow.locator("td").nth(3)).toHaveText(/liberty/i);

    /* ── 9. Assign both to the same contributor ── */
    await assignOwner(page, keystoneRow, OWNER);
    await assignOwner(page, libertyRow, OWNER);

    const afterAssign = await snapshotPortal(page);
    expect(req(afterAssign, KEYSTONE_TITLE).owner).toBe(OWNER);
    expect(req(afterAssign, LIBERTY_TITLE).owner).toBe(OWNER);
    expect(req(afterAssign, KEYSTONE_TITLE).transactionId).toBe(txnA);
    expect(req(afterAssign, LIBERTY_TITLE).transactionId).toBe(txnB);

    /* ── 10. Accept work in the workspace (keystone then liberty) ── */
    await acceptWorkFromTracker(page, KEYSTONE_TITLE);
    const afterKeystoneAccept = await snapshotPortal(page);
    expect(req(afterKeystoneAccept, KEYSTONE_TITLE).transactionId).toBe(txnA);
    expect(req(afterKeystoneAccept, KEYSTONE_TITLE).status).toBe("In Progress");
    expect(req(afterKeystoneAccept, KEYSTONE_TITLE)._processingStartedAt).toBeTruthy();

    await acceptWorkFromTracker(page, LIBERTY_TITLE);
    const afterLibertyAccept = await snapshotPortal(page);
    expect(req(afterLibertyAccept, LIBERTY_TITLE).transactionId).toBe(txnB);
    expect(req(afterLibertyAccept, LIBERTY_TITLE).status).toBe("In Progress");
    expect(req(afterLibertyAccept, LIBERTY_TITLE)._processingStartedAt).toBeTruthy();

    /* ── 11. Final reconciliation: identity + Atlas authorization ── */
    const finalState = await snapshotPortal(page);
    expect(authorizedTxnIds(finalState)).toEqual([txnA, txnB].sort());

    const reconciliation = buildReconciliation(afterUpload, finalState, txnA, txnB);
    const out = testInfo.outputPath(`identity-reconciliation-${testInfo.testId}.json`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(reconciliation, null, 2), "utf8");
    console.log("IDENTITY-RECON", out);
    console.log("IDENTITY-RECON-DATA", JSON.stringify(reconciliation, null, 2));

    } finally {
        await stopAndExportDiag(page, testInfo);
    }
});

/* ── Helpers ── */

interface PortalSnapshot {
    requests: any[];
    submissions: any[];
    txnAccess: any[];
}

function req(s: PortalSnapshot, title: string): any {
    const found = s.requests.find(r => r.title === title);
    if (!found) throw new Error(`Request not found in portalRequests: ${title}`);
    return found;
}

function authorizedTxnIds(s: PortalSnapshot): string[] {
    return [...new Set(
        s.txnAccess
            .filter(a => a.orgId === "org-atlas" && a.userId === "ext-user-alex")
            .map(a => a.transactionId),
    )].sort();
}

async function snapshotPortal(page: Page): Promise<PortalSnapshot> {
    return page.evaluate(() => {
        const get = (key: string) => {
            const raw = localStorage.getItem(key);
            if (!raw) return [];
            try {
                return JSON.parse(raw);
            } catch {
                return [];
            }
        };
        return {
            requests: get("integrasource.recap.demo.portalRequests"),
            submissions: get("integrasource.recap.demo.portalSubmissions"),
            txnAccess: get("integrasource.recap.portalTransactionAccess"),
        };
    });
}

function buildReconciliation(afterUpload: PortalSnapshot, finalState: PortalSnapshot, txnA: string, txnB: string) {
    const pick = (r: any) => ({
        title: r.title,
        requestId: r.requestId,
        canonicalId: r.id,
        transactionId: r.transactionId,
        transactionName: r.transactionName,
        submissionId: (r._sourcePackageId || "").replace(/-intake$/, "") || undefined,
        sourcePackageId: r._sourcePackageId || undefined,
        orgId: r.orgId,
        orgName: r.orgName,
        status: r.status,
        owner: r.owner ?? r.assignedTo ?? null,
        publishedAt: r._publishedAt ?? null,
        processingStartedAt: r._processingStartedAt ?? null,
        expectedTransactionId: r.title === KEYSTONE_TITLE ? txnA : txnB,
    });
    return {
        goal: "Overview uploads → one transaction per package → identity survival",
        transactions: { txnA, txnB, distinct: txnA !== txnB },
        atlasAuthorization: {
            afterUpload: authorizedTxnIds(afterUpload),
            final: authorizedTxnIds(finalState),
        },
        submissions: afterUpload.submissions.map(s => ({
            id: s.id,
            fileName: s.fileName,
            transactionId: s.transactionId,
            transactionName: s.transactionName,
            orgId: s.orgId,
            orgName: s.orgName,
        })),
        afterUpload: afterUpload.requests.map(pick),
        final: finalState.requests.map(pick),
    };
}

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

async function setReviewState(page: Page, title: string): Promise<void> {
    const row = page.locator("tr", { hasText: title }).first();
    await expect(row).toBeVisible();
    const reviewStateSelect = row.locator("select").filter({ has: page.locator("option", { hasText: "Move to Work Queue" }) }).first();
    await reviewStateSelect.selectOption({ label: "Move to Work Queue" });
    await expect(row.getByText("Ready", { exact: true })).toBeVisible();
}

async function assignOwner(page: Page, row: Locator, owner: string): Promise<void> {
    const ownerSelect = row.locator("select").filter({ has: page.locator("option", { hasText: owner }) }).first();
    await expect(ownerSelect).toBeVisible();
    await ownerSelect.selectOption({ label: owner });
    await expect(page.locator(".rc-modal")).toBeVisible();
    await page.locator(".rc-modal").getByRole("button", { name: "Assign" }).click();
    await expect(page.locator(".rc-modal")).toHaveCount(0);
}

async function acceptWorkFromTracker(page: Page, title: string): Promise<void> {
    const row = page.locator("tr", { hasText: title }).first();
    await expect(row).toBeVisible();
    // Click the deliverable cell, not the row center: the center can land on the
    // status/owner selects (stopPropagation) and never trigger the row navigate.
    await row.locator("td").nth(2).click();
    await expect(page).toHaveURL(/\/recapitalization\/workspace\/[^/]+/, { timeout: 20_000 });
    await expect(page.getByText("Accept Work", { exact: true })).toBeVisible({ timeout: 20_000 });
    await page.getByText("Accept Work", { exact: true }).click();
    await expect(page.getByText("Submit for DD Review", { exact: true }).first()).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Back to Work Queue" }).click();
    await expect(page).toHaveURL(/\/recapitalization\/tracker/, { timeout: 20_000 });
}

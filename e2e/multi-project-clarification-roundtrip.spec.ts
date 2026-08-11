import fs from "node:fs";
import path from "node:path";
import type { Locator, Page, TestInfo } from "@playwright/test";
import { test, expect, gotoApp } from "./helpers/auth";
import { getFixturePaths, KEYSTONE_FILE, LIBERTY_FILE, KEYSTONE_TITLE, LIBERTY_TITLE } from "./helpers/fixtures";

/**
 * Clarification round-trip across two projects (keystone + liberty).
 *
 * Goal: from the SAME proven starting state as the identity-flow regression
 * spec (two Overview uploads → one transaction per package → intake → assign
 * → accept), drive the full INTERNAL clarification cycle per request, exactly
 * once per project:
 *
 *   Accept Work → Need Clarification (contributor) →
 *   DD Operations → DD Ops answers INTERNALLY (Path A) →
 *   Return to contributor → contributor re-accepts / resumes.
 *
 * The workflow stops there. No completion, no external publish, no external
 * "Awaiting Your Review" checks. The assertion surface is the request state
 * after each hop plus request-identity survival (transactionId/owner/status).
 *
 * Role mechanics exercised:
 *   - Contributor opens the workspace from My Work (from: "my-work"), so the
 *     workspace currentUser stays "Sarah Chen" (no actingUser passed).
 *   - DD Operations opens the workspace from DD Operations (from:
 *     "dd-operations", actingUser "David Park").
 *   - Path A (Answer Contributor) returns the request to the ORIGINAL
 *     contributor (_clarificationRaisedBy = Sarah Chen).
 */

const CONTRIBUTOR = "Sarah Chen";
const DD_OPS = "David Park";

const KS_QUESTION = "Please confirm whether the keystone deliverable needs the property tax breakdown before I continue.";
const KS_ANSWER = "Use the standard tax breakdown template included in the shared drive.";
const LIB_QUESTION = "Can you confirm the community naming convention to use for the liberty request?";
const LIB_ANSWER = "Use the county-approved naming from the 2025 plan.";

test("Clarification round-trip: keystone + liberty, raised → answered internally → returned → re-accepted", async ({ page }, testInfo: TestInfo) => {
    test.setTimeout(300_000);

    const fixtures = getFixturePaths();

    await startDiagSession(page);

    try {

    /* ── 0. Wipe reset: clean slate ── */
    await wipeRecapData(page);

    /* ── 1. Overview: upload keystone, submit, then liberty (no remount) ── */
    await gotoApp(page, "/portal");
    await expect(page.getByRole("heading", { name: "Upload your due diligence request list to begin" })).toBeVisible();
    await page.locator('input[type="file"]').first().setInputFiles(fixtures.keystone);
    await expect(page.getByRole("heading", { name: "Package Successfully Analyzed" })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Submit Package" }).click();
    await expect(page.getByText("Package Submitted Successfully")).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Upload Another Package" }).click();
    await expect(page.getByText("Drop your due diligence package here")).toBeVisible();

    await page.locator('input[type="file"]').first().setInputFiles(fixtures.liberty);
    await expect(page.getByRole("heading", { name: "Package Successfully Analyzed" })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Submit Package" }).click();
    await expect(page.getByText("Package Submitted Successfully")).toBeVisible({ timeout: 30_000 });

    const afterUpload = await snapshotPortal(page);
    const keystoneSub = afterUpload.submissions.find(s => s.fileName === KEYSTONE_FILE);
    const libertySub = afterUpload.submissions.find(s => s.fileName === LIBERTY_FILE);
    expect(keystoneSub, "keystone submission missing").toBeTruthy();
    expect(libertySub, "liberty submission missing").toBeTruthy();
    const txnA = keystoneSub!.transactionId as string;
    const txnB = libertySub!.transactionId as string;
    expect(txnA).toBeTruthy();
    expect(txnB).toBeTruthy();
    expect(txnA).not.toBe(txnB);

    /* ── 2. Intake: move both packages to the work queue ── */
    await gotoApp(page, "/recapitalization/intake");
    await expect(page.getByRole("heading", { name: "Intake Queue" })).toBeVisible();
    await page.locator("tr", { hasText: KEYSTONE_FILE }).first().click();
    await expect(page).toHaveURL(/\/recapitalization\/intake\/review\/[^/]+/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "Intake Workbench" })).toBeVisible();
    await setReviewState(page, KEYSTONE_TITLE);
    await page.getByRole("button", { name: "Move Ready Items" }).click();
    await expect(page.getByRole("heading", { name: "Moved to Work Queue!" })).toBeVisible({ timeout: 30_000 });

    await page.getByRole("button", { name: "Back to Intake" }).click();
    await expect(page).toHaveURL(/\/recapitalization\/intake/, { timeout: 20_000 });
    await page.locator("tr", { hasText: LIBERTY_FILE }).first().click();
    await expect(page).toHaveURL(/\/recapitalization\/intake\/review\/[^/]+/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "Intake Workbench" })).toBeVisible();
    await setReviewState(page, LIBERTY_TITLE);
    await page.getByRole("button", { name: "Move Ready Items" }).click();
    await expect(page.getByRole("heading", { name: "Moved to Work Queue!" })).toBeVisible({ timeout: 30_000 });

    await page.getByRole("button", { name: "Open Work Queue" }).click();
    await expect(page).toHaveURL(/\/recapitalization\/tracker/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "Work Queue" })).toBeVisible();

    /* ── 3. Assign both to the same contributor, then accept both ── */
    await assignOwner(page, page.locator("tr", { hasText: KEYSTONE_TITLE }), CONTRIBUTOR);
    await assignOwner(page, page.locator("tr", { hasText: LIBERTY_TITLE }), CONTRIBUTOR);

    await acceptWorkFromTracker(page, KEYSTONE_TITLE);
    await acceptWorkFromTracker(page, LIBERTY_TITLE);

    /* ── 4. Starting-state checkpoint before the clarification round-trip ── */
    const starting = await snapshotPortal(page);
    expect(req(starting, KEYSTONE_TITLE).status).toBe("In Progress");
    expect(req(starting, KEYSTONE_TITLE).owner).toBe(CONTRIBUTOR);
    expect(req(starting, KEYSTONE_TITLE).transactionId).toBe(txnA);
    expect(req(starting, LIBERTY_TITLE).status).toBe("In Progress");
    expect(req(starting, LIBERTY_TITLE).owner).toBe(CONTRIBUTOR);
    expect(req(starting, LIBERTY_TITLE).transactionId).toBe(txnB);
    expect(authorizedTxnIds(starting)).toEqual([txnA, txnB].sort());

    /* ── 5. KEYSTONE round-trip ── */

    /* 5a. Contributor raises clarification (In Progress → Clarification Needed) */
    await submitClarificationFromMyWork(page, KEYSTONE_TITLE, KS_QUESTION);
    const afterKsRaised = await snapshotPortal(page);
    expect(req(afterKsRaised, KEYSTONE_TITLE).status).toBe("Clarification Needed");
    expect(req(afterKsRaised, KEYSTONE_TITLE).owner).toBe(DD_OPS);
    expect(req(afterKsRaised, KEYSTONE_TITLE)._clarificationRaisedBy).toBe(CONTRIBUTOR);
    expect(req(afterKsRaised, KEYSTONE_TITLE).transactionId).toBe(txnA);

    /* 5b. DD Ops answers internally → returned to original contributor */
    await answerClarificationInternally(page, KEYSTONE_TITLE, KS_ANSWER);
    const afterKsReturned = await snapshotPortal(page);
    expect(req(afterKsReturned, KEYSTONE_TITLE).status).toBe("Needs Rework");
    expect(req(afterKsReturned, KEYSTONE_TITLE).owner).toBe(CONTRIBUTOR);
    expect(req(afterKsReturned, KEYSTONE_TITLE)._clarificationRaisedBy).toBeFalsy();
    expect(req(afterKsReturned, KEYSTONE_TITLE)._returnReason).toContain(KS_ANSWER);
    expect(req(afterKsReturned, KEYSTONE_TITLE).transactionId).toBe(txnA);
    expect(req(afterKsReturned, LIBERTY_TITLE).status).toBe("In Progress");

    /* 5c. Contributor re-accepts / resumes (Needs Rework → In Progress) */
    await reacceptFromMyWork(page, KEYSTONE_TITLE);
    const afterKsReaccept = await snapshotPortal(page);
    expect(req(afterKsReaccept, KEYSTONE_TITLE).status).toBe("In Progress");
    expect(req(afterKsReaccept, KEYSTONE_TITLE).owner).toBe(CONTRIBUTOR);
    expect(req(afterKsReaccept, KEYSTONE_TITLE)._clarificationRaisedBy).toBeFalsy();
    expect(req(afterKsReaccept, KEYSTONE_TITLE)._processingStartedAt).toBeTruthy();
    expect(req(afterKsReaccept, KEYSTONE_TITLE).transactionId).toBe(txnA);

    /* ── 6. LIBERTY round-trip ── */

    /* 6a. Contributor raises clarification (In Progress → Clarification Needed) */
    await submitClarificationFromMyWork(page, LIBERTY_TITLE, LIB_QUESTION);
    const afterLibRaised = await snapshotPortal(page);
    expect(req(afterLibRaised, LIBERTY_TITLE).status).toBe("Clarification Needed");
    expect(req(afterLibRaised, LIBERTY_TITLE).owner).toBe(DD_OPS);
    expect(req(afterLibRaised, LIBERTY_TITLE)._clarificationRaisedBy).toBe(CONTRIBUTOR);
    expect(req(afterLibRaised, LIBERTY_TITLE).transactionId).toBe(txnB);
    expect(req(afterLibRaised, KEYSTONE_TITLE).status).toBe("In Progress");

    /* 6b. DD Ops answers internally → returned to original contributor */
    await answerClarificationInternally(page, LIBERTY_TITLE, LIB_ANSWER);
    const afterLibReturned = await snapshotPortal(page);
    expect(req(afterLibReturned, LIBERTY_TITLE).status).toBe("Needs Rework");
    expect(req(afterLibReturned, LIBERTY_TITLE).owner).toBe(CONTRIBUTOR);
    expect(req(afterLibReturned, LIBERTY_TITLE)._clarificationRaisedBy).toBeFalsy();
    expect(req(afterLibReturned, LIBERTY_TITLE)._returnReason).toContain(LIB_ANSWER);
    expect(req(afterLibReturned, LIBERTY_TITLE).transactionId).toBe(txnB);

    /* 6c. Contributor re-accepts / resumes (Needs Rework → In Progress) */
    await reacceptFromMyWork(page, LIBERTY_TITLE);
    const finalState = await snapshotPortal(page);
    expect(req(finalState, LIBERTY_TITLE).status).toBe("In Progress");
    expect(req(finalState, LIBERTY_TITLE).owner).toBe(CONTRIBUTOR);
    expect(req(finalState, LIBERTY_TITLE)._clarificationRaisedBy).toBeFalsy();
    expect(req(finalState, LIBERTY_TITLE).transactionId).toBe(txnB);

    /* ── 7. Final reconciliation: both resumed, nothing left in clarification ── */
    expect(req(finalState, KEYSTONE_TITLE).status).toBe("In Progress");
    expect(req(finalState, KEYSTONE_TITLE).owner).toBe(CONTRIBUTOR);
    expect(req(finalState, KEYSTONE_TITLE).transactionId).toBe(txnA);
    expect(finalState.requests.filter(r => r.status === "Clarification Needed")).toHaveLength(0);
    expect(authorizedTxnIds(finalState)).toEqual([txnA, txnB].sort());

    const reconciliation = buildReconciliation(afterUpload, finalState, txnA, txnB);
    const out = testInfo.outputPath(`clarification-roundtrip-${testInfo.testId}.json`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(reconciliation, null, 2), "utf8");
    console.log("CLARIFICATION-RECON", out);
    console.log("CLARIFICATION-RECON-DATA", JSON.stringify(reconciliation, null, 2));

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
        orgId: r.orgId,
        orgName: r.orgName,
        status: r.status,
        owner: r.owner ?? r.assignedTo ?? null,
        clarificationRaisedBy: r._clarificationRaisedBy ?? null,
        returnReason: r._returnReason ?? null,
        expectedTransactionId: r.title === KEYSTONE_TITLE ? txnA : txnB,
    });
    return {
        goal: "Clarification round-trip: raised → answered internally → returned → re-accepted (keystone + liberty)",
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
    await row.locator("td").nth(2).click();
    await expect(page).toHaveURL(/\/recapitalization\/workspace\/[^/]+/, { timeout: 20_000 });
    await expect(page.getByText("Accept Work", { exact: true })).toBeVisible({ timeout: 20_000 });
    await page.getByText("Accept Work", { exact: true }).click();
    await expect(page.getByText("Submit for DD Review", { exact: true }).first()).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Back to Work Queue" }).click();
    await expect(page).toHaveURL(/\/recapitalization\/tracker/, { timeout: 20_000 });
}

/* ── Clarification round-trip helpers ── */

/** Open the workspace for `title` from My Work under the given tab (contributor persona). */
async function openFromMyWork(page: Page, tabName: string, title: string): Promise<void> {
    await gotoApp(page, "/recapitalization/my-work");
    await expect(page.getByRole("heading", { name: "My Work" })).toBeVisible();
    await page.getByRole("button", { name: tabName }).click();
    const row = page.locator("tr", { hasText: title }).first();
    await expect(row).toBeVisible();
    await row.locator("td").nth(1).click();
    await expect(page).toHaveURL(/\/recapitalization\/workspace\/[^/]+/, { timeout: 20_000 });
}

/** Contributor: open the request from My Work (Active Work) and raise a clarification. */
async function submitClarificationFromMyWork(page: Page, title: string, question: string): Promise<void> {
    await openFromMyWork(page, "Active Work", title);
    await page.getByText("Ask DD Operations for help", { exact: true }).click();
    await page.getByPlaceholder("Describe what you need clarified before you can continue...").fill(question);
    await page.getByRole("button", { name: "Send to DD Operations" }).click();
    await page.getByRole("button", { name: "Confirm & Send" }).click();
    await expect(page.getByText("✓ Clarification Sent")).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Close" }).click();
    await expect(page.getByText("Waiting for DD Operations", { exact: true })).toBeVisible({ timeout: 20_000 });
}

/** DD Ops: open the request from the Needs DD Review queue and answer internally (Path A). */
async function answerClarificationInternally(page: Page, title: string, response: string): Promise<void> {
    await gotoApp(page, "/recapitalization/dd-operations");
    await expect(page.getByRole("heading", { name: "DD Operations" })).toBeVisible();
    await page.getByRole("button", { name: "Needs DD Review" }).click();
    const row = page.locator("tr", { hasText: title }).first();
    await expect(row).toBeVisible();
    await row.locator("td").nth(1).click();
    await expect(page).toHaveURL(/\/recapitalization\/workspace\/[^/]+/, { timeout: 20_000 });
    await page.getByText("Answer internally or request information", { exact: true }).click();
    await expect(page.getByText("Contributor Question", { exact: true })).toBeVisible({ timeout: 20_000 });
    await page.getByText("Answer Contributor", { exact: true }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByPlaceholder("Provide your response to the contributor's question...").fill(response);
    await page.getByRole("button", { name: "Review & Confirm" }).click();
    await expect(page.getByText(/return the request to/)).toBeVisible();
    await page.getByRole("button", { name: "Confirm & Return to Contributor" }).click();
    await expect(page.getByText("✓ Response Saved")).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Close" }).click();
    await expect(page.getByText("Waiting for contributor to re-submit", { exact: true })).toBeVisible({ timeout: 20_000 });
}

/** Contributor: open the returned request from My Work (Returned tab) and re-accept. */
async function reacceptFromMyWork(page: Page, title: string): Promise<void> {
    await openFromMyWork(page, "Returned / Needs Attention", title);
    await expect(page.getByText("Returned with Feedback", { exact: true })).toBeVisible({ timeout: 20_000 });
    await page.getByText("Accept Work", { exact: true }).click();
    await expect(page.getByText("Submit for DD Review", { exact: true }).first()).toBeVisible({ timeout: 20_000 });
}

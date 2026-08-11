import fs from "node:fs";
import path from "node:path";
import type { Locator, Page, TestInfo } from "@playwright/test";
import { test, expect, gotoApp } from "./helpers/auth";
import { getFixturePaths, KEYSTONE_FILE, LIBERTY_FILE, KEYSTONE_TITLE, LIBERTY_TITLE } from "./helpers/fixtures";

/**
 * Publication boundary across two projects (keystone + liberty).
 *
 * Goal: drive BOTH requests through the full INTERNAL lifecycle (intake →
 * assign → accept → clarification round-trip → re-accepted) and then across
 * the PUBLICATION boundary into the external portal, one project at a time:
 *
 *   Keystone:  Complete (Submit for DD Review) → DD Ops Publish External →
 *              external portal shows "Awaiting Your Review"
 *   Liberty:   same, independently
 *
 * Step 6 asserts BOTH requests are simultaneously visible to the external
 * partner as "Awaiting Your Review". If keystone passes but liberty fails on
 * the external surface, this is the reproduction of a publication-order bug —
 * the spec writes a divergence analysis (keystone = reference, liberty =
 * diverged) and stops at the first divergence.
 *
 * Diagnostics are MANDATORY here: the session must be active (and persisted
 * to localStorage) BEFORE any workflow step, the expected publish/selector
 * events must be recorded, and the session is exported in `finally`.
 */

const CONTRIBUTOR = "Sarah Chen";
const DD_OPS = "David Park";

const KS_NOTE = "E2E: Keystone deliverable complete — final financials reconciled and uploaded.";
const LIB_NOTE = "E2E: Liberty deliverable complete — naming convention confirmed and applied.";
const KS_PUB_NOTE = "E2E: publishing keystone externally for partner review.";
const LIB_PUB_NOTE = "E2E: publishing liberty externally for partner review.";

const DIAG_KEY = "integrasource.recap.diagSession";
const PORTAL_REQUESTS_KEY = "integrasource.recap.demo.portalRequests";

test("Publication boundary: keystone + liberty published externally, both Awaiting Your Review", async ({ page }, testInfo: TestInfo) => {
    test.setTimeout(600_000);

    const fixtures = getFixturePaths();

    /* ── 0. Mandatory diagnostics: session must be active BEFORE the workflow ── */
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
    const keystoneSub = afterUpload.submissions.find((s: any) => s.fileName === KEYSTONE_FILE);
    const libertySub = afterUpload.submissions.find((s: any) => s.fileName === LIBERTY_FILE);
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

    /* ── 4. Proven starting state: both In Progress under Sarah Chen ── */
    const starting = await snapshotPortal(page);
    expect(req(starting, KEYSTONE_TITLE).status).toBe("In Progress");
    expect(req(starting, KEYSTONE_TITLE).owner).toBe(CONTRIBUTOR);
    expect(req(starting, KEYSTONE_TITLE).transactionId).toBe(txnA);
    expect(req(starting, LIBERTY_TITLE).status).toBe("In Progress");
    expect(req(starting, LIBERTY_TITLE).owner).toBe(CONTRIBUTOR);
    expect(req(starting, LIBERTY_TITLE).transactionId).toBe(txnB);

    /* ── 5. Clarification round-trip per project (proven, then re-accepted) ── */

    /* 5a. Keystone round-trip */
    await submitClarificationFromMyWork(page, KEYSTONE_TITLE, "Please confirm whether the keystone deliverable needs the property tax breakdown before I continue.");
    await answerClarificationInternally(page, KEYSTONE_TITLE, "Use the standard tax breakdown template included in the shared drive.");
    await reacceptFromMyWork(page, KEYSTONE_TITLE);

    /* 5b. Liberty round-trip */
    await submitClarificationFromMyWork(page, LIBERTY_TITLE, "Can you confirm the community naming convention to use for the liberty request?");
    await answerClarificationInternally(page, LIBERTY_TITLE, "Use the county-approved naming from the 2025 plan.");
    await reacceptFromMyWork(page, LIBERTY_TITLE);

    /* 5c. Both re-accepted back to In Progress before publication */
    const beforePublish = await snapshotPortal(page);
    expect(req(beforePublish, KEYSTONE_TITLE).status).toBe("In Progress");
    expect(req(beforePublish, KEYSTONE_TITLE).owner).toBe(CONTRIBUTOR);
    expect(req(beforePublish, LIBERTY_TITLE).status).toBe("In Progress");
    expect(req(beforePublish, LIBERTY_TITLE).owner).toBe(CONTRIBUTOR);
    expect(beforePublish.requests.filter((r: any) => r.status === "Clarification Needed")).toHaveLength(0);

    /* ── STEP 1. Complete Keystone via Submit for DD Review modal ── */
    await completeFromMyWork(page, KEYSTONE_TITLE, KS_NOTE);
    const afterKsComplete = await snapshotPortal(page);
    expect(req(afterKsComplete, KEYSTONE_TITLE).status).toBe("Complete");
    expect(req(afterKsComplete, KEYSTONE_TITLE).owner).toBe(CONTRIBUTOR);
    expect(req(afterKsComplete, KEYSTONE_TITLE)._completedBy).toBe(CONTRIBUTOR);
    expect(req(afterKsComplete, KEYSTONE_TITLE)._completionNotes).toBe(KS_NOTE);
    expect(req(afterKsComplete, KEYSTONE_TITLE)._publishedExternal).toBeFalsy();

    /* ── STEP 2. DD Ops publishes Keystone via Publish External flow ── */
    await publishExternalFromDdOps(page, KEYSTONE_TITLE, KS_PUB_NOTE);
    const afterKsPublish = await snapshotPortal(page);
    expect(req(afterKsPublish, KEYSTONE_TITLE)._publishedExternal).toBe(true);
    expect(req(afterKsPublish, KEYSTONE_TITLE)._externalStatus).toBe("Published External");
    expect(req(afterKsPublish, KEYSTONE_TITLE).status).toBe("Waiting Partner Review");

    /* ── STEP 3. External portal: Keystone = Awaiting Your Review, Liberty NOT yet ── */
    const ksExternal = await verifyExternal(page, KEYSTONE_TITLE, "keystone-after-publish");
    expect(ksExternal.ok, describeExternal(ksExternal)).toBe(true);

    await assertLibertyNotPublishedOnPortal(page, LIBERTY_TITLE);

    /* ── STEP 4. Complete Liberty ── */
    await completeFromMyWork(page, LIBERTY_TITLE, LIB_NOTE);
    const afterLibComplete = await snapshotPortal(page);
    expect(req(afterLibComplete, LIBERTY_TITLE).status).toBe("Complete");
    expect(req(afterLibComplete, LIBERTY_TITLE).owner).toBe(CONTRIBUTOR);
    expect(req(afterLibComplete, LIBERTY_TITLE)._completedBy).toBe(CONTRIBUTOR);
    expect(req(afterLibComplete, LIBERTY_TITLE)._completionNotes).toBe(LIB_NOTE);
    expect(req(afterLibComplete, LIBERTY_TITLE)._publishedExternal).toBeFalsy();

    /* ── STEP 5. DD Ops publishes Liberty ── */
    await publishExternalFromDdOps(page, LIBERTY_TITLE, LIB_PUB_NOTE);
    const afterLibPublish = await snapshotPortal(page);
    expect(req(afterLibPublish, LIBERTY_TITLE)._publishedExternal).toBe(true);
    expect(req(afterLibPublish, LIBERTY_TITLE)._externalStatus).toBe("Published External");
    expect(req(afterLibPublish, LIBERTY_TITLE).status).toBe("Waiting Partner Review");

    /* ── STEP 6. Final external assertions: BOTH Awaiting Your Review ── */
    const libExternal = await verifyExternal(page, LIBERTY_TITLE, "liberty-after-publish");
    if (!libExternal.ok) {
        const divergence = await buildDivergence(page, testInfo, libExternal);
        console.log("PUB-BOUNDARY-DIVERGENCE", JSON.stringify(divergence, null, 2));
        const out = testInfo.outputPath(`publication-divergence-${testInfo.testId}.json`);
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.writeFileSync(out, JSON.stringify(divergence, null, 2), "utf8");
        console.log("PUB-BOUNDARY-DIVERGENCE-FILE", out);
    }
    expect(libExternal.ok, describeExternal(libExternal)).toBe(true);

    const ksFinal = await verifyExternal(page, KEYSTONE_TITLE, "keystone-final");
    expect(ksFinal.ok, describeExternal(ksFinal)).toBe(true);

    /* ── 7. Mandatory diagnostics: the expected events must be recorded ── */
    await assertDiagnosticsRecorded(page, testInfo);

    /* ── 8. Final reconciliation report ── */
    const finalState = await snapshotPortal(page);
    const reconciliation = buildReconciliation(afterUpload, finalState, txnA, txnB);
    const out = testInfo.outputPath(`publication-boundary-${testInfo.testId}.json`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(reconciliation, null, 2), "utf8");
    console.log("PUB-BOUNDARY-RECON", out);
    console.log("PUB-BOUNDARY-RECON-DATA", JSON.stringify(reconciliation, null, 2));

    } finally {
        await stopAndExportDiag(page, testInfo);
    }
});

/* ── Portal snapshot helpers ── */

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
            .filter((a: any) => a.orgId === "org-atlas" && a.userId === "ext-user-alex")
            .map((a: any) => a.transactionId),
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
        intakeId: r.intakeId,
        transactionId: r.transactionId,
        transactionName: r.transactionName,
        submissionId: r._sourcePackageId ?? null,
        orgId: r.orgId ?? null,
        orgName: r.orgName ?? null,
        status: r.status,
        _externalStatus: r._externalStatus ?? null,
        _publishedExternal: !!r._publishedExternal,
        publishedAt: r._publishedAt ?? r._publishedExternalAt ?? null,
        _publishedExternalAt: r._publishedExternalAt ?? null,
        _completedBy: r._completedBy ?? null,
        _completedAt: r._completedAt ?? null,
        _completionNotes: r._completionNotes ?? null,
        _processingStartedAt: r._processingStartedAt ?? null,
        _clarificationRaisedBy: r._clarificationRaisedBy ?? null,
        owner: r.owner ?? r.assignedTo ?? null,
        expectedTransactionId: r.title === KEYSTONE_TITLE ? txnA : txnB,
    });
    return {
        goal: "Publication boundary: complete → publish external → Awaiting Your Review, for both keystone and liberty",
        transactions: { txnA, txnB, distinct: txnA !== txnB },
        atlasAuthorization: {
            afterUpload: authorizedTxnIds(afterUpload),
            final: authorizedTxnIds(finalState),
        },
        submissions: afterUpload.submissions.map((s: any) => ({
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

/* ── Diagnostics harness (FIXED: retries cold start, asserts localStorage, FAILS if unreachable) ── */

async function startDiagSession(page: Page): Promise<void> {
    const attempts: string[] = [];
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            await gotoApp(page, "/recapitalization/settings");
            const startBtn = page.getByRole("button", { name: "Start Diagnostics Session" });
            await expect(startBtn).toBeVisible({ timeout: 25_000 });

            if (await startBtn.isDisabled().catch(() => false)) {
                const session = await readDiagSession(page);
                expect(session, "session marked active but not persisted to localStorage").toBeTruthy();
                expect(session.endedAt, "existing session must be active (not ended)").toBeNull();
                return;
            }

            await startBtn.click();
            await expect(page.getByText(/Diagnostics session started/)).toBeVisible({ timeout: 15_000 });
            await expect(startBtn).toBeDisabled();

            const session = await readDiagSession(page);
            expect(session, "started diagnostics session not persisted to localStorage").toBeTruthy();
            expect(session.endedAt, "started diagnostics session must be active (not ended)").toBeNull();
            return;
        } catch (err) {
            attempts.push(`attempt ${attempt}: ${(err as Error)?.message || String(err)}`);
        }
    }
    throw new Error(
        `startDiagSession: FAILED after 3 attempts — diagnostics are REQUIRED for this spec and could not be started.\n${attempts.join("\n")}`,
    );
}

async function readDiagSession(page: Page): Promise<{ id: string; endedAt: string | null; eventCount: number; events: any[] } | null> {
    return page.evaluate((k) => {
        const raw = localStorage.getItem(k);
        if (!raw) return null;
        try {
            return JSON.parse(raw);
        } catch {
            return null;
        }
    }, DIAG_KEY);
}

async function assertDiagnosticsRecorded(page: Page, testInfo: TestInfo): Promise<void> {
    const session = await readDiagSession(page);
    expect(session, "diagnostics session missing from localStorage after workflow").toBeTruthy();
    expect(session.endedAt, "diagnostics session must still be active (not ended) before export").toBeNull();

    const types: string[] = [...new Set((session.events || []).map((e: any) => e.type))].sort();
    console.log("DIAG-EVENT-INVENTORY", JSON.stringify(types));
    console.log("DIAG-EVENT-COUNT", session.eventCount);

    // Reliably-produced events for this exact workflow (publish + portal selector evaluation).
    const required = [
        "SESSION_START",
        "PUBLISH_EXTERNAL_CALLED",
        "PUBLISH_CANONICAL_UPDATED",
        "PUBLISH_EXTERNAL_PROJECTION_UPDATED",
        "EXTERNAL_REQUEST_INCLUDED",
        "REQUEST_STATE_SNAPSHOT",
    ];
    const missing = required.filter((t) => !types.includes(t));
    expect(missing, `required diagnostics events missing: ${missing.join(", ")}`).toEqual([]);

    // Note: EXTERNAL_REQUEST_SELECTOR_EVALUATED is only emitted by evaluateExternalSelector()
    // when the request itself is null/undefined; this workflow always passes a request object,
    // so INCLUDED/EXCLUDED carry the selector outcome instead. Report it if present.
    const selectorEvaluated = types.includes("EXTERNAL_REQUEST_SELECTOR_EVALUATED");
    console.log("DIAG-SELECTOR-EVALUATED-PRESENT", selectorEvaluated);

    // EXTERNAL_REQUEST_EXCLUDED is genuinely not produced in this workflow: the default broker
    // persona is authorized for every transaction present (keystone/liberty + MOCK_REQUESTS),
    // so the selector admits all of them and the exclusion path never fires. Report presence,
    // but don't require it (the exclusion boundary is asserted by persona-isolation unit tests).
    const excludedPresent = types.includes("EXTERNAL_REQUEST_EXCLUDED");
    console.log("DIAG-EXTERNAL-EXCLUDED-PRESENT", excludedPresent);

    const out = testInfo.outputPath(`diag-events-${testInfo.testId}.json`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(session, null, 2), "utf8");
    console.log("DIAG-SESSION-SNAPSHOT", out);
}

async function stopAndExportDiag(page: Page, testInfo: TestInfo): Promise<void> {
    try {
        await gotoApp(page, "/recapitalization/settings");
        const endBtn = page.getByRole("button", { name: "End Diagnostics Session" });
        if (await endBtn.isVisible().catch(() => false)) {
            await endBtn.click();
            await expect(page.getByText(/Diagnostics session ended/)).toBeVisible({ timeout: 10_000 });
        }
        const raw = await page.evaluate((k) => localStorage.getItem(k), DIAG_KEY);
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

/* ── Setup helpers (proven) ── */

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

/* ── Clarification round-trip helpers (proven) ── */

async function openFromMyWork(page: Page, tabName: string, title: string): Promise<void> {
    await gotoApp(page, "/recapitalization/my-work");
    await expect(page.getByRole("heading", { name: "My Work" })).toBeVisible();
    await page.getByRole("button", { name: tabName }).click();
    const row = page.locator("tr", { hasText: title }).first();
    await expect(row).toBeVisible();
    await row.locator("td").nth(1).click();
    await expect(page).toHaveURL(/\/recapitalization\/workspace\/[^/]+/, { timeout: 20_000 });
}

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

async function reacceptFromMyWork(page: Page, title: string): Promise<void> {
    await openFromMyWork(page, "Returned / Needs Attention", title);
    await expect(page.getByText("Returned with Feedback", { exact: true })).toBeVisible({ timeout: 20_000 });
    await page.getByText("Accept Work", { exact: true }).click();
    await expect(page.getByText("Submit for DD Review", { exact: true }).first()).toBeVisible({ timeout: 20_000 });
}

/* ── Publication boundary helpers ── */

/** Contributor: open from My Work (Active Work) and submit for DD Review with a note. */
async function completeFromMyWork(page: Page, title: string, note: string): Promise<void> {
    await openFromMyWork(page, "Active Work", title);
    await page.getByText("My work is complete and ready for DD Operations", { exact: true }).click();
    const modal = page.locator(".rc-modal");
    await expect(modal.getByRole("heading", { name: "Submit for DD Review" })).toBeVisible({ timeout: 20_000 });
    await modal.getByPlaceholder("Describe what was completed or any follow-up items...").fill(note);
    await modal.getByRole("button", { name: "Submit for DD Review" }).click();
    await expect(page.locator(".rc-modal").getByText("Submitted for DD Review", { exact: true })).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Return to My Work" }).click();
    await expect(page).toHaveURL(/\/recapitalization\/my-work/, { timeout: 20_000 });
}

/** DD Ops: open the request from the Ready to Publish queue and publish externally. */
async function publishExternalFromDdOps(page: Page, title: string, externalNote: string): Promise<void> {
    await gotoApp(page, "/recapitalization/dd-operations");
    await expect(page.getByRole("heading", { name: "DD Operations" })).toBeVisible();
    await page.getByRole("button", { name: "Ready to Publish" }).click();
    const row = page.locator("tr", { hasText: title }).first();
    await expect(row).toBeVisible();
    await row.locator("td").nth(1).click();
    await expect(page).toHaveURL(/\/recapitalization\/workspace\/[^/]+/, { timeout: 20_000 });

    await page.getByText("Share approved artifacts with the external partner", { exact: true }).click();
    const modal = page.locator(".rc-modal");
    await expect(modal.getByRole("heading", { name: "Publish to External Portal" })).toBeVisible({ timeout: 20_000 });
    await modal.getByRole("button", { name: "Continue" }).click();
    await expect(modal.getByRole("heading", { name: "Confirm External Publication" })).toBeVisible({ timeout: 20_000 });
    await modal.getByPlaceholder("e.g. Only available communities are included.").fill(externalNote);
    await modal.getByRole("button", { name: "Confirm Publish External" }).click();
    await expect(modal.getByRole("heading", { name: "Published Externally" })).toBeVisible({ timeout: 20_000 });
    await modal.getByRole("button", { name: "Done" }).click();
    await expect(page).toHaveURL(/\/recapitalization\/dd-operations/, { timeout: 20_000 });
}

interface ExternalCheck {
    title: string;
    requestId: string;
    status: string;
    _externalStatus: string | null;
    _publishedExternal: boolean;
    publishedAt: string | null;
    uiStatus: string;
    ok: boolean;
}

/** External portal: verify a request is visible as "Awaiting Your Review" (UI + canonical state). */
async function verifyExternal(page: Page, title: string, phase: string): Promise<ExternalCheck> {
    await gotoApp(page, "/portal/requests");
    await expect(page.getByRole("heading", { name: /Requests/ })).toBeVisible({ timeout: 30_000 });

    const row = page.locator(".po-requests-row", { hasText: title }).first();
    let rowVisible = false;
    try {
        await row.waitFor({ state: "visible", timeout: 15_000 });
        rowVisible = true;
    } catch {
        // leave rowVisible = false so the check captures "row missing" as a first-divergence
    }
    let uiStatus = "ROW_MISSING";
    if (rowVisible) {
        uiStatus = await row.getByText("Awaiting Your Review", { exact: true }).innerText().catch(() => "NOT_FOUND");
    }

    const state = await page.evaluate(
        ([reqKey, t]) => {
            const raw = localStorage.getItem(reqKey);
            const reqs: any[] = raw ? JSON.parse(raw) : [];
            const r = reqs.find((x: any) => x.title === t);
            return r
                ? {
                      requestId: r.requestId,
                      status: r.status,
                      _externalStatus: r._externalStatus ?? null,
                      _publishedExternal: !!r._publishedExternal,
                      publishedAt: r._publishedAt ?? r._publishedExternalAt ?? null,
                  }
                : null;
        },
        [PORTAL_REQUESTS_KEY, title] as const,
    );

    const check: ExternalCheck = {
        title,
        requestId: state?.requestId ?? "MISSING",
        status: state?.status ?? "MISSING",
        _externalStatus: state?._externalStatus ?? "MISSING",
        _publishedExternal: !!state?._publishedExternal,
        publishedAt: state?.publishedAt ?? null,
        uiStatus,
        ok: false,
    };

    const uiOk = uiStatus === "Awaiting Your Review";
    const canonicalOk =
        check._publishedExternal &&
        check._externalStatus === "Published External" &&
        check.status === "Waiting Partner Review" &&
        !!check.publishedAt;
    check.ok = rowVisible && uiOk && canonicalOk;

    if (!check.ok) {
        console.log(`PUB-BOUNDARY-CHECK-FAILED (${phase})`, JSON.stringify(check, null, 2));
    }
    return check;
}

async function assertLibertyNotPublishedOnPortal(page: Page, title: string): Promise<void> {
    await gotoApp(page, "/portal/requests");
    const row = page.locator(".po-requests-row", { hasText: title }).first();
    if (await row.isVisible().catch(() => false)) {
        const awaiting = await row.getByText("Awaiting Your Review", { exact: true }).count();
        expect(awaiting, `${title} must NOT be Awaiting Your Review before its own publish`).toBe(0);
    }
}

/** First-divergence analysis: compare the published (keystone) reference against the failed (liberty) request. */
async function buildDivergence(page: Page, testInfo: TestInfo, failed: ExternalCheck): Promise<{ phase: string; failed: ExternalCheck; reference: any | null; diverged: any | null; fieldDiff: string[] }> {
    const referenceTitle = failed.title === LIBERTY_TITLE ? KEYSTONE_TITLE : LIBERTY_TITLE;
    const raw = await page.evaluate((reqKey) => {
        const parsed: any[] = JSON.parse(localStorage.getItem(reqKey) || "[]");
        return parsed.map((r: any) => ({
            title: r.title,
            requestId: r.requestId,
            canonicalId: r.id,
            transactionId: r.transactionId,
            transactionName: r.transactionName,
            status: r.status,
            _externalStatus: r._externalStatus ?? null,
            _publishedExternal: !!r._publishedExternal,
            _publishedAt: r._publishedAt ?? null,
            _publishedExternalAt: r._publishedExternalAt ?? null,
            _completedBy: r._completedBy ?? null,
            _completionNotes: r._completionNotes ?? null,
            _clarificationRaisedBy: r._clarificationRaisedBy ?? null,
            _returnReason: r._returnReason ?? null,
            _processingStartedAt: r._processingStartedAt ?? null,
            _blockerStatus: r._blockerStatus ?? null,
            owner: r.owner ?? r.assignedTo ?? null,
        }));
    }, PORTAL_REQUESTS_KEY);

    const reference = raw.find((r: any) => r.title === referenceTitle) ?? null;
    const diverged = raw.find((r: any) => r.title === failed.title) ?? null;

    const fields = [
        "status", "_externalStatus", "_publishedExternal", "_publishedAt", "_publishedExternalAt",
        "_completedBy", "_completionNotes", "_clarificationRaisedBy", "_returnReason", "_processingStartedAt", "_blockerStatus", "owner",
    ] as const;
    const fieldDiff: string[] = [];
    for (const f of fields) {
        const a = reference?.[f];
        const b = diverged?.[f];
        const norm = (v: unknown) => (v === undefined ? null : v);
        if (JSON.stringify(norm(a)) !== JSON.stringify(norm(b))) {
            fieldDiff.push(`${f}: reference=${JSON.stringify(norm(a))} vs diverged=${JSON.stringify(norm(b))}`);
        }
    }

    return {
        phase: `liberty-after-publish`,
        failed,
        reference,
        diverged,
        fieldDiff,
    };
}

function describeExternal(c: ExternalCheck): string {
    return [
        `external check failed for "${c.title}"`,
        `  uiStatus=${c.uiStatus}`,
        `  requestId=${c.requestId}`,
        `  status=${c.status}`,
        `  _externalStatus=${c._externalStatus}`,
        `  _publishedExternal=${c._publishedExternal}`,
        `  publishedAt=${c.publishedAt}`,
    ].join("\n");
}

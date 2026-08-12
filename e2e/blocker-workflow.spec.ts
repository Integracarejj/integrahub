import fs from "node:fs";
import path from "node:path";
import type { Locator, Page, TestInfo } from "@playwright/test";
import { test, expect, gotoApp } from "./helpers/auth";
import { getFixturePaths, KEYSTONE_FILE, KEYSTONE_TITLE } from "./helpers/fixtures";

const CONTRIBUTOR = "Sarah Chen";
const DD_OPS = "David Park";
const BLOCKER_REASON = "E2E blocker: county tax schedule is unavailable.";
const RESOLUTION = "Use the verified prior-year county tax schedule and note the reporting period.";
const COMPLETE_NOTE = "E2E blocker workflow complete after DD Operations guidance.";
const PUBLISH_NOTE = "E2E blocker regression approved for external review.";
const DIAG_KEY = "integrasource.recap.diagSession";
const REQUESTS_KEY = "integrasource.recap.demo.portalRequests";
const SUBMISSIONS_KEY = "integrasource.recap.demo.portalSubmissions";

test("Blocker round-trip preserves contributor and project through external publication", async ({ page }, testInfo) => {
  test.setTimeout(600_000);
  await startDiagnostics(page);

  try {
    await wipeRecapData(page);

    await gotoApp(page, "/portal");
    await expect(page.getByRole("heading", { name: "Upload your due diligence request list to begin" })).toBeVisible();
    await page.locator('input[type="file"]').first().setInputFiles(getFixturePaths().keystone);
    await expect(page.getByRole("heading", { name: "Package Successfully Analyzed" })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Submit Package" }).click();
    await expect(page.getByText("Package Submitted Successfully")).toBeVisible({ timeout: 30_000 });

    const transactionId = await page.evaluate(([key, file]) => {
      const submissions = JSON.parse(localStorage.getItem(key) || "[]");
      return submissions.find((s: any) => s.fileName === file)?.transactionId as string | undefined;
    }, [SUBMISSIONS_KEY, KEYSTONE_FILE] as const);
    expect(transactionId, "uploaded package transaction identity missing").toBeTruthy();

    await gotoApp(page, "/recapitalization/intake");
    await page.locator("tr", { hasText: KEYSTONE_FILE }).first().click();
    await expect(page.getByRole("heading", { name: "Intake Workbench" })).toBeVisible();
    await setReviewState(page, KEYSTONE_TITLE);
    await page.getByRole("button", { name: "Move Ready Items" }).click();
    await expect(page.getByRole("heading", { name: "Moved to Work Queue!" })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Open Work Queue" }).click();

    const queueRow = page.locator("tr", { hasText: KEYSTONE_TITLE }).first();
    await assignOwner(page, queueRow, CONTRIBUTOR);
    await queueRow.locator("td").nth(2).click();
    await page.getByText("Accept Work", { exact: true }).click();
    await expect(page.getByText("Submit for DD Review", { exact: true }).first()).toBeVisible();

    const original = await requestState(page);
    expect(original.owner).toBe(CONTRIBUTOR);
    expect(original.transactionId).toBe(transactionId);

    await page.getByText("Waiting on something", { exact: true }).click();
    await page.getByPlaceholder("What is blocking this request?").fill(BLOCKER_REASON);
    await page.getByRole("button", { name: "Confirm Block" }).click();
    await expect(page.getByText("Work Blocked", { exact: true })).toBeVisible();

    const blocked = await requestState(page);
    expect(blocked.status).toBe("Blocked");
    expect(blocked.owner).toBe(DD_OPS);
    expect(blocked._blockerRaisedBy).toBe(CONTRIBUTOR);
    expect(blocked._blockerReason).toBe(BLOCKER_REASON);
    expect(blocked.transactionId).toBe(transactionId);

    await gotoApp(page, "/recapitalization/dd-operations");
    await page.getByRole("button", { name: "Needs DD Review" }).click();
    const ddRow = page.locator("tr", { hasText: KEYSTONE_TITLE }).first();
    await expect(ddRow).toContainText(BLOCKER_REASON);
    await ddRow.locator("td").nth(1).click();
    await page.getByText("Provide guidance to the contributor", { exact: true }).click();
    await expect(page.locator(".rc-modal")).toContainText(BLOCKER_REASON);
    await page.getByPlaceholder("What information or direction does the contributor need to continue?").fill(RESOLUTION);
    await page.getByRole("button", { name: "Send to Contributor" }).click();

    const returned = await requestState(page);
    expect(returned.status).toBe("Needs Rework");
    expect(returned.owner).toBe(CONTRIBUTOR);
    expect(returned.assignedTo).toBe(CONTRIBUTOR);
    expect(returned._blockerResolution).toBe(RESOLUTION);
    expect(returned.transactionId).toBe(transactionId);

    await openMyWork(page, "Returned / Needs Attention");
    await expect(page.getByText("Returned with Feedback", { exact: true })).toBeVisible();
    await page.getByText("Accept Work", { exact: true }).click();
    const reaccepted = await requestState(page);
    expect(reaccepted.status).toBe("In Progress");
    expect(reaccepted.owner).toBe(CONTRIBUTOR);
    expect(reaccepted.transactionId).toBe(transactionId);

    await page.getByText("My work is complete and ready for DD Operations", { exact: true }).click();
    const completeModal = page.locator(".rc-modal");
    await completeModal.getByPlaceholder("Describe what was completed or any follow-up items...").fill(COMPLETE_NOTE);
    await completeModal.getByRole("button", { name: "Submit for DD Review" }).click();
    await expect(completeModal.getByText("Submitted for DD Review", { exact: true })).toBeVisible();
    await completeModal.getByRole("button", { name: "Return to My Work" }).click();

    await gotoApp(page, "/recapitalization/dd-operations");
    await page.getByRole("button", { name: "Ready to Publish" }).click();
    const publishRow = page.locator("tr", { hasText: KEYSTONE_TITLE }).first();
    await publishRow.locator("td").nth(1).click();
    await page.getByText("Share approved artifacts with the external partner", { exact: true }).click();
    const publishModal = page.locator(".rc-modal");
    await publishModal.getByRole("button", { name: "Continue" }).click();
    await publishModal.getByPlaceholder("e.g. Only available communities are included.").fill(PUBLISH_NOTE);
    await publishModal.getByRole("button", { name: "Confirm Publish External" }).click();
    await expect(publishModal.getByRole("heading", { name: "Published Externally" })).toBeVisible();
    await publishModal.getByRole("button", { name: "Done" }).click();

    const published = await requestState(page);
    expect(published.status).toBe("Waiting Partner Review");
    expect(published._externalStatus).toBe("Published External");
    expect(published._publishedExternal).toBe(true);
    expect(published.transactionId).toBe(transactionId);

    await gotoApp(page, "/portal/requests");
    const externalRows = page.locator(".po-requests-row", { hasText: KEYSTONE_TITLE });
    await expect(externalRows).toHaveCount(1);
    await expect(externalRows.first().getByText("Awaiting Your Review", { exact: true })).toBeVisible();
    expect((await requestState(page)).transactionId).toBe(transactionId);

    const diagnostics = await readDiagnostics(page);
    expect(diagnostics).toBeTruthy();
    const counts = countDiagnostics(diagnostics!.events);
    console.log("BLOCKER-DIAGNOSTICS", JSON.stringify({ sessionId: diagnostics!.id, total: diagnostics!.eventCount, ...counts }));
    expect(diagnostics!.eventCount).toBeLessThan(1000);
    expect(counts.EXTERNAL_REQUEST_INCLUDED).toBeGreaterThan(0);
    expect(counts.EXTERNAL_REQUEST_INCLUDED).toBeLessThan(100);
    expect(counts.PUBLISH_EXTERNAL_PROJECTION_UPDATED).toBeGreaterThan(0);
  } finally {
    await stopAndExportDiagnostics(page, testInfo);
  }
});

async function requestState(page: Page): Promise<any> {
  return page.evaluate(([key, title]) => JSON.parse(localStorage.getItem(key) || "[]").find((r: any) => r.title === title), [REQUESTS_KEY, KEYSTONE_TITLE] as const);
}

async function setReviewState(page: Page, title: string): Promise<void> {
  const row = page.locator("tr", { hasText: title }).first();
  const select = row.locator("select").filter({ has: page.locator("option", { hasText: "Move to Work Queue" }) }).first();
  await select.selectOption({ label: "Move to Work Queue" });
  await expect(row.getByText("Ready", { exact: true })).toBeVisible();
}

async function assignOwner(page: Page, row: Locator, owner: string): Promise<void> {
  const select = row.locator("select").filter({ has: page.locator("option", { hasText: owner }) }).first();
  await select.selectOption({ label: owner });
  await page.locator(".rc-modal").getByRole("button", { name: "Assign" }).click();
  await expect(page.locator(".rc-modal")).toHaveCount(0);
}

async function openMyWork(page: Page, tab: string): Promise<void> {
  await gotoApp(page, "/recapitalization/my-work");
  await page.getByRole("button", { name: tab }).click();
  const row = page.locator("tr", { hasText: KEYSTONE_TITLE }).first();
  await expect(row).toBeVisible();
  await row.locator("td").nth(1).click();
  await expect(page).toHaveURL(/\/recapitalization\/workspace\/[^/]+/);
}

async function wipeRecapData(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Wipe Recapitalization Test Data" }).first().click();
  await page.locator(".rc-modal").getByRole("button", { name: "Wipe Recapitalization Test Data" }).click();
  await expect(page.locator(".rc-modal")).toHaveCount(0);
}

async function startDiagnostics(page: Page): Promise<void> {
  await gotoApp(page, "/recapitalization/settings");
  const card = page.locator(".rc-card", { hasText: /Diagnostics Session Recorder/i });
  await card.getByRole("button", { name: "Clear" }).click();
  await card.getByRole("button", { name: "Start Diagnostics Session" }).click();
  await expect(card.locator(".rc-badge").first()).toHaveText(/Session Active/);
}

async function readDiagnostics(page: Page): Promise<{ id: string; endedAt: string | null; eventCount: number; events: any[] } | null> {
  return page.evaluate(key => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, DIAG_KEY);
}

function countDiagnostics(events: any[]): Record<string, number> {
  const wanted = ["EXTERNAL_REQUEST_INCLUDED", "EXTERNAL_REQUEST_EXCLUDED", "PUBLISH_EXTERNAL_PROJECTION_UPDATED"];
  return Object.fromEntries(wanted.map(type => [type, events.filter(event => event.type === type).length]));
}

async function stopAndExportDiagnostics(page: Page, testInfo: TestInfo): Promise<void> {
  try {
    await gotoApp(page, "/recapitalization/settings");
    const card = page.locator(".rc-card", { hasText: /Diagnostics Session Recorder/i });
    const end = card.getByRole("button", { name: "End Diagnostics Session" });
    if (await end.isEnabled().catch(() => false)) await end.click();
    const session = await readDiagnostics(page);
    if (!session) return;
    const counts = countDiagnostics(session.events || []);
    console.log("BLOCKER-DIAGNOSTICS-FINAL", JSON.stringify({ sessionId: session.id, total: session.eventCount, ...counts }));
    const output = testInfo.outputPath("blocker-diagnostics.json");
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify(session, null, 2));
  } catch (error) {
    console.warn("Unable to finalize blocker diagnostics", error);
  }
}

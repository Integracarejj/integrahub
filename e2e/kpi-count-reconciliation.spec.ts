import type { Locator, Page } from "@playwright/test";
import { test, expect, gotoApp } from "./helpers/auth";
import {
  getFixturePaths,
  KPI_DD_REVIEW_TITLE,
  KPI_EXCEPTION_TITLE,
  KPI_IN_PROGRESS_TITLE,
  KPI_PUBLISHED_TITLE,
  KPI_READY_TITLE,
  KPI_RECONCILIATION_FILE,
} from "./helpers/fixtures";

const CONTRIBUTOR = "Sarah Chen";
const REQUESTS_KEY = "integrasource.recap.demo.portalRequests";
const SUBMISSIONS_KEY = "integrasource.recap.demo.portalSubmissions";
const TITLES = [KPI_IN_PROGRESS_TITLE, KPI_DD_REVIEW_TITLE, KPI_READY_TITLE, KPI_EXCEPTION_TITLE, KPI_PUBLISHED_TITLE];

test("KPI cards reconcile with their request queues across workflow transitions", async ({ page }) => {
  test.setTimeout(600_000);

  await gotoApp(page, "/recapitalization/settings");
  await wipeRecapData(page);

  await gotoApp(page, "/portal");
  await page.locator('input[type="file"]').first().setInputFiles(getFixturePaths().kpiReconciliation);
  await expect(page.getByRole("heading", { name: "Package Successfully Analyzed" })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Submit Package" }).click();
  await expect(page.getByText("Package Submitted Successfully")).toBeVisible({ timeout: 30_000 });

  const submission = await page.evaluate(([key, file]) => JSON.parse(localStorage.getItem(key) || "[]").find((row: any) => row.fileName === file), [SUBMISSIONS_KEY, KPI_RECONCILIATION_FILE] as const);
  expect(submission?.transactionId).toBeTruthy();

  await gotoApp(page, "/recapitalization/intake");
  await page.locator("tr", { hasText: KPI_RECONCILIATION_FILE }).first().click();
  for (const title of TITLES) await setReviewState(page, title);
  await page.getByRole("button", { name: "Move Ready Items" }).click();
  await expect(page.getByRole("heading", { name: "Moved to Work Queue!" })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Open Work Queue" }).click();

  for (const title of TITLES) await assignOwner(page, page.locator("tr", { hasText: title }).first());
  for (const title of TITLES) await acceptRequest(page, title);

  await openMyWorkItem(page, KPI_DD_REVIEW_TITLE);
  await page.getByText("Waiting on something", { exact: true }).click();
  await page.getByPlaceholder("What is blocking this request?").fill("Deterministic KPI blocker.");
  await page.getByRole("button", { name: "Confirm Block" }).click();
  await expect(page.getByText("Work Blocked", { exact: true })).toBeVisible();

  await openMyWorkItem(page, KPI_READY_TITLE);
  await completeRequest(page, "Ready-to-publish KPI state.");
  await openMyWorkItem(page, KPI_PUBLISHED_TITLE);
  await completeRequest(page, "Published KPI state.");

  await openMyWorkItem(page, KPI_EXCEPTION_TITLE);
  await page.getByText("Mark Not Applicable", { exact: true }).click();
  const naModal = page.locator(".rc-modal");
  await naModal.getByPlaceholder("Explain why this is not applicable...").fill("Deterministic KPI exception.");
  await naModal.getByRole("button", { name: "Submit Recommendation" }).click();
  await expect(page.getByText("Not Applicable Recommendation Sent", { exact: true })).toBeVisible();

  await publishRequest(page, KPI_PUBLISHED_TITLE);

  const ids = await requestIds(page);
  expect(Object.keys(ids)).toHaveLength(5);
  await gotoApp(page, "/recapitalization/dd-operations");
  await assertInternalCardQueue(page, "Needs DD Review", 1, [KPI_DD_REVIEW_TITLE]);
  await assertInternalCardQueue(page, "Ready to Publish", 1, [KPI_READY_TITLE]);
  await assertInternalCardQueue(page, "Exceptions", 1, [KPI_EXCEPTION_TITLE]);
  await assertInternalCardQueue(page, "Published External", 1, [KPI_PUBLISHED_TITLE]);
  await assertInternalCardQueue(page, "Partner Action", 0, []);

  await gotoApp(page, "/portal");
  await assertPortalCard(page, "Total Requests", 5);
  await assertPortalCard(page, "In Progress", 4);
  await assertPortalCard(page, "Awaiting Your Review", 1);
  await page.locator(".po-stat-card", { hasText: "Awaiting Your Review" }).click();
  await expect(page.locator(".po-requests-row")).toHaveCount(1);
  await expect(page.locator(".po-requests-row").first()).toContainText(KPI_PUBLISHED_TITLE);

  await gotoApp(page, "/portal/transactions");
  const aggregate = page.locator(".po-txn-summary").first();
  await expect(aggregate).toContainText("Total Requests");
  await expect(aggregate.locator(".po-txn-stat", { hasText: "Total Requests" })).toContainText("5");
  await expect(aggregate.locator(".po-txn-stat", { hasText: "Transactions" })).toContainText("1");
  const transaction = page.locator(".po-txn-summary").nth(1);
  await expect(transaction.locator(".po-txn-stat", { hasText: "Total" })).toContainText("5");
  await expect(transaction.locator(".po-txn-stat", { hasText: "Published" })).toContainText("1");

  await sendExceptionToPartner(page);
  await gotoApp(page, "/recapitalization/dd-operations");
  await assertInternalCardQueue(page, "Exceptions", 0, []);
  await assertInternalCardQueue(page, "Partner Action", 1, [KPI_EXCEPTION_TITLE]);

  await approveExceptionRemoval(page);
  await gotoApp(page, "/portal");
  await assertPortalCard(page, "Total Requests", 4);
  await assertPortalCard(page, "Removed from Scope", 1);
  await page.locator(".po-stat-card", { hasText: "Removed from Scope" }).click();
  await expect(page.locator(".po-requests-row")).toHaveCount(1);
  await expect(page.locator(".po-requests-row").first()).toContainText(KPI_EXCEPTION_TITLE);

  await approvePublishedRequest(page);
  await gotoApp(page, "/portal");
  await assertPortalCard(page, "Total Requests", 3);
  await expect(page.locator(".po-stat-card", { hasText: "Awaiting Your Review" })).toHaveCount(0);
  await assertPortalCard(page, "Complete", 1);
  await page.locator(".po-stat-card", { hasText: "Complete" }).click();
  await expect(page.locator(".po-requests-row")).toHaveCount(1);
  await expect(page.locator(".po-requests-row").first()).toContainText(KPI_PUBLISHED_TITLE);

  const final = await requestStates(page);
  expect(final.find(r => r.title === KPI_EXCEPTION_TITLE)).toMatchObject({ status: "Completed", _archived: true, _archiveReason: "Not Applicable" });
  expect(final.find(r => r.title === KPI_PUBLISHED_TITLE)).toMatchObject({ status: "Completed", _partnerDecision: "Approved", _externalStatus: "Published External" });
  console.log("KPI-RECONCILIATION", JSON.stringify({ transactionId: submission.transactionId, ids }));
});

async function setReviewState(page: Page, title: string): Promise<void> {
  const row = page.locator("tr", { hasText: title }).first();
  await row.locator("select").filter({ has: page.locator("option", { hasText: "Move to Work Queue" }) }).first().selectOption({ label: "Move to Work Queue" });
  await expect(row.getByText("Ready", { exact: true })).toBeVisible();
}

async function acceptRequest(page: Page, title: string): Promise<void> {
  await gotoApp(page, "/recapitalization/my-work");
  const row = page.locator("tr", { hasText: title }).first();
  await expect(row).toBeVisible();
  await row.locator("td").nth(2).click();
  await page.getByText("Accept Work", { exact: true }).click();
}

async function assignOwner(page: Page, row: Locator): Promise<void> {
  await row.locator("select").filter({ has: page.locator("option", { hasText: CONTRIBUTOR }) }).first().selectOption({ label: CONTRIBUTOR });
  await page.locator(".rc-modal").getByRole("button", { name: "Assign" }).click();
  await expect(page.locator(".rc-modal")).toHaveCount(0);
}

async function openMyWorkItem(page: Page, title: string): Promise<void> {
  await gotoApp(page, "/recapitalization/my-work");
  const row = page.locator("tr", { hasText: title }).first();
  await expect(row).toBeVisible();
  await row.locator("td").nth(1).click();
}

async function completeRequest(page: Page, note: string): Promise<void> {
  await page.getByText("My work is complete and ready for DD Operations", { exact: true }).click();
  const modal = page.locator(".rc-modal");
  await modal.getByPlaceholder("Describe what was completed or any follow-up items...").fill(note);
  await modal.getByRole("button", { name: "Submit for DD Review" }).click();
  await expect(modal.getByText("Submitted for DD Review", { exact: true })).toBeVisible();
}

async function publishRequest(page: Page, title: string): Promise<void> {
  await gotoApp(page, "/recapitalization/dd-operations");
  await page.getByRole("button", { name: "Ready to Publish" }).click();
  await page.locator("tr", { hasText: title }).first().locator("td").nth(1).click();
  await page.getByText("Share approved artifacts with the external partner", { exact: true }).click();
  const modal = page.locator(".rc-modal");
  await modal.getByRole("button", { name: "Continue" }).click();
  await modal.getByPlaceholder("e.g. Only available communities are included.").fill("KPI reconciliation publication.");
  await modal.getByRole("button", { name: "Confirm Publish External" }).click();
  await expect(modal.getByRole("heading", { name: "Published Externally" })).toBeVisible();
  await modal.getByRole("button", { name: "Done" }).click();
}

async function assertInternalCardQueue(page: Page, label: string, count: number, titles: string[]): Promise<void> {
  const card = page.locator(".rc-stat-card", { hasText: label });
  await expect(card.locator(".rc-stat-value")).toHaveText(String(count));
  await card.click();
  for (const title of TITLES) {
    await expect(page.locator("tr", { hasText: title })).toHaveCount(titles.includes(title) ? 1 : 0);
  }
}

async function assertPortalCard(page: Page, label: string, count: number): Promise<void> {
  await expect(page.locator(".po-stat-card", { hasText: label }).locator(".po-stat-value")).toHaveText(String(count));
}

async function sendExceptionToPartner(page: Page): Promise<void> {
  await gotoApp(page, "/recapitalization/dd-operations");
  await page.getByRole("button", { name: "Exceptions" }).click();
  await page.locator("tr", { hasText: KPI_EXCEPTION_TITLE }).first().locator("td").nth(1).click();
  await page.getByText("Recommend Not Applicable to Partner", { exact: true }).click();
  const modal = page.locator(".rc-modal");
  await modal.getByPlaceholder("Add any additional context for the external partner...").fill("KPI exception review.");
  await modal.getByRole("button", { name: "Send Recommendation to Partner" }).click();
}

async function approveExceptionRemoval(page: Page): Promise<void> {
  await gotoApp(page, "/portal/requests");
  await page.locator(".po-requests-row", { hasText: KPI_EXCEPTION_TITLE }).first().click();
  await page.getByRole("button", { name: "Approve Removal" }).click();
  await expect(page.getByRole("dialog", { name: "Review Complete" })).toBeVisible();
}

async function approvePublishedRequest(page: Page): Promise<void> {
  await gotoApp(page, "/portal/requests");
  await page.locator(".po-requests-row", { hasText: KPI_PUBLISHED_TITLE }).first().click();
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByRole("dialog", { name: "Review Complete" })).toBeVisible();
}

async function requestStates(page: Page): Promise<any[]> {
  return page.evaluate(([key, titles]) => JSON.parse(localStorage.getItem(key) || "[]").filter((r: any) => titles.includes(r.title)), [REQUESTS_KEY, TITLES] as const);
}

async function requestIds(page: Page): Promise<Record<string, string>> {
  return Object.fromEntries((await requestStates(page)).map(r => [r.title, r.requestId]));
}

async function wipeRecapData(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Wipe Recapitalization Test Data" }).first().click();
  await page.locator(".rc-modal").getByRole("button", { name: "Wipe Recapitalization Test Data" }).click();
  await expect(page.locator(".rc-modal")).toHaveCount(0);
}

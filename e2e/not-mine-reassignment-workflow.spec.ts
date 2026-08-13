import type { Locator, Page } from "@playwright/test";
import { test, expect, gotoApp } from "./helpers/auth";
import { getFixturePaths, NOT_MINE_FILE, NOT_MINE_TITLE } from "./helpers/fixtures";

const INITIAL_CONTRIBUTOR = "Sarah Chen";
const REPLACEMENT_CONTRIBUTOR = "James Wright";
const REASON = "This request should be reassigned to another contributor for regression testing.";
const REQUESTS_KEY = "integrasource.recap.demo.portalRequests";
const SUBMISSIONS_KEY = "integrasource.recap.demo.portalSubmissions";

test("Not Mine routes the same request through DD Operations to a replacement contributor", async ({ page }) => {
  test.setTimeout(600_000);
  const fixtures = getFixturePaths();

  await gotoApp(page, "/recapitalization/settings");
  await wipeRecapData(page);

  await gotoApp(page, "/portal");
  await page.locator('input[type="file"]').first().setInputFiles(fixtures.notMine);
  await expect(page.getByRole("heading", { name: "Package Successfully Analyzed" })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Submit Package" }).click();
  await expect(page.getByText("Package Submitted Successfully")).toBeVisible({ timeout: 30_000 });

  const submission = await page.evaluate(([key, file]) => {
    const submissions = JSON.parse(localStorage.getItem(key) || "[]");
    return submissions.find((row: any) => row.fileName === file);
  }, [SUBMISSIONS_KEY, NOT_MINE_FILE] as const);
  expect(submission).toBeTruthy();
  const transactionId = submission.transactionId as string;
  const projectName = submission.transactionName as string;
  let state = await requestState(page);
  const requestId = state.requestId as string;
  assertIdentity(state, requestId, transactionId, projectName);
  await expectSingleCanonicalRequest(page);

  await gotoApp(page, "/recapitalization/intake");
  const intakeRow = page.locator("tr", { hasText: NOT_MINE_FILE }).first();
  await expect(intakeRow).toBeVisible();
  await intakeRow.click();
  const reviewRow = page.locator("tr", { hasText: NOT_MINE_TITLE }).first();
  await expect(reviewRow).toBeVisible();
  await reviewRow.locator("select").filter({ has: page.locator("option", { hasText: "Move to Work Queue" }) }).first().selectOption({ label: "Move to Work Queue" });
  await expect(reviewRow.getByText("Ready", { exact: true })).toBeVisible();
  expect((await requestState(page)).transactionId).toBe(transactionId);
  await page.getByRole("button", { name: "Move Ready Items" }).click();
  await expect(page.getByRole("heading", { name: "Moved to Work Queue!" })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Open Work Queue" }).click();

  const queueRow = page.locator("tr", { hasText: NOT_MINE_TITLE }).first();
  await assignOwner(page, queueRow, INITIAL_CONTRIBUTOR);
  await queueRow.locator("td").nth(2).click();
  await page.getByText("Accept Work", { exact: true }).click();
  state = await requestState(page);
  expect(state.status).toBe("In Progress");
  expect(state.owner).toBe(INITIAL_CONTRIBUTOR);
  expect(state.assignedTo).toBe(INITIAL_CONTRIBUTOR);
  assertIdentity(state, requestId, transactionId, projectName);
  await expectSingleCanonicalRequest(page);

  await page.getByText("Not Mine", { exact: true }).click();
  const notMineModal = page.locator(".rc-modal");
  await expect(notMineModal.getByRole("heading", { name: "Request Reassignment" })).toBeVisible();
  await notMineModal.locator("textarea").fill(REASON);
  await notMineModal.getByRole("button", { name: "Request Reassignment" }).click();
  await expect(page.getByText("Reassignment Requested", { exact: true })).toBeVisible();

  state = await requestState(page);
  expect(state.status).toBe("Open");
  expect(state.owner).toBeNull();
  expect(state.assignedTo).toBeNull();
  expect(state._needsReassignment).toBe(true);
  expect(state._misassignedReason).toBe(REASON);
  expect(state._publishedExternal).toBeFalsy();
  expect(state.status).not.toBe("Waiting Partner Review");
  expectNotMineHistory(state, REASON, INITIAL_CONTRIBUTOR);
  assertIdentity(state, requestId, transactionId, projectName);
  await expectSingleCanonicalRequest(page);

  await page.getByRole("button", { name: "Return to My Work" }).click();
  await page.getByRole("button", { name: "Active Work" }).click();
  await expect(page.locator("tr", { hasText: NOT_MINE_TITLE })).toHaveCount(0);
  await page.getByRole("button", { name: "Returned / Needs Attention" }).click();
  await expect(page.locator("tr", { hasText: NOT_MINE_TITLE })).toHaveCount(0);

  await gotoApp(page, "/recapitalization/dd-operations");
  const needsReviewCard = page.locator(".rc-stat-card", { hasText: "Needs DD Review" });
  await expect(needsReviewCard).toContainText("1");
  await needsReviewCard.click();
  const ddRow = page.locator("tr", { hasText: NOT_MINE_TITLE }).first();
  await expect(ddRow).toBeVisible();
  await expect(ddRow).toContainText("Needs Reassignment");
  await expect(ddRow).toContainText(REASON);
  await ddRow.getByLabel(`Assign ${requestId}`).selectOption({ label: REPLACEMENT_CONTRIBUTOR });
  const reassignedDialog = page.getByRole("dialog", { name: "Reassigned" });
  await expect(reassignedDialog).toContainText(REPLACEMENT_CONTRIBUTOR);
  await reassignedDialog.getByRole("button", { name: "OK" }).click();

  state = await requestState(page);
  expect(state.status).toBe("Open");
  expect(state.owner).toBe(REPLACEMENT_CONTRIBUTOR);
  expect(state.assignedTo).toBe(REPLACEMENT_CONTRIBUTOR);
  expect(state.owner).not.toBe(INITIAL_CONTRIBUTOR);
  expect(state._needsReassignment).toBe(false);
  expect(state._misassignedReason).toBeNull();
  expectNotMineHistory(state, REASON, INITIAL_CONTRIBUTOR);
  assertIdentity(state, requestId, transactionId, projectName);
  await expectSingleCanonicalRequest(page);

  await gotoApp(page, "/recapitalization/my-work");
  const personaSelect = page.locator(".rc-header-actions select");
  await personaSelect.selectOption({ label: REPLACEMENT_CONTRIBUTOR });
  await expect(personaSelect).toHaveValue(REPLACEMENT_CONTRIBUTOR);
  const replacementRow = page.locator("tr", { hasText: NOT_MINE_TITLE }).first();
  await expect(replacementRow).toBeVisible();
  await replacementRow.locator("td").nth(1).click();
  await page.getByText("Accept Work", { exact: true }).click();

  state = await requestState(page);
  expect(state.status).toBe("In Progress");
  expect(state.owner).toBe(REPLACEMENT_CONTRIBUTOR);
  expect(state.assignedTo).toBe(REPLACEMENT_CONTRIBUTOR);
  expectNotMineHistory(state, REASON, INITIAL_CONTRIBUTOR);
  expect(state._publishedExternal).toBeFalsy();
  expect(state._externalStatus).not.toBe("Published External");
  assertIdentity(state, requestId, transactionId, projectName);
  await expectSingleCanonicalRequest(page);

  await gotoApp(page, "/portal/requests");
  const externalRows = page.locator(".po-requests-row", { hasText: NOT_MINE_TITLE });
  await expect(externalRows).toHaveCount(1);
  await expect(externalRows.first().getByText("In Progress", { exact: true })).toBeVisible();
  await expect(externalRows.first().getByText("Awaiting Your Review", { exact: true })).toHaveCount(0);
  console.log("NOT-MINE-FINAL", JSON.stringify({ transactionId, requestId, initialContributor: INITIAL_CONTRIBUTOR, replacementContributor: REPLACEMENT_CONTRIBUTOR, status: state.status, owner: state.owner, notMineHistory: state._workNotes?.filter((note: any) => note.action === "Not Mine").length, publishedExternal: !!state._publishedExternal }));
});

async function requestState(page: Page): Promise<any> {
  return page.evaluate(([key, title]) => JSON.parse(localStorage.getItem(key) || "[]").find((request: any) => request.title === title), [REQUESTS_KEY, NOT_MINE_TITLE] as const);
}

async function expectSingleCanonicalRequest(page: Page): Promise<void> {
  const count = await page.evaluate(([key, title]) => JSON.parse(localStorage.getItem(key) || "[]").filter((request: any) => request.title === title).length, [REQUESTS_KEY, NOT_MINE_TITLE] as const);
  expect(count).toBe(1);
}

function assertIdentity(request: any, requestId: string, transactionId: string, projectName: string): void {
  expect(request.requestId).toBe(requestId);
  expect(request.transactionId).toBe(transactionId);
  expect(request.transactionName).toBe(projectName);
}

function expectNotMineHistory(request: any, reason: string, author: string): void {
  expect(request._workNotes).toEqual(expect.arrayContaining([expect.objectContaining({ action: "Not Mine", text: reason, author })]));
}

async function assignOwner(page: Page, row: Locator, owner: string): Promise<void> {
  await row.locator("select").filter({ has: page.locator("option", { hasText: owner }) }).first().selectOption({ label: owner });
  await page.locator(".rc-modal").getByRole("button", { name: "Assign" }).click();
  await expect(page.locator(".rc-modal")).toHaveCount(0);
}

async function wipeRecapData(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Wipe Recapitalization Test Data" }).first().click();
  await page.locator(".rc-modal").getByRole("button", { name: "Wipe Recapitalization Test Data" }).click();
  await expect(page.locator(".rc-modal")).toHaveCount(0);
}

import type { Locator, Page } from "@playwright/test";
import { test, expect, gotoApp } from "./helpers/auth";
import { getFixturePaths, NOT_APPLICABLE_FILE, NOT_APPLICABLE_TITLE } from "./helpers/fixtures";

const CONTRIBUTOR = "Sarah Chen";
const REASON = "Not applicable for regression test.";
const PARTNER_NOTE = "Confirming this request is outside the transaction scope.";
const REQUESTS_KEY = "integrasource.recap.demo.portalRequests";
const SUBMISSIONS_KEY = "integrasource.recap.demo.portalSubmissions";

test("Not Applicable routes through exception review without external publication", async ({ page }) => {
  test.setTimeout(600_000);
  const fixtures = getFixturePaths();

  await gotoApp(page, "/recapitalization/settings");
  await wipeRecapData(page);

  await gotoApp(page, "/portal");
  await page.locator('input[type="file"]').first().setInputFiles(fixtures.notApplicable);
  await expect(page.getByRole("heading", { name: "Package Successfully Analyzed" })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Submit Package" }).click();
  await expect(page.getByText("Package Submitted Successfully")).toBeVisible({ timeout: 30_000 });

  const submission = await page.evaluate(([key, file]) => {
    const rows = JSON.parse(localStorage.getItem(key) || "[]");
    return rows.find((row: any) => row.fileName === file);
  }, [SUBMISSIONS_KEY, NOT_APPLICABLE_FILE] as const);
  expect(submission).toBeTruthy();
  const transactionId = submission.transactionId as string;
  const projectName = submission.transactionName as string;
  let state = await requestState(page);
  const requestId = state.requestId as string;
  expect(state.transactionId).toBe(transactionId);
  expect(state.transactionName).toBe(projectName);

  await gotoApp(page, "/recapitalization/intake");
  const intakeRow = page.locator("tr", { hasText: NOT_APPLICABLE_FILE }).first();
  await expect(intakeRow).toBeVisible();
  await intakeRow.click();
  const reviewRow = page.locator("tr", { hasText: NOT_APPLICABLE_TITLE }).first();
  const reviewSelect = reviewRow.locator("select").filter({ has: page.locator("option", { hasText: "Move to Work Queue" }) }).first();
  await reviewSelect.selectOption({ label: "Move to Work Queue" });
  await expect(reviewRow.getByText("Ready", { exact: true })).toBeVisible();
  expect((await requestState(page)).transactionId).toBe(transactionId);
  await page.getByRole("button", { name: "Move Ready Items" }).click();
  await expect(page.getByRole("heading", { name: "Moved to Work Queue!" })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Open Work Queue" }).click();

  const queueRow = page.locator("tr", { hasText: NOT_APPLICABLE_TITLE }).first();
  await assignOwner(page, queueRow);
  await queueRow.locator("td").nth(2).click();
  await page.getByText("Accept Work", { exact: true }).click();
  state = await requestState(page);
  expect(state.requestId).toBe(requestId);
  expect(state.transactionId).toBe(transactionId);
  expect(state.transactionName).toBe(projectName);
  expect(state.owner).toBe(CONTRIBUTOR);
  expect(state.status).toBe("In Progress");

  await page.getByText("Mark Not Applicable", { exact: true }).click();
  const recommendModal = page.locator(".rc-modal");
  await expect(recommendModal.getByRole("heading", { name: "Recommend Not Applicable" })).toBeVisible();
  await recommendModal.getByPlaceholder("Explain why this is not applicable...").fill(REASON);
  await recommendModal.getByRole("button", { name: "Submit Recommendation" }).click();
  await expect(page.getByText("Not Applicable Recommendation Sent", { exact: true })).toBeVisible();

  state = await requestState(page);
  expect(state.status).toBe("Not Applicable");
  expect(state._statusNotes).toBe(REASON);
  expect(state.owner).toBe(CONTRIBUTOR);
  expect(state.requestId).toBe(requestId);
  expect(state.transactionId).toBe(transactionId);
  expect(state.transactionName).toBe(projectName);
  expect(state._publishedExternal).toBeFalsy();
  expect(state.status).not.toBe("Waiting Partner Review");

  await page.getByRole("button", { name: "Return to My Work" }).click();
  await page.getByRole("button", { name: "Active Work" }).click();
  await expect(page.locator("tr", { hasText: NOT_APPLICABLE_TITLE })).toHaveCount(0);
  await page.getByRole("button", { name: "Returned / Needs Attention" }).click();
  await expect(page.locator("tr", { hasText: NOT_APPLICABLE_TITLE }).first()).toContainText("Not Applicable Review Pending");

  await gotoApp(page, "/recapitalization/dd-operations");
  const exceptionsCard = page.locator(".rc-stat-card", { hasText: "Exceptions" });
  await expect(exceptionsCard).toContainText("1");
  await exceptionsCard.click();
  const exceptionRow = page.locator("tr", { hasText: NOT_APPLICABLE_TITLE }).first();
  await expect(exceptionRow).toContainText(REASON);
  await exceptionRow.locator("td").nth(1).click();
  await page.getByText("Recommend Not Applicable to Partner", { exact: true }).click();
  const ddModal = page.locator(".rc-modal");
  await expect(ddModal).toContainText(REASON);
  await ddModal.getByPlaceholder("Add any additional context for the external partner...").fill(PARTNER_NOTE);
  await ddModal.getByRole("button", { name: "Send Recommendation to Partner" }).click();

  state = await requestState(page);
  expect(state.status).toBe("Not Applicable");
  expect(state._exceptionRecommendation).toBe("Not Applicable");
  expect(state._exceptionSentAt).toBeTruthy();
  expect(state._statusNotes).toBe(PARTNER_NOTE);
  expect(state._publishedExternal).toBeFalsy();
  expect(state._externalStatus).not.toBe("Published External");
  expect(state.requestId).toBe(requestId);
  expect(state.transactionId).toBe(transactionId);
  expect(state.transactionName).toBe(projectName);

  await gotoApp(page, "/portal/requests");
  const externalRows = page.locator(".po-requests-row", { hasText: NOT_APPLICABLE_TITLE });
  await expect(externalRows).toHaveCount(1);
  await expect(externalRows.first().getByText("Exception Review", { exact: true })).toBeVisible();
  await expect(externalRows.first().getByText("Awaiting Your Review", { exact: true })).toHaveCount(0);
  await externalRows.first().click();
  await expect(page.getByText("Potentially Not Applicable", { exact: true })).toBeVisible();
  await expect(page.getByText(PARTNER_NOTE, { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Request Rework", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Approve Removal" }).click();
  await expect(page.getByRole("dialog", { name: "Review Complete" })).toBeVisible();

  state = await requestState(page);
  expect(state.status).toBe("Completed");
  expect(state._exceptionDecision).toBe("Approve Removal");
  expect(state._archived).toBe(true);
  expect(state._archiveReason).toBe("Not Applicable");
  expect(state._publishedExternal).toBeFalsy();
  expect(state._externalStatus).not.toBe("Published External");
  expect(state.requestId).toBe(requestId);
  expect(state.transactionId).toBe(transactionId);
  expect(state.transactionName).toBe(projectName);

  await page.getByRole("dialog", { name: "Review Complete" }).getByRole("button", { name: "Return to Dashboard" }).click();
  await gotoApp(page, "/portal/requests");
  const finalRows = page.locator(".po-requests-row", { hasText: NOT_APPLICABLE_TITLE });
  await expect(finalRows).toHaveCount(1);
  await expect(finalRows.first().getByText("Removed — Not Applicable", { exact: true })).toBeVisible();
  await expect(finalRows.first().getByText("Awaiting Your Review", { exact: true })).toHaveCount(0);
  console.log("NOT-APPLICABLE-FINAL", JSON.stringify({ transactionId, requestId, status: state.status, exceptionDecision: state._exceptionDecision, archived: state._archived, archiveReason: state._archiveReason, publishedExternal: !!state._publishedExternal }));
});

async function requestState(page: Page): Promise<any> {
  return page.evaluate(([key, title]) => JSON.parse(localStorage.getItem(key) || "[]").find((request: any) => request.title === title), [REQUESTS_KEY, NOT_APPLICABLE_TITLE] as const);
}

async function assignOwner(page: Page, row: Locator): Promise<void> {
  const select = row.locator("select").filter({ has: page.locator("option", { hasText: CONTRIBUTOR }) }).first();
  await select.selectOption({ label: CONTRIBUTOR });
  await page.locator(".rc-modal").getByRole("button", { name: "Assign" }).click();
  await expect(page.locator(".rc-modal")).toHaveCount(0);
}

async function wipeRecapData(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Wipe Recapitalization Test Data" }).first().click();
  await page.locator(".rc-modal").getByRole("button", { name: "Wipe Recapitalization Test Data" }).click();
  await expect(page.locator(".rc-modal")).toHaveCount(0);
}

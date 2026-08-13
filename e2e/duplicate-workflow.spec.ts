import type { Locator, Page } from "@playwright/test";
import { test, expect, gotoApp } from "./helpers/auth";
import { DUPLICATE_CANDIDATE_TITLE, DUPLICATE_FILE, DUPLICATE_PRIMARY_TITLE, getFixturePaths } from "./helpers/fixtures";

const CONTRIBUTOR = "Sarah Chen";
const REASON = "Duplicate of the primary request in this package.";
const PARTNER_NOTE = "Please confirm this candidate is a duplicate of the retained primary request.";
const REQUESTS_KEY = "integrasource.recap.demo.portalRequests";
const SUBMISSIONS_KEY = "integrasource.recap.demo.portalSubmissions";

test("confirms a within-package duplicate while retaining the primary request", async ({ page }) => {
  test.setTimeout(600_000);
  const fixtures = getFixturePaths();

  await gotoApp(page, "/recapitalization/settings");
  await wipeRecapData(page);

  await gotoApp(page, "/portal");
  await page.locator('input[type="file"]').first().setInputFiles(fixtures.duplicate);
  await expect(page.getByRole("heading", { name: "Package Successfully Analyzed" })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Submit Package" }).click();
  await expect(page.getByText("Package Submitted Successfully")).toBeVisible({ timeout: 30_000 });

  const submission = await page.evaluate(([key, file]) => {
    const rows = JSON.parse(localStorage.getItem(key) || "[]");
    return rows.find((row: any) => row.fileName === file);
  }, [SUBMISSIONS_KEY, DUPLICATE_FILE] as const);
  expect(submission).toBeTruthy();
  const transactionId = submission.transactionId as string;
  const projectName = submission.transactionName as string;
  let { primary, candidate } = await requestStates(page);
  const primaryId = primary.requestId as string;
  const candidateId = candidate.requestId as string;
  expect(primaryId).not.toBe(candidateId);
  assertIdentity(primary, primaryId, transactionId, projectName);
  assertIdentity(candidate, candidateId, transactionId, projectName);

  await gotoApp(page, "/recapitalization/intake");
  const intakeRow = page.locator("tr", { hasText: DUPLICATE_FILE }).first();
  await expect(intakeRow).toBeVisible();
  await intakeRow.click();
  for (const title of [DUPLICATE_PRIMARY_TITLE, DUPLICATE_CANDIDATE_TITLE]) {
    const row = page.locator("tr", { hasText: title }).first();
    await expect(row).toBeVisible();
    await row.locator("select").filter({ has: page.locator("option", { hasText: "Move to Work Queue" }) }).first().selectOption({ label: "Move to Work Queue" });
    await expect(row.getByText("Ready", { exact: true })).toBeVisible();
  }
  await page.getByRole("button", { name: "Move Ready Items" }).click();
  await expect(page.getByRole("heading", { name: "Moved to Work Queue!" })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Open Work Queue" }).click();

  const primaryQueueRow = page.locator("tr", { hasText: DUPLICATE_PRIMARY_TITLE }).first();
  const candidateQueueRow = page.locator("tr", { hasText: DUPLICATE_CANDIDATE_TITLE }).first();
  await expect(primaryQueueRow).toBeVisible();
  await assignOwner(page, candidateQueueRow);
  await candidateQueueRow.locator("td").nth(2).click();
  await page.getByText("Accept Work", { exact: true }).click();
  ({ primary, candidate } = await requestStates(page));
  expect(primary.status).toBe("Open");
  expect(primary.owner).toBeNull();
  expect(candidate.status).toBe("In Progress");
  expect(candidate.owner).toBe(CONTRIBUTOR);
  assertIdentity(primary, primaryId, transactionId, projectName);
  assertIdentity(candidate, candidateId, transactionId, projectName);

  await page.getByText("Mark Duplicate", { exact: true }).click();
  const duplicateModal = page.locator(".rc-modal");
  await expect(duplicateModal.getByRole("heading", { name: "Mark as Possible Duplicate" })).toBeVisible();
  await duplicateModal.getByLabel("Duplicate Type").selectOption("Within Package");
  await duplicateModal.getByLabel("Duplicate Of").selectOption(primary.id);
  await duplicateModal.getByPlaceholder("Explain why this is a possible duplicate...").fill(REASON);
  await duplicateModal.getByRole("button", { name: "Submit for Review" }).click();
  await expect(page.getByText("Possible Duplicate Submitted", { exact: true })).toBeVisible();

  ({ primary, candidate } = await requestStates(page));
  expect(candidate.status).toBe("Duplicate");
  expect(candidate._duplicateType).toBe("Within Package");
  expect(candidate._duplicateTargetRequestId).toBe(primaryId);
  expect(candidate._duplicateTargetRequestTitle).toBe(DUPLICATE_PRIMARY_TITLE);
  expect(candidate._statusNotes).toBe(REASON);
  expect(candidate.owner).toBe(CONTRIBUTOR);
  expect(candidate._publishedExternal).toBeFalsy();
  expect(primary.status).toBe("Open");
  expect(primary._archived).toBeFalsy();
  assertIdentity(primary, primaryId, transactionId, projectName);
  assertIdentity(candidate, candidateId, transactionId, projectName);

  await page.getByRole("button", { name: "Return to My Work" }).click();
  await page.getByRole("button", { name: "Active Work" }).click();
  await expect(page.locator("tr", { hasText: DUPLICATE_CANDIDATE_TITLE })).toHaveCount(0);
  await page.getByRole("button", { name: "Returned / Needs Attention" }).click();
  await expect(page.locator("tr", { hasText: DUPLICATE_CANDIDATE_TITLE }).first()).toContainText("Duplicate Review Pending");

  await gotoApp(page, "/recapitalization/dd-operations");
  const exceptionsCard = page.locator(".rc-stat-card", { hasText: "Exceptions" });
  await expect(exceptionsCard).toContainText("1");
  await exceptionsCard.click();
  const exceptionRow = page.locator("tr", { hasText: DUPLICATE_CANDIDATE_TITLE }).first();
  await expect(exceptionRow).toContainText(REASON);
  await exceptionRow.locator("td").nth(1).click();
  await page.getByText("Recommend Duplicate to Partner", { exact: true }).click();
  const ddModal = page.locator(".rc-modal");
  await expect(ddModal.getByRole("heading", { name: "Duplicate Recommendation Review" })).toBeVisible();
  await expect(ddModal).toContainText(REASON);
  await ddModal.getByPlaceholder("Add any additional context for the external partner...").fill(PARTNER_NOTE);
  await ddModal.getByRole("button", { name: "Send Recommendation to Partner" }).click();

  ({ primary, candidate } = await requestStates(page));
  expect(candidate.status).toBe("Duplicate");
  expect(candidate._exceptionRecommendation).toBe("Duplicate");
  expect(candidate._exceptionSentAt).toBeTruthy();
  expect(candidate._statusNotes).toBe(PARTNER_NOTE);
  expect(candidate._duplicateTargetRequestId).toBe(primaryId);
  expect(candidate._publishedExternal).toBeFalsy();
  expect(candidate._externalStatus).not.toBe("Published External");
  expect(primary.status).toBe("Open");
  expect(primary._archived).toBeFalsy();

  await gotoApp(page, "/portal/requests");
  const primaryRows = page.locator(".po-requests-row", { hasText: DUPLICATE_PRIMARY_TITLE });
  const candidateRows = page.locator(".po-requests-row", { hasText: DUPLICATE_CANDIDATE_TITLE });
  await expect(primaryRows).toHaveCount(1);
  await expect(candidateRows).toHaveCount(1);
  await expect(candidateRows.first().getByText("Exception Review", { exact: true })).toBeVisible();
  await expect(candidateRows.first().getByText("Awaiting Your Review", { exact: true })).toHaveCount(0);
  await candidateRows.first().click();
  await expect(page.getByText("Potential Duplicate", { exact: true })).toBeVisible();
  await expect(page.getByText(PARTNER_NOTE, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Confirm Duplicate" }).click();
  await expect(page.getByRole("dialog", { name: "Review Complete" })).toBeVisible();

  ({ primary, candidate } = await requestStates(page));
  expect(candidate.status).toBe("Completed");
  expect(candidate._exceptionDecision).toBe("Confirm Duplicate");
  expect(candidate._archived).toBe(true);
  expect(candidate._archiveReason).toBe("Duplicate");
  expect(candidate._duplicateTargetRequestId).toBe(primaryId);
  expect(candidate._publishedExternal).toBeFalsy();
  expect(primary.status).toBe("Open");
  expect(primary._archived).toBeFalsy();
  expect(primary._publishedExternal).toBeFalsy();
  assertIdentity(primary, primaryId, transactionId, projectName);
  assertIdentity(candidate, candidateId, transactionId, projectName);

  await page.getByRole("dialog", { name: "Review Complete" }).getByRole("button", { name: "Return to Dashboard" }).click();
  await gotoApp(page, "/portal/requests");
  const finalPrimaryRows = page.locator(".po-requests-row", { hasText: DUPLICATE_PRIMARY_TITLE });
  const finalCandidateRows = page.locator(".po-requests-row", { hasText: DUPLICATE_CANDIDATE_TITLE });
  await expect(finalPrimaryRows).toHaveCount(1);
  await expect(finalCandidateRows).toHaveCount(1);
  await expect(finalCandidateRows.first().getByText("Removed — Duplicate", { exact: true })).toBeVisible();
  await expect(finalCandidateRows.first().getByText("Awaiting Your Review", { exact: true })).toHaveCount(0);
  console.log("DUPLICATE-FINAL", JSON.stringify({ transactionId, primaryId, candidateId, duplicateType: candidate._duplicateType, duplicateTargetRequestId: candidate._duplicateTargetRequestId, candidateStatus: candidate.status, archived: candidate._archived, archiveReason: candidate._archiveReason, primaryStatus: primary.status, primaryArchived: !!primary._archived, publishedExternal: !!candidate._publishedExternal }));
});

async function requestStates(page: Page): Promise<{ primary: any; candidate: any }> {
  return page.evaluate(([key, primaryTitle, candidateTitle]) => {
    const requests = JSON.parse(localStorage.getItem(key) || "[]");
    return {
      primary: requests.find((request: any) => request.title === primaryTitle),
      candidate: requests.find((request: any) => request.title === candidateTitle),
    };
  }, [REQUESTS_KEY, DUPLICATE_PRIMARY_TITLE, DUPLICATE_CANDIDATE_TITLE] as const);
}

function assertIdentity(request: any, requestId: string, transactionId: string, projectName: string): void {
  expect(request.requestId).toBe(requestId);
  expect(request.transactionId).toBe(transactionId);
  expect(request.transactionName).toBe(projectName);
}

async function assignOwner(page: Page, row: Locator): Promise<void> {
  await row.locator("select").filter({ has: page.locator("option", { hasText: CONTRIBUTOR }) }).first().selectOption({ label: CONTRIBUTOR });
  await page.locator(".rc-modal").getByRole("button", { name: "Assign" }).click();
  await expect(page.locator(".rc-modal")).toHaveCount(0);
}

async function wipeRecapData(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Wipe Recapitalization Test Data" }).first().click();
  await page.locator(".rc-modal").getByRole("button", { name: "Wipe Recapitalization Test Data" }).click();
  await expect(page.locator(".rc-modal")).toHaveCount(0);
}

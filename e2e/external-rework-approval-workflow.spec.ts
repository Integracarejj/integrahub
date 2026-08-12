import type { Locator, Page } from "@playwright/test";
import { test, expect, gotoApp } from "./helpers/auth";
import { getFixturePaths, REWORK_ARTIFACT_FILE, REWORK_FILE, REWORK_TITLE } from "./helpers/fixtures";

const CONTRIBUTOR = "Sarah Chen";
const DD_OPS = "David Park";
const REWORK_REASON = "Please revise the supporting artifact for regression testing.";
const RETURN_REASON = "Address the external partner rework request and resubmit the existing artifact.";
const REQUESTS_KEY = "integrasource.recap.demo.portalRequests";
const SUBMISSIONS_KEY = "integrasource.recap.demo.portalSubmissions";
const ARTIFACTS_KEY = "integrasource.recap.artifacts";

test("artifact survives external rework, republish, and final approval", async ({ page }) => {
  test.setTimeout(600_000);
  const fixtures = getFixturePaths();

  await gotoApp(page, "/recapitalization/settings");
  await wipeRecapData(page);

  await gotoApp(page, "/portal");
  await page.locator('input[type="file"]').first().setInputFiles(fixtures.rework);
  await expect(page.getByRole("heading", { name: "Package Successfully Analyzed" })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Submit Package" }).click();
  await expect(page.getByText("Package Submitted Successfully")).toBeVisible({ timeout: 30_000 });

  const submission = await page.evaluate(([key, file]) => {
    const rows = JSON.parse(localStorage.getItem(key) || "[]");
    return rows.find((row: any) => row.fileName === file);
  }, [SUBMISSIONS_KEY, REWORK_FILE] as const);
  expect(submission).toBeTruthy();
  const transactionId = submission.transactionId as string;
  expect(transactionId).toBeTruthy();

  await gotoApp(page, "/recapitalization/intake");
  const intakeRow = page.locator("tr", { hasText: REWORK_FILE }).first();
  await expect(intakeRow).toBeVisible();
  await intakeRow.click();
  await expect(page.getByRole("heading", { name: "Intake Workbench" })).toBeVisible();
  await setReviewState(page);
  expect((await requestState(page)).transactionId).toBe(transactionId);
  await page.getByRole("button", { name: "Move Ready Items" }).click();
  await expect(page.getByRole("heading", { name: "Moved to Work Queue!" })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Open Work Queue" }).click();

  const queueRow = page.locator("tr", { hasText: REWORK_TITLE }).first();
  await assignOwner(page, queueRow);
  await queueRow.locator("td").nth(2).click();
  await page.getByText("Accept Work", { exact: true }).click();
  let state = await requestState(page);
  expect(state.status).toBe("In Progress");
  expect(state.owner).toBe(CONTRIBUTOR);
  expect(state.transactionId).toBe(transactionId);

  await page.locator("#artifact-upload-hidden").setInputFiles(fixtures.reworkArtifact);
  await expect(page.getByText(REWORK_ARTIFACT_FILE, { exact: true })).toBeVisible();
  await assertArtifact(page, state.requestId);

  await completeFromWorkspace(page, "Initial clean-path completion with deterministic artifact.");
  state = await requestState(page);
  expect(state.status).toBe("Complete");
  await assertArtifact(page, state.requestId);

  await publishFromDdOps(page, "Initial external publication for rework regression.");
  state = await requestState(page);
  assertPublished(state, transactionId);
  const artifactId = await assertArtifact(page, state.requestId);
  expect(state._publishedArtifactIds).toContain(artifactId);

  await openExternalRequest(page);
  await expect(page.getByText("Awaiting Your Review", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Published Documents" })).toBeVisible();
  await expect(page.getByText("Available", { exact: true })).toBeVisible();
  page.once("dialog", dialog => dialog.accept(REWORK_REASON));
  await page.getByRole("button", { name: "Request Rework" }).click();

  state = await requestState(page);
  expect(state.status).toBe("Needs Rework");
  expect(state.owner).toBe(DD_OPS);
  expect(state.assignedTo).toBe(DD_OPS);
  expect(state._partnerDecision).toBe("Rework Required");
  expect(state._partnerNote).toBe(REWORK_REASON);
  expect(state._partnerReworkOriginalOwner).toBe(CONTRIBUTOR);
  expect(state.transactionId).toBe(transactionId);
  await expect(page.getByRole("button", { name: "Request Rework" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);
  await assertArtifact(page, state.requestId);

  await gotoApp(page, "/recapitalization/dd-operations");
  const needsCard = page.locator(".rc-stat-card", { hasText: "Needs DD Review" });
  await expect(needsCard).toContainText("1");
  await needsCard.click();
  const reworkRow = page.locator("tr", { hasText: REWORK_TITLE }).first();
  await expect(reworkRow).toContainText("Rework Requested");
  await expect(reworkRow).toContainText(REWORK_REASON);
  await reworkRow.getByRole("button", { name: "Return to Owner" }).click();
  const returnModal = page.locator(".rc-modal");
  await expect(returnModal).toContainText(CONTRIBUTOR);
  await returnModal.getByPlaceholder("Explain why this item is being returned...").fill(RETURN_REASON);
  await returnModal.getByRole("button", { name: "Return to Owner" }).click();

  state = await requestState(page);
  expect(state.status).toBe("Needs Rework");
  expect(state.owner).toBe(CONTRIBUTOR);
  expect(state.assignedTo).toBe(CONTRIBUTOR);
  expect(state._returnReason).toBe(RETURN_REASON);
  expect(state.transactionId).toBe(transactionId);

  await openMyWork(page, "Returned / Needs Attention");
  await expect(page.getByText("Returned with Feedback", { exact: true })).toBeVisible();
  await expect(page.getByText("Artifacts (1)", { exact: true })).toBeVisible();
  await page.getByText("Accept Work", { exact: true }).click();
  state = await requestState(page);
  expect(state.status).toBe("In Progress");
  expect(state.owner).toBe(CONTRIBUTOR);
  await assertArtifact(page, state.requestId);

  await completeFromWorkspace(page, "External rework completed; supporting artifact reviewed and retained.");
  await publishFromDdOps(page, "Republished after external rework completion.");
  state = await requestState(page);
  assertPublished(state, transactionId);
  expect(state._partnerDecision).toBeNull();
  expect(state._publishedArtifactIds).toContain(artifactId);
  await assertArtifact(page, state.requestId);

  await openExternalRequest(page);
  await expect(page.locator(".po-requests-row", { hasText: REWORK_TITLE })).toHaveCount(0);
  await expect(page.getByText("Awaiting Your Review", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Published Documents" })).toBeVisible();
  await expect(page.getByText("Available", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByRole("dialog", { name: "Review Complete" })).toBeVisible();

  state = await requestState(page);
  expect(state.status).toBe("Completed");
  expect(state._partnerDecision).toBe("Approved");
  expect(state._externalStatus).toBe("Published External");
  expect(state._publishedExternal).toBe(true);
  expect(state.transactionId).toBe(transactionId);
  expect(state._publishedArtifactIds).toContain(artifactId);
  await assertArtifact(page, state.requestId);

  await page.getByRole("dialog", { name: "Review Complete" }).getByRole("button", { name: "Return to Dashboard" }).click();
  await gotoApp(page, "/portal/requests");
  const finalRows = page.locator(".po-requests-row", { hasText: REWORK_TITLE });
  await expect(finalRows).toHaveCount(1);
  await expect(finalRows.first().getByText("Awaiting Your Review", { exact: true })).toHaveCount(0);
  console.log("REWORK-APPROVAL-FINAL", JSON.stringify({ transactionId, requestId: state.requestId, artifactId, status: state.status, externalStatus: state._externalStatus, partnerDecision: state._partnerDecision }));
});

async function requestState(page: Page): Promise<any> {
  return page.evaluate(([key, title]) => JSON.parse(localStorage.getItem(key) || "[]").find((r: any) => r.title === title), [REQUESTS_KEY, REWORK_TITLE] as const);
}

async function assertArtifact(page: Page, requestId: string): Promise<string> {
  const artifacts = await page.evaluate(([key, id]) => {
    const store = JSON.parse(localStorage.getItem(key) || "{}");
    return store[id] || [];
  }, [ARTIFACTS_KEY, requestId] as const);
  const matches = artifacts.filter((artifact: any) => artifact.originalFileName === REWORK_ARTIFACT_FILE || artifact.name === REWORK_ARTIFACT_FILE);
  expect(matches).toHaveLength(1);
  expect(matches[0].requestId).toBe(requestId);
  return matches[0].id;
}

function assertPublished(state: any, transactionId: string): void {
  expect(state.status).toBe("Waiting Partner Review");
  expect(state._externalStatus).toBe("Published External");
  expect(state._publishedExternal).toBe(true);
  expect(state.transactionId).toBe(transactionId);
}

async function setReviewState(page: Page): Promise<void> {
  const row = page.locator("tr", { hasText: REWORK_TITLE }).first();
  const select = row.locator("select").filter({ has: page.locator("option", { hasText: "Move to Work Queue" }) }).first();
  await select.selectOption({ label: "Move to Work Queue" });
  await expect(row.getByText("Ready", { exact: true })).toBeVisible();
}

async function assignOwner(page: Page, row: Locator): Promise<void> {
  const select = row.locator("select").filter({ has: page.locator("option", { hasText: CONTRIBUTOR }) }).first();
  await select.selectOption({ label: CONTRIBUTOR });
  await page.locator(".rc-modal").getByRole("button", { name: "Assign" }).click();
  await expect(page.locator(".rc-modal")).toHaveCount(0);
}

async function completeFromWorkspace(page: Page, note: string): Promise<void> {
  await page.getByText("My work is complete and ready for DD Operations", { exact: true }).click();
  const modal = page.locator(".rc-modal");
  await modal.getByPlaceholder("Describe what was completed or any follow-up items...").fill(note);
  await modal.getByRole("button", { name: "Submit for DD Review" }).click();
  await expect(modal.getByText("Submitted for DD Review", { exact: true })).toBeVisible();
  await modal.getByRole("button", { name: "Return to My Work" }).click();
}

async function publishFromDdOps(page: Page, note: string): Promise<void> {
  await gotoApp(page, "/recapitalization/dd-operations");
  await page.getByRole("button", { name: "Ready to Publish" }).click();
  let row = page.locator("tr", { hasText: REWORK_TITLE }).first();
  if (!(await row.isVisible().catch(() => false))) {
    await page.getByRole("button", { name: "Full Work Queue" }).click();
    row = page.locator("tr", { hasText: REWORK_TITLE }).first();
  }
  await expect(row).toBeVisible();
  await row.locator("td").nth(1).click();
  await page.getByText("Share approved artifacts with the external partner", { exact: true }).click();
  const modal = page.locator(".rc-modal");
  await modal.getByRole("button", { name: "Continue" }).click();
  await modal.getByPlaceholder("e.g. Only available communities are included.").fill(note);
  await modal.getByRole("button", { name: "Confirm Publish External" }).click();
  await expect(modal.getByRole("heading", { name: "Published Externally" })).toBeVisible();
  const done = modal.getByRole("button", { name: "Done" });
  if (await done.isVisible().catch(() => false)) await done.click();
  else await modal.getByRole("button", { name: "Skip for Now" }).click();
}

async function openExternalRequest(page: Page): Promise<void> {
  await gotoApp(page, "/portal/requests");
  const rows = page.locator(".po-requests-row", { hasText: REWORK_TITLE });
  await expect(rows).toHaveCount(1);
  await rows.first().click();
  await expect(page).toHaveURL(/\/portal\/requests\/[^/]+/);
}

async function openMyWork(page: Page, tab: string): Promise<void> {
  await gotoApp(page, "/recapitalization/my-work");
  await page.getByRole("button", { name: tab }).click();
  const row = page.locator("tr", { hasText: REWORK_TITLE }).first();
  await expect(row).toBeVisible();
  await row.locator("td").nth(1).click();
}

async function wipeRecapData(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Wipe Recapitalization Test Data" }).first().click();
  await page.locator(".rc-modal").getByRole("button", { name: "Wipe Recapitalization Test Data" }).click();
  await expect(page.locator(".rc-modal")).toHaveCount(0);
}

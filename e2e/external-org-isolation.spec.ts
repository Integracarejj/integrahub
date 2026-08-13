import type { Page } from "@playwright/test";
import { test, expect, gotoApp } from "./helpers/auth";
import {
  ATLAS_ISOLATION_FILE,
  ATLAS_ISOLATION_TITLE,
  getFixturePaths,
  SUMMIT_ISOLATION_FILE,
  SUMMIT_ISOLATION_TITLE,
} from "./helpers/fixtures";

const ATLAS_PERSONA = "Morgan Blake";
const ATLAS_ORG = "Atlas Capital Partners";
const ATLAS_ORG_ID = "org-atlas";
const ATLAS_PROJECT = "project-atlas-isolation";
const SUMMIT_PERSONA = "Jamie Reynolds";
const SUMMIT_ORG = "Summit Equity Group";
const SUMMIT_ORG_ID = "org-summit";
const SUMMIT_PROJECT = "project-summit-isolation";
const REQUESTS_KEY = "integrasource.recap.demo.portalRequests";
const SUBMISSIONS_KEY = "integrasource.recap.demo.portalSubmissions";
const LAST_TXN_KEY = "integrasource.recap.lastCreatedTransactionId";

test("external personas see only their organization's projects, packages, requests, and counts", async ({ page }) => {
  test.setTimeout(600_000);
  const fixtures = getFixturePaths();

  await gotoApp(page, "/recapitalization/settings");
  await wipeRecapData(page);
  await gotoApp(page, "/portal");
  await expectActivePersona(page, ATLAS_PERSONA, ATLAS_ORG);

  await uploadPackage(page, fixtures.atlasIsolation);
  const atlas = await canonicalRecord(page, ATLAS_ISOLATION_FILE, ATLAS_ISOLATION_TITLE);
  expect(atlas.submission.orgId).toBe(ATLAS_ORG_ID);
  expect(atlas.request.orgId).toBe(ATLAS_ORG_ID);
  expect(atlas.request.transactionId).toBe(atlas.submission.transactionId);
  expect(atlas.request.transactionName).toBe(ATLAS_PROJECT);
  await assertOverviewScope(page, {
    ownProject: ATLAS_PROJECT,
    ownTitle: ATLAS_ISOLATION_TITLE,
    ownFile: ATLAS_ISOLATION_FILE,
    foreignProject: SUMMIT_PROJECT,
    foreignTitle: SUMMIT_ISOLATION_TITLE,
    foreignFile: SUMMIT_ISOLATION_FILE,
  });

  await switchPersona(page, SUMMIT_PERSONA, SUMMIT_ORG);
  expect(await page.evaluate(key => localStorage.getItem(key), LAST_TXN_KEY)).toBeNull();
  await assertNoRenderedLeak(page, ATLAS_PROJECT, ATLAS_ISOLATION_TITLE, ATLAS_ISOLATION_FILE);
  await uploadPackage(page, fixtures.summitIsolation);
  const summit = await canonicalRecord(page, SUMMIT_ISOLATION_FILE, SUMMIT_ISOLATION_TITLE);
  expect(summit.submission.orgId).toBe(SUMMIT_ORG_ID);
  expect(summit.request.orgId).toBe(SUMMIT_ORG_ID);
  expect(summit.request.transactionId).toBe(summit.submission.transactionId);
  expect(summit.request.transactionName).toBe(SUMMIT_PROJECT);
  expect(summit.request.transactionId).not.toBe(atlas.request.transactionId);
  expect(summit.request.requestId).not.toBe(atlas.request.requestId);
  await assertOverviewScope(page, {
    ownProject: SUMMIT_PROJECT,
    ownTitle: SUMMIT_ISOLATION_TITLE,
    ownFile: SUMMIT_ISOLATION_FILE,
    foreignProject: ATLAS_PROJECT,
    foreignTitle: ATLAS_ISOLATION_TITLE,
    foreignFile: ATLAS_ISOLATION_FILE,
  });

  await gotoApp(page, "/portal/transactions");
  await expect(page.getByText(SUMMIT_PROJECT, { exact: true })).toBeVisible();
  await expect(page.getByText(ATLAS_PROJECT, { exact: true })).toHaveCount(0);
  await assertAggregateCounts(page, 1, 1);

  await gotoApp(page, "/portal/requests");
  await assertRequestScope(page, SUMMIT_ISOLATION_TITLE, SUMMIT_PROJECT, ATLAS_ISOLATION_TITLE, ATLAS_ISOLATION_FILE, ATLAS_PROJECT);

  await switchPersona(page, ATLAS_PERSONA, ATLAS_ORG);
  expect(await page.evaluate(key => localStorage.getItem(key), LAST_TXN_KEY)).toBeNull();
  await assertOverviewScope(page, {
    ownProject: ATLAS_PROJECT,
    ownTitle: ATLAS_ISOLATION_TITLE,
    ownFile: ATLAS_ISOLATION_FILE,
    foreignProject: SUMMIT_PROJECT,
    foreignTitle: SUMMIT_ISOLATION_TITLE,
    foreignFile: SUMMIT_ISOLATION_FILE,
  });

  await gotoApp(page, "/portal/transactions");
  await expect(page.getByText(ATLAS_PROJECT, { exact: true })).toBeVisible();
  await expect(page.getByText(SUMMIT_PROJECT, { exact: true })).toHaveCount(0);
  await assertAggregateCounts(page, 1, 1);

  await gotoApp(page, "/portal/requests");
  await assertRequestScope(page, ATLAS_ISOLATION_TITLE, ATLAS_PROJECT, SUMMIT_ISOLATION_TITLE, SUMMIT_ISOLATION_FILE, SUMMIT_PROJECT);

  await gotoApp(page, "/recapitalization/intake");
  const atlasInternal = page.locator("tr", { hasText: ATLAS_ISOLATION_FILE }).first();
  const summitInternal = page.locator("tr", { hasText: SUMMIT_ISOLATION_FILE }).first();
  await expect(atlasInternal).toBeVisible();
  await expect(atlasInternal).toContainText(ATLAS_ORG);
  await expect(summitInternal).toBeVisible();
  await expect(summitInternal).toContainText(SUMMIT_ORG);

  console.log("ORG-ISOLATION-FINAL", JSON.stringify({
    atlas: { orgId: atlas.request.orgId, transactionId: atlas.request.transactionId, requestId: atlas.request.requestId },
    summit: { orgId: summit.request.orgId, transactionId: summit.request.transactionId, requestId: summit.request.requestId },
    distinctTransactions: atlas.request.transactionId !== summit.request.transactionId,
    distinctRequests: atlas.request.requestId !== summit.request.requestId,
  }));
});

async function uploadPackage(page: Page, path: string): Promise<void> {
  await page.locator('input[type="file"]').first().setInputFiles(path);
  await expect(page.getByRole("heading", { name: "Package Successfully Analyzed" })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("strong").filter({ hasText: path.replace(/^.*[\\/]/, "").replace(/\.[^.]+$/, "") })).toBeVisible();
  await page.getByRole("button", { name: "Submit Package" }).click();
  await expect(page.getByText("Package Submitted Successfully")).toBeVisible({ timeout: 30_000 });
}

async function switchPersona(page: Page, persona: string, org: string): Promise<void> {
  await page.locator(".portal-user-profile").click();
  await expect(page.getByText("Switch Persona", { exact: true })).toBeVisible();
  await page.getByText(persona, { exact: true }).last().click();
  await page.waitForLoadState("domcontentloaded");
  await expectActivePersona(page, persona, org);
}

async function expectActivePersona(page: Page, persona: string, org: string): Promise<void> {
  const profile = page.locator(".portal-user-profile");
  await expect(profile).toContainText(persona);
  await expect(profile).toContainText(org);
}

async function canonicalRecord(page: Page, file: string, title: string): Promise<{ submission: any; request: any }> {
  return page.evaluate(([submissionsKey, requestsKey, fileName, requestTitle]) => {
    const submissions = JSON.parse(localStorage.getItem(submissionsKey) || "[]");
    const requests = JSON.parse(localStorage.getItem(requestsKey) || "[]");
    return {
      submission: submissions.find((row: any) => row.fileName === fileName),
      request: requests.find((row: any) => row.title === requestTitle),
    };
  }, [SUBMISSIONS_KEY, REQUESTS_KEY, file, title] as const);
}

async function assertOverviewScope(page: Page, expected: { ownProject: string; ownTitle: string; ownFile: string; foreignProject: string; foreignTitle: string; foreignFile: string }): Promise<void> {
  await gotoApp(page, "/portal");
  const transactionSelect = page.locator("select").filter({ hasText: expected.ownProject }).first();
  await expect(transactionSelect).toContainText(expected.ownProject);
  await expect(transactionSelect).not.toContainText(expected.foreignProject);
  await expect(page.getByText(expected.ownTitle, { exact: true })).toBeVisible();
  await expect(page.getByText(expected.foreignTitle, { exact: true })).toHaveCount(0);
  await expect(page.getByText(expected.foreignFile, { exact: true })).toHaveCount(0);
  await expect(page.getByText(expected.foreignProject, { exact: true })).toHaveCount(0);
  await expect(page.locator(".po-stat-card", { hasText: "Total Requests" })).toContainText("1");
}

async function assertNoRenderedLeak(page: Page, project: string, title: string, file: string): Promise<void> {
  await expect(page.getByText(project, { exact: true })).toHaveCount(0);
  await expect(page.getByText(title, { exact: true })).toHaveCount(0);
  await expect(page.getByText(file, { exact: true })).toHaveCount(0);
  await expect(page.locator("select").filter({ hasText: project })).toHaveCount(0);
}

async function assertAggregateCounts(page: Page, requests: number, transactions: number): Promise<void> {
  const aggregate = page.locator(".po-txn-summary", { hasText: /^All / }).first();
  await expect(aggregate.locator(".po-txn-stat", { hasText: "Total Requests" })).toContainText(String(requests));
  await expect(aggregate.locator(".po-txn-stat", { hasText: "Transactions" })).toContainText(String(transactions));
}

async function assertRequestScope(page: Page, ownTitle: string, ownProject: string, foreignTitle: string, foreignFile: string, foreignProject: string): Promise<void> {
  const ownRow = page.locator(".po-requests-row", { hasText: ownTitle });
  await expect(ownRow).toHaveCount(1);
  await expect(ownRow.first()).toContainText(ownProject);
  await expect(page.locator(".po-requests-row", { hasText: foreignTitle })).toHaveCount(0);
  await expect(page.getByText(foreignFile, { exact: true })).toHaveCount(0);
  await expect(page.getByText(foreignProject, { exact: true })).toHaveCount(0);
}

async function wipeRecapData(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Wipe Recapitalization Test Data" }).first().click();
  await page.locator(".rc-modal").getByRole("button", { name: "Wipe Recapitalization Test Data" }).click();
  await expect(page.locator(".rc-modal")).toHaveCount(0);
}

import { expect, test, type Page } from "@playwright/test";
import { getFixturePaths } from "./helpers/fixtures";
import { statSync } from "node:fs";

const EXTERNAL_USER = {
    isAuthenticated: true,
    hasAppAccess: true,
    authSource: "e2e-b2b",
    principalId: "3a45acd1-a723-4378-8350-f2a491dcdb1c",
    principalName: "joyner.jeremy@ymail.com",
    resolvedEmail: "joyner.jeremy@ymail.com",
    userRecord: {
        id: "user-1777051904674-6n040l",
        entraObjectId: "3a45acd1-a723-4378-8350-f2a491dcdb1c",
        email: "joyner.jeremy@ymail.com",
        displayName: "",
        role: "ExternalBroker",
    },
    accessReason: null,
    portalRole: "ExternalBroker",
    isPortalUser: true,
    externalContext: {
        organizations: [{ id: "TEST-BROKER-ORG", isDefault: true }],
        defaultOrganizationId: "TEST-BROKER-ORG",
        isConfigured: true,
    },
};

async function mockIdentity(page: Page) {
    await page.route("**/api/me/permissions", route => route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ user: null, permissions: { globalRole: "ExternalBroker", assignments: [] } }),
    }));
    await page.route("**/api/me", route => route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(EXTERNAL_USER),
    }));
}

test("real external new project creates once and retry reuses the authoritative transaction", async ({ page }) => {
    const fixture = getFixturePaths().liberty;
    let createCount = 0;
    let uploadCount = 0;
    let intakeCount = 0;
    await mockIdentity(page);
    await page.route("**/api/portal/recapitalization/transactions", async route => {
        if (route.request().method() === "GET") {
            return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ transactions: [] }) });
        }
        createCount++;
        expect(route.request().postDataJSON()).toEqual({ name: "liberty" });
        return route.fulfill({
            status: 201,
            contentType: "application/json",
            body: JSON.stringify({ id: "REC-2026-00000002", name: "liberty", status: "Active", owningExternalOrganizationId: "TEST-BROKER-ORG" }),
        });
    });
    await page.route("**/api/portal/recapitalization/transactions/*/incoming-documents", route => {
        uploadCount++;
        expect(route.request().url()).toContain("REC-2026-00000002");
        if (uploadCount === 1) return route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: "Incoming package persistence failed" }) });
        return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ documentId: "doc-1", status: "Uploaded" }) });
    });
    await page.route("**/api/portal/recapitalization/transactions/*/intake", async route => {
        intakeCount++;
        const body = route.request().postDataJSON();
        expect(body.sourcePackageId).toMatch(/^sub-/);
        expect(body.requests.length).toBeGreaterThan(0);
        await new Promise(resolve => setTimeout(resolve, 250));
        return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ id: "intake-1", created: true, requestCount: body.requests.length }) });
    });

    await page.goto("/portal", { waitUntil: "domcontentloaded" });
    await page.locator('input[type="file"]').first().setInputFiles(fixture);
    await expect(page.getByRole("heading", { name: "Package Successfully Analyzed" })).toBeVisible();
    await page.getByRole("button", { name: "Submit Package" }).click();
    await expect(page.getByText(/Package could not be persisted/)).toBeVisible();
    expect(createCount).toBe(1);
    expect(uploadCount).toBe(1);

    await page.getByRole("button", { name: "Submit Package" }).click();
    await expect(page.getByRole("status")).toContainText("Creating your project and securely uploading your package");
    await expect(page.getByRole("button", { name: "Submitting package..." })).toBeDisabled();
    await expect(page.getByText("Package Submitted Successfully")).toBeVisible();
    expect(createCount).toBe(1);
    expect(uploadCount).toBe(2);
    expect(intakeCount).toBe(1);
});

test("real external existing project selection uses the authorized SQL transaction without creating another", async ({ page }) => {
    const fixture = getFixturePaths().liberty;
    let createCount = 0;
    let uploadedTransaction = "";
    await mockIdentity(page);
    await page.route("**/api/portal/recapitalization/transactions", route => {
        if (route.request().method() === "POST") createCount++;
        return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ transactions: [{ id: "REC-2026-00000007", name: "Authorized Project", status: "Active", owningExternalOrganizationId: "TEST-BROKER-ORG" }] }),
        });
    });
    await page.route("**/api/portal/recapitalization/transactions/*/incoming-documents", route => {
        uploadedTransaction = route.request().url();
        return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ documentId: "doc-2", status: "Uploaded" }) });
    });
    await page.route("**/api/portal/recapitalization/transactions/*/intake", route => route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ id: "intake-2", created: true, requestCount: route.request().postDataJSON().requests.length }) }));

    await page.goto("/portal/submit?type=upload-package", { waitUntil: "domcontentloaded" });
    const transactionSelect = page.locator("select").filter({ has: page.getByRole("option", { name: /Authorized Project/ }) });
    await expect(transactionSelect.getByRole("option", { name: /Authorized Project/ })).toHaveCount(1);
    await transactionSelect.selectOption({ label: "Authorized Project — REC-2026-00000007" });
    await page.locator('input[type="file"]').setInputFiles(fixture);
    await page.getByRole("button", { name: "Analyze Package" }).click();
    await expect(page.getByRole("heading", { name: "Package Analyzed" })).toBeVisible();
    await page.getByRole("button", { name: "Submit Package to IntegraCare" }).click();
    await expect(page.getByText(/Package submitted successfully!/)).toBeVisible();
    expect(createCount).toBe(0);
    expect(uploadedTransaction).toContain("REC-2026-00000007");
});

test("fresh browser recovers an uploaded package through Existing Project without creating or duplicating it", async ({ page }) => {
    const fixture = getFixturePaths().liberty;
    const sourcePackageId = "sub-durable-prior-session";
    let createCount = 0;
    let uploadCount = 0;
    let intakeCount = 0;
    await mockIdentity(page);
    await page.route("**/api/portal/recapitalization/transactions", route => {
        if (route.request().method() === "POST") createCount++;
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ transactions: [{
            id: "REC-2026-00000003", name: "Project Keystone", status: "Active",
            owningExternalOrganizationId: "TEST-BROKER-ORG",
            recoverablePackage: { sourcePackageId, originalFileName: "liberty.xlsx", contentSize: statSync(fixture).size },
        }] }) });
    });
    await page.route("**/api/portal/recapitalization/transactions/*/incoming-documents", route => {
        uploadCount++;
        expect(route.request().headers()["x-package-id"]).toBe(sourcePackageId);
        return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ documentId: "existing-doc", sourcePackageId, status: "Uploaded" }) });
    });
    await page.route("**/api/portal/recapitalization/transactions/*/intake", route => {
        intakeCount++;
        expect(route.request().postDataJSON().sourcePackageId).toBe(sourcePackageId);
        return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ id: "intake-recovered", created: true, requestCount: route.request().postDataJSON().requests.length }) });
    });

    // Each Playwright test receives a fresh browser context: no localStorage from
    // the session that originally uploaded the durable package exists here.
    await page.goto("/portal/submit?type=upload-package", { waitUntil: "domcontentloaded" });
    await page.locator("select").filter({ has: page.getByRole("option", { name: /Project Keystone/ }) }).selectOption({ label: "Project Keystone — REC-2026-00000003" });
    await page.locator('input[type="file"]').setInputFiles(fixture);
    await page.getByRole("button", { name: "Analyze Package" }).click();
    await page.getByRole("button", { name: "Submit Package to IntegraCare" }).click();
    await expect(page.getByText(/Package submitted successfully!/)).toBeVisible();
    expect(createCount).toBe(0);
    expect(uploadCount).toBe(1);
    expect(intakeCount).toBe(1);
});

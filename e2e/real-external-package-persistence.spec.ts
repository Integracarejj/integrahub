import { expect, test, type Page } from "@playwright/test";
import { getFixturePaths } from "./helpers/fixtures";

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

    await page.goto("/portal", { waitUntil: "domcontentloaded" });
    await page.locator('input[type="file"]').first().setInputFiles(fixture);
    await expect(page.getByRole("heading", { name: "Package Successfully Analyzed" })).toBeVisible();
    await page.getByRole("button", { name: "Submit Package" }).click();
    await expect(page.getByText(/Package could not be persisted/)).toBeVisible();
    expect(createCount).toBe(1);
    expect(uploadCount).toBe(1);

    await page.getByRole("button", { name: "Submit Package" }).click();
    await expect(page.getByText("Package Submitted Successfully")).toBeVisible();
    expect(createCount).toBe(1);
    expect(uploadCount).toBe(2);
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

    await page.goto("/portal/submit?type=upload-package", { waitUntil: "domcontentloaded" });
    const transactionSelect = page.locator("select").filter({ has: page.getByRole("option", { name: "Authorized Project" }) });
    await expect(transactionSelect.getByRole("option", { name: "Authorized Project" })).toHaveCount(1);
    await transactionSelect.selectOption({ label: "Authorized Project" });
    await page.locator('input[type="file"]').setInputFiles(fixture);
    await page.getByRole("button", { name: "Analyze Package" }).click();
    await expect(page.getByRole("heading", { name: "Package Analyzed" })).toBeVisible();
    await page.getByRole("button", { name: "Submit Package to IntegraCare" }).click();
    await expect(page.getByText(/Package submitted successfully!/)).toBeVisible();
    expect(createCount).toBe(0);
    expect(uploadedTransaction).toContain("REC-2026-00000007");
});

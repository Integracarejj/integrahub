import { expect, test, type Page } from "@playwright/test";
import { PREVIEW_USER } from "./helpers/auth";

async function mockUser(page: Page, body: unknown) {
    await page.route("**/api/me/permissions", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user: null, permissions: { globalRole: "Viewer", assignments: [] } }) }));
    await page.route("**/api/portal/recapitalization/read-model*", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ transactions: [] }) }));
    await page.route("**/api/portal/recapitalization/transactions", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ transactions: [] }) }));
    await page.route("**/api/me", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) }));
}

function externalUser(role: "ExternalBroker" | "ExternalBuyer") {
    return { ...PREVIEW_USER, userRecord: { ...PREVIEW_USER.userRecord, role }, portalRole: role, isPortalUser: true, externalContext: { organizations: [{ id: "TEST-BROKER-ORG", isDefault: true }], defaultOrganizationId: "TEST-BROKER-ORG", isConfigured: true } };
}

test("internal user can open COSM from the IntegraIQ shell", async ({ page }) => {
    await mockUser(page, PREVIEW_USER);
    await page.goto("/cosm", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/cosm$/);
    await expect(page.locator(".app-shell")).toBeVisible();
    await expect(page.getByRole("heading", { name: "COSM" })).toBeVisible();
    await expect(page.getByRole("link", { name: "COSM" })).toBeVisible();
    await expect(page.locator(".portal-sidebar")).toHaveCount(0);
});

for (const role of ["ExternalBroker", "ExternalBuyer"] as const) {
    test(`${role} deep-link to COSM is redirected to the portal`, async ({ page }) => {
        await mockUser(page, externalUser(role));
        await page.goto("/cosm", { waitUntil: "domcontentloaded" });
        await expect(page).toHaveURL(/\/portal$/);
        await expect(page.locator(".app-shell")).toHaveCount(0);
        await expect(page.getByRole("link", { name: "COSM" })).toHaveCount(0);
    });
}

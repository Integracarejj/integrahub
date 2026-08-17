import { expect, test, type Page } from "@playwright/test";
import { PREVIEW_USER } from "./helpers/auth";

function externalUser(role: "ExternalBroker" | "ExternalBuyer", configured = true) {
    return {
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
            role,
        },
        accessReason: null,
        portalRole: role,
        isPortalUser: true,
        externalContext: {
            organizations: configured ? [{ id: "TEST-BROKER-ORG", isDefault: true }] : [],
            defaultOrganizationId: configured ? "TEST-BROKER-ORG" : null,
            isConfigured: configured,
        },
    };
}

async function mockCurrentUser(page: Page, body: unknown) {
    await page.route("**/api/me/permissions", (route) => route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ user: null, permissions: { globalRole: "Viewer", assignments: [] } }),
    }));
    await page.route("**/api/me", (route) => route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
    }));
}

for (const role of ["ExternalBroker", "ExternalBuyer"] as const) {
    test(`${role} is redirected from internal recap routes to its real external portal`, async ({ page }) => {
        await mockCurrentUser(page, externalUser(role));
        await page.goto("/recapitalization", { waitUntil: "domcontentloaded" });

        await expect(page).toHaveURL(/\/portal$/);
        await expect(page.locator(".portal-user-profile")).toContainText("joyner.jeremy@ymail.com");
        await expect(page.locator(".portal-user-profile")).toContainText("TEST-BROKER-ORG");
        await expect(page.getByText("Morgan Blake", { exact: true })).toHaveCount(0);
        await expect(page.getByText("Atlas Capital Partners", { exact: true })).toHaveCount(0);

        await page.goto("/recapitalization/settings", { waitUntil: "domcontentloaded" });
        await expect(page).toHaveURL(/\/portal$/);
    });
}

test("internal PlatformAdmin retains internal recap access and explicit demo preview", async ({ page }) => {
    await mockCurrentUser(page, { ...PREVIEW_USER, externalContext: null });
    await page.goto("/recapitalization", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/recapitalization$/);

    await page.goto("/portal", { waitUntil: "domcontentloaded" });
    await expect(page.locator(".portal-preview-banner")).toBeVisible();
    await expect(page.getByText("Morgan Blake", { exact: true })).toBeVisible();
});

test("authenticated external user without membership fails closed", async ({ page }) => {
    await mockCurrentUser(page, externalUser("ExternalBroker", false));
    await page.goto("/portal", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "External organization access required" })).toBeVisible();
    await expect(page.getByText("Morgan Blake", { exact: true })).toHaveCount(0);
});

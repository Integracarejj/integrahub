import { test, expect, Page } from "@playwright/test";

/**
 * In-browser mock for the app's auth endpoints.
 *
 * The real backend needs Azure SQL credentials and Entra identity, which are
 * not available on this local corporate PC. Instead of running the backend,
 * intercept the same-origin /api/me calls before they reach the vite proxy
 * and answer with a PlatformAdmin preview user.
 *
 * PlatformAdmin preview mode is a first-class feature of the app
 * (src/app/App.tsx PortalGuard): it allows a hasAppAccess user to view the
 * external portal with persona-scoped mock data while still accessing the
 * internal recapitalization routes.
 */
export const PREVIEW_USER = {
    isAuthenticated: true,
    hasAppAccess: true,
    authSource: "e2e-mock",
    principalId: "e2e-preview",
    principalName: "e2e-preview",
    resolvedEmail: "e2e.preview@integracare.com",
    userRecord: {
        id: "user-e2e",
        entraObjectId: "e2e-entra",
        email: "e2e.preview@integracare.com",
        displayName: "E2E Preview Admin",
        role: "PlatformAdmin",
    },
    accessReason: null,
    portalRole: null,
    isPortalUser: false,
};

export async function mockAuth(page: Page): Promise<void> {
    let transactionSequence = 1;
    await page.route("**/api/portal/recapitalization/transactions", async (route) => {
        if (route.request().method() !== "POST") return route.fallback();
        const id = `REC-2026-${String(transactionSequence++).padStart(8, "0")}`;
        const body = route.request().postDataJSON();
        return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ id, name: body?.name, status: "Active", owningExternalOrganizationId: "org-atlas" }) });
    });
    await page.route("**/api/portal/recapitalization/transactions/*/incoming-documents", async (route) => {
        if (route.request().method() !== "POST") return route.fallback();
        return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ documentId: "doc-e2e", status: "Uploaded" }) });
    });
    await page.route("**/api/me/permissions", (route) =>
        route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
                user: { id: "user-e2e", email: "e2e.preview@integracare.com", name: "E2E Preview Admin", globalRole: "PlatformAdmin" },
                permissions: { globalRole: "PlatformAdmin", assignments: [] },
            }),
        }),
    );

    await page.route("**/api/me", (route) => {
        if (route.request().url().endsWith("/permissions")) {
            return route.fallback();
        }
        return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(PREVIEW_USER),
        });
    });
}

/**
 * Navigate to a URL after auth mocking is in place.
 *
 * The preview banner (.portal-preview-banner) is rendered by PortalLayout and
 * only exists on /portal/* routes. Internal recapitalization routes render a
 * different layout, so for those we just wait for the app root to mount.
 */
export async function gotoApp(page: Page, path = "/portal"): Promise<void> {
    await mockAuth(page);
    await page.goto(path, { waitUntil: "domcontentloaded" });
    if (path.startsWith("/portal")) {
        // Preview banner is rendered by PortalLayout when a hasAppAccess user views
        // the portal — confirms both auth and the portal guard passed.
        await expect(page.locator(".portal-preview-banner")).toBeVisible({ timeout: 20_000 });
    } else {
        await expect(page.locator("#root")).toBeVisible({ timeout: 20_000 });
        await page.waitForLoadState("domcontentloaded");
    }
}

export { test, expect };

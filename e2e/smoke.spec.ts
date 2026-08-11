import { test, expect, gotoApp } from "./helpers/auth";

/**
 * Smoke test — proves the Playwright harness can:
 *  1. start/open the local IntegraIQ app (vite dev server + Edge)
 *  2. navigate to the external portal
 *  3. identify the active persona/organization
 *  4. interact with a basic stable page element
 *  5. assert a simple rendered-state check
 */
test("smoke: portal loads with a recognizable persona", async ({ page }) => {
    await gotoApp(page, "/portal");

    // Brand header
    await expect(page.locator(".portal-brand-title")).toHaveText("Due Diligence Dashboard");

    // Active persona + organization in the top nav
    const personaBlock = page.locator(".portal-user-profile");
    await expect(personaBlock).toBeVisible();
    await expect(page.locator(".portal-user-name")).toContainText("Morgan Blake");
    await expect(page.locator(".portal-user-role")).toContainText("Atlas Capital Partners");

    // Preview mode banner (hasAppAccess user viewing the portal)
    await expect(page.locator(".portal-preview-banner")).toContainText("Preview Mode");

    // The overview renders the upload entry point in its idle state
    await expect(page.getByRole("heading", { name: "Upload your due diligence request list to begin" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Browse Files" })).toBeVisible();

    // Basic interaction: open the persona switcher and cancel it
    await page.locator(".portal-user-profile").click();
    await expect(page.getByText("Switch Persona")).toBeVisible();
    await page.mouse.click(10, 10);
});

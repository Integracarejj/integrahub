import { test, expect } from "@playwright/test";
import { mockAuth, PREVIEW_USER } from "./helpers/auth";

const publication = {
    id: "22222222-2222-4222-8222-222222222222", workItemId: "work", requestId: "DD-2026-00000178",
    publicationNumber: 1, title: "Confirm LTC arrangements", transactionName: "Project Liberty",
    externalOrganizationId: "TEST-BROKER-ORG", status: "Published", publishedAt: "2026-09-11T12:00:00Z",
    responseSnapshotAvailable: false, responseContent: null,
    artifacts: [{ id: "pdf", fileName: "Report.pdf", contentType: "application/pdf" }, { id: "docx", fileName: "Report.docx", contentType: "application/octet-stream" }],
};

test("admin explicitly enters authoritative preview, downloads, and clears data on org switch/failure", async ({ page }) => {
    await mockAuth(page);
    let writes = 0;
    await page.route("**/api/admin/recap-external-preview/**", route => {
        const path = new URL(route.request().url()).pathname;
        if (route.request().method() !== "GET") { writes++; return route.fulfill({ status: 403 }); }
        if (path.endsWith("/organizations")) return route.fulfill({ json: { organizations: [{ id: "TEST-BROKER-ORG" }, { id: "OTHER" }, { id: "FAIL" }] } });
        if (path.includes("/FAIL/")) return route.fulfill({ status: 503, json: { error: "Preview unavailable" } });
        if (path.includes("/OTHER/")) return route.fulfill({ json: { publications: [] } });
        if (path.endsWith("/content")) return route.fulfill({ body: "edition bytes" });
        if (path.endsWith("/publications")) return route.fulfill({ json: { publications: [publication] } });
        return route.fulfill({ json: { publication } });
    });
    await page.goto("/portal");
    await page.getByRole("link", { name: "Authoritative External Preview (read-only)" }).click();
    await expect(page.locator(".portal-preview-banner")).toContainText("ADMIN PREVIEW — READ ONLY");
    await page.getByLabel("Preview organization").selectOption("TEST-BROKER-ORG");
    await page.getByRole("button", { name: /Open DD-2026-00000178/ }).click();
    await expect(page).toHaveURL(/\/portal\/admin-preview\/TEST-BROKER-ORG\/publications\/22222222/);
    await expect(page.getByText("A response snapshot was not recorded for this edition. Current draft findings are not shown.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Approve", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Request Rework", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Download Report.docx" })).toBeVisible();
    const downloaded = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download Report.pdf" }).click();
    expect((await downloaded).suggestedFilename()).toBe("Report.pdf");
    await expect(page.getByText("Atlas Capital Partners", { exact: true })).toHaveCount(0);
    await page.getByRole("link", { name: "Back to organization selection" }).click();
    await page.getByLabel("Preview organization").selectOption("OTHER");
    await expect(page.getByText("No published editions for this organization.")).toBeVisible();
    await expect(page.getByRole("heading", { name: /DD-2026-00000178/ })).toHaveCount(0);
    await page.getByLabel("Preview organization").selectOption("TEST-BROKER-ORG");
    await page.getByRole("button", { name: /Open DD-2026-00000178/ }).click();
    await page.getByRole("link", { name: "Back to organization selection" }).click();
    await page.getByLabel("Preview organization").selectOption("FAIL");
    await expect(page.getByRole("alert")).toContainText("Preview unavailable");
    await expect(page.getByRole("button", { name: /Open DD-2026-00000178/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Download Report.pdf" })).toHaveCount(0);
    expect(writes).toBe(0);
});

for (const role of ["ExternalBroker", "ExternalBuyer"]) {
    test(`${role} cannot enter admin preview or gain an organization selector`, async ({ page }) => {
        await mockAuth(page);
        await page.route("**/api/me", route => route.fulfill({ json: { ...PREVIEW_USER,
            userRecord: { ...PREVIEW_USER.userRecord, role }, portalRole: role, isPortalUser: true,
            externalContext: { organizations: [{ id: "OTHER", isDefault: true }], defaultOrganizationId: "OTHER", isConfigured: true },
        } }));
        let reads = 0;
        await page.route("**/api/admin/recap-external-preview/**", route => { reads++; return route.fulfill({ status: 403 }); });
        await page.goto("/portal/admin-preview?organizationId=TEST-BROKER-ORG");
        await expect(page.getByRole("alert")).toContainText("PlatformAdmin required");
        await expect(page.getByLabel("Preview organization")).toHaveCount(0);
        expect(reads).toBe(0);
    });
}

test("preview deep links, refresh and demo navigation never retain organization state", async ({ page }) => {
    await mockAuth(page);
    let previewReads = 0;
    await page.route("**/api/admin/recap-external-preview/**", route => {
        const path = new URL(route.request().url()).pathname;
        if (path.endsWith("/organizations")) return route.fulfill({ json: { organizations: [{ id: "TEST-BROKER-ORG" }] } });
        previewReads++;
        return route.fulfill({ json: path.endsWith("/publications") ? { publications: [publication] } : { publication } });
    });
    await page.goto("/PORTAL/ADMIN-PREVIEW/?organizationId=TEST-BROKER-ORG");
    await expect(page.locator(".portal-preview-banner")).toContainText("ADMIN PREVIEW — READ ONLY");
    await expect(page.getByLabel("Preview organization")).toHaveValue("");
    expect(previewReads).toBe(0);
    await page.getByLabel("Preview organization").selectOption("TEST-BROKER-ORG");
    await page.getByRole("button", { name: /Open DD-2026-00000178/ }).click();
    await expect(page.getByRole("heading", { name: /DD-2026-00000178/ })).toBeVisible();
    await page.getByRole("link", { name: "Exit to Demo Preview" }).click();
    await expect(page.locator(".portal-preview-banner")).toContainText("Persona-scoped mock data only");
    await expect(page.getByRole("heading", { name: /DD-2026-00000178/ })).toHaveCount(0);
    await page.getByRole("link", { name: "Authoritative External Preview (read-only)" }).click();
    await expect(page.getByLabel("Preview organization")).toHaveValue("");
    await page.getByLabel("Preview organization").selectOption("TEST-BROKER-ORG");
    await expect(page.getByRole("button", { name: /Open DD-2026-00000178/ })).toBeVisible();
    await page.route("**/api/me", route => route.fulfill({ json: { ...PREVIEW_USER,
        userRecord: { ...PREVIEW_USER.userRecord, id: "second-admin", displayName: "Second Admin" },
    } }));
    await page.reload();
    await expect(page.locator(".portal-preview-banner")).toContainText("Second Admin");
    await expect(page.getByLabel("Preview organization")).toHaveValue("");
    await expect(page.getByRole("button", { name: /Open DD-2026-00000178/ })).toHaveCount(0);
    await page.route("**/api/me", route => route.fulfill({ json: { ...PREVIEW_USER,
        userRecord: { ...PREVIEW_USER.userRecord, id: "external-user", role: "ExternalBroker" },
        portalRole: "ExternalBroker", isPortalUser: true,
        externalContext: { organizations: [{ id: "OTHER", isDefault: true }], defaultOrganizationId: "OTHER", isConfigured: true },
    } }));
    await page.route("**/api/portal/recapitalization/publications", route => route.fulfill({ json: { publications: [] } }));
    const before = previewReads;
    await page.goto("/portal/requests?organizationId=TEST-BROKER-ORG");
    await expect(page.getByRole("heading", { name: "Requests", exact: true })).toBeVisible();
    await expect(page.getByLabel("Preview organization")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Open DD-2026-00000178/ })).toHaveCount(0);
    expect(previewReads).toBe(before);
});

test("an old organization response cannot repopulate a newly selected organization", async ({ page }) => {
    await mockAuth(page);
    let release: () => void = () => {};
    const waiting = new Promise<void>(resolve => { release = resolve; });
    let started = false;
    await page.route("**/api/admin/recap-external-preview/**", async route => {
        const path = new URL(route.request().url()).pathname;
        if (path.endsWith("/organizations")) return route.fulfill({ json: { organizations: [{ id: "TEST-BROKER-ORG" }, { id: "OTHER" }] } });
        if (path.includes("/TEST-BROKER-ORG/")) {
            started = true; await waiting;
            return route.fulfill({ json: { publications: [publication] } });
        }
        return route.fulfill({ status: 503, json: { error: "Other organization unavailable" } });
    });
    await page.goto("/portal/admin-preview");
    await page.getByLabel("Preview organization").selectOption("TEST-BROKER-ORG");
    await expect.poll(() => started).toBe(true);
    await page.getByLabel("Preview organization").selectOption("OTHER");
    await expect(page.getByRole("alert")).toContainText("Other organization unavailable");
    const lateResponse = page.waitForResponse(response => response.url().includes("/TEST-BROKER-ORG/publications"));
    release(); await lateResponse;
    await expect(page.getByRole("button", { name: /Open DD-2026-00000178/ })).toHaveCount(0);
    await expect(page.getByLabel("Preview organization")).toHaveValue("OTHER");
});

test("admin preview edition deep links remain organization-scoped", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/recap-external-preview/**", route => {
        const path = new URL(route.request().url()).pathname;
        if (path.includes("/TEST-BROKER-ORG/")) return route.fulfill({ json: { publication } });
        return route.fulfill({ status: 404, json: { error: "Publication not found" } });
    });
    await page.goto(`/portal/admin-preview/TEST-BROKER-ORG/publications/${publication.id}`);
    await expect(page.getByRole("heading", { name: /DD-2026-00000178/ })).toBeVisible();
    await page.goto(`/portal/admin-preview/OTHER/publications/${publication.id}`);
    await expect(page.getByRole("alert")).toContainText("Publication not found");
    await expect(page.getByRole("heading", { name: /DD-2026-00000178/ })).toHaveCount(0);
});

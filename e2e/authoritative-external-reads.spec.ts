import { expect, test, type Page } from "@playwright/test";

const externalUser = {
    isAuthenticated: true, hasAppAccess: true, authSource: "e2e-b2b",
    principalId: "entra-real", principalName: "joyner.jeremy@ymail.com", resolvedEmail: "joyner.jeremy@ymail.com",
    userRecord: { id: "real-user", entraObjectId: "entra-real", email: "joyner.jeremy@ymail.com", displayName: "Jeremy Joyner", role: "ExternalBroker" },
    accessReason: null, portalRole: "ExternalBroker", isPortalUser: true,
    externalContext: { organizations: [{ id: "TEST-BROKER-ORG", isDefault: true }], defaultOrganizationId: "TEST-BROKER-ORG", isConfigured: true },
};

const transactions = [
    { id: "REC-2026-00000003", name: "Project Keystone", status: "Active", owningExternalOrganizationId: "TEST-BROKER-ORG", recoverablePackage: null },
    { id: "REC-2026-00000004", name: "Project Keystone", status: "Active", owningExternalOrganizationId: "TEST-BROKER-ORG", recoverablePackage: null },
];

const readModel = { transactions: [
    { ...transactions[0], createdAt: "2026-08-18", packages: [{
        id: "pkg-3", sourcePackageId: "sub-3", name: "Project Keystone", fileName: "Project Keystone.xlsx",
        status: "Awaiting Review", requestCount: 2, submittedAt: "2026-08-18T12:00:00Z",
        submittedBy: { id: "real-user", name: "Jeremy Joyner", email: "joyner.jeremy@ymail.com" },
        requests: [
            { rowNumber: 1, category: "Legal", title: "Contracts", description: "All contracts", team: "Legal", owner: null, priority: "High", dueDate: null, communityNames: [] },
            { rowNumber: 2, category: "Finance", title: "Rent roll", description: "Current rent roll", team: "Finance", owner: null, priority: "Medium", dueDate: null, communityNames: [] },
        ],
    }] },
    { ...transactions[1], createdAt: "2026-08-18", packages: [] },
] };

async function mockRealReads(page: Page) {
    await page.route("**/api/me/permissions", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user: null, permissions: { globalRole: "ExternalBroker", assignments: [] } }) }));
    await page.route("**/api/me", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(externalUser) }));
    await page.route("**/api/portal/recapitalization/transactions", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ transactions }) }));
    await page.route("**/api/portal/recapitalization/read-model*", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(readModel) }));
}

async function navigate(page: Page, path: string) {
    await page.goto(path, { waitUntil: "commit", timeout: 60_000 });
    await expect(page.locator("#root")).toBeVisible({ timeout: 30_000 });
}

test("real B2B Overview, Transactions, and Requests render authoritative SQL projections", async ({ page }) => {
    await mockRealReads(page);
    await navigate(page, "/portal");
    const selector = page.getByLabel("Transaction:");
    await expect(selector.getByRole("option", { name: "Project Keystone — REC-2026-00000003" })).toHaveCount(1);
    await expect(selector.getByRole("option", { name: "Project Keystone — REC-2026-00000004" })).toHaveCount(1);
    await expect(selector.getByRole("option", { name: "All TEST-BROKER-ORG Transactions" })).toHaveCount(1);
    await expect(page.getByText("Total Requests")).toBeVisible();
    await expect(page.getByText("Morgan Blake")).toHaveCount(0);
    await expect(page.getByText("Atlas Capital Partners")).toHaveCount(0);

    await navigate(page, "/portal/transactions");
    await expect(page.getByText("REC-2026-00000003", { exact: true })).toBeVisible();
    await expect(page.getByText("REC-2026-00000004", { exact: true })).toBeVisible();
    await expect(page.getByText("No transactions available for your account.")).toHaveCount(0);

    await navigate(page, "/portal/requests");
    await expect(page.getByText("Contracts", { exact: true })).toBeVisible();
    await expect(page.getByText("Rent roll", { exact: true })).toBeVisible();
    await expect(page.locator(".po-status-badge", { hasText: "Submitted" }).first()).toBeVisible();

    await navigate(page, "/portal/requests?transactionId=REC-2026-00000004");
    await expect(page.getByText("Contracts", { exact: true })).toHaveCount(0);
    await expect(page.getByText("No requests match the selected filters.")).toBeVisible();
});

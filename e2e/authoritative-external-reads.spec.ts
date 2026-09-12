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

const publication = {
    id: "55555555-5555-4555-8555-555555555555", workItemId: "22222222-2222-4222-8222-222222222222",
    publicationNumber: 1, status: "Published", externalOrganizationId: "TEST-BROKER-ORG",
    publishedAt: "2026-09-09T15:00:00Z", partnerActionAt: null, partnerGuidance: null,
    version: "0x0000000000000001", requestId: "DD-2026-00000044", title: "Government correspondence",
    description: "Review government correspondence", transactionId: "REC-2026-00000003",
    transactionName: "Project Keystone", workItemStatus: "Waiting Partner Review",
    artifacts: [{ id: "33333333-3333-4333-8333-333333333333", fileName: "Corp Gov Docs.pptx", contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation" }],
};

async function mockRealReads(page: Page) {
    await page.route("**/api/me/permissions", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user: null, permissions: { globalRole: "ExternalBroker", assignments: [] } }) }));
    await page.route("**/api/me", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(externalUser) }));
    await page.route("**/api/portal/recapitalization/transactions", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ transactions }) }));
    await page.route("**/api/portal/recapitalization/read-model*", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(readModel) }));
    await page.route("**/api/portal/recapitalization/publications", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ publications: [publication] }) }));
    await page.route(`**/api/portal/recapitalization/publications/${publication.id}`, route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ publication }) }));
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
    await expect(page.getByText("Government correspondence", { exact: true })).toBeVisible();

    await navigate(page, "/portal/requests?transactionId=REC-2026-00000004");
    await expect(page.getByText("Contracts", { exact: true })).toHaveCount(0);
    await expect(page.getByText("No requests match the selected filters.")).toBeVisible();
});

for (const action of ["approve", "rework"] as const) {
    test(`0178 opens from real Requests with two edition documents and supports ${action}`, async ({ page }) => {
        await mockRealReads(page);
        let current = { ...publication, requestId: "DD-2026-00000178", transactionName: "Project Liberty",
            title: "Confirm LTC and its subsidiaries have no lease or other contractual arrangement with the proposed EIK or affiliates.",
            responseContent: "", responseSnapshotAvailable: false,
            artifacts: [
                { id: "33333333-3333-4333-8333-333333333333", fileName: "RFF_Cert_2027.pdf", contentType: "application/pdf" },
                { id: "44444444-4444-4444-8444-444444444444", fileName: "State Survey Report.docx", contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
            ],
        };
        await page.route("**/api/portal/recapitalization/publications", route => route.fulfill({ json: { publications: [current] } }));
        await page.route(`**/api/portal/recapitalization/publications/${publication.id}`, route => route.fulfill({ json: { publication: current } }));
        await page.route("**/api/portal/recapitalization/publications/*/artifacts/*/content", route => route.fulfill({
            body: "published document bytes", headers: { "content-type": "application/pdf", "content-disposition": 'attachment; filename="RFF_Cert_2027.pdf"' },
        }));
        const decisions: unknown[] = [];
        await page.route("**/api/portal/recapitalization/publications/*/decision", async route => {
            const body = route.request().postDataJSON(); decisions.push(body);
            expect(body).toEqual(action === "approve" ? { action, expectedVersion: publication.version }
                : { action, guidance: "Revise the findings", expectedVersion: publication.version });
            current = { ...current, status: action === "approve" ? "Approved" : "Rework Requested",
                workItemStatus: action === "approve" ? "Completed" : "In Progress", version: "0x0000000000000002" };
            await route.fulfill({ json: { publication: current } });
        });
        await navigate(page, "/portal/requests");
        await page.getByRole("button", { name: "Open DD-2026-00000178 · Publication 1" }).click();
        await expect(page.getByRole("heading", { name: /DD-2026-00000178/ })).toBeVisible();
        await expect(page.getByText("A response snapshot was not recorded for this edition. Current draft findings are not shown.")).toBeVisible();
        await expect(page.getByRole("button", { name: "Download State Survey Report.docx" })).toBeVisible();
        const download = page.waitForEvent("download");
        await page.getByRole("button", { name: "Download RFF_Cert_2027.pdf" }).click();
        expect((await download).suggestedFilename()).toBe("RFF_Cert_2027.pdf");
        if (action === "approve") await page.getByRole("button", { name: "Approve", exact: true }).click();
        else {
            await page.getByRole("button", { name: "Request Rework", exact: true }).click();
            const dialog = page.getByRole("dialog", { name: "Request Rework?" });
            await dialog.getByLabel("Rework guidance").fill("Revise the findings");
            await dialog.getByRole("button", { name: "Request Rework", exact: true }).click();
        }
        await expect(page.getByText(action === "approve" ? "Approved — Complete" : "Rework requested — awaiting a new publication", { exact: true })).toBeVisible();
        expect(decisions).toHaveLength(1);
        await expect(page.getByRole("button", { name: "Approve", exact: true })).toHaveCount(0);
        await expect(page.getByText("A response snapshot was not recorded for this edition. Current draft findings are not shown.")).toBeVisible();
    });
}

test("real external publication errors and cross-org absence never fall back to demo", async ({ page }) => {
    await mockRealReads(page);
    await page.route("**/api/portal/recapitalization/publications", route => route.fulfill({ json: { publications: [] } }));
    await page.route(`**/api/portal/recapitalization/publications/${publication.id}`, route => route.fulfill({ status: 404, json: { error: "Publication not found" } }));
    await navigate(page, `/portal/publications/${publication.id}?organizationId=TEST-BROKER-ORG`);
    await expect(page.getByRole("alert")).toContainText("Publication not found");
    await expect(page.getByText("Atlas Capital Partners")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Approve", exact: true })).toHaveCount(0);
});

test("an internal demo persona cannot load a live publication", async ({ page }) => {
    await mockRealReads(page);
    await page.route("**/api/me", route => route.fulfill({ json: { ...externalUser,
        userRecord: { ...externalUser.userRecord, role: "PlatformAdmin" }, portalRole: null, isPortalUser: false, externalContext: null,
    } }));
    let requests = 0;
    await page.route(`**/api/portal/recapitalization/publications/${publication.id}`, route => { requests++; return route.fulfill({ status: 403 }); });
    await navigate(page, `/portal/publications/${publication.id}`);
    await expect(page.getByRole("heading", { name: "External account required" })).toBeVisible();
    await expect(page.locator(".portal-preview-banner")).toContainText("Switching demo personas does not grant access");
    expect(requests).toBe(0);
});

test("stale partner decision stays on the edition and offers a refresh", async ({ page }) => {
    await mockRealReads(page);
    let decisions = 0;
    await page.route("**/api/portal/recapitalization/publications/*/decision", route => {
        decisions++;
        return route.fulfill({ status: 409, json: { error: "Partner action cannot be applied or is stale" } });
    });
    await navigate(page, `/portal/publications/${publication.id}`);
    await page.getByRole("button", { name: "Approve", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Partner action cannot be applied or is stale");
    await expect(page.getByRole("button", { name: "Refresh publication" })).toBeEnabled();
    await expect(page.getByText("Approved — Complete", { exact: true })).toHaveCount(0);
    await page.route(`**/api/portal/recapitalization/publications/${publication.id}`, route => route.fulfill({ json: {
        publication: { ...publication, status: "Approved", version: "0x0000000000000002" },
    } }));
    await page.getByRole("button", { name: "Refresh publication" }).click();
    await expect(page.getByText("Approved — Complete", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Approve", exact: true })).toHaveCount(0);
    expect(decisions).toBe(1);
});

for (const findings of ["Immutable edition findings", ""]) {
    test(`a new edition distinguishes captured ${findings ? "findings" : "blank findings"} from legacy absence`, async ({ page }) => {
        await mockRealReads(page);
        await page.route(`**/api/portal/recapitalization/publications/${publication.id}`, route => route.fulfill({ json: {
            publication: { ...publication, responseSnapshotAvailable: true, responseContent: findings },
        } }));
        await navigate(page, `/portal/publications/${publication.id}`);
        await expect(page.getByText(findings || "No response was included in this edition.", { exact: true })).toBeVisible();
        await expect(page.getByText(/A response snapshot was not recorded/)).toHaveCount(0);
    });
}

test("authoritative published request supports server-backed partner review without exposing Graph identity", async ({ page }) => {
    await mockRealReads(page);
    const decisions: Record<string, unknown>[] = [];
    await page.route("**/api/portal/recapitalization/publications/*/decision", async route => {
        decisions.push(JSON.parse(route.request().postData() || "{}"));
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ publication: { ...publication, status: "Rework Requested", partnerGuidance: "Revise section 4" } }) });
    });
    await navigate(page, `/portal/requests/${publication.workItemId}`);
    await expect(page.getByText("Corp Gov Docs.pptx")).toBeVisible();
    await expect(page.getByText("knowledge-drive")).toHaveCount(0);
    await page.getByRole("button", { name: "Request Rework" }).click();
    const dialog = page.getByRole("dialog", { name: "Request Rework?" });
    await dialog.getByLabel("Rework guidance").fill("Revise section 4");
    await dialog.getByRole("button", { name: "Request Rework" }).click();
    await expect.poll(() => decisions.length).toBe(1);
    expect(decisions[0]).toEqual({ action: "rework", guidance: "Revise section 4", expectedVersion: publication.version });
});

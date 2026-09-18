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
const entraChallenge = "https://login.microsoftonline.com/example/oauth2/v2.0/authorize";

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

test("long request titles expand in place and review guidance stays on demand", async ({ page }) => {
    await mockRealReads(page);
    await page.setViewportSize({ width: 480, height: 900 });
    const title = "Confirm all lease, operating, financing, management, and other contractual arrangements with proposed partners and affiliated entities across the transaction, including amendments and side letters.";
    await page.route(`**/api/portal/recapitalization/publications/${publication.id}`, route => route.fulfill({ json: { publication: { ...publication, title } } }));
    await navigate(page, `/portal/publications/${publication.id}`);
    const heading = page.getByRole("heading", { name: title, exact: true });
    await expect(heading).toBeVisible();
    const expand = page.getByRole("button", { name: "Show full request" });
    await expect(expand).toHaveAttribute("aria-expanded", "false");
    const collapsedHeight = await heading.evaluate(element => element.clientHeight);
    await expand.click();
    await expect(page.getByRole("button", { name: "Show less" })).toHaveAttribute("aria-expanded", "true");
    expect(await heading.evaluate(element => element.clientHeight)).toBeGreaterThan(collapsedHeight);
    await page.getByRole("button", { name: "Show less" }).click();
    await expect(page.getByRole("button", { name: "Show full request" })).toHaveAttribute("aria-expanded", "false");
    const help = page.getByRole("button", { name: "What do I do next?" });
    await expect(help).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByText("Review the supporting documents. Approve the request if everything looks complete, or request changes if IntegraCare needs to update something.")).toHaveCount(0);
    await help.click();
    await expect(help).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByText("Review the supporting documents. Approve the request if everything looks complete, or request changes if IntegraCare needs to update something.")).toBeVisible();
});

test("real external Overview shows the clean Submitted Requests grid and publication-bound actions", async ({ page }) => {
    await mockRealReads(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    const multi = { ...publication, responseSnapshotAvailable: false, responseContent: null, artifacts: [
        { id: "pdf-one", fileName: "First.pdf", contentType: "application/pdf" },
        { id: "pdf-two", fileName: "Second.pdf", contentType: "application/pdf" },
        { id: "office", fileName: "Workbook.xlsx", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
    ] };
    await page.route("**/api/portal/recapitalization/publications", route => route.fulfill({ json: { publications: [multi] } }));
    await page.route(`**/api/portal/recapitalization/publications/${publication.id}`, route => route.fulfill({ json: { publication: multi } }));
    await page.route("**/api/portal/recapitalization/publications/*/artifacts/*/content", route => route.fulfill({ body: "edition bytes", headers: { "content-type": "application/pdf" } }));
    await navigate(page, "/portal");
    const grid = page.locator(".po-external-overview .po-dashboard-grid .po-requests-table");
    await expect(grid).toBeVisible();
    await expect(grid.locator(".po-requests-header")).toHaveText(/ID\s*Request\s*Project\s*Status\s*Category\s*Updated\s*Actions/);
    await expect(grid.locator(".po-requests-header")).not.toContainText("Review Type");
    await expect(grid.locator(".po-requests-header")).not.toContainText("Community");
    const row = grid.locator(".po-requests-row").filter({ hasText: publication.requestId.split("-").at(-1)! });
    await expect(row).toContainText("Government correspondence");
    await expect(row.getByRole("button", { name: `Preview documents for ${publication.requestId}` })).toBeVisible();
    await expect(row.getByRole("button", { name: `Download documents for ${publication.requestId}` })).toBeVisible();
    const openRequest = row.getByRole("button", { name: `Open request ${publication.requestId}`, exact: false });
    await expect(openRequest).toBeVisible();
    const tableBounds = await grid.boundingBox();
    const openBounds = await openRequest.boundingBox();
    expect(tableBounds).not.toBeNull();
    expect(openBounds).not.toBeNull();
    expect(openBounds!.x + openBounds!.width).toBeLessThanOrEqual(tableBounds!.x + tableBounds!.width);
    expect(await page.locator(".po-external-overview .po-requests-scroll").evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await expect(row.getByRole("button", { name: "Approve Request" })).toHaveCount(0);

    await row.getByRole("button", { name: `Preview documents for ${publication.requestId}` }).click();
    const previewChooser = page.getByRole("dialog", { name: `Preview documents for ${publication.requestId}` });
    await expect(previewChooser.getByRole("button", { name: "First.pdf Preview" })).toBeVisible();
    await expect(previewChooser.getByRole("button", { name: "Second.pdf Preview" })).toBeVisible();
    await expect(previewChooser.getByText("Workbook.xlsx")).toHaveCount(0);
    const previewRequest = page.waitForRequest(request => request.url().endsWith(`/publications/${publication.id}/artifacts/pdf-two/content`));
    await previewChooser.getByRole("button", { name: "Second.pdf Preview" }).click();
    await previewRequest;
    const preview = page.getByRole("dialog", { name: "Preview Second.pdf" });
    await expect(preview).toBeVisible();
    await preview.getByRole("button", { name: "Close" }).click();

    await row.getByRole("button", { name: `Download documents for ${publication.requestId}` }).click();
    const downloadChooser = page.getByRole("dialog", { name: `Download documents for ${publication.requestId}` });
    await expect(downloadChooser.getByRole("button", { name: "Workbook.xlsx Download" })).toBeVisible();
    const download = page.waitForEvent("download");
    await downloadChooser.getByRole("button", { name: "Workbook.xlsx Download" }).click();
    expect((await download).suggestedFilename()).toBe("Workbook.xlsx");
    await downloadChooser.getByRole("button", { name: "Close" }).click();

    await row.getByRole("button", { name: `Open request ${publication.requestId}`, exact: false }).click();
    await expect(page).toHaveURL(new RegExp(`/portal/publications/${publication.id}$`));
    await expect(page.getByRole("heading", { name: publication.title, exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Supporting Documents" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Approve Request" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Request Changes" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Show response" })).toBeVisible();
    await expect(page.getByText("This earlier request does not include a saved response. Please review the supporting documents below.")).toBeHidden();
    await page.getByRole("button", { name: "What do I do next?" }).click();
    await expect(page.getByText("Review the supporting documents. Approve the request if everything looks complete, or request changes if IntegraCare needs to update something.")).toBeVisible();
});

test("grid chooses among multiple previewable edition documents without opening the request", async ({ page }) => {
    await mockRealReads(page);
    const multi = { ...publication, artifacts: [
        { id: "pdf-one", fileName: "First.pdf", contentType: "application/pdf" },
        { id: "pdf-two", fileName: "Second.pdf", contentType: "application/pdf" },
        { id: "office", fileName: "Workbook.xlsx", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
    ] };
    await page.route("**/api/portal/recapitalization/publications", route => route.fulfill({ json: { publications: [multi] } }));
    await page.route("**/api/portal/recapitalization/publications/*/artifacts/*/content", route => route.fulfill({ body: "edition bytes", headers: { "content-type": "application/pdf" } }));
    await navigate(page, "/portal/requests");
    await page.getByRole("button", { name: `Preview documents for ${publication.requestId}` }).click();
    const chooser = page.getByRole("dialog", { name: `Preview documents for ${publication.requestId}` });
    await expect(chooser.getByRole("button", { name: "First.pdf Preview" })).toBeVisible();
    await expect(chooser.getByRole("button", { name: "Second.pdf Preview" })).toBeVisible();
    await expect(chooser.getByText("Workbook.xlsx")).toHaveCount(0);
    await chooser.getByRole("button", { name: "Second.pdf Preview" }).click();
    await expect(page.getByRole("dialog", { name: "Preview Second.pdf" })).toBeVisible();
    await page.getByRole("dialog", { name: "Preview Second.pdf" }).getByRole("button", { name: "Close" }).click();
    await expect(page).toHaveURL(/\/portal\/requests$/);
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
                workItemStatus: action === "approve" ? "Completed" : "Returned for Changes", version: "0x0000000000000002" };
            await route.fulfill({ json: { publication: current } });
        });
        await navigate(page, "/portal/requests");
        await expect(page.getByText("Review Type", { exact: true })).toHaveCount(0);
        await expect(page.getByText("Documents", { exact: true })).toHaveCount(0);
        await expect(page.getByRole("button", { name: "Preview documents for DD-2026-00000178" })).toBeVisible();
        await expect(page.getByRole("button", { name: "Download documents for DD-2026-00000178" })).toBeVisible();
        const gridPreviewRequest = page.waitForRequest(request => request.url().endsWith(`/artifacts/${current.artifacts[0].id}/content`));
        await page.getByRole("button", { name: "Preview documents for DD-2026-00000178" }).click();
        await gridPreviewRequest;
        const gridPreview = page.getByRole("dialog", { name: "Preview RFF_Cert_2027.pdf" });
        await expect(gridPreview).toBeVisible();
        await gridPreview.getByRole("button", { name: "Close" }).click();
        await page.getByRole("button", { name: "Download documents for DD-2026-00000178" }).click();
        const chooser = page.getByRole("dialog", { name: "Download documents for DD-2026-00000178" });
        await expect(chooser.getByRole("button", { name: "State Survey Report.docx Download" })).toBeVisible();
        const gridDownload = page.waitForEvent("download");
        await chooser.getByRole("button", { name: "State Survey Report.docx Download" }).click();
        expect((await gridDownload).suggestedFilename()).toBe("State Survey Report.docx");
        await chooser.getByRole("button", { name: "Close" }).click();
        await expect(page).toHaveURL(/\/portal\/requests$/);
        await page.getByRole("button", { name: "Open request DD-2026-00000178", exact: false }).click();
        await expect(page.getByRole("heading", { name: current.title, exact: true })).toBeVisible();
        await expect(page.locator(".apd-meta")).toContainText("Project Liberty");
        await expect(page.locator(".apd-meta")).toContainText("DD-2026-00000178");
        await expect(page.locator(".apd-review-header .po-status-badge")).toHaveText("Awaiting Your Review");
        await expect(page.getByRole("heading", { name: "IntegraCare Response", exact: true })).toBeVisible();
        await expect(page.getByRole("heading", { name: "Supporting Documents", exact: true })).toBeVisible();
        await expect(page.getByText("No response provided", { exact: true })).toBeVisible();
        await expect(page.getByText("This earlier request does not include a saved response. Please review the supporting documents below.")).toBeHidden();
        await page.getByRole("button", { name: "Show response" }).click();
        await expect(page.getByText("This earlier request does not include a saved response. Please review the supporting documents below.")).toBeVisible();
        const docx = page.locator(".apd-document").filter({ hasText: "State Survey Report.docx" });
        const pdf = page.locator(".apd-document").filter({ hasText: "RFF_Cert_2027.pdf" });
        await expect(docx.getByRole("button", { name: "Download State Survey Report.docx" })).toBeVisible();
        await expect(docx.getByRole("button", { name: "Preview" })).toHaveCount(0);
        await expect(pdf.getByRole("button", { name: "Preview" })).toBeVisible();
        const previewRequest = page.waitForRequest(request => request.url().endsWith(`/artifacts/${current.artifacts[0].id}/content`));
        await pdf.getByRole("button", { name: "Preview" }).click();
        await previewRequest;
        const previewDialog = page.getByRole("dialog", { name: "Preview RFF_Cert_2027.pdf" });
        await expect(previewDialog.getByTitle("RFF_Cert_2027.pdf")).toBeVisible();
        await previewDialog.getByRole("button", { name: "Close" }).click();
        await expect(previewDialog).toHaveCount(0);
        await expect(page.locator(".apd-decision").getByRole("heading", { name: "Your Decision" })).toBeVisible();
        await expect(page.locator(".apd-decision").getByRole("button", { name: "Approve Request" })).toBeVisible();
        const download = page.waitForEvent("download");
        await pdf.getByRole("button", { name: "Download RFF_Cert_2027.pdf" }).click();
        expect((await download).suggestedFilename()).toBe("RFF_Cert_2027.pdf");
        if (action === "approve") await page.getByRole("button", { name: "Approve Request", exact: true }).click();
        else {
            await page.getByRole("button", { name: "Request Changes", exact: true }).click();
            const dialog = page.getByRole("dialog", { name: "Request Changes" });
            await dialog.getByLabel("Rework guidance").fill("Revise the findings");
            await dialog.getByRole("button", { name: "Request Changes", exact: true }).click();
        }
        await expect(page.locator(".apd-complete").getByText(action === "approve" ? "Review complete" : "Changes requested", { exact: true })).toBeVisible();
        expect(decisions).toHaveLength(1);
        await expect(page.getByRole("button", { name: "Approve Request", exact: true })).toHaveCount(0);
        await expect(page.getByText("No response provided", { exact: true })).toBeVisible();
    });
}

test("real external publication errors and cross-org absence never fall back to demo", async ({ page }) => {
    await mockRealReads(page);
    await page.route("**/api/portal/recapitalization/publications", route => route.fulfill({ json: { publications: [] } }));
    await page.route(`**/api/portal/recapitalization/publications/${publication.id}`, route => route.fulfill({ status: 404, json: { error: "Publication not found" } }));
    await navigate(page, `/portal/publications/${publication.id}?organizationId=TEST-BROKER-ORG`);
    await expect(page.getByRole("alert")).toContainText("Publication not found");
    await expect(page.getByText("Atlas Capital Partners")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Approve Request", exact: true })).toHaveCount(0);
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
    await page.getByRole("button", { name: "Approve Request", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Partner action cannot be applied or is stale");
    await expect(page.getByRole("button", { name: "Refresh request" })).toBeEnabled();
    await expect(page.locator(".apd-complete").getByText("Review complete", { exact: true })).toHaveCount(0);
    await page.route(`**/api/portal/recapitalization/publications/${publication.id}`, route => route.fulfill({ json: {
        publication: { ...publication, status: "Approved", version: "0x0000000000000002" },
    } }));
    await page.getByRole("button", { name: "Refresh request" }).click();
    await expect(page.locator(".apd-complete").getByText("Review complete", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Approve Request", exact: true })).toHaveCount(0);
    expect(decisions).toBe(1);
});

for (const action of ["approve", "rework"] as const) {
    test(`expired external session restores the same publication before ${action} without replaying a decision`, async ({ page }) => {
        await mockRealReads(page);
        const path = `/portal/publications/${publication.id}`;
        const currentVersion = "0x0000000000000002";
        let detailReads = 0;
        let signIns = 0;
        const decisions: Record<string, unknown>[] = [];
        let status = "Published";
        await page.route(`**/api/portal/recapitalization/publications/${publication.id}`, route => {
            detailReads++;
            if (detailReads === 1) return route.fulfill({ status: 302, headers: { location: entraChallenge } });
            return route.fulfill({ json: { publication: { ...publication, status, version: currentVersion } } });
        });
        await page.route("**/.auth/login/aad?*", route => {
            signIns++;
            const returnRoute = new URL(route.request().url()).searchParams.get("post_login_redirect_uri");
            expect(returnRoute).toBe(path);
            return route.fulfill({ status: 302, headers: { location: returnRoute! } });
        });
        await page.route("**/api/portal/recapitalization/publications/*/decision", route => {
            const body = JSON.parse(route.request().postData() || "{}");
            decisions.push(body);
            expect(body.expectedVersion).toBe(currentVersion);
            status = action === "approve" ? "Approved" : "Rework Requested";
            return route.fulfill({ json: { publication: { ...publication, status, version: "0x0000000000000003" } } });
        });
        await navigate(page, path);
        await expect(page.getByRole("heading", { name: publication.title })).toBeVisible();
        await expect(page.getByRole("button", { name: "Refresh request" })).toHaveCount(0);
        expect(signIns).toBe(1);
        if (action === "approve") await page.getByRole("button", { name: "Approve Request" }).click();
        else {
            await page.getByRole("button", { name: "Request Changes" }).click();
            const dialog = page.getByRole("dialog", { name: "Request Changes" });
            await dialog.getByLabel("Rework guidance").fill("Revise section 4");
            await dialog.getByRole("button", { name: "Request Changes" }).click();
        }
        await expect(page.locator(".apd-complete")).toContainText(action === "approve" ? "Review complete" : "Changes requested");
        expect(decisions).toEqual([{ action, ...(action === "rework" ? { guidance: "Revise section 4" } : {}), expectedVersion: currentVersion }]);
        expect(signIns).toBe(1);
    });
}

test("a lost decision response reloads authoritative state instead of repeating the POST", async ({ page }) => {
    await mockRealReads(page);
    let status = "Published";
    let decisions = 0;
    await page.route(`**/api/portal/recapitalization/publications/${publication.id}`, route =>
        route.fulfill({ json: { publication: { ...publication, status } } }));
    await page.route("**/api/portal/recapitalization/publications/*/decision", route => {
        decisions++;
        status = "Approved";
        return route.abort("failed");
    });
    await navigate(page, `/portal/publications/${publication.id}`);
    await page.getByRole("button", { name: "Approve Request" }).click();
    await expect(page.locator(".apd-complete")).toContainText("Review complete");
    expect(decisions).toBe(1);
    await expect(page.getByRole("button", { name: "Approve Request" })).toHaveCount(0);
});

test("an unverifiable decision outcome hides decision controls until authoritative state can be read", async ({ page }) => {
    await mockRealReads(page);
    let detailReads = 0;
    let decisions = 0;
    let decisionAttempted = false;
    await page.route(`**/api/portal/recapitalization/publications/${publication.id}`, route => {
        detailReads++;
        return decisionAttempted ? route.abort("failed") : route.fulfill({ json: { publication } });
    });
    await page.route("**/api/portal/recapitalization/publications/*/decision", route => {
        decisions++;
        decisionAttempted = true;
        return route.abort("failed");
    });
    await navigate(page, `/portal/publications/${publication.id}`);
    await page.getByRole("button", { name: "Approve Request" }).click();
    await expect(page.getByRole("alert")).toContainText("Failed to fetch");
    await expect(page.getByRole("button", { name: "Approve Request" })).toHaveCount(0);
    expect(detailReads).toBeGreaterThanOrEqual(2);
    expect(decisions).toBe(1);
});

test("a decision redirect reauthenticates and reads the outcome without replaying the POST", async ({ page }) => {
    await mockRealReads(page);
    const path = `/portal/publications/${publication.id}`;
    let status = "Published";
    let decisions = 0;
    let signIns = 0;
    await page.route(`**/api/portal/recapitalization/publications/${publication.id}`, route =>
        route.fulfill({ json: { publication: { ...publication, status } } }));
    await page.route("**/.auth/login/aad?*", route => {
        signIns++;
        expect(new URL(route.request().url()).searchParams.get("post_login_redirect_uri")).toBe(path);
        return route.fulfill({ status: 302, headers: { location: path } });
    });
    await page.route("**/api/portal/recapitalization/publications/*/decision", route => {
        decisions++;
        status = "Rework Requested";
        return route.fulfill({ status: 302, headers: { location: entraChallenge } });
    });
    await navigate(page, path);
    await page.getByRole("button", { name: "Request Changes" }).click();
    const dialog = page.getByRole("dialog", { name: "Request Changes" });
    await dialog.getByLabel("Rework guidance").fill("Revise section 4");
    await dialog.getByRole("button", { name: "Request Changes" }).click();
    await expect(page.locator(".apd-complete")).toContainText("Changes requested");
    expect(signIns).toBe(1);
    expect(decisions).toBe(1);
    await expect(page.getByRole("button", { name: "Request Changes" })).toHaveCount(0);
});

test("an initial current-user challenge returns to the intended publication route", async ({ page }) => {
    await mockRealReads(page);
    const path = `/portal/publications/${publication.id}`;
    let identityReads = 0;
    let signIns = 0;
    await page.route("**/api/me", route => {
        identityReads++;
        if (identityReads === 1) return route.fulfill({ status: 302, headers: { location: entraChallenge } });
        return route.fulfill({ json: externalUser });
    });
    await page.route("**/.auth/login/aad?*", route => {
        signIns++;
        expect(new URL(route.request().url()).searchParams.get("post_login_redirect_uri")).toBe(path);
        return route.fulfill({ status: 302, headers: { location: path } });
    });
    await navigate(page, path);
    await expect(page.getByRole("heading", { name: publication.title })).toBeVisible();
    expect(signIns).toBe(1);
    expect(identityReads).toBeGreaterThanOrEqual(2);
    await expect(page.getByRole("button", { name: "Refresh request" })).toHaveCount(0);
});

test("a repeated auth challenge stops the loop and offers sign-in rather than Refresh request", async ({ page }) => {
    await mockRealReads(page);
    const path = `/portal/publications/${publication.id}`;
    let signIns = 0;
    await page.route(`**/api/portal/recapitalization/publications/${publication.id}`, route =>
        route.fulfill({ status: 302, headers: { location: entraChallenge } }));
    await page.route("**/.auth/login/aad?*", route => {
        signIns++;
        return route.fulfill({ status: 302, headers: { location: path } });
    });
    await navigate(page, path);
    await expect(page.getByRole("alert")).toContainText("Your session could not be restored. Please sign in again.");
    await expect(page.getByRole("button", { name: "Refresh request" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Sign in again" })).toHaveAttribute("href", `/.auth/login/aad?post_login_redirect_uri=${encodeURIComponent(path)}`);
    expect(signIns).toBe(1);
});

for (const findings of ["Immutable edition findings", ""]) {
    test(`a new edition distinguishes captured ${findings ? "findings" : "blank findings"} from legacy absence`, async ({ page }) => {
        await mockRealReads(page);
        await page.route(`**/api/portal/recapitalization/publications/${publication.id}`, route => route.fulfill({ json: {
            publication: { ...publication, responseSnapshotAvailable: true, responseContent: findings },
        } }));
        await navigate(page, `/portal/publications/${publication.id}`);
        if (findings) await expect(page.getByText(findings, { exact: true })).toBeVisible();
        else {
            await expect(page.getByText("No response was included.", { exact: true })).toBeHidden();
            await page.getByRole("button", { name: "Show response" }).click();
            await expect(page.getByText("No response was included.", { exact: true })).toBeVisible();
        }
        await expect(page.getByText(/A saved response is not available/)).toHaveCount(0);
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
    await page.getByRole("button", { name: "Request Changes" }).click();
    const dialog = page.getByRole("dialog", { name: "Request Changes" });
    await dialog.getByLabel("Rework guidance").fill("Revise section 4");
    await dialog.getByRole("button", { name: "Request Changes" }).click();
    await expect.poll(() => decisions.length).toBe(1);
    expect(decisions[0]).toEqual({ action: "rework", guidance: "Revise section 4", expectedVersion: publication.version });
});

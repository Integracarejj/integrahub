import { expect, Page, test } from "@playwright/test";
import { mockAuth, PREVIEW_USER } from "./helpers/auth";

const INTAKE_ID = "11111111-1111-4111-8111-111111111111";
const WORK_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";

test("authoritative admission, assignment, and acceptance survive isolated browser sessions", async ({ browser }) => {
    let item: Record<string, unknown> | null = null;
    const assignee = { id: USER_ID, displayName: "Durable Contributor", email: "durable@integracare.com", role: "Contributor" };
    const projection = () => ({
        workItemId: WORK_ID, intakeRequestId: INTAKE_ID, requestNumber: "DD-2026-000001", status: "Queued",
        assignedUserId: null, assignedUserName: null, assignedUserEmail: null, team: "Financial",
        priority: "High", dueDate: "2026-09-15", title: "Durable Keystone Request",
        description: "Authoritative cross-session request", category: "Financial", communities: ["Keystone"],
        needsReassignment: false, misassignedReason: null, packageId: "44444444-4444-4444-8444-444444444444",
        sourcePackageId: "pkg-keystone", packageName: "Keystone Intake", originalFileName: "keystone.xlsx",
        externalOrganizationId: "TEST-BROKER-ORG", businessTransactionId: "REC-2026-00000004",
        transactionName: "Project Keystone", admittedAt: "2026-08-19T12:00:00.000Z",
        assignedAt: null, acceptedAt: null,
        capabilities: { canAssign: true, canAccept: false, canMarkNotMine: false, canReassign: true,
            canClarify: false, canBlock: false, canComplete: false, canPublish: false,
            canMarkDuplicate: false, canMarkNotApplicable: false },
    });

    async function setup(page: Page, userId = PREVIEW_USER.userRecord.id) {
        await mockAuth(page);
        await page.route("**/api/me", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
            ...PREVIEW_USER, userRecord: { ...PREVIEW_USER.userRecord, id: userId, displayName: userId === USER_ID ? "Durable Contributor" : "E2E Preview Admin" },
        }) }));
        await page.route("**/api/recapitalization/intake", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ packages: [{
            id: "44444444-4444-4444-8444-444444444444", sourcePackageId: "pkg-keystone", packageName: "Keystone Intake",
            fileName: "keystone.xlsx", requestCount: 1, status: item ? "Converted" : "Awaiting Review",
            submittedBy: "55555555-5555-4555-8555-555555555555", submittedByName: "Real Broker",
            externalOrganizationId: "TEST-BROKER-ORG", submittedAt: "2026-08-19T11:00:00.000Z",
            transactionId: "66666666-6666-4666-8666-666666666666", transactionName: "Project Keystone",
            requests: [{ intakeRequestId: INTAKE_ID, rowNumber: 1, category: "Financial", title: "Durable Keystone Request",
                description: "Authoritative cross-session request", team: "Financial", owner: null, priority: "High",
                dueDate: "2026-09-15", communityNames: ["Keystone"] }],
        }] }) }));
        const handleWorkItems = async (route: Parameters<Parameters<Page["route"]>[1]>[0]) => {
            const url = route.request().url();
            const method = route.request().method();
            if (method === "POST" && url.endsWith("/admit")) item = projection();
            if (method === "POST" && url.endsWith("/assign")) item = { ...(item || projection()), status: "Assigned", assignedUserId: USER_ID, assignedUserName: "Durable Contributor", assignedUserEmail: assignee.email, assignedAt: "2026-08-19T12:05:00.000Z", capabilities: { ...(projection().capabilities as object), canAccept: true, canMarkNotMine: true } };
            if (method === "POST" && url.endsWith("/accept")) item = { ...(item || projection()), status: "In Progress", acceptedAt: "2026-08-19T12:10:00.000Z" };
            const body = url.endsWith("/admit") ? { workItems: item ? [item] : [] }
                : method === "GET" ? { workItems: item ? [item] : [], assignees: [assignee] }
                    : { workItem: item };
            await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
        };
        await page.route("**/api/recapitalization/work-items", handleWorkItems);
        await page.route("**/api/recapitalization/work-items/**", handleWorkItems);
    }

    const intakeContext = await browser.newContext();
    const intakePage = await intakeContext.newPage();
    await setup(intakePage);
    await intakePage.goto("/recapitalization/intake");
    await expect(intakePage.getByRole("heading", { name: "Intake Queue" })).toBeVisible();
    await intakePage.evaluate(async intakeRequestId => {
        await fetch("/api/recapitalization/work-items/admit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ intakeRequestIds: [intakeRequestId] }) });
    }, INTAKE_ID);
    await intakeContext.close();

    const queueContext = await browser.newContext();
    const queuePage = await queueContext.newPage();
    await setup(queuePage);
    await queuePage.goto("/recapitalization/tracker");
    const row = queuePage.getByRole("row").filter({ hasText: "DD-2026-000001" });
    await expect(row).toContainText("Durable Keystone Request");
    await row.locator("select").last().selectOption(USER_ID);
    await queuePage.getByRole("button", { name: "Assign", exact: true }).click();
    await expect(row).toContainText("Durable Contributor");
    await queueContext.close();

    const contributorContext = await browser.newContext();
    const contributorPage = await contributorContext.newPage();
    await setup(contributorPage, USER_ID);
    await contributorPage.goto("/recapitalization/my-work");
    await expect(contributorPage.getByText("DD-2026-000001").first()).toBeVisible();
    await contributorPage.getByText("DD-2026-000001").first().click();
    await contributorPage.getByText("Accept Work", { exact: true }).click();
    await expect(contributorPage.getByText("In Progress", { exact: true }).first()).toBeVisible();
    await contributorContext.close();

    const freshContext = await browser.newContext();
    const freshPage = await freshContext.newPage();
    await setup(freshPage, USER_ID);
    await freshPage.goto("/recapitalization/my-work");
    const persistedRow = freshPage.getByRole("row").filter({ hasText: "DD-2026-000001" });
    await expect(persistedRow).toContainText("In Progress");
    await freshContext.close();
});

import { expect, type Page, test } from "@playwright/test";
import { mockAuth, PREVIEW_USER } from "./helpers/auth";

const WORK_ID = "22222222-2222-4222-8222-222222222222";
const OWNER_ID = "33333333-3333-4333-8333-333333333333";
const ADMIN_ID = PREVIEW_USER.userRecord.id;

test("internal response, notes, blockers, review, and dispositions are authoritative across sessions", async ({ browser }) => {
    let version = 1;
    let state = "In Progress";
    let responseContent: string | null = null;
    let activeReasonType: string | null = null;
    let activeReason: string | null = null;
    let proposedDisposition: string | null = null;
    let dispositionReason: string | null = null;
    const notes: Record<string, unknown>[] = [];
    const events: Record<string, unknown>[] = [];
    const artifacts: Record<string, unknown>[] = [];
    const versionsUsed: string[] = [];
    const currentVersion = () => `0x${version.toString(16).padStart(16, "0")}`;
    const advance = () => { version += 1; };

    const project = (userId: string) => {
        const owner = userId === OWNER_ID;
        const operations = userId === ADMIN_ID;
        return {
            workItemId: WORK_ID, intakeRequestId: "11111111-1111-4111-8111-111111111111", requestNumber: "DD-2026-2B",
            status: state, assignedUserId: OWNER_ID, assignedUserName: "Durable Contributor", assignedUserEmail: "owner@example.com",
            team: "Financial", priority: "High", dueDate: "2026-09-20", title: "Authoritative 2B Request",
            description: "Exercise internal authoritative workflow", category: "Financial", communities: ["Keystone"],
            needsReassignment: false, misassignedReason: null, packageId: "44444444-4444-4444-8444-444444444444",
            sourcePackageId: "source", packageName: "Package", originalFileName: "source.xlsx", externalOrganizationId: "org",
            businessTransactionId: "txn", transactionName: "Project Keystone", admittedAt: "2026-09-03T12:00:00Z",
            assignedAt: "2026-09-03T12:05:00Z", acceptedAt: "2026-09-03T12:10:00Z", updatedAt: "2026-09-03T12:10:00Z",
            version: currentVersion(), responseContent, responseUpdatedAt: responseContent ? "2026-09-03T13:00:00Z" : null,
            responseUpdatedByUserId: responseContent ? OWNER_ID : null, activeReasonType, activeReason,
            proposedDisposition, dispositionReason, dispositionProposedByUserId: proposedDisposition ? OWNER_ID : null,
            dispositionProposedAt: proposedDisposition ? "2026-09-03T14:00:00Z" : null,
            capabilities: {
                canUpdateResponse: owner && state === "In Progress", canBlock: owner && state === "In Progress",
                canClarify: owner && state === "In Progress", canMarkDuplicate: owner && state === "In Progress",
                canMarkNotApplicable: owner && state === "In Progress", canMarkNotMine: owner,
                canSubmitForDdReview: owner && state === "In Progress", canAddWorkNote: owner || operations,
                canResolveClarification: operations && state === "Clarification Needed", canUnblock: operations && state === "Blocked",
                canReviewDisposition: operations && state === "Needs DD Review" && !!proposedDisposition,
                canReturnFromDdReview: operations && state === "Needs DD Review", canMarkReadyToPublish: operations && state === "Needs DD Review",
                canUploadArtifact: owner && state === "In Progress", canViewArtifacts: owner || operations,
            },
        };
    };

    async function setup(page: Page, userId: string) {
        await mockAuth(page);
        await page.addInitScript(() => sessionStorage.removeItem("integrasource.recap.demoPresentation"));
        await page.route("**/api/me", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ...PREVIEW_USER, userRecord: { ...PREVIEW_USER.userRecord, id: userId, displayName: userId === OWNER_ID ? "Durable Contributor" : "E2E Preview Admin" } }) }));
        await page.route("**/api/recapitalization/work-items/**", async route => {
            const url = route.request().url();
            const method = route.request().method();
            if (url.endsWith("/events")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ events }) });
            if (url.endsWith("/notes")) {
                if (method === "POST") notes.push({ id: `n-${notes.length + 1}`, authorUserId: userId, authorName: userId === OWNER_ID ? "Durable Contributor" : "E2E Preview Admin", noteType: "Work Note", noteText: JSON.parse(route.request().postData() || "{}").noteText, createdAt: "2026-09-03T13:10:00Z" });
                return route.fulfill({ status: method === "POST" ? 201 : 200, contentType: "application/json", body: JSON.stringify(method === "POST" ? { note: notes.at(-1) } : { notes }) });
            }
            if (url.endsWith("/artifacts")) {
                if (method === "POST") {
                    const artifact = { id: `artifact-${artifacts.length + 1}`, fileName: decodeURIComponent(route.request().headers()["x-file-name"]), contentType: "text/plain", size: route.request().postDataBuffer()?.length || 0, status: "Uploaded", uploadedBy: userId, uploadedAt: "2026-09-03T13:05:00Z" };
                    artifacts.push(artifact);
                    return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ artifact }) });
                }
                return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ artifacts }) });
            }
            if (url.endsWith("/source-documents")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ documents: [] }) });
            const body = JSON.parse(route.request().postData() || "{}");
            if (method === "POST") {
                versionsUsed.push(body.expectedVersion);
                expect(body.expectedVersion).toBe(currentVersion());
                if (url.endsWith("/response")) { responseContent = body.responseContent; events.push({ id: `e-${events.length + 1}`, eventType: "ResponseUpdated", actorUserId: userId, actorName: "Durable Contributor", occurredAt: "2026-09-03T13:00:00Z", details: null }); }
                if (url.endsWith("/block")) { state = "Blocked"; activeReasonType = "Blocker"; activeReason = body.reason; events.push({ id: `e-${events.length + 1}`, eventType: "Blocked", actorUserId: userId, actorName: "Durable Contributor", occurredAt: "2026-09-03T13:20:00Z", details: { reason: body.reason } }); }
                if (url.endsWith("/unblock")) { state = "In Progress"; activeReasonType = null; activeReason = null; events.push({ id: `e-${events.length + 1}`, eventType: "Unblocked", actorUserId: userId, actorName: "E2E Preview Admin", occurredAt: "2026-09-03T13:30:00Z", details: { resolution: body.resolution } }); }
                if (url.endsWith("/submit-dd-review")) { state = "Needs DD Review"; events.push({ id: `e-${events.length + 1}`, eventType: "SubmittedForDdReview", actorUserId: userId, actorName: "Durable Contributor", occurredAt: "2026-09-03T13:40:00Z", details: null }); }
                if (url.endsWith("/ready-to-publish")) state = "Ready to Publish";
                if (url.endsWith("/disposition")) { state = "Needs DD Review"; proposedDisposition = body.disposition; dispositionReason = body.reason; }
                if (url.endsWith("/disposition/approve")) state = String(proposedDisposition);
                advance();
            }
            return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ workItem: project(userId) }) });
        });
        await page.route("**/api/recapitalization/work-items", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ workItems: [project(userId)], assignees: [] }) }));
    }

    const owner = await browser.newContext();
    const ownerPage = await owner.newPage(); await setup(ownerPage, OWNER_ID);
    await ownerPage.goto(`/recapitalization/workspace/${WORK_ID}`, { waitUntil: "domcontentloaded" });
    await ownerPage.getByLabel("DD response").fill("Durable response text");
    await ownerPage.getByRole("button", { name: "Save response" }).click();
    await expect(ownerPage.getByRole("status")).toContainText("Response saved");
    await expect(ownerPage.getByTestId("authoritative-action-center").getByText("Upload Artifact", { exact: true })).toBeVisible();
    await ownerPage.getByLabel("Upload Artifact").setInputFiles({ name: "keystone-support.txt", mimeType: "text/plain", buffer: Buffer.from("authoritative artifact") });
    await expect(ownerPage.getByText("keystone-support.txt")).toBeVisible();
    await ownerPage.getByLabel("New work note").fill("Internal context survives sessions");
    await ownerPage.getByRole("button", { name: "Add note" }).click();
    await ownerPage.getByRole("button", { name: "Mark Blocked" }).click();
    await ownerPage.getByLabel("Reason or resolution").fill("Waiting for source data");
    await ownerPage.getByRole("button", { name: "Confirm" }).click();
    await expect(ownerPage.getByTestId("authoritative-status")).toHaveText("Blocked");
    await owner.close();

    const reopened = await browser.newContext();
    const reopenedPage = await reopened.newPage(); await setup(reopenedPage, OWNER_ID);
    await reopenedPage.goto(`/recapitalization/workspace/${WORK_ID}`, { waitUntil: "domcontentloaded" });
    await expect(reopenedPage.getByLabel("DD response")).toHaveValue("Durable response text");
    await expect(reopenedPage.getByText("keystone-support.txt")).toBeVisible();
    await expect(reopenedPage.getByText("Internal context survives sessions")).toBeVisible();
    await expect(reopenedPage.getByText("Waiting for source data", { exact: true })).toBeVisible();
    await expect(reopenedPage.getByRole("button", { name: "Resume Work" })).toHaveCount(0);
    await reopened.close();

    const admin = await browser.newContext();
    const adminPage = await admin.newPage(); await setup(adminPage, ADMIN_ID);
    await adminPage.goto(`/recapitalization/workspace/${WORK_ID}`, { waitUntil: "domcontentloaded" });
    await adminPage.getByRole("button", { name: "Resume Work" }).click();
    await adminPage.getByLabel("Reason or resolution").fill("Source data received");
    await adminPage.getByRole("button", { name: "Confirm" }).click();
    await expect(adminPage.getByTestId("authoritative-status")).toHaveText("In Progress");
    await admin.close();

    const submit = await browser.newContext();
    const submitPage = await submit.newPage(); await setup(submitPage, OWNER_ID);
    await submitPage.goto(`/recapitalization/workspace/${WORK_ID}`, { waitUntil: "domcontentloaded" });
    await submitPage.getByRole("button", { name: "Submit for DD Review" }).first().click();
    await submitPage.getByRole("dialog", { name: "Submit for DD Review?" }).getByRole("button", { name: "Submit for DD Review" }).click();
    await expect(submitPage.getByTestId("authoritative-status")).toHaveText("Needs DD Review");
    await submit.close();

    const review = await browser.newContext();
    const reviewPage = await review.newPage(); await setup(reviewPage, ADMIN_ID);
    await reviewPage.goto(`/recapitalization/workspace/${WORK_ID}`, { waitUntil: "domcontentloaded" });
    await expect(reviewPage.getByText("Durable response text")).toBeVisible();
    await expect(reviewPage.getByText("Response updated")).toBeVisible();
    await reviewPage.getByRole("button", { name: "Mark Ready to Publish" }).click();
    await expect(reviewPage.getByTestId("authoritative-status")).toHaveText("Ready to Publish");
    await review.close();

    state = "In Progress"; proposedDisposition = null; dispositionReason = null; advance();
    const proposal = await browser.newContext();
    const proposalPage = await proposal.newPage(); await setup(proposalPage, OWNER_ID);
    await proposalPage.goto(`/recapitalization/workspace/${WORK_ID}`, { waitUntil: "domcontentloaded" });
    await proposalPage.getByRole("button", { name: "Propose Duplicate" }).click();
    await proposalPage.getByLabel("Reason or resolution").fill("Matches DD-2026-0019");
    await proposalPage.getByRole("button", { name: "Confirm" }).click();
    await expect(proposalPage.getByTestId("authoritative-status")).toHaveText("Needs DD Review");
    await expect(proposalPage.getByRole("button", { name: "Approve Disposition" })).toHaveCount(0);
    await proposal.close();

    const dispositionReview = await browser.newContext();
    const dispositionPage = await dispositionReview.newPage(); await setup(dispositionPage, ADMIN_ID);
    await dispositionPage.goto(`/recapitalization/workspace/${WORK_ID}`, { waitUntil: "domcontentloaded" });
    await expect(dispositionPage.getByText("Matches DD-2026-0019")).toBeVisible();
    await dispositionPage.getByRole("button", { name: "Approve Disposition" }).click();
    await expect(dispositionPage.getByTestId("authoritative-status")).toHaveText("Duplicate");
    await dispositionReview.close();

    expect(versionsUsed.length).toBeGreaterThanOrEqual(7);
    expect(notes).toHaveLength(1);
    expect(events.map(event => event.eventType)).toEqual(expect.arrayContaining(["ResponseUpdated", "Blocked", "Unblocked", "SubmittedForDdReview"]));
});

test("queued workspace requires assignment and refreshes authoritative owner and capabilities", async ({ browser }) => {
    let state = "Queued";
    let assignedUserId: string | null = null;
    let version = "0x0000000000000052";
    const assignee = { id: OWNER_ID, displayName: "Durable Contributor", email: "owner@example.com", role: "Editor" };
    const projection = (userId: string) => ({
        workItemId: WORK_ID, intakeRequestId: "11111111-1111-4111-8111-111111111111", requestNumber: "DD-2026-00000052",
        status: state, assignedUserId, assignedUserName: assignedUserId ? assignee.displayName : null, assignedUserEmail: assignedUserId ? assignee.email : null,
        team: "Projects", priority: "High", dueDate: null, title: "Architectural and construction plan sets", description: "Plans", category: "Projects", communities: ["Keystone"],
        needsReassignment: false, misassignedReason: null, packageId: "44444444-4444-4444-8444-444444444444", sourcePackageId: "source", packageName: "Package", originalFileName: "source.xlsx",
        externalOrganizationId: "org", businessTransactionId: "txn", transactionName: "Project Keystone", admittedAt: "2026-09-04T12:00:00Z", assignedAt: assignedUserId ? "2026-09-04T13:00:00Z" : null,
        acceptedAt: null, updatedAt: "2026-09-04T13:00:00Z", version, responseContent: null,
        capabilities: { canAssign: userId === ADMIN_ID && state === "Queued", canAccept: userId === OWNER_ID && state === "Assigned", canMarkNotMine: userId === OWNER_ID && state === "Assigned", canAddWorkNote: userId === ADMIN_ID },
    });

    async function setup(page: Page, userId: string) {
        await mockAuth(page);
        await page.addInitScript(() => sessionStorage.removeItem("integrasource.recap.demoPresentation"));
        await page.route("**/api/me", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ...PREVIEW_USER, userRecord: { ...PREVIEW_USER.userRecord, id: userId } }) }));
        await page.route("**/api/recapitalization/work-items", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ workItems: [projection(userId)], assignees: [assignee] }) }));
        await page.route("**/api/recapitalization/work-items/**", async route => {
            const url = route.request().url();
            if (url.endsWith("/assign")) {
                const body = JSON.parse(route.request().postData() || "{}");
                expect(body).toEqual({ assignedUserId: OWNER_ID, expectedVersion: "0x0000000000000052" });
                state = "Assigned"; assignedUserId = OWNER_ID; version = "0x0000000000000053";
                return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ workItem: projection(userId) }) });
            }
            const key = url.endsWith("/events") ? "events" : url.endsWith("/notes") ? "notes" : url.endsWith("/artifacts") ? "artifacts" : "documents";
            return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ [key]: [] }) });
        });
    }

    const admin = await browser.newContext();
    const adminPage = await admin.newPage(); await setup(adminPage, ADMIN_ID);
    await adminPage.goto(`/recapitalization/workspace/${WORK_ID}`, { waitUntil: "domcontentloaded" });
    await expect(adminPage.getByTestId("workspace-state-summary")).toContainText("Status");
    await expect(adminPage.getByTestId("workspace-state-summary")).toContainText("Queued");
    await expect(adminPage.getByTestId("workspace-state-summary")).toContainText("Owner");
    await expect(adminPage.getByTestId("workspace-state-summary")).toContainText("Unassigned");
    await expect(adminPage.getByText("cannot be worked until DD Operations assigns an owner")).toBeVisible();
    await expect(adminPage.getByLabel("DD response")).toHaveCount(0);
    await adminPage.getByLabel("Assign Owner").selectOption(OWNER_ID);
    const dialog = adminPage.getByRole("dialog", { name: "Assign Request?" });
    await expect(dialog).toContainText("DD-2026-00000052");
    await dialog.getByRole("button", { name: "Assign" }).click();
    await expect(adminPage.getByTestId("authoritative-status")).toHaveText("Assigned");
    await expect(adminPage.getByTestId("workspace-state-summary")).toContainText(assignee.displayName);
    await admin.close();

    const owner = await browser.newContext();
    const ownerPage = await owner.newPage(); await setup(ownerPage, OWNER_ID);
    await ownerPage.goto(`/recapitalization/workspace/${WORK_ID}`, { waitUntil: "domcontentloaded" });
    await expect(ownerPage.getByRole("button", { name: "Accept Work" })).toBeVisible();
    await expect(ownerPage.getByRole("button", { name: "Not Mine" })).toBeVisible();
    await expect(ownerPage.getByLabel("DD response")).toHaveCount(0);
    await expect(ownerPage.getByLabel("Upload Artifact")).toHaveCount(0);
    await owner.close();

    const other = await browser.newContext();
    const otherPage = await other.newPage(); await setup(otherPage, "55555555-5555-4555-8555-555555555555");
    await otherPage.goto(`/recapitalization/workspace/${WORK_ID}`, { waitUntil: "domcontentloaded" });
    await expect(otherPage.getByRole("button", { name: "Accept Work" })).toHaveCount(0);
    await other.close();
});

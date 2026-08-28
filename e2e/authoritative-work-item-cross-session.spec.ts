import { expect, Page, test } from "@playwright/test";
import { mockAuth, PREVIEW_USER } from "./helpers/auth";

const INTAKE_ID = "11111111-1111-4111-8111-111111111111";
const WORK_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";
const REASSIGNEE_ID = "77777777-7777-4777-8777-777777777777";

test("authoritative admission, assignment, and acceptance survive isolated browser sessions", async ({ browser }) => {
    let item: Record<string, unknown> | null = null;
    let acceptPostData: string | null = "not-called";
    const assignee = { id: USER_ID, displayName: "Durable Contributor", email: "durable@integracare.com", role: "Contributor" };
    const reassignee = { id: REASSIGNEE_ID, displayName: "Austin Kiec", email: "austin@integracare.com", role: "Contributor" };
    const assignmentTargets: string[] = [];
    const acceptanceActors: string[] = [];
    const ddReviewSubmissionActors: string[] = [];
    const ddReviewActions: string[] = [];
    const artifacts: Array<Record<string, unknown>> = [];
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
        await page.addInitScript(() => sessionStorage.removeItem("integrasource.recap.demoPresentation"));
        await page.route("**/api/me", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
            ...PREVIEW_USER, userRecord: { ...PREVIEW_USER.userRecord, id: userId, displayName: userId === USER_ID ? "Durable Contributor" : userId === REASSIGNEE_ID ? "Austin Kiec" : "E2E Preview Admin" },
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
            if (url.endsWith("/source-documents")) {
                await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ documents: [{ id: "88888888-8888-4888-8888-888888888888", fileName: "keystone.xlsx", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", size: 4096, uploadedAt: "2026-08-19T11:00:00.000Z" }] }) });
                return;
            }
            if (url.includes("/artifacts/") && url.endsWith("/content")) {
                await route.fulfill({ status: 200, contentType: "application/pdf", headers: { "Content-Disposition": "attachment; filename=\"owner-report.pdf\"" }, body: "durable artifact" });
                return;
            }
            if (url.endsWith("/artifacts")) {
                if (method === "POST") {
                    await new Promise(resolve => setTimeout(resolve, 300));
                    artifacts.push({ id: "99999999-9999-4999-8999-999999999999", fileName: decodeURIComponent(route.request().headers()["x-file-name"]), contentType: route.request().headers()["x-file-content-type"], size: route.request().postDataBuffer()?.length || 0, status: "Uploaded", uploadedBy: "Durable Contributor", uploadedAt: "2026-08-19T12:15:00.000Z" });
                }
                await route.fulfill({ status: method === "POST" ? 201 : 200, contentType: "application/json", body: JSON.stringify(method === "POST" ? { artifact: artifacts[0] } : { artifacts }) });
                return;
            }
            if (method === "POST" && url.endsWith("/admit")) item = projection();
            if (method === "POST" && url.endsWith("/assign")) {
                const targetId = JSON.parse(route.request().postData() || "{}").assignedUserId;
                const target = targetId === REASSIGNEE_ID ? reassignee : assignee;
                assignmentTargets.push(targetId);
                item = { ...(item || projection()), status: "Assigned", assignedUserId: target.id, assignedUserName: target.displayName, assignedUserEmail: target.email, needsReassignment: false, misassignedReason: null, assignedAt: "2026-08-19T12:05:00.000Z", capabilities: { ...(projection().capabilities as object), canAccept: true, canMarkNotMine: true } };
            }
            if (method === "POST" && url.endsWith("/accept")) {
                acceptanceActors.push(userId);
                if (item?.assignedUserId !== userId || item?.status !== "Assigned") {
                    await route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: "Work item transition rejected" }) });
                    return;
                }
                acceptPostData = route.request().postData();
                item = { ...(item || projection()), status: "In Progress", acceptedAt: "2026-08-19T12:10:00.000Z" };
            }
            if (method === "POST" && url.endsWith("/submit-dd-review")) {
                if (item?.assignedUserId !== userId || item?.status !== "In Progress") {
                    await route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: "Work item transition rejected" }) });
                    return;
                }
                ddReviewSubmissionActors.push(userId);
                item = { ...(item || projection()), status: "Needs DD Review" };
            }
            if (method === "POST" && url.endsWith("/return-from-dd-review")) {
                ddReviewActions.push("return");
                item = { ...(item || projection()), status: "In Progress" };
            }
            if (method === "POST" && url.endsWith("/ready-to-publish")) {
                ddReviewActions.push("ready");
                item = { ...(item || projection()), status: "Ready to Publish" };
            }
            if (item) item = { ...item, capabilities: {
                ...(projection().capabilities as object),
                canAccept: item.status === "Assigned" && item.assignedUserId === userId,
                canMarkNotMine: !!item.assignedUserId,
                canSubmitForDdReview: item.status === "In Progress" && item.assignedUserId === userId,
                canReturnFromDdReview: item.status === "Needs DD Review" && userId === PREVIEW_USER.userRecord.id,
                canMarkReadyToPublish: item.status === "Needs DD Review" && userId === PREVIEW_USER.userRecord.id,
                canUploadArtifact: item.status === "In Progress" && item.assignedUserId === userId,
                canViewArtifacts: !!item.assignedUserId && (item.assignedUserId === userId || userId === PREVIEW_USER.userRecord.id),
                canDownloadArtifacts: !!item.assignedUserId && (item.assignedUserId === userId || userId === PREVIEW_USER.userRecord.id),
            } };
            const body = url.endsWith("/admit") ? { workItems: item ? [item] : [] }
                : method === "GET" ? { workItems: item ? [item] : [], assignees: [assignee, reassignee] }
                    : { workItem: item };
            await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
        };
        await page.route("**/api/recapitalization/work-items", handleWorkItems);
        await page.route("**/api/recapitalization/work-items/**", handleWorkItems);
    }

    const intakeContext = await browser.newContext();
    const intakePage = await intakeContext.newPage();
    await setup(intakePage);
    await intakePage.goto("/recapitalization/intake", { waitUntil: "domcontentloaded" });
    await expect(intakePage.getByRole("heading", { name: "Intake Queue" })).toBeVisible();
    await intakePage.evaluate(async intakeRequestId => {
        await fetch("/api/recapitalization/work-items/admit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ intakeRequestIds: [intakeRequestId] }) });
    }, INTAKE_ID);
    await intakeContext.close();

    const queueContext = await browser.newContext();
    const queuePage = await queueContext.newPage();
    await setup(queuePage);
    await queuePage.goto("/recapitalization/dd-operations", { waitUntil: "domcontentloaded" });
    const row = queuePage.getByRole("row").filter({ hasText: "DD-2026-000001" });
    await expect(row).toContainText("Durable Keystone Request");
    const initialAssign = row.getByRole("combobox", { name: "Assign DD-2026-000001" });
    await initialAssign.selectOption(USER_ID);
    await expect(queuePage.getByRole("dialog", { name: "Assign Request?" })).toContainText("Durable Contributor");
    expect(assignmentTargets).toHaveLength(0);
    await queuePage.getByRole("button", { name: "Cancel" }).click();
    expect(assignmentTargets).toHaveLength(0);
    await expect(row.locator("td").nth(6)).toHaveText("—");
    await initialAssign.selectOption(USER_ID);
    await queuePage.getByRole("button", { name: "Assign", exact: true }).click();
    await expect(queuePage.getByRole("dialog", { name: "Assigned" })).toContainText("DD-2026-000001 has been assigned to Durable Contributor.");
    expect(assignmentTargets).toEqual([USER_ID]);
    await expect(queuePage.getByText(USER_ID)).toHaveCount(0);
    await queuePage.getByRole("button", { name: "OK" }).click();
    await expect(row.locator("td").nth(6)).toHaveText("Durable Contributor");
    await queueContext.close();

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await setup(adminPage);
    await adminPage.goto(`/recapitalization/workspace/${WORK_ID}`, { waitUntil: "domcontentloaded" });
    await expect(adminPage.getByText("Durable Contributor", { exact: true }).first()).toBeVisible();
    await expect(adminPage.getByText("Accept Work", { exact: true })).toHaveCount(0);
    await expect(adminPage.getByText(USER_ID)).toHaveCount(0);
    expect(acceptanceActors).toHaveLength(0);
    await adminContext.close();

    const otherUserContext = await browser.newContext();
    const otherUserPage = await otherUserContext.newPage();
    await setup(otherUserPage, REASSIGNEE_ID);
    await otherUserPage.goto(`/recapitalization/workspace/${WORK_ID}`, { waitUntil: "domcontentloaded" });
    await expect(otherUserPage.getByText("Durable Contributor", { exact: true }).first()).toBeVisible();
    await expect(otherUserPage.getByText("Accept Work", { exact: true })).toHaveCount(0);
    await expect(otherUserPage.getByText(USER_ID)).toHaveCount(0);
    expect(acceptanceActors).toHaveLength(0);
    await otherUserContext.close();

    const contributorContext = await browser.newContext();
    await contributorContext.addInitScript(() => {
        localStorage.setItem("integrasource.recap.myWorkUser", "Sarah Chen");
        localStorage.setItem("integrasource.recap.demo.portalRequests", JSON.stringify([{ id: "legacy-browser-row", requestId: "DD-26-017", owner: "Sarah Chen", assignedTo: "Sarah Chen", transactionId: "legacy", transactionName: "VALSTONE CORP PORTFOLIO", title: "Legacy row", status: "Assigned", priority: "Low", communityNames: [], _publishedAt: "2026-01-01" }]));
    });
    const contributorPage = await contributorContext.newPage();
    await setup(contributorPage, USER_ID);
    await contributorPage.goto("/recapitalization/my-work", { waitUntil: "domcontentloaded" });
    await expect(contributorPage.getByText("Signed in as")).toContainText("Durable Contributor");
    await expect(contributorPage.getByRole("combobox", { name: "Demo work persona" })).toHaveCount(0);
    await expect(contributorPage.getByText("DD-26-017")).toHaveCount(0);
    await expect(contributorPage.getByText("DD-2026-000001").first()).toBeVisible();
    await contributorPage.getByText("DD-2026-000001").first().click();
    await expect(contributorPage.getByText("Working as")).toContainText("Durable Contributor");
    await expect(contributorPage.getByText("Testing as:")).toHaveCount(0);
    await contributorPage.getByText("Accept Work", { exact: true }).click();
    const acceptDialog = contributorPage.getByRole("dialog", { name: "Accept Work?" });
    await expect(acceptDialog).toContainText("DD-2026-000001");
    await expect(acceptDialog).toContainText("Durable Keystone Request");
    await expect(acceptDialog).toContainText("In Progress");
    expect(acceptanceActors).toHaveLength(0);
    expect(acceptPostData).toBe("not-called");
    await expect(contributorPage.getByText("Assigned", { exact: true }).first()).toBeVisible();
    await acceptDialog.getByRole("button", { name: "Cancel" }).click();
    await expect(acceptDialog).toHaveCount(0);
    expect(acceptanceActors).toHaveLength(0);
    expect(acceptPostData).toBe("not-called");
    await expect(contributorPage.getByText("Assigned", { exact: true }).first()).toBeVisible();
    await expect(contributorPage.getByText("Durable Contributor", { exact: true }).first()).toBeVisible();
    await contributorPage.getByText("Accept Work", { exact: true }).click();
    await expect(acceptDialog).toBeVisible();
    await acceptDialog.getByRole("button", { name: "Accept Work", exact: true }).click();
    await expect(contributorPage.getByText("In Progress", { exact: true }).first()).toBeVisible();
    expect(acceptPostData).toBeNull();
    expect(acceptanceActors).toEqual([USER_ID]);
    await expect(contributorPage.getByText("Accept Work", { exact: true })).toHaveCount(0);
    await expect(contributorPage.getByText("Durable Contributor", { exact: true }).first()).toBeVisible();
    await expect(contributorPage.getByText(USER_ID)).toHaveCount(0);
    await contributorContext.close();

    const reviewSubmitContext = await browser.newContext();
    const reviewSubmitPage = await reviewSubmitContext.newPage();
    await setup(reviewSubmitPage, USER_ID);
    await reviewSubmitPage.goto(`/recapitalization/workspace/${WORK_ID}`, { waitUntil: "domcontentloaded" });
    expect(await reviewSubmitPage.evaluate(async workId => (await fetch(`/api/recapitalization/work-items/${workId}/source-documents`)).json(), WORK_ID)).toMatchObject({ documents: [{ fileName: "keystone.xlsx" }] });
    await expect(reviewSubmitPage.getByText("keystone.xlsx", { exact: true })).toBeVisible();
    await reviewSubmitPage.locator("#artifact-upload-hidden").setInputFiles({ name: "owner-report.pdf", mimeType: "application/pdf", buffer: Buffer.from("durable artifact") });
    await expect(reviewSubmitPage.getByRole("status")).toContainText("owner-report.pdf");
    await expect(reviewSubmitPage.getByRole("status")).toContainText("Uploading to SharePoint");
    await expect(reviewSubmitPage.locator(".rc-artifact-upload-progress")).toBeVisible();
    await expect(reviewSubmitPage.getByText("owner-report.pdf", { exact: true }).first()).toBeVisible();
    await expect(reviewSubmitPage.getByRole("status")).toContainText("uploaded successfully");
    expect(artifacts).toHaveLength(1);
    await reviewSubmitContext.close();

    const persistedArtifactContext = await browser.newContext();
    const persistedArtifactPage = await persistedArtifactContext.newPage();
    const downloads: string[] = [];
    persistedArtifactPage.on("download", download => downloads.push(download.suggestedFilename()));
    await setup(persistedArtifactPage, USER_ID);
    await persistedArtifactPage.goto(`/recapitalization/workspace/${WORK_ID}`, { waitUntil: "domcontentloaded" });
    await expect(persistedArtifactPage.getByText("owner-report.pdf", { exact: true }).first()).toBeVisible();
    await persistedArtifactPage.getByRole("button", { name: "Download", exact: true }).click();
    await expect.poll(() => downloads).toContain("owner-report.pdf");
    await persistedArtifactContext.close();

    const submitContext = await browser.newContext();
    const submitPage = await submitContext.newPage();
    await setup(submitPage, USER_ID);
    await submitPage.goto(`/recapitalization/workspace/${WORK_ID}`, { waitUntil: "domcontentloaded" });
    await submitPage.getByText("Submit for DD Review", { exact: true }).click();
    const submitDialog = submitPage.getByRole("dialog", { name: "Submit for DD Review?" });
    await expect(submitDialog).toContainText("DD-2026-000001");
    await expect(submitDialog).toContainText("Durable Keystone Request");
    expect(ddReviewSubmissionActors).toHaveLength(0);
    await submitDialog.getByRole("button", { name: "Cancel" }).click();
    expect(ddReviewSubmissionActors).toHaveLength(0);
    await submitPage.getByText("Submit for DD Review", { exact: true }).click();
    await submitDialog.getByRole("button", { name: "Submit for DD Review" }).click();
    await expect(submitPage.getByText("Needs DD Review", { exact: true }).first()).toBeVisible();
    expect(ddReviewSubmissionActors).toEqual([USER_ID]);
    await expect(submitPage.getByText(WORK_ID)).toHaveCount(0);
    await submitContext.close();

    const ddArtifactContext = await browser.newContext();
    const ddArtifactPage = await ddArtifactContext.newPage();
    await setup(ddArtifactPage);
    await ddArtifactPage.goto(`/recapitalization/workspace/${WORK_ID}`, { waitUntil: "domcontentloaded" });
    await expect(ddArtifactPage.getByText("owner-report.pdf", { exact: true }).first()).toBeVisible();
    await expect(ddArtifactPage.getByText("Upload Artifact", { exact: true })).toHaveCount(0);
    await ddArtifactContext.close();

    const ddReturnContext = await browser.newContext();
    const ddReturnPage = await ddReturnContext.newPage();
    await setup(ddReturnPage);
    await ddReturnPage.goto("/recapitalization/dd-operations", { waitUntil: "domcontentloaded" });
    await ddReturnPage.getByRole("button", { name: "Needs DD Review" }).click();
    const reviewRow = ddReturnPage.getByRole("row").filter({ hasText: "DD-2026-000001" });
    await expect(reviewRow).toContainText("Durable Contributor");
    await reviewRow.getByRole("button", { name: "Return to Contributor" }).click();
    const returnDialog = ddReturnPage.getByRole("dialog", { name: "Return to Contributor?" });
    expect(ddReviewActions).toHaveLength(0);
    await returnDialog.getByRole("button", { name: "Cancel" }).click();
    expect(ddReviewActions).toHaveLength(0);
    await reviewRow.getByRole("button", { name: "Return to Contributor" }).click();
    await returnDialog.getByRole("button", { name: "Confirm" }).click();
    await expect(reviewRow).toHaveCount(0);
    expect(ddReviewActions).toEqual(["return"]);
    expect(item?.assignedUserId).toBe(USER_ID);
    await ddReturnContext.close();

    const resubmitContext = await browser.newContext();
    const resubmitPage = await resubmitContext.newPage();
    await setup(resubmitPage, USER_ID);
    await resubmitPage.goto(`/recapitalization/workspace/${WORK_ID}`, { waitUntil: "domcontentloaded" });
    await expect(resubmitPage.getByText("In Progress", { exact: true }).first()).toBeVisible();
    await resubmitPage.getByText("Submit for DD Review", { exact: true }).click();
    await resubmitPage.getByRole("dialog", { name: "Submit for DD Review?" }).getByRole("button", { name: "Submit for DD Review" }).click();
    await expect(resubmitPage.getByText("Needs DD Review", { exact: true }).first()).toBeVisible();
    await resubmitContext.close();

    const readyContext = await browser.newContext();
    const readyPage = await readyContext.newPage();
    await setup(readyPage);
    await readyPage.goto("/recapitalization/dd-operations", { waitUntil: "domcontentloaded" });
    await readyPage.getByRole("button", { name: "Needs DD Review" }).click();
    const readyRow = readyPage.getByRole("row").filter({ hasText: "DD-2026-000001" });
    await readyRow.getByRole("button", { name: "Mark Ready to Publish" }).click();
    const readyDialog = readyPage.getByRole("dialog", { name: "Mark Ready to Publish?" });
    await expect(readyDialog).toContainText("Publication is not included");
    await readyDialog.getByRole("button", { name: "Confirm" }).click();
    expect(ddReviewActions).toEqual(["return", "ready"]);
    expect(item?.assignedUserId).toBe(USER_ID);
    await expect(readyPage.getByRole("dialog", { name: "Ready to Publish" })).toContainText("DD-2026-000001");
    await readyPage.getByRole("button", { name: "OK" }).click();
    await readyPage.getByRole("button", { name: "Ready to Publish" }).click();
    await expect(readyPage.getByRole("row").filter({ hasText: "DD-2026-000001" })).toBeVisible();
    await expect(readyPage.getByRole("button", { name: "Publish External" })).toHaveCount(0);
    await readyContext.close();

    // Restore the in-progress fixture for the existing cold-load/reassignment coverage below.
    item = { ...(item || projection()), status: "In Progress" };

    const coldWorkspaceContext = await browser.newContext();
    const coldWorkspacePage = await coldWorkspaceContext.newPage();
    const workspaceErrors: string[] = [];
    coldWorkspacePage.on("pageerror", error => workspaceErrors.push(error.message));
    await setup(coldWorkspacePage, USER_ID);
    await coldWorkspacePage.goto(`/recapitalization/workspace/${WORK_ID}`, { waitUntil: "domcontentloaded" });
    await expect(coldWorkspacePage.getByText("DD-2026-000001").first()).toBeVisible();
    await expect(coldWorkspacePage.getByText("Working as")).toContainText("Durable Contributor");
    await expect(coldWorkspacePage.locator("#ws-owner-select")).toHaveCount(0);
    await expect(coldWorkspacePage.getByText("Reassign Owner", { exact: true })).toHaveCount(0);
    expect(workspaceErrors.filter(message => message.includes("Rendered more hooks") || message.includes("Minified React error #310"))).toEqual([]);
    await coldWorkspaceContext.close();

    const freshContext = await browser.newContext();
    await freshContext.addInitScript(() => {
        localStorage.setItem("integrasource.recap.demo.portalRequests", JSON.stringify([{
            id: "stale-intake-projection", intakeRequestId: "stale-intake-projection", requestId: "DD-sub-stale",
            origin: "authoritative", title: "Stale browser intake projection", status: "Open", priority: "Low", communityNames: [],
        }]));
    });
    const freshPage = await freshContext.newPage();
    await setup(freshPage, USER_ID);
    await freshPage.goto("/recapitalization/my-work", { waitUntil: "domcontentloaded" });
    await expect(freshPage.getByText("Signed in as")).toContainText("Durable Contributor");
    await expect(freshPage.getByRole("combobox", { name: "Demo work persona" })).toHaveCount(0);
    const persistedRow = freshPage.getByRole("row").filter({ hasText: "DD-2026-000001" });
    await expect(persistedRow).toContainText("In Progress");
    await freshPage.goto("/recapitalization/dd-operations", { waitUntil: "domcontentloaded" });
    await expect(freshPage.getByText("Signed in as")).toContainText("Durable Contributor");
    await expect(freshPage.getByRole("combobox", { name: "Switch user" })).toHaveCount(0);
    await expect(freshPage.getByText("DD-sub-stale")).toHaveCount(0);
    await expect(freshPage.getByRole("row").filter({ hasText: "DD-2026-000001" })).toContainText("In Progress");
    await freshContext.close();

    const cleanDdContext = await browser.newContext();
    const cleanDdPage = await cleanDdContext.newPage();
    await setup(cleanDdPage, USER_ID);
    await cleanDdPage.goto("/recapitalization/dd-operations", { waitUntil: "domcontentloaded" });
    const assignedRow = cleanDdPage.getByRole("row").filter({ hasText: "DD-2026-000001" });
    await expect(assignedRow).toContainText("In Progress");
    await expect(assignedRow.locator("td").nth(6)).toHaveText("Durable Contributor");
    const assignedControl = assignedRow.getByRole("combobox", { name: "Assign DD-2026-000001" });
    const callsBeforeAssignedSelection = assignmentTargets.length;
    await assignedControl.selectOption(REASSIGNEE_ID);
    await expect(cleanDdPage.getByRole("dialog", { name: "Reassign Request?" })).toContainText("Austin Kiec");
    expect(assignmentTargets).toHaveLength(callsBeforeAssignedSelection);
    await cleanDdPage.getByRole("button", { name: "Cancel" }).click();
    await expect(assignedRow.locator("td").nth(6)).toHaveText("Durable Contributor");
    expect(assignmentTargets).toHaveLength(callsBeforeAssignedSelection);
    await assignedControl.selectOption(REASSIGNEE_ID);
    await cleanDdPage.getByRole("button", { name: "Reassign", exact: true }).click();
    await expect(cleanDdPage.getByRole("dialog", { name: "Reassigned" })).toContainText("DD-2026-000001 has been assigned to Austin Kiec.");
    expect(assignmentTargets).toEqual([...assignmentTargets.slice(0, callsBeforeAssignedSelection), REASSIGNEE_ID]);
    await expect(cleanDdPage.getByText(REASSIGNEE_ID)).toHaveCount(0);
    await cleanDdPage.getByRole("button", { name: "OK" }).click();
    await expect(assignedRow.locator("td").nth(6)).toHaveText("Austin Kiec");
    await expect(cleanDdPage.getByText("DD-sub-stale")).toHaveCount(0);
    await cleanDdContext.close();

    item = { ...(item || projection()), status: "Queued", assignedUserId: null, assignedUserName: null, assignedUserEmail: null, needsReassignment: true, misassignedReason: "Wrong contributor", acceptedAt: null };
    const reassignmentContext = await browser.newContext();
    const reassignmentPage = await reassignmentContext.newPage();
    await setup(reassignmentPage);
    await reassignmentPage.goto("/recapitalization/dd-operations", { waitUntil: "domcontentloaded" });
    await reassignmentPage.getByRole("button", { name: "Needs DD Review" }).click();
    const reassignmentRow = reassignmentPage.getByRole("row").filter({ hasText: "DD-2026-000001" });
    const assignSelect = reassignmentRow.getByRole("combobox", { name: "Assign DD-2026-000001" });
    const callsBeforeSelection = assignmentTargets.length;
    await assignSelect.selectOption(REASSIGNEE_ID);
    await expect(reassignmentPage.getByRole("dialog", { name: "Reassign Request?" })).toContainText("Austin Kiec");
    expect(assignmentTargets).toHaveLength(callsBeforeSelection);
    await expect(reassignmentRow).toContainText("Wrong contributor");
    await reassignmentPage.getByRole("button", { name: "Cancel" }).click();
    expect(assignmentTargets).toHaveLength(callsBeforeSelection);
    await expect(reassignmentRow).toBeVisible();

    await assignSelect.selectOption(REASSIGNEE_ID);
    expect(assignmentTargets).toHaveLength(callsBeforeSelection);
    await reassignmentPage.getByRole("button", { name: "Reassign", exact: true }).click();
    await expect(reassignmentPage.getByRole("dialog", { name: "Reassigned" })).toContainText("DD-2026-000001 has been assigned to Austin Kiec.");
    expect(assignmentTargets).toEqual([...assignmentTargets.slice(0, callsBeforeSelection), REASSIGNEE_ID]);
    await expect(reassignmentPage.getByText(REASSIGNEE_ID)).toHaveCount(0);
    await reassignmentPage.getByRole("button", { name: "OK" }).click();
    await expect(reassignmentRow).toHaveCount(0);
    await reassignmentContext.close();
});

import { test, expect, mockAuth, PREVIEW_USER } from "./helpers/auth";

const textDocument = (name: string) => ({ name, mimeType: "text/plain", buffer: Buffer.from("document") });
const metadataOptions = { documentTypes: [{ key: "report-analysis", displayName: "Report / Analysis" }],
    businessTopics: [{ slug: "budget", name: "Budget", description: "Financial planning and variance tracking.", group: "Finance" }] };
const artifact = (id: string, fileName: string, storageDestination: "Working" | "Knowledge", libraryKey: "Projects" | null, uploadedAt = "2026-08-27T12:00:00.000Z") => ({
    id, fileName, extension: "txt", contentType: "text/plain", size: 8,
    ingestionState: "Uploaded", classificationState: "Unclassified", lifecycleState: "Active",
    storageDestination, libraryKey, sourceOrigin: "Internal Artifact Upload", sourceModule: "ArtifactHub",
    sourceContext: null, description: null, effectiveDate: null, submittedByDisplayName: "E2E User",
    uploadedAt, createdAt: uploadedAt, updatedAt: uploadedAt,
});

test("Document Hub presents business destinations and Working-only routing", async ({ page }) => {
    const listQueries: string[] = [];
    await page.route("**/api/artifacts?*", async route => {
        const params = new URL(route.request().url()).searchParams;
        const q = params.get("q") || "";
        const destination = params.get("destination") || "";
        listQueries.push(q);
        const rows = [
            artifact("11111111-1111-4111-8111-111111111111", "working.txt", "Working", "Projects"),
            artifact("22222222-2222-4222-8222-222222222222", "knowledge.txt", "Knowledge", null),
        ].filter(item => item.fileName.includes(q) && (!destination || item.storageDestination === destination));
        if (q === "failure") {
            await new Promise(resolve => setTimeout(resolve, 400));
            return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Temporary Find failure" }) });
        }
        if (destination === "Working") await new Promise(resolve => setTimeout(resolve, 500));
        if (q === "working") await new Promise(resolve => setTimeout(resolve, 700));
        return route.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({ artifacts: rows, total: rows.length, page: 1, pageSize: 10 }),
    }); });
    await page.route("**/api/artifacts/metadata/options", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(metadataOptions) }));
    await mockAuth(page);
    await page.goto("/documents", { waitUntil: "domcontentloaded", timeout: 90_000 });
    await expect(page.locator("#root")).toBeVisible();

    await expect(page.getByText("Drop documents here")).toBeVisible();
    await expect(page.locator(".document-hub-staging")).toHaveCount(0);
    await expect(page.locator(".document-hub-dropzone")).toHaveCSS("background-color", "rgb(255, 255, 255)");

    await page.locator("#document-hub-file").setInputFiles(textDocument("one.txt"));
    const row = page.locator(".document-hub-file-row").first();
    await expect(row.getByText("Choose where this document should be available")).toBeVisible();
    await expect(row.getByText("Working", { exact: true })).toBeVisible();
    await expect(row.getByText("Knowledge", { exact: true })).toBeVisible();
    await expect(row.getByText("External", { exact: true })).toBeVisible();
    await expect(row.getByRole("radio", { name: "Knowledge" })).toBeEnabled();
    await expect(row.getByRole("radio", { name: "External" })).toBeDisabled();
    await expect(row.locator(".document-hub-work-area")).toHaveCount(0);
    await expect(page.getByText("Set work area for all Working documents")).toHaveCount(0);

    await row.getByRole("radio", { name: "Working" }).check();
    await expect(row.locator(".document-hub-work-area")).toBeVisible();
    await expect(row.getByLabel("Document title")).toHaveValue("one");
    await row.getByLabel("Document type").selectOption("report-analysis");
    await row.getByLabel("Business topic").fill("Budget");
    await row.getByLabel("Document origin").fill("DHS");
    await row.getByRole("button", { name: "+ Add description" }).click();
    await row.getByLabel("Description").fill("Quarterly review context.");
    await expect(row).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await row.getByRole("radio", { name: "Knowledge" }).check();
    await expect(row.locator(".document-hub-work-area")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Store 1 document" })).toBeEnabled();

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator("#document-hub-file").setInputFiles([textDocument("one.txt"), textDocument("two.txt")]);
    await expect(page.locator(".document-hub-file-row")).toHaveCount(2);
    await expect(page.getByText("Set work area for all Working documents")).toHaveCount(0);
    await page.locator(".document-hub-file-row").first().getByRole("radio", { name: "Working" }).check();
    await page.locator(".document-hub-file-row").nth(1).getByRole("radio", { name: "Knowledge" }).check();
    await page.locator(".document-hub-file-row").first().locator(".document-hub-work-area select").selectOption("Projects");
    await expect(page.getByText("Set work area for all Working documents")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Store 2 documents" })).toBeEnabled();
    await page.screenshot({ path: "test-results/document-hub-destination.png", fullPage: true });

    await page.getByRole("button", { name: /Find Documents/ }).click();
    await expect(page.getByText("Working · Project work")).toBeVisible();
    await expect(page.locator(".document-hub-results > button").filter({ hasText: "knowledge.txt" })).toContainText("Knowledge");
    await expect(page.getByLabel("Availability")).toContainText("Working");
    await expect(page.getByLabel("Availability")).toContainText("Knowledge");
    await page.getByLabel("Availability").selectOption("Working");
    await expect(page.getByText(/Updating/)).toBeVisible();
    await expect(page.locator(".document-hub-results > button")).toHaveCount(2);
    await expect(page.locator(".document-hub-results")).toContainText("knowledge.txt");
    await expect(page.locator(".document-hub-results > button")).toHaveCount(1);
    await expect(page.locator(".document-hub-results")).toContainText("working.txt");
    await page.getByLabel("Availability").selectOption("");
    await expect(page.locator(".document-hub-results > button")).toHaveCount(2);

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.locator(".document-hub-results > button").filter({ hasText: "working.txt" }).click();
    const drawer = page.getByRole("dialog", { name: "Document details" });
    await expect(drawer).toBeVisible();
    await expect(drawer).toContainText("working.txt");
    await expect(drawer).toContainText("Upload details");
    await expect(drawer).not.toContainText("Provenance");
    await expect(drawer.getByRole("button", { name: "Download" })).toBeVisible();
    await expect(drawer.locator(".document-hub-detail-body")).toHaveCSS("overflow-y", "auto");
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("hidden");
    const lockedScrollY = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(0, 800);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(lockedScrollY);
    await drawer.getByText("working.txt").first().click();
    await expect(drawer).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(drawer).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(lockedScrollY);
    await page.locator(".document-hub-results > button").filter({ hasText: "working.txt" }).click();
    await page.locator(".document-hub-detail-backdrop").click({ position: { x: 8, y: 8 } });
    await expect(drawer).toHaveCount(0);

    const search = page.getByLabel("Search documents");
    await search.fill("failure");
    await expect(page.getByText(/Updating/)).toBeVisible();
    await expect(page.locator(".document-hub-results > button")).toHaveCount(2);
    await expect(page.getByRole("alert")).toContainText("Temporary Find failure");
    await expect(page.locator(".document-hub-results > button")).toHaveCount(2);
    const requestsBeforeTyping = listQueries.length;
    await search.fill("knowledge");
    await page.waitForTimeout(150);
    expect(listQueries).toHaveLength(requestsBeforeTyping);
    await expect(page.locator(".document-hub-results > button")).toHaveCount(1);
    await expect(page.locator(".document-hub-results")).toContainText("knowledge.txt");
    await search.fill("");
    await expect(page.locator(".document-hub-results > button")).toHaveCount(2);
    await search.fill("working");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await page.waitForTimeout(75);
    await search.fill("knowledge");
    await expect(page.locator(".document-hub-results > button")).toHaveCount(1);
    await expect(page.locator(".document-hub-results")).toContainText("knowledge.txt");
    await page.waitForTimeout(500);
    await expect(page.locator(".document-hub-results")).toContainText("knowledge.txt");
    await search.fill("missing");
    await expect(page.locator(".document-hub-find-state.empty")).toContainText("No documents found");
    await expect(page.locator(".document-hub-results")).toHaveCount(0);
});

test("successful upload opens a refreshed newest-first Find list", async ({ page }) => {
    const older = artifact("11111111-1111-4111-8111-111111111111", "older.txt", "Working", "Projects");
    let newest = { ...artifact("33333333-3333-4333-8333-333333333333", "newest.txt", "Knowledge", null, "2026-08-28T12:00:00.000Z"),
        documentTitle: "Newest Knowledge Report", documentType: { key: "report-analysis", displayName: "Report / Analysis" },
        businessTopic: { slug: "budget", name: "Budget", group: "Finance" }, documentOrigin: "DHS", description: "Quarterly review context." };
    let uploaded = false;
    const listRequests: string[] = [];
    await page.route("**/api/artifacts", route => route.request().method() === "POST"
        ? (uploaded = true, route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ artifact: newest }) }))
        : route.fallback());
    await page.route("**/api/artifacts?*", route => {
        listRequests.push(route.request().url());
        const q = new URL(route.request().url()).searchParams.get("q")?.toLowerCase() || "";
        const rows = (uploaded ? [newest, older] : [older]).filter(item => `${item.documentTitle || ""} ${item.fileName}`.toLowerCase().includes(q));
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ artifacts: rows, total: rows.length, page: 1, pageSize: 10 }) });
    });
    await page.route("**/api/artifacts/33333333-3333-4333-8333-333333333333/metadata", async route => {
        const values = route.request().postDataJSON();
        newest = { ...newest, documentTitle: values.documentTitle, documentOrigin: values.documentOrigin };
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ artifact: newest }) });
    });
    await page.route("**/api/artifacts/metadata/options", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(metadataOptions) }));
    await mockAuth(page);
    await page.goto("/documents", { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.locator("#document-hub-file").setInputFiles(textDocument("newest.txt"));
    await page.locator(".document-hub-file-row").getByRole("radio", { name: "Knowledge" }).check();
    const uploadRow = page.locator(".document-hub-file-row");
    await uploadRow.getByLabel("Document title").fill("Newest Knowledge Report");
    await uploadRow.getByLabel("Document type").selectOption("report-analysis");
    await uploadRow.getByLabel("Business topic").fill("Budget");
    await uploadRow.getByLabel("Document origin").fill("DHS");
    await page.getByRole("button", { name: "Store 1 document" }).click();
    await expect(page.getByText("Document stored successfully")).toBeVisible();
    await page.getByRole("button", { name: "View in Find Documents" }).click();
    await expect(page.locator(".document-hub-results > button").first()).toContainText("newest.txt");
    const search = page.getByLabel("Search documents");
    await search.fill("newest");
    await expect(page.locator(".document-hub-results > button")).toHaveCount(1);
    await page.locator(".document-hub-results > button").first().click();
    const drawer = page.getByRole("dialog", { name: "Document details" });
    await expect(drawer).toContainText("Report / Analysis");
    await expect(drawer).toContainText("Budget");
    await expect(drawer).toContainText("DHS");
    await expect(drawer.getByRole("button", { name: "Close document details" })).toBeVisible();
    await drawer.getByRole("button", { name: "Edit details" }).click();
    const save = drawer.getByRole("button", { name: "Save details" });
    await expect(save).toBeVisible();
    await expect(save).toHaveCSS("color", "rgb(255, 255, 255)");
    await drawer.getByLabel("Document title").fill("Updated Knowledge Report");
    await save.click();
    await expect(drawer.getByRole("heading", { name: "Updated Knowledge Report" })).toBeVisible();
    await expect(drawer.getByText("Document details updated")).toBeVisible();
    await drawer.getByRole("button", { name: "Close document details" }).click();
    await expect(drawer).toHaveCount(0);
    await expect(search).toHaveValue("newest");
    await expect(page.locator(".document-hub-results > button")).toHaveCount(1);
    await expect(page.getByText("1 document found")).toBeVisible();
    expect(listRequests.length).toBeGreaterThan(0);
    expect(new URL(listRequests[0]).searchParams.get("pageSize")).toBe("10");
    expect(new URL(listRequests[0]).searchParams.get("sort")).toBe("newest");
});

test("drawer dismissal protects unsaved metadata and permits no-change dismissal", async ({ page }) => {
    const row = { ...artifact("55555555-5555-4555-8555-555555555555", "protected.txt", "Working", "Projects"), documentTitle: "Protected report" };
    await page.route("**/api/artifacts?*", route => route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ artifacts: [row], total: 1, page: 1, pageSize: 10 }) }));
    await page.route("**/api/artifacts/metadata/options", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(metadataOptions) }));
    await mockAuth(page);
    await page.goto("/documents", { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.getByRole("button", { name: /Find Documents/ }).click();
    await page.locator(".document-hub-results > button").click();
    let drawer = page.getByRole("dialog", { name: "Document details" });
    await drawer.getByRole("button", { name: "Edit details" }).click();
    await drawer.getByRole("button", { name: "Close document details" }).click();
    await expect(drawer).toHaveCount(0);

    await page.locator(".document-hub-results > button").click();
    drawer = page.getByRole("dialog", { name: "Document details" });
    await drawer.getByRole("button", { name: "Edit details" }).click();
    await drawer.getByLabel("Document title").fill("Unsaved title");
    await drawer.getByRole("button", { name: "Save details" }).click();
    await expect(drawer.getByRole("alert")).toContainText("could not be saved");
    await expect(drawer.getByLabel("Document title")).toHaveValue("Unsaved title");
    page.once("dialog", async dialog => { expect(dialog.message()).toContain("Discard"); await dialog.dismiss(); });
    await drawer.getByRole("button", { name: "Close document details" }).click();
    await expect(drawer).toBeVisible();
    await expect(drawer.getByLabel("Document title")).toHaveValue("Unsaved title");
    page.once("dialog", async dialog => dialog.accept());
    await page.keyboard.press("Escape");
    await expect(drawer).toHaveCount(0);
});

test("authorized lifecycle management moves then removes without row actions", async ({ page }) => {
    let row = { ...artifact("66666666-6666-4666-8666-666666666666", "lifecycle.txt", "Knowledge", null), documentTitle: "Lifecycle document" };
    let active = true;
    let moveCalls = 0;
    let removeCalls = 0;
    await page.route("**/api/artifacts?*", route => route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ artifacts: active ? [row] : [], total: active ? 1 : 0, page: 1, pageSize: 10 }) }));
    await page.route("**/api/artifacts/66666666-6666-4666-8666-666666666666/move", async route => {
        moveCalls += 1;
        const values = route.request().postDataJSON();
        if (moveCalls === 1) return route.fulfill({ status: 503, contentType: "application/json",
            body: JSON.stringify({ error: "Artifact move destination is durable but requires retry" }) });
        row = { ...row, storageDestination: values.destination, libraryKey: values.workArea };
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ artifact: row }) });
    });
    await page.route("**/api/artifacts/66666666-6666-4666-8666-666666666666/remove", route => {
        removeCalls += 1; active = false;
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: row.id, removed: true }) });
    });
    await page.route("**/api/artifacts/metadata/options", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(metadataOptions) }));
    await mockAuth(page);
    await page.goto("/documents", { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.getByRole("button", { name: /Find Documents/ }).click();
    await page.locator(".document-hub-results > button").click();
    let drawer = page.getByRole("dialog", { name: "Document details" });
    await drawer.getByRole("button", { name: "Manage document" }).click();
    await drawer.getByRole("button", { name: "Move document", exact: true }).click();
    await expect(drawer.getByText("Current:")).toContainText("Knowledge");
    await expect(drawer.getByText("External", { exact: true })).toHaveCount(0);
    await expect(drawer.getByRole("button", { name: "Move document", exact: true })).toBeDisabled();
    await drawer.getByLabel("Working", { exact: true }).check();
    await drawer.getByLabel("Move Work area").selectOption("Legal");
    await expect(drawer.getByText("New:")).toContainText("Working · Legal work");
    await drawer.getByRole("button", { name: "Cancel" }).click();
    expect(moveCalls).toBe(0);
    await drawer.getByRole("button", { name: "Move document", exact: true }).click();
    await drawer.getByLabel("Working", { exact: true }).check();
    await drawer.getByLabel("Move Work area").selectOption("Legal");
    await drawer.getByRole("button", { name: "Move document", exact: true }).click();
    await expect(drawer.getByRole("alert")).toContainText("requires retry");
    await expect(drawer.getByLabel("Move Work area")).toHaveValue("Legal");
    await drawer.getByRole("button", { name: "Move document", exact: true }).click();
    await expect(drawer.getByText("Document moved")).toBeVisible();
    await expect(drawer).toContainText("Legal work");
    expect(moveCalls).toBe(2);

    await drawer.getByRole("button", { name: "Manage document" }).click();
    await drawer.getByRole("button", { name: "Remove document", exact: true }).click();
    await drawer.getByLabel(/Reason/).fill("Duplicate");
    await drawer.getByRole("button", { name: "Remove document", exact: true }).click();
    await expect(drawer).toHaveCount(0);
    await expect(page.getByText("Document removed")).toBeVisible();
    await expect(page.locator(".document-hub-results")).toHaveCount(0);
    expect(removeCalls).toBe(1);
});

test("read-only users do not receive an active metadata edit affordance", async ({ page }) => {
    const row = artifact("44444444-4444-4444-8444-444444444444", "read-only.txt", "Working", "Projects");
    await page.route("**/api/artifacts?*", route => route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ artifacts: [row], total: 1, page: 1, pageSize: 10 }) }));
    await page.route("**/api/artifacts/metadata/options", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(metadataOptions) }));
    await mockAuth(page);
    await page.route("**/api/me", route => route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ ...PREVIEW_USER, userRecord: { ...PREVIEW_USER.userRecord, role: "Viewer" } }) }));
    await page.goto("/documents", { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.getByRole("button", { name: /Find Documents/ }).click();
    await page.locator(".document-hub-results > button").click();
    const drawer = page.getByRole("dialog", { name: "Document details" });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole("button", { name: "Edit details" })).toBeHidden();
    await expect(drawer.getByRole("button", { name: "Manage document" })).toHaveCount(0);
});

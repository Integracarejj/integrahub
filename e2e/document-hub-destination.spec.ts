import { test, expect, mockAuth } from "./helpers/auth";

const textDocument = (name: string) => ({ name, mimeType: "text/plain", buffer: Buffer.from("document") });
const artifact = (id: string, fileName: string, storageDestination: "Working" | "Knowledge", libraryKey: "Projects" | null, uploadedAt = "2026-08-27T12:00:00.000Z") => ({
    id, fileName, extension: "txt", contentType: "text/plain", size: 8,
    ingestionState: "Uploaded", classificationState: "Unclassified", lifecycleState: "Active",
    storageDestination, libraryKey, sourceOrigin: "Internal Artifact Upload", sourceModule: "ArtifactHub",
    sourceContext: null, description: null, effectiveDate: null, submittedByUserId: "user-e2e",
    uploadedAt, createdAt: uploadedAt, updatedAt: uploadedAt,
});

test("Document Hub presents business destinations and Working-only routing", async ({ page }) => {
    const listQueries: string[] = [];
    await page.route("**/api/artifacts?*", async route => {
        const q = new URL(route.request().url()).searchParams.get("q") || "";
        listQueries.push(q);
        const rows = [
            artifact("11111111-1111-4111-8111-111111111111", "working.txt", "Working", "Projects"),
            artifact("22222222-2222-4222-8222-222222222222", "knowledge.txt", "Knowledge", null),
        ].filter(item => item.fileName.includes(q));
        if (q === "working") await new Promise(resolve => setTimeout(resolve, 700));
        return route.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({ artifacts: rows, total: rows.length, page: 1, pageSize: 10 }),
    }); });
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
    await page.locator(".document-hub-file-row").first().locator("select").selectOption("Projects");
    await expect(page.getByText("Set work area for all Working documents")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Store 2 documents" })).toBeEnabled();
    await page.screenshot({ path: "test-results/document-hub-destination.png", fullPage: true });

    await page.getByRole("button", { name: /Find Documents/ }).click();
    await expect(page.getByText("Working · Project work")).toBeVisible();
    await expect(page.locator(".document-hub-results > button").filter({ hasText: "knowledge.txt" })).toContainText("Knowledge");
    await expect(page.getByLabel("Availability")).toContainText("Working");
    await expect(page.getByLabel("Availability")).toContainText("Knowledge");
    await page.locator(".document-hub-results > button").filter({ hasText: "working.txt" }).click();
    const drawer = page.getByRole("dialog", { name: "Document details" });
    await expect(drawer).toBeVisible();
    await expect(drawer).toContainText("working.txt");
    await expect(drawer.getByRole("button", { name: "Download" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(drawer).toHaveCount(0);

    const search = page.getByLabel("Search documents");
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
});

test("successful upload opens a refreshed newest-first Find list", async ({ page }) => {
    const older = artifact("11111111-1111-4111-8111-111111111111", "older.txt", "Working", "Projects");
    const newest = artifact("33333333-3333-4333-8333-333333333333", "newest.txt", "Knowledge", null, "2026-08-28T12:00:00.000Z");
    let uploaded = false;
    const listRequests: string[] = [];
    await page.route("**/api/artifacts", route => route.request().method() === "POST"
        ? (uploaded = true, route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ artifact: newest }) }))
        : route.fallback());
    await page.route("**/api/artifacts?*", route => {
        listRequests.push(route.request().url());
        const rows = uploaded ? [newest, older] : [older];
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ artifacts: rows, total: rows.length, page: 1, pageSize: 10 }) });
    });
    await mockAuth(page);
    await page.goto("/documents", { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.locator("#document-hub-file").setInputFiles(textDocument("newest.txt"));
    await page.locator(".document-hub-file-row").getByRole("radio", { name: "Knowledge" }).check();
    await page.getByRole("button", { name: "Store 1 document" }).click();
    await expect(page.getByText("Document stored successfully")).toBeVisible();
    await page.getByRole("button", { name: "View in Find Documents" }).click();
    await expect(page.locator(".document-hub-results > button").first()).toContainText("newest.txt");
    await expect(page.getByText("2 documents found")).toBeVisible();
    expect(listRequests.length).toBeGreaterThan(0);
    expect(new URL(listRequests[0]).searchParams.get("pageSize")).toBe("10");
    expect(new URL(listRequests[0]).searchParams.get("sort")).toBe("newest");
});

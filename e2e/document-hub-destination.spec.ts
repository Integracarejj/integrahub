import { test, expect, mockAuth } from "./helpers/auth";

const textDocument = (name: string) => ({ name, mimeType: "text/plain", buffer: Buffer.from("document") });

test("Document Hub presents business destinations and Working-only routing", async ({ page }) => {
    const artifact = (id: string, fileName: string, storageDestination: "Working" | "Knowledge", libraryKey: "Projects" | null) => ({
        id, fileName, extension: "txt", contentType: "text/plain", size: 8,
        ingestionState: "Uploaded", classificationState: "Unclassified", lifecycleState: "Active",
        storageDestination, libraryKey, sourceOrigin: "Internal Artifact Upload", sourceModule: "ArtifactHub",
        sourceContext: null, description: null, effectiveDate: null, submittedByUserId: "user-e2e",
        uploadedAt: "2026-08-27T12:00:00.000Z", createdAt: "2026-08-27T12:00:00.000Z", updatedAt: "2026-08-27T12:00:00.000Z",
    });
    await page.route("**/api/artifacts?*", route => route.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({ artifacts: [
            artifact("11111111-1111-4111-8111-111111111111", "working.txt", "Working", "Projects"),
            artifact("22222222-2222-4222-8222-222222222222", "knowledge.txt", "Knowledge", null),
        ], total: 2, page: 1, pageSize: 25 }),
    }));
    await mockAuth(page);
    await page.goto("/documents", { waitUntil: "domcontentloaded", timeout: 90_000 });
    await expect(page.locator("#root")).toBeVisible();

    await expect(page.getByText("Drop documents here")).toBeVisible();
    await expect(page.locator(".document-hub-staging")).toHaveCount(0);
    await expect(page.locator(".document-hub-dropzone")).toHaveCSS("background-color", "rgb(255, 255, 255)");

    await page.locator("#document-hub-file").setInputFiles(textDocument("one.txt"));
    const row = page.locator(".document-hub-file-row").first();
    await expect(row.getByText("Where should this document be available?")).toBeVisible();
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
});

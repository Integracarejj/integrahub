import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import DocumentHubPage, { StoredDocumentConfirmation } from "../pages/documents/DocumentHubPage";
import DocumentHubFind, { FIND_PAGE_SIZE, SEARCH_DEBOUNCE_MS } from "../pages/documents/DocumentHubFind";
import { addDocumentFiles, applyDestinationToAll, beginDocumentUpload, BUSINESS_DESTINATIONS, canSubmitDocument, canUploadBatch, completeDocumentUpload, documentStatusLabel, EMPTY_UPLOAD_STATE, failDocumentUpload, internalWorkUseLabel, markDocumentFailed, markDocumentUploaded, MAX_DOCUMENT_BYTES, readyDocuments, removeDocumentFile, removeStagedDocument, selectDocumentFile, setDocumentBusinessDestination, setDocumentDestination, shouldShowBulkWorkAreaControl, storeButtonLabel, uploadDocumentsSequentially, validateDocumentFile, WORK_AREA_PLACEHOLDER } from "../pages/documents/documentHubState";
import { ArtifactUploadError, downloadArtifact, listArtifacts, uploadArtifact, type ArtifactRecord } from "../services/artifactPersistence";
import { shouldRedirectFromInternal } from "../utils/accessRouting";
import { INTERNAL_NAV_ITEMS } from "../navigation/internalNavigation";

const responseArtifact: ArtifactRecord = {
    id: "11111111-1111-4111-8111-111111111111", fileName: "report.txt", extension: "txt",
    contentType: "text/plain", size: 6, ingestionState: "Uploaded", classificationState: "Unclassified",
    lifecycleState: "Active", storageDestination: "Working", libraryKey: "Projects",
    sourceOrigin: "Internal Artifact Upload", sourceModule: "ArtifactHub", sourceContext: null,
    description: null, effectiveDate: null, submittedByUserId: "editor", uploadedAt: "now", createdAt: "now", updatedAt: "now",
};

function textFile(name = "report.txt", body = "report") {
    return new File([body], name, { type: "text/plain" });
}

describe("Document Hub shell and navigation", () => {
    it("uses business destinations as the primary model and reserves Work area for Working", () => {
        expect(BUSINESS_DESTINATIONS).toEqual([
            { value: "Working", description: "Active internal work and collaboration.", enabled: true },
            { value: "Knowledge", description: "Trusted internal reference.", enabled: true },
            { value: "External", description: "Controlled sharing with an approved transaction/project.", enabled: false, note: "Coming next" },
        ]);
    });

    it("renders the Provide/Find shell and browse upload affordance", () => {
        const html = renderToStaticMarkup(<DocumentHubPage />);
        expect(html).toContain("Document Hub");
        expect(html).toContain("Provide Documents");
        expect(html).toContain("Find Documents");
        expect(html).toContain("Drop documents here");
        expect(html).toContain("Browse files");
        expect(html).toContain("Up to 10 MiB each");
        expect(html).toContain("Add documents");
        expect(html).toContain("Prepare");
        expect(html).toContain("Store");
        expect(html).toContain("Add documents for internal work, choose where they belong, then store them.");
        expect(html).not.toContain("document-hub-use-context");
        expect(html).not.toContain("Set work area for all documents");
        expect(html).toContain("multiple");
        expect(html).not.toContain("Secure Working storage");
        expect(html).not.toContain("Replace");
        expect(html).not.toContain("SharePoint item ID");
        expect(html).not.toContain("document-hub-eyebrow");
        expect(html).not.toContain(" Working");
        expect(html).not.toContain(">Area<");
        expect(html).not.toContain("Staged documents");
        expect(html).not.toContain("Needs area");
        expect(html).not.toContain("Artifact ID");
    });

    it("renders the authoritative Find controls with loading state and no raw Graph identity", () => {
        const html = renderToStaticMarkup(<DocumentHubFind />);
        expect(html).toContain("Search documents");
        expect(html).toContain("Availability");
        expect(html).toContain("Knowledge");
        expect(html).toContain("All work areas");
        expect(html).toContain("Project work");
        expect(html).toContain("All types");
        expect(html).toContain("Newest uploaded");
        expect(html).toContain("Loading documents");
        expect(html).not.toContain("driveId");
        expect(html).not.toContain("itemId");
        expect(html).not.toContain("webUrl");
        expect(html).not.toContain(">Projects<");
        expect(html).not.toContain(">Legal<");
        expect(html).not.toContain(">Operations<");
        expect(html).not.toContain("Artifact ID");
        expect(html).not.toContain("Internal Artifact Upload");
        expect(FIND_PAGE_SIZE).toBe(10);
        expect(SEARCH_DEBOUNCE_MS).toBe(300);
    });

    it("maps business-facing internal work uses to the unchanged backend routing keys", () => {
        expect(WORK_AREA_PLACEHOLDER).toBe("Choose a work area");
        expect(internalWorkUseLabel("Projects")).toBe("Project work");
        expect(internalWorkUseLabel("Legal")).toBe("Legal work");
        expect(internalWorkUseLabel("Operations")).toBe("Operational work");
    });

    it("shows bulk work-area assignment only when at least two documents are staged", () => {
        let sequence = 0;
        const staged = addDocumentFiles([], [textFile("one.txt"), textFile("two.txt")], () => `key-${++sequence}`);
        expect(shouldShowBulkWorkAreaControl([])).toBe(false);
        expect(shouldShowBulkWorkAreaControl(staged.slice(0, 1))).toBe(false);
        expect(shouldShowBulkWorkAreaControl(staged)).toBe(false);
        const working = staged.reduce((items, item) => setDocumentBusinessDestination(items, item.id, "Working", () => `key-${++sequence}`), staged);
        expect(shouldShowBulkWorkAreaControl(working)).toBe(true);
    });

    it("adds /documents without replacing existing internal navigation and keeps external users out of the internal tree", () => {
        expect(INTERNAL_NAV_ITEMS).toEqual(expect.arrayContaining([
            expect.objectContaining({ to: "/documents", label: "Document Hub" }),
            expect.objectContaining({ to: "/recapitalization", label: "Recapitalization" }),
            expect.objectContaining({ to: "/applications", label: "Systems" }),
        ]));
        expect(new Set(INTERNAL_NAV_ITEMS.map(item => item.to)).size).toBe(INTERNAL_NAV_ITEMS.length);
        expect(shouldRedirectFromInternal("ExternalBroker")).toBe(true);
        expect(shouldRedirectFromInternal("ExternalBuyer")).toBe(true);
        expect(shouldRedirectFromInternal("Editor")).toBe(false);
    });
});

describe("Document Hub multi-document staging", () => {
    it("renders unmistakable Working and Knowledge completion details with the Find next step", () => {
        let sequence = 0;
        const generate = () => `key-${++sequence}`;
        const staged = addDocumentFiles([], [textFile("operations.txt"), textFile("knowledge.txt")], generate);
        const working = setDocumentDestination(setDocumentBusinessDestination(staged, staged[0].id, "Working", generate), staged[0].id, "Operations", generate);
        const destinations = setDocumentBusinessDestination(working, staged[1].id, "Knowledge", generate);
        const completed = markDocumentUploaded(markDocumentUploaded(destinations, staged[0].id, responseArtifact), staged[1].id, { ...responseArtifact, storageDestination: "Knowledge", libraryKey: null });

        const workingHtml = renderToStaticMarkup(<StoredDocumentConfirmation item={completed[0]} onView={() => undefined} />);
        expect(workingHtml).toContain("Document stored successfully");
        expect(workingHtml).toContain("operations.txt");
        expect(workingHtml).toContain("Working · Operational work");
        expect(workingHtml).toContain("Your document is now available in Document Hub.");
        expect(workingHtml).toContain("View in Find Documents");

        const knowledgeHtml = renderToStaticMarkup(<StoredDocumentConfirmation item={completed[1]} onView={() => undefined} />);
        expect(knowledgeHtml).toContain("Document stored successfully");
        expect(knowledgeHtml).toContain("knowledge.txt");
        expect(knowledgeHtml).toContain("Available in: <b>Knowledge</b>");
        expect(knowledgeHtml).not.toContain("work area");
        expect(knowledgeHtml).toContain("View in Find Documents");
    });

    it("submits only a new Ready Knowledge document beside a Stored Working document", async () => {
        let sequence = 0;
        const generate = () => `key-${++sequence}`;
        const staged = addDocumentFiles([], [textFile("stored.txt"), textFile("ready.txt")], generate);
        const working = setDocumentDestination(setDocumentBusinessDestination(staged, staged[0].id, "Working", generate), staged[0].id, "Operations", generate);
        const mixed = setDocumentBusinessDestination(working, staged[1].id, "Knowledge", generate);
        const items = markDocumentUploaded(mixed, staged[0].id, responseArtifact);
        const upload = vi.fn(async (_item: (typeof items)[number]) => ({ ...responseArtifact, storageDestination: "Knowledge" as const, libraryKey: null }));

        expect(readyDocuments(items)).toHaveLength(1);
        expect(storeButtonLabel(items, false)).toBe("Store 1 document");
        expect(readyDocuments(items)[0].file.name).toBe("ready.txt");
        await uploadDocumentsSequentially(items, upload, () => undefined, () => undefined, () => undefined);
        expect(upload).toHaveBeenCalledOnce();
        expect(upload.mock.calls[0][0].file.name).toBe("ready.txt");
    });

    it("labels a batch of two Ready documents with the exact submission count", () => {
        let sequence = 0;
        const generate = () => `key-${++sequence}`;
        const staged = addDocumentFiles([], [textFile("one.txt"), textFile("two.txt")], generate);
        const ready = staged.reduce((items, item) => setDocumentBusinessDestination(items, item.id, "Knowledge", generate), staged);
        expect(readyDocuments(ready)).toHaveLength(2);
        expect(storeButtonLabel(ready, false)).toBe("Store 2 documents");
    });

    it("stages valid and invalid browse/drop selections independently with distinct attempt keys", () => {
        let sequence = 0;
        const generate = () => `key-${++sequence}`;
        const staged = addDocumentFiles([], [textFile("contract.txt"), new File(["x"], "installer.exe", { type: "application/octet-stream" }), textFile("notes.txt")], generate);
        expect(staged.map(item => item.file.name)).toEqual(["contract.txt", "installer.exe", "notes.txt"]);
        expect(staged.map(item => item.phase)).toEqual(["ready", "invalid", "ready"]);
        expect(staged[1].validationError).toMatch(/not supported/i);
        expect(new Set(staged.map(item => item.idempotencyKey)).size).toBe(3);
        const dropped = addDocumentFiles(staged, [textFile("drop.txt")], generate);
        expect(dropped).toHaveLength(4);
    });

    it("rejects an oversized file individually without discarding a valid neighbor", () => {
        const oversized = new File([new Uint8Array(MAX_DOCUMENT_BYTES + 1)], "large.txt", { type: "text/plain" });
        let sequence = 0;
        const staged = addDocumentFiles([], [textFile(), oversized], () => `key-${++sequence}`);
        expect(staged[0].phase).toBe("ready");
        expect(staged[1]).toMatchObject({ phase: "invalid", validationError: expect.stringMatching(/10 MiB/i) });
    });

    it("supports bulk destinations, individual override, and rotates identity only when destination changes", () => {
        let sequence = 0;
        const generate = () => `key-${++sequence}`;
        const staged = addDocumentFiles([], [textFile("one.txt"), textFile("two.txt")], generate);
        const working = staged.reduce((items, item) => setDocumentBusinessDestination(items, item.id, "Working", generate), staged);
        const bulk = applyDestinationToAll(working, "Projects", generate);
        expect(bulk.map(item => item.destination)).toEqual(["Projects", "Projects"]);
        const bulkKeys = bulk.map(item => item.idempotencyKey);
        const overridden = setDocumentDestination(bulk, bulk[1].id, "Legal", generate);
        expect(overridden.map(item => item.destination)).toEqual(["Projects", "Legal"]);
        expect(overridden[0].idempotencyKey).toBe(bulkKeys[0]);
        expect(overridden[1].idempotencyKey).not.toBe(bulkKeys[1]);
        expect(documentStatusLabel(staged[0])).toBe("Choose a destination.");
        expect(documentStatusLabel(working[0])).toBe("Choose a work area.");
        expect(documentStatusLabel(bulk[0])).toBe("Ready");
    });

    it("allows Knowledge without Work area and keeps mixed staging independent", () => {
        let sequence = 0;
        const generate = () => `key-${++sequence}`;
        const staged = addDocumentFiles([], [textFile("working.txt"), textFile("knowledge.txt")], generate);
        const working = setDocumentBusinessDestination(staged, staged[0].id, "Working", generate);
        const mixed = setDocumentBusinessDestination(working, staged[1].id, "Knowledge", generate);
        const ready = setDocumentDestination(mixed, staged[0].id, "Projects", generate);
        expect(ready[1]).toMatchObject({ businessDestination: "Knowledge", destination: "" });
        expect(documentStatusLabel(ready[1])).toBe("Ready");
        expect(canUploadBatch(ready, false)).toBe(true);
        expect(shouldShowBulkWorkAreaControl(ready)).toBe(false);
    });

    it("removes only the selected item and suppresses obvious same-session duplicates", () => {
        let sequence = 0;
        const generate = () => `key-${++sequence}`;
        const file = textFile("same.txt");
        const staged = addDocumentFiles([], [file, file], generate);
        expect(staged).toHaveLength(1);
        const withSecond = addDocumentFiles(staged, [textFile("other.txt")], generate);
        expect(removeStagedDocument(withSecond, staged[0].id).map(item => item.file.name)).toEqual(["other.txt"]);
    });

    it("requires every ready file destination and preserves partial success plus failed retry identity", () => {
        let sequence = 0;
        const generate = () => `key-${++sequence}`;
        const staged = addDocumentFiles([], [textFile("one.txt"), textFile("two.txt")], generate);
        const working = staged.reduce((items, item) => setDocumentBusinessDestination(items, item.id, "Working", generate), staged);
        const oneAssigned = setDocumentDestination(working, working[0].id, "Projects", generate);
        expect(canUploadBatch(oneAssigned, false)).toBe(false);
        const ready = applyDestinationToAll(oneAssigned, "Projects", generate);
        expect(canUploadBatch(ready, false)).toBe(true);
        expect(readyDocuments(ready)).toHaveLength(2);
        const failedKey = ready[1].idempotencyKey;
        const partial = markDocumentFailed(markDocumentUploaded(ready, ready[0].id, responseArtifact), ready[1].id, "Temporary failure");
        expect(partial.map(item => item.phase)).toEqual(["uploaded", "failed"]);
        expect(partial[1].idempotencyKey).toBe(failedKey);
        expect(readyDocuments(partial)).toHaveLength(0);
    });

    it("issues one sequential request per ready file and preserves partial results", async () => {
        let sequence = 0;
        const generate = () => `key-${++sequence}`;
        const added = addDocumentFiles([], [textFile("one.txt"), textFile("two.txt")], generate);
        const working = added.reduce((items, item) => setDocumentBusinessDestination(items, item.id, "Working", generate), added);
        const staged = applyDestinationToAll(working, "Projects", generate);
        const active = { count: 0, maximum: 0 };
        const upload = vi.fn(async (item: (typeof staged)[number]) => {
            active.count += 1; active.maximum = Math.max(active.maximum, active.count);
            await Promise.resolve();
            active.count -= 1;
            if (item.file.name === "two.txt") throw new Error("failed");
            return responseArtifact;
        });
        const successes: string[] = [];
        const failures: string[] = [];
        await uploadDocumentsSequentially(staged, upload, () => undefined, item => successes.push(item.id), item => failures.push(item.id));
        expect(upload).toHaveBeenCalledTimes(2);
        expect(upload.mock.calls.map(([item]) => item.idempotencyKey)).toEqual(staged.map(item => item.idempotencyKey));
        expect(active.maximum).toBe(1);
        expect(successes).toEqual([staged[0].id]);
        expect(failures).toEqual([staged[1].id]);
    });
});

describe("Document Hub selection and attempt state", () => {
    it("uses the same selection path for dropped and browsed files and replaces an attempt key", () => {
        const keys = ["drop-key", "browse-key"];
        const generate = () => keys.shift()!;
        const dropped = selectDocumentFile(EMPTY_UPLOAD_STATE, textFile("drop.txt"), generate);
        const browsed = selectDocumentFile(dropped, textFile("browse.txt"), generate);
        expect(dropped.file?.name).toBe("drop.txt");
        expect(dropped.idempotencyKey).toBe("drop-key");
        expect(browsed.file?.name).toBe("browse.txt");
        expect(browsed.idempotencyKey).toBe("browse-key");
        expect(browsed.validationError).toBeNull();
    });

    it("rejects unsupported and oversized files before upload", () => {
        expect(validateDocumentFile(new File(["x"], "malware.exe", { type: "application/octet-stream" }))).toMatch(/not supported/i);
        const oversized = new File([new Uint8Array(MAX_DOCUMENT_BYTES + 1)], "large.txt", { type: "text/plain" });
        expect(validateDocumentFile(oversized)).toMatch(/10 MiB/i);
    });

    it("requires destination, blocks double submit, retains retry key, and resets cleanly", () => {
        const selected = selectDocumentFile(EMPTY_UPLOAD_STATE, textFile(), () => "stable-attempt-key");
        expect(canSubmitDocument(selected)).toBe(false);
        const ready = { ...selected, destination: "Projects" as const };
        expect(canSubmitDocument(ready)).toBe(true);
        const uploading = beginDocumentUpload(ready);
        expect(uploading.phase).toBe("uploading");
        expect(canSubmitDocument(uploading)).toBe(false);
        const failed = failDocumentUpload(uploading, "Temporary failure");
        expect(failed.uploadError).toBe("Temporary failure");
        expect(failed.idempotencyKey).toBe("stable-attempt-key");
        expect(canSubmitDocument(failed)).toBe(true);
        const succeeded = completeDocumentUpload(failed, responseArtifact);
        expect(succeeded.artifact?.id).toBe(responseArtifact.id);
        expect(removeDocumentFile(succeeded)).toMatchObject({ file: null, idempotencyKey: null, phase: "empty", artifact: null });
    });
});

describe("Artifact Hub browser API integration", () => {
    it("lists authoritative artifacts with search, filters, pagination, and newest-first sorting", async () => {
        const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ artifacts: [responseArtifact], total: 26, page: 2, pageSize: 25 }), { headers: { "Content-Type": "application/json" } }));
        const result = await listArtifacts({ q: "report", libraryKey: "Projects", fileType: "text", dateRange: "7days", sort: "newest", page: 2, pageSize: 25 }, fetchMock as typeof fetch);
        expect(result.total).toBe(26);
        const [path, init] = fetchMock.mock.calls[0];
        expect(path).toContain("/api/artifacts?"); expect(path).toContain("q=report"); expect(path).toContain("libraryKey=Projects");
        expect(path).toContain("fileType=text"); expect(path).toContain("dateRange=7days"); expect(path).toContain("sort=newest"); expect(path).toContain("page=2");
        expect(init).toMatchObject({ credentials: "include", cache: "no-store" });
        expect(result.artifacts[0]).not.toHaveProperty("driveId");
    });

    it("downloads through the application endpoint with the safe display filename and normalizes failures", async () => {
        const save = vi.fn();
        const fetchMock = vi.fn(async () => new Response(new Blob(["document"]), { status: 200, headers: { "Content-Type": "text/plain" } }));
        await downloadArtifact(responseArtifact.id, "report.txt", fetchMock as typeof fetch, save);
        expect(fetchMock).toHaveBeenCalledWith(`/api/artifacts/${responseArtifact.id}/content`, { credentials: "include" });
        expect(save).toHaveBeenCalledWith(expect.any(Blob), "report.txt");
        const failed = vi.fn(async () => new Response(JSON.stringify({ error: "Download unavailable" }), { status: 502, headers: { "Content-Type": "application/json" } }));
        await expect(downloadArtifact(responseArtifact.id, "report.txt", failed as typeof fetch, save)).rejects.toMatchObject({ message: "Download unavailable", status: 502 });
    });

    it("sends raw file bytes and required headers with one stable idempotency key", async () => {
        const file = textFile();
        const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ artifact: responseArtifact }), {
            status: 201, headers: { "Content-Type": "application/json" },
        }));
        const result = await uploadArtifact(file, "Working", "Projects", "stable-attempt-key", fetchMock as typeof fetch);
        expect(result.id).toBe(responseArtifact.id);
        expect(fetchMock).toHaveBeenCalledOnce();
        const [path, init] = fetchMock.mock.calls[0];
        expect(path).toBe("/api/artifacts");
        expect(init?.method).toBe("POST");
        expect(init?.body).toBe(file);
        expect(init?.headers).toMatchObject({
            "Content-Type": "application/octet-stream", "X-File-Name": "report.txt",
            "X-File-Content-Type": "text/plain", "X-Artifact-Destination": "Working", "X-Artifact-Work-Area": "Projects",
            "Idempotency-Key": "stable-attempt-key",
        });
    });

    it("normalizes backend and network failures into persistent-safe messages", async () => {
        const backendFailure = vi.fn(async () => new Response(JSON.stringify({ error: "Artifact storage collision prevented upload" }), { status: 409, headers: { "Content-Type": "application/json" } }));
        await expect(uploadArtifact(textFile(), "Working", "Projects", "stable-attempt-key", backendFailure as typeof fetch))
            .rejects.toMatchObject({ name: "ArtifactUploadError", message: "Artifact storage collision prevented upload", status: 409 });
        const networkFailure = vi.fn(async () => { throw new Error("private network detail"); });
        await expect(uploadArtifact(textFile(), "Working", "Projects", "stable-attempt-key", networkFailure as typeof fetch))
            .rejects.toEqual(expect.objectContaining<Partial<ArtifactUploadError>>({ message: expect.not.stringContaining("private network detail") }));
    });
});

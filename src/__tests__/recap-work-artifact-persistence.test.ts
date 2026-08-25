import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadAuthoritativeArtifact, downloadAuthoritativeSourceDocument } from "../services/recapWorkArtifactPersistence";

describe("authoritative artifact browser downloads", () => {
    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it.each([
        ["artifact", () => downloadAuthoritativeArtifact("work-1", "artifact-1", "report.docx"), "/api/recapitalization/work-items/work-1/artifacts/artifact-1/content", "report.docx"],
        ["source", () => downloadAuthoritativeSourceDocument("work-1", "source-1", "source.docx"), "/api/recapitalization/work-items/work-1/source-documents/source-1/content", "source.docx"],
    ])("attaches and clicks the rendered %s download before delayed URL cleanup", async (_kind, invoke, expectedPath, expectedName) => {
        vi.useFakeTimers();
        const click = vi.fn();
        const remove = vi.fn();
        const anchor = { href: "", download: "", style: { display: "" }, click, remove };
        const appendChild = vi.fn();
        const revokeObjectURL = vi.fn();
        vi.stubGlobal("localStorage", { getItem: vi.fn(() => null) });
        vi.stubGlobal("document", { createElement: vi.fn(() => anchor), body: { appendChild } });
        vi.stubGlobal("window", { setTimeout });
        vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:artifact"), revokeObjectURL });
        const fetchMock = vi.fn(async () => ({ ok: true, blob: async () => new Blob(["file"]) }));
        vi.stubGlobal("fetch", fetchMock);

        await invoke();

        expect(fetchMock).toHaveBeenCalledWith(expectedPath, expect.objectContaining({ credentials: "include" }));
        expect(anchor.download).toBe(expectedName);
        expect(anchor.href).toBe("blob:artifact");
        expect(appendChild).toHaveBeenCalledWith(anchor);
        expect(click).toHaveBeenCalledOnce();
        expect(remove).toHaveBeenCalledOnce();
        expect(revokeObjectURL).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1000);
        expect(revokeObjectURL).toHaveBeenCalledWith("blob:artifact");
    });
});

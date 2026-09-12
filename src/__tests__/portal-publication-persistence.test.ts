import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { loadAuthoritativePublication, loadAuthoritativePublications, decideAuthoritativePublication,
    type AuthoritativePublication } from "../services/portalPublicationPersistence";

beforeEach(() => vi.stubGlobal("localStorage", { getItem: () => null }));
afterEach(() => vi.unstubAllGlobals());

it("loads a publication by edition ID and sends its version for partner decisions without an organization override", async () => {
    const publication = { id: "edition-1", version: "0x0000000000000001", externalOrganizationId: "TEST-BROKER-ORG" } as AuthoritativePublication;
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ publication }) });
    vi.stubGlobal("fetch", fetchMock);
    expect(await loadAuthoritativePublication("edition-1")).toEqual(publication);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/portal/recapitalization/publications/edition-1");
    for (const action of ["approve", "rework"] as const) {
        await decideAuthoritativePublication(publication, action, action === "rework" ? "Revise" : undefined);
        const options = fetchMock.mock.lastCall?.[1] as RequestInit;
        expect(JSON.parse(String(options.body))).toEqual(action === "rework"
            ? { action, guidance: "Revise", expectedVersion: publication.version } : { action, expectedVersion: publication.version });
        expect(options.credentials).toBe("include");
    }
});

it("fails closed on list/detail/decision errors instead of returning demo records", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Publication not found" }) }));
    await expect(loadAuthoritativePublications()).rejects.toThrow("Publication not found");
    await expect(loadAuthoritativePublication("foreign-edition")).rejects.toThrow("Publication not found");
    await expect(decideAuthoritativePublication({ id: "foreign-edition", version: "0x0000000000000001" } as AuthoritativePublication, "approve")).rejects.toThrow("Publication not found");
});

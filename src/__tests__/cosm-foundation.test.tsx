import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import CosmHomePage from "../pages/cosm/CosmHomePage";
import { INTERNAL_NAV_ITEMS } from "../components/Sidebar";
import { shouldRedirectFromInternal } from "../utils/accessRouting";

describe("COSM internal foundation", () => {
    it("renders the minimal COSM foundation page", () => {
        const markup = renderToStaticMarkup(<CosmHomePage />);
        expect(markup).toContain(">COSM<");
        expect(markup).toContain("Centralized access to IntegraCare operational standards and knowledge.");
        expect(markup).not.toContain("upload");
    });

    it("appears once in internal navigation", () => {
        expect(INTERNAL_NAV_ITEMS.filter(item => item.to === "/cosm")).toEqual([
            expect.objectContaining({ label: "COSM" }),
        ]);
    });

    it.each(["ExternalBroker", "ExternalBuyer"])("keeps %s outside internal COSM routes", role => {
        expect(shouldRedirectFromInternal(role)).toBe(true);
    });

    it.each(["PlatformAdmin", "Editor", "Viewer", "DDTeam"])("allows internal role %s through the internal boundary", role => {
        expect(shouldRedirectFromInternal(role)).toBe(false);
    });
});

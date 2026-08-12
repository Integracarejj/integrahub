import { test, expect, gotoApp } from "./helpers/auth";

/**
 * Diagnostics Session Recorder UI lifecycle — Settings page only.
 *
 * Drives the four controls (Clear / Start / End / Start-again) on
 * /recapitalization/settings and verifies the UI re-renders immediately
 * (no page refresh) AND that persisted localStorage state matches what the
 * UI shows after each transition. Does NOT exercise the recap workflow.
 */

const DIAG_CARD = /Diagnostics Session Recorder/i;
const SESSION_KEY = "integrasource.recap.diagSession";

test("Settings diagnostics controls: Clear → Start → End → Start-again → Clear stay in sync with localStorage", async ({ page }) => {
    await gotoApp(page, "/recapitalization/settings");

    const diagCard = page.locator(".rc-card", { hasText: DIAG_CARD });
    const badge = diagCard.locator(".rc-badge").first();
    const sessionId = () => diagCard.locator("strong").first().textContent().then(t => (t ?? "").trim());

    const storedSession = () =>
        page.evaluate((k) => {
            const raw = localStorage.getItem(k);
            if (!raw) return null;
            try {
                return JSON.parse(raw) as { id: string; endedAt: string | null; eventCount: number; events: unknown[] };
            } catch {
                return null;
            }
        }, SESSION_KEY);

    /* ── 1. Clean slate ── */
    await diagCard.getByRole("button", { name: "Clear" }).click();
    await expect(badge).toHaveText("No Active Session");
    expect(await storedSession()).toBeNull();

    /* ── 2. Start Diagnostics Session ── */
    await diagCard.getByRole("button", { name: "Start Diagnostics Session" }).click();
    await expect(badge).toHaveText(/Session Active · /);
    await expect(diagCard).toContainText(/diag-\d{10,}-[a-z0-9]+/);
    await expect(diagCard).toContainText(/recording…/);
    const id1 = await sessionId();
    expect(id1).toMatch(/^diag-/);
    console.log("DIAG-ID1", id1);
    const afterStart = await storedSession();
    expect(afterStart, "started session not persisted").toBeTruthy();
    expect(afterStart!.id).toBe(id1);
    expect(afterStart!.endedAt).toBeNull();
    expect(afterStart!.events[0]?.type).toBe("SESSION_START");

    /* ── 3. End Diagnostics Session ── */
    await diagCard.getByRole("button", { name: "End Diagnostics Session" }).click();
    await expect(badge).toHaveText(/Session Ended · /);
    await expect(diagCard).toContainText(/frozen — export to save/);
    expect(await sessionId()).toBe(id1);
    const afterEnd = await storedSession();
    expect(afterEnd, "ended session not persisted").toBeTruthy();
    expect(afterEnd!.id).toBe(id1);
    expect(afterEnd!.endedAt).toBeTruthy();
    expect(afterEnd!.events.some(e => e.type === "SESSION_END")).toBe(true);

    /* ── 4. Start Diagnostics Session again (must NOT reuse the ended session) ── */
    await diagCard.getByRole("button", { name: "Start Diagnostics Session" }).click();
    await expect(badge).toHaveText(/Session Active · /);
    await expect(diagCard).toContainText(/recording…/);
    const id2 = await sessionId();
    expect(id2).toMatch(/^diag-/);
    expect(id2).not.toBe(id1);
    console.log("DIAG-ID2", id2, "DIAG-ID2-DISTINCT", id2 !== id1);
    const afterRestart = await storedSession();
    expect(afterRestart, "restarted session not persisted").toBeTruthy();
    expect(afterRestart!.id).toBe(id2);
    expect(afterRestart!.endedAt).toBeNull();

    /* ── 5. Clear ── */
    await diagCard.getByRole("button", { name: "Clear" }).click();
    await expect(badge).toHaveText("No Active Session");
    expect(await storedSession()).toBeNull();
});

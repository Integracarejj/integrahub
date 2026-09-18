import { afterEach, describe, expect, it, vi } from "vitest";
import { AUTHORITATIVE_REVALIDATE_EVENT, AUTHORITATIVE_REVALIDATION_INTERVAL_MS, createAuthoritativeRevalidationController } from "../hooks/useAuthoritativeRevalidation";

function target() {
    let visibilityState: "visible" | "hidden" = "visible";
    const listeners = new Map<string, Set<() => void>>();
    const add = (name: string, fn: () => void) => { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name)!.add(fn); };
    const remove = (name: string, fn: () => void) => listeners.get(name)?.delete(fn);
    const fire = (name: string) => listeners.get(name)?.forEach(fn => fn());
    const value = {
        document: { get visibilityState() { return visibilityState; }, addEventListener: add, removeEventListener: remove },
        addEventListener: add, removeEventListener: remove, setInterval, clearInterval,
        setVisible(value: "visible" | "hidden") { visibilityState = value; }, fire,
    } as unknown as Window & { setVisible: (value: "visible" | "hidden") => void; fire: (name: string) => void };
    return value;
}

describe("authoritative revalidation controller", () => {
    afterEach(() => vi.useRealTimers());

    it("waits for the configured 20-second visible cadence and does not refresh on mount", () => {
        vi.useFakeTimers();
        const calls = vi.fn(async () => undefined);
        const controller = createAuthoritativeRevalidationController(calls, target());
        controller.start();
        expect(calls).not.toHaveBeenCalled();
        vi.advanceTimersByTime(AUTHORITATIVE_REVALIDATION_INTERVAL_MS - 1);
        expect(calls).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1);
        expect(calls).toHaveBeenCalledTimes(1);
        controller.stop();
    });

    it("refreshes on visible return, focus, and shared invalidation while coalescing a burst", async () => {
        vi.useFakeTimers();
        const calls = vi.fn(async () => undefined);
        const page = target();
        const controller = createAuthoritativeRevalidationController(calls, page);
        controller.start();
        page.setVisible("hidden");
        vi.advanceTimersByTime(AUTHORITATIVE_REVALIDATION_INTERVAL_MS);
        expect(calls).not.toHaveBeenCalled();
        page.setVisible("visible");
        page.fire("visibilitychange"); page.fire("focus"); page.fire(AUTHORITATIVE_REVALIDATE_EVENT);
        expect(calls).toHaveBeenCalledTimes(1);
        await Promise.resolve();
        controller.stop();
    });

    it("prevents overlap, recovers after rejection, and cleans up after stop", async () => {
        vi.useFakeTimers();
        let resolve!: () => void;
        const pending = new Promise<void>(done => { resolve = done; });
        const calls = vi.fn(() => pending);
        const page = target();
        const controller = createAuthoritativeRevalidationController(calls, page);
        controller.start();
        vi.advanceTimersByTime(AUTHORITATIVE_REVALIDATION_INTERVAL_MS);
        page.fire("focus"); page.fire(AUTHORITATIVE_REVALIDATE_EVENT);
        expect(calls).toHaveBeenCalledTimes(1);
        resolve();
        await Promise.resolve();
        controller.stop();
        vi.advanceTimersByTime(AUTHORITATIVE_REVALIDATION_INTERVAL_MS * 2);
        page.fire("focus");
        expect(calls).toHaveBeenCalledTimes(1);
    });
});

import { useEffect, useRef } from "react";

export const AUTHORITATIVE_REVALIDATE_EVENT = "recap-authoritative-revalidate";
export const AUTHORITATIVE_REVALIDATION_INTERVAL_MS = 20_000;

export function requestAuthoritativeRevalidation() {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new Event(AUTHORITATIVE_REVALIDATE_EVENT));
}

export function createAuthoritativeRevalidationController(revalidate: () => Promise<unknown>, target: Window = window, intervalMs = AUTHORITATIVE_REVALIDATION_INTERVAL_MS) {
    let inFlight = false;
    let lastRun = 0;
    let timer: number | undefined;
    const run = () => {
        if (target.document.visibilityState === "hidden" || inFlight || Date.now() - lastRun < 750) return;
        inFlight = true; lastRun = Date.now();
        Promise.resolve(revalidate()).catch(() => undefined).finally(() => { inFlight = false; });
    };
    const onVisibility = () => { if (target.document.visibilityState === "visible") run(); };
    return {
        start() {
            target.addEventListener("focus", run);
            target.addEventListener(AUTHORITATIVE_REVALIDATE_EVENT, run);
            target.document.addEventListener("visibilitychange", onVisibility);
            timer = target.setInterval(run, intervalMs);
        },
        stop() {
            target.removeEventListener("focus", run);
            target.removeEventListener(AUTHORITATIVE_REVALIDATE_EVENT, run);
            target.document.removeEventListener("visibilitychange", onVisibility);
            if (timer !== undefined) target.clearInterval(timer);
        },
    };
}

/** Quietly refreshes authoritative GET models while a page is visible. */
export function useAuthoritativeRevalidation(revalidate: () => Promise<unknown>, enabled = true, intervalMs = 20_000) {
    const revalidateRef = useRef(revalidate);
    revalidateRef.current = revalidate;

    useEffect(() => {
        if (!enabled) return;
        const controller = createAuthoritativeRevalidationController(() => revalidateRef.current(), window, intervalMs);
        controller.start();
        return () => controller.stop();
    }, [enabled, intervalMs]);
}

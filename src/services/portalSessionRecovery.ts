export const PORTAL_SESSION_CHALLENGE = "portal-session-challenge";

const RECOVERY_ATTEMPT_KEY = "recap.portal.sessionRecoveryAt";
const RECOVERY_WINDOW_MS = 5 * 60_000;
export const PORTAL_SESSION_RECOVERY_FAILED = "Your session could not be restored. Please sign in again.";
let navigatingToSignIn = false;

export class PortalSessionRecoveryError extends Error {
    constructor(message = "Your session needs to be restored") {
        super(message);
        this.name = "PortalSessionRecoveryError";
    }
}

function currentRoute(): string {
    const path = `/${window.location.pathname.replace(/^\/+/, "")}`;
    return `${path}${window.location.search}${window.location.hash}`;
}

export function portalSignInUrl(): string {
    return `/.auth/login/aad?post_login_redirect_uri=${encodeURIComponent(currentRoute())}`;
}

export function clearPortalSessionRecoveryAttempt(): void {
    if (typeof sessionStorage !== "undefined") sessionStorage.removeItem(RECOVERY_ATTEMPT_KEY);
    navigatingToSignIn = false;
}

export function isPortalSessionRecoveryInProgress(): boolean {
    return navigatingToSignIn;
}

function recoverPortalSession(): void {
    if (navigatingToSignIn) return;
    const previousAttempt = Number(sessionStorage.getItem(RECOVERY_ATTEMPT_KEY) || 0);
    if (previousAttempt && Date.now() - previousAttempt < RECOVERY_WINDOW_MS) {
        throw new PortalSessionRecoveryError(PORTAL_SESSION_RECOVERY_FAILED);
    }
    navigatingToSignIn = true;
    sessionStorage.setItem(RECOVERY_ATTEMPT_KEY, String(Date.now()));
    window.dispatchEvent(new Event(PORTAL_SESSION_CHALLENGE));
    window.location.assign(portalSignInUrl());
}

export async function portalFetch(url: string, init?: RequestInit): Promise<Response> {
    const response = await fetch(url, { ...init, credentials: "include", redirect: "manual" });
    // Easy Auth can redirect API fetches to an interactive Entra page. A manual
    // redirect is opaque to fetch, but it remains distinguishable from a network
    // failure and can be completed by a top-level browser navigation.
    if (response.type === "opaqueredirect" || response.status === 401) {
        recoverPortalSession();
        throw new PortalSessionRecoveryError();
    }
    // A fresh /api/me identity alone does not prove that the intended portal
    // resource is usable. Clear the loop guard only after a portal API responds.
    if (url.startsWith("/api/portal/") || url.startsWith("/api/admin/recap-external-preview/")) {
        clearPortalSessionRecoveryAttempt();
    }
    return response;
}

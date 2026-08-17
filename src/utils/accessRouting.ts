const EXTERNAL_ONLY_ROLES = new Set(["ExternalBroker", "ExternalBuyer"]);

export function isExternalOnlyRole(role: string | null | undefined): boolean {
    return !!role && EXTERNAL_ONLY_ROLES.has(role);
}

export function shouldRedirectFromInternal(role: string | null | undefined): boolean {
    return isExternalOnlyRole(role);
}

export interface AuthorizedExternalOrganization {
    id: string;
    isDefault: boolean;
}

export interface AuthenticatedExternalContext {
    userId: string;
    email: string;
    displayName: string;
    role: "ExternalBroker" | "ExternalBuyer";
    organizations: AuthorizedExternalOrganization[];
    defaultOrganizationId: string | null;
}

let authenticatedExternalContext: AuthenticatedExternalContext | null = null;

export function setAuthenticatedExternalContext(context: AuthenticatedExternalContext | null): void {
    authenticatedExternalContext = context;
}

export function getAuthenticatedExternalContext(): AuthenticatedExternalContext | null {
    return authenticatedExternalContext;
}

export function isAuthenticatedExternalMode(): boolean {
    return authenticatedExternalContext !== null;
}

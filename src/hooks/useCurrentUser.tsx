import { useEffect, useState, createContext, useContext } from "react";
import { setAuthenticatedExternalContext } from "../services/portalRuntimeContext";
import { isExternalOnlyRole } from "../utils/accessRouting";
import { isPortalSessionRecoveryInProgress, portalFetch, PORTAL_SESSION_CHALLENGE } from "../services/portalSessionRecovery";

export interface UserRecord {
    id: string;
    entraObjectId: string;
    email: string;
    displayName: string;
    role: string;
}

export interface CurrentUserResponse {
    isAuthenticated: boolean;
    hasAppAccess: boolean;
    authSource: string;
    principalId: string;
    principalName: string;
    resolvedEmail: string;
    userRecord: UserRecord | null;
    accessReason: string | null;
    /** Portal role for external Recapitalization Portal users. null = not a portal user. */
    portalRole: string | null;
    /** True if the user has any portal-level role assignment. */
    isPortalUser: boolean;
    externalContext: {
        organizations: { id: string; isDefault: boolean }[];
        defaultOrganizationId: string | null;
        isConfigured: boolean;
    } | null;
}

export interface CurrentUser {
    user: CurrentUserResponse | null;
    loading: boolean;
    error: string | null;
}

const CurrentUserContext = createContext<CurrentUser>({
    user: null,
    loading: true,
    error: null,
});

export function CurrentUserProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<CurrentUserResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const onSessionChallenge = () => {
            setAuthenticatedExternalContext(null);
            setUser(null);
            setLoading(true);
            setError(null);
        };
        window.addEventListener(PORTAL_SESSION_CHALLENGE, onSessionChallenge);
        portalFetch("/api/me", { cache: "no-store" })
            .then((res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then((data) => {
                if (isExternalOnlyRole(data.userRecord?.role) && data.userRecord) {
                    setAuthenticatedExternalContext({
                        userId: data.userRecord.id,
                        email: data.userRecord.email,
                        displayName: data.userRecord.displayName || data.userRecord.email,
                        role: data.userRecord.role,
                        organizations: data.externalContext?.organizations || [],
                        defaultOrganizationId: data.externalContext?.defaultOrganizationId || null,
                    });
                } else {
                    setAuthenticatedExternalContext(null);
                }
                setUser(data);
                setError(null);
            })
            .catch((err) => {
                if (isPortalSessionRecoveryInProgress()) return;
                setAuthenticatedExternalContext(null);
                setUser(null);
                setError(err.message);
            })
            .finally(() => {
                if (!isPortalSessionRecoveryInProgress()) setLoading(false);
            });
        return () => window.removeEventListener(PORTAL_SESSION_CHALLENGE, onSessionChallenge);
    }, []);

    return (
        <CurrentUserContext.Provider value={{ user, loading, error }}>
            {children}
        </CurrentUserContext.Provider>
    );
}

export function useCurrentUser() {
    return useContext(CurrentUserContext);
}

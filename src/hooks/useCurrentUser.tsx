import { useEffect, useState, createContext, useContext } from "react";

export interface UserRecord {
    id: string;
    entraObjectId: string;
    email: string;
    displayName: string;
    role: string;
}

export interface CurrentUserResponse {
    isAuthenticated: boolean;
    authSource: string;
    principalId: string;
    principalName: string;
    resolvedEmail: string;
    userRecord: UserRecord | null;
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
        fetch("/api/me")
            .then((res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then((data) => {
                setUser(data);
                setError(null);
            })
            .catch((err) => {
                setError(err.message);
            })
            .finally(() => {
                setLoading(false);
            });
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
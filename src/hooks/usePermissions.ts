// DEV ONLY: Hook for accessing current user permissions
// TODO: Replace with real auth hook when SSO is implemented

import { useEffect, useState } from "react";

export interface PermissionInfo {
    userId: string;
    globalRole: string;
    assignments: Array<{
        applicationId: string;
        role: string;
    }>;
}

interface ApiPermissionsResponse {
    user: {
        id: string;
        email: string;
        name: string;
        globalRole: string;
    } | null;
    permissions: {
        globalRole: string;
        assignments: Array<{
            applicationId: string;
            role: string;
        }>;
    };
}

function normalizePermissions(data: ApiPermissionsResponse | null): PermissionInfo | null {
    if (!data) return null;

    return {
        userId: data.user?.id ?? "",
        globalRole: data.permissions?.globalRole ?? "Viewer",
        assignments: data.permissions?.assignments ?? [],
    };
}

function fetchPermissions(devUserEmail: string | null): Promise<PermissionInfo | null> {
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    };

    if (devUserEmail) {
        headers["x-dev-user-email"] = devUserEmail;
    }

    return fetch("/api/me/permissions", { headers })
        .then((res) => res.ok ? res.json() : null)
        .then((data) => normalizePermissions(data))
        .catch(() => null);
}

export function usePermissions() {
    const [permissions, setPermissions] = useState<PermissionInfo | null>(null);

    useEffect(() => {
        const devUserEmail = localStorage.getItem("devUserEmail");
        fetchPermissions(devUserEmail).then(setPermissions);
    }, []);

    return permissions;
}

export function isPlatformAdmin(permissions: PermissionInfo | null): boolean {
    return permissions?.globalRole === "PlatformAdmin";
}

import { usePermissions, isPlatformAdmin } from "../hooks/usePermissions";
import { useCurrentUser } from "../hooks/useCurrentUser";

export interface PermissionInfo {
    userId: string;
    globalRole: string;
    assignments: Array<{
        applicationId: string;
        role: string;
    }>;
}

export function useCurrentPermissions(): PermissionInfo | null {
    const { user: currentUser } = useCurrentUser();
    const backendPermissions = usePermissions();

    if (!currentUser?.isAuthenticated) {
        return null;
    }

    if (currentUser?.userRecord) {
        return {
            userId: currentUser.userRecord.id,
            globalRole: currentUser.userRecord.role,
            assignments: [],
        };
    }

    return backendPermissions;
}

export { usePermissions, isPlatformAdmin };
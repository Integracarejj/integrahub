import { usePermissions, isPlatformAdmin, type PermissionInfo } from "../hooks/usePermissions";
import { useCurrentUser } from "../hooks/useCurrentUser";

export function useCurrentPermissions(): PermissionInfo | null {
    const { user: currentUser } = useCurrentUser();
    const { permissions } = usePermissions();

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

    return permissions;
}

export { usePermissions, isPlatformAdmin };
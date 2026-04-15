import { query } from "../db.js";

export async function canManageIntegration(user, sourceApplicationId) {
    if (!user) return false;
    if (user.globalRole === "PlatformAdmin") return true;

    const rows = await query(
        `SELECT role FROM cmdb.ApplicationRoleAssignments 
         WHERE userId = @userId AND applicationId = @applicationId`,
        { userId: user.id, applicationId: sourceApplicationId }
    );

    if (rows.length === 0) return false;

    const role = rows[0].role;
    return role === "AppOwner" || role === "AppAdmin";
}

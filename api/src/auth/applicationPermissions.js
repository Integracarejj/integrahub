import { query } from "../db.js";

export async function canCreateApplication(user) {
    if (!user) return false;
    return user.globalRole === "PlatformAdmin";
}

export async function canEditApplication(user, applicationId) {
    if (!user) return false;
    if (user.globalRole === "PlatformAdmin") return true;

    const rows = await query(
        `SELECT role FROM cmdb.ApplicationRoleAssignments 
         WHERE userId = @userId AND applicationId = @applicationId`,
        { userId: user.id, applicationId }
    );

    if (rows.length === 0) return false;

    const role = rows[0].role;
    return role === "AppOwner" || role === "AppAdmin";
}

export function forbidden(res) {
    return res.status(403).json({ error: "Forbidden" });
}

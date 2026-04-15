import { query } from "../db.js";

const DEV_USER_HEADER = "x-dev-user-email";
const ENTRA_OBJECT_ID_HEADER = "x-entra-object-id";

export async function resolveCurrentUser(req, res, next) {
    const devEmail = req.headers[DEV_USER_HEADER];
    const entraObjectId = req.headers[ENTRA_OBJECT_ID_HEADER];

    try {
        let user;

        if (devEmail) {
            const rows = await query(
                "SELECT id, entraObjectId, email, displayName, role FROM cmdb.Users WHERE email = @email",
                { email: devEmail }
            );
            user = rows[0];

            if (!user) {
                console.warn(`resolveCurrentUser: no user found for email "${devEmail}"`);
                req.user = null;
                return next();
            }
        } else if (entraObjectId) {
            const rows = await query(
                "SELECT id, entraObjectId, email, displayName, role FROM cmdb.Users WHERE entraObjectId = @entraObjectId",
                { entraObjectId }
            );
            user = rows[0];

            if (!user) {
                console.warn(`resolveCurrentUser: no user found for entraObjectId "${entraObjectId}"`);
                req.user = null;
                return next();
            }
        } else {
            req.user = null;
            return next();
        }

        req.user = {
            id: user.id,
            entraObjectId: user.entraObjectId || null,
            email: user.email,
            name: user.displayName,
            globalRole: user.role || "Viewer",
        };
    } catch (err) {
        console.error("resolveCurrentUser: lookup failed:", err.message);
        req.user = null;
    }

    return next();
}

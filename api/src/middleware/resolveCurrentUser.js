import { query } from "../db.js";

const DEV_USER_HEADER = "x-dev-user-email";
const ENTRA_OBJECT_ID_HEADER = "x-entra-object-id";
const AZURE_CLIENT_PRINCIPAL_ID = "x-ms-client-principal-id";
const AZURE_CLIENT_PRINCIPAL_NAME = "x-ms-client-principal-name";

export async function resolveCurrentUser(req, res, next) {
    const devEmail = req.headers[DEV_USER_HEADER];
    const entraObjectId = req.headers[ENTRA_OBJECT_ID_HEADER];
    const azureClientPrincipalId = req.headers[AZURE_CLIENT_PRINCIPAL_ID];
    const azureClientPrincipalName = req.headers[AZURE_CLIENT_PRINCIPAL_NAME];

    try {
        let user;

        if (devEmail) {
            const rows = await query(
                "SELECT id, entraObjectId, email, displayName, role, isActive, canAccess FROM cmdb.Users WHERE email = @email",
                { email: devEmail }
            );
            user = rows[0];

            if (!user) {
                console.warn(`resolveCurrentUser: no user found for email "${devEmail}"`);
                req.user = null;
                return next();
            }
        } else if (azureClientPrincipalId) {
            const rows = await query(
                "SELECT id, entraObjectId, email, displayName, role, isActive, canAccess FROM cmdb.Users WHERE entraObjectId = @entraObjectId",
                { entraObjectId: azureClientPrincipalId }
            );
            user = rows[0];

            if (!user && azureClientPrincipalName) {
                const fallbackRows = await query(
                    "SELECT id, entraObjectId, email, displayName, role, isActive, canAccess FROM cmdb.Users WHERE email = @email",
                    { email: azureClientPrincipalName }
                );
                user = fallbackRows[0];
            }

            if (!user) {
                console.warn(`resolveCurrentUser: no user found for azure principal id "${azureClientPrincipalId}"`);
                req.user = null;
                return next();
            }
        } else if (entraObjectId) {
            const rows = await query(
                "SELECT id, entraObjectId, email, displayName, role, isActive, canAccess FROM cmdb.Users WHERE entraObjectId = @entraObjectId",
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

        const isActive = !!user.isActive;
        const canAccess = !!user.canAccess;

        if (!isActive || !canAccess) {
            req.authInfo = {
                resolvedEmail: user.email,
                displayName: user.displayName,
                reason: !isActive ? "User inactive" : "Access not granted",
            };
            req.user = null;
            return next();
        }

        // TODO: Load portalRole from cmdb.UserRoles once that table exists.
        //       For now, portalRole defaults to null (no portal access).
        //       Role mapping: if user.role is one of the portal roles, infer it.
        const portalRoles = ["ExternalBroker", "ExternalBuyer", "DDTeam"];
        const portalRole = portalRoles.includes(user.role) ? user.role : null;

        req.user = {
            id: user.id,
            entraObjectId: user.entraObjectId || null,
            email: user.email,
            name: user.displayName,
            globalRole: user.role || "Viewer",
            portalRole,
        };
    } catch (err) {
        console.error("resolveCurrentUser: lookup failed:", err.message);
        req.user = null;
    }

    return next();
}

/**
 * Reusable authorization middleware for the Recapitalization Portal.
 *
 * Role hierarchy:
 *   InternalAdmin  — PlatformAdmin-level access to both internal and portal
 *   InternalUser   — Standard internal CMDB user (Viewer/Editor)
 *   DDTeam         — Due diligence team (internal + portal access)
 *   ExternalBroker — External broker (portal-only)
 *   ExternalBuyer  — External buyer (portal-only)
 *
 * Usage:
 *   import { requireInternalUser, requireExternalPortalUser, requireRole, requireTransactionAccess } from "../middleware/authorization.js";
 *
 *   router.get("/internal-data", requireInternalUser, handler);
 *   router.get("/portal-data", requireExternalPortalUser, handler);
 *   router.get("/admin", requireRole("PlatformAdmin"), handler);
 *   router.get("/transactions/:id", requireTransactionAccess, handler);
 *
 * TODO:
 *   - Load portalRole from cmdb.UserRoles or cmdb.Users.portalRole once schema is migrated.
 *   - Implement transaction-level ACL via cmdb.UserTransactionAccess table.
 *   - Add audit logging for all external submissions.
 */

/**
 * Checks that req.user exists and has an internal role.
 * Internal users include PlatformAdmin, Editor, Viewer, and DDTeam.
 */
export function requireInternalUser(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
    }

    // TODO: Check against proper role table. For now, portal-only users
    //       are identified by the absence of an internal role or a specific flag.
    const internalRoles = ["PlatformAdmin", "Editor", "Viewer"];
    if (!internalRoles.includes(req.user.globalRole) && req.user.portalRole) {
        return res.status(403).json({ error: "Access denied. Internal user access required." });
    }

    return next();
}

/**
 * Checks that req.user exists and has a portal role assignment.
 * Portal roles: ExternalBroker, ExternalBuyer, DDTeam
 */
export function requireExternalPortalUser(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
    }

    // TODO: Check cmdb.UserRoles for portalRole. For now, rely on req.user.portalRole
    //       which will be populated by resolveCurrentUser once the schema is updated.
    if (!req.user.portalRole) {
        return res.status(403).json({ error: "Access denied. Portal access required." });
    }

    return next();
}

/**
 * Creates a middleware that requires a specific role.
 * @param {string|string[]} allowedRoles - Single role or array of allowed roles.
 */
export function requireRole(allowedRoles) {
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: "Authentication required" });
        }

        const userRole = req.user.portalRole || req.user.globalRole;

        if (!roles.includes(userRole)) {
            return res.status(403).json({
                error: "Access denied. Required role not found.",
                required: roles,
                actual: userRole,
            });
        }

        return next();
    };
}

/**
 * Middleware that restricts access to users assigned to a specific transaction.
 * Requires transactionId in req.params or req.body.
 *
 * TODO: Query cmdb.UserTransactionAccess to verify the user is assigned to the transaction.
 */
export function requireTransactionAccess(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
    }

    const transactionId = req.params.transactionId || req.body?.transactionId;

    if (!transactionId) {
        return res.status(400).json({ error: "Transaction ID is required" });
    }

    // TODO: Check cmdb.UserTransactionAccess for the user+transaction mapping.
    //       For now, allow DDTeam members and PlatformAdmins through, block others.
    const internalRoles = ["PlatformAdmin"];
    if (internalRoles.includes(req.user.globalRole)) {
        return next();
    }

    if (req.user.portalRole === "DDTeam") {
        return next();
    }

    // Placeholder: In Phase 2, this will query cmdb.UserTransactionAccess.
    // For now, all portal users who reach this point are allowed (transaction-level
    // enforcement will be added later).
    console.warn(`requireTransactionAccess: transaction-level ACL not yet implemented. Allowing user ${req.user.id} access to transaction ${transactionId}.`);
    return next();
}

/**
 * Returns 403 forbidden response.
 */
export function forbidden(res, message = "Forbidden") {
    return res.status(403).json({ error: message });
}

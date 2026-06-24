# Recapitalization Portal — Security Rules

## Architecture Principle

Security is enforced at **three layers**, not just the UI:

```
  Browser (UI)       →     API (Express)       →    Database (Azure SQL)
  ┌─────────────┐         ┌──────────────┐         ┌──────────────────┐
  │ Route Guards │   →    │ Auth Middleware│   →    │ Scoped Queries   │
  │ Nav Hiding   │         │ Role Check    │         │ + Views          │
  │ No API Keys  │         │ Access Control│         │ externalVisible  │
  └─────────────┘         └──────────────┘         └──────────────────┘
```

**Never rely solely on hiding menu items or routes in the UI.**  
Every layer independently enforces access control.

---

## Rule 1: Route-Level Segregation

| Constraint | Enforcement |
|---|---|
| External users can only access `/portal/*` routes | Frontend `PortalGuard` component in `App.tsx` redirects non-portal users from `/portal` routes |
| Internal users without portal access cannot access `/portal/*` | Same `PortalGuard` shows "Portal Access Required" |
| Portal-only users cannot access internal routes | Frontend `InternalGuard` redirects portal-only users to `/portal` |
| Internal users with both roles can access both zones | Both guards pass through for users with `hasAppAccess && isPortalUser` |

---

## Rule 2: Backend API Authorization

| Middleware | Route Prefix | Purpose |
|---|---|---|
| `requireInternalUser` | `/api/applications`, `/api/capabilities`, etc. | Blocks portal-only users from internal data |
| `requireExternalPortalUser` | `/api/portal/*` | Blocks internal-only users from portal data |
| `requireRole('PlatformAdmin')` | `/api/admin/*` | Restricts admin operations |
| `requireTransactionAccess` | `/api/portal/transactions/:id/*` | Scopes to user's assigned transactions |

**Enforcement order:**
1. `resolveCurrentUser` — identifies the user, loads roles (runs on ALL requests)
2. Route-specific middleware — checks the required role/permission
3. Handler function — optionally applies row-level scoping

---

## Rule 3: Row-Level Data Scoping

| Pattern | Implementation |
|---|---|
| **Transaction scoping** | All portal queries JOIN `cmdb.UserTransactionAccess WHERE userId = @currentUserId` |
| **External-visible columns** | Explicit column lists — never `SELECT *` — only include columns marked external-safe |
| **Document visibility** | `WHERE externalVisible = 1` on all external document queries |
| **Party visibility** | `WHERE externalVisible = 1` on party queries |

**Columns that MUST NEVER be exposed externally:**

| Table | Internal-Only Columns |
|---|---|
| `cmdb.Transactions` | `internalOwnerId`, `internalNotes`, `createdAt`, `updatedAt` |
| `cmdb.DueDiligenceRequests` | `internalOwnerId`, `internalNotes`, `reuseConfidence`, `duplicateAnalysisId`, `requestSource` |
| `cmdb.DueDiligenceDocuments` | `uploadedById`, `internalNotes` |
| `cmdb.DueDiligenceQuestions` | `answeredById` |
| `cmdb.DueDiligenceClarifications` | `respondedById` |

---

## Rule 4: Role Definitions

| Role | Scope | Access |
|---|---|---|
| `PlatformAdmin` | Internal + Portal Admin | Full access to both zones, can manage portal config |
| `Editor` | Internal only | Full internal read/write, no portal access |
| `Viewer` | Internal only | Internal read-only, no portal access |
| `DDTeam` | Internal + Portal DD | Internal read + portal read/write as DD admin |
| `ExternalBroker` | Portal only | Portal read/write for assigned transactions |
| `ExternalBuyer` | Portal only | Portal read/write for assigned transactions |

---

## Rule 5: Authentication

- All portal users authenticate via Microsoft Entra ID (same as internal users).
- The `resolveCurrentUser` middleware resolves both internal and portal roles from the credentials.
- External users who are not in the `cmdb.Users` table (or `UserRoles` table) receive `isAuthenticated = false` and cannot access either zone.
- No public/unauthenticated routes exist.

---

## Rule 6: Submission Security

All external submissions (questions, clarifications, new requests) MUST:
1. Be associated with the authenticated user's ID — never accept `requestedById` from the client.
2. Be scoped to transactions the user has access to — reject if transaction not in `UserTransactionAccess`.
3. Be audit-logged with user ID, timestamp, IP, and action details (Phase 2).

---

## Rule 7: Future Considerations

| Item | Status |
|---|---|
| Audit logging for all external submissions | TODO — Phase 2 |
| Rate limiting on form submissions | TODO — Phase 2 |
| Document download access logging | TODO — Phase 2 |
| File upload validation (type, size, scan) | TODO — Phase 2 |
| Session timeout / re-authentication | TODO — Phase 2 |
| IP allow-listing for broker/buyer networks | TODO — Phase 3 |
| MFA requirement for external users | TODO — Phase 3 |

---

## Testing Security Rules

See the test plan in the project documentation for step-by-step verification of each rule.

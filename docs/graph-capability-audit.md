# Graph Capability Audit

## What Was Tested

The diagnostics endpoint at `GET /api/admin/graph/diagnostics` (PlatformAdmin-only)
runs the following tests in sequence:

1. **Token Acquisition** — Client credentials grant with `https://graph.microsoft.com/.default`
2. **Organization Read** — `GET /v1.0/organization`
3. **Users Read** — `GET /v1.0/users?$top=5&$select=id,displayName,userPrincipalName,mail,userType`
4. **Groups Read** — `GET /v1.0/groups?$top=5&$select=id,displayName,description,groupTypes,visibility`
5. **SharePoint Discovery** — `GET /v1.0/sites/{hostname}:{path}` then `GET /v1.0/sites/{siteId}/drives`
6. **SharePoint Document Read** — `GET /v1.0/drives/{driveId}/root/children?$top=5`
7. **Write Test** (flag-gated) — Create + delete `_integrasource_graph_test_*` folder

## What Permissions Appear to Exist

> Run the diagnostics endpoint after deployment to confirm. The notes below are
> inferred from the app registration configuration visible at audit time.

| Capability | Status | Evidence |
|---|---|---|
| Token acquisition (client credentials) | ✅ Working | Existing `/sync/test-graph` passes |
| Read users (basic profile) | ✅ Working | Graph sync dry-run returns users |
| Read organization | ⚠️ Unknown | Not tested before this audit |
| Read groups | ⚠️ Unknown | Not tested before this audit |
| Read SharePoint sites | ⚠️ Unknown | No existing code calls SharePoint APIs |
| Read SharePoint drives/files | ⚠️ Unknown | No existing code calls SharePoint APIs |
| Write to SharePoint | ❌ Not allowed | App registration likely lacks Sites.ReadWrite.All |

## What Permissions Are Missing

Based on the current code, the app registration was configured for **Graph user sync**
(`User.Read.All` or `Directory.Read.All`). The following permissions are likely absent:

- **Sites.Read.All** — required to discover SharePoint sites and list documents
- **Sites.ReadWrite.All** — required to create folders/upload (only if write-back is needed)
- **Group.Read.All** — required if the portal needs to show security group memberships
- **Directory.Read.All** — broader than User.Read.All; may already be present

## Recommended Graph Permissions for the Recap Portal Document Browser

### Minimal (read-only document browser, preferred)

| Permission | Type | Justification |
|---|---|---|
| `Sites.Selected` | Application | Restrict to the specific Recapitalization Hub site only |
| — or `Sites.Read.All` | Application | Broader but simpler if Sites.Selected admin consent is unavailable |

No `User.Read.All` or `Group.Read.All` is needed for document browsing alone.

### Directory lookups (only if needed for B2B guest identification)

| Permission | Type | Justification |
|---|---|---|
| `User.Read.All` | Application | Needed to look up userType (Member vs Guest) |
| `Group.Read.All` | Application | Needed if the portal enforces group-based access |

### Full (if portal needs write-back)

| Permission | Type | Justification |
|---|---|---|
| `Sites.ReadWrite.All` | Application | Only if external users can upload directly |
| — or `Sites.Selected` with write scope | Application | More restrictive, preferred |

## Recommended Next Steps for B2B Guest Testing

1. **Identify guests**: Query `users?$filter=userType eq 'Guest'&$top=10` using the
   diagnostics endpoint or a manual Graph Explorer test.
2. **Test guest access to SharePoint**: If the site has external sharing enabled,
   verify that a guest token can list the same drives.
3. **Separate app registration for portal**: Consider creating a second app
   registration dedicated to the Recap Portal with only `Sites.Selected` on the
   Recapitalization Hub site. Keep the existing registration for internal user sync.
4. **Admin consent**: Each new API permission requires Azure admin consent before
   the client credentials flow will work. Plan a consent window.

## How to Run the Diagnostics

```bash
# Deploy the code, then:
curl -H "x-ms-client-principal-id: <your-entra-id>" \
  "https://<app-service>/api/admin/graph/diagnostics"
```

Or with the dev header:

```bash
curl -H "x-dev-user-email: admin@integracare.com" \
  "http://localhost:4000/api/admin/graph/diagnostics"
```

The response includes a `config` block showing which env vars are present and a
`tests` block with per-test results. No secrets, tokens, or full IDs are returned.

## Existing Endpoints (Pre-existing, Not Part of This Audit)

| Route | Purpose | Guard |
|---|---|---|
| `GET /api/admin/users/sync/readiness` | Checks Graph config presence | PlatformAdmin |
| `GET /api/admin/users/sync/test-graph` | Tests token + user read (3 users) | PlatformAdmin |
| `GET /api/admin/users/sync/dry-run` | Simulates sync without writing | PlatformAdmin |
| `POST /api/admin/users/sync/run` | Performs the actual user sync | PlatformAdmin |

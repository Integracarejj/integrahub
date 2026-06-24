# Recapitalization Portal — Database Design Proposal

## Schema Overview

All tables live under the `cmdb` schema alongside existing IntegraSource tables.  
This keeps portal data co-located with core CMDB metadata while maintaining clear logical separation.

---

## 1. cmdb.Users (extend existing)

**Status:** Existing table, extended with portal role support.

| Column | Type | Purpose | Security |
|---|---|---|---|
| `id` | `NVARCHAR(64)` PK | Unique user ID | Internal |
| `entraObjectId` | `NVARCHAR(128)` | Azure AD object ID | Internal |
| `email` | `NVARCHAR(256)` | User email | Internal |
| `displayName` | `NVARCHAR(256)` | Display name | Internal |
| `role` | `NVARCHAR(64)` | Global role: Viewer/Editor/PlatformAdmin + portal roles | Internal |
| `isActive` | `BIT` | Active flag | Internal |
| `canAccess` | `BIT` | App access gate | Internal |

**Proposed addition:**
- Add `portalRole` as a separate column? Or use existing `role` column with new role values.
- **Recommendation:** Keep `role` for internal roles. Add a separate `portalRole` column or use a `UserRoles` join table (see below).

**Security:** Users table is never exposed externally. Portal user lookup happens server-side only.

---

## 2. cmdb.UserRoles (new)

**Purpose:** Many-to-many role assignments supporting both internal and portal roles.

| Column | Type | Purpose | Security |
|---|---|---|---|
| `id` | `NVARCHAR(64)` PK | Unique ID | Internal |
| `userId` | `NVARCHAR(64)` FK → Users.id | User reference | Internal |
| `roleType` | `NVARCHAR(32)` | `'internal'` or `'portal'` | Internal |
| `roleName` | `NVARCHAR(64)` | Role name | Internal |
| `assignedAt` | `DATETIME2` | Assignment timestamp | Internal |
| `assignedBy` | `NVARCHAR(64)` | Admin who granted role | Internal |

**Role values:**
- `roleType = 'internal'` → `roleName`: `PlatformAdmin`, `Editor`, `Viewer`
- `roleType = 'portal'` → `roleName`: `DDTeam`, `ExternalBroker`, `ExternalBuyer`

**Security notes:**
- Never exposed externally.
- Internal apps query `roleType = 'internal'` for authorization.
- Portal middleware queries `roleType = 'portal'` for portal access.

---

## 3. cmdb.Transactions (new)

**Purpose:** Recapitalization transactions / deals.

| Column | Type | Purpose | Security |
|---|---|---|---|
| `id` | `NVARCHAR(64)` PK | Unique transaction ID | Internal |
| `name` | `NVARCHAR(256)` | Transaction name | External |
| `description` | `NVARCHAR(MAX)` | Deal description | External |
| `status` | `NVARCHAR(32)` | Active / Pending / Completed | External |
| `targetCloseDate` | `DATE` | Expected close | External |
| `internalOwnerId` | `NVARCHAR(64)` FK → Users.id | DD lead (internal) | Internal |
| `internalNotes` | `NVARCHAR(MAX)` | Internal notes | Internal |
| `createdAt` | `DATETIME2` | Created timestamp | Internal |
| `updatedAt` | `DATETIME2` | Updated timestamp | Internal |

**External-visible columns:** `name`, `description`, `status`, `targetCloseDate`  
**Internal-only columns:** `internalOwnerId`, `internalNotes`, `createdAt`, `updatedAt`

**Security:** Queries for external users MUST explicitly select only external-visible columns.  
A view `cmdb.ExternalTransactions` could enforce this at the DB level.

---

## 4. cmdb.TransactionParties (new)

**Purpose:** Links transactions to buyer/broker organizations and users.

| Column | Type | Purpose | Security |
|---|---|---|---|
| `id` | `NVARCHAR(64)` PK | Unique ID | Internal |
| `transactionId` | `NVARCHAR(64)` FK → Transactions.id | Transaction reference | Internal |
| `partyType` | `NVARCHAR(32)` | `'Buyer'` or `'Broker'` | External |
| `organizationName` | `NVARCHAR(256)` | Company name | External |
| `primaryContactId` | `NVARCHAR(64)` FK → Users.id | Main contact | Internal |
| `externalVisible` | `BIT` | Whether party is visible externally | External |

**Security:** Only return rows where `externalVisible = 1` for external users.

---

## 5. cmdb.UserTransactionAccess (new)

**Purpose:** Access control — which users can see which transactions.

| Column | Type | Purpose | Security |
|---|---|---|---|
| `id` | `NVARCHAR(64)` PK | Unique ID | Internal |
| `userId` | `NVARCHAR(64)` FK → Users.id | User reference | Internal |
| `transactionId` | `NVARCHAR(64)` FK → Transactions.id | Transaction reference | Internal |
| `accessLevel` | `NVARCHAR(32)` | `'view'`, `'submit'`, `'admin'` | Internal |
| `grantedAt` | `DATETIME2` | Grant timestamp | Internal |
| `grantedBy` | `NVARCHAR(64)` FK → Users.id | Who granted access | Internal |

**Security:** Every portal query for scoped data MUST join on this table to enforce `userId = @currentUserId`.  
This is the primary mechanism preventing cross-transaction data leakage.

---

## 6. cmdb.DueDiligenceRequests (new)

**Purpose:** Individual due diligence data requests within a transaction.

| Column | Type | Purpose | External Visible |
|---|---|---|---|
| `id` | `NVARCHAR(64)` PK | Unique request ID | Yes |
| `transactionId` | `NVARCHAR(64)` FK → Transactions.id | Parent transaction | Yes |
| `requestedById` | `NVARCHAR(64)` FK → Users.id | Who requested | Yes (name only) |
| `title` | `NVARCHAR(256)` | Request title | Yes |
| `category` | `NVARCHAR(64)` | Financial, Operational, etc. | Yes |
| `details` | `NVARCHAR(MAX)` | Description | Yes |
| `priority` | `NVARCHAR(16)` | High / Medium / Low | Yes |
| `neededBy` | `DATE` | Deadline | Yes |
| `status` | `NVARCHAR(32)` | Provided / In Progress / Clarification Needed / Under Review | Yes |
| `internalOwnerId` | `NVARCHAR(64)` FK → Users.id | DD team assignee | **No** |
| `internalNotes` | `NVARCHAR(MAX)` | Internal notes / routing | **No** |
| `reuseConfidence` | `NVARCHAR(16)` | Reuse confidence rating (internal) | **No** |
| `duplicateAnalysisId` | `NVARCHAR(64)` | Link to duplicate request analysis | **No** |
| `requestSource` | `NVARCHAR(32)` | `'portal'` or `'internal'` | **No** |
| `submittedAt` | `DATETIME2` | Submission timestamp | Yes |
| `updatedAt` | `DATETIME2` | Last update | Yes |

**Security:** External queries must NEVER expose `internalOwnerId`, `internalNotes`, `reuseConfidence`, `duplicateAnalysisId`, or `requestSource`.

---

## 7. cmdb.DueDiligenceClarifications (new)

**Purpose:** Clarification threads on existing requests.

| Column | Type | Purpose | External Visible |
|---|---|---|---|
| `id` | `NVARCHAR(64)` PK | Unique ID | Yes |
| `requestId` | `NVARCHAR(64)` FK → DueDiligenceRequests.id | Parent request | Yes |
| `requestedById` | `NVARCHAR(64)` FK → Users.id | Who asked | Yes |
| `details` | `NVARCHAR(MAX)` | Clarification text | Yes |
| `status` | `NVARCHAR(32)` | Open / Resolved | Yes |
| `response` | `NVARCHAR(MAX)` | DD team response | Yes |
| `respondedById` | `NVARCHAR(64)` FK → Users.id | Who responded | **No** |
| `submittedAt` | `DATETIME2` | When submitted | Yes |
| `respondedAt` | `DATETIME2` | When resolved | Yes |

**Security:** Same pattern — external-visible columns must be explicitly selected.

---

## 8. cmdb.DueDiligenceQuestions (new)

**Purpose:** General questions about a transaction (not tied to a specific request).

| Column | Type | Purpose | External Visible |
|---|---|---|---|
| `id` | `NVARCHAR(64)` PK | Unique ID | Yes |
| `transactionId` | `NVARCHAR(64)` FK → Transactions.id | Parent transaction | Yes |
| `requestedById` | `NVARCHAR(64)` FK → Users.id | Who asked | Yes |
| `questionType` | `NVARCHAR(64)` | Category | Yes |
| `subject` | `NVARCHAR(256)` | Short subject | Yes |
| `details` | `NVARCHAR(MAX)` | Full question | Yes |
| `status` | `NVARCHAR(32)` | Open / Answered / Closed | Yes |
| `answer` | `NVARCHAR(MAX)` | DD team answer | Yes |
| `answeredById` | `NVARCHAR(64)` FK → Users.id | Who answered | **No** |
| `submittedAt` | `DATETIME2` | When submitted | Yes |
| `answeredAt` | `DATETIME2` | When answered | Yes |

---

## 9. cmdb.DueDiligenceDocuments (new)

**Purpose:** Document library for due diligence materials.

| Column | Type | Purpose | External Visible |
|---|---|---|---|
| `id` | `NVARCHAR(64)` PK | Unique document ID | Yes |
| `transactionId` | `NVARCHAR(64)` FK → Transactions.id | Parent transaction | Yes |
| `requestId` | `NVARCHAR(64)` FK → DueDiligenceRequests.id | Optional request link | Yes |
| `fileName` | `NVARCHAR(256)` | Display name | Yes |
| `filePath` | `NVARCHAR(512)` | Storage path | Yes |
| `category` | `NVARCHAR(64)` | Document category | Yes |
| `fileSize` | `NVARCHAR(32)` | Human-readable size | Yes |
| `externalVisible` | `BIT` | **Critical** — only true means external can see it | Yes |
| `uploadedById` | `NVARCHAR(64)` FK → Users.id | Who uploaded | **No** |
| `internalNotes` | `NVARCHAR(MAX)` | Internal document notes | **No** |
| `uploadedAt` | `DATETIME2` | Upload timestamp | Yes |

**Security:** The `externalVisible` flag is the gatekeeper. External queries MUST have `WHERE externalVisible = 1`.  
Internal documents (confidence scoring, duplicate analysis, recommendations) must have `externalVisible = 0`.

---

## 10. cmdb.DueDiligenceDeliverableCatalog (new)

**Purpose:** Standard catalog of due diligence deliverables by category.

| Column | Type | Purpose |
|---|---|---|
| `id` | `NVARCHAR(64)` PK | Unique ID |
| `category` | `NVARCHAR(64)` | Financial, Operational, etc. |
| `name` | `NVARCHAR(256)` | Deliverable item name |
| `description` | `NVARCHAR(MAX)` | What this item covers |
| `typicalSource` | `NVARCHAR(256)` | Where this data typically comes from |
| `isActive` | `BIT` | Whether this item is still relevant |

**Security:** Mostly public within the portal. No sensitive data.

---

## 11. cmdb.DueDiligenceRequestMappings (new)

**Purpose:** Maps catalog deliverables to specific requests.

| Column | Type | Purpose |
|---|---|---|
| `id` | `NVARCHAR(64)` PK | Unique ID |
| `requestId` | `NVARCHAR(64)` FK → DueDiligenceRequests.id | Parent request |
| `catalogItemId` | `NVARCHAR(64)` FK → DueDiligenceDeliverableCatalog.id | Catalog reference |
| `coverageNotes` | `NVARCHAR(MAX)` | How this request covers the catalog item |

---

## 12. cmdb.AuditLog (new — future)

**Purpose:** Audit trail for all external portal submissions.

| Column | Type | Purpose |
|---|---|---|
| `id` | `NVARCHAR(64)` PK | Unique ID |
| `userId` | `NVARCHAR(64)` FK → Users.id | Who performed the action |
| `transactionId` | `NVARCHAR(64)` FK → Transactions.id | Related transaction |
| `actionType` | `NVARCHAR(64)` | e.g., `question.submitted`, `clarification.requested`, `request.submitted`, `document.viewed` |
| `details` | `NVARCHAR(MAX)` | JSON payload with action context |
| `ipAddress` | `NVARCHAR(64)` | Request origin |
| `createdAt` | `DATETIME2` | When the action occurred |

---

## Security Enforcement Patterns

1. **Server-side column filtering:** Never `SELECT *` from tables with mixed-visibility columns. Always explicitly list external-safe columns.

2. **Transaction-level scoping:** Every data query for portal users MUST join `cmdb.UserTransactionAccess` to enforce `userId = @currentUserId`.

3. **External-visible flag:** Documents and certain records use an `externalVisible` BIT column. External queries MUST include `WHERE externalVisible = 1`.

4. **Database views (optional but recommended):**
   - `cmdb.ExternalTransactions` — only external-visible columns
   - `cmdb.ExternalRequests` — only external-visible columns + transaction access filter
   - `cmdb.ExternalDocuments` — only where `externalVisible = 1`

5. **Audit logging (Phase 2):** All write operations from portal users must be audit-logged.

---

## Migration Order

1. Add `UserRoles` table
2. Create `Transactions` table
3. Create `TransactionParties` table
4. Create `UserTransactionAccess` table
5. Create `DueDiligenceRequests` table
6. Create `DueDiligenceClarifications` table
7. Create `DueDiligenceQuestions` table
8. Create `DueDiligenceDocuments` table
9. Create `DueDiligenceDeliverableCatalog` table
10. Create `DueDiligenceRequestMappings` table
11. Create `AuditLog` table (Phase 2)
12. Seed initial catalog items
13. Create external-safe views

# Phase B: External Multi-Package Upload UX + Internal Transaction/External-Party Context

**Date:** 2026-07-24  
**Status:** Complete — All 6 phases delivered

---

## Summary

Extended the Recap external portal upload experience and internal work queue pages with:
1. Drag/drop zone for "Submit Another Package" on Portal Overview
2. Transaction + External Party context across all internal Recap pages
3. External Party filter on the Work Queue
4. Org identity fields propagated through the data layer (intake items + requests)
5. Service-layer tests validating the new data foundation

**Build validation:** tsc clean, vite build succeeds, 502/502 tests pass

---

## Phase 1: Types + Data Layer

### `src/services/recapMockData.ts`
- Added `orgId?`, `orgName?`, `userId?`, `userName?` to `RecapRequest` and `RecapIntakeItem` interfaces

### `src/services/portalMockData.ts`
- `createPortalIntakeItem()` — added `orgId?`, `orgName?`, `userId?`, `userName?` params; stores them on the intake item
- `confirmBrokerPackage()` — now passes `identityUser?.organizationId/orgName/id/displayName` to `createPortalIntakeItem()`
- Removed `(req as any)` casts for `orgId`, `orgName`, `userId`, `userName`, `_archived`, `_archiveReason` in `mapRecapToPortalRequest` (they're now proper typed fields)

---

## Phase 2: Submit Another Package Drag/Drop

### `src/pages/portal/PortalOverview.tsx`
- Replaced the "Submit Another Package" button (which only triggered file picker) with a full drag/drop zone
- Uses existing `dropZoneRef` and drag state
- Styled with `po-upload-hero` class in compact form (padding `24px 32px`, borderRadius 16)
- Shows "Drop your due diligence package here" + "Browse Files" button — matches the hero upload experience on first load

---

## Phase 3: Internal Page Context

### 3a — Intake Queue (`src/pages/recapitalization/RecapitalizationIntake.tsx`)
- Added "External Party" column to the intake queue table
- Shows `item.orgName` (bold primary) + `item.userName` (secondary gray), fallback "—"

### 3b — Intake Workbench (ReviewEngine in RecapitalizationIntake.tsx)
- Added context bar below header showing `scope.orgName` + "Submitted by {userName}"

### 3c — Work Queue (`src/pages/recapitalization/RecapitalizationTracker.tsx`)
- Added **Transaction** column (`req.transactionName`)
- Added **External Party** column (`req.orgName` bold + `req.userName` secondary)
- Added `filterOrg` state + "All External Parties" dropdown filter (dynamically derived from requests with `orgName`)
- Filter logic: `if (filterOrg !== "all") result = result.filter(r => r.orgName === filterOrg)`

### 3d — My Work (`src/pages/recapitalization/RecapitalizationMyWork.tsx`)
- Added compact context below Deliverable: `req.transactionName · req.orgName` (line 11, gray)
- No full columns — keeps the existing tight layout

### 3e — DD Operations (`src/pages/recapitalization/RecapitalizationDdOperations.tsx`)
- Added compact context below Deliverable in both NDDR and standard table rows
- Format: title line, then `req.transactionName · req.orgName` (line 11, gray)

### 3f — Workspace Header (`src/pages/recapitalization/RecapitalizationWorkspace.tsx`)
- Added External Party context to the header metadata area (alongside Community and Transaction)
- Shows org icon + `item.orgName` (bold) + "· Submitted by {item.userName}" when `item.orgName` or `item.orgId` is present

---

## Phase 4: Transaction Selector Audit

Audited the Tracker transaction selector (`filterTxn` state). **No stale label mismatch found.** The `<select>` element binds its `value` to `filterTxn`, ensuring the dropdown label always reflects the actual filter state. Counts ("Showing X of Y requests") are derived from the same `filtered` memo that applies the filter.

---

## Phase 5: Automated Tests

### New Tests V–Z (6 describe blocks, 8 test cases)

| Test | Purpose |
|------|---------|
| **V** | Org identity propagation — intake item and requests carry org fields through `confirmBrokerPackage` |
| **W** | `getPortalSubmissionsList` and `getPortalRequests` filter by both `authorizedTxnIds` AND `orgId` (belt-and-suspenders) |
| **X** | `clearPortalSubmissions` sets `integrasource.recap.wiped` flag to prevent `initDemo()` re-seed |
| **Y** | `RecapRequest` objects carry `transactionName` and `orgName` for display in internal views |
| **Z** | Regression guard — new org fields do not break existing three-persona mutual isolation |

**Total test count:** 502 (493 original + 9 new)

---

## Phase 6: Build Validation

| Check | Result |
|-------|--------|
| `npx tsc -b` | Clean — no errors |
| `npx vitest run` | 502/502 passed |
| `npx vite build` | Built in ~11s, no errors |

---

## What Was NOT Changed (Per Requirements)

- Authorization predicates (persona-switch, direct URL, transaction-scoped)
- Persona-switch authorization flow
- Recap workflow state transitions (blocker, clarification, publish, rework, approval, exception, internal queue routing)
- Persona/organization/transaction authorization model
- External portal form layouts or field labels
- Any internal form layouts, field labels, or step sequences

---

## Files Modified

| File | Changes |
|------|---------|
| `src/services/recapMockData.ts` | Added org fields to `RecapRequest` and `RecapIntakeItem` |
| `src/services/portalMockData.ts` | `createPortalIntakeItem` accepts org params; removed `(req as any)` casts |
| `src/pages/portal/PortalOverview.tsx` | Replaced button with drag/drop zone |
| `src/pages/recapitalization/RecapitalizationIntake.tsx` | External Party column + intake workbench context bar |
| `src/pages/recapitalization/RecapitalizationTracker.tsx` | Transaction + External Party columns + org filter |
| `src/pages/recapitalization/RecapitalizationMyWork.tsx` | Compact context below Deliverable |
| `src/pages/recapitalization/RecapitalizationDdOperations.tsx` | Compact context below Deliverable (NDDR + standard rows) |
| `src/pages/recapitalization/RecapitalizationWorkspace.tsx` | External Party in workspace header |
| `src/__tests__/persona-isolation-fix.test.ts` | Tests V–Z (9 new test cases) |

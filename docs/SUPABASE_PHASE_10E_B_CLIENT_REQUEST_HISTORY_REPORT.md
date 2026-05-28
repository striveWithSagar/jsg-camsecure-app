# Phase 10E-B: Client Request History — Implementation Report

**Date:** 2026-05-28  
**Status:** COMPLETE  
**Base commit:** 1099426

---

## 1. Files Changed

| File | Action | Description |
|------|--------|-------------|
| `src/lib/data/client-portal.ts` | **MODIFIED** | Added `ClientRequestItem` type + `getClientRequests()` |
| `src/components/client/ClientTopNav.tsx` | **MODIFIED** | Added "Requests" nav link + fixed active-state logic |
| `src/app/(client)/client/requests/page.tsx` | **CREATED** | Server Component — client request history list |
| `src/app/(client)/client/requests/loading.tsx` | **CREATED** | Skeleton loading state |
| `src/app/(client)/client/requests/error.tsx` | **CREATED** | Error boundary using `ErrorBlock` |

No schema changes. No RLS changes. No migration. `service-requests.ts` untouched.

---

## 2. Implementation Summary

### `getClientRequests()` — `src/lib/data/client-portal.ts`

New export alongside the existing `getClientJobs()` and `getClientInvoices()`.

**`ClientRequestItem` type:**
```typescript
export type ClientRequestItem = {
  id:          string;
  reqNumber:   number | null;
  serviceType: string;   // display label (e.g. "DVR/NVR Issue")
  urgency:     string;   // raw enum: emergency|high|medium|low
  status:      string;   // raw enum
  description: string;
  createdAt:   string;   // raw ISO
  updatedAt:   string;   // raw ISO
  isTerminal:  boolean;  // true for converted or cancelled
  hasJob:      boolean;  // true when converted_to_job_id is set
};
```

**Query:** selects `id, request_number, service_type, urgency, status, description, created_at, updated_at, converted_to_job_id` from `service_requests`, ordered by `created_at DESC`. No `client_id` filter in code — RLS enforces `client_id = auth_client_id()`.

**`isTerminal` mapping:** `row.status === "converted" || row.status === "cancelled"` — ensures converted requests are treated as resolved for age calculation.

---

### `/client/requests/page.tsx`

Async Server Component. Calls `getClientRequests()` (RLS-filtered). Uses:
- `fmtReqNumber(req.reqNumber)` → "REQ-0008"
- `fmtDatetime(req.createdAt)` → "May 26, 2026 · 06:02 AM"
- `calcJobAge(req.createdAt, req.updatedAt, req.isTerminal ? "completed" : req.status)` — maps `converted`/`cancelled` to "completed" so they display "Completed in X days", not "Open for X days"
- `PriorityBadge` (re-used from admin) for urgency — urgency raw values (`emergency|high|medium|low`) match priority values exactly
- Inline `RequestStatusBadge` using `badge-*` CSS classes from `globals.css`:

| Status | Badge class | Display label |
|--------|-------------|---------------|
| `new` | `badge-assigned` | New |
| `reviewing` | `badge-started` | Reviewing |
| `ready_to_schedule` | `badge-on-the-way` | Ready to Schedule |
| `converted` | `badge-completed` | Converted to Job |
| `cancelled` | `badge-rescheduled` | Cancelled |

- "Job created" pill shown when `req.hasJob === true`
- Description truncated to 2 lines via CSS `line-clamp-2`
- Empty state with icon + CTA link to `/client/requests/new`
- Header "New Request" button always visible

---

### `ClientTopNav.tsx` — nav + active-state fix

**Added "Requests" link** between "Invoices" and "New Request".

**Active-state fix** — prevents both "Requests" and "New Request" from highlighting simultaneously:
```typescript
// Before:
const active = pathname === href || (href !== "/client" && pathname.startsWith(href));

// After:
const exactMatch = href === "/client" || href === "/client/requests";
const active = pathname === href || (!exactMatch && pathname.startsWith(href));
```

Active state results:

| Pathname | "Requests" active? | "New Request" active? |
|----------|-------------------|-----------------------|
| `/client/requests` | ✅ Yes (exact match) | ❌ No |
| `/client/requests/new` | ❌ No (exact match fails) | ✅ Yes (startsWith) |
| `/client` | ❌ No | ❌ No |

---

## 3. DB Verification

### Baseline counts

| Table | Count |
|-------|-------|
| `service_requests` total | 9 |
| Walk-in (`client_id = NULL`) | 8 |
| Client-linked (`client_id IS NOT NULL`) | 1 (REQ-008, Metro Security Ltd) |

### Status breakdown — `isTerminal` / `hasJob` mapping

| Status | Count | `isTerminal` | `hasJob` |
|--------|-------|-------------|---------|
| `new` | 5 | false | 0 |
| `reviewing` | 1 | false | 0 |
| `ready_to_schedule` | 1 | false | 0 |
| `converted` | 2 | true | 2 |

All `converted` rows have `converted_to_job_id` set — `hasJob=true` ✅  
No `cancelled` rows in seeded data.

### RLS simulation — David Park (client role)

```sql
BEGIN;
SET LOCAL role = 'authenticated';
SET LOCAL "request.jwt.claims" = '{"sub":"ae091c96-a0f0-443f-87dc-c0b5c909e9b6","aud":"authenticated"}';
SELECT request_number, service_type, urgency, status, client_id IS NOT NULL AS has_client_id
FROM service_requests ORDER BY created_at DESC;
ROLLBACK;
```

Result:

| request_number | service_type | urgency | status | has_client_id |
|----------------|-------------|---------|--------|---------------|
| 8 | dvr_nvr_issue | medium | new | true |

**✅ 1 row returned — exactly REQ-008.** All 8 walk-in requests with `client_id = NULL` are invisible. RLS `(client_id = auth_client_id() AND auth_role() = 'client')` enforced correctly.

### Admin visibility

Admin query (no RLS restriction for admin/owner roles): 9 rows returned — all 9 service requests visible ✅

### Walk-in requests invisible to client

`client_id IS NULL` → `NULL = auth_client_id()` evaluates to `NULL` (not `true`) in Postgres — RLS WITH CHECK silently excludes these rows. 0 walk-in rows visible to client ✅

---

## 4. Field Rendering Verification

| Field | Source | Rendered as |
|-------|--------|------------|
| Request number | `fmtReqNumber(req.reqNumber)` | `REQ-0008` ✅ |
| Service type | `SERVICE_TYPE_LABELS[row.service_type]` | `"DVR/NVR Issue"` (not `"dvr_nvr_issue"`) ✅ |
| Urgency | `PriorityBadge value={req.urgency}` | Coloured badge via `PRIORITY_BADGE_CLASS` ✅ |
| Status | `RequestStatusBadge` with `REQUEST_STATUS_LABELS` | `"New"`, `"Converted to Job"`, etc. ✅ |
| Submitted date | `fmtDatetime(req.createdAt)` | `"May 26, 2026 · 06:02 AM"` ✅ |
| Age (open) | `calcJobAge(createdAt, updatedAt, status)` | `"Open for X days"` ✅ |
| Age (converted) | `calcJobAge(createdAt, updatedAt, "completed")` | `"Completed in X days"` ✅ (not "Open for") |
| No raw UUIDs | No `id` rendered in UI | ✅ |
| No admin-only fields | `notes`, `org_id`, `submitted_by_profile_id` not selected/rendered | ✅ |

---

## 5. Build and Lint

| Check | Result |
|-------|--------|
| `npm run build` | ✅ 0 TypeScript errors · **26 routes** (25 → 26, `/client/requests` added) |
| `npm run lint` | ✅ 0 errors · 0 warnings |

New route confirmed in build output:
```
├ ƒ /client/requests
├ ƒ /client/requests/new
```

---

## 6. Confirmation: No DB/RLS/Schema Changes

| Item | Change made? |
|------|-------------|
| Database migration | ❌ None |
| RLS policy change | ❌ None |
| Schema change | ❌ None |
| `service-requests.ts` (admin data helper) | ❌ Untouched |
| `getClientJobs()` / `getClientInvoices()` | ❌ Untouched |

---

## 7. Bugs Found

**None.** Implementation matches Phase 10E-A plan exactly.

---

## 8. Final Verdict

**PASS — all verification checks passed.**

David Park sees only REQ-008 on `/client/requests`. Walk-in requests are invisible. Request numbers show as `REQ-0008`. Converted requests show "Completed in X days". Admin `/requests` unaffected. Build and lint clean at 0 errors.

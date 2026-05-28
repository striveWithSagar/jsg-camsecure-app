# Phase 10F-B: Client Request Detail — Implementation Report

**Date:** 2026-05-28  
**Status:** COMPLETE  
**Base commit:** 86b7845

---

## 1. Files Changed

| File | Action | Description |
|------|--------|-------------|
| `src/lib/data/client-portal.ts` | **MODIFIED** | Added `ClientRequestDetail` type + `getClientRequestById()` |
| `src/app/(client)/client/requests/page.tsx` | **MODIFIED** | Wrapped `RequestCard` renders in `<Link href="/client/requests/${req.id}">` |
| `src/app/(client)/client/requests/[id]/page.tsx` | **CREATED** | Server Component — client request detail page |
| `src/app/(client)/client/requests/[id]/loading.tsx` | **CREATED** | Skeleton loading state |
| `src/app/(client)/client/requests/[id]/error.tsx` | **CREATED** | Error boundary using `ErrorBlock` |

No schema changes. No RLS changes. No migration. `service-requests.ts` untouched.

---

## 2. Implementation Summary

### `getClientRequestById()` — `src/lib/data/client-portal.ts`

New export alongside `getClientRequests()`, `getClientJobs()`, `getClientInvoices()`.

**`ClientRequestDetail` type:**
```typescript
export type ClientRequestDetail = {
  id:          string;
  reqNumber:   number | null;
  serviceType: string;
  urgency:     string;
  status:      string;
  description: string;
  createdAt:   string;
  updatedAt:   string;
  isTerminal:  boolean;
  linkedJob: {
    jobNumber:   number | null;
    status:      string;
    site:        string;
    scheduledAt: string | null;
    completedAt: string | null;
  } | null;
};
```

**Query:** Selects from `service_requests` with `jobs!converted_to_job_id(job_number, status, site_name, scheduled_at, completed_at)` embed. Uses `.eq("id", id).maybeSingle()` — returns null for RLS-blocked rows (walk-in, other-client) and non-existent IDs. No `notes` field in SELECT (admin-internal).

**Array guard:** PostgREST may return the embed as an array or object depending on FK cardinality. `j = Array.isArray(row.jobs) ? (row.jobs[0] ?? null) : row.jobs` handles both shapes.

---

### `/client/requests/[id]/page.tsx`

Async Server Component. Awaits `params: Promise<{ id: string }>` per Next.js 16 pattern. Calls `notFound()` on null result (covers RLS-blocked + non-existent IDs).

**UI sections:**
- Back link → `/client/requests`
- Header: `fmtReqNumber(reqNumber)` + service type subtitle + `PriorityBadge` + `RequestStatusBadge`
- **Details** card: service type, submitted date (`fmtDatetime`), duration (`calcJobAge`)
- **Description** card: full text, no truncation, `whitespace-pre-wrap`
- **Linked Job** card: conditionally rendered when `linkedJob !== null` — shows `fmtJobNumber`, `StatusBadge` for job status, site, scheduled, completed dates

**Age mapping:** `calcJobAge(createdAt, updatedAt, isTerminal ? "completed" : status)` — same as list page, ensures converted requests show "Completed in X days" not "Open for X days".

**`notes` not rendered:** Admin-internal field excluded from SELECT and UI.

**`RequestStatusBadge`:** Inline component (same constant as list page, per plan Option A — extract when a third page requires it).

---

### `requests/page.tsx` — card navigation

```tsx
// Before:
{requests.map(req => <RequestCard key={req.id} req={req} />)}

// After:
{requests.map(req => (
  <Link
    key={req.id}
    href={`/client/requests/${req.id}`}
    className="block hover:opacity-80 transition-opacity"
  >
    <RequestCard req={req} />
  </Link>
))}
```

No changes to `RequestCard` internals, `RequestStatusBadge`, or any other logic.

---

## 3. DB Verification

### Baseline (unchanged)

| Table | Count |
|-------|-------|
| `service_requests` | 10 |
| Client-linked (`client_id IS NOT NULL`) | 1 (REQ-008) |
| Walk-in (`client_id IS NULL`) | 9 |

### FK confirmed

| Constraint | FK Column | Ref Table | Ref Column |
|-----------|-----------|-----------|-----------|
| `fk_service_requests_converted_to_job` | `converted_to_job_id` | `jobs` | `id` |

Single FK from `service_requests` to `jobs` → PostgREST resolves `jobs!converted_to_job_id(...)` unambiguously ✅

### RLS Simulation A — David Park accessing REQ-008 by ID

```sql
BEGIN;
SET LOCAL role = 'authenticated';
SET LOCAL "request.jwt.claims" = '{"sub":"ae091c96-a0f0-443f-87dc-c0b5c909e9b6","aud":"authenticated"}';
SELECT sr.id, sr.request_number, sr.status, sr.client_id IS NOT NULL AS has_client_id,
       j.id AS linked_job_id, j.job_number, j.status AS job_status
FROM service_requests sr
LEFT JOIN jobs j ON j.id = sr.converted_to_job_id
WHERE sr.id = '4172b8c8-e614-402d-8222-499e6e14a30b';
ROLLBACK;
```

Result:

| id | request_number | status | has_client_id | linked_job_id | job_number | job_status |
|----|----------------|--------|---------------|---------------|------------|------------|
| 4172b8c8-... | 8 | new | true | null | null | null |

**✅ 1 row returned.** `linkedJob = null` (REQ-008 not converted). → detail page renders without Linked Job section. Correct.

### RLS Simulation B — David Park accessing walk-in request (REQ-001, `client_id=NULL`)

Result: **✅ 0 rows.** RLS blocks walk-in → `getClientRequestById` returns null → `notFound()` fires → 404 page shown.

### RLS Simulation C — David Park accessing non-existent UUID

Result: **✅ 0 rows.** No row → null → `notFound()` → 404 page shown.

---

## 4. Field Rendering Verification

| Field | Source | Rendered as |
|-------|--------|-------------|
| Request number | `fmtReqNumber(req.reqNumber)` | `REQ-0008` ✅ |
| Service type | `SERVICE_TYPE_LABELS[row.service_type]` | `"DVR/NVR Issue"` ✅ |
| Urgency | `PriorityBadge value={request.urgency}` | Coloured badge ✅ |
| Status | `RequestStatusBadge` | `"New"`, `"Converted to Job"`, etc. ✅ |
| Submitted | `fmtDatetime(request.createdAt)` | `"May 26, 2026 · 06:02 AM"` ✅ |
| Age (open) | `calcJobAge(createdAt, updatedAt, status)` | `"Open for X days"` ✅ |
| Age (converted) | `calcJobAge(createdAt, updatedAt, "completed")` | `"Completed in X days"` ✅ |
| Description | Full text, `whitespace-pre-wrap` | No truncation ✅ |
| Linked job | Only shown when `linkedJob !== null` | Hidden for REQ-008 ✅ |
| `notes` | Not selected, not rendered | Admin-internal field excluded ✅ |
| `client_id` | Not selected, not rendered | ✅ |
| UUID in UI | Not rendered | ✅ |

---

## 5. Build and Lint

| Check | Result |
|-------|--------|
| `npm run build` | ✅ 0 TypeScript errors · **27 routes** (26 → 27, `/client/requests/[id]` added) |
| `npm run lint` | ✅ 0 errors · 0 warnings |

New route confirmed in build output:
```
├ ƒ /client/requests/[id]
```

---

## 6. Confirmation: No DB/RLS/Schema Changes

| Item | Change made? |
|------|-------------|
| Database migration | ❌ None |
| RLS policy change | ❌ None |
| Schema change | ❌ None |
| `service-requests.ts` (admin data helper) | ❌ Untouched |
| `getClientRequests()` / `getClientJobs()` / `getClientInvoices()` | ❌ Untouched |

---

## 7. Bugs Found

**None.** Implementation matches Phase 10F-A plan exactly.

---

## 8. Final Verdict

**PASS — all verification checks passed.**

David Park can navigate from `/client/requests` to `/client/requests/[REQ-008-uuid]` and sees the full request detail. Walk-in and non-existent UUIDs return 404. Internal `notes` field is excluded. `linkedJob` section is correctly hidden (REQ-008 is not converted). Build and lint clean at 0 errors, 27 routes.

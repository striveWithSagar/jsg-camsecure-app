# Phase 10F-A: Client Request Detail Page — Audit & Implementation Plan

**Date:** 2026-05-28  
**Status:** PLAN ONLY — no code changes in this phase  
**Base commit:** 86b7845

---

## 1. Audit Findings

### 1.1 Current client request routes

| Route | File | Status |
|-------|------|--------|
| `/client/requests` | `(client)/client/requests/page.tsx` | ✅ Exists |
| `/client/requests/new` | `(client)/client/requests/new/page.tsx` | ✅ Exists |
| `/client/requests/[id]` | — | ❌ Missing |

The `RequestCard` in `requests/page.tsx` currently renders as a non-navigable `<div>`. Each card needs to be wrapped in a `<Link href="/client/requests/${req.id}">` to enable navigation to the detail page.

---

### 1.2 RLS — no changes needed

**`service_requests_select` (client clause):**
```sql
(client_id = auth_client_id()) AND (auth_role() = 'client')
```

`getClientRequestById(id)` adds `.eq("id", id)` on top of this. For any given `id`:
- If `id` belongs to a row where `client_id = auth_client_id()` → row returned ✅
- If `id` belongs to a row where `client_id ≠ auth_client_id()` (another client's) → null
- If `id` belongs to a row where `client_id IS NULL` (walk-in) → null
- If `id` doesn't exist → null

All four cases return null. The page calls `notFound()` on null → **automatic 404 for unauthorised and non-existent IDs**. No additional RLS policy needed.

**`jobs_select` (client clause):**
```sql
(client_id = auth_client_id()) AND (auth_role() = 'client')
```

PostgREST applies `jobs` RLS independently on the nested embed. A linked job is returned only if `jobs.client_id = auth_client_id()`. Since a client-submitted request that is converted to a job will have the same `client_id` on both the request and the job, the embed will resolve correctly in production use.

---

### 1.3 FK for the join

```
service_requests.converted_to_job_id → jobs.id
Constraint name: fk_service_requests_converted_to_job
```

This is the **only FK from `service_requests` to `jobs`** — PostgREST can resolve the relationship unambiguously. The query can use `jobs!converted_to_job_id(...)` (explicit FK column hint) or `jobs(...)` (both work; explicit hint is safer).

---

### 1.4 `notes` field — admin-internal, must NOT be shown to clients

The `service_requests.notes` column is labeled "Internal Notes" in the admin `RequestDetail` view and is editable only by admin/dispatcher. It contains dispatcher-entered context and follow-up notes. **This field must not be selected or rendered in any client-facing view.**

`getClientRequestById` must omit `notes` from its SELECT. The detail page must not reference it.

---

### 1.5 Converted requests — DB state finding

All 3 seeded `converted` service_requests have `client_id = NULL` (walk-in requests converted by admin). This means **no client-visible request currently has a linked job**. The `linkedJob` field will always be null in current test data.

This is expected. The linked job UI is future-proof: when a client submits a request (e.g., REQ-008) and admin converts it to a job, the resulting job will have matching `client_id`. The `linkedJob` section will appear automatically at that point.

For testing purposes, the plan includes a SQL simulation to verify the join resolves correctly.

---

### 1.6 `params` — Next.js 16 async requirement

In Next.js 16 App Router, `params` in Server Components is `Promise<{ id: string }>` and must be awaited:
```typescript
type Props = { params: Promise<{ id: string }> };
export default async function Page({ params }: Props) {
  const { id } = await params;
  ...
}
```
This matches the pattern used in `/technician/jobs/[id]/page.tsx`.

---

### 1.7 `REQUEST_STATUS_BADGE` and `RequestStatusBadge` — duplication

These are currently defined inline in `requests/page.tsx`. The detail page also needs them. Two options:

- **Option A (recommended):** Duplicate inline in the detail page — keeps each file self-contained, matches the existing pattern for `CLIENT_STATUS_LABEL` in `client/jobs/page.tsx`.
- **Option B:** Extract to a shared `src/components/client/RequestStatusBadge.tsx` component — reduces duplication if a third page needs it.

**Plan recommendation: Option A.** The constant is small. Only 2 pages need it. Extract when a third page requires it.

---

## 2. Summary — What Already Works vs What Is Missing

| Item | Status |
|------|--------|
| RLS: client sees only own requests by ID | ✅ Already enforced |
| RLS: walk-in / other-client requests return null | ✅ Already enforced |
| FK: `service_requests.converted_to_job_id → jobs.id` | ✅ Confirmed |
| `jobs_select`: client can read own jobs (for linked job embed) | ✅ Confirmed |
| `getClientRequestById(id)` data helper | ❌ Missing |
| `ClientRequestDetail` type | ❌ Missing |
| `/client/requests/[id]` page | ❌ Missing |
| `/client/requests/[id]/loading.tsx` | ❌ Missing |
| `/client/requests/[id]/error.tsx` | ❌ Missing |
| `RequestCard` navigates to detail page | ❌ Cards are non-navigable `<div>` |

**Conclusion: No RLS change, no migration, no schema change. 3 new files + 2 small edits.**

---

## 3. Implementation Plan

### 3.1 Files to create

#### `src/lib/data/client-portal.ts` — ADD `getClientRequestById` (within existing file)

**`ClientRequestDetail` type:**
```typescript
export type ClientRequestDetail = {
  id:          string;
  reqNumber:   number | null;
  serviceType: string;   // display label
  urgency:     string;   // raw enum
  status:      string;   // raw enum
  description: string;
  createdAt:   string;   // raw ISO
  updatedAt:   string;   // raw ISO
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

**Local raw types (not exported):**
```typescript
type RawJobEmbed = {
  job_number:   number | null;
  status:       string;
  site_name:    string | null;
  scheduled_at: string | null;
  completed_at: string | null;
} | null;

type RequestDetailRawRow = {
  id:                  string;
  request_number:      number | null;
  service_type:        string;
  urgency:             string;
  status:              string;
  description:         string;
  created_at:          string;
  updated_at:          string;
  converted_to_job_id: string | null;
  jobs:                RawJobEmbed;
};
```

**Function:**
```typescript
// No client_id filter — RLS enforces client_id = auth_client_id() for role 'client'
// Returns null if row not found OR if RLS blocks the row (covers 404 and unauthorised)
export async function getClientRequestById(id: string): Promise<ClientRequestDetail | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("service_requests")
    .select(
      "id, request_number, service_type, urgency, status, description, " +
      "created_at, updated_at, converted_to_job_id, " +
      "jobs!converted_to_job_id(job_number, status, site_name, scheduled_at, completed_at)"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[getClientRequestById]", error.message);
    return null;
  }
  if (!data) return null;

  const row = data as unknown as RequestDetailRawRow;
  const j   = row.jobs;

  return {
    id:          row.id,
    reqNumber:   row.request_number ?? null,
    serviceType: SERVICE_TYPE_LABELS[row.service_type] ?? row.service_type,
    urgency:     row.urgency,
    status:      row.status,
    description: row.description,
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
    isTerminal:  row.status === "converted" || row.status === "cancelled",
    linkedJob:   j ? {
      jobNumber:   j.job_number ?? null,
      status:      j.status,
      site:        j.site_name ?? "—",
      scheduledAt: j.scheduled_at ?? null,
      completedAt: j.completed_at ?? null,
    } : null,
  };
}
```

**Why `.maybeSingle()` not `.single()`:** `.single()` throws `PGRST116` when no rows are returned; `.maybeSingle()` returns null cleanly. Both RLS-blocked rows and truly non-existent rows return null — the page calls `notFound()` for both.

**`notes` deliberately excluded:** The `notes` column is admin-internal. It must not appear in the SELECT string or in the returned type.

---

#### `src/app/(client)/client/requests/[id]/page.tsx` — CREATE

Async Server Component. Pattern mirrors `(technician)/technician/jobs/[id]/page.tsx`.

```
UI layout:

← Your Requests

REQ-0008                          [New]
DVR/NVR Issue                     [Medium urgency badge]

┌────────────────────────────────────────────────┐
│ DETAILS                                         │
│ Service Type   DVR/NVR Issue                    │
│ Submitted      May 26, 2026 · 06:02 AM          │
│ Duration       Open for 2 days                  │
└────────────────────────────────────────────────┘

┌────────────────────────────────────────────────┐
│ DESCRIPTION                                     │
│ [full text, no truncation]                      │
└────────────────────────────────────────────────┘

[only shown when linkedJob !== null]
┌────────────────────────────────────────────────┐
│ LINKED JOB                                      │
│ JOB-0022    [Assigned]                          │
│ Site        67 Haverhill Crescent               │
│ Scheduled   May 29, 2026 · 10:57 PM             │
└────────────────────────────────────────────────┘
```

Key implementation points:
- `const { id } = await params;` — Next.js 16 requirement
- `if (!request) notFound();` — covers RLS-blocked and non-existent IDs
- `calcJobAge(request.createdAt, request.updatedAt, request.isTerminal ? "completed" : request.status)` — same mapping as list page
- `linkedJob` section renders only when `request.linkedJob !== null`
- `fmtJobNumber(request.linkedJob.jobNumber)` for linked job number
- No `notes` field, no `client_id`, no `organization_id`, no admin actions
- Back link to `/client/requests`

---

#### `src/app/(client)/client/requests/[id]/loading.tsx` — CREATE

```typescript
import { SkeletonCards } from "@/components/shared/SkeletonPage";
export default function Loading() {
  return <div className="space-y-4 py-2"><SkeletonCards count={3} /></div>;
}
```

---

#### `src/app/(client)/client/requests/[id]/error.tsx` — CREATE

```typescript
"use client";
import { ErrorBlock } from "@/components/shared/ErrorBlock";
export default function Error(props: Parameters<typeof ErrorBlock>[0]) {
  return <ErrorBlock {...props} />;
}
```

---

### 3.2 Files to modify

#### `src/app/(client)/client/requests/page.tsx`

**Change:** Wrap each `RequestCard` in a `<Link>` to make cards clickable.

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

#### `src/lib/data/client-portal.ts`

Add `ClientRequestDetail` type, local `RawJobEmbed` and `RequestDetailRawRow` types, and `getClientRequestById()` as described in §3.1. All existing exports untouched.

---

### 3.3 No changes needed

| File | Reason |
|------|--------|
| Supabase schema | No new columns or tables |
| Supabase RLS | All policies already correct |
| `src/lib/data/service-requests.ts` | Admin helper — untouched |
| `ClientTopNav.tsx` | "Requests" link uses `startsWith` → active on `/client/requests/[id]` automatically |
| `src/lib/utils.ts` | `fmtReqNumber`, `fmtDatetime`, `fmtJobNumber`, `calcJobAge` all available |
| `src/lib/constants.ts` | `REQUEST_STATUS_LABELS` already exported |

**Note on `ClientTopNav` active state:** The "Requests" link has `href = "/client/requests"` with exact-match active state. On `/client/requests/[id]`, it will NOT be active (exact match). This is acceptable — the page has a clear back link to `/client/requests`. If active breadcrumb nav is desired, the exact-match condition could be changed to `startsWith` for just the Requests item, but that is out of scope for this phase.

---

## 4. Data Shape — `getClientRequestById` vs `getClientRequests`

| Field | `ClientRequestItem` (list) | `ClientRequestDetail` (detail) |
|-------|---------------------------|-------------------------------|
| `id` | ✅ | ✅ |
| `reqNumber` | ✅ | ✅ |
| `serviceType` | ✅ (label) | ✅ (label) |
| `urgency` | ✅ | ✅ |
| `status` | ✅ | ✅ |
| `description` | ✅ (truncated in UI) | ✅ (full text) |
| `createdAt` | ✅ | ✅ |
| `updatedAt` | ✅ | ✅ |
| `isTerminal` | ✅ | ✅ |
| `hasJob` | ✅ (boolean) | — replaced by `linkedJob` object |
| `linkedJob` | — | ✅ (null or `{ jobNumber, status, site, scheduledAt, completedAt }`) |
| `notes` | ❌ excluded | ❌ excluded (admin-internal) |
| `client_id` | ❌ excluded | ❌ excluded |
| `organization_id` | ❌ excluded | ❌ excluded |

---

## 5. Testing Checklist

| # | Test | Expected |
|---|------|----------|
| 1 | David Park visits `/client/requests` | REQ-0008 card is a clickable link → navigates to `/client/requests/[REQ-008-uuid]` |
| 2 | David Park visits `/client/requests/[REQ-008-uuid]` | Detail page shows: REQ-0008, status=New, DVR/NVR Issue, Medium urgency, submitted date, age, full description. No `notes` field, no admin actions. |
| 3 | `notes` admin field not visible | Client detail page has no "Internal Notes" section |
| 4 | David Park visits `/client/requests/[walk-in-request-uuid]` | `notFound()` → 404 page (RLS blocks, returns null) |
| 5 | David Park visits `/client/requests/[non-existent-uuid]` | `notFound()` → 404 page (row not found, returns null) |
| 6 | David Park visits `/client/requests/[another-client-request-uuid]` | `notFound()` → 404 page (RLS blocks different client's request) |
| 7 | `linkedJob` null (REQ-0008 is unconverted) | Linked job section NOT rendered |
| 8 | SQL simulation: join resolves correctly for a converted client-linked request | `jobs!converted_to_job_id(...)` returns job fields when `jobs.client_id = auth_client_id()` |
| 9 | `fmtReqNumber` format | `REQ-0008` (not UUID, not `8`) |
| 10 | Age label for open request | "Open for X days" |
| 11 | Age label for converted request | "Completed in X days" (isTerminal mapping) |
| 12 | "Requests" nav item | Active on `/client/requests`, inactive on `/client/requests/[id]` (exact match) |
| 13 | `/client/requests/new` still works | No regression from nav or page changes |
| 14 | Build: 0 TypeScript errors | `npm run build` passes — 27 routes |
| 15 | Lint: 0 warnings | `npm run lint` passes |

---

## 6. Files Affected — Complete Summary

| File | Action | Reason |
|------|--------|--------|
| `src/lib/data/client-portal.ts` | **MODIFY** | Add `ClientRequestDetail` type + `getClientRequestById()` |
| `src/app/(client)/client/requests/page.tsx` | **MODIFY** | Wrap cards in `<Link>` for navigation |
| `src/app/(client)/client/requests/[id]/page.tsx` | **CREATE** | Detail page |
| `src/app/(client)/client/requests/[id]/loading.tsx` | **CREATE** | Skeleton |
| `src/app/(client)/client/requests/[id]/error.tsx` | **CREATE** | Error boundary |
| Supabase schema | None | No migration |
| Supabase RLS | None | All policies already correct |

---

## 7. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| PostgREST join `jobs!converted_to_job_id(...)` returns array instead of object | Low | Low | If PostgREST returns an array, cast `row.jobs[0] ?? null` in the mapper. Verify in build — TypeScript will catch shape mismatch. |
| `jobs` RLS blocks embed for client (job `client_id` mismatch) | Low in prod | Low | `linkedJob` returns null → section not shown. Correct and safe. |
| `notFound()` import from wrong module | None | Low | Import from `"next/navigation"` (Next.js 16 App Router) |
| Admin `notes` field accidentally included in SELECT | None | Medium | SELECT string in `getClientRequestById` explicitly excludes `notes` |
| Route count changes 26 → 27 | None | None | Expected |

---

## 8. Conclusion

This is a **minimal, low-risk read-only feature**. RLS already provides the correct data isolation for both the direct ID lookup and the linked job embed. The implementation requires:

- 1 new data helper function (~30 lines)
- 1 new detail page component (~90 lines)
- 2 boilerplate new files (loading, error)
- 1 one-line change to the list page (wrap cards in Link)

No migration, no RLS change, no schema change. Ready for Phase 10F-B.

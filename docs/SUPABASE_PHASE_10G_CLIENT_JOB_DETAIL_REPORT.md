# Phase 10G: Client Job Detail — Implementation Report

**Date:** 2026-05-28  
**Status:** COMPLETE — awaiting commit approval  
**Base commit:** 2ce6f60

---

## 1. Files Changed

| File | Action | Description |
|------|--------|-------------|
| `src/lib/data/client-portal.ts` | **MODIFIED** | Added `ClientJobDetail` type + `getClientJobById()` |
| `src/app/(client)/client/jobs/page.tsx` | **MODIFIED** | Wrapped cards in `<Link>`, removed "coming soon" text |
| `src/app/(client)/client/jobs/[id]/page.tsx` | **CREATED** | Server Component — client job detail page |
| `src/app/(client)/client/jobs/[id]/loading.tsx` | **CREATED** | Skeleton loading state |
| `src/app/(client)/client/jobs/[id]/error.tsx` | **CREATED** | Error boundary using `ErrorBlock` |

No schema changes. No RLS changes. No migration. Admin job helpers untouched.

---

## 2. Implementation Summary

### `getClientJobById()` — `src/lib/data/client-portal.ts`

**`ClientJobDetail` type:**
```typescript
export type ClientJobDetail = {
  id:           string;
  jobNumber:    number | null;
  serviceType:  string;
  status:       string;
  priority:     string;
  site:         string;
  address:      string;
  scheduledAt:  string | null;
  completedAt:  string | null;
  createdAt:    string;
  updatedAt:    string;
  linkedRequest: {
    id:        string;   // jobs.request_id (FK) — used to build /client/requests/[id] link
    reqNumber: number | null;
    createdAt: string;
    status:    string;
  } | null;
};
```

**Fields deliberately excluded:** `dispatcher_notes`, `technician_notes`, `job_notes`, `technician` profile details, `organization_id`.

**Query:** `jobs` with embed `service_requests!request_id(request_number, created_at, status)`. Uses `.maybeSingle()` — returns null cleanly for RLS-blocked or non-existent rows.

**Array guard:** `sr = Array.isArray(row.service_requests) ? (row.service_requests[0] ?? null) : row.service_requests` — handles PostgREST returning embed as array or object.

**`linkedRequest` null when:** (a) `jobs.request_id` is null (no linked request), or (b) the embed is RLS-blocked (walk-in service_request with `client_id = NULL` — invisible to client role). Both cases safely suppress the Linked Request section.

---

### `/client/jobs/[id]/page.tsx`

Async Server Component. Awaits `params: Promise<{ id: string }>` per Next.js 16 pattern. Calls `notFound()` on null.

**UI sections:**
- Back link → `/client/jobs`
- Header: `fmtJobNumber(jobNumber)` + service type subtitle + `PriorityBadge` + `StatusBadge`
- **Details** card: Status (client-friendly label), Service Type, Site (`MapPin`), Address, Scheduled (`fmtDatetime`), Completed (if set), Duration (`calcJobAge`)
- **Timeline** card: ordered milestone list with connecting lines — Request Created (if `linkedRequest`), Job Created, Scheduled (if set), Completed (if set)
- **Linked Request** card: conditionally rendered when `linkedRequest !== null` — shows `fmtReqNumber`, `REQUEST_STATUS_LABELS` badge, "View request →" link to `/client/requests/[id]`

**Status display:** `CLIENT_STATUS_LABEL` maps raw enum to client-friendly strings ("assigned" → "Scheduled", "on_the_way" → "Technician En Route", etc.).

**Age mapping:** `calcJobAge(job.createdAt, job.completedAt, job.status)` — uses `completed_at` (job completion timestamp), not `updated_at`.

---

### `jobs/page.tsx` — navigation + cleanup

```tsx
// Before:
{active.map(j => <JobCard key={j.id} job={j} />)}

// After:
{active.map(j => (
  <Link key={j.id} href={`/client/jobs/${j.id}`} className="block hover:opacity-80 transition-opacity">
    <JobCard job={j} />
  </Link>
))}
```

Same pattern for completed section. "Detailed view — coming soon" `<div>` removed from `JobCard`.

---

## 3. Private Fields Audit

| Field | In SELECT? | In UI? |
|-------|-----------|--------|
| `dispatcher_notes` | ❌ Not selected | ❌ Not rendered |
| `technician_notes` | ❌ Not selected | ❌ Not rendered |
| `job_notes` (table) | ❌ Not queried | ❌ Not rendered |
| Technician profile (name/email/phone) | ❌ Not queried | ❌ Not rendered |
| `organization_id` | ❌ Not selected | ❌ Not rendered |
| `client_id` | ❌ Not selected | ❌ Not rendered |

---

## 4. FK Verification

| Constraint | FK Column | Ref Table | Ref Column |
|-----------|-----------|-----------|-----------|
| `jobs_request_id_fkey` | `request_id` | `service_requests` | `id` |

PostgREST hint `service_requests!request_id(...)` resolves unambiguously ✅

---

## 5. RLS Simulations

David Park UUID: `ae091c96-a0f0-443f-87dc-c0b5c909e9b6`

### Sim A — David Park accessing JOB-001 (Metro Security Ltd, completed)

Result: **✅ 1 row.** `has_client=true`, `status=completed`, `has_completed=true`.  
→ Detail page renders. No `linkedRequest` (JOB-001 `request_id=NULL`).

### Sim B — David Park accessing JOB-007 (Riverside School — different client)

Result: **✅ 0 rows.** RLS blocks non-Metro job → `getClientJobById` returns null → `notFound()` → 404.

### Sim C — David Park accessing non-existent UUID

Result: **✅ 0 rows.** No row → null → `notFound()` → 404.

### Sim D — Service_requests embed RLS for JOB-022 (has `request_id` → REQ-015, walk-in)

```sql
SELECT j.id, j.job_number, j.request_id,
       sr.request_number AS linked_req_number,
       sr.client_id IS NOT NULL AS linked_req_has_client
FROM jobs j
LEFT JOIN service_requests sr ON sr.id = j.request_id
WHERE j.id = 'f0aaa2a8-88aa-4f6c-8071-4d5d8d1b28e7';
```

Result:

| id | job_number | request_id | linked_req_number | linked_req_has_client |
|----|-----------|-----------|-------------------|-----------------------|
| f0aaa2a8-... | 22 | 2b00a483-... | null | false |

`linked_req_number=null` — RLS blocks the walk-in REQ-015 (client_id=NULL) even though `request_id` is set. PostgREST embed will return null for the service_requests embed → `linkedRequest=null` in `getClientJobById` → Linked Request section not shown. ✅

---

## 6. Field Rendering Verification

| Field | Source | Rendered as |
|-------|--------|-------------|
| Job number | `fmtJobNumber(job.jobNumber)` | `JOB-0001` ✅ |
| Service type | `SERVICE_TYPE_LABELS[row.service_type]` | `"Maintenance"`, etc. ✅ |
| Priority | `PriorityBadge value={job.priority}` | Coloured badge ✅ |
| Status (badge) | `StatusBadge value={job.status}` | Standard job badge ✅ |
| Status (friendly) | `CLIENT_STATUS_LABEL[job.status]` | `"Scheduled"`, `"Completed"`, etc. ✅ |
| Scheduled | `fmtDatetime(job.scheduledAt)` | `"May 29, 2026 · 10:57 PM"` ✅ |
| Completed | `fmtDatetime(job.completedAt)` | Only rendered when set ✅ |
| Age | `calcJobAge(createdAt, completedAt, status)` | `"Completed in X days"` / `"Open for X days"` ✅ |
| Linked request | Conditional on `linkedRequest !== null` | Hidden in current data (walk-in RLS) ✅ |
| No private fields | `dispatcher_notes`, `technician_notes`, etc. | ❌ Absent from SELECT and UI ✅ |

---

## 7. Build and Lint

| Check | Result |
|-------|--------|
| `npm run build` | ✅ 0 TypeScript errors · **28 routes** (27 → 28, `/client/jobs/[id]` added) |
| `npm run lint` | ✅ 0 errors · 0 warnings |

New route confirmed:
```
├ ƒ /client/jobs/[id]
```

---

## 8. Confirmation: No DB/RLS/Schema Changes

| Item | Change made? |
|------|-------------|
| Database migration | ❌ None |
| RLS policy change | ❌ None |
| Schema change | ❌ None |
| Admin job helpers (`src/lib/data/jobs.ts`) | ❌ Untouched |
| `getClientJobs()` | ❌ Untouched |

---

## 9. Bugs Found

**None.** All RLS simulations pass. Private fields excluded. Build and lint clean.

---

## 10. Final Verdict

**PASS — all verification checks passed.**

David Park can navigate from `/client/jobs` to `/client/jobs/[uuid]` and see full job details. Riverside School jobs and non-existent UUIDs return 404. Walk-in linked requests are invisible (Linked Request section not shown — correct). `dispatcher_notes`, `technician_notes`, and all other private fields are absent from both the SELECT query and the rendered UI. Build 28 routes, lint clean.

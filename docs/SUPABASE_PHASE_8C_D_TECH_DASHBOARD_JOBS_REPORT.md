# Supabase Phase 8C-D — Technician Dashboard & Jobs List Report

> Status: COMPLETE
> Date: 2026-05-25
> Project: JSG_CamSecure (ref: gbvstrhorjjvlxnfmxcz)

---

## What Changed

The technician dashboard (`/technician`) and jobs list (`/technician/jobs`) are now
fully backed by Supabase. `useMockStore`, `MOCK_TECHNICIAN`, all localStorage reads,
and the hardcoded Alex Rivera string filter are completely removed from the technician
portal. All three technician portal pages now run as async Server Components.

---

## Files Changed

| File | Type | Change |
|---|---|---|
| `src/lib/data/tech-jobs.ts` | Created | `getTechJobList()` — RLS-filtered job list with service type labels, formatted scheduled times, active-first sort |
| `src/app/(technician)/technician/page.tsx` | Modified | Async Server Component; parallel-fetches `getCurrentProfile()` + `getTechJobList()`; passes `firstName` + `jobs` to view |
| `src/app/(technician)/technician/TechnicianDashboardView.tsx` | Modified | Removed `"use client"`, `useMockStore`, `MOCK_TECHNICIAN`; now a Server Component accepting `{ firstName, jobs }` props |
| `src/app/(technician)/technician/jobs/page.tsx` | Modified | Removed `"use client"`, `useMockStore`, `MOCK_TECHNICIAN`; async Server Component; `Section` accepts `TechJobItem[]` |

### Files NOT changed

| File | Status |
|---|---|
| `src/lib/data/jobs.ts` | Unchanged — admin `getJobById()` reused by job detail (Phase 8C-E) |
| `src/app/(technician)/technician/jobs/[id]/page.tsx` | Unchanged — already Supabase-backed (Phase 8C-E) |
| `src/components/technician/TechJobDetail.tsx` | Unchanged — already Supabase-backed (Phase 8C-E) |
| `src/components/technician/JobStatusWidget.tsx` | Unchanged — already Supabase-backed (Phase 8C-E) |
| `src/components/technician/TechHeader.tsx` | Unchanged — already Supabase-backed (Phase 8C-C) |
| `src/app/(technician)/layout.tsx` | Unchanged — already has role guard (Phase 8C-C) |

---

## Architecture

```
(technician)/layout.tsx  (Server Component — async)
  └── getCurrentProfile()
  └── role !== "technician" → redirect("/login/technician")
  └── ProfileProvider({ profile })
        ├── TechHeader                ← useProfile() → name, initials, signout
        └── {children}

/technician/page.tsx  (Server Component — async)
  └── Promise.all([getCurrentProfile(), getTechJobList()])
  └── TechnicianDashboardView({ firstName, jobs })   ← Server Component

/technician/jobs/page.tsx  (Server Component — async)
  └── getTechJobList()
  └── Section({ title, jobs: active })               ← Server Component
  └── Section({ title, jobs: completed })            ← Server Component

/technician/jobs/[id]/page.tsx  (Server Component — async)
  └── getJobById(id)   ← RLS-filtered; notFound() if not owned
  └── TechJobDetail({ job })
        └── JobStatusWidget({ initialStatus, jobId })   ← Client Component
              └── supabase.update({ status }) + trigger → job_status_history
```

---

## `getTechJobList()` Design

**Location:** `src/lib/data/tech-jobs.ts`

**Query:**
```ts
supabase
  .from("jobs")
  .select("id, service_type, priority, status, site_name, address, scheduled_at, clients(name)")
  .order("scheduled_at", { ascending: true, nullsFirst: false })
```

No `eq("technician_id", ...)` in app code — RLS policy enforces this:
```sql
(technician_id = auth_technician_id()) AND (auth_role() = 'technician')
```

**Sort (in-memory after mapping):**
```
in_progress → started → on_the_way → assigned → needs_parts → rescheduled → completed → cancelled
```
Within each status group, `scheduled_at` ASC order (from DB) is preserved.

---

## Verification

### Mock references removed

Grep over entire `(technician)` app tree and component folder:
- `useMockStore` → **0 matches**
- `MOCK_TECHNICIAN` → **0 matches**
- `MOCK_JOBS` → **0 matches**

### Live Supabase data for Alex Rivera

RLS query confirms 5 jobs visible when `auth_technician_id() = a0000000-...000301`:

| Job | Client | Service Type | Status |
|---|---|---|---|
| `a0000000-...000501` | Metro Security Ltd | Camera Outage | `in_progress` |
| `a0000000-...000508` | Metro Security Ltd | DVR/NVR Issue | `in_progress` |
| `a0000000-...000509` | Riverside School | New Installation | `assigned` |
| `a0000000-...000505` | Sunrise Hotel | Maintenance | `completed` |
| `a0000000-...000510` | Metro Security Ltd | Maintenance | `completed` |

Dashboard stats: **3 active · 2 completed · 0 needs parts**

### Role guard

`(technician)/layout.tsx` (Phase 8C-C) redirects to `/login/technician` for:
- Unauthenticated visitors
- Admin users (`role = 'admin'`)
- Client users (`role = 'client'`)

### Status change → list refresh

`JobStatusWidget` (Phase 8C-E) writes to Supabase directly. Because `/technician/jobs`
is a dynamic Server Component (`ƒ`), every navigation to the page runs `getTechJobList()`
fresh from Supabase — the updated status is reflected immediately on the next page load.
No client-side cache, no stale localStorage.

---

## Build Result

**✓ Clean — 0 TypeScript errors, 24 routes (unchanged count).**

---

## Lint Result

**✓ Clean — 0 ESLint errors or warnings.**

---

## Remaining Limitations

| Item | Detail |
|---|---|
| **`today` detection is server-timezone-relative** | `formatScheduled()` compares `d.toDateString()` against `new Date()` on the server. If the server runs in UTC and the technician is far from UTC, "Today" may be off by ±1 day. Acceptable for this deployment; fixable by passing `timezone` in the query or using UTC date math. |
| **No loading spinner between navigation** | Server Components re-fetch on each visit. Next.js shows a loading indicator during navigation but no skeleton state while data loads. A `loading.tsx` file can add this later. |
| **`completedToday` always 0 on seeded data** | Seeded jobs have `scheduled_at` in May 23–24, 2026. "Today" = May 25 so no jobs match the `Today` filter. This is a seed data date issue, not a code issue. |
| **`cancelled` jobs hidden from active list** | `cancelled` is excluded from the active section — consistent with the previous mock behaviour (`status !== "completed"`). |

---

## Remaining Mock Dependencies (full portal)

| File | Dependency | Remaining where? |
|---|---|---|
| `src/app/(dashboard)/requests/[id]/convert/page.tsx` | `MOCK_TECHNICIAN` | Admin portal — used as a name placeholder in convert form |
| `src/lib/mock-session.ts` | `MOCK_TECHNICIAN`, `MOCK_CLIENT` | Still exported; `MOCK_CLIENT` used by client portal |
| `src/lib/constants.ts` | `MOCK_TECHNICIANS`, `MOCK_JOBS`, etc. | Still exported; can be removed once all consumers are migrated |

---

## Recommended Next Step

**Phase 8D — Client portal auth wiring and data migration.**

All technician portal pages are now fully Supabase-backed. The client portal
(`(client)/layout.tsx`, `/client/jobs`, `/client/invoices`, `/client/requests/new`)
still uses `MOCK_CLIENT` and mock data — same migration pattern applies.

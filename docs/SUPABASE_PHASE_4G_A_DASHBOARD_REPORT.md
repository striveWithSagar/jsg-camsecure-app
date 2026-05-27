# Supabase Phase 4G-A — Admin Dashboard Report

> Status: COMPLETE
> Date: 2026-05-24
> Project: JSG_CamSercure (ref: gbvstrhorjjvlxnfmxcz)

---

## What Changed

The admin `/dashboard` page now reads live data from Supabase.
`useMockStore`, `MOCK_TECHNICIANS`, and `MOCK_INVOICES` are fully removed from
this route. All six dashboard panels — emergency alert, today's schedule, field
crew, needs attention, new requests, and month at a glance — now source data
from Supabase queries.

---

## Files Changed

| File | Type | Change |
|---|---|---|
| `src/lib/data/dashboard.ts` | Created | `getDashboardData()` — 4 parallel queries, all metrics computed server-side |
| `src/app/(dashboard)/dashboard/DashboardView.tsx` | Rewritten | `"use client"` removed; `useMockStore` removed; accepts `{ data: DashboardData }` props |
| `src/app/(dashboard)/dashboard/page.tsx` | Modified | Now `async`; calls `getDashboardData()`, passes to `DashboardView` |

### Files NOT changed

| File | Status |
|---|---|
| `src/lib/mock-store.tsx` | Unchanged — still used by other routes |
| `src/lib/constants.ts` | Unchanged — `MOCK_TECHNICIANS`, `MOCK_INVOICES` still present for other consumers |
| `src/app/(dashboard)/dashboard/loading.tsx` | Unchanged |
| `src/app/(dashboard)/dashboard/error.tsx` | Unchanged |

---

## Architecture

```
/dashboard/page.tsx (Server Component — async)
  └── getDashboardData()    ← 4 parallel server queries
        ├── jobs             (with clients + technicians embed)
        ├── service_requests (status, urgency, created_at)
        ├── technicians      (with profiles embed)
        └── invoices         (status, total, paid_at)
  └── DashboardView({ data })  ← pure presentational Server Component
```

`DashboardView` lost `"use client"` — it has no state, hooks, or event handlers.

---

## `getDashboardData()` — `src/lib/data/dashboard.ts`

### Four-query parallel fetch

```ts
const [jobsResult, requestsResult, techResult, invoicesResult] = await Promise.all([
  supabase.from("jobs")
    .select("id, service_type, priority, status, site_name, scheduled_at, completed_at, technician_id, clients(name), technicians(profiles(full_name))"),
  supabase.from("service_requests")
    .select("id, client_name, service_type, urgency, status, created_at")
    .order("created_at", { ascending: false }),
  supabase.from("technicians")
    .select("id, specialty, status, profiles(full_name)"),
  supabase.from("invoices")
    .select("status, total, paid_at"),
]);
```

### Metrics — source tables

| Dashboard Metric | Table | Filter |
|---|---|---|
| Today's jobs | `jobs` | `scheduled_at::date = today` |
| Emergency jobs | `jobs` | `priority = 'emergency'` AND `status NOT IN ('completed','cancelled')` |
| Needs attention | `jobs` | `status IN ('needs_parts','rescheduled')` |
| Completed this month | `jobs` | `status = 'completed'` AND `completed_at >= month_start` |
| Upcoming jobs (tomorrow) | `jobs` | `scheduled_at::date = tomorrow` |
| Field crew + status | `technicians` + `profiles` | all rows |
| Crew current site | `jobs` | `ACTIVE_JOB_STATUSES` (`assigned`,`on_the_way`,`started`,`in_progress`) → `technician_id → site_name` map |
| New requests | `service_requests` | `status = 'new'` |
| Open request count | `service_requests` | same |
| Unpaid invoices | `invoices` | `status IN ('unpaid','overdue')` |
| Monthly revenue | `invoices` | `status = 'paid'` AND `paid_at >= month_start` |

### Types exported

```ts
DashTodayJob     = { id, time, client, site, techFirst, priority, status }
DashEmergencyJob = { id, client, site }
DashAttentionJob = { id, client, type, techFirst, status }
DashCrewMember   = { id, name, specialty, status, currentSite: string|null }
DashRequest      = { id, client, type, urgency, created }
DashboardData    = { todayJobs, emergencyJobs, attentionJobs, crew, newRequests,
                     completedThisMonth, upcomingJobCount, openRequestCount,
                     unpaidInvoiceCount, monthlyRevenue, currentMonth,
                     techAvailable, techDeployed }
```

### Crew current site

`techActiveSite` map built from jobs where `status IN ACTIVE_JOB_STATUSES` and
`technician_id` is set. For each crew member: `currentSite = techActiveSite[id]`.
Rendered as `member.currentSite ?? member.specialty` (shows specialty when idle).

---

## What the Dashboard Now Shows (Seeded Data)

| Panel | Source | Expected Values |
|---|---|---|
| Emergency alert | `jobs` | JOB-001 (Metro / Downtown Office Tower, in_progress) |
| Today's schedule | `jobs` scheduled today | JOB-001..004, JOB-007, JOB-011 (2026-05-23 jobs) |
| Needs attention | `jobs` | JOB-004 (needs_parts), JOB-006 (rescheduled) |
| Field crew | `technicians + profiles` | 5 techs; 2 available, 3 deployed |
| New requests | `service_requests` | REQ-001 (Apex Tower, emergency), REQ-005 (Lakeside Clinic, medium) |
| Completed this month | `jobs.completed_at` | 3 (JOB-005, JOB-010, JOB-013) |
| Upcoming (tomorrow) | `jobs.scheduled_at` | 2 (JOB-006, JOB-012 on 2026-05-24) |
| Unpaid invoices | `invoices` | 3 (INV-001 unpaid, INV-003 overdue, INV-004 unpaid, INV-007 unpaid) = 4 |
| Monthly revenue | `invoices` | $4,030 (INV-002 $1,850 + INV-005 $980 + INV-006 $1,200) |

---

## UI Changes (vs Mock)

| Before (mock) | After (Supabase) |
|---|---|
| `"use client"` + `useMockStore()` | Server Component, no hooks |
| `MOCK_TECHNICIANS` for crew panel | `data.crew` from `technicians + profiles` |
| `MOCK_INVOICES` for invoice counts | `data.unpaidInvoiceCount`, `data.monthlyRevenue` from `invoices` |
| `job.scheduled.replace("Today ", "")` | `job.time` (pre-extracted HH:MM) |
| `job.technician.split(" ")[0]` | `job.techFirst` (pre-extracted) |
| `req.urgency.toLowerCase()` | `req.urgency` (DB enum already lowercase) |
| Mock requests from localStorage | Supabase `service_requests` table |
| `currentJob.site.split(",")[0]` | `member.currentSite` (pre-extracted in helper) |

---

## Limitations

| Item | Detail |
|---|---|
| **"Today's schedule" date** | Uses server-side `new Date()` — correct UTC time. If server timezone differs from org timezone, jobs near midnight may appear in wrong column. Acceptable for now. |
| **`completedThisMonth`** | Filters by `completed_at >= month_start`. Jobs marked complete before Phase 4D-B (when `completed_at` wasn't set by app code) would show `completed_at = null` and be excluded. Seeded jobs have correct `completed_at` values — no gap for seeded data. |
| **Monthly revenue** | Filters by `paid_at >= month_start`. All 3 paid seeded invoices have `paid_at` in May 2026 — correct. |
| **Phase 4C-B converted job** | Counted in today's/upcoming/active metrics as a normal job — correct. |
| **`/dashboard`** | Still `ƒ (Dynamic)` — correct for an async Server Component. |

---

## Build Result

**✓ Clean — 0 TypeScript errors, 22 routes (unchanged count).**

`/dashboard` remains `ƒ (Dynamic)`.

---

## Lint Result

**✓ Clean — 0 ESLint errors or warnings.**

---

## Remaining Mock Dependencies

| Page / Component | Mock dependency | Phase |
|---|---|---|
| `/invoices` | `MOCK_INVOICES` | Phase 4H |
| `/technician/*` | `useMockStore().jobs` | Phase 8C |
| `/client/*` | mock data | Phase 8D + 4H |
| `Sidebar` | hardcoded admin name/email | Phase 8E |
| `constants.ts` | `MOCK_TECHNICIANS`, `MOCK_INVOICES` still present | Remove when all consumers migrated |

---

## Recommended Next Step

**Phase 4H — Migrate `/invoices` from `MOCK_INVOICES` to Supabase.**

The `invoices` table is populated with 7 rows. The `/invoices` page is the last
admin read-only page still using mock data. After 4H, all admin list/detail pages
will be Supabase-backed.

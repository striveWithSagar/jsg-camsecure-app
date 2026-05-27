# Supabase Phase 4D-A — Admin Job Board Read Report

> Status: COMPLETE
> Date: 2026-05-24
> Project: JSG_CamSercure (ref: gbvstrhorjjvlxnfmxcz)

---

## What Changed

The admin `/jobs` page now reads live data from Supabase instead of `useMockStore()`.
All 14 jobs (13 seeded + 1 created via Phase 4C-B conversion) are visible.
The Kanban/List toggle is preserved. Mock-store is fully removed from this route.

---

## Files Created / Changed

| File | Type | Change |
|---|---|---|
| `src/lib/data/jobs.ts` | New | `getJobs()` server helper — joins clients + technicians → profiles |
| `src/components/jobs/JobBoard.tsx` | New | Client Component — Kanban/List toggle, receives `JobRow[]` props |
| `src/app/(dashboard)/jobs/page.tsx` | Modified | Async Server Component — fetches jobs, passes to `JobBoard` |

### Files NOT changed (scope boundary held)

| File | Status |
|---|---|
| `src/app/(dashboard)/jobs/[id]/page.tsx` | Unchanged — still mock-store (Phase 4D-B) |
| `src/lib/mock-store.tsx` | Unchanged |
| All other portal pages | Unchanged |

---

## Architecture — Server / Client Split

```
/jobs/page.tsx (Server Component — async)
  └── getJobs()              ← server Supabase client, RLS-gated
  └── <TopBar />             ← Server Component
  └── <JobBoard jobs={...} /> ← Client Component (useState for Kanban/List toggle)
```

The same pattern established in `/requests` (Phase 4A-B): Server Component owns data
fetching; Client Component owns interactive state.

---

## Data Helper — `getJobs()`

**File:** `src/lib/data/jobs.ts`

### Query

```ts
supabase
  .from("jobs")
  .select("id, service_type, priority, status, site_name, scheduled_at, clients(name), technicians(profiles(full_name))")
  .order("scheduled_at", { ascending: true, nullsFirst: false })
```

- `clients(name)` — embedded one-to-one join via `jobs.client_id → clients.id`
- `technicians(profiles(full_name))` — nested join: `jobs.technician_id → technicians.id → profiles.id`
- `nullsFirst: false` — jobs with no scheduled date sort to the end

### `JobRow` type

```ts
type JobRow = {
  id:         string;   // full UUID
  shortId:    string;   // last UUID segment — for compact display
  client:     string;   // clients.name
  site:       string;   // jobs.site_name
  type:       string;   // service_type display label
  priority:   string;   // priority enum value
  status:     string;   // status enum value
  technician: string;   // profiles.full_name or "Unassigned"
  scheduled:  string;   // "Today HH:MM", "Tomorrow HH:MM", or "May 25, 2026"
};
```

### `formatScheduled(iso)`

Converts UTC timestamptz to display string:
- Same day as server now → `"Today HH:MM"`
- Next day → `"Tomorrow HH:MM"`
- Any other date → `"May 25, 2026"` (en-US locale)

### PostgREST embed handling

Without generated types, PostgREST may return embedded relations as objects or arrays.
`extractClientName()` and `extractTechName()` handle both forms, matching the pattern
established in `technicians.ts` (Phase 4C-B). Cast via `as unknown as RawRow[]`.

### RLS

| Operation | Policy |
|---|---|
| SELECT jobs | `jobs_select`: `org = auth_org_id()` |
| Embedded clients | `clients_select`: `org = auth_org_id() AND role IN (...)` |
| Embedded technicians | `technicians_select`: same condition |
| Embedded profiles | `profiles_select_own_org`: `org = auth_org_id()` |

---

## `JobBoard` Client Component

**File:** `src/components/jobs/JobBoard.tsx`

Receives `JobRow[]` as props. All rendering and toggle logic is identical to the former
`/jobs/page.tsx`, with these adaptations:

| Before (mock) | After (Supabase) |
|---|---|
| `job.id` displayed in mono ("JOB-001") | `job.shortId` displayed (last UUID segment) |
| `job.id` in Link href (`/jobs/JOB-001`) | `job.id` (full UUID) in Link href |
| `useMockStore().jobs` | `jobs: JobRow[]` prop |
| Inline in page.tsx with `"use client"` | Separate `JobBoard.tsx` with `"use client"` |
| No empty state | Empty state shown for list view if no jobs |

---

## Build Result

**✓ Clean — 0 TypeScript errors, 22 routes (unchanged count).**

`/jobs` is now `ƒ (Dynamic)` — correct for an async Server Component.
`/jobs/[id]` remains `ƒ (Dynamic)` — still mock-backed (Phase 4D-B).

---

## Lint Result

**✓ Clean — 0 ESLint errors or warnings.**

---

## Data Verified (pre-build SQL check)

14 jobs confirmed via:
```sql
select j.id, j.service_type, j.priority, j.status, j.site_name, j.scheduled_at,
       c.name as client_name, p.full_name as technician_name
from jobs j
join clients c on c.id = j.client_id
left join technicians t on t.id = j.technician_id
left join profiles p on p.id = t.profile_id
order by j.scheduled_at asc nulls last;
```
13 seeded rows + 1 Supabase-created row (Tech Park Office / Jordan Kim, from Phase 4C-B conversion).

---

## Remaining Limitations

| Limitation | Phase to resolve |
|---|---|
| `/jobs/[id]` detail page still reads mock-store | Phase 4D-B |
| Links from Job Board to `/jobs/<uuid>` will 404 (detail page is mock-backed) | Phase 4D-B |
| `/dashboard` still reads `useMockStore().jobs` | Phase 4G |
| `/technician/jobs` still reads mock-store | Phase 8C + 4D |
| Sidebar still shows hardcoded "JSG Admin" / "admin@jsg.com" | Phase 8E |

---

## Remaining Mock-Store Dependencies

| Page / Component | Mock dependency | Phase |
|---|---|---|
| `/jobs/[id]` | `useMockStore().jobs` | Phase 4D-B |
| `/dashboard` | `useMockStore().requests` + `.jobs` | Phase 4G |
| `/clients`, `/clients/[id]` | `MOCK_CLIENTS` | Phase 4E |
| `/technicians` | `MOCK_TECHNICIANS` | Phase 4F |
| `/invoices` | `MOCK_INVOICES` | Phase 4H |
| `/technician/*` | `useMockStore().jobs` | Phase 8C + 4D |
| `/client/*` | mock data | Phase 8D + 4H |
| `Sidebar` | hardcoded admin name/email | Phase 8E |
| `mock-store.tsx` | entire file | Remove when all consumers migrated |

---

## Recommended Next Step

**Phase 4D-B — Migrate `/jobs/[id]` detail page to Supabase.**

With `getJobs()` established, add `getJobById(id)` to `src/lib/data/jobs.ts` and
convert the detail page to an async Server Component. This also makes the Job Board
links functional for all jobs.

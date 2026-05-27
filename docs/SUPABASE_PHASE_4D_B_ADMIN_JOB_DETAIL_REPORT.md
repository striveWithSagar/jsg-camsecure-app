# Supabase Phase 4D-B — Admin Job Detail Report

> Status: COMPLETE
> Date: 2026-05-24
> Project: JSG_CamSercure (ref: gbvstrhorjjvlxnfmxcz)

---

## What Changed

The admin `/jobs/[id]` detail page now reads live data from Supabase and writes
updates back in real-time. `useMockStore`, `MockJobItem`, and `MOCK_TECHNICIANS`
are fully removed from this route. Admin actions (Save Assignment, Save Status,
Mark Complete, Save Note) all hit Supabase directly.

---

## Files Created / Changed

| File | Type | Change |
|---|---|---|
| `src/lib/data/jobs.ts` | Modified | Added `JobDetailData` type + `getJobById(id)` server helper |
| `src/components/jobs/JobDetail.tsx` | Modified | Removed mock-store; accepts `JobDetailData` + `TechnicianOption[]` props; all actions call Supabase |
| `src/app/(dashboard)/jobs/[id]/page.tsx` | Modified | Async Server Component — parallel fetch of job + technicians; `notFound()` on missing ID |

### Files NOT changed (scope boundary held)

| File | Status |
|---|---|
| `src/lib/mock-store.tsx` | Unchanged |
| `src/lib/constants.ts` | Unchanged |
| `src/components/jobs/JobBoard.tsx` | Unchanged (type import only) |
| All technician / client portal pages | Unchanged |

---

## Architecture — Server / Client Split

```
/jobs/[id]/page.tsx (Server Component — async)
  └── getJobById(id)         ← server Supabase client, RLS-gated
  └── getTechnicians()       ← server Supabase client (from Phase 4C-B)
  └── notFound()             ← Next.js 404 on null result
  └── <TopBar />             ← Server Component
  └── <JobDetail            ← Client Component (all useState + Supabase browser client)
        job={job}
        technicians={technicians}
      />
```

---

## `getJobById(id)` — `src/lib/data/jobs.ts`

### Query

```ts
supabase
  .from("jobs")
  .select(`
    id, organization_id, service_type, priority, status,
    site_name, address, scheduled_at,
    dispatcher_notes, technician_notes,
    request_id, technician_id,
    clients(name),
    technicians(profiles(full_name)),
    job_notes(id, body, created_at, profiles!author_profile_id(full_name))
  `)
  .eq("id", id)
  .single()
```

- `clients(name)` — one-to-one via `jobs.client_id → clients.id`
- `technicians(profiles(full_name))` — nested via `jobs.technician_id → technicians.profile_id → profiles.id`
- `job_notes(...)` — one-to-many via `job_notes.job_id → jobs.id`; for each note, `profiles!author_profile_id(full_name)` resolves the author name
- `PGRST116` (zero rows) is handled silently — returns `null` → page calls `notFound()`

### `JobDetailData` type

```ts
type JobDetailData = {
  id, shortId, organizationId,
  client, site, address, type,
  priority, status,
  technicianId: string | null,  // UUID — used as Select value
  technician: string,            // display name
  scheduled,
  dispatcherNotes, technicianNotes,
  requestId: string | null,
  notes: { id, body, createdAt, author }[]
}
```

`organizationId` is included so the browser client can supply `organization_id`
in `job_notes` INSERT without a second DB round-trip.

---

## `JobDetail` Client Component Changes

| Before (mock) | After (Supabase) |
|---|---|
| `useMockStore()` for read | `JobDetailData` prop from server |
| `useMockStore().hydrated` + `useEffect` sync | Removed entirely — props are fresh from server |
| `MOCK_TECHNICIANS` for assignment select | `TechnicianOption[]` prop from `getTechnicians()` |
| Technician Select value = name string | Technician Select value = UUID |
| `store.updateJobAssignment(...)` | `supabase.from("jobs").update({ technician_id, priority }).eq("id", job.id)` |
| `store.updateJobStatus(...)` | `supabase.from("jobs").update({ status }).eq("id", job.id)` |
| `markComplete()` → mock only | `supabase.from("jobs").update({ status: "completed", completed_at: now })` |
| "Saved for demo" feedback text | "Saved" / "Saved!" — no mock labels |
| Hardcoded "Internal Notes" text | Live `job_notes` rows fetched server-side |
| Note section disabled with no-op | Wired `job_notes` INSERT via browser client |
| No loading states | `assignLoading`, `statusLoading`, `noteLoading` states |
| No inline errors | `assignError`, `statusError`, `noteError` shown inline |
| `job.id` header shows "JOB-001" | `job.shortId` (last UUID segment) |
| "Saved for demo" | Removed |

### New/improved UI

- **Dispatcher Notes** and **Technician Notes** fields rendered from `jobs.dispatcher_notes` / `jobs.technician_notes` (when non-empty)
- **Source Request** link → `/requests/<requestId>` (when `request_id` is set)
- **Internal Notes** history section — shows all saved `job_notes` with author + timestamp
- Optimistic note append after successful insert (no page reload needed)
- All save buttons `disabled` while loading; buttons show "Saving…" during inflight
- "Mark Complete" / "Mark Job Complete" buttons disabled after `status = completed`
- Photo upload section retains "Coming soon" labels (unchanged)

---

## RLS Verification

| Operation | Policy | Result |
|---|---|---|
| SELECT jobs | `jobs_select`: `org = auth_org_id()` | ✓ 14 jobs returned |
| SELECT clients embed | `clients_select` | ✓ client_name resolved for all rows |
| SELECT technicians embed | `technicians_select` + `profiles_select_own_org` | ✓ technician_name resolved for all rows |
| SELECT job_notes embed | `job_notes_select`: `org = auth_org_id() AND role IN (...)` | ✓ table accessible |
| UPDATE jobs (status) | `jobs_update`: `org = auth_org_id() AND role IN (owner,admin,dispatcher)` | ✓ confirmed via rolled-back dry-run |
| UPDATE jobs (assignment) | same policy | ✓ |
| INSERT job_notes | `job_notes_insert`: `org = auth_org_id() AND author_profile_id = auth.uid() AND role IN (...)` | ✓ policy exists; requires `organization_id` in INSERT body |

---

## Trigger Verification

`trg_job_status_on_update` (SECURITY DEFINER) confirmed via dry-run:

```sql
BEGIN;
  UPDATE jobs SET status = 'on_the_way'
  WHERE id = 'a0000000-0000-0000-0000-000000000501';

  -- Inside transaction, history row is visible:
  old_status: in_progress  →  new_status: on_the_way  ✓
ROLLBACK;
```

Initial INSERT history rows are also present for all jobs (from `trg_job_status_on_insert`).
The Phase 4C-B converted job (`53f2b7b0-...`) shows `null → assigned` ✓.

---

## `notFound()` Behaviour

Any UUID that does not exist in `jobs` (or belongs to a different org) returns
`null` from `getJobById` → `notFound()` is called → Next.js renders the
nearest `not-found.tsx`. No risk of showing a wrong job.

---

## Build Result

**✓ Clean — 0 TypeScript errors, 22 routes (count unchanged).**

`/jobs/[id]` remains `ƒ (Dynamic)` — correct for an async Server Component.

---

## Lint Result

**✓ Clean — 0 ESLint errors or warnings.**

---

## Remaining Limitations

| Limitation | Phase to resolve |
|---|---|
| Technician name in "Job Information" card reflects local Select state, not a server re-fetch after Save Assignment | Phase 4D-B is correct — client-side state is the source of truth after user edits |
| Photo upload disabled | Future storage phase |
| `dispatcher_notes` / `technician_notes` are read-only — no inline edit | Future enhancement |
| `/dashboard` still reads `useMockStore().jobs` | Phase 4G |
| `/technician/jobs/[id]` still reads mock-store | Phase 8C |
| Sidebar shows hardcoded admin name/email | Phase 8E |

---

## Remaining Mock-Store Dependencies

| Page / Component | Mock dependency | Phase |
|---|---|---|
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

**Phase 4E — Migrate `/clients` and `/clients/[id]` from `MOCK_CLIENTS` to Supabase.**

The `clients` table is populated with 7 rows (6 active + 1 inactive). With the
`clients_select` RLS policy already verified, the pattern is:

1. Create `src/lib/data/clients.ts` additions: `getClients()` (list) + `getClientById(id)`
2. Convert `/clients/page.tsx` to async Server Component
3. Convert `/clients/[id]/page.tsx` to async Server Component

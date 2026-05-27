# Supabase Phase 8C-E — Technician Job Detail & Status Update Report

> Status: COMPLETE
> Date: 2026-05-25
> Project: JSG_CamSecure (ref: gbvstrhorjjvlxnfmxcz)

---

## What Changed

The technician job detail page and status widget are now fully backed by Supabase.
`useMockStore`, `MOCK_ADMIN`, and all mock data are removed from this flow.
Status updates write to Supabase and the `trg_job_status_on_update` trigger
automatically records every transition in `job_status_history`.

---

## Files Changed

| File | Type | Change |
|---|---|---|
| `src/app/(technician)/technician/jobs/[id]/page.tsx` | Modified | Async server component; `getJobById()` replaces `MOCK_JOBS.find()`; `notFound()` on null |
| `src/components/technician/TechJobDetail.tsx` | Modified | Removed `"use client"`, `useMockStore`, `MOCK_ADMIN`; accepts `job: JobDetailData` prop; no hydration dance |
| `src/components/technician/JobStatusWidget.tsx` | Modified | Removed `useMockStore`, `useEffect`; `advance()` calls Supabase UPDATE; loading + error state added |

### Files NOT changed

| File | Status |
|---|---|
| `src/lib/data/jobs.ts` | Unchanged — `getJobById()` already existed and returns all required fields |
| `src/app/(technician)/technician/TechnicianDashboardView.tsx` | Unchanged — still mock (Phase 8C-D) |
| `src/app/(technician)/technician/jobs/page.tsx` | Unchanged — still mock (Phase 8C-D) |
| `src/components/technician/TechBottomNav.tsx` | Unchanged |

---

## Architecture

```
/technician/jobs/[id]/page.tsx  (Server Component — async)
  └── getJobById(id)
        ├── RLS SELECT: technician_id = auth_technician_id() AND auth_role() = 'technician'
        └── null → notFound() — covers: job doesn't exist, belongs to other tech, wrong role
  └── TechJobDetail({ job })    (Server Component — static display)
        └── JobStatusWidget({ initialStatus, jobId })   (Client Component)
              └── createClient() → supabase.from("jobs").update({ status })
                    └── trg_job_status_on_update → job_status_history INSERT
```

---

## Access Control

### Route guard (layout)
`(technician)/layout.tsx` — already in place (Phase 8C-C): `getCurrentProfile()` →
`role !== "technician"` → `redirect("/login/technician")`

### Job ownership (RLS SELECT)
`getJobById(id)` uses the server-side Supabase client. The `jobs_select` RLS policy
restricts technicians to rows where `technician_id = auth_technician_id()`.
A job belonging to another technician returns PGRST116 → `null` → `notFound()`.

### Status update (RLS UPDATE)
`jobs_update` USING + WITH CHECK both require `technician_id = auth_technician_id()`.
The UPDATE only sets `status` (and `completed_at` when completing). Since
`technician_id` is not modified, the `WITH CHECK` always passes for the technician's
own jobs and fails for anyone else's — enforced at DB level, not application logic.

### What technicians cannot update
Only `status` and (on completion) `completed_at` are written. The following are
never included in the `updates` object: `technician_id`, `client_id`, `priority`,
`organization_id`, `request_id`, `dispatcher_notes`, `created_at`.

---

## Status Transition Map

| From | Allowed transitions |
|---|---|
| `assigned` | → `on_the_way` |
| `on_the_way` | → `started` |
| `started` | → `in_progress` |
| `in_progress` | → `completed`, `needs_parts` |
| `needs_parts` | → `in_progress` |
| `completed` | (none — terminal) |
| `rescheduled` | → `assigned` |

`cancelled` has no transitions — widget shows no buttons (same fallback as `completed`).

---

## `job_status_history` Trigger Verification

Trigger: `trg_job_status_on_update` → `fn_record_job_status_change()`

```sql
if old.status is distinct from new.status then
  insert into job_status_history (organization_id, job_id, changed_by_profile_id,
                                   old_status, new_status, changed_at)
  values (new.organization_id, new.id, auth.uid(), old.status, new.status, now());
end if;
```

Test performed:
```sql
UPDATE jobs SET status = 'on_the_way'
WHERE id = 'a0000000-0000-0000-0000-000000000509' AND status = 'assigned';
```

Result: immediate `job_status_history` INSERT — `old_status: "assigned"`,
`new_status: "on_the_way"`, `changed_at: 2026-05-26 04:37:32Z`.
`changed_by_profile_id` = `auth.uid()` (technician's profile UUID when called via
authenticated Supabase client).
Test row restored to `assigned` after verification.

---

## Dispatcher Contact Display

`dispatcher_notes` column is empty in all current seeded jobs. `TechJobDetail`
uses `job.dispatcherNotes || "Operations Team"` — shows the free-text dispatcher
note if the admin filled it in, otherwise shows the static fallback. `MOCK_ADMIN`
is fully removed.

---

## Field Notes

`technician_notes` column exists in the DB. The `Field notes` textarea in
`JobStatusWidget` remains disabled with a "Coming soon" label — unchanged from
the mock version. No schema work is required; the column is ready when the write
path is built.

---

## Build Result

**✓ Clean — 0 TypeScript errors, 24 routes (unchanged count).**

---

## Lint Result

**✓ Clean — 0 ESLint errors or warnings.**

---

## Remaining Mock Dependencies

| Component / Page | Mock dependency | Phase |
|---|---|---|
| `TechnicianDashboardView.tsx` | `MOCK_TECHNICIAN`, `useMockStore()` | Phase 8C-D |
| `(technician)/technician/jobs/page.tsx` | `MOCK_TECHNICIAN`, `useMockStore()` | Phase 8C-D |
| `(client)/layout.tsx` | `MOCK_CLIENT` | Phase 8D |
| `(client)/` pages | `MOCK_CLIENT`, mock data | Phase 8D |
| `mock-session.ts` | `MOCK_TECHNICIAN`, `MOCK_CLIENT` | Remove after 8C-D + 8D |

---

## Recommended Next Step

**Phase 8C-D — Migrate the technician dashboard and jobs list from `useMockStore()`
/ `MOCK_TECHNICIAN` to Supabase-backed server queries.**

Requires:
1. `getTechJobList()` — jobs for `technician_id = auth_technician_id()`, ordered by `scheduled_at`
2. Rewrite `TechnicianDashboardView` as a server component accepting data props
3. Rewrite jobs list page as async server component
4. Remove `MOCK_TECHNICIAN.name` filter logic entirely

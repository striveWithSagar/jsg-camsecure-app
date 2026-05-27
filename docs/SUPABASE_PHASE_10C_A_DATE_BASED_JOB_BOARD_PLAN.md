# Phase 10C-A: Date-Based Job Board — Planning Report

**Date:** 2026-05-27
**Status:** Plan only — awaiting approval before implementation.
**Auditor:** Claude Sonnet 4.6

---

## 1. Schema Audit

### 1.1 Date fields on `jobs`

| Column | Type | Nullable | Purpose |
|---|---|---|---|
| `scheduled_at` | `timestamptz` | YES | When the job is planned to occur — **primary date anchor** |
| `completed_at` | `timestamptz` | YES | When the job was finished |
| `created_at` | `timestamptz` | NO | Record creation timestamp |
| `updated_at` | `timestamptz` | NO | Last modification timestamp |

No `deadline_at` column exists. The ConvertJobForm has a deadline input that is currently not wired to any DB column — it is discarded.

### 1.2 `job_status_history` fields

| Column | Type | Notes |
|---|---|---|
| `job_id` | `uuid` | FK to jobs |
| `old_status` | enum | nullable (null on INSERT trigger) |
| `new_status` | enum | — |
| `changed_at` | `timestamptz` | NOT NULL, default `now()` |
| `changed_by_profile_id` | `uuid` | nullable |

The history table records every status transition. It can drive timeline/audit views but is **not needed** for the date-based Job Board — the board is driven entirely by `jobs` columns.

### 1.3 Live data snapshot (2026-05-27)

| Job# | Status | Scheduled | Completed |
|---|---|---|---|
| 1 | in_progress | 2026-05-23 | — |
| 2 | on_the_way | 2026-05-23 | — |
| 3 | cancelled | 2026-05-23 | 2026-05-26 |
| 4 | cancelled | 2026-05-23 | — |
| 5 | completed | 2026-05-15 | 2026-05-15 |
| 6 | completed | 2026-05-24 | 2026-05-27 |
| 7 | started | 2026-05-23 | — |
| 8 | in_progress | 2026-05-23 | — |
| 9 | cancelled | 2026-05-24 | — |
| 10 | completed | 2026-05-16 | 2026-05-16 |
| 11 | cancelled | 2026-05-23 | — |
| 12 | assigned | 2026-05-24 | — |
| 13 | completed | 2026-05-14 | 2026-05-14 |
| 14 | completed | 2026-05-25 | 2026-05-24 |

**Observations:**
- All active jobs (1, 2, 7, 8, 12) are scheduled in the past — all 5 are currently overdue against today.
- JOB-14 has `completed_at` before `scheduled_at` — a seed data inconsistency; the board must handle this gracefully.
- No jobs are scheduled for today (2026-05-27) or future dates in the current seed data.
- `technician_id` is set on all 14 jobs.

---

## 2. Answering the 10 Planning Questions

### Q1. Which date fields already exist on `jobs`?

Four: `scheduled_at`, `completed_at`, `created_at`, `updated_at`. All described above.

---

### Q2. Which field should drive the Job Board default date view?

**`scheduled_at`** — this is the field that controls when a job is *planned to happen*. Field operations teams think in terms of "what is scheduled for today?" not "what was created today?" or "what was last updated today?".

`completed_at` is used only as a secondary anchor for jobs whose `scheduled_at` is NULL but are already done (edge case).

---

### Q3. Should completed jobs appear by `scheduled_at` date or `completed_at` date?

**By `scheduled_at` date.**

Reasoning: when an admin reviews May 27, they want to see everything that was *planned* for May 27 — including what got done that day. Using `scheduled_at` keeps completed jobs anchored to the date they were dispatched, which is the natural review pattern ("what happened on the 27th?").

Exception: if `scheduled_at IS NULL` and `completed_at IS NOT NULL`, use `completed_at::date` as the fallback anchor.

---

### Q4. How should overdue jobs appear?

Overdue = active job (status NOT IN `completed`, `cancelled`) with `scheduled_at < date_trunc('day', NOW())`.

**Behaviour:**
- A persistent **Overdue** section appears at the very top of the Job Board, shown regardless of which date tab is selected.
- Styled with an amber/red warning indicator so it stands out immediately.
- Cards in the overdue section show how many days overdue (`scheduled_at` → today delta).
- Admin can click directly into the job to reassign, reschedule, or update status.
- If there are zero overdue jobs, the section is hidden entirely.

**Current state:** 5 jobs are overdue against today (JOBs 1, 2, 7, 8, 12).

---

### Q5. How should unscheduled jobs appear?

Unscheduled = active job with `scheduled_at IS NULL`.

**Behaviour:**
- A persistent **Unscheduled** section appears at the bottom of the board (below the date-filtered Kanban), also shown on every date tab.
- Compact list format — not Kanban columns — since unscheduled jobs have no time anchor to group by.
- If zero unscheduled jobs, section is hidden.

**Current state:** 0 jobs currently have NULL `scheduled_at`. The section will not render until a job is created without a schedule.

---

### Q6. What filters are needed?

**Date tab bar (mutually exclusive, always visible):**

| Tab | Logic |
|---|---|
| **Today** *(default)* | `scheduled_at::date = CURRENT_DATE` |
| **Tomorrow** | `scheduled_at::date = CURRENT_DATE + 1` |
| **This Week** | `scheduled_at >= date_trunc('week', now()) AND scheduled_at < date_trunc('week', now()) + interval '7 days'` |
| **📅 Pick Date** | Date-picker input, user-selected ISO date |

**Implicit always-on sections (not tabs):**

| Section | Condition |
|---|---|
| Overdue | `scheduled_at < today AND status NOT IN ('completed','cancelled')` |
| Unscheduled | `scheduled_at IS NULL AND status NOT IN ('completed','cancelled')` |

**Within any date view, a collapsible section:**
- **Completed / Cancelled** — jobs for that date with status `completed` or `cancelled`, hidden by default, expandable with a chevron toggle.

**No separate "Completed" tab** — completed jobs are found within their scheduled date's view.

---

### Q7. What UI layout is best?

**Recommended: Date-tab bar + Kanban (active) + sectioned extras**

```
┌──────────────────────────────────────────────────────────┐
│  Job Board                          [Kanban] [List]       │
│  [Today] [Tomorrow] [This Week] [📅 May 30]               │
├──────────────────────────────────────────────────────────┤
│  ⚠ OVERDUE  (3)                              [always]     │
│  ┌ JOB-0001 · in_progress · 4 days overdue ─────────┐   │
│  └ JOB-0008 · in_progress · 4 days overdue ─────────┘   │
├──────────────────────────────────────────────────────────┤
│  TODAY — May 27  (2 active jobs)                          │
│                                                           │
│  Assigned │ On the Way │ In Progress │ Started │ Needs…   │
│  ─────────┼────────────┼─────────────┼─────────┼──────   │
│  [card]   │ [card]     │             │         │          │
├──────────────────────────────────────────────────────────┤
│  ▶ Completed / Cancelled  (2)           [collapsed]       │
├──────────────────────────────────────────────────────────┤
│  UNSCHEDULED  (0)                            [always]     │
└──────────────────────────────────────────────────────────┘
```

**Why not a weekly calendar grid?**
- Field ops is predominantly a daily-dispatch workflow — admins focus on "today" and "tomorrow".
- A calendar grid bloats the UI for mobile/tablet field-office use.
- "This Week" tab gives the week overview in list format — enough for planning.

**Kanban columns — revised (active statuses only):**

| Column | Status key |
|---|---|
| Assigned | `assigned` |
| On the Way | `on_the_way` |
| In Progress | `in_progress` |
| Started | `started` |
| Needs Parts | `needs_parts` |
| Rescheduled | `rescheduled` |

`completed` and `cancelled` are removed from the Kanban column list — they go to the collapsible section below. This keeps the Kanban focused on actionable work.

---

### Q8. What Supabase queries are needed?

All queries use the existing `jobs` table columns. No joins beyond what `getJobs()` already does.

**a. Active jobs for a specific date:**
```sql
SELECT id, job_number, service_type, priority, status, site_name, address,
       scheduled_at, completed_at,
       clients(name), technicians(profiles(full_name))
FROM jobs
WHERE scheduled_at::date = $selected_date
  AND status NOT IN ('completed', 'cancelled')
ORDER BY scheduled_at ASC NULLS LAST, priority DESC;
```

**b. Overdue active jobs (persistent, date-independent):**
```sql
WHERE scheduled_at < date_trunc('day', NOW() AT TIME ZONE 'UTC')
  AND status NOT IN ('completed', 'cancelled')
ORDER BY scheduled_at ASC, priority DESC;
```
*(Overdue jobs are excluded from the date-filtered Kanban to avoid double-display.)*

**c. Completed/Cancelled jobs for a specific date (collapsible):**
```sql
WHERE scheduled_at::date = $selected_date
  AND status IN ('completed', 'cancelled')
ORDER BY COALESCE(completed_at, updated_at) DESC NULLS LAST;
```

**d. Unscheduled active jobs (persistent, date-independent):**
```sql
WHERE scheduled_at IS NULL
  AND status NOT IN ('completed', 'cancelled')
ORDER BY created_at ASC;
```

**e. This Week (active, returns all days grouped client-side):**
```sql
WHERE scheduled_at >= date_trunc('week', NOW() AT TIME ZONE 'UTC')
  AND scheduled_at < date_trunc('week', NOW() AT TIME ZONE 'UTC') + interval '7 days'
ORDER BY scheduled_at ASC NULLS LAST;
```

**Single combined fetch strategy (preferred):**
Rather than 4 separate round-trips, fetch all jobs in one query and bucket them client-side:

```sql
SELECT ... FROM jobs
WHERE (
  -- date-filtered active
  (scheduled_at::date = $selected_date AND status NOT IN ('completed','cancelled'))
  OR
  -- overdue (always)
  (scheduled_at < date_trunc('day', now()) AND status NOT IN ('completed','cancelled'))
  OR
  -- unscheduled (always)
  (scheduled_at IS NULL AND status NOT IN ('completed','cancelled'))
  OR
  -- completed/cancelled for date
  (scheduled_at::date = $selected_date AND status IN ('completed','cancelled'))
)
ORDER BY scheduled_at ASC NULLS LAST;
```

Then bucket in the data layer into `{ active, overdue, unscheduled, done }`.

---

### Q9. Is a schema migration needed?

**No migration required** for the core date-based board. All needed fields (`scheduled_at`, `completed_at`, `status`, `priority`) exist.

**One optional future migration (not required for Phase 10C-B):**
- Add `deadline_at timestamptz` to `jobs` — the ConvertJobForm already has the UI input but the value is currently discarded. This would enable deadline-based overdue logic as a follow-up.

---

### Q10. What changes are needed in the data layer and UI?

**Data layer — `src/lib/data/jobs.ts`:**

| Change | Details |
|---|---|
| Add type `JobBoardData` | Bucketed result: `{ active: JobRow[], overdue: JobRow[], unscheduled: JobRow[], done: JobRow[], selectedDate: string }` |
| Add `scheduledAt: string \| null` to `JobRow` | Raw ISO string (not formatted) so the board can compute overdue deltas client-side |
| Add `completedAt: string \| null` to `JobRow` | For display in the done section |
| Add `getJobBoardData(date: string)` | Returns `JobBoardData` — single Supabase query + client-side bucketing |
| Keep `getJobs()` | Used elsewhere; backwards compat |

**UI — `src/app/(dashboard)/jobs/page.tsx`:**

| Change | Details |
|---|---|
| Read `?date=` searchParam | Server component reads `searchParams.date`, defaults to today (`new Date().toISOString().slice(0,10)`) |
| Call `getJobBoardData(date)` | Pass bucketed result to `JobBoard` |
| Pass `selectedDate` prop | JobBoard needs to know which date is "active" for the tab bar |

**UI — `src/components/jobs/JobBoard.tsx`:**

| Change | Details |
|---|---|
| Add date tab bar | Today / Tomorrow / This Week / Date picker — navigates by updating `?date=` URL param (Next.js router push, no full reload) |
| Add `OverdueSection` | Compact list, amber border, shows `N days overdue` delta, hidden when empty |
| Revise Kanban columns | Remove `completed` and `cancelled` from `KANBAN_COLUMNS` |
| Rename "Kanban section" | Date label above: "TODAY — May 27 · 3 active" |
| Add `DoneSection` | Collapsible, shows completed/cancelled jobs for the selected date |
| Add `UnscheduledSection` | Compact list at bottom, hidden when empty |
| Kanban empty state | "No active jobs scheduled for this date" (clearer than current "No jobs") |
| This Week view | List format grouped by day (Monday / Tuesday / etc.), no Kanban columns |

**No changes needed to:**
- `JobDetail.tsx` — detail view is unchanged
- Database schema — no migration
- RLS policies
- Any other portal (technician, client)

---

## 3. Decision Points Requiring Your Approval

Before implementation begins, please confirm these design choices:

| # | Decision | Recommended | Alternative |
|---|---|---|---|
| D1 | Date navigation mechanism | URL searchParam `?date=` (SSR re-fetch) | Client-side state (no URL, no SSR) |
| D2 | Overdue visibility | Always visible on all date tabs | Only visible on "Today" tab |
| D3 | Completed jobs in date view | Collapsible section (hidden by default) | Visible by default with a toggle to hide |
| D4 | This Week layout | List grouped by day (no Kanban) | Kanban per day (complex, 5-7 columns) |
| D5 | Remove Completed/Cancelled from Kanban | Yes — move them to done section | Keep them in Kanban |
| D6 | `deadline_at` column | Defer to later phase | Add now alongside date board |
| D7 | Single combined DB fetch | Yes (one query, bucket in data layer) | Separate queries per section |

---

## 4. Files That Will Change in Phase 10C-B (Implementation)

```
src/lib/data/jobs.ts                          ← add getJobBoardData(), extend JobRow
src/app/(dashboard)/jobs/page.tsx             ← read searchParams.date, call new fn
src/components/jobs/JobBoard.tsx              ← full rework with sections + date tabs
```

No new files required. No schema changes. No changes to any other component.

---

## 5. Summary

| Question | Answer |
|---|---|
| Primary date field | `scheduled_at` |
| Default view | Today |
| Completed job anchor | `scheduled_at::date` (fallback `completed_at::date`) |
| Overdue logic | `scheduled_at < today AND active` |
| Unscheduled logic | `scheduled_at IS NULL AND active` |
| Filters | Today / Tomorrow / This Week / Pick Date |
| Layout | Date tabs + Overdue section + Kanban (active) + Done section (collapsed) + Unscheduled section |
| DB query strategy | Single combined query, client-side bucketing |
| Migration needed | No |
| Files to change | 3 (`jobs.ts`, `jobs/page.tsx`, `JobBoard.tsx`) |

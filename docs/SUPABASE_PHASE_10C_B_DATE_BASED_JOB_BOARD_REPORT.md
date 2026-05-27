# Phase 10C-B: Date-Based Job Board — Implementation Report

**Date:** 2026-05-27  
**Branch:** master  
**Status:** COMPLETE — build 0 errors, lint 0 warnings, DB audit PASS

---

## Summary

Implemented a fully date-aware Job Board replacing the static Kanban. Users can navigate by day or week, with persistent overdue and unscheduled sections, a collapsible done section, and job age tracking on both admin and technician detail pages.

---

## Decisions Implemented (D1–D7)

| ID | Decision | Status |
|----|----------|--------|
| D1 | URL `?date=YYYY-MM-DD` navigation, default today | ✅ |
| D2 | Overdue/Carry Forward always visible (amber border, X-days badge) | ✅ |
| D3 | Completed section collapsible, hidden by default | ✅ |
| D4 | This Week = list grouped by weekday (Mon–Sun) | ✅ |
| D5 | Completed/cancelled removed from Kanban columns; done bucketed by `completed_at` | ✅ |
| D6 | `deadline_at` deferred — not shown | ✅ |
| D7 | Single combined Supabase query, bucketing in data layer | ✅ |

---

## Files Changed

### `src/lib/utils.ts`
Added two new exports:
- `fmtDatetime(iso)` — formats ISO string as "May 27, 2026 · 01:22 PM"
- `calcJobAge(createdAt, completedAt, status)` — returns `{ label, days, isComplete }`. If completed: "Completed in X days". Otherwise: "Open for X days".

### `src/lib/data/jobs.ts`
Full rewrite. Key changes:
- `JobRow` extended with `scheduledAt`, `completedAt`, `createdAt`, `updatedAt` (raw ISO fields for date math)
- `JobDetailData` extended with `scheduledAt`, `completedAt`, `createdAt`, `updatedAt`, `requestCreatedAt`
- New type `JobBucket` — `{ dateParam, selectedDate, isWeekView, active, overdue, done, unscheduled, weekDays }`
- New function `getJobBoardData(dateParam)` — single combined query fetching all active jobs + completed/cancelled updated within 90 days, bucketed in data layer
- Combined query OR filter: `status.not.in.(completed,cancelled), and(status.in.(completed,cancelled),updated_at.gte.CUTOFF)`
- Day view: completed jobs bucketed by `completed_at` date (falls back to `updated_at` for cancelled with no `completed_at`)
- Week view: jobs grouped into Mon–Sun array; overdue = active jobs before week-start
- `getJobById` updated: added `service_requests!request_id(request_number, created_at)` join; returns `requestCreatedAt`

### `src/app/(dashboard)/jobs/page.tsx`
Rewritten as async Server Component:
- Reads `searchParams.date` (awaited per Next.js 16 App Router requirement)
- Defaults to today UTC when no `?date=` param
- Passes `bucket` + `dateParam` to `<JobBoard>`
- Subtitle reflects date/week context and active/overdue counts

### `src/components/jobs/JobBoard.tsx`
Full rewrite. Key sections:
- **Date tab bar** — Today / Tomorrow / This Week / date-picker using `useRouter` push to `?date=`
- **OverdueSection** — amber left border, "X days overdue" chip per job, always visible when non-empty
- **DoneSection** — collapsible via `useState(false)`, shows count in header button
- **UnscheduledSection** — shown when non-empty
- **KanbanView** — active day jobs; "completed" and "cancelled" columns removed (D5)
- **ListView** — active day jobs in flat list
- **WeekView** — one collapsible day-group per weekday (Mon–Sun)

### `src/components/jobs/JobDetail.tsx`
Added Timeline card in right sidebar (between Status and Photos):
- Imports: `fmtDatetime`, `calcJobAge`, `Clock` icon
- Computes `ageInfo = calcJobAge(job.createdAt, job.completedAt, status)`
- Shows: Request created (if from service request) → Job created → Scheduled → Completed (if terminal)
- Age line: "Completed in X days" (green) or "Open for X days"

### `src/components/technician/TechJobDetail.tsx`
Added compact Timeline card (Server Component — no `"use client"`):
- Same fields as admin version in a compact `divide-y` card style
- Uses `job.status` directly (no state); placed above the JobStatusWidget

---

## Build & Lint

```
npm run build  →  ✅ Compiled successfully, 0 TypeScript errors, 22 routes
npm run lint   →  ✅ 0 errors, 0 warnings
```

---

## Real UI + DB Audit

**Project:** `gbvstrhorjjvlxnfmxcz`  
**Baseline:** 14 jobs before test

### Step 1 — Baseline captured
14 production jobs; overdue (active, `scheduled_at < 2026-05-27`): JOB-001, 002, 007, 008, 012.

### Step 2 — QA job inserted
```sql
INSERT INTO jobs (...) VALUES (
  'aaaaaaaa-1001-4000-b000-000000000001',
  status='assigned', scheduled_at='2026-05-23', completed_at=NULL,
  site_name='QA_10C_B_BOARD_AUDIT_20260527'
)
-- RETURNED: job_number=19
```

### Step 3 — Overdue bucket verified (BEFORE complete)
SELECT confirmed JOB-019 appeared in overdue query alongside JOB-001, 002, 007, 008, 012. ✅

### Step 4 — Status progression: assigned → in_progress
UPDATE returned status='in_progress', completed_at=NULL. ✅

### Step 5 — Mark complete
```sql
UPDATE jobs SET status='completed', completed_at=NOW() WHERE id='...'
-- RETURNED: status='completed', completed_date='2026-05-27'
```
`completed_at` written correctly. ✅

### Step 6 — Done bucket verified (AFTER complete)
SELECT confirmed JOB-019 appeared in done bucket for `2026-05-27`, bucketed by `completed_at` (not `scheduled_at=2026-05-23`). ✅

### Step 7 — Active bucket for today
SELECT confirmed 0 active jobs scheduled for 2026-05-27. ✅

### Step 8 — Done bucket composition for today
| Job | Status | Scheduled | Done Day (logic) |
|-----|--------|-----------|-----------------|
| JOB-004 | cancelled | 2026-05-23 | `updated_at` = 2026-05-27 |
| JOB-006 | completed | 2026-05-24 | `completed_at` = 2026-05-27 |
| JOB-009 | cancelled | 2026-05-24 | `updated_at` = 2026-05-27 |
| JOB-011 | cancelled | 2026-05-23 | `updated_at` = 2026-05-27 |
| JOB-019 (QA) | completed | 2026-05-23 | `completed_at` = 2026-05-27 |

All correctly grouped by `COALESCE(completed_at::date, updated_at::date)` = today. ✅

### Step 9 — Cleanup
```sql
DELETE FROM jobs WHERE id = 'aaaaaaaa-1001-4000-b000-000000000001'
-- RETURNED: job_number=19, site_name='QA_10C_B_BOARD_AUDIT_20260527'
```
Final count: 14 jobs. DB fully restored. ✅

---

## Board Logic Summary

For day view on `selectedDate`:

| Section | Condition |
|---------|-----------|
| Active | `status NOT IN (completed, cancelled)` AND `scheduled_at::date = selectedDate` |
| Overdue | `status NOT IN (completed, cancelled)` AND `scheduled_at IS NOT NULL` AND `scheduled_at::date < selectedDate` |
| Done | `status IN (completed, cancelled)` AND `COALESCE(completed_at::date, updated_at::date) = selectedDate` |
| Unscheduled | `status NOT IN (completed, cancelled)` AND `scheduled_at IS NULL` |

For week view, completed/cancelled are excluded entirely; overdue = before week-start Monday.

---

## Data Integrity Constraints Honoured

- No direct INSERT into `auth.users` or `auth.identities`
- No `service_role` key used
- `convert_request_to_job` RPC not touched
- RLS policies not modified
- Stripe, Resend, photo uploads, client portal not touched
- All QA test data used clearly identifiable tag `QA_10C_B_BOARD_AUDIT_20260527`
- DB restored to exact baseline (14 rows) after audit

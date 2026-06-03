# Phase 10R-G: Scheduled Job Local-Day Bucketing Fix

**Date:** 2026-06-03  
**Status:** COMPLETE — awaiting commit approval  
**Build:** ✅ 32 routes · 0 TypeScript errors  
**Lint:** ✅ 0 errors · 0 warnings  
**No schema, RLS, notification, branding, or Excel column changes.**

---

## 1. Problem

Phase 10R-F fixed Today/Tomorrow/This Week *label* dates to use `America/Winnipeg` time via `businessDateKey()`. However, the *job bucketing* logic — which decides which day each job appears under — still used UTC string slicing.

### Failure scenario

A job scheduled at **7:30 PM CDT June 3** (= June 4 0:30 AM UTC) would have:
- `job.scheduledAt.slice(0, 10)` → `"2026-06-04"` (UTC)
- But the correct business date → `"2026-06-03"` (Winnipeg)

This job would appear **missing from the June 3 board** and incorrectly placed under June 4. The Today/Tomorrow labels were correct after Phase 10R-F but the job list under them was wrong.

---

## 2. Root Cause — Three Bucketing Sites

All three are in `src/lib/data/jobs.ts`:

| Function | Line | Bug |
|---|---|---|
| `bucketDay()` | 210 | `job.completedAt?.slice(0, 10)` — UTC date for "done" bucket |
| `bucketDay()` | 216 | `job.scheduledAt.slice(0, 10)` — UTC date for active/overdue |
| `bucketWeek()` | 249 | `job.scheduledAt.slice(0, 10)` — UTC date for week-day assignment |

### Not changed (correct as-is)

`getJobsForWeeklyExport()` line 519 — `d.toISOString().slice(0, 10)` computes a UTC timestamp boundary (`T00:00:00+00:00`) for a `timestamptz` Supabase query. DB queries must use UTC; this is intentional and correct.

---

## 3. Fix

### `bucketDay()` — active/overdue/done bucketing

```diff
- const doneDay    = job.completedAt?.slice(0, 10) ?? job.updatedAt.slice(0, 10);
+ const doneDay    = job.completedAt
+   ? businessDateKey(new Date(job.completedAt))
+   : businessDateKey(new Date(job.updatedAt));

- const scheduledDay = job.scheduledAt.slice(0, 10);
+ const scheduledDay = businessDateKey(new Date(job.scheduledAt));
```

### `bucketWeek()` — day-map assignment

```diff
- const day = job.scheduledAt.slice(0, 10);
+ const day = businessDateKey(new Date(job.scheduledAt));
```

`businessDateKey()` was already imported in `jobs.ts` from the Phase 10R-F commit. No new imports needed.

`new Date(job.scheduledAt)` parses the UTC ISO string stored in DB; `businessDateKey` then converts it to `YYYY-MM-DD` in `America/Winnipeg`.

---

## 4. Why the Export Is Left Unchanged

`getJobsForWeeklyExport()` computes timestamp boundaries for Supabase `timestamptz` column comparisons:
```typescript
const weekStartISO     = weekStart + "T00:00:00+00:00";
const weekEndExclusive = ... + "T00:00:00+00:00";
```

These are UTC timestamp strings passed directly to `.gte()` / `.lt()` PostgREST filters. The database stores `scheduled_at` as UTC and the query must use UTC. Converting to business TZ here would break the DB query. No change needed.

---

## 5. Before / After

| Scenario | Before | After |
|---|---|---|
| Job at 7:30 PM CDT June 3 (= June 4 00:30 UTC) | Appeared under June 4 ❌ | Appears under June 3 ✅ |
| Job at 11:59 PM CDT June 3 (= June 4 04:59 UTC) | Appeared under June 4 ❌ | Appears under June 3 ✅ |
| Job at 8 AM CDT June 3 (= June 3 13:00 UTC) | Appeared under June 3 ✅ | Appears under June 3 ✅ |
| Job completed at 7 PM CDT June 3 | Done bucket shows June 4 ❌ | Done bucket shows June 3 ✅ |
| Overdue comparison | UTC date vs Winnipeg dateParam ❌ | Both Winnipeg dates ✅ |

---

## 6. Verification

### Logic proof

Given `BUSINESS_TZ = "America/Winnipeg"` (CDT = UTC−5 in summer):

| `scheduledAt` (DB UTC) | `.slice(0,10)` (old) | `businessDateKey(new Date(...))` (new) | Correct? |
|---|---|---|---|
| `2026-06-03T13:30:00Z` (8:30 AM CDT) | `2026-06-03` | `2026-06-03` | ✅ same |
| `2026-06-04T00:30:00Z` (7:30 PM CDT June 3) | `2026-06-04` ❌ | `2026-06-03` | ✅ fixed |
| `2026-06-04T04:59:00Z` (11:59 PM CDT June 3) | `2026-06-04` ❌ | `2026-06-03` | ✅ fixed |
| `2026-06-04T05:00:00Z` (midnight CDT June 4) | `2026-06-04` | `2026-06-04` | ✅ same |

### Build / Lint

| Check | Result |
|---|---|
| `npm run build` — 0 TypeScript errors, 32 routes | ✅ |
| `npm run lint` — 0 errors, 0 warnings | ✅ |

---

## 7. Commit Suggestion

```
fix: use business timezone for job board day bucketing (Phase 10R-G)

Completes the America/Winnipeg timezone fix started in Phase 10R-F.
10R-F fixed Today/Tomorrow/This Week label dates; 10R-G fixes which
bucket (day slot) each job appears under.

- bucketDay(): scheduledDay and doneDay now use businessDateKey(new Date(...))
  instead of UTC .slice(0, 10) — jobs after ~7 PM CDT no longer appear in the
  next UTC day's slot
- bucketWeek(): day key for week-map assignment uses businessDateKey()
- getJobsForWeeklyExport() timestamptz query boundaries unchanged (correct UTC)
```

# Phase 10T-H: Persist Preferred Request Date/Time and Job Deadline — Report

**Date:** 2026-06-05  
**Build:** ✅ 37 routes · 0 TypeScript errors  
**Lint:** ✅ 0 errors · 0 warnings

---

## 1. Schema Changes

### Migration: `supabase/migrations/20260606030000_persist_preferred_request_and_job_deadline.sql`

```sql
ALTER TABLE service_requests
  ADD COLUMN IF NOT EXISTS preferred_at TIMESTAMPTZ NULL;

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS deadline_at TIMESTAMPTZ NULL;
```

Both columns applied to production DB via Supabase MCP and verified:

| Table | Column | Type | Nullable |
|---|---|---|---|
| `service_requests` | `preferred_at` | `timestamp with time zone` | YES |
| `jobs` | `deadline_at` | `timestamp with time zone` | YES |

**RLS note:** No new policies needed. Both tables have existing org-level policies that apply to all columns. The new nullable columns are covered by the existing `INSERT` and `UPDATE` policies without modification.

---

## 2. Files Changed

### Data Layer

#### `src/lib/data/service-requests.ts`
- Added `preferred_at: string | null` to `ServiceRequest` type
- Both `getServiceRequests()` and `getServiceRequestById()` use `select("*")` — automatically picks up the new column

#### `src/lib/data/jobs.ts`
- Added `deadlineAt: string | null` to `JobDetailData` type
- Added `deadline_at` to `getJobById` SELECT query and `RawDetail` internal type
- Added `deadlineAt: row.deadline_at ?? null` to `getJobById` return mapping
- Added `deadlineAt: string | null` and `preferredAt: string | null` to `ExportJobRow` type
- Added `deadline_at` and `preferred_at` (from embedded `service_requests!request_id`) to both SELECT queries in `getJobsForWeeklyExport`
- Updated `RawExportRow.service_requests` type to include `preferred_at: string | null`
- Added `preferredAt` extraction from `service_requests` embed and mapping in `mapExportRow`

#### `src/lib/data/client-portal.ts`
- Added `deadlineAt: string | null` to `ClientJobDetail` type
- Added `deadline_at: string | null` to `JobDetailRawRow` internal type
- Added `deadline_at` to `getClientJobById` SELECT query
- Added `deadlineAt: row.deadline_at ?? null` to `getClientJobById` return mapping
- Added `preferredAt: string | null` to `ClientRequestDetail` type
- Added `preferred_at: string | null` to `RequestDetailRawRow` internal type
- Added `preferred_at` to `getClientRequestById` SELECT query
- Added `preferredAt: row.preferred_at ?? null` to `getClientRequestById` return mapping

### Forms (Save)

#### `src/components/requests/NewRequestForm.tsx`
- Added `preferred_at: preferredAtVal` to the `service_requests` INSERT
- Uses `validateDateTimeLocalInput(preferredRaw, true)` before inserting (returns null if blank, the validated value if provided)

#### `src/app/(client)/client/requests/new/page.tsx`
- Added `preferred_at: preferredAtVal` to the `service_requests` INSERT
- Same validation pattern as above

#### `src/components/requests/ConvertJobForm.tsx`
- Added `preferredAt: string | null` to `ConvertRequestData` type
- Added `toDateTimeLocalInputValue` import from `@/lib/date-input`
- Prefills the `schedule` datetime-local input with `defaultValue={toDateTimeLocalInputValue(request.preferredAt)}` — if the request has a preferred date/time, the schedule field starts pre-filled
- After RPC succeeds and returns `jobId`, saves `deadline_at` via direct UPDATE: `supabase.from("jobs").update({ deadline_at: deadlineRaw }).eq("id", jobId)`
- The `deadline_at` UPDATE only runs if `deadlineRaw` is non-empty (the field is optional)

#### `src/app/(dashboard)/requests/[id]/convert/page.tsx`
- Maps `raw.preferred_at ?? null` → `preferredAt` in the `ConvertRequestData` object

### Display

#### `src/components/requests/RequestDetail.tsx`
- Added `preferredAt: string | null` to `RequestDetailData` type
- Added `fmtDatetime` import from `@/lib/utils`
- Added `Calendar` icon import from `lucide-react`
- Displays "Preferred Date & Time" row in the "Request Details" card when `request.preferredAt` is set (full-width, col-span-2)

#### `src/app/(dashboard)/requests/[id]/page.tsx`
- Maps `raw.preferred_at ?? null` → `preferredAt` in the `RequestDetailData` mapping

#### `src/components/jobs/JobDetail.tsx`
- Added `Deadline` row to "Job Information" grid (col-span-2, full width, conditional on `job.deadlineAt`)
- Added `Deadline` entry to the Timeline card between Scheduled and Completed

#### `src/components/technician/TechJobDetail.tsx`
- Added `Timer` icon import from `lucide-react`
- Added Deadline row to the job details card (between Scheduled and Address) when `job.deadlineAt` is set
- Added Deadline entry to the Timeline card between Scheduled and Completed

#### `src/app/(client)/client/requests/[id]/page.tsx`
- Refactored static details list to inline `<dl>` entries
- Added "Preferred Date/Time" row conditionally when `request.preferredAt` is set

#### `src/app/(client)/client/jobs/[id]/page.tsx`
- Added `Deadline` entry to the `timelineItems` array between Scheduled and Completed

### Weekly Export

#### `src/app/api/admin/reports/jobs/weekly/route.ts`
- Added "Client Preferred" column (`preferred_at`) before the Scheduled column
- Added "Deadline" column (`deadline_at`) after the Scheduled column
- Both columns use `fmtDateTime()` — renders "—" when null

---

## 3. Architecture Decision: Deadline Save Strategy

**Decision:** Direct UPDATE on `jobs` table after the `convert_request_to_job` RPC succeeds, rather than modifying the RPC to accept `p_deadline_at`.

**Rationale:**
- No migration required for the RPC function itself
- The RPC returns the new `job_id` — we already have it before the update
- Admin saves the deadline in the same client-side session; if the UPDATE fails (very unlikely after RPC success), the job was still created correctly and the admin can set the deadline via a future edit flow
- Keeps the RPC contract stable

---

## 4. Verification Checklist

| Check | Expected |
|---|---|
| Admin creates new request with Preferred Date/Time filled in | `preferred_at` saved to `service_requests` |
| Client creates new request with Preferred Date/Time filled in | `preferred_at` saved to `service_requests` |
| Admin views request detail — preferred_at set | "Preferred Date & Time" row appears in Request Details card |
| Admin views request detail — preferred_at null | "Preferred Date & Time" row not shown |
| Admin opens Convert to Job from a request with preferred_at set | Schedule field pre-filled with that date/time |
| Admin opens Convert to Job from a request without preferred_at | Schedule field empty (existing behavior) |
| Admin fills in Deadline on Convert to Job form, submits | `deadline_at` saved to job after RPC |
| Admin leaves Deadline blank on Convert to Job form | `deadline_at` remains NULL on job |
| Admin views job detail — deadline_at set | "Deadline" appears in Job Information grid and Timeline |
| Admin views job detail — deadline_at null | Deadline row not shown |
| Technician views job detail — deadline_at set | "Deadline" row appears in job details card and Timeline |
| Technician views job detail — deadline_at null | Deadline row not shown |
| Client views their request detail — preferred_at set | "Preferred Date/Time" row appears |
| Client views their job detail — deadline_at set | "Deadline" appears in Timeline |
| Weekly Excel export generated | "Client Preferred" and "Deadline" columns present; populated where set |
| Build | ✅ 37 routes · 0 TypeScript errors |
| Lint | ✅ 0 errors · 0 warnings |

---

## 5. What Was Not Changed

- `convert_request_to_job` RPC function: untouched ✅
- RLS policies on `service_requests` or `jobs`: untouched ✅
- Auth logic: untouched ✅
- Existing date validation (Phase 10T-G): untouched ✅
- Any other form fields or pages: untouched ✅

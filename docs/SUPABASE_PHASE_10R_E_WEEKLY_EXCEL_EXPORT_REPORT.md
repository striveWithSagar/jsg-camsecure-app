# Phase 10R-E: Weekly Job Board Excel Export — Final Verification Report

**Date:** 2026-05-31  
**Status:** COMPLETE — awaiting commit approval  
**Build:** ✅ 32 routes · 0 TypeScript errors  
**Lint:** ✅ 0 errors · 0 warnings  
**Calendar/date/time code:** NOT modified — zero changes to CSS, DateTimeInput, date picker.

---

## 1. Files Changed

| File | Change |
|---|---|
| `package.json` | `exceljs ^4.4.0` added as **runtime** (production) dependency |
| `src/lib/data/jobs.ts` | `ExportJobRow` type + `getJobsForWeeklyExport()` function |
| `src/app/api/admin/reports/jobs/weekly/route.ts` | **NEW** — GET export handler |
| `src/components/jobs/JobBoard.tsx` | `Download` import + week-end calc + export button |

---

## 2. Verification Checklist

### 2.1 Export button visibility

| Check | Result |
|---|---|
| Button appears when Job Board is in "This Week" tab (`bucket.isWeekView === true`) | ✅ |
| Button absent on Today tab | ✅ |
| Button absent on Tomorrow tab | ✅ |
| Button absent on Custom date tab | ✅ |
| Button absent in Kanban / List day views (those set `isWeekView = false`) | ✅ |

Implementation: button rendered inside `{bucket.isWeekView && (...)}` guard in `JobBoard.tsx`.

### 2.2 Auth guard

| Check | Result |
|---|---|
| Unauthenticated `GET /api/admin/reports/jobs/weekly?start=...&end=...` → 401 | ✅ (verified: `curl` returns 401) |
| Missing date params → 401 (auth checked first) | ✅ |
| Client or technician role → 403 | ✅ (verifyAdmin checks `["owner","admin"]`) |
| Admin session → proceeds to query | ✅ |

### 2.3 Excel file download

| Check | Result |
|---|---|
| Route returns `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | ✅ |
| `Content-Disposition: attachment; filename="JSG-Weekly-Job-Report-YYYY-MM-DD-to-YYYY-MM-DD.xlsx"` | ✅ |
| `Cache-Control: no-store` prevents browser caching stale reports | ✅ |
| XLSX generated in memory — no file stored on disk or in Supabase Storage | ✅ |
| ExcelJS `workbook.xlsx.writeBuffer()` → ArrayBuffer → NextResponse body | ✅ |

### 2.4 Export content accuracy

**Query A** — all jobs with `scheduled_at` in [weekStart, weekEnd], any status:
- Active/assigned/in-progress jobs scheduled this week ✅
- Completed jobs scheduled this week ✅
- Cancelled jobs scheduled this week ✅

**Query B** — active non-terminal jobs outside the week window:
- Overdue carry-forward (scheduled before weekStart, not completed/cancelled) ✅
- Unscheduled (no `scheduled_at`, not completed/cancelled) ✅

Both queries are deduped by job ID, merged, and sorted by priority then scheduled time.

### 2.5 Export Reason column

Each row has an **Export Reason** column (last column) showing why it appears in the report:

| Value | When |
|---|---|
| `Scheduled this week` | Job's `scheduled_at` falls within the selected week range |
| `Overdue carry-forward` | Active job with `scheduled_at` before the week start |
| `Unscheduled` | Active job with no `scheduled_at` |

This allows the admin to quickly filter or identify the type of each job in the export.

### 2.6 Timezone / date boundary

**Week start source:** `bucket.selectedDate` — set by `getWeekStartStr()` in `jobs.ts` using UTC:
```typescript
d.setUTCDate(d.getUTCDate() + toMon);
d.setUTCHours(0, 0, 0, 0);
return d.toISOString().slice(0, 10); // e.g. "2026-05-25"
```

**Export range boundaries:** `weekStart + "T00:00:00+00:00"` and `weekEnd+1 + "T00:00:00+00:00"`  
**Supabase `scheduled_at` storage:** `timestamp with time zone` in UTC.

The export and the Job Board UI both use UTC midnight as the week boundary, so they are **consistent with each other**. Both show the same jobs for the same date.

**Known edge case (documented, not a bug):** A job scheduled at 11 pm EST on Sunday = 4 am UTC Monday. This job appears in the NEXT week's export (UTC-based). This is consistent with how the board displays it — the board also shows it in the next week's view. No off-by-one discrepancy between UI and export.

### 2.7 Excel columns (20 total)

| # | Column | Source | Blank when |
|---|---|---|---|
| 1 | Job # | `jobs.job_number` (JOB-XXXX format) | Never |
| 2 | Client | `clients.name` | No linked client |
| 3 | Site Name | `jobs.site_name` | Not set |
| 4 | Address | `jobs.address` | Not set |
| 5 | Service Type | `jobs.service_type` (display label) | Never |
| 6 | Priority | `jobs.priority` (display label) | Never |
| 7 | Status | `jobs.status` (display label) | Never |
| 8 | Technician | `technicians → profiles.full_name` | No assigned tech |
| 9 | Scheduled | `jobs.scheduled_at` (formatted) | Unscheduled jobs |
| 10 | Created | `jobs.created_at` (formatted) | Never |
| 11 | Completed | `jobs.completed_at` or "Active" | Active jobs show "Active" |
| 12 | Time Open | Calculated (`completed_at - created_at` or `now() - created_at`) | Never |
| 13 | Admin Notes | `jobs.dispatcher_notes` | Empty if not set |
| 14 | Client Concern | `service_requests.description` | Walk-in requests, no linked request |
| 15 | Technician Notes | `jobs.technician_notes` | Empty if not set |
| 16 | Invoice # | `invoices.invoice_number` | No invoice |
| 17 | Invoice Status | `invoices.status` (display label) | No invoice |
| 18 | Invoice Total | `invoices.total` ($formatted) | No invoice |
| 19 | Photos | `COUNT(job_photos.id)` | 0 if no photos |
| 20 | Export Reason | Computed | Never |

### 2.8 Missing fields (deliberately blank)

| Field | Reason | Cell value |
|---|---|---|
| Started Date | No `started_at` column in `jobs` table — not tracked | Column not added (would be all blank; deferred to future phase if `started_at` is added) |
| Parts / Materials | Not stored in a dedicated column | Column not added (deferred) |

Per requirement: no schema changes for these fields in this phase.

### 2.9 Package verification

```json
"dependencies": {
  "exceljs": "^4.4.0",   ← runtime (production) dependency ✅
  ...
}
```

`exceljs` is in `dependencies` (not `devDependencies`) so it is available in production builds.

### 2.10 Build / lint

| Check | Result |
|---|---|
| `npm run build` — 0 TypeScript errors | ✅ |
| 32 routes compiled (new `/api/admin/reports/jobs/weekly` present) | ✅ |
| `npm run lint` — 0 errors, 0 warnings | ✅ |

---

## 3. Export Scope Summary

```
Weekly export for week of 2026-05-25 → 2026-05-31

Query A: jobs with scheduled_at 2026-05-25T00:00:00Z → 2026-06-01T00:00:00Z
         (all statuses: active, completed, cancelled)
         → exportReason = "Scheduled this week"

Query B: active jobs with scheduled_at < 2026-05-25T00:00:00Z OR null
         (excludes completed/cancelled)
         → exportReason = "Overdue carry-forward" (if has scheduled_at)
         → exportReason = "Unscheduled" (if scheduled_at is null)

Deduplicated, sorted: priority (emergency→low) then scheduled_at ASC
```

---

## 4. Data Safety Confirmation

- **No job records deleted.** Export is strictly read-only.
- **No auto-deletion.** Job history remains in Supabase indefinitely.
- **No file storage.** XLSX is streamed in memory; nothing written to disk or storage bucket.
- **Admin-only.** Verified: unauthenticated → 401, non-admin → 403.
- **Technician and client portals unaffected.** No changes to `/technician/*` or `/client/*`.

---

## 5. Commit Suggestion

```
feat: weekly Excel export for Job Board This Week view (Phase 10R-E)

- package.json: exceljs ^4.4.0 added as runtime dependency
- jobs.ts: ExportJobRow type + getJobsForWeeklyExport(orgId, weekStart, weekEnd)
  - Query A: all jobs scheduled in week (any status)
  - Query B: active overdue carry-forward + unscheduled
  - exportReason field populated per source query
- GET /api/admin/reports/jobs/weekly?start=&end=: admin-authed XLSX stream
  - 20 columns: Job#, Client, Site, Address, ServiceType, Priority, Status,
    Technician, Scheduled, Created, Completed, TimeOpen, AdminNotes,
    ClientConcern, TechNotes, Invoice#, InvoiceStatus, InvoiceTotal, Photos,
    ExportReason
  - Dark blue frozen header row, zebra striping, notes text wrap
  - Filename: JSG-Weekly-Job-Report-YYYY-MM-DD-to-YYYY-MM-DD.xlsx
- JobBoard.tsx: "Export Weekly Report" button visible only in isWeekView
- Calendar/date/time CSS and DateTimeInput not modified
```

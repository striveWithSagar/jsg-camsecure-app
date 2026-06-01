# Phase 10R-E: Weekly Job Board Excel Export — Audit Report

**Date:** 2026-05-31  
**Type:** Audit only — no code changes yet  
**Status:** Awaiting approval to implement

---

## 1. Job Board Architecture

### Data flow

```
URL: /jobs?date=week (or YYYY-MM-DD)
  └─ src/app/(dashboard)/jobs/page.tsx          ← Server Component
       └─ getJobBoardData("week")                ← server-side Supabase query
            └─ bucketWeek(rows)                  ← groups jobs into weekDays[]
       └─ <JobBoard bucket={bucket} />           ← Client Component (renders UI)
            ├─ WeekView                          ← shown when bucket.isWeekView
            ├─ KanbanView / ListView            ← day view
            └─ Tab bar + date picker
```

### JobBoard component

- **File:** `src/components/jobs/JobBoard.tsx`
- **Type:** `"use client"` — runs in the browser
- **Props:** `bucket: JobBucket`, `dateParam: string`
- **Week detection:** `activeTab === "week"` (line 309–313)
- **Toolbar location:** Lines 334–386 — the `flex items-center gap-3` div is where the export button will go

### Job Board query (`getJobBoardData`)

`src/lib/data/jobs.ts` lines 294–326 — the board query selects:
```
id, job_number, service_type, priority, status, site_name,
scheduled_at, completed_at, created_at, updated_at,
clients(name), technicians(profiles(full_name))
```

**Critical limitation:** `bucketWeek()` (lines 232–263) **skips completed and cancelled jobs** (`continue` at line 240). The week-view bucket only contains active/in-progress jobs. A weekly export should include ALL jobs scheduled this week regardless of status — so the export needs its own dedicated query, not the board's existing bucket data.

---

## 2. Jobs Table — All Available DB Columns

| Column | Type | Export value |
|---|---|---|
| `id` | uuid | Job UUID |
| `job_number` | integer | JOB-XXXX |
| `service_type` | enum | New Installation, Maintenance… |
| `priority` | enum | emergency / high / medium / low |
| `status` | enum | assigned / in_progress / completed… |
| `site_name` | text | Site / location name |
| `address` | text | Full address |
| `scheduled_at` | timestamptz | Scheduled date & time |
| `completed_at` | timestamptz | Completed date & time |
| `dispatcher_notes` | text | Admin / dispatcher notes |
| `technician_notes` | text | Notes for technician |
| `created_at` | timestamptz | Job created date |
| `updated_at` | timestamptz | Last updated |
| `client_id` | uuid | FK → clients |
| `technician_id` | uuid | FK → technicians |
| `request_id` | uuid | FK → service_requests |

**Not present in jobs table:** `started_at` — there is no column for when work was actually started. The closest proxy is `job_status_history` if a row with `status = 'started'` or `'in_progress'` exists, or `updated_at` when the status changed.

---

## 3. Related Tables Available for Export

### `invoices` (via `jobs.id = invoices.job_id`)
```
invoice_number, status (draft/unpaid/paid/overdue/cancelled),
total, subtotal, tax_amount, issued_at, due_at, paid_at
```
→ Joinable: `LEFT JOIN invoices ON invoices.job_id = jobs.id`

### `job_photos` (via `jobs.id = job_photos.job_id`)
```
id, file_name, created_at, storage_path
```
→ For export: `COUNT(job_photos.id)` per job

### `job_notes` (via `jobs.id = job_notes.job_id`)
```
body, created_at, author_profile_id → profiles.full_name
```
→ For export: concatenated notes as a single cell

### `job_checklist_items` (via `jobs.id = job_checklist_items.job_id`)
```
label, is_required, is_completed, completed_at
```
→ For export: count completed / total, or a summary line

### `service_requests` (via `jobs.request_id`)
```
description (client's original issue description), site_address
```
→ The "client concern" field the user wants comes from `service_requests.description`

---

## 4. Field Availability vs Requested Fields

| Requested field | Source | Available? | Notes |
|---|---|---|---|
| Job ID | `jobs.job_number` | ✅ | Format as JOB-XXXX |
| Client / Company | `clients.name` | ✅ | Via join |
| Site Address | `jobs.site_name` + `jobs.address` | ✅ | Both columns |
| Issue / Concern | `service_requests.description` | ✅ | Via `jobs.request_id` join |
| Priority | `jobs.priority` | ✅ | |
| Assigned Technician | `technicians → profiles.full_name` | ✅ | Via join |
| Scheduled Date & Time | `jobs.scheduled_at` | ✅ | ISO timestamp |
| Created Date | `jobs.created_at` | ✅ | |
| Started Date | ❌ No `started_at` column | **MISSING** | No DB column; proxy: first `job_status_history` row with `status IN ('started','in_progress')` if history is queryable, otherwise leave blank |
| Completed Date | `jobs.completed_at` | ✅ | Null for active jobs |
| Time Open / Duration | Calculated | ✅ | `completed_at - created_at` or `now() - created_at` |
| Current Status | `jobs.status` | ✅ | |
| Client Notes / Concern | `service_requests.description` | ✅ | Walk-in jobs have no linked request → blank |
| Admin Notes | `jobs.dispatcher_notes` | ✅ | |
| Technician Notes | `jobs.technician_notes` | ✅ | |
| Parts / Materials | ❌ No dedicated column | **MISSING** | Not tracked in a separate column; could concatenate relevant `job_notes` body, or leave blank |
| Photos Count | `COUNT(job_photos.id)` | ✅ | Via subquery |
| Invoice Status | `invoices.status`, `invoices.invoice_number` | ✅ | Via left join |
| Invoice Total | `invoices.total` | ✅ | |

**Summary:** 16 of 18 requested fields are available. Two are missing:
- **Started Date** — no `started_at` column; recommend blank or "—" in export
- **Parts / Materials** — not tracked structurally; recommend blank or "—"

---

## 5. No Existing Export Infrastructure

- No Excel or CSV library installed (`package.json` has no `xlsx`, `exceljs`, `papaparse`, etc.)
- No export/report API routes exist (only `/api/admin/accounts` and `/api/auth/request-password-help`)
- No file storage for reports — on-demand generation is the right approach

---

## 6. Package Recommendation

**`exceljs`** — recommended over `xlsx` (SheetJS) because:
- Server-side only (zero client-bundle impact in a Next.js API route)
- Supports column widths, bold headers, cell types (date, number, string)
- Active maintenance, TypeScript types included
- Generates a real `.xlsx` buffer that can be streamed directly from a route handler

Install: `npm install exceljs`

---

## 7. Implementation Plan

### Files to create

| File | Purpose |
|---|---|
| `src/app/api/admin/reports/jobs/weekly/route.ts` | GET handler: auth → query → build XLSX → stream response |
| (extend) `src/lib/data/jobs.ts` | Add `getJobsForWeeklyExport(start, end)` function |

### Files to modify

| File | Change |
|---|---|
| `src/components/jobs/JobBoard.tsx` | Add "Download Weekly Excel" button when `activeTab === "week"` |

### API route design

```
GET /api/admin/reports/jobs/weekly
    ?start=YYYY-MM-DD   (week Monday)
    ?end=YYYY-MM-DD     (week Sunday)
```

**Auth:** same `verifyAdmin(req)` pattern as `/api/admin/accounts`.  
**Response:** `Content-Disposition: attachment; filename="JSG-Weekly-Job-Report-…xlsx"`, `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.  
**Generation:** on-demand — no file stored on disk or in storage bucket.

### Export query (new, NOT using `getJobBoardData`)

```sql
SELECT
  j.job_number, j.site_name, j.address, j.service_type,
  j.priority, j.status,
  j.scheduled_at, j.completed_at, j.created_at, j.updated_at,
  j.dispatcher_notes, j.technician_notes,
  c.name AS client_name,
  p.full_name AS technician_name,
  sr.description AS client_concern,
  sr.site_address AS request_address,
  inv.invoice_number, inv.status AS invoice_status, inv.total AS invoice_total,
  COUNT(DISTINCT jp.id) AS photo_count
FROM jobs j
LEFT JOIN clients c       ON c.id = j.client_id
LEFT JOIN technicians t   ON t.id = j.technician_id
LEFT JOIN profiles p      ON p.id = t.profile_id
LEFT JOIN service_requests sr ON sr.id = j.request_id
LEFT JOIN invoices inv    ON inv.job_id = j.id
LEFT JOIN job_photos jp   ON jp.job_id = j.id
WHERE j.organization_id = <admin_org_id>
  AND j.scheduled_at >= <start>T00:00:00Z
  AND j.scheduled_at <  <end + 1 day>T00:00:00Z
GROUP BY j.id, c.name, p.full_name, sr.description, sr.site_address,
         inv.invoice_number, inv.status, inv.total
ORDER BY j.scheduled_at NULLS LAST, j.priority
```

This query includes ALL jobs in the week (active + completed + cancelled) — unlike `bucketWeek()` which skips terminal jobs.

### UI button placement

In `JobBoard.tsx` toolbar (line ~375), after the kanban/list toggle, when `bucket.isWeekView`:

```tsx
{bucket.isWeekView && (
  <a
    href={`/api/admin/reports/jobs/weekly?start=${weekStart}&end=${weekEnd}`}
    className="..."
    download
  >
    <Download className="h-3.5 w-3.5" />
    Download Weekly Excel
  </a>
)}
```

The `weekStart` / `weekEnd` are calculated from the same `getWeekStartStr()` logic already in `jobs.ts`, exposed to the client component.

### Excel sheet layout

| Column | Width | Source |
|---|---|---|
| Job # | 12 | `JOB-XXXX` |
| Client | 24 | `clients.name` |
| Site Name | 22 | `jobs.site_name` |
| Address | 28 | `jobs.address` |
| Service Type | 22 | enum label |
| Priority | 12 | enum label |
| Status | 16 | enum label |
| Technician | 20 | `profiles.full_name` |
| Scheduled | 20 | formatted datetime |
| Created | 18 | formatted datetime |
| Completed | 18 | formatted datetime / "Active" |
| Time Open | 14 | calculated duration |
| Client Concern | 36 | `service_requests.description` |
| Admin Notes | 30 | `dispatcher_notes` |
| Technician Notes | 30 | `technician_notes` |
| Photos | 10 | count |
| Invoice # | 14 | `invoice_number` or "—" |
| Invoice Status | 14 | enum label |
| Invoice Total | 14 | currency |

Filename pattern: `JSG-Weekly-Job-Report-2026-06-02-to-2026-06-08.xlsx`

---

## 8. What Will NOT Change

- No job records deleted
- No schema changes
- No RLS changes
- No technician or client portal affected
- No file storage — pure on-demand stream
- No change to existing `getJobBoardData` or board display logic

---

## 9. Ready to Implement

Awaiting approval. On approval, the implementation order will be:
1. `npm install exceljs`
2. Add `getJobsForWeeklyExport()` to `src/lib/data/jobs.ts`
3. Create `src/app/api/admin/reports/jobs/weekly/route.ts`
4. Add export button to `JobBoard.tsx`
5. Build + lint
6. Write implementation report

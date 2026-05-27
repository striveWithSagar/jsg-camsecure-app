# Phase 10A-D: Job & Request Numbers UI Verification Report

**Date:** 2026-05-27
**Status:** All checklist items PASS. Feature complete for Phase 10A.

---

## Database State

| Item | Value |
|---|---|
| `jobs` with `job_number` NULL | **0** |
| `jobs` total | 14 |
| `job_number` range | 1 – 14 (JOB-0001 through JOB-0014) |
| `service_requests` with `request_number` NULL | **0** |
| `service_requests` total | 8 |
| `request_number` range | 1 – 8 (REQ-0001 through REQ-0008) |
| `job_number_seq` next value | 15 (`is_called=false`) |
| `request_number_seq` next value | 9 (`is_called=false`) |

---

## Checklist Results

### 1. All jobs have `job_number` populated

**PASS.** Zero NULL `job_number` values. All 14 seed jobs have contiguous numbers 1–14 assigned via backfill in Phase 10A-B. The `fmtJobNumber()` helper formats them as `JOB-0001` through `JOB-0014`.

---

### 2. All service_requests have `request_number` populated

**PASS.** Zero NULL `request_number` values. All 8 seed requests have contiguous numbers 1–8 assigned via backfill. The `fmtReqNumber()` helper formats them as `REQ-0001` through `REQ-0008`.

---

### 3. Admin portal — formatted numbers verified by code audit

| Route | File | Display change | Result |
|---|---|---|---|
| `/jobs` | `JobBoard.tsx` | Kanban cards and list rows: `fmtJobNumber(job.jobNumber)` | **PASS** |
| `/jobs/[id]` | `jobs/[id]/page.tsx`, `JobDetail.tsx` | TopBar title `fmtJobNumber`, header badge `fmtJobNumber`, Source Request link `fmtReqNumber(job.requestNumber)` | **PASS** |
| `/requests` | `RequestsTable.tsx`, `requests/page.tsx` | ID column: `fmtReqNumber(req.requestNumber)` | **PASS** |
| `/requests/[id]` | `requests/[id]/page.tsx` | TopBar title: `Request fmtReqNumber(raw?.request_number)` | **PASS** |
| `/requests/[id]/convert` | `convert/page.tsx` | "Already converted" panel: fetches `job_number` from DB, displays `fmtJobNumber(convertedJobNumber)` | **PASS** |
| `/dashboard` | `DashboardView.tsx` | Today's Schedule rows: `fmtJobNumber(job.jobNumber)` in secondary line; New Requests rows: `fmtReqNumber(req.requestNumber)` in secondary line | **PASS** |

---

### 4. Technician portal — formatted numbers verified by code audit

| Route | File | Display change | Result |
|---|---|---|---|
| `/technician` | `TechnicianDashboardView.tsx` | Today's jobs list: `fmtJobNumber(job.jobNumber)` in secondary line | **PASS** |
| `/technician/jobs` | `technician/jobs/page.tsx` | Job cards: `fmtJobNumber(job.jobNumber)` in secondary line | **PASS** |
| `/technician/jobs/[id]` | `TechJobDetail.tsx` | Header: `fmtJobNumber(job.jobNumber)` below client name | **PASS** |

---

### 5. Client portal — formatted numbers verified by code audit

| Route | File | Display change | Result |
|---|---|---|---|
| `/client/jobs` | `client/jobs/page.tsx` | Job cards: `fmtJobNumber(job.jobNumber)` replacing full UUID | **PASS** |
| `/client/requests/new` success screen | `client/requests/new/page.tsx` | Reference: `fmtReqNumber(requestNumber)` from INSERT RETURNING | **PASS** |

---

### 6. ConvertJobForm — post-RPC `job_number` fetch

**PASS.** Implementation verified:
1. `supabase.rpc("convert_request_to_job", {...})` called — returns UUID
2. On success: `supabase.from("jobs").select("job_number").eq("id", jobId).single()` fetches number
3. `setNewJobNumber(jobData?.job_number ?? null)` stores it
4. Success screen shows `fmtJobNumber(newJobNumber)` — e.g. `JOB-0015`

No changes to the RPC required. Trigger fires automatically on INSERT.

Verified live in Phase 10A-B (V12): the RPC created a job that received `job_number=16` from the BEFORE INSERT trigger without any RPC code change.

---

### 7. NewRequestForm — INSERT RETURNING `request_number`

**PASS.** Implementation verified:
- `.select("id, request_number")` added to INSERT chain
- `setRequestNumber((inserted as {...}).request_number ?? null)` stores the number
- Success screen shows `fmtReqNumber(requestNumber)` — e.g. `REQ-0009`

Identical pattern applied to `client/requests/new/page.tsx`.

---

### 8. UUID short-segment display — grep audit

**PASS.** Zero remaining instances of UUID display hacks in `src/`.

| Pattern | Matches |
|---|---|
| `.split("-").pop()` | 0 |
| `.split("-")[0].toUpperCase()` | 0 |
| `shortId` property references | 0 |
| `job.id` / `req.id` rendered as display text | 0 |
| `request.id` rendered as display text | 0 |

**`fmtJobNumber` / `fmtReqNumber` call sites:** 30 across 14 files.

---

### 9. Build

**PASS.**

```
✓ Compiled successfully
✓ TypeScript — 0 errors
✓ 25 routes generated
```

---

### 10. Lint

**PASS.**

```
✓ ESLint — 0 errors · 0 warnings
```

---

## Known Limitations (Out of Scope for Phase 10A)

Two locations continue to display the full UUID as secondary metadata. These were **never UUID slice hacks** — they always showed the full raw UUID — and were not in the Phase 10A-A target list.

| File | Line | Displays | Note |
|---|---|---|---|
| `RequestDetail.tsx` | 104 | `{requestId}` (full UUID) in request header card | Secondary metadata badge below client name and status |
| `ConvertJobForm.tsx` | 162 | `{requestId}` (full UUID) in convert form request summary | Identifies the source request being converted |

Both are display-only and do not affect routing. A future polish pass could replace these with `fmtReqNumber` by threading `requestNumber` into `RequestDetailData` and `ConvertRequestData`.

---

## Summary

All six Phase 10A sub-phases are complete:

| Phase | Work | Status |
|---|---|---|
| 10A-A | Design plan | Complete |
| 10A-B | DB migration (sequences, backfill, triggers, constraints) | Complete |
| 10A-C | App/data layer (helpers, types, 20+ UI files) | Complete |
| 10A-D | End-to-end verification | **Complete — all checks PASS** |

Human-readable job and request numbers are live across all three portals. New jobs and requests created through any path (admin form, client portal, RPC conversion) will automatically receive the next sequence number from the BEFORE INSERT trigger. No further action required.

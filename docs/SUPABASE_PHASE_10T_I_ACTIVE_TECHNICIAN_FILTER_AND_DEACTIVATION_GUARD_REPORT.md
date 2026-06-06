# Phase 10T-I: Active Technician Filtering + Safe Deactivation Guard — Report

**Date:** 2026-06-06  
**Build:** ✅ 37 routes · 0 TypeScript errors  
**Lint:** ✅ 0 errors · 0 warnings

---

## 1. Root Causes Fixed

| # | Location | Problem | Fix |
|---|---|---|---|
| A | `src/lib/data/dashboard.ts` | Technician query had no `is_active` filter — deactivated techs appeared in Field Crew | Added `.eq("is_active", true)` to query |
| B | `src/lib/data/dashboard.ts` | Crew status came from `technicians.status` (self-reported) rather than actual job data | Status now derived from non-terminal jobs via `JOB_STATUS_TO_TECH` mapping |
| C | `src/lib/data/dashboard.ts` | `ACTIVE_JOB_STATUSES` excluded `needs_parts` | Added `"needs_parts"` to the set |
| D | `src/lib/data/technicians.ts` — `getTechnicians()` | No `is_active` filter — deactivated techs appeared in assignment dropdowns | Added `.eq("is_active", true)` |
| E | `src/app/api/admin/accounts/route.ts` — `deactivateAccount()` | Active job check only set a `warningMessage` but deactivation always proceeded | Changed to a **hard block**: returns `success: false` with job numbers when active jobs exist |
| F | `src/components/admin/AccountActionsPanel.tsx` | Dialog showed a warning but Deactivate button remained active | Dialog now shows an error block with job numbers; Confirm button removed when blocked |

---

## 2. Files Changed

### `src/lib/data/dashboard.ts`
- Added `"needs_parts"` to `ACTIVE_JOB_STATUSES` set (now 5 active statuses)
- Added `JOB_STATUS_TO_TECH` mapping: `assigned/started/in_progress → on_job`, `on_the_way → on_the_way`, `needs_parts → needs_parts`
- Technician SELECT now includes `is_active` + `.eq("is_active", true)` filter
- `TechRaw` type now includes `is_active: boolean`
- Added `techJobStatus` build loop: for each non-terminal job, records the derived tech status by `technician_id` (first non-terminal job wins per tech)
- Crew `.map()` now uses `techJobStatus[t.id] ?? "available"` instead of `t.status`

### `src/lib/data/technicians.ts`
- **`getTechnicians()`**: Added `.eq("is_active", true)` — deactivated techs excluded from all assignment dropdowns (ConvertJobForm, JobDetail reassign)
- **`getTechnicianById()`**:
  - Jobs SELECT now includes `job_number`
  - `JobEmbed` type updated: added `job_number: number | null`
  - Added `ACTIVE_STATUSES` local constant: `{"assigned", "on_the_way", "started", "in_progress", "needs_parts"}` — 5 statuses, correct per spec
  - Added `activeJobItems` computation: filters to active statuses, maps to `{ id, jobNumber }`
  - `activeJobs` count now derives from `activeJobItems.length` (uses correct 5 statuses instead of the previous "all non-completed, non-cancelled")
- Added exported type `ActiveJobItem: { id: string; jobNumber: number | null }`
- Added `activeJobItems: ActiveJobItem[]` to exported `TechnicianDetailData` type

### `src/app/api/admin/accounts/route.ts` — `deactivateAccount()`
- Replaced count-only query with row-fetching query: `select("id, job_number").in("status", ["assigned", "on_the_way", "started", "in_progress", "needs_parts"])`
- If active jobs found: returns `{ success: false, error: "This technician has N active job(s). Reassign or complete those jobs before deactivating. Active jobs: JOB-XXXX, JOB-YYYY" }`
- Deactivation of `technicians` row and `profiles` row only runs when no active jobs found
- Removed `warningMessage` / `activeJobCount` from the success response (no longer needed)

### `src/components/admin/AccountActionsPanel.tsx`
- Added `activeJobItems?: { id: string; jobNumber: number | null }[]` to `Props` type
- Added `activeJobItems = []` to component destructuring
- Deactivate dialog now branches on `role === "technician" && activeJobCount > 0`:
  - **Blocked state**: Error block (red border/background) with job numbers listed using `font-mono`. Only a "Close" button — no Deactivate confirm button.
  - **Normal state**: Existing "Are you sure?" flow unchanged.

### `src/app/(dashboard)/technicians/[id]/page.tsx`
- Added `activeJobItems={tech.activeJobItems}` prop to `<AccountActionsPanel />`

### `src/app/(dashboard)/dashboard/DashboardView.tsx`
- Added `needs_parts: { dot: "bg-c-warning-solid", label: "Needs Parts" }` to `TECH_STATUS` map
- Added `member.status === "needs_parts" && "text-c-warning bg-c-warning/10"` to status badge `cn()` block

---

## 3. Active Job Statuses Used

| Status | Is Active | Dashboard crew status derived |
|---|---|---|
| `assigned` | ✅ | `on_job` |
| `on_the_way` | ✅ | `on_the_way` |
| `started` | ✅ | `on_job` |
| `in_progress` | ✅ | `on_job` |
| `needs_parts` | ✅ | `needs_parts` |
| `rescheduled` | ❌ terminal-ish | — (tech shows as Available) |
| `completed` | ❌ terminal | — (tech shows as Available) |
| `cancelled` | ❌ terminal | — (tech shows as Available) |

---

## 4. Active Status Source of Truth

- **`profiles.is_active`** and **`technicians.is_active`** — both flags, kept in sync by `deactivateAccount()` / `reactivateAccount()` in the API route.
- The technician queries (`getTechnicians()` and the dashboard query) filter on **`technicians.is_active`** directly.
- The technicians management page (`/technicians`) continues to show ALL technicians including deactivated — existing behavior unchanged (correct per spec).

---

## 5. Deactivation Guard Behavior

**Before (warning only):**
1. Admin opens deactivate dialog
2. If tech has active jobs: yellow warning shown, Deactivate button still clickable
3. Backend sets `warningMessage` but deactivates anyway

**After (hard block):**
1. Admin opens deactivate dialog
2. If tech has active jobs (`activeJobCount > 0`): red error block shown with job numbers (e.g. `JOB-0028, JOB-0031`). Only a "Close" button — no Deactivate option.
3. Backend: if tech has jobs with statuses `assigned / on_the_way / started / in_progress / needs_parts` → returns HTTP 400 `{ error: "This technician has N active job(s)... Active jobs: JOB-XXXX" }` — deactivation does NOT proceed.
4. When all active jobs are reassigned or completed → deactivation dialog and backend both allow it.

---

## 6. Technician Management Page

No changes — existing behavior is correct. The `/technicians` list:
- Shows ALL technicians including deactivated (dimmed with `opacity-60`)
- Counts use frontend filtering (`technicians.filter(t => t.isActive)`) — unaffected

---

## 7. Verification Checklist

| Check | Expected |
|---|---|
| Admin dashboard Field Crew | Only active (non-deactivated) technicians shown |
| Crew status — tech with assigned/started/in_progress job | "On Job" badge |
| Crew status — tech with on_the_way job | "En Route" badge |
| Crew status — tech with needs_parts job | "Needs Parts" badge (amber) |
| Crew status — tech with no active job | "Available" badge |
| Available / Deployed counts | Count only active technicians |
| Convert to Job → Assign Technician dropdown | Only active (non-deactivated) technicians listed |
| Job detail → Reassign Technician dropdown | Only active (non-deactivated) technicians listed |
| Technicians management page | Still shows ALL including deactivated (unchanged) |
| Admin deactivates tech with active job | Dialog shows red block with job numbers, no Deactivate button |
| API POST deactivate_account with active jobs | HTTP 400 with job numbers in error message |
| Admin deactivates tech with no active jobs | Proceeds normally — both technicians.is_active + profiles.is_active set to false |
| Build | ✅ 37 routes · 0 TypeScript errors |
| Lint | ✅ 0 errors · 0 warnings |

---

## 8. What Was Not Changed

- Technicians management page (`/technicians`): untouched ✅
- `convert_request_to_job` RPC: untouched ✅
- RLS policies: untouched ✅
- Auth logic: untouched ✅
- `reactivateAccount()`: untouched ✅
- Any client-portal pages: untouched ✅
- Any invoice / request pages: untouched ✅

---

## 9. Recommended Commit Message

```
feat: active technician filtering and safe deactivation guard

- Dashboard Field Crew now only shows active technicians; status derived
  from current job status (assigned/on_the_way/started/in_progress/needs_parts)
  rather than self-reported technicians.status
- Job assignment dropdowns exclude deactivated technicians
- Deactivation is hard-blocked (not just warned) when technician has active
  jobs; error includes job numbers (e.g. JOB-0028, JOB-0031)
- Deactivate dialog shows blocking error with job numbers instead of a
  dismissible warning
- Active job statuses: assigned, on_the_way, started, in_progress, needs_parts
```

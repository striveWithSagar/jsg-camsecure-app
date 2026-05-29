# Phase 10M-B: Job Completion Checklist — Implementation Report

**Date:** 2026-05-28  
**Status:** COMPLETE — awaiting commit approval  
**Base commit:** 88a241e (Phase 10L hardening)

---

## 1. Summary

| Area | Result |
|---|---|
| Migration applied | ✅ `20260528000002_job_checklist_items.sql` |
| `job_checklist_items` table | ✅ Created with all columns, index, RLS |
| RLS policies (4) | ✅ `jci_select`, `jci_insert`, `jci_update`, `jci_delete` |
| Column restriction trigger | ✅ `trg_checklist_tech_col_guard` |
| Completion guard trigger on `jobs` | ✅ `trg_jobs_checklist_guard` |
| Data layer (`jobs.ts`) | ✅ `ChecklistItem` type, `JobDetailData.checklistItems`, `getJobById` |
| Admin UI (`JobChecklist.tsx`) | ✅ New component — add/delete/reorder with presets |
| Admin page (`JobDetail.tsx`) | ✅ Checklist rendered + `CHECKLIST_INCOMPLETE` error handling |
| Technician UI (`TechChecklist.tsx`) | ✅ New component — toggle completion |
| Technician page (`TechJobDetail.tsx`) | ✅ `"use client"` + reactive checklist state + `hasBlockingItems` |
| Status widget (`JobStatusWidget.tsx`) | ✅ `hasBlockingItems` prop + `CHECKLIST_INCOMPLETE` detection |
| Build | ✅ 0 TypeScript errors · 28 routes |
| Lint | ✅ 0 errors · 0 warnings |
| RLS simulations (13) | ✅ 13/13 pass |
| DB / storage orphan check | ✅ Clean |

---

## 2. Files Changed

| File | Action | Description |
|---|---|---|
| `supabase/migrations/20260528000002_job_checklist_items.sql` | **NEW** | Full schema, RLS, triggers |
| `src/lib/data/jobs.ts` | **MODIFIED** | `ChecklistItem` type + `checklistItems` in `JobDetailData` + updated `getJobById` |
| `src/components/jobs/JobChecklist.tsx` | **NEW** | Admin checklist manager |
| `src/components/jobs/JobDetail.tsx` | **MODIFIED** | Render `JobChecklist` + `CHECKLIST_INCOMPLETE` error handling |
| `src/components/technician/TechChecklist.tsx` | **NEW** | Technician completion panel |
| `src/components/technician/TechJobDetail.tsx` | **MODIFIED** | `"use client"` + checklist state + `hasBlockingItems` prop flow |
| `src/components/technician/JobStatusWidget.tsx` | **MODIFIED** | `hasBlockingItems` prop + `CHECKLIST_INCOMPLETE` error handling |
| `docs/SUPABASE_PHASE_10M_B_JOB_CHECKLIST_REPORT.md` | **NEW** | This report |

---

## 3. Schema

```sql
CREATE TABLE job_checklist_items (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         UUID        NOT NULL REFERENCES organizations(id),
  job_id                  UUID        NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  position                INTEGER     NOT NULL,
  label                   TEXT        NOT NULL,
  is_required             BOOLEAN     NOT NULL DEFAULT true,
  is_completed            BOOLEAN     NOT NULL DEFAULT false,
  completed_at            TIMESTAMPTZ NULL,
  completed_by_profile_id UUID        NULL REFERENCES profiles(id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_jci_job_id ON job_checklist_items(job_id);
```

`ON DELETE CASCADE` from `jobs` ensures all checklist items are removed when a job is deleted.

---

## 4. RLS Policies

| Policy | Command | Who |
|---|---|---|
| `jci_select` | SELECT | Admin/owner/dispatcher (org) OR assigned technician |
| `jci_insert` | INSERT | Admin/owner/dispatcher (org) only |
| `jci_update` | UPDATE | Admin/owner/dispatcher (org) OR assigned technician (completion fields enforced by trigger) |
| `jci_delete` | DELETE | Admin/owner/dispatcher (org) only |

**Client:** No SELECT, INSERT, UPDATE, or DELETE — no policy covers them.

---

## 5. Triggers

### `trg_checklist_tech_col_guard` (BEFORE UPDATE on `job_checklist_items`)

Fires on every UPDATE. When the caller is a technician, raises `CHECKLIST_FIELD_RESTRICTED` if any of `label`, `position`, `is_required`, `organization_id`, or `job_id` change from their existing values.

This enforces column-level restriction at the DB layer since PostgreSQL RLS cannot restrict which columns are updated.

### `trg_jobs_checklist_guard` (BEFORE UPDATE OF status ON `jobs`)

Fires only when `status` changes to `'completed'` from a different value. Raises:
```
CHECKLIST_INCOMPLETE: All required checklist items must be completed before marking this job complete.
```
…if any row exists in `job_checklist_items` where `job_id = NEW.id AND is_required = true AND is_completed = false`.

The trigger fires for **all roles** — admin and technician completion paths both respect it. The `CHECKLIST_INCOMPLETE:` prefix allows both portals to detect this specific error and show a friendly message.

---

## 6. Data Layer

### New export: `ChecklistItem`

```typescript
export type ChecklistItem = {
  id:                   string;
  position:             number;
  label:                string;
  isRequired:           boolean;
  isCompleted:          boolean;
  completedAt:          string | null;
  completedByProfileId: string | null;
};
```

### `JobDetailData` extension

`checklistItems: ChecklistItem[]` added. Items are sorted by `position` in the return mapping.

### `getJobById` query

Added to the Supabase select:
```
job_checklist_items(id, position, label, is_required, is_completed, completed_at, completed_by_profile_id)
```

---

## 7. Admin UI: `JobChecklist.tsx`

Placed in the **left column** of `JobDetail.tsx`, after "Job Information" and before "Internal Notes".

**Features:**
- Ordered list of checklist items with position number, label, `REQ`/`OPT` badge, completion indicator
- Move up / move down buttons (swap positions via parallel Supabase UPDATEs)
- Delete button per item (with spinner during deletion)
- Progress counter: `X/Y completed · Z required pending` (warning colour if pending, success if all done)
- **Add item panel** (expanded on "+ Add Checklist Item" click):
  - Preset dropdown (9 common items) fills the text input
  - Free-text input for custom labels
  - Required checkbox (default: checked)
  - Add / Cancel buttons; Enter submits, Escape cancels
- Completed items shown with strikethrough and success tint (read-only — technician checked them)
- Empty state: "No checklist items. Add items to require technician sign-off before completion."

**Error handling:**
`markComplete()` and `saveStatus()` in `JobDetail.tsx` detect `CHECKLIST_INCOMPLETE` in the Supabase error message and display:
> "Cannot complete — required checklist items are still pending."

---

## 8. Technician UI: `TechChecklist.tsx`

Placed in `TechJobDetail.tsx` **between the Timeline card and `JobStatusWidget`**, so the technician sees the checklist before the completion button.

**Features:**
- Returns `null` when `initialItems.length === 0` — no empty card, no noise for jobs without checklists
- Large tap-target button per item (mobile-friendly)
- Each item: large checkbox circle, label, `REQUIRED`/`OPTIONAL` badge
- Progress counter with colour: green when all required done, amber when pending
- Warning line: "X required items must be completed before the job can be marked done."
- Toggle: updates `is_completed`, `completed_at`, `completed_by_profile_id` via Supabase UPDATE
- Optimistic UI: local state updates immediately; reverts on DB error
- Per-item loading spinner during save

**State propagation:**
`TechJobDetail` is now `"use client"` and owns `checklistItems` state, initialized from `job.checklistItems`. `TechChecklist` calls `onItemsChange(updated)` on every toggle. `TechJobDetail` computes `hasBlockingItems` from this live state and passes it to `JobStatusWidget`.

---

## 9. `JobStatusWidget` Changes

**New prop:** `hasBlockingItems?: boolean` (default `false`).

When `next === "completed"` and `hasBlockingItems` is `true`:
- Button is `disabled`
- Button label becomes **"Complete checklist first"**
- Button colour muted (no success green)
- `title` tooltip: "Complete all required checklist items first"

**Error detection:**
```typescript
error.message.includes("CHECKLIST_INCOMPLETE")
  ? "Complete all required checklist items before marking this job done."
  : "Failed to update status. Please try again."
```

---

## 10. RLS + Trigger Verification Results

All 13 simulations ran via `execute_sql` with `SET LOCAL ROLE authenticated` + JWT claims.

| # | Simulation | Expected | Result |
|---|---|---|---|
| 1 | Admin INSERT checklist item | ALLOWED | ✅ PASS |
| 2 | Technician SELECT own job checklist | ALLOWED | ✅ PASS |
| 3 | Technician SELECT unassigned job checklist | BLOCKED | ✅ PASS |
| 4 | Technician UPDATE completion fields (`is_completed`, `completed_at`, `completed_by_profile_id`) | ALLOWED | ✅ PASS |
| 5 | Technician UPDATE structural field (`label`) | BLOCKED (`CHECKLIST_FIELD_RESTRICTED`) | ✅ PASS |
| 6 | Technician DELETE checklist item | BLOCKED | ✅ PASS |
| 7 | Technician INSERT checklist item | BLOCKED | ✅ PASS |
| 8 | Client SELECT `job_checklist_items` | BLOCKED (0 rows) | ✅ PASS |
| 9 | Client INSERT checklist item | BLOCKED | ✅ PASS |
| 10 | Admin DELETE checklist item | ALLOWED | ✅ PASS |
| 11 | DB guard blocks completion with 1 required pending | BLOCKED (status unchanged) | ✅ PASS |
| 12 | DB guard allows completion when all required done | ALLOWED | ✅ PASS |
| 13 | DB guard silent when no checklist exists | ALLOWED | ✅ PASS |

**Note on Sim 11:** First run showed a false-negative due to parallel test execution — Sim 12 completed the same job concurrently. Re-ran in isolation; result confirmed PASS (guard fires correctly, status remained `in_progress`).

---

## 11. Build and Lint

| Check | Result |
|---|---|
| `npm run build` | ✅ 0 TypeScript errors · 28 routes (unchanged) |
| `npm run lint` | ✅ 0 errors · 0 warnings |

---

## 12. DB Cleanup

All sim test rows removed. Jobs reset to pre-test states:

| Resource | Final state |
|---|---|
| `job_checklist_items` | 0 rows (all sim rows deleted) |
| `job_photos` | 7 rows (unchanged real admin test data) |
| `service_request_photos` | 0 rows (unchanged) |
| JOB-001 (job_number=1) | `in_progress`, 0 checklist items |
| JOB-002 (job_number=2) | `cancelled` (pre-test state restored), 0 checklist items |

---

## 13. Known Limitations / Future Work

| Item | Notes |
|---|---|
| No admin completion override | Per spec — the DB guard applies to all roles. No bypass. |
| Client cannot view checklist | Deferred per spec. A `jci_select` client branch can be added later with no schema changes. |
| No checklist templates | Templates at the org level are out of scope. Admin creates items per-job. |
| No checklist on request-to-job conversion | `convert_request_to_job` RPC not modified. Checklist can be added to the new job in `JobDetail` post-conversion. |
| Reorder uses two sequential UPDATEs | No unique constraint on `(job_id, position)` — swaps work without temp values. Could be hardened with a deferred constraint if needed. |

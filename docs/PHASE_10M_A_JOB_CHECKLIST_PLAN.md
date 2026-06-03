# Phase 10M-A: Job Completion Checklist — Implementation Plan

**Date:** 2026-05-28  
**Type:** Plan only — no code changes in this phase  
**Base commit:** 88a241e

---

## 1. Current Workflow Audit

### 1a. Completion paths

**Admin path** (`JobDetail.tsx` → `JobDetail` component):

Two independent ways to set status to `completed`:

1. **"Mark Complete" button** (header card, line 147) — calls `markComplete()` which does:
   ```typescript
   supabase.from("jobs").update({ status: "completed", completed_at: new Date().toISOString() })
   ```
2. **Status dropdown + "Save Status" button** (right sidebar) — sets `status` to any value via `saveStatus()`, including `completed`, without setting `completed_at`.

No guards of any kind currently exist in either path.

**Technician path** (`TechJobDetail.tsx` → `JobStatusWidget`):

`JobStatusWidget` defines a linear state machine. `completed` is only reachable from `in_progress`:

```
assigned → on_the_way → started → in_progress → completed
                                              ↘ needs_parts → in_progress
```

The "Mark Complete" button calls `advance("completed")`:
```typescript
supabase.from("jobs").update({ status: "completed", completed_at: new Date().toISOString() })
```

No guards exist. Nothing prevents this call from succeeding regardless of any checklist state.

### 1b. Job status RLS (`jobs_update`)

```sql
USING:
  (organization_id = auth_org_id() AND auth_role() IN ('owner','admin','dispatcher'))
  OR (technician_id = auth_technician_id() AND auth_role() = 'technician')
WITH CHECK: (same as USING)
```

The RLS grants broad UPDATE to admins and assigned technicians — it does not inspect which columns are being set.

### 1c. Existing triggers on `jobs`

| Trigger | Event | Function | Purpose |
|---|---|---|---|
| `trg_assign_job_number` | BEFORE INSERT | `assign_job_number` | Sequential job_number via `job_number_seq` |
| `trg_job_status_on_insert` | AFTER INSERT | `fn_record_job_status_insert` | Initial status → `job_status_history` |
| `trg_job_status_on_update` | AFTER UPDATE | `fn_record_job_status_change` | Status change → `job_status_history` |
| `trg_jobs_updated_at` | BEFORE UPDATE | `set_updated_at` | Maintain `updated_at` |

The new completion guard will be a **BEFORE UPDATE** trigger (fires before the change is committed, can abort it).

### 1d. `getJobById` (admin + technician path)

Both portals use `getJobById(id)` from `src/lib/data/jobs.ts`. It currently selects from `jobs`, `clients`, `technicians`, `job_notes`, and `service_requests`. The new implementation will add `job_checklist_items(*)` to this query and extend `JobDetailData`.

### 1e. `JobStatusWidget` receives `initialStatus` and `jobId` only

To support the checklist guard at UI level, `JobStatusWidget` will need to know whether blocking items exist. This requires either:
- Passing `hasBlockingItems: boolean` as a new prop, or  
- Fetching checklist state inside the widget.

**Recommended:** Pass `hasBlockingItems` as a prop. It is already computed from `job.checklistItems` in `TechJobDetail`, keeping the widget stateless and testable.

---

## 2. Recommended Schema

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

ALTER TABLE job_checklist_items ENABLE ROW LEVEL SECURITY;
```

### Column notes

| Column | Notes |
|---|---|
| `position` | Integer, 1-based. Admin manages ordering. Items are re-numbered on delete or reorder. |
| `label` | Free-text item description. Admin-only field. |
| `is_required` | When true, blocks completion. When false, item is informational only. |
| `is_completed` | Only this field (plus `completed_at`, `completed_by_profile_id`) can be set by technicians. |
| `completed_at` | Set alongside `is_completed = true`; cleared when unchecked. |
| `completed_by_profile_id` | Profile of whoever checked the item. Nullable so unchecking clears it. |

### `updated_at` trigger

```sql
CREATE TRIGGER trg_checklist_updated_at
  BEFORE UPDATE ON job_checklist_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

The shared `set_updated_at()` function already exists (used on `jobs`).

---

## 3. RLS Policy Plan

### Policy matrix

| Operation | Admin/Owner/Dispatcher | Technician (assigned) | Technician (unassigned) | Client |
|---|---|---|---|---|
| SELECT | ✅ all items in org | ✅ assigned job only | ❌ | ❌ |
| INSERT | ✅ | ❌ | ❌ | ❌ |
| UPDATE (any field) | ✅ | ❌ | ❌ | ❌ |
| UPDATE (completion fields only) | ✅ | ✅ | ❌ | ❌ |
| DELETE | ✅ | ❌ | ❌ | ❌ |

### Policy SQL

```sql
-- SELECT
CREATE POLICY jci_select ON job_checklist_items
  FOR SELECT TO authenticated
  USING (
    (organization_id = auth_org_id()
      AND auth_role() = ANY (ARRAY['owner','admin','dispatcher']))
    OR (
      auth_role() = 'technician'
      AND job_id IN (
        SELECT jobs.id FROM jobs WHERE jobs.technician_id = auth_technician_id()
      )
    )
  );

-- INSERT (admin/dispatcher only)
CREATE POLICY jci_insert ON job_checklist_items
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = auth_org_id()
    AND auth_role() = ANY (ARRAY['owner','admin','dispatcher'])
  );

-- UPDATE (admin: any field; technician: completion fields only — enforced by trigger)
CREATE POLICY jci_update ON job_checklist_items
  FOR UPDATE TO authenticated
  USING (
    (organization_id = auth_org_id()
      AND auth_role() = ANY (ARRAY['owner','admin','dispatcher']))
    OR (
      auth_role() = 'technician'
      AND job_id IN (
        SELECT jobs.id FROM jobs WHERE jobs.technician_id = auth_technician_id()
      )
    )
  )
  WITH CHECK (
    (organization_id = auth_org_id()
      AND auth_role() = ANY (ARRAY['owner','admin','dispatcher']))
    OR (
      auth_role() = 'technician'
      AND job_id IN (
        SELECT jobs.id FROM jobs WHERE jobs.technician_id = auth_technician_id()
      )
    )
  );

-- DELETE (admin/dispatcher only)
CREATE POLICY jci_delete ON job_checklist_items
  FOR DELETE TO authenticated
  USING (
    organization_id = auth_org_id()
    AND auth_role() = ANY (ARRAY['owner','admin','dispatcher'])
  );
```

### Technician column restriction trigger

RLS cannot restrict which columns a technician updates — it only controls row-level access. A `BEFORE UPDATE` trigger enforces that technicians may only touch the three completion columns:

```sql
CREATE OR REPLACE FUNCTION fn_checklist_tech_col_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF auth_role() = 'technician' THEN
    IF NEW.label           IS DISTINCT FROM OLD.label
    OR NEW.position        IS DISTINCT FROM OLD.position
    OR NEW.is_required     IS DISTINCT FROM OLD.is_required
    OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
    OR NEW.job_id          IS DISTINCT FROM OLD.job_id
    THEN
      RAISE EXCEPTION 'CHECKLIST_FIELD_RESTRICTED: Technicians may only update completion fields.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_checklist_tech_col_guard
  BEFORE UPDATE ON job_checklist_items
  FOR EACH ROW EXECUTE FUNCTION fn_checklist_tech_col_guard();
```

`auth_role()` resolves correctly within the trigger because PostgREST sets `request.jwt.claims` before executing the statement, and trigger functions run within the same transaction.

---

## 4. Completion Enforcement Strategy

### DB-level guard (the authoritative gate)

A `BEFORE UPDATE` trigger on `jobs` that fires when `status` changes to `'completed'`:

```sql
CREATE OR REPLACE FUNCTION fn_jobs_checklist_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    IF EXISTS (
      SELECT 1 FROM job_checklist_items
      WHERE job_id     = NEW.id
        AND is_required  = true
        AND is_completed = false
    ) THEN
      RAISE EXCEPTION
        'CHECKLIST_INCOMPLETE: All required checklist items must be checked before completing this job.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_jobs_checklist_guard
  BEFORE UPDATE OF status ON jobs
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed')
  EXECUTE FUNCTION fn_jobs_checklist_guard();
```

`BEFORE UPDATE OF status` makes the trigger fire only when `status` is explicitly included in the UPDATE columns — not on every row update — which is efficient and precise.

The `CHECKLIST_INCOMPLETE:` prefix in the error message allows both portals to detect this specific failure and surface a user-friendly message rather than a raw database error.

### UI-level guard (technician portal)

`JobStatusWidget` receives a new boolean prop: `hasBlockingItems`. When `true`, the "Mark Complete" transition button is disabled with a tooltip/label explaining why.

```typescript
// In TechJobDetail.tsx:
const hasBlockingItems = job.checklistItems.some(
  item => item.isRequired && !item.isCompleted
);

// Passed to:
<JobStatusWidget initialStatus={job.status} jobId={job.id} hasBlockingItems={hasBlockingItems} />
```

Inside `JobStatusWidget`, the "Mark Complete" button is disabled when `next === "completed" && hasBlockingItems`.

The DB guard is the authoritative enforcement. The UI guard is a usability layer only.

### Admin path guard

The `markComplete()` button in `JobDetail.tsx` and the status dropdown both send a direct Supabase UPDATE. The DB trigger fires on both paths. When blocked, the Supabase error `{ code: "P0001", message: "CHECKLIST_INCOMPLETE: ..." }` is returned. The admin UI should detect the `CHECKLIST_INCOMPLETE:` prefix and show a descriptive inline message instead of a raw error.

---

## 5. UI Changes — Admin Portal

### `JobDetail.tsx` changes

Add a **Checklist** card to the **left column** (after "Job Information", before "Internal Notes"). Left column is the right placement for admin content creation since the right sidebar is reserved for actions/controls.

```
Left column (lg:col-span-2):
  ├── Client & Location    (existing)
  ├── Job Information      (existing)
  ├── [NEW] Checklist      ← add here
  ├── Internal Notes       (existing)
  └── Photos               (existing — JobPhotoPanel)
```

### New component: `src/components/jobs/JobChecklist.tsx`

Admin-facing checklist manager. A `"use client"` component.

**Props:**
```typescript
{
  jobId:          string;
  organizationId: string;
  initialItems:   ChecklistItem[];
}
```

**Features:**
- Ordered list of items with position number, label text, required badge, completed indicator
- "Add Item" section with:
  - Preset dropdown: common items (see §5a below)
  - Text input for custom label
  - "Required" toggle (default: on)
  - "Add" button
- Per-item: delete button (X), up/down reorder buttons
- Items completed by technician show a green check + "Completed by [name]" caption (read-only for admin)
- No inline editing of existing labels (delete + re-add is the workflow for correction — keeps the component simple)
- Empty state: "No checklist items. Add items to require technician sign-off before completion."

**Reorder logic:**
- "Move Up" swaps `position` of item[i] and item[i-1] via two PATCH calls or a single UPSERT
- Alternative: client-side reorder with a single batch update on "Save Order" — recommended to avoid race conditions

**Preset common items (§5a):**

| Preset | Label |
|---|---|
| Test all cameras | "Test all cameras and confirm live feed" |
| Check DVR/NVR | "Check DVR/NVR connections and recording" |
| Verify storage | "Verify recording storage is functioning" |
| Mobile app | "Confirm mobile app access for client" |
| Cable management | "Inspect and secure all cable runs" |
| Label equipment | "Label all equipment and ports" |
| Site walkthrough | "Conduct final site walkthrough with client" |
| Document issues | "Document any unresolved issues" |
| Client sign-off | "Obtain client sign-off on completed work" |
| Custom | — (free text input) |

### `markComplete()` error handling update

In `JobDetail.tsx`, the `markComplete()` function currently sets error state via `setStatusError`. Update to detect `CHECKLIST_INCOMPLETE:` in the error message and show:
> "Cannot complete job — checklist has X unchecked required item(s)."

---

## 6. UI Changes — Technician Portal

### `TechJobDetail.tsx` changes

Add a **TechChecklist** panel between the Timeline card and `JobStatusWidget`. This ordering ensures checklist is seen before the completion button.

```
TechJobDetail layout (single column):
  ├── Back link
  ├── Header (client, site, job number)
  ├── Job details (service type, scheduled, address, dispatcher)
  ├── Navigate button
  ├── Timeline
  ├── [NEW] TechChecklist  ← add here
  ├── JobStatusWidget      (receives hasBlockingItems prop)
  ├── TechFieldNotes
  └── JobPhotoPanel
```

### New component: `src/components/technician/TechChecklist.tsx`

Technician-facing checklist. A `"use client"` component.

**Props:**
```typescript
{
  jobId:        string;
  initialItems: ChecklistItem[];
  onItemChecked?: (allRequiredDone: boolean) => void;  // optional callback
}
```

**Features:**
- Render nothing (return `null`) if `initialItems.length === 0` — no empty state card when no checklist exists
- Ordered list of items sorted by `position`
- Each item:
  - Checkbox (large tap target, mobile-optimised — `h-5 w-5` minimum)
  - Label text
  - `REQUIRED` badge (small, red) for `is_required = true`
  - Optional badge for `is_required = false`
  - Completed items: checked checkbox, strikethrough label, "Checked by you" caption
- Checkbox click calls `supabase.from("job_checklist_items").update({...})`:
  ```typescript
  // Check on:
  { is_completed: true, completed_at: new Date().toISOString(), completed_by_profile_id: user.id }
  // Check off:
  { is_completed: false, completed_at: null, completed_by_profile_id: null }
  ```
- Optimistic UI: toggle immediately, revert on DB error
- Loading state per item (spinner replaces checkbox during save)
- Section heading: "Job Checklist" with completion count "3 / 5 items"

### `JobStatusWidget.tsx` changes

Add `hasBlockingItems?: boolean` prop (default `false`). When a transition targets `"completed"` and `hasBlockingItems` is true:
- Button is `disabled`
- Button label changes to: "Complete all required items first"
- Retain error display for when the DB guard fires anyway (edge case: checklist state changed in another session)

---

## 7. Data Layer Changes

### `ChecklistItem` type (add to `src/lib/data/jobs.ts`)

```typescript
export type ChecklistItem = {
  id:                    string;
  position:              number;
  label:                 string;
  isRequired:            boolean;
  isCompleted:           boolean;
  completedAt:           string | null;
  completedByProfileId:  string | null;
};
```

### `JobDetailData` extension

Add to the existing type:
```typescript
checklistItems: ChecklistItem[];
```

### `getJobById` query extension

Add to the Supabase select:
```typescript
"job_checklist_items(id, position, label, is_required, is_completed, completed_at, completed_by_profile_id)"
```

Add to the return mapping:
```typescript
checklistItems: (row.job_checklist_items ?? [])
  .sort((a, b) => a.position - b.position)
  .map(item => ({
    id:                   item.id,
    position:             item.position,
    label:                item.label,
    isRequired:           item.is_required,
    isCompleted:          item.is_completed,
    completedAt:          item.completed_at ?? null,
    completedByProfileId: item.completed_by_profile_id ?? null,
  })),
```

No new data functions are needed — both admin and technician portals use `getJobById`.

---

## 8. Migration Plan

Single migration file: `supabase/migrations/20260528000002_job_checklist_items.sql`

Contents (in order):
1. `CREATE TABLE job_checklist_items` with all columns + index + `ENABLE ROW LEVEL SECURITY`
2. `trg_checklist_updated_at` (reuses existing `set_updated_at()`)
3. `jci_select`, `jci_insert`, `jci_update`, `jci_delete` policies
4. `fn_checklist_tech_col_guard` + `trg_checklist_tech_col_guard`
5. `fn_jobs_checklist_guard` + `trg_jobs_checklist_guard` (on `jobs` table)

---

## 9. Files Expected to Change

| File | Action | Description |
|---|---|---|
| `supabase/migrations/20260528000002_job_checklist_items.sql` | **NEW** | Table, RLS, triggers, completion guard |
| `src/lib/data/jobs.ts` | **MODIFIED** | `ChecklistItem` type, `checklistItems` in `JobDetailData`, extend `getJobById` select |
| `src/components/jobs/JobChecklist.tsx` | **NEW** | Admin checklist manager UI |
| `src/components/jobs/JobDetail.tsx` | **MODIFIED** | Import + render `JobChecklist`, handle `CHECKLIST_INCOMPLETE` error |
| `src/components/technician/TechChecklist.tsx` | **NEW** | Technician checklist UI |
| `src/components/technician/TechJobDetail.tsx` | **MODIFIED** | Import + render `TechChecklist`, compute `hasBlockingItems` |
| `src/components/technician/JobStatusWidget.tsx` | **MODIFIED** | Add `hasBlockingItems` prop, disable "Mark Complete" when blocked |

**Not changed:** `tech-jobs.ts` (list view does not need checklist data), any client portal files, any invoice files, any RLS on existing tables (other than the new trigger on `jobs`).

---

## 10. Verification Checklist (25 tests)

### A. Schema integrity

| # | Test | Expected |
|---|---|---|
| 1 | `job_checklist_items` table exists with all 10 columns | ✅ |
| 2 | `ON DELETE CASCADE` from `jobs` — delete a job, its checklist items are removed | ✅ items gone |
| 3 | `is_required` defaults to `true` on INSERT with no explicit value | ✅ |
| 4 | `is_completed` defaults to `false` on INSERT | ✅ |
| 5 | `updated_at` trigger fires on UPDATE | ✅ `updated_at` advances |

### B. RLS — Admin

| # | Test | Expected |
|---|---|---|
| 6 | Admin SELECT checklist items for a job in their org | ✅ rows returned |
| 7 | Admin INSERT a checklist item | ✅ row created |
| 8 | Admin UPDATE label, position, is_required | ✅ fields updated |
| 9 | Admin DELETE a checklist item | ✅ row removed |
| 10 | Admin cannot INSERT a checklist item for a job in a different org | ❌ blocked |

### C. RLS — Technician

| # | Test | Expected |
|---|---|---|
| 11 | Technician SELECT checklist items for their assigned job | ✅ rows returned |
| 12 | Technician SELECT checklist items for another technician's job | ❌ 0 rows |
| 13 | Technician UPDATE `is_completed`, `completed_at`, `completed_by_profile_id` | ✅ updated |
| 14 | Technician UPDATE `label` (structural field) | ❌ exception `CHECKLIST_FIELD_RESTRICTED` |
| 15 | Technician UPDATE `is_required` (structural field) | ❌ exception |
| 16 | Technician DELETE a checklist item | ❌ blocked |
| 17 | Technician INSERT a checklist item | ❌ blocked |

### D. RLS — Client

| # | Test | Expected |
|---|---|---|
| 18 | Client SELECT on `job_checklist_items` | ❌ 0 rows (no SELECT policy for client) |
| 19 | Client INSERT on `job_checklist_items` | ❌ blocked |

### E. DB completion guard

| # | Test | Expected |
|---|---|---|
| 20 | Admin updates `jobs.status = 'completed'` with 0 checklist items | ✅ allowed |
| 21 | Admin updates `jobs.status = 'completed'` with all required items checked | ✅ allowed |
| 22 | Admin updates `jobs.status = 'completed'` with 1 required item unchecked | ❌ `CHECKLIST_INCOMPLETE` exception |
| 23 | Admin updates `jobs.status = 'completed'` with only optional items unchecked (all required done) | ✅ allowed |
| 24 | Technician advances to `completed` with unchecked required items | ❌ `CHECKLIST_INCOMPLETE` exception |
| 25 | DB trigger does NOT fire when admin updates other fields (e.g., `priority`) | ✅ no interference |

### F. UI regression (manual or programmatic)

| # | Test | Expected |
|---|---|---|
| 26 | Admin job detail page loads with checklist section visible | ✅ |
| 27 | Technician job detail page shows checklist panel when items exist | ✅ |
| 28 | Technician job detail page shows NO checklist panel when no items exist | ✅ null render |
| 29 | Technician "Mark Complete" button is disabled when required items pending | ✅ disabled |
| 30 | Technician "Mark Complete" button is active after all required items checked | ✅ active |

---

## 11. Design Decisions and Trade-offs

### Why a trigger for column restriction (not a separate RPC)?

A dedicated RPC like `check_off_item(item_id)` would be cleaner in theory, but it requires `SECURITY DEFINER` or careful privilege management, and it deviates from the pattern used elsewhere in this codebase (direct Supabase JS calls). A `BEFORE UPDATE` trigger enforces the column restriction at the DB layer without changing the call pattern.

### Why not store checklists as a JSONB column on `jobs`?

Normalised rows allow:
- Per-item RLS (technicians can check items without seeing admin-only fields)
- Ordered inserts without full-document rewrites
- `completed_by_profile_id` FK to `profiles`
- Efficient existence check in the completion guard (`SELECT 1 ... LIMIT 1`)

### Why `position` as integer rather than `created_at` ordering?

Admin explicitly controls ordering. `created_at` ordering would make reorder impossible without re-inserting rows. Integer `position` allows up/down swaps and explicit numbering visible in the UI.

### Why not block technician completion at the RLS level on `jobs`?

The `jobs_update` policy allows technicians to update rows for their assigned jobs without column inspection. A `BEFORE UPDATE` trigger is the correct PostgreSQL mechanism for value-level or column-level constraints that RLS cannot express.

### Client read access deferred

Client visibility into the checklist (e.g., "Your job is 3/5 checklist items complete") has product value but is deferred. Adding a `jci_select` client branch later is a one-line policy addition with no schema changes.

---

## 12. Open Questions (resolve before implementation)

1. **Should admin be able to complete a job with unchecked required items by overriding the guard?** Current plan: no override — the DB trigger fires for all roles. If override is needed, an admin-only RPC `admin_force_complete_job(job_id)` could bypass it.

2. **Should technicians be able to un-check a completed item?** Current plan: yes — the UI and RLS both allow setting `is_completed = false`. This allows correction of accidental checks.

3. **Should checklist items from a service request carry over when converted to a job?** Currently out of scope. The `convert_request_to_job` RPC could be extended later to copy a template checklist.

4. **Preset checklist templates at the org level?** Out of scope for this phase. Admin adds items per-job. A "templates" feature would be a Phase 10M-B or later.

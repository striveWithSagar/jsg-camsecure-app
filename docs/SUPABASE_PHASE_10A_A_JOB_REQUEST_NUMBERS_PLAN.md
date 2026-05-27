# Phase 10A-A: Human-Readable Job & Request Numbers — Implementation Plan

**Date:** 2026-05-27
**Status:** Plan only — no code or migrations written

---

## 1. Current State Audit

### Schema

Neither `jobs` nor `service_requests` has a human-readable number column.

| Table | PK | Candidate column | Exists? |
|---|---|---|---|
| `jobs` | `id uuid` (gen_random_uuid) | `job_number` | No |
| `service_requests` | `id uuid` (gen_random_uuid) | `request_number` | No |

**No sequences exist** in the public schema (verified via `pg_sequences`).

### Row Counts (as of 2026-05-27)

| Table | Rows |
|---|---|
| `jobs` | 14 |
| `service_requests` | 8 |

Small backfill — both can be processed in a single `UPDATE` statement each.

### Current Display Pattern (UUID-slice hack)

Several UI locations currently fake a short reference by slicing the UUID:

| File | Line | Current code | Replacement |
|---|---|---|---|
| `RequestsTable.tsx` | 68 | `req.id.split("-").pop()` | `REQ-0001` |
| `requests/[id]/page.tsx` | 47 | `request.id.split("-").pop()` (TopBar title) | `REQ-0001` |
| `NewRequestForm.tsx` | 118 | `createdId.split("-").pop()` (success screen) | `REQ-0001` |
| `ConvertJobForm.tsx` | 110 | `newJobId.split("-")[0].toUpperCase()` (success screen) | `JOB-0001` |
| `client/requests/new/page.tsx` | 111 | `createdId.split("-")[0].toUpperCase()` | `REQ-0001` |
| `client/jobs/page.tsx` | 26 | Full UUID as display text | `JOB-0001` |

---

## 2. Design Options Considered

### Option A — GENERATED ALWAYS AS IDENTITY (non-PK)

```sql
ALTER TABLE jobs ADD COLUMN job_number bigint GENERATED ALWAYS AS IDENTITY;
```

**Pros:** No trigger code needed; Postgres handles sequencing.  
**Cons:** Cannot backfill existing rows without `OVERRIDING SYSTEM VALUE` on every UPDATE. Does not play well with seed rows — the sequence starts at the wrong value after backfill. Harder to coordinate with the `convert_request_to_job` RPC.

**Not recommended.**

### Option B — Separate Sequences + BEFORE INSERT Trigger ✓ Recommended

```sql
CREATE SEQUENCE job_number_seq;
CREATE SEQUENCE request_number_seq;
```

Trigger fires `BEFORE INSERT` and sets `NEW.job_number = nextval('job_number_seq')` if null. Backfill uses `ROW_NUMBER() OVER (ORDER BY created_at)` then resets the sequence start.

**Pros:**
- Clean separation of concerns — sequence owns ordering, trigger is automatic
- Works transparently through the `convert_request_to_job` RPC without any RPC changes needed
- Backfill is safe and explicit
- Rollback is additive-only (drop columns, sequences, triggers)
- Nullable during the migration window — no NOT NULL constraint until after backfill

**Cons:** Two extra DB objects per table (sequence + trigger function).

**Recommended.** See Section 4 for full SQL.

### Option C — App-layer assignment in every INSERT path

Assign the number in TypeScript before inserting, using a `SELECT nextval(...)` call.

**Cons:** Every insert path must be updated individually. Race condition risk if two inserts run concurrently. Breaks the RPC unless it is also updated. Not safe.

**Not recommended.**

---

## 3. Chosen Design

**Sequence + BEFORE INSERT trigger per table.**

### Column spec

| Table | Column | Type | Nullable | Unique | Default |
|---|---|---|---|---|---|
| `jobs` | `job_number` | `integer` | YES (initially) | YES | set by trigger |
| `service_requests` | `request_number` | `integer` | YES (initially) | YES | set by trigger |

**Why `integer` not `text`?**
- Storage is cheaper
- Sorting and range queries work correctly
- Format (`JOB-0001`) is applied at the app layer via a shared helper, keeping the DB agnostic to prefix changes
- Postgres `integer` holds up to 2,147,483,647 — no realistic overflow risk

**Format helper (app layer):**
```ts
export function fmtJobNumber(n: number | null): string {
  return n != null ? `JOB-${String(n).padStart(4, "0")}` : "—";
}

export function fmtReqNumber(n: number | null): string {
  return n != null ? `REQ-${String(n).padStart(4, "0")}` : "—";
}
```

Place in `src/lib/utils.ts` alongside the existing `cn` helper.

---

## 4. Migration SQL (Phase 10A-B)

Create via `supabase migration new job_request_numbers`.

```sql
-- ============================================================
-- Phase 10A-B: Human-readable job and request numbers.
--
-- Adds integer job_number and request_number columns,
-- backfills existing rows in created_at order,
-- then installs BEFORE INSERT triggers so all new rows
-- receive numbers automatically including via RPC.
-- ============================================================

-- ── 1. Add nullable columns ─────────────────────────────────

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS job_number integer;

ALTER TABLE service_requests
  ADD COLUMN IF NOT EXISTS request_number integer;

-- ── 2. Create sequences ──────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS job_number_seq     START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS request_number_seq START WITH 1 INCREMENT BY 1;

-- ── 3. Backfill existing rows in created_at order ────────────

WITH ordered AS (
  SELECT id,
         ROW_NUMBER() OVER (ORDER BY created_at) AS rn
  FROM   jobs
  WHERE  job_number IS NULL
)
UPDATE jobs
SET    job_number = ordered.rn
FROM   ordered
WHERE  jobs.id = ordered.id;

WITH ordered AS (
  SELECT id,
         ROW_NUMBER() OVER (ORDER BY created_at) AS rn
  FROM   service_requests
  WHERE  request_number IS NULL
)
UPDATE service_requests
SET    request_number = ordered.rn
FROM   ordered
WHERE  service_requests.id = ordered.id;

-- ── 4. Advance sequences past backfilled values ──────────────

SELECT setval('job_number_seq',
  COALESCE((SELECT MAX(job_number) FROM jobs), 0) + 1,
  false   -- next call returns this value
);

SELECT setval('request_number_seq',
  COALESCE((SELECT MAX(request_number) FROM service_requests), 0) + 1,
  false
);

-- ── 5. Unique constraints ────────────────────────────────────

ALTER TABLE jobs
  ADD CONSTRAINT jobs_job_number_unique UNIQUE (job_number);

ALTER TABLE service_requests
  ADD CONSTRAINT service_requests_request_number_unique UNIQUE (request_number);

-- ── 6. Trigger functions ─────────────────────────────────────

CREATE OR REPLACE FUNCTION set_job_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.job_number IS NULL THEN
    NEW.job_number := nextval('job_number_seq');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION set_request_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.request_number IS NULL THEN
    NEW.request_number := nextval('request_number_seq');
  END IF;
  RETURN NEW;
END;
$$;

-- ── 7. Attach triggers ───────────────────────────────────────

CREATE TRIGGER trg_jobs_set_number
  BEFORE INSERT ON jobs
  FOR EACH ROW EXECUTE FUNCTION set_job_number();

CREATE TRIGGER trg_requests_set_number
  BEFORE INSERT ON service_requests
  FOR EACH ROW EXECUTE FUNCTION set_request_number();
```

### Why `setval(..., false)`?

With `is_called = false`, `nextval()` returns `start_value` on the next call without incrementing first. This ensures the first new job after backfill of 14 rows gets `job_number = 15`, not `16`.

### convert_request_to_job RPC — no changes needed

The trigger fires `BEFORE INSERT` on the `jobs` table. The RPC does not include `job_number` in its INSERT column list, so `NEW.job_number` is `NULL` at trigger time, and the trigger assigns the next sequence value. No RPC changes required.

---

## 5. RLS Impact

**No new policies required.** The new integer columns are non-sensitive display values on rows already governed by existing policies:

- `jobs_select` — already restricts which `jobs` rows each role can see; `job_number` is just another column on the allowed rows
- `service_requests_select` — same
- `jobs_update` — the trigger fires on INSERT only; UPDATE to `job_number` is not expected and is covered by the existing admin-only UPDATE policy
- No role needs to write `job_number` or `request_number` directly — sequences handle it

**One minor consideration:** `service_requests.ts` uses `.select("*")`, which automatically includes `request_number` after the migration. No query change needed for the select. All other data files use explicit column lists and will need `job_number` / `request_number` added (see Section 6).

---

## 6. Files Requiring Changes (Phase 10A-C)

### 6.1 New utility helpers

| File | Change |
|---|---|
| `src/lib/utils.ts` | Add `fmtJobNumber(n)` and `fmtReqNumber(n)` helpers |

### 6.2 Data layer — add columns to SELECT and TypeScript types

| File | Column to add | Notes |
|---|---|---|
| `src/lib/data/jobs.ts` | `job_number` | Two `.select()` calls at lines ~69 and ~125; add `jobNumber: number \| null` to return types |
| `src/lib/data/service-requests.ts` | `request_number` | Already uses `select("*")` — only TypeScript return type needs `requestNumber` field |
| `src/lib/data/tech-jobs.ts` | `job_number` | One `.select()` call at line ~69; add to type |
| `src/lib/data/client-portal.ts` | `job_number` | One `.select()` call at line ~92; add to `ClientJobItem` type |
| `src/lib/data/dashboard.ts` | `job_number`, `request_number` | Lines ~96 (jobs) and ~99 (requests); add to respective types |

### 6.3 Admin portal UI

| File | Change |
|---|---|
| `src/components/jobs/JobBoard.tsx` | Display `fmtJobNumber(job.jobNumber)` in job cards |
| `src/components/jobs/JobDetail.tsx` line ~230 | Replace `request.requestId.split("-").pop()` with `fmtReqNumber(request.requestNumber)` |
| `src/app/(dashboard)/requests/RequestsTable.tsx` line 68 | Replace `req.id.split("-").pop()` with `fmtReqNumber(req.requestNumber)` |
| `src/app/(dashboard)/requests/[id]/page.tsx` line 47 | Replace `request.id.split("-").pop()` in TopBar title with `fmtReqNumber(raw.requestNumber)` |
| `src/app/(dashboard)/requests/[id]/convert/page.tsx` | Show `fmtJobNumber(jobNumber)` in "Already converted" panel |
| `src/components/requests/ConvertJobForm.tsx` line ~110 | Show `fmtJobNumber(jobNumber)` on success screen; update RPC return or fetch `job_number` post-create |
| `src/components/requests/NewRequestForm.tsx` line ~118 | Show `fmtReqNumber(requestNumber)` on success screen; fetch `request_number` from INSERT RETURNING |
| `src/app/(dashboard)/dashboard/DashboardView.tsx` | Show `fmtJobNumber` and `fmtReqNumber` in job/request list rows |

### 6.4 Technician portal UI

| File | Change |
|---|---|
| `src/app/(technician)/technician/TechnicianDashboardView.tsx` | Show `fmtJobNumber(job.jobNumber)` in active/upcoming job cards |
| `src/app/(technician)/technician/jobs/page.tsx` | Show `fmtJobNumber(job.jobNumber)` in job list |
| `src/components/technician/TechJobDetail.tsx` | Show `fmtJobNumber(job.jobNumber)` in job detail header |

### 6.5 Client portal UI

| File | Change |
|---|---|
| `src/app/(client)/client/jobs/page.tsx` line 26 | Replace full UUID display with `fmtJobNumber(job.jobNumber)` |
| `src/app/(client)/client/requests/new/page.tsx` line ~111 | Show `fmtReqNumber(requestNumber)` on success screen; fetch `request_number` from INSERT RETURNING |

### 6.6 ConvertJobForm success screen — special case

After conversion, `supabase.rpc("convert_request_to_job")` returns a `uuid` (the new job's id), not the `job_number`. Two options:

**Option A (recommended):** After the RPC call, do a single `.select("job_number").eq("id", jobId).single()` to fetch the number. One extra read on a rare action.

**Option B:** Modify the RPC to also return `job_number`. Requires changing the RPC signature (returns `uuid` today → would need to return a composite type). More invasive.

Use Option A.

---

## 7. Backfill Result Preview

Based on seeded `created_at` values (all seed rows have explicit timestamps):

**jobs (14 rows, created_at order → job_number 1–14)**

| job_number | Seed ID suffix |
|---|---|
| 1 | earliest created_at |
| … | … |
| 14 | most recent created_at |

**service_requests (8 rows → request_number 1–8)**

Sequences start at 15 and 9 respectively for new rows post-migration.

---

## 8. Rollback Plan

All changes are additive. Rollback at any point before Phase 10A-C UI is merged:

```sql
-- Drop triggers
DROP TRIGGER IF EXISTS trg_jobs_set_number ON jobs;
DROP TRIGGER IF EXISTS trg_requests_set_number ON service_requests;

-- Drop trigger functions
DROP FUNCTION IF EXISTS set_job_number();
DROP FUNCTION IF EXISTS set_request_number();

-- Drop sequences
DROP SEQUENCE IF EXISTS job_number_seq;
DROP SEQUENCE IF EXISTS request_number_seq;

-- Drop constraints
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_job_number_unique;
ALTER TABLE service_requests DROP CONSTRAINT IF EXISTS service_requests_request_number_unique;

-- Drop columns
ALTER TABLE jobs DROP COLUMN IF EXISTS job_number;
ALTER TABLE service_requests DROP COLUMN IF EXISTS request_number;
```

Because columns are nullable and display-only, a partial rollback (remove UI changes, keep DB columns) is also safe — the columns are simply ignored.

---

## 9. Testing Checklist (Phase 10A-D)

### Database

- [ ] `job_number` column exists on `jobs`, type `integer`, nullable
- [ ] `request_number` column exists on `service_requests`, type `integer`, nullable
- [ ] All 14 existing jobs have `job_number` 1–14 (no nulls, no gaps, no duplicates)
- [ ] All 8 existing service_requests have `request_number` 1–8 (same)
- [ ] `UNIQUE` constraint on `jobs.job_number`
- [ ] `UNIQUE` constraint on `service_requests.request_number`
- [ ] `job_number_seq` current value = 15
- [ ] `request_number_seq` current value = 9
- [ ] New job INSERT (direct) assigns next `job_number` = 15
- [ ] New request INSERT assigns next `request_number` = 9
- [ ] `convert_request_to_job` RPC assigns `job_number` automatically (no RPC code change)
- [ ] Two concurrent INSERTs get distinct `job_number` values (sequence is atomic)

### Admin portal

- [ ] Job board: each card shows `JOB-NNNN`
- [ ] Job detail page header: shows `JOB-NNNN`
- [ ] Job detail page — linked request: shows `REQ-NNNN` (not UUID slice)
- [ ] Requests table: each row shows `REQ-NNNN`
- [ ] Request detail TopBar: shows `Request REQ-NNNN`
- [ ] Convert form success screen: shows `JOB-NNNN`
- [ ] New request success screen: shows `REQ-NNNN`
- [ ] Dashboard recent jobs: shows `JOB-NNNN`
- [ ] Dashboard pending requests: shows `REQ-NNNN`
- [ ] "Already converted" panel on convert page: shows `JOB-NNNN`

### Technician portal

- [ ] Technician dashboard active job: shows `JOB-NNNN`
- [ ] Tech job list: each row shows `JOB-NNNN`
- [ ] Tech job detail header: shows `JOB-NNNN`

### Client portal

- [ ] Client jobs list: each card shows `JOB-NNNN` (not UUID)
- [ ] New request success screen: shows `REQ-NNNN`

### Routes

- [ ] `/jobs/[uuid]` still loads correctly (UUID routing unchanged)
- [ ] `/requests/[uuid]` still loads correctly (UUID routing unchanged)
- [ ] No route uses `job_number` or `request_number` as path segment

### Build & lint

- [ ] `npm run build` — 0 TypeScript errors
- [ ] `npm run lint` — 0 ESLint errors

---

## 10. Implementation Phases

| Sub-phase | Work | Files |
|---|---|---|
| **10A-A** | This plan | `docs/` |
| **10A-B** | Migration: sequences, columns, backfill, triggers | `supabase/migrations/` |
| **10A-C** | App changes: utils helpers, data layer types, UI display | `src/lib/`, `src/app/`, `src/components/` |
| **10A-D** | Verification: DB checks + full testing checklist | — |

---

## 11. Out of Scope for This Phase

- Stripe, Resend, photo uploads, field notes, client job detail — not touched
- Searching/filtering by `job_number` or `request_number` — display-only for now
- Per-organization number resets (e.g., `ORG1-JOB-0001`) — global sequences are sufficient
- Exposing `job_number` in the convert RPC return type — handled by post-RPC fetch (Section 6.6)

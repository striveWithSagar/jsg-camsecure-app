# Phase 10A-B: Human-Readable Job & Request Numbers — Migration Report

**Date:** 2026-05-27
**Status:** Complete — all verifications passed

---

## Migration File

`app/supabase/migrations/20260527033247_job_request_numbers.sql`

Applied to Supabase project `gbvstrhorjjvlxnfmxcz`.

---

## What Was Applied

| Step | Description |
|---|---|
| 1 | `jobs.job_number integer` — nullable column added |
| 2 | `service_requests.request_number integer` — nullable column added |
| 3 | `CREATE SEQUENCE job_number_seq` and `request_number_seq` |
| 4 | Backfill: `ROW_NUMBER() OVER (ORDER BY created_at, id)` applied to all existing rows |
| 5 | `setval()` advanced sequences past backfill max |
| 6 | `assign_job_number()` and `assign_request_number()` trigger functions (SECURITY INVOKER) |
| 7 | `trg_assign_job_number` and `trg_assign_request_number` — BEFORE INSERT triggers |
| 8 | `UNIQUE INDEX` on `jobs.job_number` and `service_requests.request_number` |
| 9 | `NOT NULL` constraints (safe after full backfill) |

---

## Verification Results

### V1 — Column types and NOT NULL

| Table | Column | Type | Not Null |
|---|---|---|---|
| `jobs` | `job_number` | `integer` | ✓ |
| `service_requests` | `request_number` | `integer` | ✓ |

**PASS**

---

### V2 — Job backfill

- Row count: 14
- Range: 1–14 (no gaps)
- Nulls: 0
- Distinct values: 14

**PASS**

---

### V3 — Request backfill

- Row count: 8
- Range: 1–8 (no gaps)
- Nulls: 0
- Distinct values: 8

**PASS**

---

### V4 — Sequence positions after backfill

| Sequence | Next value |
|---|---|
| `job_number_seq` | 15 |
| `request_number_seq` | 9 |

Confirmed via `nextval()` (restored to 15/9 after peek).

**PASS**

---

### V5 — Trigger on direct job INSERT (rolled back)

Inserted a test job with no `job_number` in the column list inside a rolled-back subtransaction.

- Returned `job_number = 15` ✓
- Subtransaction rolled back; row not persisted

**PASS**

---

### V6 — Trigger on direct request INSERT (rolled back)

Inserted a test service request with no `request_number` in the column list.

- Returned `request_number = 9` ✓
- Subtransaction rolled back; row not persisted

**PASS**

---

### V7 — Job display format

All 14 jobs have contiguous `job_number` values 1–14 in `created_at` order, displaying as `JOB-0001` through `JOB-0014` at the app layer via `fmtJobNumber()`.

**PASS**

---

### V8 — Request display format

All 8 service requests have contiguous `request_number` values 1–8 in `created_at` order, displaying as `REQ-0001` through `REQ-0008` at the app layer via `fmtReqNumber()`.

**PASS**

---

### V9 — Unique indexes

| Index | Table | Column |
|---|---|---|
| `idx_jobs_job_number` | `jobs` | `job_number` |
| `idx_service_requests_request_number` | `service_requests` | `request_number` |

Both confirmed in `pg_indexes`.

**PASS**

---

### V10 — Triggers

| Trigger | Timing | Event | Table |
|---|---|---|---|
| `trg_assign_job_number` | BEFORE | INSERT | `jobs` |
| `trg_assign_request_number` | BEFORE | INSERT | `service_requests` |

Both confirmed in `pg_trigger`.

**PASS**

---

### V11 — RPC test target

Identified `service_requests` row `a0000000-0000-0000-0000-000000000401` (Apex Tower Management, `status='new'`, `request_number=5`) as the RPC test target.

**PASS**

---

### V12 — `convert_request_to_job` RPC trigger integration

Called `convert_request_to_job(...)` via a CTE using JWT simulation (`set_config('request.jwt.claim.sub', ...)`) against the V11 test target.

**Result:**

| Field | Value |
|---|---|
| `job_id` | `8bb2f8f3-eeab-4fb4-913d-2ca02816548a` |
| `job_number` | `16` (auto-assigned by trigger) |
| `request_id` | `a0000000-0000-0000-0000-000000000401` |
| Service request `status` after | `converted` |

- `job_number` was auto-assigned by the trigger; the RPC INSERT does not specify `job_number`
- No RPC code changes were required

Test job and service_request state cleaned up after verification. Sequences restored to 15(false) and 9(false).

**PASS**

---

## Database State After Phase 10A-B

| Item | State |
|---|---|
| `jobs` rows | 14 (seed data; job_number 1–14) |
| `service_requests` rows | 8 (seed data; request_number 1–8) |
| `job_number_seq` next value | 15 |
| `request_number_seq` next value | 9 |
| All new job INSERTs | auto-numbered via trigger |
| All new request INSERTs | auto-numbered via trigger |
| `convert_request_to_job` RPC | works without modification |
| RLS policies | unchanged |

---

## What Was Not Changed

- `convert_request_to_job` RPC — no changes
- RLS policies — no changes
- Existing UUID primary keys — no changes
- App source files — no changes (Phase 10A-C)

---

## Next Phase

**Phase 10A-C:** App and data-layer changes — add `fmtJobNumber`/`fmtReqNumber` helpers to `src/lib/utils.ts`, update 5 data-layer files, update 14 UI components across all three portals.

See [SUPABASE_PHASE_10A_A_JOB_REQUEST_NUMBERS_PLAN.md](SUPABASE_PHASE_10A_A_JOB_REQUEST_NUMBERS_PLAN.md) sections 6.1–6.6 for the full file list.

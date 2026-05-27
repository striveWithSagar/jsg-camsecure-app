# Supabase Phase 3A — Apply Report

> Status: APPLIED AND VERIFIED
> Applied: 2026-05-23
> Project: JSG_CamSercure (ref: gbvstrhorjjvlxnfmxcz)
> Migration file: `app/supabase/migrations/20260523130000_seed_demo_data.sql`

---

## Apply Result

| Step | Result |
|---|---|
| Pre-flight check | ✓ All tables at 0 rows, base schema confirmed present |
| `apply_migration` call | ✓ `{"success":true}` |
| Post-apply verification | ✓ All counts and relationships verified |

---

## Migration History (confirmed)

| Version | Name |
|---|---|
| 20260524001041 | create_base_schema |
| 20260524003809 | seed_demo_data |

---

## Final Row Counts

| Table | Expected | Actual | Match |
|---|---|---|---|
| `organizations` | 1 | 1 | ✓ |
| `company_settings` | 1 | 1 | ✓ |
| `profiles` | 6 | 6 | ✓ |
| `clients` | 7 | 7 | ✓ |
| `client_contacts` | 7 | 7 | ✓ |
| `technicians` | 5 | 5 | ✓ |
| `service_requests` | 5 | 5 | ✓ |
| `jobs` | 13 | 13 | ✓ |
| `job_status_history` | 13 (trigger) | 13 | ✓ |
| `invoices` | 7 | 7 | ✓ |
| `invoice_items` | 7 | 7 | ✓ |
| `job_notes` | 0 | 0 | ✓ |
| `job_photos` | 0 | 0 | ✓ |

**Total rows in database: 72** (59 explicit + 13 trigger-generated)

---

## Relationship Verification

### Jobs
| Check | Result |
|---|---|
| All 13 jobs have correct `organization_id` | ✓ 13/13 |
| All 13 jobs link to a valid `client_id` | ✓ 13/13 |
| All 13 jobs link to a valid `technician_id` | ✓ 13/13 |
| Completed jobs have `completed_at` set | ✓ 3 completed, 3 with `completed_at` |

### Invoices
| Check | Result |
|---|---|
| All 7 invoices: `client_id` matches their job's `client_id` | ✓ 7/7 |
| All 7 invoices link to a valid `job_id` | ✓ 7/7 |
| All 7 invoices have `tax_rate = 0` | ✓ 7/7 |
| All 7 invoices: `total = subtotal` (zero tax) | ✓ 7/7 |
| Paid invoices have `paid_at` set | ✓ 3 paid, 3 with `paid_at` |
| Grand total across all invoice items | $14,780.00 |

### Invoice Items
| Check | Result |
|---|---|
| All 7 items: generated `total = unit_price` (qty 1) | ✓ 7/7 |
| `total` column was NOT manually inserted | ✓ (GENERATED ALWAYS AS computed correctly) |

### Service Requests
| Check | Result |
|---|---|
| All 5 requests: `client_id = NULL` (anonymous) | ✓ 5/5 |
| All 5 requests: `client_name` text populated | ✓ 5/5 |
| Converted requests | ✓ 1 (REQ-004, status = 'converted') |
| REQ-004 → JOB-005 `converted_to_job_id` set | ✓ 1/1 |

### Job Status History (trigger-generated)
| Check | Result |
|---|---|
| Total rows | ✓ 13 |
| All rows have `old_status = NULL` (initial status on INSERT) | ✓ 13/13 |
| All rows have `changed_by_profile_id = NULL` (migration context) | ✓ 13/13 |
| All 13 jobs covered (distinct job_id count) | ✓ 13/13 |

### Profiles
| Check | Result |
|---|---|
| admin role | 1 row |
| technician role | 5 rows |
| No auth.users FK violation | ✓ (no FK constraint exists — placeholder UUIDs safe) |

### Client Contacts
| Check | Result |
|---|---|
| All 7 contacts have `profile_id = NULL` | ✓ 7/7 |
| All 7 contacts have `is_primary = true` | ✓ 7/7 |

---

## RLS / Policy Verification

| Check | Expected | Actual |
|---|---|---|
| Tables with RLS enabled | 13 | 13 ✓ |
| Total public tables | 13 | 13 ✓ |
| RLS policies | 43 | 43 ✓ |
| Schema changes from seed | None | None ✓ |
| auth.users rows created | 0 | 0 ✓ |

---

## Warnings

None. Migration applied cleanly with no errors, constraint violations, or unexpected row counts.

---

## Files Changed This Phase

| File | Change |
|---|---|
| `app/supabase/migrations/20260523130000_seed_demo_data.sql` | Applied to Supabase (no local edit) |
| `app/docs/SUPABASE_PHASE_3A_APPLY_REPORT.md` | Created (this file) |

No `src/` files were modified. No mock store touched. No UI changed.

---

## Recommended Next Step

**Phase 4 — Add Supabase Read-Only Queries for Service Requests**

The database now has real data that matches the mock store. Phase 4 replaces the `/requests` page's `useMockStore().requests` read with a server-side Supabase query, while leaving all writes and other pages on the mock store.

Files that will change in Phase 4:
- `src/app/(dashboard)/requests/page.tsx` — replace mock read with Supabase query
- `src/lib/supabase/queries/requests.ts` — new typed query file
- `src/lib/types/request.ts` — new DB row types

The mock store remains active for all other pages and all writes.

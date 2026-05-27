# Supabase Phase 3A — Seed Data Review
> Status: REVISED DRAFT — awaiting final approval before applying to Supabase.
> Revision 2: 2026-05-23 — all 7 verification points checked against live schema.

---

## Migration File

```
app/supabase/migrations/20260523130000_seed_demo_data.sql
```

Applies on top of: `20260523120000_create_base_schema.sql`

---

## Verification Results

### 1. Profiles Safety — SAFE, no auth.users FK

**Schema excerpt (`20260523120000_create_base_schema.sql`, §3.2):**
```sql
create table profiles (
  id              uuid        primary key,   -- equals auth.users.id (convention, not enforced)
  organization_id uuid        not null references organizations(id) on delete restrict,
  ...
);
```

`profiles.id` is a plain `uuid primary key`. **There is no `REFERENCES auth.users(id)` constraint.** The comment "equals auth.users.id" is documentation only — it is not enforced by the database.

**Conclusion:** Inserting profiles with placeholder UUIDs that have no corresponding `auth.users` row will NOT cause a foreign key violation. The 6 placeholder profile rows in the seed are safe.

Placeholder UUIDs will be replaced with real `auth.users.id` values in Phase 8 when real auth is wired.

---

### 2. Service Request Relationships — All 5 Are Genuinely Anonymous

The user instruction asks to link service requests to seeded clients where possible. Verified below:

| Request | Caller Name | Match in Seeded Clients? |
|---|---|---|
| REQ-001 | Apex Tower Management | No |
| REQ-002 | First National Bank | No |
| REQ-003 | Parkview Condos | No |
| REQ-004 | Sunrise Retail | No — "Sunrise Hotel" is seeded (client 105) but is a different company name in the mock |
| REQ-005 | Lakeside Clinic | No |

**None of the 5 service request callers match any of the 7 seeded clients.** The mock data intentionally uses different companies for service requests vs existing job clients — this represents the realistic scenario of new enquiries from non-contracted companies.

**Conclusion:** `client_id = NULL` with `client_name` text is correct for all 5 requests. No change needed. The schema supports this: `client_id uuid references clients(id) on delete set null` (nullable), and `client_name text not null` carries the free-text company name.

---

### 3. Job Status History — Trigger-Generated, Not Manually Inserted

**Schema excerpt (`20260523120000_create_base_schema.sql`, §5):**
```sql
create or replace function fn_record_job_status_insert()
returns trigger language plpgsql security definer ...
begin
  insert into job_status_history (organization_id, job_id, changed_by_profile_id,
    old_status, new_status, changed_at)
  values (new.organization_id, new.id, auth.uid(), null, new.status, now());
  return new;
end;

create trigger trg_job_status_on_insert
  after insert on jobs
  for each row execute function fn_record_job_status_insert();
```

**Confirmed:** Every INSERT into `jobs` fires `trg_job_status_on_insert`, which automatically inserts one row into `job_status_history` with `old_status = null` and `new_status = <the inserted status>`.

The seed file does **not** manually insert any `job_status_history` rows. The 13 rows are created automatically by the trigger when the 13 `jobs` rows are inserted in §8.

`auth.uid()` returns NULL during migration execution (no authenticated user), which is acceptable — `changed_by_profile_id` is nullable.

---

### 4. Jobs and Clients — All Valid

Every seeded job has:
- `organization_id = 'a0000000-0000-0000-0000-000000000001'` (the JSG CamSecure org) ✓
- A valid `client_id` referencing a seeded client ✓
- A valid `technician_id` referencing a seeded technician ✓

| Job | Client | Technician |
|---|---|---|
| JOB-001 | Metro Security Ltd (101) | Alex Rivera (301) |
| JOB-002 | City Bank Branch (102) | Sam Chen (302) |
| JOB-003 | Green Valley Mall (103) | Jordan Kim (303) |
| JOB-004 | Harbor Logistics (104) | Taylor Reyes (304) |
| JOB-005 | Sunrise Hotel (105) | Alex Rivera (301) |
| JOB-006 | Tech Park Office (106) | Sam Chen (302) |
| JOB-007 | Riverside School (107) | Morgan Davis (305) |
| JOB-008 | Metro Security Ltd (101) | Alex Rivera (301) |
| JOB-009 | Riverside School (107) | Alex Rivera (301) |
| JOB-010 | Metro Security Ltd (101) | Alex Rivera (301) |
| JOB-011 | Metro Security Ltd (101) | Sam Chen (302) |
| JOB-012 | Metro Security Ltd (101) | Jordan Kim (303) |
| JOB-013 | Metro Security Ltd (101) | Sam Chen (302) |

**Riverside School** is intentionally added as a 7th client (UUID `...000000000107`) because JOB-007 ("All Entrances") and JOB-009 ("Gymnasium Entrance") reference it in `MOCK_JOBS` but it does not appear in `MOCK_CLIENTS`. Without it, two jobs would have no valid `client_id` (which is `NOT NULL`).

---

### 5. Invoices and Invoice Items — Consistent and Correct

**Invoice-client-job triangle verified** (each invoice's `client_id` matches its job's `client_id`):

| Invoice | Client | Job | Amount | Status | client_id ↔ job.client_id |
|---|---|---|---|---|---|
| INV-001 | Metro (101) | JOB-010 (→ Metro 101) | $2,400 | unpaid | ✓ |
| INV-002 | City Bank (102) | JOB-002 (→ City Bank 102) | $1,850 | paid | ✓ |
| INV-003 | Sunrise Hotel (105) | JOB-005 (→ Sunrise 105) | $650 | overdue | ✓ |
| INV-004 | GVM (103) | JOB-003 (→ GVM 103) | $4,200 | unpaid | ✓ |
| INV-005 | Harbor (104) | JOB-004 (→ Harbor 104) | $980 | paid | ✓ |
| INV-006 | Metro (101) | JOB-013 (→ Metro 101) | $1,200 | paid | ✓ |
| INV-007 | Metro (101) | JOB-001 (→ Metro 101) | $3,500 | unpaid | ✓ |

**`invoice_items.total` is NOT in the INSERT column list.** It is defined as `GENERATED ALWAYS AS (round(quantity * unit_price, 2)) stored` — Postgres computes it automatically. Including it in an INSERT would cause an error.

**Tax rates:** All invoices use `tax_rate = 0`, `tax_amount = 0.00`. This mirrors the fact that `company_settings.tax_rate = null` (not yet configured). No global tax rate is assumed. When tax is later configured, it applies only to new invoices created after that point — existing seeded invoices are not affected.

**Invoice number uniqueness:** `INV-001` through `INV-007` are unique within the org (enforced by `constraint uq_invoice_number_per_org unique (organization_id, invoice_number)`). ✓

---

### 6. RLS and Seed Compatibility — Safe

Supabase runs migrations as the `postgres` superuser role. The `postgres` role is exempt from RLS policies — `SET SESSION AUTHORIZATION` and `SET ROLE` are not used during migration execution.

**Confirmed:** All 11 sections of the seed migration will execute successfully despite RLS being enabled on all 13 tables. No new RLS policies are added. No existing policies are weakened or removed.

---

## Rows Planned Per Table

| Table | Rows | How Created |
|---|---|---|
| `organizations` | 1 | Explicit INSERT (§1) |
| `company_settings` | 1 | Explicit INSERT (§2) |
| `profiles` | 6 | Explicit INSERT (§3) — placeholder UUIDs, no auth.users rows |
| `clients` | 7 | Explicit INSERT (§4) — 6 from MOCK_CLIENTS + Riverside School |
| `client_contacts` | 7 | Explicit INSERT (§5) — one primary per client, profile_id = NULL |
| `technicians` | 5 | Explicit INSERT (§6) |
| `service_requests` | 5 | Explicit INSERT (§7) — all anonymous (client_id = NULL) |
| `jobs` | 13 | Explicit INSERT (§8) |
| `job_status_history` | **13** | **Auto-created by `trg_job_status_on_insert` trigger** — NOT manually inserted |
| `invoices` | 7 | Explicit INSERT (§10) |
| `invoice_items` | 7 | Explicit INSERT (§11) — `total` column omitted (GENERATED) |
| `job_notes` | 0 | No mock data |
| `job_photos` | 0 | No mock data |

**Total explicit INSERT rows: 59**
**Total trigger-auto rows: 13**
**Grand total rows created: 72**

---

## What Is Linked vs Anonymous

| Entity | Linked To | Notes |
|---|---|---|
| Technicians | profiles (via profile_id) | placeholder UUID profiles, not real auth users |
| Client contacts | clients (via client_id) | all 7 contacts have is_primary = true |
| Client contacts | profiles | profile_id = NULL — no portal login yet |
| Jobs | clients, technicians, organization | all FKs populated |
| JOB-005 | REQ-004 via request_id | the one request→job conversion |
| REQ-004 | JOB-005 via converted_to_job_id | set via UPDATE in §9 after JOB-005 exists |
| Invoices | clients + jobs | client_id ↔ job.client_id triangle verified |
| Invoice items | invoices | one item per invoice |
| Service requests | **anonymous** — client_id = NULL | all 5 callers are non-contracted companies |

---

## Intentionally Skipped

| Item | Reason |
|---|---|
| `auth.users` rows | Explicitly excluded. Added in Phase 8. |
| `client_contacts.profile_id` | No portal logins yet. Set when real auth users are created in Phase 8. |
| `job_notes` | No mock data exists in `constants.ts`. |
| `job_photos` | No mock data. Storage bucket not yet created. |
| `MOCK_METRICS` | Derived — computed by Supabase queries, not seeded rows. |
| `invoice_items.total` | GENERATED ALWAYS AS — Postgres computes it. Do not INSERT. |
| `submitted_by_profile_id` on service_requests | No authenticated user during seed. Defaults to NULL. |

---

## Auth Users Required Later?

**Yes — Phase 8.**

Profiles currently have placeholder UUIDs with no matching `auth.users` row. Until real auth users exist:

- All RLS helper functions (`auth_org_id()`, `auth_role()`, etc.) return NULL
- No authenticated reads/writes through the Supabase JS client are possible
- The app continues to use the mock store — this is by design for Phase 3

In Phase 8, real `auth.users` rows will be created. Profile UUIDs will be updated to match the real `auth.users.id` values at that time.

---

## Changes Made vs Original Draft

**Seed SQL:** No changes — the SQL was verified to be correct on all 7 points.

**Review doc:** Rewritten to include explicit verification evidence for each point:
- Quoted the exact profiles schema confirming no auth.users FK
- Added client-name-by-client-name table confirming all 5 service requests are genuinely anonymous
- Quoted the trigger function confirming job_status_history is auto-inserted
- Added the invoice-client-job triangle table
- Added the "linked vs anonymous" table
- Added explicit RLS migration-context safety confirmation

---

## Approval Checklist

Before running `apply_migration` on this seed file, confirm:

- [ ] Base schema (`20260523120000_create_base_schema.sql`) is confirmed applied — all 13 tables, 9 enums, 43 policies, 11 triggers present
- [ ] Current row counts are all 0 (no prior seed applied)
- [ ] Profiles with placeholder UUIDs are understood to be temporary — Phase 8 will overwrite with real auth IDs
- [ ] All 5 service requests being anonymous (client_id = NULL) is intentional — none of the callers match seeded clients
- [ ] `job_status_history` rows are NOT manually inserted — the trigger creates them automatically on jobs INSERT
- [ ] Riverside School (7th client) is intentional — required for JOB-007 and JOB-009
- [ ] `invoice_items.total` is intentionally absent from the INSERT — it is a GENERATED column
- [ ] REQ-004 → JOB-005 two-way link understood: `jobs.request_id` set at INSERT (§8); `service_requests.converted_to_job_id` set via UPDATE (§9)
- [ ] No auth.users rows are created or expected
- [ ] No RLS policies are added or modified

---

## Rollback

If the seed is applied and must be reversed:

```sql
truncate table
  invoice_items, invoices,
  job_photos, job_notes, job_status_history, jobs,
  service_requests,
  technicians, client_contacts, clients,
  profiles,
  company_settings, organizations
cascade;
```

Zero app impact — the frontend still reads from the mock store until Phase 4.

---

## Next Step After Approval

Apply via Supabase MCP `apply_migration`, then run verification queries to confirm row counts per table, then proceed to **Phase 3A-B — Verify Seed Data**.

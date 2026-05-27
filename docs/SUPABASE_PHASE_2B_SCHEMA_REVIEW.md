# Supabase Phase 2B — Schema Review
> Status: REVISED DRAFT — awaiting final approval before applying to Supabase.
> Revision 2 applied 2026-05-23 based on decisions from Phase 2B-A review.

---

## Migration File

```
app/supabase/migrations/20260523120000_create_base_schema.sql
```

---

## Tables Created (13)

| # | Table | Purpose | organization_id |
|---|---|---|---|
| 1 | `organizations` | Top-level tenant | — (is the tenant) |
| 2 | `profiles` | One per auth user; carries role | ✓ |
| 3 | `clients` | Client companies | ✓ |
| 4 | `client_contacts` | People at client companies | ✓ |
| 5 | `technicians` | JSG field staff | ✓ |
| 6 | `service_requests` | Inbound service requests | ✓ |
| 7 | `jobs` | Work orders | ✓ |
| 8 | `job_status_history` | Immutable status audit log | ✓ |
| 9 | `job_notes` | Freeform notes on jobs/requests | ✓ |
| 10 | `job_photos` | Storage metadata for site photos | ✓ |
| 11 | `invoices` | Billing records | ✓ |
| 12 | `invoice_items` | Invoice line items | ✓ |
| 13 | `company_settings` | Per-org config and branding | ✓ |

---

## Enums Created (9)

| Enum | Values |
|---|---|
| `user_role` | owner, admin, dispatcher, technician, client |
| `job_status` | assigned, on_the_way, started, in_progress, needs_parts, completed, rescheduled, cancelled |
| `job_priority` | emergency, high, medium, low |
| `request_status` | new, reviewing, ready_to_schedule, converted, cancelled |
| `urgency_level` | emergency, high, medium, low |
| `service_type` | new_installation, maintenance, dvr_nvr_issue, camera_outage, mobile_app_issue, wiring_issue, emergency_service, quote_request, site_inspection, other |
| `invoice_status` | draft, unpaid, paid, overdue, cancelled |
| `technician_status` | available, on_job, on_the_way, off_duty |
| `client_status` | active, inactive |

---

## Indexes Created (30)

| Index | Table | Columns |
|---|---|---|
| `idx_profiles_organization_id` | profiles | organization_id |
| `idx_profiles_email` | profiles | email |
| `idx_profiles_org_role` | profiles | organization_id, role |
| `idx_clients_org_status` | clients | organization_id, status |
| `idx_clients_org_name` | clients | organization_id, name |
| `idx_client_contacts_client_id` | client_contacts | client_id |
| `idx_client_contacts_org_client` | client_contacts | organization_id, client_id |
| `idx_client_contacts_profile_id` | client_contacts | profile_id (partial, where not null) |
| `idx_technicians_org` | technicians | organization_id |
| `idx_technicians_profile_id` | technicians | profile_id |
| `idx_technicians_org_status` | technicians | organization_id, status |
| `idx_service_requests_org_status` | service_requests | organization_id, status |
| `idx_service_requests_org_created` | service_requests | organization_id, created_at desc |
| `idx_service_requests_client_id` | service_requests | client_id (partial, where not null) |
| `idx_jobs_org_status` | jobs | organization_id, status |
| `idx_jobs_org_technician` | jobs | organization_id, technician_id |
| `idx_jobs_org_scheduled` | jobs | organization_id, scheduled_at |
| `idx_jobs_client_id` | jobs | client_id |
| `idx_jobs_request_id` | jobs | request_id (partial, where not null) |
| `idx_jobs_org_priority` | jobs | organization_id, priority (partial: not completed/cancelled) |
| `idx_service_requests_converted_job` | service_requests | converted_to_job_id (partial, where not null) |
| `idx_job_status_history_job` | job_status_history | job_id, changed_at desc |
| `idx_job_notes_job_id` | job_notes | job_id, created_at (partial) |
| `idx_job_notes_request_id` | job_notes | request_id, created_at (partial) |
| `idx_job_photos_job_id` | job_photos | job_id, created_at |
| `idx_invoices_org_status` | invoices | organization_id, status |
| `idx_invoices_org_due` | invoices | organization_id, due_at |
| `idx_invoices_client_id` | invoices | client_id |
| `idx_invoices_job_id` | invoices | job_id (partial, where not null) |
| `idx_invoice_items_invoice_id` | invoice_items | invoice_id, sort_order |

---

## Functions Created (7)

| Function | Type | Purpose |
|---|---|---|
| `set_updated_at()` | Trigger fn | Sets `updated_at = now()` on every UPDATE |
| `auth_org_id()` | RLS helper | Returns `organization_id` for the current user |
| `auth_role()` | RLS helper | Returns `role` for the current user |
| `auth_technician_id()` | RLS helper | Returns `technicians.id` for the current user |
| `auth_client_id()` | RLS helper | Returns `client_contacts.client_id` for the current user |
| `fn_record_job_status_change()` | Trigger fn | Appends row to `job_status_history` on `jobs.status` UPDATE |
| `fn_record_job_status_insert()` | Trigger fn | Appends initial row to `job_status_history` on `jobs` INSERT |

---

## Triggers Created (11)

| Trigger | Table | Event | Function |
|---|---|---|---|
| `trg_organizations_updated_at` | organizations | BEFORE UPDATE | set_updated_at |
| `trg_profiles_updated_at` | profiles | BEFORE UPDATE | set_updated_at |
| `trg_clients_updated_at` | clients | BEFORE UPDATE | set_updated_at |
| `trg_technicians_updated_at` | technicians | BEFORE UPDATE | set_updated_at |
| `trg_service_requests_updated_at` | service_requests | BEFORE UPDATE | set_updated_at |
| `trg_jobs_updated_at` | jobs | BEFORE UPDATE | set_updated_at |
| `trg_job_notes_updated_at` | job_notes | BEFORE UPDATE | set_updated_at |
| `trg_invoices_updated_at` | invoices | BEFORE UPDATE | set_updated_at |
| `trg_company_settings_updated_at` | company_settings | BEFORE UPDATE | set_updated_at |
| `trg_job_status_on_update` | jobs | AFTER UPDATE | fn_record_job_status_change |
| `trg_job_status_on_insert` | jobs | AFTER INSERT | fn_record_job_status_insert |

---

## RLS Status

| Table | RLS Enabled | Policies |
|---|---|---|
| organizations | ✓ | select (own org), update (owner only) |
| profiles | ✓ | select (own org), update (self or admin), delete (owner) |
| clients | ✓ | select, insert, update, delete |
| client_contacts | ✓ | select, insert, update, delete |
| technicians | ✓ | select, insert, update, delete |
| service_requests | ✓ | select, insert, update, delete |
| jobs | ✓ | select, insert, update, delete |
| job_status_history | ✓ | select only (insert via trigger/SECURITY DEFINER) |
| job_notes | ✓ | select, insert, update (own), delete (admin) |
| job_photos | ✓ | select, insert, delete (admin) |
| invoices | ✓ | select, insert, update, delete |
| invoice_items | ✓ | select, insert, update, delete |
| company_settings | ✓ | select (all in org), update (owner only) |

**Total RLS policies: 43**

No public (unauthenticated) access is granted on any table.

---

## What Changed in Revision 2 — Decisions and Reasons

### 1. `technician_status` enum — No change
Values `available / on_job / on_the_way / off_duty` were already correct. Confirmed as intended.

---

### 2. `invoice_items.total` — Changed to `GENERATED ALWAYS AS`

**Before:**
```sql
total numeric(10,2) not null,
```
App code was responsible for computing and providing `quantity * unit_price`.

**After:**
```sql
total numeric(10,2) generated always as (round(quantity * unit_price, 2)) stored,
```

**Why:** Prevents any possibility of a stored `total` diverging from `quantity * unit_price`. Postgres computes it on every INSERT and UPDATE. App code cannot override it.

**Precision note:** `numeric(10,2) * numeric(10,2)` produces `numeric(21,4)` in Postgres (scale = sum of input scales). `round(..., 2)` narrows it back to 2 decimal places before storage. This is intentional and documented in the migration.

**App impact:** INSERT and UPDATE statements must never include `total` in their column list for `invoice_items`. Supabase JS client will return the computed value on SELECT.

---

### 3. Tax rate — No global default

**Before:**
- `invoices.tax_rate`: `not null default 0.10`
- `company_settings.tax_rate`: `not null default 0.10`

**After:**
- `invoices.tax_rate`: `not null default 0`
- `company_settings.tax_rate`: nullable, no default

**Why:** There is no single correct tax rate across all jurisdictions or business configurations. Hardcoding 10% (GST) would be incorrect for any org not operating under Australian GST. `company_settings.tax_rate` being nullable signals "not yet configured" rather than silently applying a wrong rate.

**How it works at invoice creation:**
1. App reads `company_settings.tax_rate` for the org (may be null)
2. App applies the rate (defaulting to 0 if null)
3. App stores the resolved rate in `invoices.tax_rate` and computes `tax_amount` and `total`
4. These values are frozen in the invoice row — subsequent changes to `company_settings.tax_rate` do not affect existing invoices

**Note:** `invoices.tax_amount` and `invoices.total` remain app-maintained stored columns (not generated). This preserves the exact amounts at the time of invoice creation, which is an auditing requirement.

---

### 4. `auth_client_id()` — Removed `is_primary = true` gate

**Before:**
```sql
select client_id from client_contacts
where profile_id = auth.uid() and is_primary = true
limit 1
```

**After:**
```sql
select client_id from client_contacts
where profile_id = auth.uid()
limit 1
```

**Why:** Using `is_primary = true` as an access gate meant that any non-primary contact with a login would see nothing — an unintended lockout. `is_primary` is retained in the `client_contacts` table for display and defaulting purposes (e.g., "show this contact first", "use this email for notifications") but is no longer part of the access decision.

**Downstream effect:** All RLS policies that call `auth_client_id()` benefit automatically — no policy text changed. Client users can now see their client's jobs, invoices, and contacts regardless of whether they are the primary contact.

---

### 5. `job_notes` constraint — Changed to XOR (exactly one parent)

**Before:**
```sql
constraint chk_job_notes_has_parent check (
  job_id is not null or request_id is not null
)
```
Allowed a note to belong to both a job AND a request simultaneously.

**After:**
```sql
constraint chk_job_notes_one_parent check (
  num_nonnulls(job_id, request_id) = 1
)
```

**Why:** A note that belongs to both a job and a request is ambiguous — it could not be cleanly displayed in either context. `num_nonnulls()` is a Postgres built-in that counts non-null values in its arguments. `= 1` enforces that exactly one of the two columns is non-null (XOR semantics). This is cleaner than `(job_id is not null and request_id is null) or (job_id is null and request_id is not null)`.

---

### 6. Dispatcher job permissions — Confirmed correct (no change)

The migration already included `dispatcher` in the `jobs_insert_admin` policy:
```sql
auth_role() in ('owner', 'admin', 'dispatcher')
```
No SQL change was needed. Confirmed: owner, admin, and dispatcher can create and convert jobs. Technician and client cannot.

---

## Remaining Assumptions

1. **Supabase Postgres ≥ 15** — `gen_random_uuid()` built-in, `num_nonnulls()` available (Postgres 9.6+).
2. **Technician column restriction on job UPDATE** — The `jobs_update` policy allows technicians to update any field on their assigned jobs. True column restriction (status + technician_notes only) requires a SECURITY DEFINER server function, deferred to Phase 8.
3. **Profile auto-creation trigger** — Not in this migration. Will be added in Phase 8 when real auth is wired. For Phase 3 seed, profiles are inserted directly.
4. **`auth_client_id()` returns one client** — If a contact is linked to multiple clients (rare), `limit 1` returns one arbitrarily. This is acceptable for MVP; multi-client contacts can be handled with a set-returning function in a future migration.
5. **`invoice_items.total` is read-only from app** — Application INSERT statements must omit `total` from the column list. The Supabase JS client will error if you try to set a generated column.

---

## No Remaining Approval Blockers

All 7 decisions from the Phase 2B-A review have been resolved. The migration is ready for final review before applying.

---

## Rollback Approach

If the migration is applied and must be reversed:

```sql
-- Drop tables in reverse dependency order
drop table if exists invoice_items       cascade;
drop table if exists invoices            cascade;
drop table if exists job_photos          cascade;
drop table if exists job_notes           cascade;
drop table if exists job_status_history  cascade;
drop table if exists jobs                cascade;
drop table if exists service_requests    cascade;
drop table if exists technicians         cascade;
drop table if exists client_contacts     cascade;
drop table if exists clients             cascade;
drop table if exists profiles            cascade;
drop table if exists company_settings    cascade;
drop table if exists organizations       cascade;

-- Drop functions
drop function if exists set_updated_at()               cascade;
drop function if exists fn_record_job_status_change()  cascade;
drop function if exists fn_record_job_status_insert()  cascade;
drop function if exists auth_org_id()                  cascade;
drop function if exists auth_role()                    cascade;
drop function if exists auth_technician_id()           cascade;
drop function if exists auth_client_id()               cascade;

-- Drop enums
drop type if exists user_role          cascade;
drop type if exists job_status         cascade;
drop type if exists job_priority       cascade;
drop type if exists request_status     cascade;
drop type if exists urgency_level      cascade;
drop type if exists service_type       cascade;
drop type if exists invoice_status     cascade;
drop type if exists technician_status  cascade;
drop type if exists client_status      cascade;
```

**Zero impact on the app** — until Phase 4, no app code reads from these tables.

---

## Next Step After Final Approval

Apply the migration via Supabase MCP `apply_migration`, then proceed to **Phase 3 — Seed Demo Data**.

# Supabase Schema Plan — CamSecure

> Planning document only. No SQL has been run. Tables do not exist yet.
> Every business table includes `organization_id` for multi-tenant isolation.

---

## Design Principles

1. **Multi-tenant from day one.** Every row in every business table is owned by an `organization_id`. JSG is the first (and for now, only) tenant.
2. **Auth-first identities.** Staff and client users are represented first in `auth.users`, then mirrored in `profiles`. Business-layer FKs always point to `profiles`, never directly to `auth.users`.
3. **Clients are companies, contacts are people.** A single `clients` row (Metro Security Ltd) can have many `client_contacts` rows. A contact may or may not have a login.
4. **Status history, not overwrites.** Every job status change appends a row to `job_status_history`. The current status is a denormalized field on `jobs` for performance.
5. **Deferred complexity.** `invoice_items`, `job_photos`, and notifications are designed now but migrated last.

---

## Enums

These must be created before any table that uses them.

```sql
create type user_role         as enum ('owner', 'admin', 'dispatcher', 'technician', 'client');
create type job_status        as enum ('assigned', 'on_the_way', 'started', 'in_progress', 'needs_parts', 'completed', 'rescheduled', 'cancelled');
create type job_priority      as enum ('emergency', 'high', 'medium', 'low');
create type request_status    as enum ('new', 'reviewing', 'ready_to_schedule', 'converted', 'cancelled');
create type urgency_level     as enum ('emergency', 'high', 'medium', 'low');
create type service_type      as enum ('new_installation', 'maintenance', 'dvr_nvr_issue', 'camera_outage', 'mobile_app_issue', 'wiring_issue', 'emergency_service', 'quote_request', 'site_inspection', 'other');
create type invoice_status    as enum ('draft', 'unpaid', 'paid', 'overdue', 'cancelled');
create type technician_status as enum ('available', 'on_job', 'on_the_way', 'off_duty');
create type client_status     as enum ('active', 'inactive');
```

---

## Table Definitions

Tables are listed in dependency order (no FK points to a table defined later in this list).

---

### 1. `organizations`

**Purpose:** The top-level tenant. JSG is one row. Future white-label customers each get their own row.  
**Replaces:** Nothing in mock (JSG is implicit). Needed before all other tables.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | `gen_random_uuid()` |
| `name` | `text NOT NULL` | "JSG CamSecure" |
| `slug` | `text UNIQUE NOT NULL` | "jsg" — used in future subdomains |
| `email` | `text` | Main contact email |
| `phone` | `text` | Main contact phone |
| `address` | `text` | Office address |
| `logo_url` | `text` | Supabase Storage URL |
| `created_at` | `timestamptz` | `now()` |
| `updated_at` | `timestamptz` | `now()` |

**Indexes:** None needed — single-row table per deployment.

---

### 2. `profiles`

**Purpose:** One row per authenticated user, linked 1:1 to `auth.users`. Carries role and org membership.  
**Replaces:** `mock-session.ts` — `MOCK_ADMIN`, `MOCK_TECHNICIAN`, `MOCK_CLIENT`.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | Must equal `auth.users.id` |
| `organization_id` | `uuid FK → organizations` | NOT NULL |
| `role` | `user_role` | NOT NULL |
| `full_name` | `text NOT NULL` | |
| `email` | `text NOT NULL` | Mirror of `auth.users.email` |
| `phone` | `text` | Nullable |
| `initials` | `text` | 2-char display initials |
| `avatar_url` | `text` | Supabase Storage URL |
| `is_active` | `boolean` | Default `true` |
| `created_at` | `timestamptz` | `now()` |
| `updated_at` | `timestamptz` | `now()` |

**Indexes:** `(organization_id)`, `(email)`  
**Note:** A database trigger on `auth.users` INSERT should create this row automatically (profile auto-creation pattern).

---

### 3. `clients`

**Purpose:** Companies that hire JSG. One row per client company.  
**Replaces:** `MOCK_CLIENTS` in `constants.ts` (6 rows).

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `organization_id` | `uuid FK → organizations` | NOT NULL |
| `name` | `text NOT NULL` | "Metro Security Ltd" |
| `status` | `client_status` | Default `'active'` |
| `address` | `text` | Primary site address |
| `notes` | `text` | Internal admin notes |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

**Indexes:** `(organization_id, status)`, `(organization_id, name)`  
**Computed fields (not stored):** `sites` and `jobs` counts in mock are derived — compute via SQL joins or Postgres functions, not stored columns.

---

### 4. `client_contacts`

**Purpose:** Individual people at a client company. A client may have a login (linked to `profiles`) or be contact-only.  
**Replaces:** The single `contact`/`email`/`phone` fields on each mock client row.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `organization_id` | `uuid FK → organizations` | NOT NULL |
| `client_id` | `uuid FK → clients` | NOT NULL |
| `profile_id` | `uuid FK → profiles` | Nullable — set when contact has a login |
| `full_name` | `text NOT NULL` | "David Park" |
| `email` | `text NOT NULL` | |
| `phone` | `text` | |
| `is_primary` | `boolean` | Default `false` |
| `created_at` | `timestamptz` | |

**Indexes:** `(client_id)`, `(organization_id, client_id)`, `(profile_id)` where not null

---

### 5. `technicians`

**Purpose:** JSG field staff. One row per technician, linked to their profile.  
**Replaces:** `MOCK_TECHNICIANS` in `constants.ts` (5 rows).

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `organization_id` | `uuid FK → organizations` | NOT NULL |
| `profile_id` | `uuid FK → profiles` | UNIQUE — one profile = one technician |
| `specialty` | `text` | "Installation & Networking" |
| `status` | `technician_status` | Default `'available'` |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

**Indexes:** `(organization_id)`, `(profile_id)`  
**Computed fields:** `active_jobs` and `completed_jobs` are derived from `jobs` — do not store.

---

### 6. `service_requests`

**Purpose:** Inbound service requests from clients or created by admin. First step in the workflow.  
**Replaces:** `MOCK_REQUESTS` in `constants.ts` (5 rows) + `MockRequestItem` type in `mock-store.tsx`.  
**Mutations replaced:** `addRequest`, `updateRequestStatus`, `updateRequestNotes`.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `organization_id` | `uuid FK → organizations` | NOT NULL |
| `client_id` | `uuid FK → clients` | Nullable — may be unrecognised client |
| `client_contact_id` | `uuid FK → client_contacts` | Nullable |
| `submitted_by_profile_id` | `uuid FK → profiles` | Nullable — null for public form submissions |
| `client_name` | `text NOT NULL` | Denormalised for forms where client is unknown |
| `client_phone` | `text` | |
| `service_type` | `service_type` | NOT NULL |
| `urgency` | `urgency_level` | NOT NULL |
| `status` | `request_status` | Default `'new'` |
| `description` | `text NOT NULL` | |
| `notes` | `text` | Internal dispatcher notes |
| `converted_to_job_id` | `uuid FK → jobs` | Nullable — set on convert |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

**Indexes:** `(organization_id, status)`, `(organization_id, created_at DESC)`, `(client_id)`, `(converted_to_job_id)`

---

### 7. `jobs`

**Purpose:** Work orders. Created from a service request (or directly by admin).  
**Replaces:** `MOCK_JOBS` in `constants.ts` (13 rows) + `MockJobItem` type in `mock-store.tsx`.  
**Mutations replaced:** `convertToJob`, `updateJobAssignment`, `updateJobStatus`.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `organization_id` | `uuid FK → organizations` | NOT NULL |
| `request_id` | `uuid FK → service_requests` | Nullable — direct jobs have no request |
| `client_id` | `uuid FK → clients` | NOT NULL |
| `technician_id` | `uuid FK → technicians` | Nullable until assigned |
| `site_name` | `text` | "Downtown Office Tower" |
| `address` | `text` | Full site address |
| `service_type` | `service_type` | NOT NULL |
| `priority` | `job_priority` | NOT NULL, default `'medium'` |
| `status` | `job_status` | NOT NULL, default `'assigned'` |
| `scheduled_at` | `timestamptz` | Nullable — when job is booked |
| `completed_at` | `timestamptz` | Nullable — set on completion |
| `dispatcher_notes` | `text` | Notes from admin/dispatcher to tech |
| `technician_notes` | `text` | Notes from tech for admin |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

**Indexes:** `(organization_id, status)`, `(organization_id, technician_id)`, `(organization_id, scheduled_at)`, `(client_id)`, `(request_id)`

---

### 8. `job_status_history`

**Purpose:** Immutable audit trail. Every time `jobs.status` changes, a row is appended here.  
**Replaces:** Nothing in mock — this is new and improves on mock behaviour.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `organization_id` | `uuid FK → organizations` | NOT NULL |
| `job_id` | `uuid FK → jobs` | NOT NULL |
| `changed_by_profile_id` | `uuid FK → profiles` | Nullable (system-level changes) |
| `old_status` | `job_status` | Nullable for first insert |
| `new_status` | `job_status` | NOT NULL |
| `changed_at` | `timestamptz` | `now()` |

**Indexes:** `(job_id, changed_at DESC)`  
**Note:** Populated via a Postgres trigger on `jobs.status` update, not via app code.

---

### 9. `job_notes`

**Purpose:** Freeform notes on a job or request, written by admin or technician.  
**Replaces:** Inline `notes` field on `service_requests` (currently a single text blob). Adds audit trail.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `organization_id` | `uuid FK → organizations` | NOT NULL |
| `job_id` | `uuid FK → jobs` | Nullable |
| `request_id` | `uuid FK → service_requests` | Nullable — note can belong to either |
| `author_profile_id` | `uuid FK → profiles` | NOT NULL |
| `body` | `text NOT NULL` | |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

**Constraint:** At least one of `job_id` / `request_id` must be non-null (check constraint).  
**Indexes:** `(job_id, created_at)`, `(request_id, created_at)`

---

### 10. `job_photos`

**Purpose:** Photos uploaded by technicians at a job site. Stored in Supabase Storage, referenced here.  
**Replaces:** The disabled photo-upload placeholder in the app.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `organization_id` | `uuid FK → organizations` | NOT NULL |
| `job_id` | `uuid FK → jobs` | NOT NULL |
| `uploaded_by_profile_id` | `uuid FK → profiles` | NOT NULL |
| `storage_path` | `text NOT NULL` | Supabase Storage path (`job-photos/{org_id}/{job_id}/{uuid}.jpg`) |
| `caption` | `text` | Optional label |
| `taken_at` | `timestamptz` | From EXIF or manual entry |
| `created_at` | `timestamptz` | |

**Indexes:** `(job_id, created_at)`  
**Storage bucket:** `job-photos` — private, accessible via signed URLs only.

---

### 11. `invoices`

**Purpose:** Billing records per job. Generated by admin/owner.  
**Replaces:** `MOCK_INVOICES` in `constants.ts` (7 rows).

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `organization_id` | `uuid FK → organizations` | NOT NULL |
| `client_id` | `uuid FK → clients` | NOT NULL |
| `job_id` | `uuid FK → jobs` | Nullable — some invoices may cover non-job work |
| `invoice_number` | `text` | Human-readable (INV-001), unique per org |
| `status` | `invoice_status` | Default `'draft'` |
| `issued_at` | `timestamptz` | Nullable until published |
| `due_at` | `timestamptz` | |
| `paid_at` | `timestamptz` | Nullable |
| `subtotal` | `numeric(10,2)` | Before tax |
| `tax_rate` | `numeric(5,4)` | e.g., 0.1 for 10% GST |
| `tax_amount` | `numeric(10,2)` | |
| `total` | `numeric(10,2)` | `subtotal + tax_amount` |
| `notes` | `text` | Footer/payment notes |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

**Indexes:** `(organization_id, status)`, `(organization_id, due_at)`, `(client_id)`  
**Note:** Current mock has a flat `amount` field — the real schema uses `subtotal + tax` for future GST/VAT support.

---

### 12. `invoice_items`

**Purpose:** Line items within an invoice (labour, parts, call-out fee, etc.).  
**Replaces:** Nothing in mock — the mock has a single flat `amount`. This is new.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `organization_id` | `uuid FK → organizations` | NOT NULL |
| `invoice_id` | `uuid FK → invoices` | NOT NULL |
| `description` | `text NOT NULL` | "Camera installation — Floor 5" |
| `quantity` | `numeric(10,2)` | Default `1` |
| `unit_price` | `numeric(10,2)` | NOT NULL |
| `total` | `numeric(10,2)` | Computed: `quantity * unit_price` |
| `sort_order` | `int` | Display order |
| `created_at` | `timestamptz` | |

**Indexes:** `(invoice_id)`

---

### 13. `company_settings`

**Purpose:** Per-organisation configuration (branding, tax rate, invoice prefix, etc.).  
**Replaces:** The `/settings` placeholder page.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `organization_id` | `uuid FK → organizations` | UNIQUE — one row per org |
| `business_name` | `text` | Display name override |
| `abn` | `text` | Australian Business Number (or tax ID) |
| `tax_rate` | `numeric(5,4)` | Default `0.10` (10% GST) |
| `invoice_prefix` | `text` | Default `'INV'` |
| `invoice_footer_note` | `text` | Printed on invoice PDFs |
| `primary_color` | `text` | Hex for branding |
| `logo_url` | `text` | Supabase Storage URL |
| `updated_at` | `timestamptz` | |

**Indexes:** `(organization_id)` — unique constraint covers this.

---

## Mock Data → Table Mapping Summary

| Mock Source | Target Table(s) | Rows |
|---|---|---|
| `MOCK_CLIENTS` | `clients` + `client_contacts` | 6 clients, 6 primary contacts |
| `MOCK_TECHNICIANS` | `technicians` + `profiles` | 5 technicians |
| `MOCK_REQUESTS` | `service_requests` | 5 requests |
| `MOCK_JOBS` | `jobs` | 13 jobs |
| `MOCK_INVOICES` | `invoices` | 7 invoices |
| `MOCK_METRICS` | Computed via SQL — not stored | — |
| `MOCK_ADMIN` | `profiles` (role = admin) | 1 row |
| `mock-store.tsx` mutations | Supabase queries | — |
| Label maps in `constants.ts` | Stay in frontend | — |

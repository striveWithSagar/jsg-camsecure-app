-- ============================================================
-- CamSecure Operations — Base Schema Migration
-- File: 20260523120000_create_base_schema.sql
--
-- DRAFT — do not apply without explicit approval.
--
-- Creates all enums, tables, indexes, helper functions,
-- triggers, and full RLS policies. No seed data.
--
-- Safe to apply to an empty public schema.
-- Does NOT modify auth schema.
-- Does NOT drop anything.
-- ============================================================


-- ============================================================
-- SECTION 1: ENUMS
-- Must be created before any table that references them.
-- ============================================================

create type user_role as enum (
  'owner',
  'admin',
  'dispatcher',
  'technician',
  'client'
);

create type job_status as enum (
  'assigned',
  'on_the_way',
  'started',
  'in_progress',
  'needs_parts',
  'completed',
  'rescheduled',
  'cancelled'
);

create type job_priority as enum (
  'emergency',
  'high',
  'medium',
  'low'
);

create type request_status as enum (
  'new',
  'reviewing',
  'ready_to_schedule',
  'converted',
  'cancelled'
);

create type urgency_level as enum (
  'emergency',
  'high',
  'medium',
  'low'
);

create type service_type as enum (
  'new_installation',
  'maintenance',
  'dvr_nvr_issue',
  'camera_outage',
  'mobile_app_issue',
  'wiring_issue',
  'emergency_service',
  'quote_request',
  'site_inspection',
  'other'
);

create type invoice_status as enum (
  'draft',
  'unpaid',
  'paid',
  'overdue',
  'cancelled'
);

create type technician_status as enum (
  'available',
  'on_job',
  'on_the_way',
  'off_duty'
);

create type client_status as enum (
  'active',
  'inactive'
);


-- ============================================================
-- SECTION 2: SHARED TRIGGER FUNCTION — updated_at
-- One function, attached to every table that has updated_at.
-- ============================================================

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ============================================================
-- SECTION 3: TABLES
-- Created in FK dependency order.
-- No circular FKs at creation time — the one circular pair
-- (service_requests ↔ jobs) is resolved via ALTER TABLE in §3.7.
-- ============================================================


-- ── 3.1  organizations ──────────────────────────────────────
-- Top-level tenant. JSG is one row.
-- Every business table references this via organization_id.

create table organizations (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  slug        text        not null unique,
  email       text,
  phone       text,
  address     text,
  logo_url    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger trg_organizations_updated_at
  before update on organizations
  for each row execute function set_updated_at();


-- ── 3.2  profiles ───────────────────────────────────────────
-- One row per authenticated user. id must equal auth.users.id.
-- Created automatically by a trigger on auth.users (added in a later migration
-- when auth is wired — Phase 8). For Phase 3 seed, rows are inserted directly.

create table profiles (
  id              uuid        primary key,              -- equals auth.users.id
  organization_id uuid        not null references organizations(id) on delete restrict,
  role            user_role   not null,
  full_name       text        not null,
  email           text        not null,
  phone           text,
  initials        text,
  avatar_url      text,
  is_active       boolean     not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_profiles_organization_id on profiles(organization_id);
create index idx_profiles_email           on profiles(email);
create index idx_profiles_org_role        on profiles(organization_id, role);

create trigger trg_profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();


-- ── 3.3  clients ────────────────────────────────────────────
-- Companies that hire JSG. "Metro Security Ltd" is one row.
-- Contacts/people within a company live in client_contacts.

create table clients (
  id              uuid          primary key default gen_random_uuid(),
  organization_id uuid          not null references organizations(id) on delete restrict,
  name            text          not null,
  status          client_status not null default 'active',
  address         text,
  notes           text,
  created_at      timestamptz   not null default now(),
  updated_at      timestamptz   not null default now()
);

create index idx_clients_org_status on clients(organization_id, status);
create index idx_clients_org_name   on clients(organization_id, name);

create trigger trg_clients_updated_at
  before update on clients
  for each row execute function set_updated_at();


-- ── 3.4  client_contacts ────────────────────────────────────
-- Individual people at a client company.
-- profile_id is nullable — a contact may exist without a login.

create table client_contacts (
  id              uuid        primary key default gen_random_uuid(),
  organization_id uuid        not null references organizations(id) on delete restrict,
  client_id       uuid        not null references clients(id) on delete cascade,
  profile_id      uuid        references profiles(id) on delete set null,
  full_name       text        not null,
  email           text        not null,
  phone           text,
  is_primary      boolean     not null default false,
  created_at      timestamptz not null default now()
);

create index idx_client_contacts_client_id  on client_contacts(client_id);
create index idx_client_contacts_org_client on client_contacts(organization_id, client_id);
create index idx_client_contacts_profile_id on client_contacts(profile_id)
  where profile_id is not null;


-- ── 3.5  technicians ────────────────────────────────────────
-- JSG field staff. profile_id is UNIQUE — one login = one technician slot.

create table technicians (
  id              uuid               primary key default gen_random_uuid(),
  organization_id uuid               not null references organizations(id) on delete restrict,
  profile_id      uuid               not null unique references profiles(id) on delete restrict,
  specialty       text,
  status          technician_status  not null default 'available',
  created_at      timestamptz        not null default now(),
  updated_at      timestamptz        not null default now()
);

create index idx_technicians_org         on technicians(organization_id);
create index idx_technicians_profile_id  on technicians(profile_id);
create index idx_technicians_org_status  on technicians(organization_id, status);

create trigger trg_technicians_updated_at
  before update on technicians
  for each row execute function set_updated_at();


-- ── 3.6  service_requests ───────────────────────────────────
-- Inbound service requests. converted_to_job_id is a FORWARD FK to jobs.
-- That FK is added via ALTER TABLE after jobs is created (§3.7).

create table service_requests (
  id                      uuid           primary key default gen_random_uuid(),
  organization_id         uuid           not null references organizations(id) on delete restrict,
  client_id               uuid           references clients(id) on delete set null,
  client_contact_id       uuid           references client_contacts(id) on delete set null,
  submitted_by_profile_id uuid           references profiles(id) on delete set null,
  client_name             text           not null,
  client_phone            text           not null default '',
  service_type            service_type   not null,
  urgency                 urgency_level  not null,
  status                  request_status not null default 'new',
  description             text           not null,
  notes                   text           not null default '',
  converted_to_job_id     uuid,          -- FK constraint added below after jobs exists
  created_at              timestamptz    not null default now(),
  updated_at              timestamptz    not null default now()
);

create index idx_service_requests_org_status  on service_requests(organization_id, status);
create index idx_service_requests_org_created on service_requests(organization_id, created_at desc);
create index idx_service_requests_client_id   on service_requests(client_id)
  where client_id is not null;

create trigger trg_service_requests_updated_at
  before update on service_requests
  for each row execute function set_updated_at();


-- ── 3.7  jobs ───────────────────────────────────────────────
-- Work orders. May be created from a service_request or directly.

create table jobs (
  id               uuid         primary key default gen_random_uuid(),
  organization_id  uuid         not null references organizations(id) on delete restrict,
  request_id       uuid         references service_requests(id) on delete set null,
  client_id        uuid         not null references clients(id) on delete restrict,
  technician_id    uuid         references technicians(id) on delete set null,
  site_name        text         not null default '',
  address          text         not null default '',
  service_type     service_type not null,
  priority         job_priority not null default 'medium',
  status           job_status   not null default 'assigned',
  scheduled_at     timestamptz,
  completed_at     timestamptz,
  dispatcher_notes text         not null default '',
  technician_notes text         not null default '',
  created_at       timestamptz  not null default now(),
  updated_at       timestamptz  not null default now()
);

create index idx_jobs_org_status     on jobs(organization_id, status);
create index idx_jobs_org_technician on jobs(organization_id, technician_id);
create index idx_jobs_org_scheduled  on jobs(organization_id, scheduled_at);
create index idx_jobs_client_id      on jobs(client_id);
create index idx_jobs_request_id     on jobs(request_id)
  where request_id is not null;
create index idx_jobs_org_priority   on jobs(organization_id, priority)
  where status not in ('completed', 'cancelled');

create trigger trg_jobs_updated_at
  before update on jobs
  for each row execute function set_updated_at();

-- Resolve the forward FK: service_requests → jobs
alter table service_requests
  add constraint fk_service_requests_converted_to_job
  foreign key (converted_to_job_id)
  references jobs(id)
  on delete set null;

create index idx_service_requests_converted_job on service_requests(converted_to_job_id)
  where converted_to_job_id is not null;


-- ── 3.8  job_status_history ─────────────────────────────────
-- Immutable audit log. Populated only by triggers (§5).
-- No app-level INSERT policy — trigger uses SECURITY DEFINER.

create table job_status_history (
  id                    uuid       primary key default gen_random_uuid(),
  organization_id       uuid       not null references organizations(id) on delete restrict,
  job_id                uuid       not null references jobs(id) on delete cascade,
  changed_by_profile_id uuid       references profiles(id) on delete set null,
  old_status            job_status,               -- null for the initial INSERT row
  new_status            job_status not null,
  changed_at            timestamptz not null default now()
);

create index idx_job_status_history_job on job_status_history(job_id, changed_at desc);


-- ── 3.9  job_notes ──────────────────────────────────────────
-- Freeform notes. Must belong to EXACTLY ONE of job_id or request_id.
-- num_nonnulls() counts non-null arguments — enforces XOR at the DB level.

create table job_notes (
  id                uuid        primary key default gen_random_uuid(),
  organization_id   uuid        not null references organizations(id) on delete restrict,
  job_id            uuid        references jobs(id) on delete cascade,
  request_id        uuid        references service_requests(id) on delete cascade,
  author_profile_id uuid        not null references profiles(id) on delete restrict,
  body              text        not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint chk_job_notes_one_parent check (
    num_nonnulls(job_id, request_id) = 1
  )
);

create index idx_job_notes_job_id     on job_notes(job_id, created_at)
  where job_id is not null;
create index idx_job_notes_request_id on job_notes(request_id, created_at)
  where request_id is not null;

create trigger trg_job_notes_updated_at
  before update on job_notes
  for each row execute function set_updated_at();


-- ── 3.10  job_photos ────────────────────────────────────────
-- Metadata rows for photos stored in Supabase Storage bucket "job-photos".
-- The bucket itself must be created separately in the Supabase dashboard.

create table job_photos (
  id                     uuid        primary key default gen_random_uuid(),
  organization_id        uuid        not null references organizations(id) on delete restrict,
  job_id                 uuid        not null references jobs(id) on delete cascade,
  uploaded_by_profile_id uuid        not null references profiles(id) on delete restrict,
  storage_path           text        not null,
  caption                text,
  taken_at               timestamptz,
  created_at             timestamptz not null default now()
);

create index idx_job_photos_job_id on job_photos(job_id, created_at);


-- ── 3.11  invoices ──────────────────────────────────────────
-- invoice_number is unique per organization (not globally).
-- tax_rate defaults to 0 — the correct rate is pulled from company_settings at
-- invoice creation time and stored here to preserve the rate that was in effect.
-- subtotal, tax_amount, and total are all app-maintained stored values so the
-- invoice remains auditable even if company_settings.tax_rate changes later.

create table invoices (
  id              uuid           primary key default gen_random_uuid(),
  organization_id uuid           not null references organizations(id) on delete restrict,
  client_id       uuid           not null references clients(id) on delete restrict,
  job_id          uuid           references jobs(id) on delete set null,
  invoice_number  text           not null,
  status          invoice_status not null default 'draft',
  issued_at       timestamptz,
  due_at          timestamptz,
  paid_at         timestamptz,
  subtotal        numeric(10,2)  not null default 0,
  tax_rate        numeric(5,4)   not null default 0,
  tax_amount      numeric(10,2)  not null default 0,
  total           numeric(10,2)  not null default 0,
  notes           text           not null default '',
  created_at      timestamptz    not null default now(),
  updated_at      timestamptz    not null default now(),

  constraint uq_invoice_number_per_org unique (organization_id, invoice_number),
  constraint chk_invoice_total_positive check (total >= 0)
);

create index idx_invoices_org_status on invoices(organization_id, status);
create index idx_invoices_org_due    on invoices(organization_id, due_at);
create index idx_invoices_client_id  on invoices(client_id);
create index idx_invoices_job_id     on invoices(job_id)
  where job_id is not null;

create trigger trg_invoices_updated_at
  before update on invoices
  for each row execute function set_updated_at();


-- ── 3.12  invoice_items ─────────────────────────────────────
-- Line items within an invoice.
-- total is a GENERATED ALWAYS AS column: round(quantity * unit_price, 2).
-- Precision note: numeric(10,2) * numeric(10,2) yields numeric(21,4) in Postgres.
-- round(..., 2) narrows the result back to 2 decimal places before storage.
-- The column cannot be set by application code — Postgres computes it on every write.

create table invoice_items (
  id              uuid          primary key default gen_random_uuid(),
  organization_id uuid          not null references organizations(id) on delete restrict,
  invoice_id      uuid          not null references invoices(id) on delete cascade,
  description     text          not null,
  quantity        numeric(10,2) not null default 1,
  unit_price      numeric(10,2) not null,
  total           numeric(10,2) generated always as (round(quantity * unit_price, 2)) stored,
  sort_order      int           not null default 0,
  created_at      timestamptz   not null default now(),

  constraint chk_invoice_items_positive_qty   check (quantity > 0),
  constraint chk_invoice_items_positive_price check (unit_price >= 0)
);

create index idx_invoice_items_invoice_id on invoice_items(invoice_id, sort_order);


-- ── 3.13  company_settings ──────────────────────────────────
-- One row per org. Stores JSG branding and billing defaults.
-- tax_rate is nullable — null means "no tax configured yet".
-- Application code reads this when creating a new invoice and copies the value
-- into invoices.tax_rate at that moment, preserving the rate that was in effect.

create table company_settings (
  id                  uuid          primary key default gen_random_uuid(),
  organization_id     uuid          not null unique references organizations(id) on delete cascade,
  business_name       text,
  abn                 text,
  tax_rate            numeric(5,4),
  invoice_prefix      text          not null default 'INV',
  invoice_footer_note text,
  primary_color       text,
  logo_url            text,
  updated_at          timestamptz   not null default now()
);

create trigger trg_company_settings_updated_at
  before update on company_settings
  for each row execute function set_updated_at();


-- ============================================================
-- SECTION 4: RLS HELPER FUNCTIONS
-- SECURITY DEFINER so they can read profiles regardless of
-- the calling user's own RLS context.
-- set search_path = public prevents search_path injection.
-- All return NULL gracefully when called unauthenticated.
-- ============================================================

create or replace function auth_org_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select organization_id
  from profiles
  where id = auth.uid()
$$;

create or replace function auth_role()
returns user_role
language sql stable security definer
set search_path = public
as $$
  select role
  from profiles
  where id = auth.uid()
$$;

create or replace function auth_technician_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select id
  from technicians
  where profile_id = auth.uid()
$$;

create or replace function auth_client_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  -- Returns the client_id for the current user based on any client_contacts row.
  -- is_primary is NOT required — any linked contact grants access to that client's data.
  -- is_primary is retained for display/default purposes only, not as an access gate.
  select client_id
  from client_contacts
  where profile_id = auth.uid()
  limit 1
$$;


-- ============================================================
-- SECTION 5: JOB STATUS HISTORY TRIGGERS
-- Automatically records every status change + initial status.
-- Uses SECURITY DEFINER to bypass RLS on job_status_history.
-- ============================================================

-- Fires on every UPDATE that changes jobs.status
create or replace function fn_record_job_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status then
    insert into job_status_history (
      organization_id,
      job_id,
      changed_by_profile_id,
      old_status,
      new_status,
      changed_at
    ) values (
      new.organization_id,
      new.id,
      auth.uid(),   -- NULL when changed by a server-side process
      old.status,
      new.status,
      now()
    );
  end if;
  return new;
end;
$$;

create trigger trg_job_status_on_update
  after update on jobs
  for each row execute function fn_record_job_status_change();

-- Fires on INSERT to capture the initial status
create or replace function fn_record_job_status_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into job_status_history (
    organization_id,
    job_id,
    changed_by_profile_id,
    old_status,
    new_status,
    changed_at
  ) values (
    new.organization_id,
    new.id,
    auth.uid(),
    null,           -- no previous status on creation
    new.status,
    now()
  );
  return new;
end;
$$;

create trigger trg_job_status_on_insert
  after insert on jobs
  for each row execute function fn_record_job_status_insert();


-- ============================================================
-- SECTION 6: ENABLE RLS
-- Enabled on every business table before any policy is written.
-- With no policies, authenticated users see nothing by default.
-- ============================================================

alter table organizations      enable row level security;
alter table profiles           enable row level security;
alter table clients            enable row level security;
alter table client_contacts    enable row level security;
alter table technicians        enable row level security;
alter table service_requests   enable row level security;
alter table jobs               enable row level security;
alter table job_status_history enable row level security;
alter table job_notes          enable row level security;
alter table job_photos         enable row level security;
alter table invoices           enable row level security;
alter table invoice_items      enable row level security;
alter table company_settings   enable row level security;


-- ============================================================
-- SECTION 7: RLS POLICIES
--
-- Naming: <table>_<operation>_<who>
-- "admin" in comments = roles: owner, admin, dispatcher.
-- No INSERT policy on profiles — rows created by trigger only.
-- No INSERT/UPDATE/DELETE on job_status_history — trigger only.
-- ============================================================


-- ── organizations ───────────────────────────────────────────

create policy "organizations_select_own"
  on organizations for select
  to authenticated
  using (id = auth_org_id());

create policy "organizations_update_owner"
  on organizations for update
  to authenticated
  using    (id = auth_org_id() and auth_role() = 'owner')
  with check (id = auth_org_id() and auth_role() = 'owner');


-- ── profiles ────────────────────────────────────────────────

create policy "profiles_select_own_org"
  on profiles for select
  to authenticated
  using (organization_id = auth_org_id());

create policy "profiles_update_self_or_admin"
  on profiles for update
  to authenticated
  using    (id = auth.uid() or auth_role() in ('owner', 'admin'))
  with check (id = auth.uid() or auth_role() in ('owner', 'admin'));

create policy "profiles_delete_owner"
  on profiles for delete
  to authenticated
  using (auth_role() = 'owner');


-- ── clients ─────────────────────────────────────────────────

create policy "clients_select"
  on clients for select
  to authenticated
  using (
    (organization_id = auth_org_id() and auth_role() in ('owner', 'admin', 'dispatcher'))
    or
    (id = auth_client_id() and auth_role() = 'client')
  );

create policy "clients_insert_admin"
  on clients for insert
  to authenticated
  with check (
    organization_id = auth_org_id()
    and auth_role() in ('owner', 'admin', 'dispatcher')
  );

create policy "clients_update_admin"
  on clients for update
  to authenticated
  using    (organization_id = auth_org_id() and auth_role() in ('owner', 'admin', 'dispatcher'))
  with check (organization_id = auth_org_id() and auth_role() in ('owner', 'admin', 'dispatcher'));

create policy "clients_delete_owner"
  on clients for delete
  to authenticated
  using (organization_id = auth_org_id() and auth_role() = 'owner');


-- ── client_contacts ─────────────────────────────────────────

create policy "client_contacts_select"
  on client_contacts for select
  to authenticated
  using (
    (organization_id = auth_org_id() and auth_role() in ('owner', 'admin', 'dispatcher'))
    or
    (client_id = auth_client_id() and auth_role() = 'client')
  );

create policy "client_contacts_insert_admin"
  on client_contacts for insert
  to authenticated
  with check (
    organization_id = auth_org_id()
    and auth_role() in ('owner', 'admin', 'dispatcher')
  );

create policy "client_contacts_update_admin"
  on client_contacts for update
  to authenticated
  using    (organization_id = auth_org_id() and auth_role() in ('owner', 'admin', 'dispatcher'))
  with check (organization_id = auth_org_id() and auth_role() in ('owner', 'admin', 'dispatcher'));

create policy "client_contacts_delete_owner"
  on client_contacts for delete
  to authenticated
  using (organization_id = auth_org_id() and auth_role() = 'owner');


-- ── technicians ─────────────────────────────────────────────

create policy "technicians_select"
  on technicians for select
  to authenticated
  using (
    (organization_id = auth_org_id() and auth_role() in ('owner', 'admin', 'dispatcher'))
    or
    (profile_id = auth.uid() and auth_role() = 'technician')
  );

create policy "technicians_insert_admin"
  on technicians for insert
  to authenticated
  with check (
    organization_id = auth_org_id()
    and auth_role() in ('owner', 'admin')
  );

create policy "technicians_update_admin"
  on technicians for update
  to authenticated
  using    (organization_id = auth_org_id() and auth_role() in ('owner', 'admin'))
  with check (organization_id = auth_org_id() and auth_role() in ('owner', 'admin'));

create policy "technicians_delete_owner"
  on technicians for delete
  to authenticated
  using (organization_id = auth_org_id() and auth_role() = 'owner');


-- ── service_requests ────────────────────────────────────────

create policy "service_requests_select"
  on service_requests for select
  to authenticated
  using (
    (organization_id = auth_org_id() and auth_role() in ('owner', 'admin', 'dispatcher'))
    or
    (client_id = auth_client_id() and auth_role() = 'client')
  );

create policy "service_requests_insert"
  on service_requests for insert
  to authenticated
  with check (
    organization_id = auth_org_id()
    and (
      auth_role() in ('owner', 'admin', 'dispatcher')
      or (auth_role() = 'client' and client_id = auth_client_id())
    )
  );

create policy "service_requests_update_admin"
  on service_requests for update
  to authenticated
  using    (organization_id = auth_org_id() and auth_role() in ('owner', 'admin', 'dispatcher'))
  with check (organization_id = auth_org_id() and auth_role() in ('owner', 'admin', 'dispatcher'));

create policy "service_requests_delete_owner"
  on service_requests for delete
  to authenticated
  using (organization_id = auth_org_id() and auth_role() = 'owner');


-- ── jobs ────────────────────────────────────────────────────

create policy "jobs_select"
  on jobs for select
  to authenticated
  using (
    (organization_id = auth_org_id() and auth_role() in ('owner', 'admin', 'dispatcher'))
    or
    (technician_id = auth_technician_id() and auth_role() = 'technician')
    or
    (client_id = auth_client_id() and auth_role() = 'client')
  );

create policy "jobs_insert_admin"
  on jobs for insert
  to authenticated
  with check (
    organization_id = auth_org_id()
    and auth_role() in ('owner', 'admin', 'dispatcher')
  );

-- Technician update: policy allows the row; column restriction (status + technician_notes only)
-- is enforced via a SECURITY DEFINER server function (added in a later migration, Phase 8).
create policy "jobs_update"
  on jobs for update
  to authenticated
  using (
    (organization_id = auth_org_id() and auth_role() in ('owner', 'admin', 'dispatcher'))
    or
    (technician_id = auth_technician_id() and auth_role() = 'technician')
  )
  with check (
    (organization_id = auth_org_id() and auth_role() in ('owner', 'admin', 'dispatcher'))
    or
    (technician_id = auth_technician_id() and auth_role() = 'technician')
  );

create policy "jobs_delete_owner"
  on jobs for delete
  to authenticated
  using (organization_id = auth_org_id() and auth_role() = 'owner');


-- ── job_status_history ──────────────────────────────────────
-- Read-only for app users. INSERT is trigger-only (SECURITY DEFINER bypasses RLS).

create policy "job_status_history_select"
  on job_status_history for select
  to authenticated
  using (
    (organization_id = auth_org_id() and auth_role() in ('owner', 'admin', 'dispatcher'))
    or
    (
      auth_role() = 'technician'
      and job_id in (
        select id from jobs
        where technician_id = auth_technician_id()
      )
    )
  );


-- ── job_notes ───────────────────────────────────────────────

create policy "job_notes_select"
  on job_notes for select
  to authenticated
  using (
    (organization_id = auth_org_id() and auth_role() in ('owner', 'admin', 'dispatcher'))
    or
    (
      auth_role() = 'technician'
      and job_id in (
        select id from jobs where technician_id = auth_technician_id()
      )
    )
  );

create policy "job_notes_insert"
  on job_notes for insert
  to authenticated
  with check (
    organization_id = auth_org_id()
    and author_profile_id = auth.uid()
    and (
      auth_role() in ('owner', 'admin', 'dispatcher')
      or (
        auth_role() = 'technician'
        and job_id in (
          select id from jobs where technician_id = auth_technician_id()
        )
      )
    )
  );

create policy "job_notes_update_own"
  on job_notes for update
  to authenticated
  using    (author_profile_id = auth.uid() and organization_id = auth_org_id())
  with check (author_profile_id = auth.uid() and organization_id = auth_org_id());

create policy "job_notes_delete_admin"
  on job_notes for delete
  to authenticated
  using (organization_id = auth_org_id() and auth_role() in ('owner', 'admin'));


-- ── job_photos ──────────────────────────────────────────────

create policy "job_photos_select"
  on job_photos for select
  to authenticated
  using (
    (organization_id = auth_org_id() and auth_role() in ('owner', 'admin', 'dispatcher'))
    or
    (
      auth_role() = 'technician'
      and job_id in (select id from jobs where technician_id = auth_technician_id())
    )
    or
    (
      auth_role() = 'client'
      and job_id in (select id from jobs where client_id = auth_client_id())
    )
  );

create policy "job_photos_insert"
  on job_photos for insert
  to authenticated
  with check (
    organization_id = auth_org_id()
    and uploaded_by_profile_id = auth.uid()
    and (
      auth_role() in ('owner', 'admin', 'dispatcher')
      or (
        auth_role() = 'technician'
        and job_id in (select id from jobs where technician_id = auth_technician_id())
      )
    )
  );

create policy "job_photos_delete_admin"
  on job_photos for delete
  to authenticated
  using (organization_id = auth_org_id() and auth_role() in ('owner', 'admin'));


-- ── invoices ────────────────────────────────────────────────

create policy "invoices_select"
  on invoices for select
  to authenticated
  using (
    (organization_id = auth_org_id() and auth_role() in ('owner', 'admin', 'dispatcher'))
    or
    (client_id = auth_client_id() and auth_role() = 'client')
  );

create policy "invoices_insert_admin"
  on invoices for insert
  to authenticated
  with check (
    organization_id = auth_org_id()
    and auth_role() in ('owner', 'admin')
  );

create policy "invoices_update_admin"
  on invoices for update
  to authenticated
  using    (organization_id = auth_org_id() and auth_role() in ('owner', 'admin'))
  with check (organization_id = auth_org_id() and auth_role() in ('owner', 'admin'));

create policy "invoices_delete_owner"
  on invoices for delete
  to authenticated
  using (organization_id = auth_org_id() and auth_role() = 'owner');


-- ── invoice_items ───────────────────────────────────────────

create policy "invoice_items_select"
  on invoice_items for select
  to authenticated
  using (
    (organization_id = auth_org_id() and auth_role() in ('owner', 'admin', 'dispatcher'))
    or
    (
      auth_role() = 'client'
      and invoice_id in (
        select id from invoices where client_id = auth_client_id()
      )
    )
  );

create policy "invoice_items_insert_admin"
  on invoice_items for insert
  to authenticated
  with check (organization_id = auth_org_id() and auth_role() in ('owner', 'admin'));

create policy "invoice_items_update_admin"
  on invoice_items for update
  to authenticated
  using    (organization_id = auth_org_id() and auth_role() in ('owner', 'admin'))
  with check (organization_id = auth_org_id() and auth_role() in ('owner', 'admin'));

create policy "invoice_items_delete_admin"
  on invoice_items for delete
  to authenticated
  using (organization_id = auth_org_id() and auth_role() in ('owner', 'admin'));


-- ── company_settings ────────────────────────────────────────

create policy "company_settings_select"
  on company_settings for select
  to authenticated
  using (organization_id = auth_org_id());

create policy "company_settings_update_owner"
  on company_settings for update
  to authenticated
  using    (organization_id = auth_org_id() and auth_role() = 'owner')
  with check (organization_id = auth_org_id() and auth_role() = 'owner');


-- ============================================================
-- END OF MIGRATION
-- ============================================================
--
-- Summary:
--   Tables:         13
--   Enums:           9
--   Indexes:        30
--   Trigger fns:     3  (set_updated_at, fn_record_job_status_change, fn_record_job_status_insert)
--   Triggers:       11  (9× updated_at + 2× job_status_history)
--   RLS helper fns:  4  (auth_org_id, auth_role, auth_technician_id, auth_client_id)
--   RLS policies:   43
--
-- Revision history:
--   Rev 2 (2026-05-23): Applied decisions from Phase 2B-A review:
--     - invoice_items.total → GENERATED ALWAYS AS (round(qty * price, 2)) STORED
--     - invoices.tax_rate   → default 0 (not 0.10); preserved at invoice creation time
--     - company_settings.tax_rate → nullable (no global default)
--     - auth_client_id()   → removed is_primary = true restriction
--     - job_notes constraint → XOR (exactly one parent) using num_nonnulls()
--     - dispatcher job INSERT confirmed as intended (no change, already correct)
--
-- DRAFT — awaiting approval before applying to Supabase.
-- ============================================================

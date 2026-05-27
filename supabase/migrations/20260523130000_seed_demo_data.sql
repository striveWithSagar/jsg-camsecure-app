-- ============================================================
-- CamSecure Operations — Demo Seed Data
-- File: 20260523130000_seed_demo_data.sql
--
-- DRAFT — do not apply without explicit approval.
--
-- Mirrors mock data from src/lib/constants.ts and
-- src/lib/mock-session.ts for Phase 3 demo / testing use.
--
-- Fixed UUIDs ensure stable FK relationships.
-- Profiles use placeholder UUIDs — NO auth.users rows exist.
-- Does NOT modify auth schema.
-- Does NOT alter or drop any schema objects.
-- Safe to apply on top of 20260523120000_create_base_schema.sql.
-- ============================================================


-- ============================================================
-- UUID LEGEND (prefix: a0000000-0000-0000-0000-XXXXXXXXXXXX)
-- ============================================================
--
-- ORGANIZATION
--   JSG CamSecure            a0000000-0000-0000-0000-000000000001
--
-- PROFILES  (placeholder — no matching auth.users row)
--   JSG Admin                a0000000-0000-0000-0000-000000000010
--   Alex Rivera (tech)       a0000000-0000-0000-0000-000000000011
--   Sam Chen (tech)          a0000000-0000-0000-0000-000000000012
--   Jordan Kim (tech)        a0000000-0000-0000-0000-000000000013
--   Taylor Reyes (tech)      a0000000-0000-0000-0000-000000000014
--   Morgan Davis (tech)      a0000000-0000-0000-0000-000000000015
--
-- CLIENTS
--   Metro Security Ltd       a0000000-0000-0000-0000-000000000101
--   City Bank Branch         a0000000-0000-0000-0000-000000000102
--   Green Valley Mall        a0000000-0000-0000-0000-000000000103
--   Harbor Logistics         a0000000-0000-0000-0000-000000000104
--   Sunrise Hotel            a0000000-0000-0000-0000-000000000105
--   Tech Park Office         a0000000-0000-0000-0000-000000000106
--   Riverside School         a0000000-0000-0000-0000-000000000107
--
-- CLIENT CONTACTS  (profile_id = NULL — no portal login yet)
--   David Park (Metro)       a0000000-0000-0000-0000-000000000201
--   Linda Torres (City Bank) a0000000-0000-0000-0000-000000000202
--   Mike Johnson (GVM)       a0000000-0000-0000-0000-000000000203
--   Sarah Wu (Harbor)        a0000000-0000-0000-0000-000000000204
--   James Lee (Sunrise)      a0000000-0000-0000-0000-000000000205
--   Amy Chen (Tech Park)     a0000000-0000-0000-0000-000000000206
--   Pat Miller (Riverside)   a0000000-0000-0000-0000-000000000207
--
-- TECHNICIANS
--   Alex Rivera              a0000000-0000-0000-0000-000000000301
--   Sam Chen                 a0000000-0000-0000-0000-000000000302
--   Jordan Kim               a0000000-0000-0000-0000-000000000303
--   Taylor Reyes             a0000000-0000-0000-0000-000000000304
--   Morgan Davis             a0000000-0000-0000-0000-000000000305
--
-- SERVICE REQUESTS  (callers not in clients table → client_id=NULL)
--   REQ-001 Apex Tower Mgmt  a0000000-0000-0000-0000-000000000401
--   REQ-002 First Natl Bank  a0000000-0000-0000-0000-000000000402
--   REQ-003 Parkview Condos  a0000000-0000-0000-0000-000000000403
--   REQ-004 Sunrise Retail   a0000000-0000-0000-0000-000000000404
--   REQ-005 Lakeside Clinic  a0000000-0000-0000-0000-000000000405
--
-- JOBS
--   JOB-001                  a0000000-0000-0000-0000-000000000501
--   JOB-002                  a0000000-0000-0000-0000-000000000502
--   JOB-003                  a0000000-0000-0000-0000-000000000503
--   JOB-004                  a0000000-0000-0000-0000-000000000504
--   JOB-005                  a0000000-0000-0000-0000-000000000505
--   JOB-006                  a0000000-0000-0000-0000-000000000506
--   JOB-007                  a0000000-0000-0000-0000-000000000507
--   JOB-008                  a0000000-0000-0000-0000-000000000508
--   JOB-009                  a0000000-0000-0000-0000-000000000509
--   JOB-010                  a0000000-0000-0000-0000-000000000510
--   JOB-011                  a0000000-0000-0000-0000-000000000511
--   JOB-012                  a0000000-0000-0000-0000-000000000512
--   JOB-013                  a0000000-0000-0000-0000-000000000513
--
-- INVOICES
--   INV-001                  a0000000-0000-0000-0000-000000000601
--   INV-002                  a0000000-0000-0000-0000-000000000602
--   INV-003                  a0000000-0000-0000-0000-000000000603
--   INV-004                  a0000000-0000-0000-0000-000000000604
--   INV-005                  a0000000-0000-0000-0000-000000000605
--   INV-006                  a0000000-0000-0000-0000-000000000606
--   INV-007                  a0000000-0000-0000-0000-000000000607
--
-- INVOICE ITEMS  (one per invoice)
--   Item for INV-001         a0000000-0000-0000-0000-000000000701
--   Item for INV-002         a0000000-0000-0000-0000-000000000702
--   Item for INV-003         a0000000-0000-0000-0000-000000000703
--   Item for INV-004         a0000000-0000-0000-0000-000000000704
--   Item for INV-005         a0000000-0000-0000-0000-000000000705
--   Item for INV-006         a0000000-0000-0000-0000-000000000706
--   Item for INV-007         a0000000-0000-0000-0000-000000000707
-- ============================================================


-- ── §1  ORGANIZATION ─────────────────────────────────────────

insert into organizations (id, name, slug, email, phone)
values (
  'a0000000-0000-0000-0000-000000000001',
  'JSG CamSecure',
  'jsg-camsecure',
  'admin@jsg.com',
  '555-0000'
);


-- ── §2  COMPANY SETTINGS ─────────────────────────────────────

insert into company_settings (organization_id, business_name, invoice_prefix, tax_rate)
values (
  'a0000000-0000-0000-0000-000000000001',
  'JSG CamSecure Operations',
  'INV',
  null  -- not yet configured; app treats null as 0 at invoice creation time
);


-- ── §3  PROFILES ─────────────────────────────────────────────
-- profiles.id has no FK to auth.users — the constraint is by convention only.
-- Placeholder UUIDs are used here so technicians can be linked via profile_id.
-- These will be replaced with real auth.users IDs in Phase 8.

insert into profiles (id, organization_id, role, full_name, email, phone, initials)
values
  ('a0000000-0000-0000-0000-000000000010',
   'a0000000-0000-0000-0000-000000000001',
   'admin', 'JSG Admin', 'admin@jsg.com', null, 'JG'),

  ('a0000000-0000-0000-0000-000000000011',
   'a0000000-0000-0000-0000-000000000001',
   'technician', 'Alex Rivera', 'a.rivera@camsecure.com', '555-2001', 'AR'),

  ('a0000000-0000-0000-0000-000000000012',
   'a0000000-0000-0000-0000-000000000001',
   'technician', 'Sam Chen', 's.chen@camsecure.com', '555-2002', 'SC'),

  ('a0000000-0000-0000-0000-000000000013',
   'a0000000-0000-0000-0000-000000000001',
   'technician', 'Jordan Kim', 'j.kim@camsecure.com', '555-2003', 'JK'),

  ('a0000000-0000-0000-0000-000000000014',
   'a0000000-0000-0000-0000-000000000001',
   'technician', 'Taylor Reyes', 't.reyes@camsecure.com', '555-2004', 'TR'),

  ('a0000000-0000-0000-0000-000000000015',
   'a0000000-0000-0000-0000-000000000001',
   'technician', 'Morgan Davis', 'm.davis@camsecure.com', '555-2005', 'MD');


-- ── §4  CLIENTS ──────────────────────────────────────────────
-- 6 from MOCK_CLIENTS + Riverside School (needed by JOB-007, JOB-009).

insert into clients (id, organization_id, name, status)
values
  ('a0000000-0000-0000-0000-000000000101',
   'a0000000-0000-0000-0000-000000000001', 'Metro Security Ltd',  'active'),

  ('a0000000-0000-0000-0000-000000000102',
   'a0000000-0000-0000-0000-000000000001', 'City Bank Branch',    'active'),

  ('a0000000-0000-0000-0000-000000000103',
   'a0000000-0000-0000-0000-000000000001', 'Green Valley Mall',   'active'),

  ('a0000000-0000-0000-0000-000000000104',
   'a0000000-0000-0000-0000-000000000001', 'Harbor Logistics',    'active'),

  ('a0000000-0000-0000-0000-000000000105',
   'a0000000-0000-0000-0000-000000000001', 'Sunrise Hotel',       'inactive'),

  ('a0000000-0000-0000-0000-000000000106',
   'a0000000-0000-0000-0000-000000000001', 'Tech Park Office',    'active'),

  ('a0000000-0000-0000-0000-000000000107',
   'a0000000-0000-0000-0000-000000000001', 'Riverside School',    'active');


-- ── §5  CLIENT CONTACTS ──────────────────────────────────────
-- One primary contact per client.
-- profile_id = NULL — no client portal login exists yet.

insert into client_contacts
  (id, organization_id, client_id, full_name, email, phone, is_primary)
values
  ('a0000000-0000-0000-0000-000000000201',
   'a0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000101',
   'David Park', 'd.park@metro.com', '555-1001', true),

  ('a0000000-0000-0000-0000-000000000202',
   'a0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000102',
   'Linda Torres', 'l.torres@citybank.com', '555-1002', true),

  ('a0000000-0000-0000-0000-000000000203',
   'a0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000103',
   'Mike Johnson', 'm.johnson@gvm.com', '555-1003', true),

  ('a0000000-0000-0000-0000-000000000204',
   'a0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000104',
   'Sarah Wu', 's.wu@harbor.com', '555-1004', true),

  ('a0000000-0000-0000-0000-000000000205',
   'a0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000105',
   'James Lee', 'j.lee@sunrise.com', '555-1005', true),

  ('a0000000-0000-0000-0000-000000000206',
   'a0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000106',
   'Amy Chen', 'a.chen@techpark.com', '555-1006', true),

  ('a0000000-0000-0000-0000-000000000207',
   'a0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000107',
   'Pat Miller', 'p.miller@riverside.edu', '555-1007', true);


-- ── §6  TECHNICIANS ──────────────────────────────────────────

insert into technicians (id, organization_id, profile_id, specialty, status)
values
  ('a0000000-0000-0000-0000-000000000301',
   'a0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000011',
   'Installation & Networking', 'on_job'),

  ('a0000000-0000-0000-0000-000000000302',
   'a0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000012',
   'DVR/NVR Systems', 'on_the_way'),

  ('a0000000-0000-0000-0000-000000000303',
   'a0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000013',
   'CCTV & IP Cameras', 'available'),

  ('a0000000-0000-0000-0000-000000000304',
   'a0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000014',
   'Access Control', 'available'),

  ('a0000000-0000-0000-0000-000000000305',
   'a0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000015',
   'Wiring & Cabling', 'on_job');


-- ── §7  SERVICE REQUESTS ─────────────────────────────────────
-- All 5 from MOCK_REQUESTS.
-- None of the callers exist as client rows — client_id = NULL,
-- client_name carries the free-text company name from the mock.
-- converted_to_job_id is NULL for all rows here;
-- REQ-004 is linked to JOB-005 after jobs are inserted (§9).

insert into service_requests (
  id, organization_id,
  client_name, client_phone,
  service_type, urgency, status,
  description, notes,
  created_at, updated_at
)
values
  -- REQ-001: Apex Tower Management, camera outage, emergency, new
  ('a0000000-0000-0000-0000-000000000401',
   'a0000000-0000-0000-0000-000000000001',
   'Apex Tower Management', '555-0101',
   'camera_outage', 'emergency', 'new',
   '3 cameras on floor 5 stopped recording overnight. DVR shows no signal for cameras 5A, 5B, 5C.',
   'Premium contract — prioritise. Call David Park before dispatching.',
   '2026-05-23 08:00:00+00', '2026-05-23 08:00:00+00'),

  -- REQ-002: First National Bank, new installation, medium, reviewing
  ('a0000000-0000-0000-0000-000000000402',
   'a0000000-0000-0000-0000-000000000001',
   'First National Bank', '555-0202',
   'new_installation', 'medium', 'reviewing',
   'Requesting 8-camera system for new branch location at 400 Commerce St.',
   'Site survey required first. Sam Chen did their previous install.',
   '2026-05-23 05:00:00+00', '2026-05-23 05:00:00+00'),

  -- REQ-003: Parkview Condos, DVR/NVR issue, high, ready_to_schedule
  ('a0000000-0000-0000-0000-000000000403',
   'a0000000-0000-0000-0000-000000000001',
   'Parkview Condos', '555-0303',
   'dvr_nvr_issue', 'high', 'ready_to_schedule',
   'DVR not accessible remotely since firmware update on May 14. All remote sessions timing out.',
   'Jordan Kim reviewed — firmware rollback needed. Schedule for next available slot.',
   '2026-05-22 10:00:00+00', '2026-05-22 10:00:00+00'),

  -- REQ-004: Sunrise Retail, maintenance, low, converted → JOB-005 (set in §9)
  ('a0000000-0000-0000-0000-000000000404',
   'a0000000-0000-0000-0000-000000000001',
   'Sunrise Retail', '555-0404',
   'maintenance', 'low', 'converted',
   'Annual maintenance check for 12-camera system.',
   'Converted to JOB-005. Alex Rivera assigned.',
   '2026-05-21 10:00:00+00', '2026-05-21 10:00:00+00'),

  -- REQ-005: Lakeside Clinic, mobile app issue, medium, new
  ('a0000000-0000-0000-0000-000000000405',
   'a0000000-0000-0000-0000-000000000001',
   'Lakeside Clinic', '555-0505',
   'mobile_app_issue', 'medium', 'new',
   'Staff cannot access live feed on iOS and Android. Error: stream timeout after 30 seconds.',
   '',
   '2026-05-20 10:00:00+00', '2026-05-20 10:00:00+00');


-- ── §8  JOBS ─────────────────────────────────────────────────
-- All 13 jobs from MOCK_JOBS, inserted in JOB-001..013 order.
-- The trg_job_status_on_insert trigger fires on each INSERT and
-- auto-creates one job_status_history row per job (old_status = null).
-- JOB-005 sets request_id = REQ-004 (already exists in §7).
-- "Today" timestamps = 2026-05-23; "Tomorrow" = 2026-05-24.

insert into jobs (
  id, organization_id,
  request_id, client_id, technician_id,
  site_name, address,
  service_type, priority, status,
  scheduled_at, completed_at,
  dispatcher_notes
)
values
  -- JOB-001: Metro / Downtown Office Tower, emergency camera outage, in_progress, Alex Rivera
  ('a0000000-0000-0000-0000-000000000501',
   'a0000000-0000-0000-0000-000000000001',
   null,
   'a0000000-0000-0000-0000-000000000101',
   'a0000000-0000-0000-0000-000000000301',
   'Downtown Office Tower', '123 Main St, Downtown',
   'camera_outage', 'emergency', 'in_progress',
   '2026-05-23 09:00:00+00', null, ''),

  -- JOB-002: City Bank / Eastside Branch, DVR/NVR issue, on_the_way, Sam Chen
  ('a0000000-0000-0000-0000-000000000502',
   'a0000000-0000-0000-0000-000000000001',
   null,
   'a0000000-0000-0000-0000-000000000102',
   'a0000000-0000-0000-0000-000000000302',
   'Eastside Branch', '456 East Ave',
   'dvr_nvr_issue', 'high', 'on_the_way',
   '2026-05-23 11:30:00+00', null, ''),

  -- JOB-003: Green Valley Mall / Main Entrance, new installation, assigned, Jordan Kim
  ('a0000000-0000-0000-0000-000000000503',
   'a0000000-0000-0000-0000-000000000001',
   null,
   'a0000000-0000-0000-0000-000000000103',
   'a0000000-0000-0000-0000-000000000303',
   'Main Entrance', '789 Valley Rd',
   'new_installation', 'medium', 'assigned',
   '2026-05-23 14:00:00+00', null, ''),

  -- JOB-004: Harbor Logistics / Warehouse B, wiring issue, needs_parts, Taylor Reyes
  ('a0000000-0000-0000-0000-000000000504',
   'a0000000-0000-0000-0000-000000000001',
   null,
   'a0000000-0000-0000-0000-000000000104',
   'a0000000-0000-0000-0000-000000000304',
   'Warehouse B', '10 Harbor Way',
   'wiring_issue', 'low', 'needs_parts',
   '2026-05-23 16:00:00+00', null, ''),

  -- JOB-005: Sunrise Hotel / Lobby & Parking, maintenance, completed, Alex Rivera
  --          Converted from REQ-004 (request_id set here; converted_to_job_id set in §9)
  ('a0000000-0000-0000-0000-000000000505',
   'a0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000404',
   'a0000000-0000-0000-0000-000000000105',
   'a0000000-0000-0000-0000-000000000301',
   'Lobby & Parking', '55 Sunrise Blvd',
   'maintenance', 'medium', 'completed',
   '2026-05-15 09:00:00+00', '2026-05-15 17:00:00+00', ''),

  -- JOB-006: Tech Park / Floor 3, site inspection, rescheduled, Sam Chen
  ('a0000000-0000-0000-0000-000000000506',
   'a0000000-0000-0000-0000-000000000001',
   null,
   'a0000000-0000-0000-0000-000000000106',
   'a0000000-0000-0000-0000-000000000302',
   'Floor 3', '200 Tech Park Dr',
   'site_inspection', 'low', 'rescheduled',
   '2026-05-24 10:00:00+00', null, ''),

  -- JOB-007: Riverside School / All Entrances, new installation, started, Morgan Davis
  ('a0000000-0000-0000-0000-000000000507',
   'a0000000-0000-0000-0000-000000000001',
   null,
   'a0000000-0000-0000-0000-000000000107',
   'a0000000-0000-0000-0000-000000000305',
   'All Entrances', '88 River Rd',
   'new_installation', 'high', 'started',
   '2026-05-23 13:00:00+00', null, ''),

  -- JOB-008: Metro / East Wing Level 3, DVR/NVR issue, in_progress, Alex Rivera
  ('a0000000-0000-0000-0000-000000000508',
   'a0000000-0000-0000-0000-000000000001',
   null,
   'a0000000-0000-0000-0000-000000000101',
   'a0000000-0000-0000-0000-000000000301',
   'East Wing Level 3', '123 Main St, East Wing',
   'dvr_nvr_issue', 'medium', 'in_progress',
   '2026-05-23 15:30:00+00', null, ''),

  -- JOB-009: Riverside School / Gymnasium Entrance, new installation, assigned, Alex Rivera
  ('a0000000-0000-0000-0000-000000000509',
   'a0000000-0000-0000-0000-000000000001',
   null,
   'a0000000-0000-0000-0000-000000000107',
   'a0000000-0000-0000-0000-000000000301',
   'Gymnasium Entrance', '88 River Rd',
   'new_installation', 'medium', 'assigned',
   '2026-05-24 09:00:00+00', null, ''),

  -- JOB-010: Metro / Parking Structure B, maintenance, completed, Alex Rivera
  ('a0000000-0000-0000-0000-000000000510',
   'a0000000-0000-0000-0000-000000000001',
   null,
   'a0000000-0000-0000-0000-000000000101',
   'a0000000-0000-0000-0000-000000000301',
   'Parking Structure B', '123 Main St, Parking',
   'maintenance', 'low', 'completed',
   '2026-05-16 09:00:00+00', '2026-05-16 16:00:00+00', ''),

  -- JOB-011: Metro / Lobby Reception, camera outage, assigned, Sam Chen
  ('a0000000-0000-0000-0000-000000000511',
   'a0000000-0000-0000-0000-000000000001',
   null,
   'a0000000-0000-0000-0000-000000000101',
   'a0000000-0000-0000-0000-000000000302',
   'Lobby Reception', '123 Main St, Lobby',
   'camera_outage', 'high', 'assigned',
   '2026-05-23 13:30:00+00', null, ''),

  -- JOB-012: Metro / Car Park Level 2, new installation, assigned, Jordan Kim
  ('a0000000-0000-0000-0000-000000000512',
   'a0000000-0000-0000-0000-000000000001',
   null,
   'a0000000-0000-0000-0000-000000000101',
   'a0000000-0000-0000-0000-000000000303',
   'Car Park Level 2', '123 Main St, Car Park',
   'new_installation', 'medium', 'assigned',
   '2026-05-24 14:00:00+00', null, ''),

  -- JOB-013: Metro / Server Room, DVR/NVR issue, completed, Sam Chen
  ('a0000000-0000-0000-0000-000000000513',
   'a0000000-0000-0000-0000-000000000001',
   null,
   'a0000000-0000-0000-0000-000000000101',
   'a0000000-0000-0000-0000-000000000302',
   'Server Room', '123 Main St, Server Room',
   'dvr_nvr_issue', 'high', 'completed',
   '2026-05-14 09:00:00+00', '2026-05-14 15:00:00+00', '');


-- ── §9  LINK CONVERTED REQUEST → JOB ─────────────────────────
-- REQ-004 was converted to JOB-005. Set the forward FK now that
-- JOB-005 exists.

update service_requests
set    converted_to_job_id = 'a0000000-0000-0000-0000-000000000505',
       updated_at          = '2026-05-21 11:00:00+00'
where  id = 'a0000000-0000-0000-0000-000000000404';


-- ── §10  INVOICES ────────────────────────────────────────────
-- 7 invoices from MOCK_INVOICES.
-- tax_rate = 0 (company_settings.tax_rate is null → app defaults to 0).
-- subtotal = total (no tax). tax_amount = 0.
-- paid_at is set for paid invoices; null otherwise.

insert into invoices (
  id, organization_id,
  client_id, job_id,
  invoice_number, status,
  issued_at, due_at, paid_at,
  subtotal, tax_rate, tax_amount, total
)
values
  -- INV-001: Metro / JOB-010 (Parking Structure B maintenance), $2 400, unpaid
  ('a0000000-0000-0000-0000-000000000601',
   'a0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000101',
   'a0000000-0000-0000-0000-000000000510',
   'INV-001', 'unpaid',
   '2026-05-17 00:00:00+00', '2026-05-31 00:00:00+00', null,
   2400.00, 0, 0.00, 2400.00),

  -- INV-002: City Bank / JOB-002 (Eastside Branch DVR/NVR), $1 850, paid
  ('a0000000-0000-0000-0000-000000000602',
   'a0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000102',
   'a0000000-0000-0000-0000-000000000502',
   'INV-002', 'paid',
   '2026-05-10 00:00:00+00', '2026-05-24 00:00:00+00', '2026-05-20 00:00:00+00',
   1850.00, 0, 0.00, 1850.00),

  -- INV-003: Sunrise Hotel / JOB-005 (Lobby & Parking maintenance), $650, overdue
  ('a0000000-0000-0000-0000-000000000603',
   'a0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000105',
   'a0000000-0000-0000-0000-000000000505',
   'INV-003', 'overdue',
   '2026-04-28 00:00:00+00', '2026-05-12 00:00:00+00', null,
   650.00, 0, 0.00, 650.00),

  -- INV-004: Green Valley Mall / JOB-003 (Main Entrance installation), $4 200, unpaid
  ('a0000000-0000-0000-0000-000000000604',
   'a0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000103',
   'a0000000-0000-0000-0000-000000000503',
   'INV-004', 'unpaid',
   '2026-05-13 00:00:00+00', '2026-05-27 00:00:00+00', null,
   4200.00, 0, 0.00, 4200.00),

  -- INV-005: Harbor Logistics / JOB-004 (Warehouse B wiring), $980, paid
  ('a0000000-0000-0000-0000-000000000605',
   'a0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000104',
   'a0000000-0000-0000-0000-000000000504',
   'INV-005', 'paid',
   '2026-05-08 00:00:00+00', '2026-05-22 00:00:00+00', '2026-05-15 00:00:00+00',
   980.00, 0, 0.00, 980.00),

  -- INV-006: Metro / JOB-013 (Server Room DVR/NVR), $1 200, paid
  ('a0000000-0000-0000-0000-000000000606',
   'a0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000101',
   'a0000000-0000-0000-0000-000000000513',
   'INV-006', 'paid',
   '2026-05-15 00:00:00+00', '2026-05-29 00:00:00+00', '2026-05-22 00:00:00+00',
   1200.00, 0, 0.00, 1200.00),

  -- INV-007: Metro / JOB-001 (Downtown Office Tower emergency), $3 500, unpaid
  ('a0000000-0000-0000-0000-000000000607',
   'a0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000101',
   'a0000000-0000-0000-0000-000000000501',
   'INV-007', 'unpaid',
   '2026-05-14 00:00:00+00', '2026-05-28 00:00:00+00', null,
   3500.00, 0, 0.00, 3500.00);


-- ── §11  INVOICE ITEMS ───────────────────────────────────────
-- One line item per invoice. Mock data has totals only — no itemisation.
-- IMPORTANT: do NOT include the `total` column — it is GENERATED ALWAYS AS.
-- Postgres computes total = round(quantity * unit_price, 2) automatically.

insert into invoice_items (
  id, organization_id, invoice_id,
  description, quantity, unit_price,
  sort_order
)
values
  ('a0000000-0000-0000-0000-000000000701',
   'a0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000601',
   'Security system maintenance — Parking Structure B',
   1, 2400.00, 0),

  ('a0000000-0000-0000-0000-000000000702',
   'a0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000602',
   'DVR/NVR system repair — Eastside Branch',
   1, 1850.00, 0),

  ('a0000000-0000-0000-0000-000000000703',
   'a0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000603',
   'CCTV maintenance — Lobby & Parking',
   1, 650.00, 0),

  ('a0000000-0000-0000-0000-000000000704',
   'a0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000604',
   'New CCTV installation — Main Entrance',
   1, 4200.00, 0),

  ('a0000000-0000-0000-0000-000000000705',
   'a0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000605',
   'Wiring repair — Warehouse B',
   1, 980.00, 0),

  ('a0000000-0000-0000-0000-000000000706',
   'a0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000606',
   'DVR/NVR repair — Server Room',
   1, 1200.00, 0),

  ('a0000000-0000-0000-0000-000000000707',
   'a0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000607',
   'Emergency camera repair — Downtown Office Tower',
   1, 3500.00, 0);


-- ============================================================
-- END OF SEED MIGRATION
--
-- Summary of rows inserted:
--   organizations:       1
--   company_settings:    1
--   profiles:            6  (1 admin + 5 technicians, placeholder UUIDs)
--   clients:             7  (6 from MOCK_CLIENTS + Riverside School)
--   client_contacts:     7  (one primary per client, profile_id = NULL)
--   technicians:         5
--   service_requests:    5
--   jobs:               13
--   job_status_history: 13  (auto-inserted by trg_job_status_on_insert)
--   invoices:            7
--   invoice_items:       7
--
-- Tables with 0 rows (no mock data exists):
--   job_notes, job_photos
--
-- Intentionally skipped:
--   auth.users  — Phase 8+
--   client portal profiles  — client_contacts.profile_id = NULL
-- ============================================================

# Supabase Migration Phases — CamSecure

> Each phase must be approved before the next begins.
> The mock store and localStorage remain active until a phase explicitly replaces them.
> The app must remain fully functional after every phase.

---

## Phase 2B — Base Schema SQL Migration

**Goal:** Create all tables, enums, indexes, and RLS scaffolding in the Supabase public schema. No data yet.

**Files likely affected:**
- New: `supabase/migrations/001_base_schema.sql` (or applied via MCP `apply_migration`)
- None of the `src/` app files change

**What to create:**
- All enums (`user_role`, `job_status`, `job_priority`, etc.)
- All 13 tables in dependency order
- All indexes
- `auth_org_id()`, `auth_role()`, `auth_technician_id()`, `auth_client_id()` helper functions
- RLS enabled on every table
- `organizations` and `profiles` RLS policies (the only two policies needed before Phase 3)
- `job_status_history` trigger on `jobs.status` update

**What to test:**
- Supabase dashboard shows all tables
- RLS is enabled (shows lock icon in table editor)
- No TypeScript changes → `npm run build` still passes

**Rollback plan:**
- Drop all tables and enums in reverse order
- App continues running on mock store — zero user impact

**What stays mock:** Everything in the frontend. The app never touches these tables until Phase 4.

---

## Phase 3 — Seed Demo Organisation, Clients, Technicians, Requests, Jobs

**Goal:** Populate the database with the same data currently in `constants.ts` so Phase 4 has real rows to query.

**Files likely affected:**
- New: `supabase/migrations/002_seed_demo.sql` (or applied via MCP)
- None of the `src/` app files change

**What to seed:**
- 1 `organizations` row: JSG CamSecure
- 1 `company_settings` row
- 6 `clients` rows (from `MOCK_CLIENTS`)
- 6 `client_contacts` rows (primary contact per client)
- 5 `profiles` rows for technicians (no real `auth.users` — use placeholder UUIDs until auth is live)
- 5 `technicians` rows (from `MOCK_TECHNICIANS`)
- 1 `profiles` row for admin
- 5 `service_requests` rows (from `MOCK_REQUESTS`)
- 13 `jobs` rows (from `MOCK_JOBS`)
- 7 `invoices` rows (from `MOCK_INVOICES`)

**What to test:**
- Query each table via MCP `execute_sql` and confirm row counts match mock data
- Verify FK relationships are intact (no orphaned rows)
- `npm run build` still passes — app still uses mock store

**Rollback plan:**
- Truncate all tables (data only, schema stays)
- App unaffected — still on mock store

**What stays mock:** Everything in the frontend.

---

## Phase 4 — Add Supabase Read-Only Queries for Service Requests

**Goal:** The admin `/requests` page reads from Supabase instead of `MOCK_REQUESTS`. The mock store still handles writes.

**Files likely affected:**
- `src/app/(dashboard)/requests/page.tsx` — replace `useMockStore().requests` with a server-side Supabase query
- `src/lib/supabase/queries/requests.ts` — new file: typed query functions
- `src/lib/types/request.ts` — new file: DB row types (replace `MockRequestItem`)

**What to test:**
- `/requests` page loads and shows the 5 seeded requests
- Filters and status counts still work
- Other portals (technician, client) unaffected
- No regression on job board, clients, invoices pages
- `npm run build` + `npm run lint` pass

**Rollback plan:**
- Revert `requests/page.tsx` to `useMockStore().requests`
- Delete `src/lib/supabase/queries/requests.ts`

**What stays mock:**
- Request creation (`addRequest`)
- Request status updates (`updateRequestStatus`)
- Request notes (`updateRequestNotes`)
- All job, client, invoice, technician data
- Auth / session

---

## Phase 5 — Replace Admin Request Creation with Supabase Insert

**Goal:** `addRequest` (currently in mock store) becomes a Supabase insert. The client submission form and the admin new-request form both write to the DB.

**Files likely affected:**
- `src/app/(dashboard)/requests/new/page.tsx`
- `src/components/requests/NewRequestForm.tsx`
- `src/app/(client)/client/requests/new/page.tsx`
- `src/lib/supabase/mutations/requests.ts` — new file

**What to test:**
- Submit a new request as admin → appears in `/requests` with correct status `'new'`
- Submit a new request as client → appears in admin view
- Success screen still shows after client submission
- Existing 5 seeded requests still visible

**Rollback plan:**
- Revert form components to call `store.addRequest()` instead of Supabase insert

**What stays mock:** All job data, status updates, notes, client portal reads, technician portal.

---

## Phase 6 — Replace Request-to-Job Conversion

**Goal:** The "Convert to Job" flow writes a real `jobs` row and updates `service_requests.converted_to_job_id`.

**Files likely affected:**
- `src/app/(dashboard)/requests/[id]/convert/page.tsx`
- `src/components/requests/ConvertJobForm.tsx`
- `src/lib/supabase/mutations/jobs.ts` — new file
- `src/app/(dashboard)/requests/[id]/page.tsx` — reads request detail from DB

**What to test:**
- Open a seeded request → convert it → new job appears in `/jobs`
- Original request status changes to `'converted'`
- `converted_to_job_id` is set on the request row
- `job_status_history` has an initial row for the new job

**Rollback plan:**
- Revert `ConvertJobForm.tsx` to use `store.convertToJob()`

**What stays mock:** Job board reads, job detail, technician portal, client portal.

---

## Phase 7 — Replace Job Board and Job Detail Data

**Goal:** `/jobs` and `/jobs/[id]` read from Supabase. Admin can update job assignment and priority.

**Files likely affected:**
- `src/app/(dashboard)/jobs/page.tsx`
- `src/app/(dashboard)/jobs/[id]/page.tsx`
- `src/components/jobs/JobDetail.tsx`
- `src/lib/supabase/queries/jobs.ts` — new file

**What to test:**
- Job board shows all jobs with correct status columns
- Job detail shows correct client, technician, address, priority
- Admin can reassign technician → change persists on refresh
- `job_status_history` appends on every status change (via trigger)

**Rollback plan:**
- Revert page files to use `useMockStore().jobs`

**What stays mock:** Technician portal, client portal.

---

## Phase 8 — Replace Technician Job Status Updates

**Goal:** Technician portal reads own jobs from Supabase. Status widget writes to DB.

**Files likely affected:**
- `src/app/(technician)/technician/page.tsx` (TechnicianDashboardView)
- `src/app/(technician)/technician/jobs/page.tsx`
- `src/app/(technician)/technician/jobs/[id]/page.tsx`
- `src/components/technician/TechJobDetail.tsx`
- `src/components/technician/JobStatusWidget.tsx`
- `src/lib/supabase/queries/jobs.ts` — extend with technician-scoped filter

**What to test:**
- Technician dashboard shows only Alex Rivera's jobs
- Status widget updates persist across page reloads
- `job_status_history` has new row after each status change
- Admin job board reflects technician's status change in real time

**Rollback plan:**
- Revert technician pages to `useMockStore().jobs` filtered by name

**What stays mock:** Client portal, auth.

---

## Phase 9 — Replace Client Portal Data

**Goal:** Client portal reads own jobs and invoices from Supabase.

**Files likely affected:**
- `src/app/(client)/client/page.tsx` (ClientDashboardView)
- `src/app/(client)/client/jobs/page.tsx`
- `src/app/(client)/client/invoices/page.tsx`
- `src/lib/supabase/queries/clients.ts` — new file

**What to test:**
- Client dashboard shows Metro Security Ltd jobs only
- Invoice list matches seeded invoices
- "New Request" form still works (Phase 5 already live)

**Rollback plan:**
- Revert client pages to `useMockStore()` filtered by `MOCK_CLIENT.companyName`

**What stays mock:** Auth. The client portal still uses the hardcoded `MOCK_CLIENT` identity to determine which client_id to use for filtering.

---

## Phase 10 — Invoices, Photos, Notifications (Future)

**Goal:** Full invoice management, photo uploads, notification delivery.

**Scope:**
- Invoice creation + line items (admin)
- "Send Link" button for client invoice payment (Stripe integration)
- Supabase Storage bucket `job-photos` — technician upload
- Real-time notifications via Supabase Realtime or third-party (e.g., Resend email)

**Files likely affected:**
- `src/app/(dashboard)/invoices/page.tsx`
- `src/app/(client)/client/invoices/page.tsx`
- New: `src/app/(dashboard)/invoices/new/page.tsx`
- New: `src/components/jobs/PhotoUpload.tsx`
- New: `src/lib/supabase/storage.ts`

**What stays mock until explicitly replaced:** Everything still untouched at this point.

---

## Mock Store Retirement

`src/lib/mock-store.tsx` should be deleted only after all the following are confirmed live:
- Phases 4–9 complete and tested
- `useMockStore()` has zero callers (grep confirms)
- `src/app/providers.tsx` no longer imports `MockStoreProvider`

Do not delete it earlier — it is the safety net for every phase rollback.

---

## Rollback Summary

| Phase | Rollback Cost | Impact |
|---|---|---|
| 2B | Drop tables (SQL) | Zero — app never reads them |
| 3 | Truncate tables | Zero — app never reads them |
| 4 | Revert 1 page file | Low |
| 5 | Revert 2 form components | Low |
| 6 | Revert 1 component | Low |
| 7 | Revert 2 page files | Medium |
| 8 | Revert 4 files | Medium |
| 9 | Revert 3 files | Medium |
| 10 | Revert 3+ files | Medium-High |

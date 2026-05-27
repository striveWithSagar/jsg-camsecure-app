# Supabase Phase 4C-B — Request-to-Job Conversion Report

> Status: COMPLETE
> Date: 2026-05-24
> Project: JSG_CamSercure (ref: gbvstrhorjjvlxnfmxcz)

---

## What Changed

The `/requests/[id]/convert` flow now creates a real Supabase `jobs` row and
marks the source `service_requests` row as `converted` — atomically, via a
Postgres RPC function. The mock store (`useMockStore`, `convertToJob`) is fully
removed from the convert flow.

---

## Files Created / Changed

| File | Type | Change |
|---|---|---|
| `supabase/migrations/20260524140000_convert_request_fn.sql` | New | `convert_request_to_job()` RPC function |
| `src/lib/data/clients.ts` | New | `getClients()` server helper |
| `src/lib/data/technicians.ts` | New | `getTechnicians()` server helper with `profiles` join |
| `src/app/(dashboard)/requests/[id]/convert/page.tsx` | Modified | Async Server Component — fetches request, clients, technicians in parallel |
| `src/components/requests/ConvertJobForm.tsx` | Modified | Removed mock-store; added client selector; technician selector uses UUID values; calls RPC on submit |

### Files NOT changed (scope boundary held)

| File | Status |
|---|---|
| `src/lib/mock-store.tsx` | Unchanged |
| `src/lib/data/service-requests.ts` | Unchanged |
| `src/app/(dashboard)/jobs/*` | Unchanged — still mock-store |
| All other portal pages | Unchanged |

---

## Migration Applied

**Function:** `convert_request_to_job()`  
**Applied to:** `gbvstrhorjjvlxnfmxcz` via MCP `apply_migration`  
**Migration version:** `20260524140000`

### Function signature

```sql
create or replace function convert_request_to_job(
  p_request_id       uuid,
  p_client_id        uuid,
  p_technician_id    uuid,
  p_site_name        text,
  p_address          text,
  p_service_type     service_type,
  p_priority         job_priority,
  p_scheduled_at     timestamptz,
  p_dispatcher_notes text  default '',
  p_technician_notes text  default ''
) returns uuid
language plpgsql
security invoker          -- all RLS policies apply to the calling user
set search_path = public
```

### What the function does (atomically)

1. Calls `auth_org_id()` (SECURITY DEFINER helper) to resolve the caller's org
2. `INSERT INTO jobs (...)` — subject to `jobs_insert_admin` RLS
3. `UPDATE service_requests SET status = 'converted', converted_to_job_id = <new_id>` — subject to `service_requests_update_admin` RLS
4. Returns new `jobs.id` UUID

Both writes happen inside one implicit PL/pgSQL transaction. If either fails,
both are rolled back.

---

## RLS Verification

| Operation | Policy | Admin passes |
|---|---|---|
| Resolve org_id | `auth_org_id()` SECURITY DEFINER | ✓ Always resolves for authenticated user |
| INSERT into jobs | `jobs_insert_admin`: `org = auth_org_id() AND role IN ('owner','admin','dispatcher')` | ✓ |
| UPDATE service_requests | `service_requests_update_admin`: same condition | ✓ |
| SELECT clients (server helper) | `clients_select`: `org = auth_org_id() AND role IN (...)` | ✓ 6 active clients returned |
| SELECT technicians + profiles join | `technicians_select` + `profiles_select_own_org` | ✓ 5 technicians with names returned |

---

## Field Mapping — Form → RPC Parameters

| Form source | RPC parameter | DB column | Notes |
|---|---|---|---|
| Client selector (UUID value) | `p_client_id` | `jobs.client_id` | Required — was hard blocker; new selector added |
| Technician selector (UUID value) | `p_technician_id` | `jobs.technician_id` | Changed from name string to UUID |
| `address` input | `p_site_name` + `p_address` | `jobs.site_name`, `jobs.address` | Form has one field; used for both |
| `schedule` datetime-local | `p_scheduled_at` | `jobs.scheduled_at` | `new Date(schedule).toISOString()` → UTC timestamptz |
| `tools` textarea | `p_dispatcher_notes` | `jobs.dispatcher_notes` | No dedicated tools column |
| `job-notes` textarea | `p_technician_notes` | `jobs.technician_notes` | Direct semantic match |
| `request.serviceTypeDb` (prop) | `p_service_type` | `jobs.service_type` | DB enum value passed from server — no client-side conversion |
| Priority Select state | `p_priority` | `jobs.priority` | `PRIORITY_LABELS` keys already match `job_priority` enum |
| `requestId` (prop) | `p_request_id` | `jobs.request_id` (FK) | Links job back to source request |
| `deadline` input | — | — | No DB column — collected but not inserted |

---

## Data Helpers

### `getClients()` — `src/lib/data/clients.ts`

- Reads `clients` table, `status = 'active'`, ordered by name
- Returns `{ id: string; name: string }[]`
- RLS: `clients_select` — admin can read all active clients in org
- Result for seeded data: 6 clients (Sunrise Hotel excluded — `status = 'inactive'`)

### `getTechnicians()` — `src/lib/data/technicians.ts`

- Reads `technicians` joined with `profiles(full_name)` — `technicians` has no name column
- Returns `{ id, full_name, specialty, status }[]` sorted by name
- RLS: `technicians_select` + `profiles_select_own_org` — both pass for admin
- TypeScript note: PostgREST returns the embedded `profiles` as an array without
  generated types; handled via `extractName()` helper that accepts both array
  and object forms
- Result for seeded data: 5 technicians (Alex Rivera, Jordan Kim, Morgan Davis,
  Sam Chen, Taylor Reyes)

---

## Form Changes Summary

| Before | After |
|---|---|
| `useMockStore()` for read + write | Removed entirely |
| `MockRequestItem` type | Removed — replaced by `ConvertRequestData` prop |
| `MOCK_TECHNICIANS` for technician list | Replaced by `TechnicianOption[]` prop from `getTechnicians()` |
| Technician Select value = name string | Technician Select value = `technicians.id` UUID |
| No client selector | Required client selector added (`jobs.client_id NOT NULL`) |
| `store.convertToJob()` mock write | `supabase.rpc('convert_request_to_job', ...)` |
| `useEffect` store-sync for priority init | Removed — `priority` initialized from `request.urgency` prop |
| Success screen: "View JOB-XXX" link | Removed — `/jobs/<uuid>` not yet navigable |
| Success screen: links to mock job ID | Links to `/requests/<request-uuid>` and `/requests` only |

### New form UI additions

- **Client Account selector** (required) — populated from `getClients()`, value = UUID
- Loading state on "Create Job" button (`disabled` + "Creating…")
- Inline `submitError` below submit button

---

## Verification Results

### RPC existence check

```
function_name:   convert_request_to_job
security:        INVOKER   ✓
language:        plpgsql   ✓
returns:         uuid      ✓
```

### Dry-run RPC call (rolled back)

Simulated authenticated admin (UUID `d483bbff-b30b-42b8-888f-abf91f3adf0f`)
calling `convert_request_to_job()` with REQ-001, Metro Security Ltd, Alex Rivera,
`camera_outage`, `emergency`:

```
new_job_id: f60e03c8-7399-4204-937e-daedb95c8db4   ✓ RPC returned UUID
```

Post-rollback state:
- REQ-001 status: `new`, `converted_to_job_id: null`  ✓ rolled back cleanly
- `job_status_history` count: `13`  ✓ trigger row included in rollback

### `job_status_history` trigger

Confirmed `SECURITY DEFINER` trigger `trg_job_status_on_insert` fires inside
the RPC transaction and is rolled back atomically with it. On a real conversion
(not rolled back), one `job_status_history` row is created automatically with
`old_status = null`, `new_status = 'assigned'`.

### Client/technician data availability

| Check | Result |
|---|---|
| `getClients()` — active clients | 6 rows: City Bank Branch, Green Valley Mall, Harbor Logistics, Metro Security Ltd, Riverside School, Tech Park Office |
| `getTechnicians()` with profile join | 5 rows: Alex Rivera, Jordan Kim, Morgan Davis, Sam Chen, Taylor Reyes |

---

## Success Screen Behaviour

After successful RPC call:

- **Job Created** heading + short UUID (last segment of job UUID)
- **View Request** → `/requests/<request-id>` — shows the request now marked `converted`
- **All Requests** → `/requests` — shows the request with `Converted` badge
- **Job Board** → `/jobs` — navigates to the mock-backed Kanban (new job not visible; expected)
- No `/jobs/<uuid>` link — jobs pages are still mock-only (Phase 4D)

---

## Build Result

**✓ Clean — 0 TypeScript errors, 22 routes.**

`/requests/[id]/convert` remains `ƒ (Dynamic)` — expected (async Server
Component fetching request + clients + technicians).

### TypeScript fix applied

PostgREST without generated types infers the `profiles` join as an array type.
Fixed in `technicians.ts` via `extractName()` helper that handles both
`{ full_name: string }` and `{ full_name: string }[]` at runtime.

---

## Lint Result

**✓ Clean — 0 ESLint errors or warnings.**

---

## Remaining Limitations

| Limitation | Phase to resolve |
|---|---|
| Job Board (`/jobs`, `/jobs/[id]`) still reads mock-store — newly converted jobs don't appear | Phase 4D |
| Converted job not navigable from success screen (no View Job link) | Phase 4D |
| `deadline` form field is collected but not stored (no DB column) | Future schema migration if needed |
| Site name and address use the same value (single address field) | Future form enhancement |
| Sidebar still shows hardcoded "JSG Admin" / "admin@jsg.com" | Phase 8E |
| Technician auth, client auth not yet wired | Phase 8C, 8D |

---

## Remaining Mock-Store Dependencies

| Page / Component | Mock dependency | Phase |
|---|---|---|
| `/jobs`, `/jobs/[id]` | `useMockStore().jobs` | Phase 4D |
| `/dashboard` | `useMockStore().requests` + `.jobs` | Phase 4G |
| `/clients`, `/clients/[id]` | `MOCK_CLIENTS` | Phase 4E |
| `/technicians` | `MOCK_TECHNICIANS` | Phase 4F |
| `/invoices` | `MOCK_INVOICES` | Phase 4H |
| `/technician/*` | `useMockStore().jobs` | Phase 8C + 4D |
| `/client/*` | mock data | Phase 8D + 4H |
| `Sidebar` | hardcoded admin name/email | Phase 8E |
| `mock-store.tsx` | entire file | Remove when all consumers migrated |

---

## Recommended Next Step

**Phase 4D — Migrate Job Board reads to Supabase.**

The `jobs` table is populated with 13 seeded rows. With admin auth already
working, the `/jobs` and `/jobs/[id]` pages can be migrated the same way
`/requests` was (Phase 4A-B):

1. Create `src/lib/data/jobs.ts` with `getJobs()` and `getJobById(id)` helpers
2. Convert `/jobs/page.tsx` to an async Server Component reading `getJobs()`
3. Extract interactive Kanban/List toggle to a `JobBoard` Client Component
4. Convert `/jobs/[id]/page.tsx` to use `getJobById(id)`

This also makes the success screen's "Job Board" link functional for
newly created jobs.

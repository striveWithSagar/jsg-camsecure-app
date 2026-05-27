# Supabase Phase 4C-A — Admin Create Request Report

> Status: COMPLETE
> Date: 2026-05-24
> Project: JSG_CamSercure (ref: gbvstrhorjjvlxnfmxcz)

---

## What Changed

The `/requests/new` admin form now inserts into `service_requests` via Supabase
instead of the mock store. The form UI and validation are unchanged.

---

## Files Changed

| File | Type | Change |
|---|---|---|
| `src/components/requests/NewRequestForm.tsx` | Modified | Removed `useMockStore`, wired async insert via browser Supabase client |

### Files NOT changed

| File | Status |
|---|---|
| `src/app/(dashboard)/requests/new/page.tsx` | Unchanged — pure Server Component shell |
| `src/lib/data/service-requests.ts` | Unchanged — insert handled in component via browser client |
| `src/lib/mock-store.tsx` | Unchanged |
| `src/lib/constants.ts` | Unchanged |
| All other portal pages | Unchanged |

---

## Insert Payload Mapping

| DB column | Source | Value |
|---|---|---|
| `organization_id` | Admin's profile (Supabase query) | `profile.organization_id` |
| `submitted_by_profile_id` | Auth session | `user.id` |
| `client_name` | Form: `business-name` or `client-name` | `businessName || clientName` |
| `client_phone` | Form: `phone` | Required field |
| `service_type` | Form: service type Select via `SERVICE_TYPE_DB` map | Display string → DB enum |
| `urgency` | Form: urgency Select | Already lowercase enum value |
| `description` | Form: `description` | Required textarea |
| `notes` | Form: `notes` | Optional textarea, defaults to `""` |
| `status` | DB default | `'new'` — omitted from payload |
| `id` | DB default | `gen_random_uuid()` — omitted from payload |
| `created_at` / `updated_at` | DB default | `now()` — omitted from payload |
| `client_id` | Not in form | `null` |
| `client_contact_id` | Not in form | `null` |
| `converted_to_job_id` | Not applicable | `null` |

### Form fields NOT inserted (no matching DB column)

| Form field | Reason not inserted |
|---|---|
| `email` | No `email` column in `service_requests` |
| `address` | No `address` column in `service_requests` |
| `preferred-datetime` | No scheduled date column in `service_requests` |

---

## Service Type Enum Conversion

The `SERVICE_TYPES` constant in `constants.ts` uses display strings as Select
values ("New Installation", "Camera Outage", etc.). The DB enum requires
snake_case ("new_installation", "camera_outage", etc.).

A local `SERVICE_TYPE_DB` map converts at submit time. The Select UI is
unchanged — display strings remain as both labels and values.

| Display string | DB enum value |
|---|---|
| New Installation | `new_installation` |
| Maintenance | `maintenance` |
| DVR/NVR Issue | `dvr_nvr_issue` |
| Camera Outage | `camera_outage` |
| Mobile App Issue | `mobile_app_issue` |
| Wiring Issue | `wiring_issue` |
| Emergency Service | `emergency_service` |
| Quote Request | `quote_request` |
| Site Inspection | `site_inspection` |
| Other | `other` |

Urgency values were already lowercase in the Select (`u.toLowerCase()`) and
match the DB enum directly — no conversion needed.

---

## Submit Flow

```
handleSubmit() [async]
  1. Validate required fields (client-name, phone, serviceType, urgency, description)
     → setErrors and return early if any fail
  2. setLoading(true)
  3. supabase.auth.getUser()
     → error or no user → setSubmitError("Not authenticated…"), return
  4. supabase.from("profiles").select("organization_id").eq("id", user.id).single()
     → error or no profile → setSubmitError("Could not load your profile…"), return
     → allowed by "profiles_select_own_org" RLS (organization_id = auth_org_id())
  5. supabase.from("service_requests").insert({...}).select("id").single()
     → error → setSubmitError(insertError.message), return
     → allowed by "service_requests_insert" RLS (organization_id = auth_org_id(),
       auth_role() in ('owner', 'admin', 'dispatcher'))
  6. setCreatedId(inserted.id), setSubmitted(true)
```

---

## Success Screen

After successful insert the form shows a confirmation screen with:
- Short ID: `createdId.split("-").pop()` — last UUID segment for readability
- **View Request** button → `/requests/<full-uuid>` (opens the detail page, now Supabase-backed)
- **All Requests** button → `/requests` (new row appears in the live list)
- **Add Another** button → resets all state back to blank form

---

## RLS Verification

| Policy | Applied | Outcome |
|---|---|---|
| `profiles_select_own_org` | `organization_id = auth_org_id()` | Admin can select own profile to get org_id |
| `service_requests_insert` | `organization_id = auth_org_id()` and `auth_role() in ('owner', 'admin', 'dispatcher')` | Admin insert allowed |

Unauthenticated users are redirected to `/login/admin` by the proxy before the
page renders — RLS is a second layer of defence.

---

## End-to-End Flow (Expected)

1. Admin logs in at `/login/admin` (Phase 8A-B)
2. Navigates to `/requests` → sees 5 seeded rows (Phase 4A-B)
3. Clicks **New Request** → form at `/requests/new`
4. Fills in client name, phone, service type, urgency, description
5. Clicks **Create Request**
6. Form inserts to `service_requests`; success screen shows short UUID
7. **View Request** → `/requests/<uuid>` → detail page (Phase 4B) shows live data
8. **All Requests** → `/requests` → list shows 6 rows (5 seeded + 1 new)

---

## Build Result

**✓ Clean — 0 TypeScript errors, 22 routes.**

`/requests/new` remains `ƒ (Dynamic)` — expected (dashboard layout guard
calls `await supabase.auth.getUser()` server-side).

---

## Lint Result

**✓ Clean — 0 ESLint errors or warnings.**

---

## Remaining Mock-Store Dependencies

| Page / Component | Mock dependency | Phase to migrate |
|---|---|---|
| `/requests/[id]/convert` | `MOCK_REQUESTS` + `useMockStore().convertToJob()` | Phase 4C-B (convert flow) |
| `/jobs`, `/jobs/[id]` | `useMockStore().jobs` | Phase 4D |
| `/dashboard` | `useMockStore().requests` + `useMockStore().jobs` | Phase 4G |
| `/clients`, `/clients/[id]` | `MOCK_CLIENTS` | Phase 4E |
| `/technicians` | `MOCK_TECHNICIANS` | Phase 4F |
| `/invoices` | `MOCK_INVOICES` | Phase 4H |
| `/technician/*` | `useMockStore().jobs` | Phase 8C + 4D |
| `/client/*` | mock data | Phase 8D + 4H |
| `Sidebar` | hardcoded "JSG Admin" name/email | Phase 8E |
| `mock-store.tsx` | entire file | Remove when all consumers migrated |

---

## Recommended Next Steps

**Option 1 — Complete requests module (Phase 4C-B):**
Migrate `/requests/[id]/convert` — replace `MOCK_REQUESTS` + `useMockStore().convertToJob()`
with a Supabase INSERT into `jobs` and an UPDATE to `service_requests.converted_to_job_id`.
This completes the full requests lifecycle on Supabase.

**Option 2 — Technician auth (Phase 8C):**
Create auth user for `a.rivera@camsecure.com`, bridge `profiles.id` +
`technicians.profile_id` in a transaction, wire `/login/technician` and layout guard.

**Option 3 — Next data module (Phase 4D — Jobs):**
Migrate `/jobs` and `/jobs/[id]` reads to Supabase. Requires no new auth work.

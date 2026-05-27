# Supabase Phase 4A-B — /requests Supabase Read Report

> Status: COMPLETE
> Date: 2026-05-24
> Project: JSG_CamSercure (ref: gbvstrhorjjvlxnfmxcz)

---

## What Changed

The `/requests` list page now reads live data from Supabase instead of the
mock store. The mock store is untouched — all other pages still use it.

---

## Files Changed

| File | Type | Change |
|---|---|---|
| `src/app/(dashboard)/requests/page.tsx` | Modified | Replaced `"use client"` + `useMockStore()` with an async Server Component that calls `getServiceRequests()` |
| `src/app/(dashboard)/requests/RequestsTable.tsx` | New | Client Component extracted for row-click navigation (`useRouter`). Receives pre-mapped `RequestRow[]` props from the server. |

### Files NOT changed (scope boundary held)

| File | Status |
|---|---|
| `src/app/(dashboard)/requests/[id]/page.tsx` | Unchanged — still reads from `MOCK_REQUESTS` + mock store |
| `src/app/(dashboard)/requests/new/page.tsx` | Unchanged — still writes to mock store |
| `src/app/(dashboard)/requests/[id]/convert/page.tsx` | Unchanged — still uses mock store |
| `src/lib/mock-store.tsx` | Unchanged |
| `src/lib/data/service-requests.ts` | Unchanged — used as-is |
| All other portal pages | Unchanged |

---

## Field Mapping

| UI column | Mock field | Supabase field | Notes |
|---|---|---|---|
| ID | `req.id` (e.g. "REQ-001") | `req.id.split("-").pop()` | Last UUID segment — distinct per row |
| Client name | `req.client` | `r.client_name` | Direct map |
| Phone | `req.phone` | `r.client_phone` | Direct map |
| Service Type | `req.type` (display string) | `SERVICE_TYPE_LABELS[r.service_type]` | Enum → label map added in page.tsx |
| Description | `req.description` | `r.description` | Direct map |
| Urgency | `req.urgency.toLowerCase()` | `r.urgency` | Already lowercase in DB |
| Status | `req.status` | `r.status` | Direct — same enum values |
| Created | `req.created` (relative string) | `formatDate(r.created_at)` | ISO → "May 23" format |

### Service type label map (added to page.tsx)

| DB enum | Display label |
|---|---|
| `new_installation` | New Installation |
| `maintenance` | Maintenance |
| `dvr_nvr_issue` | DVR/NVR Issue |
| `camera_outage` | Camera Outage |
| `mobile_app_issue` | Mobile App Issue |
| `wiring_issue` | Wiring Issue |
| `emergency_service` | Emergency Service |
| `quote_request` | Quote Request |
| `site_inspection` | Site Inspection |
| `other` | Other |

---

## Architecture

The page was split into two layers to satisfy the Server Component / Client
Component boundary in Next.js App Router:

```
page.tsx (Server Component — async)
  → calls getServiceRequests()      [Supabase query, server-side, RLS-gated]
  → maps ServiceRequest[] → RequestRow[]
  → computes counts
  → renders TopBar, stat strip, "New Request" button
  → passes RequestRow[] to ↓

RequestsTable.tsx (Client Component)
  → receives RequestRow[] as props  [no Supabase call here]
  → uses useRouter() for row-click navigation
  → renders Table with status/urgency badges
  → renders empty state if 0 rows
```

This pattern keeps all async/server logic in the Server Component and all
interactivity in the Client Component, without restructuring the UI.

---

## Test Results

### Authenticated admin (logged in as admin@jsg.com)

| Check | Expected | Result |
|---|---|---|
| `getServiceRequests()` row count | 5 | ✓ 5 rows returned |
| Stat strip: New | 2 | ✓ (REQ-001, REQ-005) |
| Stat strip: Reviewing | 1 | ✓ (REQ-002) |
| Stat strip: Ready to Schedule | 1 | ✓ (REQ-003) |
| Stat strip: Converted | 1 | ✓ (REQ-004) |
| TopBar subtitle | "5 total · 2 new" | ✓ |
| Service type labels render correctly | ✓ | e.g. "Camera Outage", "New Installation" |
| Urgency badges render correctly | ✓ | PriorityBadge receives lowercase enum values |
| Status badges render correctly | ✓ | REQUEST_STATUS_LABELS resolves all 5 statuses |
| Created dates render | ✓ | "May 23" format |

### Unauthenticated access

| Check | Expected | Result |
|---|---|---|
| Direct navigation to `/requests` without session | Redirect to `/login/admin` | ✓ Proxy redirects before page renders |
| `getServiceRequests()` with no session (if proxy bypassed) | 0 rows (RLS) | ✓ Empty state shown with RLS note |

---

## Empty State Behaviour

If `getServiceRequests()` returns 0 rows (RLS blocked or no data), the table
renders a single full-width row with:

```
No service requests found.
If you expect data here, confirm you are signed in as admin —
RLS requires an authenticated session.
```

This is diagnostic information to help identify auth issues during development.

---

## Row Navigation (Known Limitation This Phase)

Clicking a row navigates to `/requests/<uuid>` (e.g.
`/requests/a0000000-0000-0000-0000-000000000401`).

The `/requests/[id]` detail page currently looks up by ID in `MOCK_REQUESTS`
(which uses "REQ-001" format) and the mock store. It will not find a match for
UUID-based IDs and will render with an empty seed. The `RequestDetail`
component inside that page falls back to the mock store which also won't find
the UUID.

**This is expected and intentional for Phase 4A-B.** The scope explicitly
excludes `/requests/[id]`. The detail page will be migrated to Supabase in a
later phase.

---

## Build Result

**✓ Clean — 0 TypeScript errors, 22 routes.**

`/requests` remains `ƒ (Dynamic)` — expected, as it now calls
`getServiceRequests()` which reads a session cookie on every request.

---

## Lint Result

**✓ Clean — 0 ESLint errors or warnings.**

---

## Remaining Mock-Store Dependencies

The following pages/components still read from mock-store and have not been
migrated:

| Page / Component | Mock dependency | Phase to migrate |
|---|---|---|
| `/requests/[id]` | `MOCK_REQUESTS` + `useMockStore()` | Phase 4B |
| `/requests/new` | `useMockStore().addRequest()` | Phase 4B |
| `/requests/[id]/convert` | `useMockStore().convertToJob()` | Phase 4B |
| `/jobs`, `/jobs/[id]` | `useMockStore().jobs` | Phase 4C |
| `/dashboard` | `useMockStore().requests` + `useMockStore().jobs` | Phase 4F |
| `/clients`, `/clients/[id]` | `MOCK_CLIENTS` | Phase 4D |
| `/technicians` | `MOCK_TECHNICIANS` | Phase 4E |
| `/invoices` | `MOCK_INVOICES` | Phase 4G |
| `/technician/*` | `useMockStore().jobs` | Phase 8C + 4C |
| `/client/*` | mock data | Phase 8D + 4G |
| `Sidebar` | hardcoded "JSG Admin" name/email | Phase 8E |
| `mock-store.tsx` | entire file | Remove when all consumers migrated |

---

## Recommended Next Steps

**Option 1 — Continue data migration (Phase 4B):**
Replace `/requests/[id]` detail page read with `getServiceRequestById(id)`.
This completes the full requests flow end-to-end on Supabase.

**Option 2 — Continue auth (Phase 8C):**
Create the technician auth user (`a.rivera@camsecure.com`), update the
`technicians.profile_id` FK, wire `/login/technician`, add layout guard to
`(technician)/layout.tsx`.

Phase 4B is recommended next — the data layer is ready and the auth bridge is
already proven. Completing the requests detail page makes the requests module
fully Supabase-backed before moving to other modules.

# Supabase Phase 4B — /requests/[id] Detail Page Report

> Status: COMPLETE
> Date: 2026-05-24
> Project: JSG_CamSercure (ref: gbvstrhorjjvlxnfmxcz)

---

## What Changed

The `/requests/[id]` detail page now reads live data from Supabase instead of
`MOCK_REQUESTS`. Status and notes saves write back to Supabase via the browser
client (RLS-gated). The mock store is untouched — `/requests/[id]/convert` and
all other pages still use it.

---

## Files Changed

| File | Type | Change |
|---|---|---|
| `src/app/(dashboard)/requests/[id]/page.tsx` | Modified | Replaced `MOCK_REQUESTS.find` with `getServiceRequestById(id)`, maps `ServiceRequest` → `RequestDetailData`, passes to `RequestDetail` |
| `src/components/requests/RequestDetail.tsx` | Modified | Removed `useMockStore` / `MockRequestItem`, accepts `RequestDetailData`, saves via browser Supabase client |

### Files NOT changed (scope boundary held)

| File | Status |
|---|---|
| `src/app/(dashboard)/requests/[id]/convert/page.tsx` | Unchanged — still reads from `MOCK_REQUESTS` + mock store |
| `src/components/requests/ConvertJobForm.tsx` | Unchanged |
| `src/app/(dashboard)/requests/new/page.tsx` | Unchanged — still writes to mock store |
| `src/lib/data/service-requests.ts` | Unchanged — used as-is |
| `src/lib/mock-store.tsx` | Unchanged |
| All other portal pages | Unchanged |

---

## Architecture

```
page.tsx (Server Component — async)
  → calls getServiceRequestById(id)      [Supabase query, server-side, RLS-gated]
  → maps ServiceRequest → RequestDetailData
  → renders TopBar with client name + service type
  → passes RequestDetailData | null to ↓

RequestDetail.tsx (Client Component)
  → receives RequestDetailData as prop    [no Supabase call here for reads]
  → manages local state: status, notes   [initialized from prop]
  → saveStatus() → supabase.update({ status }).eq("id", requestId)
  → saveNotes()  → supabase.update({ notes  }).eq("id", requestId)
  → both use createClient() (browser client — auth cookie sent automatically)
  → renders "Request not found." if request prop is null
```

---

## Field Mapping

| UI field | Mock field | Supabase field | Notes |
|---|---|---|---|
| Client name | `display.client` | `r.client_name` | Direct map |
| Phone | `display.phone` | `r.client_phone` | Direct map |
| Service Type | `display.type` (display string) | `SERVICE_TYPE_LABELS[r.service_type]` | Enum → label map (same as list page) |
| Urgency | `display.urgency.toLowerCase()` | `r.urgency` | Already lowercase in DB — `.toLowerCase()` removed |
| Status | `display.status` | `r.status` | Direct — same enum values |
| Description | `display.description` | `r.description` | Direct map |
| Notes | `display.notes` | `r.notes` | Direct map — editable, writes back to DB |
| Created | `display.created` (relative string) | `formatDate(r.created_at)` | ISO → "May 23" format |

---

## Write Operations (New in Phase 4B)

Both save operations use the browser Supabase client (`createClient()` from
`src/lib/supabase/client.ts`). The auth session cookie is sent automatically.

| Operation | SQL equivalent | RLS policy |
|---|---|---|
| Save Status | `UPDATE service_requests SET status = $1 WHERE id = $2` | `service_requests_update_admin` — allows `admin` role |
| Save Notes | `UPDATE service_requests SET notes = $1 WHERE id = $2` | `service_requests_update_admin` — allows `admin` role |

The `set_updated_at()` trigger on `service_requests` fires automatically on
every update, keeping `updated_at` current.

---

## TopBar ID Display

The TopBar title shows the last segment of the UUID
(`request.id.split("-").pop()`) for visual consistency with the ID column in
the list page.

---

## Not Found / RLS Blocked Behaviour

If `getServiceRequestById(id)` returns `null` (ID not found or RLS hides row):
- TopBar shows `"Request Not Found"` title
- `RequestDetail` renders `"Request not found."` in the content area

---

## Mock Store Removal Summary

`RequestDetail` previously depended on `useMockStore()` for three things:

| Old dependency | Removed | Replaced with |
|---|---|---|
| `store.hydrated` check | ✓ | Not needed — data arrives as server-fetched prop |
| `store.requests.find(r => r.id === requestId)` (read sync) | ✓ | `request` prop from page |
| `store.updateRequestStatus(requestId, status)` | ✓ | `supabase.from("service_requests").update({ status })` |
| `store.updateRequestNotes(requestId, notes)` | ✓ | `supabase.from("service_requests").update({ notes })` |

The `MockRequestItem` type import and the `useEffect` store-sync hook are
entirely removed. The "Loading…" state (waiting for store hydration) is also
removed — data is ready at first render.

---

## Build Result

**✓ Clean — 0 TypeScript errors, 22 routes.**

`/requests/[id]` remains `ƒ (Dynamic)` — expected, as it calls
`getServiceRequestById()` which reads a session cookie on every request.

---

## Lint Result

**✓ Clean — 0 ESLint errors or warnings.**

---

## Remaining Mock-Store Dependencies

| Page / Component | Mock dependency | Phase to migrate |
|---|---|---|
| `/requests/[id]/convert` | `MOCK_REQUESTS` + `useMockStore().convertToJob()` | Phase 4B-ext (convert flow) |
| `/requests/new` | `useMockStore().addRequest()` | Phase 4B-ext (new request flow) |
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

**Option 1 — Complete the requests module (Phase 4B-ext):**
Migrate `/requests/new` (addRequest → Supabase INSERT) and
`/requests/[id]/convert` (convertToJob → Supabase INSERT + UPDATE).
This makes the full requests CRUD flow Supabase-backed.

**Option 2 — Continue auth (Phase 8C):**
Create the technician auth user (`a.rivera@camsecure.com`), update
`profiles.id` + `technicians.profile_id` FK in a transaction, wire
`/login/technician`, add guard to `(technician)/layout.tsx`.

**Option 3 — Next data module (Phase 4C — Jobs):**
Migrate `/jobs` and `/jobs/[id]` reads from mock store to Supabase.
Requires no new auth work — admin session already covers jobs RLS.

Phase 4B-ext is recommended next if the goal is a complete requests flow.
Phase 4C (Jobs) is recommended next if the goal is breadth over depth.

# Supabase Phase 4F-A — Admin Technicians List Report

> Status: COMPLETE
> Date: 2026-05-24
> Project: JSG_CamSercure (ref: gbvstrhorjjvlxnfmxcz)

---

## What Changed

The admin `/technicians` list page now reads live data from Supabase.
`MOCK_TECHNICIANS` is fully removed from this route. All 5 technicians are shown
with real contact data (email, phone from `profiles`) and live active/completed
job counts computed from the `jobs` table.

---

## Files Changed

| File | Type | Change |
|---|---|---|
| `src/lib/data/technicians.ts` | Modified | Added `TechnicianRow` type + `getTechnicianList()` |
| `src/app/(dashboard)/technicians/page.tsx` | Modified | Async Server Component — `MOCK_TECHNICIANS` removed; uses `getTechnicianList()` |

### Files NOT changed

| File | Status |
|---|---|
| `src/lib/data/technicians.ts` — `getTechnicians()`, `TechnicianOption` | Unchanged — used by job assignment dropdowns |
| `src/lib/mock-store.tsx` | Unchanged |
| `src/lib/constants.ts` | Unchanged (`MOCK_TECHNICIANS` still present for other consumers) |
| All other pages | Unchanged |

---

## `getTechnicianList()` — `src/lib/data/technicians.ts`

### Two-query approach (parallel, safe)

```ts
const [techResult, jobsResult] = await Promise.all([
  supabase
    .from("technicians")
    .select("id, specialty, status, profiles(full_name, email, phone)"),
  supabase
    .from("jobs")
    .select("technician_id, status"),
]);
```

Query 1 — `technicians` with embedded `profiles(full_name, email, phone)`: returns
all 5 technicians with their linked profile data.

Query 2 — `jobs.technician_id + status`: used to build `activeMap` and
`completedMap`. Active = any status NOT `completed` or `cancelled`. Completed =
status `= 'completed'`. Computed in JS after both queries resolve.

### `TechnicianRow` type

```ts
type TechnicianRow = {
  id:            string;
  name:          string;   // from profiles.full_name
  email:         string;   // from profiles.email
  phone:         string;   // from profiles.phone
  specialty:     string;   // technicians.specialty
  status:        string;   // technicians.status
  activeJobs:    number;   // jobs where status NOT IN ('completed','cancelled')
  completedJobs: number;   // jobs where status = 'completed'
};
```

### `extractProfile` helper (inlined, not exported)

Handles PostgREST embed returning either object or array (no generated types):
falls back to `{ name: "Unknown", email: "", phone: "" }` if embed is null.

### Sort order

Sorted alphabetically by `name` — matches mock order (Alex Rivera, Jordan Kim,
Morgan Davis, Sam Chen, Taylor Reyes).

---

## RLS Verification (pre-implementation)

Verified via Supabase MCP — 5 technicians returned with full profile data:

| Technician    | Status      | Active | Completed | Email                      | Phone    |
|---|---|---|---|---|---|
| Alex Rivera   | on_job      | 3      | 2         | a.rivera@camsecure.com     | 555-2001 |
| Jordan Kim    | available   | 2      | 0         | j.kim@camsecure.com        | 555-2003 |
| Morgan Davis  | on_job      | 1      | 0         | m.davis@camsecure.com      | 555-2005 |
| Sam Chen      | on_the_way  | 3      | 2         | s.chen@camsecure.com       | 555-2002 |
| Taylor Reyes  | available   | 1      | 0         | t.reyes@camsecure.com      | 555-2004 |

---

## UI Changes

| Before (mock) | After (Supabase) |
|---|---|
| `MOCK_TECHNICIANS.filter(...)` | `getTechnicianList()` (server query) |
| `export default function` (sync) | `export default async function` |
| Phone/email always rendered | Conditionally rendered — hidden if empty |
| No empty state | Empty state paragraph if `technicians.length === 0` |
| Status badge: missing fallback | Falls back to `TECH_STATUS_STYLE.off_duty` for unknown status |
| Status label: missing fallback | Falls back to `tech.status` raw value for unknown status |
| "Add Technician" disabled | Unchanged — still disabled with "Coming soon" |
| "View Jobs" links to `/jobs` | Unchanged |

---

## Limitations

| Item | Detail |
|---|---|
| **Technician detail page** | No `/technicians/[id]` page — cards are not clickable (Phase 8C) |
| **Job count scale** | Fetches all `jobs.technician_id` rows — safe at current scale (14 jobs) |

---

## Build Result

**✓ Clean — 0 TypeScript errors, 22 routes (unchanged count).**

`/technicians` remains `ƒ (Dynamic)`.

---

## Lint Result

**✓ Clean — 0 ESLint errors or warnings.**

---

## Remaining Mock Dependencies

| Page / Component | Mock dependency | Phase |
|---|---|---|
| `/dashboard` | `useMockStore().requests` + `.jobs` | Phase 4G |
| `/invoices` | `MOCK_INVOICES` | Phase 4H |
| `/technician/*` | `useMockStore().jobs` | Phase 8C |
| `/client/*` | mock data | Phase 8D + 4H |
| `Sidebar` | hardcoded admin name/email | Phase 8E |
| `constants.ts` | `MOCK_TECHNICIANS` still present | Remove when all consumers migrated |

---

## Recommended Next Step

**Phase 4G — Migrate `/dashboard` from `useMockStore()` to Supabase.**

The dashboard uses `useMockStore().requests` (for pending count) and `.jobs` (for
active jobs list). Both `service_requests` and `jobs` tables are populated and
have RLS policies in place. The dashboard will need a server-side data function
and the Client Component `useMockStore()` calls replaced with props.

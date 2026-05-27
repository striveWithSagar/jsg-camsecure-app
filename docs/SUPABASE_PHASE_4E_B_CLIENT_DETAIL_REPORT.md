# Supabase Phase 4E-B — Admin Client Detail Report

> Status: COMPLETE
> Date: 2026-05-24
> Project: JSG_CamSercure (ref: gbvstrhorjjvlxnfmxcz)

---

## What Changed

The admin `/clients/[id]` detail page now reads live data from Supabase.
`MOCK_CLIENTS`, `MOCK_JOBS`, and `MOCK_INVOICES` are fully removed from this
route. Contact info, jobs list, and invoice list all come from Supabase.

---

## Files Changed

| File | Type | Change |
|---|---|---|
| `src/lib/data/clients.ts` | Modified | Added `ClientJobItem`, `ClientInvoiceItem`, `ClientDetailData` types + `getClientById(id)` |
| `src/app/(dashboard)/clients/[id]/page.tsx` | Modified | Async Server Component — all mock imports removed; `notFound()` on missing ID |

### Files NOT changed

| File | Status |
|---|---|
| `src/app/(dashboard)/clients/page.tsx` | Unchanged |
| `src/lib/data/clients.ts` — `getClients()`, `getClientList()` | Unchanged |
| `src/lib/mock-store.tsx` | Unchanged |
| `src/lib/constants.ts` | Unchanged |

---

## `getClientById(id)` — `src/lib/data/clients.ts`

### Query — single round-trip with three embeds

```ts
supabase
  .from("clients")
  .select(`
    id, name, status,
    client_contacts(full_name, email, phone, is_primary),
    jobs(id, service_type, priority, status, scheduled_at),
    invoices(id, invoice_number, status, total, due_at)
  `)
  .eq("id", id)
  .single()
```

All three embeds are subject to RLS — admin reads all rows in their org.
`PGRST116` (zero rows on `.single()`) is handled silently — returns `null` → `notFound()`.

### Types added

```ts
type ClientJobItem     = { id, type, scheduled, priority, status }
type ClientInvoiceItem = { id, number, status, total: number, dueAt }
type ClientDetailData  = { id, name, status, contact, email, phone,
                           jobCount, jobs: ClientJobItem[], invoices: ClientInvoiceItem[] }
```

### Jobs sort order

Active jobs first (non-completed, non-cancelled), then by `scheduled_at` desc,
completed/cancelled sorted to the bottom. Computed in JS after the single query.

### `total` field

`invoices.total` is `numeric(10,2)` — wrapped in `Number(raw.total) || 0`
to handle both string and number representations from PostgREST.

### Helper functions (inlined, not exported)

- `SERVICE_TYPE_LABELS` — maps DB enum to display label
- `formatScheduled(iso)` — "Today HH:MM" / "Tomorrow HH:MM" / "May 24, 2026"
- `formatDueDate(iso)` — "May 31, 2026"

---

## RLS Verification (pre-implementation)

Verified via Supabase MCP against Metro Security Ltd (`a0000000-...-000000000101`):

| Query | Result |
|---|---|
| `clients` SELECT | ✓ row returned (name, status, address) |
| `client_contacts` embed | ✓ David Park, d.park@metro.com, 555-1001, is_primary: true |
| `jobs` embed | ✓ 6 rows (service_type, priority, status, scheduled_at) |
| `invoices` embed | ✓ 3 rows under admin JWT context |

---

## Client IDs Tested

| Client | UUID | Jobs | Invoices |
|---|---|---|---|
| Metro Security Ltd | `a0000000-0000-0000-0000-000000000101` | 6 | 3 |

---

## Invalid ID Result

`getClientById("00000000-...")` → PostgREST returns `PGRST116` → function returns `null` → `notFound()` fires → Next.js 404 page. No wrong client shown. ✓

---

## UI Changes

| Before (mock) | After (Supabase) |
|---|---|
| `MOCK_CLIENTS.find(c => c.id === id) ?? MOCK_CLIENTS[0]` | `getClientById(id)` — `notFound()` if null |
| `MOCK_JOBS.filter(j => j.client === client.name)` | embedded `jobs` array from Supabase |
| `MOCK_INVOICES.filter(i => i.client === client.name)` | embedded `invoices` array from Supabase |
| TopBar subtitle: `X sites · Y jobs` | TopBar subtitle: `Y jobs` (no sites concept) |
| Jobs badge: `clientJobs.length \|\| client.jobs` | `client.jobCount` (from embedded count) |
| `job.type` from mock string | `SERVICE_TYPE_LABELS[job.service_type]` |
| `job.scheduled` from pre-formatted string | `formatScheduled(job.scheduled_at)` |
| `inv.amount` from number | `inv.total` via `Number(raw.total)` |
| `inv.due` from pre-formatted string | `formatDueDate(inv.due_at)` |
| Phone/email always rendered | Conditionally rendered — hidden if empty |
| "Edit Client" button disabled (unchanged) | Unchanged — still disabled with "Coming soon" |

---

## Limitations

| Item | Detail |
|---|---|
| **Sites count** | No `sites` column in schema — removed from TopBar subtitle entirely |
| **Job links** | `/jobs/${job.id}` uses real UUIDs — detail pages now work (Phase 4D-B complete) |
| **Invoice detail** | No `/invoices/[id]` page yet — invoice rows are non-clickable (Phase 4H) |
| **Address** | `clients.address` is null in seeded data — not rendered |

---

## Build Result

**✓ Clean — 0 TypeScript errors, 22 routes (unchanged count).**

`/clients/[id]` remains `ƒ (Dynamic)`.

---

## Lint Result

**✓ Clean — 0 ESLint errors or warnings.**

---

## Remaining Mock Dependencies

| Page / Component | Mock dependency | Phase |
|---|---|---|
| `/dashboard` | `useMockStore().requests` + `.jobs` | Phase 4G |
| `/technicians` | `MOCK_TECHNICIANS` | Phase 4F |
| `/invoices` | `MOCK_INVOICES` | Phase 4H |
| `/technician/*` | `useMockStore().jobs` | Phase 8C |
| `/client/*` | mock data | Phase 8D + 4H |
| `Sidebar` | hardcoded admin name/email | Phase 8E |
| `constants.ts` | `MOCK_CLIENTS` still present | Remove when all consumers migrated |

---

## Recommended Next Step

**Phase 4F — Migrate `/technicians` from `MOCK_TECHNICIANS` to Supabase.**

The `technicians` table is populated with 5 rows joined to `profiles` for names.
`getTechnicians()` already exists from Phase 4C-B — the technicians list page
can reuse it directly, following the same async Server Component pattern.

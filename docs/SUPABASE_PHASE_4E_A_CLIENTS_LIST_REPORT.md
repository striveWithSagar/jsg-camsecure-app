# Supabase Phase 4E-A — Admin Clients List Report

> Status: COMPLETE
> Date: 2026-05-24
> Project: JSG_CamSercure (ref: gbvstrhorjjvlxnfmxcz)

---

## What Changed

The admin `/clients` list page now reads live data from Supabase instead of
`MOCK_CLIENTS`. All 7 seeded clients are shown with real contact data and live
job counts. `MOCK_CLIENTS` is fully removed from this route.

---

## Files Changed

| File | Type | Change |
|---|---|---|
| `src/lib/data/clients.ts` | Modified | Added `ClientRow` type + `getClientList()` server helper |
| `src/app/(dashboard)/clients/page.tsx` | Modified | Async Server Component — `MOCK_CLIENTS` removed, uses `getClientList()` |

### Files NOT changed

| File | Status |
|---|---|
| `src/app/(dashboard)/clients/[id]/page.tsx` | Unchanged — Phase 4E-B |
| `src/lib/mock-store.tsx` | Unchanged |
| `src/lib/constants.ts` | Unchanged (`MOCK_CLIENTS` still present for other consumers) |
| All other pages | Unchanged |

---

## Architecture

`/clients/page.tsx` is now an **async Server Component**. No Client Component
needed — the page has no interactive state.

```
/clients/page.tsx (Server Component — async)
  └── getClientList()   ← two parallel server queries: clients+contacts / jobs
```

`getClients()` (used by the convert form, returns `{ id, name }[]`) is **unchanged**.

---

## `getClientList()` — `src/lib/data/clients.ts`

### Two-query approach (safe, no PostgREST aggregate dependency)

```ts
const [clientsResult, jobsResult] = await Promise.all([
  supabase
    .from("clients")
    .select("id, name, status, client_contacts(full_name, email, phone, is_primary)")
    .order("name"),
  supabase
    .from("jobs")
    .select("client_id"),
]);
```

Query 1 — `clients` with embedded `client_contacts`: returns all clients (all
statuses) with their contact rows. Each contact has `full_name`, `email`,
`phone`, `is_primary`.

Query 2 — `jobs.client_id`: used to build a `jobCountMap` for O(1) lookup per
client. All jobs in the org are fetched (14 rows). Safe at current scale.

### `ClientRow` type

```ts
type ClientRow = {
  id:       string;   // UUID
  name:     string;   // clients.name
  status:   string;   // "active" | "inactive"
  contact:  string;   // primary contact full_name
  email:    string;   // primary contact email
  phone:    string;   // primary contact phone
  jobCount: number;   // COUNT of jobs.client_id = client.id
};
```

### Contact resolution

`extractPrimaryContact`: finds first contact where `is_primary = true`, falls
back to `contacts[0]`, falls back to `null` (renders `—`). All 7 seeded clients
have exactly one primary contact — no fallback needed.

---

## RLS Verification

| Operation | Policy | Result |
|---|---|---|
| SELECT clients | `clients_select`: `org = auth_org_id() AND role IN (owner,admin,dispatcher)` | ✓ 7 rows returned |
| SELECT client_contacts embed | `client_contacts_select`: same condition | ✓ all contacts resolved |
| SELECT jobs (for count) | `jobs_select`: `org = auth_org_id() AND role IN (...)` | ✓ 14 rows (all client_ids resolved) |

---

## Clients Shown

**7 clients** (up from 6 in MOCK_CLIENTS — Riverside School is now visible):

| Client | Status | Contact | Job Count |
|---|---|---|---|
| City Bank Branch | active | Linda Torres | 1 |
| Green Valley Mall | active | Mike Johnson | 1 |
| Harbor Logistics | active | Sarah Wu | 1 |
| Metro Security Ltd | active | David Park | 6 |
| Riverside School | active | Pat Miller | 2 |
| Sunrise Hotel | inactive | James Lee | 1 |
| Tech Park Office | active | Amy Chen | 2 |

**Notes on counts:**
- Metro Security Ltd: 6 seeded jobs ✓
- Tech Park Office: 2 = 1 seeded (JOB-006) + 1 from Phase 4C-B conversion ✓
- Riverside School: 2 seeded jobs (JOB-007, JOB-009) ✓

---

## Limitations

| Item | Details |
|---|---|
| **Sites count** | No `sites` column or concept in DB schema — shows `—` on all cards |
| **`clients/[id]`** | Still uses `MOCK_CLIENTS` — Phase 4E-B |
| **Add Client** | Button remains visible but `disabled` with "Coming soon" label |
| **address** | `clients.address` is null in all seeded rows — not displayed on list page |
| **Job count scale** | Fetches all `jobs.client_id` rows to compute counts — safe for current scale (14 jobs); consider a DB aggregate for large datasets |

---

## Build Result

**✓ Clean — 0 TypeScript errors, 22 routes (unchanged count).**

`/clients` remains `ƒ (Dynamic)` — correct for an async Server Component.

---

## Lint Result

**✓ Clean — 0 ESLint errors or warnings.**

---

## Remaining Mock-Store / MOCK_CLIENTS Dependencies

| Page / Component | Mock dependency | Phase |
|---|---|---|
| `/clients/[id]` | `MOCK_CLIENTS` | Phase 4E-B |
| `/dashboard` | `useMockStore().requests` + `.jobs` | Phase 4G |
| `/technicians` | `MOCK_TECHNICIANS` | Phase 4F |
| `/invoices` | `MOCK_INVOICES` | Phase 4H |
| `/technician/*` | `useMockStore().jobs` | Phase 8C |
| `/client/*` | mock data | Phase 8D + 4H |
| `Sidebar` | hardcoded admin name/email | Phase 8E |

---

## Recommended Next Step

**Phase 4E-B — Migrate `/clients/[id]` detail page to Supabase.**

With `getClientList()` established and all client UUIDs known, add
`getClientById(id)` to `src/lib/data/clients.ts` and convert the detail page
to an async Server Component. The `/clients/${client.id}` links on the list
page already use real UUIDs — they just 404 until Phase 4E-B.

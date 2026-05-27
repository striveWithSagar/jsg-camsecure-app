# Supabase Phase 4H-A — Admin Invoices List Report

> Status: COMPLETE
> Date: 2026-05-25
> Project: JSG_CamSercure (ref: gbvstrhorjjvlxnfmxcz)

---

## What Changed

The admin `/invoices` page now reads live data from Supabase.
`MOCK_INVOICES` is fully removed from this route. The summary strip and invoice
table both source data from the `invoices` table with embedded `clients` and
`jobs` relations.

---

## Files Changed

| File | Type | Change |
|---|---|---|
| `src/lib/data/invoices.ts` | Created | `InvoiceRow`, `InvoiceSummary`, `InvoiceListData` types + `getInvoiceList()` |
| `src/app/(dashboard)/invoices/page.tsx` | Modified | Async Server Component — `MOCK_INVOICES` removed; uses `getInvoiceList()` |

### Files NOT changed

| File | Status |
|---|---|
| `src/lib/constants.ts` | Unchanged — `MOCK_INVOICES` still present (no longer consumed by any admin page) |
| `src/lib/mock-store.tsx` | Unchanged |
| All other pages | Unchanged |

---

## `getInvoiceList()` — `src/lib/data/invoices.ts`

### Single query with two embeds

```ts
supabase
  .from("invoices")
  .select("id, invoice_number, status, total, issued_at, due_at, clients(name), jobs(service_type)")
  .order("issued_at", { ascending: false, nullsFirst: false })
```

Returns all invoices in the org (admin RLS reads all rows), sorted newest-issued
first. `clients(name)` resolves the client name. `jobs(service_type)` resolves
the job type label (shown in the Job column). Both embeds are nullable — `null`
renders as `"—"`.

### Types

```ts
type InvoiceRow = {
  id:       string;   // UUID
  number:   string;   // invoice_number (e.g. "INV-001")
  client:   string;   // clients.name
  jobLabel: string;   // SERVICE_TYPE_LABELS[jobs.service_type] (e.g. "Maintenance")
  total:    number;   // Number(total) — handles numeric string from PostgREST
  status:   string;   // 'draft' | 'unpaid' | 'paid' | 'overdue' | 'cancelled'
  issued:   string;   // formatted issued_at (e.g. "May 17, 2026")
  due:      string;   // formatted due_at
};

type InvoiceSummary = {
  unpaidAmount, overdueAmount, paidAmount,   // sum of total per status bucket
  unpaidCount,  overdueCount,  paidCount,    // count per status bucket
  totalCount,                                // all invoices
};
```

---

## UI Changes

| Before (mock) | After (Supabase) |
|---|---|
| `export default function` (sync) | `export default async function` |
| `MOCK_INVOICES.length` | `summary.totalCount` |
| `inv.id` in table (e.g. "INV-001") | `inv.number` (from `invoice_number`) |
| `inv.client` | `inv.client` (from `clients.name` embed) |
| `inv.job` (e.g. "JOB-010") | `inv.jobLabel` (e.g. "Maintenance") |
| `inv.amount` | `inv.total` via `Number(raw.total)` |
| `inv.issued`, `inv.due` | `formatDate(issued_at)`, `formatDate(due_at)` |
| `inv.status !== "paid"` for Send Link | `status !== "paid" && status !== "cancelled"` |
| No empty state | Empty state panel when `invoices.length === 0` |
| Status badge: 3 styles | 5 styles — added `draft` and `cancelled` (neutral/muted) |

### Job column

The mock showed a short job ID ("JOB-010"). The DB stores a UUID in `job_id`.
The new column shows the **service type label** (e.g., "Maintenance", "Camera
Outage") — more readable than a UUID fragment and consistent with other pages.

---

## RLS

Admin RLS policy `invoices_select`:
```
organization_id = auth_org_id() AND auth_role() IN ('owner','admin','dispatcher')
```
All 7 seeded invoices are in the same org — admin reads all 7. ✓

---

## Invoices Shown (Seeded Data)

| Invoice | Client | Job | Amount | Status |
|---|---|---|---|---|
| INV-001 | Metro Security Ltd | Maintenance | $2,400 | unpaid |
| INV-007 | Metro Security Ltd | Camera Outage | $3,500 | unpaid |
| INV-006 | Metro Security Ltd | DVR/NVR Issue | $1,200 | paid |
| INV-004 | Green Valley Mall | New Installation | $4,200 | unpaid |
| INV-005 | Harbor Logistics | Wiring Issue | $980 | paid |
| INV-002 | City Bank Branch | DVR/NVR Issue | $1,850 | paid |
| INV-003 | Sunrise Hotel | Maintenance | $650 | overdue |

**Summary strip:**
- Unpaid: $9,100 (3 invoices)
- Overdue: $650 (1 invoice)
- Paid: $4,030 (3 invoices)

---

## Limitations

| Item | Detail |
|---|---|
| **Invoice detail page** | No `/invoices/[id]` page yet — rows are not clickable |
| **Send Link** | Disabled with "Coming soon" — no email/payment integration |
| **Create Invoice** | Disabled with "Coming soon" |
| **Mark as Paid** | No action — status updates not implemented (future phase) |
| **Sort / filter** | Table shows all invoices, newest-issued first; no client/status filter UI |

---

## Build Result

**✓ Clean — 0 TypeScript errors, 22 routes (unchanged count).**

`/invoices` remains `ƒ (Dynamic)`.

---

## Lint Result

**✓ Clean — 0 ESLint errors or warnings.**

---

## Remaining Mock Dependencies

| Page / Component | Mock dependency | Phase |
|---|---|---|
| `/technician/*` | `useMockStore().jobs` | Phase 8C |
| `/client/*` | mock data | Phase 8D |
| `Sidebar` | hardcoded admin name/email | Phase 8E |
| `constants.ts` | `MOCK_TECHNICIANS`, `MOCK_INVOICES`, `MOCK_CLIENTS` | Remove when portals migrated |

**All admin list/detail pages are now Supabase-backed:**
`/dashboard`, `/jobs`, `/jobs/[id]`, `/requests`, `/requests/[id]`,
`/clients`, `/clients/[id]`, `/technicians`, `/invoices` ✓

---

## Recommended Next Step

**Phase 8C — Technician portal: migrate `/technician/jobs` from `useMockStore()` to Supabase.**

With all admin pages migrated, the next meaningful block is the technician portal.
The technician session will require RLS to filter jobs by `technician_id = auth.uid()`
— this depends on Phase 8 auth wiring for the technician role.

Alternatively: **Phase 8E — Wire Sidebar live session values** (admin name/email
from the authenticated `profiles` row). This is a smaller, lower-risk change that
can be done before the portal auth work.

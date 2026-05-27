# Supabase Phase 8D-E — Client Jobs & Invoices Migration Report

> Status: COMPLETE
> Date: 2026-05-26
> Project: JSG_CamSecure (ref: gbvstrhorjjvlxnfmxcz)

---

## What Changed

`/client/jobs` and `/client/invoices` are now fully backed by Supabase.
`useMockStore`, `MOCK_CLIENT`, `MOCK_INVOICES`, and all hardcoded client-name
filters are removed. Both pages are async Server Components using the
`getClientJobs()` and `getClientInvoices()` helpers from `client-portal.ts`.

---

## Files Changed

| File | Type | Change |
|---|---|---|
| `src/app/(client)/client/jobs/page.tsx` | Modified | Removed `"use client"`, `useMockStore`, `MOCK_CLIENT`, `CLIENT_NAME`, manual sort; async Server Component using `getClientJobs()`; `JobCard` typed with `ClientJobItem`; `cancelled` status added to `CLIENT_STATUS_LABEL` |
| `src/app/(client)/client/invoices/page.tsx` | Modified | Removed `MOCK_INVOICES`, `MOCK_CLIENT`, `CLIENT_NAME`; async Server Component using `getClientInvoices()`; `inv.invoiceNumber` replaces `inv.id`; `inv.total` replaces `inv.amount`; `inv.serviceType` replaces `inv.job`; `INV_CONFIG` extended with `draft` + `cancelled` entries; empty-state border added |

### Files NOT changed

| File | Status |
|---|---|
| `src/lib/data/client-portal.ts` | Unchanged — helpers already created in Phase 8D-D |
| `src/app/(client)/client/requests/new/page.tsx` | Unchanged — Phase 8D-F |

---

## Architecture

```
/client/jobs/page.tsx  (Server Component — async)
  └── getClientJobs()   ← RLS: client_id = auth_client_id(), role = 'client'
  └── active    = jobs.filter(status ∉ completed, cancelled)
  └── completed = jobs.filter(status = completed)
  └── JobCard({ job: ClientJobItem })   ← Server Component

/client/invoices/page.tsx  (Server Component — async)
  └── getClientInvoices()   ← RLS: client_id = auth_client_id(), role = 'client'
  └── totalPaid   = sum of paid invoices
  └── totalUnpaid = sum of non-paid invoices
  └── InvoiceCard({ inv: ClientInvoiceItem })   ← Server Component
```

---

## Design Decisions

### Jobs page
- **Sort already handled by `getClientJobs()`** — STATUS_ORDER sort removed from page.
- **`cancelled` jobs** excluded from the active section (alongside completed). They don't appear in seeded data but the filter is correct.
- **Job ID display** — UUID shown in `font-mono text-muted-foreground/60` (same design as mock; de-emphasized). No job number field exists in schema.
- **Client-friendly status labels** — `CLIENT_STATUS_LABEL` map preserved and extended with `cancelled`.

### Invoices page
- **`inv.invoiceNumber`** replaces the mock `inv.id` ("INV-001" string) — same display value from real DB.
- **`inv.serviceType`** replaces the mock `inv.job` ("JOB-010") — more meaningful to a client.
- **`INV_CONFIG`** extended: `draft` and `cancelled` statuses handled with neutral styling so unexpected values never crash the page.
- **`Pay Now` button** remains disabled with "Online payment coming soon" — Stripe not in scope.
- **`isUnpaid` guard** — hides Pay Now for cancelled invoices (only shown for `unpaid` / `overdue` / `draft`).
- **Summary totals** — `totalPaid` / `totalUnpaid` computed from `total` (already a `number` after `Number()` coercion in helper).

---

## Verification

### Mock references removed

Grep over `jobs/page.tsx` and `invoices/page.tsx`:
- `useMockStore` → **0 matches**
- `MOCK_CLIENT`  → **0 matches**
- `MOCK_INVOICES` → **0 matches**
- `CLIENT_NAME`  → **0 matches**

### Live Supabase data for David Park / Metro Security Ltd

**Jobs (6 total):**

| Site | Service Type | Status |
|---|---|---|
| Downtown Office Tower | Camera Outage | `in_progress` |
| East Wing Level 3 | DVR/NVR Issue | `in_progress` |
| Lobby Reception | Camera Outage | `assigned` |
| Car Park Level 2 | New Installation | `assigned` |
| Parking Structure B | Maintenance | `completed` |
| Server Room | DVR/NVR Issue | `completed` |

Jobs page shows: **4 active · 2 completed**

**Invoices (3 total):**

| Invoice | Status | Total | Due |
|---|---|---|---|
| INV-001 | unpaid | $2,400 | May 31, 2026 |
| INV-006 | paid   | $1,200 | May 29, 2026 |
| INV-007 | unpaid | $3,500 | May 28, 2026 |

Invoices page summary: **Total paid $1,200 · Outstanding $5,900**

### No data leakage

All other clients (City Bank, Green Valley Mall, Harbor Logistics, Riverside School,
Sunrise Hotel, Tech Park Office) have their own jobs and invoices that are inaccessible
when `auth_client_id() = a0000000-...000101`. RLS enforces this — no app-level
`client_id` filter needed.

---

## Build Result

**✓ Clean — 0 TypeScript errors, 24 routes (unchanged count).**

---

## Lint Result

**✓ Clean — 0 ESLint errors or warnings.**

---

## Remaining Mock Dependencies (client portal)

| File | Dependency | Phase |
|---|---|---|
| `src/app/(client)/client/requests/new/page.tsx` | `useMockStore`, `MOCK_CLIENT` | 8D-F |

---

## Remaining Limitations

| Item | Detail |
|---|---|
| **Job ID is a UUID** | `/client/jobs` shows the full UUID in de-emphasized mono text. No `job_number` field exists in the schema. Could add a computed short-ref column in a future migration. |
| **No job detail page for clients** | Job cards link to `/client/jobs` (list) rather than individual job pages. A `/client/jobs/[id]` detail view is not in scope for this phase. |
| **Pay Now is disabled** | Stripe integration not in scope. Button renders as disabled with explanatory text. |
| **`issued_at` / `due_at` are UTC midnight timestamps** | Dates render as e.g. "May 31, 2026" using server locale. Off-by-one day risk for timezones west of UTC, same as `formatScheduled()` in other helpers. |

---

## Recommended Next Step

**Phase 8D-F — Client new service request form.**

Wire `/client/requests/new` to a real Supabase INSERT into `service_requests`,
using `orgId`, `clientId`, and `contactId` from `ClientProfileData` (already
available via `useClientProfile()` context). Map UI urgency labels to DB enum values.
Remove `useMockStore.addRequest()` and `MOCK_CLIENT`.

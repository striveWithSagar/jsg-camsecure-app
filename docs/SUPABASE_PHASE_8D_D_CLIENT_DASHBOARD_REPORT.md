# Supabase Phase 8D-D — Client Dashboard Data Migration Report

> Status: COMPLETE
> Date: 2026-05-26
> Project: JSG_CamSecure (ref: gbvstrhorjjvlxnfmxcz)

---

## What Changed

The client overview dashboard (`/client`) is now fully backed by Supabase.
`useMockStore`, `MOCK_CLIENT`, and `MOCK_INVOICES` are completely removed from
`ClientDashboardView` and `client/page.tsx`. Both files are now Server Components.
All job and invoice data is fetched at request time via RLS-filtered Supabase queries.

---

## Files Changed

| File | Type | Change |
|---|---|---|
| `src/lib/data/client-portal.ts` | Created | `getClientJobs()` + `getClientInvoices()` — RLS-filtered server helpers with service-type labels, formatted dates, active-first sort |
| `src/app/(client)/client/page.tsx` | Modified | Async Server Component; `Promise.all([getCurrentClientProfile(), getClientJobs(), getClientInvoices()])` → props into `ClientDashboardView` |
| `src/app/(client)/client/ClientDashboardView.tsx` | Modified | Removed `"use client"`, `useMockStore`, `MOCK_CLIENT`, `MOCK_INVOICES`; now a Server Component accepting `{ profile, jobs, invoices }` props |

### Files NOT changed

| File | Status |
|---|---|
| `src/app/(client)/client/jobs/page.tsx` | Unchanged — Phase 8D-E |
| `src/app/(client)/client/invoices/page.tsx` | Unchanged — Phase 8D-E |
| `src/app/(client)/client/requests/new/page.tsx` | Unchanged — Phase 8D-F |

---

## Architecture

```
(client)/layout.tsx  (Server Component — async)
  └── getCurrentClientProfile()
  └── profile === null → redirect("/login/client")
  └── ClientProfileProvider({ profile })
        ├── ClientHeader       ← useClientProfile() → companyName, name, initials, signout
        └── {children}

/client/page.tsx  (Server Component — async)
  └── Promise.all([getCurrentClientProfile(), getClientJobs(), getClientInvoices()])
  └── ClientDashboardView({ profile, jobs, invoices })   ← Server Component
        └── activeJobs     = jobs.filter(status ∉ completed, cancelled)
        └── completedJobs  = jobs.filter(status = completed)
        └── unpaidInvoices = invoices.filter(status ≠ paid)
```

---

## `getClientJobs()` Design

**Location:** `src/lib/data/client-portal.ts`

**Query:**
```ts
supabase
  .from("jobs")
  .select("id, service_type, priority, status, site_name, address, scheduled_at")
  .order("scheduled_at", { ascending: true, nullsFirst: false })
```

No `eq("client_id", ...)` in app code — RLS policy enforces this:
```sql
(client_id = auth_client_id()) AND (auth_role() = 'client')
```

**Sort (in-memory after mapping):**
```
in_progress → started → on_the_way → assigned → needs_parts → rescheduled → completed → cancelled
```
Within each status group, `scheduled_at` ASC order from DB is preserved.

---

## `getClientInvoices()` Design

**Location:** `src/lib/data/client-portal.ts`

**Query:**
```ts
supabase
  .from("invoices")
  .select("id, invoice_number, status, total, issued_at, due_at, jobs(service_type)")
  .order("issued_at", { ascending: false })
```

No `eq("client_id", ...)` in app code — RLS policy enforces this:
```sql
(client_id = auth_client_id()) AND (auth_role() = 'client')
```

`total` is returned as a numeric string by PostgREST — coerced with `Number(row.total)`.

---

## Verification

### Mock references removed

Grep over `client/page.tsx` and `ClientDashboardView.tsx`:
- `useMockStore` → **0 matches**
- `MOCK_CLIENT`  → **0 matches**
- `MOCK_INVOICES` → **0 matches**

### Live Supabase data for David Park

RLS identity chain: `auth.uid() = ae091c96-...` → `client_contacts.profile_id` → `client_id = a0000000-...000101` (Metro Security Ltd)

**6 jobs visible when `auth_client_id() = a0000000-...000101`:**

| Site | Service Type | Status | Priority |
|---|---|---|---|
| Downtown Office Tower | Camera Outage | `in_progress` | emergency |
| East Wing Level 3 | DVR/NVR Issue | `in_progress` | medium |
| Lobby Reception | Camera Outage | `assigned` | high |
| Car Park Level 2 | New Installation | `assigned` | medium |
| Parking Structure B | Maintenance | `completed` | low |
| Server Room | DVR/NVR Issue | `completed` | high |

Dashboard stats: **4 active · 2 completed · 2 open invoices**

**3 invoices visible when `auth_client_id() = a0000000-...000101`:**

| Invoice | Status | Total | Due |
|---|---|---|---|
| INV-001 | unpaid | $2,400 | May 31, 2026 |
| INV-006 | paid | $1,200 | May 29, 2026 |
| INV-007 | unpaid | $3,500 | May 28, 2026 |

Outstanding (unpaid) shown in dashboard: **INV-001 + INV-007** (INV-006 hidden, status = paid).

### No data leakage

Jobs and invoices from City Bank, Sunrise Hotel, Green Valley Mall, and Harbor Logistics
are excluded by RLS — no `client_id` filter needed in app code.

### Route guard

Unauthenticated `/client` → `getCurrentClientProfile()` returns null → layout redirects to `/login/client`.

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
| `src/app/(client)/client/jobs/page.tsx` | `useMockStore`, `MOCK_CLIENT` | 8D-E |
| `src/app/(client)/client/invoices/page.tsx` | `MOCK_CLIENT`, `MOCK_INVOICES` | 8D-E |
| `src/app/(client)/client/requests/new/page.tsx` | `useMockStore`, `MOCK_CLIENT` | 8D-F |

---

## Recommended Next Step

**Phase 8D-E — Client jobs list and invoices list data migration.**

Wire `/client/jobs` and `/client/invoices` pages to Supabase using the
`getClientJobs()` and `getClientInvoices()` helpers already created in Phase 8D-D.
Remove `useMockStore` and `MOCK_CLIENT` from both pages.

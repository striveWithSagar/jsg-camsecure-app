# Supabase Phase 9A — Migration Completion Audit Report

> Status: COMPLETE (audit only — no code changes)
> Date: 2026-05-26
> Project: JSG_CamSecure (ref: gbvstrhorjjvlxnfmxcz)
> Build: ✓ 0 TypeScript errors, 24 routes
> Lint:  ✓ 0 ESLint errors or warnings

---

## 1. Fully Supabase-Backed

### Admin portal (`(dashboard)/`)
| Route | Data source |
|---|---|
| `/dashboard` | `getDashboardData()` — jobs, requests, technicians, invoices aggregated |
| `/jobs` | `getJobs()` — full job board with status/priority |
| `/jobs/[id]` | `getJobById()` + `JobDetail` client component — status update, technician reassignment, notes via Supabase |
| `/requests` | `getServiceRequests()` — RLS-filtered org-scoped list |
| `/requests/new` | `NewRequestForm` — real Supabase INSERT into `service_requests` |
| `/requests/[id]` | `getServiceRequestById()` + `RequestDetail` — notes + status update via Supabase |
| `/clients` | `getClientList()` — live Supabase data |
| `/clients/[id]` | `getClientById()` — live Supabase data |
| `/invoices` | `getInvoiceList()` — live Supabase data |
| `/technicians` | `getTechnicianList()` — live Supabase data |
| `(dashboard)/layout.tsx` | `getCurrentProfile()` + `ProfileProvider` — real auth session |

### Technician portal (`(technician)/`)
| Route | Data source |
|---|---|
| `/technician` | `getCurrentProfile()` + `getTechJobList()` — live RLS-filtered data |
| `/technician/jobs` | `getTechJobList()` — RLS: `technician_id = auth_technician_id()` |
| `/technician/jobs/[id]` | `getJobById()` + `TechJobDetail` — real job data |
| `(technician)/layout.tsx` | `getCurrentProfile()` + role guard (`role !== 'technician'` → redirect) |
| `TechHeader` | `useProfile()` — signout via `supabase.auth.signOut()` |
| `JobStatusWidget` | Browser Supabase client — `jobs.update({ status })` + trigger auto-inserts `job_status_history` |
| `/login/technician` | Real `signInWithPassword` + role check |

### Client portal (`(client)/`)
| Route | Data source |
|---|---|
| `/client` | `getCurrentClientProfile()` + `getClientJobs()` + `getClientInvoices()` |
| `/client/jobs` | `getClientJobs()` — RLS: `client_id = auth_client_id()` |
| `/client/invoices` | `getClientInvoices()` — RLS: `client_id = auth_client_id()` |
| `/client/requests/new` | Browser Supabase INSERT into `service_requests` with full identity payload |
| `(client)/layout.tsx` | `getCurrentClientProfile()` + role guard (`role !== 'client'` → redirect) |
| `ClientHeader` | `useClientProfile()` — company name, contact name, signout |
| `/login/client` | Real `signInWithPassword` + role check |

---

## 2. Still Mock / Fake

### `(dashboard)/requests/[id]/convert/page.tsx` + `ConvertJobForm.tsx`

**Severity: High** — This is the most significant remaining mock dependency.

- `useMockStore()` used to look up the request by ID
- `MOCK_CLIENTS` used to populate client selector dropdown
- `MOCK_TECHNICIANS` used to populate technician selector dropdown
- `store.convertToJob()` writes to localStorage, not Supabase
- Success screen says "The job will appear on the Job Board after Phase 4D migration" — stale message from early development

The form itself has real Supabase client types (`ClientOption`, `TechnicianOption`) imported and accepted as props, but the page populates them from mock arrays instead of calling the real data helpers. `getClientList()` and `getTechnicianList()` already exist and return the exact types needed.

### `(dashboard)/settings/page.tsx`

**Severity: Medium** — All save actions are fake toasts.

- `saveOrg()` → `toast.success("Organization saved — demo only")`
- `saveNotifs()` → `toast.success("Notification preferences saved — demo only")`
- `saveAccount()` → `toast.success("Account updated — demo only")`
- `saveInteg()` → `toast.info("... coming soon")`
- Admin name/email fields pre-filled with hardcoded `"JSG Admin"` / `"admin@jsg.com"`
- Password change field renders but does nothing
- Integrations list still shows `"Supabase (Database)"` as "Not connected — integration upcoming" — factually wrong now

### `src/app/providers.tsx` + `MockStoreProvider`

**Severity: Low** — `MockStoreProvider` still wraps the entire app via `AppProviders` in `layout.tsx`. The only active consumers of `useMockStore()` are `ConvertJobForm` and the convert page. `MockStoreProvider` initialises localStorage state on every page load for no benefit outside those two files.

---

## 3. What Should Be Deleted

These files/exports have zero remaining active consumers outside of each other once the convert flow is migrated:

| File | Can delete when |
|---|---|
| `src/lib/mock-store.tsx` | After `ConvertJobForm` is migrated to Supabase |
| `src/lib/mock-session.ts` | Now — `MOCK_ADMIN`, `MOCK_TECHNICIAN`, `MOCK_CLIENT` have zero imports outside the file itself |
| `src/app/providers.tsx` | After `MockStoreProvider` is removed (can be replaced with a minimal no-op or removed entirely from `layout.tsx`) |

**Constants safe to delete from `src/lib/constants.ts`:**
| Export | Status |
|---|---|
| `MOCK_JOBS` | No consumers outside `mock-store.tsx` and `constants.ts` itself |
| `MOCK_REQUESTS` | No consumers outside `mock-store.tsx` |
| `MOCK_CLIENTS` | Used only in convert page — delete after Phase 9B |
| `MOCK_TECHNICIANS` | Used only in convert page — delete after Phase 9B |
| `MOCK_INVOICES` | No consumers — safe to delete now |
| `MOCK_METRICS` | No consumers — safe to delete now |

---

## 4. What Should Stay

**Constants with real UI config value (keep permanently):**
| Export | Used by |
|---|---|
| `PRIORITY_LABELS` | `ConvertJobForm`, `JobDetail`, `StatusBadge` |
| `STATUS_LABELS` | `StatusBadge`, `JobDetail` |
| `REQUEST_STATUS_LABELS` | `RequestsTable`, `RequestDetail` |
| `SERVICE_TYPES` | `NewRequestForm`, client `requests/new` page |
| `URGENCY_LEVELS` | `NewRequestForm`, client `requests/new` page |
| `PRIORITY_BADGE_CLASS` | `StatusBadge` |
| `STATUS_BADGE_CLASS` | `StatusBadge` |
| `NAV_ITEMS` | Sidebar |

These are display-layer config, not data — they correctly belong in `constants.ts`.

---

## 5. Fake / Disabled / Misleading Buttons

| Location | Button / Action | State | Risk |
|---|---|---|---|
| `/settings` — all sections | Save Organization, Save Preferences, Update Account | Fake — toast "demo only", no DB write | Medium — admin expects saves to persist |
| `/settings` — Integrations | Connect (Stripe, Resend, Supabase) | No-op toast | Low — cosmetic |
| `/settings` — Supabase integration | Shows "Not connected" | Factually wrong — Supabase IS connected | Low — cosmetic confusion |
| `/invoices` (admin) | Create Invoice | Disabled, "Coming soon" | Low — expected limitation |
| `/invoices` (admin) | Send Link (per invoice) | Disabled, "Coming soon" | Low — expected limitation |
| `/client/invoices` | Pay Now | Disabled, "Online payment coming soon" | Low — expected limitation |
| `/technicians` | Add Technician | Disabled, "Coming soon" | Low — expected limitation |
| `/clients` | Add Client | Disabled, "Coming soon" | Low — expected limitation |
| `/clients/[id]` | Edit Client | Disabled, "Coming soon" | Low — expected limitation |
| `/jobs/[id]` (admin) | Photo upload (2 buttons) | Disabled, "Photo upload coming soon" | Low — expected limitation |
| `/technician/jobs/[id]` | Field notes textarea | Disabled, "Coming soon" | Low — expected limitation |
| `/client/requests/new` | Photo upload area | Non-interactive placeholder | Low — expected limitation |
| `/client/jobs` — each card | "Detailed view — coming soon" | Static text | Low — no `/client/jobs/[id]` page |
| `/requests/[id]/convert` | Create Job (form submit) | Writes to localStorage only | **High** — admin believes job was created in DB |

---

## 6. Auth / RLS Risk Assessment

### Risk: Admin layout does not check `role`
**File:** `src/app/(dashboard)/layout.tsx`
**Issue:** `getCurrentProfile()` returns a profile for any authenticated user regardless of role. The layout only checks `if (!profile)`. A client or technician who navigates to `/dashboard` will not be redirected — they'll see the admin UI shell with empty data (RLS blocks the data queries), but the UI itself is accessible.
**RLS mitigation:** All admin data queries (`getDashboardData`, `getJobs`, `getServiceRequests`, etc.) use RLS policies that check `auth_role() in ('owner', 'admin', 'dispatcher')`. A client/technician would see empty lists, not data they shouldn't see.
**Risk level:** Medium — no data leaks, but unauthenticated cross-role access to admin UI is a UX/security gap.
**Fix:** Add `if (profile.role !== 'admin') redirect('/login/admin')` to the admin layout (same pattern as technician and client layouts).

### Risk: Admin login has no role check
**File:** `src/app/(auth)/login/admin/page.tsx`
**Issue:** After `signInWithPassword` succeeds, the admin login page unconditionally pushes to `/dashboard`. It does not verify `profile.role === 'admin'`. A technician or client could log in via `/login/admin` and be routed to `/dashboard`.
**RLS mitigation:** Same as above — they'd see empty data.
**Risk level:** Medium — session would be set to the wrong portal, causing confusing empty state.
**Fix:** After sign-in, fetch `profiles.role` and check it, same pattern as technician and client login pages.

### Risk: `MockStoreProvider` wraps the entire app
**File:** `src/app/providers.tsx`
**Issue:** `MockStoreProvider` runs on every page load and hydrates mock data from localStorage into React Context. Only two files still consume it. The localStorage key `jsg_camsecure_v1` persists stale demo request/job data that has no relation to the live database.
**Risk level:** Low — no auth bypass, but the localStorage state could confuse future debugging or if a developer adds a `useMockStore()` call by mistake.

### Risk: Convert form writes to localStorage, not Supabase
**File:** `src/app/(dashboard)/requests/[id]/convert/page.tsx`
**Issue:** When an admin converts a request to a job, `store.convertToJob()` writes to localStorage only. The admin sees a success screen, but no job is created in Supabase. The job board will never show the "created" job. The request status is not updated in Supabase.
**Risk level:** High — this is a broken critical admin workflow. An admin using this in production will believe a job exists when it does not.

### Existing protections that are working correctly
- Technician layout: `role !== 'technician'` → redirect `/login/technician` ✓
- Client layout: `role !== 'client'` → redirect `/login/client` ✓ (via `getCurrentClientProfile()` returning null)
- RLS on all tables: client/technician data is siloed by `auth_client_id()` / `auth_technician_id()` ✓
- No service_role key anywhere in app code ✓
- No direct auth.users INSERT in app code ✓

---

## 7. Schema Gaps Discovered During Migration

| Gap | Detail | Recommended action |
|---|---|---|
| **`service_requests.address`** | Form captures site address but no column exists. Address is validated but discarded. | Add `site_address text not null default ''` in a future migration. |
| **`service_requests.preferred_at`** | "Preferred date / time" datetime input is captured but not stored. | Add `preferred_at timestamptz` in a future migration. |
| **Photo uploads** | Both admin job detail and client new request have upload placeholders. No Supabase Storage bucket configured. | Create `job-photos` bucket + `job_photos` table rows pointing to Storage paths. |
| **Client request history** | Clients can submit requests but have no `/client/requests` list page. The select RLS policy is in place (`client_id = auth_client_id()`). | Add `/client/requests` list page — no schema changes needed. |
| **Job number / human reference** | Jobs use UUID primary keys. No `job_number` field. Client jobs page shows raw UUIDs. Submitted requests show an 8-char UUID hex segment as "reference". | Add a `job_number` sequence trigger (e.g. `JOB-0001`) and a similar `request_number` for service_requests. |
| **Invoice creation** | Admin `/invoices` has a disabled "Create Invoice" button. No invoice creation flow exists. | Needs a form + Supabase INSERT into `invoices` + `invoice_items`. |
| **Invoice "Send Link"** | Disabled — requires Stripe + Resend integration. | Out of scope until Phase 10+. |
| **Settings persistence** | `company_settings` table exists in schema with `org_name`, `phone`, `address`, `email_footer`, etc. The settings page uses hardcoded `useState` and fake saves. | Wire settings page to read from and write to `company_settings` via Supabase. |
| **Admin account management** | Settings page has admin name/email/password fields that don't persist. | Wire to `supabase.auth.updateUser()` for email/password + `profiles.update()` for display name. |
| **`jobs.convert_request` RPC** | The `convert_request_to_job` RPC exists in the schema (Phase 3A) but the convert form still uses `store.convertToJob()` (localStorage). | Replace convert form submit with a call to the existing RPC. |

---

## 8. Summary: What Is and Isn't Mock

### Fully live (Supabase-backed)
- All three portals: auth, layout guards, data reads
- Technician job status updates
- Admin job status + technician reassignment + job notes
- Admin request status updates + notes
- Client service request submission
- All list and detail pages across all three portals

### Still mock / fake
1. **Convert request → job** (`/requests/[id]/convert`) — localStorage write, not Supabase
2. **Settings page** — all saves are fake toasts
3. **`MockStoreProvider`** — still wraps the entire app unnecessarily
4. **`providers.tsx`** — still imports and renders `MockStoreProvider`

### Safe to delete (no consumers)
- `src/lib/mock-session.ts` — all three `MOCK_*` identities fully replaced; zero imports outside the file itself
- `MOCK_INVOICES` from `constants.ts` — zero consumers
- `MOCK_METRICS` from `constants.ts` — zero consumers

### Deletable after Phase 9B (convert form migration)
- `src/lib/mock-store.tsx` — only consumed by convert flow
- `MOCK_CLIENTS`, `MOCK_JOBS`, `MOCK_REQUESTS` from `constants.ts`
- `src/app/providers.tsx` (or replace with a no-op shell)

---

## 9. Recommended Next Phase

**Phase 9B — Convert request → job (admin): replace `store.convertToJob()` with the existing `convert_request_to_job` Supabase RPC.**

This is the highest-priority remaining work because it is a broken critical admin workflow that silently appears to succeed. The RPC, the `ConvertJobForm` component structure, and the real data helpers (`getClientList()`, `getTechnicianList()`) are all already in place. The page just needs to:
1. Become an async Server Component that fetches real request data + client/technician lists
2. Replace `store.convertToJob()` with a browser Supabase call to the RPC
3. Remove `useMockStore`, `MOCK_CLIENTS`, `MOCK_TECHNICIANS`

After Phase 9B, `mock-store.tsx`, `mock-session.ts`, and the mock arrays in `constants.ts` can all be deleted in a single cleanup commit.

**Phase 9C** (recommended immediately after 9B): Settings page — wire to `company_settings` table and `supabase.auth.updateUser()`.

**Phase 9D**: Admin role guard in `(dashboard)/layout.tsx` and role check in `/login/admin` — low effort, eliminates the cross-role UI access gap.

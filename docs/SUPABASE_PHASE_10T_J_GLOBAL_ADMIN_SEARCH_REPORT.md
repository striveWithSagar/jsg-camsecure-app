# Phase 10T-J: Functional Global Admin Search — Report

**Date:** 2026-06-07
**Build:** ✅ 38 routes · 0 TypeScript errors
**Lint:** ✅ 0 errors · 0 warnings

---

## 1. Root Cause

`TopBar.tsx` rendered a plain `<Input>` with placeholder "Search jobs, clients, requests…" and **no `value`, `onChange`, or any backing logic** — purely decorative. There was no API route, no data function, and no UI for results. Admin/owner/dispatcher users could type into the box and nothing would happen.

---

## 2. Files Changed

| File | Change |
|---|---|
| `src/lib/data/global-search.ts` | **New** — server-side `globalSearch()` data function (org-scoped via RLS, parallel queries, dedupe/cap/format) |
| `src/app/api/admin/search/route.ts` | **New** — `GET /api/admin/search?q=` route; auth + role guard, delegates to `globalSearch()` |
| `src/components/layout/GlobalSearch.tsx` | **New** — client component: debounced input, dropdown, grouped results, keyboard nav, click-outside |
| `src/components/layout/TopBar.tsx` | Replaced the decorative search `<div>`/`<Input>` with `<GlobalSearch />`; updated import list |

No other files were touched. The search bar's position, sizing, and surrounding TopBar layout are unchanged — only its internals went from decorative to functional, and the placeholder now reads **"Search jobs, requests, clients, technicians…"**.

---

## 3. Entities and Fields Searched

| Entity | Matched on | Result links to |
|---|---|---|
| **Jobs** | `JOB-0035` / `35` identifier (`job_number`), site name, address, client/company name (via `client_id` → `clients.name`/`client_contacts`), service type label (e.g. "camera" → `camera_outage`), status label | `/jobs/[jobId]` |
| **Service Requests** | `REQ-0035` / `35` identifier (`request_number`), `client_name`, `site_address`, `description`, service type label, status label | `/requests/[requestId]` |
| **Clients** | company `name`, `address`, primary-contact `full_name`/`email`/`phone` (via `client_contacts`) | `/clients/[clientId]` |
| **Technicians** | profile `full_name`/`email`/`phone` (via `profiles`, `role = 'technician'`), `specialty` | `/technicians/[technicianId]` |

A bare number (e.g. `35`) matches **both** job and request numbers; `JOB-`/`REQ-` prefixed identifiers match only their own entity. Minimum 2 characters required unless the input parses as a job/request identifier.

---

## 4. Security & Org-Scoping Method

- **Auth gate:** the route calls `supabase.auth.getUser()` — unauthenticated requests get HTTP 401. It then loads the caller's `profiles.role` and requires membership in `{admin, owner, dispatcher}` (matching the `(dashboard)` layout's `ADMIN_ROLES` — every role that can see the TopBar can use the search) — otherwise HTTP 403.
- **Org scoping:** the route uses `createClient()` — the **authenticated server client bound to the user's cookie session** — for every query. **No service-role key is used anywhere in this feature.** All org-scoping is enforced by **RLS policies already present on every queried table**, confirmed live against the database (see §6): `jobs`, `service_requests`, `clients`, `client_contacts`, `technicians`, and `profiles` all have `rls_enabled = true` with `SELECT` policies of the form `organization_id = auth_org_id() AND auth_role() = ANY(['owner','admin','dispatcher', ...])`. The application code never adds a manual `.eq("organization_id", ...)` — exactly as the rest of the codebase's data functions already work, and per the spec's preference for relying on RLS rather than re-implementing scoping in app code.
- **Injection safety:** user text is **never** interpolated into a combined `.or()` filter string (which would require manual escaping with no documented-safe recipe — confirmed via Supabase docs search). Instead every filter is an independent `.ilike()`/`.eq()`/`.in()` call; each value is passed through the client library's own parameter encoding. Wildcard characters (`\`, `%`, `_`) in user input are escaped via `escapeLikePattern()` before being wrapped in `%...%`, so a search for e.g. `50%` or `a_b` matches literally rather than as a wildcard pattern.
- **Minimal data exposure:** each entity query selects only the columns needed to render a label/secondary line/badge and to build the destination link (e.g. jobs: `id, job_number, site_name, address, service_type, status, scheduled_at, clients(name)` — no internal notes, no financial data, no full address breakdowns beyond what's already shown in list views).
- **Result caps:** max 5 results per category (`RESULT_LIMIT`), with bounded lookup queries (`LOOKUP_LIMIT = 10`) for resolving matching client/technician IDs before the final fetch.

---

## 5. UI Behavior Implemented

- 300 ms debounce after the user stops typing; requests are aborted (`AbortController`) if the query changes mid-flight
- Loading spinner inside the input while a search is in flight
- Dropdown panel grouped by entity (Jobs / Service Requests / Clients / Technicians), each header shown only when it has results
- Each result row shows an icon (`Briefcase`/`Inbox`/`Users`/`HardHat`), a primary label, secondary text, and a status badge (jobs/requests/technicians) using the existing `STATUS_LABELS`/`REQUEST_STATUS_LABELS` maps
- Click or Enter navigates via `router.push()` (no full page reload) and resets the search box
- Keyboard navigation: `ArrowDown`/`ArrowUp` cycle through results (wrapping), `Enter` opens the active (or first) result, `Escape` closes the panel and blurs the input
- Click-outside (via `mousedown` + `containerRef.contains`) closes the panel
- Clearing the input clears results and returns to the idle state
- Empty/short-query state: **"Start typing to search"**; no-match state: **"No matching records found"**; error state: **"Something went wrong. Try again."**
- The dropdown is `absolute`/`z-50` with `max-h-[28rem] overflow-y-auto`, positioned relative to the search container — not clipped by the TopBar's overflow
- The component keeps the existing `hidden sm:block` responsive behavior of the original search box (consistent with "do not redesign the search bar" — mobile continues to show the menu/title/actions without the search field, exactly as before)

---

## 6. Verification Results

### Database / RLS verification (via Supabase MCP `execute_sql` against project `gbvstrhorjjvlxnfmxcz`)

**RLS is enabled on every table the search touches**, confirmed live:

| Table | RLS enabled | SELECT policy enforces org + role |
|---|---|---|
| `jobs` | ✅ | `organization_id = auth_org_id()` AND role ∈ {owner, admin, dispatcher} (or technician/client row-ownership) |
| `service_requests` | ✅ | `organization_id = auth_org_id()` AND role ∈ {owner, admin, dispatcher} (or client row-ownership) |
| `clients` | ✅ | `organization_id = auth_org_id()` AND role ∈ {owner, admin, dispatcher, technician} |
| `client_contacts` | ✅ | `organization_id = auth_org_id()` AND role ∈ {owner, admin, dispatcher} |
| `technicians` | ✅ | `organization_id = auth_org_id()` AND role ∈ {owner, admin, dispatcher} |
| `profiles` | ✅ | `organization_id = auth_org_id()` |

Because `globalSearch()` runs exclusively through the authenticated server client (cookie-session bound), **every query above is automatically filtered to the caller's organization and role by Postgres itself** — the same mechanism every other admin data function in this codebase relies on. (Note: this project currently has only **one** organization in the database, so a live cross-org negative test isn't possible with real data — but the policy definitions above are the actual enforcement mechanism and were inspected directly, not inferred.)

### Data-layer scenario verification (live queries mirroring `globalSearch()`'s exact filters)

| Scenario | Result |
|---|---|
| Search `31` (bare number) | Matches **both** `JOB-0031` (site "rahon, punjab, india", completed) and `REQ-0031` (client "Rahon", converted) — confirms dual job/request number matching ✅ |
| Search `metro` | Matches client **Metro Security Ltd**, 5 service requests with `client_name = "Metro Security Ltd"`, and 9 jobs joined via that client's `client_id` — confirms client-name → jobs resolution via the two-phase ID lookup ✅ |
| Search `gaurav` | Matches technician profile **Gaurav** (`gaurav@gmail.com`, specialty "lazy") via `profiles.full_name` → `technicians.profile_id` join ✅ |
| Search `camera` (service-type label) | `SERVICE_TYPE_LABELS` reverse-map correctly resolves "Camera Outage" → `camera_outage`; matches 3 jobs (`JOB-0031`, `JOB-0024`, `JOB-0033`) and 3 requests (`REQ-0022`, `REQ-0023`, `REQ-0034`) ✅ |
| Search `winnipeg` (site address fragment) | Matches `REQ-0026` (`site_address = "downtown winnipeg"`) and `JOB-0026` (`address = "downtown winnipeg"`) ✅ |
| Search `JOB-0031` / `job31` (prefixed identifier) | Regex parses to `jobNumber = 31`, `requestNumber = null` — matches only the job, not the request with the same number ✅ |
| Email/phone search | `client_contacts` rows carry real emails/phones (e.g. `d.park@metro.com`, `555-1001`) reachable via the `ilike` lookup queries exactly as coded ✅ |
| Search `zzzznotfoundxx` (gibberish) | Zero matches across `clients`, `jobs`, `service_requests`, and technician `profiles` — confirms the "No matching records found" path is reachable with real data ✅ |

### API-layer verification

- Dev server confirmed running at `http://localhost:3000` (HTTP 200)
- `GET /api/admin/search?q=test` **without** a session → **HTTP 401 "Not authenticated"** — confirms the auth guard rejects unauthenticated requests at the network level ✅

### Build / Lint

- `npm run build` → ✅ Compiled successfully, 38 routes (added `/api/admin/search`), 0 TypeScript errors
- `npm run lint` → ✅ 0 errors, 0 warnings

### Not independently driven in this environment

This environment has no browser-automation tool available (confirmed via `ToolSearch` — no Playwright/devtools/screenshot tool surfaced). The following **UI-only** behaviors were verified by code review and the data-layer checks above feeding the exact same component code paths, but were **not** clicked through in a live browser:

- Visual debounce timing, dropdown rendering/grouping/icons/badges
- Arrow-key/Enter/Escape keyboard navigation and click-outside dismissal
- Mobile responsive layout (`hidden sm:block`)

Recommend a quick manual spot-check of these in-browser as admin/owner/dispatcher before/while reviewing — the underlying data and security paths they depend on are confirmed working end-to-end.

---

## 7. What Was Not Changed

- The search bar's design, placement, and sizing — unchanged (only its internals went from decorative to functional)
- Any unrelated TopBar elements (Quick Add, Notifications, Avatar, mobile menu) — untouched
- Any production data — read-only queries only; zero writes
- RLS policies, auth logic, or any other data function — untouched
- Client portal / technician portal — untouched (this is an admin/owner/dispatcher-only feature, gated identically to the rest of the `(dashboard)` route group)

---

## 8. Recommended Commit Message

```
feat: implement functional global admin search

- Add globalSearch() data function querying jobs, service requests,
  clients, and technicians via independent parallel ilike/eq/in
  filters (never raw .or() string interpolation with user text)
- Add GET /api/admin/search route gated to admin/owner/dispatcher,
  using the authenticated server client so RLS enforces org-scoping
- Replace the decorative TopBar search input with a debounced,
  keyboard-navigable results dropdown grouped by entity, each item
  linking to its detail page (/jobs, /requests, /clients, /technicians)
- Update search placeholder to "Search jobs, requests, clients,
  technicians…" now that technician search is implemented
```

---

**Do not commit until approved.**

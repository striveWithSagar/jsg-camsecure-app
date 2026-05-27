# JSG CamSecure — Supabase Migration Final Report

**Date:** 2026-05-27
**Project ID:** gbvstrhorjjvlxnfmxcz
**Stack:** Next.js 16.2.6 (App Router) · Supabase (Auth + Postgres + RLS) · @supabase/ssr 0.10.3

---

## Status

**Supabase migration is complete and ready for feature development.**

- Zero mock/localStorage references remain in `src/`
- All three portals are fully Supabase-backed
- All auth flows use real Supabase Auth with role enforcement
- All critical write operations hit the live database
- Build: 0 TypeScript errors · Lint: 0 ESLint errors

---

## Completed Phases

| Phase | Description |
|---|---|
| 3A | Demo seed migration — 13 tables, 75+ rows |
| 4A–4H | Admin read paths — requests, jobs, clients, technicians, invoices, dashboard metrics |
| 8A | Admin authentication (Supabase Auth sign-in, sign-out, session middleware) |
| 8C | Technician auth + portal — dashboard, jobs list, job detail, status widget |
| 8D | Client auth + portal — dashboard, jobs list, invoices list, new request form |
| 8E | Admin session guards, sign-out, token refresh |
| 9A | Full pre-final migration audit |
| 9B | Admin request-to-job conversion via RPC (`convert_request_to_job`) |
| 9B-C | Live conversion flow verification |
| 9B-D | Mock store system complete removal (providers.tsx, mock-store.tsx, mock-session.ts, all MOCK_* arrays) |
| 9B-E | Duplicate conversion hardening (FOR UPDATE lock + unique partial index on `jobs.request_id`) |
| 9C-A | Settings page audit and implementation plan |
| 9C-B | Settings RLS migration — UPDATE policies broadened to `owner \| admin` |
| 9C-C | Settings page wired to Supabase (org, profile, password) |
| 9C-D | Settings persistence end-to-end verification |
| 9D-A | Admin role enforcement — layout guard + login-time role check with signOut |
| 9E | Final migration completion audit |
| 9F | Production-readiness checkpoint (this document) |

---

## Live Routes by Portal

### Admin Portal (`/`) — requires `admin`, `owner`, or `dispatcher` role

| Route | Description |
|---|---|
| `/dashboard` | Metrics, recent jobs, pending requests |
| `/jobs` | Full job board with status/priority filters |
| `/jobs/[id]` | Job detail — assignment, status, notes, history |
| `/requests` | Service request list |
| `/requests/new` | Create service request |
| `/requests/[id]` | Request detail — status, notes |
| `/requests/[id]/convert` | Convert request to job (RPC) |
| `/clients` | Client list |
| `/clients/[id]` | Client detail — jobs, invoices |
| `/technicians` | Technician roster |
| `/invoices` | Invoice list |
| `/settings` | Org settings, account, notifications (stub), integrations |

### Technician Portal (`/technician`) — requires `technician` role

| Route | Description |
|---|---|
| `/technician` | Dashboard — today's jobs, next job card |
| `/technician/jobs` | Full job list |
| `/technician/jobs/[id]` | Job detail — status widget with state transitions |

### Client Portal (`/client`) — requires `client` role + linked `client_contacts` row

| Route | Description |
|---|---|
| `/client` | Overview — open requests, active jobs, unpaid invoices |
| `/client/jobs` | Job list with status tracking |
| `/client/invoices` | Invoice list with totals |
| `/client/requests/new` | Submit new service request |

### Auth Routes (unauthenticated)

| Route | Description |
|---|---|
| `/login` | Role selector |
| `/login/admin` | Admin sign-in — role check post-auth |
| `/login/technician` | Technician sign-in — role check post-auth |
| `/login/client` | Client sign-in — role check post-auth |

---

## Auth Users Required for Demo

All three users must exist in `auth.users` and have corresponding `profiles` rows.

| Email | Role | Portal |
|---|---|---|
| `admin@jsg.com` | `admin` | Admin dashboard |
| `a.rivera@camsecure.com` | `technician` | Technician portal |
| `d.park@metro.com` | `client` | Client portal |

`d.park@metro.com` additionally requires a `client_contacts` row with `profile_id = auth.users.id` linking to the Metro Security client.

---

## Auth & RLS Architecture Summary

### Three-Layer Auth Guard (each portal)
1. **Login page** — `signInWithPassword` → fetch `profiles.role` → `signOut()` if role mismatch
2. **Layout (Server Component)** — `getCurrentProfile()` / `getCurrentClientProfile()` → `redirect()` if role invalid
3. **RLS policies** — every table restricts rows by `auth_org_id()` and/or `auth_role()`

### Key Helper Functions (SECURITY DEFINER)
- `auth_org_id()` — returns `organization_id` for the authenticated user's profile
- `auth_role()` — returns `role` enum from profiles for the authenticated user

### Convert RPC Guard
`convert_request_to_job()` uses `SELECT ... FOR UPDATE` + status check + unique partial index on `jobs(request_id) WHERE request_id IS NOT NULL` to prevent duplicate conversions.

---

## Remaining Out-of-Scope Features

These are intentional stubs, not migration debt. None fake-save or mislead the user.

| Feature | Current State | Required to Ship |
|---|---|---|
| Photo uploads | Disabled UI stub | Supabase Storage bucket + RLS policies |
| Technician field notes | Disabled textarea, "coming soon" | `job_notes` INSERT RLS for technician role |
| Stripe payments | "Coming soon" badge | Stripe integration + webhook handler |
| Resend / email notifications | "Not connected" in settings | Resend API key + edge function or server action |
| Client job detail page | "Detailed view coming soon" text | New route `/client/jobs/[id]` |
| Client request history | Not shown in portal | New route `/client/requests` |
| Human-readable job/request numbers | UUIDs used throughout | DB sequence + `job_number` / `request_number` columns |

---

## Known Schema Gaps

These columns are referenced in UI designs or future requirements but do not yet exist in the database.

| Table | Missing Column | Purpose |
|---|---|---|
| `service_requests` | `address` / `site_address` | Site address from client request form (currently captured in `description`) |
| `service_requests` | `preferred_at` | Preferred appointment datetime from client request form |
| `jobs` | `job_number` | Human-readable sequence number (e.g. `JOB-042`) |
| `service_requests` | `request_number` | Human-readable sequence number (e.g. `REQ-018`) |

None of these gaps block current functionality — the app works correctly without them.

---

## Recommendation for Next Development Phase

The application is production-ready for a closed beta with real admin, technician, and client users. The highest-value items to implement next, in priority order:

1. **Human-readable job/request numbers** — low effort, high UX impact; requires a DB sequence and one migration
2. **Technician field notes** — the UI stub is already built; just needs the RLS INSERT policy for `technician` role on `job_notes`
3. **Client job detail page** — route shell and data fetch already have a pattern to follow; client can then track job status
4. **Email notifications (Resend)** — unlocks the most-requested feature for clients; fire on job assignment and completion
5. **Photo uploads** — requires Supabase Storage bucket setup; UI already shows the placeholder
6. **Client request history page** — straightforward read route following the existing client portal pattern
7. **Stripe payments** — longer integration; defer until core ops flow is validated with real users

---

## Build & Lint (Final)

```
npm run build   →  ✓ Compiled successfully · 0 TypeScript errors · 25 routes
npm run lint    →  ✓ 0 ESLint errors
```

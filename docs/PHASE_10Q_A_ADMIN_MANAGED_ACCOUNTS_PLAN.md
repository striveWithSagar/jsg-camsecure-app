# Phase 10Q-A: Admin-Managed Client and Technician Accounts — Plan

**Date:** 2026-05-30  
**Type:** Plan only — no code changes  
**Base commit:** 6c9f727

---

## 1. Current State Audit

### 1a. Auth and profile creation — critical gaps

**No `auth.users` trigger for profile creation.** All existing profiles in the system were inserted directly via the seed migration (service_role). When a new Supabase auth user is created, no profile row is automatically created. This must be handled explicitly in the admin route handler.

**No `profiles INSERT` policy.** The existing `profiles` RLS has SELECT, UPDATE, and DELETE — but NO INSERT. Inserting a new profile row requires service_role (bypasses RLS). This is the correct pattern for admin-managed creation.

**`supabase/server.ts` uses the publishable anon key (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`).** This is correct and safe. There is currently NO `service-role` server client helper — it needs to be created in `src/lib/supabase/service-role.ts`, using `SUPABASE_SERVICE_ROLE_KEY` from server-only env vars.

### 1b. Existing schema — relevant columns

| Table | Relevant columns | Notes |
|---|---|---|
| `profiles` | `id`, `organization_id`, `role`, `full_name`, `email`, `phone`, `initials`, `avatar_url`, `is_active BOOLEAN DEFAULT true`, `created_at`, `updated_at` | `is_active` already exists — **not yet enforced in login** |
| `clients` | `id`, `organization_id`, `name`, `status` enum(`active`/`inactive`), `address`, `notes`, `created_at`, `updated_at` | Deactivation column exists |
| `client_contacts` | `id`, `organization_id`, `client_id`, `profile_id` (nullable), `full_name`, `email`, `phone`, `is_primary` | `profile_id` links a portal user to a client account |
| `technicians` | `id`, `organization_id`, `profile_id`, `specialty`, `status` enum(`available`/`on_job`/`on_the_way`/`off_duty`), `created_at`, `updated_at` | `status` is OPERATIONAL — not for deactivation. No `is_active` column on `technicians` yet. |

**Deactivation strategy:**
- **Client:** Set `clients.status = 'inactive'` AND `profiles.is_active = false`
- **Technician:** Set `profiles.is_active = false` (technician's operational `status` remains untouched — it reflects actual field state)
- **No `deactivated_at` column exists yet** — will add to `profiles` for audit trail

### 1c. Login pages — `is_active` not enforced

All three login pages (`/login/client`, `/login/technician`, `/login/admin`) check `profiles.role` after successful auth but **do not check `profiles.is_active`**. A deactivated user can currently sign in if they know their password. This must be fixed.

### 1d. Admin pages — current "Add" state

Both `/clients` and `/technicians` pages show **disabled "Add Client/Technician" buttons with "Coming soon" text**. The client detail page (`/clients/[id]`) has a **disabled "Edit Client" button with "Coming soon"**. These are the exact insertion points for Phase 10Q UI.

### 1e. Existing RLS summary

| Table | INSERT | UPDATE | DELETE |
|---|---|---|---|
| `profiles` | ❌ No policy | `self OR admin/owner` | `owner` only |
| `clients` | Admin/owner/dispatcher | Admin/owner/dispatcher | `owner` only |
| `client_contacts` | Admin/owner/dispatcher | Admin/owner/dispatcher | `owner` only |
| `technicians` | Admin/owner | Admin/owner | `owner` only |

**Key gap:** `profiles` has no INSERT policy. Any profile row creation requires service_role. This is intentional for security (only server-side admin code creates profiles) but must be explicitly documented.

### 1f. ClientProfileProvider

`ClientProfileProvider` reads from `@/lib/data/client-profile` (file does not exist under that name; likely `client-portal.ts`). The provider accepts a pre-loaded `ClientProfileData` object from the server layout. No changes needed here unless new fields are required.

### 1g. No `service-role` server helper exists

`src/lib/supabase/service-role.ts` does not exist. It must be created for server-side admin operations. This file must **never be imported by client components** or have `"use client"` in its import chain.

---

## 2. Recommended Architecture

### Core principle: server-side admin operations only

The `service_role` key grants full Supabase Auth Admin API access. It **must never** reach the browser. The architectural pattern is:

```
Admin browser clicks "Add Client"
         ↓
Client component calls fetch('/api/admin/accounts', { method: 'POST', body: ... })
         ↓
Next.js Route Handler (server-side)
  1. Reads session from cookie via createClient()
  2. Verifies profile.role IN ('owner', 'admin')
  3. Creates service_role Supabase client from SUPABASE_SERVICE_ROLE_KEY
  4. Calls supabase.auth.admin.createUser({ email, password, email_confirm: true })
  5. Inserts profile row via service_role (bypasses RLS)
  6. Inserts client/technician row via service_role
  7. Links client_contacts.profile_id
  8. Returns { success: true, userId }
         ↓
Client component shows success, reloads data
```

### Route handler: `src/app/api/admin/accounts/route.ts`

Single endpoint, `action` field determines operation:

| `action` | Operations | Auth required |
|---|---|---|
| `create_client` | auth.admin.createUser + profiles + clients + client_contacts | admin/owner |
| `create_technician` | auth.admin.createUser + profiles + technicians | admin/owner |
| `reset_password` | auth.admin.updateUserById (password) | admin/owner |
| `deactivate_client` | clients.status=inactive + profiles.is_active=false + deactivated_at | admin/owner |
| `reactivate_client` | clients.status=active + profiles.is_active=true + deactivated_at=null | admin/owner |
| `deactivate_technician` | profiles.is_active=false + deactivated_at | admin/owner |
| `reactivate_technician` | profiles.is_active=true + deactivated_at=null | admin/owner |

### Service role helper: `src/lib/supabase/service-role.ts`

```typescript
import { createClient } from "@supabase/supabase-js";

// Server-only — never import in client components
export function createServiceRoleClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // server-only, not NEXT_PUBLIC_
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
```

`SUPABASE_SERVICE_ROLE_KEY` is already in `.env.local` (Supabase projects always have it). It is NOT prefixed `NEXT_PUBLIC_` so it never reaches the browser.

---

## 3. Migration Required

### Migration: `supabase/migrations/20260530000003_admin_managed_accounts.sql`

```sql
-- 1. Add deactivated_at to profiles for audit trail
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ NULL;

-- 2. profiles INSERT policy: admin/owner can create profiles for their org
--    (Required for server-side route handler to insert profiles as authenticated admin
--     when not using service_role bypass — belt-and-suspenders safety)
CREATE POLICY profiles_insert_admin ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = auth_org_id()
    AND auth_role() IN ('owner'::user_role, 'admin'::user_role)
  );

-- 3. technicians: add is_active for deactivation (separate from operational status)
ALTER TABLE technicians
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Note: client deactivation uses clients.status='inactive' (already exists)
-- Note: profile deactivation uses profiles.is_active=false (already exists)
```

**Why profiles INSERT policy?** Although the route handler uses service_role (bypassing RLS), adding this policy is defense-in-depth. If the admin authenticated client is ever used as a fallback, it can still insert profiles within org scope.

---

## 4. Exact Tables and Columns Affected

### Add Client creates:

1. `auth.users` — via `supabase.auth.admin.createUser({ email, password, email_confirm: true })`
2. `profiles` — `{ id: authUser.id, organization_id, role: 'client', full_name: contactName, email, phone, initials, is_active: true }`
3. `clients` — `{ organization_id, name: companyName, status: 'active', address, notes }`
4. `client_contacts` — `{ organization_id, client_id: newClient.id, profile_id: authUser.id, full_name: contactName, email, phone, is_primary: true }`

### Add Technician creates:

1. `auth.users` — via `supabase.auth.admin.createUser({ email, password, email_confirm: true })`
2. `profiles` — `{ id: authUser.id, organization_id, role: 'technician', full_name: name, email, phone, initials, is_active: true }`
3. `technicians` — `{ organization_id, profile_id: authUser.id, specialty, status: 'available', is_active: true }`

### Deactivate Client:

1. `clients` — `status = 'inactive'`
2. `profiles` — `is_active = false`, `deactivated_at = now()`
3. `auth.users` — optionally disable via `auth.admin.updateUserById(uid, { ban_duration: '876600h' })` (100 years = effectively permanent ban)

### Deactivate Technician:

1. `profiles` — `is_active = false`, `deactivated_at = now()`
2. `technicians` — `is_active = false`
3. `auth.users` — optionally ban as above

### Password Reset:

1. `auth.users` — via `supabase.auth.admin.updateUserById(uid, { password: newPassword })`
2. No changes to any public tables — passwords are never stored in public schema

---

## 5. UI Pages and Components

### New components

| Component | Location | Description |
|---|---|---|
| `AddClientDialog.tsx` | `src/components/clients/` | Modal form: company name, contact name, email, password, phone, address, notes |
| `AddTechnicianDialog.tsx` | `src/components/technicians/` | Modal form: full name, email, password, phone, specialty |
| `ResetPasswordForm.tsx` | `src/components/admin/` | Password input + confirm, calls reset_password action |
| `DeactivateReactivateButton.tsx` | `src/components/admin/` | Toggle button with confirmation dialog |

### Modified pages

| Page | Change |
|---|---|
| `/clients/page.tsx` | Replace disabled "Add Client" button with `<AddClientDialog />` trigger |
| `/clients/[id]/page.tsx` | Add `<DeactivateReactivateButton />` + `<ResetPasswordForm />` |
| `/technicians/page.tsx` | Replace disabled "Add Technician" button with `<AddTechnicianDialog />` trigger |
| `/technicians/[id]/page.tsx` | **CREATE THIS PAGE** — detail page for technician (similar to `/clients/[id]`) + deactivate/reset controls |
| `/login/client/page.tsx` | Check `is_active` after login, add "Forgot password?" link |
| `/login/technician/page.tsx` | Check `is_active` after login, add "Forgot password?" link |

### New pages

| Page | Description |
|---|---|
| `src/app/(dashboard)/technicians/[id]/page.tsx` | Technician detail: profile info, job history, deactivate, reset password |

---

## 6. Deactivate Technician with Active Jobs — Recommendation

**Allow deactivation with warning (not blocking).**

**Rationale:** Blocking deactivation until all jobs are reassigned is dangerous when a technician leaves suddenly. The admin knows the operational context better than the system can. The correct pattern is:

1. Admin clicks "Deactivate"
2. System checks: `SELECT COUNT(*) FROM jobs WHERE technician_id = $id AND status NOT IN ('completed','cancelled')`
3. If count > 0: show **warning modal** — "This technician has N active/in-progress jobs. Deactivating will not remove them from jobs. You should reassign them before or after deactivating. Proceed?"
4. Admin can choose to proceed or cancel and reassign first
5. After deactivation, the jobs page continues to show assigned jobs — the technician name displays (historical), but the technician can no longer log in

This is the business-safe option: job data integrity is preserved, admin is informed, admin retains control.

---

## 7. Forgot Password Flow

### Design: admin-mediated reset (no direct email to user)

```
Client/Technician clicks "Forgot password?" on login page
         ↓
Enters their email address
         ↓
POST /api/admin/forgot-password (public route, no auth required)
  1. Look up profile by email in profiles table
  2. If found AND role matches portal type: insert notification for admin
     event_type: 'password_reset_requested'
     title: 'Password reset requested'
     body: 'User email@example.com (client) has requested a password reset.'
     entity_type: 'profile', entity_id: profile.id
  3. Always return generic message (anti-enumeration)
         ↓
Generic message shown: "If this account exists, an admin will be notified to reset your password."
         ↓
Admin sees notification in bell → navigates to client/technician detail → resets password
```

**Anti-enumeration:** The endpoint ALWAYS returns the same generic message whether or not the email exists. This prevents attackers from discovering which emails are registered.

**No Supabase password reset email ever sent** — the standard `supabase.auth.resetPasswordForEmail()` is NOT called. Only the notification to admin is created.

---

## 8. RLS Impact Analysis

### Existing policies — no changes needed for:
- `clients` INSERT/UPDATE: already allows admin ✅
- `client_contacts` INSERT/UPDATE: already allows admin ✅
- `technicians` INSERT/UPDATE: already allows admin ✅
- `jobs`, `service_requests`, `invoices`: no changes ✅

### Changes required:
1. **`profiles INSERT` policy** — add for admin/owner (see Section 3)
2. **Login `is_active` check** — code change in login pages, not RLS

### RLS changes NOT needed (handled by service_role in route handler):
- `auth.users` management — always service_role, not subject to RLS
- `profiles` INSERT via route handler — route handler uses service_role client

### Deactivated user portal access:

Deactivated clients/technicians lose portal access at the **login check level** (code), not RLS. The RLS policies intentionally remain open for historical data:
- A deactivated client's `service_requests` and `jobs` remain linked and visible to admin ✅
- A deactivated technician's `job_notes`, `job_photos`, `job_status_history` remain intact ✅
- If the deactivated user somehow retains a valid session token, they would still be able to query data (rare edge case). For maximum security, ban the user in `auth.users` via `ban_duration` (see Section 4).

---

## 9. Security Risks and Mitigations

| Risk | Mitigation |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` exposed to client | File in `src/lib/supabase/service-role.ts` — no `"use client"` imports. Key is `SUPABASE_SERVICE_ROLE_KEY` (no `NEXT_PUBLIC_` prefix). |
| Unauthorized user calls admin route handler | Handler verifies session + `profile.role IN ('owner','admin')` before using service_role client. Returns 401/403 on failure. |
| Account enumeration via forgot password | Endpoint always returns same generic response regardless of whether email exists. |
| Admin creates account in wrong organization | Route handler reads `organization_id` from the authenticated admin's profile, not from the request body. |
| Deactivated user retains active session | After deactivation, the route handler calls `auth.admin.updateUserById(uid, { ban_duration: '876600h' })` to invalidate existing tokens. |
| Race condition: two admins create same email | Supabase Auth enforces unique email constraint. The route handler catches the error and returns a clear message. |
| Weak passwords set by admin | Server-side password validation: minimum 8 characters, at least 1 number or symbol. Applied before calling auth.admin.createUser. |
| Password visible in transit | HTTPS only — standard. Passwords are never stored in DB or logged. |
| Dispatcher can create accounts | Restricted to `admin/owner` only. Dispatchers can view but not create accounts. |

---

## 10. Step-by-Step Implementation Phases

### Phase 10Q-B: Foundation (server infrastructure + migration)

1. Create migration `20260530000003_admin_managed_accounts.sql`
   - `profiles.deactivated_at` column
   - `profiles INSERT` policy for admin/owner
   - `technicians.is_active` column
2. Create `src/lib/supabase/service-role.ts`
3. Create `src/app/api/admin/accounts/route.ts` — all account management actions
4. Create `src/app/api/admin/forgot-password/route.ts` — public endpoint for forgot password
5. Update login pages to check `is_active`
6. Run verification: RLS sims, route handler security tests

### Phase 10Q-C: Add Client UI

1. Create `src/lib/data/admin-accounts.ts` — server functions for admin account lookups
2. Create `AddClientDialog.tsx` — form with validation
3. Update `/clients/page.tsx` — wire Add Client button
4. End-to-end test: admin creates client → client logs in immediately

### Phase 10Q-D: Add Technician UI

1. Create `AddTechnicianDialog.tsx`
2. Update `/technicians/page.tsx` — wire Add Technician button
3. Create `/technicians/[id]/page.tsx` — technician detail page
4. End-to-end test: admin creates technician → technician logs in

### Phase 10Q-E: Deactivate / Reactivate + Password Reset UI

1. Create `DeactivateReactivateButton.tsx` — with active-job warning dialog
2. Create `ResetPasswordForm.tsx`
3. Add controls to `/clients/[id]/page.tsx`
4. Add controls to `/technicians/[id]/page.tsx`
5. End-to-end test: deactivate → verify login blocked → reactivate → verify login works

### Phase 10Q-F: Forgot Password Flow

1. Add "Forgot password?" link to client + technician login pages
2. Create forgot password page/modal
3. Wire to `/api/admin/forgot-password`
4. Verify admin receives notification in bell
5. Admin resets from detail page end-to-end test

---

## 11. Verification Checklist (32 checks)

### A. Database migration

| # | Check |
|---|---|
| 1 | `profiles.deactivated_at` column added, default null |
| 2 | `profiles_insert_admin` policy created, admin/owner only |
| 3 | `technicians.is_active` column added, default true |
| 4 | Existing profiles and technicians unaffected by migration |

### B. Route handler security

| # | Check |
|---|---|
| 5 | Unauthenticated request to `/api/admin/accounts` → 401 |
| 6 | Technician-authenticated request → 403 |
| 7 | Client-authenticated request → 403 |
| 8 | Dispatcher-authenticated request → 403 (dispatcher cannot create accounts) |
| 9 | Admin-authenticated request with valid payload → 200 |
| 10 | `organization_id` is read from the admin's profile, not the request body |

### C. Create Client

| # | Check |
|---|---|
| 11 | `auth.users` row created with correct email |
| 12 | `profiles` row created with `role='client'`, `is_active=true`, correct org |
| 13 | `clients` row created with `status='active'` |
| 14 | `client_contacts` row created with `profile_id` linked, `is_primary=true` |
| 15 | New client can log in at `/login/client` immediately |
| 16 | Duplicate email returns clear error (not 500) |

### D. Create Technician

| # | Check |
|---|---|
| 17 | `auth.users` row created |
| 18 | `profiles` row created with `role='technician'`, `is_active=true` |
| 19 | `technicians` row created with `profile_id` linked, `is_active=true` |
| 20 | New technician can log in at `/login/technician` immediately |

### E. Deactivate and reactivate

| # | Check |
|---|---|
| 21 | Deactivate client: `clients.status='inactive'`, `profiles.is_active=false`, `deactivated_at` set |
| 22 | Deactivated client login attempt → blocked with clear message |
| 23 | Deactivate technician with active jobs → warning shown to admin |
| 24 | Deactivate technician: `profiles.is_active=false`, `technicians.is_active=false` |
| 25 | Deactivated technician login attempt → blocked |
| 26 | Reactivate client → `clients.status='active'`, `profiles.is_active=true`, `deactivated_at=null` |
| 27 | Reactivated client can log in again |
| 28 | Historical jobs/requests/photos for deactivated accounts remain intact and admin-visible |

### F. Password reset

| # | Check |
|---|---|
| 29 | Admin resets password → client/technician can log in with new password |
| 30 | Password is NOT stored in any public table |
| 31 | Old password no longer works after reset |

### G. Forgot password

| # | Check |
|---|---|
| 32 | Forgot password for known email → admin notification created in `notifications` table |
| 33 | Forgot password for unknown email → same generic message (no enumeration) |
| 34 | No Supabase password reset email sent to user |

### H. Build + lint

| # | Check |
|---|---|
| 35 | `npm run build` → 0 TypeScript errors |
| 36 | `npm run lint` → 0 errors, 0 warnings |

---

## 12. Open Questions

1. **Dispatcher can create accounts?** Current plan restricts creation to `admin/owner` only (more secure). If dispatchers should also be able to add technicians, the route handler guard needs updating. Decision needed before Phase 10Q-B.

2. **Email confirmation for admin-created accounts?** When admin calls `auth.admin.createUser({ email_confirm: true })`, the user's email is confirmed immediately (no confirmation email). This is the correct behavior — the admin is vouch-confirming the email. Verify this is the intended design.

3. **Should deactivation ban the auth user?** The plan recommends `ban_duration: '876600h'` (100 years) on `auth.users` to invalidate sessions. This is more secure but harder to reverse. Alternative: rely on `is_active` login check only (existing sessions still valid until expiry ~1 hour). Recommend the ban for production.

4. **Password strength requirements?** Minimum 8 characters is recommended. Should the system also require uppercase/number/symbol? This is a UX decision.

5. **`/technicians/[id]` page scope?** Currently no technician detail page exists. Phase 10Q-D will create it. What should it show beyond name/contact/active jobs? Same pattern as `/clients/[id]`?

6. **Notification event type for forgot password?** The `notifications` table uses text event_type. The new event `password_reset_requested` should be documented in the event type catalog. Should this trigger an email to admin in Phase 10P? (Likely yes — admin needs to know urgently.)

7. **Dispatcher "forgot password" behavior?** Admin portal has "Forgot password? (Coming soon)" hardcoded. For admin/dispatcher accounts, the password should be reset by the owner directly (same route handler, or Supabase Dashboard). This is out of scope for Phase 10Q but should be documented.

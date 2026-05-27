# Supabase Phase 8A-B — Admin Auth Bridge Report

> Status: COMPLETE
> Date: 2026-05-24
> Project: JSG_CamSercure (ref: gbvstrhorjjvlxnfmxcz)

---

## A. Admin Auth Bridge Result

**The bridge is live and verified end-to-end.**

The seeded admin profile (previously using placeholder UUID
`a0000000-0000-0000-0000-000000000010`) has been updated to match the real
`auth.users.id` for `admin@jsg.com`. All four RLS helper functions resolve
correctly under an authenticated session. A simulated authenticated read of
`service_requests` returns all 5 rows.

---

## B. Profile / Auth UUID Verification

### SQL bridge transaction (run as a safe transaction with pre/post checks)

| Check | Result |
|---|---|
| Pre-flight: placeholder profile existed | ✓ 1 row found |
| Pre-flight: no `job_status_history` rows referenced placeholder UUID | ✓ 0 child rows |
| `UPDATE profiles SET id = '<real-uuid>' WHERE email = 'admin@jsg.com'` | ✓ 1 row updated |
| Post-update: profile has correct `id`, `email`, `role`, `organization_id` | ✓ verified |
| Placeholder UUID `a0000000-0000-0000-0000-000000000010` is gone | ✓ 0 rows remaining |

### Profile row after bridge

| Column | Value |
|---|---|
| `id` | `d483bbff-b30b-42b8-888f-abf91f3adf0f` (real auth.users.id) |
| `email` | `admin@jsg.com` |
| `role` | `admin` |
| `organization_id` | `a0000000-0000-0000-0000-000000000001` |
| `full_name` | `JSG Admin` |
| `is_active` | `true` |

### RLS helper function verification (simulated authenticated session)

Tested by setting `role = authenticated` and `request.jwt.claims.sub` to the
real admin UUID in the SQL context:

| Function | Expected | Actual | Pass |
|---|---|---|---|
| `auth.uid()` | `d483bbff-b30b-42b8-888f-abf91f3adf0f` | `d483bbff-b30b-42b8-888f-abf91f3adf0f` | ✓ |
| `auth_org_id()` | `a0000000-0000-0000-0000-000000000001` | `a0000000-0000-0000-0000-000000000001` | ✓ |
| `auth_role()` | `admin` | `admin` | ✓ |
| `org_matches` | `true` | `true` | ✓ |
| `role_is_admin` | `true` | `true` | ✓ |

### RLS read check

| Query | Before bridge | After bridge |
|---|---|---|
| `SELECT COUNT(*) FROM service_requests` (authenticated) | 0 rows (no auth) | **5 rows** ✓ |

---

## C. Middleware / Proxy Status

**Created: `src/proxy.ts`**

Next.js 16 renamed Middleware to Proxy (`proxy.ts`, exported as `proxy`). The
file is confirmed active — the build output shows `ƒ Proxy (Middleware)` in the
route listing.

### What the proxy does

1. **Session refresh** — creates a `@supabase/ssr` server client on every
   request and calls `supabase.auth.getUser()`, which validates the JWT against
   Supabase Auth and refreshes expiring session tokens into the response cookies.

2. **Admin route guard** — if the request path starts with `/dashboard`,
   `/requests`, `/jobs`, `/clients`, `/technicians`, `/invoices`, or `/settings`,
   and no valid user session is found, the request is redirected to
   `/login/admin`.

3. Uses `getUser()` not `getSession()` — `getUser()` validates the JWT server-side.
   `getSession()` trusts the cookie without verification and must not be used for
   access control.

### What the proxy does NOT guard (yet)

- `/technician/*` — no technician auth implemented
- `/client/*` — no client auth implemented
- `/login/*` — not guarded (intentional — login must be accessible without auth)

---

## D. Admin Login Status

**Updated: `src/app/(auth)/login/admin/page.tsx`**

### Changes made

| Before | After |
|---|---|
| `handleSubmit` did `router.push("/dashboard")` unconditionally | Calls `supabase.auth.signInWithPassword({ email, password })` |
| "Demo mode — any email and password will sign you in." banner | Removed |
| "Quick access (demo)" link bypassing auth directly to `/dashboard` | Removed |
| `MOCK_ADMIN` import from `mock-session.ts` | Removed |
| `buttonVariants` and `cn` imports (only used in removed section) | Removed |
| Email/password inputs had no `name` attribute | Added `name="email"` and `name="password"` |
| No error display | Inline error message shown on auth failure |
| No loading state | Button shows "Signing in…" and is disabled during request |

### Login flow

1. User enters email and password and submits
2. `supabase.auth.signInWithPassword()` is called with the browser Supabase client
3. On success: `router.push("/dashboard")`
4. On failure: error message displayed inline below the password field

### Dashboard layout route guard

**Updated: `src/app/(dashboard)/layout.tsx`**

The layout is now an `async` Server Component that calls `supabase.auth.getUser()`
before rendering. If no user is found, it calls `redirect("/login/admin")`. This
is the secure server-side layer (proxy is optimistic/fast; layout is the
authoritative check).

---

## E. Logout Status

**Updated: `src/components/layout/Sidebar.tsx`**

The logout button's `onClick` previously called `router.push("/")` directly.
It now calls `handleSignOut()` which:

1. Calls `supabase.auth.signOut()` via the browser Supabase client
2. Calls `router.push("/")` after sign-out

The Sidebar UI (name, email, avatar) remains hardcoded as `"JSG Admin"` /
`"admin@jsg.com"` — replacing these with live session values is deferred to a
later phase to avoid scope creep.

---

## F. Files Changed

| File | Type | Change |
|---|---|---|
| `src/proxy.ts` | New | Session refresh + admin route guard |
| `src/app/(auth)/login/admin/page.tsx` | Modified | Wired `signInWithPassword`, removed mock bypass, added error/loading state |
| `src/app/(dashboard)/layout.tsx` | Modified | Added `getUser()` server-side route guard |
| `src/components/layout/Sidebar.tsx` | Modified | Wired logout to `supabase.auth.signOut()` |

### SQL changes

| Operation | Detail |
|---|---|
| `UPDATE profiles SET id = 'd483bbff-b30b-42b8-888f-abf91f3adf0f' WHERE email = 'admin@jsg.com'` | Run inside a transaction with pre/post verification. 1 row updated. No schema changes. No new migrations created. |

No mock-store was touched. No RLS policies were added or modified. No other
tables were changed. No `auth.users` rows were created by this phase.

---

## G. Build Result

**✓ Clean — 0 TypeScript errors.**

Notable route table changes from the build:

| Route | Before | After | Reason |
|---|---|---|---|
| `/dashboard`, `/requests`, `/jobs`, etc. | `○ Static` | `ƒ Dynamic` | Layout now calls `await supabase.auth.getUser()` — cannot be statically prerendered |
| `/login/admin` | `○ Static` | `○ Static` | Unchanged — login page has no server-side auth check |
| Proxy entry | (absent) | `ƒ Proxy (Middleware)` | `src/proxy.ts` registered and active |

---

## H. Lint Result

**✓ Clean — 0 ESLint errors or warnings.**

---

## I. Remaining Limitations

| Limitation | When resolved |
|---|---|
| Sidebar shows hardcoded "JSG Admin" / "admin@jsg.com" — not pulled from session | Phase 8E (post all-portal auth) |
| Technician and client logins still use the mock bypass pattern | Phase 8C (technician) and Phase 8D (client) |
| `/technician/*` and `/client/*` routes have no auth guard | Phase 8C and 8D |
| `mock-store.tsx` still provides all data — no page reads from Supabase yet | Phase 4A-B onwards (starting with `/requests`) |
| `mock-session.ts` still used by technician/client login pages | Removed in Phase 8C/8D when those logins are wired |
| `src/lib/supabase/test-connection.ts` is still present | Can be removed at any time — it was a diagnostic file |

---

## Recommended Next Steps

**Two parallel tracks are now unblocked:**

**Track 1 — Data (requires admin auth ✓):**
→ **Phase 4A-B**: Replace `/requests` page's `useMockStore().requests` read with
  `getServiceRequests()` from `src/lib/data/service-requests.ts`. Admin is now
  authenticated and RLS returns 5 rows. This is the smallest safe data migration.

**Track 2 — Auth continuation:**
→ **Phase 8C**: Create technician auth user for `a.rivera@camsecure.com`, update
  `profiles.id` + `technicians.profile_id` in a transaction, wire
  `/login/technician`, add guard to `(technician)/layout.tsx`.

The recommended sequence is Phase 4A-B first (it exercises the live auth path
with a real read and validates the full stack), then Phase 8C.

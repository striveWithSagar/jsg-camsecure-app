# Supabase Auth & RLS Integration Plan

> Status: PLAN — no implementation until explicitly approved per phase
> Date: 2026-05-24
> Project: JSG_CamSercure (ref: gbvstrhorjjvlxnfmxcz)
> Supersedes: earlier draft (2026-05-23)

---

## A. Current Auth/RLS Bridge — How It Works

### The identity chain

Every RLS policy in the schema resolves a user through one chain:

```
Request arrives with JWT
        │
        ▼
auth.uid()  (Supabase extracts this from the JWT sub claim)
        │
        ▼
profiles.id = auth.uid()   ← THE required invariant
        │
        ├── organization_id → which org row the user belongs to
        ├── role            → what they are allowed to do
        │
        ├── IF technician → technicians.profile_id = auth.uid()
        └── IF client     → client_contacts.profile_id = auth.uid()
```

The four SECURITY DEFINER helper functions are the only bridge between a JWT
and data. All 43 policies call one or more of them:

```sql
-- Resolves which org the caller belongs to
auth_org_id()
→  SELECT organization_id FROM profiles WHERE id = auth.uid()

-- Resolves the caller's role (owner / admin / dispatcher / technician / client)
auth_role()
→  SELECT role FROM profiles WHERE id = auth.uid()

-- Resolves which technicians row belongs to the caller
auth_technician_id()
→  SELECT id FROM technicians WHERE profile_id = auth.uid()

-- Resolves which client the caller is a contact for
auth_client_id()
→  SELECT client_id FROM client_contacts WHERE profile_id = auth.uid() LIMIT 1
```

All four return NULL gracefully when called unauthenticated. With RLS enabled,
NULL means every USING clause evaluates to false → 0 rows returned.

### Does profiles.id need to equal auth.uid()?

**Yes — absolutely. This is the only identity bridge.**

There is no separate `auth_user_id` or `user_id` column. The schema comment
makes this explicit:

```sql
create table profiles (
  id  uuid  primary key,   -- equals auth.users.id (convention enforced by Phase 8 trigger)
  ...
```

There is no FK constraint from `profiles.id` to `auth.users.id` — this is
intentional so Phase 3 seed data with placeholder UUIDs does not violate DB
integrity. But the functional requirement is absolute: if `profiles.id ≠ auth.uid()`,
then `auth_org_id()` returns NULL and every table returns 0 rows.

### How admin, technician, and client roles are resolved

| Role | How auth_role() resolves | Extra lookup required |
|---|---|---|
| `owner` / `admin` / `dispatcher` | `profiles.role` lookup only | None — org-wide access via `auth_org_id()` |
| `technician` | `profiles.role` = `'technician'` | `auth_technician_id()` needed for per-job filtering |
| `client` | `profiles.role` = `'client'` | `auth_client_id()` needed — reads `client_contacts.profile_id` |

A client user with no `client_contacts` row pointing to their profile gets 0
rows from everything. The `client_contacts.profile_id = auth.uid()` lookup is
what connects a login identity to a client company.

### Current state (Phase 3 seed — no auth yet)

The 6 seeded profiles use placeholder UUIDs with no matching `auth.users` rows:

| Profile | Email | Placeholder UUID | FK dependencies |
|---|---|---|---|
| JSG Admin | admin@jsg.com | `...000000000010` | None |
| Alex Rivera | a.rivera@camsecure.com | `...000000000011` | `technicians.profile_id` → `...000000000301` |
| Sam Chen | s.chen@camsecure.com | `...000000000012` | `technicians.profile_id` → `...000000000302` |
| Jordan Kim | j.kim@camsecure.com | `...000000000013` | `technicians.profile_id` → `...000000000303` |
| Taylor Reyes | t.reyes@camsecure.com | `...000000000014` | `technicians.profile_id` → `...000000000304` |
| Morgan Davis | m.davis@camsecure.com | `...000000000015` | `technicians.profile_id` → `...000000000305` |

All `client_contacts.profile_id` values are NULL — no client login exists yet.

---

## B. Recommended Demo-Auth Setup

### Three options compared

**Option A — Create users manually in Supabase Auth dashboard, update profile IDs via SQL**

Steps: Supabase Dashboard → Authentication → Users → Add user → note returned UUID
→ run `UPDATE profiles SET id = '<real-uuid>' WHERE email = '...'` via MCP.

- Pros: No code, no service_role key in the codebase, fully reversible
- Cons: Manual step; not scriptable; UUID update for technician profiles requires
  a transaction (FK to `technicians.profile_id`)
- Best for: Phase 8A-B (admin only — zero FK dependencies)

**Option B — Create users via a server-only script using service_role key**

Steps: write a one-shot Node.js script in `scripts/create-demo-users.ts` using
`@supabase/supabase-js` Admin client (`supabase.auth.admin.createUser()`).
Script captures returned UUIDs and runs profile updates in the same transaction.

- Pros: Reproducible, handles FK ordering, documents the process as code
- Cons: Requires service_role key to be present locally (never committed);
  adds a script to maintain
- Best for: Phase 8C+ (technician and client users with FK chains)

**Option C — Change the schema or profile bridge**

Rejected outright. The current design is correct, production-ready, and already
applied to the live project. Changing `auth_org_id()` or the profile bridge now
invalidates all 43 policies and requires a coordinated migration with no benefit.

### Recommendation

**Use Option A for Phase 8A-B** (one admin user, zero FK risk).
**Use Option B for Phase 8C and 8D** (technician and client users need FK transactions).

---

## C. Required Demo Users

### Phase 8A-B: Admin only (minimum viable auth verification)

| Field | Value |
|---|---|
| Email | `admin@jsg.com` |
| Role | `admin` |
| Current placeholder UUID | `a0000000-0000-0000-0000-000000000010` |
| FK dependencies | **None** |

The admin profile has no `technicians` row, no `client_contacts` row, and the
13 seeded `job_status_history` rows have `changed_by_profile_id = NULL` (not
pointing to the admin UUID). A straight PK update is safe:

```sql
-- Run after creating auth.users row and noting the returned UUID
UPDATE profiles
SET id = '<real-auth-users-uuid>'
WHERE email = 'admin@jsg.com';
-- Expected: UPDATE 1
```

### Phase 8C: Technician (Alex Rivera)

| Field | Value |
|---|---|
| Email | `a.rivera@camsecure.com` |
| Role | `technician` |
| Current placeholder UUID | `a0000000-0000-0000-0000-000000000011` |
| FK dependency | `technicians.profile_id = '...000000000011'` — must update in same transaction |

```sql
BEGIN;
  UPDATE profiles
    SET id = '<alex-real-uuid>'
    WHERE email = 'a.rivera@camsecure.com';
  UPDATE technicians
    SET profile_id = '<alex-real-uuid>'
    WHERE profile_id = 'a0000000-0000-0000-0000-000000000011';
COMMIT;
```

### Phase 8D: Client contact (David Park / Metro Security Ltd)

David Park has no existing `profiles` row — he is a `client_contacts` entry
with `profile_id = NULL`. Phase 8D requires:

1. Create `auth.users` row for `d.park@metro.com`
2. INSERT a new `profiles` row with `role = 'client'`, `id = <real-uuid>`
3. UPDATE `client_contacts SET profile_id = <real-uuid> WHERE id = 'a0000000-0000-0000-0000-000000000201'`

```sql
-- After creating auth.users for d.park@metro.com:
BEGIN;
  INSERT INTO profiles (id, organization_id, role, full_name, email, phone, initials)
  VALUES (
    '<david-real-uuid>',
    'a0000000-0000-0000-0000-000000000001',
    'client', 'David Park', 'd.park@metro.com', '555-1001', 'DP'
  );
  UPDATE client_contacts
    SET profile_id = '<david-real-uuid>'
    WHERE id = 'a0000000-0000-0000-0000-000000000201';
COMMIT;
```

**Do not attempt Phase 8C or 8D until Phase 8A-B is verified end-to-end.**

---

## D. Files Likely Affected

### Phase 8A-B (admin only)

| File | Change |
|---|---|
| `src/middleware.ts` | **NEW** — `@supabase/ssr` session refresh on every request. No route guards yet — guards before sign-in works would lock everyone out. |
| `src/app/(auth)/login/admin/page.tsx` | Replace `router.push("/dashboard")` bypass with `supabase.auth.signInWithPassword()` + inline error display |

### Phase 8C (technician login)

| File | Change |
|---|---|
| `src/app/(auth)/login/technician/page.tsx` | Wire `signInWithPassword()` + redirect to `/technician` |
| `src/app/(technician)/layout.tsx` | Add session check; redirect to `/login/technician` if no session or role ≠ `technician` |

### Phase 8D (client login)

| File | Change |
|---|---|
| `src/app/(auth)/login/client/page.tsx` | Wire `signInWithPassword()` + redirect to `/client` |
| `src/app/(client)/layout.tsx` | Add session check; redirect to `/login/client` if no session or role ≠ `client` |

### After all Phase 8 users verified (unlocks Phase 4A-B and beyond)

| File | Change | Triggered by |
|---|---|---|
| `src/app/(dashboard)/layout.tsx` | Add admin session guard | Phase 8A-B done |
| `src/app/(dashboard)/requests/page.tsx` | Replace `useMockStore().requests` with `getServiceRequests()` | Phase 4A-B |
| `src/components/layout/Sidebar.tsx` | Replace `MOCK_ADMIN` with session-derived name/initials/role | Phase 8A-B |
| `src/lib/mock-session.ts` | Deprecated — removed when all three portals read real session | Phase 8D complete |
| Various logout locations | Add `supabase.auth.signOut()` + redirect to `/login` | Phase 8A-B |

### Middleware implementation (Phase 8A-B mandatory)

```ts
// src/middleware.ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: must call getUser() not getSession()
  // getSession() reads from cookie only — not safe for server-side auth checks
  // getUser() validates the JWT against Supabase Auth server
  await supabase.auth.getUser();

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

---

## E. Risks

### Risk 1 — service_role key exposure (CRITICAL)

The `service_role` key bypasses every RLS policy on every table. It must NEVER:
- Appear in any `NEXT_PUBLIC_` env var
- Be imported into any client component, hook, or browser-side code
- Be committed to any file (including `.env.local` or `.env.example`)
- Appear in any `src/app/` or `src/components/` file

For Phase 8A-B this key is not needed at all — users are created in the
Supabase dashboard and profiles are updated via MCP. If Option B scripts are
written later, the key lives only in a local `.env.local` under a server-only
name (e.g. `SUPABASE_SERVICE_ROLE_KEY`, no `NEXT_PUBLIC_` prefix) and is
accessed only from `scripts/`, never from the Next.js app.

### Risk 2 — Middleware must precede layout guards

Currently all routes are accessible without auth (demo mode). The login form
can be wired to real auth in Phase 8A-B without breaking anything — users who
know the URL can still bypass the form, same as today.

However, once layout-level session checks are added (Phase 8C+), middleware
MUST already be in place. Without middleware, the `@supabase/ssr` server client
cannot refresh an expiring session token, so a valid user who has been idle for
~1 hour will fail the layout check even though they are genuinely logged in.

**Order that must be respected:** middleware → login form → layout guards.

### Risk 3 — PK update on profiles

Updating `profiles.id` is a primary key change. Postgres allows it but:
- `ON UPDATE` behaviour on the schema's FKs is `NO ACTION` (the default, same as
  RESTRICT) — Postgres will reject the UPDATE if any child row references the
  old value via FK, unless all FKs are updated in the same transaction.
- For the admin profile this is safe (no child rows).
- For technician profiles: `technicians.profile_id` must be updated in the same
  transaction.
- Always use `BEGIN; ... COMMIT;` with a mental `ROLLBACK` plan.

### Risk 4 — 43 RLS policies activate simultaneously

The moment a real session exists, all 43 policies fire. Edge cases that are
invisible today (a dispatcher who cannot see something they should; a technician
who sees an extra job) will surface as silent empty-result bugs, not errors.
Each role must be tested end-to-end after Phase 8 before any mock-store removal.

### Risk 5 — getSession() vs getUser() confusion

`supabase.auth.getSession()` reads from the cookie only and does not validate
the JWT signature against the Supabase Auth server. It is safe for client
components (trusted environment) but **not safe for server-side auth checks**
(the cookie could be forged). Layout guards must use `supabase.auth.getUser()`
which does the server-side validation.

The `@supabase/ssr` docs are explicit about this:
> "Always use `getUser()` in Server Components, middleware, and layout files.
> Never trust `getSession()` for security decisions on the server."

### Risk 6 — Mock session still rendered after login is wired

`mock-session.ts` is imported by `src/app/(auth)/login/admin/page.tsx` (the
"Demo mode" quick-access button shows `MOCK_ADMIN.name` and `MOCK_ADMIN.email`).
It is likely also imported by the Sidebar and TopBar. If the login form is wired
to real auth but the Sidebar still reads `MOCK_ADMIN.name`, the display will
show stale mock identity to the authenticated user. Replace these imports in the
same phase as the form change.

---

## F. Exact Next Implementation Command (Phase 8A-B)

```
Proceed with Phase 8A-B only: create one Supabase Auth demo user (admin) and
verify the full auth→RLS→query chain.

Important:
- Create ONLY the admin user (admin@jsg.com). Do not create technician or
  client users yet.
- Do not add layout route guards. Do not redirect unauthenticated users.
- Do not replace the /requests UI or any other page.
- Do not remove or change mock-store.
- Do not use service_role key in browser code or any NEXT_PUBLIC_ env var.
- Do not apply any schema migrations.
- If any SQL error occurs, stop immediately and report it exactly.

Tasks:
1. Create auth.users row for admin@jsg.com via Supabase MCP
   (supabase.auth.admin.createUser or equivalent MCP tool).
   - email_confirm: false (demo — skip email verification)
   - Note the returned auth.users.id UUID.

2. Update the admin profile to use the real UUID:
     UPDATE profiles
     SET id = '<returned-uuid>'
     WHERE email = 'admin@jsg.com';
   Confirm: 1 row updated.

3. Verify the identity bridge via execute_sql (set role to authenticated,
   set JWT sub claim to the real UUID):
     SELECT auth_org_id();   -- must return 'a0000000-0000-0000-0000-000000000001'
     SELECT auth_role();     -- must return 'admin'

4. Create src/middleware.ts (session refresh only — no route guards yet).
   Use the @supabase/ssr middleware pattern exactly as documented.
   Call getUser(), not getSession().

5. Wire src/app/(auth)/login/admin/page.tsx:
   - Replace router.push("/dashboard") bypass with supabase.auth.signInWithPassword()
   - On success: redirect to /dashboard
   - On error: display the error message inline (below the submit button)
   - Keep the existing UI structure — only change the handleSubmit logic
   - Keep the "Demo mode" banner text; update the quick-access button to remove
     the direct href="/dashboard" bypass (or keep it clearly labelled as bypass)

6. Run npm run build. Run npm run lint. Both must pass clean.

7. Create docs/SUPABASE_PHASE_8A_APPLY_REPORT.md documenting:
   - auth.users row created (yes/no)
   - profiles.id updated (confirm 1 row, show old vs new UUID)
   - Bridge verification results (exact values returned)
   - Files changed
   - Build and lint results
   - Recommended next step

8. Stop after step 7. Do not replace /requests page. Do not wire other logins.

Return:
A. auth.users row created (yes/no)
B. profiles.id updated (yes/no, confirm 1 row)
C. Bridge verification — exact values returned from auth_org_id() and auth_role()
D. src/middleware.ts created (yes/no)
E. Login page wired (yes/no, describe what changed)
F. Build result
G. Lint result
H. Recommended next step
```

---

## G. What Must Remain Mock

The following must continue reading from mock-store and constants.ts until
explicitly approved in a named phase. Do not touch any of these during Phase 8:

| Area | Specific files | Reason |
|---|---|---|
| Jobs board | `(dashboard)/jobs/*` | Admin session needed; Phase 4B |
| Job detail | `(dashboard)/jobs/[id]/*` | Same |
| Invoices | `(dashboard)/invoices/*` | Admin session; Phase 4C |
| Clients | `(dashboard)/clients/*` | Admin session; Phase 4D |
| Technicians list | `(dashboard)/technicians/*` | Admin session; Phase 4E |
| Dashboard metrics | `(dashboard)/dashboard/*` | Derived queries; Phase 4F |
| Requests page | `(dashboard)/requests/page.tsx` | Waits for Phase 4A-B (after Phase 8A-B) |
| Client portal | `(client)/client/*` | No client auth until Phase 8D |
| Technician portal | `(technician)/technician/*` | No technician auth until Phase 8C |
| Settings | `(dashboard)/settings/*` | owner-only; Phase 4G |
| Job photos | — | No storage bucket; Phase 9 |
| Job notes | — | No seed data; Phase 4H |
| Stripe / payments | — | Phase 10+ |
| Email notifications | — | Phase 10+ |
| All mock-store writes | `mock-store.tsx` mutations | Each write stays mock until the corresponding Supabase mutation is created and verified per-feature |

**Do not remove or modify `mock-store.tsx` or `constants.ts`** until every
consumer has been migrated and verified individually.

---

## Summary Table

| Question | Answer |
|---|---|
| Does `profiles.id` need to equal `auth.uid()`? | Yes — it is the only identity bridge |
| Is there a separate `auth_user_id` column? | No — `profiles.id` IS the auth user ID |
| How does `auth_org_id()` work? | `SELECT organization_id FROM profiles WHERE id = auth.uid()` |
| How is role resolved? | `SELECT role FROM profiles WHERE id = auth.uid()` |
| How are technicians identified? | `SELECT id FROM technicians WHERE profile_id = auth.uid()` |
| How are clients identified? | Via `client_contacts.profile_id = auth.uid()` → `client_id` |
| Recommended demo-auth setup | Option A (manual dashboard) for Phase 8A-B; Option B (script) for 8C+ |
| Users needed first | 1 — admin@jsg.com only |
| Safest first verification | Sign in as admin → `auth_org_id()` returns org UUID → `service_requests` returns 5 rows |
| Is middleware required? | Yes — must precede all layout guards |
| Biggest risks | service_role key exposure; getSession() vs getUser() confusion; missing middleware |
| Next command | Phase 8A-B as specified in section F above |

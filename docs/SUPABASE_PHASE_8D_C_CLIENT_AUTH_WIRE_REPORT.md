# Supabase Phase 8D-C — Client Auth Wiring Report

> Status: COMPLETE
> Date: 2026-05-26
> Project: JSG_CamSecure (ref: gbvstrhorjjvlxnfmxcz)

---

## What Changed

The client portal login page and layout are now fully backed by Supabase auth.
`MOCK_CLIENT`, the sync layout, and the demo-bypass form are completely removed from
the auth/guard layer. The client portal runs as an async Server Component layout
with a real role guard and `ClientProfileProvider` context available to all children.

---

## Files Changed

| File | Type | Change |
|---|---|---|
| `src/lib/data/client-profile.ts` | Created | `getCurrentClientProfile()` — auth + profiles + client_contacts+clients join; returns `ClientProfileData \| null` |
| `src/components/providers/ClientProfileProvider.tsx` | Created | React context + `useClientProfile()` hook for `ClientProfileData` |
| `src/components/client/ClientHeader.tsx` | Created | Client component — shows company name, contact name, avatar with initials, signout to `/login/client` |
| `src/app/(auth)/login/client/page.tsx` | Modified | Real `signInWithPassword`, role check (`role !== "client"` → signOut + error), loading/error state, demo banner and quick-access link removed |
| `src/app/(client)/layout.tsx` | Modified | Async server component; `getCurrentClientProfile()` → `null` redirects to `/login/client`; wraps children in `ClientProfileProvider` + `ClientHeader` |

### Files NOT changed

| File | Status |
|---|---|
| `src/app/(client)/client/ClientDashboardView.tsx` | Unchanged — Phase 8D-D |
| `src/app/(client)/client/jobs/page.tsx` | Unchanged — Phase 8D-E |
| `src/app/(client)/client/invoices/page.tsx` | Unchanged — Phase 8D-E |
| `src/app/(client)/client/requests/new/page.tsx` | Unchanged — Phase 8D-F |
| `src/components/client/ClientTopNav.tsx` | Unchanged — already a client component, no mock deps |

---

## Architecture

```
(client)/layout.tsx  (Server Component — async)
  └── getCurrentClientProfile()
        └── supabase.auth.getUser()
        └── profiles.select(role) → role !== "client" → return null
        └── client_contacts.select(id, phone, client_id, clients(name, org_id))
              WHERE profile_id = auth.uid()
  └── profile === null → redirect("/login/client")
  └── ClientProfileProvider({ profile })
        ├── ClientHeader           ← useClientProfile() → companyName, name, initials, signout
        └── {children}

/login/client/page.tsx  (Client Component)
  └── signInWithPassword(email, password)
  └── profiles.select(role) → role !== "client" → signOut() + error
  └── router.push("/client")
```

---

## `getCurrentClientProfile()` Design

**Location:** `src/lib/data/client-profile.ts`

**Query sequence:**
```ts
// 1. Auth user
supabase.auth.getUser()

// 2. Profile + role check
supabase.from("profiles")
  .select("full_name, email, role, initials")
  .eq("id", user.id)
  .single()

// 3. Client contact + company (only if role === "client")
supabase.from("client_contacts")
  .select("id, phone, client_id, clients(name, organization_id)")
  .eq("profile_id", user.id)
  .single()
```

No explicit `client_id` filter in app code — RLS on `client_contacts` enforces
`profile_id = auth.uid()`. The `clients` embed is a PostgREST join, not a separate query.

**Returns `null` when:**
- Not authenticated
- Profile row missing or `role !== "client"`
- No `client_contacts` row with `profile_id = auth.uid()`
- `clients` embed is null (broken FK)

In all null cases the layout redirects to `/login/client`.

---

## `ClientProfileData` Type

```ts
type ClientProfileData = {
  name:        string;   // profiles.full_name
  email:       string;   // profiles.email
  initials:    string;   // profiles.initials (or derived)
  role:        string;   // always "client"
  companyName: string;   // clients.name
  clientId:    string;   // client_contacts.client_id
  contactId:   string;   // client_contacts.id
  orgId:       string;   // clients.organization_id (needed for INSERT RLS)
  phone:       string;   // client_contacts.phone
};
```

`orgId` is included because the `service_requests` INSERT RLS policy checks
`organization_id = auth_org_id()`. Browser JS cannot call `auth_org_id()` directly,
so the app must pass it in the INSERT payload (Phase 8D-F).

---

## Verification

### Mock references removed from auth/guard layer

Grep over `(client)/layout.tsx` and `(auth)/login/client/page.tsx`:
- `MOCK_CLIENT` → **0 matches**
- `useMockStore` → **0 matches**
- `mock-session` → **0 matches**

### Role guard behaviour

`(client)/layout.tsx` redirects to `/login/client` for:
- Unauthenticated visitors (`getUser()` returns null)
- Technician users (`role = 'technician'`)
- Admin users (`role = 'admin'`)
- Authenticated clients with no `client_contacts` row

### Login page behaviour

`/login/client`:
- Calls `signInWithPassword` — real Supabase auth, no demo bypass
- On success: checks `profiles.role` — if not `"client"`, calls `signOut()` and shows error
- On auth failure: shows "Invalid email or password." inline (no alert)
- Loading state: button shows "Signing in…" and is disabled

---

## Build Result

**✓ Clean — 0 TypeScript errors, 24 routes (unchanged count).**

---

## Lint Result

**✓ Clean — 0 ESLint errors or warnings.**

---

## Remaining Mock Dependencies (client portal pages)

| File | Dependency | Remaining where? |
|---|---|---|
| `src/app/(client)/client/ClientDashboardView.tsx` | `useMockStore`, `MOCK_CLIENT`, `MOCK_INVOICES` | Phase 8D-D |
| `src/app/(client)/client/jobs/page.tsx` | `useMockStore`, `MOCK_CLIENT` | Phase 8D-E |
| `src/app/(client)/client/invoices/page.tsx` | `MOCK_CLIENT`, `MOCK_INVOICES` | Phase 8D-E |
| `src/app/(client)/client/requests/new/page.tsx` | `useMockStore`, `MOCK_CLIENT` | Phase 8D-F |

---

## Recommended Next Step

**Phase 8D-D — Client overview dashboard data migration.**

Wire `ClientDashboardView` to real Supabase data using `clientId` from `useClientProfile()`.
Create `getClientJobs()` and `getClientInvoices()` server helpers; convert `ClientDashboardView`
to a Server Component.

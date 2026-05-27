# Supabase Phase 8C-C — Technician Auth Wire Report

> Status: COMPLETE
> Date: 2026-05-25
> Project: JSG_CamSecure (ref: gbvstrhorjjvlxnfmxcz)

---

## What Changed

The technician login page and layout are now backed by real Supabase auth.
`MOCK_TECHNICIAN` is removed from both. The portal is protected by a
server-side role guard — only sessions with `profiles.role = 'technician'` can
reach `/technician/*`.

---

## Files Changed

| File | Type | Change |
|---|---|---|
| `src/app/(auth)/login/technician/page.tsx` | Modified | Real `signInWithPassword` + role check + error/loading state; demo banner + quick-access link removed |
| `src/app/(technician)/layout.tsx` | Modified | Converted to async Server Component; `getCurrentProfile()` guard; `ProfileProvider` wrap; `TechHeader` replaces inline header |
| `src/components/technician/TechHeader.tsx` | Created | Client Component — `useProfile()` for name/initials; signout button (LogOut → `/login/technician`) |

### Files NOT changed

| File | Status |
|---|---|
| `src/app/(technician)/technician/TechnicianDashboardView.tsx` | Unchanged — still uses `MOCK_TECHNICIAN`, `useMockStore()` (Phase 8C-D) |
| `src/app/(technician)/technician/jobs/page.tsx` | Unchanged — still uses `MOCK_TECHNICIAN`, `useMockStore()` (Phase 8C-D) |
| `src/app/(technician)/technician/jobs/[id]/page.tsx` | Unchanged — still uses `MOCK_JOBS` (Phase 8C-D) |
| `src/components/technician/TechJobDetail.tsx` | Unchanged — still uses `MOCK_ADMIN` dispatcher contact (Phase 8C-D) |
| `src/components/technician/TechBottomNav.tsx` | Unchanged — no auth dependency |
| `src/lib/mock-session.ts` | Unchanged — `MOCK_TECHNICIAN`, `MOCK_CLIENT` still used by portal pages |

---

## Architecture

```
(technician)/layout.tsx  (Server Component — async)
  └── getCurrentProfile()      ← supabase.auth.getUser() + profiles row
  └── role guard: role !== "technician" → redirect("/login/technician")
  └── ProfileProvider({ profile })
        ├── TechHeader          ← useProfile() → name, initials; signout button
        └── {children}
```

The same `getCurrentProfile()` helper and `ProfileProvider` context used by the
admin layout — no duplication.

---

## Login Page Changes

| Element | Before | After |
|---|---|---|
| `handleSubmit` | `router.push("/technician")` unconditionally | `signInWithPassword` → role check → push |
| Demo banner | "Demo mode — any email and password will sign you in." | Removed |
| Quick-access link | `MOCK_TECHNICIAN.name` link bypassing auth | Removed |
| Error display | None | Inline destructive banner below password field |
| Loading state | None | Button text → "Signing in…", disabled during request |
| Input `name` attrs | Missing | Added (`name="email"`, `name="password"`) so `FormData` resolves correctly |
| `MOCK_TECHNICIAN` import | Present | Removed |

### Role check on login

After `signInWithPassword` succeeds, the page queries `profiles.role` for the
authenticated user. If `role !== "technician"`, it calls `signOut()` immediately
and shows "This account does not have technician access." — no redirect to a
protected page.

---

## Route Guard

`(technician)/layout.tsx` runs server-side on every `/technician/*` request:

```ts
const profile = await getCurrentProfile();
if (!profile || profile.role !== "technician") {
  redirect("/login/technician");
}
```

| Visitor | Outcome |
|---|---|
| Unauthenticated | `getCurrentProfile()` → null → redirect |
| Admin user | `profile.role = 'admin'` → redirect |
| Client user | `profile.role = 'client'` → redirect |
| Technician | Allowed through; `ProfileProvider` receives real profile |

---

## Signout

`TechHeader.handleSignOut()`:
```ts
const supabase = createClient();   // browser client
await supabase.auth.signOut();     // clears session cookie
router.push("/login/technician");
```

Signout button (LogOut icon) appears in the header's top-right area, to the
right of the avatar — same pattern as admin `Sidebar`.

---

## Build Result

**✓ Clean — 0 TypeScript errors, 24 routes.**

Route count increased by 2 from Phase 8E (22 → 24): `/technician/jobs` and
`/technician/jobs/[id]` now appear as dynamic (ƒ) routes — previously static
because the layout was a sync component.

---

## Lint Result

**✓ Clean — 0 ESLint errors or warnings.**

---

## Remaining Mock Dependencies

| Component / Page | Mock dependency | Phase |
|---|---|---|
| `TechnicianDashboardView.tsx` | `MOCK_TECHNICIAN`, `useMockStore()` | Phase 8C-D |
| `(technician)/technician/jobs/page.tsx` | `MOCK_TECHNICIAN`, `useMockStore()` | Phase 8C-D |
| `(technician)/technician/jobs/[id]/page.tsx` | `MOCK_JOBS` | Phase 8C-D |
| `TechJobDetail.tsx` | `MOCK_ADMIN` (dispatcher contact) | Phase 8C-D |
| `(client)/layout.tsx` | `MOCK_CLIENT` | Phase 8D |
| `(client)/` pages | `MOCK_CLIENT`, mock data | Phase 8D |
| `mock-session.ts` | `MOCK_TECHNICIAN`, `MOCK_CLIENT` | Remove after 8C-D + 8D |

---

## Recommended Next Step

**Phase 8C-D — Replace `useMockStore()` / `MOCK_TECHNICIAN` on all technician
portal pages with Supabase-backed server queries.**

Requires:
1. `getTechJobList()` — jobs filtered by `technician_id = auth_technician_id()`
2. `getTechJob(id)` — single job with client name embed
3. Rewrite `TechnicianDashboardView`, jobs list, and `[id]` pages as async Server
   Components (or pass data as props from async page wrappers)
4. Replace `useMockStore().updateJobStatus()` with a Supabase UPDATE call
5. Remove `MOCK_ADMIN` dispatcher contact from `TechJobDetail`

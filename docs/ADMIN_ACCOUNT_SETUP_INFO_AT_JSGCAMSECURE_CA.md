# Admin Account Setup — info@jsgcamsecure.ca

**Date:** 2026-05-30  
**Type:** Database-only change — no code modified  
**Status:** COMPLETE

---

## Verification Results

| Check | Result |
|---|---|
| `info@jsgcamsecure.ca` exists in `auth.users` | ✅ YES — uid `2e8c5dde-16f2-498a-b292-4da05ab16e16` |
| Email confirmed in Supabase Auth | ✅ YES |
| Profile row exists in `profiles` | ✅ YES — created by this setup |
| `profiles.role` | ✅ `admin` |
| `profiles.is_active` | ✅ `true` |
| `profiles.deactivated_at` | ✅ `null` |
| `profiles.organization_id` | ✅ `a0000000-0000-0000-0000-000000000001` (JSG CamSecure) |
| `profiles.full_name` | ✅ `JSG Camsecure Admin` |
| Old dummy admin (`admin@jsg.com`) deleted? | ✅ NO — untouched, still role=admin, is_active=true |

---

## Login Guard Analysis

`/login/admin` page code checks after `signInWithPassword`:

```typescript
if (!["admin", "owner", "dispatcher"].includes(profile?.role ?? "")) {
  signOut(); return error;
}
router.push("/dashboard");
```

`info@jsgcamsecure.ca` has `role = "admin"` → **passes the guard → redirects to `/dashboard`**.

All admin routes (`/dashboard`, `/clients`, `/technicians`, `/jobs`, `/requests`, `/settings`) use RLS policy `profiles_select_own_org` which checks `organization_id = auth_org_id()`. Both the new admin's profile and all app data share org `a0000000-0000-0000-0000-000000000001` → **full portal access granted**.

---

## What Was Done

1. Queried `auth.users` → confirmed `info@jsgcamsecure.ca` exists with id `2e8c5dde-...`
2. Queried `profiles` → confirmed NO profile row existed for this id
3. Inserted profile row:
   ```sql
   INSERT INTO profiles (id, organization_id, role, full_name, email, initials, is_active, deactivated_at)
   VALUES ('2e8c5dde-...', 'a0000000-...', 'admin', 'JSG Camsecure Admin', 'info@jsgcamsecure.ca', 'JA', true, null);
   ```
4. Verified the row was created correctly

---

## What Was NOT Done

- No passwords changed
- No code modified (build/lint confirmed clean at commit `3f94a68`)
- Old admin (`admin@jsg.com`) not deleted or modified
- No app data (jobs, requests, clients, technicians, invoices) touched
- No `.env.local` changes
- No commits made (DB-only change, no code to commit)

---

## Two Active Admin Accounts

| Account | uid | Status |
|---|---|---|
| `admin@jsg.com` (old) | `d483bbff-...` | active, role=admin |
| `info@jsgcamsecure.ca` (new) | `2e8c5dde-...` | active, role=admin |

Both can log in to `/login/admin` and access the full admin portal simultaneously. The old account can be deactivated at any time using the `AccountActionsPanel` added in Phase 10Q-E.

---

## Build + Lint

| Check | Result |
|---|---|
| `npm run build` | ✅ 0 TypeScript errors · 29 routes |
| `npm run lint` | ✅ 0 errors · 0 warnings |

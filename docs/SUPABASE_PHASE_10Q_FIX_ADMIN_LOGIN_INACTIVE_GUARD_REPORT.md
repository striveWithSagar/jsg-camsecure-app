# Phase 10Q-Fix: Admin Login Inactive Guard

**Date:** 2026-05-30  
**Status:** COMPLETE — awaiting commit approval  
**Base commit:** 3f94a68

---

## 1. Problem

`/login/admin` was missing the `is_active` check that already existed on `/login/client` and `/login/technician` (added in Phase 10Q-B). After `admin@jsg.com` was deactivated (`profiles.is_active = false`), that account could still log in to the admin portal because the admin login page only checked `profile.role`, not `profile.is_active`.

---

## 2. Fix

**File changed:** `src/app/(auth)/login/admin/page.tsx`

**Before:**
```typescript
const { data: profile } = await supabase
  .from("profiles")
  .select("role")           // only role
  .eq("id", authData.user.id)
  .single();

if (!["admin", "owner", "dispatcher"].includes(profile?.role ?? "")) {
  // role check only — no is_active check
}
router.push("/dashboard");
```

**After:**
```typescript
const { data: profile } = await supabase
  .from("profiles")
  .select("role, is_active")  // now includes is_active
  .eq("id", authData.user.id)
  .single();

if (!["admin", "owner", "dispatcher"].includes(profile?.role ?? "")) {
  await supabase.auth.signOut();
  setError("This account does not have admin portal access.");
  setLoading(false);
  return;
}

if (!profile?.is_active) {                    // NEW GUARD
  await supabase.auth.signOut();
  setError("This admin account has been deactivated. Please contact the account owner.");
  setLoading(false);
  return;
}

router.push("/dashboard");
```

The fix is identical in structure to the guards added to `/login/client` and `/login/technician` in Phase 10Q-B, keeping all three login pages consistent.

---

## 3. Login Guard Verification

| Account | Role check | `is_active` check | `login_allowed` |
|---|---|---|---|
| `admin@jsg.com` (old, deactivated) | ✅ passes (role=admin) | ❌ fails (is_active=false) | **Blocked** |
| `info@jsgcamsecure.ca` (new, active) | ✅ passes (role=admin) | ✅ passes (is_active=true) | **Allowed** |

Verified by simulating the guard logic against the live DB.

---

## 4. Error Message Shown to Deactivated Admin

> "This admin account has been deactivated. Please contact the account owner."

Displayed in the existing error style (red bordered box), same as all other login error messages.

---

## 5. What Was Not Changed

- No DB schema changes
- No password changes
- `admin@jsg.com` auth.users row not deleted
- No historical data touched

---

## 6. Build and Lint

| Check | Result |
|---|---|
| `npm run build` | ✅ 0 TypeScript errors · 29 routes |
| `npm run lint` | ✅ 0 errors · 0 warnings |

---

## 7. Files Changed

| File | Change |
|---|---|
| `src/app/(auth)/login/admin/page.tsx` | Added `is_active` to profile select + inactive guard |
| `docs/SUPABASE_PHASE_10Q_FIX_ADMIN_LOGIN_INACTIVE_GUARD_REPORT.md` | This report |

# Phase 10T-F: Client Review Panel & Announcements — Production Verification Report

**Date:** 2026-06-05  
**Build:** ✅ 37 routes · 0 TypeScript errors  
**Lint:** ✅ 0 errors · 0 warnings  
**Production commit at time of report:** `596a1ea` (Phase 10T-E — date hardening)  
**Phase 10T-D changes:** Uncommitted (working tree) — NOT yet deployed to Vercel

---

## 1. Google Review URL Save

**Status: ✅ PASS**

`company_settings` query result:

| Column | Value |
|---|---|
| `organization_id` | `a0000000-0000-0000-0000-000000000001` |
| `org_name` | JSG CamSecure |
| `google_review_url` | `https://share.google/I3a5eRDCZ1gwrudXT` |

The URL is already set. The admin Settings → Google Review URL save flow worked correctly on production.

---

## 2. ReviewPanel on Client Dashboard

**Status: ✅ CODE CORRECT (URL set in DB)**

`ReviewPanel` in `src/components/client/ReviewPanel.tsx` reads `google_review_url` from `company_settings` via the server component. Since the URL is present in the DB (confirmed above), the panel renders a "Leave a Review" button that links to the configured URL.

No code changes needed. No data issues.

---

## 3. Announcements — Live State

**DB snapshot at verification time (2026-06-05):**

| Title | Published | Starts | Ends | Client-visible today? |
|---|---|---|---|---|
| test 2 | ✅ true | 2026-06-04 | 2026-06-08 | ✅ YES — within window |
| New Deal | ❌ false | NULL | NULL | ❌ NO — unpublished |
| deal test 1 | ❌ false | NULL (cleaned) | NULL | ❌ NO — unpublished |
| testdeal | ❌ false | NULL (cleaned) | NULL | ❌ NO — unpublished |

### "test 2" — Active published announcement ✅
Window: 2026-06-04 → 2026-06-08. Today (2026-06-05) is within the window. RLS `ca_select_client` passes. Clients can see this announcement now.

### "New Deal" — Currently unpublished ⚠️
`is_published = false`. The admin toggled it off during testing. This announcement is NOT visible to clients. Admin must open `/announcements/bf18c374.../edit` and check "Publish immediately" to make it visible.

### "deal test 1" and "testdeal" — Bad-date cleanup (this phase)
These two unpublished test announcements had invalid Postgres year values (`111111` and `222222`) carried over from before the 10T-E date validation fix was deployed. They were unpublished so no client impact. Dates cleared to NULL in this phase:

```sql
UPDATE client_announcements
SET starts_at = NULL, ends_at = NULL
WHERE is_published = false
  AND (
    starts_at::text LIKE '111111%' OR starts_at::text LIKE '222222%'
    OR ends_at::text LIKE '111111%' OR ends_at::text LIKE '222222%'
  );
-- 2 rows updated: "deal test 1", "testdeal"
```

---

## 4. Interest Button Flow

**Status: ✅ PASS — Already demonstrated on production**

`client_announcement_interests` table contains:

| Field | Value |
|---|---|
| `announcement_id` | `eed19c61-ea60-4bb9-928d-7a174ffd0733` ("test 2") |
| `profile_email` | `rahon@gmail.com` |
| `clicked_at` | 2026-06-06 03:36:43 UTC |

The interest button on the client dashboard (`/client`) called `POST /api/client/announcements/interest` successfully. The button correctly changes state to "Interest Sent" after submission. The DB row exists as evidence.

---

## 5. Admin Notification — Creation ✅, Click Routing: BUG FOUND AND FIXED

### Notification row (confirmed in DB)

| Field | Value |
|---|---|
| `event_type` | `client_announcement_interest` |
| `title` | "Client interested in deal" |
| `body` | "Rahon (2 June) is interested in 'test 2'." |
| `entity_type` | `announcement` |
| `entity_id` | `eed19c61-ea60-4bb9-928d-7a174ffd0733` |
| `is_read` | `true` |

Notification was created by the `/api/client/announcements/interest` route and was read by the admin. ✅

### Routing bug — found and fixed in this phase

`NotificationBell.tsx` had a local `notificationEntityUrl()` function that controlled where the bell navigates when a notification is clicked. It had no `announcement` case, causing `entity_type = "announcement"` notifications to fall through to `default: return /requests/${entityId}` — navigating to a non-existent request page.

The fix in `src/lib/data/notifications.ts` (committed in 10T-B) was server-side only; `NotificationBell.tsx` uses its own independent routing function.

**Fix applied (this phase) in `src/components/layout/NotificationBell.tsx`:**

```typescript
// Before:
function notificationEntityUrl(entityType: string, entityId: string): string {
  switch (entityType) {
    case "job":              return `/jobs/${entityId}`;
    case "client":           return `/clients/${entityId}`;
    case "technician":       return `/technicians/${entityId}`;
    default:                 return `/requests/${entityId}`;   // ← announcement fell here
  }
}

// After:
function notificationEntityUrl(entityType: string, entityId: string): string {
  switch (entityType) {
    case "job":              return `/jobs/${entityId}`;
    case "client":           return `/clients/${entityId}`;
    case "technician":       return `/technicians/${entityId}`;
    case "announcement":     return `/announcements/${entityId}/edit`;  // ← added
    default:                 return `/requests/${entityId}`;
  }
}
```

Clicking a "Client interested in deal" notification now navigates to `/announcements/[id]/edit`, where the admin can see the full interest list and manage the announcement.

---

## 6. Safety Checks

| Check | Status | Notes |
|---|---|---|
| Non-owner cannot delete announcements | ⚠️ PENDING | 10T-D changes not yet committed/deployed; delete button currently visible to admin role on production |
| Edit pencil navigates correctly | ⚠️ PENDING | 10T-D fix not deployed; `<Link><Button>` nesting bug still present on production |
| Delete does not disrupt session | ⚠️ PENDING | 10T-D fix not deployed; storage-before-DB delete anti-pattern still on production |
| Admin profile role is `admin` (not `owner`) | ✅ Confirmed | `info@jsgcamsecure.ca` → role = `admin` |
| Client interest flow does not break auth | ✅ Confirmed | API route uses service-role server client; no session disruption |

The safety checks for delete button visibility, edit button routing, and session stability during delete all depend on the **Phase 10T-D changes**, which are implemented locally but not yet committed. These require a separate approval + commit before deployment.

---

## 7. Changes Made in This Phase

### Code fix: `src/components/layout/NotificationBell.tsx`
Added `case "announcement": return /announcements/${entityId}/edit;` to local routing function.

### Data cleanup: `client_announcements`
Cleared bad-year dates from "deal test 1" and "testdeal" (both unpublished). DB now has no rows with year-111111 or year-222222 date values.

---

## 8. Files Changed (This Phase — UNCOMMITTED)

| File | Change |
|---|---|
| `src/components/layout/NotificationBell.tsx` | Added `announcement` case to `notificationEntityUrl()` |

### Files pending commit from Phase 10T-D (also UNCOMMITTED)

| File | Change |
|---|---|
| `src/components/announcements/AnnouncementsTable.tsx` | Edit button `router.push()` fix · `safeDate`/`fmtWindow` formatter · delete handler 0-row guard + reversed order · delete button owner-only |
| `src/app/(dashboard)/announcements/page.tsx` | Profile role fetch · passes `userRole` to `AnnouncementsTable` |
| `docs/SUPABASE_PHASE_10T_D_ANNOUNCEMENTS_BUGFIX_REPORT.md` | Report for Phase 10T-D bugs |

---

## 9. Action Required Before Closing Phase 10T

1. **Commit Phase 10T-D + 10T-F changes together** — `AnnouncementsTable.tsx`, `announcements/page.tsx`, `NotificationBell.tsx`, `docs/SUPABASE_PHASE_10T_D_ANNOUNCEMENTS_BUGFIX_REPORT.md`, `docs/SUPABASE_PHASE_10T_F_CLIENT_REVIEW_AND_ANNOUNCEMENTS_PROD_VERIFICATION.md` — pending user approval.

2. **Admin: publish "New Deal"** — Navigate to `/announcements` → edit "New Deal" → check "Publish immediately" → save. This will make the announcement visible to clients.

3. **Re-test notification bell click routing** on the next "Client interested in deal" notification to confirm `/announcements/[id]/edit` navigation.

---

## 10. What Was Not Changed

- DB schema: no migrations ✅
- RLS policies: untouched ✅
- Job / request / invoice / technician workflows: untouched ✅
- Client portal code: untouched ✅
- Auth logic: untouched ✅
- `email_alerts_enabled` remains `false` for all organizations ✅

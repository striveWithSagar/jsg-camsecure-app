# Phase 10T-C: Client Announcements Display + Interest Notification — Implementation Report

**Date:** 2026-06-05  
**Build:** ✅ 36 routes · 0 TypeScript errors  
**Lint:** ✅ 0 errors · 0 warnings

---

## Summary

Phase 10T-C delivers the client-portal display of announcements, the interest submission flow with admin notification, and the Review panel. It adds no new DB tables and no new storage buckets.

---

## 1 — API Route

### `POST /api/client/announcements/interest`

**File:** `src/app/api/client/announcements/interest/route.ts`

**Auth guard:** Verifies `auth.getUser()` + profile `role = 'client'`. Returns 401/403 otherwise.

**Flow:**
1. Validate `announcement_id` in body
2. Fetch `client_id` + `clientName` from `client_contacts` join
3. Verify announcement exists via Supabase JS (client RLS: only published+active visible)
4. `INSERT client_announcement_interests` (org_id, announcement_id, client_id, profile_id, message)
5. `INSERT notifications` (recipient_role=`admin`, event_type=`client_announcement_interest`)
6. Returns `{ ok: true }`

**Notification body:** `"<ClientName> is interested in "<AnnouncementTitle>"."`

---

## 2 — Client Components

### `src/components/client/AnnouncementCard.tsx`

- Displays poster image (signed URL) or branded orange placeholder (`ImageIcon`)
- Title, description (multi-line preserved via `whitespace-pre-line`)
- CTA button: admin-configured `ctaText` (default: "I'm Interested")
- On click: `POST /api/client/announcements/interest` → success toast → button changes to "Interest Sent" with `CheckCircle2` icon
- Button disabled after successful click (client-side only; DB has no unique constraint)
- Uses `var(--cp-orange)` / `var(--cp-cyan)` brand tokens

### `src/components/client/ReviewPanel.tsx`

- Branded card with `Star` icon, short trust message, "Leave a Review" button
- Button: `<a href={url} target="_blank" rel="noopener noreferrer">` — opens Google Business in new tab
- Component receives `url` prop; if `url` is empty string the parent conditionally omits rendering it

---

## 3 — Client Dashboard Updates

### `src/app/(client)/client/page.tsx`

Added to `Promise.all`:
- `getAnnouncementsForClient()` — fetches published + active announcements
- `getOrgSettings()` — fetches `googleReviewUrl`
- `resolveSignedUrls()` — generates 1-hour signed URLs for poster images server-side

**Signed URL generation:** batched `Promise.all` over announcements with `posterPath`. Client never sees the raw storage path. If a URL cannot be generated, the slot is simply absent from the map and `AnnouncementCard` renders the placeholder.

### `src/app/(client)/client/ClientDashboardView.tsx`

- Props added: `announcements`, `posterUrls`, `googleReviewUrl`
- Two new sections appended at the bottom of `space-y-8` stack:
  1. **News & Deals** — renders `<AnnouncementCard>` per announcement; hidden if `announcements.length === 0`
  2. **Google Review CTA** — renders `<ReviewPanel>` if `googleReviewUrl` is non-empty

---

## 4 — Notification System Updates

### `src/components/layout/NotificationBell.tsx`

Added to `EVENT_ICON`:
```typescript
client_announcement_interest: "💬",
```

### `src/lib/data/notifications.ts`

Added to `notificationEntityUrl()`:
```typescript
if (entityType === "announcement") return `/announcements/${entityId}/edit`;
```
Admin clicking the notification navigates directly to the announcement edit page where they can see the interests list.

---

## 5 — Verification Checklist

| Check | How to verify |
|---|---|
| Admin creates announcement without poster | `/announcements/new` → submit without poster → row appears in table, no poster_path |
| Admin creates announcement with poster | Add image → submit → poster appears in edit page |
| Unpublished announcement not shown to client | Create with publish=off → log in as client → not visible |
| Published active announcement shown to client | Publish → client dashboard shows "News & Deals" section |
| Expired announcement hidden | Set ends_at to past date → client does not see it |
| Future announcement hidden | Set starts_at to future date → client does not see it |
| Client clicks "I'm Interested" | Button changes to "Interest Sent", toast fires |
| Interest row created | Admin → `/announcements/[id]/edit` → interests table shows client name |
| Admin notification appears | NotificationBell shows 💬 "Client interested in deal" |
| Notification click opens announcement | Clicking notification navigates to `/announcements/[id]/edit` |
| Review panel hidden when URL empty | Settings → leave URL blank → client portal bottom has no review card |
| Review panel visible when URL set | Settings → set URL → client portal bottom shows review card |
| Review button opens new tab | Click "Leave a Review" → opens URL in new tab (noopener) |
| Build passes | ✅ 36 routes, 0 TypeScript errors |
| Lint passes | ✅ 0 errors, 0 warnings |

---

## 6 — Files Changed

| File | Action |
|---|---|
| `src/app/api/client/announcements/interest/route.ts` | New |
| `src/components/client/ReviewPanel.tsx` | New |
| `src/components/client/AnnouncementCard.tsx` | New |
| `src/app/(client)/client/page.tsx` | Updated |
| `src/app/(client)/client/ClientDashboardView.tsx` | Updated |
| `src/components/layout/NotificationBell.tsx` | Updated |
| `src/lib/data/notifications.ts` | Updated |

---

## 7 — What Was Not Changed

- Job, request, invoice, technician workflows: untouched ✅
- Technician portal: untouched ✅
- Existing notification behavior: only additive (new event type + entity routing) ✅
- Storage bucket / storage policies: no new objects — existing `camsecure-media` policies cover `org/<orgId>/announcements/…` paths ✅
- No hardcoded Google Review URL ✅

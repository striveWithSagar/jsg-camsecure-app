# Phase 10T-B: Admin Announcements — Implementation Report

**Date:** 2026-06-05  
**Build:** ✅ 35 routes · 0 TypeScript errors  
**Lint:** ✅ 0 errors · 0 warnings

---

## Summary

Phase 10T-B delivers the admin-side foundation for client announcements: DB schema, admin navigation, CRUD pages, settings extension for Google Review URL, and the data layer.

---

## 1 — Database Migration

**File:** `supabase/migrations/20260606012810_client_announcements.sql`  
**Applied to Supabase:** ✅ Confirmed via MCP `execute_sql`

### Changes applied

| Object | Type | Action |
|---|---|---|
| `company_settings.google_review_url` | Column (`TEXT`) | Added |
| `client_announcements` | Table | Created |
| `client_announcement_interests` | Table | Created |
| `idx_announcements_org_published` | Index | Created |
| `idx_announcement_interests_announcement` | Index | Created |
| `trg_announcements_updated_at` | Trigger | Created |
| `ca_select_admin` | RLS Policy | Created |
| `ca_select_client` | RLS Policy | Created |
| `ca_insert` | RLS Policy | Created |
| `ca_update` | RLS Policy | Created |
| `ca_delete` | RLS Policy | Created |
| `cai_select_admin` | RLS Policy | Created |
| `cai_select_client` | RLS Policy | Created |
| `cai_insert` | RLS Policy | Created |

### `client_announcements` schema

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | `gen_random_uuid()` |
| `organization_id` | UUID FK | `organizations(id)` |
| `title` | TEXT NOT NULL | Required |
| `description` | TEXT | Optional |
| `cta_text` | TEXT NOT NULL | Default: `'I'm Interested'` |
| `poster_path` | TEXT | Storage path in `camsecure-media` |
| `is_published` | BOOLEAN | Default: `false` |
| `starts_at` | TIMESTAMPTZ | Optional start gate |
| `ends_at` | TIMESTAMPTZ | Optional end gate |
| `created_by` | UUID FK | `profiles(id)` |
| `created_at` / `updated_at` | TIMESTAMPTZ | Auto-managed |

### `client_announcement_interests` schema

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | `gen_random_uuid()` |
| `organization_id` | UUID FK | `organizations(id)` |
| `announcement_id` | UUID FK | `client_announcements(id) ON DELETE CASCADE` |
| `client_id` | UUID FK | `clients(id)`, nullable |
| `profile_id` | UUID FK | `profiles(id)`, nullable |
| `message` | TEXT | Optional |
| `clicked_at` | TIMESTAMPTZ | Auto: `now()` |

---

## 2 — Data Layer

### `src/lib/data/settings.ts`

- `OrgSettings` type: added `googleReviewUrl: string`
- `getOrgSettings()` query: added `google_review_url` to select
- Maps: `googleReviewUrl: cs.google_review_url ?? ""`

### `src/lib/data/announcements.ts` (new)

| Export | Purpose |
|---|---|
| `getAnnouncements()` | Admin: all org announcements + interest counts |
| `getAnnouncementDetail(id)` | Admin: single announcement + interests list |
| `getAnnouncementsForClient()` | Client: published + active only (RLS enforces date window) |

Interest counts fetched in a single follow-up query (not N+1) — counts `announcement_id` rows grouped in code.

---

## 3 — Admin Navigation

### `src/components/layout/Sidebar.tsx`

Added to `NAV` array after Invoices:
```typescript
{ label: "Announcements", href: "/announcements", icon: Megaphone }
```

### `src/components/layout/MobileBottomNav.tsx`

Added to `MORE_NAV` between Invoices and Settings:
```typescript
{ label: "Announcements", href: "/announcements", icon: Megaphone }
```

---

## 4 — Admin Pages

| Route | File | Purpose |
|---|---|---|
| `/announcements` | `(dashboard)/announcements/page.tsx` | List with stats, publish toggles, edit/delete |
| `/announcements/new` | `(dashboard)/announcements/new/page.tsx` | Create form |
| `/announcements/[id]/edit` | `(dashboard)/announcements/[id]/edit/page.tsx` | Edit form + interests list |

All three routes are server components that fetch data server-side and pass it to client components.

---

## 5 — Admin Components

### `AnnouncementsTable.tsx`

- Renders announcement rows: title, date window, interest count, publish status
- **Publish toggle**: inline `UPDATE is_published` via Supabase JS client → `router.refresh()`
- **Delete**: confirms, removes poster from `camsecure-media` storage if present, then deletes row
- Responsive: window + interests columns hidden on small screens

### `AnnouncementForm.tsx`

- Shared create/edit form
- Fields: title, description, CTA text, poster upload, starts_at/ends_at, publish toggle
- **Poster upload flow (create):**
  1. Insert announcement row → get `id`
  2. Upload to `org/<orgId>/announcements/<id>/<filename>` in `camsecure-media`
  3. Update row with `poster_path`
- **Poster upload flow (edit):** upload new file to same path (upsert), update row
- If upload fails: shows warning toast, announcement is still saved without poster
- Poster preview with remove button; branded dashed drop zone if no poster

---

## 6 — Settings Extension

### `src/app/(dashboard)/settings/SettingsClient.tsx`

- Added new "Client Engagement" section (`Star` icon) between Organization and Notifications
- URL input field with placeholder `https://g.page/r/…/review`
- Saves to `company_settings.google_review_url` via Supabase JS client
- Empty value → saves `NULL` (hides Review panel in client portal)

---

## 7 — Route Count

| Phase | Routes before | Routes after |
|---|---|---|
| 10T-B | 32 | 35 (+`/announcements`, `/announcements/new`, `/announcements/[id]/edit`) |

---

## 8 — Files Changed

| File | Action |
|---|---|
| `supabase/migrations/20260606012810_client_announcements.sql` | New |
| `src/lib/data/settings.ts` | Updated |
| `src/lib/data/announcements.ts` | New |
| `src/components/layout/Sidebar.tsx` | Updated |
| `src/components/layout/MobileBottomNav.tsx` | Updated |
| `src/components/announcements/AnnouncementsTable.tsx` | New |
| `src/components/announcements/AnnouncementForm.tsx` | New |
| `src/app/(dashboard)/announcements/page.tsx` | New |
| `src/app/(dashboard)/announcements/new/page.tsx` | New |
| `src/app/(dashboard)/announcements/[id]/edit/page.tsx` | New |
| `src/app/(dashboard)/settings/SettingsClient.tsx` | Updated |

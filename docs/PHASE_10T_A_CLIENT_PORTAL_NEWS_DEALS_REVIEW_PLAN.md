# Phase 10T-A: Client Portal Review Panel + Admin Announcements — Implementation Plan

**Date:** 2026-06-05  
**Status:** PLAN — awaiting approval before implementation  
**Scope:** Feature additions only. No changes to job/request/invoice/technician workflows.

---

## 1 — Audit Findings

### 1.1 Admin Navigation (`Sidebar.tsx` + `MobileBottomNav.tsx`)

Current `Sidebar.tsx` NAV array (lines 15–22):
```
Dashboard → /dashboard
Service Requests → /requests
Job Board → /jobs
Clients → /clients
Technicians → /technicians
Invoices → /invoices
```
Settings is in a separate `BOTTOM_NAV` array (line 24).

**Best placement:** Add `Announcements → /announcements` as the last item in the main `NAV` array, after `Invoices` and before the Settings separator. This keeps it logically grouped with operational items without crowding Settings.

`MobileBottomNav.tsx` bottom drawer `MORE_NAV` currently has Technicians, Invoices, Settings. `Announcements` goes into `MORE_NAV` between Invoices and Settings.

Lucide icon recommendation: `Megaphone` (matches "news/deals" concept).

---

### 1.2 Storage Bucket (`camsecure-media`)

Existing bucket: `camsecure-media` — private, 10 MB limit, allows `image/jpeg image/png image/webp image/heic`.

Existing storage path convention:
```
org/<org_id>/jobs/<job_id>/<filename>
org/<org_id>/requests/<request_id>/<filename>
```

Existing storage RLS policies (`camsecure_media_select`, `camsecure_media_insert`, `camsecure_media_delete`) all check `name LIKE 'org/' || auth_org_id()::text || '/%'`. This already covers a new announcements sub-path without any new storage policy.

**New path convention for announcement posters:**
```
org/<org_id>/announcements/<announcement_id>/poster.<ext>
```

No new storage bucket or storage policies needed. ✅

Client-side image display: since the bucket is private, announcement poster URLs must be generated as short-lived signed URLs (`createSignedUrl`, 1-hour TTL). This should be done server-side at render time and passed as a signed URL prop — not from the client browser.

---

### 1.3 Notification Insert Pattern

Notifications are inserted by:
- **Triggers** (`fn_record_job_status_change`, `fn_sr_status_client_notify`, `convert_request_to_job`) for server-driven events
- **Direct Supabase JS client inserts** from `(client)/client/requests/new/page.tsx` for client-originated events

The `notifications` table RLS `notifications_insert` policy allows any authenticated user to insert notifications for their own org. The `notifications_select` RLS gives admin/owner/dispatcher all org notifications, plus each user sees their own `recipient_profile_id` targeted ones.

**Pattern for announcement interest notification:** use a dedicated API route (`POST /api/client/announcements/interest`) that atomically inserts both the interest row and the admin notification server-side. This is cleaner than two parallel client-side inserts and avoids partial failures.

`NotificationBell.tsx` `EVENT_ICON` map (line 46) needs a new entry for `client_announcement_interest`. The `notificationEntityUrl` function in `notifications.ts` needs to handle `entity_type = 'announcement'` → `/announcements/<id>`.

---

### 1.4 Client Portal Layout

`(client)/layout.tsx`: single-column, `.cp-portal` scoped, `max-w-4xl mx-auto px-4 py-6`, no sidebars.

`ClientDashboardView.tsx`: already has hero banner, metric tiles, quick actions, active jobs, open invoices sections — all in a `space-y-8` stack.

**Best placement for Review + Announcements:** Add two new sections at the bottom of `ClientDashboardView`, after the existing content. Order:

```
... existing sections ...
── Announcements/Deals  ←  dynamic, from DB
── Leave Us a Review    ←  static CTA, always visible
```

This order means the review CTA is never hidden above the fold by deal cards, but still appears naturally at the end of every page visit. Alternatively, if the team prefers the review prompt at the top of the engagement area, swap them. Both work — flagged for your call.

---

### 1.5 Google Review URL — Store in `company_settings`

`company_settings` currently has: `id, organization_id, business_name, abn, tax_rate, invoice_footer_note, primary_color, logo_url`.

**Recommendation:** Add `google_review_url TEXT` column to `company_settings`. Admin sets it in Settings → saves to DB. Client portal reads it at render time.

Benefit: no redeploy needed to update the URL. If it's null/empty, the Review panel is hidden.

Alternative (temporary hardcode): hardcode the Google Review URL as a constant in `ReviewPanel.tsx`. Simpler but not configurable without a deploy.

**Recommended: store in `company_settings`.**

---

## 2 — Recommended Database Schema

### 2.1 Migration: `company_settings` extension

```sql
ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS google_review_url TEXT;
```

No RLS change needed — existing `company_settings_select` (all authenticated org users) and `company_settings_update_owner` (owner only) already cover this column.

---

### 2.2 New table: `client_announcements`

```sql
CREATE TABLE client_announcements (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES organizations(id),
  title           TEXT        NOT NULL,
  description     TEXT,
  cta_text        TEXT        NOT NULL DEFAULT 'I''m Interested',
  poster_path     TEXT,         -- storage path in camsecure-media, nullable
  is_published    BOOLEAN     NOT NULL DEFAULT false,
  starts_at       TIMESTAMPTZ,  -- NULL = no start gate
  ends_at         TIMESTAMPTZ,  -- NULL = no end gate
  created_by      UUID        NOT NULL REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_announcements_org_published
  ON client_announcements(organization_id, is_published, starts_at, ends_at);

ALTER TABLE client_announcements ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_announcements_updated_at
  BEFORE UPDATE ON client_announcements
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

---

### 2.3 New table: `client_announcement_interests`

```sql
CREATE TABLE client_announcement_interests (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES organizations(id),
  announcement_id UUID        NOT NULL REFERENCES client_announcements(id) ON DELETE CASCADE,
  client_id       UUID        REFERENCES clients(id),
  profile_id      UUID        REFERENCES profiles(id),   -- client portal user
  message         TEXT,
  clicked_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_announcement_interests_announcement
  ON client_announcement_interests(announcement_id, clicked_at DESC);

ALTER TABLE client_announcement_interests ENABLE ROW LEVEL SECURITY;
```

---

## 3 — Recommended RLS Policies

### 3.1 `client_announcements`

```sql
-- Admin/owner/dispatcher: full org access (read all, including unpublished)
CREATE POLICY ca_select_admin ON client_announcements
  FOR SELECT TO authenticated
  USING (
    organization_id = auth_org_id()
    AND auth_role() = ANY (ARRAY['owner'::user_role, 'admin'::user_role, 'dispatcher'::user_role])
  );

-- Client: see published + within date window
CREATE POLICY ca_select_client ON client_announcements
  FOR SELECT TO authenticated
  USING (
    organization_id = auth_org_id()
    AND auth_role() = 'client'::user_role
    AND is_published = true
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at   IS NULL OR ends_at   >= now())
  );

-- Insert: admin/owner/dispatcher only
CREATE POLICY ca_insert ON client_announcements
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = auth_org_id()
    AND auth_role() = ANY (ARRAY['owner'::user_role, 'admin'::user_role, 'dispatcher'::user_role])
    AND created_by = auth.uid()
  );

-- Update: admin/owner/dispatcher only
CREATE POLICY ca_update ON client_announcements
  FOR UPDATE TO authenticated
  USING    (organization_id = auth_org_id()
            AND auth_role() = ANY (ARRAY['owner'::user_role, 'admin'::user_role, 'dispatcher'::user_role]))
  WITH CHECK (organization_id = auth_org_id()
            AND auth_role() = ANY (ARRAY['owner'::user_role, 'admin'::user_role, 'dispatcher'::user_role]));

-- Delete: owner only (prefer unpublish over delete)
CREATE POLICY ca_delete ON client_announcements
  FOR DELETE TO authenticated
  USING (organization_id = auth_org_id() AND auth_role() = 'owner'::user_role);
```

### 3.2 `client_announcement_interests`

```sql
-- Admin/owner/dispatcher: see all org interests
CREATE POLICY cai_select_admin ON client_announcement_interests
  FOR SELECT TO authenticated
  USING (
    organization_id = auth_org_id()
    AND auth_role() = ANY (ARRAY['owner'::user_role, 'admin'::user_role, 'dispatcher'::user_role])
  );

-- Client: see own interests only
CREATE POLICY cai_select_client ON client_announcement_interests
  FOR SELECT TO authenticated
  USING (
    organization_id = auth_org_id()
    AND auth_role() = 'client'::user_role
    AND profile_id = auth.uid()
  );

-- Insert: client only, own org, own profile
CREATE POLICY cai_insert ON client_announcement_interests
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = auth_org_id()
    AND auth_role() = 'client'::user_role
    AND profile_id = auth.uid()
    AND (client_id IS NULL OR client_id = auth_client_id())
  );
```

---

## 4 — UI Files to Create / Modify

### 4.1 Admin side — New files

| File | Type | Purpose |
|---|---|---|
| `src/app/(dashboard)/announcements/page.tsx` | Server Component | List all org announcements; publish/unpublish toggle; link to create/edit |
| `src/app/(dashboard)/announcements/new/page.tsx` | Server Component | Renders `AnnouncementForm` in create mode |
| `src/app/(dashboard)/announcements/[id]/edit/page.tsx` | Server Component | Renders `AnnouncementForm` in edit mode + interests list |
| `src/components/announcements/AnnouncementForm.tsx` | Client Component | Create/edit form: title, description, CTA text, poster upload, publish toggle, start/end date |
| `src/components/announcements/AnnouncementsTable.tsx` | Client Component | Table of announcements with publish badge, interest count, edit/delete actions |
| `src/lib/data/announcements.ts` | Server-only | `getAnnouncements()`, `getAnnouncement(id)`, `getAnnouncementsForClient()`, `getInterests(announcementId)` |
| `src/app/api/client/announcements/interest/route.ts` | API Route | `POST` — validates client auth, inserts interest + admin notification atomically |

### 4.2 Admin side — Modified files

| File | Change |
|---|---|
| `src/components/layout/Sidebar.tsx` | Add `{ label: "Announcements", href: "/announcements", icon: Megaphone }` to `NAV` after Invoices |
| `src/components/layout/MobileBottomNav.tsx` | Add `{ label: "Announcements", href: "/announcements", icon: Megaphone }` to `MORE_NAV` before Settings |
| `src/app/(dashboard)/settings/SettingsClient.tsx` | Add "Google Review URL" text input field, saved to `company_settings.google_review_url` |
| `src/lib/data/settings.ts` | Add `googleReviewUrl` to `OrgSettings` type + `getOrgSettings()` query |
| `src/components/layout/NotificationBell.tsx` | Add `client_announcement_interest: "💬"` to `EVENT_ICON` |
| `src/lib/data/notifications.ts` | Add `announcement` case to `notificationEntityUrl()` → `/announcements/<id>` |

### 4.3 Client portal — New files

| File | Type | Purpose |
|---|---|---|
| `src/components/client/ReviewPanel.tsx` | Client Component | Google Review CTA card — orange/cyan branded; hidden if `googleReviewUrl` is null |
| `src/components/client/AnnouncementCard.tsx` | Client Component | Single deal/news card with poster image, title, description, CTA button; posts interest on click |

### 4.4 Client portal — Modified files

| File | Change |
|---|---|
| `src/app/(client)/client/page.tsx` | Add `getAnnouncementsForClient()` + `getOrgSettings()` (for `googleReviewUrl`) to `Promise.all`; pass both to `ClientDashboardView` |
| `src/app/(client)/client/ClientDashboardView.tsx` | Add `announcements` + `googleReviewUrl` props; render `<AnnouncementCard>` list + `<ReviewPanel>` at the bottom of the `space-y-8` stack |

---

## 5 — Data Flow: Client Interest Submit

```
Client clicks "I'm Interested" on AnnouncementCard
  ↓
POST /api/client/announcements/interest
  { announcement_id: string, message?: string }
  ↓
API route:
  1. verifyClientAuth() — get user.id + org_id + client_id
  2. INSERT client_announcement_interests
     (org_id, announcement_id, client_id, profile_id=user.id, message)
  3. Fetch announcement.title for notification body
  4. Fetch company_name from clients where id = client_id
  5. INSERT notifications
     (org_id, actor=user.id, recipient_role='admin',
      event_type='client_announcement_interest',
      title='Client interested in deal',
      body='<CompanyName> is interested in "<AnnouncementTitle>".',
      entity_type='announcement', entity_id=announcement_id)
  6. Return { ok: true }
  ↓
Client: show toast "Thank you — we'll be in touch!", disable button
```

---

## 6 — Decision: Google Review URL

| Option | Pros | Cons |
|---|---|---|
| **Store in `company_settings` (recommended)** | Admin-configurable without deploy; consistent with existing pattern | Requires schema migration + settings UI change |
| Hardcode in `ReviewPanel.tsx` | Zero DB change | Any URL update requires code push |

**Recommendation:** Store in `company_settings.google_review_url`. If the URL is `NULL` or empty string, `ReviewPanel` renders nothing — clean progressive enhancement.

**For initial implementation:** even if the URL is temporarily hardcoded as an env var or constant during development, the settings column should still be added so the feature is configurable on production from day 1.

---

## 7 — Migration File Plan

Two migration files:

**File 1:** `supabase/migrations/<timestamp>_client_announcements_schema.sql`
- `ALTER TABLE company_settings ADD COLUMN google_review_url TEXT`
- `CREATE TABLE client_announcements` + indexes + RLS + trigger
- `CREATE TABLE client_announcement_interests` + indexes + RLS

**File 2:** No second migration file needed — storage path is handled by existing `camsecure-media` policies.

---

## 8 — What Is NOT Changing

- Job, request, invoice, technician workflows: untouched
- Technician portal: untouched
- Admin notification system: additive only (new event type + entity routing)
- Existing RLS policies: no modifications, only additions
- Client portal branding (`.cp-portal` CSS tokens): new components will use existing `var(--cp-orange)` / `var(--cp-cyan)` tokens

---

## 9 — File Count Summary

| Category | New files | Modified files |
|---|---|---|
| Admin pages | 3 | 0 |
| Admin components | 2 | 4 |
| Client pages | 0 | 2 |
| Client components | 2 | 0 |
| Data layer | 1 | 2 |
| API routes | 1 | 0 |
| Migrations | 1 | 0 |
| **Total** | **10** | **8** |

---

## 10 — Open Question for Approval

1. **Review panel position:** Place Google Review CTA *above* or *below* the announcements feed?  
   Above = more visible but feels pushy if there are many deals. Below = calmer, clients see deals first.  
   Recommended: **Announcements first, Review CTA last** (bottom of page = highest intent moment).

2. **Interest button behavior:** After clicking once, disable permanently for that session, or allow re-submit?  
   Recommended: **disable button client-side after first click** (no DB unique constraint — a client could theoretically click on refresh, but that's fine for the business use case).

3. **Poster image:** Required or optional?  
   Recommended: **optional** — announcement is valid without a poster. UI should gracefully show a styled placeholder if `poster_path` is null.

4. **`cta_text` default:** `"I'm Interested"` or `"Give Me More Info"` or admin-configurable per announcement?  
   Recommended: **admin-configurable per announcement** (already in the schema as `cta_text TEXT NOT NULL DEFAULT 'I''m Interested'`).

---

*Ready to implement on approval. No code changes have been made.*

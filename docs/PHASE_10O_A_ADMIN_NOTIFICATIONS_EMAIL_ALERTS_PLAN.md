# Phase 10O-A: Admin Notifications / Email Alerts — Implementation Plan

**Date:** 2026-05-30  
**Type:** Plan only — no code changes  
**Base commit:** 197a133

---

## 1. Current State Audit

### 1a. TopBar — Bell already placeholder-wired

`src/components/layout/TopBar.tsx` (line 68–71) already renders a `Bell` icon with a hardcoded red dot:

```tsx
<Button variant="ghost" size="icon" aria-label="Notifications" className="relative h-8 w-8">
  <Bell className="h-4 w-4" />
  <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
</Button>
```

`TopBar` is a `"use client"` component that already has access to `useProfile()`. The bell is the exact insertion point for the notification dropdown. The hardcoded dot becomes a dynamic unread count badge.

### 1b. Event sources — all client components making direct Supabase calls

| Event | File | Supabase call |
|---|---|---|
| Client creates request | `src/app/(client)/client/requests/new/page.tsx` | `.from("service_requests").insert(...)` |
| Client edits request | `src/components/client/ClientRequestActions.tsx` | `.from("service_requests").update({ description, service_type, urgency })` |
| Client cancels request | `src/components/client/ClientRequestActions.tsx` | `.from("service_requests").update({ status: "cancelled" })` |
| Admin converts to job | `src/components/requests/ConvertJobForm.tsx` | `.rpc("convert_request_to_job", {...})` |
| Admin assigns technician | `src/components/jobs/JobDetail.tsx` `saveAssignment()` | `.from("jobs").update({ technician_id, priority })` |
| Technician job status change | `src/components/technician/JobStatusWidget.tsx` `advance()` | `.from("jobs").update({ status })` |
| Technician adds field note | `src/components/technician/TechFieldNotes.tsx` `saveNote()` | `.from("job_notes").insert(...)` |
| Technician checks checklist item | `src/components/technician/TechChecklist.tsx` `toggleItem()` | `.from("job_checklist_items").update({ is_completed, ... })` |
| Technician completes job | `src/components/technician/JobStatusWidget.tsx` `advance("completed")` | `.from("jobs").update({ status: "completed", completed_at })` |
| Client uploads request photo | `src/components/requests/RequestPhotoPanel.tsx` `handleFile()` | `.from("service_request_photos").insert(...)` |
| Admin/tech uploads job photo | `src/components/jobs/JobPhotoPanel.tsx` `handleFile()` | `.from("job_photos").insert(...)` |

Every event is a Supabase call that already returns a success/error signal. Notification inserts slot in after the successful action — no new DB calls needed before the main action.

### 1c. `convert_request_to_job` RPC — server-side transaction

The RPC inserts a job row and updates the service request in a single transaction. A notification insert inside the RPC would fire atomically. This is the one event where extending the RPC is cleaner than a post-call insert in the form component.

### 1d. Job status trigger — existing infrastructure

`trg_job_status_on_update` (AFTER UPDATE on `jobs`) already calls `fn_record_job_status_change` which inserts into `job_status_history`. This trigger fires for every status change including completion. Extending this trigger to also insert a notification is clean and reliable — it cannot be bypassed by any code path.

---

## 2. Notification Table Schema

```sql
CREATE TABLE notifications (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID        NOT NULL REFERENCES organizations(id),
  recipient_profile_id  UUID        NULL REFERENCES profiles(id),
  recipient_role        user_role   NULL,
  actor_profile_id      UUID        NULL REFERENCES profiles(id),
  event_type            TEXT        NOT NULL,
  title                 TEXT        NOT NULL,
  body                  TEXT,
  entity_type           TEXT        NOT NULL,
  entity_id             UUID        NOT NULL,
  is_read               BOOLEAN     NOT NULL DEFAULT false,
  read_at               TIMESTAMPTZ NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_org_unread
  ON notifications(organization_id, is_read, created_at DESC);

CREATE INDEX idx_notifications_recipient
  ON notifications(recipient_profile_id, is_read)
  WHERE recipient_profile_id IS NOT NULL;
```

### Column semantics

| Column | Usage |
|---|---|
| `recipient_profile_id` | Set for targeted notifications (e.g., "You were assigned to JOB-001"). NULL when targeting a role group. |
| `recipient_role` | Set when targeting an entire role group (e.g., `'admin'` = all admins in org see it). NULL when targeting a specific profile. |
| `actor_profile_id` | Who triggered the event. NULL for system-generated. |
| `event_type` | See Event Types below. Text (not enum) to avoid frequent migrations. |
| `entity_type` | `'service_request'`, `'job'`, `'job_note'`, `'job_checklist_item'`, `'job_photo'`, `'service_request_photo'` |
| `entity_id` | UUID of the relevant entity — used to navigate to the correct page on click. |
| `is_read` / `read_at` | Managed by the mark-read flow. |

### Event type naming convention: `{actor}_{entity}_{action}`

| `event_type` | Trigger | Recipient |
|---|---|---|
| `client_request_created` | Client submits new request | `recipient_role = 'admin'` |
| `client_request_edited` | Client edits description/type/urgency | `recipient_role = 'admin'` |
| `client_request_cancelled` | Client cancels request | `recipient_role = 'admin'` |
| `admin_request_converted` | Admin converts to job | `recipient_profile_id = assigned_technician_profile_id` |
| `admin_technician_assigned` | Admin assigns/reassigns tech | `recipient_profile_id = new_technician_profile_id` |
| `technician_job_status_changed` | Tech advances job status (non-completion) | `recipient_role = 'admin'` |
| `technician_job_completed` | Tech marks job completed | `recipient_role = 'admin'` |
| `technician_field_note_added` | Tech adds field note | `recipient_role = 'admin'` |
| `technician_checklist_item_completed` | Tech checks off a required item | *(deferred — high volume, low urgency)* |
| `client_request_photo_uploaded` | Client uploads request photo | `recipient_role = 'admin'` |
| `job_photo_uploaded` | Admin or tech uploads job photo | `recipient_role = 'admin'` or *(deferred)* |

### Not notified in Phase 10O

- `technician_checklist_item_completed` — creates noise (one per item). Instead, consider a single `technician_checklist_all_required_done` event when `hasBlockingItems` transitions from true → false.
- `job_photo_uploaded` by admin — admin uploads their own photo, no reason to self-notify.

---

## 3. In-App vs Email Decision

### Phase 10O: In-app only

All 10 event types above are **in-app notifications only**. No email infrastructure in this phase.

### Phase 10P (deferred): Email for high-urgency events

| Event | Email priority |
|---|---|
| `client_request_created` | High — dispatcher needs to act quickly |
| `client_request_cancelled` | High — active work may need to be unwound |
| `technician_job_completed` | Medium — admin wants to know promptly |
| `admin_technician_assigned` | High — technician needs to know their assignment |
| Others | Low — visible in-app is sufficient |

### Email infrastructure deferred: no `email_events` or `notification_deliveries` table now

When email is introduced (Phase 10P), a separate `email_queue` table + Supabase Edge Function cron will be added. The `notifications` table is not extended for email — email is a separate delivery channel that reads from `notifications`. This keeps the schema clean.

---

## 4. RLS Policy Plan

### SELECT

```sql
CREATE POLICY notifications_select ON notifications
  FOR SELECT TO authenticated
  USING (
    -- Admin/owner/dispatcher: see all notifications in their org
    (organization_id = auth_org_id()
      AND auth_role() = ANY (ARRAY['owner','admin','dispatcher']))
    -- Technician: only notifications explicitly targeted to them
    OR (auth_role() = 'technician' AND recipient_profile_id = auth.uid())
  );
```

Clients never see notifications. Walk-in request actors (no `client_id`) have no notification visibility.

### INSERT

```sql
CREATE POLICY notifications_insert ON notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = auth_org_id()
    -- Actor must be the current user (or NULL for system-generated)
    AND (actor_profile_id = auth.uid() OR actor_profile_id IS NULL)
    -- Prevent clients from inserting admin-targeted notifications
    -- (clients can only create notifications for role='admin' after their own actions)
    -- This is permissive by design — see Section 6
  );
```

See Section 6 for the security discussion on client-originated inserts.

### UPDATE (mark as read only)

```sql
CREATE POLICY notifications_update_read ON notifications
  FOR UPDATE TO authenticated
  USING (
    (organization_id = auth_org_id()
      AND auth_role() = ANY (ARRAY['owner','admin','dispatcher']))
    OR recipient_profile_id = auth.uid()
  )
  WITH CHECK (
    (organization_id = auth_org_id()
      AND auth_role() = ANY (ARRAY['owner','admin','dispatcher']))
    OR recipient_profile_id = auth.uid()
  );
```

A column guard trigger (`trg_notification_read_guard`) prevents changing any column other than `is_read` and `read_at` via authenticated users. Structural fields (`event_type`, `entity_id`, `title`, etc.) are immutable after creation.

### DELETE

```sql
CREATE POLICY notifications_delete ON notifications
  FOR DELETE TO authenticated
  USING (
    organization_id = auth_org_id()
    AND auth_role() = 'owner'::user_role
  );
```

Only owners can delete notifications (e.g., bulk cleanup). Admins and dispatchers cannot delete — they can only mark as read.

---

## 5. Notification Creation Strategy

### Recommended: Hybrid (app-code + one DB trigger extension)

#### A. App-code post-action inserts (9 of 10 events)

After a Supabase action succeeds in a client component, insert a notification row as a **best-effort follow-up**. Notification failure does not block or revert the main action.

Pattern:
```typescript
// After main action succeeds:
const supabase = createClient();
await supabase.from("notifications").insert({
  organization_id:      orgId,
  recipient_role:       "admin",
  actor_profile_id:     user.id,
  event_type:           "client_request_created",
  title:                "New service request from Metro Security Ltd",
  body:                 `REQ-${requestNumber} — Camera Outage · High`,
  entity_type:          "service_request",
  entity_id:            requestId,
}).catch(err => console.warn("[notifications] insert failed:", err.message));
// .catch() ensures notification failure is non-blocking
```

Notification insert uses `.catch()` — the main operation already completed. If the notification insert fails (e.g., RLS issue, network), it logs a warning but does not affect the user's primary action.

#### B. DB trigger extension for job status (1 event)

Extend `fn_record_job_status_change` to also insert a notification. This is reliable because:
- It fires inside the same transaction as the status change
- Cannot be bypassed by any code path (admin, technician, future API)
- Status history and notification are written atomically

```sql
CREATE OR REPLACE FUNCTION fn_record_job_status_change()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_title TEXT; v_event TEXT;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO job_status_history (organization_id, job_id, changed_by_profile_id, old_status, new_status, changed_at)
    VALUES (NEW.organization_id, NEW.id, auth.uid(), OLD.status, NEW.status, now());

    -- Notification for all status transitions
    v_event := CASE WHEN NEW.status = 'completed' THEN 'technician_job_completed' ELSE 'technician_job_status_changed' END;
    v_title := CASE WHEN NEW.status = 'completed'
      THEN 'Job JOB-' || NEW.job_number || ' completed'
      ELSE 'Job JOB-' || NEW.job_number || ' status → ' || NEW.status
    END;
    INSERT INTO notifications (organization_id, actor_profile_id, recipient_role, event_type, title, entity_type, entity_id)
    VALUES (NEW.organization_id, auth.uid(), 'admin', v_event, v_title, 'job', NEW.id);
  END IF;
  RETURN NEW;
END;
$$;
```

#### C. RPC extension for convert_request_to_job

Add notification inserts inside the `convert_request_to_job` RPC for:
1. Admin-targeted notification: "Request REQ-X converted to job" (optional — admin did it themselves)
2. **Technician-targeted notification**: "You have been assigned to JOB-X" (important — this is how the technician finds out)

The technician notification requires looking up the technician's `profile_id` from the `technicians` table inside the RPC (or passing `p_technician_id` which is already a parameter).

### Why not all-trigger or all-RPC?

- **All-trigger**: Status changes work well as triggers because they already have one. Photo uploads, field notes, request edits don't have natural DB entry points for triggers without significant new infrastructure.
- **All-RPC**: Would require converting every client component action into an RPC call, breaking the established direct-SDK pattern.
- **Hybrid**: Minimal change surface, leverages existing patterns, reliable for high-frequency DB-only events.

### Security note on client inserts

Clients insert notifications for `recipient_role = 'admin'` after their own actions. The RLS INSERT policy validates `actor_profile_id = auth.uid()`. A malicious client could theoretically craft arbitrary notification titles/bodies. Mitigations:
1. Title/body are display-only — they don't affect business logic
2. The `entity_id` + `entity_type` link to real rows, verified by the admin when navigating
3. For Phase 10O, this risk is acceptable. Phase 10P (email) would require server-side generation of notification content to prevent content injection into emails.

---

## 6. MVP UI: Admin Notification Bell and Dropdown

### `TopBar.tsx` — replace hardcoded bell with `NotificationBell` component

```tsx
{/* Replace the current static Bell button with: */}
<NotificationBell />
```

### New: `src/components/layout/NotificationBell.tsx`

A `"use client"` component:

**State:**
- `notifications: NotificationItem[]` — last 20 unread
- `unreadCount: number`
- `open: boolean` — dropdown open state

**Realtime subscription:**
```typescript
useEffect(() => {
  // Initial fetch
  fetchNotifications();

  // Realtime: listen for new notifications targeting this org/user
  const channel = supabase
    .channel("notifications")
    .on("postgres_changes", {
      event: "INSERT",
      schema: "public",
      table: "notifications",
      filter: `organization_id=eq.${orgId}`,
    }, () => fetchNotifications())
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}, []);
```

**Dropdown content:**
- Unread count badge on bell icon (red dot → number when > 0)
- Max 20 recent notifications, sorted by `created_at DESC`
- Each row: icon by event type, title, body (truncated), relative time ("2 min ago")
- Unread rows have distinct background
- Click row: mark as read + `router.push(entityUrl)` where entity URL is derived from `entity_type` + `entity_id`
- "Mark all read" button at top right of dropdown
- Empty state: "No notifications"

**Entity navigation map:**
```typescript
const entityUrl = {
  service_request: `/requests/${entityId}`,
  job:             `/jobs/${entityId}`,
  job_note:        `/jobs/${entityId}`,       // scroll to notes
  job_photo:       `/jobs/${entityId}`,       // scroll to photos
  service_request_photo: `/requests/${entityId}`,
}[entity_type] ?? "/dashboard";
```

### Mark-as-read flow

```typescript
async function markRead(id: string) {
  await supabase.from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("id", id);
  setNotifications(prev => prev.filter(n => n.id !== id));
  setUnreadCount(c => Math.max(0, c - 1));
}

async function markAllRead() {
  await supabase.from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("organization_id", orgId)
    .eq("is_read", false);
  setNotifications([]);
  setUnreadCount(0);
}
```

### Notification data function

`src/lib/data/notifications.ts`:
```typescript
export type NotificationItem = {
  id:                  string;
  eventType:           string;
  title:               string;
  body:                string | null;
  entityType:          string;
  entityId:            string;
  actorProfileId:      string | null;
  isRead:              boolean;
  createdAt:           string;
};

export async function getAdminNotifications(): Promise<NotificationItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, event_type, title, body, entity_type, entity_id, actor_profile_id, is_read, created_at")
    .eq("is_read", false)
    .order("created_at", { ascending: false })
    .limit(20);
  return (data ?? []).map(...);
}
```

---

## 7. Optional: Notification List Page

`/notifications` — low priority for Phase 10O. Useful for:
- Viewing read notifications history
- Bulk mark-as-read
- Filtering by event type

Defer unless user requests it. The bell dropdown covers the core MVP use case.

---

## 8. Files Expected to Change

| File | Action | Description |
|---|---|---|
| `supabase/migrations/20260530000001_notifications.sql` | **NEW** | Table, indexes, RLS, read guard trigger, RPC + status trigger extension |
| `src/lib/data/notifications.ts` | **NEW** | `NotificationItem` type + fetch function |
| `src/components/layout/NotificationBell.tsx` | **NEW** | Bell icon + dropdown + realtime subscription |
| `src/components/layout/TopBar.tsx` | **MODIFIED** | Replace static bell with `<NotificationBell />` |
| `src/app/(client)/client/requests/new/page.tsx` | **MODIFIED** | Insert notification after request submit |
| `src/components/client/ClientRequestActions.tsx` | **MODIFIED** | Insert notifications on edit + cancel |
| `src/components/requests/ConvertJobForm.tsx` | **MODIFIED** | Insert notification after successful RPC |
| `src/components/jobs/JobDetail.tsx` | **MODIFIED** | Insert notification in `saveAssignment()` |
| `src/components/technician/TechFieldNotes.tsx` | **MODIFIED** | Insert notification after field note save |
| `src/components/jobs/JobPhotoPanel.tsx` | **MODIFIED** | Insert notification after photo upload (tech path only) |
| `src/components/requests/RequestPhotoPanel.tsx` | **MODIFIED** | Insert notification after photo upload (client path) |

**Not modified:**
- `TechChecklist.tsx` — per-item notifications deferred
- `JobStatusWidget.tsx` — job status notifications handled by DB trigger (no client code change)
- Admin portal pages — no change

---

## 9. Required Migrations

### Single migration: `20260530000001_notifications.sql`

Contents:
1. `CREATE TABLE notifications` with indexes
2. `ALTER TABLE notifications ENABLE ROW LEVEL SECURITY`
3. `notifications_select` policy
4. `notifications_insert` policy
5. `notifications_update_read` policy
6. `notifications_delete` policy
7. `fn_notification_read_guard()` + `trg_notification_read_guard` (column guard — only `is_read` + `read_at` changeable after insert)
8. `CREATE OR REPLACE FUNCTION fn_record_job_status_change()` — extended with notification insert
9. `CREATE OR REPLACE FUNCTION convert_request_to_job(...)` — extended with technician-assignment notification

---

## 10. Open Questions (resolve before implementation)

1. **Should admins be notified of their own actions?** (e.g., admin converts a request — they did it, so probably no notification to themselves). Recommend: skip notifications where `actor_profile_id = recipient_profile_id`.

2. **Notification for technician_assigned via `saveAssignment()`** vs via the RPC `convert_request_to_job`**: assignment can happen independently of conversion. Both flows need a notification. The `saveAssignment()` call in `JobDetail.tsx` should also insert a technician-targeted notification.

3. **"Reassignment" notification**: When a technician is reassigned, should the OLD technician be notified they're off the job? Recommend: notify the new technician, optionally notify the old one (deferred to Phase 10O-B).

4. **Job photo upload by admin**: Admin uploads a photo, who gets notified? Nobody — admin is doing the upload themselves. But if a technician uploads a photo, admin should be notified. `JobPhotoPanel` is shared — use `readOnly` prop context or pass an `actor_role` prop to determine notification targeting.

5. **Notification deduplication**: If a technician changes status 3 times in 5 minutes, 3 notifications fire. For Phase 10O, this is acceptable. A deduplication window can be added later.

6. **Unread count cap**: Should the bell show "99+" or the exact count? Recommend capping display at 99 with actual DB count stored.

---

## 11. Verification Checklist

### A. Schema

| # | Test |
|---|---|
| 1 | `notifications` table created with all columns, indexes, RLS |
| 2 | `is_read` defaults to `false`, `created_at` auto-set |
| 3 | `organization_id` FK enforced |

### B. RLS — Admin reads

| # | Test |
|---|---|
| 4 | Admin can SELECT all notifications for their org |
| 5 | Admin cannot SELECT notifications from a different org |

### C. RLS — INSERT

| # | Test |
|---|---|
| 6 | Admin can INSERT notification (actor_profile_id = auth.uid()) |
| 7 | Client can INSERT notification targeting `recipient_role = 'admin'` |
| 8 | Client cannot INSERT notification with `actor_profile_id` set to another user's ID |
| 9 | Unauthenticated user cannot INSERT |

### D. RLS — Mark as read

| # | Test |
|---|---|
| 10 | Admin can UPDATE `is_read = true` on org notification |
| 11 | Admin cannot change `event_type` or `title` (column guard fires) |
| 12 | Technician can mark read only on their own targeted notification |
| 13 | Client cannot mark any notification read |

### E. RLS — Technician scope

| # | Test |
|---|---|
| 14 | Technician sees only notifications where `recipient_profile_id = auth.uid()` |
| 15 | Technician cannot see role-targeted admin notifications |

### F. DB trigger — job status

| # | Test |
|---|---|
| 16 | Technician advances job status → `notifications` row created with `event_type = 'technician_job_status_changed'` |
| 17 | Technician completes job → `event_type = 'technician_job_completed'` row created |
| 18 | Admin changes job status → notification row created (same trigger) |

### G. App-code events

| # | Test |
|---|---|
| 19 | Client submits new request → `client_request_created` notification created |
| 20 | Client edits request → `client_request_edited` notification created |
| 21 | Client cancels request → `client_request_cancelled` notification created |
| 22 | Admin converts request → `admin_technician_assigned` notification for technician |
| 23 | Admin assigns technician via `saveAssignment()` → notification for new technician |
| 24 | Technician saves field note → `technician_field_note_added` notification |
| 25 | Client uploads request photo → `client_request_photo_uploaded` notification |

### H. Bell UI

| # | Test |
|---|---|
| 26 | Unread count badge shows correct number |
| 27 | Dropdown opens and lists notifications |
| 28 | Clicking a notification marks it read and navigates to entity page |
| 29 | "Mark all read" clears the badge and dropdown |
| 30 | Realtime: new notification appears in dropdown without page reload |

### I. Build + lint

| # | Test |
|---|---|
| 31 | `npm run build` → 0 TypeScript errors · 28+ routes |
| 32 | `npm run lint` → 0 errors · 0 warnings |

### J. Cleanup

| # | Test |
|---|---|
| 33 | All test notifications deleted after verification |
| 34 | Any test users/requests restored to baseline |

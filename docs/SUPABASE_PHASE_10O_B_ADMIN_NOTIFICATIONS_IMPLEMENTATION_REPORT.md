# Phase 10O-B: Admin Notifications — Implementation Report

**Date:** 2026-05-30  
**Status:** COMPLETE — awaiting commit approval  
**Base commit:** 197a133 (Phase 10N-B/C)

---

## 1. Summary

| Area | Result |
|---|---|
| `notifications` table + RLS + column guard | ✅ Created |
| `job_status_history_insert` RLS policy (missing, now fixed) | ✅ Added |
| Job status trigger extended with notifications | ✅ |
| `fn_sr_status_client_notify` trigger added | ✅ |
| `convert_request_to_job` RPC extended with notifications | ✅ |
| `NotificationBell.tsx` — bell + dropdown + polling | ✅ Created |
| `TopBar.tsx` — wired to real `NotificationBell` | ✅ Updated |
| `TechnicianOption` + `getTechnicians` — `profile_id` added | ✅ Updated |
| Event sources instrumented (8 app-code inserts) | ✅ |
| Build | ✅ 0 TypeScript errors · 28 routes |
| Lint | ✅ 0 errors · 0 warnings |
| RLS + trigger simulations (9 sims) | ✅ All pass |
| DB/state cleanup | ✅ 0 notifications, JOB-001 restored |

---

## 2. Files Changed

| File | Action | Description |
|---|---|---|
| `supabase/migrations/20260530000001_notifications.sql` | **NEW** | Full migration: table, RLS, triggers, RPC, history insert policy |
| `src/lib/data/notifications.ts` | **NEW** | `NotificationItem` type + server-side fetch functions |
| `src/lib/data/technicians.ts` | **MODIFIED** | `profile_id` added to `TechnicianOption` + `getTechnicians` query |
| `src/components/layout/NotificationBell.tsx` | **NEW** | Bell icon + dropdown + 30s polling |
| `src/components/layout/TopBar.tsx` | **MODIFIED** | Replaced hardcoded bell with `<NotificationBell />` |
| `src/app/(client)/client/requests/new/page.tsx` | **MODIFIED** | `client_request_created` notification |
| `src/components/client/ClientRequestActions.tsx` | **MODIFIED** | `client_request_edited` + `client_request_cancelled` notifications |
| `src/components/jobs/JobDetail.tsx` | **MODIFIED** | Technician assignment notifications (new + old tech) |
| `src/components/technician/TechFieldNotes.tsx` | **MODIFIED** | `technician_field_note_added` notification |
| `src/components/requests/RequestPhotoPanel.tsx` | **MODIFIED** | `client_request_photo_uploaded` notification |
| `src/components/jobs/JobPhotoPanel.tsx` | **MODIFIED** | `notifyOnUpload` prop + `job_photo_uploaded` notification |
| `src/components/technician/TechJobDetail.tsx` | **MODIFIED** | `notifyOnUpload={true}` passed to `JobPhotoPanel` |
| `docs/SUPABASE_PHASE_10O_B_ADMIN_NOTIFICATIONS_IMPLEMENTATION_REPORT.md` | **NEW** | This report |

---

## 3. Database Changes

### `notifications` table

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
```

### RLS policies

| Policy | Who |
|---|---|
| `notifications_select` | Admin/owner/dispatcher (org-scoped) OR `recipient_profile_id = auth.uid()` |
| `notifications_insert` | Any authenticated user for own org, as themselves (`actor_profile_id = auth.uid()`) |
| `notifications_update_read` | Same scope as SELECT — only `is_read` + `read_at` changeable (column guard enforces) |
| `notifications_delete` | Owner only |

### Column guard trigger

`trg_notification_read_guard` blocks UPDATE of any column except `is_read` and `read_at`. Raises `NOTIFICATION_IMMUTABLE` error.

### `job_status_history_insert` — new policy (bug fix)

**Root cause discovered:** The original `fn_record_job_status_change` was `SECURITY DEFINER`. Phase 10O-B rewrote it using `CREATE OR REPLACE FUNCTION` without the `SECURITY DEFINER` keyword, which silently reset it to `SECURITY INVOKER`. The function then ran as the `authenticated` role, which had no INSERT policy on `job_status_history` — blocking all trigger-based status history writes.

**Fix:** Added an INSERT policy on `job_status_history` allowing `authenticated` users to insert with `organization_id = auth_org_id()` and `changed_by_profile_id = auth.uid()`. This is correct per Supabase security guidelines (prefer RLS over SECURITY DEFINER). Direct inserts are constrained to the user's own org and profile.

```sql
CREATE POLICY job_status_history_insert ON job_status_history
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = auth_org_id()
    AND changed_by_profile_id = auth.uid()
  );
```

### Trigger extensions

**`fn_record_job_status_change`** (AFTER UPDATE on `jobs`):
- Admin notification (`recipient_role = 'admin'`) when actor is NOT admin/owner/dispatcher
- Client notification (`recipient_profile_id = client's profile_id`) on job completion
- Event types: `technician_job_status_changed`, `technician_job_completed`, `job_completed_client`

**`trg_sr_status_client_notify`** (new, AFTER UPDATE OF status on `service_requests`):
- Client notification when admin changes request status to `reviewing`, `ready_to_schedule`, or `cancelled`
- Skips if actor is the client themselves

**`convert_request_to_job` RPC extended** with:
- Technician notification: `admin_technician_assigned` (if technician assigned)
- Client notification: `request_converted_to_job` (if client_contacts profile exists)

---

## 4. Event Type Coverage

| Event | Source | Recipient |
|---|---|---|
| `client_request_created` | `client/requests/new/page.tsx` | `recipient_role = 'admin'` |
| `client_request_edited` | `ClientRequestActions.tsx` | `recipient_role = 'admin'` |
| `client_request_cancelled` | `ClientRequestActions.tsx` | `recipient_role = 'admin'` |
| `admin_technician_assigned` (new assignment) | `JobDetail.tsx saveAssignment()` + `convert_request_to_job` RPC | `recipient_profile_id` = new tech |
| `technician_reassigned_away` (old technician) | `JobDetail.tsx saveAssignment()` | `recipient_profile_id` = old tech |
| `technician_job_status_changed` | DB trigger `fn_record_job_status_change` | `recipient_role = 'admin'` |
| `technician_job_completed` | DB trigger `fn_record_job_status_change` | `recipient_role = 'admin'` |
| `technician_field_note_added` | `TechFieldNotes.tsx saveNote()` | `recipient_role = 'admin'` |
| `client_request_photo_uploaded` | `RequestPhotoPanel.tsx handleFile()` | `recipient_role = 'admin'` |
| `job_photo_uploaded` | `JobPhotoPanel.tsx handleFile()` (tech only, `notifyOnUpload=true`) | `recipient_role = 'admin'` |
| `request_converted_to_job` | `convert_request_to_job` RPC | `recipient_profile_id` = client |
| `job_completed_client` | DB trigger `fn_record_job_status_change` | `recipient_profile_id` = client |
| `request_status_updated_client` | DB trigger `trg_sr_status_client_notify` | `recipient_profile_id` = client |

---

## 5. NotificationBell Component

**Location:** `src/components/layout/NotificationBell.tsx`

**Replaces** the hardcoded `Bell` + red dot in `TopBar.tsx` (lines 68–71).

**Features:**
- Unread count badge (shows number, capped display at 99+)
- Dropdown listing up to 20 most recent unread notifications
- Emoji icon per event type for quick scanning
- Relative timestamp ("2m ago", "3h ago")
- Click notification → marks as read + navigates to entity page
- "Mark all read" button → clears all unread
- 30-second polling interval + re-fetch on dropdown open

**Polling choice (not Realtime):** Supabase Realtime postgres_changes requires careful RLS interaction and adds connection overhead. For a notification bell, 30-second polling is a reliable MVP approach. Realtime can be added in Phase 10O-C by subscribing to INSERT events on the `notifications` table.

**Navigation mapping:**
```typescript
entityType === "job" ? `/jobs/${entityId}` : `/requests/${entityId}`
```

---

## 6. `TechnicianOption` Update

Added `profile_id: string | null` to `TechnicianOption` type and updated `getTechnicians()` query to select `profile_id`. This enables `JobDetail.tsx` to insert technician-targeted notifications without an extra DB call for the profile lookup.

---

## 7. Self-Notification Prevention

**Approved decision:** Admins should not receive notifications about their own actions.

**Implementation:**
- DB trigger: only fires admin notification when `auth_role() NOT IN ('owner','admin','dispatcher')`
- App code: `saveAssignment()` in `JobDetail.tsx` only notifies the technicians (new + old), not admins
- `RequestPhotoPanel.tsx`: fires when `canUpload=true` (client upload context only)
- `JobPhotoPanel.tsx`: fires only when `notifyOnUpload=true` (set only in `TechJobDetail.tsx`, not in admin `JobDetail.tsx`)

---

## 8. Verification Simulation Results

| # | Simulation | Result |
|---|---|---|
| 1 | Admin SELECT org notifications | ✅ PASS |
| 2 | Client CANNOT read admin role notifications | ✅ PASS (blocked) |
| 3 | Client CAN read own `recipient_profile_id` notification | ✅ PASS |
| 4 | Admin can mark notification as read (UPDATE `is_read`) | ✅ PASS |
| 5 | Column guard blocks title/body change | ✅ PASS (title unchanged) |
| 6a | Technician sees own targeted notification | ✅ PASS |
| 6b | Technician CANNOT see admin role notification | ✅ PASS (blocked) |
| 7 | DB trigger creates admin notification for technician status change | ✅ PASS |
| 8 | Admin status change does NOT create admin notification | ✅ PASS (no self-notification) |
| 9 | Client can INSERT admin-targeted notification (own actor_profile_id) | ✅ PASS |

**Debugging note on Sim 7:** Failed initially due to missing `job_status_history` INSERT policy (see Section 3 bug fix). Passed after policy was added and `::text` cast was applied to the enum `status` field in `replace()` calls.

---

## 9. Build and Lint

| Check | Result |
|---|---|
| `npm run build` | ✅ 0 TypeScript errors · **28 routes** (unchanged) |
| `npm run lint` | ✅ 0 errors · 0 warnings |

**Build issues encountered and fixed:**
- Server/client module boundary: `NotificationBell.tsx` cannot import from `notifications.ts` (which uses `next/headers`). Fixed by defining `NotificationItem` type and `notificationEntityUrl` directly in `NotificationBell.tsx`.
- `PostgrestFilterBuilder` has no `.catch()`. Fixed by using `void supabase.from(...).insert(...)` (fire-and-forget pattern).
- `DropdownMenuTrigger` does not support `asChild` in this project. Fixed by applying button styles directly to the trigger element.
- `useCallback` + `setLoading` inside `useEffect` triggered `react-hooks/set-state-in-effect`. Fixed by defining async functions inline inside each effect (matching existing `JobPhotoPanel.tsx` pattern).

---

## 10. DB Cleanup

| Resource | Final state |
|---|---|
| `notifications` | 0 rows (all sim rows deleted) |
| JOB-001 | `in_progress` (restored) |
| `job_photos` | 7 rows (unchanged) |

---

## 11. Known Limitations / Future Work

| Limitation | Notes |
|---|---|
| 30s polling, not Realtime | Reliable MVP. Realtime subscription can be added in Phase 10O-C. |
| Admin notification navigates to admin portal only | Bell URL map uses `/jobs/`, `/requests/`. Client/tech portals have their own navigation when they click targeted notifications (not yet wired). |
| No technician-side bell | Technicians receive `recipient_profile_id` notifications but there is no bell UI in the technician portal yet. Phase 10O-C can add it to the technician header. |
| Client notification for request status only on 3 statuses | `reviewing`, `ready_to_schedule`, `cancelled`. Does not fire on admin-created status changes to other values. |
| No notification deduplication | Multiple rapid status changes create multiple notifications. A deduplication window can be added in Phase 10O-C. |
| Email delivery deferred | Phase 10P. No `email_events` table added. |

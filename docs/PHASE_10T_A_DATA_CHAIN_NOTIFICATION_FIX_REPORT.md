# Phase 10T-A: Client Request Data Chain + Notification Fixes

**Date:** 2026-06-01  
**Status:** COMPLETE — awaiting commit approval  
**Build:** ✅ 32 routes · 0 TypeScript errors  
**Lint:** ✅ 0 errors · 0 warnings  
**Calendar/date CSS:** NOT modified. Weekly Excel export: NOT modified.

---

## 1. Root Causes Found

### 1.1 "Unknown Client" in technician portal

**Cause:** `clients` RLS policy `clients_select` did not include `technician` role:
```sql
-- Old: only owner/admin/dispatcher + client (own record)
-- Technician got 0 rows → embedded clients(name) → NULL → "Unknown Client"
```

The data was correct (`jobs.client_id` = Norbert Company's ID). Only the RLS prevented technicians from reading it.

### 1.2 Admin sees "You have been assigned to JOB-####"

**Cause (two-part):**
1. `notifications_select` RLS gives admin/owner **all notifications in their org** — including those targeted at individual technician profiles (`recipient_profile_id = tech_uuid`).
2. `NotificationBell` query had no recipient filter — just fetched all `is_read = false` notifications that RLS allowed.

The RPC was creating the notification correctly (sent to technician's `recipient_profile_id`) — the admin was "eavesdropping" due to the broad RLS + no bell filter.

### 1.3 No admin notification when job is converted

The `convert_request_to_job` RPC sent notifications to the technician and client, but **zero notifications to admin**. Admin had no visibility into job creation.

### 1.4 Request submit notification — wrong wording, no technician notification

Admin received `"New request from Norbert Company"` with a terse body. No informational notification was sent to technicians.

---

## 2. Fixes Applied

### Fix 1 — `clients` RLS: add `technician` to `clients_select`

**DB change (live):**
```sql
DROP POLICY IF EXISTS clients_select ON clients;
CREATE POLICY clients_select ON clients FOR SELECT TO authenticated USING (
  ((organization_id = auth_org_id()) AND (auth_role() = ANY (ARRAY['owner','admin','dispatcher','technician'])))
  OR ((id = auth_client_id()) AND (auth_role() = 'client'))
);
```

Technicians can now read all clients in their organization. This is required for job display — a technician needs to know who they are working for.

### Fix 2 — `NotificationBell`: recipient filter

**File:** `src/components/layout/NotificationBell.tsx`

Added `useProfile()` and a one-time `getUser()` call to obtain `userId` and `role`. Both query locations now apply:

```
(recipient_role = my_role AND recipient_profile_id IS NULL)
OR (recipient_role IS NULL AND recipient_profile_id IS NULL)
OR recipient_profile_id = my_user_id
```

**Effect:**
- Admin sees: `recipient_role = 'admin'` broadcasts + their own profile-specific notifications
- Admin does NOT see: `recipient_profile_id = technician_id` notifications (assignment, etc.)
- Technician sees: `recipient_role = 'technician'` broadcasts + their own `recipient_profile_id` notifications ("You have been assigned")

### Fix 3 — `convert_request_to_job` RPC: admin broadcast + improved tech notification

**DB change (live):**

Added admin broadcast after job creation:
```sql
-- NEW: admin broadcast
INSERT INTO notifications (..., recipient_role = 'admin', ...)
VALUES (..., 'request_converted_to_job', 'JOB-0028 created', 'Assigned to Jordan Kim for Norbert Company.', 'job', v_job_id);
```

Updated technician notification body (was `NULL`, now includes context):
```sql
-- UPDATED: technician assignment notification
title = 'JOB-0028 assigned to you'
body  = 'Norbert Company · 123 Main St · camera_outage'
```

**Notification summary after fix:**

| Recipient | Event | Title | Sender |
|---|---|---|---|
| Assigned technician (profile) | `admin_technician_assigned` | "JOB-#### assigned to you" | RPC |
| Admin (role broadcast) | `request_converted_to_job` | "JOB-#### created" | RPC |
| Client (profile) | `request_converted_to_job` | "Your request has been scheduled as a job" | RPC |

### Fix 4 — Client request submit: notification wording + technician broadcast

**File:** `src/app/(client)/client/requests/new/page.tsx`

**Admin notification (updated wording):**
```typescript
title: "New service request submitted",
body:  `${companyName} submitted a request for ${serviceTypeLabel} at ${siteAddress || "—"}.`,
```

**Technician broadcast (new):**
```typescript
recipient_role: "technician",
title: "New service request pending assignment",
body:  `${companyName} requested ${serviceTypeLabel} at ${siteAddress || "—"}.`,
```

Technicians see this as informational — no assignment implied. With the NotificationBell filter fix, admins will NOT see this technician-targeted notification.

---

## 3. Files Changed

| File | Change |
|---|---|
| DB: `clients_select` policy | `technician` role added (live) |
| DB: `convert_request_to_job` RPC | Admin broadcast added; technician notification body improved (live) |
| `src/components/layout/NotificationBell.tsx` | `useProfile()` + `getUser()` + `recipientFilter()` + `mapRow()` helper |
| `src/app/(client)/client/requests/new/page.tsx` | Admin notification wording updated; technician broadcast added |

---

## 4. Notification Flow After All Fixes

```
CLIENT submits service request
  → Admin receives:       "New service request submitted"
                           "Norbert Company submitted a request for Camera Outage at St Norbert."
  → Technicians receive:  "New service request pending assignment"
                           "Norbert Company requested Camera Outage at St Norbert."

ADMIN converts to job, assigns technician
  → Technician receives:  "JOB-0029 assigned to you"
                           "Norbert Company · St Norbert · camera_outage"
  → Admin receives:       "JOB-0029 created"   ← NEW
                           "Assigned to Jordan Kim for Norbert Company."  ← NEW
  → Client receives:      "Your request has been scheduled as a job"
                           "JOB-0029 has been created for your service request."

TECHNICIAN portal job list/detail
  → client column shows:  "Norbert Company"  ← FIXED (was "Unknown Client")
```

---

## 5. Verification Checklist

| # | Check | Result |
|---|---|---|
| 1 | Technician job list shows real company name (not "Unknown Client") | ✅ RLS fix applied |
| 2 | Technician job detail shows real company name | ✅ RLS fix applied (`getJobById` uses same clients embed) |
| 3 | Admin does NOT see "You have been assigned to JOB-####" | ✅ NotificationBell filter |
| 4 | Admin sees "JOB-#### created — Assigned to [Tech] for [Client]" | ✅ RPC fix |
| 5 | Assigned technician still receives "JOB-#### assigned to you" | ✅ RPC keeps technician notification |
| 6 | Client still receives "Your request has been scheduled as a job" | ✅ RPC keeps client notification |
| 7 | Admin notification for new request: "New service request submitted" | ✅ client/requests/new page |
| 8 | Technician notification for new request: "New service request pending assignment" | ✅ client/requests/new page |
| 9 | Admin does NOT see the technician "pending assignment" broadcast | ✅ NotificationBell filter (role-scoped) |
| 10 | `npm run build` — 0 TypeScript errors, 32 routes | ✅ |
| 11 | `npm run lint` — 0 errors, 0 warnings | ✅ |
| 12 | Calendar/date-time CSS untouched | ✅ |
| 13 | Weekly Excel export untouched | ✅ |

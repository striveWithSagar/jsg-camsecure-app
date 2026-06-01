# Phase 10T-A: Client Request → Job → Technician Data Chain + Notification Audit

**Date:** 2026-06-01  
**Type:** Audit — findings confirmed, implementation pending  
**Build before audit:** ✅ passing

---

## 1. "Unknown Client" in Technician Portal — Root Cause

### Confirmed by DB query

Jobs 25–28 (Norbert Company) have `client_id = ca16485f` set correctly and `clients.name = "Norbert Company"` in the DB. The data IS there.

### Root cause: `clients` RLS blocks technician role

`clients_select` policy:
```sql
((organization_id = auth_org_id()) AND (auth_role() = ANY ('owner','admin','dispatcher')))
OR ((id = auth_client_id()) AND (auth_role() = 'client'))
```

**`technician` is not in this policy.** When `getTechJobList()` and `getJobById()` run with a technician's session, they execute `clients(name)` as an embedded join. PostgREST runs a sub-query against `clients` with the technician's RLS context — which returns zero rows. `extractClientName(null) → "Unknown Client"`.

### Why the data chain is otherwise correct

| Step | Status |
|---|---|
| Client submits request → `service_requests.client_id = ca16485f` | ✅ Set correctly |
| Admin converts → `convert_request_to_job` sets `jobs.client_id = p_client_id` | ✅ Set correctly |
| `getTechJobList()` queries `clients(name)` via `jobs.client_id` | ❌ RLS blocks read → NULL → "Unknown Client" |

### Fix required

Add `technician` to `clients_select` (read-only, scoped to their org):
```sql
DROP POLICY IF EXISTS clients_select ON clients;
CREATE POLICY clients_select ON clients FOR SELECT TO authenticated USING (
  ((organization_id = auth_org_id()) AND (auth_role() = ANY (ARRAY['owner','admin','dispatcher','technician'])))
  OR ((id = auth_client_id()) AND (auth_role() = 'client'))
);
```

Justification: technicians are field workers who need to know who the client is for their assigned jobs. This is no different from the admin seeing the same data.

---

## 2. Admin Sees "You Have Been Assigned to JOB-####" — Root Cause

### Confirmed by DB query + RLS analysis

The `convert_request_to_job` RPC correctly inserts:
```sql
-- Correctly targeted at the technician's profile ID
INSERT INTO notifications (..., recipient_profile_id = v_tech_profile, title = 'You have been assigned to JOB-####', ...)
```

This notification is CORRECTLY addressed to the technician's profile ID (not to admin). **The data is correct.**

### Root cause: `notifications_select` RLS is too broad for admins

```sql
-- Current policy:
((organization_id = auth_org_id()) AND (auth_role() = ANY ('owner','admin','dispatcher')))
OR (recipient_profile_id = auth.uid())
```

The first branch lets admin/owner/dispatcher see **ALL notifications in their org** — including those with `recipient_profile_id = some_technician_id`. Admins read notifications meant for technicians.

### Root cause: `NotificationBell` has no recipient filter

```typescript
// Current query — no recipient filter:
.eq("is_read", false)
.order("created_at", ...)
```

### Fix required

Add a recipient filter to `NotificationBell` so each user only sees notifications intended for them:
```
(recipient_profile_id IS NULL AND recipient_role = my_role)
OR (recipient_profile_id IS NULL AND recipient_role IS NULL)
OR (recipient_profile_id = my_user_id)
```

This ensures:
- Admin sees: notifications with `recipient_role = 'admin'` + general broadcasts + their own profile-specific notifications
- Technician sees: notifications with `recipient_role = 'technician'` + general broadcasts + their own "You have been assigned" notifications
- Admin does NOT see technician's "You have been assigned" (targeted at technician profile ID)

---

## 3. Missing Admin Notification on Job Convert

### Current RPC behavior

`convert_request_to_job` sends:
- ✅ Technician: "You have been assigned to JOB-####" → `recipient_profile_id = v_tech_profile`
- ✅ Client: "Your request has been scheduled as a job" → `recipient_profile_id = v_client_profile`
- ❌ **MISSING**: Admin broadcast notification

Admin currently sees no notification when a new job is created (unless they happen to see the technician's notification due to the RLS bug above).

### Fix required

Add admin broadcast to the RPC:
```sql
INSERT INTO notifications (organization_id, actor_profile_id, recipient_role, event_type, title, body, entity_type, entity_id)
VALUES (v_org_id, auth.uid(), 'admin',
  'request_converted_to_job',
  'JOB-' || LPAD(COALESCE(v_job_number::text,'?'), 4, '0') || ' created',
  'Assigned to ' || v_tech_name || ' for ' || v_client_name || '.',
  'job', v_job_id);
```

(Requires looking up tech name and client name in the RPC — both are available via joins.)

---

## 4. Request Submit Notification — Wording + Missing Technician Notification

### Current behavior

```typescript
// Admin notification (correct recipient, wrong wording):
{
  recipient_role: "admin",
  event_type: "client_request_created",
  title: `New request from ${profile.companyName}`,    // ← should be clearer
  body: `${reqLabel} · ${serviceType} · ${urgency}`,  // ← needs site address
}
// ❌ No technician notification at all
```

### Required behavior

**Admin notification:**
```typescript
{
  recipient_role: "admin",
  title: "New service request submitted",
  body: `${companyName} submitted a request for ${serviceTypeLabel} at ${siteAddress || "—"}.`,
}
```

**Technician broadcast (new — informational only):**
```typescript
{
  recipient_role: "technician",
  title: "New service request pending assignment",
  body: `${companyName} requested ${serviceTypeLabel} at ${siteAddress || "—"}.`,
}
```

Note: `recipient_role = "technician"` broadcasts to all technicians in the org. With the `NotificationBell` fix (see issue 2), admins will NOT see this — they only see `recipient_role = "admin"` notifications.

---

## 5. Files to Change

| Fix | Files |
|---|---|
| 1. "Unknown Client" | RLS on `clients` table (MCP SQL) |
| 2. Admin sees tech notifications | `src/components/layout/NotificationBell.tsx` |
| 3. Admin notification on job convert | `convert_request_to_job` RPC (MCP SQL) |
| 4. Request submit notifications | `src/app/(client)/client/requests/new/page.tsx` |

**No changes to:** calendar/date-time CSS, weekly Excel export, DB schema (columns), any portal page logic.

---

## 6. Data Chain Summary (after fixes)

```
CLIENT submits service request
  → service_requests: client_id ✅, client_name ✅, site_address ✅
  → Notification: Admin ← "New service request submitted"
  → Notification: All technicians ← "New service request pending assignment" [NEW]

ADMIN converts to job
  → jobs: client_id ✅ (from p_client_id), technician_id ✅
  → Notification: Assigned technician ← "You have been assigned to JOB-####" ✅
  → Notification: Client ← "Your request has been scheduled as a job" ✅
  → Notification: Admin ← "JOB-#### created — Assigned to [Tech] for [Client]" [NEW]

TECHNICIAN views job
  → getTechJobList(): clients(name) join — ✅ after RLS fix
  → getJobById(): clients(name) join — ✅ after RLS fix

ADMIN views notifications
  → NotificationBell only shows recipient_role='admin' + own profile-id notifications
  → Does NOT show technician-targeted "You have been assigned" [FIX]
```

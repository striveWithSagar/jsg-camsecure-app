# Phase 10N-B: Client Request Edit / Cancel — Implementation Report

**Date:** 2026-05-29  
**Status:** COMPLETE — awaiting commit approval  
**Base commit:** dbf157d (Phase 10M-C verification report)

---

## 1. Summary

| Area | Result |
|---|---|
| Migration applied | ✅ `20260529000001_client_request_edit_cancel.sql` |
| `service_requests_update_client` RLS policy | ✅ Created |
| `trg_sr_client_col_guard` column guard trigger | ✅ Created |
| `convert_request_to_job` hardened (cancelled guard) | ✅ Updated |
| Data layer — `rawServiceType` added to `ClientRequestDetail` | ✅ |
| `ClientRequestActions.tsx` (edit + cancel UI) | ✅ New component |
| `/client/requests/[id]/page.tsx` updated | ✅ |
| Build | ✅ 0 TypeScript errors · 28 routes |
| Lint | ✅ 0 errors · 0 warnings |
| RLS simulations (8) | ✅ 8/8 pass |
| DB / test data cleanup | ✅ Clean |

---

## 2. Files Changed

| File | Action | Description |
|---|---|---|
| `supabase/migrations/20260529000001_client_request_edit_cancel.sql` | **NEW** | RLS policy + column guard + hardened RPC |
| `src/lib/data/client-portal.ts` | **MODIFIED** | `rawServiceType` in `ClientRequestDetail` and return mapping |
| `src/components/client/ClientRequestActions.tsx` | **NEW** | Edit form + cancel button |
| `src/app/(client)/client/requests/[id]/page.tsx` | **MODIFIED** | Import + render `ClientRequestActions` |
| `docs/SUPABASE_PHASE_10N_B_CLIENT_REQUEST_EDIT_CANCEL_REPORT.md` | **NEW** | This report |

---

## 3. Database Changes

### New RLS policy: `service_requests_update_client`

```sql
CREATE POLICY service_requests_update_client ON service_requests
  FOR UPDATE TO authenticated
  USING (
    client_id       = auth_client_id()
    AND auth_role() = 'client'::user_role
    AND status      IN ('new', 'reviewing')
  )
  WITH CHECK (
    client_id           = auth_client_id()
    AND auth_role()     = 'client'::user_role
    AND organization_id = auth_org_id()
    AND status          IN ('new', 'reviewing', 'cancelled')
  );
```

- **USING** (old row): client can target only their own `new` or `reviewing` requests
- **WITH CHECK** (new row): status must remain `new`, `reviewing`, or `cancelled` — blocks elevation to `ready_to_schedule` or `converted`

### New trigger: `trg_sr_client_col_guard`

Fires BEFORE UPDATE. When the caller is `client` role, raises `SR_FIELD_RESTRICTED` if any of the following change: `organization_id`, `client_id`, `submitted_by_profile_id`, `client_name`, `request_number`, `converted_to_job_id`, `notes`.

Allowed client-editable fields: `description`, `service_type`, `urgency`, `status` (→ `cancelled` only via WITH CHECK), `client_phone`, `updated_at` (auto-managed by trigger).

### Hardened `convert_request_to_job` RPC

Added a cancelled-status guard **before** the existing converted-request guard:

```sql
IF v_req.status = 'cancelled' THEN
  RAISE EXCEPTION
    'SERVICE_REQUEST_CANCELLED: Service request has been cancelled and cannot be converted to a job.';
END IF;
```

The error prefix `SERVICE_REQUEST_CANCELLED:` allows the admin convert page to surface a clear message if needed.

**Note:** The RPC had to be `DROP`ped before recreation due to a Postgres restriction on removing parameter defaults via `CREATE OR REPLACE`.

---

## 4. Data Layer Change

`ClientRequestDetail` (in `src/lib/data/client-portal.ts`) now includes:

```typescript
rawServiceType: string;   // DB enum value, e.g. "new_installation"
serviceType:    string;   // display label, e.g. "New Installation"
```

`rawServiceType` passes directly from `row.service_type` (no transform). This allows `ClientRequestActions` to pre-select the correct value in the edit dropdown without a reverse-mapping lookup.

---

## 5. UI: `ClientRequestActions.tsx`

Rendered at `/client/requests/[id]` **above** `RequestPhotoPanel`, only when `status === 'new' || status === 'reviewing'`.

### Modes

| Mode | Triggered by | Behaviour |
|---|---|---|
| Idle | Default | Shows "Edit Request" + "Cancel Request" buttons |
| Edit open | "Edit Request" click | Inline form: service_type select, urgency select, description textarea, Save / Discard |
| Cancel confirm | "Cancel Request" click | Confirmation card: "Yes, cancel request" / "Keep request" |
| Cancelled | After successful cancel | Replaces all controls with "Request cancelled" info card |

### Edit flow

1. Client clicks "Edit Request"
2. Inline form pre-fills from `request.rawServiceType`, `request.urgency`, `request.description`
3. Client changes any field(s)
4. "Save Changes" → `supabase.from("service_requests").update({ description, service_type, urgency }).eq("id", request.id)`
5. On success: form collapses, brief "Changes saved" confirmation
6. On error: inline error message (`SR_FIELD_RESTRICTED` surfaced as user-friendly text)
7. "Discard" → form collapses, original values restored in state

### Cancel flow

1. Client clicks "Cancel Request"
2. Confirmation card appears: "Cancel this request? This cannot be undone by you."
3. "Yes, cancel request" → `supabase.from("service_requests").update({ status: "cancelled" }).eq("id", request.id)`
4. On success: `currentStatus` state → `'cancelled'`; all edit/cancel controls replaced by cancelled info card
5. On error: inline error, confirmation card resets

Both flows write directly to Supabase — no fake state, no optimistic-only updates.

---

## 6. RLS Simulation Results

All sims ran via `SET LOCAL ROLE authenticated` with JWT claims set via `set_config`. Test data cleaned up after every sim.

| # | Scenario | Expected | Result |
|---|---|---|---|
| 1 | Client updates `description` on own `new` request | ALLOWED | ✅ PASS |
| 2 | Client sets `status = 'cancelled'` on own `new` request | ALLOWED | ✅ PASS |
| 3 | Client edits a `cancelled` request (USING blocks) | BLOCKED | ✅ PASS |
| 4 | Client attempts to change `notes` (column guard fires) | BLOCKED (`SR_FIELD_RESTRICTED`) | ✅ PASS |
| 5 | Client attempts to set `status = 'ready_to_schedule'` (WITH CHECK blocks) | BLOCKED | ✅ PASS |
| 6 | Client edits a walk-in request (different `client_id`) | BLOCKED | ✅ PASS |
| 7 | Admin updates `notes` on the same request (regression) | ALLOWED | ✅ PASS |
| 8 | `convert_request_to_job` called on a cancelled request | BLOCKED (`SERVICE_REQUEST_CANCELLED`) | ✅ PASS |

---

## 7. Build and Lint

| Check | Result |
|---|---|
| `npm run build` | ✅ 0 TypeScript errors · **28 routes** (unchanged) |
| `npm run lint` | ✅ 0 errors · 0 warnings |

---

## 8. DB Cleanup

All sim test rows removed or restored:

| Resource | Final state |
|---|---|
| REQ-008 (d.park's request) | `description = 'asdasdasda'`, `notes = ''`, `status = 'new'` — fully restored |
| `dddd0001` sim request | Deleted |
| All other service_requests | Unchanged |

---

## 9. Admin Portal Impact

No admin portal code was changed. Existing behaviour:

- Admin sees a client-cancelled request with status `Cancelled` and the "Status locked: Cancelled" message
- Admin can still set the status back to `new` via the status dropdown if needed (admin-only capability)
- The convert page (`/requests/[id]/convert`) will surface `SERVICE_REQUEST_CANCELLED` as an error if admin attempts to convert a cancelled request — no additional UI changes needed; the error propagates naturally to the admin's error display

---

## 10. Known Limitations

| Limitation | Notes |
|---|---|
| Client cannot un-cancel | Only admin can restore from `cancelled`. Intentional — per spec. |
| No cancellation reason field | Status-only cancel. A `client_cancel_reason` column can be added in a future phase without RLS changes. |
| No real-time admin notification | If admin is viewing a request while the client cancels it, their page is stale until reload. Acceptable — no real-time sync in scope. |
| `ready_to_schedule` + beyond locks client out | Once admin advances the request, it's locked to client. Admin must set it back to `reviewing` to re-enable client editing. Correct behaviour. |

# Phase 10N-A: Client Request Editing and Cancellation — Implementation Plan

**Date:** 2026-05-29  
**Type:** Plan only — no code changes in this phase  
**Base commit:** dbf157d

---

## 1. Current Workflow Audit

### 1a. `service_requests` schema

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `organization_id` | uuid | NOT NULL |
| `client_id` | uuid | NULL for walk-in |
| `client_contact_id` | uuid | NULL |
| `submitted_by_profile_id` | uuid | Profile who submitted |
| `client_name` | text | Display name (from profile) |
| `client_phone` | text | Contact number |
| `service_type` | enum | new_installation … other |
| `urgency` | enum | emergency, high, medium, low |
| `status` | enum | **see below** |
| `description` | text | Client-entered issue description |
| `notes` | text | Admin internal notes |
| `converted_to_job_id` | uuid | Set by convert_request_to_job RPC |
| `request_number` | integer | Auto-assigned by trigger |
| `created_at` / `updated_at` | timestamptz | `updated_at` maintained by trigger |

**`request_status` enum values:**

```
new → reviewing → ready_to_schedule → converted
                                    ↘ cancelled (at any admin-controlled step)
```

### 1b. Current RLS policies

| Policy | Command | Who |
|---|---|---|
| `service_requests_select` | SELECT | Admin/owner/dispatcher (org) OR client (own client_id) |
| `service_requests_insert` | INSERT | Admin/owner/dispatcher (org) OR client (own client_id) |
| `service_requests_update_admin` | UPDATE | Admin/owner/dispatcher (org) **only** |
| `service_requests_delete_owner` | DELETE | Owner only |

**Critical gap:** There is **no client UPDATE policy**. Clients cannot currently edit or cancel their own requests.

### 1c. Triggers on `service_requests`

| Trigger | Event | Function | Purpose |
|---|---|---|---|
| `trg_assign_request_number` | BEFORE INSERT | `assign_request_number` | Sequential request_number via sequence |
| `trg_service_requests_updated_at` | BEFORE UPDATE | `set_updated_at` | Maintains `updated_at` automatically |

No history table exists. `updated_at` is the only audit trail for edits.

### 1d. `convert_request_to_job` RPC

The RPC guards against double-conversion:
```sql
IF v_req.status = 'converted' OR v_req.converted_to_job_id IS NOT NULL THEN
  RAISE EXCEPTION 'Service request has already been converted';
END IF;
```

This means:
- A cancelled request cannot be converted (USING clause blocks client UPDATE on converted requests; admin path is separate)
- If a client cancels a request before admin converts it, the RPC will still succeed unless status is also checked — **the RPC only checks for `converted`, not `cancelled`**. This means an admin could theoretically convert a client-cancelled request if they have a stale view. This is an **edge case to document**, not a blocker.

### 1e. Client request detail page

`/client/requests/[id]/page.tsx` is a **Server Component** that renders static read-only fields (service type, submitted date, description, linked job) and two Client Components (`RequestStatusBadge`, `RequestPhotoPanel`). No edit or cancel functionality exists.

### 1f. Admin request detail page

`RequestDetail.tsx` (admin) shows status, client info, description, internal notes, and the photo panel. The admin status dropdown already includes `cancelled`. The admin notes field is already separate from client description. **No changes needed to the admin portal.**

---

## 2. Decisions

| Question | Decision | Rationale |
|---|---|---|
| Which statuses allow editing? | `new` and `reviewing` only | Matches existing `canUpload` gate; admin has already read the request by `ready_to_schedule` |
| Which statuses allow cancellation? | `new` and `reviewing` only | Same gate — once `ready_to_schedule` or beyond, admin/ops is committed |
| What fields can client edit? | `description`, `service_type`, `urgency` | The core content the client controls; contact fields (phone) excluded for simplicity |
| Can client edit `notes`? | No | `notes` is an admin-internal field |
| Can client change `client_id`, `org_id`, etc.? | No | Structural fields — protected by column guard trigger |
| Cancellation format | Status-only (`status → 'cancelled'`) | No reason field in Phase 10N; clean and simple. Reason can be added later with a `client_cancel_reason` column |
| Visibility after cancel — admin? | Yes, fully visible | Admin sees all requests regardless of status |
| Visibility after cancel — client? | Yes, listed with "Cancelled" badge | Row stays in the client's request list |
| Can client un-cancel? | No | Once cancelled, status cannot be reversed by client. Admin can still change status via the dropdown |
| What happens if admin converts a client-cancelled request? | Edge case — allow for now, admin is responsible | Documented as a known limitation |
| History/audit trail | `updated_at` only for Phase 10N | No `service_request_history` table needed now |

---

## 3. RLS Policy Changes

### New policy: `service_requests_update_client`

```sql
CREATE POLICY service_requests_update_client ON service_requests
  FOR UPDATE TO authenticated
  USING (
    client_id        = auth_client_id()
    AND auth_role()  = 'client'::user_role
    AND status       IN ('new'::request_status, 'reviewing'::request_status)
  )
  WITH CHECK (
    client_id        = auth_client_id()
    AND auth_role()  = 'client'::user_role
    AND organization_id = auth_org_id()
    AND status       IN ('new'::request_status, 'reviewing'::request_status, 'cancelled'::request_status)
  );
```

**USING (old row):** Only rows the client owns that are still in `new` or `reviewing` can be targeted. This gates both edits and cancellations identically at the row level.

**WITH CHECK (new row):** The new row must:
- Still belong to the client (`client_id = auth_client_id()`)
- Stay in the same org
- Have a status of `new`, `reviewing`, or `cancelled` (client cannot elevate to `ready_to_schedule` or `converted`)

This single policy covers both the edit case (status stays unchanged) and the cancel case (status → `cancelled`).

### Column guard trigger: `trg_sr_client_col_guard`

RLS alone cannot restrict which columns a client changes. A `BEFORE UPDATE` trigger prevents clients from modifying structural/admin fields:

```sql
CREATE OR REPLACE FUNCTION fn_sr_client_col_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF auth_role() = 'client'::user_role THEN
    IF NEW.organization_id         IS DISTINCT FROM OLD.organization_id
    OR NEW.client_id               IS DISTINCT FROM OLD.client_id
    OR NEW.client_contact_id       IS DISTINCT FROM OLD.client_contact_id
    OR NEW.submitted_by_profile_id IS DISTINCT FROM OLD.submitted_by_profile_id
    OR NEW.client_name             IS DISTINCT FROM OLD.client_name
    OR NEW.notes                   IS DISTINCT FROM OLD.notes
    OR NEW.converted_to_job_id     IS DISTINCT FROM OLD.converted_to_job_id
    OR NEW.request_number          IS DISTINCT FROM OLD.request_number
    THEN
      RAISE EXCEPTION 'SR_FIELD_RESTRICTED: Clients may only update description, service type, urgency, and status.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sr_client_col_guard
  BEFORE UPDATE ON service_requests
  FOR EACH ROW EXECUTE FUNCTION fn_sr_client_col_guard();
```

Columns a client **can** change:
- `description`
- `service_type`
- `urgency`
- `status` (to `cancelled` only, enforced by WITH CHECK)
- `client_phone` (contact number — debatable, excluded from restriction list for flexibility)
- `updated_at` (handled by existing `set_updated_at` trigger automatically)

### Migration file

`supabase/migrations/20260529000001_client_request_edit_cancel.sql`

Contents:
1. `service_requests_update_client` policy
2. `fn_sr_client_col_guard` function
3. `trg_sr_client_col_guard` trigger

---

## 4. Data Layer Changes

`ClientRequestDetail` (in `src/lib/data/client-portal.ts`) already includes:
- `id`, `organizationId`, `status`, `description`, `serviceType`, `urgency`, `isTerminal`

**Additions needed:**
- None strictly required — all needed fields are already present
- `getClientRequestById` already returns `organizationId` (for photo panel reuse)

---

## 5. UI Changes — Client Portal

### New component: `src/components/client/ClientRequestActions.tsx`

A `"use client"` component rendered at the bottom of the request detail page.

**Props:**
```typescript
{
  request: ClientRequestDetail;
}
```

**Visibility gating:**
Only rendered when `request.status === 'new' || request.status === 'reviewing'`.

When status is `ready_to_schedule`, `converted`, or `cancelled` — the component renders nothing (or a read-only note like "This request is no longer editable.").

**Edit section:**
- Collapsible — hidden behind "Edit Request" button (not always open)
- When open:
  - `service_type` select (same options as the new request form, pre-filled)
  - `urgency` select (pre-filled)
  - `description` textarea (pre-filled)
- "Save Changes" button → `supabase.from("service_requests").update({ service_type, urgency, description }).eq("id", request.id)`
- "Discard" button → collapses without saving
- Success: brief "Changes saved" confirmation, collpase
- Error: inline error message

**Cancel section:**
- "Cancel Request" button (destructive styling, always visible when status is editable)
- Click → inline confirmation: "Are you sure? This cannot be undone by you." + "Yes, cancel" / "Keep request"
- On confirm: `supabase.from("service_requests").update({ status: "cancelled" }).eq("id", request.id)`
- On success: navigate to `/client/requests` (request is no longer active)
- On error: inline error

**State machine:**
```
idle
├── editOpen: form is expanded; Save → saving → idle (updated); Discard → idle
└── cancelConfirm: confirmation shown; Yes → cancelling → redirect; No → idle
```

### Page update: `src/app/(client)/client/requests/[id]/page.tsx`

Add import and render `ClientRequestActions` just before the `RequestPhotoPanel`:

```tsx
import { ClientRequestActions } from "@/components/client/ClientRequestActions";

// In the page JSX:
{(request.status === "new" || request.status === "reviewing") && (
  <ClientRequestActions request={request} />
)}
```

The page remains a Server Component — `ClientRequestActions` is the client boundary.

### Request list: `src/app/(client)/client/requests/page.tsx`

No changes required. The existing `RequestCard` already renders the status badge, and the cancelled badge style is already defined:
```typescript
cancelled: "badge-rescheduled",
```

Cancelled requests are naturally ordered last in the list (the list currently has no status-based filtering — all requests are shown).

---

## 6. Admin Portal Impact

**No code changes needed.** The admin portal already:
- Shows all request statuses in `RequestDetail.tsx` including `cancelled`
- Has a locked "Status locked: Cancelled" message when `isTerminal` (which includes `cancelled`)
- The `RequestDetail` status dropdown only shows non-`converted` statuses (admin can set back to `new` if needed)

The only visible effect on admin: a request that was `new` or `reviewing` may become `cancelled` without admin action. Admin sees it with the cancelled badge. Admin retains the ability to change the status back via their own dropdown if needed.

---

## 7. Files Expected to Change

| File | Action | Description |
|---|---|---|
| `supabase/migrations/20260529000001_client_request_edit_cancel.sql` | **NEW** | RLS policy + column guard |
| `src/components/client/ClientRequestActions.tsx` | **NEW** | Edit form + cancel button with confirmation |
| `src/app/(client)/client/requests/[id]/page.tsx` | **MODIFIED** | Render `ClientRequestActions` |
| `docs/PHASE_10N_A_CLIENT_REQUEST_EDIT_CANCEL_PLAN.md` | **NEW** | This plan |

**Not changed:** Admin portal pages, `RequestDetail.tsx`, `client-portal.ts` data layer, `service_requests` schema (no new columns), any RLS policy for admin.

---

## 8. Verification Checklist (20 tests)

### A. RLS — Client edit allowed

| # | Test |
|---|---|
| 1 | Client updates `description` on own `new` request → row updated |
| 2 | Client updates `service_type` on own `new` request → row updated |
| 3 | Client updates `urgency` on own `reviewing` request → row updated |
| 4 | `updated_at` advances after client edit |

### B. RLS — Cancellation allowed

| # | Test |
|---|---|
| 5 | Client sets `status = 'cancelled'` on own `new` request → row updated |
| 6 | Client sets `status = 'cancelled'` on own `reviewing` request → row updated |
| 7 | After cancel, row visible to client with `status = 'cancelled'` |
| 8 | After cancel, row visible to admin (not filtered out) |

### C. RLS — Client blocked

| # | Test |
|---|---|
| 9 | Client cannot edit own `ready_to_schedule` request (USING blocks) |
| 10 | Client cannot edit own `converted` request (USING blocks) |
| 11 | Client cannot edit own `cancelled` request (USING blocks — can't un-cancel) |
| 12 | Client cannot edit another client's request (client_id mismatch) |
| 13 | Client cannot set `status = 'ready_to_schedule'` (WITH CHECK blocks) |
| 14 | Client cannot set `status = 'converted'` (WITH CHECK blocks) |

### D. Column guard

| # | Test |
|---|---|
| 15 | Client UPDATE of `notes` → trigger fires `SR_FIELD_RESTRICTED` |
| 16 | Client UPDATE of `client_id` → trigger fires `SR_FIELD_RESTRICTED` |
| 17 | Client UPDATE of `organization_id` → trigger fires `SR_FIELD_RESTRICTED` |

### E. Build + lint

| # | Test |
|---|---|
| 18 | `npm run build` → 0 TypeScript errors, 28 routes (unchanged) |
| 19 | `npm run lint` → 0 errors, 0 warnings |

### F. Admin regression

| # | Test |
|---|---|
| 20 | Admin can still update `notes` and `status` on a request the client can edit — no interference from new client policy |

---

## 9. Known Limitations and Future Work

| Limitation | Notes |
|---|---|
| No cancellation reason | Client just sets `status = 'cancelled'`. A `client_cancel_reason` column can be added in a future phase. |
| Admin can convert a client-cancelled request | The `convert_request_to_job` RPC only checks `status = 'converted'`, not `cancelled`. Admin should check status before converting. Not a blocker. |
| No notification to admin when client edits/cancels | Out of scope — a notification system would be a separate feature. |
| No `service_request_history` table | `updated_at` is the only audit trail. A history table can be added later. |
| Client cannot un-cancel | Once cancelled, only admin can restore the request via their status dropdown. This is intentional. |
| `ready_to_schedule` requests are locked to client | If admin sets status to `ready_to_schedule` and then needs client to re-describe the issue, admin must move it back to `reviewing` first. This is correct behaviour. |

---

## 10. Open Questions

1. **Should the edit form show the linked job details on a `converted` request?** The current page already shows the linked job card. No change needed — the `ClientRequestActions` component renders nothing for converted requests, while the rest of the page still shows the linked job.

2. **Should service_type be editable?** The admin may have already acted on the service type (e.g., assigned a specialist technician). However, since editing is only allowed in `new`/`reviewing` — before `ready_to_schedule` — admin hasn't fully committed yet. **Recommendation: allow service_type edit.**

3. **Should urgency be editable?** Same logic applies. **Recommendation: allow urgency edit.**

4. **Should `client_phone` be editable?** The current plan excludes it from the column guard (it's not in the restricted list). However, the edit UI form above only exposes `description`, `service_type`, and `urgency`. Phone can be added later without RLS changes.

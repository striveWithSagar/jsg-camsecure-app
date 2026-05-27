# Supabase Phase 8D-F — Client New Request Form Report

> Status: COMPLETE
> Date: 2026-05-26
> Project: JSG_CamSecure (ref: gbvstrhorjjvlxnfmxcz)

---

## What Changed

`/client/requests/new` now performs a real Supabase INSERT into `service_requests`.
`useMockStore`, `MOCK_CLIENT`, `CLIENT_NAME`, and `CLIENT_PHONE` are fully removed.
The form uses `useClientProfile()` for prefill and identity fields, and calls
`supabase.auth.getUser()` at submit time to get `submitted_by_profile_id`.

---

## Files Changed

| File | Type | Change |
|---|---|---|
| `src/app/(client)/client/requests/new/page.tsx` | Modified | Replaced `useMockStore` + `MOCK_CLIENT` with `useClientProfile()` + browser Supabase client; `handleSubmit` made async; `SERVICE_TYPE_MAP` added for label→enum mapping; loading + inline error states added; success screen shows UUID short ref; company field pre-filled and read-only |

No new files created. No other files touched.

---

## Architecture

```
/client/requests/new/page.tsx  (Client Component — "use client")
  └── useClientProfile()  →  profile.orgId, clientId, contactId, companyName, phone, email
  └── handleSubmit (async)
        └── supabase.auth.getUser()  →  submitted_by_profile_id
        └── supabase.from("service_requests").insert({ ... }).select("id").single()
        └── success → show shortRef (id.split("-")[0].toUpperCase())
        └── error   → show inline submitError message
```

---

## INSERT Payload

```ts
{
  organization_id:         profile.orgId,          // RLS: must equal auth_org_id()
  client_id:               profile.clientId,        // RLS: must equal auth_client_id()
  client_contact_id:       profile.contactId,
  submitted_by_profile_id: user.id,                 // from supabase.auth.getUser()
  client_name:             profile.companyName,
  client_phone:            phone || profile.phone,  // form input or profile fallback
  service_type:            SERVICE_TYPE_MAP[label], // "Camera Outage" → "camera_outage"
  urgency:                 urgency.toLowerCase(),    // "High" → "high"
  status:                  "new",
  description:             desc,
  notes:                   "",
}
```

### `SERVICE_TYPE_MAP`
| UI Label | DB Enum |
|---|---|
| New Installation | `new_installation` |
| Maintenance | `maintenance` |
| DVR/NVR Issue | `dvr_nvr_issue` |
| Camera Outage | `camera_outage` |
| Mobile App Issue | `mobile_app_issue` |
| Wiring Issue | `wiring_issue` |
| Emergency Service | `emergency_service` |
| Quote Request | `quote_request` |
| Site Inspection | `site_inspection` |
| Other | `other` |

---

## UX Changes from Mock Version

| Feature | Mock | Supabase |
|---|---|---|
| Submit handler | Sync, localStorage write | Async, Supabase INSERT |
| Submit button | Always enabled | Disabled + "Submitting…" while loading |
| Error state | None (silent) | Inline error below button |
| Success ref shown | "REQ-006" style ID | First UUID segment, e.g. `E5E2CEC6` |
| Contact name pre-fill | Empty | Pre-filled from `profile.name` |
| Company field | Editable, pre-filled | Read-only, pre-filled from profile |
| Email field | Empty | Pre-filled from `profile.email` |
| Phone placeholder | Hardcoded `MOCK_CLIENT.phone` | `profile.phone` from Supabase |

---

## Verification

### Mock references removed

Grep over `requests/new/page.tsx`:
- `useMockStore`  → **0 matches**
- `MOCK_CLIENT`   → **0 matches**
- `CLIENT_NAME`   → **0 matches**
- `CLIENT_PHONE`  → **0 matches**

### Test INSERT result (cleaned up after verification)

Inserted row confirmed:
- `id`: `e5e2cec6-0722-4470-bde3-e48bc0ee7519` (deleted after verification)
- `client_id`: `a0000000-0000-0000-0000-000000000101` ✓ Metro Security Ltd
- `submitted_by_profile_id`: `ae091c96-a0f0-443f-87dc-c0b5c909e9b6` ✓ David Park
- `service_type`: `camera_outage` ✓ enum accepted
- `status`: `new` ✓

### Admin visibility

All 8 requests (5 seeded + 2 prior test + 1 verification) visible via
`organization_id = auth_org_id()` for admin role — the new client-submitted
request appears at the top of `/requests` ordered by `created_at DESC`.

### Client RLS isolation

Via `client_id = auth_client_id()` filter:
- David Park sees **only** requests with `client_id = a0000000-...000101`.
- Seeded walk-in requests (REQ-001 to REQ-005) have `client_id = NULL` → not visible to any client portal user. This is correct — those were phone-in requests with no portal account.
- Requests from other clients are isolated by `client_id` mismatch.

### Unauthenticated access

`(client)/layout.tsx` (Phase 8D-C) calls `getCurrentClientProfile()` → redirects
to `/login/client` for all unauthenticated visitors before the page renders.
No RLS bypass possible through the UI.

---

## Build Result

**✓ Clean — 0 TypeScript errors, 24 routes (unchanged count).**

---

## Lint Result

**✓ Clean — 0 ESLint errors or warnings.**

---

## Remaining Limitations

| Item | Detail |
|---|---|
| **`address` field not persisted** | The site address is validated as required but `service_requests` has no `address` column. It could be prepended to `description` or added as a schema column in a future migration. |
| **`preferred` datetime not persisted** | Preferred date/time input is captured by the form but has no corresponding column in `service_requests`. Could be added as `preferred_at timestamptz` in a future migration. |
| **Photo upload is a placeholder** | Storage/Supabase bucket not configured yet. The camera dropzone renders disabled with "Available after account setup." |
| **No request list in client portal** | Submitted requests are visible to admins but the client has no `/client/requests` list page yet. The success screen links back to overview only. |
| **Success ref is UUID segment** | Shows e.g. `E5E2CEC6` (first 8 hex chars). A human-readable `REQ-NNN` style reference would require a DB sequence or trigger. |

---

## Remaining Mock Dependencies (full portal)

| File | Dependency | Notes |
|---|---|---|
| `src/app/(dashboard)/requests/[id]/convert/page.tsx` | `MOCK_TECHNICIAN` | Admin portal — name placeholder in convert form; not in client portal scope |
| `src/lib/mock-session.ts` | `MOCK_TECHNICIAN`, `MOCK_CLIENT` | Still exported; `MOCK_CLIENT` no longer consumed by client portal |
| `src/lib/constants.ts` | `MOCK_JOBS`, `MOCK_REQUESTS`, etc. | Still exported; admin portal still references some mock metrics |

The entire client portal (`layout`, `header`, `/client`, `/client/jobs`, `/client/invoices`,
`/client/requests/new`) is now fully Supabase-backed. All mock dependencies removed.

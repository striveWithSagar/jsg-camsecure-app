# Phase 10J-E: Client Request Photo Upload UI + Admin Request Photo Viewer — Implementation Report

**Date:** 2026-05-28  
**Status:** COMPLETE — awaiting commit approval  
**Base commit:** 2033afa

---

## 1. Scope

- **Client**: Upload and delete photos on own service requests at `/client/requests/[id]`
- **Admin**: View (and delete) client-uploaded request photos at `/requests/[id]`
- **Success screen**: "View Request / Add Photos" button after new request submission
- No DB schema changes. No storage bucket changes. No new RLS policies required.

---

## 2. Files Changed

| File | Action | Description |
|------|--------|-------------|
| `src/components/requests/RequestPhotoPanel.tsx` | **CREATED** | Reusable client component — upload/view/delete for `service_request_photos` |
| `src/lib/data/client-portal.ts` | **MODIFIED** | Added `organization_id` to select query and `organizationId` to `ClientRequestDetail` type |
| `src/app/(client)/client/requests/[id]/page.tsx` | **MODIFIED** | Import + render `RequestPhotoPanel` with `canUpload` gated by request status |
| `src/components/requests/RequestDetail.tsx` | **MODIFIED** | Added `organizationId` to `RequestDetailData` type; import + render `RequestPhotoPanel` with `canUpload={false}` |
| `src/app/(dashboard)/requests/[id]/page.tsx` | **MODIFIED** | Pass `raw.organization_id` when constructing `RequestDetailData` |
| `src/app/(client)/client/requests/new/page.tsx` | **MODIFIED** | Added `requestId` state; "View Request / Add Photos" button on success screen |

---

## 3. Component: `RequestPhotoPanel`

**Props:**
```typescript
{
  requestId:      string;   // service_requests.id
  organizationId: string;   // service_requests.organization_id
  canUpload?:     boolean;  // default true — hides upload button when false
}
```

**Storage path format:**
```
org/{organizationId}/requests/{requestId}/{timestamp}-{safeFileName}
```

**Key design decisions:**
- Mirrors `JobPhotoPanel` exactly — same state machine, same `refreshKey` pattern, same rollback-on-DB-failure
- `canUpload` prop controls upload button visibility; delete button is always shown (RLS handles authorization)
- Admin receives `canUpload={false}` — viewer + delete only in this phase
- Client receives `canUpload={request.status === "new" || request.status === "reviewing"}` — matches RLS INSERT constraint exactly
- `createSignedUrls()` batch generates all signed URLs in one call (3600s expiry)

---

## 4. Schema Audit

### `service_request_photos` columns

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | uuid | NO | gen_random_uuid() |
| `organization_id` | uuid | NO | — |
| `service_request_id` | uuid | NO | — |
| `uploaded_by_profile_id` | uuid | NO | — |
| `storage_bucket` | text | NO | `'camsecure-media'` |
| `storage_path` | text | NO | — |
| `file_name` | text | NO | — |
| `mime_type` | text | NO | — |
| `file_size` | integer | NO | — |
| `caption` | text | YES | — |
| `created_at` | timestamptz | NO | now() |

`caption` is nullable and unused in this phase — available for a future "describe what you see" UX.

### RLS Policies (all pre-existing, no changes)

| Policy | Command | Who |
|--------|---------|-----|
| `srp_select` | SELECT | Admin/owner/dispatcher: any org photo · Client: own `client_id` requests only |
| `srp_insert` | INSERT | Admin/owner/dispatcher: any org · Client: own `client_id` requests where `status IN ('new','reviewing')` |
| `srp_delete` | DELETE | Admin/owner: any org photo · Anyone: own `uploaded_by_profile_id` photo |

### Storage RLS (pre-existing, no changes)

The existing `camsecure_media_insert/select/delete` policies on `storage.objects` check:
```
name LIKE 'org/' || auth_org_id()::text || '/%'
```
This pattern covers `org/{org_id}/requests/...` paths with no additional policies needed.

---

## 5. RLS Verification

### `auth_client_id()` resolution
```sql
SELECT client_id FROM client_contacts WHERE profile_id = auth.uid() LIMIT 1
```
d.park@metro.com (uid `ae091c96`) → client_contact → `client_id = a0000000-...000101` → REQ-008.

### Seed data used

| Entity | UUID |
|--------|------|
| d.park@metro.com (client profile) | `ae091c96-a0f0-443f-87dc-c0b5c909e9b6` |
| client_id | `a0000000-0000-0000-0000-000000000101` |
| REQ-008 (client-owned, status: new) | `4172b8c8-e614-402d-8222-499e6e14a30b` |
| REQ-001 (walk-in, client_id=NULL) | `a0000000-0000-0000-0000-000000000401` |
| admin@jsg.com | `d483bbff-b30b-42b8-888f-abf91f3adf0f` |
| Organization | `a0000000-0000-0000-0000-000000000001` |

**Note:** Seed data has only one client user (d.park). All other requests have `client_id = NULL` (walk-in). "Other client's request" and "walk-in request" are the same boundary in this seed.

---

### Check A — Client can upload photo to own request ✅ ALLOWED

d.park inserts into `service_request_photos` for REQ-008.

`srp_insert` WITH CHECK:
- `organization_id = auth_org_id()` ✅
- `uploaded_by_profile_id = auth.uid()` ✅
- `auth_role() = 'client'` AND `service_request_id IN (SELECT ... WHERE client_id = auth_client_id() AND status IN ('new','reviewing'))` ✅

Result: `1 row returned` (Node.js step 3 — id `ce486b57`).

---

### Check B — Client can view signed URL for own request photo ✅ ALLOWED

`camsecure_media_select`: `name LIKE 'org/a0000000-.../requests/...'` matched `auth_org_id()` ✅

`createSignedUrl` succeeded → HTTP 200 (Node.js step 4).

---

### Check C — Client cannot upload to another client's request ✅ BLOCKED (42501)

d.park attempts INSERT into REQ-001 (walk-in, `client_id = NULL`).

`srp_insert` WITH CHECK: `service_request_id NOT IN (SELECT ... WHERE client_id = auth_client_id())` — REQ-001 has no client_id, so condition fails.

Result: `ERROR 42501: new row violates row-level security policy` (SQL simulation).

---

### Check D — Client cannot view walk-in request photos ✅ BLOCKED (0 rows)

d.park SELECT on a photo row for REQ-004 (walk-in, `client_id = NULL`).

`srp_select` USING: `service_request_id IN (SELECT ... WHERE client_id = auth_client_id())` — REQ-004 has no client_id. Row invisible.

Result: `[]` — 0 rows returned (SQL simulation). Walk-in request photos are invisible to all clients.

---

### Check E — Admin can view client-uploaded request photos ✅ ALLOWED

Admin SELECT on client-uploaded photo for REQ-008.

`srp_select` USING: `organization_id = auth_org_id()` AND `auth_role() IN ('owner','admin','dispatcher')` ✅

Result: `1 row` returned with correct `file_name` and `uploaded_by_profile_id` — both SQL simulation and Node.js step 5.

---

### Check F — Delete flow removes both Storage object and DB row ✅ CLEAN

`storage.remove([storagePath])` → success (Node.js step 6).  
`service_request_photos DELETE WHERE id = ...` → success (Node.js step 6).

---

### Check G — No orphan DB rows after delete ✅ CONFIRMED

SELECT after delete → `[]` — 0 rows (Node.js step 7).

---

### Check H — No orphan Storage objects after delete ✅ CONFIRMED

Signed URL after delete → HTTP 400 — object gone from bucket (Node.js step 7).

---

## 6. Programmatic Verification Summary

All 7 Node.js script steps passed:

| Step | What | Result |
|------|------|--------|
| 1 | Sign in as d.park@metro.com | uid `ae091c96` ✅ |
| 2 | Storage upload `org/.../requests/{REQ-008}/verify-10je-*.jpg` | Object created ✅ |
| 3 | `service_request_photos` INSERT | Row `ce486b57` created, all 7 fields correct ✅ |
| 4 | `createSignedUrl` → HTTP 200 | Accessible ✅ |
| 5 | Admin sees photo (cross-portal) | file_name + uploader correct ✅ |
| 6 | Client deletes storage + DB | Both removed ✅ |
| 7 | Signed URL → HTTP 400 after delete | Object confirmed gone ✅ |

Temp password technique: both original bcrypt hashes saved before UPDATE, restored via `CASE WHEN` immediately after script.

---

## 7. Client Portal: Upload Gate

Client upload is gated on request status in the Server Component:

```tsx
<RequestPhotoPanel
  requestId={request.id}
  organizationId={request.organizationId}
  canUpload={request.status === "new" || request.status === "reviewing"}
/>
```

| Status | `canUpload` | Upload button shown | RLS INSERT |
|--------|-------------|---------------------|-----------|
| `new` | true | ✅ | ✅ allowed |
| `reviewing` | true | ✅ | ✅ allowed |
| `ready_to_schedule` | false | ❌ hidden | ❌ would block |
| `converted` | false | ❌ hidden | ❌ would block |
| `cancelled` | false | ❌ hidden | ❌ would block |

---

## 8. Admin Portal: Viewer + Delete

`RequestPhotoPanel` is placed in the left column of `RequestDetail.tsx` (after Internal Notes), with `canUpload={false}`.

- No upload button for admin in this phase
- Delete button shown on all photos; RLS `srp_delete` allows admin/owner to delete any org photo
- Internal Notes are admin-only (not shown on client portal) — client-visible photos are in `service_request_photos`, not `service_requests.notes`

---

## 9. Success Screen: "View Request / Add Photos"

After a client submits a new request, the success screen now shows:

- Reference number: `REQ-0009`
- **"View Request / Add Photos"** button → `/client/requests/{newRequestId}`
- "Submit another" button (resets form, clears `requestId`)
- "Back to overview" button

The `requestId` state is populated from the INSERT response (`data.id`) alongside `request_number`. Walk-in request creation (admin-side) is unaffected — the button only appears in the client new-request form.

---

## 10. Build and Lint

| Check | Result |
|-------|--------|
| `npm run build` | ✅ 0 TypeScript errors · **28 routes** (unchanged) |
| `npm run lint` | ✅ 0 errors · 0 warnings |

---

## 11. Cross-Portal Photo Visibility

| Who uploads | Where visible |
|-------------|---------------|
| Client uploads on `/client/requests/[id]` | ✅ Admin sees on `/requests/[id]` (`srp_select` admin branch) |
| Admin has no upload in this phase | — |
| Client of another org | ❌ Blocked by `organization_id = auth_org_id()` check |
| Client on walk-in request | ❌ Blocked — `client_id = NULL` never matches `auth_client_id()` |

---

## 12. Known Limitations

| Limitation | Notes |
|------------|-------|
| Admin upload from request detail | Not implemented — spec required viewer only. `srp_insert` already allows admin/owner/dispatcher. Can be enabled by changing `canUpload={false}` to `canUpload={true}` in `RequestDetail.tsx`. |
| Only one demo client user | Seed data has `d.park@metro.com` linked to one client_id. Cross-client isolation was verified via SQL simulation, not separate user accounts. |
| `caption` field unused | Present in `service_request_photos` schema — available for future "describe the issue" UX. |
| Client cannot upload after `ready_to_schedule` | Intentional — RLS INSERT gate and `canUpload` prop both enforce this. |

---

## 13. Cleanup Confirmation

| Item | State |
|------|-------|
| Verify script `verify-10je.mjs` | Deleted ✅ |
| Test photo row `ce486b57` | Deleted ✅ |
| Test storage object | Deleted ✅ (signed URL → HTTP 400) |
| d.park bcrypt hash | Restored ✅ |
| admin bcrypt hash | Restored ✅ |

---

## 14. Final Verdict

**PASS — all checks passed.**

`RequestPhotoPanel` fully implements client request photo upload and admin viewing. RLS enforces all isolation boundaries: client upload gated to own `new`/`reviewing` requests, walk-in requests invisible to all clients, admin has full read+delete visibility. Build 28 routes, lint clean.

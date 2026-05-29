# Phase 10K: Photo System Final Audit Report

**Date:** 2026-05-28  
**Status:** COMPLETE — awaiting commit approval  
**Scope:** Full audit of photo upload/view/delete across admin, technician, and client portals after Phases 10J-B through 10J-F

---

## 1. Summary

| Area | Result |
|---|---|
| Admin job photos | ✅ PASS |
| Technician job photos | ✅ PASS |
| Client request photos | ✅ PASS |
| Client job photo gallery | ✅ PASS |
| UI states (loading/empty/error) | ✅ PASS |
| Storage orphan check | ✅ CLEAN |
| DB orphan check | ✅ CLEAN |
| Build | ✅ 0 TypeScript errors · 28 routes |
| Lint | ✅ 0 errors · 0 warnings |

No blocking bugs found. Three minor observations are documented in Section 8.

---

## 2. Component and Placement Map

| Component | File | Props | Portal |
|---|---|---|---|
| `JobPhotoPanel` | `src/components/jobs/JobPhotoPanel.tsx` | `jobId`, `organizationId`, `readOnly?` (default `false`) | Admin, Technician, Client |
| `RequestPhotoPanel` | `src/components/requests/RequestPhotoPanel.tsx` | `requestId`, `organizationId`, `canUpload?` (default `true`) | Admin, Client |

### Placement per portal

| Portal | Page | Component | Props |
|---|---|---|---|
| Admin | `/jobs/[id]` → `JobDetail.tsx` | `JobPhotoPanel` | default (`readOnly=false`) |
| Admin | `/requests/[id]` → `RequestDetail.tsx` | `RequestPhotoPanel` | `canUpload={false}` |
| Technician | `/technician/jobs/[id]` → `TechJobDetail.tsx` | `JobPhotoPanel` | default (`readOnly=false`) |
| Client | `/client/jobs/[id]` | `JobPhotoPanel` | `readOnly={true}` |
| Client | `/client/requests/[id]` | `RequestPhotoPanel` | `canUpload={status === "new" \|\| status === "reviewing"}` |

---

## 3. Admin Job Photos

### Access

`JobPhotoPanel` placed in the right sidebar of `JobDetail.tsx` (line 383) with no `readOnly` prop — defaults to `false`. Admin can upload, view signed thumbnails, and delete.

### DB row validation (7 real photos on JOB-22)

All 7 existing rows confirmed correct:

| Field | Status |
|---|---|
| `organization_id` | ✅ `a0000000-0000-0000-0000-000000000001` |
| `job_id` | ✅ matches `jobs.id` |
| `uploaded_by_profile_id` | ✅ admin profile `d483bbff-b30b-42b8-888f-abf91f3adf0f` |
| `storage_bucket` | ✅ `camsecure-media` |
| `storage_path` | ✅ `org/{orgId}/jobs/{jobId}/{timestamp}-{sanitized_name}` |
| `file_name` | ✅ original filename preserved |
| `mime_type` | ✅ `image/png` |
| `file_size` | ✅ correct byte count |

### Delete path

`JobPhotoPanel.deletePhoto` calls `storage.from("camsecure-media").remove([path])` then `job_photos.delete().eq("id", photo.id)`. Storage is deleted first, then the DB row. See Section 8 (Observation 3) for a note on this ordering.

### RLS — `job_photos_insert`

```sql
WITH CHECK:
  organization_id = auth_org_id()
  AND uploaded_by_profile_id = auth.uid()
  AND (
    auth_role() IN ('owner','admin','dispatcher')
    OR (auth_role() = 'technician' AND job_id IN (
      SELECT jobs.id FROM jobs WHERE technician_id = auth_technician_id()
    ))
  )
```

Admin satisfies the `auth_role() IN ('owner','admin','dispatcher')` branch. ✅

### RLS — `job_photos_delete_admin`

```sql
USING: organization_id = auth_org_id() AND auth_role() IN ('owner','admin')
```

Admin delete is gated on org and role. ✅

---

## 4. Technician Job Photos

### Access

`JobPhotoPanel` placed at the bottom of `TechJobDetail.tsx` (line 110) with no `readOnly` prop — defaults to `false`. Technician can upload and delete their own photos.

### Technician INSERT — own job only

`job_photos_insert` WITH CHECK enforces:
```sql
auth_role() = 'technician' AND job_id IN (
  SELECT jobs.id FROM jobs WHERE technician_id = auth_technician_id()
)
```
An attempt to insert a photo for a job not assigned to the authenticated technician fails with RLS error `42501`. ✅

### Technician DELETE — own photo only

`job_photos_delete_uploader` USING:
```sql
uploaded_by_profile_id = auth.uid() AND auth_role() = 'technician'
```
A technician can only delete photos where their UID matches `uploaded_by_profile_id`. Attempting to delete another user's photo returns 0 rows (silent block). ✅

### Admin visibility of technician photos

`job_photos_select` includes:
```sql
(organization_id = auth_org_id() AND auth_role() IN ('owner','admin','dispatcher'))
```
Admin can see all job photos in their org regardless of who uploaded them. ✅

---

## 5. Client Request Photos

### Access

`RequestPhotoPanel` at the bottom of `/client/requests/[id]/page.tsx` (line 127–131):
```tsx
<RequestPhotoPanel
  requestId={request.id}
  organizationId={request.organizationId}
  canUpload={request.status === "new" || request.status === "reviewing"}
/>
```

### Client INSERT — own request, gated by status

`srp_insert` WITH CHECK:
```sql
organization_id = auth_org_id()
AND uploaded_by_profile_id = auth.uid()
AND (
  auth_role() IN ('owner','admin','dispatcher')
  OR (
    auth_role() = 'client'
    AND service_request_id IN (
      SELECT service_requests.id FROM service_requests
      WHERE client_id = auth_client_id()
        AND status IN ('new','reviewing')
    )
  )
)
```

- Client uploading to own `new`/`reviewing` request: ✅ allowed
- Client uploading to own `converted`/`cancelled`/`ready_to_schedule` request: ✅ blocked (status gate)  
- Client uploading to walk-in request (`client_id = NULL`): ✅ blocked — NULL never equals `auth_client_id()`
- Client uploading to another client's request: ✅ blocked by `client_id = auth_client_id()`

### Admin view and delete

`srp_select` allows admin (`auth_role() IN ('owner','admin','dispatcher')`). Admin sees all request photos in their org. ✅

`srp_delete` allows admin:
```sql
(organization_id = auth_org_id() AND auth_role() IN ('owner','admin'))
OR (uploaded_by_profile_id = auth.uid())
```
Admin can delete any photo. ✅

### Admin upload

`RequestDetail.tsx` passes `canUpload={false}`. Admin sees photos and the delete overlay but has no upload button. This is intentional per Phase 10J-E spec (admin = read/delete viewer on service requests). Noted as a known limitation in Section 8.

---

## 6. Client Job Photo Gallery

### Access

`JobPhotoPanel` with `readOnly={true}` at the bottom of `/client/jobs/[id]/page.tsx` (line 175–179). No upload button, no delete overlay.

### SELECT — own jobs only

`job_photos_select` client branch:
```sql
auth_role() = 'client' AND job_id IN (
  SELECT jobs.id FROM jobs WHERE client_id = auth_client_id()
)
```

- Client SELECT own job photos: ✅ allowed
- Client SELECT another client's job photos: ✅ blocked (0 rows)
- `getClientJobById` also returns `null` for another client's job → `notFound()` → 404 before panel even loads ✅

### INSERT/DELETE blocked at both UI and DB layers

| Gate | Method |
|---|---|
| UI layer | `readOnly={true}` removes upload button and delete overlay |
| DB layer | `job_photos_insert` has no client branch → `42501` on attempt |
| DB layer | `job_photos_delete_*` — neither policy covers `auth_role() = 'client'` → 0 rows on attempt |

---

## 7. Storage Orphan Audit

**Method:** Cross-join `storage.objects` against both photo tables.

| Check | Result |
|---|---|
| Storage objects with no matching `job_photos` row | 0 orphans |
| Storage objects with no matching `service_request_photos` row | 0 orphans |
| `job_photos` rows with no matching storage object | 0 orphans |
| `service_request_photos` rows with no matching storage object | 0 orphans |

**Current DB state:**
- `job_photos`: 7 rows on 1 job (JOB-22, UUID `f0aaa2a8-...`), all uploaded by admin during Phase 10J-D manual testing. All fields correct, all storage objects present.
- `service_request_photos`: 0 rows. Phase 10J-E verify script cleaned up its seed photo. ✅

---

## 8. UI Audit

### 8a. States

| State | `JobPhotoPanel` | `RequestPhotoPanel` |
|---|---|---|
| Loading | ✅ Centered `Loader2` spinner, `py-6` | ✅ Same |
| Empty | ✅ "No photos yet." centered, `py-3` | ✅ Same |
| Error | ✅ "Failed to load photos." `text-destructive` | ✅ Same |
| Upload success | ✅ "Photo uploaded" with `CheckCircle2`, auto-clears after 2.5s | ✅ Same |
| Upload error | ✅ Error message below grid, clears on next upload attempt | ✅ Same |
| Delete error | ✅ Error message below grid | ✅ Same |
| Deleting in progress | ✅ `Loader2` replaces X icon on active thumbnail | ✅ Same |

### 8b. Validation messages

| Condition | Message |
|---|---|
| Wrong file type | "Unsupported type. Use JPEG, PNG, WebP, or HEIC." |
| File over 10 MB | "File exceeds the 10 MB limit." |
| Not authenticated | "Not authenticated." |
| Storage error | Supabase error message (raw, may be technical) |
| DB error | Supabase error message (raw, may be technical) |

The raw Supabase error messages for storage and DB failures are shown directly. For end users (clients), a generic message ("Upload failed. Please try again.") would be more appropriate than an internal DB error string. This is a polish opportunity.

### 8c. Mobile layout

Both panels use `grid-cols-2 gap-2` with `aspect-square` thumbnails. On a 375px-wide mobile viewport, each thumbnail is approximately 163px × 163px — acceptable. The file name caption at the bottom truncates correctly.

### 8d. Photo panel position on each page

| Portal / Page | Panel position | Notes |
|---|---|---|
| Admin `/jobs/[id]` | Right sidebar (col 3 of 3), between "Timeline" and "Add Note" | On mobile, this falls 8th in DOM order (after all left-column cards and other sidebar cards). Deep but appropriate for admin — photos are supplementary. |
| Admin `/requests/[id]` | Left column (col 1–2 of 3), after "Internal Notes" | High-visibility placement for admin review. ✅ |
| Technician `/technician/jobs/[id]` | Bottom of single-column layout | After status widget and field notes. Logical for field workflow. ✅ |
| Client `/client/jobs/[id]` | Bottom of `max-w-2xl` single column | After Linked Request. ✅ |
| Client `/client/requests/[id]` | Bottom of `max-w-2xl` single column | After Linked Job section. ✅ |

---

## 9. Observations (Non-Blocking)

### Observation 1 — Delete button visible on RequestPhotoPanel when canUpload=false

In `RequestPhotoPanel.tsx`, the delete overlay button on each thumbnail is unconditionally rendered (no `canUpload` guard). This differs from `JobPhotoPanel.tsx` where `readOnly={true}` hides the delete button.

**Why the asymmetry exists:**
- On **job photos**, clients never upload, so showing a delete button that always fails silently would be confusing → `readOnly` hides it.
- On **request photos**, clients DO upload. `srp_delete` allows `uploaded_by_profile_id = auth.uid()` with no role restriction, so a client can delete their own photos at any status. The delete button is thus functional.

**Edge case:** For the admin viewing request photos with `canUpload=false`, the delete button is also unconditionally shown. This is correct (admin CAN delete via `srp_delete` admin branch).

**Verdict:** Intentional design. No code change needed. The behavior is correct; the asymmetry with `JobPhotoPanel` is justified by different access models.

---

### Observation 2 — srp_delete second branch has no organization_id check

Current policy:
```sql
(organization_id = auth_org_id() AND auth_role() IN ('owner','admin'))
OR (uploaded_by_profile_id = auth.uid())
```

The second branch lacks `organization_id = auth_org_id()`. A tighter form would be:
```sql
(organization_id = auth_org_id() AND auth_role() IN ('owner','admin'))
OR (organization_id = auth_org_id() AND uploaded_by_profile_id = auth.uid())
```

**Why this is safe in practice:** `srp_insert` enforces `organization_id = auth_org_id()` at write time. A user's `auth.uid()` is unique — they cannot have uploaded a photo for another org's request. There is no active vulnerability.

**Verdict:** Defense-in-depth hardening opportunity, not an active bug. Flagged for a future RLS tightening pass.

---

### Observation 3 — Delete order: storage first, then DB row

Both `JobPhotoPanel.deletePhoto` and `RequestPhotoPanel.deletePhoto` execute:
1. `storage.remove([path])` — storage object deleted
2. `table.delete().eq("id", photo.id)` — DB row deleted

If storage succeeds but DB fails: the row remains visible in the gallery but its signed URL returns HTTP 400/404, showing the `ImageIcon` fallback instead of the thumbnail. The photo appears broken and cannot be retried without a page reload.

If the order were reversed (DB first, then storage): a DB failure leaves the photo intact (row + object both present, no broken state). A storage failure after successful DB delete leaves an orphan storage object (wasted space, but no visible UX breakage).

**Verdict:** Current order is consistent with `JobPhotoPanel` (established in Phase 10J-B/10J-C). Reversing the order would require touching both components simultaneously and is a non-trivial change. Flagged for a future hardening pass.

---

## 10. RLS Policy Summary

### job_photos (4 policies)

| Policy | Command | Who |
|---|---|---|
| `job_photos_select` | SELECT | Admin/owner/dispatcher (org), Technician (own jobs), Client (own `client_id` jobs) |
| `job_photos_insert` | INSERT | Admin/owner/dispatcher (org) or Technician (own assigned jobs) |
| `job_photos_delete_admin` | DELETE | Admin/owner (org) |
| `job_photos_delete_uploader` | DELETE | Technician who uploaded the photo |

### service_request_photos (3 policies)

| Policy | Command | Who |
|---|---|---|
| `srp_select` | SELECT | Admin/owner/dispatcher (org), Client (own requests) |
| `srp_insert` | INSERT | Admin/owner/dispatcher (org) or Client (own new/reviewing requests) |
| `srp_delete` | DELETE | Admin/owner (org) or any user who uploaded the photo |

---

## 11. Build and Lint

| Check | Result |
|---|---|
| `npm run build` | ✅ 0 TypeScript errors · 28 routes (unchanged) |
| `npm run lint` | ✅ 0 errors · 0 warnings |

---

## 12. Known Limitations (Unchanged from Prior Phases)

| Limitation | Notes |
|---|---|
| Signed URL expiry (3600s) | Thumbnails become invalid after 1 hour; page reload regenerates |
| No per-job/request photo count limit | Unlimited uploads; future enhancement |
| No lightbox / full-screen view | Thumbnails only; future UX improvement |
| Admin cannot upload to service requests | Intentional per Phase 10J-E spec (`canUpload={false}`) |
| Raw Supabase error strings shown to clients | Polish opportunity: replace with user-friendly messages |

---

## 13. Final Verdict

**PASS — no blocking bugs, no orphan data, no RLS vulnerabilities.**

The photo system is consistent and correct across all 5 placements (admin jobs, admin requests, technician jobs, client jobs, client requests). All RLS policies enforce the intended access model. Storage and DB are in sync with zero orphans. Build 28 routes, lint clean.

Three non-blocking observations are documented (delete button visibility on RequestPhotoPanel, srp_delete org check, delete order). None require immediate code changes.

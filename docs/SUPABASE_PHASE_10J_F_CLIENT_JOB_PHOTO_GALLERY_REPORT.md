# Phase 10J-F: Client Job Photo Gallery — Implementation Report

**Date:** 2026-05-28  
**Status:** COMPLETE — awaiting commit approval  
**Base commit:** 9aa9df5

---

## 1. Scope

Read-only job photo gallery for clients on `/client/jobs/[id]`. Clients can view signed-URL thumbnails for photos on their own jobs. No upload, no delete. No DB schema, RLS, or Storage changes required.

---

## 2. Files Changed

| File | Action | Description |
|------|--------|-------------|
| `src/components/jobs/JobPhotoPanel.tsx` | **MODIFIED** | Added `readOnly?: boolean` prop — hides delete overlay and upload section |
| `src/lib/data/client-portal.ts` | **MODIFIED** | Added `organizationId` to `ClientJobDetail` type, `JobDetailRawRow`, select query, and return mapping |
| `src/app/(client)/client/jobs/[id]/page.tsx` | **MODIFIED** | Import + render `<JobPhotoPanel readOnly={true} />` after Linked Request section |

---

## 3. Schema and RLS Audit

### No changes required

`job_photos_select` already includes a client branch (present since Phase 10J-B):

```sql
OR ((auth_role() = 'client'::user_role)
    AND (job_id IN (
      SELECT jobs.id FROM jobs
      WHERE jobs.client_id = auth_client_id()
    )))
```

| Policy | Client coverage |
|--------|-----------------|
| `job_photos_select` | ✅ Client can SELECT photos for own `client_id` jobs |
| `job_photos_insert` | ❌ No client branch — client CANNOT insert |
| `job_photos_delete_admin` | ❌ Admin/owner only |
| `job_photos_delete_uploader` | ❌ Technician only |

Storage RLS (`camsecure_media_select`): `name LIKE 'org/{auth_org_id()}/%'` — clients with a valid org_id can generate signed URLs for any object under their org prefix. ✅

---

## 4. Component Change: `JobPhotoPanel.tsx`

Added `readOnly?: boolean` (default `false`):

```diff
 export function JobPhotoPanel({
   jobId,
   organizationId,
+  readOnly = false,
 }: {
   jobId:          string;
   organizationId: string;
+  readOnly?:      boolean;
 }) {
```

When `readOnly=true`:
- Delete button overlay on thumbnails is not rendered
- File input and Upload button are not rendered
- Loading, empty state, error state, and thumbnail grid all render normally

The existing admin and technician callers pass no `readOnly` prop — they default to `false` and are completely unaffected.

---

## 5. Data Layer Change: `ClientJobDetail`

Added `organizationId: string` to the type, raw row type, select query, and return mapping. Required so the page Server Component can pass it to `JobPhotoPanel`.

```diff
 export type ClientJobDetail = {
   id:             string;
+  organizationId: string;
   jobNumber:      number | null;
   ...
```

Select query:
```diff
-"id, job_number, service_type, ..."
+"id, organization_id, job_number, service_type, ..."
```

---

## 6. Page Change: Client Job Detail

`JobPhotoPanel` placed after the Linked Request section (last item on the page):

```tsx
<JobPhotoPanel
  jobId={job.id}
  organizationId={job.organizationId}
  readOnly={true}
/>
```

Server Component passes props; the client boundary is at `JobPhotoPanel`'s own `"use client"` directive — correct Next.js 16 pattern, same as `TechJobDetail.tsx`.

**No internal fields exposed.** `ClientJobDetail` does not include:
- `notes` (internal admin/dispatcher notes)
- `dispatcher_notes`
- `technician_id` or technician info
- Any field not already shown on the page

---

## 7. RLS Simulations

All simulations use `BEGIN/ROLLBACK` with `SET LOCAL role = 'authenticated'` and JWT claims. Test rows are inserted before the role switch (bypassing RLS at the postgres role) and rolled back at the end — no persistent test data.

**Seed data used:**

| Entity | UUID |
|--------|------|
| d.park@metro.com (client profile) | `ae091c96-a0f0-443f-87dc-c0b5c909e9b6` |
| d.park's client_id | `a0000000-0000-0000-0000-000000000101` |
| JOB-001 (d.park's job) | `a0000000-0000-0000-0000-000000000501` |
| JOB-002 (different client `...102`) | `a0000000-0000-0000-0000-000000000502` |
| Admin | `d483bbff-b30b-42b8-888f-abf91f3adf0f` |
| Alex Rivera (technician, assigned JOB-001) | `5a8b959c-f347-4a31-8247-801356c6e5b0` |

---

### Sim 1 — Client SELECT own job photo ✅ ALLOWED

d.park queries `job_photos` for JOB-001 (`client_id = ...000101` = auth_client_id()).

`job_photos_select` USING: `auth_role() = 'client'` AND `job_id IN (SELECT jobs.id WHERE client_id = auth_client_id())` — matches JOB-001.

Result: `1 row` — `id=ffff0001`, `job_id=...000501`, `file_name=sim1.jpg`.

---

### Sim 2 — Client SELECT another client's job photo ✅ BLOCKED (0 rows)

d.park queries `job_photos` for JOB-002 (`client_id = ...000102` ≠ auth_client_id()).

`job_photos_select` USING: `job_id NOT IN (SELECT jobs.id WHERE client_id = auth_client_id())` — JOB-002 not in d.park's jobs.

Result: `[]` — 0 rows. Photo invisible.

---

### Sim 3 — Client INSERT job photo ✅ BLOCKED (42501)

d.park attempts to INSERT into `job_photos`.

`job_photos_insert` WITH CHECK: `auth_role() IN ('owner','admin','dispatcher')` OR `auth_role() = 'technician'` — neither matches `'client'`.

Result: `ERROR 42501: new row violates row-level security policy`.

---

### Sim 4 — Client DELETE job photo ✅ BLOCKED (0 rows deleted)

d.park attempts to DELETE a `job_photos` row uploaded by admin.

`job_photos_delete_admin` USING: `auth_role() IN ('owner','admin')` — does not match `'client'`.  
`job_photos_delete_uploader` USING: `auth_role() = 'technician'` — does not match `'client'`.

Result: `DELETE 0` — row persists. Client cannot delete any job photo.

---

### Sim 5 — Admin SELECT (regression) ✅ ALLOWED

Admin queries `job_photos` for JOB-001.

`job_photos_select` USING: `organization_id = auth_org_id()` AND `auth_role() IN ('owner','admin','dispatcher')` — matches.

Result: `1 row` — admin visibility unchanged. ✅

---

### Sim 6 — Technician SELECT assigned job (regression) ✅ ALLOWED

Alex Rivera queries `job_photos` for JOB-001 (his assigned job, `technician_id = auth_technician_id()`).

`job_photos_select` USING: `auth_role() = 'technician'` AND `job_id IN (SELECT jobs.id WHERE technician_id = auth_technician_id())` — matches JOB-001.

Result: `1 row` — technician visibility unchanged. ✅

---

## 8. What Clients See vs. What They Don't

| Data | Client sees? | Notes |
|------|-------------|-------|
| Job photo thumbnails (signed URLs) | ✅ Yes | For own `client_id` jobs only |
| Photo file names | ✅ Yes | Shown as thumbnail caption |
| Upload button | ❌ No | `readOnly=true` hides it |
| Delete button | ❌ No | `readOnly=true` hides it |
| Internal notes (`jobs.notes`) | ❌ No | Not in `ClientJobDetail` |
| Dispatcher notes | ❌ No | Not in `ClientJobDetail` |
| Technician info | ❌ No | Not in `ClientJobDetail` |
| Other clients' photos | ❌ No | RLS blocks at DB level |

---

## 9. Build and Lint

| Check | Result |
|-------|--------|
| `npm run build` | ✅ 0 TypeScript errors · **28 routes** (unchanged) |
| `npm run lint` | ✅ 0 errors · 0 warnings |

No new routes added. `/client/jobs/[id]` already existed.

---

## 10. Known Limitations

| Limitation | Notes |
|------------|-------|
| Signed URL expiry (3600s) | Same as `JobPhotoPanel` — page reload refreshes URLs |
| No lightbox / full-screen view | Thumbnails only; enlargement is a future UX improvement |
| Empty state shown for jobs with no photos | Correct — "No photos yet." message |

---

## 11. Final Verdict

**PASS — all checks passed.**

Client job photo gallery is live at `/client/jobs/[id]` with zero RLS changes, zero schema changes, and zero storage changes. The `readOnly` prop on `JobPhotoPanel` cleanly handles the no-upload/no-delete requirement. All 6 RLS simulations confirm correct isolation. Build 28 routes, lint clean.

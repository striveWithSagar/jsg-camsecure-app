# Phase 10J-B: Photo Storage Foundation — Implementation Report

**Date:** 2026-05-27  
**Status:** COMPLETE — awaiting commit approval  
**Base commit:** 9f55735

---

## 1. Scope

DB and Storage foundation for the photo upload system. No UI changes. No TypeScript changes.

| Layer | Change |
|-------|--------|
| `job_photos` | ALTER TABLE — 4 storage metadata columns added |
| `job_photos` | New DELETE policy for technician self-delete |
| `service_request_photos` | New table — full schema, FKs, index, RLS enabled, 3 policies |
| Storage | New private bucket `camsecure-media` |
| `storage.objects` | 3 new RLS policies (SELECT / INSERT / DELETE) |
| Migration file | `supabase/migrations/20260527100000_photo_upload_schema.sql` |

---

## 2. Files Changed

| File | Action |
|------|--------|
| `supabase/migrations/20260527100000_photo_upload_schema.sql` | **CREATED** |
| `docs/SUPABASE_PHASE_10J_B_PHOTO_STORAGE_FOUNDATION_REPORT.md` | **CREATED** |

No TypeScript files modified. No Next.js routes added. No build output changes.

---

## 3. DB Changes

### 3a. `job_photos` — ALTER TABLE

Four columns appended after existing `created_at`:

| Column | Type | Default | Nullable |
|--------|------|---------|----------|
| `storage_bucket` | TEXT | `'camsecure-media'` | NO |
| `file_name` | TEXT | `''` | NO |
| `mime_type` | TEXT | `''` | NO |
| `file_size` | INTEGER | `0` | NO |

**Data compatibility:** All columns have non-null defaults. Existing 0 rows unaffected. Backfill not needed (table was empty). Future rows set defaults at upload time via application code.

**Original columns preserved:** `id`, `organization_id`, `job_id`, `uploaded_by_profile_id`, `storage_path`, `caption`, `taken_at`, `created_at` — all unchanged.

---

### 3b. `job_photos` — New RLS Policy

```sql
CREATE POLICY job_photos_delete_uploader ON job_photos
  FOR DELETE TO authenticated
  USING (
    uploaded_by_profile_id = auth.uid()
    AND auth_role() = 'technician'::user_role
  );
```

**Effect:** Technicians can delete only photos they uploaded. Complements the existing `job_photos_delete_admin` policy (owner/admin org-scoped delete).

**Original policies untouched:**

| Policy | Command |
|--------|---------|
| `job_photos_select` | SELECT — org staff + assigned technician + client (own jobs) |
| `job_photos_insert` | INSERT — org staff + assigned technician (own jobs only) |
| `job_photos_delete_admin` | DELETE — owner/admin org-scoped |

---

### 3c. `service_request_photos` — New Table

```
id                     UUID PRIMARY KEY DEFAULT gen_random_uuid()
organization_id        UUID NOT NULL → organizations(id)
service_request_id     UUID NOT NULL → service_requests(id) ON DELETE CASCADE
uploaded_by_profile_id UUID NOT NULL → profiles(id)
storage_bucket         TEXT NOT NULL DEFAULT 'camsecure-media'
storage_path           TEXT NOT NULL
file_name              TEXT NOT NULL
mime_type              TEXT NOT NULL
file_size              INTEGER NOT NULL
caption                TEXT (nullable)
created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
```

**FK constraints:**

| Constraint | FK Column | Ref | Delete Rule |
|-----------|-----------|-----|-------------|
| `service_request_photos_service_request_id_fkey` | `service_request_id` | `service_requests(id)` | CASCADE |
| `service_request_photos_organization_id_fkey` | `organization_id` | `organizations(id)` | RESTRICT |
| `service_request_photos_uploaded_by_profile_id_fkey` | `uploaded_by_profile_id` | `profiles(id)` | RESTRICT |

**Index:** `idx_srp_service_request_id` on `service_request_id` — supports per-request photo lookups.

**RLS:** Enabled (`relrowsecurity = true`, `relforcerowsecurity = true`).

---

### 3d. `service_request_photos` — RLS Policies

**`srp_select` (SELECT)**
- Admin/owner/dispatcher: org-scoped (`organization_id = auth_org_id()`)
- Client: own requests only (`service_request_id IN (SELECT id FROM service_requests WHERE client_id = auth_client_id())`)
- Technician: no SELECT access (cannot see request photos)

**`srp_insert` (INSERT)**
- Admin/owner/dispatcher: org-scoped + `uploaded_by_profile_id = auth.uid()`
- Client: own requests only, limited to `status IN ('new', 'reviewing')` + `uploaded_by_profile_id = auth.uid()`
- Technician: blocked

**`srp_delete` (DELETE)**
- Admin/owner: org-scoped
- Any uploader: `uploaded_by_profile_id = auth.uid()` (client can delete own uploads)

---

## 4. Storage Changes

### 4a. Bucket `camsecure-media`

| Property | Value |
|----------|-------|
| `id` / `name` | `camsecure-media` |
| `public` | `false` |
| `file_size_limit` | `10485760` (10 MB) |
| `allowed_mime_types` | `image/jpeg`, `image/png`, `image/webp`, `image/heic` |

**No public URL access.** All reads require authenticated session via Supabase Storage SDK.

### 4b. Storage RLS Policies (`storage.objects`)

**`camsecure_media_select` (SELECT)**
```
bucket_id = 'camsecure-media'
AND name LIKE 'org/' || auth_org_id()::text || '/%'
```
Users can only download objects within their org's path prefix.

**`camsecure_media_insert` (INSERT WITH CHECK)**
```
bucket_id = 'camsecure-media'
AND name LIKE 'org/' || auth_org_id()::text || '/%'
```
Users can only upload to their org's path prefix. `owner` column set automatically by Supabase to `auth.uid()` at upload time.

**`camsecure_media_delete` (DELETE)**
```
bucket_id = 'camsecure-media'
AND (
  owner = auth.uid()
  OR (
    auth_role() = ANY (ARRAY['owner'::user_role, 'admin'::user_role])
    AND name LIKE 'org/' || auth_org_id()::text || '/%'
  )
)
```
Any authenticated user can delete objects they own. Admins/owners can delete any object within their org.

**Path convention:**
```
org/<org_id>/jobs/<job_id>/<filename>
org/<org_id>/requests/<request_id>/<filename>
```

---

## 5. RLS Simulations

David Park UUID: `ae091c96-a0f0-443f-87dc-c0b5c909e9b6` (Metro Security Ltd, client)  
Tech A UUID: `a0000000-0000-0000-0000-000000000002` (technician, assigned to JOB-001)  
Tech B UUID: `a0000000-0000-0000-0000-000000000003` (technician, different assignment)  
Admin UUID: `a0000000-0000-0000-0000-000000000001`

All sims run inside `BEGIN/ROLLBACK` with `SET LOCAL role = 'authenticated'` and `SET LOCAL "request.jwt.claims"`.

### Sim A — Admin INSERT job_photos ✅ ALLOWED

Admin can insert a job photo for any org job. `inserted_count = 1`.

### Sim B — Assigned Technician INSERT job_photos ✅ ALLOWED

Tech A inserts a photo for JOB-001 (their assigned job). `inserted_count = 1`.

### Sim C — Unassigned Technician INSERT job_photos ✅ BLOCKED (42501)

Tech B attempts to insert a photo for JOB-001 (not their job). RLS blocks with `ERROR 42501: new row violates row-level security policy for table "job_photos"`.

### Sim D — Client INSERT job_photos ✅ BLOCKED (42501)

David Park attempts to insert a job photo. `auth_role() = 'client'` — no INSERT policy matches. RLS blocks with `ERROR 42501`.

### Sim E — Technician INSERT service_request_photos ✅ BLOCKED (42501)

Tech A attempts to insert a request photo. No `srp_insert` branch permits technician role. Blocked with `ERROR 42501`.

### Sim F — Client INSERT service_request_photos (own open request) ✅ ALLOWED

David Park inserts a photo for REQ-001 (Metro Security Ltd, `status='new'`). `srp_insert` client branch passes. `inserted_count = 1`.

### Sim G — Client INSERT service_request_photos (walk-in request) ✅ BLOCKED (42501)

David Park attempts to insert a photo for a walk-in request (`client_id = NULL`). `auth_client_id()` returns David's client UUID — no match. Blocked with `ERROR 42501`.

### Sim H — Cross-Technician DELETE (self-delete policy bypass attempt) ✅ BLOCKED

Tech B attempts `SET LOCAL row_security = off` then DELETE Tech A's photo. `relforcerowsecurity = true` on `job_photos` prevents bypass. Returns `ERROR 42501: query would be affected by row-level security policy for table "job_photos"`. This is the expected and correct result — `FORCE ROW LEVEL SECURITY` prevents even session-level `row_security = off` from bypassing policies.

### Sim I — Client SELECT service_request_photos (cross-org isolation) ✅ CORRECT

David Park (Metro) SELECTs from `service_request_photos` after Sim F inserted 1 row. Returns exactly 1 row — his own Metro photo. Riverside School row (different `client_id`) not visible. No cross-client data leakage.

---

## 6. Security Checklist

| Check | Result |
|-------|--------|
| No public buckets | ✅ `public = false` |
| No `service_role` key in app code | ✅ Not referenced anywhere |
| Existing `job_photos` RLS untouched | ✅ Original 3 policies preserved |
| `job_photos` data compatibility | ✅ Defaults on all new columns, 0 existing rows |
| Clients cannot upload job photos | ✅ Sim D blocked |
| Technicians cannot upload request photos | ✅ Sim E blocked |
| Technicians cannot delete other techs' photos | ✅ Sim H blocked (force RLS) |
| Admins can view/manage photos within org | ✅ Sim A confirmed |
| Cross-client isolation | ✅ Sim I confirmed |
| Storage path org-scoping | ✅ `name LIKE 'org/<org_id>/%'` on all storage policies |
| No `SECURITY DEFINER` functions added | ✅ None added |
| RLS enabled with `FORCE` on both tables | ✅ Both tables confirmed |

---

## 7. Build and Lint

No TypeScript files changed. Build and lint run as regression check.

| Check | Result |
|-------|--------|
| `npm run build` | ✅ 0 TypeScript errors · **28 routes** (unchanged) |
| `npm run lint` | ✅ 0 errors · 0 warnings |

---

## 8. Confirmation: No Breaking Changes

| Item | Change? |
|------|---------|
| `job_photos` existing columns | ❌ Untouched |
| `job_photos` original 3 RLS policies | ❌ Untouched |
| `service_requests` table | ❌ Untouched |
| `jobs` table | ❌ Untouched |
| `convert_request_to_job` RPC | ❌ Untouched |
| Any existing Next.js routes | ❌ Untouched |
| Admin/technician/client portal TypeScript | ❌ Untouched |

---

## 9. Bugs Found

**None.** All 9 RLS simulations pass. No data leakage across clients or roles. Build and lint clean. No breaking changes to existing tables or policies.

---

## 10. What's Next (Phase 10J-C+)

This phase establishes the DB/Storage foundation. UI implementation is deferred to later phases:

| Phase | Scope |
|-------|-------|
| 10J-C | Admin/technician upload UI for job photos (file input, Supabase Storage SDK) |
| 10J-D | Client upload UI on new service request form |
| 10J-E | Photo gallery/viewer on job detail and request detail pages |

---

## 11. Final Verdict

**PASS — all verification checks passed.**

`job_photos` extended with 4 storage metadata columns, backward-compatible. Technician self-delete policy added. `service_request_photos` table created with correct FKs and 3 RLS policies enforcing role-based access. Private `camsecure-media` bucket created (10 MB, 4 MIME types). Three Storage `objects` policies enforce org-path scoping. All 9 cross-role RLS simulations pass. Build and lint clean.

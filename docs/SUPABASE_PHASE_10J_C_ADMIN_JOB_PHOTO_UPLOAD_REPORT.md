# Phase 10J-C: Admin Job Photo Upload UI — Implementation Report

**Date:** 2026-05-28  
**Status:** COMPLETE — awaiting commit approval  
**Base commit:** 35a6c42

---

## 1. Scope

Admin-facing photo upload and gallery on `/jobs/[id]`. No DB schema changes. No RLS changes. No new routes.

---

## 2. Files Changed

| File | Action | Description |
|------|--------|-------------|
| `src/components/jobs/JobPhotoPanel.tsx` | **CREATED** | Self-contained photo upload/gallery client component |
| `src/components/jobs/JobDetail.tsx` | **MODIFIED** | Replace disabled Photos placeholder with `<JobPhotoPanel>` |

---

## 3. DB / Storage Audit (Pre-Implementation)

### `job_photos` table — 12 columns confirmed

| Column | Type | Default |
|--------|------|---------|
| `id` | uuid | `gen_random_uuid()` |
| `organization_id` | uuid | — |
| `job_id` | uuid | — |
| `uploaded_by_profile_id` | uuid | — |
| `storage_path` | text | — |
| `caption` | text | NULL |
| `taken_at` | timestamptz | NULL |
| `created_at` | timestamptz | `now()` |
| `storage_bucket` | text | `'camsecure-media'` |
| `file_name` | text | `''` |
| `mime_type` | text | `''` |
| `file_size` | integer | `0` |

### `camsecure-media` bucket

| Property | Value |
|----------|-------|
| `public` | `false` |
| `file_size_limit` | `10485760` (10 MB) |
| `allowed_mime_types` | `image/jpeg`, `image/png`, `image/webp`, `image/heic` |

### RLS policies confirmed (4 on `job_photos`, 3 on `storage.objects`)

All policies from Phase 10J-B intact — not modified in this phase.

---

## 4. Implementation

### `src/components/jobs/JobPhotoPanel.tsx`

Self-contained client component (`"use client"`). All Supabase mutations use the browser client (`createClient()` from `@/lib/supabase/client`), consistent with the rest of `JobDetail.tsx`.

**State:**

| State | Type | Purpose |
|-------|------|---------|
| `photos` | `PhotoEntry[]` | Loaded photo entries with signed URLs |
| `loadState` | `"loading" \| "ready" \| "error"` | Controls spinner / grid / error |
| `refreshKey` | `number` | Incrementing this re-triggers the fetch `useEffect` |
| `uploading` | `boolean` | Disables button and shows spinner during upload |
| `uploadError` | `string \| null` | Shown below grid on upload failure |
| `uploadDone` | `boolean` | Shows "Photo uploaded" flash for 2.5 s |
| `deletingId` | `string \| null` | Shows per-thumbnail spinner during delete |
| `deleteError` | `string \| null` | Shown on delete failure |

**Photo fetch (`useEffect`):**

```typescript
useEffect(() => {
  async function fetchPhotos() {
    const { data } = await supabase.from("job_photos").select(...).eq("job_id", jobId);
    // ... build entries ...
    const { data: signed } = await supabase.storage
      .from("camsecure-media")
      .createSignedUrls(paths, 3600);
    setPhotos(entries);
    setLoadState("ready");
  }
  fetchPhotos();
}, [jobId, refreshKey]);
```

All `setState` calls inside `fetchPhotos` happen after `await` statements — none are synchronous in the effect body. This satisfies the `react-hooks/set-state-in-effect` lint rule.

**`triggerReload()`:** Called from event handlers (not effects). Sets `loadState = "loading"` and increments `refreshKey`, which re-triggers the fetch effect.

**Upload flow:**

1. Client-side validation: MIME type in `ALLOWED_MIME`, size `≤ MAX_BYTES` (10 MB)
2. `supabase.auth.getUser()` — confirms authenticated session
3. Storage upload: `org/{orgId}/jobs/{jobId}/{timestamp}-{sanitizedName}`
4. DB insert into `job_photos` with all required metadata fields
5. **Rollback on DB failure:** `supabase.storage.remove([storagePath])` — prevents orphaned objects
6. `triggerReload()` — refreshes gallery with signed URLs

**Delete flow:**

1. Storage `remove([storagePath])` — deletes the object
2. `job_photos` DELETE by `id` — removes metadata row
3. Optimistic local state update (`setPhotos(prev => prev.filter(...))`)

**Storage path format:**
```
org/{organizationId}/jobs/{jobId}/{timestamp}-{sanitizedFileName}
```

Matches `camsecure_media_insert` policy requirement: `name LIKE 'org/' || auth_org_id()::text || '/%'`

**`sanitizeName()`:** Lowercases, preserves extension, replaces non-alphanumeric characters with `_`. Prevents path-traversal characters and whitespace in storage keys.

**Signed URLs:** 1-hour expiry, generated via `createSignedUrls()` batch call after fetching rows. Photos without a signed URL show an `ImageIcon` placeholder.

**`<img>` vs `next/image`:** Standard `<img>` used intentionally. Signed URLs are ephemeral private URLs; `next/image` optimization is not applicable and would require configuring `remotePatterns` in `next.config.ts`.

---

### `src/components/jobs/JobDetail.tsx` — Changes

| Change | Detail |
|--------|--------|
| Removed `Upload` from lucide-react imports | No longer used in this file |
| Added `import { JobPhotoPanel }` | From `@/components/jobs/JobPhotoPanel` |
| Replaced 15-line disabled Photos placeholder | Single `<JobPhotoPanel jobId={job.id} organizationId={job.organizationId} />` |

`job.organizationId` is already in `JobDetailData` (populated by `getJobById`). No changes to the data layer.

---

## 5. RLS Verification Simulations

All sims use `BEGIN/ROLLBACK` with `SET LOCAL role = 'authenticated'` and JWT claims.

**UUIDs used:**
- Job: `a0000000-0000-0000-0000-000000000501` (JOB-001, Metro Security Ltd)
- Org: `a0000000-0000-0000-0000-000000000001`
- Admin: `d483bbff-b30b-42b8-888f-abf91f3adf0f` (JSG Admin)
- Client: `ae091c96-a0f0-443f-87dc-c0b5c909e9b6` (David Park, Metro Security Ltd)
- Riverside job: `a0000000-0000-0000-0000-000000000507` (JOB-007)

---

### Sim 1 — Admin INSERT `job_photos` ✅ ALLOWED

Admin inserts metadata row for JOB-001. `RETURNING id` confirms row created:
```
id: dfe225ab-7c52-4cad-8b9d-acfe4a5c1ee3
```
`job_photos_insert` WITH CHECK passes: `organization_id = auth_org_id()`, `uploaded_by_profile_id = auth.uid()`, `auth_role() IN ('owner','admin','dispatcher')`. ✅

---

### Sim 2 — Client INSERT `job_photos` ✅ BLOCKED

David Park (client role) attempts to insert a job photo.
Result: `ERROR 42501: new row violates row-level security policy for table "job_photos"`. Client role not in `('owner','admin','dispatcher')` branch and not in `technician` branch → blocked. ✅

---

### Sim 3 — Storage path satisfies RLS policy ✅ CONFIRMED

```sql
'org/a0000000-.../jobs/a0000000-.../1234-test.jpg'
LIKE ('org/' || auth_org_id()::text || '/%')
```
Result: `path_satisfies_storage_rls = true`. The `org/{orgId}/...` path format used by the upload component satisfies both `camsecure_media_insert` and `camsecure_media_select` policies. ✅

---

### Sim 4 — Admin SELECT confirms row exists ✅ CONFIRMED

Test row `2af77699-2638-400e-8378-aa2ded26f51f` committed to DB. Admin SELECT returns:
```
file_name: verif-test-photo.jpg
mime_type: image/jpeg
file_size: 204800
storage_path: org/...
```
`job_photos_select` org-scoped SELECT policy permits admin/owner/dispatcher. ✅

---

### Sim 5a — Client SELECT own job photos: 1 row ✅ EXPECTED DESIGN

David Park (Metro Security Ltd client) queries the test photo row for JOB-001.
Result: `visible_to_client = 1`.

This is **intentional RLS design** from Phase 10J-B. The `job_photos_select` policy includes a client branch:
```sql
OR (auth_role() = 'client' AND job_id IN (
  SELECT id FROM jobs WHERE client_id = auth_client_id()
))
```
JOB-001 belongs to Metro Security Ltd, and David Park is that client → he can read photos of his own job. No client-facing UI for this is implemented in Phase 10J-C. Upload access remains blocked.

---

### Sim 5b — Client SELECT different client's job: 0 rows ✅ ISOLATED

David Park queries photo for JOB-007 (Riverside School — different client).
Result: `riverside_job007_visible = 0`. Cross-client isolation confirmed. ✅

---

### Cleanup — Both test rows deleted ✅

```
DELETE FROM job_photos WHERE id IN (
  '2af77699-2638-400e-8378-aa2ded26f51f',
  'fe012e75-b0f1-4a46-9602-3f596d404abf'
)
```
Both rows removed. DB returned to clean state. ✅

---

## 6. Lint Fixes Applied

Two lint errors found and fixed before final build:

| Error | Rule | Fix |
|-------|------|-----|
| `(data as any[])` on photo rows | `@typescript-eslint/no-explicit-any` | Replaced with typed `PhotoRow` local type |
| `useEffect(() => { loadPhotos(); }, [loadPhotos])` | `react-hooks/set-state-in-effect` | Dropped `useCallback`/`loadPhotos`; inlined async `fetchPhotos` directly in `useEffect` — all `setState` calls now occur after `await`, not synchronously in the effect body |

---

## 7. Build and Lint

| Check | Result |
|-------|--------|
| `npm run build` | ✅ 0 TypeScript errors · **28 routes** (unchanged) |
| `npm run lint` | ✅ 0 errors · 0 warnings |

---

## 8. Confirmation: No DB/Schema/RLS Changes

| Item | Changed? |
|------|----------|
| `job_photos` schema | ❌ None |
| `job_photos` RLS policies | ❌ None |
| `camsecure-media` bucket | ❌ None |
| Storage RLS policies | ❌ None |
| Any other table | ❌ None |
| Admin/client/technician routes | ❌ Untouched |
| `getJobById()` data function | ❌ Untouched |

---

## 9. Security Checklist

| Check | Result |
|-------|--------|
| No `service_role` key in app code | ✅ Browser client only (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) |
| No public bucket access | ✅ `camsecure-media` is private; all URLs are signed |
| Client cannot upload job photos | ✅ Sim 2 blocked (42501) |
| Storage path org-scoped | ✅ `org/{orgId}/jobs/{jobId}/...` matches storage RLS |
| Orphan storage rollback on DB failure | ✅ `storage.remove([path])` called if INSERT fails |
| Filename sanitization prevents path characters | ✅ `sanitizeName()` strips non-`[a-z0-9-_.]` |
| File type validated client-side before upload | ✅ `ALLOWED_MIME` check |
| File size validated client-side before upload | ✅ `MAX_BYTES = 10 MB` check |
| Signed URL expiry | ✅ 3600 s (1 hour) |
| Cross-client isolation | ✅ Sim 5b confirmed 0 rows for other client |

---

## 10. Bugs Found

**None.** All RLS simulations pass. Both lint errors caught and fixed before final build. Build and lint clean.

---

## 11. Final Verdict

**PASS — all checks passed.**

Admin users on `/jobs/[id]` can now upload photos (JPEG/PNG/WebP/HEIC, max 10 MB), see them in a 2-column thumbnail grid with 1-hour signed URLs, and delete individual photos. The "Photo upload coming soon" placeholder has been replaced. Client upload remains blocked by RLS. Storage objects are path-scoped per org. Build 28 routes, lint clean.

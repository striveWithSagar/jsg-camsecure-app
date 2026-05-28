# Phase 10J-A: Photo Upload System — Audit & Implementation Plan

**Date:** 2026-05-28  
**Status:** PLAN ONLY — no code or schema changes in this phase  
**Base commit:** 9f55735

---

## 1. Current State Audit

### 1.1 UI Placeholders Found

#### Admin Job Detail — `src/components/jobs/JobDetail.tsx:382–396`

```jsx
{/* Photos */}
<div className="rounded-lg border border-border bg-card p-5 space-y-3">
  <h3 ...>Photos</h3>
  <div className="grid grid-cols-2 gap-2">
    <button disabled ...><Upload /> <span>Before</span></button>
    <button disabled ...><Upload /> <span>After</span></button>
  </div>
  <p ...>Photo upload coming soon</p>
</div>
```

Two disabled "Before/After" upload buttons. Located in the right-hand admin actions sidebar. Both are `disabled` with `opacity-50` and `cursor-not-allowed`. No file input, no handler, no storage integration.

---

#### Client New Request Form — `src/app/(client)/client/requests/new/page.tsx:265–275`

```jsx
{/* Photo upload placeholder */}
<section className="space-y-1.5">
  <Label>Attach photos (optional)</Label>
  <div className="...border-dashed...">
    <Camera />
    <p>Photo upload</p>
    <p>Available after account setup</p>
  </div>
</section>
```

Static dashed box with Camera icon and "Available after account setup" message. No file input, no handler.

---

#### Technician Job Detail — `src/components/technician/TechJobDetail.tsx`

**No photo section exists.** Component renders job metadata, `JobStatusWidget`, and `TechFieldNotes` only. Photo upload for technicians is entirely absent.

---

#### Client Job Detail — `src/app/(client)/client/jobs/[id]/page.tsx`

**No photo section exists.** Page shows Details, Timeline, and Linked Request cards only.

---

#### Admin Request Detail — `src/components/requests/RequestDetail.tsx`

**No photo section exists.** Request detail shows metadata, status, and internal notes only.

---

### 1.2 Database Audit

#### `job_photos` table — **already exists**, 0 rows

```
Column                  Type        Nullable  Default
-----------------------  ----------  --------  ---------------
id                      uuid        NOT NULL  gen_random_uuid()
organization_id         uuid        NOT NULL  —
job_id                  uuid        NOT NULL  —
uploaded_by_profile_id  uuid        NOT NULL  —
storage_path            text        NOT NULL  —
caption                 text        NULL      —
taken_at                timestamptz NULL      —
created_at              timestamptz NOT NULL  now()
```

**Foreign keys:** `job_id → jobs.id`, `organization_id → organizations.id`, `uploaded_by_profile_id → profiles.id`  
**Indexes:** primary key on `id`; composite `(job_id, created_at)` for gallery queries  
**RLS:** enabled — 3 existing policies (detailed in §4.1)

**Missing columns (required for file management):**
- `storage_bucket` — which bucket the file lives in (needed if we ever migrate/add buckets)
- `file_name` — original filename for download labeling
- `mime_type` — for Content-Type header on signed URL delivery
- `file_size` — for display and quota enforcement

#### `service_request_photos` table — **does not exist**

No table for request-attached photos. Needs to be created.

#### Supabase Storage — **no buckets configured**

`storage.buckets` is empty. No bucket exists. No `storage.objects` RLS policies exist.

---

### 1.3 Summary: What Already Works vs What Is Missing

| Item | Status |
|------|--------|
| `job_photos` table + RLS + indexes | ✅ Exists (needs 4 extra columns) |
| `service_request_photos` table | ❌ Missing |
| Supabase Storage bucket | ❌ No bucket exists |
| Storage RLS policies | ❌ No policies exist |
| Admin job photo upload UI | ❌ Placeholder only |
| Technician job photo upload UI | ❌ Not started |
| Client request photo upload UI | ❌ Placeholder only |
| Client job photo display | ❌ Not started |
| Admin request photo display | ❌ Not started |
| Signed URL generation helpers | ❌ Missing |
| Photo gallery component | ❌ Missing |

---

## 2. Database Design

### 2.1 Separate Tables vs. Unified Table

**Decision: Keep separate tables — `job_photos` and `service_request_photos`.**

Rationale:

| Factor | Separate Tables | Unified Table |
|--------|----------------|---------------|
| RLS policies | Clean per-entity — no nullable FK awkwardness | Single table but every policy needs `CASE` on nullable columns |
| Existing schema | `job_photos` already exists — changing it to unified would break FKs | — |
| Pattern consistency | Mirrors `job_notes` (job-specific) in the existing schema | Different pattern from everything else |
| FK integrity | NOT NULL on `job_id` / `service_request_id` — enforced | Both columns nullable, one always null — cannot be NOT NULL |
| Query clarity | `SELECT * FROM job_photos WHERE job_id = ?` | `SELECT * FROM photos WHERE job_id = ? AND service_request_id IS NULL` |
| RLS scope | Technician: `job_id IN (SELECT id FROM jobs WHERE technician_id = ...)` — direct, cheap | Same but on a larger table with mixed FK types |

A unified table only makes sense when there are 5+ entity types that can have photos. With 2 types (jobs + requests), separate tables are simpler and already half-built.

---

### 2.2 `job_photos` — Final Column Spec (after migration)

```sql
CREATE TABLE job_photos (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id        uuid        NOT NULL REFERENCES organizations(id),
  job_id                 uuid        NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  uploaded_by_profile_id uuid        NOT NULL REFERENCES profiles(id),
  storage_bucket         text        NOT NULL DEFAULT 'camsecure-media',
  storage_path           text        NOT NULL,
  file_name              text        NOT NULL,
  mime_type              text        NOT NULL,
  file_size              integer     NOT NULL,  -- bytes
  caption                text,
  taken_at               timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now()
);
```

**Migration required:** `ALTER TABLE job_photos ADD COLUMN storage_bucket text NOT NULL DEFAULT 'camsecure-media'` (and similarly for `file_name`, `mime_type`, `file_size`). Safe — table is empty (0 rows confirmed).

---

### 2.3 `service_request_photos` — New Table

```sql
CREATE TABLE service_request_photos (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id        uuid        NOT NULL REFERENCES organizations(id),
  service_request_id     uuid        NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  uploaded_by_profile_id uuid        NOT NULL REFERENCES profiles(id),
  storage_bucket         text        NOT NULL DEFAULT 'camsecure-media',
  storage_path           text        NOT NULL,
  file_name              text        NOT NULL,
  mime_type              text        NOT NULL,
  file_size              integer     NOT NULL,
  caption                text,
  created_at             timestamptz NOT NULL DEFAULT now()
);
```

`taken_at` omitted — clients uploading request photos rarely track shot time. Caption is optional and can be used for "describe what the photo shows."

**Indexes:**
```sql
CREATE INDEX idx_service_request_photos_request_id
  ON service_request_photos(service_request_id, created_at);
```

---

### 2.4 `ON DELETE CASCADE` Justification

Both `job_photos.job_id` and `service_request_photos.service_request_id` use `ON DELETE CASCADE`. When a job or request is deleted, orphaned storage objects would remain. Phase 10J-B should also add a database trigger (or document the need) to clean up Storage objects on row delete. Without cascade cleanup of Storage, deleted rows leave orphaned blobs. This is documented as a known limitation to address in Phase 10J-G.

---

## 3. Supabase Storage Design

### 3.1 Bucket: Single Private Bucket `camsecure-media`

**Name:** `camsecure-media`  
**Visibility:** **Private** (not public)  
**File size limit:** 10 MB per file  
**Allowed MIME types:** `image/jpeg`, `image/png`, `image/webp`, `image/heic`

**Why single bucket over separate `job-photos` / `request-photos`:**
- Storage RLS policies in Supabase apply per-bucket. Two buckets = two complete sets of policies.
- Path-based separation provides the same logical isolation with one policy set.
- Simpler to configure, simpler to audit.
- If in future isolation is required (e.g., compliance), the bucket can be split — the `storage_bucket` column in DB makes this a 1-line path change.

**Why private (not public):**
- Job and request photos may contain sensitive information (security camera installations, site details, access credentials visible in shots).
- Clients should only see photos for their own jobs/requests — public buckets bypass this entirely.
- Signed URLs expire (1 hour), limiting exposure if a URL leaks.
- There is no content-delivery advantage to public buckets here (not serving public marketing images).

---

### 3.2 Storage Path Format

```
org/{organization_id}/jobs/{job_id}/{photo_id}-{sanitized_filename}
org/{organization_id}/requests/{service_request_id}/{photo_id}-{sanitized_filename}
```

**Examples:**
```
org/a000...0001/jobs/a000...0501/3f8a1c2d-...-before-install.jpg
org/a000...0001/requests/4172b8c8-.../7d3e9f1a-...-crack-in-cable.png
```

**Why `{photo_id}-{sanitized_filename}` prefix:**
- The UUID prefix prevents filename collisions when the same file is uploaded twice.
- The original filename is preserved for human readability.
- `sanitized_filename` = lowercase, spaces replaced with hyphens, non-alphanumeric stripped. Max 60 chars.

**The `org/{organization_id}/` prefix enables org-scoped Storage RLS** using path string matching, without needing a DB lookup from within the storage policy.

---

### 3.3 Signed URL Expiry

- **Gallery display (page load):** 1-hour signed URLs generated server-side
- **Download links:** Same 1-hour URL (user downloads within the browsing session)
- **Recommendation:** Generate all signed URLs in the data helper at page render time; do not cache in the client across sessions

A 1-hour TTL is suitable for internal ops tools. If the admin dashboard eventually needs longer-lived URLs (e.g., for email attachments), a 24-hour expiry can be used for those specific cases.

---

## 4. RLS Policy Plan

### 4.1 `job_photos` — Existing Policies (annotated)

| Policy | CMD | Allows | Gap? |
|--------|-----|--------|------|
| `job_photos_select` | SELECT | admin/owner/dispatcher (org-scoped) + technician (own jobs) + client (own client_id jobs) | ✅ None |
| `job_photos_insert` | INSERT | admin/owner/dispatcher + technician (own jobs); `organization_id = auth_org_id()` + `uploaded_by_profile_id = auth.uid()` | Client blocked — ✅ correct (clients don't upload to job photos) |
| `job_photos_delete_admin` | DELETE | admin/owner only | ❌ Uploader (technician) cannot delete own photos |

**New policy needed:**
```sql
-- Allow original uploader to delete their own photo
CREATE POLICY job_photos_delete_uploader ON job_photos
  FOR DELETE TO authenticated
  USING (
    uploaded_by_profile_id = auth.uid()
    AND auth_role() = 'technician'
  );
```

Scope to `technician` only — admins already have `job_photos_delete_admin`. This prevents a scenario where a client account somehow has a `job_photos` row (impossible today, but defensive).

---

### 4.2 `service_request_photos` — New Policies

```sql
-- SELECT: admin/owner/dispatcher (org-scoped) + client (own requests only)
CREATE POLICY srp_select ON service_request_photos
  FOR SELECT TO authenticated
  USING (
    (organization_id = auth_org_id()
      AND auth_role() = ANY (ARRAY['owner','admin','dispatcher']::user_role[]))
    OR
    (auth_role() = 'client'
      AND service_request_id IN (
        SELECT id FROM service_requests WHERE client_id = auth_client_id()
      ))
  );

-- INSERT: admin/owner/dispatcher OR client (own requests, new/reviewing status only)
CREATE POLICY srp_insert ON service_request_photos
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = auth_org_id()
    AND uploaded_by_profile_id = auth.uid()
    AND (
      auth_role() = ANY (ARRAY['owner','admin','dispatcher']::user_role[])
      OR (
        auth_role() = 'client'
        AND service_request_id IN (
          SELECT id FROM service_requests
          WHERE client_id = auth_client_id()
            AND status IN ('new', 'reviewing')
        )
      )
    )
  );

-- DELETE: admin/owner OR original uploader
CREATE POLICY srp_delete ON service_request_photos
  FOR DELETE TO authenticated
  USING (
    (organization_id = auth_org_id()
      AND auth_role() = ANY (ARRAY['owner','admin']::user_role[]))
    OR uploaded_by_profile_id = auth.uid()
  );
```

**Client INSERT restriction to `new`/`reviewing` status:** Prevents clients from adding photos to a request that has already been converted to a job or cancelled. Once converted, photos should go to the job (admin/technician territory).

---

### 4.3 Storage RLS — `storage.objects`

Storage RLS policies apply to the `storage.objects` table in the `storage` schema. The `name` column holds the full path (e.g., `org/abc.../jobs/xyz.../photo.jpg`) and `bucket_id` holds the bucket name.

```sql
-- SELECT (download): authenticated users can read objects under their org prefix
CREATE POLICY storage_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'camsecure-media'
    AND name LIKE ('org/' || auth_org_id()::text || '/%')
  );

-- INSERT (upload): authenticated users can upload under their org prefix
CREATE POLICY storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'camsecure-media'
    AND name LIKE ('org/' || auth_org_id()::text || '/%')
  );

-- DELETE: authenticated users can delete objects they own or admin can delete all org objects
CREATE POLICY storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'camsecure-media'
    AND (
      owner = auth.uid()
      OR (
        name LIKE ('org/' || auth_org_id()::text || '/%')
        AND auth_role() = ANY (ARRAY['owner','admin']::user_role[])
      )
    )
  );
```

**Note:** The Storage `owner` column is set by Supabase to `auth.uid()` at upload time automatically. This makes uploader-scoped delete straightforward without an extra DB join.

**Defense in depth:** Even if a malicious user crafts a path like `org/other-org-id/...`, the `auth_org_id()` check rejects it at the Storage policy level before `job_photos` INSERT is attempted.

---

### 4.4 Cross-Role Isolation Summary

| Action | Admin/Owner | Dispatcher | Technician | Client |
|--------|-------------|------------|-----------|--------|
| View job photos | ✅ All org jobs | ✅ All org jobs | ✅ Own jobs only | ✅ Own client_id jobs |
| Upload job photo | ✅ | ✅ | ✅ Own jobs only | ❌ Blocked |
| Delete job photo | ✅ | ❌ | ✅ Own uploads only | ❌ Blocked |
| View request photos | ✅ | ✅ | ❌ Not in scope | ✅ Own requests only |
| Upload request photo | ✅ | ✅ | ❌ Not in scope | ✅ Own requests (new/reviewing) |
| Delete request photo | ✅ | ❌ | ❌ | ✅ Own uploads only |

---

## 5. Implementation Phases

### Phase 10J-B: DB Migration + Storage Bucket + RLS

**Files/changes:**
- New migration via `supabase migration new photo_upload_schema`
- `ALTER TABLE job_photos ADD COLUMN storage_bucket text NOT NULL DEFAULT 'camsecure-media'`
- `ALTER TABLE job_photos ADD COLUMN file_name text NOT NULL DEFAULT ''`
- `ALTER TABLE job_photos ADD COLUMN mime_type text NOT NULL DEFAULT ''`
- `ALTER TABLE job_photos ADD COLUMN file_size integer NOT NULL DEFAULT 0`
- `CREATE TABLE service_request_photos (...)` with all columns
- `CREATE INDEX idx_service_request_photos_request_id ON service_request_photos(service_request_id, created_at)`
- Enable RLS on `service_request_photos`
- Add `srp_select`, `srp_insert`, `srp_delete` policies
- Add `job_photos_delete_uploader` policy
- Create Storage bucket `camsecure-media` (via Supabase Dashboard or MCP `execute_sql` on `storage.buckets`)
- Add Storage RLS policies on `storage.objects`

**Verification:** Advisor check, row count confirmation (0 rows undisturbed), RLS simulation.

---

### Phase 10J-C: Data Helpers + Signed URL Layer

**New file: `src/lib/data/photos.ts`**

```typescript
// Server-side data helpers (use server Supabase client)

export type JobPhotoItem = {
  id:         string;
  storagePath: string;
  fileName:   string;
  caption:    string | null;
  takenAt:    string | null;
  createdAt:  string;
  signedUrl:  string;  // 1-hour signed URL
};

export type RequestPhotoItem = {
  id:          string;
  storagePath: string;
  fileName:    string;
  caption:     string | null;
  createdAt:   string;
  signedUrl:   string;
};

export async function getJobPhotos(jobId: string): Promise<JobPhotoItem[]>
export async function getRequestPhotos(requestId: string): Promise<RequestPhotoItem[]>
```

**New file: `src/lib/actions/photos.ts`** (Server Actions for delete)

```typescript
// Server Actions (Next.js "use server")
export async function deleteJobPhoto(photoId: string, storagePath: string): Promise<void>
export async function deleteRequestPhoto(photoId: string, storagePath: string): Promise<void>
```

**Upload approach — direct browser-to-Storage:**
- Client components import `createClient` (browser Supabase client)
- `supabase.storage.from('camsecure-media').upload(path, file)` — uploads directly from browser
- On success, call a Server Action or `fetch` to INSERT the `job_photos` / `service_request_photos` row
- This avoids streaming files through the Next.js server (better performance, lower memory)

**Signed URL generation:**
```typescript
const { data } = await supabase.storage
  .from('camsecure-media')
  .createSignedUrl(storagePath, 3600);  // 1 hour
```

Called server-side in data helpers; URLs embedded into page props at render time.

---

### Phase 10J-D: Admin Job Photo Upload + Gallery

**Files modified:**
- `src/components/jobs/JobDetail.tsx` — replace "Before/After" placeholder with `<JobPhotoGallery>`
- `src/lib/data/jobs.ts` — add `job_photos` to `getJobById()` select

**New file:** `src/components/jobs/JobPhotoGallery.tsx` (Client Component)

UI:
```
┌────────────────────────────────────┐
│ PHOTOS (3)          [+ Add Photo]  │
│ ┌──────┐ ┌──────┐ ┌──────┐        │
│ │ img  │ │ img  │ │ img  │        │
│ │      │ │  ×   │ │  ×   │        │
│ └──────┘ └──────┘ └──────┘        │
└────────────────────────────────────┘
```

- Thumbnail grid (3–4 columns)
- Click thumbnail → open full-size in new tab via signed URL
- `×` delete button visible to admin/owner only
- `[+ Add Photo]` button triggers hidden `<input type="file" accept="image/*" multiple>`
- Upload progress: spinner on uploading thumbnail slot
- Error: inline destructive banner if upload fails

---

### Phase 10J-E: Technician Job Photo Upload + Gallery

**Files modified:**
- `src/components/technician/TechJobDetail.tsx` — add `<TechJobPhotos>` after `<TechFieldNotes>`
- `src/lib/data/jobs.ts` — ensure `getJobById()` returns photos (shared with admin)

**New file:** `src/components/technician/TechJobPhotos.tsx` (Client Component)

Same gallery pattern as admin, with differences:
- Can only upload to own assigned jobs (RLS enforced)
- Can delete own uploads only (RLS enforced — `job_photos_delete_uploader`)
- Caption field shown on upload (optional — "Describe what this photo shows")
- "Before" / "After" is removed as a concept — general photo uploads with optional caption

---

### Phase 10J-F: Client Request Photo Upload + Display

**Files modified:**
- `src/app/(client)/client/requests/new/page.tsx` — replace Camera placeholder with functional upload
- `src/app/(client)/client/requests/[id]/page.tsx` — add photos section
- `src/components/requests/RequestDetail.tsx` — add photos section for admin view of request

**Client new request form — upload flow change:**

The current form submits the request and redirects. Adding file upload to a single-submit form is fragile (files fail silently on server errors). Recommended flow:

**Option A (recommended):** Two-step — create request first, then show photo upload step on the success/confirmation screen. Redirects to `/client/requests/[new-id]?uploaded=true` where the detail page shows an upload prompt.

**Option B:** Single-step with multipart submission — complex, harder to recover from partial failures.

Plan recommends Option A. Approval needed on this UX approach.

---

### Phase 10J-G: Full Verification Report

All CRUD/RLS/security checks per the testing checklist (§7). Written to `docs/SUPABASE_PHASE_10J_G_PHOTO_UPLOAD_VERIFICATION_REPORT.md`.

---

## 6. UX Recommendations

### File Constraints

| Constraint | Value | Reason |
|-----------|-------|--------|
| Accepted types | `image/jpeg`, `image/png`, `image/webp`, `image/heic` | Common mobile/camera formats; exclude PDF/video to keep scope narrow |
| Max file size | 10 MB per file | Typical high-res phone photo is 4–8 MB; 10 MB provides headroom |
| Max files per job | 20 | Prevents storage abuse; field jobs rarely need more |
| Max files per request | 10 | Clients attach evidence photos; 10 is generous |
| Bucket-level enforcement | `file_size_limit: 10485760` (10 MB) | Supabase enforces at storage layer, not just app code |
| Bucket MIME allowlist | `['image/jpeg','image/png','image/webp','image/heic']` | Supabase enforces at storage layer |

### Upload States

| State | UI |
|-------|----|
| Idle | Dashed upload zone + `[+ Add Photo]` button |
| Selecting | Native file picker |
| Client-side validation fail | Inline error: "File must be JPEG, PNG, WebP, or HEIC under 10 MB" |
| Uploading | Thumbnail placeholder with spinner; button disabled |
| Success | Thumbnail appears in grid; counter increments |
| Server error | Inline destructive banner: "Upload failed — please try again"; thumbnail slot removed |

### Gallery

- **4-column thumbnail grid** on desktop, 2-column on mobile (CSS grid, `aspect-square`, `object-cover`)
- **Click thumbnail** → open signed URL in new tab (`window.open(signedUrl, '_blank')`)
- **Caption** → shown below thumbnail if set (one line, truncated)
- **Delete button (`×`)** → top-right corner of thumbnail, shown only to authorized roles; requires confirmation alert before deletion
- **Empty state** → "No photos yet" with upload icon and CTA button

### Signed URL Handling

- Generated **server-side** at page render; embedded as props into client gallery components
- **1-hour expiry** — sufficient for active browsing sessions
- Gallery component does NOT re-fetch on its own; page reload regenerates fresh URLs
- If a URL expires mid-session and the user clicks an image, the browser will receive a 403; the gallery should handle this gracefully (show "Image expired — reload page" on `<img>` error)

---

## 7. Testing Checklist

| # | Test | Role | Expected |
|---|------|------|---------|
| 1 | Upload photo to JOB-001 | Admin | `job_photos` row inserted; Storage object at correct path; thumbnail appears |
| 2 | View job photos | Admin | All org photos visible; signed URLs load |
| 3 | Delete job photo | Admin | `job_photos` row removed; Storage object deleted |
| 4 | Upload photo to assigned job | Technician (Alex Rivera) | `job_photos` row inserted; own photo visible |
| 5 | Upload photo to unassigned job | Technician (Alex Rivera) | RLS blocks INSERT — `42501` error; no row created; no Storage object |
| 6 | Delete own photo | Technician | Allowed by `job_photos_delete_uploader` |
| 7 | Delete another technician's photo | Technician | RLS blocks DELETE |
| 8 | View photos for assigned job | Technician | Own job photos visible |
| 9 | View photos for unassigned job | Technician | 0 rows returned (RLS blocks) |
| 10 | Upload photo to own service request | Client (David Park) | `service_request_photos` row inserted; photo visible on `/client/requests/[id]` |
| 11 | Upload photo to another client's request | Client | RLS blocks INSERT |
| 12 | View another client's request photos | Client | 0 rows returned (RLS blocks) |
| 13 | Upload photo to converted request | Client | RLS blocks (status not in `new`/`reviewing`) |
| 14 | Admin views request photos | Admin | All org request photos visible |
| 15 | Signed URL expires (simulate) | Any | 403 on expired URL; page reload regenerates fresh URL |
| 16 | File over 10 MB | Any | Client-side reject + Supabase Storage-level reject |
| 17 | Non-image file (e.g., PDF) | Any | Client-side reject + Supabase Storage MIME reject |
| 18 | Storage path prefix mismatch | Any | Storage RLS blocks (`name LIKE 'org/auth_org_id...'` fails) |
| 19 | Build: 0 TypeScript errors | — | `npm run build` passes |
| 20 | Lint: 0 warnings | — | `npm run lint` passes |
| 21 | All QA test rows cleaned | — | 0 rows remain in `job_photos` and `service_request_photos` after test; Storage objects deleted |

---

## 8. Risks and Design Decisions Requiring Approval

The following require explicit sign-off before Phase 10J-B begins:

| # | Decision | Recommendation | Risk if wrong |
|---|----------|----------------|--------------|
| 1 | **ALTER TABLE `job_photos`** — add 4 columns | Proceed — table is empty (0 rows), safe | None — table is empty |
| 2 | **Single bucket vs. two buckets** | Single `camsecure-media` with path separation | Low — can split later if needed |
| 3 | **Client request photo upload flow** — two-step (create request first, then upload) vs. single-step | Two-step — simpler, no orphaned objects | If not approved, single-step implementation needed |
| 4 | **Client photo upload scope** — `new`/`reviewing` status only | Restrict — prevent post-conversion uploads | Could frustrate clients who want to add photos to reviewing requests |
| 5 | **Technician uploader self-delete** | Allow (`job_photos_delete_uploader` policy scoped to technician role) | Minor — only affects own-uploaded photos |
| 6 | **Signed URL expiry** — 1 hour vs. 24 hours | 1 hour for security; 24 hours only for admin email/export flows | 1-hour URLs expire during long admin sessions — acceptable trade-off |
| 7 | **`taken_at` on `service_request_photos`** | Omit — clients won't track shot time | None — can add later with a trivial migration |
| 8 | **Storage object cleanup on row delete** | Document as limitation; implement DB trigger in a follow-up | Orphaned Storage blobs if rows deleted directly via SQL (not via app) |
| 9 | **`caption` field on upload UI** | Show optional caption input on admin/technician upload; omit from client request upload (keep simple) | Minor UX difference across portals |

---

## 9. Files Affected — Complete Summary (all phases)

| File | Phase | Action |
|------|-------|--------|
| Supabase migration (new) | 10J-B | ALTER `job_photos`, CREATE `service_request_photos`, Storage bucket, Storage RLS, `job_photos` delete policy |
| `src/lib/data/photos.ts` | 10J-C | CREATE — `getJobPhotos()`, `getRequestPhotos()` + signed URL generation |
| `src/lib/actions/photos.ts` | 10J-C | CREATE — `deleteJobPhoto()`, `deleteRequestPhoto()` Server Actions |
| `src/lib/data/jobs.ts` | 10J-D | MODIFY — add `job_photos` embed to `getJobById()` |
| `src/components/jobs/JobDetail.tsx` | 10J-D | MODIFY — replace photo placeholder with `<JobPhotoGallery>` |
| `src/components/jobs/JobPhotoGallery.tsx` | 10J-D | CREATE — Client Component, admin gallery + upload |
| `src/components/technician/TechJobDetail.tsx` | 10J-E | MODIFY — add `<TechJobPhotos>` |
| `src/components/technician/TechJobPhotos.tsx` | 10J-E | CREATE — Client Component, technician gallery + upload |
| `src/app/(client)/client/requests/new/page.tsx` | 10J-F | MODIFY — replace Camera placeholder; wire two-step upload flow |
| `src/app/(client)/client/requests/[id]/page.tsx` | 10J-F | MODIFY — add photos section |
| `src/components/requests/RequestDetail.tsx` | 10J-F | MODIFY — add request photos section for admin |

---

## 10. Conclusion

The photo upload system is approximately 60% designed already — `job_photos` table with RLS is in place and well-structured. The main work is:

1. **4-column migration** on `job_photos` (safe, table is empty)
2. **1 new table** — `service_request_photos` (mirrors job_photos pattern)
3. **1 Storage bucket** — `camsecure-media` (private, 10 MB image-only)
4. **Storage RLS policies** — org-prefix path matching
5. **1 new data helper file + 1 Server Actions file** — signed URL generation + delete
6. **3 new Client Component galleries** — admin job, technician job, client request
7. **3 existing page/component modifications** — wire galleries in

The highest-risk decision is the **client request photo upload flow** (§8 item 3). Approval of the two-step approach (create request → then upload photos on confirmation screen) is needed before Phase 10J-F implementation begins, as it affects the client new request UX significantly.

Ready for approval and Phase 10J-B when confirmed.

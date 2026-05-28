-- Phase 10J-B: Photo Upload Schema Foundation
-- Adds storage columns to job_photos, creates service_request_photos table,
-- creates camsecure-media Storage bucket, and adds all RLS policies.

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Extend job_photos with storage metadata columns
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE job_photos
  ADD COLUMN IF NOT EXISTS storage_bucket TEXT NOT NULL DEFAULT 'camsecure-media',
  ADD COLUMN IF NOT EXISTS file_name      TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS mime_type      TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS file_size      INTEGER NOT NULL DEFAULT 0;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Add technician self-delete policy to job_photos
--    (original 3 policies — job_photos_select, job_photos_insert,
--    job_photos_delete_admin — are untouched)
-- ────────────────────────────────────────────────────────────────────────────
CREATE POLICY job_photos_delete_uploader ON job_photos
  FOR DELETE TO authenticated
  USING (
    uploaded_by_profile_id = auth.uid()
    AND auth_role() = 'technician'::user_role
  );

-- ────────────────────────────────────────────────────────────────────────────
-- 3. service_request_photos table
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS service_request_photos (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id        UUID        NOT NULL REFERENCES organizations(id),
  service_request_id     UUID        NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  uploaded_by_profile_id UUID        NOT NULL REFERENCES profiles(id),
  storage_bucket         TEXT        NOT NULL DEFAULT 'camsecure-media',
  storage_path           TEXT        NOT NULL,
  file_name              TEXT        NOT NULL,
  mime_type              TEXT        NOT NULL,
  file_size              INTEGER     NOT NULL,
  caption                TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_srp_service_request_id
  ON service_request_photos(service_request_id);

ALTER TABLE service_request_photos ENABLE ROW LEVEL SECURITY;

-- SELECT: admin/owner/dispatcher (org-scoped) OR client viewing own requests
CREATE POLICY srp_select ON service_request_photos
  FOR SELECT TO authenticated
  USING (
    (
      (organization_id = auth_org_id())
      AND auth_role() = ANY (ARRAY['owner'::user_role, 'admin'::user_role, 'dispatcher'::user_role])
    )
    OR (
      auth_role() = 'client'::user_role
      AND service_request_id IN (
        SELECT id FROM service_requests WHERE client_id = auth_client_id()
      )
    )
  );

-- INSERT: admin/owner/dispatcher OR client on own open/reviewing requests
CREATE POLICY srp_insert ON service_request_photos
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id        = auth_org_id()
    AND uploaded_by_profile_id = auth.uid()
    AND (
      auth_role() = ANY (ARRAY['owner'::user_role, 'admin'::user_role, 'dispatcher'::user_role])
      OR (
        auth_role() = 'client'::user_role
        AND service_request_id IN (
          SELECT id FROM service_requests
          WHERE client_id = auth_client_id()
            AND status = ANY (ARRAY['new'::request_status, 'reviewing'::request_status])
        )
      )
    )
  );

-- DELETE: admin/owner (org-scoped) OR original uploader
CREATE POLICY srp_delete ON service_request_photos
  FOR DELETE TO authenticated
  USING (
    (
      (organization_id = auth_org_id())
      AND auth_role() = ANY (ARRAY['owner'::user_role, 'admin'::user_role])
    )
    OR uploaded_by_profile_id = auth.uid()
  );

-- ────────────────────────────────────────────────────────────────────────────
-- 4. Storage bucket — camsecure-media (private, 10 MB, 4 image MIME types)
-- ────────────────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'camsecure-media',
  'camsecure-media',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────────────────────
-- 5. Storage RLS policies on storage.objects
--    Path convention: org/<org_id>/jobs/<job_id>/<filename>
--                     org/<org_id>/requests/<request_id>/<filename>
-- ────────────────────────────────────────────────────────────────────────────
CREATE POLICY camsecure_media_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'camsecure-media'
    AND name LIKE 'org/' || auth_org_id()::text || '/%'
  );

CREATE POLICY camsecure_media_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'camsecure-media'
    AND name LIKE 'org/' || auth_org_id()::text || '/%'
  );

-- Uploader can always delete their own object; admins/owners can delete any org object
CREATE POLICY camsecure_media_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'camsecure-media'
    AND (
      owner = auth.uid()
      OR (
        auth_role() = ANY (ARRAY['owner'::user_role, 'admin'::user_role])
        AND name LIKE 'org/' || auth_org_id()::text || '/%'
      )
    )
  );

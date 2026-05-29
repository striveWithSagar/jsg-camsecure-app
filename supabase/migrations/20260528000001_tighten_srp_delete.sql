-- Phase 10L: Tighten service_request_photos DELETE policy
--
-- Before: second branch had no organization_id check and no role restriction,
--         allowing any authenticated user who uploaded a photo to delete it
--         regardless of org or role context.
--
-- After:  every delete path is gated on organization_id = auth_org_id().
--         Admin/owner/dispatcher: full org-scoped delete.
--         Client: must own the service request AND be the uploader.
--         Technician / any other role: no delete (no insert branch exists for them either).

DROP POLICY IF EXISTS srp_delete ON service_request_photos;

CREATE POLICY srp_delete ON service_request_photos
  FOR DELETE TO authenticated
  USING (
    organization_id = auth_org_id()
    AND (
      auth_role() = ANY (ARRAY['owner'::user_role, 'admin'::user_role, 'dispatcher'::user_role])
      OR (
        auth_role() = 'client'::user_role
        AND service_request_id IN (
          SELECT id FROM service_requests
          WHERE client_id = auth_client_id()
        )
        AND uploaded_by_profile_id = auth.uid()
      )
    )
  );

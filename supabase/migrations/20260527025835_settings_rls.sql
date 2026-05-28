-- ============================================================
-- Phase 9C-B: Broaden UPDATE policies on company_settings and
-- organizations to allow both owner and admin roles.
--
-- Previously these policies were owner-only. Admins need write
-- access to update org settings from the Settings page.
-- ============================================================

-- ── company_settings ─────────────────────────────────────────

DROP POLICY IF EXISTS company_settings_update_owner ON company_settings;

CREATE POLICY company_settings_update_owner ON company_settings
  FOR UPDATE TO authenticated
  USING (
    (organization_id = auth_org_id())
    AND auth_role() = ANY (ARRAY['owner', 'admin']::user_role[])
  )
  WITH CHECK (
    (organization_id = auth_org_id())
    AND auth_role() = ANY (ARRAY['owner', 'admin']::user_role[])
  );

-- ── organizations ─────────────────────────────────────────────

DROP POLICY IF EXISTS organizations_update_owner ON organizations;

CREATE POLICY organizations_update_owner ON organizations
  FOR UPDATE TO authenticated
  USING (
    (id = auth_org_id())
    AND auth_role() = ANY (ARRAY['owner', 'admin']::user_role[])
  )
  WITH CHECK (
    (id = auth_org_id())
    AND auth_role() = ANY (ARRAY['owner', 'admin']::user_role[])
  );

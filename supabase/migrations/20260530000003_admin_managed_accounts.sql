-- Phase 10Q-B: Admin-Managed Accounts Foundation
--
-- Adds deactivated_at to profiles, is_active to technicians,
-- lookup indexes, and a profiles INSERT policy for admin/owner.
-- Does not delete any existing data.

-- ── 1. Profile deactivation audit trail ────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ NULL;

-- ── 2. Technician deactivation flag (separate from operational status) ─────────
ALTER TABLE technicians
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- ── 3. Lookup indexes ──────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_profiles_is_active
  ON profiles(organization_id, is_active);

CREATE INDEX IF NOT EXISTS idx_technicians_is_active
  ON technicians(organization_id, is_active);

-- ── 4. profiles INSERT policy ─────────────────────────────────────────────────
-- Service_role (route handler) bypasses RLS, but this policy adds defense-in-depth
-- so authenticated admins can insert profiles within their own organization.
CREATE POLICY profiles_insert_admin ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = auth_org_id()
    AND auth_role() IN ('owner'::user_role, 'admin'::user_role)
  );

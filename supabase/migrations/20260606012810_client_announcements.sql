-- Phase 10T-B: Client Announcements + Google Review URL
--
-- 1. Add google_review_url to company_settings
-- 2. Create client_announcements table
-- 3. Create client_announcement_interests table
-- 4. Indexes, RLS policies, updated_at trigger

-- ── 1. google_review_url ──────────────────────────────────────────────────────

ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS google_review_url TEXT;

-- ── 2. client_announcements ───────────────────────────────────────────────────

CREATE TABLE client_announcements (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES organizations(id),
  title           TEXT        NOT NULL,
  description     TEXT,
  cta_text        TEXT        NOT NULL DEFAULT 'I''m Interested',
  poster_path     TEXT,
  is_published    BOOLEAN     NOT NULL DEFAULT false,
  starts_at       TIMESTAMPTZ,
  ends_at         TIMESTAMPTZ,
  created_by      UUID        NOT NULL REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_announcements_org_published
  ON client_announcements(organization_id, is_published, starts_at, ends_at);

ALTER TABLE client_announcements ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_announcements_updated_at
  BEFORE UPDATE ON client_announcements
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Admin/owner/dispatcher: full org access (read all, including unpublished)
CREATE POLICY ca_select_admin ON client_announcements
  FOR SELECT TO authenticated
  USING (
    organization_id = auth_org_id()
    AND auth_role() = ANY (ARRAY['owner'::user_role, 'admin'::user_role, 'dispatcher'::user_role])
  );

-- Client: see published + within optional date window
CREATE POLICY ca_select_client ON client_announcements
  FOR SELECT TO authenticated
  USING (
    organization_id = auth_org_id()
    AND auth_role() = 'client'::user_role
    AND is_published = true
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at   IS NULL OR ends_at   >= now())
  );

-- Insert: admin/owner/dispatcher only
CREATE POLICY ca_insert ON client_announcements
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = auth_org_id()
    AND auth_role() = ANY (ARRAY['owner'::user_role, 'admin'::user_role, 'dispatcher'::user_role])
    AND created_by = auth.uid()
  );

-- Update: admin/owner/dispatcher only
CREATE POLICY ca_update ON client_announcements
  FOR UPDATE TO authenticated
  USING    (organization_id = auth_org_id()
            AND auth_role() = ANY (ARRAY['owner'::user_role, 'admin'::user_role, 'dispatcher'::user_role]))
  WITH CHECK (organization_id = auth_org_id()
            AND auth_role() = ANY (ARRAY['owner'::user_role, 'admin'::user_role, 'dispatcher'::user_role]));

-- Delete: owner only
CREATE POLICY ca_delete ON client_announcements
  FOR DELETE TO authenticated
  USING (organization_id = auth_org_id() AND auth_role() = 'owner'::user_role);

-- ── 3. client_announcement_interests ─────────────────────────────────────────

CREATE TABLE client_announcement_interests (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES organizations(id),
  announcement_id UUID        NOT NULL REFERENCES client_announcements(id) ON DELETE CASCADE,
  client_id       UUID        REFERENCES clients(id),
  profile_id      UUID        REFERENCES profiles(id),
  message         TEXT,
  clicked_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_announcement_interests_announcement
  ON client_announcement_interests(announcement_id, clicked_at DESC);

ALTER TABLE client_announcement_interests ENABLE ROW LEVEL SECURITY;

-- Admin/owner/dispatcher: see all org interests
CREATE POLICY cai_select_admin ON client_announcement_interests
  FOR SELECT TO authenticated
  USING (
    organization_id = auth_org_id()
    AND auth_role() = ANY (ARRAY['owner'::user_role, 'admin'::user_role, 'dispatcher'::user_role])
  );

-- Client: see own interests only
CREATE POLICY cai_select_client ON client_announcement_interests
  FOR SELECT TO authenticated
  USING (
    organization_id = auth_org_id()
    AND auth_role() = 'client'::user_role
    AND profile_id = auth.uid()
  );

-- Insert: client only, own org, own profile
CREATE POLICY cai_insert ON client_announcement_interests
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = auth_org_id()
    AND auth_role() = 'client'::user_role
    AND profile_id = auth.uid()
    AND (client_id IS NULL OR client_id = auth_client_id())
  );

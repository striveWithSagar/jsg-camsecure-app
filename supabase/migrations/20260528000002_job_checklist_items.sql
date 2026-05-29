-- Phase 10M-B: Job Completion Checklist
-- Adds job_checklist_items table, RLS policies, column restriction trigger,
-- and a BEFORE UPDATE guard on jobs.status that blocks completion when
-- required checklist items remain unchecked.

-- ── 1. Table ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS job_checklist_items (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         UUID        NOT NULL REFERENCES organizations(id),
  job_id                  UUID        NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  position                INTEGER     NOT NULL,
  label                   TEXT        NOT NULL,
  is_required             BOOLEAN     NOT NULL DEFAULT true,
  is_completed            BOOLEAN     NOT NULL DEFAULT false,
  completed_at            TIMESTAMPTZ NULL,
  completed_by_profile_id UUID        NULL REFERENCES profiles(id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jci_job_id ON job_checklist_items(job_id);

ALTER TABLE job_checklist_items ENABLE ROW LEVEL SECURITY;

-- ── 2. updated_at trigger (reuses existing set_updated_at helper) ─────────────

CREATE TRIGGER trg_checklist_updated_at
  BEFORE UPDATE ON job_checklist_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 3. RLS policies ───────────────────────────────────────────────────────────

-- SELECT: admin/owner/dispatcher (org-scoped) OR assigned technician
CREATE POLICY jci_select ON job_checklist_items
  FOR SELECT TO authenticated
  USING (
    (organization_id = auth_org_id()
      AND auth_role() = ANY (ARRAY['owner'::user_role,'admin'::user_role,'dispatcher'::user_role]))
    OR (
      auth_role() = 'technician'::user_role
      AND job_id IN (SELECT jobs.id FROM jobs WHERE jobs.technician_id = auth_technician_id())
    )
  );

-- INSERT: admin/owner/dispatcher only
CREATE POLICY jci_insert ON job_checklist_items
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = auth_org_id()
    AND auth_role() = ANY (ARRAY['owner'::user_role,'admin'::user_role,'dispatcher'::user_role])
  );

-- UPDATE: admin (any field) OR assigned technician (completion fields only — enforced by trigger)
CREATE POLICY jci_update ON job_checklist_items
  FOR UPDATE TO authenticated
  USING (
    (organization_id = auth_org_id()
      AND auth_role() = ANY (ARRAY['owner'::user_role,'admin'::user_role,'dispatcher'::user_role]))
    OR (
      auth_role() = 'technician'::user_role
      AND job_id IN (SELECT jobs.id FROM jobs WHERE jobs.technician_id = auth_technician_id())
    )
  )
  WITH CHECK (
    (organization_id = auth_org_id()
      AND auth_role() = ANY (ARRAY['owner'::user_role,'admin'::user_role,'dispatcher'::user_role]))
    OR (
      auth_role() = 'technician'::user_role
      AND job_id IN (SELECT jobs.id FROM jobs WHERE jobs.technician_id = auth_technician_id())
    )
  );

-- DELETE: admin/owner/dispatcher only
CREATE POLICY jci_delete ON job_checklist_items
  FOR DELETE TO authenticated
  USING (
    organization_id = auth_org_id()
    AND auth_role() = ANY (ARRAY['owner'::user_role,'admin'::user_role,'dispatcher'::user_role])
  );

-- ── 4. Column guard: technicians may only update completion fields ─────────────

CREATE OR REPLACE FUNCTION fn_checklist_tech_col_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF auth_role() = 'technician'::user_role THEN
    IF NEW.label           IS DISTINCT FROM OLD.label
    OR NEW.position        IS DISTINCT FROM OLD.position
    OR NEW.is_required     IS DISTINCT FROM OLD.is_required
    OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
    OR NEW.job_id          IS DISTINCT FROM OLD.job_id
    THEN
      RAISE EXCEPTION 'CHECKLIST_FIELD_RESTRICTED: Technicians may only update completion fields.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_checklist_tech_col_guard
  BEFORE UPDATE ON job_checklist_items
  FOR EACH ROW EXECUTE FUNCTION fn_checklist_tech_col_guard();

-- ── 5. Completion guard on jobs ────────────────────────────────────────────────
-- Fires BEFORE status is changed to 'completed'.
-- Error prefix CHECKLIST_INCOMPLETE: allows UI to show a user-friendly message.

CREATE OR REPLACE FUNCTION fn_jobs_checklist_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM job_checklist_items
    WHERE job_id     = NEW.id
      AND is_required  = true
      AND is_completed = false
  ) THEN
    RAISE EXCEPTION
      'CHECKLIST_INCOMPLETE: All required checklist items must be completed before marking this job complete.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_jobs_checklist_guard
  BEFORE UPDATE OF status ON jobs
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed')
  EXECUTE FUNCTION fn_jobs_checklist_guard();

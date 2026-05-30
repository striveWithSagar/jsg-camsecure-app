-- Phase 10O-B: In-App Notifications
--
-- 1. notifications table + RLS + column guard trigger
-- 2. Extends fn_record_job_status_change to emit admin + client notifications
-- 3. Adds trg_sr_status_client_notify on service_requests
-- 4. Recreates convert_request_to_job with technician + client notifications

-- ── 1. Table ──────────────────────────────────────────────────────────────────

CREATE TABLE notifications (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID        NOT NULL REFERENCES organizations(id),
  recipient_profile_id  UUID        NULL REFERENCES profiles(id),
  recipient_role        user_role   NULL,
  actor_profile_id      UUID        NULL REFERENCES profiles(id),
  event_type            TEXT        NOT NULL,
  title                 TEXT        NOT NULL,
  body                  TEXT,
  entity_type           TEXT        NOT NULL,
  entity_id             UUID        NOT NULL,
  is_read               BOOLEAN     NOT NULL DEFAULT false,
  read_at               TIMESTAMPTZ NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_org_unread ON notifications(organization_id, is_read, created_at DESC);
CREATE INDEX idx_notifications_recipient  ON notifications(recipient_profile_id, is_read)
  WHERE recipient_profile_id IS NOT NULL;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ── 2. RLS ────────────────────────────────────────────────────────────────────

-- Admin/owner/dispatcher see all org notifications; any user sees their own targeted ones
CREATE POLICY notifications_select ON notifications
  FOR SELECT TO authenticated
  USING (
    (organization_id = auth_org_id()
      AND auth_role() = ANY (ARRAY['owner'::user_role,'admin'::user_role,'dispatcher'::user_role]))
    OR recipient_profile_id = auth.uid()
  );

-- Any authenticated user can insert for their own org as themselves
CREATE POLICY notifications_insert ON notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = auth_org_id()
    AND (actor_profile_id = auth.uid() OR actor_profile_id IS NULL)
  );

-- Mark-read: same SELECT scope as read access
CREATE POLICY notifications_update_read ON notifications
  FOR UPDATE TO authenticated
  USING (
    (organization_id = auth_org_id()
      AND auth_role() = ANY (ARRAY['owner'::user_role,'admin'::user_role,'dispatcher'::user_role]))
    OR recipient_profile_id = auth.uid()
  )
  WITH CHECK (
    (organization_id = auth_org_id()
      AND auth_role() = ANY (ARRAY['owner'::user_role,'admin'::user_role,'dispatcher'::user_role]))
    OR recipient_profile_id = auth.uid()
  );

-- Deletion: owner only
CREATE POLICY notifications_delete ON notifications
  FOR DELETE TO authenticated
  USING (
    organization_id = auth_org_id()
    AND auth_role() = 'owner'::user_role
  );

-- ── 3. Column guard ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_notification_read_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.event_type           IS DISTINCT FROM OLD.event_type
  OR NEW.title                IS DISTINCT FROM OLD.title
  OR NEW.body                 IS DISTINCT FROM OLD.body
  OR NEW.entity_type          IS DISTINCT FROM OLD.entity_type
  OR NEW.entity_id            IS DISTINCT FROM OLD.entity_id
  OR NEW.organization_id      IS DISTINCT FROM OLD.organization_id
  OR NEW.recipient_profile_id IS DISTINCT FROM OLD.recipient_profile_id
  OR NEW.recipient_role       IS DISTINCT FROM OLD.recipient_role
  OR NEW.actor_profile_id     IS DISTINCT FROM OLD.actor_profile_id
  OR NEW.created_at           IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'NOTIFICATION_IMMUTABLE: Only is_read and read_at may be updated.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notification_read_guard
  BEFORE UPDATE ON notifications
  FOR EACH ROW EXECUTE FUNCTION fn_notification_read_guard();

-- ── 4. job_status_history INSERT policy ──────────────────────────────────────
-- Required so fn_record_job_status_change (SECURITY INVOKER) can write when called
-- by an authenticated user. Constrained to own org + own profile.
CREATE POLICY job_status_history_insert ON job_status_history
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = auth_org_id()
    AND changed_by_profile_id = auth.uid()
  );

-- ── 5. Job status → admin + client notifications ──────────────────────────────

CREATE OR REPLACE FUNCTION fn_record_job_status_change()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_event          TEXT;
  v_title          TEXT;
  v_job_label      TEXT;
  v_client_profile UUID;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN

    INSERT INTO job_status_history (organization_id, job_id, changed_by_profile_id, old_status, new_status, changed_at)
    VALUES (NEW.organization_id, NEW.id, auth.uid(), OLD.status, NEW.status, now());

    v_job_label := 'JOB-' || LPAD(COALESCE(NEW.job_number::text,'?'), 4, '0');

    -- Admin notification: only for technician-driven events (not admin self-actions)
    IF auth_role() NOT IN ('owner'::user_role, 'admin'::user_role, 'dispatcher'::user_role) THEN
      v_event := CASE WHEN NEW.status = 'completed' THEN 'technician_job_completed' ELSE 'technician_job_status_changed' END;
      v_title := CASE WHEN NEW.status = 'completed'
        THEN v_job_label || ' completed by technician'
        ELSE v_job_label || ' → ' || replace(NEW.status::text, '_', ' ')
      END;
      INSERT INTO notifications (organization_id, actor_profile_id, recipient_role, event_type, title, entity_type, entity_id)
      VALUES (NEW.organization_id, auth.uid(), 'admin', v_event, v_title, 'job', NEW.id);
    END IF;

    -- Client notification on job completion
    IF NEW.status = 'completed' AND NEW.client_id IS NOT NULL THEN
      SELECT cc.profile_id INTO v_client_profile
      FROM client_contacts cc
      WHERE cc.client_id = NEW.client_id AND cc.profile_id IS NOT NULL LIMIT 1;

      IF v_client_profile IS NOT NULL THEN
        INSERT INTO notifications (organization_id, actor_profile_id, recipient_profile_id, event_type, title, body, entity_type, entity_id)
        VALUES (NEW.organization_id, auth.uid(), v_client_profile,
          'job_completed_client',
          v_job_label || ' has been completed',
          'Your service job has been completed. View details in your portal.',
          'job', NEW.id);
      END IF;
    END IF;

  END IF;
  RETURN NEW;
END;
$$;

-- ── 5. Service request status → client notification ───────────────────────────

CREATE OR REPLACE FUNCTION fn_sr_status_client_notify()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_client_profile UUID;
BEGIN
  IF NEW.client_id IS NOT NULL
    AND auth_role() != 'client'::user_role
    AND NEW.status IN ('reviewing'::request_status, 'ready_to_schedule'::request_status, 'cancelled'::request_status)
  THEN
    SELECT cc.profile_id INTO v_client_profile
    FROM client_contacts cc
    WHERE cc.client_id = NEW.client_id AND cc.profile_id IS NOT NULL LIMIT 1;

    IF v_client_profile IS NOT NULL THEN
      INSERT INTO notifications (organization_id, actor_profile_id, recipient_profile_id, event_type, title, entity_type, entity_id)
      VALUES (NEW.organization_id, auth.uid(), v_client_profile,
        'request_status_updated_client',
        'REQ-' || LPAD(COALESCE(NEW.request_number::text, '?'), 4, '0')
          || ' status updated: ' || replace(NEW.status::text, '_', ' '),
        'service_request', NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sr_status_client_notify
  AFTER UPDATE OF status ON service_requests
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION fn_sr_status_client_notify();

-- ── 6. Recreate convert_request_to_job with notifications ────────────────────

DROP FUNCTION IF EXISTS convert_request_to_job(uuid,uuid,uuid,text,text,service_type,job_priority,timestamp with time zone,text,text);

CREATE OR REPLACE FUNCTION convert_request_to_job(
  p_request_id       uuid,
  p_client_id        uuid,
  p_technician_id    uuid,
  p_site_name        text,
  p_address          text,
  p_service_type     service_type,
  p_priority         job_priority,
  p_scheduled_at     timestamp with time zone,
  p_dispatcher_notes text,
  p_technician_notes text
) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  v_org_id         uuid;
  v_job_id         uuid;
  v_job_number     integer;
  v_req            record;
  v_tech_profile   uuid;
  v_client_profile uuid;
BEGIN
  v_org_id := auth_org_id();
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Not authenticated or profile not found'; END IF;

  SELECT id, status, converted_to_job_id INTO v_req
  FROM service_requests WHERE id = p_request_id FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Service request % not found', p_request_id; END IF;

  IF v_req.status = 'cancelled' THEN
    RAISE EXCEPTION 'SERVICE_REQUEST_CANCELLED: Service request has been cancelled and cannot be converted to a job.';
  END IF;

  IF v_req.status = 'converted' OR v_req.converted_to_job_id IS NOT NULL THEN
    RAISE EXCEPTION 'Service request % has already been converted to a job (%)', p_request_id, v_req.converted_to_job_id;
  END IF;

  INSERT INTO jobs (
    organization_id, request_id, client_id, technician_id,
    site_name, address, service_type, priority,
    scheduled_at, dispatcher_notes, technician_notes
  ) VALUES (
    v_org_id, p_request_id, p_client_id, p_technician_id,
    p_site_name, p_address, p_service_type, p_priority,
    p_scheduled_at, p_dispatcher_notes, p_technician_notes
  ) RETURNING id, job_number INTO v_job_id, v_job_number;

  UPDATE service_requests SET status = 'converted', converted_to_job_id = v_job_id WHERE id = p_request_id;

  -- Notify assigned technician
  IF p_technician_id IS NOT NULL THEN
    SELECT profile_id INTO v_tech_profile FROM technicians WHERE id = p_technician_id;
    IF v_tech_profile IS NOT NULL THEN
      INSERT INTO notifications (organization_id, actor_profile_id, recipient_profile_id, event_type, title, entity_type, entity_id)
      VALUES (v_org_id, auth.uid(), v_tech_profile, 'admin_technician_assigned',
        'You have been assigned to JOB-' || LPAD(COALESCE(v_job_number::text,'?'), 4, '0'),
        'job', v_job_id);
    END IF;
  END IF;

  -- Notify client (if request owned by a client portal user)
  SELECT cc.profile_id INTO v_client_profile
  FROM client_contacts cc WHERE cc.client_id = p_client_id AND cc.profile_id IS NOT NULL LIMIT 1;

  IF v_client_profile IS NOT NULL THEN
    INSERT INTO notifications (organization_id, actor_profile_id, recipient_profile_id, event_type, title, body, entity_type, entity_id)
    VALUES (v_org_id, auth.uid(), v_client_profile, 'request_converted_to_job',
      'Your request has been scheduled as a job',
      'JOB-' || LPAD(COALESCE(v_job_number::text,'?'), 4, '0') || ' has been created for your service request.',
      'service_request', p_request_id);
  END IF;

  RETURN v_job_id;
END;
$$;

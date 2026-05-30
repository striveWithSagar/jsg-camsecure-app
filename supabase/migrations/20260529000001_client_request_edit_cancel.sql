-- Phase 10N-B: Client Request Edit and Cancellation
--
-- 1. Hardens convert_request_to_job to reject cancelled requests
-- 2. Adds service_requests_update_client RLS policy
-- 3. Adds column guard trigger to prevent clients from modifying restricted fields

-- ── 1. Recreate convert_request_to_job with cancelled guard ───────────────────
-- Must DROP first; CREATE OR REPLACE cannot change parameter defaults.
DROP FUNCTION IF EXISTS convert_request_to_job(
  uuid, uuid, uuid, text, text, service_type, job_priority,
  timestamp with time zone, text, text
);

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
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_org_id uuid;
  v_job_id uuid;
  v_req    record;
BEGIN
  v_org_id := auth_org_id();

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated or profile not found';
  END IF;

  SELECT id, status, converted_to_job_id
  INTO   v_req
  FROM   service_requests
  WHERE  id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Service request % not found', p_request_id;
  END IF;

  -- New: block conversion of cancelled requests
  IF v_req.status = 'cancelled' THEN
    RAISE EXCEPTION
      'SERVICE_REQUEST_CANCELLED: Service request has been cancelled and cannot be converted to a job.';
  END IF;

  -- Existing: block double-conversion
  IF v_req.status = 'converted' OR v_req.converted_to_job_id IS NOT NULL THEN
    RAISE EXCEPTION
      'Service request % has already been converted to a job (%)',
      p_request_id, v_req.converted_to_job_id;
  END IF;

  INSERT INTO jobs (
    organization_id, request_id, client_id, technician_id,
    site_name, address, service_type, priority,
    scheduled_at, dispatcher_notes, technician_notes
  ) VALUES (
    v_org_id, p_request_id, p_client_id, p_technician_id,
    p_site_name, p_address, p_service_type, p_priority,
    p_scheduled_at, p_dispatcher_notes, p_technician_notes
  )
  RETURNING id INTO v_job_id;

  UPDATE service_requests
  SET    status              = 'converted',
         converted_to_job_id = v_job_id
  WHERE  id = p_request_id;

  RETURN v_job_id;
END;
$$;

-- ── 2. Client UPDATE RLS policy ────────────────────────────────────────────────
-- USING:      client can target rows they own that are still new or reviewing
-- WITH CHECK: new row must keep status in {new, reviewing, cancelled}
--             (blocks elevation to ready_to_schedule or converted)
CREATE POLICY service_requests_update_client ON service_requests
  FOR UPDATE TO authenticated
  USING (
    client_id       = auth_client_id()
    AND auth_role() = 'client'::user_role
    AND status      IN ('new'::request_status, 'reviewing'::request_status)
  )
  WITH CHECK (
    client_id           = auth_client_id()
    AND auth_role()     = 'client'::user_role
    AND organization_id = auth_org_id()
    AND status          IN ('new'::request_status, 'reviewing'::request_status, 'cancelled'::request_status)
  );

-- ── 3. Column guard: block clients from modifying structural/admin fields ──────
CREATE OR REPLACE FUNCTION fn_sr_client_col_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF auth_role() = 'client'::user_role THEN
    IF NEW.organization_id         IS DISTINCT FROM OLD.organization_id
    OR NEW.client_id               IS DISTINCT FROM OLD.client_id
    OR NEW.submitted_by_profile_id IS DISTINCT FROM OLD.submitted_by_profile_id
    OR NEW.client_name             IS DISTINCT FROM OLD.client_name
    OR NEW.request_number          IS DISTINCT FROM OLD.request_number
    OR NEW.converted_to_job_id     IS DISTINCT FROM OLD.converted_to_job_id
    OR NEW.notes                   IS DISTINCT FROM OLD.notes
    THEN
      RAISE EXCEPTION
        'SR_FIELD_RESTRICTED: Clients may only update description, service_type, urgency, or status.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sr_client_col_guard
  BEFORE UPDATE ON service_requests
  FOR EACH ROW EXECUTE FUNCTION fn_sr_client_col_guard();

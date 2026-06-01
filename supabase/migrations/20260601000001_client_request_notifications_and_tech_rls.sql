-- Phase 10T-A: Client request data chain + notification fixes
--
-- 1. clients_select RLS: add technician role so technician portal can read
--    client names for their assigned jobs (was returning "Unknown Client").
--
-- 2. convert_request_to_job RPC: add admin broadcast notification on job create;
--    fix technician notification to use human-readable service type label;
--    no changes to client or schema.

-- ─── 1. clients RLS — add technician read access ─────────────────────────────

DROP POLICY IF EXISTS clients_select ON public.clients;

CREATE POLICY clients_select ON public.clients
  FOR SELECT TO authenticated
  USING (
    (
      (organization_id = auth_org_id())
      AND (auth_role() = ANY (ARRAY[
        'owner'::user_role,
        'admin'::user_role,
        'dispatcher'::user_role,
        'technician'::user_role   -- added: technicians need client name on job views
      ]))
    )
    OR (
      (id = auth_client_id())
      AND (auth_role() = 'client'::user_role)
    )
  );


-- ─── 2. convert_request_to_job RPC ───────────────────────────────────────────
-- Changes vs previous version:
--   - Added v_service_label CASE for human-readable service type (e.g. "Camera Outage")
--   - Added admin role-broadcast notification after job creation
--   - Updated technician notification body to include human-readable service label
--   - Technician notification title changed from "You have been assigned to JOB-####"
--     to "JOB-#### assigned to you" (clearer, shorter)
--   - No changes to client notification or job INSERT

CREATE OR REPLACE FUNCTION public.convert_request_to_job(
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
AS $function$
DECLARE
  v_org_id         uuid;
  v_job_id         uuid;
  v_job_number     integer;
  v_req            record;
  v_tech_profile   uuid;
  v_client_profile uuid;
  v_tech_name      text;
  v_client_name    text;
  v_job_label      text;
  v_service_label  text;
BEGIN
  v_org_id := auth_org_id();
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated or profile not found';
  END IF;

  SELECT id, status, converted_to_job_id INTO v_req
  FROM service_requests WHERE id = p_request_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Service request % not found', p_request_id;
  END IF;
  IF v_req.status = 'cancelled' THEN
    RAISE EXCEPTION
      'SERVICE_REQUEST_CANCELLED: Service request has been cancelled and cannot be converted to a job.';
  END IF;
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
  ) RETURNING id, job_number INTO v_job_id, v_job_number;

  UPDATE service_requests
  SET status = 'converted', converted_to_job_id = v_job_id
  WHERE id = p_request_id;

  v_job_label := 'JOB-' || LPAD(COALESCE(v_job_number::text, '?'), 4, '0');

  -- Human-readable service type label
  v_service_label := CASE p_service_type
    WHEN 'new_installation'  THEN 'New Installation'
    WHEN 'maintenance'       THEN 'Maintenance'
    WHEN 'dvr_nvr_issue'     THEN 'DVR/NVR Issue'
    WHEN 'camera_outage'     THEN 'Camera Outage'
    WHEN 'mobile_app_issue'  THEN 'Mobile App Issue'
    WHEN 'wiring_issue'      THEN 'Wiring Issue'
    WHEN 'emergency_service' THEN 'Emergency Service'
    WHEN 'quote_request'     THEN 'Quote Request'
    WHEN 'site_inspection'   THEN 'Site Inspection'
    ELSE 'Other'
  END;

  -- Resolve display names
  SELECT p.full_name INTO v_tech_name
  FROM technicians t JOIN profiles p ON p.id = t.profile_id
  WHERE t.id = p_technician_id;
  v_tech_name := COALESCE(v_tech_name, 'Technician');

  SELECT name INTO v_client_name FROM clients WHERE id = p_client_id;
  v_client_name := COALESCE(v_client_name, 'Client');

  -- Notify assigned technician only (profile-specific, not a broadcast)
  IF p_technician_id IS NOT NULL THEN
    SELECT profile_id INTO v_tech_profile
    FROM technicians WHERE id = p_technician_id;

    IF v_tech_profile IS NOT NULL THEN
      INSERT INTO notifications (
        organization_id, actor_profile_id, recipient_profile_id,
        event_type, title, body, entity_type, entity_id
      ) VALUES (
        v_org_id, auth.uid(), v_tech_profile,
        'admin_technician_assigned',
        v_job_label || ' assigned to you',
        v_client_name || ' · ' || COALESCE(p_address, p_site_name, '—') || ' · ' || v_service_label,
        'job', v_job_id
      );
    END IF;
  END IF;

  -- Notify admin/owner (role-based broadcast — different wording from technician msg)
  INSERT INTO notifications (
    organization_id, actor_profile_id, recipient_role,
    event_type, title, body, entity_type, entity_id
  ) VALUES (
    v_org_id, auth.uid(), 'admin',
    'request_converted_to_job',
    v_job_label || ' created',
    'Assigned to ' || v_tech_name || ' for ' || v_client_name || ' · ' || v_service_label || '.',
    'job', v_job_id
  );

  -- Notify client (if request was owned by a portal client)
  SELECT cc.profile_id INTO v_client_profile
  FROM client_contacts cc
  WHERE cc.client_id = p_client_id AND cc.profile_id IS NOT NULL
  LIMIT 1;

  IF v_client_profile IS NOT NULL THEN
    INSERT INTO notifications (
      organization_id, actor_profile_id, recipient_profile_id,
      event_type, title, body, entity_type, entity_id
    ) VALUES (
      v_org_id, auth.uid(), v_client_profile,
      'request_converted_to_job',
      'Your request has been scheduled as a job',
      v_job_label || ' has been created for your service request.',
      'service_request', p_request_id
    );
  END IF;

  RETURN v_job_id;
END;
$function$;

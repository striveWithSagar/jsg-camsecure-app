-- ============================================================
-- Phase 4C-B: convert_request_to_job()
-- Atomically inserts a job and marks the source request
-- as converted. SECURITY INVOKER — all RLS policies apply.
-- ============================================================

create or replace function convert_request_to_job(
  p_request_id       uuid,
  p_client_id        uuid,
  p_technician_id    uuid,
  p_site_name        text,
  p_address          text,
  p_service_type     service_type,
  p_priority         job_priority,
  p_scheduled_at     timestamptz,
  p_dispatcher_notes text  default '',
  p_technician_notes text  default ''
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_org_id uuid;
  v_job_id uuid;
begin
  -- Resolve org via SECURITY DEFINER helper (same pattern as all RLS policies)
  v_org_id := auth_org_id();

  if v_org_id is null then
    raise exception 'Not authenticated or profile not found';
  end if;

  -- Insert job (subject to jobs_insert_admin RLS)
  insert into jobs (
    organization_id,
    request_id,
    client_id,
    technician_id,
    site_name,
    address,
    service_type,
    priority,
    scheduled_at,
    dispatcher_notes,
    technician_notes
  ) values (
    v_org_id,
    p_request_id,
    p_client_id,
    p_technician_id,
    p_site_name,
    p_address,
    p_service_type,
    p_priority,
    p_scheduled_at,
    p_dispatcher_notes,
    p_technician_notes
  )
  returning id into v_job_id;

  -- Mark request converted (subject to service_requests_update_admin RLS)
  update service_requests
  set    status              = 'converted',
         converted_to_job_id = v_job_id
  where  id = p_request_id;

  return v_job_id;
end;
$$;

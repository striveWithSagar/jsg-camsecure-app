-- ============================================================
-- Phase 9B-E: Harden convert_request_to_job against
-- duplicate conversions at the database level.
--
-- Changes:
--   1. Replace the existing non-unique partial index on
--      jobs(request_id) with a UNIQUE partial index so the
--      database physically prevents two jobs from referencing
--      the same service_request.
--   2. Replace convert_request_to_job() with a version that
--      locks the service_requests row (FOR UPDATE) before
--      inserting, then raises a clear exception if the request
--      is already converted. The unique index is a last-resort
--      safety net; the lock + status check is the primary guard.
-- ============================================================

-- ── 1. Upgrade request_id index to UNIQUE ────────────────────

-- Drop the existing non-unique partial index (the unique index
-- below is a strict superset — keeping both would be redundant).
DROP INDEX IF EXISTS idx_jobs_request_id;

-- Unique partial index: one service_request -> at most one job.
-- WHERE request_id IS NOT NULL ensures walk-in jobs (no request)
-- are unaffected.
CREATE UNIQUE INDEX idx_jobs_request_id
  ON jobs(request_id)
  WHERE request_id IS NOT NULL;

-- ── 2. Replace the RPC ────────────────────────────────────────

CREATE OR REPLACE FUNCTION convert_request_to_job(
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
  v_req    record;
begin
  -- Resolve org via SECURITY DEFINER helper (same pattern as all RLS policies)
  v_org_id := auth_org_id();

  if v_org_id is null then
    raise exception 'Not authenticated or profile not found';
  end if;

  -- Lock the service_requests row for the duration of this transaction.
  -- This serialises concurrent convert attempts for the same request
  -- so only the first one proceeds past the status check below.
  select id, status, converted_to_job_id
  into   v_req
  from   service_requests
  where  id = p_request_id
  for update;

  if not found then
    raise exception 'Service request % not found', p_request_id;
  end if;

  -- Guard: raise before any INSERT if the request is already converted.
  -- This check + the FOR UPDATE lock above prevent the race condition
  -- where two concurrent calls both see status = new and both insert.
  -- The unique index on jobs(request_id) is a final safety net.
  if v_req.status = 'converted' or v_req.converted_to_job_id is not null then
    raise exception
      'Service request % has already been converted to a job (%)',
      p_request_id, v_req.converted_to_job_id;
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

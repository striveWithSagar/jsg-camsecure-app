-- ============================================================
-- Phase 10A-B: Human-readable job and request numbers
--
-- Adds jobs.job_number and service_requests.request_number:
--   1. Nullable integer columns
--   2. Global sequences
--   3. Deterministic backfill of existing rows (created_at, id)
--   4. Sequences advanced past backfill max
--   5. BEFORE INSERT trigger functions + triggers
--   6. UNIQUE indexes
--   7. NOT NULL constraints (safe after full backfill)
--
-- UUIDs remain primary keys. Columns are display-only.
-- No RLS policy changes. No RPC changes.
-- ============================================================

-- ── 1. Add nullable columns ──────────────────────────────────

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS job_number integer;

ALTER TABLE service_requests
  ADD COLUMN IF NOT EXISTS request_number integer;

-- ── 2. Create sequences ──────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS job_number_seq
  START WITH 1
  INCREMENT BY 1
  NO CYCLE;

CREATE SEQUENCE IF NOT EXISTS request_number_seq
  START WITH 1
  INCREMENT BY 1
  NO CYCLE;

-- ── 3. Backfill existing rows deterministically ──────────────
-- ORDER BY (created_at, id) is stable even if two rows share
-- the same timestamp (uses UUID as tiebreaker).

WITH ordered AS (
  SELECT id,
         ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn
  FROM   jobs
  WHERE  job_number IS NULL
)
UPDATE jobs
SET    job_number = ordered.rn
FROM   ordered
WHERE  jobs.id = ordered.id;

WITH ordered AS (
  SELECT id,
         ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn
  FROM   service_requests
  WHERE  request_number IS NULL
)
UPDATE service_requests
SET    request_number = ordered.rn
FROM   ordered
WHERE  service_requests.id = ordered.id;

-- ── 4. Advance sequences past backfill max ───────────────────
-- setval(seq, n, false) means nextval() will return n (not n+1)
-- on the next call, so the first new row gets max+1.

SELECT setval(
  'job_number_seq',
  COALESCE((SELECT MAX(job_number) FROM jobs), 0) + 1,
  false
);

SELECT setval(
  'request_number_seq',
  COALESCE((SELECT MAX(request_number) FROM service_requests), 0) + 1,
  false
);

-- ── 5. Trigger functions ─────────────────────────────────────

CREATE OR REPLACE FUNCTION assign_job_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.job_number IS NULL THEN
    NEW.job_number := nextval('job_number_seq');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION assign_request_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.request_number IS NULL THEN
    NEW.request_number := nextval('request_number_seq');
  END IF;
  RETURN NEW;
END;
$$;

-- ── 6. Attach triggers ───────────────────────────────────────

CREATE TRIGGER trg_assign_job_number
  BEFORE INSERT ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION assign_job_number();

CREATE TRIGGER trg_assign_request_number
  BEFORE INSERT ON service_requests
  FOR EACH ROW
  EXECUTE FUNCTION assign_request_number();

-- ── 7. Unique indexes ────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_job_number
  ON jobs (job_number);

CREATE UNIQUE INDEX IF NOT EXISTS idx_service_requests_request_number
  ON service_requests (request_number);

-- ── 8. NOT NULL constraints (safe after full backfill) ───────

ALTER TABLE jobs
  ALTER COLUMN job_number SET NOT NULL;

ALTER TABLE service_requests
  ALTER COLUMN request_number SET NOT NULL;

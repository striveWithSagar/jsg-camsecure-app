-- Phase 10T-H: Add preferred_at to service_requests and deadline_at to jobs
-- These columns persist the preferred date/time entered by clients/admins on request forms
-- and the job deadline set by admins on the convert-to-job form.
--
-- RLS note: existing policies on both tables use org-level and role-level checks
-- that already cover all columns via SELECT * / UPDATE without column restrictions.
-- No new policies are required.

ALTER TABLE service_requests
  ADD COLUMN IF NOT EXISTS preferred_at TIMESTAMPTZ NULL;

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS deadline_at TIMESTAMPTZ NULL;

-- Phase 10S-A / 10R-B: store site address submitted with the service request
-- so the convert-to-job page can pre-fill it without asking admin to retype it.
ALTER TABLE service_requests
  ADD COLUMN IF NOT EXISTS site_address TEXT NOT NULL DEFAULT '';

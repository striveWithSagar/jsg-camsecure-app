-- Phase 10R-C: Backfill service_requests.site_address for old rows.
--
-- Rows created before Phase 10S-A added the site_address column default to ''.
-- Where a request has a linked client_id and clients.address is non-empty,
-- copy the client address as a best-effort site address for that request.
-- Rows that already have a site_address value are not touched.

UPDATE service_requests sr
SET    site_address = c.address
FROM   clients c
WHERE  sr.client_id   = c.id
  AND  (sr.site_address IS NULL OR sr.site_address = '')
  AND  c.address IS NOT NULL
  AND  c.address <> '';

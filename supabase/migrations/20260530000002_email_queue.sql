-- Phase 10P-B: Email Alerts Foundation
-- Adds email_queue table for delivery tracking/retry,
-- and email_alerts_enabled feature flag on company_settings.

-- ── 1. Feature flag ────────────────────────────────────────────────────────────
ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS email_alerts_enabled BOOLEAN NOT NULL DEFAULT false;

-- ── 2. email_queue table ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_queue (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id           UUID        NOT NULL REFERENCES organizations(id),
  notification_id           UUID        NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  recipient_profile_id      UUID        NULL REFERENCES profiles(id),
  -- intended_recipient_email: the real intended recipient (for dedup + audit)
  -- recipient_email: actual send target (may be redirected in test mode)
  intended_recipient_email  TEXT        NOT NULL,
  recipient_email           TEXT        NOT NULL,
  recipient_name            TEXT,
  event_type                TEXT        NOT NULL,
  subject                   TEXT        NOT NULL,
  html_body                 TEXT        NOT NULL,
  status                    TEXT        NOT NULL DEFAULT 'queued',
    -- 'queued' | 'sent' | 'failed' | 'permanently_failed'
  attempts                  INTEGER     NOT NULL DEFAULT 0,
  last_error                TEXT,
  next_retry_at             TIMESTAMPTZ,
  sent_at                   TIMESTAMPTZ,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One queue row per notification × intended recipient (prevents duplicate sends)
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_queue_dedup
  ON email_queue(notification_id, intended_recipient_email);

-- Retry worker index
CREATE INDEX IF NOT EXISTS idx_email_queue_retry
  ON email_queue(status, next_retry_at)
  WHERE status IN ('queued','failed');

ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;

-- No authenticated access — Edge Functions use service_role key exclusively
CREATE POLICY email_queue_block_authenticated ON email_queue
  FOR ALL TO authenticated USING (false);

-- updated_at trigger (reuses existing set_updated_at helper)
CREATE TRIGGER trg_email_queue_updated_at
  BEFORE UPDATE ON email_queue
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Admin read policy (admins monitor delivery status; writes remain service_role only)
CREATE POLICY email_queue_admin_select ON email_queue
  FOR SELECT TO authenticated
  USING (
    organization_id = auth_org_id()
    AND auth_role() IN ('owner'::user_role, 'admin'::user_role)
  );

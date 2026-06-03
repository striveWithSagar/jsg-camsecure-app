# Phase 10P-A: Email Alerts — Implementation Plan

**Date:** 2026-05-30  
**Type:** Plan only — no code changes  
**Base commit:** bfd5f8a (Phase 10O-D audit report)  
**Prerequisite:** Phase 10O-B (in-app notifications) — complete and stable

---

## 1. Current State Audit

### Notifications table (already exists)

All notification events are already written to the `notifications` table with:
- `event_type` (text) — identifies which event occurred
- `title` + `body` — human-readable content (ready for email subject/body)
- `entity_type` + `entity_id` — for building deep-link URLs
- `recipient_profile_id` — specific user (tech or client), or
- `recipient_role` — role-wide audience (`'admin'`)
- `actor_profile_id` — who triggered the event
- `organization_id` — tenant scope

**This is the authoritative event source for Phase 10P.** Email delivery reads from `notifications` — it does not bypass or duplicate the notification creation logic.

### No existing email infrastructure

- No `pg_cron` extension installed
- No `supabase/functions/` directory
- No email provider configured
- No Edge Functions in this project yet

### Email lookup: profiles already have emails

`profiles.email` stores each user's email. The `client_contacts.email` stores client-facing contact email. Both are accessible via service-role queries inside Edge Functions.

---

## 2. Recommended Architecture

### Overview

```
App or DB trigger writes to notifications
         ↓
  Supabase Database Webhook
  fires on INSERT to notifications
         ↓
  Edge Function: process-notification-email
  • Checks if event_type should send email
  • Looks up recipient email(s) from profiles/client_contacts
  • Renders email template
  • Sends via email provider (Resend)
         ↓ (success)           ↓ (failure)
  Writes sent record        Writes failed record
  to email_queue            to email_queue
                            retry on next
                            scheduled run
```

### Why Database Webhook + Edge Function (not server action)?

| Approach | Pro | Con |
|---|---|---|
| Database Webhook → Edge Function | Fires automatically, app-independent, scales separately, supports retries | Requires Edge Function deploy |
| Next.js Server Action | Already in Next.js app, no extra infra | App must be running, no retry, harder to test independently |
| Direct insert in existing app code | Simple, no new infra | Tightly coupled, harder to extend, no retry |

**Recommendation:** Database Webhook triggering an Edge Function. This is the standard Supabase email pattern and keeps email delivery decoupled from the Next.js app lifecycle.

---

## 3. `email_queue` Table

An `email_queue` table is **recommended** for:
- Retry tracking (failed sends can be retried)
- Audit trail (when was each email sent, to whom)
- Deduplication (prevent double-sends on webhook re-delivery)
- Future analytics (delivery rates per event type)

```sql
CREATE TABLE email_queue (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id   UUID        NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  organization_id   UUID        NOT NULL REFERENCES organizations(id),
  recipient_email   TEXT        NOT NULL,
  recipient_name    TEXT,
  subject           TEXT        NOT NULL,
  html_body         TEXT        NOT NULL,
  status            TEXT        NOT NULL DEFAULT 'pending',
    -- 'pending' | 'sent' | 'failed' | 'skipped' | 'permanent_failure'
  error_message     TEXT,
  retry_count       INTEGER     NOT NULL DEFAULT 0,
  max_retries       INTEGER     NOT NULL DEFAULT 3,
  next_retry_at     TIMESTAMPTZ,
  sent_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_queue_status_retry
  ON email_queue(status, next_retry_at)
  WHERE status IN ('pending','failed');

CREATE UNIQUE INDEX idx_email_queue_notif_recipient
  ON email_queue(notification_id, recipient_email);
  -- Prevents duplicate emails for the same notification+recipient
```

### email_queue RLS

```sql
ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;

-- Only service_role (Edge Function) reads/writes — no authenticated access
-- The Edge Function uses the service_role key
CREATE POLICY email_queue_none ON email_queue FOR ALL TO authenticated USING (false);
```

No authenticated user should ever read or write `email_queue` directly. All operations go through the Edge Function (service_role).

---

## 4. Which Events Send Emails

### Priority matrix

| Event type | Email to | Priority | Rationale |
|---|---|---|---|
| `client_request_created` | Admin/dispatcher | **High** | Requires human review and action |
| `client_request_cancelled` | Admin/dispatcher | **High** | May affect active scheduling |
| `admin_technician_assigned` | Assigned technician | **High** | Technician must be notified of new job |
| `technician_reassigned_away` | Old technician | **Medium** | Reassignment can affect technician planning |
| `technician_job_completed` | Admin + client contact | **High** | Admin confirms completion; client wants confirmation |
| `technician_field_note_added` | Admin/dispatcher | **Low** | Informational; can be deferred |
| `job_photo_uploaded` | Admin | **Low** | Skip for Phase 10P — too noisy |
| `client_request_photo_uploaded` | Admin | **Low** | Skip for Phase 10P — too noisy |
| `request_status_updated_client` | Client contact | **Medium** | Client wants to know their request moved forward |
| `request_converted_to_job` | Client contact | **Medium** | Client confirmation of conversion |
| `job_completed_client` | Client contact | **Medium** | Client job completion confirmation |

### Phase 10P scope (first release)

Send emails for: `client_request_created`, `client_request_cancelled`, `admin_technician_assigned`, `technician_reassigned_away`, `technician_job_completed`

Defer to Phase 10Q: `request_status_updated_client`, `request_converted_to_job`, `job_completed_client`, `technician_field_note_added`

Skip permanently: `job_photo_uploaded`, `client_request_photo_uploaded`

---

## 5. Recipient Rules

### Admin/dispatcher recipients

For events targeting `recipient_role = 'admin'`:
```sql
SELECT p.email, p.full_name
FROM profiles p
WHERE p.organization_id = $org_id
  AND p.role IN ('owner', 'admin', 'dispatcher')
  AND p.is_active = true
  AND p.email IS NOT NULL
  AND p.email != '';
```

**Sends one email per admin/dispatcher.** Org with 3 dispatchers → 3 emails.

### Technician recipients

For events targeting `recipient_profile_id` (technician):
```sql
SELECT p.email, p.full_name
FROM profiles p
WHERE p.id = $recipient_profile_id
  AND p.email IS NOT NULL;
```

### Client recipients

For events targeting `recipient_profile_id` (client):
```sql
SELECT cc.email, cc.full_name
FROM client_contacts cc
WHERE cc.profile_id = $recipient_profile_id
  AND cc.email IS NOT NULL;
```

---

## 6. Edge Function Structure

### `supabase/functions/process-notification-email/index.ts`

Triggered by:
1. **Database Webhook** — fires on INSERT to `notifications` table (primary path)
2. **Scheduled invocation** — runs every 5 minutes to retry failed `email_queue` rows

```typescript
// Pseudocode outline
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

export default async function handler(req: Request) {
  const payload = await req.json();
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const resend   = new Resend(RESEND_API_KEY);

  if (payload.type === "INSERT" && payload.table === "notifications") {
    // Webhook path: new notification
    const notification = payload.record;
    await processNotification(supabase, resend, notification);
  } else {
    // Scheduled retry path: process failed/pending email_queue rows
    await retryFailedEmails(supabase, resend);
  }
}

async function processNotification(supabase, resend, notif) {
  // 1. Check if this event_type should send email
  if (!EMAIL_EVENTS.includes(notif.event_type)) return;

  // 2. Look up recipient email(s)
  const recipients = await getRecipients(supabase, notif);

  // 3. For each recipient:
  for (const r of recipients) {
    // 4. Insert pending row in email_queue (deduplication via unique index)
    const queueRow = await insertEmailQueue(supabase, notif, r);
    if (!queueRow) continue; // duplicate — already queued

    // 5. Render email template
    const { subject, html } = renderTemplate(notif, r);

    // 6. Send via Resend
    try {
      await resend.emails.send({
        from:    FROM_ADDRESS,
        to:      r.email,
        subject,
        html,
      });
      await markSent(supabase, queueRow.id);
    } catch (err) {
      await markFailed(supabase, queueRow.id, err.message);
    }
  }
}
```

### Scheduled retry function

A **separate scheduled Edge Function** (`retry-email-queue`) runs every 5 minutes:

```typescript
// Picks up failed rows where retry_count < max_retries AND next_retry_at <= now()
const { data: retries } = await supabase
  .from("email_queue")
  .select("*")
  .in("status", ["pending", "failed"])
  .lte("next_retry_at", new Date().toISOString())
  .lt("retry_count", 3)
  .limit(50);
```

Scheduling is configured in the Supabase Edge Function cron settings (via Dashboard or `supabase.toml`). No `pg_cron` required.

---

## 7. Email Template Structure

All emails share a base layout:

```
┌─────────────────────────────────────────────────┐
│  JSG CamSecure                                  │
│  [logo or text header]                          │
├─────────────────────────────────────────────────┤
│                                                 │
│  [TITLE: notification.title]                    │
│                                                 │
│  [BODY: notification.body or rendered text]     │
│                                                 │
│  [ → View in Portal ]  ← CTA button            │
│    (links to APP_URL/[entity_type]/[entity_id]) │
│                                                 │
├─────────────────────────────────────────────────┤
│  © 2026 JSG CamSecure                           │
│  You received this because you are an admin/    │
│  dispatcher for [org_name].                     │
└─────────────────────────────────────────────────┘
```

### CTA URL by entity type

| `entity_type` | Admin portal URL | Client portal URL |
|---|---|---|
| `job` | `APP_URL/jobs/{entity_id}` | `APP_URL/client/jobs/{entity_id}` |
| `service_request` | `APP_URL/requests/{entity_id}` | `APP_URL/client/requests/{entity_id}` |

Recipient type determines which URL to use.

### Subject line format

| Event | Subject |
|---|---|
| `client_request_created` | `[CamSecure] New request: {title}` |
| `client_request_cancelled` | `[CamSecure] Request cancelled: {title}` |
| `admin_technician_assigned` | `[CamSecure] Job assignment: {title}` |
| `technician_reassigned_away` | `[CamSecure] Job reassignment: {title}` |
| `technician_job_completed` | `[CamSecure] Job completed: {title}` |

---

## 8. Retry and Failure Handling

### Retry backoff schedule

| Retry # | Delay | `next_retry_at` |
|---|---|---|
| 1 | 5 min | now() + 5 min |
| 2 | 30 min | now() + 30 min |
| 3 | 2 hours | now() + 2 hours |
| > 3 | Permanent failure | status = 'permanent_failure' |

```typescript
function nextRetryAt(retryCount: number): string {
  const delays = [5, 30, 120]; // minutes
  const mins   = delays[retryCount] ?? 0;
  return mins > 0
    ? new Date(Date.now() + mins * 60_000).toISOString()
    : null; // no more retries
}
```

### Permanent failure handling

Rows with `status = 'permanent_failure'`:
- Remain in `email_queue` for audit inspection
- Alert (optional): a separate admin notification or Supabase alert can fire when permanent failures occur
- A future cron job can archive rows older than 30 days

---

## 9. RLS and Security

### email_queue access

No authenticated user can access `email_queue`. The Edge Function uses `SUPABASE_SERVICE_ROLE_KEY` (a Supabase Vault secret, not exposed in client-side code).

### Edge Function secrets (Supabase Dashboard → Settings → Edge Function Secrets)

| Secret name | Value | Notes |
|---|---|---|
| `EMAIL_PROVIDER_API_KEY` | Resend/SendGrid API key | Never in .env or code |
| `EMAIL_FROM_ADDRESS` | `noreply@jsgcamsecure.com` | From address |
| `EMAIL_FROM_NAME` | `JSG CamSecure` | From name |
| `APP_URL` | `https://app.jsgcamsecure.com` | Portal URL for CTA links |

`SUPABASE_SERVICE_ROLE_KEY` is available automatically inside Deno Edge Functions via `Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")`.

### Database Webhook security

The webhook is configured to call the Edge Function URL with a shared secret header (`x-webhook-secret`). The Edge Function validates this header before processing. The secret is stored in Supabase Vault.

### Rate limiting

Inside the Edge Function, limit to 10 emails per webhook call. If an event somehow spawns more (e.g., org has 20 admins), queue the rest and process in the retry loop.

---

## 10. Required Environment Variables

### Supabase project (already available in Edge Functions)

| Variable | Source |
|---|---|
| `SUPABASE_URL` | Auto-injected |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-injected |
| `SUPABASE_ANON_KEY` | Auto-injected |

### Must be configured via Supabase Dashboard (Edge Function Secrets)

| Secret | Example | When needed |
|---|---|---|
| `EMAIL_PROVIDER_API_KEY` | `re_xxxxxxxxxx` | Before Phase 10P deploy |
| `EMAIL_FROM_ADDRESS` | `noreply@jsgcamsecure.com` | Before Phase 10P deploy |
| `EMAIL_FROM_NAME` | `JSG CamSecure Ops` | Before Phase 10P deploy |
| `APP_URL` | `https://app.jsgcamsecure.com` | Before Phase 10P deploy — must be the public URL |
| `WEBHOOK_SECRET` | Random 32-char string | For Database Webhook validation |

### `app/.env.local` — no new keys needed

The Next.js app does not call the email function directly. All email processing is server-side in the Edge Function.

---

## 11. Feature Flag: `email_alerts_enabled`

Add `email_alerts_enabled BOOLEAN DEFAULT false` to the `company_settings` table. The Edge Function checks this flag before sending any email:

```typescript
const { data: settings } = await supabase
  .from("company_settings")
  .select("email_alerts_enabled")
  .eq("organization_id", notif.organization_id)
  .single();

if (!settings?.email_alerts_enabled) return; // skip silently
```

This allows email to be toggled on/off per-org without code changes or redeployment.

---

## 12. Files Expected to Change

| File | Action | Description |
|---|---|---|
| `supabase/migrations/20260530000002_email_queue.sql` | **NEW** | `email_queue` table + index + feature flag column |
| `supabase/functions/process-notification-email/index.ts` | **NEW** | Webhook handler — sends emails on notification INSERT |
| `supabase/functions/retry-email-queue/index.ts` | **NEW** | Scheduled function — retries failed email_queue rows |
| `supabase/config.toml` | **MODIFIED** | Edge Function + cron schedule configuration |
| `src/app/(dashboard)/settings/page.tsx` (or similar) | **MODIFIED** | Add `email_alerts_enabled` toggle in Settings UI |

**Not changed:** `notifications` table, notification creation logic in app code, `NotificationBell`, RLS policies on `notifications`.

---

## 13. Verification Checklist

### A. Migration

| # | Check |
|---|---|
| 1 | `email_queue` table created with all columns + unique index + status index |
| 2 | `company_settings.email_alerts_enabled` column added, default false |
| 3 | No INSERT/UPDATE/DELETE access from `authenticated` role |

### B. Edge Function — Happy path

| # | Check |
|---|---|
| 4 | Insert a `client_request_created` notification → Edge Function fires |
| 5 | `email_queue` row created with `status = 'sent'` |
| 6 | Email received in test inbox with correct subject, body, CTA link |
| 7 | `sent_at` populated, no error_message |
| 8 | Unique index prevents duplicate queue row for same notif+recipient |

### C. Edge Function — Failure + retry

| # | Check |
|---|---|
| 9 | Simulate API key failure → `email_queue` row with `status = 'failed'`, `retry_count = 1`, `next_retry_at` set |
| 10 | Retry cron runs → picks up failed row, attempts send, updates to `sent` or increments retry |
| 11 | After 3 failures → `status = 'permanent_failure'`, no more retries |

### D. Feature flag

| # | Check |
|---|---|
| 12 | `email_alerts_enabled = false` → no email sent, no queue row |
| 13 | `email_alerts_enabled = true` → email sent normally |

### E. Event coverage

| # | Check |
|---|---|
| 14 | `client_request_created` → admin email sent |
| 15 | `client_request_cancelled` → admin email sent |
| 16 | `admin_technician_assigned` → technician email sent |
| 17 | `technician_reassigned_away` → old technician email sent |
| 18 | `technician_job_completed` → admin + client email sent |

### F. Non-email events do not queue

| # | Check |
|---|---|
| 19 | `job_photo_uploaded` → NO email queue row created |
| 20 | `client_request_photo_uploaded` → NO email queue row created |

### G. Build + lint

| # | Check |
|---|---|
| 21 | `npm run build` → 0 TypeScript errors, 28+ routes |
| 22 | `npm run lint` → 0 errors, 0 warnings |

### H. Cleanup

| # | Check |
|---|---|
| 23 | All test email_queue rows deleted |
| 24 | Test notifications cleared |
| 25 | `email_alerts_enabled` reset to false after testing |

---

## 14. Rollback Plan

### Level 1 — Feature flag rollback (30 seconds)

```sql
UPDATE company_settings SET email_alerts_enabled = false
WHERE organization_id = '[org_id]';
```

Immediately stops all email sending. In-app notifications continue unaffected.

### Level 2 — Webhook disable (2 minutes)

Disable the Database Webhook in Supabase Dashboard → Database → Webhooks. No code deploy needed.

### Level 3 — Edge Function undeploy (5 minutes)

```bash
supabase functions delete process-notification-email
supabase functions delete retry-email-queue
```

### Level 4 — Migration rollback

```sql
ALTER TABLE company_settings DROP COLUMN IF EXISTS email_alerts_enabled;
DROP TABLE IF EXISTS email_queue;
```

This does not affect `notifications` or in-app notification behavior in any way.

---

## 15. Open Questions

1. **Email provider**: Resend recommended (native Supabase integration, simple API). Confirm preferred provider before Phase 10P implementation.

2. **From address domain**: `noreply@jsgcamsecure.com` requires DNS verification (SPF, DKIM). Lead time 1-2 days. If domain not owned, use provider's sandbox domain for testing.

3. **Client-facing emails**: Phase 10P plan covers `job_completed_client` as medium priority. Confirm whether client email should be sent for job completion in Phase 10P or deferred to Phase 10Q.

4. **Unsubscribe**: Not required for transactional email by CAN-SPAM for B2B. If clients are consumers (not businesses), add unsubscribe link to Phase 10Q.

5. **Admin notification on email failure**: Should admins see an in-app notification if a critical email (e.g., technician assignment) permanently fails? Recommended: yes — add `email_delivery_failed` event type in Phase 10Q.

6. **Multi-admin deduplication**: If 3 admins are on the org, do we send 3 separate emails or 1 combined digest? Phase 10P: send individual. Phase 10Q: consider daily digest mode.

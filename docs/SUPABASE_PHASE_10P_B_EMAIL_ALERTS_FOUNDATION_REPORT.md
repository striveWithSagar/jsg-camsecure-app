# Phase 10P-B: Email Alerts Foundation — Implementation Report

**Date:** 2026-05-30  
**Status:** COMPLETE — awaiting commit approval  
**Base commit:** bfd5f8a

---

## 1. Summary

| Area | Result |
|---|---|
| `email_queue` table + RLS + feature flag migration | ✅ Applied |
| `company_settings.email_alerts_enabled` (default false) | ✅ Added |
| `email_queue_admin_select` read policy for admins | ✅ Added |
| `process-notification-email` Edge Function | ✅ Deployed (ACTIVE, v1) |
| `retry-email-queue` Edge Function | ✅ Deployed (ACTIVE, v1) |
| `tsconfig.json` updated to exclude `supabase/functions/` | ✅ |
| Build | ✅ 0 TypeScript errors · 28 routes |
| Lint | ✅ 0 errors · 0 warnings |
| Verification: 29/29 checks passed | ✅ |
| DB cleanup | ✅ 0 notifications · 0 email_queue rows |

---

## 2. Files Changed

| File | Action | Description |
|---|---|---|
| `supabase/migrations/20260530000002_email_queue.sql` | **NEW** | email_queue table, RLS, feature flag, admin read policy |
| `supabase/functions/process-notification-email/index.ts` | **NEW** | Webhook handler Edge Function |
| `supabase/functions/retry-email-queue/index.ts` | **NEW** | Retry worker Edge Function |
| `tsconfig.json` | **MODIFIED** | Added `supabase/functions` to `exclude` list |
| `docs/SUPABASE_PHASE_10P_B_EMAIL_ALERTS_FOUNDATION_REPORT.md` | **NEW** | This report |

---

## 3. Database Changes

### `company_settings.email_alerts_enabled`

```sql
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS email_alerts_enabled BOOLEAN NOT NULL DEFAULT false;
```

Per-org feature flag. All email sending is skipped when `false`. Enables zero-risk testing in staging and progressive rollout to production.

### `email_queue` table

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `organization_id` | uuid FK → organizations | Tenant scope |
| `notification_id` | uuid FK → notifications ON DELETE CASCADE | Cascade delete |
| `recipient_profile_id` | uuid nullable FK → profiles | For audit |
| `intended_recipient_email` | text | Real intended address (used for dedup) |
| `recipient_email` | text | Actual delivery target (may differ in test mode) |
| `recipient_name` | text nullable | For email display |
| `event_type` | text | Mirrors notifications.event_type |
| `subject` | text | Rendered subject line |
| `html_body` | text | Rendered HTML email |
| `status` | text | `queued` \| `sent` \| `failed` \| `permanently_failed` |
| `attempts` | integer | 0 = never attempted |
| `last_error` | text nullable | Last Resend error message |
| `next_retry_at` | timestamptz nullable | null when not retrying |
| `sent_at` | timestamptz nullable | |
| `created_at` / `updated_at` | timestamptz | |

**Deduplication index:** `UNIQUE(notification_id, intended_recipient_email)` — prevents duplicate sends on webhook re-delivery.

**Retry index:** `(status, next_retry_at) WHERE status IN ('queued','failed')`.

### RLS

| Policy | Who | Operations |
|---|---|---|
| `email_queue_block_authenticated` | All authenticated | Blocks ALL (INSERT/UPDATE/DELETE) |
| `email_queue_admin_select` | Admin/owner | SELECT for their org only |

Edge Functions use `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS) for all writes.

---

## 4. Edge Functions

### `process-notification-email` (slug: `process-notification-email`, verify_jwt: false)

**Trigger:** Supabase Database Webhook on `notifications` INSERT (see Section 7).  
**Also accepts:** Direct POST with `{ notification: {...} }` payload for testing.

**Flow:**
1. Validates `x-webhook-secret` header (if `WEBHOOK_SECRET` env var is set)
2. Parses notification record from payload
3. Skips if `event_type` not in supported set
4. Checks `company_settings.email_alerts_enabled` — returns `skipped` if false
5. Resolves recipients:
   - `recipient_role='admin'` → queries all active admin/dispatcher/owner profiles in org
   - `recipient_profile_id` → queries that specific profile
6. For each recipient:
   - Inserts `email_queue` row (unique index prevents dups)
   - Renders subject + HTML body
   - Sends via Resend (if `RESEND_API_KEY` configured)
   - Updates queue row to `sent` or `failed`
   - Respects `EMAIL_TEST_MODE` + `EMAIL_TEST_RECIPIENT`

**Supported event types (Phase 10P):**
- `client_request_created` → admin recipients
- `client_request_cancelled` → admin recipients
- `admin_technician_assigned` → technician (specific profile)
- `technician_reassigned_away` → old technician (specific profile)
- `technician_job_completed` → admin recipients

### `retry-email-queue` (slug: `retry-email-queue`, verify_jwt: false)

**Trigger:** Scheduled (see Section 7 for cron setup) or manual POST.

**Flow:**
1. Fetches `email_queue` rows where `status IN ('queued','failed')`, `attempts < 3`, `next_retry_at <= now()`
2. For each row: sends via Resend, updates status to `sent` or (`failed` / `permanently_failed`)
3. Skips immediately if `RESEND_API_KEY` not set

**Retry backoff:** 5 min → 30 min → 2 hours → permanently_failed (no more retries)

---

## 5. Test Mode Design

When `EMAIL_TEST_MODE=true` and `EMAIL_TEST_RECIPIENT` is set:
- `recipient_email` (actual delivery) → redirected to `EMAIL_TEST_RECIPIENT`
- `intended_recipient_email` → always the real address (for audit and deduplication)

This allows full end-to-end testing without emailing real users. The `UNIQUE(notification_id, intended_recipient_email)` dedup index works correctly in test mode because it uses the intended address, not the redirected address.

---

## 6. Required Edge Function Secrets (Dashboard Setup)

All secrets are configured via **Supabase Dashboard → Edge Functions → Manage Secrets**:

| Secret | Required | Description |
|---|---|---|
| `RESEND_API_KEY` | Yes (for actual sending) | Resend API key. Without this, rows are queued but not sent. |
| `EMAIL_FROM_ADDRESS` | Yes | From address, e.g. `noreply@jsgcamsecure.com` |
| `EMAIL_FROM_NAME` | Yes | From name, e.g. `JSG CamSecure` |
| `APP_URL` | Yes | Portal URL for CTA links, e.g. `https://app.jsgcamsecure.com` |
| `WEBHOOK_SECRET` | Recommended | Validates webhook authenticity via `x-webhook-secret` header |
| `EMAIL_TEST_MODE` | Optional | `true` to redirect all sends to `EMAIL_TEST_RECIPIENT` |
| `EMAIL_TEST_RECIPIENT` | Optional | Test inbox address when `EMAIL_TEST_MODE=true` |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected by Supabase.

---

## 7. Webhook and Cron Setup (Manual Dashboard Steps)

**These steps require Supabase Dashboard — cannot be scripted via migration.**

### Database Webhook for `process-notification-email`

1. Go to **Supabase Dashboard → Database → Webhooks**
2. Click **Create a new hook**
3. Configure:
   - **Name:** `on_notification_insert`
   - **Table:** `public.notifications`
   - **Events:** ✅ INSERT
   - **Type:** Supabase Edge Functions
   - **Function:** `process-notification-email`
   - **HTTP Headers:** `x-webhook-secret: [value of WEBHOOK_SECRET]`
4. Save

### Cron schedule for `retry-email-queue`

1. Go to **Supabase Dashboard → Edge Functions → retry-email-queue**
2. Click **Schedule** (or use pg_cron if enabled)
3. Set schedule: `*/5 * * * *` (every 5 minutes)
4. Alternatively via `pg_cron` once enabled:
   ```sql
   SELECT cron.schedule('retry-email-queue', '*/5 * * * *',
     $$SELECT net.http_post(
       url := 'https://[project].supabase.co/functions/v1/retry-email-queue',
       headers := '{"x-webhook-secret": "[secret]"}'::jsonb
     )$$);
   ```

---

## 8. Verification Results

### Checks 1–13 (29 individual assertions)

| Check | Scenario | Result |
|---|---|---|
| 1 | `email_alerts_enabled=false` → 0 queue rows, skipped=true | ✅ |
| 2 | `client_request_created` → queue row created, status=queued, correct subject+recipient | ✅ |
| 3 | `client_request_cancelled` → admin queue row | ✅ |
| 4 | `admin_technician_assigned` → technician queue row (Alex Rivera) | ✅ |
| 5 | `technician_reassigned_away` → old technician queue row, correct subject | ✅ |
| 6 | `technician_job_completed` → admin queue row | ✅ |
| 7 | Unsupported `job_photo_uploaded` → skipped=true, 0 rows | ✅ |
| 8 | Duplicate webhook call → unique index prevents duplicate row | ✅ |
| 9 | No API key → status=queued, attempts=0, html_body rendered | ✅ |
| 10 | `retry-email-queue` skips when no `RESEND_API_KEY` | ✅ |
| 11 | `permanently_failed` after 3 attempts (MCP SQL sim) | ✅ |
| 12 | Test mode: `intended_recipient_email` = real address, `recipient_email` = separate field | ✅ |
| 13 | Build 0 errors, lint 0 warnings | ✅ |

### Check 11 — MCP SQL verification

Inserted row at `status=failed, attempts=2` then simulated 3rd failure:
```json
{ "status": "permanently_failed", "attempts": 3, "last_error": "Resend 401: (attempt 3)", "next_retry_at": null }
```

Confirmed: after 3 failures the row transitions to `permanently_failed` and `next_retry_at=null`, blocking further retry.

---

## 9. Important Notes

### Why admin can't write `email_queue`

The `email_queue_block_authenticated` policy blocks all INSERT/UPDATE/DELETE from authenticated users. Only the Edge Function (service_role) can write. This prevents:
- Clients/technicians injecting fake email queue rows
- Admin accidentally modifying sent/failed status

### tsconfig.json change

Added `supabase/functions` to `exclude` list. Without this, Next.js TypeScript compilation tries to compile Deno-specific files (`jsr:` imports, `Deno.serve`) and fails. The Edge Functions are compiled and executed by Deno on Supabase's Edge runtime, not by the Next.js build.

### Queue stays `queued` until API key is set

When `RESEND_API_KEY` is not configured, the Edge Function creates the queue row but marks it `queued` without incrementing `attempts`. This means: once the API key is added, the retry function will pick up all pending rows and attempt delivery. **No emails are lost.**

---

## 10. Build and Lint

| Check | Result |
|---|---|
| `npm run build` | ✅ 0 TypeScript errors · 28 routes |
| `npm run lint` | ✅ 0 errors · 0 warnings |

---

## 11. DB Cleanup

| Resource | Final state |
|---|---|
| `notifications` | 0 rows |
| `email_queue` | 0 rows |
| `company_settings.email_alerts_enabled` | `false` |
| Admin hash | ✅ Restored |
| `verify-10pb.mjs` | Deleted |

---

## 12. Ready for Phase 10P-C

To activate email alerts:
1. Set `RESEND_API_KEY` and other secrets in Supabase Dashboard → Edge Functions → Manage Secrets
2. Configure the Database Webhook (Section 7)
3. Schedule `retry-email-queue` (Section 7)
4. Enable per org: `UPDATE company_settings SET email_alerts_enabled=true WHERE organization_id='...'`
5. For testing: also set `EMAIL_TEST_MODE=true` and `EMAIL_TEST_RECIPIENT=your@inbox.com`

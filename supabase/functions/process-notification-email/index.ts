import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Supported event types for Phase 10P ────────────────────────────────────────
const SUPPORTED_EVENTS = new Set([
  "client_request_created",
  "client_request_cancelled",
  "admin_technician_assigned",
  "technician_reassigned_away",
  "technician_job_completed",
]);

// ── Email subject lines ────────────────────────────────────────────────────────
function buildSubject(eventType: string, title: string): string {
  const prefixMap: Record<string, string> = {
    client_request_created:     "[CamSecure] New request",
    client_request_cancelled:   "[CamSecure] Request cancelled",
    admin_technician_assigned:  "[CamSecure] Job assigned to you",
    technician_reassigned_away: "[CamSecure] Job reassignment",
    technician_job_completed:   "[CamSecure] Job completed",
  };
  const prefix = prefixMap[eventType] ?? "[CamSecure] Notification";
  return `${prefix}: ${title}`;
}

// ── HTML email template ────────────────────────────────────────────────────────
function buildHtml(params: {
  title: string;
  body: string | null;
  ctaUrl: string;
  ctaLabel: string;
  orgName: string;
}): string {
  const { title, body, ctaUrl, ctaLabel, orgName } = params;
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
        <tr>
          <td style="background:#0f172a;padding:20px 32px;">
            <span style="color:#ffffff;font-size:18px;font-weight:bold;">CamSecure</span>
            <span style="color:#94a3b8;font-size:12px;margin-left:8px;">Operations</span>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <h2 style="margin:0 0 12px;color:#0f172a;font-size:20px;">${title}</h2>
            ${body ? `<p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">${body}</p>` : "<p style=\"margin:0 0 24px;\"></p>"}
            <a href="${ctaUrl}" style="display:inline-block;background:#3b82f6;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600;">
              ${ctaLabel} &rarr;
            </a>
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;">
            <p style="margin:0;color:#94a3b8;font-size:12px;">
              You received this notification because you are a member of <strong>${orgName}</strong> on JSG CamSecure.<br>
              This is a transactional alert.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── CTA URL helper ─────────────────────────────────────────────────────────────
function buildCtaUrl(appUrl: string, entityType: string, entityId: string, role: string): string {
  if (role === "client") {
    return entityType === "job"
      ? `${appUrl}/client/jobs/${entityId}`
      : `${appUrl}/client/requests/${entityId}`;
  }
  if (role === "technician") {
    return `${appUrl}/technician/jobs/${entityId}`;
  }
  return entityType === "job"
    ? `${appUrl}/jobs/${entityId}`
    : `${appUrl}/requests/${entityId}`;
}

// ── Send via Resend ────────────────────────────────────────────────────────────
async function sendViaResend(params: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: params.from,
      to:   [params.to],
      subject: params.subject,
      html:    params.html,
    }),
  });
  if (res.ok) return { ok: true };
  const errorBody = await res.text();
  return { ok: false, error: `Resend ${res.status}: ${errorBody.slice(0, 200)}` };
}

// ── Retry backoff ──────────────────────────────────────────────────────────────
function nextRetryAt(attempts: number): string | null {
  const delaysMin = [5, 30, 120];
  const mins = delaysMin[attempts];
  if (!mins) return null;
  return new Date(Date.now() + mins * 60_000).toISOString();
}

// ── Main handler ───────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  try {
    const supabaseUrl   = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const webhookSecret = Deno.env.get("WEBHOOK_SECRET") ?? "";
    const resendApiKey  = Deno.env.get("RESEND_API_KEY") ?? "";
    const fromAddress   = Deno.env.get("EMAIL_FROM_ADDRESS") ?? "noreply@jsgcamsecure.com";
    const fromName      = Deno.env.get("EMAIL_FROM_NAME") ?? "JSG CamSecure";
    const appUrl        = Deno.env.get("APP_URL") ?? "http://localhost:3000";
    const testMode      = Deno.env.get("EMAIL_TEST_MODE") === "true";
    const testRecipient = Deno.env.get("EMAIL_TEST_RECIPIENT") ?? "";

    // Webhook secret validation (skip if not configured)
    if (webhookSecret) {
      const incoming = req.headers.get("x-webhook-secret");
      if (incoming !== webhookSecret) {
        return new Response("Unauthorized", { status: 401 });
      }
    }

    const payload = await req.json();

    // Accept Supabase webhook format OR direct test call
    let notification: Record<string, unknown>;
    if (payload.type === "INSERT" && payload.table === "notifications") {
      notification = payload.record as Record<string, unknown>;
    } else if (payload.notification) {
      notification = payload.notification as Record<string, unknown>;
    } else {
      return new Response(JSON.stringify({ skipped: true, reason: "unknown payload" }), { status: 200 });
    }

    const eventType      = notification.event_type as string;
    const orgId          = notification.organization_id as string;
    const notifId        = notification.id as string;
    const entityType     = notification.entity_type as string;
    const entityId       = notification.entity_id as string;
    const title          = notification.title as string;
    const body           = (notification.body as string | null) ?? null;
    const recipientRole  = (notification.recipient_role as string | null) ?? null;
    const recipientProfId = (notification.recipient_profile_id as string | null) ?? null;

    if (!SUPPORTED_EVENTS.has(eventType)) {
      return new Response(JSON.stringify({ skipped: true, reason: `event_type '${eventType}' not in scope` }), { status: 200 });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: settings } = await supabase
      .from("company_settings")
      .select("email_alerts_enabled, business_name")
      .eq("organization_id", orgId)
      .maybeSingle();

    if (!settings?.email_alerts_enabled) {
      return new Response(JSON.stringify({ skipped: true, reason: "email_alerts_enabled=false" }), { status: 200 });
    }

    const orgName = settings.business_name ?? "JSG CamSecure";

    type Recipient = { profileId: string | null; email: string; name: string; role: string };
    const recipients: Recipient[] = [];

    if (recipientRole && ["admin","owner","dispatcher"].includes(recipientRole)) {
      const { data: admins } = await supabase
        .from("profiles")
        .select("id, email, full_name, role")
        .eq("organization_id", orgId)
        .in("role", ["owner","admin","dispatcher"])
        .eq("is_active", true)
        .not("email", "is", null);

      for (const a of admins ?? []) {
        if (a.email) recipients.push({ profileId: a.id, email: a.email, name: a.full_name ?? "", role: "admin" });
      }
    } else if (recipientProfId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, email, full_name, role")
        .eq("id", recipientProfId)
        .maybeSingle();

      if (profile?.email) {
        recipients.push({ profileId: profile.id, email: profile.email, name: profile.full_name ?? "", role: profile.role ?? "" });
      }
    }

    if (recipients.length === 0) {
      return new Response(JSON.stringify({ skipped: true, reason: "no recipients resolved" }), { status: 200 });
    }

    const results: Record<string, string>[] = [];

    for (const r of recipients) {
      const intendedEmail = r.email;
      const actualEmail   = (testMode && testRecipient) ? testRecipient : intendedEmail;
      const subject       = buildSubject(eventType, title);
      const ctaUrl        = buildCtaUrl(appUrl, entityType, entityId, r.role);
      const htmlBody      = buildHtml({ title, body, ctaUrl, ctaLabel: "View in Portal", orgName });

      // Insert queue row (unique index prevents duplicates)
      const { data: queueRow, error: insertErr } = await supabase
        .from("email_queue")
        .insert({
          organization_id:          orgId,
          notification_id:          notifId,
          recipient_profile_id:     r.profileId,
          intended_recipient_email: intendedEmail,
          recipient_email:          actualEmail,
          recipient_name:           r.name,
          event_type:               eventType,
          subject,
          html_body:                htmlBody,
          status:                   "queued",
        })
        .select("id")
        .single();

      if (insertErr) {
        if (insertErr.code === "23505") {
          results.push({ email: intendedEmail, result: "duplicate_skipped" });
          continue;
        }
        results.push({ email: intendedEmail, result: `insert_error: ${insertErr.message}` });
        continue;
      }

      const queueId = queueRow.id as string;

      // No API key → row stays queued for retry when key is configured
      if (!resendApiKey) {
        results.push({ email: intendedEmail, result: "queued_no_api_key" });
        continue;
      }

      const sendResult = await sendViaResend({
        apiKey:  resendApiKey,
        from:    `${fromName} <${fromAddress}>`,
        to:      actualEmail,
        subject,
        html:    htmlBody,
      });

      if (sendResult.ok) {
        await supabase.from("email_queue").update({
          status:   "sent",
          sent_at:  new Date().toISOString(),
          attempts: 1,
        }).eq("id", queueId);
        results.push({ email: intendedEmail, result: "sent" });
      } else {
        await supabase.from("email_queue").update({
          status:        "failed",
          attempts:      1,
          last_error:    sendResult.error,
          next_retry_at: nextRetryAt(1),
        }).eq("id", queueId);
        results.push({ email: intendedEmail, result: `failed: ${sendResult.error}` });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("process-notification-email error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});

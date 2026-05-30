import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type QueueRow = {
  id: string;
  organization_id: string;
  notification_id: string;
  intended_recipient_email: string;
  recipient_email: string;
  subject: string;
  html_body: string;
  status: string;
  attempts: number;
};

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

function nextRetryAt(attempts: number): string | null {
  const delaysMin = [5, 30, 120];
  const mins = delaysMin[attempts];
  if (!mins) return null;
  return new Date(Date.now() + mins * 60_000).toISOString();
}

Deno.serve(async (req: Request) => {
  try {
    const supabaseUrl   = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const webhookSecret = Deno.env.get("WEBHOOK_SECRET") ?? "";
    const resendApiKey  = Deno.env.get("RESEND_API_KEY") ?? "";
    const fromAddress   = Deno.env.get("EMAIL_FROM_ADDRESS") ?? "noreply@jsgcamsecure.com";
    const fromName      = Deno.env.get("EMAIL_FROM_NAME") ?? "JSG CamSecure";
    const testMode      = Deno.env.get("EMAIL_TEST_MODE") === "true";
    const testRecipient = Deno.env.get("EMAIL_TEST_RECIPIENT") ?? "";

    if (webhookSecret) {
      const incoming = req.headers.get("x-webhook-secret");
      if (incoming !== webhookSecret) {
        return new Response("Unauthorized", { status: 401 });
      }
    }

    if (!resendApiKey) {
      return new Response(JSON.stringify({ skipped: true, reason: "RESEND_API_KEY not configured" }), { status: 200 });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const now = new Date().toISOString();
    const { data: rows, error: fetchErr } = await supabase
      .from("email_queue")
      .select("*")
      .in("status", ["queued","failed"])
      .lt("attempts", 3)
      .or(`next_retry_at.is.null,next_retry_at.lte.${now}`)
      .order("created_at", { ascending: true })
      .limit(20);

    if (fetchErr) {
      return new Response(JSON.stringify({ error: fetchErr.message }), { status: 500 });
    }

    const results: { id: string; email: string; result: string }[] = [];

    for (const row of (rows ?? []) as QueueRow[]) {
      const actualEmail = (testMode && testRecipient) ? testRecipient : row.recipient_email;

      const sendResult = await sendViaResend({
        apiKey:  resendApiKey,
        from:    `${fromName} <${fromAddress}>`,
        to:      actualEmail,
        subject: row.subject,
        html:    row.html_body,
      });

      const newAttempts = row.attempts + 1;

      if (sendResult.ok) {
        await supabase.from("email_queue").update({
          status:     "sent",
          sent_at:    new Date().toISOString(),
          attempts:   newAttempts,
          last_error: null,
        }).eq("id", row.id);
        results.push({ id: row.id, email: row.intended_recipient_email, result: "sent" });
      } else {
        const isPermanent = newAttempts >= 3;
        await supabase.from("email_queue").update({
          status:        isPermanent ? "permanently_failed" : "failed",
          attempts:      newAttempts,
          last_error:    sendResult.error,
          next_retry_at: !isPermanent ? nextRetryAt(newAttempts) : null,
        }).eq("id", row.id);
        results.push({ id: row.id, email: row.intended_recipient_email, result: isPermanent ? "permanently_failed" : `retry_${newAttempts}` });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("retry-email-queue error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});

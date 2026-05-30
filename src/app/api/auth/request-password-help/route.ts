import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

// ── Anti-enumeration: always return the same response ─────────────────────────
// Factory function — creates a fresh response each call (Response body is consumed once)
function ok() { return NextResponse.json({ success: true }, { status: 200 }); }

// ── Rate limit recommendation ──────────────────────────────────────────────────
// This endpoint should be rate-limited at the edge/middleware level in production.
// Recommended: max 5 requests per IP per 15 minutes via middleware or Cloudflare rules.
// Not implemented here — out of scope for this phase.

export async function POST(req: NextRequest): Promise<NextResponse> {
  let email: string;
  let role: string;

  try {
    const body = await req.json();
    email = String(body.email ?? "").trim().toLowerCase();
    role  = String(body.role  ?? "").trim();
  } catch {
    return ok(); // malformed body — same response (anti-enumeration)
  }

  // Validate inputs — but always return OK to prevent enumeration
  if (!email || !["client", "technician"].includes(role)) return ok();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))          return ok();

  try {
    const admin = createServiceRoleClient();

    // Look up profile by email + role (service_role bypasses RLS safely)
    const { data: profile } = await admin
      .from("profiles")
      .select("id, full_name, role, is_active, organization_id")
      .eq("email", email)
      .eq("role",  role)
      .maybeSingle();

    // No matching profile → silent success (anti-enumeration)
    if (!profile) return ok();

    // Resolve the entity id for admin notification navigation
    let entityType: string;
    let entityId:   string;

    if (role === "client") {
      const { data: contact } = await admin
        .from("client_contacts")
        .select("client_id")
        .eq("profile_id", profile.id)
        .maybeSingle();
      if (!contact?.client_id) return ok(); // no linked client account
      entityType = "client";
      entityId   = contact.client_id;
    } else {
      const { data: tech } = await admin
        .from("technicians")
        .select("id")
        .eq("profile_id", profile.id)
        .maybeSingle();
      if (!tech?.id) return ok(); // no linked technician record
      entityType = "technician";
      entityId   = tech.id;
    }

    // Notify admin regardless of is_active status.
    // If inactive: notification body makes it clear so admin can investigate.
    const isInactive = !profile.is_active;
    const title = isInactive
      ? "Password help requested (inactive account)"
      : "Password help requested";
    const body = isInactive
      ? `${profile.full_name} (${email}) requested password help. Note: this ${role} account is currently inactive.`
      : `${profile.full_name} (${email}) requested help resetting their ${role} portal password.`;

    await admin.from("notifications").insert({
      organization_id: profile.organization_id,
      recipient_role:  "admin",
      actor_profile_id: null,
      event_type:  "account_password_help_requested",
      title,
      body,
      entity_type: entityType,
      entity_id:   entityId,
    });
  } catch (err) {
    console.error("[request-password-help]", err);
    // Still return OK — do not leak server errors to the requester
  }

  return ok();
}

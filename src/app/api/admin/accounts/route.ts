import { NextRequest, NextResponse }  from "next/server";
import { createClient }              from "@/lib/supabase/server";
import { createClient as createSbClient } from "@supabase/supabase-js";
import { createServiceRoleClient }   from "@/lib/supabase/service-role";

// ── Types ──────────────────────────────────────────────────────────────────────

type ActionResult =
  | { success: true;  data: Record<string, unknown> }
  | { success: false; error: string; code?: string };

// ── Auth guard ─────────────────────────────────────────────────────────────────
// Accepts both cookie-based sessions (browser) and Authorization Bearer token
// (API clients / server-to-server calls).

async function verifyAdmin(req: NextRequest): Promise<
  | { ok: true;  userId: string; orgId: string }
  | { ok: false; status: 401 | 403; message: string }
> {
  const authHeader  = req.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  // Build an authenticated Supabase client so auth.uid() is set in RLS context
  let authedClient;
  if (bearerToken) {
    // API clients (test scripts, server-to-server): create client with Bearer token
    authedClient = createSbClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { global: { headers: { Authorization: `Bearer ${bearerToken}` } }, auth: { autoRefreshToken: false, persistSession: false } }
    );
  } else {
    // Browser clients: use cookie-based session
    authedClient = await createClient();
  }

  const { data: { user }, error: authErr } = await authedClient.auth.getUser();
  if (authErr || !user) {
    return { ok: false, status: 401, message: "Not authenticated" };
  }

  const { data: profile } = await authedClient
    .from("profiles")
    .select("role, organization_id")
    .eq("id", user.id)
    .single();

  if (!profile || !["owner", "admin"].includes(profile.role)) {
    return { ok: false, status: 403, message: "Admin or owner access required" };
  }

  return { ok: true, userId: user.id, orgId: profile.organization_id as string };
}

// ── Validation helpers ─────────────────────────────────────────────────────────

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function validatePassword(password: string): string | null {
  if (!password || password.length < 8) return "Password must be at least 8 characters";
  return null;
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map(n => n[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");
}

// ── Action: create_client_account ──────────────────────────────────────────────

async function createClientAccount(
  body: Record<string, unknown>,
  orgId: string,
): Promise<ActionResult> {
  const email       = String(body.email       ?? "").trim().toLowerCase();
  const password    = String(body.password    ?? "");
  const companyName = String(body.companyName ?? "").trim();
  const contactName = String(body.contactName ?? "").trim();
  const phone       = String(body.phone       ?? "").trim();
  const address     = String(body.address     ?? "").trim();
  const notes       = String(body.notes       ?? "").trim();

  if (!validateEmail(email))   return { success: false, error: "Valid email is required" };
  const pwErr = validatePassword(password);
  if (pwErr)                   return { success: false, error: pwErr };
  if (!companyName)            return { success: false, error: "Company name is required" };
  if (!contactName)            return { success: false, error: "Contact name is required" };

  const admin = createServiceRoleClient();

  // 1. Create auth user
  const { data: authData, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: contactName, role: "client" },
  });
  if (authErr || !authData.user) {
    if (authErr?.message?.toLowerCase().includes("already")) {
      return { success: false, error: "A user with this email already exists", code: "email_taken" };
    }
    return { success: false, error: authErr?.message ?? "Failed to create auth user" };
  }
  const authUserId = authData.user.id;

  try {
    // 2. Insert profile
    const { error: profErr } = await admin.from("profiles").insert({
      id:              authUserId,
      organization_id: orgId,
      role:            "client",
      full_name:       contactName,
      email,
      phone:           phone || null,
      initials:        initials(contactName),
      is_active:       true,
    });
    if (profErr) throw new Error(`Profile insert: ${profErr.message}`);

    // 3. Insert client row
    const { data: clientRow, error: clientErr } = await admin
      .from("clients")
      .insert({
        organization_id: orgId,
        name:            companyName,
        status:          "active",
        address:         address || null,
        notes:           notes   || null,
      })
      .select("id")
      .single();
    if (clientErr || !clientRow) throw new Error(`Client insert: ${clientErr?.message}`);

    // 4. Insert primary client_contact linking the portal user
    const { error: contactErr } = await admin.from("client_contacts").insert({
      organization_id: orgId,
      client_id:       clientRow.id,
      profile_id:      authUserId,
      full_name:       contactName,
      email,
      phone:           phone || null,
      is_primary:      true,
    });
    if (contactErr) throw new Error(`Client contact insert: ${contactErr.message}`);

    return {
      success: true,
      data: {
        profileId:   authUserId,
        clientId:    clientRow.id,
        email,
        companyName,
        contactName,
      },
    };
  } catch (err) {
    // Rollback: delete the auth user so we don't leave orphaned auth accounts
    await admin.auth.admin.deleteUser(authUserId);
    return { success: false, error: String(err) };
  }
}

// ── Action: create_technician_account ─────────────────────────────────────────

async function createTechnicianAccount(
  body: Record<string, unknown>,
  orgId: string,
): Promise<ActionResult> {
  const email     = String(body.email     ?? "").trim().toLowerCase();
  const password  = String(body.password  ?? "");
  const fullName  = String(body.fullName  ?? "").trim();
  const phone     = String(body.phone     ?? "").trim();
  const specialty = String(body.specialty ?? "").trim();

  if (!validateEmail(email))   return { success: false, error: "Valid email is required" };
  const pwErr = validatePassword(password);
  if (pwErr)                   return { success: false, error: pwErr };
  if (!fullName)               return { success: false, error: "Full name is required" };

  const admin = createServiceRoleClient();

  // 1. Create auth user
  const { data: authData, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role: "technician" },
  });
  if (authErr || !authData.user) {
    if (authErr?.message?.toLowerCase().includes("already")) {
      return { success: false, error: "A user with this email already exists", code: "email_taken" };
    }
    return { success: false, error: authErr?.message ?? "Failed to create auth user" };
  }
  const authUserId = authData.user.id;

  try {
    // 2. Insert profile
    const { error: profErr } = await admin.from("profiles").insert({
      id:              authUserId,
      organization_id: orgId,
      role:            "technician",
      full_name:       fullName,
      email,
      phone:           phone || null,
      initials:        initials(fullName),
      is_active:       true,
    });
    if (profErr) throw new Error(`Profile insert: ${profErr.message}`);

    // 3. Insert technician row
    const { data: techRow, error: techErr } = await admin
      .from("technicians")
      .insert({
        organization_id: orgId,
        profile_id:      authUserId,
        specialty:       specialty || null,
        status:          "available",
        is_active:       true,
      })
      .select("id")
      .single();
    if (techErr || !techRow) throw new Error(`Technician insert: ${techErr?.message}`);

    return {
      success: true,
      data: {
        profileId:     authUserId,
        technicianId:  techRow.id,
        email,
        fullName,
      },
    };
  } catch (err) {
    await admin.auth.admin.deleteUser(authUserId);
    return { success: false, error: String(err) };
  }
}

// ── Action: deactivate_account ────────────────────────────────────────────────

async function deactivateAccount(
  body: Record<string, unknown>,
  orgId: string,
): Promise<ActionResult> {
  const profileId = String(body.profileId ?? "").trim();
  const role      = String(body.role      ?? "").trim();

  if (!profileId) return { success: false, error: "profileId is required" };
  if (!["client","technician"].includes(role)) {
    return { success: false, error: "role must be client or technician" };
  }

  const admin = createServiceRoleClient();
  const now   = new Date().toISOString();

  // Verify profile belongs to this org
  const { data: profile } = await admin.from("profiles")
    .select("organization_id, is_active").eq("id", profileId).single();
  if (!profile || profile.organization_id !== orgId) {
    return { success: false, error: "Profile not found in this organization" };
  }
  if (!profile.is_active) {
    return { success: false, error: "Account is already deactivated" };
  }

  if (role === "technician") {
    // Hard block: technician must have no active jobs before deactivation
    const { data: tech } = await admin.from("technicians")
      .select("id").eq("profile_id", profileId).single();

    if (tech) {
      const { data: activeJobs } = await admin.from("jobs")
        .select("id, job_number")
        .eq("technician_id", tech.id)
        .in("status", ["assigned", "on_the_way", "started", "in_progress", "needs_parts"]);

      if (activeJobs && activeJobs.length > 0) {
        const jobLabels = activeJobs
          .map(j => j.job_number ? `JOB-${String(j.job_number).padStart(4, "0")}` : "(no number)")
          .join(", ");
        return {
          success: false,
          error: `This technician has ${activeJobs.length} active job${activeJobs.length !== 1 ? "s" : ""}. Reassign or complete those jobs before deactivating. Active jobs: ${jobLabels}`,
        };
      }

      // No active jobs — deactivate technician row
      await admin.from("technicians").update({ is_active: false }).eq("profile_id", profileId);
    }
  }

  // Deactivate profile
  const { error: profErr } = await admin.from("profiles")
    .update({ is_active: false, deactivated_at: now })
    .eq("id", profileId);
  if (profErr) return { success: false, error: `Profile update failed: ${profErr.message}` };

  return {
    success: true,
    data: { profileId, deactivatedAt: now },
  };
}

// ── Action: reactivate_account ────────────────────────────────────────────────

async function reactivateAccount(
  body: Record<string, unknown>,
  orgId: string,
): Promise<ActionResult> {
  const profileId = String(body.profileId ?? "").trim();
  const role      = String(body.role      ?? "").trim();

  if (!profileId) return { success: false, error: "profileId is required" };
  if (!["client","technician"].includes(role)) {
    return { success: false, error: "role must be client or technician" };
  }

  const admin = createServiceRoleClient();

  const { data: profile } = await admin.from("profiles")
    .select("organization_id, is_active").eq("id", profileId).single();
  if (!profile || profile.organization_id !== orgId) {
    return { success: false, error: "Profile not found in this organization" };
  }
  if (profile.is_active) {
    return { success: false, error: "Account is already active" };
  }

  const { error: profErr } = await admin.from("profiles")
    .update({ is_active: true, deactivated_at: null })
    .eq("id", profileId);
  if (profErr) return { success: false, error: `Profile update failed: ${profErr.message}` };

  if (role === "technician") {
    await admin.from("technicians").update({ is_active: true }).eq("profile_id", profileId);
  }

  return { success: true, data: { profileId, reactivated: true } };
}

// ── Action: reset_account_password ────────────────────────────────────────────

async function resetAccountPassword(
  body: Record<string, unknown>,
  orgId: string,
): Promise<ActionResult> {
  const profileId   = String(body.profileId   ?? "").trim();
  const newPassword = String(body.newPassword ?? "");

  if (!profileId) return { success: false, error: "profileId is required" };
  const pwErr = validatePassword(newPassword);
  if (pwErr)      return { success: false, error: pwErr };

  const admin = createServiceRoleClient();

  // Verify profile belongs to this org
  const { data: profile } = await admin.from("profiles")
    .select("organization_id").eq("id", profileId).single();
  if (!profile || profile.organization_id !== orgId) {
    return { success: false, error: "Profile not found in this organization" };
  }

  // profiles.id = auth.users.id — use it directly as the auth user ID
  const { error: resetErr } = await admin.auth.admin.updateUserById(profileId, {
    password: newPassword,
  });
  if (resetErr) return { success: false, error: `Password reset failed: ${resetErr.message}` };

  return { success: true, data: { profileId, passwordReset: true } };
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Verify the caller is an authenticated admin/owner
  const guard = await verifyAdmin(req);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.message }, { status: guard.status });
  }
  const { orgId } = guard;

  // 2. Parse body
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const action = String(body.action ?? "").trim();
  if (!action) {
    return NextResponse.json({ error: "action is required" }, { status: 400 });
  }

  // 3. Dispatch to action handler (wrapped so unhandled throws return clean JSON)
  let result: ActionResult;

  try {
    switch (action) {
      case "create_client_account":
        result = await createClientAccount(body, orgId);
        break;
      case "create_technician_account":
        result = await createTechnicianAccount(body, orgId);
        break;
      case "deactivate_account":
        result = await deactivateAccount(body, orgId);
        break;
      case "reactivate_account":
        result = await reactivateAccount(body, orgId);
        break;
      case "reset_account_password":
        result = await resetAccountPassword(body, orgId);
        break;
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err) {
    console.error("[/api/admin/accounts]", err);
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }

  if (!result.success) {
    const status = result.code === "email_taken" ? 409 : 400;
    return NextResponse.json({ error: result.error, code: result.code }, { status });
  }

  return NextResponse.json(result.data, { status: 200 });
}

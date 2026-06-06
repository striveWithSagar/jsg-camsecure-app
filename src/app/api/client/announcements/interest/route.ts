import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  // Verify client auth
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, organization_id")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "client") {
    return NextResponse.json({ error: "Client access required" }, { status: 403 });
  }

  const orgId = profile.organization_id as string;

  // Get client_id from client_contacts
  const { data: contact } = await supabase
    .from("client_contacts")
    .select("client_id, clients(name)")
    .eq("profile_id", user.id)
    .single() as { data: { client_id: string; clients: { name: string } | null } | null; error: unknown };

  const clientId   = contact?.client_id ?? null;
  const clientName = contact?.clients?.name ?? "A client";

  // Parse body
  let body: { announcement_id?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { announcement_id, message } = body;
  if (!announcement_id) {
    return NextResponse.json({ error: "announcement_id is required" }, { status: 400 });
  }

  // Verify announcement exists and is published (client RLS enforces this on select)
  const { data: ann } = await supabase
    .from("client_announcements")
    .select("id, title")
    .eq("id", announcement_id)
    .single();

  if (!ann) {
    return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
  }

  // Insert interest row
  const { error: interestErr } = await supabase
    .from("client_announcement_interests")
    .insert({
      organization_id: orgId,
      announcement_id,
      client_id:       clientId,
      profile_id:      user.id,
      message:         message ?? null,
    });

  if (interestErr) {
    return NextResponse.json({ error: interestErr.message }, { status: 500 });
  }

  // Insert admin notification
  await supabase.from("notifications").insert({
    organization_id:      orgId,
    actor_profile_id:     user.id,
    recipient_role:       "admin",
    event_type:           "client_announcement_interest",
    title:                "Client interested in deal",
    body:                 `${clientName} is interested in "${ann.title as string}".`,
    entity_type:          "announcement",
    entity_id:            announcement_id,
  });

  return NextResponse.json({ ok: true });
}

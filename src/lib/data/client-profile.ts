import { createClient } from "@/lib/supabase/server";

export type ClientProfileData = {
  name:        string;
  email:       string;
  initials:    string;
  role:        string;
  companyName: string;
  clientId:    string;
  contactId:   string;
  orgId:       string;
  phone:       string;
};

function deriveInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.map(p => p[0] ?? "").join("").toUpperCase().slice(0, 2) || "C";
}

type ContactRow = {
  id:         string;
  phone:      string | null;
  client_id:  string;
  clients: {
    name:            string;
    organization_id: string;
  } | null;
};

export async function getCurrentClientProfile(): Promise<ClientProfileData | null> {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, role, initials")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "client") return null;

  const { data: contact } = await supabase
    .from("client_contacts")
    .select("id, phone, client_id, clients(name, organization_id)")
    .eq("profile_id", user.id)
    .single() as { data: ContactRow | null; error: unknown };

  if (!contact || !contact.clients) return null;

  const name     = profile.full_name ?? user.email?.split("@")[0] ?? "Client";
  const email    = profile.email     ?? user.email ?? "";
  const initials = profile.initials  ?? deriveInitials(name);

  return {
    name,
    email,
    initials,
    role:        "client",
    companyName: contact.clients.name,
    clientId:    contact.client_id,
    contactId:   contact.id,
    orgId:       contact.clients.organization_id,
    phone:       contact.phone ?? "",
  };
}

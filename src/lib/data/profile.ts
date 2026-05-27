import { createClient } from "@/lib/supabase/server";

export type ProfileData = {
  name:     string;
  email:    string;
  initials: string;
  role:     string;
};

function deriveInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.map(p => p[0] ?? "").join("").toUpperCase().slice(0, 2) || "A";
}

export async function getCurrentProfile(): Promise<ProfileData | null> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, role, initials")
    .eq("id", user.id)
    .single();

  const name     = profile?.full_name ?? user.email?.split("@")[0] ?? "Admin";
  const email    = profile?.email     ?? user.email ?? "";
  const role     = profile?.role      ?? "admin";
  const initials = profile?.initials  ?? deriveInitials(name);

  return { name, email, initials, role };
}

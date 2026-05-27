import { notFound } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { getOrgSettings } from "@/lib/data/settings";
import { createClient } from "@/lib/supabase/server";
import { SettingsClient } from "./SettingsClient";

export default async function SettingsPage() {
  const supabase = await createClient();

  const [settings, { data: { user } }] = await Promise.all([
    getOrgSettings(),
    supabase.auth.getUser(),
  ]);

  if (!settings || !user) notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .single();

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Settings" subtitle="Organization & account configuration" />
      <SettingsClient
        settings={settings}
        userId={user.id}
        adminName={profile?.full_name ?? user.email?.split("@")[0] ?? "Admin"}
        adminEmail={profile?.email ?? user.email ?? ""}
      />
    </div>
  );
}

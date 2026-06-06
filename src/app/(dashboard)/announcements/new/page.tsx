import { notFound } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { AnnouncementForm } from "@/components/announcements/AnnouncementForm";
import { createClient } from "@/lib/supabase/server";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "New Announcement · CamSecure" };

export default async function NewAnnouncementPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();
  if (!profile?.organization_id) notFound();

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="New Announcement" subtitle="Create a news post or deal for clients" />
      <div className="flex-1 px-6 py-6">
        <Link
          href="/announcements"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-3 w-3" /> Back to Announcements
        </Link>
        <AnnouncementForm mode="create" orgId={profile.organization_id} />
      </div>
    </div>
  );
}

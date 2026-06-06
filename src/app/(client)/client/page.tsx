import type { Metadata } from "next";
import { getCurrentClientProfile } from "@/lib/data/client-profile";
import { getClientJobs, getClientInvoices } from "@/lib/data/client-portal";
import { getAnnouncementsForClient } from "@/lib/data/announcements";
import { getOrgSettings } from "@/lib/data/settings";
import { createClient } from "@/lib/supabase/server";
import { ClientDashboardView } from "./ClientDashboardView";
import type { AnnouncementRow } from "@/lib/data/announcements";

export const metadata: Metadata = { title: "Overview · CamSecure Client Portal" };

async function resolveSignedUrls(
  announcements: AnnouncementRow[]
): Promise<Record<string, string>> {
  const withPosters = announcements.filter(a => a.posterPath);
  if (withPosters.length === 0) return {};
  const supabase = await createClient();
  const map: Record<string, string> = {};
  await Promise.all(
    withPosters.map(async a => {
      const { data } = await supabase.storage
        .from("camsecure-media")
        .createSignedUrl(a.posterPath!, 3600);
      if (data?.signedUrl) map[a.id] = data.signedUrl;
    })
  );
  return map;
}

export default async function ClientPage() {
  const [profile, jobs, invoices, announcements, settings] = await Promise.all([
    getCurrentClientProfile(),
    getClientJobs(),
    getClientInvoices(),
    getAnnouncementsForClient(),
    getOrgSettings(),
  ]);

  const posterUrls = await resolveSignedUrls(announcements);

  return (
    <ClientDashboardView
      profile={profile}
      jobs={jobs}
      invoices={invoices}
      announcements={announcements}
      posterUrls={posterUrls}
      googleReviewUrl={settings?.googleReviewUrl ?? ""}
    />
  );
}

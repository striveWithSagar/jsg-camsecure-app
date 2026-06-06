import { notFound } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { AnnouncementForm } from "@/components/announcements/AnnouncementForm";
import { getAnnouncementDetail } from "@/lib/data/announcements";
import { createClient } from "@/lib/supabase/server";
import { ArrowLeft, Users } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Edit Announcement · CamSecure" };

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default async function EditAnnouncementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();
  if (!profile?.organization_id) notFound();

  const detail = await getAnnouncementDetail(id);
  if (!detail) notFound();

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Edit Announcement" subtitle={detail.title} />
      <div className="flex-1 px-6 py-6 space-y-8">
        <div>
          <Link
            href="/announcements"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-6"
          >
            <ArrowLeft className="h-3 w-3" /> Back to Announcements
          </Link>
          <AnnouncementForm mode="edit" initial={detail} orgId={profile.organization_id} />
        </div>

        {/* Interests panel */}
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">
              Client Interests <span className="text-muted-foreground font-normal">({detail.interests.length})</span>
            </h2>
          </div>
          {detail.interests.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 border border-dashed border-border rounded-lg text-center">
              No clients have expressed interest yet.
            </p>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">Client</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5 hidden sm:table-cell">Message</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5 whitespace-nowrap">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.interests.map(i => (
                    <tr key={i.id} className="border-b border-border/50 last:border-0">
                      <td className="px-4 py-2.5 text-sm font-medium text-foreground">
                        {i.clientName ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground hidden sm:table-cell">
                        {i.message ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                        {fmtDate(i.clickedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

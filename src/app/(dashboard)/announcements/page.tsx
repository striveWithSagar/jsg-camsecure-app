import { TopBar } from "@/components/layout/TopBar";
import { getAnnouncements } from "@/lib/data/announcements";
import { AnnouncementsTable } from "@/components/announcements/AnnouncementsTable";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Announcements · CamSecure" };

export default async function AnnouncementsPage() {
  const announcements = await getAnnouncements();
  const published   = announcements.filter(a => a.isPublished).length;
  const totalInterests = announcements.reduce((sum, a) => sum + a.interestCount, 0);

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar
        title="Announcements"
        subtitle={`${announcements.length} total · ${published} published`}
      />

      <div className="flex-1 px-6 py-6 space-y-5">

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-5 text-sm">
            <span className="text-2xl font-semibold text-foreground">{announcements.length}</span>
            <span className="text-muted-foreground">announcements ·</span>
            <span className="text-c-success">{published} published</span>
            {totalInterests > 0 && (
              <>
                <span className="text-muted-foreground">·</span>
                <span className="text-primary">{totalInterests} interests</span>
              </>
            )}
          </div>
          <Link href="/announcements/new">
            <Button size="sm" className="h-8 gap-1.5 text-xs">
              <Plus className="h-3.5 w-3.5" />
              New Announcement
            </Button>
          </Link>
        </div>

        <AnnouncementsTable rows={announcements} />

      </div>
    </div>
  );
}

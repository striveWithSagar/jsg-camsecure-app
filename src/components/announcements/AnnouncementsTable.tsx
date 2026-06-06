"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Pencil, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AnnouncementRow } from "@/lib/data/announcements";
import Link from "next/link";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
}

export function AnnouncementsTable({ rows }: { rows: AnnouncementRow[] }) {
  const router = useRouter();
  const [toggling, setToggling] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function togglePublish(row: AnnouncementRow) {
    setToggling(row.id);
    const supabase = createClient();
    const { error } = await supabase
      .from("client_announcements")
      .update({ is_published: !row.isPublished })
      .eq("id", row.id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(row.isPublished ? "Announcement unpublished" : "Announcement published");
      router.refresh();
    }
    setToggling(null);
  }

  async function deleteAnnouncement(row: AnnouncementRow) {
    if (!confirm(`Delete "${row.title}"? This cannot be undone.`)) return;
    setDeleting(row.id);
    const supabase = createClient();
    // Delete poster from storage if present
    if (row.posterPath) {
      await supabase.storage.from("camsecure-media").remove([row.posterPath]);
    }
    const { error } = await supabase
      .from("client_announcements")
      .delete()
      .eq("id", row.id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Announcement deleted");
      router.refresh();
    }
    setDeleting(null);
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-14 rounded-lg border border-dashed border-border text-center">
        <p className="text-sm font-medium text-muted-foreground">No announcements yet</p>
        <p className="text-xs text-muted-foreground/60">Create your first announcement to share deals and news with clients.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Title</th>
            <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 hidden sm:table-cell">Window</th>
            <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 hidden md:table-cell">Interests</th>
            <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Status</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
              <td className="px-4 py-3">
                <p className="font-medium text-foreground leading-tight">{row.title}</p>
                {row.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{row.description}</p>
                )}
              </td>
              <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell whitespace-nowrap">
                {row.startsAt || row.endsAt
                  ? `${fmtDate(row.startsAt)} – ${fmtDate(row.endsAt)}`
                  : "Always"}
              </td>
              <td className="px-4 py-3 hidden md:table-cell">
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  {row.interestCount}
                </span>
              </td>
              <td className="px-4 py-3">
                <button
                  onClick={() => togglePublish(row)}
                  disabled={toggling === row.id}
                  className={cn(
                    "inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded border transition-colors",
                    row.isPublished
                      ? "text-[oklch(0.72_0.135_155)] bg-[oklch(0.72_0.135_155_/_0.10)] border-[oklch(0.72_0.135_155_/_0.25)] hover:bg-[oklch(0.72_0.135_155_/_0.18)]"
                      : "text-muted-foreground bg-muted/30 border-border hover:bg-muted/60"
                  )}
                >
                  {toggling === row.id ? "…" : row.isPublished ? "Published" : "Draft"}
                </button>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1 justify-end">
                  <Link href={`/announcements/${row.id}/edit`}>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => deleteAnnouncement(row)}
                    disabled={deleting === row.id}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

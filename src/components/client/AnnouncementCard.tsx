"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ImageIcon, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AnnouncementRow } from "@/lib/data/announcements";

type Props = {
  announcement: AnnouncementRow;
  posterUrl:    string | null;
};

export function AnnouncementCard({ announcement, posterUrl }: Props) {
  const [interested, setInterested] = useState(false);
  const [loading,    setLoading]    = useState(false);

  async function handleInterest() {
    if (interested || loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/client/announcements/interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ announcement_id: announcement.id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Request failed");
      }
      setInterested(true);
      toast.success("Thank you — we'll be in touch!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ borderColor: "var(--cp-orange-border)" }}
    >
      {/* Poster */}
      {posterUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={posterUrl}
          alt={announcement.title}
          className="w-full max-h-56 object-cover"
        />
      ) : (
        <div
          className="w-full h-32 flex items-center justify-center"
          style={{ background: "var(--cp-orange-dim)" }}
        >
          <ImageIcon className="h-10 w-10 opacity-30" style={{ color: "var(--cp-orange-text)" }} />
        </div>
      )}

      {/* Content */}
      <div className="px-5 py-5 space-y-3" style={{ background: "oklch(0.10 0.022 252 / 0.6)" }}>
        <h3 className="cp-heading text-base font-semibold" style={{ color: "var(--cp-orange-text)" }}>
          {announcement.title}
        </h3>
        {announcement.description && (
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
            {announcement.description}
          </p>
        )}

        {/* CTA */}
        <button
          onClick={handleInterest}
          disabled={interested || loading}
          className={cn(
            "inline-flex items-center gap-2 h-10 px-5 rounded-lg text-sm font-semibold transition-all",
            interested
              ? "opacity-80 cursor-default"
              : "hover:opacity-90"
          )}
          style={
            interested
              ? { background: "var(--cp-cyan-dim)", color: "var(--cp-cyan-text)" }
              : { background: "var(--cp-orange)", color: "var(--primary-foreground)" }
          }
        >
          {interested ? (
            <>
              <CheckCircle2 className="h-4 w-4" />
              Interest Sent
            </>
          ) : loading ? (
            "Sending…"
          ) : (
            announcement.ctaText
          )}
        </button>
      </div>
    </div>
  );
}

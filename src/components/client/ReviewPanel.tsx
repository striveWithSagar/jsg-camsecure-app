"use client";

import { Star, ExternalLink } from "lucide-react";

export function ReviewPanel({ url }: { url: string }) {
  return (
    <div
      className="rounded-2xl border px-6 py-6 flex flex-col sm:flex-row items-center gap-5"
      style={{ borderColor: "var(--cp-orange-border)", background: "oklch(0.10 0.022 252 / 0.6)" }}
    >
      {/* Icon */}
      <div
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl"
        style={{ background: "var(--cp-orange-dim)" }}
      >
        <Star className="h-7 w-7 fill-current" style={{ color: "var(--cp-orange-text)" }} />
      </div>

      {/* Text */}
      <div className="flex-1 text-center sm:text-left">
        <p className="cp-heading text-base font-semibold" style={{ color: "var(--cp-orange-text)" }}>
          Enjoying our service?
        </p>
        <p className="text-sm text-muted-foreground mt-0.5">
          Your review helps other businesses find JSG CamSecure. It only takes 30 seconds.
        </p>
      </div>

      {/* Button */}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 inline-flex items-center gap-2 h-10 px-5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90"
        style={{ background: "var(--cp-orange)", color: "var(--primary-foreground)" }}
      >
        <ExternalLink className="h-3.5 w-3.5" />
        Leave a Review
      </a>
    </div>
  );
}

import type { ClientProfileData } from "@/lib/data/client-profile";
import type { ClientJobItem, ClientInvoiceItem } from "@/lib/data/client-portal";
import type { AnnouncementRow } from "@/lib/data/announcements";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  ArrowRight, CheckCircle2, Clock, FileText,
  Plus, Briefcase, AlertTriangle, Camera,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AnnouncementCard } from "@/components/client/AnnouncementCard";
import { ReviewPanel } from "@/components/client/ReviewPanel";

export function ClientDashboardView({
  profile,
  jobs,
  invoices,
  announcements,
  posterUrls,
  googleReviewUrl,
}: {
  profile:         ClientProfileData | null;
  jobs:            ClientJobItem[];
  invoices:        ClientInvoiceItem[];
  announcements:   AnnouncementRow[];
  posterUrls:      Record<string, string>;
  googleReviewUrl: string;
}) {
  const activeJobs     = jobs.filter(j => j.status !== "completed" && j.status !== "cancelled");
  const completedJobs  = jobs.filter(j => j.status === "completed");
  const unpaidInvoices = invoices.filter(i => i.status !== "paid" && i.status !== "cancelled");
  const overdueInvoices = invoices.filter(i => i.status === "overdue");

  const companyName = profile?.companyName ?? "Your Company";

  return (
    <div className="space-y-8">

      {/* ── Hero / welcome banner ─────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden rounded-2xl border px-6 py-7"
        style={{
          background: "linear-gradient(135deg, oklch(0.10 0.022 252) 0%, oklch(0.15 0.030 252) 100%)",
          borderColor: "var(--cp-orange-border)",
        }}
      >
        {/* Decorative circuit-line overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, var(--cp-cyan) 0px, transparent 1px, transparent 28px)," +
              "repeating-linear-gradient(90deg, var(--cp-cyan) 0px, transparent 1px, transparent 28px)",
          }}
        />
        {/* Orange right-edge chevron accent */}
        <div
          className="pointer-events-none absolute right-0 top-0 bottom-0 w-2"
          style={{ background: "linear-gradient(180deg, var(--cp-orange) 0%, var(--cp-cyan) 100%)" }}
        />

        <div className="relative flex items-center justify-between gap-6 flex-wrap">
          <div className="flex items-center gap-5">
            <Image
              src="/brand/jsg-camsecure-logo.png"
              alt="JSG CamSecure"
              width={90}
              height={60}
              className="object-contain shrink-0"
            />
            <div>
              <p
                className="cp-heading text-2xl sm:text-3xl text-foreground leading-tight"
                style={{ color: "var(--cp-orange-text)" }}
              >
                Welcome back
              </p>
              <p className="text-sm text-muted-foreground mt-1">{companyName}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--cp-cyan-text)" }}>
                Client Portal — JSG CamSecure
              </p>
            </div>
          </div>
          <Link
            href="/client/requests/new"
            className={cn(buttonVariants({ size: "sm" }), "h-10 px-5 gap-2 shrink-0 font-semibold")}
            style={{ background: "var(--cp-orange)", color: "var(--primary-foreground)" }}
          >
            <Plus className="h-4 w-4" />
            Raise a Request
          </Link>
        </div>
      </div>

      {/* ── Metric tiles ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {/* Active jobs — orange */}
        <div
          className="cp-card-orange rounded-xl border border-border bg-card px-5 py-4 flex items-center gap-3"
        >
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg shrink-0"
            style={{ background: "var(--cp-orange-dim)" }}
          >
            <Briefcase className="h-4 w-4" style={{ color: "var(--cp-orange-text)" }} />
          </div>
          <div>
            <p
              className="cp-heading text-3xl leading-none tabular-nums"
              style={{ color: "var(--cp-orange-text)" }}
            >
              {activeJobs.length}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Active Jobs</p>
          </div>
        </div>

        {/* Completed — cyan */}
        <div
          className="cp-card-cyan rounded-xl border border-border bg-card px-5 py-4 flex items-center gap-3"
        >
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg shrink-0"
            style={{ background: "var(--cp-cyan-dim)" }}
          >
            <CheckCircle2 className="h-4 w-4" style={{ color: "var(--cp-cyan-text)" }} />
          </div>
          <div>
            <p
              className="cp-heading text-3xl leading-none tabular-nums"
              style={{ color: "var(--cp-cyan-text)" }}
            >
              {completedJobs.length}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Completed</p>
          </div>
        </div>

        {/* Open invoices — warning or success */}
        <div
          className={cn(
            "rounded-xl border bg-card px-5 py-4 flex items-center gap-3",
            overdueInvoices.length > 0 ? "border-t-2" : "border-border"
          )}
          style={overdueInvoices.length > 0
            ? { borderTopColor: "oklch(0.62 0.240 27)" }
            : { borderTop: "2px solid var(--cp-orange-border)" }}
        >
          <div
            className={cn("flex h-9 w-9 items-center justify-center rounded-lg shrink-0")}
            style={{ background: unpaidInvoices.length > 0 ? "oklch(0.70 0.185 47 / 0.15)" : "var(--cp-cyan-dim)" }}
          >
            <FileText
              className="h-4 w-4"
              style={{ color: unpaidInvoices.length > 0 ? "oklch(0.82 0.150 47)" : "var(--cp-cyan-text)" }}
            />
          </div>
          <div>
            <p
              className="cp-heading text-3xl leading-none tabular-nums"
              style={{ color: unpaidInvoices.length > 0 ? "oklch(0.82 0.150 47)" : "var(--cp-cyan-text)" }}
            >
              {unpaidInvoices.length}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Open Invoices</p>
          </div>
        </div>
      </div>

      {/* ── Quick actions ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "New Request",      icon: Plus,        href: "/client/requests/new", accent: "orange" },
          { label: "Your Jobs",        icon: Briefcase,   href: "/client/jobs",         accent: "cyan" },
          { label: "Invoices",         icon: FileText,    href: "/client/invoices",     accent: "orange" },
          { label: "Request History",  icon: Clock,       href: "/client/requests",     accent: "cyan" },
        ].map(({ label, icon: Icon, href, accent }) => (
          <Link
            key={href}
            href={href}
            className="group flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 py-5 text-center transition-all hover:border-[var(--cp-orange-border)] hover:bg-muted/20"
          >
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg transition-transform group-hover:scale-110"
              style={{
                background: accent === "orange" ? "var(--cp-orange-dim)" : "var(--cp-cyan-dim)",
              }}
            >
              <Icon
                className="h-5 w-5"
                style={{ color: accent === "orange" ? "var(--cp-orange-text)" : "var(--cp-cyan-text)" }}
              />
            </div>
            <p className="text-xs font-semibold text-foreground leading-tight">{label}</p>
          </Link>
        ))}
      </div>

      {/* ── Active jobs ──────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2
            className="cp-heading text-base"
            style={{ color: "var(--cp-orange-text)" }}
          >
            Active Jobs
          </h2>
          <Link
            href="/client/jobs"
            className="flex items-center gap-1 text-xs font-medium transition-colors hover:underline"
            style={{ color: "var(--cp-cyan-text)" }}
          >
            All jobs <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {activeJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-10 rounded-xl border border-dashed border-border text-center">
            <Camera className="h-7 w-7 text-muted-foreground/30" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">No active jobs</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Raise a service request and we&apos;ll schedule a visit.
              </p>
            </div>
            <Link
              href="/client/requests/new"
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md text-xs font-semibold transition-colors"
              style={{ background: "var(--cp-orange)", color: "var(--primary-foreground)" }}
            >
              <Plus className="h-3.5 w-3.5" /> Raise a Request
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {activeJobs.slice(0, 4).map(job => (
              <Link key={job.id} href={`/client/jobs/${job.id}`} className="block group">
                <div
                  className="flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4 transition-all group-hover:border-[var(--cp-orange-border)] group-hover:bg-muted/20"
                >
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0"
                    style={{ background: "var(--cp-orange-dim)" }}
                  >
                    <Briefcase className="h-3.5 w-3.5" style={{ color: "var(--cp-orange-text)" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{job.site}</p>
                    <p className="text-xs text-muted-foreground">{job.type} · {job.scheduled}</p>
                  </div>
                  <StatusBadge value={job.status} />
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ── Overdue / outstanding invoices ───────────────────────────────── */}
      {unpaidInvoices.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2
              className="cp-heading text-base flex items-center gap-2"
              style={{ color: overdueInvoices.length > 0 ? "oklch(0.78 0.180 27)" : "var(--cp-orange-text)" }}
            >
              {overdueInvoices.length > 0 && <AlertTriangle className="h-4 w-4" />}
              Outstanding Invoices
            </h2>
            <Link
              href="/client/invoices"
              className="flex items-center gap-1 text-xs font-medium transition-colors hover:underline"
              style={{ color: "var(--cp-cyan-text)" }}
            >
              All invoices <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {unpaidInvoices.map(inv => (
              <div
                key={inv.id}
                className="flex items-center gap-4 rounded-xl border bg-card px-5 py-4"
                style={{ borderColor: inv.status === "overdue" ? "oklch(0.62 0.240 27 / 0.50)" : "var(--cp-orange-border)" }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{inv.invoiceNumber}</p>
                  <p className="text-xs text-muted-foreground">Due {inv.due}</p>
                </div>
                <div className="text-right">
                  <p
                    className="cp-heading text-xl tabular-nums"
                    style={{ color: inv.status === "overdue" ? "oklch(0.78 0.180 27)" : "var(--cp-orange-text)" }}
                  >
                    ${inv.total.toLocaleString()}
                  </p>
                  <Link
                    href="/client/invoices"
                    className="inline-flex items-center gap-1 text-xs mt-1.5 transition-colors hover:underline"
                    style={{ color: "var(--cp-cyan-text)" }}
                  >
                    View →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Announcements / Deals ────────────────────────────────────────── */}
      {announcements.length > 0 && (
        <div>
          <h2
            className="cp-heading text-base mb-3"
            style={{ color: "var(--cp-orange-text)" }}
          >
            News &amp; Deals
          </h2>
          <div className="space-y-4">
            {announcements.map(a => (
              <AnnouncementCard
                key={a.id}
                announcement={a}
                posterUrl={posterUrls[a.id] ?? null}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Google Review CTA ─────────────────────────────────────────────── */}
      {googleReviewUrl && <ReviewPanel url={googleReviewUrl} />}

    </div>
  );
}

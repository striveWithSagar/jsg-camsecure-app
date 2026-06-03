import type { Metadata } from "next";
import type { ClientJobItem } from "@/lib/data/client-portal";
import { getClientJobs } from "@/lib/data/client-portal";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { fmtJobNumber } from "@/lib/utils";
import { MapPin, Clock, Wrench, Camera, Plus, ArrowRight } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = { title: "Your Jobs · JSG CamSecure Client Portal" };

const CLIENT_STATUS_LABEL: Record<string, string> = {
  assigned:    "Scheduled",
  on_the_way:  "Technician En Route",
  started:     "Work Started",
  in_progress: "In Progress",
  needs_parts: "Awaiting Parts",
  completed:   "Completed",
  rescheduled: "Rescheduled",
  cancelled:   "Cancelled",
};

const CLIENT_STATUS_ACCENT: Record<string, string> = {
  assigned:    "var(--cp-cyan)",
  on_the_way:  "oklch(0.68 0.155 200)",
  started:     "oklch(0.78 0.165 90)",
  in_progress: "var(--cp-orange)",
  needs_parts: "oklch(0.70 0.185 47)",
  completed:   "oklch(0.63 0.165 155)",
  rescheduled: "oklch(0.65 0.170 300)",
  cancelled:   "oklch(0.50 0.040 252)",
};

function JobCard({ job }: { job: ClientJobItem }) {
  const accent = CLIENT_STATUS_ACCENT[job.status] ?? "var(--cp-orange)";
  return (
    <div className="group rounded-xl border border-border bg-card overflow-hidden transition-all hover:border-[var(--cp-orange-border)] hover:shadow-sm">
      {/* Status color bar */}
      <div className="h-0.5 w-full" style={{ background: accent }} />

      <div className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">{job.site}</p>
            <p className="text-xs font-mono text-muted-foreground/60 mt-0.5">{fmtJobNumber(job.jobNumber)}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <StatusBadge value={job.status} />
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>

        <p
          className="text-xs font-medium px-2.5 py-1 rounded-md inline-block"
          style={{ background: `${accent}20`, color: accent }}
        >
          {CLIENT_STATUS_LABEL[job.status] ?? job.status}
        </p>

        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><Wrench className="h-3 w-3" />{job.type}</span>
          <span className="flex items-center gap-1.5"><Clock className="h-3 w-3" />{job.scheduled}</span>
          {job.address !== "—" && (
            <span className="flex items-center gap-1.5"><MapPin className="h-3 w-3" />{job.address}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default async function ClientJobsPage() {
  const jobs = await getClientJobs();

  const active    = jobs.filter(j => j.status !== "completed" && j.status !== "cancelled");
  const completed = jobs.filter(j => j.status === "completed");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="cp-heading text-3xl" style={{ color: "var(--cp-orange-text)" }}>
            Your Jobs
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {active.length} active · {completed.length} completed
          </p>
        </div>
      </div>

      {/* Empty state */}
      {jobs.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 py-16 rounded-xl border border-dashed border-border text-center">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full"
            style={{ background: "var(--cp-cyan-dim)" }}
          >
            <Camera className="h-7 w-7" style={{ color: "var(--cp-cyan-text)" }} />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">No jobs on record</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              Once a service request is scheduled, your jobs will appear here.
            </p>
          </div>
          <Link
            href="/client/requests/new"
            className="inline-flex items-center gap-1.5 h-10 px-5 rounded-lg text-xs font-semibold"
            style={{ background: "var(--cp-orange)", color: "var(--primary-foreground)" }}
          >
            <Plus className="h-3.5 w-3.5" /> Raise a Request
          </Link>
        </div>
      )}

      {/* Active jobs */}
      {active.length > 0 && (
        <div>
          <p
            className="cp-heading text-sm mb-3"
            style={{ color: "var(--cp-orange-text)" }}
          >
            Active
          </p>
          <div className="space-y-3">
            {active.map(j => (
              <Link key={j.id} href={`/client/jobs/${j.id}`} className="block">
                <JobCard job={j} />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Completed jobs */}
      {completed.length > 0 && (
        <div>
          <p
            className="cp-heading text-sm mb-3"
            style={{ color: "var(--cp-cyan-text)" }}
          >
            Completed
          </p>
          <div className="space-y-3 opacity-75">
            {completed.map(j => (
              <Link key={j.id} href={`/client/jobs/${j.id}`} className="block">
                <JobCard job={j} />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

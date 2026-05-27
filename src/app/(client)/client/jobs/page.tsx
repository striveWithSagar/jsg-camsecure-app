import type { Metadata } from "next";
import type { ClientJobItem } from "@/lib/data/client-portal";
import { getClientJobs } from "@/lib/data/client-portal";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { fmtJobNumber } from "@/lib/utils";
import { MapPin, Clock, Wrench } from "lucide-react";

export const metadata: Metadata = { title: "Your Jobs · CamSecure Client Portal" };

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

function JobCard({ job }: { job: ClientJobItem }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{job.site}</p>
          <p className="text-xs font-mono text-muted-foreground/60">{fmtJobNumber(job.jobNumber)}</p>
        </div>
        <StatusBadge value={job.status} />
      </div>
      <p className="text-xs text-muted-foreground bg-muted/30 px-2 py-1 rounded">
        {CLIENT_STATUS_LABEL[job.status] ?? job.status}
      </p>
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><Wrench className="h-3 w-3" />{job.type}</span>
        <span className="flex items-center gap-1.5"><Clock className="h-3 w-3" />{job.scheduled}</span>
        <span className="flex items-center gap-1.5"><MapPin className="h-3 w-3" />{job.address}</span>
      </div>
      <div className="pt-2 border-t border-border/50">
        <p className="text-[10px] text-muted-foreground/60 text-center">Detailed view — coming soon</p>
      </div>
    </div>
  );
}

export default async function ClientJobsPage() {
  // getClientJobs() is RLS-filtered — no client_id filter needed here
  const jobs = await getClientJobs();

  const active    = jobs.filter(j => j.status !== "completed" && j.status !== "cancelled");
  const completed = jobs.filter(j => j.status === "completed");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Your Jobs</h1>
        <p className="text-sm text-muted-foreground mt-1">{active.length} active · {completed.length} completed</p>
      </div>

      {jobs.length === 0 && (
        <p className="text-sm text-muted-foreground py-12 text-center rounded-xl border border-dashed border-border">
          No jobs on record for your account.
        </p>
      )}

      {active.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3">Active</p>
          <div className="space-y-3">
            {active.map(j => <JobCard key={j.id} job={j} />)}
          </div>
        </div>
      )}

      {completed.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3">Completed</p>
          <div className="space-y-3 opacity-70">
            {completed.map(j => <JobCard key={j.id} job={j} />)}
          </div>
        </div>
      )}
    </div>
  );
}

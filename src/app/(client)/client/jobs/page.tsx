"use client";

// TODO: replace useMockStore with Supabase query filtered by authenticated client:
//   supabase.from("jobs").select().eq("client_id", session.user.client_id)

import { useMockStore } from "@/lib/mock-store";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { MapPin, Clock, Wrench } from "lucide-react";

// TODO: replace with authenticated client from Supabase session
const CLIENT_NAME = "Metro Security Ltd";

const STATUS_ORDER = ["in_progress", "started", "on_the_way", "assigned", "needs_parts", "rescheduled", "completed"];

const CLIENT_STATUS_LABEL: Record<string, string> = {
  assigned:    "Scheduled",
  on_the_way:  "Technician En Route",
  started:     "Work Started",
  in_progress: "In Progress",
  needs_parts: "Awaiting Parts",
  completed:   "Completed",
  rescheduled: "Rescheduled",
};

export default function ClientJobsPage() {
  // TODO: replace with Supabase query
  const { jobs } = useMockStore();
  const clientJobs = jobs
    .filter(j => j.client === CLIENT_NAME)
    .sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status));

  const active    = clientJobs.filter(j => j.status !== "completed");
  const completed = clientJobs.filter(j => j.status === "completed");

  function JobCard({ job }: { job: typeof clientJobs[number] }) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">{job.site}</p>
            <p className="text-xs font-mono text-muted-foreground/60">{job.id}</p>
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
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Your Jobs</h1>
        <p className="text-sm text-muted-foreground mt-1">{active.length} active · {completed.length} completed</p>
      </div>

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

      {clientJobs.length === 0 && (
        <p className="text-sm text-muted-foreground py-12 text-center">No jobs on record for your account.</p>
      )}
    </div>
  );
}
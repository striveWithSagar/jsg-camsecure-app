"use client";

// TODO: replace useMockStore with Supabase query filtered by authenticated technician:
//   supabase.from("jobs").select().eq("technician_id", session.user.id)

import { useMockStore } from "@/lib/mock-store";
import { StatusBadge, PriorityBadge } from "@/components/shared/StatusBadge";
import { Clock, MapPin, ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// TODO: replace with authenticated user from Supabase session
const TECH_NAME = "Alex Rivera";

export default function TechnicianJobsPage() {
  // TODO: replace with Supabase query
  const { jobs } = useMockStore();
  const myJobs = jobs
    .filter(j => j.technician === TECH_NAME)
    .sort((a, b) => {
      const order = ["in_progress", "started", "on_the_way", "assigned", "needs_parts", "rescheduled", "completed"];
      return order.indexOf(a.status) - order.indexOf(b.status);
    });

  const active    = myJobs.filter(j => j.status !== "completed");
  const completed = myJobs.filter(j => j.status === "completed");

  function Section({ title, jobs: sectionJobs }: { title: string; jobs: typeof myJobs }) {
    if (sectionJobs.length === 0) return null;
    return (
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3">{title}</p>
        <div className="space-y-2.5">
          {sectionJobs.map(job => (
            <Link key={job.id} href={`/technician/jobs/${job.id}`}>
              <div className={cn(
                "rounded-xl border border-border bg-card p-4 hover:bg-muted/20 transition-colors",
                job.status === "completed" && "opacity-60"
              )}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{job.client}</p>
                    <p className="text-xs text-muted-foreground truncate">{job.site}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-0.5" />
                </div>
                <p className="text-xs text-muted-foreground bg-muted/30 px-2 py-1 rounded mb-3 truncate">{job.type}</p>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{job.scheduled}</span>
                    <span className="flex items-center gap-1 truncate max-w-[120px]"><MapPin className="h-3 w-3" />{job.address.split(",")[0]}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <PriorityBadge value={job.priority} />
                    <StatusBadge value={job.status} />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">My Jobs</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{active.length} active · {completed.length} completed</p>
      </div>
      <Section title="Active" jobs={active} />
      <Section title="Completed" jobs={completed} />
    </div>
  );
}
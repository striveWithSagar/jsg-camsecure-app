"use client";

// TODO: replace useMockStore with Supabase query filtered by authenticated technician:
//   supabase.from("jobs").select().eq("technician_id", session.user.id)

import { useMockStore } from "@/lib/mock-store";
import { StatusBadge, PriorityBadge } from "@/components/shared/StatusBadge";
import { CheckCircle2, MapPin, Clock, ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// TODO: replace with authenticated user from Supabase session
const TECH_NAME = "Alex Rivera";

const STATUS_DOT: Record<string, string> = {
  in_progress: "bg-primary",
  assigned:    "bg-c-info-solid",
  on_the_way:  "bg-c-teal-solid",
  started:     "bg-c-amber-solid",
  needs_parts: "bg-c-warning-solid",
  completed:   "bg-c-success-solid",
  rescheduled: "bg-c-purple-solid",
};

export default function TechnicianDashboard() {
  // TODO: replace with Supabase query
  const { jobs } = useMockStore();
  const myJobs    = jobs.filter(j => j.technician === TECH_NAME);
  const todayJobs = myJobs.filter(j => j.scheduled.startsWith("Today"));
  const activeJob = myJobs.find(j => j.status === "in_progress" || j.status === "started" || j.status === "on_the_way");
  const completedToday = todayJobs.filter(j => j.status === "completed").length;

  // Safe to call new Date() in a client component — no SSR hydration mismatch
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-6">

      {/* Greeting */}
      <div>
        <h1 className="text-xl font-semibold text-foreground">{greeting}, {TECH_NAME.split(" ")[0]}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {todayJobs.length} job{todayJobs.length !== 1 ? "s" : ""} scheduled today · {completedToday} completed
        </p>
      </div>

      {/* Active job callout */}
      {activeJob && (
        <Link href={`/technician/jobs/${activeJob.id}`}>
          <div className="rounded-xl border border-primary/30 bg-primary/6 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                <p className="text-xs font-semibold text-primary uppercase tracking-wide">Currently Active</p>
              </div>
              <ChevronRight className="h-4 w-4 text-primary/60" />
            </div>
            <div>
              <p className="text-base font-semibold text-foreground">{activeJob.client}</p>
              <p className="text-sm text-muted-foreground">{activeJob.site}</p>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><Clock className="h-3 w-3" />{activeJob.scheduled.replace("Today ", "")}</span>
              <span className="flex items-center gap-1.5"><MapPin className="h-3 w-3" />{activeJob.address}</span>
            </div>
            <StatusBadge value={activeJob.status} />
          </div>
        </Link>
      )}

      {/* Today's jobs */}
      {todayJobs.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground">Today's Jobs</h2>
            <Link href="/technician/jobs" className="text-xs text-primary hover:underline">See all</Link>
          </div>
          <div className="space-y-2">
            {todayJobs.map(job => (
              <Link key={job.id} href={`/technician/jobs/${job.id}`}>
                <div className={cn(
                  "flex items-center gap-3 rounded-lg border border-border bg-card p-4 hover:bg-muted/20 transition-colors",
                  job.status === "completed" && "opacity-60"
                )}>
                  <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", STATUS_DOT[job.status] ?? "bg-muted")} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{job.client}</p>
                    <p className="text-xs text-muted-foreground truncate">{job.site} · {job.scheduled.replace("Today ", "")}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {job.status === "completed"
                      ? <CheckCircle2 className="h-4 w-4 text-c-success" />
                      : <PriorityBadge value={job.priority} />
                    }
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Assigned",    value: myJobs.filter(j => j.status !== "completed").length, color: "text-foreground" },
          { label: "Completed",   value: myJobs.filter(j => j.status === "completed").length,  color: "text-c-success" },
          { label: "Needs Parts", value: myJobs.filter(j => j.status === "needs_parts").length, color: "text-c-warning" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-lg border border-border bg-card px-3 py-3 text-center">
            <p className={cn("text-2xl font-semibold tabular-nums", color)}>{value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

    </div>
  );
}
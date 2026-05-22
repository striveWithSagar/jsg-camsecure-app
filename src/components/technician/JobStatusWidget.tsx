"use client";

import { useState, useEffect } from "react";
// TODO: replace useMockStore call with Supabase mutation:
//   supabase.from("jobs").update({ status: next }).eq("id", jobId)
import { useMockStore } from "@/lib/mock-store";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Play, Wrench, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const TRANSITIONS: Record<string, { label: string; icon: React.ElementType; next: string; color: string }[]> = {
  assigned:    [{ label: "Start Travelling",        icon: ArrowRight,   next: "on_the_way",  color: "text-c-teal" }],
  on_the_way:  [{ label: "Arrived — Start Job",     icon: Play,         next: "started",     color: "text-c-amber" }],
  started:     [{ label: "Mark In Progress",        icon: Play,         next: "in_progress", color: "text-primary" }],
  in_progress: [
    { label: "Mark Complete", icon: CheckCircle2, next: "completed",   color: "text-c-success" },
    { label: "Needs Parts",   icon: Wrench,       next: "needs_parts", color: "text-c-warning" },
  ],
  needs_parts: [{ label: "Resume — Parts Arrived",  icon: Play,         next: "in_progress", color: "text-primary" }],
  completed:   [],
  rescheduled: [{ label: "Restart Job",             icon: Play,         next: "assigned",    color: "text-primary" }],
};

const STATUS_LABELS: Record<string, string> = {
  assigned:    "Assigned",
  on_the_way:  "On the Way",
  started:     "Started",
  in_progress: "In Progress",
  needs_parts: "Needs Parts",
  completed:   "Completed",
  rescheduled: "Rescheduled",
};

export function JobStatusWidget({ initialStatus, jobId }: { initialStatus: string; jobId: string }) {
  const [status, setStatus] = useState(initialStatus);
  // TODO: replace with Supabase realtime subscription once auth is integrated
  const store = useMockStore();

  // Sync from store after localStorage hydrates — picks up status changes made in the admin portal
  useEffect(() => {
    if (!store.hydrated) return;
    const stored = store.jobs.find(j => j.id === jobId);
    if (stored) setStatus(stored.status);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.hydrated]);

  const transitions = TRANSITIONS[status] ?? [];

  function advance(next: string) {
    setStatus(next);
    store.updateJobStatus(jobId, next);
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Job Status</p>
        <span className={cn(
          "text-xs font-semibold px-2 py-1 rounded",
          status === "completed"   && "text-c-success bg-c-success",
          status === "in_progress" && "text-primary bg-primary/10",
          status === "needs_parts" && "text-c-warning bg-c-warning",
          status === "on_the_way"  && "text-c-teal bg-c-teal",
          status === "started"     && "text-c-amber bg-c-amber",
          status === "assigned"    && "text-c-info bg-c-info",
          status === "rescheduled" && "text-c-purple bg-c-purple",
        )}>
          {STATUS_LABELS[status] ?? status}
        </span>
      </div>

      {transitions.length > 0 ? (
        <div className="space-y-2">
          {transitions.map(({ label, icon: Icon, next, color }) => (
            <Button
              key={next}
              variant="outline"
              className={cn("w-full justify-start gap-2 h-11", color)}
              onClick={() => advance(next)}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Button>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm text-c-success">
          <CheckCircle2 className="h-4 w-4" />
          Job completed
        </div>
      )}

      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground font-medium">Field notes</p>
        <textarea
          className="w-full rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground px-3 py-2.5 min-h-[80px] resize-none focus:outline-none focus:ring-1 focus:ring-primary/40"
          placeholder="Add any notes for the dispatcher…"
        />
      </div>
    </div>
  );
}
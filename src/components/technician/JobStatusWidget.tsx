"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Play, Wrench, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const TRANSITIONS: Record<string, { label: string; icon: React.ElementType; next: string; color: string }[]> = {
  assigned:    [{ label: "Start Travelling",       icon: ArrowRight,   next: "on_the_way",  color: "text-c-teal" }],
  on_the_way:  [{ label: "Arrived — Start Job",    icon: Play,         next: "started",     color: "text-c-amber" }],
  started:     [{ label: "Mark In Progress",       icon: Play,         next: "in_progress", color: "text-primary" }],
  in_progress: [
    { label: "Mark Complete", icon: CheckCircle2, next: "completed",   color: "text-c-success" },
    { label: "Needs Parts",   icon: Wrench,       next: "needs_parts", color: "text-c-warning" },
  ],
  needs_parts: [{ label: "Resume — Parts Arrived", icon: Play,         next: "in_progress", color: "text-primary" }],
  completed:   [],
  rescheduled: [{ label: "Restart Job",            icon: Play,         next: "assigned",    color: "text-primary" }],
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

export function JobStatusWidget({
  initialStatus,
  jobId,
  hasBlockingItems = false,
}: {
  initialStatus:    string;
  jobId:            string;
  hasBlockingItems?: boolean;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const transitions = TRANSITIONS[status] ?? [];

  async function advance(next: string) {
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const updates: Record<string, unknown> = { status: next };
    if (next === "completed") {
      updates.completed_at = new Date().toISOString();
    }

    const { error: dbError } = await supabase
      .from("jobs")
      .update(updates)
      .eq("id", jobId);

    if (dbError) {
      setError(
        dbError.message.includes("CHECKLIST_INCOMPLETE")
          ? "Complete all required checklist items before marking this job done."
          : "Failed to update status. Please try again."
      );
      setSaving(false);
      return;
    }

    setStatus(next);
    setSaving(false);
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
          {transitions.map(({ label, icon: Icon, next, color }) => {
            const blocked = next === "completed" && hasBlockingItems;
            return (
              <Button
                key={next}
                variant="outline"
                className={cn("w-full justify-start gap-2 h-11", blocked ? "text-muted-foreground" : color)}
                onClick={() => advance(next)}
                disabled={saving || blocked}
                title={blocked ? "Complete all required checklist items first" : undefined}
              >
                <Icon className="h-4 w-4" />
                {saving ? "Saving…" : blocked ? "Complete checklist first" : label}
              </Button>
            );
          })}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm text-c-success">
          <CheckCircle2 className="h-4 w-4" />
          Job completed
        </div>
      )}

      {error && (
        <p className="text-xs text-destructive bg-destructive/8 border border-destructive/20 rounded-md px-3 py-2">
          {error}
        </p>
      )}

    </div>
  );
}

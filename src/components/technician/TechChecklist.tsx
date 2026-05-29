"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ChecklistItem } from "@/lib/data/jobs";
import { ClipboardList, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  initialItems:  ChecklistItem[];
  onItemsChange: (items: ChecklistItem[]) => void;
};

export function TechChecklist({ initialItems, onItemsChange }: Props) {
  const [items,     setItems]     = useState<ChecklistItem[]>(initialItems);
  const [savingId,  setSavingId]  = useState<string | null>(null);
  const [error,     setError]     = useState<string | null>(null);

  // Return nothing when there is no checklist for this job
  if (items.length === 0) return null;

  async function toggleItem(item: ChecklistItem) {
    setSavingId(item.id);
    setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const nowCompleted = !item.isCompleted;
    const { error: dbErr } = await supabase
      .from("job_checklist_items")
      .update({
        is_completed:            nowCompleted,
        completed_at:            nowCompleted ? new Date().toISOString() : null,
        completed_by_profile_id: nowCompleted ? (user?.id ?? null) : null,
      })
      .eq("id", item.id);

    if (dbErr) {
      setError("Could not update item. Please try again.");
      setSavingId(null);
      return;
    }

    const updated = items.map(i =>
      i.id === item.id
        ? {
            ...i,
            isCompleted:          nowCompleted,
            completedAt:          nowCompleted ? new Date().toISOString() : null,
            completedByProfileId: nowCompleted ? (user?.id ?? null) : null,
          }
        : i
    );
    setItems(updated);
    onItemsChange(updated);
    setSavingId(null);
  }

  const totalCount    = items.length;
  const doneCount     = items.filter(i => i.isCompleted).length;
  const reqPending    = items.filter(i => i.isRequired && !i.isCompleted).length;
  const allReqDone    = reqPending === 0;

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
          <ClipboardList className="h-3.5 w-3.5" /> Job Checklist
        </p>
        <span className={cn(
          "text-[11px] font-semibold",
          allReqDone ? "text-c-success" : "text-c-warning"
        )}>
          {doneCount}/{totalCount} completed
        </span>
      </div>

      {!allReqDone && (
        <p className="text-[11px] text-c-warning">
          {reqPending} required item{reqPending !== 1 ? "s" : ""} must be completed before the job can be marked done.
        </p>
      )}

      <div className="space-y-2">
        {items.map(item => (
          <button
            key={item.id}
            onClick={() => toggleItem(item)}
            disabled={!!savingId}
            className={cn(
              "w-full flex items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors",
              item.isCompleted
                ? "border-c-success/30 bg-c-success/5"
                : "border-border bg-background hover:bg-muted/40",
              !!savingId && "opacity-70 cursor-not-allowed"
            )}
          >
            {savingId === item.id ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground shrink-0" />
            ) : item.isCompleted ? (
              <CheckCircle2 className="h-5 w-5 text-c-success shrink-0" />
            ) : (
              <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/50 shrink-0" />
            )}

            <div className="flex-1 min-w-0">
              <p className={cn(
                "text-sm font-medium leading-snug",
                item.isCompleted ? "text-muted-foreground line-through" : "text-foreground"
              )}>
                {item.label}
              </p>
            </div>

            <span className={cn(
              "text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0",
              item.isRequired
                ? "bg-destructive/10 text-destructive"
                : "bg-muted text-muted-foreground"
            )}>
              {item.isRequired ? "REQUIRED" : "OPTIONAL"}
            </span>
          </button>
        ))}
      </div>

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}

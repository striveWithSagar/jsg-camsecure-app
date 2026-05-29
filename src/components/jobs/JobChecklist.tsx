"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ChecklistItem } from "@/lib/data/jobs";
import { Button } from "@/components/ui/button";
import { ClipboardList, Plus, X, ChevronUp, ChevronDown, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const PRESET_LABELS = [
  "Test all cameras and confirm live feed",
  "Check DVR/NVR connections and recording",
  "Verify recording storage is functioning",
  "Confirm mobile app access for client",
  "Inspect and secure all cable runs",
  "Label all equipment and ports",
  "Conduct final site walkthrough with client",
  "Document any unresolved issues",
  "Obtain client sign-off on completed work",
];

type Props = {
  jobId:          string;
  organizationId: string;
  initialItems:   ChecklistItem[];
};

export function JobChecklist({ jobId, organizationId, initialItems }: Props) {
  const [items,      setItems]      = useState<ChecklistItem[]>(initialItems);
  const [adding,     setAdding]     = useState(false);
  const [newLabel,   setNewLabel]   = useState("");
  const [newRequired, setNewRequired] = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [movingId,   setMovingId]   = useState<string | null>(null);
  const [error,      setError]      = useState<string | null>(null);

  function handlePresetSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    if (e.target.value) setNewLabel(e.target.value);
    e.target.value = "";
  }

  async function addItem() {
    const label = newLabel.trim();
    if (!label) return;
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const nextPos  = items.length > 0 ? Math.max(...items.map(i => i.position)) + 1 : 1;

    const { data, error: dbErr } = await supabase
      .from("job_checklist_items")
      .insert({
        organization_id: organizationId,
        job_id:          jobId,
        position:        nextPos,
        label,
        is_required:     newRequired,
      })
      .select("id, position, label, is_required, is_completed, completed_at, completed_by_profile_id")
      .single();

    if (dbErr || !data) {
      setError("Failed to add item. Please try again.");
      setSaving(false);
      return;
    }

    const newItem: ChecklistItem = {
      id:                   (data as { id: string }).id,
      position:             (data as { position: number }).position,
      label:                (data as { label: string }).label,
      isRequired:           (data as { is_required: boolean }).is_required,
      isCompleted:          false,
      completedAt:          null,
      completedByProfileId: null,
    };
    setItems(prev => [...prev, newItem]);
    setNewLabel("");
    setAdding(false);
    setSaving(false);
  }

  async function deleteItem(id: string) {
    setDeletingId(id);
    setError(null);
    const supabase = createClient();
    const { error: dbErr } = await supabase
      .from("job_checklist_items")
      .delete()
      .eq("id", id);
    if (dbErr) {
      setError("Failed to delete item. Please try again.");
      setDeletingId(null);
      return;
    }
    setItems(prev => prev.filter(i => i.id !== id));
    setDeletingId(null);
  }

  async function moveItem(id: string, direction: "up" | "down") {
    const idx = items.findIndex(i => i.id === id);
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === items.length - 1) return;

    const otherIdx = direction === "up" ? idx - 1 : idx + 1;
    const thisItem = items[idx];
    const other    = items[otherIdx];

    setMovingId(id);
    setError(null);
    const supabase = createClient();

    // Swap positions
    const [r1, r2] = await Promise.all([
      supabase.from("job_checklist_items").update({ position: other.position }).eq("id", thisItem.id),
      supabase.from("job_checklist_items").update({ position: thisItem.position }).eq("id", other.id),
    ]);

    if (r1.error || r2.error) {
      setError("Failed to reorder. Please try again.");
      setMovingId(null);
      return;
    }

    const updated = [...items];
    updated[idx]      = { ...thisItem, position: other.position };
    updated[otherIdx] = { ...other,    position: thisItem.position };
    setItems(updated.sort((a, b) => a.position - b.position));
    setMovingId(null);
  }

  const completedCount  = items.filter(i => i.isCompleted).length;
  const requiredPending = items.filter(i => i.isRequired && !i.isCompleted).length;

  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
          <ClipboardList className="h-3.5 w-3.5" /> Checklist
        </h3>
        {items.length > 0 && (
          <span className={cn(
            "text-[11px] font-medium",
            requiredPending > 0 ? "text-c-warning" : "text-c-success"
          )}>
            {completedCount}/{items.length} completed
            {requiredPending > 0 && ` · ${requiredPending} required pending`}
          </span>
        )}
      </div>

      {items.length === 0 && !adding && (
        <p className="text-xs text-muted-foreground">
          No checklist items. Add items to require technician sign-off before completion.
        </p>
      )}

      {items.length > 0 && (
        <div className="space-y-1.5">
          {items.map((item, idx) => (
            <div
              key={item.id}
              className={cn(
                "flex items-center gap-2 rounded-md border px-3 py-2",
                item.isCompleted
                  ? "border-c-success/30 bg-c-success/5"
                  : "border-border bg-background"
              )}
            >
              <span className="text-[11px] font-mono text-muted-foreground w-5 shrink-0 text-right">
                {item.position}.
              </span>

              {item.isCompleted ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-c-success shrink-0" />
              ) : (
                <div className="h-3.5 w-3.5 rounded-full border-2 border-muted-foreground/40 shrink-0" />
              )}

              <span className={cn(
                "flex-1 text-xs",
                item.isCompleted ? "text-muted-foreground line-through" : "text-foreground"
              )}>
                {item.label}
              </span>

              <span className={cn(
                "text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0",
                item.isRequired
                  ? "bg-destructive/10 text-destructive"
                  : "bg-muted text-muted-foreground"
              )}>
                {item.isRequired ? "REQ" : "OPT"}
              </span>

              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  onClick={() => moveItem(item.id, "up")}
                  disabled={idx === 0 || !!movingId}
                  className="h-5 w-5 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Move up"
                >
                  <ChevronUp className="h-3 w-3" />
                </button>
                <button
                  onClick={() => moveItem(item.id, "down")}
                  disabled={idx === items.length - 1 || !!movingId}
                  className="h-5 w-5 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Move down"
                >
                  <ChevronDown className="h-3 w-3" />
                </button>
                <button
                  onClick={() => deleteItem(item.id)}
                  disabled={!!deletingId}
                  className="h-5 w-5 flex items-center justify-center text-muted-foreground hover:text-destructive disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Delete item"
                >
                  {deletingId === item.id
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <X className="h-3 w-3" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {adding ? (
        <div className="space-y-2 pt-1">
          <select
            className="w-full h-8 rounded-md border border-border bg-background px-2 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            defaultValue=""
            onChange={handlePresetSelect}
          >
            <option value="" disabled>— use a preset or type below —</option>
            {PRESET_LABELS.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <input
            autoFocus
            type="text"
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") addItem(); if (e.key === "Escape") { setAdding(false); setNewLabel(""); } }}
            placeholder="Checklist item label…"
            className="w-full h-8 rounded-md border border-border bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <div className="flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={newRequired}
                onChange={e => setNewRequired(e.target.checked)}
                className="rounded"
              />
              Required (blocks job completion)
            </label>
            <div className="flex gap-2">
              <Button
                variant="outline" size="sm"
                className="h-7 text-xs"
                onClick={() => { setAdding(false); setNewLabel(""); }}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={addItem}
                disabled={saving || !newLabel.trim()}
              >
                {saving ? <><Loader2 className="h-3 w-3 animate-spin mr-1" />Adding…</> : "Add Item"}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="w-full h-8 text-xs gap-1.5"
          onClick={() => setAdding(true)}
        >
          <Plus className="h-3.5 w-3.5" /> Add Checklist Item
        </Button>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

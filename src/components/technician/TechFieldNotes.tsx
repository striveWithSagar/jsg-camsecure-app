"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";

type Props = {
  jobId:        string;
  orgId:        string;
  initialNotes: { id: string; body: string; createdAt: string; author: string }[];
};

export function TechFieldNotes({ jobId, orgId, initialNotes }: Props) {
  const [notes,    setNotes]    = useState(initialNotes);
  const [noteText, setNoteText] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  async function saveNote() {
    if (!noteText.trim()) return;
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("Not authenticated.");
      setLoading(false);
      return;
    }
    const { data: newNote, error: dbError } = await supabase
      .from("job_notes")
      .insert({
        organization_id:   orgId,
        job_id:            jobId,
        author_profile_id: user.id,
        body:              noteText.trim(),
      })
      .select("id, body, created_at")
      .single();
    setLoading(false);
    if (dbError) {
      setError(dbError.message);
      return;
    }
    setNotes(prev => [...prev, {
      id:        newNote.id as string,
      body:      newNote.body as string,
      createdAt: newNote.created_at as string,
      author:    "You",
    }]);
    setNoteText("");

    // Notify admins of new field note (best-effort)
    void supabase.from("notifications").insert({
      organization_id:  orgId,
      actor_profile_id: user.id,
      recipient_role:   "admin",
      event_type:       "technician_field_note_added",
      title:            `Field note added to JOB-${jobId.slice(-4)}`,
      body:             (newNote.body as string).length > 80
        ? (newNote.body as string).slice(0, 80) + "…"
        : (newNote.body as string),
      entity_type:      "job",
      entity_id:        jobId,
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Field Notes</p>

      {notes.length > 0 && (
        <div className="space-y-3">
          {notes.map(n => (
            <div key={n.id} className="space-y-1 border-l-2 border-border pl-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{n.author}</span>
                <span>·</span>
                <span>{new Date(n.createdAt).toLocaleString("en-US", {
                  month: "short", day: "numeric",
                  hour: "2-digit", minute: "2-digit",
                })}</span>
              </div>
              <p className="text-sm text-foreground">{n.body}</p>
            </div>
          ))}
        </div>
      )}

      <textarea
        className="w-full rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground px-3 py-2.5 min-h-[80px] resize-none focus:outline-none focus:ring-1 focus:ring-ring"
        placeholder="Add a field note…"
        value={noteText}
        onChange={e => { setNoteText(e.target.value); setError(null); }}
        disabled={loading}
      />

      <Button
        variant="outline"
        className="w-full h-10 text-xs gap-1.5"
        onClick={saveNote}
        disabled={loading || !noteText.trim()}
      >
        <FileText className="h-3.5 w-3.5" />
        {loading ? "Saving…" : "Save Note"}
      </Button>

      {error && (
        <p className="text-xs text-destructive bg-destructive/8 border border-destructive/20 rounded-md px-3 py-2">
          {error}
        </p>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { JobDetailData } from "@/lib/data/jobs";
import type { TechnicianOption } from "@/lib/data/technicians";
import { StatusBadge, PriorityBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { STATUS_LABELS, PRIORITY_LABELS } from "@/lib/constants";
import { fmtJobNumber, fmtReqNumber, fmtDatetime, calcJobAge } from "@/lib/utils";
import {
  MapPin, CheckCircle2, User, FileText, UserCog, Save, Clock,
} from "lucide-react";
import { JobPhotoPanel } from "@/components/jobs/JobPhotoPanel";
import { JobChecklist } from "@/components/jobs/JobChecklist";
import Link from "next/link";

export function JobDetail({
  job,
  technicians,
}: {
  job:         JobDetailData;
  technicians: TechnicianOption[];
}) {
  const [technicianId, setTechnicianId] = useState(job.technicianId ?? "");
  const [priority,     setPriority]     = useState(job.priority);
  const [status,       setStatus]       = useState(job.status);
  const [noteText,     setNoteText]     = useState("");
  const [notes,        setNotes]        = useState(job.notes);

  const [assignLoading, setAssignLoading] = useState(false);
  const [assignSaved,   setAssignSaved]   = useState(false);
  const [assignError,   setAssignError]   = useState<string | null>(null);

  const [statusLoading, setStatusLoading] = useState(false);
  const [statusSaved,   setStatusSaved]   = useState(false);
  const [statusError,   setStatusError]   = useState<string | null>(null);

  const [noteLoading, setNoteLoading] = useState(false);
  const [noteSaved,   setNoteSaved]   = useState(false);
  const [noteError,   setNoteError]   = useState<string | null>(null);

  const technicianName = technicianId
    ? (technicians.find(t => t.id === technicianId)?.full_name ?? "Unassigned")
    : (job.technician || "Unassigned");

  const ageInfo = calcJobAge(job.createdAt, job.completedAt, status);

  async function saveAssignment() {
    setAssignLoading(true);
    setAssignError(null);
    setAssignSaved(false);
    const supabase = createClient();
    const { error } = await supabase
      .from("jobs")
      .update({ technician_id: technicianId || null, priority })
      .eq("id", job.id);
    setAssignLoading(false);
    if (error) { setAssignError(error.message); return; }
    setAssignSaved(true);
    setTimeout(() => setAssignSaved(false), 2500);
  }

  async function saveStatus() {
    setStatusLoading(true);
    setStatusError(null);
    setStatusSaved(false);
    const supabase = createClient();
    const { error } = await supabase
      .from("jobs")
      .update({ status })
      .eq("id", job.id);
    setStatusLoading(false);
    if (error) {
      setStatusError(
        error.message.includes("CHECKLIST_INCOMPLETE")
          ? "Cannot complete — required checklist items are still pending."
          : error.message
      );
      return;
    }
    setStatusSaved(true);
    setTimeout(() => setStatusSaved(false), 2500);
  }

  async function markComplete() {
    const prevStatus = status;
    setStatus("completed");
    setStatusLoading(true);
    setStatusError(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("jobs")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", job.id);
    setStatusLoading(false);
    if (error) {
      setStatusError(
        error.message.includes("CHECKLIST_INCOMPLETE")
          ? "Cannot complete — required checklist items are still pending."
          : error.message
      );
      setStatus(prevStatus);
      return;
    }
    setStatusSaved(true);
    setTimeout(() => setStatusSaved(false), 2500);
  }

  async function saveNote() {
    if (!noteText.trim()) return;
    setNoteLoading(true);
    setNoteError(null);
    setNoteSaved(false);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setNoteError("Not authenticated."); setNoteLoading(false); return; }
    const { data: newNote, error } = await supabase
      .from("job_notes")
      .insert({
        organization_id:   job.organizationId,
        job_id:            job.id,
        author_profile_id: user.id,
        body:              noteText.trim(),
      })
      .select("id, body, created_at")
      .single();
    setNoteLoading(false);
    if (error) { setNoteError(error.message); return; }
    setNotes(prev => [...prev, {
      id:        newNote.id as string,
      body:      newNote.body as string,
      createdAt: newNote.created_at as string,
      author:    "You",
    }]);
    setNoteText("");
    setNoteSaved(true);
    setTimeout(() => setNoteSaved(false), 2500);
  }

  return (
    <div className="space-y-6">

      {/* Header card */}
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <PriorityBadge value={priority} />
              <StatusBadge value={status} />
              <span className="text-xs font-mono text-muted-foreground">{fmtJobNumber(job.jobNumber)}</span>
            </div>
            <h2 className="text-lg font-semibold text-foreground">{job.client}</h2>
            <p className="text-sm text-muted-foreground">{job.site}</p>
          </div>
          <Button
            size="sm" variant="outline" className="h-9 text-xs gap-1.5"
            onClick={markComplete}
            disabled={statusLoading || status === "completed"}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {status === "completed" ? "Completed" : "Mark Complete"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left: static job info */}
        <div className="lg:col-span-2 space-y-4">

          {/* Client & location */}
          <div className="rounded-lg border border-border bg-card p-5 space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Client & Location</h3>
            <div className="space-y-2.5">
              <div className="flex items-center gap-3">
                <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">{job.client}</p>
                  <p className="text-xs text-muted-foreground">{job.site}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-foreground">{job.address || "—"}</p>
                  {job.address && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                    >
                      <MapPin className="h-3 w-3" /> Open in Google Maps
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Job info */}
          <div className="rounded-lg border border-border bg-card p-5 space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Job Information</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Type</p>
                <p className="text-foreground font-medium">{job.type}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Technician</p>
                <p className="text-foreground font-medium">{technicianName}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Scheduled</p>
                <p className="text-foreground font-medium">{job.scheduled}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Priority</p>
                <p className="text-foreground font-medium capitalize">{priority}</p>
              </div>
            </div>
            {(job.dispatcherNotes || job.technicianNotes || job.requestId) && (
              <>
                <Separator className="bg-border" />
                {job.dispatcherNotes && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5">Dispatcher Notes</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{job.dispatcherNotes}</p>
                  </div>
                )}
                {job.technicianNotes && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5">Technician Notes</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{job.technicianNotes}</p>
                  </div>
                )}
                {job.requestId && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Source Request</p>
                    <Link
                      href={`/requests/${job.requestId}`}
                      className="text-xs text-primary hover:underline font-mono"
                    >
                      {fmtReqNumber(job.requestNumber)}
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>

          <JobChecklist
            jobId={job.id}
            organizationId={job.organizationId}
            initialItems={job.checklistItems}
          />

          {/* Internal notes history */}
          <div className="rounded-lg border border-border bg-card p-5 space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Internal Notes</h3>
            {notes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No notes yet.</p>
            ) : (
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
          </div>
        </div>

        {/* Right: admin actions */}
        <div className="space-y-4">

          {/* Assignment */}
          <div className="rounded-lg border border-border bg-card p-5 space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <UserCog className="h-3.5 w-3.5" /> Assignment
            </h3>
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Technician</p>
              <Select
                value={technicianId}
                onValueChange={v => { setTechnicianId(v ?? technicianId); setAssignSaved(false); }}
              >
                <SelectTrigger className="h-9 text-sm">
                  <span className="truncate">
                    {technicians.find(t => t.id === technicianId)?.full_name ?? "Select technician"}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {technicians.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Priority</p>
              <Select value={priority} onValueChange={v => { setPriority(v ?? priority); setAssignSaved(false); }}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_LABELS).map(([val, label]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline" className="w-full h-9 text-xs gap-1.5"
              onClick={saveAssignment} disabled={assignLoading}
            >
              <Save className="h-3.5 w-3.5" />
              {assignLoading ? "Saving…" : assignSaved ? "Saved!" : "Save Assignment"}
            </Button>
            {assignSaved && (
              <p className="text-xs text-c-success text-center flex items-center justify-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Saved
              </p>
            )}
            {assignError && <p className="text-xs text-destructive">{assignError}</p>}
          </div>

          {/* Status */}
          <div className="rounded-lg border border-border bg-card p-5 space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Update Status</h3>
            <Select value={status} onValueChange={v => { setStatus(v ?? status); setStatusSaved(false); }}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABELS).map(([val, label]) => (
                  <SelectItem key={val} value={val}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              className="w-full h-9 text-sm gap-1.5"
              onClick={saveStatus} disabled={statusLoading}
            >
              <Save className="h-3.5 w-3.5" />
              {statusLoading ? "Saving…" : statusSaved ? "Saved!" : "Save Status"}
            </Button>
            {statusSaved && (
              <p className="text-xs text-c-success text-center flex items-center justify-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Saved
              </p>
            )}
            {statusError && <p className="text-xs text-destructive">{statusError}</p>}
          </div>

          {/* Timeline */}
          <div className="rounded-lg border border-border bg-card p-5 space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Timeline
            </h3>
            <div className="space-y-2 text-xs">
              {job.requestCreatedAt && (
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Request created</span>
                  <span className="text-foreground font-medium text-right">{fmtDatetime(job.requestCreatedAt)}</span>
                </div>
              )}
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Job created</span>
                <span className="text-foreground font-medium text-right">{fmtDatetime(job.createdAt)}</span>
              </div>
              {job.scheduledAt && (
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Scheduled</span>
                  <span className="text-foreground font-medium text-right">{fmtDatetime(job.scheduledAt)}</span>
                </div>
              )}
              {job.completedAt && (
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Completed</span>
                  <span className="text-foreground font-medium text-right">{fmtDatetime(job.completedAt)}</span>
                </div>
              )}
              <Separator className="bg-border" />
              <div className="flex justify-between gap-2 pt-0.5">
                <span className="text-muted-foreground">Age</span>
                <span className={`font-semibold ${ageInfo.isComplete ? "text-c-success" : "text-foreground"}`}>
                  {ageInfo.label}
                </span>
              </div>
            </div>
          </div>

          <JobPhotoPanel jobId={job.id} organizationId={job.organizationId} />

          {/* Add note */}
          <div className="rounded-lg border border-border bg-card p-5 space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Add Note</h3>
            <Textarea
              placeholder="Add an internal note…"
              rows={3}
              className="text-sm resize-none"
              value={noteText}
              onChange={e => { setNoteText(e.target.value); setNoteSaved(false); }}
            />
            <Button
              variant="outline" className="w-full h-9 text-xs gap-1.5"
              onClick={saveNote} disabled={noteLoading || !noteText.trim()}
            >
              <FileText className="h-3.5 w-3.5" />
              {noteLoading ? "Saving…" : "Save Note"}
            </Button>
            {noteSaved && (
              <p className="text-xs text-c-success text-center flex items-center justify-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Note saved
              </p>
            )}
            {noteError && <p className="text-xs text-destructive">{noteError}</p>}
          </div>

          {/* Mark complete */}
          <Button
            className="w-full h-11 text-sm gap-2 bg-c-success-solid hover:bg-c-success-solid/90 text-white"
            onClick={markComplete}
            disabled={statusLoading || status === "completed"}
          >
            <CheckCircle2 className="h-4 w-4" />
            {status === "completed" ? "Job Completed" : "Mark Job Complete"}
          </Button>
        </div>
      </div>
    </div>
  );
}

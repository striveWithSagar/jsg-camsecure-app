"use client";

import { useState, useEffect } from "react";
import { useMockStore } from "@/lib/mock-store";
import type { MockJobItem } from "@/lib/mock-store";
import { StatusBadge, PriorityBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { MOCK_TECHNICIANS, STATUS_LABELS, PRIORITY_LABELS } from "@/lib/constants";
import {
  MapPin, CheckCircle2, User, FileText, Upload, UserCog, Save,
} from "lucide-react";

export function JobDetail({
  jobId,
  seedJob,
}: {
  jobId: string;
  seedJob: MockJobItem | null;
}) {
  const store = useMockStore();

  // On first render, use seed (avoids SSR mismatch). After hydration, sync to stored state.
  const initial = seedJob ?? store.jobs.find(j => j.id === jobId);
  const [technician, setTechnician] = useState(initial?.technician ?? "");
  const [priority, setPriority]     = useState(initial?.priority   ?? "medium");
  const [status, setStatus]         = useState(initial?.status     ?? "assigned");
  const [assignSaved, setAssignSaved] = useState(false);
  const [statusSaved, setStatusSaved] = useState(false);
  const [noteSaved, setNoteSaved]     = useState(false);

  // Sync local state with localStorage once the store has hydrated
  useEffect(() => {
    if (!store.hydrated) return;
    const stored = store.jobs.find(j => j.id === jobId);
    if (stored) {
      setTechnician(stored.technician);
      setPriority(stored.priority);
      setStatus(stored.status);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.hydrated]);

  // Pull latest non-mutable fields from store (for display)
  const job = store.jobs.find(j => j.id === jobId) ?? seedJob;

  if (!job) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-sm text-muted-foreground">Job not found.</p>
      </div>
    );
  }

  function saveAssignment() {
    store.updateJobAssignment(job!.id, technician, priority);
    setAssignSaved(true);
    setTimeout(() => setAssignSaved(false), 2500);
  }

  function saveStatus() {
    store.updateJobStatus(job!.id, status);
    setStatusSaved(true);
    setTimeout(() => setStatusSaved(false), 2500);
  }

  function markComplete() {
    setStatus("completed");
    store.updateJobStatus(job!.id, "completed");
    setStatusSaved(true);
    setTimeout(() => setStatusSaved(false), 2500);
  }

  return (
    <div className="space-y-6">

      {/* Header card — reflects current local state */}
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <PriorityBadge value={priority} />
              <StatusBadge value={status} />
              <span className="text-xs font-mono text-muted-foreground">{job.id}</span>
            </div>
            <h2 className="text-lg font-semibold text-foreground">{job.client}</h2>
            <p className="text-sm text-muted-foreground">{job.site}</p>
          </div>
          <Button size="sm" variant="outline" className="h-9 text-xs gap-1.5" onClick={markComplete}>
            <CheckCircle2 className="h-3.5 w-3.5" /> Mark Complete
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
                  <p className="text-sm text-foreground">{job.address}</p>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                  >
                    <MapPin className="h-3 w-3" /> Open in Google Maps
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Job info — shows current technician/priority from local state */}
          <div className="rounded-lg border border-border bg-card p-5 space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Job Information</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Type</p>
                <p className="text-foreground font-medium">{job.type}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Technician</p>
                <p className="text-foreground font-medium">{technician}</p>
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
            <Separator className="bg-border" />
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5">Job Description</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Customer reported {job.type.toLowerCase()} issue. Inspect all connections, power supply, and cabling.
              </p>
            </div>
          </div>

          {/* Internal notes — not persisted in mock, replaced by Supabase notes table */}
          <div className="rounded-lg border border-border bg-card p-5 space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Internal Notes</h3>
            <p className="text-sm text-muted-foreground">Check previous service history before dispatching. Confirm access with client day before.</p>
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
              <Select value={technician} onValueChange={v => { setTechnician(v ?? technician); setAssignSaved(false); }}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MOCK_TECHNICIANS.map(t => (
                    <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
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
            <Button variant="outline" className="w-full h-9 text-xs gap-1.5" onClick={saveAssignment}>
              <Save className="h-3.5 w-3.5" />
              {assignSaved ? "Saved!" : "Save Assignment"}
            </Button>
            {assignSaved && (
              <p className="text-xs text-c-success text-center flex items-center justify-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Persisted locally
              </p>
            )}
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
            <Button className="w-full h-9 text-sm gap-1.5" onClick={saveStatus}>
              <Save className="h-3.5 w-3.5" />
              {statusSaved ? "Saved!" : "Save Status"}
            </Button>
            {statusSaved && (
              <p className="text-xs text-c-success text-center flex items-center justify-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Persisted locally
              </p>
            )}
          </div>

          {/* Photos */}
          <div className="rounded-lg border border-border bg-card p-5 space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Photos</h3>
            <div className="grid grid-cols-2 gap-2">
              <button className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border py-5 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors">
                <Upload className="h-4 w-4" /> Before
              </button>
              <button className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border py-5 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors">
                <Upload className="h-4 w-4" /> After
              </button>
            </div>
          </div>

          {/* Note */}
          <div className="rounded-lg border border-border bg-card p-5 space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Add Note</h3>
            <Textarea placeholder="Job notes, findings, parts used…" rows={3} className="text-sm resize-none" />
            <Button variant="outline" className="w-full h-9 text-xs gap-1.5" onClick={() => { setNoteSaved(true); setTimeout(() => setNoteSaved(false), 2500); }}>
              <FileText className="h-3.5 w-3.5" />
              {noteSaved ? "Saved!" : "Save Note"}
            </Button>
          </div>

          {/* Mark complete */}
          <Button
            className="w-full h-11 text-sm gap-2 bg-c-success-solid hover:bg-c-success-solid/90 text-white"
            onClick={markComplete}
          >
            <CheckCircle2 className="h-4 w-4" /> Mark Job Complete
          </Button>
        </div>
      </div>
    </div>
  );
}

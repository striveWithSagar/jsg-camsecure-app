"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PriorityBadge } from "@/components/shared/StatusBadge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { REQUEST_STATUS_LABELS } from "@/lib/constants";
import { cn, fmtReqNumber } from "@/lib/utils";
import { Phone, Clock, Save, Briefcase, CheckCircle2 } from "lucide-react";
import Link from "next/link";

const STATUS_STYLE: Record<string, string> = {
  new:               "text-primary bg-primary/10 border-primary/20",
  reviewing:         "text-c-teal bg-c-teal border-c-teal",
  ready_to_schedule: "text-c-amber bg-c-amber border-c-amber",
  converted:         "text-c-success bg-c-success border-c-success",
  cancelled:         "text-muted-foreground bg-muted/40 border-border",
};

const EDITABLE_STATUSES = [
  { value: "new",               label: "New" },
  { value: "reviewing",         label: "Reviewing" },
  { value: "ready_to_schedule", label: "Ready to Schedule" },
  { value: "cancelled",         label: "Cancelled" },
];

export type RequestDetailData = {
  id:            string;
  client:        string;
  phone:         string;
  type:          string;
  urgency:       string;
  status:        string;
  description:   string;
  notes:         string;
  created:       string;
  requestNumber: number | null;
};

export function RequestDetail({
  requestId,
  request,
}: {
  requestId: string;
  request: RequestDetailData | null;
}) {
  const [status, setStatus]           = useState(request?.status ?? "new");
  const [notes, setNotes]             = useState(request?.notes  ?? "");
  const [statusSaved, setStatusSaved] = useState(false);
  const [notesSaved, setNotesSaved]   = useState(false);

  if (!request) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-sm text-muted-foreground">Request not found.</p>
      </div>
    );
  }

  const isTerminal = status === "converted" || status === "cancelled";

  async function saveStatus() {
    const supabase = createClient();
    const { error } = await supabase
      .from("service_requests")
      .update({ status })
      .eq("id", requestId);
    if (!error) {
      setStatusSaved(true);
      setTimeout(() => setStatusSaved(false), 2500);
    }
  }

  async function saveNotes() {
    const supabase = createClient();
    const { error } = await supabase
      .from("service_requests")
      .update({ notes })
      .eq("id", requestId);
    if (!error) {
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2500);
    }
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-2 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <PriorityBadge value={request.urgency} />
              <span className={cn(
                "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border",
                STATUS_STYLE[status] ?? STATUS_STYLE.new
              )}>
                {REQUEST_STATUS_LABELS[status as keyof typeof REQUEST_STATUS_LABELS] ?? status}
              </span>
              <span className="font-mono text-xs text-muted-foreground">{fmtReqNumber(request.requestNumber)}</span>
            </div>
            <h2 className="text-xl font-semibold text-foreground">{request.client}</h2>
            <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1.5">
                <Phone className="h-3 w-3" />
                <a href={`tel:${request.phone}`} className="hover:text-foreground transition-colors">{request.phone}</a>
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-3 w-3" /> Received {request.created}
              </span>
            </div>
          </div>

          {!isTerminal && (
            <Link
              href={`/requests/${requestId}/convert`}
              className={cn(buttonVariants({ size: "sm" }), "h-9 gap-1.5 shrink-0")}
            >
              <Briefcase className="h-3.5 w-3.5" /> Convert to Job
            </Link>
          )}
          {status === "converted" && (
            <span className="inline-flex items-center gap-1.5 text-xs text-c-success font-medium shrink-0">
              <CheckCircle2 className="h-3.5 w-3.5" /> Converted to Job
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left */}
        <div className="lg:col-span-2 space-y-4">

          <div className="rounded-lg border border-border bg-card p-5 space-y-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Request Details</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Service Type</p>
                <p className="text-sm font-medium text-foreground">{request.type}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Urgency</p>
                <p className="text-sm font-medium text-foreground capitalize">{request.urgency}</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5">Description</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{request.description}</p>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-5 space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Internal Notes</h3>
            <Textarea
              value={notes}
              onChange={e => { setNotes(e.target.value); setNotesSaved(false); }}
              placeholder="Add internal notes, context, or follow-up reminders…"
              rows={4}
              className="text-sm resize-none"
            />
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={saveNotes}>
                <Save className="h-3 w-3" />
                {notesSaved ? "Saved!" : "Save Notes"}
              </Button>
              {notesSaved && (
                <span className="text-xs text-c-success flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Saved
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right */}
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-5 space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Status</h3>
            {isTerminal ? (
              <p className="text-sm text-muted-foreground">
                Status locked: <span className="font-medium text-foreground capitalize">{status.replace(/_/g, " ")}</span>.
              </p>
            ) : (
              <>
                <Select value={status} onValueChange={v => { setStatus(v ?? status); setStatusSaved(false); }}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EDITABLE_STATUSES.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button className="w-full h-9 text-sm gap-1.5" onClick={saveStatus}>
                  <Save className="h-3.5 w-3.5" />
                  {statusSaved ? "Saved!" : "Save Status"}
                </Button>
                {statusSaved && (
                  <p className="text-xs text-c-success text-center flex items-center justify-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Saved
                  </p>
                )}
              </>
            )}
          </div>

          {!isTerminal && (
            <div className="rounded-lg border border-border bg-card p-5 space-y-2.5">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Actions</h3>
              <Link
                href={`/requests/${requestId}/convert`}
                className={cn(buttonVariants({ size: "sm" }), "w-full h-9 text-sm gap-1.5 justify-center")}
              >
                <Briefcase className="h-3.5 w-3.5" /> Convert to Job
              </Link>
              <Link
                href="/requests"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full h-8 text-xs")}
              >
                Back to List
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

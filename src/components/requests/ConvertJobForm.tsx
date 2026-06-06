"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ClientOption } from "@/lib/data/clients";
import type { TechnicianOption } from "@/lib/data/technicians";
import { PRIORITY_LABELS } from "@/lib/constants";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PriorityBadge } from "@/components/shared/StatusBadge";
import { cn, fmtJobNumber, fmtReqNumber } from "@/lib/utils";
import { validateDateTimeLocalInput, toDateTimeLocalInputValue } from "@/lib/date-input";
import { ArrowLeft, Briefcase, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import Link from "next/link";

export type ConvertRequestData = {
  id:            string;
  client:        string;
  type:          string;        // resolved display label
  serviceTypeDb: string;        // raw DB enum value — passed directly to RPC
  urgency:       string;
  description:   string;
  requestNumber: number | null;
  clientId:      string | null; // pre-set when request has client_id
  clientName:    string | null; // resolved name for read-only display
  siteAddress:   string;        // resolved address — from request, client fallback, or ""
  addressSource: "request" | "client" | "none"; // which source provided the address
  preferredAt:   string | null; // from service_requests.preferred_at — prefills schedule
};

type Errors = Partial<Record<string, string>>;

export function ConvertJobForm({
  requestId,
  request,
  clients,
  technicians,
}: {
  requestId:   string;
  request:     ConvertRequestData | null;
  clients:     ClientOption[];
  technicians: TechnicianOption[];
}) {
  const [clientId,      setClientId]      = useState(request?.clientId ?? "");
  const [technicianId,  setTechnicianId]  = useState("");
  const [priority,      setPriority]      = useState(request?.urgency ?? "medium");
  const [errors,        setErrors]        = useState<Errors>({});
  const [converted,     setConverted]     = useState(false);
  const [newJobId,      setNewJobId]      = useState("");
  const [newJobNumber,  setNewJobNumber]  = useState<number | null>(null);
  const [loading,       setLoading]       = useState(false);
  const [submitError,   setSubmitError]   = useState<string | null>(null);

  if (!request) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-sm text-muted-foreground">Request not found.</p>
      </div>
    );
  }

  function clearError(key: string) {
    setErrors(prev => ({ ...prev, [key]: undefined }));
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!request) return;

    // Capture form data synchronously before any awaits
    const data        = new FormData(e.currentTarget);
    const schedule    = ((data.get("schedule")  as string) ?? "").trim();
    const deadlineRaw = ((data.get("deadline")  as string) ?? "").trim();
    const address     = ((data.get("address")   as string) ?? "").trim();
    const tools       = ((data.get("tools")     as string) ?? "").trim();
    const jobNotes    = ((data.get("job-notes") as string) ?? "").trim();

    const next: Errors = {};
    // Only validate client selection when request has no pre-set client_id
    if (!request.clientId && !clientId) next.clientId = "Please select a client account.";
    if (!technicianId) next.technicianId = "Please assign a technician.";
    if (!address)      next.address      = "Site address is required.";

    // Validate scheduled date/time (required)
    if (!schedule) {
      next.schedule = "Scheduled date and time is required.";
    } else {
      try { validateDateTimeLocalInput(schedule, false); }
      catch (err) { next.schedule = err instanceof Error ? err.message : "Invalid date and time."; }
    }

    // Validate deadline (optional)
    if (deadlineRaw) {
      try { validateDateTimeLocalInput(deadlineRaw, true); }
      catch (err) { next.deadline = err instanceof Error ? err.message : "Invalid date and time."; }
    }

    // Deadline must be after scheduled date if both are provided and both are valid
    if (!next.schedule && !next.deadline && schedule && deadlineRaw && deadlineRaw < schedule) {
      next.deadline = "Deadline must be after the scheduled date and time.";
    }

    if (Object.keys(next).length > 0) { setErrors(next); return; }

    setLoading(true);
    setSubmitError(null);

    const supabase = createClient();
    const { data: jobId, error: rpcError } = await supabase.rpc("convert_request_to_job", {
      p_request_id:       requestId,
      p_client_id:        clientId,
      p_technician_id:    technicianId,
      p_site_name:        address,
      p_address:          address,
      p_service_type:     request.serviceTypeDb,
      p_priority:         priority,
      p_scheduled_at:     schedule,
      p_dispatcher_notes: tools,
      p_technician_notes: jobNotes,
    });

    if (rpcError || !jobId) {
      setSubmitError(rpcError?.message ?? "Failed to create job. Please try again.");
      setLoading(false);
      return;
    }

    // Save deadline_at if provided (RPC has no p_deadline_at param — direct UPDATE)
    if (deadlineRaw) {
      await supabase
        .from("jobs")
        .update({ deadline_at: deadlineRaw })
        .eq("id", jobId as string);
    }

    const { data: jobData } = await supabase
      .from("jobs")
      .select("job_number")
      .eq("id", jobId as string)
      .single();

    setNewJobId(jobId as string);
    setNewJobNumber(jobData?.job_number ?? null);
    setConverted(true);
    setLoading(false);
  }

  if (converted) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center gap-5">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-c-success/15 border border-c-success/30">
          <CheckCircle2 className="h-8 w-8 text-c-success" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">Job Created</h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-sm">
            {request.client} has been converted to job{" "}
            <span className="font-mono font-semibold text-foreground">{fmtJobNumber(newJobNumber)}</span>.
          </p>
        </div>
        <div className="flex gap-3 mt-2 flex-wrap justify-center">
          <Link href={`/jobs/${newJobId}`} className={cn(buttonVariants({ size: "sm" }), "h-9")}>
            View Job
          </Link>
          <Link href={`/requests/${requestId}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9")}>
            View Request
          </Link>
          <Link href="/jobs" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9")}>
            Job Board
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href={`/requests/${requestId}`}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3 w-3" /> Back to Request
      </Link>

      {/* Request summary — read-only */}
      <div className="rounded-lg border border-border bg-muted/10 p-4 flex items-start gap-4">
        <Briefcase className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <p className="text-sm font-semibold text-foreground">{request.client}</p>
            <PriorityBadge value={request.urgency} />
            <span className="font-mono text-xs text-muted-foreground">{fmtReqNumber(request.requestNumber)}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {request.type} · {request.description.length > 90
              ? request.description.substring(0, 90) + "…"
              : request.description}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">

        {/* Assignment */}
        <section className="rounded-lg border border-border bg-card p-5 space-y-4">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Assignment</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Client — read-only when request has client_id, dropdown otherwise */}
            <div className="space-y-1.5">
              <Label className="text-xs">
                Client Account {!request.clientId && <span className="text-destructive">*</span>}
              </Label>
              {request.clientId ? (
                <div className="flex h-9 items-center rounded-md border border-border bg-muted/30 px-3 text-sm text-foreground">
                  {request.clientName ?? clients.find(c => c.id === request.clientId)?.name ?? "—"}
                </div>
              ) : (
                <>
                  <Select
                    value={clientId}
                    onValueChange={v => { setClientId(v ?? ""); clearError("clientId"); }}
                  >
                    <SelectTrigger className={cn("h-9 text-sm", errors.clientId && "border-destructive")}>
                      <span className="truncate">
                        {clients.find(c => c.id === clientId)?.name ?? "Select client"}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.clientId && <p className="text-xs text-destructive">{errors.clientId}</p>}
                </>
              )}
            </div>

            {/* Technician selector — UUID value, name label */}
            <div className="space-y-1.5">
              <Label className="text-xs">Technician <span className="text-destructive">*</span></Label>
              <Select
                value={technicianId}
                onValueChange={v => { setTechnicianId(v ?? ""); clearError("technicianId"); }}
              >
                <SelectTrigger className={cn("h-9 text-sm", errors.technicianId && "border-destructive")}>
                  <span className="truncate">
                    {technicians.find(t => t.id === technicianId)?.full_name ?? "Select technician"}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {technicians.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.full_name}
                      {t.status === "available"  ? " · Available"   :
                       t.status === "on_job"     ? " · On Job"      :
                       t.status === "on_the_way" ? " · On the Way"  : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.technicianId && <p className="text-xs text-destructive">{errors.technicianId}</p>}
            </div>

            {/* Priority — PRIORITY_LABELS keys match job_priority enum */}
            <div className="space-y-1.5">
              <Label className="text-xs">Priority</Label>
              <Select value={priority} onValueChange={v => setPriority(v ?? priority)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_LABELS).map(([val, label]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        {/* Schedule & location */}
        <section className="rounded-lg border border-border bg-card p-5 space-y-4">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Schedule & Location</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="schedule" className="text-xs">
                Scheduled Date & Time <span className="text-destructive">*</span>
              </Label>
              <DateTimeInput
                id="schedule" name="schedule" type="datetime-local"
                defaultValue={toDateTimeLocalInputValue(request.preferredAt)}
                className={cn("h-9 text-sm", errors.schedule && "border-destructive")}
                onChange={() => clearError("schedule")}
              />
              {errors.schedule && <p className="text-xs text-destructive">{errors.schedule}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="deadline" className="text-xs">Deadline (optional)</Label>
              <DateTimeInput
                id="deadline" name="deadline" type="datetime-local"
                className={cn("h-9 text-sm", errors.deadline && "border-destructive")}
                onChange={() => clearError("deadline")}
              />
              {errors.deadline && <p className="text-xs text-destructive">{errors.deadline}</p>}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="address" className="text-xs">
              Site Address <span className="text-destructive">*</span>
            </Label>
            {/* Warning banner when no address source is available */}
            {request.addressSource === "none" && (
              <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/8 px-3 py-2 text-xs text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                No site address found on this request or client account. Please enter the job site address.
              </div>
            )}
            <Input
              id="address" name="address"
              placeholder="Full address including city"
              defaultValue={request.siteAddress}
              className={cn("h-9 text-sm", errors.address && "border-destructive")}
              onChange={() => clearError("address")}
            />
            {/* Source hint — only show when a value is pre-filled */}
            {request.addressSource === "request" && !errors.address && (
              <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Info className="h-3 w-3 shrink-0" />
                Pre-filled from client request. Edit only if the job site is different.
              </p>
            )}
            {request.addressSource === "client" && !errors.address && (
              <p className="flex items-center gap-1 text-[11px] text-amber-400/80">
                <Info className="h-3 w-3 shrink-0" />
                No request address was found. Using client account address as fallback.
              </p>
            )}
            {errors.address && <p className="text-xs text-destructive">{errors.address}</p>}
          </div>
        </section>

        {/* Job details */}
        <section className="rounded-lg border border-border bg-card p-5 space-y-4">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Job Details</h2>
          <div className="space-y-1.5">
            <Label htmlFor="tools" className="text-xs">Required Tools / Materials</Label>
            <Textarea
              id="tools" name="tools"
              placeholder="e.g. cable tester, BNC connectors, 50m RG-59, power supply tester"
              rows={2}
              className="text-sm resize-none"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="job-notes" className="text-xs">Notes for Technician</Label>
            <Textarea
              id="job-notes" name="job-notes"
              placeholder="Any context or special instructions for the field technician…"
              rows={3}
              className="text-sm resize-none"
            />
          </div>
        </section>

        <div className="flex items-center gap-3 pb-6 flex-wrap">
          <Button type="submit" disabled={loading} className="h-9 px-5 text-sm gap-1.5">
            <Briefcase className="h-3.5 w-3.5" />
            {loading ? "Creating…" : "Create Job"}
          </Button>
          <Link
            href={`/requests/${requestId}`}
            className={cn(buttonVariants({ variant: "outline" }), "h-9 px-5 text-sm")}
          >
            Cancel
          </Link>
          {submitError && (
            <p className="text-xs text-destructive w-full">{submitError}</p>
          )}
        </div>
      </form>
    </div>
  );
}

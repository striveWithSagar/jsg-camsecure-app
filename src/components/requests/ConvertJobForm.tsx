"use client";

import { useState } from "react";
import { useMockStore } from "@/lib/mock-store";
import type { MockRequestItem } from "@/lib/mock-store";
import { MOCK_TECHNICIANS, PRIORITY_LABELS } from "@/lib/constants";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PriorityBadge } from "@/components/shared/StatusBadge";
import { cn } from "@/lib/utils";
import { ArrowLeft, Briefcase, CheckCircle2 } from "lucide-react";
import Link from "next/link";

type Errors = Partial<Record<string, string>>;

export function ConvertJobForm({ request }: { request: MockRequestItem }) {
  const store = useMockStore();

  const [technician, setTechnician] = useState("");
  const [priority, setPriority]     = useState(request.urgency.toLowerCase());
  const [errors, setErrors]         = useState<Errors>({});
  const [converted, setConverted]   = useState(false);
  const [newJobId, setNewJobId]     = useState("");
  const [assignedTech, setAssignedTech] = useState("");

  function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const data     = new FormData(e.currentTarget);
    const schedule = ((data.get("schedule") as string) ?? "").trim();
    const address  = ((data.get("address")  as string) ?? "").trim();

    const next: Errors = {};
    if (!technician) next.technician = "Please assign a technician.";
    if (!schedule)   next.schedule   = "Scheduled date and time is required.";
    if (!address)    next.address    = "Site address is required.";

    if (Object.keys(next).length > 0) { setErrors(next); return; }

    const id = store.convertToJob(request.id, {
      client:     request.client,
      site:       address,
      type:       request.type,
      priority,
      status:     "assigned",
      technician,
      scheduled:  schedule,
      address,
    });

    setNewJobId(id);
    setAssignedTech(technician);
    setConverted(true);
  }

  if (converted) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center gap-5">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-c-success border border-c-success">
          <CheckCircle2 className="h-8 w-8 text-c-success" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">Job Created</h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-sm">
            {request.client} has been converted to{" "}
            <span className="font-semibold text-foreground">{newJobId}</span> and assigned to {assignedTech}.
          </p>
        </div>
        <div className="flex gap-3 mt-2 flex-wrap justify-center">
          <Link href={`/jobs/${newJobId}`} className={cn(buttonVariants({ size: "sm" }), "h-9")}>
            View {newJobId}
          </Link>
          <Link href="/jobs" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9")}>
            Job Board
          </Link>
          <Link href="/requests" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9")}>
            Requests
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href={`/requests/${request.id}`}
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
            <PriorityBadge value={request.urgency.toLowerCase()} />
            <span className="font-mono text-xs text-muted-foreground">{request.id}</span>
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
            <div className="space-y-1.5">
              <Label className="text-xs">Technician <span className="text-destructive">*</span></Label>
              <Select
                value={technician}
                onValueChange={v => { setTechnician(v ?? ""); setErrors(p => ({ ...p, technician: undefined })); }}
              >
                <SelectTrigger className={cn("h-9 text-sm", errors.technician && "border-destructive")}>
                  <SelectValue placeholder="Assign technician" />
                </SelectTrigger>
                <SelectContent>
                  {MOCK_TECHNICIANS.map(t => (
                    <SelectItem key={t.id} value={t.name}>
                      {t.name}{t.status === "available" ? " · Available" : t.status === "on_job" ? " · On Job" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.technician && <p className="text-xs text-destructive">{errors.technician}</p>}
            </div>
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
              <Input
                id="schedule" name="schedule" type="datetime-local"
                className={cn("h-9 text-sm", errors.schedule && "border-destructive")}
                onChange={() => setErrors(p => ({ ...p, schedule: undefined }))}
              />
              {errors.schedule && <p className="text-xs text-destructive">{errors.schedule}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="deadline" className="text-xs">Deadline (optional)</Label>
              <Input id="deadline" name="deadline" type="datetime-local" className="h-9 text-sm" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="address" className="text-xs">
              Site Address <span className="text-destructive">*</span>
            </Label>
            <Input
              id="address" name="address"
              placeholder="Full address including city"
              className={cn("h-9 text-sm", errors.address && "border-destructive")}
              onChange={() => setErrors(p => ({ ...p, address: undefined }))}
            />
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

        <div className="flex items-center gap-3 pb-6">
          <Button type="submit" className="h-9 px-5 text-sm gap-1.5">
            <Briefcase className="h-3.5 w-3.5" /> Create Job
          </Button>
          <Link
            href={`/requests/${request.id}`}
            className={cn(buttonVariants({ variant: "outline" }), "h-9 px-5 text-sm")}
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

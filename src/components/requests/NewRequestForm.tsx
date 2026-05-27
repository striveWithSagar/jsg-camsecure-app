"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { SERVICE_TYPES, URGENCY_LEVELS } from "@/lib/constants";
import { cn, fmtReqNumber } from "@/lib/utils";
import { CheckCircle2 } from "lucide-react";
import Link from "next/link";

// Maps the display-string Select values to the DB enum values in service_requests.service_type
const SERVICE_TYPE_DB: Record<string, string> = {
  "New Installation":  "new_installation",
  "Maintenance":       "maintenance",
  "DVR/NVR Issue":     "dvr_nvr_issue",
  "Camera Outage":     "camera_outage",
  "Mobile App Issue":  "mobile_app_issue",
  "Wiring Issue":      "wiring_issue",
  "Emergency Service": "emergency_service",
  "Quote Request":     "quote_request",
  "Site Inspection":   "site_inspection",
  "Other":             "other",
};

type Errors = Partial<Record<string, string>>;

export function NewRequestForm() {
  const [serviceType, setServiceType] = useState("");
  const [urgency, setUrgency]         = useState("");
  const [errors, setErrors]           = useState<Errors>({});
  const [submitted,      setSubmitted]      = useState(false);
  const [createdId,      setCreatedId]      = useState("");
  const [requestNumber,  setRequestNumber]  = useState<number | null>(null);
  const [loading,        setLoading]        = useState(false);
  const [submitError,    setSubmitError]    = useState<string | null>(null);

  function clear(key: string) {
    setErrors(prev => ({ ...prev, [key]: undefined }));
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const data         = new FormData(e.currentTarget);
    const clientName   = ((data.get("client-name")   as string) ?? "").trim();
    const businessName = ((data.get("business-name") as string) ?? "").trim();
    const phone        = ((data.get("phone")          as string) ?? "").trim();
    const desc         = ((data.get("description")    as string) ?? "").trim();
    const notes        = ((data.get("notes")          as string) ?? "").trim();

    const next: Errors = {};
    if (!clientName)   next["client-name"] = "Client name is required.";
    if (!phone)        next.phone          = "Phone number is required.";
    if (!serviceType)  next.serviceType    = "Please select a service type.";
    if (!urgency)      next.urgency        = "Please select an urgency level.";
    if (!desc)         next.description    = "Please describe the issue.";

    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }

    setLoading(true);
    setSubmitError(null);

    const supabase = createClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      setSubmitError("Not authenticated. Please sign in again.");
      setLoading(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      setSubmitError("Could not load your profile. Please try again.");
      setLoading(false);
      return;
    }

    const { data: inserted, error: insertError } = await supabase
      .from("service_requests")
      .insert({
        organization_id:         profile.organization_id,
        submitted_by_profile_id: user.id,
        client_name:             businessName || clientName,
        client_phone:            phone,
        service_type:            SERVICE_TYPE_DB[serviceType] ?? serviceType,
        urgency,
        description:             desc,
        notes,
      })
      .select("id, request_number")
      .single();

    if (insertError || !inserted) {
      setSubmitError(insertError?.message ?? "Failed to create request. Please try again.");
      setLoading(false);
      return;
    }

    setCreatedId(inserted.id as string);
    setRequestNumber((inserted as { id: string; request_number: number | null }).request_number ?? null);
    setSubmitted(true);
    setLoading(false);
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center gap-5">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-c-success border border-c-success">
          <CheckCircle2 className="h-8 w-8 text-c-success" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">Request Created</h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-sm">
            <span className="font-mono font-semibold text-foreground">{fmtReqNumber(requestNumber)}</span> has been logged and will appear in the requests queue.
          </p>
        </div>
        <div className="flex gap-3 mt-2 flex-wrap justify-center">
          <Link href={`/requests/${createdId}`} className={cn(buttonVariants({ size: "sm" }), "h-9")}>
            View Request
          </Link>
          <Link href="/requests" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9")}>
            All Requests
          </Link>
          <Button variant="outline" size="sm" className="h-9" onClick={() => {
            setSubmitted(false);
            setCreatedId("");
            setRequestNumber(null);
            setServiceType("");
            setUrgency("");
            setErrors({});
            setSubmitError(null);
          }}>
            Add Another
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">

      {/* Client info */}
      <section className="rounded-lg border border-border bg-card p-5 space-y-4">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Client Information</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="client-name" className="text-xs">
              Client Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="client-name" name="client-name"
              placeholder="Full name"
              className={cn("h-9 text-sm", errors["client-name"] && "border-destructive")}
              onChange={() => clear("client-name")}
            />
            {errors["client-name"] && <p className="text-xs text-destructive">{errors["client-name"]}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="business-name" className="text-xs">Business / Site Name</Label>
            <Input id="business-name" name="business-name" placeholder="Company or site name" className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone" className="text-xs">
              Phone Number <span className="text-destructive">*</span>
            </Label>
            <Input
              id="phone" name="phone" type="tel"
              placeholder="555-0100"
              className={cn("h-9 text-sm", errors.phone && "border-destructive")}
              onChange={() => clear("phone")}
            />
            {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs">Email Address</Label>
            <Input id="email" name="email" type="email" placeholder="client@company.com" className="h-9 text-sm" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="address" className="text-xs">Site Address</Label>
          <Input
            id="address" name="address"
            placeholder="Full address including city and zip"
            className="h-9 text-sm"
          />
        </div>
      </section>

      {/* Service info */}
      <section className="rounded-lg border border-border bg-card p-5 space-y-4">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Service Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Service Type <span className="text-destructive">*</span></Label>
            <Select value={serviceType} onValueChange={v => { setServiceType(v ?? ""); clear("serviceType"); }}>
              <SelectTrigger className={cn("h-9 text-sm", errors.serviceType && "border-destructive")}>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {SERVICE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            {errors.serviceType && <p className="text-xs text-destructive">{errors.serviceType}</p>}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Urgency Level <span className="text-destructive">*</span></Label>
            <Select value={urgency} onValueChange={v => { setUrgency(v ?? ""); clear("urgency"); }}>
              <SelectTrigger className={cn("h-9 text-sm", errors.urgency && "border-destructive")}>
                <SelectValue placeholder="Select urgency" />
              </SelectTrigger>
              <SelectContent>
                {URGENCY_LEVELS.map(u => <SelectItem key={u} value={u.toLowerCase()}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
            {errors.urgency && <p className="text-xs text-destructive">{errors.urgency}</p>}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="description" className="text-xs">
            Problem Description <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="description" name="description"
            placeholder="Describe the issue or service needed in detail…"
            rows={4}
            className={cn("text-sm resize-none", errors.description && "border-destructive")}
            onChange={() => clear("description")}
          />
          {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="preferred-datetime" className="text-xs">Preferred Date & Time</Label>
          <Input id="preferred-datetime" name="preferred-datetime" type="datetime-local" className="h-9 text-sm" />
        </div>
      </section>

      {/* Internal notes */}
      <section className="rounded-lg border border-border bg-card p-5 space-y-4">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Internal Notes</h2>
        <div className="space-y-1.5">
          <Label htmlFor="notes" className="text-xs">Notes (not visible to client)</Label>
          <Textarea
            id="notes" name="notes"
            placeholder="Any internal notes, context, or follow-up reminders…"
            rows={3}
            className="text-sm resize-none"
          />
        </div>
      </section>

      <div className="flex items-center gap-3 pb-6 flex-wrap">
        <Button type="submit" disabled={loading} className="h-9 px-5 text-sm">
          {loading ? "Creating…" : "Create Request"}
        </Button>
        <Link href="/requests" className={cn(buttonVariants({ variant: "outline" }), "h-9 px-5 text-sm")}>
          Cancel
        </Link>
        {submitError && (
          <p className="text-xs text-destructive w-full">{submitError}</p>
        )}
      </div>
    </form>
  );
}

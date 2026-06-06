"use client";

import { useState, useRef } from "react";
import { useClientProfile } from "@/components/providers/ClientProfileProvider";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, Camera, CheckCircle2, Upload, X, Loader2, AlertTriangle } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { SERVICE_TYPES, URGENCY_LEVELS } from "@/lib/constants";
import { cn, fmtReqNumber } from "@/lib/utils";
import { validateDateTimeLocalInput } from "@/lib/date-input";
import Link from "next/link";

const SERVICE_TYPE_MAP: Record<string, string> = {
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

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic"];
const MAX_BYTES    = 10 * 1024 * 1024;

function sanitizeName(name: string): string {
  const ext  = name.includes(".") ? "." + name.split(".").pop()!.toLowerCase() : "";
  const base = name.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9-]/g, "_");
  return (base || "photo") + ext;
}

type Errors = Partial<Record<string, string>>;

export default function ClientNewRequestPage() {
  const profile = useClientProfile();

  const [submitted,     setSubmitted]     = useState(false);
  const [requestId,     setRequestId]     = useState<string | null>(null);
  const [requestNumber, setRequestNumber] = useState<number | null>(null);
  const [serviceType,   setServiceType]   = useState("");
  const [urgency,       setUrgency]       = useState("");
  const [errors,        setErrors]        = useState<Errors>({});
  const [loading,       setLoading]       = useState(false);
  const [loadingMsg,    setLoadingMsg]    = useState("Submitting…");
  const [submitError,   setSubmitError]   = useState<string | null>(null);
  const [photoWarning,  setPhotoWarning]  = useState<string | null>(null);

  // Staged files — selected before submit, uploaded after request is created
  const [stagedFiles,   setStagedFiles]   = useState<File[]>([]);
  const [fileError,     setFileError]     = useState<string | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  function clearError(key: string) {
    setErrors(prev => ({ ...prev, [key]: undefined }));
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (selected.length === 0) return;

    setFileError(null);
    const valid: File[]   = [];
    const invalid: string[] = [];

    for (const file of selected) {
      if (!ALLOWED_MIME.includes(file.type)) {
        invalid.push(`${file.name}: unsupported type`);
      } else if (file.size > MAX_BYTES) {
        invalid.push(`${file.name}: exceeds 10 MB`);
      } else {
        valid.push(file);
      }
    }

    if (invalid.length > 0) setFileError(invalid.join(", "));
    setStagedFiles(prev => [...prev, ...valid]);
  }

  function removeFile(index: number) {
    setStagedFiles(prev => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Capture synchronously before any awaits
    const formData       = new FormData(e.currentTarget);
    const phone          = (formData.get("phone")        as string ?? "").trim();
    const email          = (formData.get("email")        as string ?? "").trim();
    const address        = (formData.get("address")      as string ?? "").trim();
    const desc           = (formData.get("description")  as string ?? "").trim();
    const preferredRaw   = (formData.get("preferred")    as string ?? "").trim();

    const next: Errors = {};
    if (!phone && !email) next.phone       = "Provide a phone number or email.";
    if (!serviceType)     next.serviceType = "Please select a service type.";
    if (!urgency)         next.urgency     = "Please select an urgency level.";
    if (!desc)            next.description = "Please describe the issue.";

    if (preferredRaw) {
      try { validateDateTimeLocalInput(preferredRaw, true); }
      catch (err) { next.preferred = err instanceof Error ? err.message : "Invalid date and time."; }
    }

    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }

    setLoading(true);
    setLoadingMsg("Submitting…");
    setSubmitError(null);
    setPhotoWarning(null);

    const supabase = createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      setSubmitError("Session expired. Please sign in again.");
      setLoading(false);
      return;
    }

    // Step 1 — create the service request
    const { data, error: insertError } = await supabase
      .from("service_requests")
      .insert({
        organization_id:         profile.orgId,
        client_id:               profile.clientId,
        client_contact_id:       profile.contactId,
        submitted_by_profile_id: user.id,
        client_name:             profile.companyName,
        client_phone:            phone || profile.phone,
        service_type:            SERVICE_TYPE_MAP[serviceType] ?? serviceType,
        urgency:                 urgency.toLowerCase(),
        status:                  "new",
        description:             desc,
        notes:                   "",
        site_address:            address,
      })
      .select("id, request_number")
      .single();

    if (insertError || !data) {
      setSubmitError("Failed to submit request. Please try again.");
      setLoading(false);
      return;
    }

    const row = data as { id: string; request_number: number | null };

    // Notify admins of new request (best-effort)
    // serviceType holds the display label e.g. "Camera Outage" — use it directly
    void supabase.from("notifications").insert({
      organization_id:  profile.orgId,
      actor_profile_id: user.id,
      recipient_role:   "admin",
      event_type:       "client_request_created",
      title:            "New service request submitted",
      body:             `${profile.companyName} submitted a request for ${serviceType} at ${address || "—"}.`,
      entity_type:      "service_request",
      entity_id:        row.id,
    });

    // No technician notification here — technicians are notified only when
    // a job is actually assigned to them via convert_request_to_job RPC.

    // Step 2 — upload staged photos (if any)
    let photosFailed = 0;
    if (stagedFiles.length > 0) {
      for (let i = 0; i < stagedFiles.length; i++) {
        setLoadingMsg(`Uploading photos (${i + 1} of ${stagedFiles.length})…`);
        const file        = stagedFiles[i];
        const storagePath = `org/${profile.orgId}/requests/${row.id}/${Date.now()}-${sanitizeName(file.name)}`;

        const { error: upErr } = await supabase.storage
          .from("camsecure-media")
          .upload(storagePath, file, { contentType: file.type });

        if (upErr) { photosFailed++; continue; }

        const { error: dbErr } = await supabase.from("service_request_photos").insert({
          organization_id:        profile.orgId,
          service_request_id:     row.id,
          uploaded_by_profile_id: user.id,
          storage_bucket:         "camsecure-media",
          storage_path:           storagePath,
          file_name:              file.name,
          mime_type:              file.type,
          file_size:              file.size,
        });

        if (dbErr) {
          photosFailed++;
          void supabase.storage.from("camsecure-media").remove([storagePath]);
        }
      }

      // Single notification for all photos if at least one succeeded
      if (photosFailed < stagedFiles.length) {
        void supabase.from("notifications").insert({
          organization_id:  profile.orgId,
          actor_profile_id: user.id,
          recipient_role:   "admin",
          event_type:       "client_request_photo_uploaded",
          title:            "New photo attached to request",
          entity_type:      "service_request",
          entity_id:        row.id,
        });
      }

      if (photosFailed > 0) {
        setPhotoWarning(
          `${photosFailed} photo${photosFailed > 1 ? "s" : ""} failed to upload. You can add them from the request page.`
        );
      }
    }

    setRequestId(row.id);
    setRequestNumber(row.request_number ?? null);
    setSubmitted(true);
    setLoading(false);
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-5">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-c-success/15 border border-c-success/30">
          <CheckCircle2 className="h-8 w-8 text-c-success" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">Request submitted</h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-sm">
            Reference{" "}
            <span className="font-mono font-semibold text-foreground">{fmtReqNumber(requestNumber)}</span>{" "}
            has been received. Our team will be in touch within 1 business day to confirm scheduling.
          </p>
        </div>
        {photoWarning && (
          <div className="flex items-center gap-2 rounded-md border border-c-warning/30 bg-c-warning/10 px-4 py-2.5 text-xs text-c-warning max-w-sm">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {photoWarning}
          </div>
        )}
        <div className="flex flex-wrap gap-3 mt-2 justify-center">
          {requestId && (
            <Link href={`/client/requests/${requestId}`} className={cn(buttonVariants({ size: "sm" }), "h-9 gap-1.5")}>
              <Camera className="h-3.5 w-3.5" /> View Request / Add Photos
            </Link>
          )}
          <Button variant="outline" size="sm" className="h-9" onClick={() => {
            setSubmitted(false);
            setRequestId(null);
            setRequestNumber(null);
            setServiceType("");
            setUrgency("");
            setErrors({});
            setSubmitError(null);
            setPhotoWarning(null);
            setStagedFiles([]);
            setFileError(null);
          }}>
            Submit another
          </Button>
          <Link href="/client" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9")}>
            Back to overview
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">

      {/* Header */}
      <div>
        <Link href="/client" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-5">
          <ArrowLeft className="h-3 w-3" /> Back to overview
        </Link>
        <h1 className="text-2xl font-semibold text-foreground">New Service Request</h1>
        <p className="text-sm text-muted-foreground mt-1">Submit a request and our team will contact you to confirm scheduling.</p>
      </div>

      <form className="space-y-8" onSubmit={handleSubmit} noValidate>

        {/* Contact Details */}
        <section className="space-y-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Contact Details</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs">Contact name</Label>
              <Input id="name" name="name" defaultValue={profile.name} className="h-10 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="company" className="text-xs">Company name</Label>
              <Input id="company" name="company" defaultValue={profile.companyName} readOnly className="h-10 text-sm bg-muted/30" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="phone" className="text-xs">
                Phone number <span className="text-destructive">*</span>
              </Label>
              <Input
                id="phone" name="phone" type="tel"
                placeholder={profile.phone || "Your phone number"}
                className={cn("h-10 text-sm", errors.phone && "border-destructive")}
                onChange={() => clearError("phone")}
              />
              {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs">Email address</Label>
              <Input
                id="email" name="email" type="email"
                defaultValue={profile.email}
                className="h-10 text-sm"
                onChange={() => clearError("phone")}
              />
            </div>
          </div>
        </section>

        <div className="h-px bg-border" />

        {/* Service Details */}
        <section className="space-y-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Service Details</p>

          <div className="space-y-1.5">
            <Label htmlFor="address" className="text-xs">
              Site address <span className="text-destructive">*</span>
            </Label>
            <Input
              id="address" name="address"
              placeholder="123 Main St, Suite 5, City"
              className={cn("h-10 text-sm", errors.address && "border-destructive")}
              onChange={() => clearError("address")}
            />
            {errors.address && <p className="text-xs text-destructive">{errors.address}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">
                Service type <span className="text-destructive">*</span>
              </Label>
              <Select value={serviceType} onValueChange={v => { setServiceType(v ?? ""); clearError("serviceType"); }}>
                <SelectTrigger className={cn("h-10 text-sm", errors.serviceType && "border-destructive")}>
                  <SelectValue placeholder="Select service type" />
                </SelectTrigger>
                <SelectContent>
                  {SERVICE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.serviceType && <p className="text-xs text-destructive">{errors.serviceType}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">
                Urgency <span className="text-destructive">*</span>
              </Label>
              <Select value={urgency} onValueChange={v => { setUrgency(v ?? ""); clearError("urgency"); }}>
                <SelectTrigger className={cn("h-10 text-sm", errors.urgency && "border-destructive")}>
                  <SelectValue placeholder="Select urgency" />
                </SelectTrigger>
                <SelectContent>
                  {URGENCY_LEVELS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.urgency && <p className="text-xs text-destructive">{errors.urgency}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-xs">
              Issue description <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="description" name="description"
              placeholder="Describe the issue — which cameras, what the problem is, when it started, and any relevant context…"
              className={cn("min-h-[100px] text-sm resize-none", errors.description && "border-destructive")}
              onChange={() => clearError("description")}
            />
            {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="preferred" className="text-xs">Preferred date / time</Label>
            <DateTimeInput
              id="preferred" name="preferred" type="datetime-local"
              className={cn("h-10 text-sm", errors.preferred && "border-destructive")}
              onChange={() => clearError("preferred")}
            />
            {errors.preferred && <p className="text-xs text-destructive">{errors.preferred}</p>}
          </div>
        </section>

        <div className="h-px bg-border" />

        {/* Photo attachment */}
        <section className="space-y-3">
          <Label className="text-xs">Attach photos (optional)</Label>

          {/* Hidden file input */}
          <input
            ref={photoRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />

          {/* Staged file list */}
          {stagedFiles.length > 0 && (
            <ul className="space-y-1.5">
              {stagedFiles.map((file, i) => (
                <li
                  key={i}
                  className="flex items-center gap-2 rounded-md border border-border bg-muted/20 px-3 py-1.5 text-xs"
                >
                  <Camera className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="flex-1 truncate text-foreground">{file.name}</span>
                  <span className="text-muted-foreground shrink-0">{(file.size / 1024).toFixed(0)} KB</span>
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    disabled={loading}
                    className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 shrink-0"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {fileError && <p className="text-xs text-destructive">{fileError}</p>}

          {/* Trigger button */}
          <button
            type="button"
            onClick={() => { setFileError(null); photoRef.current?.click(); }}
            disabled={loading}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border",
              "bg-muted/15 px-6 py-6 text-xs text-muted-foreground transition-colors",
              "hover:border-border/60 hover:bg-muted/25 hover:text-foreground",
              "disabled:pointer-events-none disabled:opacity-50"
            )}
          >
            <Upload className="h-4 w-4" />
            {stagedFiles.length > 0 ? "Add more photos" : "Choose photos"}
            <span className="text-muted-foreground/60">· JPEG, PNG, WebP, HEIC · max 10 MB</span>
          </button>
        </section>

        {submitError && (
          <div className="rounded-md border border-destructive/30 bg-destructive/8 px-3 py-2 text-xs text-destructive">
            {submitError}
          </div>
        )}

        <Button type="submit" className="w-full h-11 text-sm font-medium" disabled={loading}>
          {loading
            ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5" />{loadingMsg}</>
            : "Submit Request"}
        </Button>

      </form>
    </div>
  );
}

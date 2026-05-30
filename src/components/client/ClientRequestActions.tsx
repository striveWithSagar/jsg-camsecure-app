"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ClientRequestDetail } from "@/lib/data/client-portal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from "@/components/ui/select";
import { Edit2, X, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

const SERVICE_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "new_installation",  label: "New Installation" },
  { value: "maintenance",       label: "Maintenance" },
  { value: "dvr_nvr_issue",     label: "DVR/NVR Issue" },
  { value: "camera_outage",     label: "Camera Outage" },
  { value: "mobile_app_issue",  label: "Mobile App Issue" },
  { value: "wiring_issue",      label: "Wiring Issue" },
  { value: "emergency_service", label: "Emergency Service" },
  { value: "quote_request",     label: "Quote Request" },
  { value: "site_inspection",   label: "Site Inspection" },
  { value: "other",             label: "Other" },
];

const URGENCY_OPTIONS: { value: string; label: string }[] = [
  { value: "emergency", label: "Emergency" },
  { value: "high",      label: "High" },
  { value: "medium",    label: "Medium" },
  { value: "low",       label: "Low" },
];

// Lookup maps derived from option arrays — used to render trigger labels explicitly
// (avoids Radix SelectValue falling back to raw enum strings before portal mounts)
const SERVICE_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  SERVICE_TYPE_OPTIONS.map(o => [o.value, o.label])
);
const URGENCY_LABEL: Record<string, string> = Object.fromEntries(
  URGENCY_OPTIONS.map(o => [o.value, o.label])
);

type Props = { request: ClientRequestDetail };

export function ClientRequestActions({ request }: Props) {
  const [currentStatus, setCurrentStatus] = useState(request.status);
  const [editing,        setEditing]       = useState(false);
  const [serviceType,    setServiceType]   = useState(request.rawServiceType);
  const [urgency,        setUrgency]       = useState(request.urgency);
  const [description,    setDescription]  = useState(request.description);
  const [saving,         setSaving]        = useState(false);
  const [saveDone,       setSaveDone]      = useState(false);
  const [cancelConfirm,  setCancelConfirm] = useState(false);
  const [cancelling,     setCancelling]    = useState(false);
  const [error,          setError]         = useState<string | null>(null);

  const canEdit = currentStatus === "new" || currentStatus === "reviewing";

  // Cancelled state — shown after client cancels
  if (currentStatus === "cancelled" && request.status !== "cancelled") {
    return (
      <div className="rounded-xl border border-border bg-card p-5 flex items-start gap-3">
        <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-foreground">Request cancelled</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            This request has been cancelled and is no longer active.
          </p>
        </div>
      </div>
    );
  }

  if (!canEdit) return null;

  function discardEdit() {
    setServiceType(request.rawServiceType);
    setUrgency(request.urgency);
    setDescription(request.description);
    setEditing(false);
    setError(null);
  }

  async function saveEdit() {
    if (!description.trim()) return;
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { error: dbErr } = await supabase
      .from("service_requests")
      .update({ description: description.trim(), service_type: serviceType, urgency })
      .eq("id", request.id);
    setSaving(false);
    if (dbErr) {
      setError(
        dbErr.message.includes("SR_FIELD_RESTRICTED")
          ? "Cannot modify that field."
          : "Failed to save changes. Please try again."
      );
      return;
    }
    setSaveDone(true);
    setTimeout(() => setSaveDone(false), 3000);
    setEditing(false);

    // Notify admins of client edit (best-effort)
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      void supabase.from("notifications").insert({
        organization_id:  request.organizationId,
        actor_profile_id: user.id,
        recipient_role:   "admin",
        event_type:       "client_request_edited",
        title:            `Request REQ-${String(request.reqNumber ?? 0).padStart(4, "0")} updated by client`,
        entity_type:      "service_request",
        entity_id:        request.id,
      });
    }
  }

  async function cancelRequest() {
    setCancelling(true);
    setError(null);
    const supabase = createClient();
    const { error: dbErr } = await supabase
      .from("service_requests")
      .update({ status: "cancelled" })
      .eq("id", request.id);
    setCancelling(false);
    if (dbErr) {
      setError("Failed to cancel request. Please try again.");
      setCancelConfirm(false);
      return;
    }
    setCurrentStatus("cancelled");
    setCancelConfirm(false);

    // Notify admins of cancellation (best-effort)
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      void supabase.from("notifications").insert({
        organization_id:  request.organizationId,
        actor_profile_id: user.id,
        recipient_role:   "admin",
        event_type:       "client_request_cancelled",
        title:            `Request REQ-${String(request.reqNumber ?? 0).padStart(4, "0")} cancelled by client`,
        entity_type:      "service_request",
        entity_id:        request.id,
      });
    }
  }

  return (
    <div className="space-y-3">

      {/* Edit form */}
      {editing ? (
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            Edit Request
          </h3>

          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Service Type</p>
            <Select value={serviceType} onValueChange={v => setServiceType(v ?? serviceType)}>
              <SelectTrigger className="h-9 text-sm">
                <span>{SERVICE_TYPE_LABEL[serviceType] ?? serviceType}</span>
              </SelectTrigger>
              <SelectContent>
                {SERVICE_TYPE_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Urgency</p>
            <Select value={urgency} onValueChange={v => setUrgency(v ?? urgency)}>
              <SelectTrigger className="h-9 text-sm">
                <span>{URGENCY_LABEL[urgency] ?? urgency}</span>
              </SelectTrigger>
              <SelectContent>
                {URGENCY_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Description</p>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={4}
              className="text-sm resize-none"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm" className="h-8 text-xs gap-1.5"
              onClick={saveEdit}
              disabled={saving || !description.trim()}
            >
              {saving
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</>
                : "Save Changes"}
            </Button>
            <Button
              variant="outline" size="sm" className="h-8 text-xs"
              onClick={discardEdit} disabled={saving}
            >
              Discard
            </Button>
            {saveDone && (
              <span className="text-xs text-c-success flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Saved
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline" size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => { setEditing(true); setError(null); setCancelConfirm(false); }}
          >
            <Edit2 className="h-3.5 w-3.5" /> Edit Request
          </Button>
          {!cancelConfirm && (
            <Button
              variant="outline" size="sm"
              className="h-8 gap-1.5 text-xs text-destructive hover:text-destructive hover:border-destructive/40"
              onClick={() => { setCancelConfirm(true); setError(null); }}
            >
              <X className="h-3.5 w-3.5" /> Cancel Request
            </Button>
          )}
          {saveDone && (
            <span className="text-xs text-c-success flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Changes saved
            </span>
          )}
        </div>
      )}

      {/* Cancellation confirmation */}
      {cancelConfirm && !editing && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-3">
          <p className="text-sm font-medium text-foreground">Cancel this request?</p>
          <p className="text-xs text-muted-foreground">
            This cannot be undone by you. Our team will be notified.
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="h-8 text-xs gap-1.5 bg-destructive hover:bg-destructive/90 text-white"
              onClick={cancelRequest}
              disabled={cancelling}
            >
              {cancelling
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Cancelling…</>
                : "Yes, cancel request"}
            </Button>
            <Button
              variant="outline" size="sm" className="h-8 text-xs"
              onClick={() => setCancelConfirm(false)}
              disabled={cancelling}
            >
              Keep request
            </Button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

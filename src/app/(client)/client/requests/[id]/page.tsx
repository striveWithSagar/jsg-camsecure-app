import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getClientRequestById } from "@/lib/data/client-portal";
import { REQUEST_STATUS_LABELS } from "@/lib/constants";
import { PriorityBadge, StatusBadge } from "@/components/shared/StatusBadge";
import { RequestPhotoPanel } from "@/components/requests/RequestPhotoPanel";
import { ClientRequestActions } from "@/components/client/ClientRequestActions";
import { fmtReqNumber, fmtJobNumber, fmtDatetime, calcJobAge, cn } from "@/lib/utils";
import { ArrowLeft, Clock, Camera } from "lucide-react";

export const metadata: Metadata = { title: "Request Detail · JSG CamSecure Client Portal" };

const REQUEST_STATUS_BADGE: Record<string, string> = {
  new:               "badge-assigned",
  reviewing:         "badge-started",
  ready_to_schedule: "badge-on-the-way",
  converted:         "badge-completed",
  cancelled:         "badge-rescheduled",
};

const REQUEST_STATUS_COLOR: Record<string, string> = {
  new:               "var(--cp-cyan)",
  reviewing:         "oklch(0.78 0.165 90)",
  ready_to_schedule: "oklch(0.68 0.155 200)",
  converted:         "oklch(0.63 0.165 155)",
  cancelled:         "oklch(0.50 0.040 252)",
};

function RequestStatusBadge({ status }: { status: string }) {
  const cls   = REQUEST_STATUS_BADGE[status] ?? "badge-assigned";
  const label = REQUEST_STATUS_LABELS[status as keyof typeof REQUEST_STATUS_LABELS] ?? status;
  return (
    <span className={cn("inline-flex items-center px-2.5 py-1 rounded text-xs font-semibold border", cls)}>
      {label}
    </span>
  );
}

export default async function ClientRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id }  = await params;
  const request = await getClientRequestById(id);

  if (!request) notFound();

  const terminalStatus = request.isTerminal ? "completed" : request.status;
  const ageInfo        = calcJobAge(request.createdAt, request.updatedAt, terminalStatus);
  const accentColor    = REQUEST_STATUS_COLOR[request.status] ?? "var(--cp-orange)";

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Back nav */}
      <Link
        href="/client/requests"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Your Requests
      </Link>

      {/* Header */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{ borderColor: "var(--cp-orange-border)" }}
      >
        <div className="h-0.5 w-full" style={{ background: accentColor }} />
        <div className="p-5 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1
              className="cp-heading text-3xl"
              style={{ color: "var(--cp-orange-text)" }}
            >
              {fmtReqNumber(request.reqNumber)}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">{request.serviceType}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap mt-1">
            <PriorityBadge value={request.urgency} />
            <RequestStatusBadge status={request.status} />
          </div>
        </div>
      </div>

      {/* Details card */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div
          className="px-5 py-3 border-b border-border"
          style={{ borderBottom: "1px solid var(--cp-orange-border)" }}
        >
          <p className="cp-heading text-xs" style={{ color: "var(--cp-orange-text)" }}>
            Details
          </p>
        </div>
        <dl className="divide-y divide-border">
          <div className="flex gap-3 px-5 py-3">
            <dt className="w-32 text-xs text-muted-foreground shrink-0">Service Type</dt>
            <dd className="text-xs text-foreground">{request.serviceType}</dd>
          </div>
          <div className="flex gap-3 px-5 py-3">
            <dt className="w-32 text-xs text-muted-foreground shrink-0">Submitted</dt>
            <dd className="text-xs text-foreground">
              <span className="flex items-center gap-1.5"><Clock className="h-3 w-3 text-muted-foreground" />{fmtDatetime(request.createdAt)}</span>
            </dd>
          </div>
          {request.preferredAt && (
            <div className="flex gap-3 px-5 py-3">
              <dt className="w-32 text-xs text-muted-foreground shrink-0">Preferred Date/Time</dt>
              <dd className="text-xs text-foreground">
                <span className="flex items-center gap-1.5"><Clock className="h-3 w-3 text-muted-foreground" />{fmtDatetime(request.preferredAt)}</span>
              </dd>
            </div>
          )}
          <div className="flex gap-3 px-5 py-3">
            <dt className="w-32 text-xs text-muted-foreground shrink-0">Duration</dt>
            <dd className="text-xs text-foreground">
              <span className={ageInfo.isComplete ? "font-semibold" : ""} style={ageInfo.isComplete ? { color: "var(--cp-cyan-text)" } : undefined}>{ageInfo.label}</span>
            </dd>
          </div>
        </dl>
      </div>

      {/* Description */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div
          className="px-5 py-3 border-b"
          style={{ borderBottom: "1px solid var(--cp-orange-border)" }}
        >
          <p className="cp-heading text-xs" style={{ color: "var(--cp-orange-text)" }}>
            Description
          </p>
        </div>
        <p className="px-5 py-4 text-sm text-foreground leading-relaxed whitespace-pre-wrap">
          {request.description}
        </p>
      </div>

      {/* Linked job */}
      {request.linkedJob && (
        <div className="rounded-xl border bg-card overflow-hidden" style={{ borderColor: "var(--cp-cyan-border)" }}>
          <div className="h-0.5 w-full" style={{ background: "var(--cp-cyan)" }} />
          <div className="p-5 space-y-3">
            <p className="cp-heading text-xs" style={{ color: "var(--cp-cyan-text)" }}>
              Linked Job
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <p
                className="text-sm font-bold font-mono"
                style={{ color: "var(--cp-cyan-text)" }}
              >
                {fmtJobNumber(request.linkedJob.jobNumber)}
              </p>
              <StatusBadge value={request.linkedJob.status} />
            </div>
            <dl className="space-y-2">
              <div className="flex gap-3">
                <dt className="w-28 text-xs text-muted-foreground shrink-0">Site</dt>
                <dd className="text-xs text-foreground">{request.linkedJob.site}</dd>
              </div>
              {request.linkedJob.scheduledAt && (
                <div className="flex gap-3">
                  <dt className="w-28 text-xs text-muted-foreground shrink-0">Scheduled</dt>
                  <dd className="text-xs text-foreground">{fmtDatetime(request.linkedJob.scheduledAt)}</dd>
                </div>
              )}
              {request.linkedJob.completedAt && (
                <div className="flex gap-3">
                  <dt className="w-28 text-xs text-muted-foreground shrink-0">Completed</dt>
                  <dd className="text-xs text-foreground">{fmtDatetime(request.linkedJob.completedAt)}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      )}

      <ClientRequestActions request={request} />

      {/* Photo panel */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--cp-orange-border)" }}>
        <div
          className="px-5 py-3 border-b flex items-center gap-2"
          style={{ borderBottom: "1px solid var(--cp-orange-border)" }}
        >
          <Camera className="h-3.5 w-3.5" style={{ color: "var(--cp-orange-text)" }} />
          <p className="cp-heading text-xs" style={{ color: "var(--cp-orange-text)" }}>
            Photos
          </p>
        </div>
        <div className="p-4">
          <RequestPhotoPanel
            requestId={request.id}
            organizationId={request.organizationId}
            canUpload={request.status === "new" || request.status === "reviewing"}
          />
        </div>
      </div>
    </div>
  );
}

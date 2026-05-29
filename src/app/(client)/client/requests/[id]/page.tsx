import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getClientRequestById } from "@/lib/data/client-portal";
import { REQUEST_STATUS_LABELS } from "@/lib/constants";
import { PriorityBadge, StatusBadge } from "@/components/shared/StatusBadge";
import { RequestPhotoPanel } from "@/components/requests/RequestPhotoPanel";
import { fmtReqNumber, fmtJobNumber, fmtDatetime, calcJobAge, cn } from "@/lib/utils";
import { ArrowLeft, Clock } from "lucide-react";

export const metadata: Metadata = { title: "Request Detail · CamSecure Client Portal" };

const REQUEST_STATUS_BADGE: Record<string, string> = {
  new:               "badge-assigned",
  reviewing:         "badge-started",
  ready_to_schedule: "badge-on-the-way",
  converted:         "badge-completed",
  cancelled:         "badge-rescheduled",
};

function RequestStatusBadge({ status }: { status: string }) {
  const cls   = REQUEST_STATUS_BADGE[status] ?? "badge-assigned";
  const label = REQUEST_STATUS_LABELS[status as keyof typeof REQUEST_STATUS_LABELS] ?? status;
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border", cls)}>
      {label}
    </span>
  );
}

export default async function ClientRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id }    = await params;
  const request   = await getClientRequestById(id);

  if (!request) notFound();

  const terminalStatus = request.isTerminal ? "completed" : request.status;
  const ageInfo        = calcJobAge(request.createdAt, request.updatedAt, terminalStatus);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link
          href="/client/requests"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Your Requests
        </Link>

        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold font-mono text-foreground">
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

      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Details</p>
        <dl className="space-y-2.5">
          <div className="flex gap-3">
            <dt className="w-28 text-xs text-muted-foreground shrink-0">Service Type</dt>
            <dd className="text-xs text-foreground">{request.serviceType}</dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-28 text-xs text-muted-foreground shrink-0">Submitted</dt>
            <dd className="text-xs text-foreground flex items-center gap-1.5">
              <Clock className="h-3 w-3 text-muted-foreground" />
              {fmtDatetime(request.createdAt)}
            </dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-28 text-xs text-muted-foreground shrink-0">Duration</dt>
            <dd className={cn("text-xs", ageInfo.isComplete ? "text-c-success font-medium" : "text-foreground")}>
              {ageInfo.label}
            </dd>
          </div>
        </dl>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Description</p>
        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{request.description}</p>
      </div>

      {request.linkedJob && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Linked Job</p>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold font-mono text-foreground">
              {fmtJobNumber(request.linkedJob.jobNumber)}
            </p>
            <StatusBadge value={request.linkedJob.status} />
          </div>
          <dl className="space-y-2.5">
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
      )}

      <RequestPhotoPanel
        requestId={request.id}
        organizationId={request.organizationId}
        canUpload={request.status === "new" || request.status === "reviewing"}
      />
    </div>
  );
}

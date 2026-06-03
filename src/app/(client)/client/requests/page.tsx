import type { Metadata } from "next";
import type { ClientRequestItem } from "@/lib/data/client-portal";
import { getClientRequests } from "@/lib/data/client-portal";
import { REQUEST_STATUS_LABELS } from "@/lib/constants";
import { PriorityBadge } from "@/components/shared/StatusBadge";
import { fmtReqNumber, fmtDatetime, calcJobAge, cn } from "@/lib/utils";
import { Clock, FileText, Plus, ArrowRight } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = { title: "Your Requests · JSG CamSecure Client Portal" };

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
  cancelled:         "oklch(0.55 0.060 252)",
};

function RequestStatusBadge({ status }: { status: string }) {
  const cls   = REQUEST_STATUS_BADGE[status] ?? "badge-assigned";
  const label = REQUEST_STATUS_LABELS[status as keyof typeof REQUEST_STATUS_LABELS] ?? status;
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border shrink-0", cls)}>
      {label}
    </span>
  );
}

function RequestCard({ req }: { req: ClientRequestItem }) {
  const terminalStatus = req.isTerminal ? "completed" : req.status;
  const ageInfo        = calcJobAge(req.createdAt, req.updatedAt, terminalStatus);
  const accentColor    = REQUEST_STATUS_COLOR[req.status] ?? "var(--cp-orange)";

  return (
    <div
      className="group rounded-xl border border-border bg-card overflow-hidden transition-all hover:border-[var(--cp-orange-border)] hover:shadow-sm"
    >
      {/* Color accent bar */}
      <div className="h-0.5 w-full" style={{ background: accentColor }} />

      <div className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <p
              className="text-sm font-bold font-mono"
              style={{ color: "var(--cp-orange-text)" }}
            >
              {fmtReqNumber(req.reqNumber)}
            </p>
            {req.hasJob && (
              <span
                className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                style={{ background: "var(--cp-cyan-dim)", color: "var(--cp-cyan-text)" }}
              >
                Job created
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <RequestStatusBadge status={req.status} />
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-foreground">{req.serviceType}</span>
          <span className="text-xs text-muted-foreground">·</span>
          <PriorityBadge value={req.urgency} />
        </div>

        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            {fmtDatetime(req.createdAt)}
          </span>
          <span className={ageInfo.isComplete ? "font-medium" : ""} style={ageInfo.isComplete ? { color: "var(--cp-cyan-text)" } : undefined}>
            {ageInfo.label}
          </span>
        </div>

        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{req.description}</p>
      </div>
    </div>
  );
}

export default async function ClientRequestsPage() {
  const requests = await getClientRequests();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="cp-heading text-3xl text-foreground" style={{ color: "var(--cp-orange-text)" }}>
            Your Requests
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {requests.length === 0
              ? "No requests submitted yet"
              : `${requests.length} request${requests.length === 1 ? "" : "s"} on record`}
          </p>
        </div>
        <Link
          href="/client/requests/new"
          className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg text-xs font-semibold transition-colors"
          style={{ background: "var(--cp-orange)", color: "var(--primary-foreground)" }}
        >
          <Plus className="h-3.5 w-3.5" />
          New Request
        </Link>
      </div>

      {/* Empty state */}
      {requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-16 rounded-xl border border-dashed border-border text-center">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full"
            style={{ background: "var(--cp-orange-dim)" }}
          >
            <FileText className="h-7 w-7" style={{ color: "var(--cp-orange-text)" }} />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">No service requests yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              Submit a request and our team will contact you to confirm scheduling.
            </p>
          </div>
          <Link
            href="/client/requests/new"
            className="inline-flex items-center gap-1.5 h-10 px-5 rounded-lg text-xs font-semibold transition-colors"
            style={{ background: "var(--cp-orange)", color: "var(--primary-foreground)" }}
          >
            <Plus className="h-3.5 w-3.5" />
            Submit your first request
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(req => (
            <Link
              key={req.id}
              href={`/client/requests/${req.id}`}
              className="block"
            >
              <RequestCard req={req} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

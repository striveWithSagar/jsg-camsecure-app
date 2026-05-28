import type { Metadata } from "next";
import type { ClientRequestItem } from "@/lib/data/client-portal";
import { getClientRequests } from "@/lib/data/client-portal";
import { REQUEST_STATUS_LABELS } from "@/lib/constants";
import { PriorityBadge } from "@/components/shared/StatusBadge";
import { fmtReqNumber, fmtDatetime, calcJobAge, cn } from "@/lib/utils";
import { Clock, FileText, Plus } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = { title: "Your Requests · CamSecure Client Portal" };

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

function RequestCard({ req }: { req: ClientRequestItem }) {
  const terminalStatus = req.isTerminal ? "completed" : req.status;
  const ageInfo        = calcJobAge(req.createdAt, req.updatedAt, terminalStatus);

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold font-mono text-foreground">{fmtReqNumber(req.reqNumber)}</p>
          {req.hasJob && (
            <span className="text-[10px] text-muted-foreground/70 bg-muted/40 px-1.5 py-0.5 rounded">
              Job created
            </span>
          )}
        </div>
        <RequestStatusBadge status={req.status} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-foreground font-medium">{req.serviceType}</span>
        <span className="text-xs text-muted-foreground">·</span>
        <PriorityBadge value={req.urgency} />
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Clock className="h-3 w-3" />
          {fmtDatetime(req.createdAt)}
        </span>
        <span className={ageInfo.isComplete ? "text-c-success font-medium" : ""}>
          {ageInfo.label}
        </span>
      </div>

      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{req.description}</p>
    </div>
  );
}

export default async function ClientRequestsPage() {
  const requests = await getClientRequests();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Your Requests</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {requests.length === 0
              ? "No requests yet"
              : `${requests.length} request${requests.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <Link
          href="/client/requests/new"
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-card text-xs font-medium text-foreground hover:bg-muted/50 transition-colors shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          New Request
        </Link>
      </div>

      {requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-16 rounded-xl border border-dashed border-border text-center">
          <FileText className="h-8 w-8 text-muted-foreground/30" />
          <div>
            <p className="text-sm font-medium text-muted-foreground">No service requests yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Submit a request and our team will be in touch to confirm scheduling.
            </p>
          </div>
          <Link
            href="/client/requests/new"
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
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
              className="block hover:opacity-80 transition-opacity"
            >
              <RequestCard req={req} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

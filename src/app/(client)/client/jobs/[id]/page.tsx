import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getClientJobById } from "@/lib/data/client-portal";
import { REQUEST_STATUS_LABELS } from "@/lib/constants";
import { StatusBadge, PriorityBadge } from "@/components/shared/StatusBadge";
import { fmtJobNumber, fmtReqNumber, fmtDatetime, calcJobAge, cn } from "@/lib/utils";
import { ArrowLeft, MapPin, Clock, Circle } from "lucide-react";

export const metadata: Metadata = { title: "Job Detail · CamSecure Client Portal" };

const CLIENT_STATUS_LABEL: Record<string, string> = {
  assigned:    "Scheduled",
  on_the_way:  "Technician En Route",
  started:     "Work Started",
  in_progress: "In Progress",
  needs_parts: "Awaiting Parts",
  completed:   "Completed",
  rescheduled: "Rescheduled",
  cancelled:   "Cancelled",
};

function TimelineRow({ label, time, isLast = false }: { label: string; time: string; isLast?: boolean }) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <Circle className="h-2.5 w-2.5 fill-primary text-primary shrink-0 mt-0.5" />
        {!isLast && <div className="w-px flex-1 bg-border/60 mt-1" />}
      </div>
      <div className="pb-3">
        <p className="text-xs font-medium text-foreground">{label}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{time}</p>
      </div>
    </div>
  );
}

export default async function ClientJobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const job    = await getClientJobById(id);

  if (!job) notFound();

  const ageInfo      = calcJobAge(job.createdAt, job.completedAt, job.status);
  const friendlyStatus = CLIENT_STATUS_LABEL[job.status] ?? job.status;

  const timelineItems: { label: string; time: string }[] = [];
  if (job.linkedRequest) timelineItems.push({ label: "Request Created",  time: fmtDatetime(job.linkedRequest.createdAt) });
  timelineItems.push({ label: "Job Created", time: fmtDatetime(job.createdAt) });
  if (job.scheduledAt)  timelineItems.push({ label: "Scheduled",         time: fmtDatetime(job.scheduledAt) });
  if (job.completedAt)  timelineItems.push({ label: "Completed",         time: fmtDatetime(job.completedAt) });

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link
          href="/client/jobs"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Your Jobs
        </Link>

        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold font-mono text-foreground">
              {fmtJobNumber(job.jobNumber)}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">{job.serviceType}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap mt-1">
            <PriorityBadge value={job.priority} />
            <StatusBadge value={job.status} />
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Details</p>
        <dl className="space-y-2.5">
          <div className="flex gap-3">
            <dt className="w-28 text-xs text-muted-foreground shrink-0">Status</dt>
            <dd className="text-xs text-foreground">{friendlyStatus}</dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-28 text-xs text-muted-foreground shrink-0">Service Type</dt>
            <dd className="text-xs text-foreground">{job.serviceType}</dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-28 text-xs text-muted-foreground shrink-0">Site</dt>
            <dd className="text-xs text-foreground flex items-center gap-1.5">
              <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
              {job.site}
            </dd>
          </div>
          {job.address !== "—" && (
            <div className="flex gap-3">
              <dt className="w-28 text-xs text-muted-foreground shrink-0">Address</dt>
              <dd className="text-xs text-foreground">{job.address}</dd>
            </div>
          )}
          {job.scheduledAt && (
            <div className="flex gap-3">
              <dt className="w-28 text-xs text-muted-foreground shrink-0">Scheduled</dt>
              <dd className="text-xs text-foreground flex items-center gap-1.5">
                <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                {fmtDatetime(job.scheduledAt)}
              </dd>
            </div>
          )}
          {job.completedAt && (
            <div className="flex gap-3">
              <dt className="w-28 text-xs text-muted-foreground shrink-0">Completed</dt>
              <dd className="text-xs text-foreground flex items-center gap-1.5">
                <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                {fmtDatetime(job.completedAt)}
              </dd>
            </div>
          )}
          <div className="flex gap-3">
            <dt className="w-28 text-xs text-muted-foreground shrink-0">Duration</dt>
            <dd className={cn("text-xs", ageInfo.isComplete ? "text-c-success font-medium" : "text-foreground")}>
              {ageInfo.label}
            </dd>
          </div>
        </dl>
      </div>

      {/* Timeline */}
      {timelineItems.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Timeline</p>
          <div>
            {timelineItems.map((item, i) => (
              <TimelineRow
                key={item.label}
                label={item.label}
                time={item.time}
                isLast={i === timelineItems.length - 1}
              />
            ))}
          </div>
        </div>
      )}

      {/* Linked Request */}
      {job.linkedRequest && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Linked Request</p>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold font-mono text-foreground">
                {fmtReqNumber(job.linkedRequest.reqNumber)}
              </p>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border badge-completed">
                {REQUEST_STATUS_LABELS[job.linkedRequest.status as keyof typeof REQUEST_STATUS_LABELS] ?? job.linkedRequest.status}
              </span>
            </div>
            <Link
              href={`/client/requests/${job.linkedRequest.id}`}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
            >
              View request →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getClientJobById } from "@/lib/data/client-portal";
import { REQUEST_STATUS_LABELS } from "@/lib/constants";
import { StatusBadge, PriorityBadge } from "@/components/shared/StatusBadge";
import { JobPhotoPanel } from "@/components/jobs/JobPhotoPanel";
import { fmtJobNumber, fmtReqNumber, fmtDatetime, calcJobAge } from "@/lib/utils";
import { ArrowLeft, MapPin, Clock, Circle, Camera } from "lucide-react";

export const metadata: Metadata = { title: "Job Detail · JSG CamSecure Client Portal" };

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

const CLIENT_STATUS_ACCENT: Record<string, string> = {
  assigned:    "var(--cp-cyan)",
  on_the_way:  "oklch(0.68 0.155 200)",
  started:     "oklch(0.78 0.165 90)",
  in_progress: "var(--cp-orange)",
  needs_parts: "oklch(0.70 0.185 47)",
  completed:   "oklch(0.63 0.165 155)",
  rescheduled: "oklch(0.65 0.170 300)",
  cancelled:   "oklch(0.50 0.040 252)",
};

function TimelineRow({ label, time, isLast = false }: { label: string; time: string; isLast?: boolean }) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <Circle
          className="h-2.5 w-2.5 shrink-0 mt-0.5"
          style={{ fill: "var(--cp-orange)", color: "var(--cp-orange)" }}
        />
        {!isLast && <div className="w-px flex-1 bg-border/60 mt-1" />}
      </div>
      <div className="pb-3">
        <p className="text-xs font-semibold text-foreground">{label}</p>
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

  const ageInfo        = calcJobAge(job.createdAt, job.completedAt, job.status);
  const friendlyStatus = CLIENT_STATUS_LABEL[job.status] ?? job.status;
  const accent         = CLIENT_STATUS_ACCENT[job.status] ?? "var(--cp-orange)";

  const timelineItems: { label: string; time: string }[] = [];
  if (job.linkedRequest) timelineItems.push({ label: "Request Created", time: fmtDatetime(job.linkedRequest.createdAt) });
  timelineItems.push({ label: "Job Created", time: fmtDatetime(job.createdAt) });
  if (job.scheduledAt) timelineItems.push({ label: "Scheduled",  time: fmtDatetime(job.scheduledAt) });
  if (job.deadlineAt)  timelineItems.push({ label: "Deadline",   time: fmtDatetime(job.deadlineAt)  });
  if (job.completedAt) timelineItems.push({ label: "Completed",  time: fmtDatetime(job.completedAt) });

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Back nav */}
      <Link
        href="/client/jobs"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Your Jobs
      </Link>

      {/* Header card */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{ borderColor: "var(--cp-orange-border)" }}
      >
        <div className="h-0.5 w-full" style={{ background: accent }} />
        <div className="p-5 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1
              className="cp-heading text-3xl"
              style={{ color: "var(--cp-orange-text)" }}
            >
              {fmtJobNumber(job.jobNumber)}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">{job.serviceType}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap mt-1">
            <PriorityBadge value={job.priority} />
            <StatusBadge value={job.status} />
          </div>
        </div>
        {/* Friendly status label */}
        <div
          className="px-5 py-2.5 border-t flex items-center gap-2"
          style={{ borderColor: `${accent}30`, background: `${accent}0d` }}
        >
          <div className="h-2 w-2 rounded-full" style={{ background: accent }} />
          <p className="text-xs font-semibold" style={{ color: accent }}>{friendlyStatus}</p>
        </div>
      </div>

      {/* Details */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div
          className="px-5 py-3 border-b"
          style={{ borderBottom: "1px solid var(--cp-orange-border)" }}
        >
          <p className="cp-heading text-xs" style={{ color: "var(--cp-orange-text)" }}>Details</p>
        </div>
        <dl className="divide-y divide-border">
          {[
            { label: "Service Type", value: job.serviceType },
            { label: "Site",         value: <span className="flex items-center gap-1.5"><MapPin className="h-3 w-3 text-muted-foreground shrink-0" />{job.site}</span> },
            job.address !== "—" ? { label: "Address", value: job.address } : null,
            job.scheduledAt ? { label: "Scheduled", value: <span className="flex items-center gap-1.5"><Clock className="h-3 w-3 text-muted-foreground shrink-0" />{fmtDatetime(job.scheduledAt)}</span> } : null,
            job.completedAt ? { label: "Completed",  value: <span className="flex items-center gap-1.5"><Clock className="h-3 w-3 text-muted-foreground shrink-0" />{fmtDatetime(job.completedAt)}</span> } : null,
            {
              label: "Duration",
              value: <span className={ageInfo.isComplete ? "font-semibold" : ""} style={ageInfo.isComplete ? { color: "var(--cp-cyan-text)" } : undefined}>{ageInfo.label}</span>,
            },
          ].filter(Boolean).map((item) => {
            const { label, value } = item as { label: string; value: React.ReactNode };
            return (
              <div key={label} className="flex gap-3 px-5 py-3">
                <dt className="w-28 text-xs text-muted-foreground shrink-0">{label}</dt>
                <dd className="text-xs text-foreground">{value}</dd>
              </div>
            );
          })}
        </dl>
      </div>

      {/* Timeline */}
      {timelineItems.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div
            className="px-5 py-3 border-b"
            style={{ borderBottom: "1px solid var(--cp-orange-border)" }}
          >
            <p className="cp-heading text-xs" style={{ color: "var(--cp-orange-text)" }}>Timeline</p>
          </div>
          <div className="px-5 pt-4 pb-2">
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
        <div className="rounded-xl border bg-card overflow-hidden" style={{ borderColor: "var(--cp-cyan-border)" }}>
          <div className="h-0.5 w-full" style={{ background: "var(--cp-cyan)" }} />
          <div className="p-5 space-y-3">
            <p className="cp-heading text-xs" style={{ color: "var(--cp-cyan-text)" }}>Linked Request</p>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <p
                  className="text-sm font-bold font-mono"
                  style={{ color: "var(--cp-cyan-text)" }}
                >
                  {fmtReqNumber(job.linkedRequest.reqNumber)}
                </p>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border badge-completed">
                  {REQUEST_STATUS_LABELS[job.linkedRequest.status as keyof typeof REQUEST_STATUS_LABELS] ?? job.linkedRequest.status}
                </span>
              </div>
              <Link
                href={`/client/requests/${job.linkedRequest.id}`}
                className="text-xs transition-colors hover:underline"
                style={{ color: "var(--cp-cyan-text)" }}
              >
                View request →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Photos */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--cp-orange-border)" }}>
        <div
          className="px-5 py-3 border-b flex items-center gap-2"
          style={{ borderBottom: "1px solid var(--cp-orange-border)" }}
        >
          <Camera className="h-3.5 w-3.5" style={{ color: "var(--cp-orange-text)" }} />
          <p className="cp-heading text-xs" style={{ color: "var(--cp-orange-text)" }}>Photos</p>
        </div>
        <div className="p-4">
          <JobPhotoPanel
            jobId={job.id}
            organizationId={job.organizationId}
            readOnly={true}
          />
        </div>
      </div>
    </div>
  );
}

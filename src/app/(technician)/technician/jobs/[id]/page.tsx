import { MOCK_JOBS } from "@/lib/constants";
import { PriorityBadge } from "@/components/shared/StatusBadge";
import { JobStatusWidget } from "@/components/technician/JobStatusWidget";
import { ArrowLeft, MapPin, Clock, Wrench, Phone } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function TechJobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = MOCK_JOBS.find(j => j.id === id);
  if (!job) notFound();

  return (
    <div className="space-y-5">

      {/* Back */}
      <Link href="/technician/jobs" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-3 w-3" /> Back to jobs
      </Link>

      {/* Header */}
      <div>
        <div className="flex items-start justify-between gap-3 mb-1">
          <h1 className="text-lg font-semibold text-foreground leading-tight">{job.client}</h1>
          <PriorityBadge value={job.priority} />
        </div>
        <p className="text-sm text-muted-foreground">{job.site}</p>
        <p className="text-xs font-mono text-muted-foreground/60 mt-1">{job.id}</p>
      </div>

      {/* Job details */}
      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        {[
          { icon: Wrench,  label: "Service Type", value: job.type },
          { icon: Clock,   label: "Scheduled",    value: job.scheduled },
          { icon: MapPin,  label: "Address",      value: job.address },
          { icon: Phone,   label: "Dispatcher",   value: "JSG Admin · admin@jsg.com" },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-start gap-3 px-4 py-3.5">
            <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
              <p className="text-sm font-medium text-foreground">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Navigate button (opens maps) */}
      <a
        href={`https://maps.google.com/?q=${encodeURIComponent(job.address)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 w-full h-11 rounded-lg border border-c-teal text-c-teal text-sm font-medium hover:bg-c-teal hover:text-foreground transition-colors"
      >
        <MapPin className="h-4 w-4" />
        Navigate to site
      </a>

      {/* Status update widget */}
      <JobStatusWidget initialStatus={job.status} jobId={job.id} />

    </div>
  );
}

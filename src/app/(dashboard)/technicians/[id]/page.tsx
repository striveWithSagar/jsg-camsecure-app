import { notFound } from "next/navigation";
import { getTechnicianById } from "@/lib/data/technicians";
import { AccountActionsPanel } from "@/components/admin/AccountActionsPanel";
import { TopBar } from "@/components/layout/TopBar";
import { StatusBadge, PriorityBadge } from "@/components/shared/StatusBadge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { ArrowLeft, Phone, Mail, Briefcase, CheckCircle2, Calendar } from "lucide-react";
import Link from "next/link";

const TECH_STATUS_STYLE: Record<string, string> = {
  available:  "text-c-success bg-c-success border-c-success",
  on_job:     "text-c-info bg-c-info border-c-info",
  on_the_way: "text-c-teal bg-c-teal border-c-teal",
  off_duty:   "text-muted-foreground bg-muted/30 border-border",
};

const TECH_STATUS_LABEL: Record<string, string> = {
  available: "Available", on_job: "On Job", on_the_way: "En Route", off_duty: "Off Duty",
};

function initials(name: string) {
  return name.split(" ").filter(Boolean).map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function TechnicianDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tech    = await getTechnicianById(id);

  if (!tech) notFound();

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar
        title={tech.name}
        subtitle={tech.specialty || "Technician"}
      />

      <div className="flex-1 px-6 py-6 space-y-6 max-w-4xl">

        <Link
          href="/technicians"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3 w-3" /> Back to Technicians
        </Link>

        {/* Header card */}
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-start gap-4">
            <Avatar className="h-14 w-14 shrink-0">
              <AvatarFallback className="bg-primary/15 text-primary text-base font-semibold">
                {initials(tech.name)}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">{tech.name}</h2>
                  {tech.specialty && (
                    <p className="text-sm text-muted-foreground">{tech.specialty}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn(
                    "text-xs font-medium px-1.5 py-0.5 rounded border",
                    TECH_STATUS_STYLE[tech.status] ?? TECH_STATUS_STYLE.off_duty
                  )}>
                    {TECH_STATUS_LABEL[tech.status] ?? tech.status}
                  </span>
                  {!tech.isActive && (
                    <span className="text-xs font-medium px-1.5 py-0.5 rounded border text-muted-foreground bg-muted/30 border-border">
                      Inactive
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-4 text-sm">
                {tech.email && (
                  <a href={`mailto:${tech.email}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <Mail className="h-3.5 w-3.5" />{tech.email}
                  </a>
                )}
                {tech.phone && (
                  <a href={`tel:${tech.phone}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <Phone className="h-3.5 w-3.5" />{tech.phone}
                  </a>
                )}
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" /> Joined {fmtDate(tech.createdAt)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats + Jobs */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Account management + Stats sidebar */}
          <div className="space-y-4">
            <AccountActionsPanel
              profileId={tech.profileId}
              role="technician"
              isActive={tech.isActive}
              name={tech.name}
              activeJobCount={tech.activeJobs}
            />
            <div className="rounded-lg border border-border bg-card p-5 space-y-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                Summary
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
                    <Briefcase className="h-3.5 w-3.5" /> Active jobs
                  </span>
                  <span className="font-semibold text-foreground">{tech.activeJobs}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Completed jobs
                  </span>
                  <span className="font-semibold text-foreground">{tech.completedJobs}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Recent jobs */}
          <div className="lg:col-span-2">
            <div className="rounded-lg border border-border bg-card">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">Recent Jobs</h3>
                  <span className="text-xs text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded">
                    {tech.activeJobs + tech.completedJobs}
                  </span>
                </div>
                <Link href="/jobs">
                  <span className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                    View all →
                  </span>
                </Link>
              </div>
              <div className="divide-y divide-border">
                {tech.recentJobs.length > 0 ? (
                  tech.recentJobs.map(job => (
                    <Link
                      key={job.id}
                      href={`/jobs/${job.id}`}
                      className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/20 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{job.type}</p>
                        <p className="text-xs text-muted-foreground">{job.scheduled}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <PriorityBadge value={job.priority} />
                        <StatusBadge   value={job.status}   />
                      </div>
                    </Link>
                  ))
                ) : (
                  <p className="px-5 py-8 text-sm text-muted-foreground text-center">
                    No jobs assigned yet.
                  </p>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

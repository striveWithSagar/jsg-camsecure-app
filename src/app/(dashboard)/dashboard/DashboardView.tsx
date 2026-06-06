import type { DashboardData } from "@/lib/data/dashboard";
import { TopBar } from "@/components/layout/TopBar";
import { StatusBadge, PriorityBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle, ArrowRight, CheckCircle2, Clock,
  Radio, Wrench, ChevronRight, Plus,
} from "lucide-react";
import Link from "next/link";
import { cn, fmtJobNumber, fmtReqNumber } from "@/lib/utils";

const PRIORITY_DOT: Record<string, string> = {
  emergency: "bg-c-emergency-solid",
  high:      "bg-c-warning-solid",
  medium:    "bg-c-amber-solid",
  low:       "bg-c-success-solid",
};

const TECH_STATUS: Record<string, { dot: string; label: string }> = {
  on_job:      { dot: "bg-primary",           label: "On Job" },
  on_the_way:  { dot: "bg-c-teal-solid",      label: "En Route" },
  available:   { dot: "bg-c-success-solid",   label: "Available" },
  needs_parts: { dot: "bg-c-warning-solid",   label: "Needs Parts" },
  off_duty:    { dot: "bg-muted-foreground",  label: "Off Duty" },
};

function initials(name: string) {
  return name.split(" ").map(n => n[0]).join("");
}

export function DashboardView({ data }: { data: DashboardData }) {
  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Operations" subtitle="Today's dispatch overview" />

      <div className="flex-1 px-4 sm:px-6 py-5 space-y-5">

        {/* ── Emergency Alert ── */}
        {data.emergencyJobs.length > 0 && (
          <div className="relative rounded-lg border border-c-emergency bg-c-emergency overflow-hidden">
            <div className="absolute inset-y-0 left-0 w-1 bg-c-emergency-solid" />
            <div className="flex items-start gap-3 px-5 py-4">
              <AlertTriangle className="h-4 w-4 text-c-emergency mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-c-emergency">
                  {data.emergencyJobs.length} Emergency Job{data.emergencyJobs.length > 1 ? "s" : ""} Active
                </p>
                <p className="text-xs text-c-emergency/80 mt-0.5 truncate">
                  {data.emergencyJobs.map(j => `${j.client} — ${j.site}`).join(" · ")}
                </p>
              </div>
              <Link href="/jobs" className="flex items-center gap-1 text-xs font-medium text-c-emergency hover:underline shrink-0 mt-0.5">
                View <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        )}

        {/* ── Command Center: Today's Schedule + Crew ── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

          {/* Today's Schedule */}
          <div className="lg:col-span-3 flex flex-col rounded-lg border border-border bg-card min-w-0">
            <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-border">
              <div className="flex items-center gap-4">
                <h2 className="text-sm font-semibold text-foreground">{"Today's Schedule"}</h2>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary inline-block" />
                    {data.todayJobs.filter(j => j.status !== "completed").length} active
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-c-success-solid inline-block" />
                    {data.todayJobs.filter(j => j.status === "completed").length} done
                  </span>
                </div>
              </div>
              <Link href="/jobs" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                All jobs <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {data.todayJobs.length === 0 ? (
              <div className="flex-1 flex items-center justify-center py-12 text-sm text-muted-foreground">
                No jobs scheduled for today
              </div>
            ) : (
              <div className="divide-y divide-border">
                {data.todayJobs.map(job => {
                  const isAttention = job.status === "needs_parts" || job.status === "rescheduled";
                  return (
                    <Link
                      key={job.id}
                      href={`/jobs/${job.id}`}
                      className={cn(
                        "grid items-center gap-3 px-5 py-3 hover:bg-muted/25 transition-colors group",
                        "grid-cols-[3rem_auto_1fr_auto]"
                      )}
                    >
                      <span className="font-mono text-xs text-muted-foreground tabular-nums">{job.time}</span>
                      <div className="flex items-center gap-2">
                        <span className={cn("h-2 w-2 rounded-full shrink-0", PRIORITY_DOT[job.priority])} />
                      </div>
                      <div className="min-w-0">
                        <p className={cn(
                          "text-sm font-medium leading-tight truncate",
                          isAttention ? "text-c-warning" : "text-foreground"
                        )}>
                          {job.client}
                          {isAttention && <span className="ml-1.5 text-xs font-normal">⚠</span>}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          <span className="font-mono text-[10px]">{fmtJobNumber(job.jobNumber)}</span>
                          {" · "}{job.site} · {job.techFirst}
                        </p>
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        <StatusBadge value={job.status} />
                        <ChevronRight className="h-3 w-3 text-muted-foreground/0 group-hover:text-muted-foreground/60 transition-colors" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Field Crew */}
          <div className="lg:col-span-2 flex flex-col rounded-lg border border-border bg-card min-w-0">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">Field Crew</h2>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-c-success font-medium">{data.techAvailable} available</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-primary font-medium">{data.techDeployed} deployed</span>
              </div>
            </div>

            <div className="divide-y divide-border flex-1">
              {data.crew.map(member => {
                const s = TECH_STATUS[member.status] ?? TECH_STATUS.off_duty;
                return (
                  <div key={member.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="relative shrink-0">
                      <div className="h-7 w-7 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center text-[10px] font-semibold text-primary">
                        {initials(member.name)}
                      </div>
                      <span className={cn("absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card", s.dot)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground leading-tight">{member.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate leading-tight mt-0.5">
                        {member.currentSite ?? member.specialty}
                      </p>
                    </div>
                    <span className={cn(
                      "text-[10px] font-medium shrink-0 px-1.5 py-0.5 rounded",
                      member.status === "available"   && "text-c-success bg-c-success",
                      member.status === "on_job"      && "text-primary bg-primary/10",
                      member.status === "on_the_way"  && "text-c-teal bg-c-teal",
                      member.status === "needs_parts" && "text-c-warning bg-c-warning/10",
                      member.status === "off_duty"    && "text-muted-foreground bg-muted/40",
                    )}>
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="px-5 py-3 border-t border-border">
              <Link href="/technicians">
                <Button variant="ghost" size="sm" className="w-full h-7 text-xs text-muted-foreground hover:text-foreground justify-between">
                  Manage technicians <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* ── Needs Attention ── */}
        {data.attentionJobs.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Wrench className="h-3.5 w-3.5 text-c-warning" />
              <h2 className="text-xs font-semibold text-c-warning uppercase tracking-wider">
                Needs Attention · {data.attentionJobs.length}
              </h2>
            </div>
            <div className="flex flex-wrap gap-3">
              {data.attentionJobs.map(job => (
                <Link key={job.id} href={`/jobs/${job.id}`} className="flex items-center gap-3 rounded-lg border border-c-warning bg-card px-4 py-3 hover:bg-muted/20 transition-colors min-w-[220px] flex-1 max-w-sm">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{job.client}</p>
                    <p className="text-xs text-muted-foreground truncate">{job.type} · {job.techFirst}</p>
                  </div>
                  <StatusBadge value={job.status} />
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── Bottom row: New Requests + Month Summary ── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

          {/* New Requests */}
          <div className="lg:col-span-3 rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-semibold text-foreground">New Requests</h2>
                {data.newRequests.length > 0 && (
                  <span className="text-xs font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                    {data.newRequests.length}
                  </span>
                )}
              </div>
              <Link href="/requests/new">
                <Button size="sm" className="h-7 text-xs gap-1">
                  <Plus className="h-3 w-3" /> New
                </Button>
              </Link>
            </div>

            {data.newRequests.length === 0 ? (
              <p className="px-5 py-8 text-sm text-muted-foreground text-center">No new requests</p>
            ) : (
              <div className="divide-y divide-border">
                {data.newRequests.map(req => (
                  <Link key={req.id} href={`/requests/${req.id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/25 transition-colors group">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-medium text-foreground truncate">{req.client}</p>
                        <PriorityBadge value={req.urgency} />
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        <span className="font-mono text-[10px]">{fmtReqNumber(req.requestNumber)}</span>
                        {" · "}{req.type} · {req.created}
                      </p>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/0 group-hover:text-muted-foreground/60 transition-colors shrink-0" />
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Month at a Glance */}
          <div className="lg:col-span-2 rounded-lg border border-border bg-card">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">{data.currentMonth} at a Glance</h2>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-2xl font-semibold text-foreground tabular-nums">{data.completedThisMonth}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                    <CheckCircle2 className="h-3 w-3 text-c-success" /> Jobs completed this month
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-foreground tabular-nums">{data.upcomingJobCount}</p>
                  <p className="text-xs text-muted-foreground">upcoming</p>
                </div>
              </div>
              <div className="h-px bg-border" />
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground text-xs">Revenue this month</span>
                  <span className="font-semibold text-foreground tabular-nums">${data.monthlyRevenue.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground text-xs flex items-center gap-1.5">
                    <Clock className="h-3 w-3 text-c-warning" /> Unpaid invoices
                  </span>
                  <Link href="/invoices" className="text-xs text-c-warning font-medium hover:underline tabular-nums">
                    {data.unpaidInvoiceCount} invoices →
                  </Link>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground text-xs flex items-center gap-1.5">
                    <Radio className="h-3 w-3 text-muted-foreground" /> Open requests
                  </span>
                  <Link href="/requests" className="text-xs text-primary font-medium hover:underline tabular-nums">
                    {data.openRequestCount} pending →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

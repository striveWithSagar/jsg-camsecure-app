"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { JobBucket, JobRow } from "@/lib/data/jobs";
import { StatusBadge, PriorityBadge } from "@/components/shared/StatusBadge";
import { fmtJobNumber, businessDateKey, BUSINESS_TZ } from "@/lib/utils";
import { validateDateInput } from "@/lib/date-input";
import { AlertTriangle, Calendar, ChevronDown, ChevronRight, Clock, Download, User } from "lucide-react";
import { DateTimeInput } from "@/components/ui/date-time-input";
import Link from "next/link";

// ── Config ────────────────────────────────────────────────────────────────────

// Completed / Cancelled removed from active Kanban (D5)
const KANBAN_COLUMNS = [
  { key: "assigned",    label: "Assigned",    dot: "bg-c-info-solid" },
  { key: "on_the_way",  label: "On the Way",  dot: "bg-c-teal-solid" },
  { key: "in_progress", label: "In Progress", dot: "bg-c-violet-solid" },
  { key: "started",     label: "Started",     dot: "bg-c-amber-solid" },
  { key: "needs_parts", label: "Needs Parts", dot: "bg-c-warning-solid" },
  { key: "rescheduled", label: "Rescheduled", dot: "bg-c-purple-solid" },
];

const PRIORITY_ORDER = ["emergency", "high", "medium", "low"];

// ── Client-side date helpers ──────────────────────────────────────────────────

function businessDateOffset(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return businessDateKey(d);
}

function daysBetween(isoA: string, isoB: string): number {
  return Math.max(0, Math.round(
    (new Date(isoB + "T00:00:00").getTime() - new Date(isoA + "T00:00:00").getTime()) / 86_400_000,
  ));
}

function fmtDayHeading(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
    timeZone: BUSINESS_TZ,
  });
}

// ── Shared card components ────────────────────────────────────────────────────

function KanbanCard({ job }: { job: JobRow }) {
  return (
    <Link href={`/jobs/${job.id}`}>
      <div className="rounded-lg border border-border bg-card p-3.5 hover:border-border/80 hover:bg-muted/20 transition-colors cursor-pointer">
        <div className="flex items-center gap-2 mb-2.5">
          <PriorityBadge value={job.priority} />
          <span className="text-[10px] font-mono text-muted-foreground ml-auto">{fmtJobNumber(job.jobNumber)}</span>
        </div>
        <p className="text-sm font-semibold text-foreground leading-tight truncate">{job.client}</p>
        <p className="text-xs text-muted-foreground truncate mb-2.5">{job.site}</p>
        <p className="text-xs text-muted-foreground bg-muted/30 px-2 py-1 rounded mb-3 truncate">{job.type}</p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <User className="h-3 w-3" />
            {job.technician.split(" ")[0]}
          </span>
          <span className="flex items-center gap-1 ml-auto">
            <Clock className="h-3 w-3" />
            {job.scheduled.replace("Today ", "")}
          </span>
        </div>
      </div>
    </Link>
  );
}

function ListRow({ job }: { job: JobRow }) {
  return (
    <Link href={`/jobs/${job.id}`}>
      <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 hover:bg-muted/20 transition-colors">
        <PriorityBadge value={job.priority} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{job.client}</p>
          <p className="text-xs text-muted-foreground truncate">{job.site} · {job.type}</p>
        </div>
        <div className="hidden sm:flex items-center gap-4 shrink-0 text-xs text-muted-foreground">
          <span className="font-mono text-muted-foreground/60">{fmtJobNumber(job.jobNumber)}</span>
          <span className="flex items-center gap-1"><User className="h-3 w-3" />{job.technician.split(" ")[0]}</span>
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{job.scheduled.replace("Today ", "")}</span>
        </div>
        <StatusBadge value={job.status} />
      </div>
    </Link>
  );
}

// ── Section components ────────────────────────────────────────────────────────

function OverdueSection({ jobs, todayStr }: { jobs: JobRow[]; todayStr: string }) {
  if (jobs.length === 0) return null;
  return (
    <div className="mb-5 rounded-lg border border-c-warning/40 bg-c-warning/5 p-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="h-3.5 w-3.5 text-c-warning" />
        <span className="text-xs font-semibold text-c-warning uppercase tracking-widest">
          Overdue / Carry Forward
        </span>
        <span className="ml-auto text-xs text-c-warning/70 bg-c-warning/10 px-1.5 py-0.5 rounded">
          {jobs.length}
        </span>
      </div>
      <div className="space-y-1.5">
        {jobs.map(job => {
          const days = job.scheduledAt ? daysBetween(job.scheduledAt.slice(0, 10), todayStr) : 0;
          return (
            <Link key={job.id} href={`/jobs/${job.id}`}>
              <div className="flex items-center gap-3 rounded-md border border-c-warning/20 bg-background/60 px-3 py-2.5 hover:bg-c-warning/10 transition-colors">
                <PriorityBadge value={job.priority} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{job.client}</p>
                  <p className="text-xs text-muted-foreground truncate">{job.site}</p>
                </div>
                <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                  <span className="font-mono text-muted-foreground/60">{fmtJobNumber(job.jobNumber)}</span>
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />{job.technician.split(" ")[0]}
                  </span>
                </div>
                <StatusBadge value={job.status} />
                <span className="text-xs font-semibold text-c-warning shrink-0 ml-1">
                  {days > 0 ? `${days}d` : "<1d"}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function DoneSection({ jobs, label }: { jobs: JobRow[]; label: string }) {
  const [open, setOpen] = useState(false);
  if (jobs.length === 0) return null;
  return (
    <div className="mt-4 border-t border-border pt-4">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-2 text-left mb-2"
      >
        {open
          ? <ChevronDown  className="h-3.5 w-3.5 text-muted-foreground" />
          : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        }
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{label}</span>
        <span className="text-xs text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded ml-1">{jobs.length}</span>
      </button>
      {open && (
        <div className="space-y-1.5">
          {jobs.map(job => (
            <Link key={job.id} href={`/jobs/${job.id}`}>
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/10 px-4 py-2.5 opacity-75 hover:opacity-100 hover:bg-muted/20 transition-all">
                <PriorityBadge value={job.priority} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{job.client}</p>
                  <p className="text-xs text-muted-foreground truncate">{job.site}</p>
                </div>
                <span className="font-mono text-xs text-muted-foreground/60">{fmtJobNumber(job.jobNumber)}</span>
                <StatusBadge value={job.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function UnscheduledSection({ jobs }: { jobs: JobRow[] }) {
  if (jobs.length === 0) return null;
  return (
    <div className="mt-4 border-t border-border pt-4">
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Unscheduled</span>
        <span className="text-xs text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded">{jobs.length}</span>
      </div>
      <div className="space-y-1.5">
        {jobs.map(job => (
          <Link key={job.id} href={`/jobs/${job.id}`}>
            <div className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-card px-4 py-2.5 hover:bg-muted/20 transition-colors">
              <PriorityBadge value={job.priority} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{job.client}</p>
                <p className="text-xs text-muted-foreground truncate">{job.site} · {job.type}</p>
              </div>
              <span className="font-mono text-xs text-muted-foreground/60">{fmtJobNumber(job.jobNumber)}</span>
              <StatusBadge value={job.status} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ── View components ───────────────────────────────────────────────────────────

function KanbanView({ jobs }: { jobs: JobRow[] }) {
  if (jobs.length === 0) {
    return (
      <div className="mb-5 rounded-lg border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No active jobs scheduled for this date.</p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto pb-4 mb-5">
      <div className="flex gap-4" style={{ minWidth: `${KANBAN_COLUMNS.length * 260}px` }}>
        {KANBAN_COLUMNS.map(col => {
          const colJobs = jobs.filter(j => j.status === col.key);
          return (
            <div key={col.key} className="flex flex-col w-[260px] shrink-0">
              <div className="flex items-center gap-2 mb-3">
                <div className={`h-2 w-2 rounded-full ${col.dot}`} />
                <span className="text-xs font-semibold text-foreground">{col.label}</span>
                <span className="ml-auto text-xs text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded">
                  {colJobs.length}
                </span>
              </div>
              <div className="space-y-2.5">
                {colJobs.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border py-8 text-center">
                    <p className="text-xs text-muted-foreground">No jobs</p>
                  </div>
                ) : (
                  colJobs.map(job => <KanbanCard key={job.id} job={job} />)
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ListView({ jobs }: { jobs: JobRow[] }) {
  const sorted = [...jobs].sort((a, b) => {
    const pa = PRIORITY_ORDER.indexOf(a.priority);
    const pb = PRIORITY_ORDER.indexOf(b.priority);
    return pa !== pb ? pa - pb : a.client.localeCompare(b.client);
  });
  return (
    <div className="space-y-1.5 mb-5">
      {sorted.length === 0 && (
        <div className="py-10 text-center">
          <p className="text-sm text-muted-foreground">No active jobs scheduled for this date.</p>
        </div>
      )}
      {sorted.map(job => <ListRow key={job.id} job={job} />)}
    </div>
  );
}

function WeekView({ bucket }: { bucket: JobBucket }) {
  const todayStr = businessDateOffset(0);
  return (
    <div className="space-y-5">
      <OverdueSection jobs={bucket.overdue} todayStr={todayStr} />
      {bucket.weekDays.map(({ label, date, jobs }) => (
        <div key={date}>
          <div className="flex items-center gap-2 mb-2.5">
            <span className={`text-xs font-semibold uppercase tracking-widest ${
              date === todayStr ? "text-primary" : "text-muted-foreground"
            }`}>
              {label}{date === todayStr ? " · Today" : ""}
            </span>
            <span className="text-xs text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded">
              {jobs.length}
            </span>
          </div>
          {jobs.length === 0 ? (
            <p className="text-xs text-muted-foreground pl-1 py-1 border-l-2 border-border">
              No jobs scheduled.
            </p>
          ) : (
            <div className="space-y-1.5">
              {jobs.map(job => <ListRow key={job.id} job={job} />)}
            </div>
          )}
        </div>
      ))}
      <UnscheduledSection jobs={bucket.unscheduled} />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function JobBoard({ bucket, dateParam }: { bucket: JobBucket; dateParam: string }) {
  const router = useRouter();
  const [view, setView] = useState<"kanban" | "list">("kanban");

  const todayStr    = businessDateOffset(0);
  const tomorrowStr = businessDateOffset(1);

  const activeTab =
    dateParam === "week"        ? "week"     :
    dateParam === todayStr      ? "today"    :
    dateParam === tomorrowStr   ? "tomorrow" :
    "custom";

  function nav(d: string) {
    router.push(`/jobs?date=${d}`);
  }

  // Week export — compute Sunday from the Monday stored in bucket.selectedDate
  const weekEnd = bucket.isWeekView ? (() => {
    const d = new Date(bucket.selectedDate + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + 6);
    return d.toISOString().slice(0, 10);
  })() : "";
  const weekExportHref = bucket.isWeekView
    ? `/api/admin/reports/jobs/weekly?start=${bucket.selectedDate}&end=${weekEnd}`
    : "";

  const doneLabel =
    dateParam === todayStr      ? "Completed Today" :
    dateParam === tomorrowStr   ? "Completed Tomorrow" :
    dateParam === "week"        ? "Completed This Week" :
    `Completed ${new Date(dateParam + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

  const tabClass = (id: string) =>
    activeTab === id
      ? "h-7 px-3 text-xs bg-card text-foreground shadow-sm rounded"
      : "h-7 px-3 text-xs text-muted-foreground rounded hover:text-foreground transition-colors";

  return (
    <div className="flex-1 px-6 py-6 flex flex-col min-w-0">

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">

        {/* Date tab bar */}
        <div className="flex items-center gap-1 rounded-md border border-border bg-muted/30 p-0.5">
          <button className={tabClass("today")}    onClick={() => nav(todayStr)}>Today</button>
          <button className={tabClass("tomorrow")} onClick={() => nav(tomorrowStr)}>Tomorrow</button>
          <button className={tabClass("week")}     onClick={() => nav("week")}>This Week</button>
          {/* Date picker tab — uses DateTimeInput for reliable picker trigger */}
          <DateTimeInput
            type="date"
            value={activeTab === "custom" ? dateParam : ""}
            onChange={e => {
              const val = (e.target as HTMLInputElement).value;
              if (!val) return;
              try { validateDateInput(val, false); nav(val); } catch { /* ignore invalid manual input */ }
            }}
            title="Pick a date"
            className="h-7 text-xs text-muted-foreground bg-transparent border-0 shadow-none focus-visible:ring-0 dark:bg-transparent hover:text-foreground cursor-pointer px-2"
            wrapperClassName="inline-flex items-center"
          />
        </div>

        {/* Kanban / List toggle — day view only */}
        {!bucket.isWeekView && (
          <div className="flex items-center gap-1 rounded-md border border-border bg-muted/30 p-0.5 ml-2">
            <button
              onClick={() => setView("kanban")}
              className={view === "kanban"
                ? "h-7 px-3 text-xs bg-card text-foreground shadow-sm rounded"
                : "h-7 px-3 text-xs text-muted-foreground rounded hover:text-foreground transition-colors"}
            >
              Kanban
            </button>
            <button
              onClick={() => setView("list")}
              className={view === "list"
                ? "h-7 px-3 text-xs bg-card text-foreground shadow-sm rounded"
                : "h-7 px-3 text-xs text-muted-foreground rounded hover:text-foreground transition-colors"}
            >
              List
            </button>
          </div>
        )}

        {/* Quick stats */}
        <div className="flex items-center gap-2 ml-auto text-xs text-muted-foreground">
          {bucket.overdue.length > 0 && (
            <>
              <span className="font-medium text-c-warning">{bucket.overdue.length} overdue</span>
              <span>·</span>
            </>
          )}
          <span>
            {bucket.active.length + bucket.overdue.length + bucket.unscheduled.length} active
          </span>
        </div>

        {/* Weekly Excel export — only shown in This Week view */}
        {bucket.isWeekView && (
          <a
            href={weekExportHref}
            download
            className="inline-flex items-center gap-1.5 h-7 px-3 rounded-md border border-border bg-card text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors shrink-0"
            title={`Download weekly report (${bucket.selectedDate} to ${weekEnd})`}
          >
            <Download className="h-3 w-3" />
            Export Weekly Report
          </a>
        )}
      </div>

      {/* ── Week view ── */}
      {bucket.isWeekView && <WeekView bucket={bucket} />}

      {/* ── Day view ── */}
      {!bucket.isWeekView && (
        <>
          {/* Overdue / Carry Forward — always shown when non-empty */}
          <OverdueSection jobs={bucket.overdue} todayStr={todayStr} />

          {/* Active section header */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-semibold text-foreground uppercase tracking-widest">
              {activeTab === "today"    ? "Today" :
               activeTab === "tomorrow" ? "Tomorrow" :
               fmtDayHeading(dateParam)}
            </span>
            <span className="text-xs text-muted-foreground">
              — {bucket.active.length} active
            </span>
          </div>

          {/* Kanban or list for today's active jobs */}
          {view === "kanban"
            ? <KanbanView jobs={bucket.active} />
            : <ListView   jobs={bucket.active} />
          }

          {/* Completed / Cancelled for this date (grouped by completed_at, collapsible) */}
          <DoneSection jobs={bucket.done} label={doneLabel} />

          {/* Unscheduled — always shown when non-empty */}
          <UnscheduledSection jobs={bucket.unscheduled} />
        </>
      )}
    </div>
  );
}

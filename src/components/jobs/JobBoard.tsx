"use client";

import { useState } from "react";
import type { JobRow } from "@/lib/data/jobs";
import { StatusBadge, PriorityBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { fmtJobNumber } from "@/lib/utils";
import { Clock, User } from "lucide-react";
import Link from "next/link";

const KANBAN_COLUMNS = [
  { key: "assigned",    label: "Assigned",    indicator: "bg-c-info-solid" },
  { key: "on_the_way",  label: "On the Way",  indicator: "bg-c-teal-solid" },
  { key: "in_progress", label: "In Progress", indicator: "bg-c-violet-solid" },
  { key: "started",     label: "Started",     indicator: "bg-c-amber-solid" },
  { key: "needs_parts",  label: "Needs Parts",  indicator: "bg-c-warning-solid" },
  { key: "rescheduled", label: "Rescheduled", indicator: "bg-c-purple-solid" },
  { key: "completed",   label: "Completed",   indicator: "bg-c-success-solid" },
];

const PRIORITY_ORDER = ["emergency", "high", "medium", "low"];

export function JobBoard({ jobs }: { jobs: JobRow[] }) {
  const [view, setView] = useState<"kanban" | "list">("kanban");

  const sortedForList = [...jobs].sort((a, b) => {
    const pa = PRIORITY_ORDER.indexOf(a.priority);
    const pb = PRIORITY_ORDER.indexOf(b.priority);
    if (pa !== pb) return pa - pb;
    return a.client.localeCompare(b.client);
  });

  return (
    <div className="flex-1 px-6 py-6 flex flex-col min-w-0">

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-1 rounded-md border border-border bg-muted/30 p-0.5">
          <Button
            variant="ghost" size="sm"
            onClick={() => setView("kanban")}
            className={view === "kanban"
              ? "h-7 px-3 text-xs bg-card text-foreground shadow-sm rounded"
              : "h-7 px-3 text-xs text-muted-foreground rounded"}
          >
            Kanban
          </Button>
          <Button
            variant="ghost" size="sm"
            onClick={() => setView("list")}
            className={view === "list"
              ? "h-7 px-3 text-xs bg-card text-foreground shadow-sm rounded"
              : "h-7 px-3 text-xs text-muted-foreground rounded"}
          >
            List
          </Button>
        </div>
        <div className="flex items-center gap-2 ml-auto text-xs text-muted-foreground">
          <span>{jobs.filter(j => j.priority === "emergency").length} emergency</span>
          <span>·</span>
          <span>{jobs.filter(j => j.status === "needs_parts").length} needs parts</span>
        </div>
      </div>

      {/* ── List view ── */}
      {view === "list" && (
        <div className="space-y-1.5">
          {sortedForList.length === 0 && (
            <div className="py-16 text-center">
              <p className="text-sm text-muted-foreground">No jobs found.</p>
            </div>
          )}
          {sortedForList.map(job => (
            <Link key={job.id} href={`/jobs/${job.id}`}>
              <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 hover:bg-muted/20 transition-colors">
                <PriorityBadge value={job.priority} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{job.client}</p>
                  <p className="text-xs text-muted-foreground truncate">{job.site} · {job.type}</p>
                </div>
                <div className="hidden sm:flex items-center gap-4 shrink-0 text-xs text-muted-foreground">
                  <span className="font-mono text-muted-foreground/60">{fmtJobNumber(job.jobNumber)}</span>
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />{job.technician.split(" ")[0]}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />{job.scheduled.replace("Today ", "")}
                  </span>
                </div>
                <StatusBadge value={job.status} />
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* ── Kanban board ── */}
      {view === "kanban" && (
        <div className="flex-1 overflow-x-auto pb-4">
          <div className="flex gap-4 h-full" style={{ minWidth: `${KANBAN_COLUMNS.length * 260}px` }}>
            {KANBAN_COLUMNS.map(col => {
              const colJobs = jobs.filter(j => j.status === col.key);
              return (
                <div key={col.key} className="flex flex-col w-[260px] shrink-0">
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`h-2 w-2 rounded-full ${col.indicator}`} />
                    <span className="text-xs font-semibold text-foreground">{col.label}</span>
                    <span className="ml-auto text-xs text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded">
                      {colJobs.length}
                    </span>
                  </div>
                  <div className="flex-1 space-y-2.5">
                    {colJobs.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-border py-8 text-center">
                        <p className="text-xs text-muted-foreground">No jobs</p>
                      </div>
                    ) : colJobs.map(job => (
                      <Link key={job.id} href={`/jobs/${job.id}`}>
                        <div className="rounded-lg border border-border bg-card p-3.5 hover:border-border/80 hover:bg-muted/20 transition-colors cursor-pointer group">
                          <div className="flex items-center gap-2 mb-2.5">
                            <PriorityBadge value={job.priority} />
                            <span className="text-[10px] font-mono text-muted-foreground ml-auto">{fmtJobNumber(job.jobNumber)}</span>
                          </div>
                          <p className="text-sm font-semibold text-foreground leading-tight truncate">{job.client}</p>
                          <p className="text-xs text-muted-foreground truncate mb-2.5">{job.site}</p>
                          <p className="text-xs text-muted-foreground bg-muted/30 px-2 py-1 rounded mb-3 truncate">{job.type}</p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />{job.technician.split(" ")[0]}
                            </span>
                            <span className="flex items-center gap-1 ml-auto">
                              <Clock className="h-3 w-3" />{job.scheduled.replace("Today ", "")}
                            </span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

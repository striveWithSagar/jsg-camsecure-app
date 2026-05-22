"use client";

import { useMockStore } from "@/lib/mock-store";
import { TopBar } from "@/components/layout/TopBar";
import { PriorityBadge } from "@/components/shared/StatusBadge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { REQUEST_STATUS_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Plus, ArrowRight } from "lucide-react";
import Link from "next/link";

const REQUEST_STATUS_STYLE: Record<string, string> = {
  new:               "text-primary bg-primary/10 border-primary/20",
  reviewing:         "text-c-teal bg-c-teal border-c-teal",
  ready_to_schedule: "text-c-amber bg-c-amber border-c-amber",
  converted:         "text-c-success bg-c-success border-c-success",
  cancelled:         "text-muted-foreground bg-muted/40 border-border",
};

export default function RequestsPage() {
  const { requests } = useMockStore();

  const counts = {
    all:       requests.length,
    new:       requests.filter(r => r.status === "new").length,
    reviewing: requests.filter(r => r.status === "reviewing").length,
    ready:     requests.filter(r => r.status === "ready_to_schedule").length,
    converted: requests.filter(r => r.status === "converted").length,
  };

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Service Requests" subtitle={`${counts.all} total · ${counts.new} new`} />

      <div className="flex-1 px-6 py-6 space-y-5">

        {/* Stat strip */}
        <div className="flex items-center gap-5 flex-wrap">
          {[
            { label: "New",               count: counts.new,       cls: "text-primary" },
            { label: "Reviewing",         count: counts.reviewing, cls: "text-c-teal" },
            { label: "Ready to Schedule", count: counts.ready,     cls: "text-c-amber" },
            { label: "Converted",         count: counts.converted, cls: "text-c-success" },
          ].map(({ label, count, cls }) => (
            <div key={label} className="flex items-center gap-2">
              <span className={cn("text-2xl font-semibold tabular-nums", cls)}>{count}</span>
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
          ))}
          <div className="ml-auto">
            <Link href="/requests/new">
              <Button size="sm" className="gap-1.5 h-8 text-xs">
                <Plus className="h-3.5 w-3.5" /> New Request
              </Button>
            </Link>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-xs text-muted-foreground font-medium uppercase tracking-wide w-24">ID</TableHead>
                <TableHead className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Client</TableHead>
                <TableHead className="text-xs text-muted-foreground font-medium uppercase tracking-wide hidden md:table-cell">Service Type</TableHead>
                <TableHead className="text-xs text-muted-foreground font-medium uppercase tracking-wide hidden lg:table-cell">Description</TableHead>
                <TableHead className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Urgency</TableHead>
                <TableHead className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Status</TableHead>
                <TableHead className="text-xs text-muted-foreground font-medium uppercase tracking-wide hidden sm:table-cell">Created</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map(req => (
                <TableRow key={req.id} className="border-border hover:bg-muted/20 cursor-pointer">
                  <TableCell className="font-mono text-xs text-muted-foreground">{req.id}</TableCell>
                  <TableCell>
                    <div>
                      <p className="text-sm font-medium text-foreground">{req.client}</p>
                      <p className="text-xs text-muted-foreground">{req.phone}</p>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{req.type}</TableCell>
                  <TableCell className="hidden lg:table-cell text-xs text-muted-foreground max-w-xs truncate">{req.description}</TableCell>
                  <TableCell><PriorityBadge value={req.urgency.toLowerCase()} /></TableCell>
                  <TableCell>
                    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border", REQUEST_STATUS_STYLE[req.status])}>
                      {REQUEST_STATUS_LABELS[req.status as keyof typeof REQUEST_STATUS_LABELS] ?? req.status}
                    </span>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">{req.created}</TableCell>
                  <TableCell>
                    <Link
                      href={`/requests/${req.id}`}
                      className={buttonVariants({ variant: "ghost", size: "icon", className: "h-7 w-7" })}
                    >
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

      </div>
    </div>
  );
}

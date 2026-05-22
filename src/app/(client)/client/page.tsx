"use client";

// TODO: replace useMockStore with Supabase queries filtered by authenticated client:
//   jobs:     supabase.from("jobs").select().eq("client_id", session.user.client_id)
//   invoices: supabase.from("invoices").select().eq("client_id", session.user.client_id)

import { useMockStore } from "@/lib/mock-store";
import { MOCK_INVOICES } from "@/lib/constants"; // invoices have no mutations in mock store
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ArrowRight, CheckCircle2, Clock, FileText, Plus } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// TODO: replace with authenticated client from Supabase session
const CLIENT_NAME = "Metro Security Ltd";

export default function ClientDashboard() {
  // TODO: replace with Supabase queries
  const { jobs } = useMockStore();
  const myJobs  = jobs.filter(j => j.client === CLIENT_NAME);

  // Invoices have no mutations in the mock store — read from constants until Supabase is added
  const myInvoices     = MOCK_INVOICES.filter(i => i.client === CLIENT_NAME);
  const activeJobs     = myJobs.filter(j => j.status !== "completed");
  const unpaidInvoices = myInvoices.filter(i => i.status !== "paid");

  return (
    <div className="space-y-8">

      {/* Welcome */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Welcome back</h1>
          <p className="text-sm text-muted-foreground mt-1">{CLIENT_NAME} · Client Portal</p>
        </div>
        <Link href="/client/requests/new" className={cn(buttonVariants({ size: "sm" }), "h-9 shrink-0 gap-1.5")}>
          <Plus className="h-3.5 w-3.5" /> Raise a Request
        </Link>
      </div>

      {/* Status strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[
          { label: "Active Jobs",   value: activeJobs.length,                                    icon: Clock,        color: "text-primary",   bg: "bg-primary/10" },
          { label: "Completed",     value: myJobs.filter(j => j.status === "completed").length,  icon: CheckCircle2, color: "text-c-success", bg: "bg-c-success" },
          { label: "Open Invoices", value: unpaidInvoices.length,                                icon: FileText,     color: "text-c-warning", bg: "bg-c-warning" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="rounded-xl border border-border bg-card px-5 py-4 flex items-center gap-3">
            <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg shrink-0", bg)}>
              <Icon className={cn("h-4 w-4", color)} />
            </div>
            <div>
              <p className={cn("text-2xl font-semibold tabular-nums leading-none", color)}>{value}</p>
              <p className="text-xs text-muted-foreground mt-1">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Active jobs */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-foreground">Your Active Jobs</h2>
          <Link href="/client/jobs" className="text-xs text-primary hover:underline flex items-center gap-1">
            All jobs <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {activeJobs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center rounded-xl border border-dashed border-border">
            No active jobs at the moment.
          </p>
        ) : (
          <div className="space-y-2">
            {activeJobs.map(job => (
              <div key={job.id} className="flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{job.site}</p>
                  <p className="text-xs text-muted-foreground">{job.type} · {job.scheduled}</p>
                </div>
                <StatusBadge value={job.status} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Unpaid invoices */}
      {unpaidInvoices.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground">Outstanding Invoices</h2>
            <Link href="/client/invoices" className="text-xs text-primary hover:underline flex items-center gap-1">
              All invoices <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {unpaidInvoices.map(inv => (
              <div key={inv.id} className="flex items-center gap-4 rounded-xl border border-c-warning bg-card px-5 py-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{inv.id}</p>
                  <p className="text-xs text-muted-foreground">Due {inv.due}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-foreground tabular-nums">${inv.amount.toLocaleString()}</p>
                  <Link href="/client/invoices" className={cn(buttonVariants({ size: "sm" }), "h-7 text-xs mt-1.5")}>
                    Pay Now
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
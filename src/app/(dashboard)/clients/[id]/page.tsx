import { notFound } from "next/navigation";
import { getClientById } from "@/lib/data/clients";
import { TopBar } from "@/components/layout/TopBar";
import { StatusBadge, PriorityBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Building2, Phone, Mail, Briefcase, Receipt,
} from "lucide-react";
import Link from "next/link";
import { AccountActionsPanel } from "@/components/admin/AccountActionsPanel";

export default async function ClientProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await getClientById(id);

  if (!client) notFound();

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar
        title={client.name}
        subtitle={`${client.jobCount} job${client.jobCount !== 1 ? "s" : ""}`}
      />

      <div className="flex-1 px-6 py-6 space-y-6 max-w-4xl">

        <Link href="/clients" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3 w-3" /> Back to Clients
        </Link>

        {/* Profile header */}
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 border border-primary/15 shrink-0">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-foreground">{client.name}</h2>
              <p className="text-sm text-muted-foreground mb-3">{client.contact || "—"}</p>
              <div className="flex flex-wrap gap-4 text-sm">
                {client.phone && (
                  <a href={`tel:${client.phone}`} className="flex items-center gap-1.5 text-primary hover:underline">
                    <Phone className="h-3.5 w-3.5" />{client.phone}
                  </a>
                )}
                {client.email && (
                  <a href={`mailto:${client.email}`} className="flex items-center gap-1.5 text-primary hover:underline">
                    <Mail className="h-3.5 w-3.5" />{client.email}
                  </a>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Button size="sm" variant="outline" className="h-8 text-xs shrink-0" disabled>Edit Client</Button>
              <span className="text-xs text-muted-foreground">Coming soon</span>
            </div>
          </div>
        </div>

        {/* Account management */}
        <AccountActionsPanel
          profileId={client.profileId}
          role="client"
          isActive={client.profileIsActive}
          name={client.contact || client.name}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Jobs */}
          <div className="rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">Jobs</h3>
                <span className="text-xs text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded">{client.jobCount}</span>
              </div>
              <Link href="/jobs">
                <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground">View all</Button>
              </Link>
            </div>
            <div className="divide-y divide-border">
              {client.jobs.length > 0 ? client.jobs.map(job => (
                <Link key={job.id} href={`/jobs/${job.id}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/20 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{job.type}</p>
                    <p className="text-xs text-muted-foreground">{job.scheduled}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <PriorityBadge value={job.priority} />
                    <StatusBadge value={job.status} />
                  </div>
                </Link>
              )) : (
                <p className="px-5 py-8 text-sm text-muted-foreground text-center">No jobs found</p>
              )}
            </div>
          </div>

          {/* Invoices */}
          <div className="rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">Invoices</h3>
                <span className="text-xs text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded">{client.invoices.length}</span>
              </div>
              <Link href="/invoices">
                <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground">View all</Button>
              </Link>
            </div>
            <div className="divide-y divide-border">
              {client.invoices.length > 0 ? client.invoices.map(inv => (
                <div key={inv.id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">${inv.total.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Due {inv.dueAt}</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded border ${
                    inv.status === "paid"    ? "badge-completed" :
                    inv.status === "overdue" ? "badge-emergency" : "badge-assigned"
                  }`}>{inv.status}</span>
                </div>
              )) : (
                <p className="px-5 py-8 text-sm text-muted-foreground text-center">No invoices</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

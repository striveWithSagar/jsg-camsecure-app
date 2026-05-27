import { getClientList } from "@/lib/data/clients";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Plus, ArrowRight, Building2, Phone, Mail } from "lucide-react";
import Link from "next/link";

export default async function ClientsPage() {
  const clients = await getClientList();
  const activeCount = clients.filter(c => c.status === "active").length;

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Clients" subtitle={`${clients.length} clients`} />

      <div className="flex-1 px-6 py-6 space-y-5">

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm">
            <span className="text-2xl font-semibold text-foreground">{clients.length}</span>
            <span className="text-muted-foreground">total clients ·</span>
            <span className="text-c-success">{activeCount} active</span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" className="gap-1.5 h-8 text-xs" disabled>
              <Plus className="h-3.5 w-3.5" /> Add Client
            </Button>
            <span className="text-xs text-muted-foreground">Coming soon</span>
          </div>
        </div>

        {/* Client cards grid */}
        {clients.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-muted-foreground">No clients found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {clients.map(client => (
              <Link key={client.id} href={`/clients/${client.id}`}>
                <div className="rounded-lg border border-border bg-card p-5 hover:border-border/80 hover:bg-muted/20 transition-colors group">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 border border-primary/15">
                        <Building2 className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground leading-tight">{client.name}</p>
                        <p className="text-xs text-muted-foreground">{client.contact || "—"}</p>
                      </div>
                    </div>
                    <span className={cn(
                      "text-xs font-medium px-1.5 py-0.5 rounded border",
                      client.status === "active"
                        ? "text-c-success bg-c-success border-c-success"
                        : "text-muted-foreground bg-muted/30 border-border"
                    )}>
                      {client.status}
                    </span>
                  </div>

                  <div className="space-y-1.5 mb-4">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Phone className="h-3 w-3" />{client.phone || "—"}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Mail className="h-3 w-3" />{client.email || "—"}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs border-t border-border pt-3">
                    <div>
                      <p className="text-muted-foreground">Sites</p>
                      <p className="font-semibold text-foreground">—</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Jobs</p>
                      <p className="font-semibold text-foreground">{client.jobCount}</p>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}

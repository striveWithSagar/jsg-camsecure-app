import type { Metadata } from "next";
import type { ClientInvoiceItem } from "@/lib/data/client-portal";
import { getClientInvoices } from "@/lib/data/client-portal";
import { buttonVariants } from "@/components/ui/button";
import { Send, CheckCircle2, Clock, AlertTriangle, FileX } from "lucide-react";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Invoices · CamSecure Client Portal" };

const INV_CONFIG: Record<string, { icon: React.ElementType; label: string; color: string; bg: string }> = {
  paid:      { icon: CheckCircle2,  label: "Paid",      color: "text-c-success",   bg: "bg-c-success/15" },
  unpaid:    { icon: Clock,         label: "Unpaid",    color: "text-c-info",      bg: "bg-c-info/15" },
  overdue:   { icon: AlertTriangle, label: "Overdue",   color: "text-c-emergency", bg: "bg-c-emergency/15" },
  draft:     { icon: FileX,         label: "Draft",     color: "text-muted-foreground", bg: "bg-muted/30" },
  cancelled: { icon: FileX,         label: "Cancelled", color: "text-muted-foreground", bg: "bg-muted/30" },
};

function InvoiceCard({ inv }: { inv: ClientInvoiceItem }) {
  const cfg = INV_CONFIG[inv.status] ?? INV_CONFIG.unpaid;
  const StatusIcon = cfg.icon;
  const isUnpaid = inv.status !== "paid" && inv.status !== "cancelled";

  return (
    <div className={cn(
      "rounded-xl border bg-card p-5",
      inv.status === "overdue" ? "border-c-emergency" : "border-border"
    )}>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="text-sm font-semibold text-foreground">{inv.invoiceNumber}</p>
          <p className="text-xs text-muted-foreground">{inv.serviceType || "—"}</p>
        </div>
        <div className={cn("flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded", cfg.color, cfg.bg)}>
          <StatusIcon className="h-3 w-3" />
          {cfg.label}
        </div>
      </div>

      <div className="flex items-end justify-between gap-4">
        <div className="space-y-1 text-xs text-muted-foreground">
          <p>Issued: {inv.issued}</p>
          <p>Due: {inv.due}</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-semibold text-foreground tabular-nums">${inv.total.toLocaleString()}</p>
          {isUnpaid && (
            <div className="flex flex-col items-end gap-1 mt-2">
              <button
                disabled
                className={cn(buttonVariants({ size: "sm" }), "gap-1.5 opacity-50 cursor-not-allowed pointer-events-none")}
              >
                <Send className="h-3 w-3" /> Pay Now
              </button>
              <p className="text-[10px] text-muted-foreground">Online payment coming soon</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default async function ClientInvoicesPage() {
  // getClientInvoices() is RLS-filtered — no client_id filter needed here
  const invoices = await getClientInvoices();

  const totalPaid   = invoices.filter(i => i.status === "paid").reduce((s, i)  => s + i.total, 0);
  const totalUnpaid = invoices.filter(i => i.status !== "paid").reduce((s, i) => s + i.total, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Invoices</h1>
        <p className="text-sm text-muted-foreground mt-1">{invoices.length} invoice{invoices.length !== 1 ? "s" : ""}</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card px-5 py-4">
          <p className="text-xs text-muted-foreground mb-1">Total paid</p>
          <p className="text-xl font-semibold text-c-success tabular-nums">${totalPaid.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-c-warning bg-card px-5 py-4">
          <p className="text-xs text-muted-foreground mb-1">Outstanding</p>
          <p className="text-xl font-semibold text-c-warning tabular-nums">${totalUnpaid.toLocaleString()}</p>
        </div>
      </div>

      {/* Invoice list */}
      {invoices.length === 0 ? (
        <p className="text-sm text-muted-foreground py-12 text-center rounded-xl border border-dashed border-border">
          No invoices on record for your account.
        </p>
      ) : (
        <div className="space-y-3">
          {invoices.map(inv => <InvoiceCard key={inv.id} inv={inv} />)}
        </div>
      )}
    </div>
  );
}

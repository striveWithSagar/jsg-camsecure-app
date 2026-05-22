import { MOCK_INVOICES } from "@/lib/constants";
import { buttonVariants } from "@/components/ui/button";
import { Send, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export const metadata = { title: "Invoices · Metro Security Ltd" };

const CLIENT_NAME = "Metro Security Ltd";

const INV_CONFIG: Record<string, { icon: React.ElementType; label: string; color: string; bg: string }> = {
  paid:    { icon: CheckCircle2,  label: "Paid",    color: "text-c-success", bg: "bg-c-success" },
  unpaid:  { icon: Clock,         label: "Unpaid",  color: "text-c-info",    bg: "bg-c-info" },
  overdue: { icon: AlertTriangle, label: "Overdue", color: "text-c-emergency", bg: "bg-c-emergency" },
};

export default function ClientInvoicesPage() {
  const invoices = MOCK_INVOICES.filter(i => i.client === CLIENT_NAME);
  const totalPaid   = invoices.filter(i => i.status === "paid").reduce((s, i) => s + i.amount, 0);
  const totalUnpaid = invoices.filter(i => i.status !== "paid").reduce((s, i) => s + i.amount, 0);

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
        <p className="text-sm text-muted-foreground py-12 text-center">No invoices on record.</p>
      ) : (
        <div className="space-y-3">
          {invoices.map(inv => {
            const cfg = INV_CONFIG[inv.status];
            const StatusIcon = cfg.icon;
            return (
              <div key={inv.id} className={cn(
                "rounded-xl border bg-card p-5",
                inv.status === "overdue" ? "border-c-emergency" : "border-border"
              )}>
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{inv.id}</p>
                    <p className="text-xs text-muted-foreground">Job {inv.job}</p>
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
                    <p className="text-xl font-semibold text-foreground tabular-nums">${inv.amount.toLocaleString()}</p>
                    {inv.status !== "paid" && (
                      <Link href="#" className={cn(buttonVariants({ size: "sm" }), "mt-2 gap-1.5")}>
                        <Send className="h-3 w-3" /> Pay Now
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}

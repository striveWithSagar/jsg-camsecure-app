import type { Metadata } from "next";
import type { ClientInvoiceItem } from "@/lib/data/client-portal";
import { getClientInvoices } from "@/lib/data/client-portal";
import { Send, CheckCircle2, Clock, AlertTriangle, FileX, FileText } from "lucide-react";

export const metadata: Metadata = { title: "Invoices · JSG CamSecure Client Portal" };

const INV_CONFIG: Record<string, { icon: React.ElementType; label: string; color: string; bg: string; accent: string }> = {
  paid:      { icon: CheckCircle2,  label: "Paid",      color: "oklch(0.72 0.135 155)", bg: "oklch(0.63 0.165 155 / 0.15)", accent: "oklch(0.63 0.165 155)" },
  unpaid:    { icon: Clock,         label: "Unpaid",    color: "var(--cp-cyan-text)",    bg: "var(--cp-cyan-dim)",           accent: "var(--cp-cyan)" },
  overdue:   { icon: AlertTriangle, label: "Overdue",   color: "oklch(0.78 0.180 27)",   bg: "oklch(0.63 0.240 27 / 0.15)", accent: "oklch(0.62 0.240 27)" },
  draft:     { icon: FileX,         label: "Draft",     color: "oklch(0.55 0.016 252)",  bg: "oklch(0.20 0.018 252)",       accent: "oklch(0.40 0.020 252)" },
  cancelled: { icon: FileX,         label: "Cancelled", color: "oklch(0.55 0.016 252)",  bg: "oklch(0.20 0.018 252)",       accent: "oklch(0.40 0.020 252)" },
};

function InvoiceCard({ inv }: { inv: ClientInvoiceItem }) {
  const cfg = INV_CONFIG[inv.status] ?? INV_CONFIG.unpaid;
  const StatusIcon = cfg.icon;
  const isUnpaid = inv.status !== "paid" && inv.status !== "cancelled";

  return (
    <div
      className="rounded-xl border bg-card overflow-hidden"
      style={{ borderColor: inv.status === "overdue" ? "oklch(0.62 0.240 27 / 0.50)" : "var(--cp-orange-border)" }}
    >
      {/* Top accent bar */}
      <div className="h-0.5 w-full" style={{ background: cfg.accent }} />

      <div className="p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <p
              className="cp-heading text-lg"
              style={{ color: "var(--cp-orange-text)" }}
            >
              {inv.invoiceNumber}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{inv.serviceType || "—"}</p>
          </div>
          <div
            className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ color: cfg.color, background: cfg.bg }}
          >
            <StatusIcon className="h-3 w-3" />
            {cfg.label}
          </div>
        </div>

        <div className="flex items-end justify-between gap-4">
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>Issued: <span className="text-foreground font-medium">{inv.issued}</span></p>
            <p>Due: <span className="text-foreground font-medium">{inv.due}</span></p>
          </div>
          <div className="text-right">
            <p
              className="cp-heading text-2xl tabular-nums"
              style={{ color: cfg.color }}
            >
              ${inv.total.toLocaleString()}
            </p>
            {isUnpaid && (
              <div className="flex flex-col items-end gap-1 mt-2">
                <button
                  disabled
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-semibold opacity-40 cursor-not-allowed"
                  style={{ background: "var(--cp-orange)", color: "var(--primary-foreground)" }}
                >
                  <Send className="h-3 w-3" /> Pay Now
                </button>
                <p className="text-[10px] text-muted-foreground">Online payment coming soon</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function ClientInvoicesPage() {
  const invoices = await getClientInvoices();

  const totalPaid   = invoices.filter(i => i.status === "paid").reduce((s, i) => s + i.total, 0);
  const totalUnpaid = invoices.filter(i => i.status !== "paid" && i.status !== "cancelled").reduce((s, i) => s + i.total, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="cp-heading text-3xl" style={{ color: "var(--cp-orange-text)" }}>
          Invoices
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {invoices.length} invoice{invoices.length !== 1 ? "s" : ""} on record
        </p>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 gap-4">
        <div className="cp-card-cyan rounded-xl border border-border bg-card px-5 py-4">
          <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Total Paid</p>
          <p
            className="cp-heading text-2xl tabular-nums"
            style={{ color: "oklch(0.72 0.135 155)" }}
          >
            ${totalPaid.toLocaleString()}
          </p>
        </div>
        <div className="cp-card-orange rounded-xl border border-border bg-card px-5 py-4">
          <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Outstanding</p>
          <p
            className="cp-heading text-2xl tabular-nums"
            style={{ color: totalUnpaid > 0 ? "var(--cp-orange-text)" : "oklch(0.72 0.135 155)" }}
          >
            ${totalUnpaid.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Invoice list */}
      {invoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-16 rounded-xl border border-dashed border-border text-center">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full"
            style={{ background: "var(--cp-orange-dim)" }}
          >
            <FileText className="h-7 w-7" style={{ color: "var(--cp-orange-text)" }} />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">No invoices yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Invoices will appear here once a job is completed.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {invoices.map(inv => <InvoiceCard key={inv.id} inv={inv} />)}
        </div>
      )}
    </div>
  );
}

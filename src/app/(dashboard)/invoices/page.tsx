import { getInvoiceList } from "@/lib/data/invoices";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Plus, Send, DollarSign } from "lucide-react";

const INV_STATUS_STYLE: Record<string, string> = {
  paid:      "text-c-success bg-c-success border-c-success",
  unpaid:    "text-c-info bg-c-info border-c-info",
  overdue:   "text-c-emergency bg-c-emergency border-c-emergency",
  draft:     "text-muted-foreground bg-muted/30 border-border",
  cancelled: "text-muted-foreground bg-muted/30 border-border",
};

export default async function InvoicesPage() {
  const { invoices, summary } = await getInvoiceList();

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Invoices & Payments" subtitle={`${summary.totalCount} invoice${summary.totalCount !== 1 ? "s" : ""}`} />

      <div className="flex-1 px-6 py-6 space-y-5">

        {/* Summary strip */}
        <div className="flex items-stretch gap-4 flex-wrap">
          {[
            { label: "Unpaid",  amount: summary.unpaidAmount,  cls: "text-c-info",      count: summary.unpaidCount },
            { label: "Overdue", amount: summary.overdueAmount, cls: "text-c-emergency", count: summary.overdueCount },
            { label: "Paid",    amount: summary.paidAmount,    cls: "text-c-success",   count: summary.paidCount },
          ].map(({ label, amount, cls, count }) => (
            <div key={label} className="rounded-lg border border-border bg-card px-5 py-4 flex items-center gap-4 min-w-[160px]">
              <DollarSign className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <p className={cn("text-xl font-semibold", cls)}>${amount.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{count} {label.toLowerCase()}</p>
              </div>
            </div>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" className="gap-1.5 h-8 text-xs" disabled>
              <Plus className="h-3.5 w-3.5" /> Create Invoice
            </Button>
            <span className="text-xs text-muted-foreground">Coming soon</span>
          </div>
        </div>

        {/* Table */}
        {invoices.length === 0 ? (
          <div className="rounded-lg border border-border bg-card py-16 text-center">
            <p className="text-sm text-muted-foreground">No invoices found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Invoice</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Client</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-medium uppercase tracking-wide hidden md:table-cell">Job</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Amount</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Status</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-medium uppercase tracking-wide hidden sm:table-cell">Issued</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-medium uppercase tracking-wide hidden sm:table-cell">Due</TableHead>
                  <TableHead className="w-28" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map(inv => (
                  <TableRow key={inv.id} className="border-border hover:bg-muted/20">
                    <TableCell className="font-mono text-xs text-muted-foreground">{inv.number}</TableCell>
                    <TableCell className="text-sm font-medium text-foreground">{inv.client}</TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{inv.jobLabel}</TableCell>
                    <TableCell className="text-sm font-semibold text-foreground">${inv.total.toLocaleString()}</TableCell>
                    <TableCell>
                      <span className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border",
                        INV_STATUS_STYLE[inv.status] ?? INV_STATUS_STYLE.draft
                      )}>
                        {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                      </span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">{inv.issued}</TableCell>
                    <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">{inv.due}</TableCell>
                    <TableCell>
                      {inv.status !== "paid" && inv.status !== "cancelled" && (
                        <div className="flex flex-col items-start gap-0.5">
                          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground" disabled>
                            <Send className="h-3 w-3" /> Send Link
                          </Button>
                          <p className="text-[10px] text-muted-foreground pl-1">Coming soon</p>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

      </div>
    </div>
  );
}

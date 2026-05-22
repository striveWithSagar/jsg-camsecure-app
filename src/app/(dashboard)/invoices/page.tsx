import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { MOCK_INVOICES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Plus, Send, DollarSign } from "lucide-react";

const INV_STATUS_STYLE: Record<string, string> = {
  paid:    "text-c-success bg-c-success border-c-success",
  unpaid:  "text-c-info bg-c-info border-c-info",
  overdue: "text-c-emergency bg-c-emergency border-c-emergency",
};

export default function InvoicesPage() {
  const totals = {
    paid: MOCK_INVOICES.filter(i => i.status === "paid").reduce((s, i) => s + i.amount, 0),
    unpaid: MOCK_INVOICES.filter(i => i.status === "unpaid").reduce((s, i) => s + i.amount, 0),
    overdue: MOCK_INVOICES.filter(i => i.status === "overdue").reduce((s, i) => s + i.amount, 0),
  };

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Invoices & Payments" subtitle={`${MOCK_INVOICES.length} invoices`} />

      <div className="flex-1 px-6 py-6 space-y-5">

        {/* Summary strip */}
        <div className="flex items-stretch gap-4 flex-wrap">
          {[
            { label: "Unpaid",  amount: totals.unpaid,  cls: "text-c-info",      count: MOCK_INVOICES.filter(i => i.status === "unpaid").length },
            { label: "Overdue", amount: totals.overdue, cls: "text-c-emergency", count: MOCK_INVOICES.filter(i => i.status === "overdue").length },
            { label: "Paid",    amount: totals.paid,    cls: "text-c-success",   count: MOCK_INVOICES.filter(i => i.status === "paid").length },
          ].map(({ label, amount, cls, count }) => (
            <div key={label} className="rounded-lg border border-border bg-card px-5 py-4 flex items-center gap-4 min-w-[160px]">
              <DollarSign className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <p className={cn("text-xl font-semibold", cls)}>${amount.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{count} {label.toLowerCase()}</p>
              </div>
            </div>
          ))}
          <div className="ml-auto flex items-center">
            <Button size="sm" className="gap-1.5 h-8 text-xs">
              <Plus className="h-3.5 w-3.5" /> Create Invoice
            </Button>
          </div>
        </div>

        {/* Table */}
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
              {MOCK_INVOICES.map(inv => (
                <TableRow key={inv.id} className="border-border hover:bg-muted/20">
                  <TableCell className="font-mono text-xs text-muted-foreground">{inv.id}</TableCell>
                  <TableCell className="text-sm font-medium text-foreground">{inv.client}</TableCell>
                  <TableCell className="hidden md:table-cell font-mono text-xs text-muted-foreground">{inv.job}</TableCell>
                  <TableCell className="text-sm font-semibold text-foreground">${inv.amount.toLocaleString()}</TableCell>
                  <TableCell>
                    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border", INV_STATUS_STYLE[inv.status])}>
                      {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                    </span>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">{inv.issued}</TableCell>
                  <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">{inv.due}</TableCell>
                  <TableCell>
                    {inv.status !== "paid" && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground">
                        <Send className="h-3 w-3" /> Send Link
                      </Button>
                    )}
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

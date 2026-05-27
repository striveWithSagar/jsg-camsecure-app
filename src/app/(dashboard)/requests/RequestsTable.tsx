"use client";

import { useRouter } from "next/navigation";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { PriorityBadge } from "@/components/shared/StatusBadge";
import { REQUEST_STATUS_LABELS } from "@/lib/constants";
import { cn, fmtReqNumber } from "@/lib/utils";
import { ArrowRight } from "lucide-react";

const REQUEST_STATUS_STYLE: Record<string, string> = {
  new:               "text-primary bg-primary/10 border-primary/20",
  reviewing:         "text-c-teal bg-c-teal border-c-teal",
  ready_to_schedule: "text-c-amber bg-c-amber border-c-amber",
  converted:         "text-c-success bg-c-success border-c-success",
  cancelled:         "text-muted-foreground bg-muted/40 border-border",
};

export type RequestRow = {
  id:            string;
  requestNumber: number | null;
  client:        string;
  phone:         string;
  type:          string;
  description:   string;
  urgency:       string;
  status:        string;
  created:       string;
};

export function RequestsTable({ requests }: { requests: RequestRow[] }) {
  const router = useRouter();

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className="text-xs text-muted-foreground font-medium uppercase tracking-wide w-32">ID</TableHead>
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
          {requests.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="py-12 text-center">
                <p className="text-sm text-muted-foreground">No service requests found.</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  If you expect data here, confirm you are signed in as admin — RLS requires an authenticated session.
                </p>
              </TableCell>
            </TableRow>
          ) : (
            requests.map(req => (
              <TableRow
                key={req.id}
                className="border-border hover:bg-muted/20 cursor-pointer"
                onClick={() => router.push(`/requests/${req.id}`)}
              >
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {fmtReqNumber(req.requestNumber)}
                </TableCell>
                <TableCell>
                  <div>
                    <p className="text-sm font-medium text-foreground">{req.client}</p>
                    <p className="text-xs text-muted-foreground">{req.phone}</p>
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{req.type}</TableCell>
                <TableCell className="hidden lg:table-cell text-xs text-muted-foreground max-w-xs truncate">{req.description}</TableCell>
                <TableCell><PriorityBadge value={req.urgency} /></TableCell>
                <TableCell>
                  <span className={cn(
                    "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border",
                    REQUEST_STATUS_STYLE[req.status]
                  )}>
                    {REQUEST_STATUS_LABELS[req.status as keyof typeof REQUEST_STATUS_LABELS] ?? req.status}
                  </span>
                </TableCell>
                <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">{req.created}</TableCell>
                <TableCell>
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground">
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

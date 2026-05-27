import { getServiceRequests } from "@/lib/data/service-requests";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";
import Link from "next/link";
import { RequestsTable, type RequestRow } from "./RequestsTable";

const SERVICE_TYPE_LABELS: Record<string, string> = {
  new_installation:  "New Installation",
  maintenance:       "Maintenance",
  dvr_nvr_issue:     "DVR/NVR Issue",
  camera_outage:     "Camera Outage",
  mobile_app_issue:  "Mobile App Issue",
  wiring_issue:      "Wiring Issue",
  emergency_service: "Emergency Service",
  quote_request:     "Quote Request",
  site_inspection:   "Site Inspection",
  other:             "Other",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function RequestsPage() {
  const raw = await getServiceRequests();

  const requests: RequestRow[] = raw.map(r => ({
    id:            r.id,
    requestNumber: r.request_number ?? null,
    client:        r.client_name,
    phone:         r.client_phone,
    type:          SERVICE_TYPE_LABELS[r.service_type] ?? r.service_type,
    description:   r.description,
    urgency:       r.urgency,
    status:        r.status,
    created:       formatDate(r.created_at),
  }));

  const counts = {
    all:       requests.length,
    new:       requests.filter(r => r.status === "new").length,
    reviewing: requests.filter(r => r.status === "reviewing").length,
    ready:     requests.filter(r => r.status === "ready_to_schedule").length,
    converted: requests.filter(r => r.status === "converted").length,
  };

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar
        title="Service Requests"
        subtitle={`${counts.all} total · ${counts.new} new`}
      />

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

        <RequestsTable requests={requests} />

      </div>
    </div>
  );
}

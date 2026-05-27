import { getServiceRequestById } from "@/lib/data/service-requests";
import { TopBar } from "@/components/layout/TopBar";
import { RequestDetail, type RequestDetailData } from "@/components/requests/RequestDetail";
import { fmtReqNumber } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

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

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const raw = await getServiceRequestById(id);

  const request: RequestDetailData | null = raw ? {
    id:            raw.id,
    client:        raw.client_name,
    phone:         raw.client_phone,
    type:          SERVICE_TYPE_LABELS[raw.service_type] ?? raw.service_type,
    urgency:       raw.urgency,
    status:        raw.status,
    description:   raw.description,
    notes:         raw.notes,
    created:       formatDate(raw.created_at),
    requestNumber: raw.request_number ?? null,
  } : null;

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar
        title={request ? `Request ${fmtReqNumber(raw?.request_number)}` : "Request Not Found"}
        subtitle={request ? `${request.client} · ${request.type}` : ""}
      />
      <div className="flex-1 px-6 py-6 max-w-4xl">
        <Link
          href="/requests"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="h-3 w-3" /> Back to Requests
        </Link>
        <RequestDetail requestId={id} request={request} />
      </div>
    </div>
  );
}

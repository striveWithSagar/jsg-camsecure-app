import { notFound } from "next/navigation";
import Link from "next/link";
import { getServiceRequestById } from "@/lib/data/service-requests";
import { getClients } from "@/lib/data/clients";
import { getTechnicians } from "@/lib/data/technicians";
import { createClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/layout/TopBar";
import { ConvertJobForm, type ConvertRequestData } from "@/components/requests/ConvertJobForm";
import { fmtJobNumber } from "@/lib/utils";

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

export default async function ConvertRequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const [raw, clients, technicians] = await Promise.all([
    getServiceRequestById(id),
    getClients(),
    getTechnicians(),
  ]);

  if (!raw) notFound();

  if (raw.status === "converted") {
    let convertedJobNumber: number | null = null;
    if (raw.converted_to_job_id) {
      const { data: jobData } = await supabase
        .from("jobs")
        .select("job_number")
        .eq("id", raw.converted_to_job_id)
        .single();
      convertedJobNumber = jobData?.job_number ?? null;
    }
    return (
      <div className="flex flex-col min-h-screen">
        <TopBar title="Convert to Job" subtitle="" />
        <div className="flex-1 px-6 py-6 max-w-2xl">
          <div className="rounded-lg border border-border bg-muted/10 p-6 space-y-4">
            <div>
              <p className="text-sm font-semibold text-foreground">Already converted</p>
              <p className="text-sm text-muted-foreground mt-1">
                This request has already been converted to{" "}
                <span className="font-mono font-semibold text-foreground">
                  {fmtJobNumber(convertedJobNumber)}
                </span>.
              </p>
            </div>
            <div className="flex items-center gap-3">
              {raw.converted_to_job_id && (
                <Link
                  href={`/jobs/${raw.converted_to_job_id}`}
                  className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
                >
                  View Job
                </Link>
              )}
              <Link
                href={`/requests/${id}`}
                className="inline-flex h-9 items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Back to Request
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Resolve site address: prefer the request's own site_address, then fall back
  // to the linked client account's address. Old requests created before the
  // site_address column existed (Phase 10S-A) will have an empty string here.
  const linkedClient     = raw.client_id ? clients.find(c => c.id === raw.client_id) : undefined;
  const requestAddress   = (raw.site_address ?? "").trim();
  const clientAddress    = (linkedClient?.address ?? "").trim();
  const resolvedAddress  = requestAddress || clientAddress;
  const addressSource: "request" | "client" | "none" =
    requestAddress ? "request" :
    clientAddress  ? "client"  : "none";

  const request: ConvertRequestData = {
    id:            raw.id,
    client:        raw.client_name,
    type:          SERVICE_TYPE_LABELS[raw.service_type] ?? raw.service_type,
    serviceTypeDb: raw.service_type,
    urgency:       raw.urgency,
    description:   raw.description,
    requestNumber: raw.request_number ?? null,
    clientId:      raw.client_id ?? null,
    clientName:    linkedClient?.name ?? null,
    siteAddress:   resolvedAddress,
    addressSource,
    preferredAt:   raw.preferred_at ?? null,
  };

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar
        title="Convert to Job"
        subtitle={`${request.client} · ${request.type}`}
      />
      <div className="flex-1 px-6 py-6 max-w-2xl">
        <ConvertJobForm
          requestId={id}
          request={request}
          clients={clients}
          technicians={technicians}
        />
      </div>
    </div>
  );
}

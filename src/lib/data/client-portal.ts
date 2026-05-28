import { createClient } from "@/lib/supabase/server";

export type ClientJobItem = {
  id:        string;
  jobNumber: number | null;
  site:      string;
  type:      string;
  priority:  string;
  status:    string;
  scheduled: string;
  address:   string;
};

export type ClientInvoiceItem = {
  id:            string;
  invoiceNumber: string;
  status:        string;
  total:         number;
  due:           string;
  issued:        string;
  serviceType:   string;
};

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

const STATUS_ORDER = [
  "in_progress", "started", "on_the_way", "assigned",
  "needs_parts", "rescheduled", "completed", "cancelled",
];

function formatScheduled(iso: string | null): string {
  if (!iso) return "—";
  const d   = new Date(iso);
  const now = new Date();
  const hhmm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  if (d.toDateString() === now.toDateString()) return `Today ${hhmm}`;
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow ${hhmm}`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

type JobRawRow = {
  id:           string;
  job_number:   number | null;
  service_type: string;
  priority:     string;
  status:       string;
  site_name:    string | null;
  address:      string | null;
  scheduled_at: string | null;
};

type JobEmbed = { service_type: string } | { service_type: string }[] | null;

type InvoiceRawRow = {
  id:             string;
  invoice_number: string;
  status:         string;
  total:          number;
  issued_at:      string | null;
  due_at:         string | null;
  jobs:           JobEmbed;
};

function extractJobServiceType(j: JobEmbed): string {
  if (!j) return "";
  const raw = Array.isArray(j) ? (j[0]?.service_type ?? "") : (j.service_type ?? "");
  return SERVICE_TYPE_LABELS[raw] ?? raw;
}

// No client_id filter — RLS enforces client_id = auth_client_id() for role 'client'
export async function getClientJobs(): Promise<ClientJobItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("jobs")
    .select("id, job_number, service_type, priority, status, site_name, address, scheduled_at")
    .order("scheduled_at", { ascending: true, nullsFirst: false });

  if (error) {
    console.error("[getClientJobs]", error.message);
    return [];
  }

  return ((data ?? []) as unknown as JobRawRow[])
    .map(row => ({
      id:        row.id,
      jobNumber: row.job_number ?? null,
      site:      row.site_name ?? "—",
      type:      SERVICE_TYPE_LABELS[row.service_type] ?? row.service_type,
      priority:  row.priority,
      status:    row.status,
      scheduled: formatScheduled(row.scheduled_at),
      address:   row.address ?? "—",
    }))
    .sort((a, b) => {
      const ai = STATUS_ORDER.indexOf(a.status);
      const bi = STATUS_ORDER.indexOf(b.status);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
}

export type ClientRequestItem = {
  id:          string;
  reqNumber:   number | null;
  serviceType: string;   // display label
  urgency:     string;   // raw enum: emergency|high|medium|low
  status:      string;   // raw enum
  description: string;
  createdAt:   string;   // raw ISO
  updatedAt:   string;   // raw ISO
  isTerminal:  boolean;  // true for converted or cancelled
  hasJob:      boolean;  // true when converted_to_job_id is set
};

type RequestRawRow = {
  id:                  string;
  request_number:      number | null;
  service_type:        string;
  urgency:             string;
  status:              string;
  description:         string;
  created_at:          string;
  updated_at:          string;
  converted_to_job_id: string | null;
};

// No client_id filter — RLS enforces client_id = auth_client_id() for role 'client'
export async function getClientRequests(): Promise<ClientRequestItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("service_requests")
    .select("id, request_number, service_type, urgency, status, description, created_at, updated_at, converted_to_job_id")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getClientRequests]", error.message);
    return [];
  }

  return ((data ?? []) as unknown as RequestRawRow[]).map(row => ({
    id:          row.id,
    reqNumber:   row.request_number ?? null,
    serviceType: SERVICE_TYPE_LABELS[row.service_type] ?? row.service_type,
    urgency:     row.urgency,
    status:      row.status,
    description: row.description,
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
    isTerminal:  row.status === "converted" || row.status === "cancelled",
    hasJob:      !!row.converted_to_job_id,
  }));
}

export type ClientRequestDetail = {
  id:          string;
  reqNumber:   number | null;
  serviceType: string;
  urgency:     string;
  status:      string;
  description: string;
  createdAt:   string;
  updatedAt:   string;
  isTerminal:  boolean;
  linkedJob: {
    jobNumber:   number | null;
    status:      string;
    site:        string;
    scheduledAt: string | null;
    completedAt: string | null;
  } | null;
};

type RawJobEmbed = {
  job_number:   number | null;
  status:       string;
  site_name:    string | null;
  scheduled_at: string | null;
  completed_at: string | null;
} | null;

type RequestDetailRawRow = {
  id:                  string;
  request_number:      number | null;
  service_type:        string;
  urgency:             string;
  status:              string;
  description:         string;
  created_at:          string;
  updated_at:          string;
  converted_to_job_id: string | null;
  jobs:                RawJobEmbed;
};

// No client_id filter — RLS enforces client_id = auth_client_id() for role 'client'
// Returns null if RLS blocks the row (other client, walk-in) or row does not exist
export async function getClientRequestById(id: string): Promise<ClientRequestDetail | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("service_requests")
    .select(
      "id, request_number, service_type, urgency, status, description, " +
      "created_at, updated_at, converted_to_job_id, " +
      "jobs!converted_to_job_id(job_number, status, site_name, scheduled_at, completed_at)"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) { console.error("[getClientRequestById]", error.message); return null; }
  if (!data)  return null;

  const row = data as unknown as RequestDetailRawRow;
  const j   = Array.isArray(row.jobs) ? (row.jobs[0] ?? null) : row.jobs;

  return {
    id:          row.id,
    reqNumber:   row.request_number ?? null,
    serviceType: SERVICE_TYPE_LABELS[row.service_type] ?? row.service_type,
    urgency:     row.urgency,
    status:      row.status,
    description: row.description,
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
    isTerminal:  row.status === "converted" || row.status === "cancelled",
    linkedJob:   j ? {
      jobNumber:   j.job_number ?? null,
      status:      j.status,
      site:        j.site_name ?? "—",
      scheduledAt: j.scheduled_at ?? null,
      completedAt: j.completed_at ?? null,
    } : null,
  };
}

// No client_id filter — RLS enforces client_id = auth_client_id() for role 'client'
export async function getClientInvoices(): Promise<ClientInvoiceItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("invoices")
    .select("id, invoice_number, status, total, issued_at, due_at, jobs(service_type)")
    .order("issued_at", { ascending: false });

  if (error) {
    console.error("[getClientInvoices]", error.message);
    return [];
  }

  return ((data ?? []) as unknown as InvoiceRawRow[]).map(row => ({
    id:            row.id,
    invoiceNumber: row.invoice_number,
    status:        row.status,
    total:         Number(row.total),
    due:           formatDate(row.due_at),
    issued:        formatDate(row.issued_at),
    serviceType:   extractJobServiceType(row.jobs),
  }));
}

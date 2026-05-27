import { createClient } from "@/lib/supabase/server";

export type JobDetailData = {
  id:              string;
  jobNumber:       number | null;
  organizationId:  string;
  client:          string;
  site:            string;
  address:         string;
  type:            string;
  priority:        string;
  status:          string;
  technicianId:    string | null;
  technician:      string;
  scheduled:       string;
  dispatcherNotes: string;
  technicianNotes: string;
  requestId:       string | null;
  requestNumber:   number | null;
  notes: {
    id:        string;
    body:      string;
    createdAt: string;
    author:    string;
  }[];
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

export type JobRow = {
  id:         string;
  jobNumber:  number | null;
  client:     string;
  site:       string;
  type:       string;
  priority:   string;
  status:     string;
  technician: string;
  scheduled:  string;
};

function formatScheduled(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  const hhmm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  if (d.toDateString() === now.toDateString()) return `Today ${hhmm}`;
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow ${hhmm}`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export async function getJobs(): Promise<JobRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("jobs")
    .select("id, job_number, service_type, priority, status, site_name, scheduled_at, clients(name), technicians(profiles(full_name))")
    .order("scheduled_at", { ascending: true, nullsFirst: false });

  if (error) {
    console.error("[getJobs]", error.message);
    return [];
  }

  type ProfileEmbed = { full_name: string } | { full_name: string }[] | null;
  type TechEmbed    = { profiles: ProfileEmbed } | { profiles: ProfileEmbed }[] | null;
  type ClientEmbed  = { name: string } | { name: string }[] | null;
  type RawRow = {
    id:           string;
    job_number:   number | null;
    service_type: string;
    priority:     string;
    status:       string;
    site_name:    string | null;
    scheduled_at: string | null;
    clients:      ClientEmbed;
    technicians:  TechEmbed;
  };

  function extractClientName(c: ClientEmbed): string {
    if (!c) return "Unknown Client";
    if (Array.isArray(c)) return c[0]?.name ?? "Unknown Client";
    return c.name ?? "Unknown Client";
  }

  function extractTechName(t: TechEmbed): string {
    if (!t) return "Unassigned";
    const profiles = Array.isArray(t)
      ? t[0]?.profiles
      : (t as { profiles: ProfileEmbed }).profiles;
    if (!profiles) return "Unassigned";
    if (Array.isArray(profiles)) return profiles[0]?.full_name ?? "Unassigned";
    return profiles.full_name ?? "Unassigned";
  }

  return ((data ?? []) as unknown as RawRow[]).map(row => ({
    id:         row.id,
    jobNumber:  row.job_number ?? null,
    client:     extractClientName(row.clients),
    site:       row.site_name ?? "—",
    type:       SERVICE_TYPE_LABELS[row.service_type] ?? row.service_type,
    priority:   row.priority,
    status:     row.status,
    technician: extractTechName(row.technicians),
    scheduled:  formatScheduled(row.scheduled_at),
  }));
}

export async function getJobById(id: string): Promise<JobDetailData | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("jobs")
    .select(`
      id, organization_id, service_type, priority, status,
      site_name, address, scheduled_at,
      dispatcher_notes, technician_notes,
      request_id, technician_id, job_number,
      clients(name),
      technicians(profiles(full_name)),
      job_notes(id, body, created_at, profiles!author_profile_id(full_name)),
      service_requests!request_id(request_number)
    `)
    .eq("id", id)
    .single();

  if (error || !data) {
    if (error && error.code !== "PGRST116") {
      console.error("[getJobById]", error.message);
    }
    return null;
  }

  type ProfileEmbed   = { full_name: string } | { full_name: string }[] | null;
  type TechEmbed      = { profiles: ProfileEmbed } | { profiles: ProfileEmbed }[] | null;
  type ClientEmbed    = { name: string } | { name: string }[] | null;
  type NoteEmbed      = { full_name: string } | { full_name: string }[] | null;
  type ReqEmbed       = { request_number: number } | { request_number: number }[] | null;
  type RawNote = {
    id:         string;
    body:       string;
    created_at: string;
    profiles:   NoteEmbed;
  };
  type RawDetail = {
    id:               string;
    job_number:       number | null;
    organization_id:  string;
    service_type:     string;
    priority:         string;
    status:           string;
    site_name:        string | null;
    address:          string | null;
    scheduled_at:     string | null;
    dispatcher_notes: string;
    technician_notes: string;
    request_id:       string | null;
    technician_id:    string | null;
    clients:          ClientEmbed;
    technicians:      TechEmbed;
    job_notes:        RawNote[] | null;
    service_requests: ReqEmbed;
  };

  function extractClientName(c: ClientEmbed): string {
    if (!c) return "Unknown Client";
    if (Array.isArray(c)) return c[0]?.name ?? "Unknown Client";
    return c.name ?? "Unknown Client";
  }

  function extractTechName(t: TechEmbed): string {
    if (!t) return "Unassigned";
    const profiles = Array.isArray(t)
      ? t[0]?.profiles
      : (t as { profiles: ProfileEmbed }).profiles;
    if (!profiles) return "Unassigned";
    if (Array.isArray(profiles)) return profiles[0]?.full_name ?? "Unassigned";
    return profiles.full_name ?? "Unassigned";
  }

  function extractNoteName(p: NoteEmbed): string {
    if (!p) return "Unknown";
    if (Array.isArray(p)) return p[0]?.full_name ?? "Unknown";
    return p.full_name ?? "Unknown";
  }

  function extractRequestNumber(r: ReqEmbed): number | null {
    if (!r) return null;
    if (Array.isArray(r)) return r[0]?.request_number ?? null;
    return r.request_number ?? null;
  }

  const row = data as unknown as RawDetail;
  const rawNotes = row.job_notes ?? [];

  return {
    id:              row.id,
    jobNumber:       row.job_number ?? null,
    organizationId:  row.organization_id,
    client:          extractClientName(row.clients),
    site:            row.site_name ?? "—",
    address:         row.address ?? "",
    type:            SERVICE_TYPE_LABELS[row.service_type] ?? row.service_type,
    priority:        row.priority,
    status:          row.status,
    technicianId:    row.technician_id,
    technician:      extractTechName(row.technicians),
    scheduled:       formatScheduled(row.scheduled_at),
    dispatcherNotes: row.dispatcher_notes ?? "",
    technicianNotes: row.technician_notes ?? "",
    requestId:       row.request_id,
    requestNumber:   extractRequestNumber(row.service_requests),
    notes: rawNotes.map(n => ({
      id:        n.id,
      body:      n.body,
      createdAt: n.created_at,
      author:    extractNoteName(n.profiles),
    })),
  };
}

import { createClient } from "@/lib/supabase/server";

export type TechJobItem = {
  id:        string;
  jobNumber: number | null;
  client:    string;
  site:      string;
  type:      string;
  priority:  string;
  status:    string;
  scheduled: string;
  address:   string;
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

// Active statuses ordered by urgency; completed/cancelled sink to the bottom.
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

type ClientEmbed = { name: string } | { name: string }[] | null;
type RawRow = {
  id:           string;
  job_number:   number | null;
  service_type: string;
  priority:     string;
  status:       string;
  site_name:    string | null;
  address:      string | null;
  scheduled_at: string | null;
  clients:      ClientEmbed;
};

function extractClientName(c: ClientEmbed): string {
  if (!c) return "Unknown Client";
  if (Array.isArray(c)) return c[0]?.name ?? "Unknown Client";
  return c.name ?? "Unknown Client";
}

export async function getTechJobList(): Promise<TechJobItem[]> {
  const supabase = await createClient();

  // No technician_id filter — RLS enforces technician_id = auth_technician_id()
  const { data, error } = await supabase
    .from("jobs")
    .select("id, job_number, service_type, priority, status, site_name, address, scheduled_at, clients(name)")
    .order("scheduled_at", { ascending: true, nullsFirst: false });

  if (error) {
    console.error("[getTechJobList]", error.message);
    return [];
  }

  return ((data ?? []) as unknown as RawRow[])
    .map(row => ({
      id:        row.id,
      jobNumber: row.job_number ?? null,
      client:    extractClientName(row.clients),
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
      // STATUS_ORDER defines primary sort; scheduled_at order from DB is preserved within each group
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
}

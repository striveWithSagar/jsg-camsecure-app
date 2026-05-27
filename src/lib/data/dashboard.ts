import { createClient } from "@/lib/supabase/server";

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

const ACTIVE_JOB_STATUSES = new Set(["assigned", "on_the_way", "started", "in_progress"]);

export type DashTodayJob = {
  id:        string;
  jobNumber: number | null;
  time:      string;
  client:    string;
  site:      string;
  techFirst: string;
  priority:  string;
  status:    string;
};

export type DashEmergencyJob = {
  id:     string;
  client: string;
  site:   string;
};

export type DashAttentionJob = {
  id:        string;
  client:    string;
  type:      string;
  techFirst: string;
  status:    string;
};

export type DashCrewMember = {
  id:          string;
  name:        string;
  specialty:   string;
  status:      string;
  currentSite: string | null;
};

export type DashRequest = {
  id:            string;
  requestNumber: number | null;
  client:        string;
  type:          string;
  urgency:       string;
  created:       string;
};

export type DashboardData = {
  todayJobs:          DashTodayJob[];
  emergencyJobs:      DashEmergencyJob[];
  attentionJobs:      DashAttentionJob[];
  crew:               DashCrewMember[];
  newRequests:        DashRequest[];
  completedThisMonth: number;
  upcomingJobCount:   number;
  openRequestCount:   number;
  unpaidInvoiceCount: number;
  monthlyRevenue:     number;
  currentMonth:       string;
  techAvailable:      number;
  techDeployed:       number;
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatCreated(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createClient();

  const now         = new Date();
  const todayStr    = now.toDateString();
  const tomorrowDate = new Date(now);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowStr = tomorrowDate.toDateString();
  const monthStart  = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [jobsResult, requestsResult, techResult, invoicesResult] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, job_number, service_type, priority, status, site_name, scheduled_at, completed_at, technician_id, clients(name), technicians(profiles(full_name))"),
    supabase
      .from("service_requests")
      .select("id, request_number, client_name, service_type, urgency, status, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("technicians")
      .select("id, specialty, status, profiles(full_name)"),
    supabase
      .from("invoices")
      .select("status, total, paid_at"),
  ]);

  // ── Jobs ──────────────────────────────────────────────────────

  type ProfileEmbed = { full_name: string } | { full_name: string }[] | null;
  type TechEmbed    = { profiles: ProfileEmbed } | { profiles: ProfileEmbed }[] | null;
  type ClientEmbed  = { name: string } | { name: string }[] | null;
  type RawJob = {
    id:            string;
    job_number:    number | null;
    service_type:  string;
    priority:      string;
    status:        string;
    site_name:     string | null;
    scheduled_at:  string | null;
    completed_at:  string | null;
    technician_id: string | null;
    clients:       ClientEmbed;
    technicians:   TechEmbed;
  };

  function extractClientName(c: ClientEmbed): string {
    if (!c) return "Unknown Client";
    if (Array.isArray(c)) return c[0]?.name ?? "Unknown Client";
    return c.name ?? "Unknown Client";
  }

  function extractTechName(t: TechEmbed): string {
    if (!t) return "Unassigned";
    const profiles = Array.isArray(t) ? t[0]?.profiles : (t as { profiles: ProfileEmbed }).profiles;
    if (!profiles) return "Unassigned";
    if (Array.isArray(profiles)) return profiles[0]?.full_name ?? "Unassigned";
    return profiles.full_name ?? "Unassigned";
  }

  if (jobsResult.error) console.error("[getDashboardData] jobs:", jobsResult.error.message);
  const rawJobs = (jobsResult.data ?? []) as unknown as RawJob[];

  const techActiveSite: Record<string, string> = {};
  for (const j of rawJobs) {
    if (j.technician_id && ACTIVE_JOB_STATUSES.has(j.status) && j.site_name) {
      techActiveSite[j.technician_id] = j.site_name.split(",")[0];
    }
  }

  const todayJobs: DashTodayJob[] = rawJobs
    .filter(j => j.scheduled_at && new Date(j.scheduled_at).toDateString() === todayStr)
    .sort((a, b) => (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? ""))
    .map(j => ({
      id:        j.id,
      jobNumber: j.job_number ?? null,
      time:      j.scheduled_at ? formatTime(j.scheduled_at) : "—",
      client:    extractClientName(j.clients),
      site:      j.site_name ?? "—",
      techFirst: extractTechName(j.technicians).split(" ")[0],
      priority:  j.priority,
      status:    j.status,
    }));

  const emergencyJobs: DashEmergencyJob[] = rawJobs
    .filter(j => j.priority === "emergency" && j.status !== "completed" && j.status !== "cancelled")
    .map(j => ({ id: j.id, client: extractClientName(j.clients), site: j.site_name ?? "—" }));

  const attentionJobs: DashAttentionJob[] = rawJobs
    .filter(j => j.status === "needs_parts" || j.status === "rescheduled")
    .map(j => ({
      id:        j.id,
      client:    extractClientName(j.clients),
      type:      SERVICE_TYPE_LABELS[j.service_type] ?? j.service_type,
      techFirst: extractTechName(j.technicians).split(" ")[0],
      status:    j.status,
    }));

  const completedThisMonth = rawJobs.filter(j =>
    j.status === "completed" && j.completed_at && j.completed_at >= monthStart
  ).length;

  const upcomingJobCount = rawJobs.filter(j =>
    j.scheduled_at && new Date(j.scheduled_at).toDateString() === tomorrowStr
  ).length;

  // ── Technicians ───────────────────────────────────────────────

  type TechRaw = { id: string; specialty: string | null; status: string; profiles: ProfileEmbed };
  if (techResult.error) console.error("[getDashboardData] technicians:", techResult.error.message);
  const rawTechs = (techResult.data ?? []) as unknown as TechRaw[];

  function extractProfileName(p: ProfileEmbed): string {
    if (!p) return "Unknown";
    if (Array.isArray(p)) return p[0]?.full_name ?? "Unknown";
    return p.full_name ?? "Unknown";
  }

  const crew: DashCrewMember[] = rawTechs
    .map(t => ({
      id:          t.id,
      name:        extractProfileName(t.profiles),
      specialty:   t.specialty ?? "",
      status:      t.status,
      currentSite: techActiveSite[t.id] ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const techAvailable = crew.filter(t => t.status === "available").length;
  const techDeployed  = crew.filter(t => t.status === "on_job" || t.status === "on_the_way").length;

  // ── Service requests ──────────────────────────────────────────

  type RawRequest = {
    id: string; request_number: number | null; client_name: string; service_type: string;
    urgency: string; status: string; created_at: string;
  };
  if (requestsResult.error) console.error("[getDashboardData] requests:", requestsResult.error.message);
  const rawRequests = (requestsResult.data ?? []) as unknown as RawRequest[];

  const newRequests: DashRequest[] = rawRequests
    .filter(r => r.status === "new")
    .map(r => ({
      id:            r.id,
      requestNumber: r.request_number ?? null,
      client:        r.client_name,
      type:          SERVICE_TYPE_LABELS[r.service_type] ?? r.service_type,
      urgency:       r.urgency,
      created:       formatCreated(r.created_at),
    }));

  // ── Invoices ──────────────────────────────────────────────────

  type RawInvoice = { status: string; total: string | number; paid_at: string | null };
  if (invoicesResult.error) console.error("[getDashboardData] invoices:", invoicesResult.error.message);
  const rawInvoices = (invoicesResult.data ?? []) as unknown as RawInvoice[];

  const unpaidInvoiceCount = rawInvoices.filter(i => i.status === "unpaid" || i.status === "overdue").length;
  const monthlyRevenue     = rawInvoices
    .filter(i => i.status === "paid" && i.paid_at && i.paid_at >= monthStart)
    .reduce((sum, i) => sum + (Number(i.total) || 0), 0);

  return {
    todayJobs,
    emergencyJobs,
    attentionJobs,
    crew,
    newRequests,
    completedThisMonth,
    upcomingJobCount,
    openRequestCount: newRequests.length,
    unpaidInvoiceCount,
    monthlyRevenue,
    currentMonth: now.toLocaleString("default", { month: "long" }),
    techAvailable,
    techDeployed,
  };
}

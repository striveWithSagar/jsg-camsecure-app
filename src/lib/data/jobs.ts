import { createClient } from "@/lib/supabase/server";

// ── Shared display types ──────────────────────────────────────────────────────

export type JobRow = {
  id:          string;
  jobNumber:   number | null;
  client:      string;
  site:        string;
  type:        string;
  priority:    string;
  status:      string;
  technician:  string;
  scheduled:   string;        // formatted display string
  scheduledAt: string | null; // raw ISO — used for date math
  completedAt: string | null; // raw ISO
  createdAt:   string;        // raw ISO
  updatedAt:   string;        // raw ISO
};

export type JobDetailData = {
  id:               string;
  jobNumber:        number | null;
  organizationId:   string;
  client:           string;
  site:             string;
  address:          string;
  type:             string;
  priority:         string;
  status:           string;
  technicianId:     string | null;
  technician:       string;
  scheduled:        string;        // formatted display
  scheduledAt:      string | null; // raw ISO
  completedAt:      string | null; // raw ISO
  createdAt:        string;        // raw ISO
  updatedAt:        string;        // raw ISO
  requestCreatedAt: string | null; // raw ISO — from linked service_request
  dispatcherNotes:  string;
  technicianNotes:  string;
  requestId:        string | null;
  requestNumber:    number | null;
  notes: {
    id:        string;
    body:      string;
    createdAt: string;
    author:    string;
  }[];
};

// ── Job Board bucket ─────────────────────────────────────────────────────────

export type JobBucket = {
  dateParam:    string;   // raw URL param: "YYYY-MM-DD" or "week"
  selectedDate: string;   // canonical YYYY-MM-DD (or week-start for week view)
  isWeekView:   boolean;
  active:       JobRow[]; // day view: active jobs on selectedDate
  overdue:      JobRow[]; // always shown: active jobs before selectedDate/weekStart
  done:         JobRow[]; // day view: completed/cancelled on selectedDate (by completed_at)
  unscheduled:  JobRow[]; // always shown: active jobs with null scheduledAt
  weekDays:     { label: string; date: string; jobs: JobRow[] }[]; // week view only
};

// ── Constants ─────────────────────────────────────────────────────────────────

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

const PRIORITY_ORDER = ["emergency", "high", "medium", "low"];
const DONE_CUTOFF_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

// ── Shared raw types ──────────────────────────────────────────────────────────

type ProfileEmbed = { full_name: string } | { full_name: string }[] | null;
type TechEmbed    = { profiles: ProfileEmbed } | { profiles: ProfileEmbed }[] | null;
type ClientEmbed  = { name: string } | { name: string }[] | null;

type RawJobRow = {
  id:           string;
  job_number:   number | null;
  service_type: string;
  priority:     string;
  status:       string;
  site_name:    string | null;
  scheduled_at: string | null;
  completed_at: string | null;
  created_at:   string;
  updated_at:   string;
  clients:      ClientEmbed;
  technicians:  TechEmbed;
};

// ── Shared helper functions ───────────────────────────────────────────────────

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

function mapToJobRow(row: RawJobRow): JobRow {
  return {
    id:          row.id,
    jobNumber:   row.job_number ?? null,
    client:      extractClientName(row.clients),
    site:        row.site_name ?? "—",
    type:        SERVICE_TYPE_LABELS[row.service_type] ?? row.service_type,
    priority:    row.priority,
    status:      row.status,
    technician:  extractTechName(row.technicians),
    scheduled:   formatScheduled(row.scheduled_at),
    scheduledAt: row.scheduled_at ?? null,
    completedAt: row.completed_at ?? null,
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
  };
}

// ── Bucketing helpers ─────────────────────────────────────────────────────────

function getWeekStartStr(): string {
  const now = new Date();
  const dow = now.getUTCDay(); // 0 = Sun
  const toMon = dow === 0 ? -6 : 1 - dow;
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() + toMon);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function buildWeekDays(weekStartStr: string): { label: string; date: string; jobs: JobRow[] }[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStartStr + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + i);
    const date  = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
    return { label, date, jobs: [] };
  });
}

function sortByPriorityThenDate(jobs: JobRow[]): void {
  jobs.sort((a, b) => {
    const pa = PRIORITY_ORDER.indexOf(a.priority);
    const pb = PRIORITY_ORDER.indexOf(b.priority);
    if (pa !== pb) return pa - pb;
    return (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? "");
  });
}

function bucketDay(rows: JobRow[], dateParam: string): JobBucket {
  const active:      JobRow[] = [];
  const overdue:     JobRow[] = [];
  const done:        JobRow[] = [];
  const unscheduled: JobRow[] = [];

  for (const job of rows) {
    const terminal = job.status === "completed" || job.status === "cancelled";

    if (terminal) {
      // Group by completed_at date (D5 requirement); fall back to updated_at for cancelled
      const doneDay = job.completedAt?.slice(0, 10) ?? job.updatedAt.slice(0, 10);
      if (doneDay === dateParam) done.push(job);
    } else {
      if (!job.scheduledAt) {
        unscheduled.push(job);
      } else {
        const scheduledDay = job.scheduledAt.slice(0, 10);
        if (scheduledDay === dateParam)    active.push(job);
        else if (scheduledDay < dateParam) overdue.push(job);
        // Jobs scheduled after dateParam are not shown for this date view
      }
    }
  }

  sortByPriorityThenDate(overdue);

  return {
    dateParam,
    selectedDate: dateParam,
    isWeekView:   false,
    active,
    overdue,
    done,
    unscheduled,
    weekDays: [],
  };
}

function bucketWeek(rows: JobRow[]): JobBucket {
  const weekStartStr = getWeekStartStr();
  const weekDays     = buildWeekDays(weekStartStr);
  const dayMap       = new Map(weekDays.map(d => [d.date, d.jobs]));
  const overdue:     JobRow[] = [];
  const unscheduled: JobRow[] = [];

  for (const job of rows) {
    if (job.status === "completed" || job.status === "cancelled") continue;
    if (!job.scheduledAt) { unscheduled.push(job); continue; }

    const day = job.scheduledAt.slice(0, 10);
    if (day < weekStartStr) {
      overdue.push(job);
    } else if (dayMap.has(day)) {
      dayMap.get(day)!.push(job);
    }
  }

  sortByPriorityThenDate(overdue);

  return {
    dateParam:    "week",
    selectedDate: weekStartStr,
    isWeekView:   true,
    active:       [],
    overdue,
    done:         [],
    unscheduled,
    weekDays,
  };
}

// ── Public data functions ─────────────────────────────────────────────────────

/** Legacy list used by dashboard and any other full-list consumers. */
export async function getJobs(): Promise<JobRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("jobs")
    .select(`
      id, job_number, service_type, priority, status, site_name,
      scheduled_at, completed_at, created_at, updated_at,
      clients(name), technicians(profiles(full_name))
    `)
    .order("scheduled_at", { ascending: true, nullsFirst: false });

  if (error) {
    console.error("[getJobs]", error.message);
    return [];
  }

  return ((data ?? []) as unknown as RawJobRow[]).map(mapToJobRow);
}

/**
 * Single combined query — returns all active jobs + recently closed jobs
 * bucketed for the Job Board date/week view.
 *
 * dateParam: "YYYY-MM-DD" for a single-day view, "week" for this-week view.
 */
export async function getJobBoardData(dateParam: string): Promise<JobBucket> {
  const supabase = await createClient();
  const cutoff   = new Date(Date.now() - DONE_CUTOFF_MS).toISOString();

  const { data, error } = await supabase
    .from("jobs")
    .select(`
      id, job_number, service_type, priority, status, site_name,
      scheduled_at, completed_at, created_at, updated_at,
      clients(name), technicians(profiles(full_name))
    `)
    // All active jobs + completed/cancelled jobs updated in last 90 days (D7)
    .or(
      `status.not.in.(completed,cancelled),` +
      `and(status.in.(completed,cancelled),updated_at.gte.${cutoff})`
    )
    .order("scheduled_at", { ascending: true, nullsFirst: false });

  if (error) {
    console.error("[getJobBoardData]", error.message);
    const empty: JobBucket = {
      dateParam,
      selectedDate: dateParam === "week" ? getWeekStartStr() : dateParam,
      isWeekView:   dateParam === "week",
      active: [], overdue: [], done: [], unscheduled: [],
      weekDays: dateParam === "week" ? buildWeekDays(getWeekStartStr()) : [],
    };
    return empty;
  }

  const rows = ((data ?? []) as unknown as RawJobRow[]).map(mapToJobRow);
  return dateParam === "week" ? bucketWeek(rows) : bucketDay(rows, dateParam);
}

export async function getJobById(id: string): Promise<JobDetailData | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("jobs")
    .select(`
      id, organization_id, service_type, priority, status,
      site_name, address, scheduled_at, completed_at, created_at, updated_at,
      dispatcher_notes, technician_notes,
      request_id, technician_id, job_number,
      clients(name),
      technicians(profiles(full_name)),
      job_notes(id, body, created_at, profiles!author_profile_id(full_name)),
      service_requests!request_id(request_number, created_at)
    `)
    .eq("id", id)
    .single();

  if (error || !data) {
    if (error && error.code !== "PGRST116") {
      console.error("[getJobById]", error.message);
    }
    return null;
  }

  type NoteEmbed  = { full_name: string } | { full_name: string }[] | null;
  type ReqEmbed   = { request_number: number; created_at: string }
                  | { request_number: number; created_at: string }[]
                  | null;
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
    completed_at:     string | null;
    created_at:       string;
    updated_at:       string;
    dispatcher_notes: string;
    technician_notes: string;
    request_id:       string | null;
    technician_id:    string | null;
    clients:          ClientEmbed;
    technicians:      TechEmbed;
    job_notes:        RawNote[] | null;
    service_requests: ReqEmbed;
  };

  function extractNoteName(p: NoteEmbed): string {
    if (!p) return "Unknown";
    if (Array.isArray(p)) return p[0]?.full_name ?? "Unknown";
    return p.full_name ?? "Unknown";
  }

  function extractReqNumber(r: ReqEmbed): number | null {
    if (!r) return null;
    if (Array.isArray(r)) return r[0]?.request_number ?? null;
    return r.request_number ?? null;
  }

  function extractReqCreatedAt(r: ReqEmbed): string | null {
    if (!r) return null;
    if (Array.isArray(r)) return r[0]?.created_at ?? null;
    return r.created_at ?? null;
  }

  const row     = data as unknown as RawDetail;
  const rawNotes = row.job_notes ?? [];

  return {
    id:               row.id,
    jobNumber:        row.job_number ?? null,
    organizationId:   row.organization_id,
    client:           extractClientName(row.clients),
    site:             row.site_name ?? "—",
    address:          row.address ?? "",
    type:             SERVICE_TYPE_LABELS[row.service_type] ?? row.service_type,
    priority:         row.priority,
    status:           row.status,
    technicianId:     row.technician_id,
    technician:       extractTechName(row.technicians),
    scheduled:        formatScheduled(row.scheduled_at),
    scheduledAt:      row.scheduled_at ?? null,
    completedAt:      row.completed_at ?? null,
    createdAt:        row.created_at,
    updatedAt:        row.updated_at,
    requestCreatedAt: extractReqCreatedAt(row.service_requests),
    dispatcherNotes:  row.dispatcher_notes ?? "",
    technicianNotes:  row.technician_notes ?? "",
    requestId:        row.request_id,
    requestNumber:    extractReqNumber(row.service_requests),
    notes: rawNotes.map(n => ({
      id:        n.id,
      body:      n.body,
      createdAt: n.created_at,
      author:    extractNoteName(n.profiles),
    })),
  };
}

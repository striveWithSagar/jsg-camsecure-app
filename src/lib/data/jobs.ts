import { createClient } from "@/lib/supabase/server";
import { businessDateKey, BUSINESS_TZ } from "@/lib/utils";

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

export type ChecklistItem = {
  id:                   string;
  position:             number;
  label:                string;
  isRequired:           boolean;
  isCompleted:          boolean;
  completedAt:          string | null;
  completedByProfileId: string | null;
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
  checklistItems: ChecklistItem[];
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
  // Use business timezone so Monday aligns with the local business week,
  // not the UTC week (which could be 5–6 hours ahead of Winnipeg).
  const todayKey = businessDateKey();                  // YYYY-MM-DD in business TZ
  const d        = new Date(todayKey + "T12:00:00");   // noon avoids DST edge cases
  const dow      = d.getDay();                         // 0 = Sun (local)
  const toMon    = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + toMon);
  return businessDateKey(d);                           // Monday in business TZ
}

function buildWeekDays(weekStartStr: string): { label: string; date: string; jobs: JobRow[] }[] {
  return Array.from({ length: 7 }, (_, i) => {
    // Use noon so DST transitions don't flip the date
    const d    = new Date(weekStartStr + "T12:00:00");
    d.setDate(d.getDate() + i);
    const date  = businessDateKey(d);
    const label = d.toLocaleDateString("en-US", {
      weekday: "long", month: "short", day: "numeric",
      timeZone: BUSINESS_TZ,
    });
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
      service_requests!request_id(request_number, created_at),
      job_checklist_items(id, position, label, is_required, is_completed, completed_at, completed_by_profile_id)
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
  type RawChecklistItem = {
    id:                     string;
    position:               number;
    label:                  string;
    is_required:            boolean;
    is_completed:           boolean;
    completed_at:           string | null;
    completed_by_profile_id: string | null;
  };
  type RawDetail = {
    id:                   string;
    job_number:           number | null;
    organization_id:      string;
    service_type:         string;
    priority:             string;
    status:               string;
    site_name:            string | null;
    address:              string | null;
    scheduled_at:         string | null;
    completed_at:         string | null;
    created_at:           string;
    updated_at:           string;
    dispatcher_notes:     string;
    technician_notes:     string;
    request_id:           string | null;
    technician_id:        string | null;
    clients:              ClientEmbed;
    technicians:          TechEmbed;
    job_notes:            RawNote[] | null;
    service_requests:     ReqEmbed;
    job_checklist_items:  RawChecklistItem[] | null;
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

  const row      = data as unknown as RawDetail;
  const rawNotes = row.job_notes ?? [];
  const rawItems = row.job_checklist_items ?? [];

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
    checklistItems: rawItems
      .sort((a, b) => a.position - b.position)
      .map(item => ({
        id:                   item.id,
        position:             item.position,
        label:                item.label,
        isRequired:           item.is_required,
        isCompleted:          item.is_completed,
        completedAt:          item.completed_at ?? null,
        completedByProfileId: item.completed_by_profile_id ?? null,
      })),
  };
}

// ── Weekly export ─────────────────────────────────────────────────────────────

export type ExportJobRow = {
  id:            string;
  jobNumber:     number | null;
  client:        string;
  siteName:      string;
  address:       string;
  serviceType:   string;
  priority:      string;
  status:        string;
  technician:    string;
  scheduledAt:   string | null;
  createdAt:     string;
  completedAt:   string | null;
  adminNotes:    string;
  techNotes:     string;
  clientConcern: string; // from service_requests.description
  invoiceNumber: string;
  invoiceStatus: string;
  invoiceTotal:  number | null;
  photoCount:    number;
  exportReason:  string; // "Scheduled this week" | "Overdue carry-forward" | "Unscheduled"
};

/**
 * Returns ALL jobs belonging to an organization that fall in the export window:
 *   - Jobs with scheduled_at in [weekStart, weekEnd] (any status)
 *   - Active non-terminal jobs with scheduled_at before weekStart (overdue carry-forward)
 *   - Active non-terminal jobs with no scheduled_at (unscheduled)
 *
 * This is intentionally broader than getJobBoardData which skips terminal jobs
 * and uses a 90-day cutoff — the weekly export needs the full picture.
 */
export async function getJobsForWeeklyExport(
  orgId:      string,
  weekStart:  string, // YYYY-MM-DD (Monday)
  weekEnd:    string, // YYYY-MM-DD (Sunday)
): Promise<ExportJobRow[]> {
  const supabase = await createClient();

  const weekStartISO     = weekStart + "T00:00:00+00:00";
  const weekEndExclusive = (() => {
    const d = new Date(weekEnd + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10) + "T00:00:00+00:00";
  })();

  // Two separate queries to avoid complex nested OR filter syntax
  const [weekResult, overdueResult] = await Promise.all([
    // A: ALL jobs scheduled within this week (any status)
    supabase
      .from("jobs")
      .select(`
        id, job_number, service_type, priority, status,
        site_name, address, scheduled_at, completed_at, created_at, updated_at,
        dispatcher_notes, technician_notes,
        clients(name),
        technicians(profiles(full_name)),
        service_requests!request_id(description),
        invoices(invoice_number, status, total),
        job_photos(id)
      `)
      .eq("organization_id", orgId)
      .gte("scheduled_at", weekStartISO)
      .lt("scheduled_at", weekEndExclusive)
      .order("scheduled_at", { ascending: true }),

    // B: Active overdue + unscheduled jobs (not in the week window but still open)
    supabase
      .from("jobs")
      .select(`
        id, job_number, service_type, priority, status,
        site_name, address, scheduled_at, completed_at, created_at, updated_at,
        dispatcher_notes, technician_notes,
        clients(name),
        technicians(profiles(full_name)),
        service_requests!request_id(description),
        invoices(invoice_number, status, total),
        job_photos(id)
      `)
      .eq("organization_id", orgId)
      .neq("status", "completed")
      .neq("status", "cancelled")
      .or(`scheduled_at.lt.${weekStartISO},scheduled_at.is.null`)
      .order("scheduled_at", { ascending: true, nullsFirst: false }),
  ]);

  if (weekResult.error)    console.error("[getJobsForWeeklyExport] week query:", weekResult.error.message);
  if (overdueResult.error) console.error("[getJobsForWeeklyExport] overdue query:", overdueResult.error.message);

  type RawExportRow = {
    id:                string;
    job_number:        number | null;
    service_type:      string;
    priority:          string;
    status:            string;
    site_name:         string | null;
    address:           string | null;
    scheduled_at:      string | null;
    completed_at:      string | null;
    created_at:        string;
    updated_at:        string;
    dispatcher_notes:  string;
    technician_notes:  string;
    clients:           { name: string } | { name: string }[] | null;
    technicians:       { profiles: { full_name: string } | { full_name: string }[] | null }
                     | { profiles: { full_name: string } | { full_name: string }[] | null }[] | null;
    service_requests:  { description: string } | { description: string }[] | null;
    invoices:          { invoice_number: string; status: string; total: string | number }[]
                     | { invoice_number: string; status: string; total: string | number } | null;
    job_photos:        { id: string }[] | null;
  };

  function mapExportRow(row: RawExportRow): ExportJobRow {
    const clientName = Array.isArray(row.clients)
      ? (row.clients[0]?.name ?? "Unknown")
      : (row.clients?.name ?? "Unknown");

    const techProfiles = Array.isArray(row.technicians)
      ? row.technicians[0]?.profiles
      : (row.technicians as { profiles: unknown } | null)?.profiles;
    const techName = Array.isArray(techProfiles)
      ? ((techProfiles[0] as { full_name: string })?.full_name ?? "Unassigned")
      : ((techProfiles as { full_name: string } | null)?.full_name ?? "Unassigned");

    const clientNotes = Array.isArray(row.service_requests)
      ? (row.service_requests[0]?.description ?? "")
      : ((row.service_requests as { description: string } | null)?.description ?? "");

    const inv = Array.isArray(row.invoices)
      ? row.invoices[0]
      : (row.invoices as { invoice_number: string; status: string; total: string | number } | null);

    return {
      id:            row.id,
      jobNumber:     row.job_number ?? null,
      client:        clientName,
      siteName:      row.site_name ?? "—",
      address:       row.address ?? "—",
      serviceType:   SERVICE_TYPE_LABELS[row.service_type] ?? row.service_type,
      priority:      row.priority,
      status:        row.status,
      technician:    techName,
      scheduledAt:   row.scheduled_at ?? null,
      createdAt:     row.created_at,
      completedAt:   row.completed_at ?? null,
      adminNotes:    row.dispatcher_notes ?? "",
      techNotes:     row.technician_notes ?? "",
      clientConcern: clientNotes,
      invoiceNumber: inv?.invoice_number ?? "—",
      invoiceStatus: inv?.status ?? "—",
      invoiceTotal:  inv ? Number(inv.total) : null,
      photoCount:    (row.job_photos ?? []).length,
      exportReason:  "", // set by caller
    };
  }

  // Set export reason AFTER mapping so we know which query each row came from
  const weekRows = ((weekResult.data ?? []) as unknown as RawExportRow[]).map(row => ({
    ...mapExportRow(row),
    exportReason: "Scheduled this week",
  }));
  const overdueRows = ((overdueResult.data ?? []) as unknown as RawExportRow[]).map(row => {
    const mapped = mapExportRow(row);
    return {
      ...mapped,
      exportReason: mapped.scheduledAt ? "Overdue carry-forward" : "Unscheduled",
    };
  });

  // Deduplicate — a job could theoretically appear in both (edge case: same ID)
  const seen = new Set(weekRows.map(r => r.id));
  const merged = [...weekRows, ...overdueRows.filter(r => !seen.has(r.id))];

  // Sort: priority first, then scheduled_at
  const PORDER = ["emergency", "high", "medium", "low"];
  merged.sort((a, b) => {
    const pa = PORDER.indexOf(a.priority);
    const pb = PORDER.indexOf(b.priority);
    if (pa !== pb) return pa - pb;
    return (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? "");
  });

  return merged;
}

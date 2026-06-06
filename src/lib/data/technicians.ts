import { createClient } from "@/lib/supabase/server";

export type TechnicianRow = {
  id:            string;
  profileId:     string | null;
  name:          string;
  email:         string;
  phone:         string;
  specialty:     string;
  status:        string;
  isActive:      boolean;
  activeJobs:    number;
  completedJobs: number;
  createdAt:     string;
};

export async function getTechnicianList(): Promise<TechnicianRow[]> {
  const supabase = await createClient();

  const [techResult, jobsResult] = await Promise.all([
    supabase
      .from("technicians")
      .select("id, profile_id, specialty, status, is_active, created_at, profiles(full_name, email, phone)"),
    supabase
      .from("jobs")
      .select("technician_id, status"),
  ]);

  if (techResult.error) {
    console.error("[getTechnicianList] technicians:", techResult.error.message);
    return [];
  }
  if (jobsResult.error) {
    console.error("[getTechnicianList] jobs:", jobsResult.error.message);
  }

  type ProfileEmbed = { full_name: string; email: string; phone: string | null }
    | { full_name: string; email: string; phone: string | null }[]
    | null;
  type RawRow = {
    id:         string;
    profile_id: string | null;
    specialty:  string | null;
    status:     string;
    is_active:  boolean;
    created_at: string;
    profiles:   ProfileEmbed;
  };

  function extractProfile(p: ProfileEmbed): { name: string; email: string; phone: string } {
    if (!p) return { name: "Unknown", email: "", phone: "" };
    const row = Array.isArray(p) ? p[0] : p;
    if (!row) return { name: "Unknown", email: "", phone: "" };
    return { name: row.full_name ?? "Unknown", email: row.email ?? "", phone: row.phone ?? "" };
  }

  const jobs = jobsResult.data ?? [];
  const activeMap: Record<string, number> = {};
  const completedMap: Record<string, number> = {};

  for (const j of jobs) {
    if (!j.technician_id) continue;
    if (j.status === "completed") {
      completedMap[j.technician_id] = (completedMap[j.technician_id] ?? 0) + 1;
    } else if (j.status !== "cancelled") {
      activeMap[j.technician_id] = (activeMap[j.technician_id] ?? 0) + 1;
    }
  }

  return ((techResult.data ?? []) as unknown as RawRow[])
    .map(t => {
      const p = extractProfile(t.profiles);
      return {
        id:            t.id,
        profileId:     t.profile_id ?? null,
        name:          p.name,
        email:         p.email,
        phone:         p.phone,
        specialty:     t.specialty ?? "",
        status:        t.status,
        isActive:      t.is_active,
        activeJobs:    activeMap[t.id]    ?? 0,
        completedJobs: completedMap[t.id] ?? 0,
        createdAt:     t.created_at,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export type TechnicianOption = {
  id:         string;
  profile_id: string | null;
  full_name:  string;
  specialty:  string | null;
  status:     string;
};

export async function getTechnicians(): Promise<TechnicianOption[]> {
  const supabase = await createClient();

  // Join profiles to get full_name — technicians table has no name column.
  // profiles_select_own_org RLS allows admin to read all profiles in their org.
  const { data, error } = await supabase
    .from("technicians")
    .select("id, profile_id, specialty, status, profiles(full_name)")
    .eq("is_active", true);

  if (error) {
    console.error("[getTechnicians]", error.message);
    return [];
  }

  type ProfileEmbed = { full_name: string } | { full_name: string }[] | null;
  type RawRow = {
    id:         string;
    profile_id: string | null;
    specialty:  string | null;
    status:     string;
    profiles:   ProfileEmbed;
  };

  function extractName(p: ProfileEmbed): string {
    if (!p) return "Unknown";
    if (Array.isArray(p)) return p[0]?.full_name ?? "Unknown";
    return p.full_name ?? "Unknown";
  }

  return ((data ?? []) as unknown as RawRow[])
    .map(t => ({
      id:        t.id,
      profile_id: t.profile_id ?? null,
      full_name:  extractName(t.profiles),
      specialty:  t.specialty,
      status:     t.status,
    }))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
}

// ── Technician detail ─────────────────────────────────────────────────────────

export type TechnicianJobItem = {
  id:        string;
  type:      string;
  scheduled: string;
  priority:  string;
  status:    string;
};

export type ActiveJobItem = {
  id:        string;
  jobNumber: number | null;
};

export type TechnicianDetailData = {
  id:             string;
  profileId:      string | null;
  name:           string;
  email:          string;
  phone:          string;
  specialty:      string;
  status:         string;
  isActive:       boolean;
  createdAt:      string;
  activeJobs:     number;
  completedJobs:  number;
  recentJobs:     TechnicianJobItem[];
  activeJobItems: ActiveJobItem[];
};

const SERVICE_TYPE_LABELS_T: Record<string, string> = {
  new_installation: "New Installation", maintenance: "Maintenance",
  dvr_nvr_issue: "DVR/NVR Issue",       camera_outage: "Camera Outage",
  mobile_app_issue: "Mobile App Issue", wiring_issue: "Wiring Issue",
  emergency_service: "Emergency Service", quote_request: "Quote Request",
  site_inspection: "Site Inspection",   other: "Other",
};

function fmtSched(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export async function getTechnicianById(id: string): Promise<TechnicianDetailData | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("technicians")
    .select(`
      id, profile_id, specialty, status, is_active, created_at,
      profiles(full_name, email, phone),
      jobs(id, job_number, service_type, priority, status, scheduled_at)
    `)
    .eq("id", id)
    .single();

  if (error || !data) {
    if (error && error.code !== "PGRST116") {
      console.error("[getTechnicianById]", error.message);
    }
    return null;
  }

  type ProfEmbed = { full_name: string; email: string; phone: string | null }
    | { full_name: string; email: string; phone: string | null }[] | null;
  type JobEmbed = { id: string; job_number: number | null; service_type: string; priority: string; status: string; scheduled_at: string | null };
  type RawDetail = {
    id: string; profile_id: string | null; specialty: string | null;
    status: string; is_active: boolean; created_at: string;
    profiles: ProfEmbed; jobs: JobEmbed[] | null;
  };

  const row = data as unknown as RawDetail;

  const prof = Array.isArray(row.profiles) ? (row.profiles[0] ?? null) : row.profiles;
  const name  = prof?.full_name ?? "Unknown";
  const email = prof?.email     ?? "";
  const phone = prof?.phone     ?? "";

  const ACTIVE_STATUSES = new Set(["assigned", "on_the_way", "started", "in_progress", "needs_parts"]);

  const rawJobs = (row.jobs ?? []);
  const activeJobItems = rawJobs
    .filter(j => ACTIVE_STATUSES.has(j.status))
    .map(j => ({ id: j.id, jobNumber: j.job_number ?? null }));
  const activeJobs    = activeJobItems.length;
  const completedJobs = rawJobs.filter(j => j.status === "completed").length;

  const recentJobs = rawJobs
    .sort((a, b) => (b.scheduled_at ?? "").localeCompare(a.scheduled_at ?? ""))
    .slice(0, 5)
    .map(j => ({
      id:        j.id,
      type:      SERVICE_TYPE_LABELS_T[j.service_type] ?? j.service_type,
      scheduled: fmtSched(j.scheduled_at),
      priority:  j.priority,
      status:    j.status,
    }));

  return {
    id:             row.id,
    profileId:      row.profile_id,
    name,
    email,
    phone,
    specialty:      row.specialty ?? "",
    status:         row.status,
    isActive:       row.is_active,
    createdAt:      row.created_at,
    activeJobs,
    completedJobs,
    recentJobs,
    activeJobItems,
  };
}

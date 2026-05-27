import { createClient } from "@/lib/supabase/server";

export type TechnicianRow = {
  id:            string;
  name:          string;
  email:         string;
  phone:         string;
  specialty:     string;
  status:        string;
  activeJobs:    number;
  completedJobs: number;
};

export async function getTechnicianList(): Promise<TechnicianRow[]> {
  const supabase = await createClient();

  const [techResult, jobsResult] = await Promise.all([
    supabase
      .from("technicians")
      .select("id, specialty, status, profiles(full_name, email, phone)"),
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
    id:        string;
    specialty: string | null;
    status:    string;
    profiles:  ProfileEmbed;
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
        name:          p.name,
        email:         p.email,
        phone:         p.phone,
        specialty:     t.specialty ?? "",
        status:        t.status,
        activeJobs:    activeMap[t.id]    ?? 0,
        completedJobs: completedMap[t.id] ?? 0,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export type TechnicianOption = {
  id:        string;
  full_name: string;
  specialty: string | null;
  status:    string;
};

export async function getTechnicians(): Promise<TechnicianOption[]> {
  const supabase = await createClient();

  // Join profiles to get full_name — technicians table has no name column.
  // profiles_select_own_org RLS allows admin to read all profiles in their org.
  const { data, error } = await supabase
    .from("technicians")
    .select("id, specialty, status, profiles(full_name)");

  if (error) {
    console.error("[getTechnicians]", error.message);
    return [];
  }

  type ProfileEmbed = { full_name: string } | { full_name: string }[] | null;
  type RawRow = {
    id:        string;
    specialty: string | null;
    status:    string;
    profiles:  ProfileEmbed;
  };

  function extractName(p: ProfileEmbed): string {
    if (!p) return "Unknown";
    if (Array.isArray(p)) return p[0]?.full_name ?? "Unknown";
    return p.full_name ?? "Unknown";
  }

  return ((data ?? []) as unknown as RawRow[])
    .map(t => ({
      id:        t.id,
      full_name: extractName(t.profiles),
      specialty: t.specialty,
      status:    t.status,
    }))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
}

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

function formatDueDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export type ClientOption = {
  id:      string;
  name:    string;
  address: string; // clients.address — used as site address fallback on convert page
};

export type ClientRow = {
  id:       string;
  name:     string;
  status:   string;
  contact:  string;
  email:    string;
  phone:    string;
  jobCount: number;
};

export async function getClients(): Promise<ClientOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select("id, name, address")
    .eq("status", "active")
    .order("name");

  if (error) {
    console.error("[getClients]", error.message);
    return [];
  }

  return (data ?? []) as ClientOption[];
}

export async function getClientList(): Promise<ClientRow[]> {
  const supabase = await createClient();

  const [clientsResult, jobsResult] = await Promise.all([
    supabase
      .from("clients")
      .select("id, name, status, client_contacts(full_name, email, phone, is_primary)")
      .order("name"),
    supabase
      .from("jobs")
      .select("client_id"),
  ]);

  if (clientsResult.error) {
    console.error("[getClientList] clients:", clientsResult.error.message);
    return [];
  }
  if (jobsResult.error) {
    console.error("[getClientList] jobs:", jobsResult.error.message);
  }

  type ContactEmbed = {
    full_name:  string;
    email:      string;
    phone:      string | null;
    is_primary: boolean;
  };
  type RawClient = {
    id:              string;
    name:            string;
    status:          string;
    client_contacts: ContactEmbed[] | null;
  };

  const jobCountMap = (jobsResult.data ?? []).reduce<Record<string, number>>((acc, j) => {
    if (j.client_id) acc[j.client_id] = (acc[j.client_id] ?? 0) + 1;
    return acc;
  }, {});

  return ((clientsResult.data ?? []) as unknown as RawClient[]).map(row => {
    const contacts = row.client_contacts ?? [];
    const primary  = contacts.find(c => c.is_primary) ?? contacts[0] ?? null;
    return {
      id:       row.id,
      name:     row.name,
      status:   row.status,
      contact:  primary?.full_name ?? "",
      email:    primary?.email     ?? "",
      phone:    primary?.phone     ?? "",
      jobCount: jobCountMap[row.id] ?? 0,
    };
  });
}

export type ClientJobItem = {
  id:        string;
  type:      string;
  scheduled: string;
  priority:  string;
  status:    string;
};

export type ClientInvoiceItem = {
  id:     string;
  number: string;
  status: string;
  total:  number;
  dueAt:  string;
};

export type ClientDetailData = {
  id:               string;
  name:             string;
  status:           string;
  contact:          string;
  email:            string;
  phone:            string;
  jobCount:         number;
  jobs:             ClientJobItem[];
  invoices:         ClientInvoiceItem[];
  profileId:        string | null;   // auth user id of primary portal contact
  profileIsActive:  boolean;         // whether portal account is active
};

export async function getClientById(id: string): Promise<ClientDetailData | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("clients")
    .select(`
      id, name, status,
      client_contacts(full_name, email, phone, is_primary, profile_id),
      jobs(id, service_type, priority, status, scheduled_at),
      invoices(id, invoice_number, status, total, due_at)
    `)
    .eq("id", id)
    .single();

  if (error || !data) {
    if (error && error.code !== "PGRST116") {
      console.error("[getClientById]", error.message);
    }
    return null;
  }

  type ContactEmbed = { full_name: string; email: string; phone: string | null; is_primary: boolean; profile_id: string | null };
  type JobEmbed     = { id: string; service_type: string; priority: string; status: string; scheduled_at: string | null };
  type InvoiceEmbed = { id: string; invoice_number: string; status: string; total: string | number; due_at: string | null };
  type RawDetail = {
    id:              string;
    name:            string;
    status:          string;
    client_contacts: ContactEmbed[] | null;
    jobs:            JobEmbed[]     | null;
    invoices:        InvoiceEmbed[] | null;
  };

  const row      = data as unknown as RawDetail;
  const contacts = row.client_contacts ?? [];
  const primary  = contacts.find(c => c.is_primary) ?? contacts[0] ?? null;
  const profileId = primary?.profile_id ?? null;

  // Fetch portal account active-status if a profile is linked
  let profileIsActive = true;
  if (profileId) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("is_active")
      .eq("id", profileId)
      .single();
    profileIsActive = prof?.is_active ?? true;
  }

  const rawJobs  = (row.jobs ?? []).sort((a, b) => {
    const aCompleted = ["completed", "cancelled"].includes(a.status);
    const bCompleted = ["completed", "cancelled"].includes(b.status);
    if (aCompleted !== bCompleted) return aCompleted ? 1 : -1;
    if (!a.scheduled_at) return 1;
    if (!b.scheduled_at) return -1;
    return new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime();
  });

  return {
    id:              row.id,
    name:            row.name,
    status:          row.status,
    contact:         primary?.full_name ?? "",
    email:           primary?.email     ?? "",
    phone:           primary?.phone     ?? "",
    profileId,
    profileIsActive,
    jobCount: (row.jobs ?? []).length,
    jobs: rawJobs.map(j => ({
      id:        j.id,
      type:      SERVICE_TYPE_LABELS[j.service_type] ?? j.service_type,
      scheduled: formatScheduled(j.scheduled_at),
      priority:  j.priority,
      status:    j.status,
    })),
    invoices: (row.invoices ?? []).map(inv => ({
      id:     inv.id,
      number: inv.invoice_number,
      status: inv.status,
      total:  Number(inv.total) || 0,
      dueAt:  formatDueDate(inv.due_at),
    })),
  };
}

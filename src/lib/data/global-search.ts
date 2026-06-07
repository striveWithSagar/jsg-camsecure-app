import { createClient } from "@/lib/supabase/server";
import { fmtJobNumber, fmtReqNumber } from "@/lib/utils";
import { STATUS_LABELS, REQUEST_STATUS_LABELS } from "@/lib/constants";

// ─── Service type enum → label (mirrors the map already duplicated in
// dashboard.ts / clients.ts / client-portal.ts) — needed to let users search
// by the human-readable label (e.g. "camera") and match the underlying enum. ──

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

const RESULT_LIMIT = 5;
const LOOKUP_LIMIT = 10;

export type SearchJobResult = {
  id: string;
  label: string;
  secondary: string;
  status: string;
};

export type SearchRequestResult = {
  id: string;
  label: string;
  secondary: string;
  status: string;
};

export type SearchClientResult = {
  id: string;
  label: string;
  secondary: string;
};

export type SearchTechnicianResult = {
  id: string;
  label: string;
  secondary: string;
  status: string;
};

export type GlobalSearchResults = {
  jobs: SearchJobResult[];
  requests: SearchRequestResult[];
  clients: SearchClientResult[];
  technicians: SearchTechnicianResult[];
};

const EMPTY_RESULTS: GlobalSearchResults = { jobs: [], requests: [], clients: [], technicians: [] };

// ─── Query parsing helpers ──────────────────────────────────────────────────

// Escapes ilike wildcard characters so user input is matched literally.
function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

function toPattern(value: string): string {
  return `%${escapeLikePattern(value)}%`;
}

// Parses "JOB-0035" / "job35" / "REQ-0035" / "35" into the numeric identifier
// each entity should match on. A bare number matches both job and request
// numbers; a prefixed identifier matches only its own entity.
function parseIdentifiers(query: string): { jobNumber: number | null; requestNumber: number | null } {
  const trimmed = query.trim();
  const jobMatch = /^job-?(\d+)$/i.exec(trimmed);
  if (jobMatch) return { jobNumber: parseInt(jobMatch[1], 10), requestNumber: null };

  const reqMatch = /^req-?(\d+)$/i.exec(trimmed);
  if (reqMatch) return { jobNumber: null, requestNumber: parseInt(reqMatch[1], 10) };

  if (/^\d+$/.test(trimmed)) {
    const n = parseInt(trimmed, 10);
    return { jobNumber: n, requestNumber: n };
  }

  return { jobNumber: null, requestNumber: null };
}

function matchingEnumValues(labels: Record<string, string>, query: string): string[] {
  const lower = query.toLowerCase();
  return Object.entries(labels)
    .filter(([, label]) => label.toLowerCase().includes(lower))
    .map(([value]) => value);
}

function uniqueStrings(values: (string | null | undefined)[]): string[] {
  return Array.from(new Set(values.filter((v): v is string => Boolean(v))));
}

function fmtShortDate(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-US", { day: "numeric", month: "long" }).format(new Date(iso));
}

// ─── Embed helpers — every relation in this codebase can come back as either
// a single object or an array depending on the join, so unwrap defensively. ──

function unwrap<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

// ─── Main entry point ───────────────────────────────────────────────────────

export async function globalSearch(rawQuery: string): Promise<GlobalSearchResults> {
  const trimmed = rawQuery.trim();
  const { jobNumber, requestNumber } = parseIdentifiers(trimmed);
  const looksLikeIdentifier = jobNumber !== null || requestNumber !== null;

  if (trimmed.length < 2 && !looksLikeIdentifier) return EMPTY_RESULTS;

  const supabase = await createClient();
  const pattern = toPattern(trimmed);
  const matchingServiceTypes = matchingEnumValues(SERVICE_TYPE_LABELS, trimmed);
  const matchingJobStatuses = matchingEnumValues(STATUS_LABELS, trimmed);
  const matchingRequestStatuses = matchingEnumValues(REQUEST_STATUS_LABELS, trimmed);

  // ── Resolve matching client IDs first — needed both for the Clients
  // results and for matching jobs by client/company name (jobs has no
  // denormalized client name, only a client_id FK). ──
  const [clientByField, clientByContact] = await Promise.all([
    supabase.from("clients").select("id").ilike("name", pattern).limit(LOOKUP_LIMIT),
    supabase.from("clients").select("id").ilike("address", pattern).limit(LOOKUP_LIMIT),
  ]);
  const [contactByName, contactByEmail, contactByPhone] = await Promise.all([
    supabase.from("client_contacts").select("client_id").ilike("full_name", pattern).limit(LOOKUP_LIMIT),
    supabase.from("client_contacts").select("client_id").ilike("email", pattern).limit(LOOKUP_LIMIT),
    supabase.from("client_contacts").select("client_id").ilike("phone", pattern).limit(LOOKUP_LIMIT),
  ]);
  const matchedClientIds = uniqueStrings([
    ...(clientByField.data ?? []).map((r) => r.id),
    ...(clientByContact.data ?? []).map((r) => r.id),
    ...(contactByName.data ?? []).map((r) => r.client_id),
    ...(contactByEmail.data ?? []).map((r) => r.client_id),
    ...(contactByPhone.data ?? []).map((r) => r.client_id),
  ]);

  // ── Resolve matching technician profile IDs — technicians have no
  // denormalized name/email/phone, only a profile_id FK to profiles. ──
  const [profileByName, profileByEmail, profileByPhone, technicianBySpecialty] = await Promise.all([
    supabase.from("profiles").select("id").eq("role", "technician").ilike("full_name", pattern).limit(LOOKUP_LIMIT),
    supabase.from("profiles").select("id").eq("role", "technician").ilike("email", pattern).limit(LOOKUP_LIMIT),
    supabase.from("profiles").select("id").eq("role", "technician").ilike("phone", pattern).limit(LOOKUP_LIMIT),
    supabase.from("technicians").select("profile_id").ilike("specialty", pattern).limit(LOOKUP_LIMIT),
  ]);
  const matchedTechProfileIds = uniqueStrings([
    ...(profileByName.data ?? []).map((r) => r.id),
    ...(profileByEmail.data ?? []).map((r) => r.id),
    ...(profileByPhone.data ?? []).map((r) => r.id),
    ...(technicianBySpecialty.data ?? []).map((r) => r.profile_id),
  ]);

  // ── Run the four entity result queries in parallel. Each is a set of
  // independent single-column filters (never string-interpolated user text
  // into a combined .or() — every value goes through the client library's
  // own parameter encoding). ──
  const jobSelect = "id, job_number, site_name, address, service_type, status, scheduled_at, clients(name)";
  const jobBaseQueries = [
    supabase.from("jobs").select(jobSelect).ilike("site_name", pattern).limit(RESULT_LIMIT),
    supabase.from("jobs").select(jobSelect).ilike("address", pattern).limit(RESULT_LIMIT),
  ];
  if (jobNumber !== null) {
    jobBaseQueries.push(supabase.from("jobs").select(jobSelect).eq("job_number", jobNumber).limit(RESULT_LIMIT));
  }
  if (matchingServiceTypes.length > 0) {
    jobBaseQueries.push(supabase.from("jobs").select(jobSelect).in("service_type", matchingServiceTypes).limit(RESULT_LIMIT));
  }
  if (matchingJobStatuses.length > 0) {
    jobBaseQueries.push(supabase.from("jobs").select(jobSelect).in("status", matchingJobStatuses).limit(RESULT_LIMIT));
  }
  if (matchedClientIds.length > 0) {
    jobBaseQueries.push(supabase.from("jobs").select(jobSelect).in("client_id", matchedClientIds).limit(RESULT_LIMIT));
  }

  const reqSelect = "id, request_number, client_name, service_type, status, site_address";
  const reqBaseQueries = [
    supabase.from("service_requests").select(reqSelect).ilike("client_name", pattern).limit(RESULT_LIMIT),
    supabase.from("service_requests").select(reqSelect).ilike("site_address", pattern).limit(RESULT_LIMIT),
    supabase.from("service_requests").select(reqSelect).ilike("description", pattern).limit(RESULT_LIMIT),
  ];
  if (requestNumber !== null) {
    reqBaseQueries.push(supabase.from("service_requests").select(reqSelect).eq("request_number", requestNumber).limit(RESULT_LIMIT));
  }
  if (matchingServiceTypes.length > 0) {
    reqBaseQueries.push(supabase.from("service_requests").select(reqSelect).in("service_type", matchingServiceTypes).limit(RESULT_LIMIT));
  }
  if (matchingRequestStatuses.length > 0) {
    reqBaseQueries.push(supabase.from("service_requests").select(reqSelect).in("status", matchingRequestStatuses).limit(RESULT_LIMIT));
  }

  const clientSelect = "id, name, status, client_contacts(full_name, email, phone, is_primary)";
  const clientQuery = matchedClientIds.length > 0
    ? supabase.from("clients").select(clientSelect).in("id", matchedClientIds.slice(0, RESULT_LIMIT))
    : null;

  const techSelect = "id, specialty, status, profiles(full_name)";
  const techQuery = matchedTechProfileIds.length > 0
    ? supabase.from("technicians").select(techSelect).in("profile_id", matchedTechProfileIds.slice(0, RESULT_LIMIT))
    : null;

  const [jobBatches, reqBatches, clientRes, techRes] = await Promise.all([
    Promise.all(jobBaseQueries),
    Promise.all(reqBaseQueries),
    clientQuery ?? Promise.resolve({ data: [] as unknown[] }),
    techQuery ?? Promise.resolve({ data: [] as unknown[] }),
  ]);

  // ── Map + dedupe + cap each entity's merged result set ──

  type JobRow = {
    id: string; job_number: number | null; site_name: string; address: string;
    service_type: string; status: string; scheduled_at: string | null;
    clients: { name: string } | { name: string }[] | null;
  };
  const jobRows = new Map<string, JobRow>();
  for (const batch of jobBatches) {
    for (const row of (batch.data ?? []) as JobRow[]) jobRows.set(row.id, row);
  }
  const jobs: SearchJobResult[] = Array.from(jobRows.values()).slice(0, RESULT_LIMIT).map((row) => {
    const client = unwrap(row.clients);
    const dateLabel = fmtShortDate(row.scheduled_at);
    const clientPart = dateLabel ? `${client?.name ?? "Unknown"} (${dateLabel})` : (client?.name ?? "Unknown");
    return {
      id: row.id,
      label: `${fmtJobNumber(row.job_number)} · ${clientPart}`,
      secondary: row.site_name || row.address || "",
      status: row.status,
    };
  });

  type ReqRow = {
    id: string; request_number: number | null; client_name: string;
    service_type: string; status: string; site_address: string;
  };
  const reqRows = new Map<string, ReqRow>();
  for (const batch of reqBatches) {
    for (const row of (batch.data ?? []) as ReqRow[]) reqRows.set(row.id, row);
  }
  const requests: SearchRequestResult[] = Array.from(reqRows.values()).slice(0, RESULT_LIMIT).map((row) => ({
    id: row.id,
    label: `${fmtReqNumber(row.request_number)} · ${SERVICE_TYPE_LABELS[row.service_type] ?? row.service_type}`,
    secondary: [row.client_name, row.site_address].filter(Boolean).join(" / "),
    status: row.status,
  }));

  type ClientRow = {
    id: string; name: string; status: string;
    client_contacts: { full_name: string; email: string; phone: string; is_primary: boolean }
      | { full_name: string; email: string; phone: string; is_primary: boolean }[] | null;
  };
  const clients: SearchClientResult[] = ((clientRes.data ?? []) as ClientRow[]).slice(0, RESULT_LIMIT).map((row) => {
    const contacts = Array.isArray(row.client_contacts) ? row.client_contacts : (row.client_contacts ? [row.client_contacts] : []);
    const primary = contacts.find((c) => c.is_primary) ?? contacts[0] ?? null;
    const secondaryParts = primary ? [primary.full_name, primary.email].filter(Boolean) : [];
    return {
      id: row.id,
      label: row.name,
      secondary: secondaryParts.length > 0 ? `Primary contact · ${secondaryParts.join(" · ")}` : "",
    };
  });

  type TechRow = {
    id: string; specialty: string | null; status: string;
    profiles: { full_name: string } | { full_name: string }[] | null;
  };
  const technicians: SearchTechnicianResult[] = ((techRes.data ?? []) as TechRow[]).slice(0, RESULT_LIMIT).map((row) => {
    const profile = unwrap(row.profiles);
    return {
      id: row.id,
      label: profile?.full_name ?? "Unknown",
      secondary: row.specialty ?? "",
      status: row.status,
    };
  });

  return { jobs, requests, clients, technicians };
}

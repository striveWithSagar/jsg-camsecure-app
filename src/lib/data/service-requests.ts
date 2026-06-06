import { createClient } from "@/lib/supabase/server";

// ─── DB-typed enums matching the Postgres enum definitions exactly ──────────

export type RequestStatus =
  | "new"
  | "reviewing"
  | "ready_to_schedule"
  | "converted"
  | "cancelled";

export type UrgencyLevel = "emergency" | "high" | "medium" | "low";

export type ServiceType =
  | "new_installation"
  | "maintenance"
  | "dvr_nvr_issue"
  | "camera_outage"
  | "mobile_app_issue"
  | "wiring_issue"
  | "emergency_service"
  | "quote_request"
  | "site_inspection"
  | "other";

// ─── DB row type matching service_requests table columns exactly ────────────

export type ServiceRequest = {
  id: string;
  organization_id: string;
  client_id: string | null;
  client_contact_id: string | null;
  submitted_by_profile_id: string | null;
  client_name: string;
  client_phone: string;
  service_type: ServiceType;
  urgency: UrgencyLevel;
  status: RequestStatus;
  description: string;
  notes: string;
  site_address: string;
  preferred_at: string | null;
  converted_to_job_id: string | null;
  request_number: number | null;
  created_at: string;
  updated_at: string;
};

// ─── Read-only queries ───────────────────────────────────────────────────────
// RLS note: these queries use the authenticated server client (publishable key
// + session cookie). Without an active auth session, RLS returns 0 rows — no
// error is thrown. Reads will succeed only after Phase 8 wires up real auth.

export async function getServiceRequests(): Promise<ServiceRequest[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("service_requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getServiceRequests]", error.message);
    return [];
  }

  return (data ?? []) as ServiceRequest[];
}

export async function getServiceRequestById(
  id: string
): Promise<ServiceRequest | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("service_requests")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    // PGRST116 = "no rows returned" — expected when row doesn't exist or RLS hides it
    if (error.code !== "PGRST116") {
      console.error("[getServiceRequestById]", error.message);
    }
    return null;
  }

  return data as ServiceRequest;
}

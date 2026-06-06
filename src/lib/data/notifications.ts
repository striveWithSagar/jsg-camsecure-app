import { createClient } from "@/lib/supabase/server";

export type NotificationItem = {
  id:                 string;
  eventType:          string;
  title:              string;
  body:               string | null;
  entityType:         string;
  entityId:           string;
  actorProfileId:     string | null;
  recipientProfileId: string | null;
  recipientRole:      string | null;
  isRead:             boolean;
  createdAt:          string;
};

type RawRow = {
  id:                    string;
  event_type:            string;
  title:                 string;
  body:                  string | null;
  entity_type:           string;
  entity_id:             string;
  actor_profile_id:      string | null;
  recipient_profile_id:  string | null;
  recipient_role:        string | null;
  is_read:               boolean;
  created_at:            string;
};

function mapRow(r: RawRow): NotificationItem {
  return {
    id:                 r.id,
    eventType:          r.event_type,
    title:              r.title,
    body:               r.body ?? null,
    entityType:         r.entity_type,
    entityId:           r.entity_id,
    actorProfileId:     r.actor_profile_id ?? null,
    recipientProfileId: r.recipient_profile_id ?? null,
    recipientRole:      r.recipient_role ?? null,
    isRead:             r.is_read,
    createdAt:          r.created_at,
  };
}

// Server-side: fetch unread notifications for admin/dispatcher TopBar SSR count
export async function getUnreadNotificationCount(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("is_read", false);
  if (error) return 0;
  return count ?? 0;
}

// Server-side: fetch recent notifications for initial render
export async function getRecentNotifications(limit = 20): Promise<NotificationItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, event_type, title, body, entity_type, entity_id, actor_profile_id, recipient_profile_id, recipient_role, is_read, created_at")
    .eq("is_read", false)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) { console.error("[getRecentNotifications]", error.message); return []; }
  return ((data ?? []) as unknown as RawRow[]).map(mapRow);
}

// Entity → URL map for navigation on click
export function notificationEntityUrl(entityType: string, entityId: string, role: "admin" | "client" | "technician" = "admin"): string {
  if (role === "client") {
    return entityType === "job" ? `/client/jobs/${entityId}` : `/client/requests/${entityId}`;
  }
  if (role === "technician") {
    return `/technician/jobs/${entityId}`;
  }
  // admin default
  if (entityType === "announcement") return `/announcements/${entityId}/edit`;
  return entityType === "job" ? `/jobs/${entityId}` : `/requests/${entityId}`;
}

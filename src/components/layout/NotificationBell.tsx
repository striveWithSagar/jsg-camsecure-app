"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/components/providers/ProfileProvider";
type NotificationItem = {
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

function notificationEntityUrl(entityType: string, entityId: string): string {
  switch (entityType) {
    case "job":              return `/jobs/${entityId}`;
    case "client":           return `/clients/${entityId}`;
    case "technician":       return `/technicians/${entityId}`;
    default:                 return `/requests/${entityId}`;
  }
}
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Bell, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)  return "just now";
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

const EVENT_ICON: Record<string, string> = {
  client_request_created:       "📋",
  client_request_edited:        "✏️",
  client_request_cancelled:     "❌",
  technician_job_status_changed:"🔄",
  technician_job_completed:     "✅",
  technician_field_note_added:  "📝",
  client_request_photo_uploaded:"📸",
  job_photo_uploaded:           "📸",
  admin_technician_assigned:    "👷",
  technician_reassigned_away:   "🔁",
  request_converted_to_job:     "🔧",
  request_status_updated_client:"📬",
  job_completed_client:                "✅",
  account_password_help_requested:     "🔑",
  client_announcement_interest:        "💬",
};

export function NotificationBell() {
  const router  = useRouter();
  const profile = useProfile(); // provides role for recipient filtering
  const [items, setItems]   = useState<NotificationItem[]>([]);
  const [open,  setOpen]    = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Fetch user ID once on mount — needed to filter profile-specific notifications
  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id);
    });
  }, []);

  const unreadCount = items.length;

  // Build PostgREST OR filter: show notifications that are either
  //   (a) role-based for my role  (recipient_role = my_role, no specific profile)
  //   (b) general broadcast       (no role, no profile)
  //   (c) addressed to me         (recipient_profile_id = my_user_id)
  // This prevents admins from seeing technician-targeted "You have been assigned" notifications.
  function recipientFilter(): string | null {
    if (!userId) return null;
    const role = profile.role;
    return [
      `and(recipient_role.eq.${role},recipient_profile_id.is.null)`,
      `and(recipient_role.is.null,recipient_profile_id.is.null)`,
      `recipient_profile_id.eq.${userId}`,
    ].join(",");
  }

  function mapRow(r: Record<string, unknown>): NotificationItem {
    return {
      id:                 r.id as string,
      eventType:          r.event_type as string,
      title:              r.title as string,
      body:               (r.body as string | null) ?? null,
      entityType:         r.entity_type as string,
      entityId:           r.entity_id as string,
      actorProfileId:     (r.actor_profile_id as string | null) ?? null,
      recipientProfileId: (r.recipient_profile_id as string | null) ?? null,
      recipientRole:      (r.recipient_role as string | null) ?? null,
      isRead:             r.is_read as boolean,
      createdAt:          r.created_at as string,
    };
  }

  // All setState calls inside loadNotifications happen after the first await —
  // satisfies react-hooks/set-state-in-effect.
  useEffect(() => {
    if (!userId) return; // wait until user ID is known
    async function loadNotifications() {
      const supabase = createClient();
      const filter   = recipientFilter();
      let query = supabase
        .from("notifications")
        .select("id, event_type, title, body, entity_type, entity_id, actor_profile_id, recipient_profile_id, recipient_role, is_read, created_at")
        .eq("is_read", false)
        .order("created_at", { ascending: false })
        .limit(20);
      if (filter) query = query.or(filter);
      const { data, error } = await query;
      if (!error && data) {
        setItems((data as Record<string, unknown>[]).map(mapRow));
      }
    }

    loadNotifications();
    const interval = setInterval(loadNotifications, 30_000);
    return () => clearInterval(interval);
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch when dropdown opens
  useEffect(() => {
    if (!open || !userId) return;
    async function loadOnOpen() {
      const supabase = createClient();
      const filter   = recipientFilter();
      let query = supabase
        .from("notifications")
        .select("id, event_type, title, body, entity_type, entity_id, actor_profile_id, recipient_profile_id, recipient_role, is_read, created_at")
        .eq("is_read", false)
        .order("created_at", { ascending: false })
        .limit(20);
      if (filter) query = query.or(filter);
      const { data, error } = await query;
      if (!error && data) {
        setItems((data as Record<string, unknown>[]).map(mapRow));
      }
    }
    loadOnOpen();
  }, [open, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function markRead(item: NotificationItem) {
    const supabase = createClient();
    await supabase.from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("id", item.id);
    setItems(prev => prev.filter(n => n.id !== item.id));
    setOpen(false);
    router.push(notificationEntityUrl(item.entityType, item.entityId));
  }

  async function markAllRead() {
    if (items.length === 0) return;
    const supabase = createClient();
    const ids = items.map(n => n.id);
    await supabase.from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .in("id", ids);
    setItems([]);
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        aria-label="Notifications"
        className={cn(
          "relative inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition-colors",
          "hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        )}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground leading-none">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 p-0" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
          <p className="text-xs font-semibold text-foreground">
            Notifications {unreadCount > 0 && <span className="text-muted-foreground font-normal">({unreadCount} unread)</span>}
          </p>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <CheckCheck className="h-3 w-3" />
              Mark all read
            </button>
          )}
        </div>

        {/* List */}
        <div className="max-h-[360px] overflow-y-auto">
          {items.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6">No unread notifications</p>
          )}
          {items.map(item => (
            <button
              key={item.id}
              onClick={() => markRead(item)}
              className={cn(
                "w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors border-b border-border/40 last:border-0",
                "flex items-start gap-2.5"
              )}
            >
              <span className="text-base shrink-0 mt-0.5">
                {EVENT_ICON[item.eventType] ?? "🔔"}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground leading-snug truncate">
                  {item.title}
                </p>
                {item.body && (
                  <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                    {item.body}
                  </p>
                )}
                <p className="text-[10px] text-muted-foreground/70 mt-1">
                  {relativeTime(item.createdAt)}
                </p>
              </div>
            </button>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

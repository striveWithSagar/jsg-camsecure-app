import { createClient } from "@/lib/supabase/server";

export type AnnouncementRow = {
  id:             string;
  title:          string;
  description:    string | null;
  ctaText:        string;
  posterPath:     string | null;
  isPublished:    boolean;
  startsAt:       string | null;
  endsAt:         string | null;
  createdAt:      string;
  updatedAt:      string;
  interestCount:  number;
};

export type AnnouncementDetail = AnnouncementRow & {
  interests: InterestRow[];
};

export type InterestRow = {
  id:        string;
  clientId:  string | null;
  profileId: string | null;
  message:   string | null;
  clickedAt: string;
  clientName: string | null;
};

type RawAnnouncement = {
  id:              string;
  title:           string;
  description:     string | null;
  cta_text:        string;
  poster_path:     string | null;
  is_published:    boolean;
  starts_at:       string | null;
  ends_at:         string | null;
  created_at:      string;
  updated_at:      string;
};

function mapAnnouncement(r: RawAnnouncement, interestCount = 0): AnnouncementRow {
  return {
    id:            r.id,
    title:         r.title,
    description:   r.description,
    ctaText:       r.cta_text,
    posterPath:    r.poster_path,
    isPublished:   r.is_published,
    startsAt:      r.starts_at,
    endsAt:        r.ends_at,
    createdAt:     r.created_at,
    updatedAt:     r.updated_at,
    interestCount,
  };
}

// Admin: all org announcements ordered newest first
export async function getAnnouncements(): Promise<AnnouncementRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_announcements")
    .select("id, title, description, cta_text, poster_path, is_published, starts_at, ends_at, created_at, updated_at")
    .order("created_at", { ascending: false });
  if (error) { console.error("[getAnnouncements]", error.message); return []; }

  if (!data || data.length === 0) return [];

  // Fetch interest counts in one query
  const ids = (data as RawAnnouncement[]).map(r => r.id);
  const { data: counts } = await supabase
    .from("client_announcement_interests")
    .select("announcement_id")
    .in("announcement_id", ids);

  const countMap: Record<string, number> = {};
  for (const row of (counts ?? []) as { announcement_id: string }[]) {
    countMap[row.announcement_id] = (countMap[row.announcement_id] ?? 0) + 1;
  }

  return (data as RawAnnouncement[]).map(r => mapAnnouncement(r, countMap[r.id] ?? 0));
}

// Admin: single announcement with interests list
export async function getAnnouncementDetail(id: string): Promise<AnnouncementDetail | null> {
  const supabase = await createClient();
  const { data: ann, error } = await supabase
    .from("client_announcements")
    .select("id, title, description, cta_text, poster_path, is_published, starts_at, ends_at, created_at, updated_at")
    .eq("id", id)
    .single();
  if (error || !ann) return null;

  const { data: rawInterests } = await supabase
    .from("client_announcement_interests")
    .select("id, client_id, profile_id, message, clicked_at, clients(name)")
    .eq("announcement_id", id)
    .order("clicked_at", { ascending: false });

  const interests: InterestRow[] = ((rawInterests ?? []) as unknown as {
    id: string; client_id: string | null; profile_id: string | null;
    message: string | null; clicked_at: string;
    clients: { name: string } | null;
  }[]).map(r => ({
    id:         r.id,
    clientId:   r.client_id,
    profileId:  r.profile_id,
    message:    r.message,
    clickedAt:  r.clicked_at,
    clientName: r.clients?.name ?? null,
  }));

  return { ...mapAnnouncement(ann as RawAnnouncement, interests.length), interests };
}

// Client portal: active published announcements only (RLS enforces date window)
export async function getAnnouncementsForClient(): Promise<AnnouncementRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_announcements")
    .select("id, title, description, cta_text, poster_path, is_published, starts_at, ends_at, created_at, updated_at")
    .order("created_at", { ascending: false });
  if (error) { console.error("[getAnnouncementsForClient]", error.message); return []; }
  return ((data ?? []) as RawAnnouncement[]).map(r => mapAnnouncement(r));
}

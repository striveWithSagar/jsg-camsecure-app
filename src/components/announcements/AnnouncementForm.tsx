"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Upload, X, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { toDateInputValue, validateDateInput, MIN_DATE, MAX_DATE } from "@/lib/date-input";
import type { AnnouncementRow } from "@/lib/data/announcements";

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES    = 10 * 1024 * 1024;

function sanitizeFileName(name: string): string {
  const ext  = name.includes(".") ? "." + name.split(".").pop()!.toLowerCase() : "";
  const base = name.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9-]/g, "_");
  return (base || "poster") + ext;
}

type Props = {
  mode:       "create" | "edit";
  initial?:   AnnouncementRow;
  orgId:      string;
};

export function AnnouncementForm({ mode, initial, orgId }: Props) {
  const router = useRouter();
  const [loading,     setLoading]     = useState(false);
  const [title,       setTitle]       = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [ctaText,     setCtaText]     = useState(initial?.ctaText ?? "I'm Interested");
  const [isPublished, setIsPublished] = useState(initial?.isPublished ?? false);
  const [startsAt,    setStartsAt]    = useState(toDateInputValue(initial?.startsAt));
  const [endsAt,      setEndsAt]      = useState(toDateInputValue(initial?.endsAt));
  const [posterFile,  setPosterFile]  = useState<File | null>(null);
  const [posterPreview, setPosterPreview] = useState<string | null>(null);
  const [fileError,   setFileError]   = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setFileError(null);
    if (!ALLOWED_MIME.includes(file.type)) {
      setFileError("Only JPEG, PNG, or WebP images are allowed.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setFileError("File exceeds 10 MB limit.");
      return;
    }
    setPosterFile(file);
    setPosterPreview(URL.createObjectURL(file));
  }

  function clearPoster() {
    setPosterFile(null);
    setPosterPreview(null);
    setFileError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { toast.error("Title is required"); return; }

    // Validate date window before any network call
    let normalizedStartsAt: string | null;
    let normalizedEndsAt: string | null;
    try {
      normalizedStartsAt = validateDateInput(startsAt);
      normalizedEndsAt   = validateDateInput(endsAt);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid date");
      return;
    }
    if (normalizedStartsAt && normalizedEndsAt && normalizedStartsAt > normalizedEndsAt) {
      toast.error("Hide after date must be after Show from date.");
      return;
    }

    setLoading(true);

    const supabase = createClient();

    // Get current user for created_by
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Not authenticated"); setLoading(false); return; }

    let posterPath: string | null = initial?.posterPath ?? null;

    try {
      if (mode === "create") {
        // 1. Insert announcement (no poster yet)
        const { data: created, error: insertErr } = await supabase
          .from("client_announcements")
          .insert({
            organization_id: orgId,
            title:           title.trim(),
            description:     description.trim() || null,
            cta_text:        ctaText.trim() || "I'm Interested",
            is_published:    isPublished,
            starts_at:       normalizedStartsAt,
            ends_at:         normalizedEndsAt,
            created_by:      user.id,
          })
          .select("id")
          .single();
        if (insertErr || !created) throw new Error(insertErr?.message ?? "Insert failed");

        // 2. Upload poster if provided
        if (posterFile) {
          const safeName = sanitizeFileName(posterFile.name);
          const storagePath = `org/${orgId}/announcements/${created.id}/${safeName}`;
          const { error: uploadErr } = await supabase.storage
            .from("camsecure-media")
            .upload(storagePath, posterFile, { upsert: true });
          if (uploadErr) {
            toast.warning("Announcement created but poster upload failed: " + uploadErr.message);
          } else {
            await supabase
              .from("client_announcements")
              .update({ poster_path: storagePath })
              .eq("id", created.id);
          }
        }

        toast.success("Announcement created");
        router.push("/announcements");
        router.refresh();

      } else {
        // Edit mode — update existing
        if (!initial) throw new Error("No initial data for edit");

        // Upload new poster if provided
        if (posterFile) {
          const safeName = sanitizeFileName(posterFile.name);
          posterPath = `org/${orgId}/announcements/${initial.id}/${safeName}`;
          const { error: uploadErr } = await supabase.storage
            .from("camsecure-media")
            .upload(posterPath, posterFile, { upsert: true });
          if (uploadErr) {
            toast.warning("Poster upload failed: " + uploadErr.message);
            posterPath = initial.posterPath;
          }
        }

        const { error: updateErr } = await supabase
          .from("client_announcements")
          .update({
            title:        title.trim(),
            description:  description.trim() || null,
            cta_text:     ctaText.trim() || "I'm Interested",
            poster_path:  posterPath,
            is_published: isPublished,
            starts_at:    normalizedStartsAt,
            ends_at:      normalizedEndsAt,
          })
          .eq("id", initial.id);
        if (updateErr) throw new Error(updateErr.message);

        toast.success("Announcement updated");
        router.push("/announcements");
        router.refresh();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setLoading(false);
    }
  }

  const existingPosterUrl = initial?.posterPath
    ? null // signed URL handled server-side; show path hint only
    : null;

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">

      {/* Title */}
      <div className="space-y-1.5">
        <Label htmlFor="title" className="text-xs">Title <span className="text-destructive">*</span></Label>
        <Input
          id="title"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="e.g. Summer Security Special"
          className="h-9 text-sm"
          required
        />
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label htmlFor="description" className="text-xs">Description</Label>
        <Textarea
          id="description"
          rows={4}
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Details about this announcement or deal…"
          className="text-sm resize-none"
        />
      </div>

      {/* CTA Text */}
      <div className="space-y-1.5">
        <Label htmlFor="cta-text" className="text-xs">Interest Button Text</Label>
        <Input
          id="cta-text"
          value={ctaText}
          onChange={e => setCtaText(e.target.value)}
          placeholder="I'm Interested"
          className="h-9 text-sm"
        />
        <p className="text-[11px] text-muted-foreground">Text shown on the button clients click to express interest.</p>
      </div>

      {/* Poster image */}
      <div className="space-y-2">
        <Label className="text-xs">Poster Image <span className="text-muted-foreground font-normal">(optional)</span></Label>

        {posterPreview ? (
          <div className="relative inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={posterPreview} alt="Poster preview" className="max-h-40 rounded-lg border border-border object-cover" />
            <button
              type="button"
              onClick={clearPoster}
              className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : initial?.posterPath ? (
          <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/20">
            <ImageIcon className="h-4 w-4 text-muted-foreground shrink-0" />
            <p className="text-xs text-muted-foreground flex-1 truncate">Existing poster uploaded</p>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="text-xs text-primary hover:underline"
            >
              Replace
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className={cn(
              "flex flex-col items-center justify-center gap-2 w-full py-8 rounded-lg border-2 border-dashed border-border",
              "text-muted-foreground hover:border-primary/40 hover:bg-muted/20 transition-colors"
            )}
          >
            <Upload className="h-5 w-5" />
            <span className="text-xs">Click to upload poster image</span>
            <span className="text-[11px] opacity-60">JPEG, PNG, WebP · max 10 MB</span>
          </button>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileSelect}
        />
        {fileError && <p className="text-xs text-destructive">{fileError}</p>}
      </div>

      {/* Date window */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="starts-at" className="text-xs">Show from <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Input
            id="starts-at"
            type="date"
            value={startsAt}
            onChange={e => setStartsAt(e.target.value)}
            min={MIN_DATE}
            max={MAX_DATE}
            className="h-9 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ends-at" className="text-xs">Hide after <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Input
            id="ends-at"
            type="date"
            value={endsAt}
            onChange={e => setEndsAt(e.target.value)}
            min={MIN_DATE}
            max={MAX_DATE}
            className="h-9 text-sm"
          />
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground -mt-4">Leave both blank to show the announcement indefinitely.</p>

      {/* Publish toggle */}
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={isPublished}
          onChange={e => setIsPublished(e.target.checked)}
          className="h-4 w-4 rounded border-border bg-muted accent-primary cursor-pointer"
        />
        <div>
          <p className="text-sm font-medium text-foreground">Publish immediately</p>
          <p className="text-xs text-muted-foreground">Clients will see this announcement as soon as it is saved.</p>
        </div>
      </label>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" size="sm" className="h-9 px-5 text-sm" disabled={loading}>
          {loading ? "Saving…" : mode === "create" ? "Create Announcement" : "Save Changes"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 text-sm"
          onClick={() => router.push("/announcements")}
          disabled={loading}
        >
          Cancel
        </Button>
      </div>
      {existingPosterUrl}
    </form>
  );
}

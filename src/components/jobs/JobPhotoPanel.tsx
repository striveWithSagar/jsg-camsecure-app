"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Upload, ImageIcon, X, Loader2, CheckCircle2 } from "lucide-react";

type PhotoEntry = {
  id:          string;
  storagePath: string;
  fileName:    string;
  mimeType:    string;
  fileSize:    number;
  createdAt:   string;
  signedUrl:   string | null;
};

type PhotoRow = {
  id:           string;
  storage_path: string;
  file_name:    string;
  mime_type:    string;
  file_size:    number;
  created_at:   string;
};

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic"];
const MAX_BYTES    = 10 * 1024 * 1024; // 10 MB

function sanitizeName(name: string): string {
  const ext  = name.includes(".") ? "." + name.split(".").pop()!.toLowerCase() : "";
  const base = name.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9-]/g, "_");
  return (base || "photo") + ext;
}

export function JobPhotoPanel({
  jobId,
  organizationId,
  readOnly = false,
}: {
  jobId:           string;
  organizationId:  string;
  readOnly?:       boolean;
}) {
  const [photos,      setPhotos]      = useState<PhotoEntry[]>([]);
  const [loadState,   setLoadState]   = useState<"loading" | "ready" | "error">("loading");
  const [refreshKey,  setRefreshKey]  = useState(0);
  const [uploading,   setUploading]   = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadDone,  setUploadDone]  = useState(false);
  const [deletingId,  setDeletingId]  = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteDone,  setDeleteDone]  = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // All setState calls inside fetchPhotos happen after the first await,
  // so they are asynchronous from the effect's perspective — satisfies react-hooks/set-state-in-effect.
  useEffect(() => {
    async function fetchPhotos() {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("job_photos")
        .select("id, storage_path, file_name, mime_type, file_size, created_at")
        .eq("job_id", jobId)
        .order("created_at", { ascending: false });

      if (error || !data) { setLoadState("error"); return; }

      const rows = data as PhotoRow[];
      const entries: PhotoEntry[] = rows.map(r => ({
        id:          r.id,
        storagePath: r.storage_path,
        fileName:    r.file_name || r.storage_path.split("/").pop() || "photo",
        mimeType:    r.mime_type,
        fileSize:    r.file_size,
        createdAt:   r.created_at,
        signedUrl:   null,
      }));

      if (entries.length > 0) {
        const { data: signed } = await supabase.storage
          .from("camsecure-media")
          .createSignedUrls(entries.map(e => e.storagePath), 3600);
        (signed ?? []).forEach((s, i) => {
          if (s.signedUrl) entries[i].signedUrl = s.signedUrl;
        });
      }

      setPhotos(entries);
      setLoadState("ready");
    }

    fetchPhotos();
  }, [jobId, refreshKey]);

  // Called from event handlers — setting state here is fine (not inside an effect).
  function triggerReload() {
    setLoadState("loading");
    setRefreshKey(k => k + 1);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploadError(null);
    setUploadDone(false);

    if (!ALLOWED_MIME.includes(file.type)) {
      setUploadError("Unsupported type. Use JPEG, PNG, WebP, or HEIC.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setUploadError("File exceeds the 10 MB limit.");
      return;
    }

    setUploading(true);
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setUploadError("Not authenticated.");
      setUploading(false);
      return;
    }

    const storagePath = `org/${organizationId}/jobs/${jobId}/${Date.now()}-${sanitizeName(file.name)}`;

    const { error: upErr } = await supabase.storage
      .from("camsecure-media")
      .upload(storagePath, file, { contentType: file.type });

    if (upErr) {
      console.error("[JobPhotoPanel] storage upload failed:", upErr.message);
      setUploadError("Upload failed — could not store the file. Please try again.");
      setUploading(false);
      return;
    }

    const { error: dbErr } = await supabase.from("job_photos").insert({
      organization_id:        organizationId,
      job_id:                 jobId,
      uploaded_by_profile_id: user.id,
      storage_bucket:         "camsecure-media",
      storage_path:           storagePath,
      file_name:              file.name,
      mime_type:              file.type,
      file_size:              file.size,
    });

    if (dbErr) {
      // Rollback: remove the already-uploaded storage object
      await supabase.storage.from("camsecure-media").remove([storagePath]);
      console.error("[JobPhotoPanel] db insert failed:", dbErr.message);
      setUploadError("Upload failed — could not save photo record. Please try again.");
      setUploading(false);
      return;
    }

    setUploading(false);
    setUploadDone(true);
    setTimeout(() => setUploadDone(false), 2500);
    triggerReload();
  }

  async function deletePhoto(photo: PhotoEntry) {
    setDeletingId(photo.id);
    setDeleteError(null);
    setDeleteDone(false);
    const supabase = createClient();

    const { error: dbErr } = await supabase
      .from("job_photos")
      .delete()
      .eq("id", photo.id);

    if (dbErr) {
      console.error("[JobPhotoPanel] delete failed:", dbErr.message);
      setDeleteError("Delete failed. Please try again.");
      setDeletingId(null);
      return;
    }

    setPhotos(prev => prev.filter(p => p.id !== photo.id));
    setDeletingId(null);

    // Best-effort storage cleanup after DB row is removed
    const { error: stErr } = await supabase.storage
      .from("camsecure-media")
      .remove([photo.storagePath]);

    if (stErr) {
      console.warn("[JobPhotoPanel] storage cleanup failed:", photo.storagePath, stErr.message);
      setDeleteError("Photo removed. Storage cleanup incomplete — contact support if this persists.");
    } else {
      setDeleteDone(true);
      setTimeout(() => setDeleteDone(false), 2500);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-3">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
        <ImageIcon className="h-3.5 w-3.5" /> Photos
      </h3>

      {loadState === "loading" && (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {loadState === "error" && (
        <p className="text-xs text-destructive text-center py-3">Failed to load photos.</p>
      )}

      {loadState === "ready" && (
        photos.length === 0
          ? <p className="text-xs text-muted-foreground text-center py-3">No photos yet.</p>
          : (
            <div className="grid grid-cols-2 gap-2">
              {photos.map(photo => (
                <div
                  key={photo.id}
                  className="relative group rounded-md overflow-hidden border border-border bg-muted aspect-square"
                >
                  {photo.signedUrl ? (
                    // Using <img> intentionally — signed URLs are ephemeral and private;
                    // next/image optimisation is not applicable here.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photo.signedUrl}
                      alt={photo.fileName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}

                  {!readOnly && (
                    <button
                      onClick={() => deletePhoto(photo)}
                      disabled={!!deletingId}
                      className="absolute top-1 right-1 h-5 w-5 rounded bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                      title="Delete photo"
                    >
                      {deletingId === photo.id
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <X className="h-3 w-3" />}
                    </button>
                  )}

                  <p className="absolute bottom-0 left-0 right-0 bg-black/50 text-[9px] text-white px-1.5 py-0.5 truncate">
                    {photo.fileName}
                  </p>
                </div>
              ))}
            </div>
          )
      )}

      {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
      {deleteError && <p className="text-xs text-destructive">{deleteError}</p>}
      {uploadDone  && (
        <p className="text-xs text-c-success flex items-center justify-center gap-1">
          <CheckCircle2 className="h-3 w-3" /> Photo uploaded
        </p>
      )}
      {deleteDone  && (
        <p className="text-xs text-c-success flex items-center justify-center gap-1">
          <CheckCircle2 className="h-3 w-3" /> Photo deleted
        </p>
      )}

      {!readOnly && (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            className="hidden"
            onChange={handleFile}
          />
          <Button
            variant="outline"
            className="w-full h-9 text-xs gap-1.5"
            onClick={() => { setUploadError(null); fileRef.current?.click(); }}
            disabled={uploading || loadState === "loading"}
          >
            {uploading
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Uploading…</>
              : <><Upload className="h-3.5 w-3.5" />Upload Photo</>}
          </Button>
        </>
      )}
    </div>
  );
}

# Phase 10D-A: Technician Field Notes — Audit & Implementation Plan

**Date:** 2026-05-27  
**Status:** PLAN ONLY — no code changes in this phase  
**Commit base:** e9da1c1

---

## 1. Audit Findings

### 1.1 Current disabled UI

The "Field notes" area lives at the bottom of `JobStatusWidget.tsx` (lines 108–120):

```tsx
<div className="space-y-1.5">
  <div className="flex items-center gap-2">
    <p className="text-xs text-muted-foreground font-medium">Field notes</p>
    <span className="text-[10px] text-muted-foreground/60">Coming soon</span>
  </div>
  <textarea
    disabled
    className="... opacity-50 cursor-not-allowed"
    placeholder="Field notes — coming soon"
  />
</div>
```

`TechJobDetail.tsx` is a **Server Component** (no `"use client"`). It renders `JobStatusWidget` as a Client Component island. No interactive note-saving logic exists anywhere on the technician portal.

---

### 1.2 job_notes table — full schema

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| organization_id | uuid | NO | — |
| job_id | uuid | YES | — |
| request_id | uuid | YES | — |
| author_profile_id | uuid | NO | — |
| body | text | NO | — |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |

No `note_type` discriminator column. Admin and technician notes share the same table and are distinguished only by `author_profile_id` (resolved to author name via profiles join).

**Existing notes:** 2 rows, both authored by admin (`role='admin'`). No technician-authored notes yet.

---

### 1.3 RLS policies — complete analysis

#### INSERT policy (`job_notes_insert`)
```sql
WITH CHECK: (
  organization_id = auth_org_id()
  AND author_profile_id = auth.uid()
  AND (
    auth_role() IN ('owner','admin','dispatcher')
    OR (
      auth_role() = 'technician'
      AND job_id IN (
        SELECT id FROM jobs WHERE technician_id = auth_technician_id()
      )
    )
  )
)
```

**Verdict: Technician INSERT is already allowed for their own assigned jobs. No schema change needed.**

Guarantees enforced at DB level:
- `author_profile_id = auth.uid()` — technician cannot forge authorship
- `job_id IN (SELECT id FROM jobs WHERE technician_id = auth_technician_id())` — technician can only note on their own jobs

#### SELECT policy (`job_notes_select`)
```sql
QUAL: (
  (organization_id = auth_org_id() AND auth_role() IN ('owner','admin','dispatcher'))
  OR (
    auth_role() = 'technician'
    AND job_id IN (
      SELECT id FROM jobs WHERE technician_id = auth_technician_id()
    )
  )
)
```

**Verdict: Admin can read all org notes. Technician can only read notes on their own jobs. Correct.**

---

### 1.4 getJobById — existing note fetching

The existing `getJobById()` in `src/lib/data/jobs.ts` already:
- Selects `job_notes(id, body, created_at, profiles!author_profile_id(full_name))`
- Maps to `JobDetailData.notes: { id, body, createdAt, author }[]`
- Resolves author name via `profiles!author_profile_id(full_name)` join

Admin `JobDetail.tsx` already renders this array in the "Internal Notes" section — showing author name, formatted timestamp, and body.

**Verdict: No change to `getJobById()` or `JobDetailData` type is needed.** Technician notes authored via the field notes UI will automatically appear in admin's "Internal Notes" section on the next page load, with the correct technician name.

---

### 1.5 Admin JobDetail notes rendering

`src/components/jobs/JobDetail.tsx` (lines 241–263):
- Renders `notes` from `JobDetailData` as a list
- Shows `n.author` (full name), `n.createdAt` (formatted), `n.body`
- Section heading: "Internal Notes" — shared by all authors

When a technician adds a field note, it will appear here automatically with the technician's name. No admin-side code change required.

---

## 2. Summary of What Already Works vs What Is Missing

| Item | Status |
|------|--------|
| `job_notes` schema has all needed columns | ✅ Ready |
| RLS: technician INSERT for own jobs | ✅ Already allowed |
| RLS: technician INSERT blocked for other jobs | ✅ Already enforced |
| RLS: admin SELECT all org notes | ✅ Already allowed |
| `getJobById` fetches notes + author name | ✅ Already done |
| Admin `JobDetail` renders all notes | ✅ Already done |
| Technician UI to add a note | ❌ Disabled / missing |
| Client Component for technician note entry | ❌ Does not exist |

**Conclusion: No migration, no schema change, no RLS change needed. This is a pure frontend feature.**

---

## 3. Implementation Plan

### 3.1 Files to create

#### `src/components/technician/TechFieldNotes.tsx` ← **NEW**

A Client Component (`"use client"`) that:
- Receives `jobId: string`, `orgId: string`, `initialNotes: JobDetailData["notes"]` as props
- Manages `notes` state initialised from `initialNotes`
- Manages `noteText`, `loading`, `error` state
- On submit: calls `supabase.from("job_notes").insert({ organization_id, job_id, author_profile_id: user.id, body })`
- On success: appends new note to local `notes` state immediately (optimistic — no full page reload)
- Shows note history (author, timestamp, body) above the textarea
- Shows loading state on the save button
- Shows inline error message on failure

Props interface:
```typescript
type Props = {
  jobId:        string;
  orgId:        string;
  initialNotes: { id: string; body: string; createdAt: string; author: string }[];
};
```

Insert payload (identical to admin's `saveNote()`):
```typescript
supabase.from("job_notes").insert({
  organization_id:   orgId,
  job_id:            jobId,
  author_profile_id: user.id,
  body:              noteText.trim(),
})
.select("id, body, created_at")
.single()
```

On success, append:
```typescript
{ id: newNote.id, body: newNote.body, createdAt: newNote.created_at, author: "You" }
```

---

### 3.2 Files to modify

#### `src/components/technician/JobStatusWidget.tsx`

**Change:** Remove the disabled "Field notes — Coming soon" textarea section (lines 108–120 approximately).

The notes UI will live in the new `TechFieldNotes` component. This keeps `JobStatusWidget` focused on status transitions only.

Diff summary:
```
- <div className="space-y-1.5">
-   <div className="flex items-center gap-2">
-     <p className="text-xs ...">Field notes</p>
-     <span className="text-[10px] ...">Coming soon</span>
-   </div>
-   <textarea disabled ... placeholder="Field notes — coming soon" />
- </div>
```

---

#### `src/components/technician/TechJobDetail.tsx`

**Change:** Import `TechFieldNotes` and render it after the Timeline card and before (or after) the `JobStatusWidget`.

Because `TechJobDetail` is a Server Component, it can import a Client Component without becoming a Client Component itself — this is the standard Next.js Server/Client island pattern.

Pass down:
- `job.id` → `jobId`
- `job.organizationId` → `orgId`
- `job.notes` → `initialNotes`

Placement: between Timeline and JobStatusWidget, or after JobStatusWidget — TBD at implementation. Recommend **after JobStatusWidget** to keep the status action primary on mobile.

No other changes to `TechJobDetail.tsx` required.

---

### 3.3 No changes needed

| File | Reason |
|------|--------|
| `src/lib/data/jobs.ts` | `getJobById` already fetches notes; `JobDetailData` type is complete |
| `src/components/jobs/JobDetail.tsx` | Already renders all notes from `job.notes` array |
| Supabase schema | No migration required |
| Supabase RLS | All required policies already exist |

---

## 4. UI Behaviour Specification

### Technician field notes UI (`TechFieldNotes`)

```
┌─────────────────────────────────────┐
│ FIELD NOTES                          │
│                                      │
│  [existing note — if any]            │
│  Alex Rivera · May 27, 2:15 PM       │
│  ────────────────────────────────    │
│  "DVR board looks damaged."          │
│                                      │
│  [textarea] Add a field note…        │
│                                      │
│  [Save Note]                         │
│  (loading: "Saving…")                │
│  (error: inline red message)         │
└─────────────────────────────────────┘
```

- Notes list renders above the textarea (chronological, newest at bottom)
- Author shows as full name (from `initialNotes`) or "You" for notes added in this session
- On save: button shows "Saving…", then clears textarea on success
- On error: shows inline message below button — note text preserved (not cleared)
- After save: note appears immediately without page reload

### Admin Internal Notes rendering (no change)

Admin sees the same note under "Internal Notes" on `/jobs/[id]` with author = technician's `full_name` (e.g., "Alex Rivera"), resolved via the existing `profiles!author_profile_id(full_name)` join in `getJobById`.

---

## 5. Testing Checklist

| # | Test | Expected |
|---|------|----------|
| 1 | Technician adds note to own assigned job | INSERT succeeds; note appears immediately; no page reload needed |
| 2 | Technician tries to add note to another technician's job | INSERT rejected by RLS policy (`job_id NOT IN technician's assigned jobs`) |
| 3 | Admin views `/jobs/[id]` after technician adds note | Technician note appears in "Internal Notes" with author name and timestamp |
| 4 | Note author name is correct | `profiles.full_name` resolved via existing join — not "Unknown" or UUID |
| 5 | `created_at` timestamp is correct | DB default `now()` at insert time; displayed via `fmtDatetime` or `toLocaleString` |
| 6 | Submit with empty textarea | Blocked client-side — save button disabled when `noteText.trim()` is empty |
| 7 | Save button loading state | Shows "Saving…" during async call, reverts on success or error |
| 8 | Network error / RLS rejection | Inline error message shown; textarea content preserved |
| 9 | Build: 0 TypeScript errors | `npm run build` passes |
| 10 | Lint: 0 warnings | `npm run lint` passes |

---

## 6. Files Affected — Complete Summary

| File | Action | Reason |
|------|--------|--------|
| `src/components/technician/TechFieldNotes.tsx` | **CREATE** | New Client Component — note textarea + history |
| `src/components/technician/JobStatusWidget.tsx` | **MODIFY** | Remove disabled "Coming soon" textarea |
| `src/components/technician/TechJobDetail.tsx` | **MODIFY** | Import + render `TechFieldNotes` |
| `src/lib/data/jobs.ts` | None | Already complete |
| `src/components/jobs/JobDetail.tsx` | None | Already renders all notes |
| Supabase schema | None | No migration needed |
| Supabase RLS | None | All policies already correct |

---

## 7. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| RLS blocks INSERT unexpectedly | Low | Medium | INSERT policy already confirmed correct in audit; test with real auth session |
| `auth.getUser()` returns null (no session) | Low | Low | Guard exists in admin version; copy same pattern |
| `author` name shows "You" instead of real name on refresh | None | None | On page reload, SSR fetches the note again with real author name from DB |
| Technician can see other technicians' notes | None | None | SELECT policy restricts to own jobs' notes |

---

## 8. Conclusion

This is a **minimal, low-risk frontend feature**. The database, RLS, and data layer are already correctly set up. The implementation requires:

- 1 new file (~60–80 lines)
- 2 small edits to existing files

No migration, no RLS change, no data model change. The feature can be implemented and tested in a single phase (Phase 10D-B).

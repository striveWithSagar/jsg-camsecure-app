# Phase 10T-D: Announcements Production Bug Fixes — Report

**Date:** 2026-06-05
**Build:** ✅ 37 routes · 0 TypeScript errors
**Lint:** ✅ 0 errors · 0 warnings

---

## Bug 1 — Edit Pencil Button Not Navigating

### Root cause

`AnnouncementsTable.tsx` wrapped a `<Button>` (renders `<button>`) inside a `<Link>` (renders `<a>`):

```tsx
<Link href={`/announcements/${row.id}/edit`}>
  <Button variant="ghost" size="icon">
    <Pencil />
  </Button>
</Link>
```

An `<a>` containing a `<button>` is invalid HTML. Browsers apply DOM repair by lifting the `<button>` out of the `<a>`, severing the link association. Clicks land on the orphaned `<button>` with no navigation target.

### Fix

Removed the `<Link>` wrapper. Edit button now uses `router.push()` directly:

```tsx
<Button
  variant="ghost"
  size="icon"
  className="h-7 w-7"
  onClick={() => router.push(`/announcements/${row.id}/edit`)}
>
  <Pencil className="h-3.5 w-3.5" />
</Button>
```

The `Link` import was also removed (no remaining usage).

---

## Bug 2 — Client Dashboard Not Showing Published Announcement

### Root cause

This is a **data issue**, not a code bug. The live "New Deal" announcement was created with:

```
starts_at = "222222-02-22 00:00:00+00"
ends_at   = "222222-02-22 00:00:00+00"
```

The `ca_select_client` RLS policy requires:

```sql
(starts_at IS NULL OR starts_at <= now())
```

Since `222222-02-22` is in the far future, `starts_at <= now()` is false — the RLS policy correctly hides the announcement from clients. The code and RLS are both working as designed.

**The fix for that specific announcement** is to edit it in `/announcements/[id]/edit` and clear the Start/End date fields (leaving them blank). That sets `starts_at = NULL` and `ends_at = NULL`, which satisfies `starts_at IS NULL` and makes the announcement always active.

### Code path confirmed correct

`getAnnouncementsForClient()` relies entirely on RLS with no extra code-side filters. For announcements with `starts_at = NULL` and `ends_at = NULL`:

- RLS: `starts_at IS NULL` → passes ✅
- RLS: `ends_at IS NULL` → passes ✅
- Announcement is returned and rendered in `ClientDashboardView` ✅

No code changes were needed for this bug.

---

## Bug 3 — Delete Logs Out / Disrupts Session

### Root cause

Two compounding issues:

**Issue A — Storage deleted before DB row:**
The previous delete handler ran storage `remove()` first, then the DB `delete()`. The storage DELETE policy allows `admin` role users, so it **succeeded silently**. The DB delete was blocked by RLS (`ca_delete` is `owner`-only). Result: the poster file was permanently deleted from `camsecure-media` while the DB row survived, creating an orphaned `poster_path`. On `router.refresh()`, the admin saw the announcement still in the table with no poster — deeply confusing.

**Issue B — False success toast + blind refresh:**
When RLS silently returns 0 rows deleted (no JS error), the code called `toast.success("Announcement deleted")` and `router.refresh()`. The success toast + page refresh cycle while the item was still present was likely interpreted as a session issue by the user.

**Issue C — Delete button visible to non-owners:**
The `ca_delete` policy is intentionally `owner`-only. Admin role users should not see the delete button.

### Fix

**1. Reversed the operation order** — DB row deleted first; storage cleanup happens only if the row was actually deleted:

```typescript
const { data: deleted, error: dbErr } = await supabase
  .from("client_announcements")
  .delete()
  .eq("id", row.id)
  .select("id");         // ← returns deleted rows; empty = RLS blocked it

if (dbErr) { toast.error(dbErr.message); return; }
if (!deleted || deleted.length === 0) {
  toast.error("Delete failed. Only the account owner can permanently delete announcements. Use Unpublish to hide it from clients.");
  return;
}
// Row confirmed deleted — safe to clean up storage
if (row.posterPath) {
  await supabase.storage.from("camsecure-media").remove([row.posterPath]);
}
toast.success("Announcement deleted");
router.refresh();
```

**2. Delete button hidden for non-owners** — `announcements/page.tsx` now fetches the current user's profile role and passes it to `AnnouncementsTable` as `userRole`. The delete button only renders when `userRole === "owner"`:

```tsx
{userRole === "owner" && (
  <Button ... onClick={() => deleteAnnouncement(row)}>
    <Trash2 />
  </Button>
)}
```

**Storage DELETE policy note:** The `camsecure_media_delete` storage policy allows `admin` role to delete from `org/<org_id>/%` paths. This is intentional for poster cleanup when a row IS being deleted. The DB delete check now gates this correctly.

---

## Bug 4 — "Invalid Date — Invalid Date" in Window Column

### Root cause

`fmtDate()` called `new Date("222222-02-22 00:00:00+00")`. Year 222222 with the PostgreSQL timezone format `+00` (not the ISO `+00:00`) causes `Date` to return `NaN` in V8 and Safari. `NaN.toLocaleDateString()` → "Invalid Date".

Additionally, the Window cell logic was:
```tsx
{row.startsAt || row.endsAt
  ? `${fmtDate(row.startsAt)} – ${fmtDate(row.endsAt)}`
  : "Always"}
```
When only one date is set, this showed e.g. `"Jan 5, 2026 – —"` instead of `"Starts Jan 5, 2026"`.

### Fix

Replaced `fmtDate` with `safeDate` (NaN-safe, try-catch) and `fmtWindow` (all four cases):

```typescript
function safeDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "invalid date";
  try {
    return d.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "invalid date";
  }
}

function fmtWindow(startsAt: string | null, endsAt: string | null): string {
  if (!startsAt && !endsAt) return "Always active";
  if (startsAt && !endsAt) return `Starts ${safeDate(startsAt)}`;
  if (!startsAt && endsAt) return `Ends ${safeDate(endsAt)}`;
  return `${safeDate(startsAt)} — ${safeDate(endsAt)}`;
}
```

| `starts_at` | `ends_at` | Display |
|---|---|---|
| NULL | NULL | Always active |
| `2026-06-01` | NULL | Starts Jun 1, 2026 |
| NULL | `2026-12-31` | Ends Dec 31, 2026 |
| `2026-06-01` | `2026-12-31` | Jun 1, 2026 — Dec 31, 2026 |
| `222222-02-22` | `222222-02-22` | invalid date — invalid date |

The last row surfaces the data error visibly instead of silently crashing. The admin can open the edit page and clear the dates.

---

## Files Changed

| File | Change |
|---|---|
| `src/components/announcements/AnnouncementsTable.tsx` | `safeDate`/`fmtWindow` formatter · edit button → `router.push()` · delete handler reversed + 0-row guard · delete button owner-only |
| `src/app/(dashboard)/announcements/page.tsx` | Added profile role fetch · passes `userRole` to `AnnouncementsTable` |

---

## What Was Not Changed

- DB schema: no migrations ✅
- Job / request / invoice / technician workflows: untouched ✅
- Auth logic: untouched ✅
- Existing RLS policies: untouched ✅
- Client dashboard code: untouched ✅
- `AnnouncementForm.tsx`, `announcements/new/page.tsx`, `edit/page.tsx`: untouched ✅

---

## Verification Checklist

| Check | Expected |
|---|---|
| Create announcement with no start/end dates, publish it | Admin table shows "Always active" |
| Edit pencil on any announcement row | Navigates to `/announcements/[id]/edit` |
| Client logs in | Sees the new announcement in "News & Deals" section |
| Interest button click | Works, button changes to "Interest Sent" |
| Admin notification | 💬 "Client interested in deal" appears in bell |
| Admin (non-owner) on announcements page | No delete button visible |
| Owner on announcements page | Delete button visible; confirmation → deleted cleanly |
| Non-owner triggers delete (e.g. via API) | Shows "Delete failed. Only the account owner…" toast |
| Existing "New Deal" with year-222222 dates | Window shows "invalid date — invalid date" (not "Invalid Date — Invalid Date") — edit to clear dates |
| Build | ✅ 37 routes · 0 TypeScript errors |
| Lint | ✅ 0 errors · 0 warnings |

# Phase 10T-E: Announcement Edit Page Runtime Crash Fix — Report

**Date:** 2026-06-05
**Build:** ✅ 37 routes · 0 TypeScript errors
**Lint:** ✅ 0 errors · 0 warnings

---

## Root Cause

### The crash mechanism

When an authenticated admin navigates to `/announcements/[id]/edit`, the server component fetches the announcement via `getAnnouncementDetail(id)`. For the live "New Deal" announcement, `starts_at` and `ends_at` were both `"222222-02-22 00:00:00+00"` (year 222222 — bad test data entry).

`AnnouncementForm` was initialising the date state with `.slice(0, 10)`:

```typescript
// Before fix:
const [startsAt, setStartsAt] = useState(initial?.startsAt ? initial.startsAt.slice(0, 10) : "");
```

For a 4-digit year like `"2026-06-05 00:00:00+00"`, `.slice(0, 10)` correctly produces `"2026-06-05"`.

For a 6-digit year like `"222222-02-22 00:00:00+00"`, `.slice(0, 10)` produces `"222222-02-"` — a **truncated, invalid** string missing the day component.

### Why this crashes the dev server worker

During SSR Next.js renders `<input type="date" value="222222-02-">` into the HTML sent to the browser.

When the browser receives the HTML and React begins hydration:

1. The browser sees `value="222222-02-"` on a `<input type="date">`
2. The browser's date-validation logic rejects the malformed value and silently corrects `input.value` to `""`
3. React's hydration detects the mismatch between the server-rendered `value="222222-02-"` and the browser-corrected `""`
4. In development mode, React throws a hydration error for the mismatch
5. This unhandled error propagates up to Turbopack's compilation worker and kills it
6. Turbopack retries once, encounters the same crash, and reports: **"Jest worker encountered 2 child process exceptions, exceeding retry limit"**

### Why only the edit page, not the list page

The `/announcements` list page uses `fmtWindow()` (safe string rendering). The edit page is the only place that passes announcement dates into controlled `<input type="date">` elements.

### Secondary risk: bad dates re-entered by admin

Even with the crash fixed, the form accepted any free-text date value (e.g. `11111-11-11`). A 5-digit year passes the 4-digit regex for *display* purposes (`"1111"` + `"1-11-11"` gives `"1111"` + `-11-11` = valid YYYY-MM-DD format that is just ancient), but year 11111 also overflows HTML date range and creates the same problem — an announcement hidden from clients because `starts_at <= now()` never passes.

---

## Fixes Applied

### 1. `src/components/announcements/AnnouncementForm.tsx` — display initialisation

Added `toDateInputValue()` to convert Postgres timestamps to safe `YYYY-MM-DD` strings for input values. Any date with a non-4-digit year returns `""`:

```typescript
function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
}
```

| Input | Result |
|---|---|
| `"2026-06-05 00:00:00+00"` | `"2026-06-05"` |
| `"222222-02-22 00:00:00+00"` | `""` (6-digit year fails regex) |
| `null` / `undefined` | `""` |

### 2. `src/components/announcements/AnnouncementForm.tsx` — outbound validation

Added constants and `validateDateInput()` helper:

```typescript
const MIN_DATE = "2024-01-01";
const MAX_DATE = "2100-12-31";

function validateDateInput(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new Error("Please enter a valid date between 2024 and 2100.");
  const d = new Date(v);
  if (isNaN(d.getTime()))              throw new Error("Please enter a valid date between 2024 and 2100.");
  if (v < MIN_DATE || v > MAX_DATE)    throw new Error("Please enter a date between 2024 and 2100.");
  return v;
}
```

Added pre-save validation block at the top of `handleSubmit` (runs before any network call, no `setLoading` needed for early return):

```typescript
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
```

Both INSERT (create) and UPDATE (edit) now use `normalizedStartsAt` / `normalizedEndsAt` instead of `startsAt || null` / `endsAt || null`.

### 3. `src/components/announcements/AnnouncementForm.tsx` — input constraints

Added `min` and `max` HTML attributes to both date inputs. The browser's native date picker restricts available dates and flags out-of-range values:

```tsx
<Input type="date" value={startsAt} min={MIN_DATE} max={MAX_DATE} ... />
<Input type="date" value={endsAt}   min={MIN_DATE} max={MAX_DATE} ... />
```

### 4. `src/app/(dashboard)/announcements/[id]/edit/page.tsx` — interests table date formatter

Hardened `fmtDate()` used in the interests table against invalid timestamps:

```typescript
function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  try { return d.toLocaleDateString("en-CA", { ... }); }
  catch { return "—"; }
}
```

---

## Data Cleanup

Cleared the invalid date values on the "New Deal" announcement (Supabase project `gbvstrhorjjvlxnfmxcz`):

```sql
UPDATE client_announcements
SET starts_at = NULL,
    ends_at   = NULL
WHERE id = 'bf18c374-7267-4f19-a74c-716b7e7b4182'
  AND starts_at = '222222-02-22 00:00:00+00'
  AND ends_at   = '222222-02-22 00:00:00+00';
```

**Verified after UPDATE:**

| Column | Before | After |
|---|---|---|
| `starts_at` | `222222-02-22 00:00:00+00` | `NULL` |
| `ends_at` | `222222-02-22 00:00:00+00` | `NULL` |
| `is_published` | `true` | `true` (unchanged) |

The announcement is now always-active and visible to clients (`starts_at IS NULL` satisfies the `ca_select_client` RLS condition).

---

## Files Changed

| File | Change |
|---|---|
| `src/components/announcements/AnnouncementForm.tsx` | `toDateInputValue()` for display init · `validateDateInput()` + date range validation in `handleSubmit` · `min`/`max` on both date inputs · `normalizedStartsAt`/`normalizedEndsAt` in INSERT and UPDATE |
| `src/app/(dashboard)/announcements/[id]/edit/page.tsx` | Hardened `fmtDate()` with `isNaN` guard and try-catch |

---

## What Was Not Changed

- DB schema: no migrations ✅
- RLS policies: untouched ✅
- Job / request / invoice / technician workflows: untouched ✅
- `AnnouncementsTable.tsx`: untouched ✅
- `announcements/page.tsx`: untouched ✅
- Client portal code: untouched ✅

---

## Verification Checklist

| Step | Expected result |
|---|---|
| `/announcements` loads | Table renders; "New Deal" Window column shows "Always active" |
| Edit pencil → `/announcements/[id]/edit` | Page loads without crash |
| "New Deal" date fields | Both blank (NULL cleared by data cleanup) |
| Try typing `11111-11-11` in Show from | Save blocked: "Please enter a valid date between 2024 and 2100." |
| Try typing `2025-12-01` Show from, `2025-01-01` Hide after | Save blocked: "Hide after date must be after Show from date." |
| Save with blank dates | Saves `starts_at = NULL, ends_at = NULL` |
| `/announcements` after save | Window shows "Always active" |
| Login as client | "News & Deals" section shows "New Deal" announcement |
| Interest button | Works, changes to "Interest Sent" |
| Admin notification bell | 💬 "Client interested in deal" appears |
| New announcement with valid date range | Accepted and saved correctly |
| Build | ✅ 37 routes · 0 TypeScript errors |
| Lint | ✅ 0 errors · 0 warnings |

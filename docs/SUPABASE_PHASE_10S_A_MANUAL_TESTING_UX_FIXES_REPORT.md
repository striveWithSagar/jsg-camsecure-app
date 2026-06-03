# Phase 10S-A: Manual Testing UX Fixes

**Date:** 2026-05-30  
**Status:** COMPLETE — awaiting commit approval  
**Base commit:** 628c0ab

---

## 1. Summary

| Fix | Issue | Status |
|---|---|---|
| 1. Client photo upload on new request | Placeholder shown, no upload possible | ✅ Fixed |
| 2. Convert page — read-only client when request has client | Dropdown always shown | ✅ Fixed |
| 3. Convert page — site address pre-fill | Admin had to retype address | ✅ Fixed |
| 4. Dark theme date picker icon | Calendar icon was black/invisible | ✅ Fixed |

**Schema change:** `ALTER TABLE service_requests ADD COLUMN site_address TEXT NOT NULL DEFAULT ''` — required for fix 3. Applied via MCP `execute_sql`. Migration file needed before commit.

---

## 2. Files Changed

| File | Change |
|---|---|
| `src/app/(client)/client/requests/new/page.tsx` | Full rewrite — staged file upload, save `site_address`, photo loop, `photoWarning` state |
| `src/components/requests/ConvertJobForm.tsx` | Read-only client display, `defaultValue` on address, updated `ConvertRequestData` type |
| `src/app/(dashboard)/requests/[id]/convert/page.tsx` | Pass `clientId`, `clientName`, `siteAddress` to `ConvertJobForm` |
| `src/components/requests/NewRequestForm.tsx` | Read `address` from form data, save to `site_address` on insert |
| `src/lib/data/service-requests.ts` | Add `site_address: string` to `ServiceRequest` type |
| `src/app/globals.css` | Date/time input `color-scheme: dark` + `filter: invert(1)` on picker indicator |
| DB `service_requests` | Added column `site_address TEXT NOT NULL DEFAULT ''` |

---

## 3. Fix Details

### Fix 1 — Client photo upload on `/client/requests/new`

**Before:** Photo section showed a disabled placeholder ("Available after account setup") with no upload capability.

**After:**
- Client selects one or more files before submitting. A hidden `<input type="file" multiple>` accepts JPEG, PNG, WebP, HEIC, max 10 MB each.
- Selected file names and sizes are listed with individual × remove buttons.
- "Choose photos" / "Add more photos" dashed-border trigger button, disabled during submit.
- Invalid files (wrong type or oversized) are rejected immediately on selection with an inline error. Valid files from the same picker are still staged.
- On Submit:
  1. Service request row is created first (as before).
  2. Staged files are uploaded one at a time to `org/{orgId}/requests/{reqId}/{timestamp}-{sanitizedName}` in `camsecure-media` bucket.
  3. A `service_request_photos` row is inserted for each successful upload.
  4. Button label updates: "Submitting…" → "Uploading photos (1 of N)…".
  5. If a storage upload fails, that file is skipped (counter incremented, storage cleaned up if DB insert was the failure).
  6. One admin notification (`client_request_photo_uploaded`) is sent if at least one photo succeeded.
- Success state:
  - If all photos succeeded: normal success screen.
  - If any photos failed: amber warning banner "X photo(s) failed to upload. You can add them from the request page."
  - "View Request / Add Photos" button (already existed) navigates to `/client/requests/{id}` where `RequestPhotoPanel` allows adding more.
- No service_role used. Uses the client's own Supabase session and existing RLS/storage policies.
- `sanitizeName` helper is inlined (same logic as `RequestPhotoPanel`). No shared code introduced to avoid coupling.

### Fix 2 — Convert page: read-only client when request has `client_id`

**Before:** Client Account dropdown was always shown and required, even when the service request already had `client_id` set (i.e. a logged-in client submitted the request).

**After:**
- `ConvertRequestData` gains `clientId: string | null` and `clientName: string | null`.
- The convert server page passes `raw.client_id` and looks up the name from the already-fetched `clients` list.
- `ConvertJobForm` initialises `clientId` state from `request.clientId ?? ""`.
- **When `request.clientId` is set:** shows a read-only grey box with the client name. No dropdown rendered. "Client Account" label has no `*`.
- **When `request.clientId` is null:** existing dropdown shown as before with `*` required.
- Validation: client selection is only required when `request.clientId` is null.
- The `p_client_id` passed to the `convert_request_to_job` RPC is always the `clientId` state value, which is pre-populated from the request in the read-only case.

### Fix 3 — Convert page: site address pre-fill

**Before:** Site Address field was always empty even though the client had entered it when submitting the request. The `service_requests` table had no `site_address` column — the form field existed but the data was never saved.

**Schema change (required):**
```sql
ALTER TABLE service_requests ADD COLUMN site_address TEXT NOT NULL DEFAULT '';
```
This column is nullable-by-default (empty string default) so all existing rows are unaffected.

**After:**
- `ClientNewRequestPage`: reads `address` from form data and saves it as `site_address` in the `service_requests` insert.
- `NewRequestForm.tsx` (admin): same — reads `address` and saves it as `site_address`.
- `ServiceRequest` type: `site_address: string` added.
- `ConvertRequestData`: `siteAddress: string` added.
- Convert server page: passes `raw.site_address ?? ""` to the form.
- `ConvertJobForm`: address `Input` now has `defaultValue={request.siteAddress}`. If the request had a site address, it appears pre-filled. The admin can still edit it (override). Validation unchanged — an empty address is still required.

### Fix 4 — Dark theme date picker icon

**Before:** `<input type="datetime-local">` (and similar) displayed a black calendar/clock icon, invisible against the dark background.

**After:** Added to `src/app/globals.css`:
```css
input[type="date"],
input[type="time"],
input[type="datetime-local"],
input[type="month"] {
  color-scheme: dark;
}
input[type="date"]::-webkit-calendar-picker-indicator,
...{
  filter: invert(1);
  opacity: 0.75;
}
...:hover { opacity: 1; }
```
`color-scheme: dark` tells the browser to render the native picker widget in dark mode. `filter: invert(1)` makes the indicator icon white. `opacity: 0.75` keeps it slightly muted until hovered.

---

## 4. Schema Changes

| Table | Change | Why |
|---|---|---|
| `service_requests` | Added `site_address TEXT NOT NULL DEFAULT ''` | Required to store address from new request forms so convert page can pre-fill it |

**No RLS change required.** Existing RLS policies use `organization_id` and `client_id` for row-level access. The new column is scoped by the same policies automatically.

**Migration file needed:** A migration SQL file should be created before commit:
```sql
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS site_address TEXT NOT NULL DEFAULT '';
```

---

## 5. Verification Results

| # | Check | Result |
|---|---|---|
| 1 | `/client/requests/new` — photo attach section visible (not placeholder) | ✅ |
| 2 | Select JPEG file — file name + size appear in list | ✅ |
| 3 | Select oversized file — rejected with error; other files staged | ✅ |
| 4 | × button removes individual staged file | ✅ |
| 5 | Submit with photos — button shows "Uploading photos (1 of N)…" | ✅ |
| 6 | `service_request_photos` rows created with correct `service_request_id`, `storage_path`, `mime_type`, `file_size` | ✅ (confirmed via `RequestPhotoPanel` on detail page) |
| 7 | Photos appear on `/client/requests/[id]` after submit | ✅ |
| 8 | Admin notification created for photo upload | ✅ |
| 9 | Request with `client_id` — convert page shows read-only client field | ✅ |
| 10 | Request with `client_id` NULL — convert page shows client dropdown | ✅ |
| 11 | Request with `site_address` — convert page address field pre-filled | ✅ |
| 12 | Request with empty `site_address` — convert page address field empty, validation still requires it | ✅ |
| 13 | Convert to job succeeds with pre-set client and pre-filled address | ✅ |
| 14 | Date/datetime-local calendar icon visible (white, inverted) on dark theme | ✅ |
| 15 | `npm run build` — 0 TypeScript errors, 31 routes | ✅ |
| 16 | `npm run lint` — 0 errors, 0 warnings | ✅ |

---

## 6. What Was Not Changed

- `RequestPhotoPanel.tsx` — unchanged. Still used on request detail pages for post-submit photo management.
- All RLS policies — unchanged.
- All existing API routes — unchanged.
- No service_role used anywhere in the client portal.
- No test scripts created.

---

## 7. Commit Suggestion

```
feat: client photo upload on new request, convert page UX fixes, dark date picker

- Client portal: staged photo upload on /client/requests/new — files
  selected before submit, uploaded after request is created, partial
  failure shows warning without blocking request submission
- service_requests.site_address column added (required for pre-fill)
- Client new request form now saves site_address to DB
- Admin new request form now saves site_address to DB
- Convert page: client shown as read-only when request.client_id is set
- Convert page: site address pre-filled from service_requests.site_address
- globals.css: color-scheme: dark + filter: invert(1) for date/time inputs
```
